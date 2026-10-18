import assert from 'node:assert/strict';
import test from 'node:test';
import {
  assessPortionV1, readStoredIntegrityStatusV1,
  type FoodConversionV1, type FoodNutritionProfileV1, type PortionRequestV1,
} from '../nutritionIntegrityV1';

const foodId = 'synthetic-food';
const nutrition = { calories: '200.000', protein: '10.000', fat: '8.000', carbs: '20.000', fiber: null };
const reviewed: FoodNutritionProfileV1 = {
  foodId, basis: 'PER_100_G_EDIBLE', perBasis: nutrition,
  provenance: { kind: 'REVIEWED_REVISION', nutritionRevisionId: 'synthetic-revision',
    nutritionDigest: 'synthetic-digest', approvalEventId: 'synthetic-approval' },
};
const legacy: FoodNutritionProfileV1 = {
  foodId, basis: 'PER_100_G_EDIBLE', perBasis: nutrition,
  provenance: { kind: 'LEGACY_CONTRACT', contractRef: 'synthetic-unverified-100g-claim' },
};
const request = (amount: string, unit: PortionRequestV1['unit']): PortionRequestV1 => ({ foodId, amount, unit });
const conversion = (
  unit: FoodConversionV1['unit'], kind: FoodConversionV1['kind'], value: string,
  source: FoodConversionV1['source'] = 'REVIEWED_EVIDENCE'
): FoodConversionV1 => ({ foodId, unit, kind, value, source, evidenceRef: 'synthetic-source' });

test('reviewed 100g + grams yields confirmed nutrition and exact mass', () => {
  assert.deepEqual(assessPortionV1(request('150', 'g'), reviewed), {
    status: 'CONFIRMED', reason: null, totals: {
      calories: '300.000', protein: '15.000', fat: '12.000', carbs: '30.000', fiber: null,
    }, normalizedGrams: '150.000', basis: 'PER_100_G_EDIBLE', provenance: reviewed.provenance,
    conversionRef: null, legacyGramWriterCompatible: true,
  });
});

test('legacy 100g claim remains an estimate in normal gram flow', () => {
  const result = assessPortionV1(request('50', 'g'), legacy);
  assert.equal(result.status, 'ESTIMATE');
  if (result.status === 'ESTIMATE') assert.equal(result.totals.calories, '100.000');
});

test('unknown basis never produces invented nutrition, even in grams', () => {
  const profile: FoodNutritionProfileV1 = { foodId, basis: 'UNKNOWN', perBasis: nutrition, provenance: { kind: 'UNKNOWN' } };
  assert.deepEqual(assessPortionV1(request('100', 'g'), profile), {
    status: 'UNKNOWN', reason: 'BASIS_UNKNOWN', totals: null, normalizedGrams: null,
  });
});

test('ml and l cannot silently become grams; 1:1 density is not implicit', () => {
  for (const [amount, unit] of [['100', 'ml'], ['0.1', 'l']] as const) {
    const result = assessPortionV1(request(amount, unit), reviewed);
    assert.equal(result.status, 'UNKNOWN');
    assert.equal(result.totals, null);
  }
});

test('food-specific reviewed density permits ml and l for reviewed per-100g nutrition', () => {
  const density = conversion('ml', 'GRAMS_PER_ML', '0.800');
  for (const [amount, unit] of [['100', 'ml'], ['0.1', 'l']] as const) {
    const result = assessPortionV1(request(amount, unit), reviewed, [density]);
    assert.equal(result.status, 'CONFIRMED');
    if (result.status === 'CONFIRMED') {
      assert.equal(result.normalizedGrams, '80.000');
      assert.equal(result.totals.calories, '160.000');
      assert.equal(result.conversionRef, density.evidenceRef);
    }
  }
});

test('a user-declared density cannot promote reviewed nutrition to confirmed', () => {
  const result = assessPortionV1(request('100', 'ml'), reviewed, [conversion('ml', 'GRAMS_PER_ML', '0.800', 'USER_DECLARED')]);
  assert.equal(result.status, 'ESTIMATE');
});

test('a conversion for another food or without an evidence reference is unavailable', () => {
  const density = conversion('ml', 'GRAMS_PER_ML', '0.800');
  for (const candidate of [{ ...density, foodId: 'other' }, { ...density, evidenceRef: '' }]) {
    assert.equal(assessPortionV1(request('100', 'ml'), reviewed, [candidate]).status, 'UNKNOWN');
  }
});

test('duplicate conversion observations cannot be selected arbitrarily', () => {
  const density = conversion('ml', 'GRAMS_PER_ML', '0.800');
  assert.equal(assessPortionV1(request('100', 'ml'), reviewed, [density, density]).status, 'UNKNOWN');
});

test('spoons and pieces require a food-specific measure', () => {
  for (const unit of ['tbsp', 'tsp', 'piece'] as const) {
    assert.equal(assessPortionV1(request('1', unit), reviewed).status, 'UNKNOWN');
  }
  const result = assessPortionV1(request('1', 'tbsp'), reviewed, [conversion('tbsp', 'GRAMS_PER_UNIT', '13.500')]);
  assert.equal(result.status, 'CONFIRMED');
  if (result.status === 'CONFIRMED') assert.equal(result.totals.calories, '27.000');
});

test('declared per-100ml nutrition scales by volume without pretending grams are known', () => {
  const profile: FoodNutritionProfileV1 = {
    foodId, basis: 'PER_100_ML', perBasis: nutrition, provenance: { kind: 'USER_DECLARED', ownerId: 'synthetic-owner' },
  };
  const result = assessPortionV1(request('0.25', 'l'), profile);
  assert.equal(result.status, 'ESTIMATE');
  if (result.status === 'ESTIMATE') {
    assert.equal(result.totals.calories, '500.000');
    assert.equal(result.normalizedGrams, null);
    assert.equal(result.legacyGramWriterCompatible, false);
  }
  assert.equal(assessPortionV1(request('250', 'g'), profile).status, 'UNKNOWN');
  const withDensity = assessPortionV1(request('250', 'ml'), profile, [conversion('ml', 'GRAMS_PER_ML', '0.800')]);
  assert.equal(withDensity.status, 'ESTIMATE');
  if (withDensity.status === 'ESTIMATE') {
    assert.equal(withDensity.normalizedGrams, '200.000');
    assert.equal(withDensity.legacyGramWriterCompatible, false);
  }
});

test('declared per-portion nutrition uses portions but never invents portion mass', () => {
  const profile: FoodNutritionProfileV1 = {
    foodId, basis: 'PER_PORTION', perBasis: nutrition, provenance: { kind: 'USER_DECLARED', ownerId: 'synthetic-owner' },
  };
  const result = assessPortionV1(request('2', 'portion'), profile);
  assert.equal(result.status, 'ESTIMATE');
  if (result.status === 'ESTIMATE') {
    assert.equal(result.totals.calories, '400.000');
    assert.equal(result.normalizedGrams, null);
    assert.equal(result.legacyGramWriterCompatible, false);
  }
  assert.equal(assessPortionV1(request('200', 'g'), profile).status, 'UNKNOWN');
});

test('invalid numbers, missing macros and forged reviewed non-gram basis fail closed', () => {
  for (const amount of ['NaN', '-1', '1e3', '0', '1.1234', ' 2']) {
    assert.equal(assessPortionV1(request(amount, 'g'), reviewed).status, 'UNKNOWN');
  }
  assert.equal(assessPortionV1(request('100', 'g'), { ...reviewed, perBasis: null }).status, 'UNKNOWN');
  assert.equal(assessPortionV1(request('100', 'ml'), { ...reviewed, basis: 'PER_100_ML' }).status, 'UNKNOWN');
  assert.equal(assessPortionV1(request('999999999', 'g'), reviewed).status, 'UNKNOWN');
  assert.equal(assessPortionV1(request(100 as unknown as string, 'g'), reviewed).status, 'UNKNOWN');
});

test('historical rows read as UNKNOWN without changing stored nutrition', () => {
  assert.equal(readStoredIntegrityStatusV1(null, null), 'UNKNOWN');
  assert.equal(readStoredIntegrityStatusV1(1, null), 'UNKNOWN');
  assert.equal(readStoredIntegrityStatusV1(1, 'ESTIMATE'), 'ESTIMATE');
  assert.equal(readStoredIntegrityStatusV1(1, 'CONFIRMED'), 'CONFIRMED');
  assert.equal(readStoredIntegrityStatusV1(2, 'CONFIRMED'), 'UNKNOWN');
  assert.equal(readStoredIntegrityStatusV1(1, 'FORGED'), 'UNKNOWN');
});

test('evaluation is deterministic and does not mutate the supplied evidence', () => {
  const density = conversion('ml', 'GRAMS_PER_ML', '0.920');
  Object.freeze(density);
  Object.freeze(reviewed.provenance);
  Object.freeze(reviewed.perBasis);
  Object.freeze(reviewed);
  const first = JSON.stringify(assessPortionV1(request('37.5', 'ml'), reviewed, [density]));
  assert.equal(JSON.stringify(assessPortionV1(request('37.5', 'ml'), reviewed, [density])), first);
});
