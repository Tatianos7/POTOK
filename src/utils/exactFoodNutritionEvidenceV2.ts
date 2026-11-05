/** Pure versioned artifacts, not an issuer. Self digests do not authenticate approval. */
import { adaptiveNutritionSha256HexV1, canonicalJsonV1 } from './adaptiveNutritionWireV1';
import { decodeFoodReviewAuthorityContextRawV1, type FoodReviewAuthorityContextV1 } from './foodReviewedEvidenceV1';
import {
  decodeFoodNutritionSourceBindingRawV2, parseFoodNutritionSourceBindingJsonRawV2 as parse,
  type FoodNutritionSourceBindingV2,
} from './foodNutritionSourceBindingV2';
export const exactFoodNutritionRevisionContractV2 = 'potok-exact-food-nutrition-revision-v2' as const;
export const exactFoodNutritionEventContractV2 = 'potok-exact-food-nutrition-review-event-v2' as const;
export const exactFoodNutritionEvidenceEncodingV2 = 'potok-exact-food-nutrition-evidence-json-v2' as const;
export const exactFoodNutritionEvidenceDomainsV2 = Object.freeze({
  revision: 'potok-exact-food-nutrition-revision-sha256-v2', event: 'potok-exact-food-nutrition-review-event-sha256-v2',
});
export interface ExactFoodNutritionRevisionV2 {
  readonly contract: typeof exactFoodNutritionRevisionContractV2;
  readonly encoding: typeof exactFoodNutritionEvidenceEncodingV2;
  readonly revisionId: string; readonly supersedesRevisionId: string | null;
  readonly reviewEventId: string;
  /** Immutable proposal retains its original NONE/REVIEW_REQUIRED status. Approval is external. */
  readonly sourceProposal: FoodNutritionSourceBindingV2;
  readonly digest: string;
}
interface EventCommon {
  readonly contract: typeof exactFoodNutritionEventContractV2;
  readonly encoding: typeof exactFoodNutritionEvidenceEncodingV2;
  readonly eventId: string; readonly occurredAt: string; readonly timestampOrigin: 'SERVER';
  readonly authorityContext: FoodReviewAuthorityContextV1;
  readonly idempotencyReference: string; readonly requestDigest: string; readonly digest: string;
}
interface RevisionTarget {
  readonly kind: 'EXACT_NUTRITION_REVISION_V2'; readonly revisionId: string;
  readonly digest: string; readonly canonicalFoodId: string;
}
interface ProposalTarget {
  readonly kind: 'SOURCE_BINDING_PROPOSAL_V2'; readonly digest: string; readonly canonicalFoodId: string;
}
export type ExactFoodNutritionReviewEventV2 = EventCommon & (
  { readonly kind: 'REVIEW_APPROVED'; readonly target: RevisionTarget } |
  { readonly kind: 'INVALIDATION'; readonly target: RevisionTarget; readonly severity: 'CORRECTION' | 'SAFETY_CRITICAL'; readonly reason: string } |
  { readonly kind: 'REVIEW_REJECTED'; readonly target: ProposalTarget; readonly reason: string }
);
function fail(reason: string): never { throw new Error(`EXACT_FOOD_NUTRITION_EVIDENCE_V2_${reason}`); }
function fields(value: unknown, keys: readonly string[]): Record<string, unknown> {
  if (!value || typeof value !== 'object' || Array.isArray(value) || Object.getPrototypeOf(value) !== Object.prototype
    || Object.keys(value).length !== keys.length || keys.some(key => !Object.prototype.hasOwnProperty.call(value, key))) fail('FIELDS');
  return value as Record<string, unknown>;
}
function text(value: unknown): string {
  if (typeof value !== 'string' || !value.trim()) fail('TEXT');
  for (let i = 0; i < value.length; i++) {
    const c = value.charCodeAt(i);
    if (c >= 0xd800 && c <= 0xdbff) { const next = value.charCodeAt(++i); if (!(next >= 0xdc00 && next <= 0xdfff)) fail('UNICODE'); }
    else if (c >= 0xdc00 && c <= 0xdfff) fail('UNICODE');
  }
  return value;
}
function uuid(value: unknown): string {
  const result = text(value); if (!/^[a-f0-9]{8}-[a-f0-9]{4}-[1-8][a-f0-9]{3}-[89ab][a-f0-9]{3}-[a-f0-9]{12}$/.test(result)) fail('UUID'); return result;
}
function hash(value: unknown): string {
  const result = text(value); if (!/^[a-f0-9]{64}$/.test(result)) fail('DIGEST'); return result;
}
function timestamp(value: unknown): string {
  const result = text(value);
  if (!/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/.test(result)
    || !Number.isFinite(Date.parse(result)) || new Date(result).toISOString() !== result) fail('TIMESTAMP');
  return result;
}
function freeze<T>(value: T): T {
  if (value && typeof value === 'object') { for (const child of Object.values(value)) freeze(child); Object.freeze(value); } return value;
}
function bytes(value: ExactFoodNutritionRevisionV2 | ExactFoodNutritionReviewEventV2, domain: string): Uint8Array {
  const { digest, ...payload } = value; hash(digest);
  return new TextEncoder().encode(canonicalJsonV1({ domain, payload }, 'SAFE_INTEGER'));
}
async function revision(raw: string, pinsRaw: string): Promise<ExactFoodNutritionRevisionV2> {
  const row = fields(parse(raw), ['contract', 'encoding', 'revisionId', 'supersedesRevisionId', 'reviewEventId', 'sourceProposal', 'digest']);
  if (row.contract !== exactFoodNutritionRevisionContractV2 || row.encoding !== exactFoodNutritionEvidenceEncodingV2) fail('REVISION_CONTRACT');
  const revisionId = uuid(row.revisionId), supersedesRevisionId = row.supersedesRevisionId === null ? null : uuid(row.supersedesRevisionId);
  if (revisionId === supersedesRevisionId) fail('SELF_SUPERSESSION');
  return { contract: exactFoodNutritionRevisionContractV2, encoding: exactFoodNutritionEvidenceEncodingV2,
    revisionId, supersedesRevisionId, reviewEventId: uuid(row.reviewEventId),
    sourceProposal: await decodeFoodNutritionSourceBindingRawV2(JSON.stringify(row.sourceProposal), pinsRaw), digest: hash(row.digest) };
}
async function event(raw: string): Promise<ExactFoodNutritionReviewEventV2> {
  const value = parse(raw), kind = (value as Record<string, unknown> | null)?.kind;
  if (kind !== 'REVIEW_APPROVED' && kind !== 'REVIEW_REJECTED' && kind !== 'INVALIDATION') fail('EVENT_KIND');
  const row = fields(value, ['contract', 'encoding', 'kind', 'eventId', 'occurredAt', 'timestampOrigin', 'authorityContext',
    'idempotencyReference', 'requestDigest', 'target', 'digest', ...(kind === 'REVIEW_APPROVED' ? [] : ['reason']), ...(kind === 'INVALIDATION' ? ['severity'] : [])]);
  if (row.contract !== exactFoodNutritionEventContractV2 || row.encoding !== exactFoodNutritionEvidenceEncodingV2) fail('EVENT_CONTRACT');
  if (row.timestampOrigin !== 'SERVER') fail('SERVER_TIMESTAMP');
  const common: EventCommon = { contract: exactFoodNutritionEventContractV2, encoding: exactFoodNutritionEvidenceEncodingV2,
    eventId: uuid(row.eventId), occurredAt: timestamp(row.occurredAt), timestampOrigin: 'SERVER',
    authorityContext: decodeFoodReviewAuthorityContextRawV1(JSON.stringify(row.authorityContext)),
    idempotencyReference: uuid(row.idempotencyReference), requestDigest: hash(row.requestDigest), digest: hash(row.digest) };
  const target = fields(row.target, kind === 'REVIEW_REJECTED' ? ['kind', 'digest', 'canonicalFoodId'] : ['kind', 'revisionId', 'digest', 'canonicalFoodId']);
  const targetDigest = hash(target.digest), canonicalFoodId = uuid(target.canonicalFoodId);
  if (kind === 'REVIEW_REJECTED') {
    if (target.kind !== 'SOURCE_BINDING_PROPOSAL_V2') fail('TARGET_KIND');
    return { ...common, kind, target: { kind: 'SOURCE_BINDING_PROPOSAL_V2', digest: targetDigest, canonicalFoodId }, reason: text(row.reason) };
  }
  if (target.kind !== 'EXACT_NUTRITION_REVISION_V2') fail('TARGET_KIND');
  const revisionTarget: RevisionTarget = { kind: 'EXACT_NUTRITION_REVISION_V2', revisionId: uuid(target.revisionId), digest: targetDigest, canonicalFoodId };
  if (kind === 'REVIEW_APPROVED') return { ...common, kind, target: revisionTarget };
  if (row.severity !== 'CORRECTION' && row.severity !== 'SAFETY_CRITICAL') fail('SEVERITY');
  return { ...common, kind, target: revisionTarget, severity: row.severity, reason: text(row.reason) };
}
/** Digest helpers validate representation, not self digest/authority; used by future issuer and synthetic fixtures. */
export async function exactFoodNutritionRevisionCanonicalBytesRawV2(raw: string, pinsRaw: string): Promise<Uint8Array> {
  return bytes(await revision(raw, pinsRaw), exactFoodNutritionEvidenceDomainsV2.revision);
}
export async function exactFoodNutritionRevisionDigestRawV2(raw: string, pinsRaw: string): Promise<string> {
  return adaptiveNutritionSha256HexV1(await exactFoodNutritionRevisionCanonicalBytesRawV2(raw, pinsRaw));
}
export async function exactFoodNutritionEventCanonicalBytesRawV2(raw: string): Promise<Uint8Array> {
  return bytes(await event(raw), exactFoodNutritionEvidenceDomainsV2.event);
}
export async function exactFoodNutritionEventDigestRawV2(raw: string): Promise<string> {
  return adaptiveNutritionSha256HexV1(await exactFoodNutritionEventCanonicalBytesRawV2(raw));
}
export async function decodeExactFoodNutritionRevisionRawV2(raw: string, pinsRaw: string): Promise<ExactFoodNutritionRevisionV2> {
  const result = await revision(raw, pinsRaw);
  if (result.digest !== await adaptiveNutritionSha256HexV1(bytes(result, exactFoodNutritionEvidenceDomainsV2.revision))) fail('SELF_DIGEST_MISMATCH');
  return freeze(result);
}
/** targetRaw is the exact revision, or the independently pinned source proposal for rejection. */
export async function decodeExactFoodNutritionReviewEventRawV2(raw: string, targetRaw: string, pinsRaw: string): Promise<ExactFoodNutritionReviewEventV2> {
  const result = await event(raw);
  if (result.digest !== await adaptiveNutritionSha256HexV1(bytes(result, exactFoodNutritionEvidenceDomainsV2.event))) fail('SELF_DIGEST_MISMATCH');
  if (result.kind === 'REVIEW_REJECTED') {
    const proposal = await decodeFoodNutritionSourceBindingRawV2(targetRaw, pinsRaw);
    if (result.target.digest !== proposal.digest || result.target.canonicalFoodId !== proposal.canonical.canonicalFoodId) fail('PROPOSAL_BINDING_MISMATCH');
  } else {
    const target = await decodeExactFoodNutritionRevisionRawV2(targetRaw, pinsRaw);
    if (result.target.revisionId !== target.revisionId || result.target.digest !== target.digest
      || result.target.canonicalFoodId !== target.sourceProposal.canonical.canonicalFoodId) fail('REVISION_BINDING_MISMATCH');
    if (result.kind === 'REVIEW_APPROVED' && result.eventId !== target.reviewEventId) fail('REVIEW_EVENT_BINDING_MISMATCH');
  }
  return freeze(result);
}
