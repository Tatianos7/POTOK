import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';

import { analyzeRecipeTextDemo } from '../recipeAnalyzerDemo';
import { RecipeSaveValidationError, ensureRecipeIngredientsResolved } from '../recipesService';

test('analyzer can display nutrition while ingredient is still unresolved', () => {
  const items = analyzeRecipeTextDemo('яйцо куриное 150 г, молоко 100 мл, сливки 30 мл');

  assert.equal(items.length, 3);
  assert.equal(items.every((item) => item.calories > 0), true);
  assert.equal(items.some((item) => item.resolution_status === 'unresolved'), true);
  assert.equal(items.every((item) => item.canonical_food_id == null), true);
});

test('saveRecipe validation rejects unresolved ingredients with structured error', () => {
  assert.throws(
    () =>
      ensureRecipeIngredientsResolved([
        { name: 'Яйцо куриное', canonical_food_id: '11111111-1111-4111-8111-111111111111' },
        { name: 'Молоко', canonical_food_id: null },
      ]),
    (error: unknown) => {
      assert.equal(error instanceof RecipeSaveValidationError, true);
      const validationError = error as RecipeSaveValidationError;
      assert.equal(validationError.code, 'unresolved_ingredients');
      assert.deepEqual(validationError.unresolvedIngredients, ['Молоко']);
      return true;
    }
  );
});

test('fully resolved ingredients pass saveRecipe validation', () => {
  assert.doesNotThrow(() =>
    ensureRecipeIngredientsResolved([
      { name: 'Яйцо куриное', canonical_food_id: '11111111-1111-4111-8111-111111111111' },
      { name: 'Молоко', canonical_food_id: '22222222-2222-4222-8222-222222222222' },
    ])
  );
});

test('recipe analyzer save path does not depend on recompute_recipe_totals RPC', () => {
  const currentDir = dirname(fileURLToPath(import.meta.url));
  const serviceSource = readFileSync(resolve(currentDir, '../recipesService.ts'), 'utf8');

  assert.equal(serviceSource.includes(".rpc('recompute_recipe_totals'"), false);
  assert.equal(serviceSource.includes('.rpc("recompute_recipe_totals"'), false);
});
