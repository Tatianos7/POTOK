import assert from 'node:assert/strict';
import test from 'node:test';
import { readFileSync } from 'node:fs';
import { validateRecipeCandidates, type CatalogFood, type RecipeCandidate } from './validateRecipeCandidates';

// Synthetic numeric fixtures verify arithmetic; never export as food content.
const food: CatalogFood = {
  id: '11111111-1111-4111-8111-111111111111', canonical_food_id: '11111111-1111-4111-8111-111111111111',
  stable_food_id: 'fixture_food', name: 'Test fixture', source: 'core', verified: true, needs_review: false, is_searchable: true,
  calories: 200, protein: 10, fat: 4, carbs: 31, fiber: null,
};
const recipe: RecipeCandidate = {
  stable_recipe_id: 'test_recipe', title: 'Test recipe', description: 'Synthetic fixture', category: 'breakfast',
  servings: 2, preparation_time_min: 10, tags: [], provenance: 'test only', steps: ['Test preparation'],
  ingredients: [{ stable_food_id: 'fixture_food', amount_g: 150 }],
};

test('macros derive only from canonical foods and scale by servings with unknown fiber preserved', () => {
  const report = validateRecipeCandidates([{ ...recipe, calories: 999 } as RecipeCandidate], [food]);
  assert.equal(report.summary.valid, 1);
  assert.equal(report.publishable, false);
  assert.deepEqual(report.recipes[0].totals, { calories: 300, protein: 15, fat: 6, carbs: 46.5, fiber: null });
  assert.deepEqual(report.recipes[0].per_serving, { calories: 150, protein: 7.5, fat: 3, carbs: 23.25, fiber: null });
  assert.equal(report.recipes[0].ingredients[0].food_id, food.id);
});

test('unresolved and ambiguous ingredients fail closed without partial totals or UUID invention', () => {
  for (const foods of [[], [food, { ...food }]]) {
    const result = validateRecipeCandidates([recipe], foods);
    assert.equal(result.summary.rejected, 1);
    assert.equal(result.recipes[0].totals, null);
    assert.deepEqual(result.recipes[0].ingredients, []);
  }
  assert.equal(validateRecipeCandidates([recipe], []).summary.unresolved_foods, 1);
  assert.equal(validateRecipeCandidates([recipe], [food, food]).summary.ambiguous_foods, 1);
});

test('private, unreviewed, hidden, non-root and invalid nutrient foods cannot publish', () => {
  for (const patch of [
    { source: 'user' }, { verified: false }, { needs_review: true }, { is_searchable: false },
    { canonical_food_id: 'different' }, { id: 'semantic_not_uuid' },
    { calories: NaN }, { protein: -1 }, { fat: Infinity }, { fiber: -1 }, { protein: 101 },
  ]) {
    const result = validateRecipeCandidates([recipe], [{ ...food, ...patch }]);
    assert.equal(result.summary.valid, 0, JSON.stringify(patch));
    assert.equal(result.recipes[0].totals, null);
  }
});

test('zero macro recipes reject and calorie or macro outliers require review', () => {
  const zero = { ...food, calories: 0, protein: 0, fat: 0, carbs: 0, fiber: 0 };
  assert.equal(validateRecipeCandidates([recipe], [zero]).recipes[0].issues[0].code, 'zero_macro_recipe');
  assert.equal(validateRecipeCandidates([{ ...recipe, ingredients: [{ stable_food_id: 'fixture_food', amount_g: 5 }] }], [food]).summary.calorie_outliers, 1);
  assert.equal(validateRecipeCandidates([recipe], [{ ...food, calories: 500 }]).summary.macro_outliers, 1);
});

test('duplicates cannot win by input order; ingredient ordering and split rows do not bypass detection', () => {
  const duplicate = { ...recipe, stable_recipe_id: 'another_id', ingredients: [
    { stable_food_id: 'fixture_food', amount_g: 100 }, { stable_food_id: 'fixture_food', amount_g: 50 },
  ] };
  const result = validateRecipeCandidates([recipe, duplicate], [food]);
  assert.equal(result.summary.duplicates, 2);
  assert.equal(result.summary.valid, 0);
  const reversed = validateRecipeCandidates([duplicate, recipe], [food]);
  assert.deepEqual(result.summary, reversed.summary);
});

test('near-duplicates require review without deleting either candidate', () => {
  const result = validateRecipeCandidates([recipe, { ...recipe, stable_recipe_id: 'variation', ingredients: [{ stable_food_id: 'fixture_food', amount_g: 180 }] }], [food]);
  assert.equal(result.summary.near_duplicates, 2);
  assert.equal(result.summary.review, 2);
  assert.equal(result.recipes.length, 2);
});

test('invalid recipe units, portions and preparation are rejected', () => {
  for (const patch of [{ servings: 0 }, { servings: 1.5 }, { preparation_time_min: Infinity }, { steps: [] }, { ingredients: [] }, { ingredients: [{ stable_food_id: 'fixture_food', amount_g: -20 }] }]) {
    assert.equal(validateRecipeCandidates([{ ...recipe, ...patch }], [food]).summary.rejected, 1);
  }
});

test('authored sample covers all meals and remains blocked without an actual canonical export', () => {
  const candidates = JSON.parse(readFileSync(new URL('../../data/recipes/recipe-candidates-v1.json', import.meta.url), 'utf8')) as RecipeCandidate[];
  assert.deepEqual(new Set(candidates.map((candidate) => candidate.category)), new Set(['breakfast', 'lunch', 'dinner', 'snack']));
  const result = validateRecipeCandidates(candidates, []);
  assert.equal(result.summary.total_recipes, 4);
  assert.equal(result.summary.valid, 0);
  assert.equal(result.summary.rejected, 4);
  assert.equal(result.recipes.some((row) => row.issues.some((issue) => issue.code === 'invalid_recipe_content')), false);
});
