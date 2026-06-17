import test from 'node:test';
import assert from 'node:assert/strict';

import { calculateMacros } from '../goalProjection';

test('calculateMacros returns positive carbs for normal calories', () => {
  const macros = calculateMacros(70, 2200);

  assert.equal(macros.proteins, 140);
  assert.equal(macros.fats, 63);
  assert.ok(macros.carbs > 0);
});

test('calculateMacros clamps carbs to zero for low calories', () => {
  const macros = calculateMacros(70, 1000);

  assert.equal(macros.proteins, 140);
  assert.equal(macros.fats, 63);
  assert.equal(macros.carbs, 0);
});

test('calculateMacros clamps carbs to zero when remaining calories are negative', () => {
  const macros = calculateMacros(120, 900);

  assert.equal(macros.proteins, 240);
  assert.equal(macros.fats, 108);
  assert.equal(macros.carbs, 0);
});

test('calculateMacros keeps protein and fat unchanged when carbs are clamped', () => {
  const normalCalories = calculateMacros(70, 2200);
  const lowCalories = calculateMacros(70, 900);

  assert.equal(lowCalories.proteins, normalCalories.proteins);
  assert.equal(lowCalories.fats, normalCalories.fats);
  assert.equal(lowCalories.carbs, 0);
});

test('create and edit goal flows can use the same macro helper result', () => {
  const weight = 82;
  const calories = 2400;

  const createFlowMacros = calculateMacros(weight, calories);
  const editFlowMacros = calculateMacros(weight, calories);

  assert.deepEqual(editFlowMacros, createFlowMacros);
});
