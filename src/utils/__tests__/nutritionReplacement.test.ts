import assert from 'node:assert/strict';
import test from 'node:test';
import { nutritionWeekPreviewFixture } from '../../test/nutritionWeekPreviewFixture';
import { weekPreviewContextKey } from '../nutritionWeekPreview';
import { previewNutritionReplacement, type PlannedNutritionTotals } from '../nutritionReplacement';

function fixture(): Parameters<typeof previewNutritionReplacement>[0] {
  const { context } = nutritionWeekPreviewFixture();
  context.week.days[2].sourceDay!.meals[0].catalogPrimaryRecipeId = 'original';
  const values = { calories: 2000, protein: 120, fat: 70, carbs: 240 };
  const total: PlannedNutritionTotals = { scope: context.week.scope, fromDate: context.today, toDate: context.today,
    coverage: 'complete', values };
  return { context, expectedContextKey: weekPreviewContextKey(context), date: context.today,
    slotId: 'fixture-slot-3', mealType: 'lunch', originalRecipeId: 'original', candidateRecipeId: 'candidate',
    originalServings: 1, candidateServings: 1,
    recipes: ['original', 'candidate'].map((id) => ({ id, title: id, category: 'lunch', calories: null,
      protein: null, fat: null, carbs: null, cookingTimeMin: null, difficultyLabel: '', isActive: true })),
    eligibility: ['original', 'candidate'].map((recipeId) => ({ recipeId, origin: 'potok-curated', review: 'approved',
      tags: [], mealTypes: ['lunch'], collectionVisible: true, planEligible: true, portionScalable: true, servings: 1, fiber: null })),
    nutrition: [
      { recipeId: 'original', revision: 'synthetic-1', canonicalReview: 'approved', baseServings: 1,
        batch: { calories: 500, protein: 30, fat: 20, carbs: 50 } },
      { recipeId: 'candidate', revision: 'synthetic-2', canonicalReview: 'approved', baseServings: 1,
        batch: { calories: 500, protein: 40, fat: 10, carbs: 62.5 } },
    ], dayTotals: total, weekTotals: { ...total, fromDate: context.week.startDate, toDate: context.week.endDate,
      values: { calories: 14000, protein: 840, fat: 490, carbs: 1680 } },
  };
}

test('equal calories still expose all macro differences and whole-day/week consequences', () => {
  const input = fixture();
  const before = structuredClone(input);
  const result = previewNutritionReplacement(input);
  assert.deepEqual(result.mealDelta, { calories: 0, protein: 10, fat: -10, carbs: 12.5 });
  assert.deepEqual(result.proposedDay, { calories: 2000, protein: 130, fat: 60, carbs: 252.5 });
  assert.equal(result.proposedWeek?.protein, 850);
  assert.equal(result.canApply, false);
  assert.equal(result.createsDiaryFact, false);
  assert.equal(result.changesGoal, false);
  assert.ok(result.blockers.includes('reviewed-portion-and-safety-policy'));
  assert.deepEqual(input, before);
});

test('proposed portion changes only its slot, including repeated recipe occurrences in totals', () => {
  const result = previewNutritionReplacement({ ...fixture(), candidateServings: 2 });
  assert.equal(result.mealDelta?.calories, 500);
  assert.equal(result.proposedDay?.calories, 2500);
  assert.equal(result.proposedWeek?.calories, 14500);
});

test('missing, duplicate, private or unreviewed evidence never becomes a safe replacement', () => {
  for (const change of ['missing-nutrition', 'duplicate', 'unreviewed', 'private', 'portion'] as const) {
    const input = fixture();
    if (change === 'missing-nutrition') input.nutrition = [];
    if (change === 'duplicate') input.nutrition.push(input.nutrition[1]);
    if (change === 'unreviewed') input.nutrition[1].canonicalReview = 'pending';
    if (change === 'private') input.eligibility = input.eligibility.slice(0, 1);
    if (change === 'portion') { input.eligibility[1].portionScalable = false; input.candidateServings = 2; }
    const result = previewNutritionReplacement(input);
    assert.equal(result.canApply, false);
    assert.equal(result.mealDelta, null);
    assert.equal(result.proposedDay, null);
    assert.ok(result.issues.length > 0, change);
  }
});

test('partial or inconsistent totals remain unavailable instead of zero-filled or clamped', () => {
  const input = fixture();
  input.dayTotals!.coverage = 'partial';
  input.weekTotals = null;
  const result = previewNutritionReplacement(input);
  assert.ok(result.mealDelta);
  assert.equal(result.proposedDay, null);
  assert.equal(result.proposedWeek, null);
  input.dayTotals!.coverage = 'complete';
  input.dayTotals!.values.protein = 0;
  assert.ok(previewNutritionReplacement(input).issues.includes('inconsistent_period_totals'));
});

test('account/version/slot/period mismatches reject rather than mutate historical or foreign plans', () => {
  for (const change of ['account', 'version', 'slot', 'original', 'period'] as const) {
    const input = fixture();
    if (change === 'account') input.context.currentUserId = 'account-B';
    if (change === 'version') input.context.week.scope.goalVersion = 'goal-v2';
    if (change === 'slot') input.slotId = 'fixture-slot-1';
    if (change === 'original') input.originalRecipeId = 'different';
    if (change === 'period') input.weekTotals!.fromDate = '2026-09-21';
    assert.throws(() => previewNutritionReplacement(input));
  }
});

test('nonfinite arithmetic cannot produce a plausible preview', () => {
  const input = fixture();
  input.candidateServings = Number.MAX_VALUE;
  const result = previewNutritionReplacement(input);
  assert.equal(result.mealDelta, null);
  assert.ok(result.issues.includes('nutrition_overflow'));
});
