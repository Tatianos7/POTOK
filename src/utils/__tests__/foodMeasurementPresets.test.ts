import test from 'node:test';
import assert from 'node:assert/strict';

import { getQuickFoodPresets, getSafeDisplayUnit, getSupportedFoodDisplayUnits } from '../foodMeasurementPresets';
import type { Food } from '../../types';

function buildFood(overrides: Partial<Food> = {}): Food {
  const now = new Date('2026-03-23T10:00:00.000Z').toISOString();
  return {
    id: 'food-1',
    name: 'Куриная грудка',
    calories: 165,
    protein: 31,
    fat: 3.6,
    carbs: 0,
    fiber: 0,
    source: 'core',
    canonical_food_id: 'food-1',
    createdAt: now,
    updatedAt: now,
    ...overrides,
  };
}

test('default product keeps only reasonable presets', () => {
  const food = buildFood({ name: 'Куриная грудка', category: 'meat' });

  const presets = getQuickFoodPresets(food);
  const units = getSupportedFoodDisplayUnits(food);

  assert.deepEqual(presets.map((item) => item.label), ['100 г']);
  assert.deepEqual(units, ['г']);
});

test('liquid-like product gets ml presets', () => {
  const food = buildFood({ name: 'Кефир', category: 'dairy', unit: 'мл' });

  const presets = getQuickFoodPresets(food);
  const units = getSupportedFoodDisplayUnits(food);

  assert.deepEqual(presets.map((item) => item.label), ['100 г', '100 мл']);
  assert.deepEqual(units, ['г', 'мл', 'л']);
});

test('non-liquid product does not get irrelevant ml presets', () => {
  const food = buildFood({ name: 'Говядина', category: 'meat' });

  const presets = getQuickFoodPresets(food);
  const units = getSupportedFoodDisplayUnits(food);

  assert.equal(presets.some((item) => item.unit === 'мл'), false);
  assert.equal(units.includes('мл'), false);
  assert.equal(units.includes('л'), false);
});

test('unknown semantics do not get fake piece or spoon presets', () => {
  const food = buildFood({ name: 'Рис отварной', category: 'grains' });

  const presets = getQuickFoodPresets(food);
  const units = getSupportedFoodDisplayUnits(food);

  assert.equal(presets.some((item) => item.unit === 'шт'), false);
  assert.equal(presets.some((item) => item.unit === 'ст.л'), false);
  assert.equal(presets.some((item) => item.unit === 'ч.л'), false);
  assert.equal(units.includes('шт'), false);
  assert.equal(units.includes('ст.л'), false);
  assert.equal(units.includes('ч.л'), false);
});

test('modal preset logic does not expose fake portion semantics', () => {
  const food = buildFood({ name: 'Куриная грудка', category: 'meat' });

  const presets = getQuickFoodPresets(food);
  const units = getSupportedFoodDisplayUnits(food);

  assert.equal(presets.some((item) => item.unit === 'порция'), false);
  assert.equal(units.includes('порция'), false);
});

test('add/edit presets stay consistent for the same product', () => {
  const food = buildFood({ name: 'Кефир', category: 'dairy', unit: 'мл' });

  const addPresets = getQuickFoodPresets(food);
  const editPresets = getQuickFoodPresets(food);
  const addUnits = getSupportedFoodDisplayUnits(food);
  const editUnits = getSupportedFoodDisplayUnits(food);

  assert.deepEqual(addPresets, editPresets);
  assert.deepEqual(addUnits, editUnits);
});

test('invalid unit resets safely to grams baseline', () => {
  const food = buildFood({ name: 'Куриная грудка', category: 'meat' });
  const supportedUnits = getSupportedFoodDisplayUnits(food);

  assert.equal(getSafeDisplayUnit('мл', supportedUnits), 'г');
  assert.equal(getSafeDisplayUnit('шт', supportedUnits), 'г');
  assert.equal(getSafeDisplayUnit('г', supportedUnits), 'г');
});
