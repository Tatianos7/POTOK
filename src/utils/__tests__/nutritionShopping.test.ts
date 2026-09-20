import assert from 'node:assert/strict';
import test from 'node:test';
import { deriveActiveWeekShoppingPreview, type ShoppingRecipeComposition } from '../nutritionShopping';

// Synthetic UUID fixture only; never a production food mapping.
const foodId = '11111111-1111-4111-8111-111111111111';
const recipe: ShoppingRecipeComposition = { recipeId: 'catalog-fixture', baseServings: 2,
  ingredients: [{ canonicalFoodId: foodId, name: 'Fixture grain', state: 'dry', grams: 100 }] };
const input = { currentUserId: 'A', scope: { userId: 'A', planId: 'plan', planVersion: 'v1', goalVersion: 'g1' },
  today: '2026-09-19', fromDate: '2026-09-14', dayCount: 7 as const, compositions: [recipe],
  meals: [
    { date: '2026-09-14', slotId: 'lunch', recipeId: recipe.recipeId, servings: 1 },
    { date: '2026-09-15', slotId: 'lunch', recipeId: recipe.recipeId, servings: 3 },
  ] };

test('shopping counts repeated recipe occurrences and scales by actual selected portions', () => {
  const result = deriveActiveWeekShoppingPreview(input);
  assert.equal(result.products[0].grams, 200);
  assert.equal(result.selectedMealCount, 2);
  assert.deepEqual(result.products[0].recipeIds, [recipe.recipeId]);
  assert.equal(result.createsDiaryFact, false);
  assert.equal(recipe.ingredients[0].grams, 100);
});

test('a changed slot composition replaces the shopping ingredients without changing the base catalog', () => {
  const next = { ...recipe, recipeId: 'replacement-fixture', ingredients: [{ ...recipe.ingredients[0], grams: 40 }] };
  const result = deriveActiveWeekShoppingPreview({ ...input, compositions: [recipe, next],
    meals: [input.meals[0], { ...input.meals[1], recipeId: next.recipeId }] });
  assert.equal(result.products[0].grams, 110);
});

test('missing identity or composition cannot produce a falsely complete shopping list', () => {
  for (const compositions of [[], [recipe, recipe], [{ ...recipe, ingredients: [{ ...recipe.ingredients[0], canonicalFoodId: null }] }]]) {
    const result = deriveActiveWeekShoppingPreview({ ...input, compositions });
    assert.equal(result.status, 'review-required');
    assert.deepEqual(result.products, []);
  }
});

test('raw and cooked states never merge even if an upstream annotation repeats a UUID', () => {
  const result = deriveActiveWeekShoppingPreview({ ...input, compositions: [{ ...recipe,
    ingredients: [recipe.ingredients[0], { ...recipe.ingredients[0], state: 'cooked' }] }] });
  assert.equal(result.products.length, 2);
});

test('scope, duplicate slots and provisional-week shopping are rejected', () => {
  assert.throws(() => deriveActiveWeekShoppingPreview({ ...input, currentUserId: 'B' }), /scope/);
  assert.throws(() => deriveActiveWeekShoppingPreview({ ...input, meals: [input.meals[0], input.meals[0]] }), /duplicate/);
  assert.throws(() => deriveActiveWeekShoppingPreview({ ...input, fromDate: '2026-09-21' }), /active_week/);
});
