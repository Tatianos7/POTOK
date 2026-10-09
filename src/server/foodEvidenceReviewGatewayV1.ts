import { createClient } from '@supabase/supabase-js';
import { canonicalJsonV1 } from '../utils/adaptiveNutritionWireV1';
import { decodeCanonicalFoodReviewedRevisionRawV1, decodeNutritionReviewedRevisionRawV1,
  decodeFoodEvidenceReviewEventRawV1, type CanonicalFoodReviewedRevisionV1, type NutritionReviewedRevisionV1 } from '../utils/foodReviewedEvidenceV1';
import { decodeFoodEvidenceReviewRequestRawV1, foodEvidenceRequestDigestRawV1,
  foodEvidenceRequestMaxBytesV1, type FoodEvidenceReviewRequestV1 } from './foodEvidenceReviewRequestV1';

export const foodEvidenceStagingOriginV1 = 'https://ozidryfvhkcbtpnulakq.supabase.co';
export interface FoodEvidenceUserClientV1 {
  verifyUser(token: string): Promise<{ id: string } | null>;
  review(raw: string): Promise<{ data: unknown; error: { code?: string; message?: string } | null }>;
}
export interface FoodEvidenceGatewayDependenciesV1 {
  createUserClient(authorization: string): FoodEvidenceUserClientV1;
}
class GatewayError extends Error {
  constructor(readonly code: string, readonly status: number) { super(code); }
}
const canonical = (value: unknown): string => canonicalJsonV1(value, 'SAFE_INTEGER');
function row(value: unknown, fields: string[]): Record<string, unknown> {
  if (!value || typeof value !== 'object' || Array.isArray(value)) throw new GatewayError('INVALID_SERVER_RECEIPT', 502);
  const object = value as Record<string, unknown>;
  if (Object.keys(object).length !== fields.length || fields.some(field => !Object.prototype.hasOwnProperty.call(object, field))) {
    throw new GatewayError('INVALID_SERVER_RECEIPT', 502);
  }
  return object;
}
/** Independent wire/binding verification of the database result, not an authorization substitute. */
export async function verifyFoodEvidenceReceiptV1(request: FoodEvidenceReviewRequestV1, actorId: string, value: unknown): Promise<void> {
  const receipt = row(value, ['contract', 'event', 'revision', 'canonicalRevision', 'proposalTarget', 'replayed']);
  if (receipt.contract !== 'potok-food-evidence-review-receipt-v1' || typeof receipt.replayed !== 'boolean') throw new GatewayError('INVALID_SERVER_RECEIPT', 502);
  let targetRaw: string;
  let canonicalRaw: string | undefined;
  let revision: CanonicalFoodReviewedRevisionV1 | NutritionReviewedRevisionV1 | null = null;
  if (request.kind === 'REVIEW_REJECTED') {
    const pinned = { kind: request.proposal.contract === 'potok-canonical-food-review-proposal-v1' ? 'CANONICAL_PROPOSAL' : 'NUTRITION_PROPOSAL',
      canonicalFoodId: request.proposal.canonicalFoodId, proposalDigest: request.proposalDigest, applicability: request.proposal.applicability };
    if (receipt.revision !== null || receipt.canonicalRevision !== null || canonical(receipt.proposalTarget) !== canonical(pinned)) throw new GatewayError('INVALID_SERVER_RECEIPT', 502);
    targetRaw = JSON.stringify(pinned);
  } else {
    if (receipt.proposalTarget !== null) throw new GatewayError('INVALID_SERVER_RECEIPT', 502);
    targetRaw = JSON.stringify(receipt.revision);
    const targetKind = request.kind === 'INVALIDATION' ? request.target.kind
      : request.proposal.contract === 'potok-canonical-food-review-proposal-v1' ? 'CANONICAL_REVIEWED_REVISION' : 'NUTRITION_REVIEWED_REVISION';
    if (targetKind === 'CANONICAL_REVIEWED_REVISION') {
      if (receipt.canonicalRevision !== null) throw new GatewayError('INVALID_SERVER_RECEIPT', 502);
      revision = await decodeCanonicalFoodReviewedRevisionRawV1(targetRaw);
    } else {
      canonicalRaw = JSON.stringify(receipt.canonicalRevision);
      revision = await decodeNutritionReviewedRevisionRawV1(targetRaw, canonicalRaw);
    }
  }
  const event = await decodeFoodEvidenceReviewEventRawV1(JSON.stringify(receipt.event), targetRaw, canonicalRaw);
  if (event.kind !== request.kind || event.authorityContext.actorId !== actorId || event.authorityContext.role !== 'ADMIN'
    || event.idempotencyReference !== request.idempotencyReference
    || event.requestDigest !== await foodEvidenceRequestDigestRawV1(JSON.stringify(request))
    || canonical(event.retainedSource) !== canonical(request.retainedSource)) throw new GatewayError('INVALID_SERVER_RECEIPT', 502);
  if (event.kind === 'INVALIDATION' && request.kind === 'INVALIDATION'
    && (event.reason !== request.reason || event.severity !== request.severity || canonical(event.target) !== canonical(request.target))) throw new GatewayError('INVALID_SERVER_RECEIPT', 502);
  if (event.kind === 'REVIEW_REJECTED' && request.kind === 'REVIEW_REJECTED' && event.reason !== request.reason) throw new GatewayError('INVALID_SERVER_RECEIPT', 502);
  if (request.kind === 'REVIEW_APPROVED' && revision) {
    const { contract, encoding, revisionId, reviewEventId, digest, supersedesRevisionId, ...snapshot } = revision;
    void contract; void encoding; void revisionId; void reviewEventId; void digest;
    const { contract: proposalContract, ...input } = request.proposal;
    void proposalContract;
    const expected = request.proposal.contract === 'potok-canonical-food-review-proposal-v1' ? { ...input, foodId: input.canonicalFoodId } : input;
    if (canonical(snapshot) !== canonical(expected) || supersedesRevisionId !== (request.expectedHead?.revisionId ?? null)) throw new GatewayError('INVALID_SERVER_RECEIPT', 502);
  }
}
async function body(request: Request): Promise<string> {
  if (!request.body) throw new GatewayError('INVALID_REQUEST', 400);
  const reader = request.body.getReader();
  const chunks: Uint8Array[] = [];
  let length = 0;
  try {
    for (;;) {
      const part = await reader.read();
      if (part.done) break;
      length += part.value.length;
      if (length > foodEvidenceRequestMaxBytesV1) { await reader.cancel(); throw new GatewayError('REQUEST_TOO_LARGE', 413); }
      chunks.push(part.value);
    }
  } finally { reader.releaseLock(); }
  const bytes = new Uint8Array(length);
  let offset = 0;
  for (const chunk of chunks) { bytes.set(chunk, offset); offset += chunk.length; }
  return new TextDecoder('utf-8', { fatal: true, ignoreBOM: true }).decode(bytes);
}
const sqlErrors: Record<string, number> = {
  AUTH_REQUIRED: 401, JWT_EXPIRED: 401, LIVE_AUTH_SESSION_REQUIRED: 401,
  VERIFIED_ADMIN_REQUIRED: 403, ADMIN_PROVENANCE_MISMATCH: 403, SHARED_CANONICAL_ROOT_REQUIRED: 403,
  IDEMPOTENCY_PAYLOAD_CONFLICT: 409, CURRENT_HEAD_CONFLICT: 409, CATALOG_SNAPSHOT_CONFLICT: 409,
  LIVE_CANONICAL_BINDING_REQUIRED: 409, EXACT_TARGET_REQUIRED: 409, SOURCE_ARTIFACT_ID_CONFLICT: 409,
};
function response(status: number, value: unknown): Response {
  return new Response(JSON.stringify(value), { status, headers: { 'content-type': 'application/json; charset=utf-8', 'cache-control': 'no-store' } });
}
/** No automatic retries, replacement keys, privileged credentials, environment reads or startup side effects. */
export function createFoodEvidenceReviewHandlerV1(deps: FoodEvidenceGatewayDependenciesV1) {
  return async (request: Request): Promise<Response> => {
    let phase: 'auth' | 'input' | 'database' | 'receipt' = 'auth';
    try {
      if (request.method !== 'POST') throw new GatewayError('METHOD_NOT_ALLOWED', 405);
      if (new URL(request.url).search) throw new GatewayError('INVALID_REQUEST', 400);
      if (!/^application\/json(?:\s*;\s*charset=utf-8)?$/i.test(request.headers.get('content-type') ?? '')) throw new GatewayError('JSON_REQUIRED', 415);
      const authorization = request.headers.get('authorization') ?? '';
      const match = /^Bearer ([^\s,]+)$/i.exec(authorization);
      if (!match) throw new GatewayError('AUTH_REQUIRED', 401);
      const client = deps.createUserClient(authorization);
      const actor = await client.verifyUser(match[1]);
      if (!actor || !/^[a-f0-9]{8}-[a-f0-9]{4}-[1-8][a-f0-9]{3}-[89ab][a-f0-9]{3}-[a-f0-9]{12}$/.test(actor.id)) throw new GatewayError('AUTH_REQUIRED', 401);
      phase = 'input';
      const raw = await body(request);
      const decoded = await decodeFoodEvidenceReviewRequestRawV1(raw);
      phase = 'database';
      const result = await client.review(raw); // Preserve raw JSON for SQL duplicate detection / retained proposal bytes.
      if (result.error) {
        if (result.error.code === 'PGRST301' || result.error.code === 'PGRST303') throw new GatewayError('AUTH_REQUIRED', 401);
        const known = result.error.message && sqlErrors[result.error.message];
        if (known) throw new GatewayError(result.error.message as string, known);
        if (result.error.code === '22023' || result.error.code === '22P02') throw new GatewayError('INVALID_REQUEST', 400);
        throw new GatewayError('FOOD_EVIDENCE_UNAVAILABLE', 503);
      }
      phase = 'receipt';
      await verifyFoodEvidenceReceiptV1(decoded, actor.id, result.data);
      return response(200, result.data);
    } catch (error) {
      if (error instanceof GatewayError) return response(error.status, { error: error.code });
      return response(phase === 'input' ? 400 : phase === 'receipt' ? 502 : 503,
        { error: phase === 'input' ? 'INVALID_REQUEST' : phase === 'receipt' ? 'INVALID_SERVER_RECEIPT' : 'FOOD_EVIDENCE_UNAVAILABLE' });
    }
  };
}
/** Real Auth verification + caller-JWT RPC transport. Exported for a later reviewed server host; never mounted here. */
export function createStagingFoodEvidenceReviewGatewayV1(config: { supabaseUrl: string; publishableKey: string }) {
  // Configuration classification only, never JWT authentication. The Auth service
  // verifies actual tokens. Prevent accidentally configuring a privileged API key.
  let publicKey = /^sb_publishable_[A-Za-z0-9_-]+$/.test(config.publishableKey);
  if (!publicKey && /^[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+$/.test(config.publishableKey)) {
    try {
      const segment = config.publishableKey.split('.')[1].replace(/-/g, '+').replace(/_/g, '/');
      const claims: unknown = JSON.parse(atob(segment.padEnd(Math.ceil(segment.length / 4) * 4, '=')));
      publicKey = !!claims && typeof claims === 'object' && !Array.isArray(claims)
        && (claims as Record<string, unknown>).role === 'anon';
    } catch { publicKey = false; }
  }
  if (config.supabaseUrl !== foodEvidenceStagingOriginV1 || !publicKey) throw new Error('STAGING_CONFIGURATION_REQUIRED');
  return createFoodEvidenceReviewHandlerV1({ createUserClient(authorization) {
    const client = createClient(config.supabaseUrl, config.publishableKey, {
      global: { headers: { Authorization: authorization } }, auth: { persistSession: false, autoRefreshToken: false },
    });
    return {
      async verifyUser(token) {
        const { data, error } = await client.auth.getUser(token);
        return error || !data.user || data.user.is_anonymous ? null : { id: data.user.id };
      },
      async review(raw) {
        const { data, error } = await client.rpc('food_evidence_review_v1', { p_request_text: raw });
        return { data: data as unknown, error };
      },
    };
  } });
}
