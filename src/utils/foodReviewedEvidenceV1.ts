import { assertRawJsonWithoutDuplicateKeysV1, canonicalJsonV1, adaptiveNutritionSha256HexV1 } from './adaptiveNutritionWireV1';
import type { GraphFoodStateV1 } from './adaptiveNutritionGraphV1';

export const canonicalFoodReviewedRevisionContractV1 = 'potok-canonical-food-reviewed-revision-v1' as const;
export const nutritionReviewedRevisionContractV1 = 'potok-nutrition-reviewed-revision-v1' as const;
export const foodEvidenceReviewEventContractV1 = 'potok-food-evidence-review-event-v1' as const;
export const foodReviewedEvidenceEncodingV1 = 'potok-food-reviewed-evidence-canonical-json-v1' as const;
export const foodReviewedEvidenceDigestDomainsV1 = {
  canonical: 'potok-canonical-food-reviewed-revision-sha256-v1',
  nutrition: 'potok-nutrition-reviewed-revision-sha256-v1',
  event: 'potok-food-evidence-review-event-sha256-v1',
} as const;
export interface FoodApplicabilityV1 { kind: 'EXACT_FOOD_STATE'; foodState: GraphFoodStateV1 }
export interface ReviewedFoodIdentitySnapshotV1 {
  name: string; nameOriginal: string | null; normalizedName: string;
  brand: string | null; normalizedBrand: string | null; barcode: string | null; aliases: string[];
}
interface RevisionV1 {
  encoding: typeof foodReviewedEvidenceEncodingV1;
  revisionId: string; supersedesRevisionId: string | null; reviewEventId: string; digest: string;
}
export interface CanonicalFoodReviewedRevisionV1 extends RevisionV1 {
  contract: typeof canonicalFoodReviewedRevisionContractV1;
  foodId: string; canonicalFoodId: string; foodStableId: string;
  identitySnapshot: ReviewedFoodIdentitySnapshotV1;
  source: 'core' | 'brand'; foodState: GraphFoodStateV1; applicability: FoodApplicabilityV1;
  sharedCatalogAccessible: true;
}
export interface ReviewedFoodNutritionV1 { calories: string; protein: string; fat: string; carbs: string; fiber: string }
export interface NutritionReviewedRevisionV1 extends RevisionV1 {
  contract: typeof nutritionReviewedRevisionContractV1;
  canonicalRevisionId: string; canonicalRevisionDigest: string; canonicalFoodId: string;
  nutrition: ReviewedFoodNutritionV1; basis: 'PER_100_G_EDIBLE';
  units: { calories: 'kcal'; protein: 'g'; fat: 'g'; carbs: 'g'; fiber: 'g' };
  foodState: GraphFoodStateV1; applicability: FoodApplicabilityV1;
}
export interface FoodEvidenceTargetV1 {
  kind: 'CANONICAL_REVIEWED_REVISION' | 'NUTRITION_REVIEWED_REVISION';
  revisionId: string; digest: string; canonicalFoodId: string;
}
export interface RetainedFoodSourceMappingV1 {
  field: 'identitySnapshot' | 'calories' | 'protein' | 'fat' | 'carbs' | 'fiber';
  sourceField: string; applicability: FoodApplicabilityV1;
}
interface RetainedFoodSourceCommonV1 {
  sourceArtifactId: string; providerIdentity: string; documentIdentity: string; sourceRevision: string | null;
  locator: string; capturedAt: string; mediaType: string; byteLength: number; sourceBytesSha256: string;
  mappings: RetainedFoodSourceMappingV1[];
}
export type RetainedFoodSourceSnapshotV1 = RetainedFoodSourceCommonV1 &
  ({ text: string; bytesBase64?: never } | { bytesBase64: string; text?: never });
interface FoodEvidenceEventCommonV1 {
  contract: typeof foodEvidenceReviewEventContractV1; encoding: typeof foodReviewedEvidenceEncodingV1;
  eventId: string; occurredAt: string; reviewerId: string; target: FoodEvidenceTargetV1;
  retainedSource: RetainedFoodSourceSnapshotV1; digest: string;
}
export type FoodEvidenceReviewEventV1 = FoodEvidenceEventCommonV1 & (
  { kind: 'REVIEW_APPROVED' } |
  { kind: 'REVIEW_REJECTED'; reason: string } |
  { kind: 'INVALIDATION'; severity: 'CORRECTION' | 'SAFETY_CRITICAL'; reason: string }
);
type Artifact = CanonicalFoodReviewedRevisionV1 | NutritionReviewedRevisionV1 | FoodEvidenceReviewEventV1;
const uuidPattern = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/;
const hashPattern = /^[0-9a-f]{64}$/;
const decimalPattern = /^(?:0|[1-9][0-9]{0,8})\.[0-9]{3}$/;
function fail(label: string): never { throw new Error(`FOOD_REVIEWED_EVIDENCE_${label}`); }
function record(value: unknown, keys: readonly string[]): Record<string, unknown> {
  if (!value || typeof value !== 'object' || Array.isArray(value) || Object.getPrototypeOf(value) !== Object.prototype) fail('OBJECT_REQUIRED');
  const row = value as Record<string, unknown>;
  if (Object.keys(row).length !== keys.length || keys.some(key => !Object.prototype.hasOwnProperty.call(row, key))) fail('EXACT_FIELDS_REQUIRED');
  return row;
}
// Reject lone surrogates: TextEncoder would otherwise silently replace their bytes.
function utf8Text(value: unknown): string {
  if (typeof value !== 'string') fail('STRING_REQUIRED');
  for (let i = 0; i < value.length; i++) {
    const code = value.charCodeAt(i);
    if (code >= 0xd800 && code <= 0xdbff) {
      const next = value.charCodeAt(++i);
      if (!(next >= 0xdc00 && next <= 0xdfff)) fail('UTF8_INVALID');
    } else if (code >= 0xdc00 && code <= 0xdfff) fail('UTF8_INVALID');
  }
  return value;
}
function text(value: unknown): string { const result = utf8Text(value); if (!result.trim()) fail('TEXT_REQUIRED'); return result; }
function nullableText(value: unknown): string | null { return value === null ? null : text(value); }
function uuid(value: unknown): string { const result = text(value); if (!uuidPattern.test(result)) fail('UUID_INVALID'); return result; }
function hash(value: unknown): string { const result = text(value); if (!hashPattern.test(result)) fail('DIGEST_INVALID'); return result; }
function timestamp(value: unknown): string {
  const result = text(value);
  // UTC milliseconds only; round-trip rejects impossible calendar dates and normalization.
  if (!/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/.test(result)
    || !Number.isFinite(Date.parse(result)) || new Date(result).toISOString() !== result) fail('TIMESTAMP_INVALID');
  return result;
}
function state(value: unknown): GraphFoodStateV1 {
  if (value !== 'raw' && value !== 'dry' && value !== 'frozen' && value !== 'cooked' && value !== 'as-sold') fail('FOOD_STATE_INVALID');
  return value;
}
function applicability(value: unknown, expected?: GraphFoodStateV1): FoodApplicabilityV1 {
  const row = record(value, ['kind', 'foodState']);
  if (row.kind !== 'EXACT_FOOD_STATE') fail('APPLICABILITY_INVALID');
  const foodState = state(row.foodState);
  if (expected !== undefined && foodState !== expected) fail('APPLICABILITY_MISMATCH');
  return { kind: 'EXACT_FOOD_STATE', foodState };
}
export function assertFoodEvidenceDecimalV1(value: unknown): string {
  if (typeof value !== 'string' || !decimalPattern.test(value)) fail('DECIMAL_INVALID');
  return value;
}
/** Source-only lossless normalization; trusted decoders never call this helper. No float arithmetic. */
export function normalizeFoodEvidenceSourceDecimalV1(value: unknown): string {
  if (typeof value !== 'string' || !/^(?:0|[1-9][0-9]{0,8})(?:\.[0-9]+)?$/.test(value)) fail('SOURCE_DECIMAL_INVALID');
  const [integer, fraction = ''] = value.split('.');
  if (fraction.slice(3).replace(/0/g, '') !== '') fail('SOURCE_DECIMAL_PRECISION_LOSS');
  return assertFoodEvidenceDecimalV1(`${integer}.${fraction.slice(0, 3).padEnd(3, '0')}`);
}
function parse(raw: string): unknown {
  if (typeof raw !== 'string') fail('RAW_STRING_REQUIRED');
  assertRawJsonWithoutDuplicateKeysV1(raw);
  return JSON.parse(raw) as unknown;
}
function freeze<T>(value: T): T {
  if (value && typeof value === 'object') { for (const child of Object.values(value)) freeze(child); Object.freeze(value); }
  return value;
}
function revision(row: Record<string, unknown>): RevisionV1 {
  if (row.encoding !== foodReviewedEvidenceEncodingV1) fail('ENCODING_INVALID');
  const revisionId = uuid(row.revisionId);
  const supersedesRevisionId = row.supersedesRevisionId === null ? null : uuid(row.supersedesRevisionId);
  if (revisionId === supersedesRevisionId) fail('SELF_SUPERSESSION');
  return { encoding: foodReviewedEvidenceEncodingV1, revisionId, supersedesRevisionId, reviewEventId: uuid(row.reviewEventId), digest: hash(row.digest) };
}
const revisionKeys = ['contract', 'encoding', 'revisionId', 'supersedesRevisionId', 'reviewEventId', 'digest'];
function canonicalOwned(value: unknown): CanonicalFoodReviewedRevisionV1 {
  const row = record(value, [...revisionKeys, 'foodId', 'canonicalFoodId', 'foodStableId', 'identitySnapshot', 'source', 'foodState', 'applicability', 'sharedCatalogAccessible']);
  if (row.contract !== canonicalFoodReviewedRevisionContractV1) fail('CANONICAL_CONTRACT_INVALID');
  const foodId = uuid(row.foodId), canonicalFoodId = uuid(row.canonicalFoodId), foodStableId = text(row.foodStableId);
  if (foodId !== canonicalFoodId || !/^[a-z0-9][a-z0-9_-]{0,127}$/.test(foodStableId)
    || (row.source !== 'core' && row.source !== 'brand') || row.sharedCatalogAccessible !== true) fail('CANONICAL_ROOT_REQUIRED');
  const identity = record(row.identitySnapshot, ['name', 'nameOriginal', 'normalizedName', 'brand', 'normalizedBrand', 'barcode', 'aliases']);
  if (!Array.isArray(identity.aliases)) fail('ALIASES_REQUIRED');
  const aliases = identity.aliases.map(text);
  if (new Set(aliases).size !== aliases.length) fail('DUPLICATE_ALIAS');
  const identitySnapshot = { name: text(identity.name), nameOriginal: nullableText(identity.nameOriginal), normalizedName: text(identity.normalizedName),
    brand: nullableText(identity.brand), normalizedBrand: nullableText(identity.normalizedBrand), barcode: nullableText(identity.barcode), aliases };
  const foodState = state(row.foodState);
  return { ...revision(row), contract: canonicalFoodReviewedRevisionContractV1, foodId, canonicalFoodId, foodStableId, identitySnapshot,
    source: row.source, foodState, applicability: applicability(row.applicability, foodState), sharedCatalogAccessible: true };
}
function nutritionOwned(value: unknown): NutritionReviewedRevisionV1 {
  const row = record(value, [...revisionKeys, 'canonicalRevisionId', 'canonicalRevisionDigest', 'canonicalFoodId', 'nutrition', 'basis', 'units', 'foodState', 'applicability']);
  if (row.contract !== nutritionReviewedRevisionContractV1 || row.basis !== 'PER_100_G_EDIBLE') fail('NUTRITION_CONTRACT_OR_BASIS_INVALID');
  const fields = ['calories', 'protein', 'fat', 'carbs', 'fiber'] as const;
  const payload = record(row.nutrition, fields), units = record(row.units, fields);
  for (const field of fields) if (units[field] !== (field === 'calories' ? 'kcal' : 'g')) fail('UNITS_INVALID');
  const nutrition = { calories: assertFoodEvidenceDecimalV1(payload.calories), protein: assertFoodEvidenceDecimalV1(payload.protein),
    fat: assertFoodEvidenceDecimalV1(payload.fat), carbs: assertFoodEvidenceDecimalV1(payload.carbs), fiber: assertFoodEvidenceDecimalV1(payload.fiber) };
  const foodState = state(row.foodState);
  return { ...revision(row), contract: nutritionReviewedRevisionContractV1, canonicalRevisionId: uuid(row.canonicalRevisionId),
    canonicalRevisionDigest: hash(row.canonicalRevisionDigest), canonicalFoodId: uuid(row.canonicalFoodId), nutrition, basis: 'PER_100_G_EDIBLE',
    units: { calories: 'kcal', protein: 'g', fat: 'g', carbs: 'g', fiber: 'g' }, foodState, applicability: applicability(row.applicability, foodState) };
}
async function retainedSource(value: unknown): Promise<RetainedFoodSourceSnapshotV1> {
  if (!value || typeof value !== 'object') fail('SOURCE_REQUIRED');
  const hasText = Object.prototype.hasOwnProperty.call(value, 'text');
  const hasBytes = Object.prototype.hasOwnProperty.call(value, 'bytesBase64');
  if (hasText === hasBytes) fail('SOURCE_PAYLOAD_XOR');
  const row = record(value, ['sourceArtifactId', 'providerIdentity', 'documentIdentity', 'sourceRevision', 'locator', 'capturedAt', 'mediaType',
    'byteLength', 'sourceBytesSha256', 'mappings', hasText ? 'text' : 'bytesBase64']);
  let bytes: Uint8Array;
  let payload: { text: string } | { bytesBase64: string };
  if (hasText) {
    payload = { text: utf8Text(row.text) }; bytes = new TextEncoder().encode(payload.text);
  } else {
    const encoded = utf8Text(row.bytesBase64);
    if (!/^(?:[A-Za-z0-9+/]{4})*(?:[A-Za-z0-9+/]{2}==|[A-Za-z0-9+/]{3}=)?$/.test(encoded)) fail('BASE64_INVALID');
    const binary = atob(encoded);
    if (btoa(binary) !== encoded) fail('BASE64_NONCANONICAL');
    bytes = Uint8Array.from(binary, char => char.charCodeAt(0)); payload = { bytesBase64: encoded };
  }
  if (typeof row.byteLength !== 'number' || !Number.isSafeInteger(row.byteLength) || row.byteLength < 0
    || Object.is(row.byteLength, -0) || row.byteLength !== bytes.length) fail('SOURCE_BYTE_LENGTH_MISMATCH');
  const sourceBytesSha256 = hash(row.sourceBytesSha256);
  if (sourceBytesSha256 !== await adaptiveNutritionSha256HexV1(bytes)) fail('SOURCE_SHA256_MISMATCH');
  if (!Array.isArray(row.mappings) || !row.mappings.length) fail('SOURCE_MAPPINGS_REQUIRED');
  const mappings = row.mappings.map((value): RetainedFoodSourceMappingV1 => {
    const mapping = record(value, ['field', 'sourceField', 'applicability']);
    const field = mapping.field;
    if (field !== 'identitySnapshot' && field !== 'calories' && field !== 'protein' && field !== 'fat' && field !== 'carbs' && field !== 'fiber') fail('SOURCE_MAPPING_FIELD_INVALID');
    return { field, sourceField: text(mapping.sourceField), applicability: applicability(mapping.applicability) };
  });
  if (new Set(mappings.map(mapping => mapping.field)).size !== mappings.length) fail('SOURCE_MAPPING_DUPLICATE');
  return { sourceArtifactId: uuid(row.sourceArtifactId), providerIdentity: text(row.providerIdentity), documentIdentity: text(row.documentIdentity),
    sourceRevision: nullableText(row.sourceRevision), locator: text(row.locator), capturedAt: timestamp(row.capturedAt), mediaType: text(row.mediaType),
    byteLength: row.byteLength, sourceBytesSha256, mappings, ...payload };
}
async function eventOwned(value: unknown): Promise<FoodEvidenceReviewEventV1> {
  if (!value || typeof value !== 'object') fail('EVENT_REQUIRED');
  const kind = (value as Record<string, unknown>).kind;
  if (kind !== 'REVIEW_APPROVED' && kind !== 'REVIEW_REJECTED' && kind !== 'INVALIDATION') fail('EVENT_VARIANT_INVALID');
  const row = record(value, ['contract', 'encoding', 'eventId', 'occurredAt', 'reviewerId', 'target', 'retainedSource', 'digest', 'kind',
    ...(kind === 'REVIEW_APPROVED' ? [] : ['reason']), ...(kind === 'INVALIDATION' ? ['severity'] : [])]);
  if (row.contract !== foodEvidenceReviewEventContractV1 || row.encoding !== foodReviewedEvidenceEncodingV1) fail('EVENT_CONTRACT_INVALID');
  const target = record(row.target, ['kind', 'revisionId', 'digest', 'canonicalFoodId']);
  if (target.kind !== 'CANONICAL_REVIEWED_REVISION' && target.kind !== 'NUTRITION_REVIEWED_REVISION') fail('TARGET_KIND_INVALID');
  const retained = await retainedSource(row.retainedSource);
  const expectedFields = target.kind === 'CANONICAL_REVIEWED_REVISION' ? ['identitySnapshot'] : ['calories', 'protein', 'fat', 'carbs', 'fiber'];
  if (retained.mappings.length !== expectedFields.length || expectedFields.some(field => !retained.mappings.some(mapping => mapping.field === field))) fail('SOURCE_MAPPING_COVERAGE');
  const common: FoodEvidenceEventCommonV1 = { contract: foodEvidenceReviewEventContractV1, encoding: foodReviewedEvidenceEncodingV1,
    eventId: uuid(row.eventId), occurredAt: timestamp(row.occurredAt), reviewerId: uuid(row.reviewerId),
    target: { kind: target.kind, revisionId: uuid(target.revisionId), digest: hash(target.digest), canonicalFoodId: uuid(target.canonicalFoodId) },
    retainedSource: retained, digest: hash(row.digest) };
  if (kind === 'REVIEW_APPROVED') return { ...common, kind };
  if (kind === 'REVIEW_REJECTED') return { ...common, kind, reason: text(row.reason) };
  if (row.severity !== 'CORRECTION' && row.severity !== 'SAFETY_CRITICAL') fail('INVALIDATION_SEVERITY_INVALID');
  return { ...common, kind, severity: row.severity, reason: text(row.reason) };
}
function bytes(artifact: Artifact, domain: string): Uint8Array {
  const { digest, ...payload } = artifact;
  if (!hashPattern.test(digest)) fail('INTERNAL_DIGEST_INVALID');
  return new TextEncoder().encode(canonicalJsonV1({ domain, payload }));
}
async function verified<T extends Artifact>(artifact: T, domain: string): Promise<T> {
  if (artifact.digest !== await adaptiveNutritionSha256HexV1(bytes(artifact, domain))) fail('SELF_DIGEST_MISMATCH');
  return freeze(artifact);
}
/** Integrity only: none of these functions establishes reviewer authority, provenance or live status. */
export function canonicalFoodReviewedRevisionCanonicalBytesRawV1(raw: string): Uint8Array {
  return bytes(canonicalOwned(parse(raw)), foodReviewedEvidenceDigestDomainsV1.canonical);
}
export async function canonicalFoodReviewedRevisionDigestRawV1(raw: string): Promise<string> {
  return adaptiveNutritionSha256HexV1(canonicalFoodReviewedRevisionCanonicalBytesRawV1(raw));
}
export function nutritionReviewedRevisionCanonicalBytesRawV1(raw: string): Uint8Array {
  return bytes(nutritionOwned(parse(raw)), foodReviewedEvidenceDigestDomainsV1.nutrition);
}
export async function nutritionReviewedRevisionDigestRawV1(raw: string): Promise<string> {
  return adaptiveNutritionSha256HexV1(nutritionReviewedRevisionCanonicalBytesRawV1(raw));
}
export async function foodEvidenceReviewEventCanonicalBytesRawV1(raw: string): Promise<Uint8Array> {
  return bytes(await eventOwned(parse(raw)), foodReviewedEvidenceDigestDomainsV1.event);
}
export async function foodEvidenceReviewEventDigestRawV1(raw: string): Promise<string> {
  return adaptiveNutritionSha256HexV1(await foodEvidenceReviewEventCanonicalBytesRawV1(raw));
}
export async function decodeCanonicalFoodReviewedRevisionRawV1(raw: string): Promise<CanonicalFoodReviewedRevisionV1> {
  return verified(canonicalOwned(parse(raw)), foodReviewedEvidenceDigestDomainsV1.canonical);
}
/** Caller must supply the exact retained canonical revision; no catalog lookup or current-status claim. */
export async function decodeNutritionReviewedRevisionRawV1(raw: string, canonicalRaw: string): Promise<NutritionReviewedRevisionV1> {
  const nutrition = await verified(nutritionOwned(parse(raw)), foodReviewedEvidenceDigestDomainsV1.nutrition);
  const canonical = await decodeCanonicalFoodReviewedRevisionRawV1(canonicalRaw);
  if (nutrition.canonicalRevisionId !== canonical.revisionId || nutrition.canonicalRevisionDigest !== canonical.digest
    || nutrition.canonicalFoodId !== canonical.canonicalFoodId || nutrition.foodState !== canonical.foodState
    || canonicalJsonV1(nutrition.applicability) !== canonicalJsonV1(canonical.applicability)) fail('CANONICAL_BINDING_MISMATCH');
  return nutrition;
}
/** Exact target binding, including source applicability. INVALIDATION never implies supersession. */
export async function decodeFoodEvidenceReviewEventRawV1(raw: string, targetRaw: string, canonicalRaw?: string): Promise<FoodEvidenceReviewEventV1> {
  const event = await verified(await eventOwned(parse(raw)), foodReviewedEvidenceDigestDomainsV1.event);
  let target: CanonicalFoodReviewedRevisionV1 | NutritionReviewedRevisionV1;
  if (event.target.kind === 'CANONICAL_REVIEWED_REVISION') target = await decodeCanonicalFoodReviewedRevisionRawV1(targetRaw);
  else {
    if (canonicalRaw === undefined) fail('CANONICAL_CONTEXT_REQUIRED');
    target = await decodeNutritionReviewedRevisionRawV1(targetRaw, canonicalRaw);
  }
  if (event.target.revisionId !== target.revisionId || event.target.digest !== target.digest || event.target.canonicalFoodId !== target.canonicalFoodId
    || event.retainedSource.mappings.some(mapping => canonicalJsonV1(mapping.applicability) !== canonicalJsonV1(target.applicability))) fail('EVENT_TARGET_BINDING_MISMATCH');
  if (event.kind !== 'INVALIDATION' && event.eventId !== target.reviewEventId) fail('REVIEW_EVENT_BINDING_MISMATCH');
  return event;
}
