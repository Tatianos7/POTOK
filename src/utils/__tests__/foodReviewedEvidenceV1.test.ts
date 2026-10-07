import assert from 'node:assert/strict';
import test from 'node:test';
import { createHash } from 'node:crypto';
import {
  canonicalFoodReviewedRevisionContractV1 as canonicalContract,
  nutritionReviewedRevisionContractV1 as nutritionContract,
  foodEvidenceReviewEventContractV1 as eventContract,
  foodReviewedEvidenceEncodingV1 as encoding,
  foodReviewedEvidenceDigestDomainsV1 as domains,
  canonicalFoodReviewedRevisionCanonicalBytesRawV1 as canonicalBytes,
  nutritionReviewedRevisionCanonicalBytesRawV1 as nutritionBytes,
  foodEvidenceReviewEventCanonicalBytesRawV1 as eventBytes,
  canonicalFoodReviewedRevisionDigestRawV1 as canonicalDigest,
  nutritionReviewedRevisionDigestRawV1 as nutritionDigest,
  foodEvidenceReviewEventDigestRawV1 as eventDigest,
  decodeCanonicalFoodReviewedRevisionRawV1 as decodeCanonical,
  decodeNutritionReviewedRevisionRawV1 as decodeNutrition,
  decodeFoodEvidenceReviewEventRawV1 as decodeEvent,
  assertFoodEvidenceDecimalV1 as decimal,
  normalizeFoodEvidenceSourceDecimalV1 as normalize,
  type CanonicalFoodReviewedRevisionV1 as Canonical,
  type NutritionReviewedRevisionV1 as Nutrition,
  type FoodEvidenceReviewEventV1 as Event,
} from '../foodReviewedEvidenceV1';
const id = (n: number) => `${String(n).padStart(8, '0')}-0000-4000-8000-${String(n).padStart(12, '0')}`;
const zero = '0'.repeat(64);
const raw = (value: unknown) => JSON.stringify(value);
const hash = (value: string | Uint8Array) => createHash('sha256').update(value).digest('hex');
const app = () => ({ kind: 'EXACT_FOOD_STATE' as const, foodState: 'as-sold' as const });
// Synthetic test fixtures only; these are never issued or persisted as real evidence.
async function canonical(): Promise<Canonical> {
  const result: Canonical = { contract: canonicalContract, encoding, revisionId: id(1), supersedesRevisionId: null,
    foodId: id(2), canonicalFoodId: id(2), foodStableId: 'synthetic_food',
    identitySnapshot: { name: 'Тест 🥕', nameOriginal: null, normalizedName: 'тест', brand: null, normalizedBrand: null, barcode: null, aliases: ['synthetic'] },
    source: 'core', foodState: 'as-sold', applicability: app(), sharedCatalogAccessible: true, reviewEventId: id(3), digest: zero };
  result.digest = await canonicalDigest(raw(result)); return result;
}
async function nutrition(c: Canonical): Promise<Nutrition> {
  const result: Nutrition = { contract: nutritionContract, encoding, revisionId: id(4), supersedesRevisionId: null,
    canonicalRevisionId: c.revisionId, canonicalRevisionDigest: c.digest, canonicalFoodId: c.canonicalFoodId,
    nutrition: { calories: '17.200', protein: '1.230', fat: '0.000', carbs: '3.001', fiber: '0.000' },
    basis: 'PER_100_G_EDIBLE', units: { calories: 'kcal', protein: 'g', fat: 'g', carbs: 'g', fiber: 'g' },
    foodState: 'as-sold', applicability: app(), reviewEventId: id(5), digest: zero };
  result.digest = await nutritionDigest(raw(result)); return result;
}
async function event(target: Canonical | Nutrition, kind: Event['kind'] = 'REVIEW_APPROVED', binary = false): Promise<Event> {
  const text = 'Источник 🥕\n17.200';
  const nutritionTarget = target.contract === nutritionContract;
  const fields = nutritionTarget ? ['calories', 'protein', 'fat', 'carbs', 'fiber'] as const : ['identitySnapshot'] as const;
  const common = { contract: eventContract, encoding, eventId: kind === 'INVALIDATION' ? id(9) : target.reviewEventId,
    occurredAt: '2026-10-07T12:00:00.000Z', reviewerId: id(6),
    target: { kind: nutritionTarget ? 'NUTRITION_REVIEWED_REVISION' as const : 'CANONICAL_REVIEWED_REVISION' as const,
      revisionId: target.revisionId, digest: target.digest, canonicalFoodId: target.canonicalFoodId },
    retainedSource: { sourceArtifactId: id(7), providerIdentity: 'Synthetic provider', documentIdentity: 'Synthetic document', sourceRevision: null,
      locator: 'https://example.invalid/fixture', capturedAt: '2026-10-07T11:00:00.000Z', mediaType: 'text/plain; charset=utf-8',
      byteLength: new TextEncoder().encode(text).length, sourceBytesSha256: hash(text),
      mappings: fields.map(field => ({ field, sourceField: `synthetic.${field}`, applicability: app() })),
      ...(binary ? { bytesBase64: Buffer.from(text).toString('base64') } : { text }) }, digest: zero };
  const result: Event = kind === 'REVIEW_APPROVED' ? { ...common, kind } : kind === 'REVIEW_REJECTED'
    ? { ...common, kind, reason: 'Synthetic rejection' } : { ...common, kind, severity: 'SAFETY_CRITICAL', reason: 'Synthetic invalidation' };
  result.digest = await eventDigest(raw(result)); return result;
}
function mutate(value: unknown, path: string, replacement: unknown, remove = false): unknown {
  const cloned = JSON.parse(raw(value)) as Record<string, unknown>;
  const parts = path.split('.'); let row = cloned;
  for (const key of parts.slice(0, -1)) row = row[key] as Record<string, unknown>;
  if (remove) delete row[parts[parts.length - 1]]; else row[parts[parts.length - 1]] = replacement;
  return cloned;
}

test('valid canonical/nutrition and all strict event variants are immutable, including nested retained source', async () => {
  const c = await canonical(), n = await nutrition(c);
  const decoded = await decodeCanonical(raw(c)); assert.deepEqual(decoded, c);
  assert.deepEqual(await decodeNutrition(raw(n), raw(c)), n);
  for (const target of [c, n]) for (const kind of ['REVIEW_APPROVED', 'REVIEW_REJECTED', 'INVALIDATION'] as const) {
    for (const binary of [false, true]) {
      const e = await event(target, kind, binary), result = await decodeEvent(raw(e), raw(target), raw(c));
      assert.deepEqual(result, e); assert.ok(Object.isFrozen(result));
      assert.ok(Object.isFrozen(result.retainedSource)); assert.ok(Object.isFrozen(result.retainedSource.mappings[0].applicability));
      assert.throws(() => { result.retainedSource.mappings[0].sourceField = 'tampered'; }, TypeError);
    }
  }
  assert.ok(Object.isFrozen(decoded.identitySnapshot.aliases));
});

test('exact shapes reject unknown, missing, malformed UUIDs, enums, defaults and duplicate keys recursively', async () => {
  const c = await canonical(), n = await nutrition(c), e = await event(c);
  for (const value of [mutate(c, 'extra', true), mutate(c, 'identitySnapshot.extra', true), mutate(c, 'revisionId', 'bad'),
    mutate(c, 'reviewEventId', id(1).toUpperCase().replace('4000', '0000')), mutate(c, 'foodState', 'unknown'),
    mutate(c, 'source', 'private'), mutate(c, 'encoding', 'other'), mutate(c, 'contract', nutritionContract),
    mutate(c, 'identitySnapshot.aliases', null)]) await assert.rejects(decodeCanonical(raw(value)));
  for (const key of Object.keys(c)) await assert.rejects(decodeCanonical(raw(mutate(c, key, null, true))));
  for (const key of Object.keys(n)) await assert.rejects(decodeNutrition(raw(mutate(n, key, null, true)), raw(c)));
  for (const key of Object.keys(e)) await assert.rejects(decodeEvent(raw(mutate(e, key, null, true)), raw(c)));
  for (const value of [mutate(e, 'kind', 'APPROVED'), mutate(e, 'reason', 'unexpected'), mutate(e, 'severity', 'CORRECTION'),
    mutate(e, 'reviewerId', 'bad'), mutate(e, 'target.kind', 'FOOD'), mutate(e, 'retainedSource.extra', true)]) {
    await assert.rejects(decodeEvent(raw(value), raw(c)));
  }
  await assert.rejects(decodeCanonical(raw(c).replace('"foodId":', `"foodId":"${c.foodId}","foodId":`)));
  await assert.rejects(decodeCanonical(raw(c).replace('"name":', '"name":"duplicate","name":')));
  await assert.rejects(decodeEvent(raw(e).replace('"text":', '"text":"duplicate","text":'), raw(c)));
  await assert.rejects(decodeCanonical(c as unknown as string));
  for (const primitive of ['null', 'true', '1', '[]', '"text"']) await assert.rejects(decodeCanonical(primitive));
});

test('timestamps reject impossible dates, non-UTC, missing milliseconds and malformed values', async () => {
  const c = await canonical(), e = await event(c);
  for (const value of ['2026-02-30T12:00:00.000Z', '2026-10-07T24:00:00.000Z', '2026-10-07T12:00:00Z',
    '2026-10-07T12:00:00.000+00:00', 'not-a-date', 123, null]) {
    for (const path of ['occurredAt', 'retainedSource.capturedAt']) await assert.rejects(decodeEvent(raw(mutate(e, path, value)), raw(c)));
  }
});

test('each discriminated variant rejects missing and foreign fields, even before digest verification', async () => {
  const c = await canonical();
  for (const kind of ['REVIEW_APPROVED', 'REVIEW_REJECTED', 'INVALIDATION'] as const) {
    const e = await event(c, kind);
    for (const key of Object.keys(e)) await assert.rejects(decodeEvent(raw(mutate(e, key, null, true)), raw(c)));
    await assert.rejects(decodeEvent(raw(mutate(e, 'extra', true)), raw(c)));
    for (const key of Object.keys(e.retainedSource)) {
      await assert.rejects(decodeEvent(raw(mutate(e, `retainedSource.${key}`, null, true)), raw(c)));
    }
  }
});

test('raw boundary rejects wrappers and proxies without invoking coercion or traps', async () => {
  const c = await canonical(), n = await nutrition(c), e = await event(c);
  let calls = 0;
  const proxy = new Proxy({}, { get() { calls++; throw new Error('trap'); }, getPrototypeOf() { calls++; throw new Error('trap'); } });
  for (const value of [proxy, new String(raw(c)), c]) {
    await assert.rejects(decodeCanonical(value as unknown as string), /RAW_STRING_REQUIRED/);
    await assert.rejects(decodeNutrition(value as unknown as string, raw(c)), /RAW_STRING_REQUIRED/);
    await assert.rejects(decodeEvent(value as unknown as string, raw(c)), /RAW_STRING_REQUIRED/);
  }
  await assert.rejects(decodeNutrition(raw(n), proxy as unknown as string), /RAW_STRING_REQUIRED/);
  await assert.rejects(decodeEvent(raw(e), proxy as unknown as string), /RAW_STRING_REQUIRED/);
  assert.equal(calls, 0);
});

test('strict decimal scale, precision and upper bound; source normalization is separate and lossless', async () => {
  for (const value of ['0.000', '1.230', '3.001', '999999999.999']) assert.equal(decimal(value), value);
  for (const [source, expected] of [['17.2', '17.200'], ['0', '0.000'], ['1.2300', '1.230'], ['1.230000', '1.230'], ['3.00100', '3.001']]) {
    assert.equal(normalize(source), expected);
  }
  for (const value of ['1.2301', '3.0011', '-0', '-0.000', '-1', '1e2', 'NaN', 'Infinity', '1000000000', 17.2, null]) assert.throws(() => normalize(value));
  const c = await canonical(), n = await nutrition(c);
  for (const value of ['0', '17.2', '1.2300', '1.2301', '-1.000', '-0.000', '1e3', 'NaN', 'Infinity', '1000000000.000', '01.000', 1.23, null]) {
    assert.throws(() => decimal(value));
    await assert.rejects(decodeNutrition(raw(mutate(n, 'nutrition.fiber', value)), raw(c)));
  }
  await assert.rejects(decodeNutrition(raw(mutate(n, 'nutrition.fiber', null, true)), raw(c)));
  for (const value of [mutate(n, 'basis', 'PER_100_ML'), mutate(n, 'units.calories', 'g'), mutate(n, 'units.fiber', 'mg'), mutate(n, 'nutrition.extra', '0.000')]) {
    await assert.rejects(decodeNutrition(raw(value), raw(c)));
  }
});

test('canonical bytes and SHA-256 deterministic, key-order independent, self digest excluded, domains distinct', async () => {
  const c = await canonical(), n = await nutrition(c), e = await event(c);
  const pairs = [[c, canonicalBytes, canonicalDigest, domains.canonical], [n, nutritionBytes, nutritionDigest, domains.nutrition],
    [e, eventBytes, eventDigest, domains.event]] as const;
  assert.equal(new Set(Object.values(domains)).size, 3);
  for (const [artifact, encode, digest, domain] of pairs) {
    const input = raw(artifact), bytes = await encode(input);
    const reversed = raw(Object.fromEntries(Object.entries(artifact).reverse()));
    assert.deepEqual(await encode(reversed), bytes); assert.equal(await digest(input), artifact.digest);
    assert.equal(hash(bytes), artifact.digest);
    assert.deepEqual(await encode(raw(mutate(artifact, 'digest', 'a'.repeat(64)))), bytes);
    const payload = JSON.parse(new TextDecoder().decode(bytes)) as { domain: string; payload: Record<string, unknown> };
    assert.equal(payload.domain, domain); assert.equal(payload.payload.contract, artifact.contract); assert.equal(payload.payload.encoding, encoding);
    assert.ok(!Object.prototype.hasOwnProperty.call(payload.payload, 'digest'));
    const changedDomainBytes = new TextEncoder().encode(new TextDecoder().decode(bytes).replace(domain, `${domain}-other`));
    assert.notEqual(hash(changedDomainBytes), artifact.digest);
  }
  assert.notEqual(await canonicalDigest(raw(mutate(c, 'identitySnapshot.name', 'changed'))), c.digest);
  assert.notEqual(await nutritionDigest(raw(mutate(n, 'nutrition.fiber', '0.001'))), n.digest);
  const rejected = await event(c, 'REVIEW_REJECTED');
  assert.notEqual(await eventDigest(raw(mutate(rejected, 'reason', 'changed'))), rejected.digest);
  await assert.rejects(decodeCanonical(raw(mutate(c, 'digest', n.digest))));
  await assert.rejects(decodeNutrition(raw(mutate(n, 'digest', c.digest)), raw(c)));
  await assert.rejects(decodeEvent(raw(mutate(e, 'digest', c.digest)), raw(c)));
});

test('canonical root, stable key, supersession and state constraints', async () => {
  const c = await canonical();
  for (const value of [mutate(c, 'foodId', id(99)), mutate(c, 'foodStableId', ''), mutate(c, 'sharedCatalogAccessible', false),
    mutate(c, 'supersedesRevisionId', c.revisionId), mutate(c, 'supersedesRevisionId', 'bad'), mutate(c, 'applicability.foodState', 'raw')]) {
    await assert.rejects(decodeCanonical(raw(value)));
  }
  const next = { ...c, revisionId: id(8), supersedesRevisionId: c.revisionId };
  next.digest = await canonicalDigest(raw(next)); assert.deepEqual(await decodeCanonical(raw(next)), next);
  const brand = { ...c, source: 'brand' as const }; brand.digest = await canonicalDigest(raw(brand));
  assert.equal((await decodeCanonical(raw(brand))).source, 'brand');
});

test('nutrition verifies exact canonical revision ID, digest, root and applicability even after resealing', async () => {
  const c = await canonical(), n = await nutrition(c);
  for (const [path, value] of [['canonicalRevisionId', id(99)], ['canonicalRevisionDigest', zero], ['canonicalFoodId', id(99)]] as const) {
    const changed = mutate(n, path, value) as Nutrition; changed.digest = await nutritionDigest(raw(changed));
    await assert.rejects(decodeNutrition(raw(changed), raw(c)), /CANONICAL_BINDING_MISMATCH/);
  }
  const changed = { ...n, foodState: 'raw' as const, applicability: { ...app(), foodState: 'raw' as const } };
  changed.digest = await nutritionDigest(raw(changed)); await assert.rejects(decodeNutrition(raw(changed), raw(c)), /CANONICAL_BINDING_MISMATCH/);
  await assert.rejects(decodeNutrition(raw(n), raw(mutate(c, 'digest', zero))));
  const next = { ...n, revisionId: id(8), supersedesRevisionId: n.revisionId }; next.digest = await nutritionDigest(raw(next));
  assert.deepEqual(await decodeNutrition(raw(next), raw(c)), next);
  await assert.rejects(decodeNutrition(raw(mutate(n, 'supersedesRevisionId', n.revisionId)), raw(c)));
});

test('invalidation exact target bindings and severity; supersession is independent', async () => {
  const c = await canonical(), n = await nutrition(c);
  for (const target of [c, n]) {
    const e = await event(target, 'INVALIDATION');
    for (const [path, value] of [['target.revisionId', id(99)], ['target.digest', zero], ['target.canonicalFoodId', id(99)],
      ['retainedSource.mappings.0.applicability.foodState', 'raw']] as const) {
      const changed = mutate(e, path, value) as Event; changed.digest = await eventDigest(raw(changed));
      await assert.rejects(decodeEvent(raw(changed), raw(target), raw(c)), /EVENT_TARGET_BINDING_MISMATCH/);
    }
    await assert.rejects(decodeEvent(raw(mutate(e, 'severity', 'LOW')), raw(target), raw(c)));
    await assert.rejects(decodeEvent(raw(mutate(e, 'severity', null, true)), raw(target), raw(c)));
    await assert.rejects(decodeEvent(raw(mutate(e, 'target.kind', target === c ? 'NUTRITION_REVIEWED_REVISION' : 'CANONICAL_REVIEWED_REVISION')), raw(target), raw(c)));
    const correction = { ...e, severity: 'CORRECTION' }; correction.digest = await eventDigest(raw(correction));
    assert.equal((await decodeEvent(raw(correction), raw(target), raw(c))).kind, 'INVALIDATION');
  }
  const approved = await event(c); const wrong = { ...approved, eventId: id(99) }; wrong.digest = await eventDigest(raw(wrong));
  await assert.rejects(decodeEvent(raw(wrong), raw(c)), /REVIEW_EVENT_BINDING_MISMATCH/);
  await assert.rejects(decodeEvent(raw(await event(n)), raw(n)), /CANONICAL_CONTEXT_REQUIRED/);
});

test('retained UTF-8/base64 validates exact bytes, XOR, canonical base64, source SHA and field coverage', async () => {
  const c = await canonical(), e = await event(c), binary = await event(c, 'REVIEW_APPROVED', true);
  for (const value of [mutate(e, 'retainedSource.byteLength', 1), mutate(e, 'retainedSource.byteLength', -0),
    mutate(e, 'retainedSource.sourceBytesSha256', zero), mutate(e, 'retainedSource.bytesBase64', 'AA=='),
    mutate(e, 'retainedSource.text', null, true), mutate(e, 'retainedSource.text', '\ud800'),
    mutate(e, 'retainedSource.mappings', []), mutate(e, 'retainedSource.sourceArtifactId', 'bad'),
    mutate(e, 'retainedSource.mappings.0.field', 'calories')]) await assert.rejects(decodeEvent(raw(value), raw(c)));
  for (const value of ['!', 'AAA', 'AA=A', 'AB==', 'AAA===', ' AA==', 'AA==\n', '____']) {
    await assert.rejects(decodeEvent(raw(mutate(binary, 'retainedSource.bytesBase64', value)), raw(c)));
  }
  assert.notEqual(e.retainedSource.byteLength, e.retainedSource.text!.length);
  const n = await nutrition(c), en = await event(n);
  await assert.rejects(decodeEvent(raw(mutate(en, 'retainedSource.mappings', en.retainedSource.mappings.slice(0, 4))), raw(n), raw(c)));
  const bytes = new Uint8Array([0, 255, 128]);
  const arbitrary = { ...binary, retainedSource: { ...binary.retainedSource, bytesBase64: Buffer.from(bytes).toString('base64'), byteLength: 3, sourceBytesSha256: hash(bytes), mediaType: 'application/octet-stream' } };
  arbitrary.digest = await eventDigest(raw(arbitrary)); assert.deepEqual(await decodeEvent(raw(arbitrary), raw(c)), arbitrary);
});
