/** Unmounted backend port. Caller-JWT database connection, never a privileged key or client-provided authority. */
import { createClient } from '@supabase/supabase-js';
import { adaptiveNutritionSha256HexV1, canonicalJsonV1 } from '../utils/adaptiveNutritionWireV1';
import { decodeExactFoodNutritionRevisionRawV2, decodeExactFoodNutritionReviewEventRawV2 } from '../utils/exactFoodNutritionEvidenceV2';
import { decodeFoodNutritionSourceBindingRawV2 } from '../utils/foodNutritionSourceBindingV2';
import { decodeExactFoodNutritionReviewRequestRawV2, exactFoodNutritionReviewRequestDigestRawV2 } from './exactFoodNutritionReviewRequestV2';
import { resolveExactFoodNutritionReviewedSnapshotV2, type ExactFoodNutritionReviewedSnapshotV2,
  type ExactFoodNutritionReadResultV2 } from './exactFoodNutritionReviewedAdapterV2';

export interface ExactFoodNutritionUserPortV2 {
  /** Real Auth verification belongs to the host. A decoded JWT or locally asserted actor is insufficient. */
  verifyUser(): Promise<{ id: string } | null>;
  review(raw: string): Promise<unknown>;
  receipt(idempotencyReference: string): Promise<unknown>;
  current(foodId: string, state: ExactFoodNutritionReviewedSnapshotV2['currentFoodState']): Promise<unknown>;
}
const canonical = (v: unknown): string => canonicalJsonV1(v, 'SAFE_INTEGER');
function object(value: unknown, keys: string[]): Record<string, unknown> {
  if (!value || typeof value !== 'object' || Array.isArray(value) || Object.keys(value).length !== keys.length
    || keys.some(k => !Object.prototype.hasOwnProperty.call(value, k))) throw Error('INVALID_SERVER_RECEIPT');
  return value as Record<string, unknown>;
}
function actorId(value: unknown): value is string {
  return typeof value === 'string' && /^[a-f0-9]{8}-[a-f0-9]{4}-[1-8][a-f0-9]{3}-[89ab][a-f0-9]{3}-[a-f0-9]{12}$/.test(value);
}
export async function verifyExactFoodNutritionReceiptV2(raw: string, actor: string, value: unknown): Promise<void> {
  const req = decodeExactFoodNutritionReviewRequestRawV2(raw);
  const r = object(value, ['contract','actorId','idempotencyReference','requestDigest','rawRequestSha256','eventRaw','targetRaw','sourcePinsRaw','replayed']);
  if (r.contract !== 'potok-exact-food-nutrition-review-receipt-v2' || typeof r.replayed !== 'boolean'
    || r.actorId !== actor || r.idempotencyReference !== req.idempotencyReference
    || r.requestDigest !== await exactFoodNutritionReviewRequestDigestRawV2(raw)
    || r.rawRequestSha256 !== await adaptiveNutritionSha256HexV1(new TextEncoder().encode(raw))
    || typeof r.eventRaw !== 'string' || typeof r.targetRaw !== 'string' || typeof r.sourcePinsRaw !== 'string') throw Error('INVALID_SERVER_RECEIPT');
  const event = await decodeExactFoodNutritionReviewEventRawV2(r.eventRaw, r.targetRaw, r.sourcePinsRaw);
  if (event.kind !== req.kind || event.authorityContext.actorId !== actor || event.idempotencyReference !== req.idempotencyReference
    || event.requestDigest !== r.requestDigest) throw Error('INVALID_SERVER_RECEIPT');
  if (req.kind === 'INVALIDATION' && event.kind === 'INVALIDATION') {
    if (canonical({ kind: 'EXACT_NUTRITION_REVISION_V2', ...req.target }) !== canonical(event.target)
      || event.reason !== req.reason || event.severity !== req.severity) throw Error('INVALID_SERVER_RECEIPT');
  } else if (req.kind === 'REVIEW_REJECTED' && event.kind === 'REVIEW_REJECTED') {
    const proposal = await decodeFoodNutritionSourceBindingRawV2(r.targetRaw, r.sourcePinsRaw);
    if (proposal.digest !== req.sourceProposalDigest || event.reason !== req.reason) throw Error('INVALID_SERVER_RECEIPT');
  } else if (req.kind === 'REVIEW_APPROVED' && event.kind === 'REVIEW_APPROVED') {
    const revision = await decodeExactFoodNutritionRevisionRawV2(r.targetRaw, r.sourcePinsRaw);
    if (revision.sourceProposal.digest !== req.sourceProposalDigest || revision.supersedesRevisionId !== (req.expectedHead?.revisionId ?? null)) throw Error('INVALID_SERVER_RECEIPT');
  } else throw Error('INVALID_SERVER_RECEIPT');
}
export type ExactFoodNutritionSubmissionV2 =
  | { readonly kind: 'CONFIRMED'; readonly receipt: unknown }
  | { readonly kind: 'UNKNOWN'; readonly actorId: string; readonly raw: string; readonly idempotencyReference: string };
/** Invalid input/auth fails before dispatch. Any uncertain result after dispatch stays UNKNOWN, never retried. */
export async function submitExactFoodNutritionReviewV2(port: ExactFoodNutritionUserPortV2, raw: string): Promise<ExactFoodNutritionSubmissionV2> {
  const req = decodeExactFoodNutritionReviewRequestRawV2(raw), actor = await port.verifyUser();
  if (!actor || !actorId(actor.id)) throw Error('AUTH_REQUIRED');
  const id = actor.id;
  try {
    const receipt = await port.review(raw);
    if ((await port.verifyUser())?.id !== id) throw Error('AUTH_CHANGED');
    await verifyExactFoodNutritionReceiptV2(raw, id, receipt);
    return Object.freeze({ kind: 'CONFIRMED', receipt });
  } catch { return Object.freeze({ kind: 'UNKNOWN', actorId: id, raw, idempotencyReference: req.idempotencyReference }); }
}
/** Read-only recovery requires the exact originating actor/raw/key, never a replacement write. */
export async function recoverExactFoodNutritionReviewV2(port: ExactFoodNutritionUserPortV2,
  pending: Extract<ExactFoodNutritionSubmissionV2, { kind: 'UNKNOWN' }>): Promise<ExactFoodNutritionSubmissionV2> {
  const { actorId: id, raw, idempotencyReference } = pending;
  if (decodeExactFoodNutritionReviewRequestRawV2(raw).idempotencyReference !== idempotencyReference || !actorId(id)) throw Error('INVALID_RECOVERY_CONTEXT');
  if ((await port.verifyUser())?.id !== id) throw Error('AUTH_CHANGED');
  try {
    const receipt = await port.receipt(idempotencyReference);
    if ((await port.verifyUser())?.id !== id) throw Error('AUTH_CHANGED');
    await verifyExactFoodNutritionReceiptV2(raw, id, receipt);
    return Object.freeze({ kind: 'CONFIRMED', receipt });
  } catch { return Object.freeze({ kind: 'UNKNOWN', actorId: id, raw, idempotencyReference }); }
}
/** Only use with the fixed authenticated SQL current RPC. This is not a public JSON approval endpoint. */
export async function readCurrentExactFoodNutritionV2(port: ExactFoodNutritionUserPortV2, foodId: string,
  state: ExactFoodNutritionReviewedSnapshotV2['currentFoodState']): Promise<ExactFoodNutritionReadResultV2> {
  const unresolved = (): ExactFoodNutritionReadResultV2 => Object.freeze({ kind: 'UNRESOLVED', foodId });
  if (!actorId(foodId) || !['raw','dry','frozen','cooked','as-sold'].includes(state)) return unresolved();
  try {
    const actor = await port.verifyUser(); if (!actor || !actorId(actor.id)) return unresolved();
    const id = actor.id;
    // Take an owned JSON snapshot before any asynchronous validation.
    const result = JSON.parse(JSON.stringify(await port.current(foodId, state))) as unknown;
    if ((await port.verifyUser())?.id !== id) return unresolved();
    if ((result as { kind?: unknown })?.kind === 'UNRESOLVED') return unresolved();
    const envelope = object(result, ['kind','snapshot','eventAuthorizations']);
    if (envelope.kind !== 'COMPLETE_TRUSTED_STORE_SNAPSHOT_V2' || !Array.isArray(envelope.eventAuthorizations)
      || envelope.eventAuthorizations.length !== 2) return unresolved();
    const snapshot = object(envelope.snapshot, ['requestedFoodId','nutritionRaw','sourcePinsRaw','canonicalApprovalRaw','nutritionApprovalRaw',
      'relevantEventRaws','activeCanonicalRevisionId','activeNutritionRevisionId','currentFoodState']);
    if (snapshot.requestedFoodId !== foodId || snapshot.currentFoodState !== state) return unresolved();
    const authorized = new Map<string, string>();
    for (const value of envelope.eventAuthorizations) {
      const auth = object(value, ['eventId','digest','authorized']);
      if (!actorId(auth.eventId) || typeof auth.digest !== 'string' || !/^[a-f0-9]{64}$/.test(auth.digest)
        || auth.authorized !== true || authorized.has(auth.eventId)) return unresolved();
      authorized.set(auth.eventId, auth.digest);
    }
    return await resolveExactFoodNutritionReviewedSnapshotV2(snapshot as unknown as ExactFoodNutritionReviewedSnapshotV2,
      { isAuthorizedEvent: async event => authorized.get(event.eventId) === event.digest });
  } catch { return unresolved(); }
}

/** Concrete caller-JWT transport for a later reviewed host. Construction performs no network request.
 * SQL in this package is disposable-only: these RPCs are NOT installed/activated on Staging here. */
export function createStagingExactFoodNutritionUserPortV2(config: {
  supabaseUrl: string; publishableKey: string; authorization: string;
}): ExactFoodNutritionUserPortV2 {
  let publicKey = /^sb_publishable_[A-Za-z0-9_-]+$/.test(config.publishableKey);
  if (!publicKey) {
    try {
      if (!/^[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+$/.test(config.publishableKey)) throw Error('KEY');
      const segment = config.publishableKey.split('.')[1].replace(/-/g,'+').replace(/_/g,'/');
      const payload: unknown = JSON.parse(atob(segment.padEnd(Math.ceil(segment.length/4)*4,'=')));
      publicKey = !!payload && typeof payload === 'object' && !Array.isArray(payload)
        && (payload as Record<string, unknown>).role === 'anon';
    } catch { publicKey = false; }
  }
  const bearer = /^Bearer ([^\s,]+)$/i.exec(config.authorization);
  if (config.supabaseUrl !== 'https://ozidryfvhkcbtpnulakq.supabase.co' || !publicKey || !bearer) throw Error('STAGING_CALLER_JWT_CONFIGURATION_REQUIRED');
  const token = bearer[1];
  const client = createClient(config.supabaseUrl,config.publishableKey,{ global:{ headers:{ Authorization:config.authorization } },
    auth:{ persistSession:false,autoRefreshToken:false,detectSessionInUrl:false } });
  async function rpc(name: 'food_nutrition_review_v2' | 'food_nutrition_receipt_v2' | 'food_nutrition_current_v2', args: Record<string,string>): Promise<unknown> {
    const { data,error } = await client.rpc(name,args);
    if (error) throw Error('EXACT_FOOD_DATABASE_RESULT_UNCONFIRMED');
    return data as unknown;
  }
  return {
    async verifyUser() {
      const { data,error } = await client.auth.getUser(token);
      return error || !data.user || data.user.is_anonymous ? null : { id:data.user.id };
    },
    review: raw => rpc('food_nutrition_review_v2',{ p_request_text:raw }),
    receipt: key => rpc('food_nutrition_receipt_v2',{ p_idempotency_reference:key }),
    current: (food,state) => rpc('food_nutrition_current_v2',{ p_canonical_food_id:food,p_food_state:state }),
  };
}
