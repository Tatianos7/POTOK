import { adaptiveNutritionSha256HexV1, canonicalJsonV1 } from '../utils/adaptiveNutritionWireV1';
import { parseFoodNutritionSourceBindingJsonRawV2 } from '../utils/foodNutritionSourceBindingV2';

export const exactFoodNutritionRequestContractV2 = 'potok-exact-food-nutrition-review-request-v2' as const;
export const exactFoodNutritionRequestDomainV2 = 'potok-exact-food-nutrition-review-request-sha256-v2';
type Common = { readonly contract: typeof exactFoodNutritionRequestContractV2; readonly idempotencyReference: string };
export type ExactFoodNutritionReviewRequestV2 = Common & (
  { readonly kind: 'REVIEW_APPROVED'; readonly sourceProposalDigest: string;
    readonly expectedHead: { readonly revisionId: string; readonly digest: string } | null } |
  { readonly kind: 'REVIEW_REJECTED'; readonly sourceProposalDigest: string; readonly reason: string } |
  { readonly kind: 'INVALIDATION'; readonly target: { readonly canonicalFoodId: string; readonly revisionId: string; readonly digest: string };
    readonly severity: 'CORRECTION' | 'SAFETY_CRITICAL'; readonly reason: string }
);
function fail(): never { throw Error('EXACT_FOOD_REVIEW_REQUEST_INVALID'); }
function fields(value: unknown, keys: string[]): Record<string, unknown> {
  if (!value || typeof value !== 'object' || Array.isArray(value) || Object.keys(value).length !== keys.length
    || keys.some(k => !Object.prototype.hasOwnProperty.call(value, k))) fail();
  return value as Record<string, unknown>;
}
function match(value: unknown, pattern: RegExp): string { if (typeof value !== 'string' || !pattern.test(value)) fail(); return value; }
const uuid = (v: unknown): string => match(v, /^[a-f0-9]{8}-[a-f0-9]{4}-[1-8][a-f0-9]{3}-[89ab][a-f0-9]{3}-[a-f0-9]{12}$/);
const hash = (v: unknown): string => match(v, /^[a-f0-9]{64}$/);
function reason(value: unknown): string {
  if (typeof value !== 'string' || !value.trim() || value.includes('\u0000') || value.length > 1024
    || new TextDecoder('utf-8', { fatal: true }).decode(new TextEncoder().encode(value)) !== value) fail();
  return value;
}
/** References a private, independently prepared dossier. Inline source/authority/numeric values are forbidden. */
export function decodeExactFoodNutritionReviewRequestRawV2(raw: string): ExactFoodNutritionReviewRequestV2 {
  if (typeof raw !== 'string' || new TextEncoder().encode(raw).length > 65536) fail();
  const parsed = parseFoodNutritionSourceBindingJsonRawV2(raw) as Record<string, unknown> | null;
  const kind = parsed?.kind;
  if (kind !== 'REVIEW_APPROVED' && kind !== 'REVIEW_REJECTED' && kind !== 'INVALIDATION') fail();
  const row = fields(parsed, ['contract', 'kind', 'idempotencyReference', ...(kind === 'INVALIDATION'
    ? ['target', 'severity', 'reason'] : ['sourceProposalDigest', kind === 'REVIEW_APPROVED' ? 'expectedHead' : 'reason'])]);
  if (row.contract !== exactFoodNutritionRequestContractV2) fail();
  const common = { contract: exactFoodNutritionRequestContractV2, idempotencyReference: uuid(row.idempotencyReference) };
  if (kind === 'INVALIDATION') {
    const target = fields(row.target, ['canonicalFoodId', 'revisionId', 'digest']);
    if (row.severity !== 'CORRECTION' && row.severity !== 'SAFETY_CRITICAL') fail();
    return Object.freeze({ ...common, kind, target: Object.freeze({ canonicalFoodId: uuid(target.canonicalFoodId),
      revisionId: uuid(target.revisionId), digest: hash(target.digest) }), severity: row.severity, reason: reason(row.reason) });
  }
  const sourceProposalDigest = hash(row.sourceProposalDigest);
  if (kind === 'REVIEW_REJECTED') return Object.freeze({ ...common, kind, sourceProposalDigest, reason: reason(row.reason) });
  const head = row.expectedHead === null ? null : fields(row.expectedHead, ['revisionId', 'digest']);
  return Object.freeze({ ...common, kind, sourceProposalDigest,
    expectedHead: head === null ? null : Object.freeze({ revisionId: uuid(head.revisionId), digest: hash(head.digest) }) });
}
export async function exactFoodNutritionReviewRequestDigestRawV2(raw: string): Promise<string> {
  return adaptiveNutritionSha256HexV1(new TextEncoder().encode(canonicalJsonV1({ domain: exactFoodNutritionRequestDomainV2,
    payload: decodeExactFoodNutritionReviewRequestRawV2(raw) }, 'SAFE_INTEGER')));
}
