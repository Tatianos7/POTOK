import assert from 'node:assert/strict';
import test from 'node:test';
import { createHash } from 'node:crypto';
import { canonicalJsonV1 } from '../adaptiveNutritionWireV1';
import {
  canonicalFoodReviewedRevisionContractV1, foodReviewedEvidenceEncodingV1, canonicalFoodReviewedRevisionDigestRawV1,
  decodeNutritionReviewedRevisionRawV1, decodeFoodEvidenceReviewEventRawV1,
} from '../foodReviewedEvidenceV1';
import { captureExactNutritionInputV2, exactNutritionInputDigestV2 } from '../exactNutritionValuesV2';
import {
  captureFoodNutritionSourceBindingRawV2 as capture, decodeFoodNutritionSourceBindingRawV2 as decode,
  retainedFoodSourceSnapshotDigestRawV2 as sourceDigest, foodNutritionSourceBindingCanonicalRawV2 as canonicalRaw,
} from '../foodNutritionSourceBindingV2';
const raw = JSON.stringify;
const sha = (value: string) => createHash('sha256').update(value).digest('hex');
const id = (n: number) => `${String(n).padStart(8, '0')}-0000-4000-8000-${String(n).padStart(12, '0')}`;
const axes = ['calories', 'protein', 'fat', 'carbs', 'fiber'] as const;
// Synthetic identity/source only: never an issued production revision or an approved source.
async function fixture(binary = false, basis: 'PER_100_G_FOOD' | 'PER_100_G_EDIBLE' = 'PER_100_G_FOOD') {
  const app = { kind: 'EXACT_FOOD_STATE', foodState: 'raw' };
  const c = { contract: canonicalFoodReviewedRevisionContractV1, encoding: foodReviewedEvidenceEncodingV1,
    revisionId: id(1), supersedesRevisionId: null, reviewEventId: id(2), digest: '0'.repeat(64),
    foodId: id(3), canonicalFoodId: id(3), foodStableId: 'synthetic',
    identitySnapshot: { name: 'Synthetic 🥕', nameOriginal: null, normalizedName: 'synthetic', brand: null, normalizedBrand: null, barcode: null, aliases: [] },
    source: 'core', foodState: 'raw', applicability: app, sharedCatalogAccessible: true };
  c.digest = await canonicalFoodReviewedRevisionDigestRawV1(raw(c));
  const decimal = { calories: '378.866123', protein: '13.496450', fat: '5.89', carbs: '58.23755', fiber: '10.42' };
  const text = raw({ synthetic: true, values: decimal });
  const source = { sourceArtifactId: id(4), providerIdentity: 'synthetic', documentIdentity: 'synthetic record', sourceRevision: null,
    locator: 'https://example.invalid/synthetic', capturedAt: '2026-11-05T00:00:00.000Z', mediaType: 'application/json',
    byteLength: Buffer.byteLength(text), sourceBytesSha256: sha(text),
    mappings: axes.map(field => ({ field, sourceField: `values.${field}`, applicability: app })),
    ...(binary ? { bytesBase64: Buffer.from(text).toString('base64') } : { text }) };
  const input = captureExactNutritionInputV2({ sourceRecord: 'synthetic record', declaredRetainedArtifactSha256: sha(text), basis,
    units: { calories: 'kcal', protein: 'g', fat: 'g', carbs: 'g', fiber: 'g' },
    carbohydrateSemantics: 'AVAILABLE_EXCLUDING_FIBER', mappingPolicyRef: 'synthetic-extraction-policy-v1' }, decimal);
  const pins = { canonicalRevisionDigest: c.digest, numericInputDigest: await exactNutritionInputDigestV2(input), retainedSnapshotDigest: await sourceDigest(raw(source)) };
  return { c, source, input, pins };
}
async function packet(f: Awaited<ReturnType<typeof fixture>>) { return capture(raw(f.c), raw(f.source), raw(f.input), raw(f.pins)); }
const clone = <T>(v: T): T => JSON.parse(raw(v)) as T;

test('text/binary and both bases remain exact immutable REVIEW_REQUIRED proposals', async () => {
  for (const binary of [false, true]) for (const basis of ['PER_100_G_FOOD', 'PER_100_G_EDIBLE'] as const) {
    const f = await fixture(binary, basis), p = await packet(f);
    assert.equal(p.authority, 'NONE'); assert.equal(p.status, 'REVIEW_REQUIRED');
    assert.deepEqual(await decode(raw(p), raw(f.pins)), p);
    assert.equal(p.numericInput.reference.basis, basis);
    assert.equal(p.numericInput.mappedDecimalText.protein, '13.496450');
    assert.deepEqual(p.numericInput.values.calories, { numerator: '378866123', denominator: '1000000' });
    for (const v of [p, p.canonical.identitySnapshot.aliases, p.retainedSource.mappings[0].applicability, p.numericInput.values.calories]) assert.ok(Object.isFrozen(v));
  }
});
test('proposal digest and canonical bytes agree with independent node hashing', async () => {
  const f = await fixture(), p = await packet(f), { digest, ...payload } = p;
  assert.equal(digest, sha(canonicalJsonV1({ domain: 'potok-food-nutrition-source-binding-proposal-sha256-v2', payload }, 'SAFE_INTEGER')));
  assert.equal(await canonicalRaw(raw(p), raw(f.pins)), canonicalJsonV1(p, 'SAFE_INTEGER'));
  assert.notEqual(digest, f.pins.numericInputDigest); assert.notEqual(digest, f.pins.retainedSnapshotDigest);
});
test('caller mutation cannot alter captured bytes or exact values', async () => {
  const f = await fixture(), p = await packet(f), before = raw(p);
  f.source.mappings[0].sourceField = 'forged'; f.c.identitySnapshot.name = 'forged';
  assert.equal(raw(p), before);
});
test('valid replacement canonical identity with recomputed self digest fails independent pin', async () => {
  const f = await fixture(); f.c.foodId = f.c.canonicalFoodId = id(9);
  f.c.digest = await canonicalFoodReviewedRevisionDigestRawV1(raw(f.c));
  await assert.rejects(packet(f), /CANONICAL_PIN_MISMATCH/);
});
test('changed numeric values with self-consistent fractions fail independent numeric pin', async () => {
  const f = await fixture(); const changed = captureExactNutritionInputV2(f.input.reference, { ...f.input.mappedDecimalText, calories: '1' });
  await assert.rejects(capture(raw(f.c), raw(f.source), raw(changed), raw(f.pins)), /NUMERIC_INPUT_PIN_MISMATCH/);
});
test('record, policy, basis and trailing decimal text are independently pinned', async () => {
  const f = await fixture();
  for (const reference of [{ ...f.input.reference, sourceRecord: 'other' }, { ...f.input.reference, mappingPolicyRef: 'other' },
    { ...f.input.reference, basis: 'PER_100_G_EDIBLE' }]) {
    const input = captureExactNutritionInputV2(reference, f.input.mappedDecimalText);
    await assert.rejects(capture(raw(f.c), raw(f.source), raw(input), raw(f.pins)), /NUMERIC_INPUT_PIN_MISMATCH/);
  }
  const input = captureExactNutritionInputV2(f.input.reference, { ...f.input.mappedDecimalText, protein: '13.49645' });
  await assert.rejects(capture(raw(f.c), raw(f.source), raw(input), raw(f.pins)), /NUMERIC_INPUT_PIN_MISMATCH/);
});
test('metadata and sourceField substitution with same bytes fails full snapshot pin', async () => {
  const f = await fixture();
  for (const change of ['documentIdentity', 'locator', 'mapping'] as const) {
    const source = clone(f.source);
    if (change === 'mapping') source.mappings[0].sourceField = 'different.path'; else source[change] = 'other';
    await assert.rejects(capture(raw(f.c), raw(source), raw(f.input), raw(f.pins)), /SOURCE_PIN_MISMATCH/);
  }
});
test('bytes hash and byte length are verified even before independent pins', async () => {
  const f = await fixture();
  await assert.rejects(sourceDigest(raw({ ...f.source, byteLength: 0 })), /SOURCE_BYTE_LENGTH_MISMATCH/);
  await assert.rejects(sourceDigest(raw({ ...f.source, sourceBytesSha256: '0'.repeat(64) })), /SOURCE_SHA256_MISMATCH/);
  await assert.rejects(sourceDigest(raw({ ...f.source, bytesBase64: 'eA==' })), /SOURCE_PAYLOAD_XOR/);
});
test('repinned input referring to different bytes rejects cross-artifact linkage', async () => {
  const f = await fixture(), input = captureExactNutritionInputV2({ ...f.input.reference, declaredRetainedArtifactSha256: '0'.repeat(64) }, f.input.mappedDecimalText);
  const pins = { ...f.pins, numericInputDigest: await exactNutritionInputDigestV2(input) };
  await assert.rejects(capture(raw(f.c), raw(f.source), raw(input), raw(pins)), /SOURCE_BYTES_BINDING_MISMATCH/);
});
test('repinned state mismatch and missing axis reject, without guessing state or fiber', async () => {
  const f = await fixture();
  const wrongState = clone(f.source); wrongState.mappings[0].applicability.foodState = 'cooked';
  const missing = clone(f.source); missing.mappings.pop();
  for (const [source, error] of [[wrongState, /FOOD_STATE_MISMATCH/], [missing, /MAPPING_COVERAGE/]] as const) {
    const pins = { ...f.pins, retainedSnapshotDigest: await sourceDigest(raw(source)) };
    await assert.rejects(capture(raw(f.c), raw(source), raw(f.input), raw(pins)), error);
  }
});
test('duplicate and identity-only mappings cannot pass nutrition coverage', async () => {
  const f = await fixture(); const source = clone(f.source); source.mappings.push(source.mappings[0]);
  await assert.rejects(sourceDigest(raw(source)), /SOURCE_MAPPING_DUPLICATE/);
  const identity = { ...f.source, mappings: [{ field: 'identitySnapshot', sourceField: 'name', applicability: f.source.mappings[0].applicability }] };
  await assert.rejects(capture(raw(f.c), raw(identity), raw(f.input), raw({ ...f.pins, retainedSnapshotDigest: await sourceDigest(raw(identity)) })), /MAPPING_COVERAGE/);
});
test('a repinned different source packet cannot be substituted into the original context', async () => {
  const f = await fixture(), originalPins = raw(f.pins); f.source.documentIdentity = 'changed';
  f.pins.retainedSnapshotDigest = await sourceDigest(raw(f.source)); const p = await packet(f);
  await assert.rejects(decode(raw(p), originalPins), /SOURCE_PIN_MISMATCH/);
});
test('untrusted authority/status and contract promotions always reject', async () => {
  const f = await fixture(), p = await packet(f);
  for (const extra of [{ authority: 'OWNER' }, { status: 'APPROVED' }, { contract: 'potok-nutrition-reviewed-revision-v2' }, { encoding: 'legacy' }]) {
    await assert.rejects(decode(raw({ ...p, ...extra }), raw(f.pins)), /CONTRACT/);
  }
  await assert.rejects(decodeNutritionReviewedRevisionRawV1(raw(p), raw(f.c)));
  await assert.rejects(decodeFoodEvidenceReviewEventRawV1(raw(p), raw(f.c)));
});
test('self digest is mandatory, exact and cannot hide altered payload', async () => {
  const f = await fixture(), p = await packet(f);
  await assert.rejects(decode(raw({ ...p, digest: '0'.repeat(64) }), raw(f.pins)), /SELF_DIGEST_MISMATCH/);
  await assert.rejects(decode(raw({ ...p, digest: p.digest.toUpperCase() }), raw(f.pins)), /DIGEST/);
});
test('extra fields, missing pins and duplicate raw keys fail closed', async () => {
  const f = await fixture(), p = await packet(f);
  await assert.rejects(decode(raw({ ...p, approved: true }), raw(f.pins)), /FIELDS/);
  await assert.rejects(decode(raw(p), '{}'), /FIELDS/);
  await assert.rejects(decode(raw(p), raw({ ...f.pins, authority: 'OWNER' })), /FIELDS/);
  await assert.rejects(decode(raw(p).replace('{', '{"status":"REVIEW_REQUIRED",'), raw(f.pins)));
  await assert.rejects(capture(raw(f.c).replace('{', '{"source":"core",'), raw(f.source), raw(f.input), raw(f.pins)));
});
test('bounded raw parser rejects huge and deeply nested packets before recursive scanner', async () => {
  const f = await fixture();
  await assert.rejects(decode(' '.repeat(262145), raw(f.pins)), /RAW_BUDGET/);
  await assert.rejects(decode('['.repeat(13) + '0' + ']'.repeat(13), raw(f.pins)), /RAW_DEPTH/);
  await assert.rejects(decode('"' + '🦊'.repeat(70000) + '"', raw(f.pins)), /RAW_BUDGET/);
});
