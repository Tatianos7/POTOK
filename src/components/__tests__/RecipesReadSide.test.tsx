import test from 'node:test';
import assert from 'node:assert/strict';
import { renderToStaticMarkup } from 'react-dom/server';
import type { Recipe } from '../../types/recipe';

function installLocalStorageMock() {
  const storage = new Map<string, string>();
  Object.defineProperty(globalThis, 'localStorage', {
    value: {
      getItem: (key: string) => storage.get(key) ?? null,
      setItem: (key: string, value: string) => {
        storage.set(key, value);
      },
      removeItem: (key: string) => {
        storage.delete(key);
      },
      clear: () => {
        storage.clear();
      },
    },
    configurable: true,
  });
}

function buildRecipe(id: string, name: string): Recipe {
  const now = new Date('2026-03-23T12:00:00.000Z').toISOString();
  return {
    id,
    name,
    totalCalories: 320,
    totalProteins: 28,
    totalFats: 14,
    totalCarbs: 18,
    ingredients: [
      {
        name: 'Куриная грудка',
        canonical_food_id: '11111111-1111-4111-8111-111111111111',
        quantity: 200,
        unit: 'г',
        grams: 200,
        calories: 330,
        proteins: 62,
        fats: 7,
        carbs: 0,
      },
    ],
    source: 'manual',
    createdAt: now,
    updatedAt: now,
    userId: 'user-1',
  };
}

test('recipes grid renders multiple recipes from base list without optional metadata', async () => {
  installLocalStorageMock();
  const { default: RecipesGrid } = await import('../RecipesGrid');

  const html = renderToStaticMarkup(
    <RecipesGrid
      recipes={[buildRecipe('recipe-1', 'Омлет'), buildRecipe('recipe-2', 'Салат')]}
      onRecipeClick={() => {}}
    />
  );

  assert.match(html, /Омлет/);
  assert.match(html, /Салат/);
});

test('recipes list renders multiple recipes from base list without optional metadata', async () => {
  installLocalStorageMock();
  const { default: RecipesList } = await import('../RecipesList');

  const html = renderToStaticMarkup(
    <RecipesList
      recipes={[buildRecipe('recipe-1', 'Омлет'), buildRecipe('recipe-2', 'Салат')]}
      onRecipeClick={() => {}}
    />
  );

  assert.match(html, /Омлет/);
  assert.match(html, /Салат/);
});

