import { adaptiveNutritionSha256HexV1, assertRawJsonWithoutDuplicateKeysV1, canonicalJsonV1 } from './adaptiveNutritionWireV1';
import {
  decodeCanonicalFoodReviewedRevisionRawV1, decodeRetainedFoodSourceSnapshotRawV1,
  type CanonicalFoodReviewedRevisionV1, type RetainedFoodSourceSnapshotV1,
} from './foodReviewedEvidenceV1';
import { decodeExactNutritionInputRawV2, exactNutritionAxesV2, exactNutritionInputDigestV2, type ExactNutritionInputV2 } from './exactNutritionValuesV2';

export const foodNutritionSourceBindingContractV2 = 'potok-food-nutrition-source-binding-proposal-v2' as const;
export const foodNutritionSourceBindingEncodingV2 = 'potok-food-nutrition-source-binding-json-v2' as const;
export const foodNutritionSourceBindingBudgetsV2 = Object.freeze({ rawBytes: 262144, rawDepth: 12 });
/** Supplied independently by the caller's reviewed identity / selected source mapper.
 * A packet must never supply its own trusted expectations. These pins confer no authority. */
export interface FoodNutritionSourceBindingPinsV2 {
  readonly canonicalRevisionDigest: string;
  readonly numericInputDigest: string;
  readonly retainedSnapshotDigest: string;
}
export interface FoodNutritionSourceBindingV2 {
  readonly contract: typeof foodNutritionSourceBindingContractV2;
  readonly encoding: typeof foodNutritionSourceBindingEncodingV2;
  readonly authority: 'NONE';
  readonly status: 'REVIEW_REQUIRED';
  readonly canonical: CanonicalFoodReviewedRevisionV1;
  readonly retainedSource: RetainedFoodSourceSnapshotV1;
  readonly numericInput: ExactNutritionInputV2;
  readonly digest: string;
}
function fail(reason: string): never { throw new Error(`FOOD_NUTRITION_SOURCE_BINDING_V2_${reason}`); }
function record(value: unknown, fields: readonly string[]): Record<string, unknown> {
  if (!value || typeof value !== 'object' || Array.isArray(value)
    || Object.keys(value).length !== fields.length || fields.some(key => !Object.prototype.hasOwnProperty.call(value, key))) fail('FIELDS');
  return value as Record<string, unknown>;
}
function hash(value: unknown): string {
  if (typeof value !== 'string' || !/^[a-f0-9]{64}$/.test(value)) fail('DIGEST');
  return value;
}
/** Bounded protocol JSON; only safe integer numbers are representable (retained byte length). */
export function parseFoodNutritionSourceBindingJsonRawV2(raw: unknown): unknown {
  if (typeof raw !== 'string' || raw.length > foodNutritionSourceBindingBudgetsV2.rawBytes
    || new TextEncoder().encode(raw).length > foodNutritionSourceBindingBudgetsV2.rawBytes) fail('RAW_BUDGET');
  let depth = 0, quoted = false, escaped = false;
  for (const char of raw) {
    if (quoted) { if (escaped) escaped = false; else if (char === '\\') escaped = true; else if (char === '"') quoted = false; }
    else if (char === '"') quoted = true;
    else if (char === '{' || char === '[') { if (++depth > foodNutritionSourceBindingBudgetsV2.rawDepth) fail('RAW_DEPTH'); }
    else if (char === '}' || char === ']') { if (--depth < 0) fail('RAW_JSON'); }
  }
  assertRawJsonWithoutDuplicateKeysV1(raw);
  const result: unknown = JSON.parse(raw);
  // Preserve lexical -0 rejection before nested packets pass through JSON.stringify.
  // Stringifying first would silently turn an invalid retained byteLength -0 into 0.
  const checkNumbers = (value: unknown): void => {
    if (typeof value === 'number' && (!Number.isSafeInteger(value) || Object.is(value, -0))) fail('RAW_NUMBER');
    if (value && typeof value === 'object') for (const child of Object.values(value)) checkNumbers(child);
  };
  checkNumbers(result);
  return result;
}
async function digest(domain: string, payload: unknown): Promise<string> {
  return adaptiveNutritionSha256HexV1(new TextEncoder().encode(canonicalJsonV1({ domain, payload }, 'SAFE_INTEGER')));
}
/** Includes bytes, mappings AND metadata, rather than just the declared bytes hash. */
export async function retainedFoodSourceSnapshotDigestRawV2(raw: string): Promise<string> {
  const source = await decodeRetainedFoodSourceSnapshotRawV1(JSON.stringify(parseFoodNutritionSourceBindingJsonRawV2(raw)));
  return digest('potok-retained-food-source-snapshot-sha256-v2', source);
}
async function capture(canonicalRaw: string, sourceRaw: string, inputRaw: string, pinsRaw: string): Promise<FoodNutritionSourceBindingV2> {
  const pins = record(parseFoodNutritionSourceBindingJsonRawV2(pinsRaw), ['canonicalRevisionDigest', 'numericInputDigest', 'retainedSnapshotDigest']);
  const expected = {
    canonicalRevisionDigest: hash(pins.canonicalRevisionDigest), numericInputDigest: hash(pins.numericInputDigest),
    retainedSnapshotDigest: hash(pins.retainedSnapshotDigest),
  };
  const canonical = await decodeCanonicalFoodReviewedRevisionRawV1(JSON.stringify(parseFoodNutritionSourceBindingJsonRawV2(canonicalRaw)));
  const retainedSource = await decodeRetainedFoodSourceSnapshotRawV1(JSON.stringify(parseFoodNutritionSourceBindingJsonRawV2(sourceRaw)));
  const numericInput = decodeExactNutritionInputRawV2(inputRaw);
  if (canonical.digest !== expected.canonicalRevisionDigest) fail('CANONICAL_PIN_MISMATCH');
  if (await exactNutritionInputDigestV2(numericInput) !== expected.numericInputDigest) fail('NUMERIC_INPUT_PIN_MISMATCH');
  if (await digest('potok-retained-food-source-snapshot-sha256-v2', retainedSource) !== expected.retainedSnapshotDigest) fail('SOURCE_PIN_MISMATCH');
  if (numericInput.reference.declaredRetainedArtifactSha256 !== retainedSource.sourceBytesSha256) fail('SOURCE_BYTES_BINDING_MISMATCH');
  if (retainedSource.mappings.length !== exactNutritionAxesV2.length
    || exactNutritionAxesV2.some(axis => !retainedSource.mappings.some(mapping => mapping.field === axis))) fail('MAPPING_COVERAGE');
  if (retainedSource.mappings.some(mapping => canonicalJsonV1(mapping.applicability) !== canonicalJsonV1(canonical.applicability))) fail('FOOD_STATE_MISMATCH');
  const payload = {
    contract: foodNutritionSourceBindingContractV2, encoding: foodNutritionSourceBindingEncodingV2,
    authority: 'NONE' as const, status: 'REVIEW_REQUIRED' as const, canonical, retainedSource, numericInput,
  };
  return Object.freeze({ ...payload, digest: await digest('potok-food-nutrition-source-binding-proposal-sha256-v2', payload) });
}
/** Representation only. Does not extract nutrient values from arbitrary bytes or issue reviewed evidence. */
export async function captureFoodNutritionSourceBindingRawV2(canonicalRaw: string, sourceRaw: string, inputRaw: string, pinsRaw: string): Promise<FoodNutritionSourceBindingV2> {
  return capture(canonicalRaw, sourceRaw, inputRaw, pinsRaw);
}
/** A valid self digest cannot substitute for the independent caller pins. */
export async function decodeFoodNutritionSourceBindingRawV2(raw: string, pinsRaw: string): Promise<FoodNutritionSourceBindingV2> {
  const row = record(parseFoodNutritionSourceBindingJsonRawV2(raw), ['contract', 'encoding', 'authority', 'status', 'canonical', 'retainedSource', 'numericInput', 'digest']);
  if (row.contract !== foodNutritionSourceBindingContractV2 || row.encoding !== foodNutritionSourceBindingEncodingV2
    || row.authority !== 'NONE' || row.status !== 'REVIEW_REQUIRED') fail('CONTRACT');
  const result = await capture(JSON.stringify(row.canonical), JSON.stringify(row.retainedSource), JSON.stringify(row.numericInput), pinsRaw);
  if (hash(row.digest) !== result.digest) fail('SELF_DIGEST_MISMATCH');
  return result;
}
export async function foodNutritionSourceBindingCanonicalRawV2(raw: string, pinsRaw: string): Promise<string> {
  return canonicalJsonV1(await decodeFoodNutritionSourceBindingRawV2(raw, pinsRaw), 'SAFE_INTEGER');
}
