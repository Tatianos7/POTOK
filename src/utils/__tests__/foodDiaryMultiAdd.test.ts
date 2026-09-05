import test from 'node:test';
import assert from 'node:assert/strict';

import {
  addFoodDiaryMultiAddDraft,
  buildMealEntryFromMultiAddDraft,
  getFoodDiaryMultiAddTotals,
  isFoodDiaryMultiAddBasketValid,
  previewFoodDiaryMultiAddDraft,
  removeFoodDiaryMultiAddDraft,
  updateFoodDiaryMultiAddDraft,
} from '../foodDiaryMultiAdd';
import { Food } from '../../types';

const eggId = '11111111-1111-4111-8111-111111111111';
const oatId = '22222222-2222-4222-8222-222222222222';

const egg: Food = {
  id: eggId,
  name: 'Яйцо куриное',
  calories: 155,
  protein: 13,
  fat: 11,
  carbs: 1.1,
  category: 'Яйца',
  canonical_food_id: eggId,
  source: 'core',
  createdAt: '2026-09-03T00:00:00.000Z',
  updatedAt: '2026-09-03T00:00:00.000Z',
};

const oats: Food = {
  id: oatId,
  name: 'Овсянка',
  calories: 370,
  protein: 12,
  fat: 6,
  carbs: 65,
  category: 'Крупы',
  canonical_food_id: oatId,
  source: 'core',
  createdAt: '2026-09-03T00:00:00.000Z',
  updatedAt: '2026-09-03T00:00:00.000Z',
};

test('multi-add basket selects multiple products and renders draft state', () => {
  const first = addFoodDiaryMultiAddDraft([], egg, 100).drafts;
  const second = addFoodDiaryMultiAddDraft(first, oats, 50).drafts;

  assert.equal(second.length, 2);
  assert.equal(second[0].food.name, 'Яйцо куриное');
  assert.equal(second[1].food.name, 'Овсянка');
  assert.equal(second[1].quantity, '50');
});

test('duplicate canonical food focuses existing row instead of adding duplicate', () => {
  const first = addFoodDiaryMultiAddDraft([], egg, 100).drafts;
  const duplicate = addFoodDiaryMultiAddDraft(first, { ...egg, name: 'Яйцо' }, 80);

  assert.equal(duplicate.drafts.length, 1);
  assert.equal(duplicate.duplicateKey, first[0].key);
});

test('remove selected product updates basket and totals', () => {
  const basket = addFoodDiaryMultiAddDraft(
    addFoodDiaryMultiAddDraft([], egg, 100).drafts,
    oats,
    100
  ).drafts;
  const before = getFoodDiaryMultiAddTotals(basket);
  const afterBasket = removeFoodDiaryMultiAddDraft(basket, basket[0].key);
  const after = getFoodDiaryMultiAddTotals(afterBasket);

  assert.equal(afterBasket.length, 1);
  assert.equal(Math.round(before.calories), 525);
  assert.equal(Math.round(after.calories), 370);
});

test('entering weights updates per-row preview and total KBJU preview', () => {
  const basket = addFoodDiaryMultiAddDraft([], oats, 100).drafts;
  const updated = updateFoodDiaryMultiAddDraft(basket, basket[0].key, { quantity: '40' });
  const preview = previewFoodDiaryMultiAddDraft(updated[0]);
  const totals = getFoodDiaryMultiAddTotals(updated);

  assert.equal(preview.isValid, true);
  assert.equal(Math.round(preview.weight), 40);
  assert.equal(Math.round(preview.calories), 148);
  assert.equal(Math.round(totals.calories), 148);
  assert.equal(Number(totals.protein.toFixed(1)), 4.8);
});

test('invalid weights block save and partial invalid basket blocks save', () => {
  const basket = addFoodDiaryMultiAddDraft(
    addFoodDiaryMultiAddDraft([], egg, 100).drafts,
    oats,
    50
  ).drafts;
  const invalid = updateFoodDiaryMultiAddDraft(basket, basket[1].key, { quantity: '0' });
  const invalidPreview = previewFoodDiaryMultiAddDraft(invalid[1]);

  assert.equal(invalidPreview.isValid, false);
  assert.match(invalidPreview.error || '', /больше нуля/);
  assert.equal(isFoodDiaryMultiAddBasketValid(invalid), false);
});

test('empty, negative and non-finite weights are invalid', () => {
  const basket = addFoodDiaryMultiAddDraft([], egg, 100).drafts;

  for (const quantity of ['', '-1', 'Infinity']) {
    const [draft] = updateFoodDiaryMultiAddDraft(basket, basket[0].key, { quantity });
    assert.equal(previewFoodDiaryMultiAddDraft(draft).isValid, false);
  }
});

test('valid draft builds a canonical meal entry for existing diary creation path', () => {
  const basket = addFoodDiaryMultiAddDraft([], egg, 100).drafts;
  const entry = buildMealEntryFromMultiAddDraft(basket[0], 'entry-1');

  assert.equal(entry.id, 'entry-1');
  assert.equal(entry.foodId, eggId);
  assert.equal(entry.canonicalFoodId, eggId);
  assert.equal(entry.weight, 100);
  assert.equal(entry.displayUnit, 'г');
  assert.equal(entry.displayAmount, 100);
  assert.equal(Math.round(entry.calories), 155);
});
