/** Account closure admission policy, inactive until backed by trusted, serialized server storage.
 * A caller MUST NOT use this helper as a replacement for database write-side fencing.
 * Unknown, missing and stale state fail closed. No Supabase access or side effects here.
 */
export const accountClosureFenceContractV1 = 'potok-account-closure-fence-v1' as const;
export type AccountClosureStateV1 = 'ACTIVE' | 'CLOSING' | 'CLOSED';
export type AccountClosureObservationV1 = Readonly<{
  contract: typeof accountClosureFenceContractV1;
  accountId: string;
  state: AccountClosureStateV1;
  revision: string;
}>;
export type AccountClosureAdmissionV1 =
  | Readonly<{ kind: 'ALLOW'; revision: string }>
  | Readonly<{ kind: 'DENY'; reason: 'CLOSING' | 'CLOSED' | 'UNVERIFIED' }>;

const uuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const revision = /^[a-f0-9]{64}$/;

/** Revision must be a trusted database-generated state/version binding; never client supplied. */
export function assessAccountClosureAdmissionV1(
  accountId: string, observed: unknown,
): AccountClosureAdmissionV1 {
  if (!uuid.test(accountId) || !observed || typeof observed !== 'object' || Array.isArray(observed)) {
    return { kind: 'DENY', reason: 'UNVERIFIED' };
  }
  const row = observed as Record<string, unknown>;
  if (Object.keys(row).length !== 4
    || row.contract !== accountClosureFenceContractV1
    || row.accountId !== accountId
    || typeof row.revision !== 'string'
    || !revision.test(row.revision)) return { kind: 'DENY', reason: 'UNVERIFIED' };

  if (row.state === 'CLOSING') return { kind: 'DENY', reason: 'CLOSING' };
  if (row.state === 'CLOSED') return { kind: 'DENY', reason: 'CLOSED' };
  if (row.state !== 'ACTIVE') return { kind: 'DENY', reason: 'UNVERIFIED' };
  return { kind: 'ALLOW', revision: row.revision };
}

export interface AccountClosureReadPortV1 {
  read(accountId: string): Promise<unknown>;
}

/** Read-only admission check; any transport, permission or database failure denies.
 * A precheck ALLOW is never sufficient for a mutation: a DB transaction MUST
 * serialize the final state check against the CLOSING transition before COMMIT.
 */
export async function readAccountClosureAdmissionV1(
  port: AccountClosureReadPortV1, accountId: string,
): Promise<AccountClosureAdmissionV1> {
  try { return assessAccountClosureAdmissionV1(accountId, await port.read(accountId)); }
  catch { return { kind: 'DENY', reason: 'UNVERIFIED' }; }
}
