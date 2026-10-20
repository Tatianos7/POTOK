/** Inactive owner-only account closure request boundary.
 * This is NOT an endpoint or a deletion implementation. A future trusted adapter
 * must authorize the same live user, serialize admission in SQL and return a
 * committed receipt. No admin privileges, service-role fallback or JWT parsing.
 */
export const accountClosureRequestContractV1 = 'potok-account-closure-request-v1' as const;
export const accountClosureReceiptContractV1 = 'potok-account-closure-receipt-v1' as const;

const uuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const plainRecord = (value: unknown): value is Record<string, unknown> =>
  value !== null && typeof value === 'object' && !Array.isArray(value)
  && Object.getPrototypeOf(value) === Object.prototype;
const exact = (value: Record<string, unknown>, keys: string[]): boolean =>
  Object.keys(value).length === keys.length && keys.every(key =>
    Object.prototype.hasOwnProperty.call(value, key));

export type ClosureOwnerRequestV1 = Readonly<{
  contract: typeof accountClosureRequestContractV1;
  closureKey: string;
}>;
export type ClosureCommittedReceiptV1 = Readonly<{
  contract: typeof accountClosureReceiptContractV1;
  accountId: string;
  closureKey: string;
  state: 'CLOSING';
  revision: string;
}>;
export type ClosureOutcomeV1 =
  | Readonly<{ kind: 'CONFIRMED'; receipt: ClosureCommittedReceiptV1 }>
  | Readonly<{ kind: 'UNKNOWN'; actorId: string; closureKey: string }>;
export interface ClosureOwnerPortV1 {
  /** Must verify the JWT through actual Auth/session infrastructure, not parse claims. */
  verifyUser(token: string): Promise<{ id: string } | null>;
  /** Must atomically authenticate and authorize the actor and transition the
   * matching account from ACTIVE to CLOSING in the same DB transaction.
   * An injected mock cannot provide this guarantee in production.
   */
  beginForVerifiedActor(accountId: string, closureKey: string): Promise<unknown>;
}

export function decodeClosureOwnerRequestV1(value: unknown): ClosureOwnerRequestV1 {
  if (!plainRecord(value) || !exact(value, ['contract', 'closureKey'])
    || value.contract !== accountClosureRequestContractV1
    || typeof value.closureKey !== 'string' || !uuid.test(value.closureKey)) {
    throw new Error('CLOSURE_REQUEST_INVALID');
  }
  return { contract: accountClosureRequestContractV1, closureKey: value.closureKey };
}
export function verifyClosureCommittedReceiptV1(
  value: unknown, accountId: string, closureKey: string,
): ClosureCommittedReceiptV1 {
  if (!plainRecord(value)
    || !exact(value, ['contract', 'accountId', 'closureKey', 'state', 'revision'])
    || value.contract !== accountClosureReceiptContractV1
    || value.accountId !== accountId || value.closureKey !== closureKey
    || value.state !== 'CLOSING'
    || typeof value.revision !== 'string' || !/^[1-9][0-9]*$/.test(value.revision)) {
    throw new Error('CLOSURE_RECEIPT_UNVERIFIED');
  }
  return { contract: accountClosureReceiptContractV1, accountId, closureKey,
    state: 'CLOSING', revision: value.revision };
}

/** No endpoint is registered and no retry uses a replacement key.
 * Post-dispatch failures always return UNKNOWN, preserving the original key.
 */
export async function prepareOwnerClosureV1(
  port: ClosureOwnerPortV1, token: string, input: unknown,
): Promise<ClosureOutcomeV1> {
  const request = decodeClosureOwnerRequestV1(input);
  if (!token || /\s/.test(token)) throw new Error('CLOSURE_AUTH_REQUIRED');
  const first = await port.verifyUser(token);
  if (!first || !uuid.test(first.id)) throw new Error('CLOSURE_AUTH_REQUIRED');
  try {
    const candidate = await port.beginForVerifiedActor(first.id, request.closureKey);
    const again = await port.verifyUser(token);
    if (again?.id !== first.id) throw new Error('CLOSURE_AUTH_CHANGED');
    const receipt = verifyClosureCommittedReceiptV1(candidate, first.id, request.closureKey);
    return { kind: 'CONFIRMED', receipt };
  } catch {
    return { kind: 'UNKNOWN', actorId: first.id, closureKey: request.closureKey };
  }
}
