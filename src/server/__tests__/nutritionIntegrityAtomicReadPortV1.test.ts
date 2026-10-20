import assert from 'node:assert/strict';
import test from 'node:test';
import {
  readVerifiedNutritionEvidenceV1, type AtomicReviewedEvidenceStoreV1,
} from '../nutritionIntegrityAtomicReadPortV1';

const foodId = 'synthetic-food-id';
const unavailable: AtomicReviewedEvidenceStoreV1 = {
  readComplete: async () => ({ kind: 'UNAVAILABLE' }),
};

test('atomic port returns unresolved when trusted evidence storage is unavailable', async () => {
  assert.deepEqual(await readVerifiedNutritionEvidenceV1(foodId, unavailable),
    { kind: 'UNRESOLVED', foodId });
});

test('atomic port rejects absent snapshot, wrong food identity and incomplete authority', async () => {
  const invalid: AtomicReviewedEvidenceStoreV1[] = [
    { readComplete: async () => ({ kind: 'COMPLETE', snapshot: null, authority: null }) as never },
    { readComplete: async () => ({
      kind: 'COMPLETE', snapshot: { requestedFoodId: 'other-food' },
      authority: { isAuthorizedEvent: async () => true },
    }) as never },
    { readComplete: async () => ({
      kind: 'COMPLETE', snapshot: { requestedFoodId: foodId },
      authority: {},
    }) as never },
  ];
  for (const store of invalid) {
    assert.equal((await readVerifiedNutritionEvidenceV1(foodId, store)).kind, 'UNRESOLVED');
  }
});

test('atomic port fails closed when read or evidence decoding throws', async () => {
  const store: AtomicReviewedEvidenceStoreV1 = {
    readComplete: async () => { throw new Error('database unavailable'); },
  };
  assert.equal((await readVerifiedNutritionEvidenceV1(foodId, store)).kind, 'UNRESOLVED');
  const malformed: AtomicReviewedEvidenceStoreV1 = {
    readComplete: async () => ({
      kind: 'COMPLETE',
      snapshot: { requestedFoodId: foodId, canonicalRaw: '{invalid json' },
      authority: { isAuthorizedEvent: async () => true },
    }) as never,
  };
  assert.equal((await readVerifiedNutritionEvidenceV1(foodId, malformed)).kind, 'UNRESOLVED');
});

test('atomic port rejects blank food identifiers without any store access', async () => {
  let called = 0;
  const store: AtomicReviewedEvidenceStoreV1 = {
    readComplete: async () => { called++; return { kind: 'UNAVAILABLE' }; },
  };
  assert.equal((await readVerifiedNutritionEvidenceV1(' ', store)).kind, 'UNRESOLVED');
  assert.equal(called, 0);
});
