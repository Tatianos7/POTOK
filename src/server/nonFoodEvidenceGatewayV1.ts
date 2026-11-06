import { decodeNonFoodRequestV1, nonFoodMaxBytesV1, verifyNonFoodReceiptV1 } from './nonFoodEvidenceV1';

export interface NonFoodGatewayClientV1 {
  verifyUser(token: string): Promise<{ id: string } | null>;
  review(raw: string): Promise<unknown>;
  receipt(key: string): Promise<unknown>;
}
export type NonFoodOutcomeV1 =
  | { kind: 'SETTLED'; receipt: unknown }
  | { kind: 'UNKNOWN'; actorId: string; raw: string; idempotencyReference: string };
/** Unmounted server adapter; no client/runtime imports or automatic mutation retries. */
export async function dispatchNonFoodV1(client: NonFoodGatewayClientV1, token: string, raw: string,
  recover = false, expectedActor?: string): Promise<NonFoodOutcomeV1> {
  const request = await decodeNonFoodRequestV1(raw);
  const actor = await client.verifyUser(token);
  if (!actor || (expectedActor && expectedActor !== actor.id)) throw new Error('NONFOOD_AUTH_REQUIRED');
  try {
    const value = recover ? await client.receipt(request.idempotencyReference) : await client.review(raw);
    const after = await client.verifyUser(token);
    if (after?.id !== actor.id) throw new Error('NONFOOD_AUTH_CHANGED');
    await verifyNonFoodReceiptV1(raw, actor.id, value);
    const final = await client.verifyUser(token);
    if (final?.id !== actor.id) throw new Error('NONFOOD_AUTH_CHANGED');
    return { kind: 'SETTLED', receipt: value };
  } catch {
    // Never infer rollback from auth/transport/malformed receipt. Keep exact operation.
    return { kind: 'UNKNOWN', actorId: actor.id, raw, idempotencyReference: request.idempotencyReference };
  }
}
export function createNonFoodReviewHandlerV1(createClient: (authorization: string) => NonFoodGatewayClientV1) {
  return async (request: Request): Promise<Response> => {
    try {
      if (request.method !== 'POST' || new URL(request.url).search
        || !/^application\/json(?:\s*;\s*charset=utf-8)?$/i.test(request.headers.get('content-type') ?? '')) throw new Error('INVALID_INPUT');
      const authorization = request.headers.get('authorization') ?? '';
      const token = /^Bearer ([^\s,]+)$/i.exec(authorization)?.[1]; if (!token) throw new Error('AUTH_REQUIRED');
      if (!request.body) throw new Error('INVALID_INPUT');
      const reader = request.body.getReader(); const chunks: Uint8Array[] = []; let size = 0;
      try { for (;;) { const p = await reader.read(); if (p.done) break;
        size += p.value.length; if (size > nonFoodMaxBytesV1) { await reader.cancel(); throw new Error('OVERSIZE'); } chunks.push(p.value); }
      } finally { reader.releaseLock(); }
      const bytes = new Uint8Array(size); let offset = 0; for (const c of chunks) { bytes.set(c, offset); offset += c.length; }
      const raw = new TextDecoder('utf-8', { fatal: true, ignoreBOM: true }).decode(bytes);
      const result = await dispatchNonFoodV1(createClient(authorization), token, raw);
      return new Response(JSON.stringify(result), { status: result.kind === 'UNKNOWN' ? 202 : 200,
        headers: { 'content-type': 'application/json', 'cache-control': 'no-store' } });
    } catch { return new Response(JSON.stringify({ error: 'NONFOOD_REQUEST_REJECTED' }), { status: 400, headers: { 'cache-control': 'no-store' } }); }
  };
}
