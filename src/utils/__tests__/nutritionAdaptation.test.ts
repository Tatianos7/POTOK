import assert from 'node:assert/strict';
import test from 'node:test';
import { createMealConfirmationIntent, reviewDailyNutrition } from '../nutritionAdaptation';
import { filterCuratedRecipes } from '../curatedRecipeEligibility';
import type { CuratedRecipeEligibility } from '../../types/adaptiveNutrition';

const scope = { userId: 'A', planId: 'plan', planVersion: 'v1', goalVersion: 'g1' };
const target = { calories: 2200, protein: 140, fat: 70, carbs: 252.5 };
const input = { scope, currentUserId: 'A', date: '2026-09-19', target, actual: null,
  dayState: 'normal' as const, cycle: { enabled: false as const } };

test('every meal choice is an intent, never a completion or diary write', () => {
  for (const choice of ['ate-as-planned', 'ate-with-changes', 'did-not-eat', 'extra-food'] as const) {
    const intent = createMealConfirmationIntent({ ...input, slotId: 'lunch', choice });
    assert.equal(intent.createsDiaryFact, false);
    assert.equal(intent.requiresFactReview, true);
    assert.equal(intent.kind, 'confirmation-intent');
  }
  assert.throws(() => createMealConfirmationIntent({ ...input, currentUserId: 'B', slotId: 'lunch', choice: 'ate-as-planned' }), /account/);
  assert.throws(() => createMealConfirmationIntent({ ...input, slotId: null, choice: 'did-not-eat' }), /slot/);
});

test('extra food and missed intake never create automatic tomorrow compensation', () => {
  for (const calories of [2500, 1900]) {
    const actual = { userId: 'A', date: input.date, source: 'diary-facts' as const,
      coverage: 'confirmed-complete' as const, totals: { ...target, calories } };
    const review = reviewDailyNutrition({ ...input, actual });
    assert.equal(review.actualMinusTarget?.calories, calories - target.calories);
    assert.equal(review.options[0].action, 'keep-plan');
    assert.equal(review.options.every((option) => !option.appliesAutomatically), true);
    assert.equal(review.canApplyAdjustment, false);
    assert.equal(review.changesGoal, false);
    assert.equal(review.createsDiaryFact, false);
    assert.deepEqual(input.target, target);
  }
});

test('unknown or partial diary coverage is never confirmed undereating', () => {
  assert.equal(reviewDailyNutrition(input).actualMinusTarget, null);
  const result = reviewDailyNutrition({ ...input, actual: { userId: 'A', date: input.date, source: 'diary-facts',
    coverage: 'partial', totals: { calories: 0, protein: 0, fat: 0, carbs: 0 } } });
  assert.equal(result.isCompleteDayComparison, false);
});

test('review rejects foreign account/date and malformed nutrients', () => {
  const actual = { userId: 'A', date: input.date, source: 'diary-facts' as const,
    coverage: 'partial' as const, totals: target };
  for (const changes of [{ userId: 'B' }, { date: '2026-09-18' }, { totals: { ...target, calories: NaN } }]) {
    assert.throws(() => reviewDailyNutrition({ ...input, actual: { ...actual, ...changes } }), /actual_nutrition/);
  }
});

test('opted-in cycle disruption requests health review without outputting sensitive symptoms', () => {
  const result = reviewDailyNutrition({ ...input, cycle: { enabled: true, contraception: 'hormonal',
    symptoms: ['pain'], reportedCycleDisruption: true } });
  assert.equal(result.guidance, 'health-review-before-restriction');
  assert.equal(result.canApplyAdjustment, false);
  assert.equal(JSON.stringify(result).includes('hormonal'), false);
  assert.equal(JSON.stringify(result).includes('pain'), false);
});

test('one curated identity supports multiple approved tags; missing/private/unreviewed metadata never qualifies', () => {
  const recipe = { id: 'catalog-id', title: 'Fixture', category: 'lunch', calories: null, protein: null,
    fat: null, carbs: null, cookingTimeMin: null, difficultyLabel: '', isActive: true };
  const entry: CuratedRecipeEligibility = { recipeId: recipe.id, origin: 'potok-curated', review: 'approved',
    tags: ['vegan', 'high_carb'], mealTypes: ['lunch'], collectionVisible: true, planEligible: false,
    portionScalable: false, servings: null, fiber: null };
  assert.deepEqual(filterCuratedRecipes([recipe], [entry], { purpose: 'collection', tags: ['vegan', 'high_carb'] }), [recipe]);
  assert.deepEqual(filterCuratedRecipes([recipe], [entry], { purpose: 'plan' }), []);
  assert.deepEqual(filterCuratedRecipes([recipe], [], { purpose: 'collection' }), []);
  assert.deepEqual(filterCuratedRecipes([recipe], [{ ...entry, review: 'pending' }], { purpose: 'collection' }), []);
  const privateEntry = { ...entry, origin: 'private-user-recipe' } as unknown as CuratedRecipeEligibility;
  assert.deepEqual(filterCuratedRecipes([recipe], [privateEntry], { purpose: 'collection' }), []);
  assert.deepEqual(filterCuratedRecipes([recipe], [entry, entry], { purpose: 'collection' }), []);
  assert.deepEqual(filterCuratedRecipes([recipe, recipe], [entry], { purpose: 'collection' }), []);
});
