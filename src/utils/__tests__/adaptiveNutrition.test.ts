import assert from 'node:assert/strict';
import test from 'node:test';
import { ingredientGrams, previewAdvancedMacros, trainingContextFromLegacyGoal } from '../adaptiveNutrition';
import { nutritionWeekDates, parseNutritionDate } from '../nutritionWeek';

const recommendation = { calories: 2200, protein: 140, fat: 70, carbs: 252.5 };
const input = { recommendation, weightKg: 70, calories: { source: 'potok' as const },
  protein: { source: 'potok' as const }, fat: { source: 'potok' as const } };

test('manual g/kg macro draft balances calories exactly without activating or changing a goal', () => {
  const before = structuredClone(input);
  const result = previewAdvancedMacros({ ...input, protein: { source: 'manual', unit: 'g/kg', value: 1.5 },
    fat: { source: 'manual', unit: 'g', value: 60 } });
  assert.ok(result.ok);
  assert.equal(result.values.protein, 105);
  assert.equal(result.values.carbs, 310);
  assert.equal(result.values.protein * 4 + result.values.fat * 9 + result.values.carbs * 4, 2200);
  assert.equal(result.canActivate, false);
  assert.equal(result.clinicalSafety, 'not-evaluated');
  assert.deepEqual(input, before);
});

test('advanced draft rejects negative residual instead of the legacy zero-carb clamp', () => {
  assert.deepEqual(previewAdvancedMacros({ ...input, calories: { source: 'manual', value: 1000 } }),
    { ok: false, reason: 'negative-carbohydrate-energy' });
  const exact = previewAdvancedMacros({ ...input, calories: { source: 'manual', value: 1190 } });
  assert.ok(exact.ok);
  assert.equal(exact.values.carbs, 0);
  assert.equal(exact.canActivate, false);
});

test('macro drafts reject nonfinite, negative and overflowing input without a safety recommendation', () => {
  for (const value of [-1, NaN, Infinity, Number.MAX_VALUE]) {
    assert.equal(previewAdvancedMacros({ ...input, protein: { source: 'manual', unit: 'g/kg', value } }).ok, false);
  }
  for (const weightKg of [0, -1, NaN]) assert.equal(previewAdvancedMacros({ ...input, weightKg }).ok, false);
});

test('legacy place is not evidence of training frequency, intensity or activity', () => {
  assert.deepEqual(trainingContextFromLegacyGoal({ ...recommendation, training_place: 'gym' }), {
    trains: null, place: 'gym', activities: [], sessionsPerWeek: null, durationMinutes: null, perceivedLoad: null,
  });
  assert.equal(trainingContextFromLegacyGoal(recommendation).place, null);
  assert.equal(trainingContextFromLegacyGoal({ ...recommendation, training_place: 'none' }).trains, false);
});

test('oil ml never silently means grams; density requires explicit evidence', () => {
  const oil = { stableFoodRef: 'oil-candidate', state: 'as-sold' as const, amount: 10, unit: 'ml' as const };
  assert.equal(ingredientGrams(oil), null);
  // Synthetic conversion fixture, not an actual food density recommendation.
  assert.equal(ingredientGrams({ ...oil, density: { gramsPerMl: 0.8, evidenceRef: 'synthetic-fixture' } }), 8);
  assert.equal(ingredientGrams({ ...oil, density: { gramsPerMl: 1, evidenceRef: '' } }), null);
  assert.equal(ingredientGrams({ ...oil, unit: 'g' }), 10);
  assert.equal(ingredientGrams({ ...oil, amount: Infinity }), null);
});

test('civil weeks are Monday to Sunday across year, leap-day and DST boundaries', () => {
  assert.deepEqual(nutritionWeekDates('2027-01-03'), [
    '2026-12-28', '2026-12-29', '2026-12-30', '2026-12-31', '2027-01-01', '2027-01-02', '2027-01-03',
  ]);
  assert.equal(nutritionWeekDates('2027-01-03', 1)[0], '2027-01-04');
  assert.equal(nutritionWeekDates('2024-02-29')[3], '2024-02-29');
  assert.equal(nutritionWeekDates('2026-03-29')[6], '2026-03-29');
});

test('impossible dates never roll into a different week', () => {
  for (const date of ['2026-02-29', '2026-04-31', '2026-1-01', '0000-01-01', '2026-09-19T00:00:00Z']) {
    assert.throws(() => parseNutritionDate(date), /invalid_calendar_date/);
  }
});
