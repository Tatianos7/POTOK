import { assertRawJsonWithoutDuplicateKeysV1, canonicalJsonV1, adaptiveNutritionSha256HexV1 } from '../utils/adaptiveNutritionWireV1';
import { assertFoodEvidenceDecimalV1, decodeRetainedFoodSourceSnapshotRawV1,
  type FoodApplicabilityV1, type FoodEvidenceTargetV1, type RetainedFoodSourceSnapshotV1,
  type ReviewedFoodIdentitySnapshotV1, type ReviewedFoodNutritionV1 } from '../utils/foodReviewedEvidenceV1';

// New server INPUT domains. The three Phase 1 artifact domains remain unchanged.
export const foodEvidenceRequestContractV1 = 'potok-food-evidence-review-request-v1' as const;
export const foodEvidenceInputDomainsV1 = {
  request: 'potok-food-evidence-review-request-sha256-v1',
  canonicalProposal: 'potok-canonical-food-review-proposal-sha256-v1',
  nutritionProposal: 'potok-nutrition-review-proposal-sha256-v1',
} as const;
export const foodEvidenceRequestMaxBytesV1 = 1_048_576;
export interface CanonicalFoodReviewProposalV1 {
  contract: 'potok-canonical-food-review-proposal-v1'; canonicalFoodId: string; foodStableId: string;
  identitySnapshot: ReviewedFoodIdentitySnapshotV1; source: 'core' | 'brand';
  applicability: FoodApplicabilityV1; foodState: FoodApplicabilityV1['foodState']; sharedCatalogAccessible: true;
}
export interface NutritionFoodReviewProposalV1 {
  contract: 'potok-nutrition-review-proposal-v1'; canonicalFoodId: string;
  canonicalRevisionId: string; canonicalRevisionDigest: string; nutrition: ReviewedFoodNutritionV1;
  basis: 'PER_100_G_EDIBLE'; units: { calories: 'kcal'; protein: 'g'; fat: 'g'; carbs: 'g'; fiber: 'g' };
  applicability: FoodApplicabilityV1; foodState: FoodApplicabilityV1['foodState'];
}
export type FoodReviewProposalV1 = CanonicalFoodReviewProposalV1 | NutritionFoodReviewProposalV1;
export type FoodEvidenceExpectedHeadV1 = { revisionId: string; digest: string } | null;
type Common = { contract: typeof foodEvidenceRequestContractV1; idempotencyReference: string };
export type FoodEvidenceReviewRequestV1 = Common & (
  { kind: 'REVIEW_APPROVED'; proposal: FoodReviewProposalV1; proposalDigest: string;
    expectedHead: FoodEvidenceExpectedHeadV1; retainedSource: RetainedFoodSourceSnapshotV1 } |
  { kind: 'REVIEW_REJECTED'; proposal: FoodReviewProposalV1; proposalDigest: string;
    retainedSource: RetainedFoodSourceSnapshotV1 | null; reason: string } |
  { kind: 'INVALIDATION'; target: FoodEvidenceTargetV1; retainedSource: RetainedFoodSourceSnapshotV1;
    severity: 'CORRECTION' | 'SAFETY_CRITICAL'; reason: string }
);
const uuidPattern = /^[a-f0-9]{8}-[a-f0-9]{4}-[1-8][a-f0-9]{3}-[89ab][a-f0-9]{3}-[a-f0-9]{12}$/;
const digestPattern = /^[a-f0-9]{64}$/;
const fields = ['calories', 'protein', 'fat', 'carbs', 'fiber'] as const;
function fail(code: string): never { throw new Error(`FOOD_EVIDENCE_REQUEST_${code}`); }
function object(value: unknown, keys: string[]): Record<string, unknown> {
  if (!value || typeof value !== 'object' || Array.isArray(value) || Object.getPrototypeOf(value) !== Object.prototype) fail('OBJECT_REQUIRED');
  const row = value as Record<string, unknown>;
  if (Object.keys(row).length !== keys.length || keys.some(key => !Object.prototype.hasOwnProperty.call(row, key))) fail('EXACT_FIELDS_REQUIRED');
  return row;
}
function text(value: unknown): string {
  if (typeof value !== 'string' || !value.trim()) fail('TEXT_REQUIRED');
  // PostgreSQL jsonb strings cannot contain U+0000. Binary retained sources can.
  if (value.includes('\u0000')) fail('POSTGRES_TEXT_NUL');
  for (let i = 0; i < value.length; i++) {
    const code = value.charCodeAt(i);
    if (code >= 0xd800 && code <= 0xdbff) {
      const next = value.charCodeAt(++i);
      if (!(next >= 0xdc00 && next <= 0xdfff)) fail('UTF8_INVALID');
    } else if (code >= 0xdc00 && code <= 0xdfff) fail('UTF8_INVALID');
  }
  return value;
}
function uuid(value: unknown): string { const result = text(value); if (!uuidPattern.test(result)) fail('UUID_INVALID'); return result; }
function digest(value: unknown): string { const result = text(value); if (!digestPattern.test(result)) fail('DIGEST_INVALID'); return result; }
function nullableText(value: unknown): string | null { return value === null ? null : text(value); }
function applicability(value: unknown, state: unknown): FoodApplicabilityV1 {
  const row = object(value, ['kind', 'foodState']);
  if (row.kind !== 'EXACT_FOOD_STATE' || row.foodState !== state
    || (state !== 'raw' && state !== 'dry' && state !== 'frozen' && state !== 'cooked' && state !== 'as-sold')) fail('APPLICABILITY_INVALID');
  return { kind: 'EXACT_FOOD_STATE', foodState: state };
}
function proposal(value: unknown): FoodReviewProposalV1 {
  if (!value || typeof value !== 'object') fail('PROPOSAL_REQUIRED');
  const contract = (value as Record<string, unknown>).contract;
  if (contract === 'potok-canonical-food-review-proposal-v1') {
    const row = object(value, ['contract', 'canonicalFoodId', 'foodStableId', 'identitySnapshot', 'source', 'foodState', 'applicability', 'sharedCatalogAccessible']);
    const stable = text(row.foodStableId);
    if (!/^[a-z0-9][a-z0-9_-]{0,127}$/.test(stable) || (row.source !== 'core' && row.source !== 'brand') || row.sharedCatalogAccessible !== true) fail('CANONICAL_ROOT_REQUIRED');
    const identity = object(row.identitySnapshot, ['name', 'nameOriginal', 'normalizedName', 'brand', 'normalizedBrand', 'barcode', 'aliases']);
    if (!Array.isArray(identity.aliases)) fail('ALIASES_REQUIRED');
    const aliases = identity.aliases.map(text);
    if (new Set(aliases).size !== aliases.length) fail('DUPLICATE_ALIAS');
    const app = applicability(row.applicability, row.foodState);
    return { contract, canonicalFoodId: uuid(row.canonicalFoodId), foodStableId: stable,
      identitySnapshot: { name: text(identity.name), nameOriginal: nullableText(identity.nameOriginal), normalizedName: text(identity.normalizedName),
        brand: nullableText(identity.brand), normalizedBrand: nullableText(identity.normalizedBrand), barcode: nullableText(identity.barcode), aliases },
      source: row.source, foodState: app.foodState, applicability: app, sharedCatalogAccessible: true };
  }
  if (contract !== 'potok-nutrition-review-proposal-v1') fail('PROPOSAL_CONTRACT_INVALID');
  const row = object(value, ['contract', 'canonicalFoodId', 'canonicalRevisionId', 'canonicalRevisionDigest', 'nutrition', 'basis', 'units', 'foodState', 'applicability']);
  const nutrition = object(row.nutrition, [...fields]), units = object(row.units, [...fields]);
  if (row.basis !== 'PER_100_G_EDIBLE' || fields.some(field => units[field] !== (field === 'calories' ? 'kcal' : 'g'))) fail('BASIS_OR_UNITS_INVALID');
  const app = applicability(row.applicability, row.foodState);
  return { contract, canonicalFoodId: uuid(row.canonicalFoodId), canonicalRevisionId: uuid(row.canonicalRevisionId),
    canonicalRevisionDigest: digest(row.canonicalRevisionDigest), foodState: app.foodState, applicability: app,
    basis: 'PER_100_G_EDIBLE', units: { calories: 'kcal', protein: 'g', fat: 'g', carbs: 'g', fiber: 'g' },
    nutrition: { calories: assertFoodEvidenceDecimalV1(nutrition.calories), protein: assertFoodEvidenceDecimalV1(nutrition.protein),
      fat: assertFoodEvidenceDecimalV1(nutrition.fat), carbs: assertFoodEvidenceDecimalV1(nutrition.carbs), fiber: assertFoodEvidenceDecimalV1(nutrition.fiber) } };
}
function frozen<T>(value: T): T {
  if (value && typeof value === 'object') { Object.values(value).forEach(frozen); Object.freeze(value); }
  return value;
}
function postgresStrings(value: unknown): void {
  if (typeof value === 'string' && value.includes('\u0000')) fail('POSTGRES_TEXT_NUL');
  if (value && typeof value === 'object') Object.values(value).forEach(postgresStrings);
}
export async function foodReviewProposalDigestV1(value: FoodReviewProposalV1): Promise<string> {
  const validated = proposal(value);
  const domain = validated.contract === 'potok-canonical-food-review-proposal-v1'
    ? foodEvidenceInputDomainsV1.canonicalProposal : foodEvidenceInputDomainsV1.nutritionProposal;
  return adaptiveNutritionSha256HexV1(new TextEncoder().encode(canonicalJsonV1({ domain, payload: validated })));
}
/** Strict untrusted request decoder. Authorization and catalog/current-head checks are SQL-only. */
export async function decodeFoodEvidenceReviewRequestRawV1(raw: string): Promise<FoodEvidenceReviewRequestV1> {
  if (typeof raw !== 'string') fail('RAW_STRING_REQUIRED');
  if (new TextEncoder().encode(raw).length > foodEvidenceRequestMaxBytesV1) fail('TOO_LARGE');
  assertRawJsonWithoutDuplicateKeysV1(raw);
  const parsed: unknown = JSON.parse(raw);
  if (!parsed || typeof parsed !== 'object') fail('OBJECT_REQUIRED');
  const kind = (parsed as Record<string, unknown>).kind;
  if (kind !== 'REVIEW_APPROVED' && kind !== 'REVIEW_REJECTED' && kind !== 'INVALIDATION') fail('KIND_INVALID');
  const row = object(parsed, ['contract', 'kind', 'idempotencyReference', 'retainedSource',
    ...(kind === 'INVALIDATION' ? ['target', 'severity', 'reason'] : ['proposal', 'proposalDigest', kind === 'REVIEW_APPROVED' ? 'expectedHead' : 'reason'])]);
  if (row.contract !== foodEvidenceRequestContractV1) fail('CONTRACT_INVALID');
  const common = { contract: foodEvidenceRequestContractV1, idempotencyReference: uuid(row.idempotencyReference) };
  // JSON.stringify would erase -0 before the delegated Phase 1 raw decoder sees it.
  if (row.retainedSource && typeof row.retainedSource === 'object'
    && Object.is((row.retainedSource as Record<string, unknown>).byteLength, -0)) fail('SOURCE_BYTE_LENGTH_MISMATCH');
  // Rejection is the only variant admitting an explicit null retainedSource.
  const source = kind === 'REVIEW_REJECTED' && row.retainedSource === null ? null
    : await decodeRetainedFoodSourceSnapshotRawV1(JSON.stringify(row.retainedSource));
  // Match PostgreSQL's representable input subset without silently changing bytes.
  postgresStrings(source);
  if (kind === 'INVALIDATION') {
    if (!source || (row.severity !== 'CORRECTION' && row.severity !== 'SAFETY_CRITICAL')) fail('INVALIDATION_INVALID');
    const target = object(row.target, ['kind', 'revisionId', 'digest', 'canonicalFoodId']);
    if (target.kind !== 'CANONICAL_REVIEWED_REVISION' && target.kind !== 'NUTRITION_REVIEWED_REVISION') fail('TARGET_KIND_INVALID');
    return frozen({ ...common, kind, target: { kind: target.kind, revisionId: uuid(target.revisionId), digest: digest(target.digest), canonicalFoodId: uuid(target.canonicalFoodId) },
      retainedSource: source, severity: row.severity, reason: text(row.reason) });
  }
  const input = proposal(row.proposal), proposalDigest = digest(row.proposalDigest);
  if (await foodReviewProposalDigestV1(input) !== proposalDigest) fail('PROPOSAL_DIGEST_MISMATCH');
  const expectedFields = input.contract === 'potok-canonical-food-review-proposal-v1' ? ['identitySnapshot'] : [...fields];
  if (source && (source.mappings.length !== expectedFields.length || expectedFields.some(field => !source.mappings.some(mapping => mapping.field === field))
    || source.mappings.some(mapping => canonicalJsonV1(mapping.applicability) !== canonicalJsonV1(input.applicability)))) fail('SOURCE_MAPPING_MISMATCH');
  if (kind === 'REVIEW_REJECTED') return frozen({ ...common, kind, proposal: input, proposalDigest, retainedSource: source, reason: text(row.reason) });
  if (!source) fail('SOURCE_REQUIRED');
  const expectedHead = row.expectedHead === null ? null : object(row.expectedHead, ['revisionId', 'digest']);
  return frozen({ ...common, kind, proposal: input, proposalDigest, retainedSource: source,
    expectedHead: expectedHead === null ? null : { revisionId: uuid(expectedHead.revisionId), digest: digest(expectedHead.digest) } });
}
export async function foodEvidenceRequestCanonicalBytesRawV1(raw: string): Promise<Uint8Array> {
  const payload = await decodeFoodEvidenceReviewRequestRawV1(raw);
  return new TextEncoder().encode(canonicalJsonV1({ domain: foodEvidenceInputDomainsV1.request, payload }, 'SAFE_INTEGER'));
}
export async function foodEvidenceRequestDigestRawV1(raw: string): Promise<string> {
  return adaptiveNutritionSha256HexV1(await foodEvidenceRequestCanonicalBytesRawV1(raw));
}
