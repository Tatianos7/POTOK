import assert from 'node:assert/strict';
import test from 'node:test';
import { mapRecipeGraphIngredient, prepareRecipeIngredients, RecipeSaveValidationError } from '../recipesService';
import { resolveExactFoodCandidates, type ResolverFood } from '../canonicalFoodResolver';
import { calcTotals } from '../../utils/nutritionCalculator';
import type { Recipe } from '../../types/recipe';

const storage = new Map<string, string>();
Object.defineProperty(globalThis, 'localStorage', { configurable: true, value: {
  getItem: (key: string) => storage.get(key) ?? null,
  setItem: (key: string, value: string) => storage.set(key, value),
  removeItem: (key: string) => storage.delete(key),
} });
const { analyzeRecipeTextReal } = await import('../recipeAnalyzerReal');
const { resolveCanonicalFavoriteId } = await import('../favoritesService');

const A = '11111111-1111-4111-8111-111111111111';
const B = '22222222-2222-4222-8222-222222222222';
const milk: ResolverFood = { id: A, canonical_food_id: A, name: 'Молоко', normalized_name: 'молоко', source: 'core',
  calories: 60, protein: 3, fat: 3, carbs: 5, fiber: null, createdAt: '', updatedAt: '' };
const ingredient = (changes: Partial<NonNullable<Recipe['ingredients']>[number]> = {}) => ({
  name: 'Молоко', quantity: 150, unit: 'г', grams: 150, calories: 999, proteins: 999, fats: 999, carbs: 999, ...changes,
});

test('analyzer reports ambiguity, excludes nutrition and never retries it as a shorter query', async () => {
  const calls: string[] = [];
  const rows = [milk, { ...milk, id: B, canonical_food_id: B }];
  const items = await analyzeRecipeTextReal('молоко 150 г', { resolve: async (query) => {
    calls.push(query); return resolveExactFoodCandidates(query, rows);
  } });
  assert.equal(items[0].resolution_status, 'ambiguous');
  assert.equal(items[0].resolution_reason, 'catalog_ambiguous');
  assert.equal(items[0].canonical_food_id, null);
  assert.equal(calcTotals(items).total.calories, 0);
  assert.equal(calls.length, 1);
});

test('analyzer preserves catalog failure instead of masking it with fuzzy suggestions', async () => {
  let calls = 0;
  const items = await analyzeRecipeTextReal('молоко 150 г', { resolve: async () => {
    calls += 1; return { status: 'unresolved', food: null, candidates: [], reason: 'unavailable' };
  } });
  assert.equal(items[0].resolution_reason, 'catalog_unavailable');
  assert.equal(calls, 1);
});

test('analyzer passes exact account scope and rejects corrupt nutrition', async () => {
  for (const calories of [NaN, -1, Infinity]) {
    const items = await analyzeRecipeTextReal('молоко 150 г', { userId: 'account-A', resolve: async (query, userId) => {
      assert.equal(userId, 'account-A');
      return resolveExactFoodCandidates(query, [{ ...milk, calories }], userId);
    } });
    assert.equal(items[0].resolution_reason, 'invalid_nutrition');
    assert.equal(items[0].canonical_food_id, null);
  }
});

test('recipe preflight rejects ambiguity/unresolved states even with a supplied UUID', async () => {
  for (const resolution_status of ['ambiguous', 'unresolved'] as const) {
    await assert.rejects(prepareRecipeIngredients([ingredient({ canonical_food_id: A, resolution_status })], 'A'), RecipeSaveValidationError);
  }
  await assert.rejects(prepareRecipeIngredients([ingredient()], 'A', async (query) =>
    resolveExactFoodCandidates(query, [milk, { ...milk, id: B, canonical_food_id: B }])
  ), RecipeSaveValidationError);
});

test('recipe preflight cannot reassign an ingredient but retain another foods nutrition', async () => {
  const rows = await prepareRecipeIngredients([ingredient()], 'account-A', async (query, userId) => {
    assert.equal(userId, 'account-A'); return resolveExactFoodCandidates(query, [milk]);
  });
  assert.equal(rows[0].canonical_food_id, A);
  assert.deepEqual([rows[0].calories, rows[0].proteins, rows[0].fats, rows[0].carbs], [90, 4.5, 4.5, 7.5]);
  assert.equal(rows[0].grams, 150);
});

test('recipe preflight rejects invalid amounts/nutrition and retains existing valid snapshots', async () => {
  for (const grams of [0, -1, NaN, Infinity]) {
    await assert.rejects(prepareRecipeIngredients([ingredient({ canonical_food_id: A, grams })], 'A'), /quantity/);
  }
  for (const calories of [NaN, Infinity, -1]) {
    await assert.rejects(prepareRecipeIngredients([ingredient({ canonical_food_id: A, calories })], 'A'), /Invalid ingredient/);
  }
  const source = ingredient({ canonical_food_id: A, calories: 0 });
  const rows = await prepareRecipeIngredients([source], 'A', async () => { throw new Error('must not re-resolve a selected identity'); });
  assert.deepEqual(rows, [source]);
  await assert.rejects(prepareRecipeIngredients([
    ingredient({ canonical_food_id: A, calories: Number.MAX_VALUE }),
    ingredient({ canonical_food_id: B, calories: Number.MAX_VALUE }),
  ], 'A'), /numeric range/);
});

test('favorite fallback never assigns the first ambiguous or merely similar UUID', async () => {
  const rows = [milk, { ...milk, id: B, canonical_food_id: B }];
  assert.equal(await resolveCanonicalFavoriteId('A', 'Молоко', undefined, async (query, userId) => {
    assert.equal(userId, 'A'); return resolveExactFoodCandidates(query, rows);
  }), null);
  assert.equal(await resolveCanonicalFavoriteId('A', 'Моло', undefined, async (query) => resolveExactFoodCandidates(query, [milk])), null);
  assert.equal(await resolveCanonicalFavoriteId('A', 'Молоко', undefined, async (query) => resolveExactFoodCandidates(query, [milk])), A);
  assert.equal(await resolveCanonicalFavoriteId('A', B, undefined, async () => { throw new Error('explicit identity must be preserved'); }), B);
});

test('recipe preflight freezes the draft across async resolution and returns independent snapshots', async () => {
  let finish!: () => void;
  const pending = new Promise<void>((resolve) => { finish = resolve; });
  const draft = [ingredient(), ingredient({ canonical_food_id: B })];
  const preparing = prepareRecipeIngredients(draft, 'account-A', async (query) => {
    assert.equal(query, 'Молоко');
    await pending;
    return resolveExactFoodCandidates(query, [milk]);
  });
  draft[0].name = 'Другое';
  draft[0].grams = 300;
  draft[1].canonical_food_id = A;
  draft[1].calories = 12;
  finish();
  const rows = await preparing;
  assert.equal(rows[0].name, 'Молоко');
  assert.equal(rows[0].grams, 150);
  assert.equal(rows[0].calories, 90);
  assert.equal(rows[1].canonical_food_id, B);
  assert.equal(rows[1].calories, 999);
  draft[1].grams = 500;
  assert.equal(rows[1].grams, 150);
});

test('finite ingredient weights cannot overflow the total recipe weight', async () => {
  await assert.rejects(prepareRecipeIngredients([
    ingredient({ canonical_food_id: A, grams: Number.MAX_VALUE }),
    ingredient({ canonical_food_id: B, grams: Number.MAX_VALUE }),
  ], 'A'), /numeric range/);
});

test('conflicting catalog snapshots cannot contribute nutrition or pass recipe/favorite fallback', async () => {
  const resolve = async (query: string) => resolveExactFoodCandidates(query, [milk, { ...milk, calories: 61 }]);
  const items = await analyzeRecipeTextReal('молоко 150 г', { resolve });
  assert.equal(items[0].resolution_reason, 'catalog_unavailable');
  assert.equal(items[0].canonical_food_id, null);
  assert.equal(calcTotals(items).total.calories, 0);
  await assert.rejects(prepareRecipeIngredients([ingredient()], 'A', resolve), RecipeSaveValidationError);
  assert.equal(await resolveCanonicalFavoriteId('A', 'Молоко', undefined, resolve), null);
});

test('graph read followed by save rejects missing nutrition instead of persisting invented zeros', async () => {
  for (const missing of [null, undefined, '', ' ', 'invalid', Infinity]) {
    const row = mapRecipeGraphIngredient({ food_id: A, amount_g: 150, food: { ...milk, calories: missing } });
    assert.ok(!Number.isFinite(row.calories));
    await assert.rejects(prepareRecipeIngredients([row], 'A'), /Invalid ingredient/);
  }
  for (const food of [null, undefined, [], [milk], [milk, { ...milk, id: B }], 'invalid']) {
    const missingFood = mapRecipeGraphIngredient({ food_id: A, amount_g: 150, food });
    await assert.rejects(prepareRecipeIngredients([missingFood], 'A'), /Invalid ingredient/);
  }
});

test('graph mapping preserves real zeros and numeric strings, rejects invalid amounts before save', async () => {
  const zero = mapRecipeGraphIngredient({ food_id: A, amount_g: '150', food: {
    name: 'Вода', calories: '0', protein: 0, fat: '0', carbs: 0,
  } });
  assert.deepEqual([zero.grams, zero.calories, zero.proteins, zero.fats, zero.carbs], [150, 0, 0, 0, 0]);
  assert.deepEqual(await prepareRecipeIngredients([zero], 'A'), [zero]);
  for (const amount_g of [null, '', 'invalid', 0, -1, Infinity]) {
    const row = mapRecipeGraphIngredient({ food_id: A, amount_g, food: milk });
    await assert.rejects(prepareRecipeIngredients([row], 'A'), /quantity/);
  }
});
