import test from 'node:test';
import assert from 'node:assert/strict';

import { resolveFavoriteFoodForAdd } from '../favoritesFoodSelection';
import type { Food } from '../../types';

function buildFood(overrides: Partial<Food> = {}): Food {
  const now = new Date('2026-03-21T10:00:00.000Z').toISOString();
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

test('hydration before add from favorites path replaces stale local object', async () => {
  const staleFood = buildFood({
    calories: 0,
    protein: 0,
    fat: 0,
    carbs: 0,
  });
  const hydratedFood = buildFood({
    calories: 165,
    protein: 31,
    fat: 3.6,
    carbs: 0,
  });

  const result = await resolveFavoriteFoodForAdd(
    {
      foodId: 'food-1',
      foodName: 'Куриная грудка',
      weight: 120,
      lastUsedAt: '2026-03-21T10:00:00.000Z',
    },
    'user-1',
    {
      getFoodById: () => staleFood,
      search: async () => [],
      hydrateFoodForDiarySelection: async () => hydratedFood,
      isSuspiciousFood: () => false,
    }
  );

  assert.equal(result.kind, 'resolved');
  if (result.kind !== 'resolved') return;
  assert.equal(result.food.calories, 165);
  assert.equal(result.food.protein, 31);
  assert.equal(result.food.id, 'food-1');
});

test('zero-shield blocks suspicious all-zero catalog food from favorites path', async () => {
  const suspiciousFood = buildFood({
    id: 'food-bad',
    name: 'Антрекот из говядины',
    calories: 0,
    protein: 0,
    fat: 0,
    carbs: 0,
    source: 'core',
  });

  const result = await resolveFavoriteFoodForAdd(
    {
      foodId: 'food-bad',
      foodName: 'Антрекот из говядины',
      weight: 140,
      lastUsedAt: '2026-03-21T10:00:00.000Z',
    },
    'user-1',
    {
      getFoodById: () => suspiciousFood,
      search: async () => [],
      hydrateFoodForDiarySelection: async () => suspiciousFood,
      isSuspiciousFood: (food) => food.source === 'core' && food.calories === 0 && food.protein === 0 && food.fat === 0 && food.carbs === 0,
    }
  );

  assert.equal(result.kind, 'blocked_suspicious_zero');
});

test('valid favorite still resolves correctly for user food path', async () => {
  const userFood = buildFood({
    id: 'food-user',
    source: 'user',
    created_by_user_id: 'user-1',
    name: 'Мой омлет',
    calories: 180,
    protein: 12,
    fat: 13,
    carbs: 2,
  });

  const result = await resolveFavoriteFoodForAdd(
    {
      foodId: 'food-user',
      foodName: 'Мой омлет',
      weight: 200,
      lastUsedAt: '2026-03-21T10:00:00.000Z',
    },
    'user-1',
    {
      getFoodById: () => userFood,
      search: async () => [],
      hydrateFoodForDiarySelection: async () => userFood,
      isSuspiciousFood: () => false,
    }
  );

  assert.equal(result.kind, 'resolved');
  if (result.kind !== 'resolved') return;
  assert.equal(result.food.source, 'user');
  assert.equal(result.food.name, 'Мой омлет');
});

test('favorites path falls back to search and opens valid authoritative result', async () => {
  const brandFood = buildFood({
    id: 'food-brand',
    source: 'brand',
    name: 'Тунец в собственном соку',
    calories: 116,
    protein: 26,
    fat: 1,
    carbs: 0,
  });

  const result = await resolveFavoriteFoodForAdd(
    {
      foodId: '',
      foodName: 'Тунец в собственном соку',
      weight: 100,
      lastUsedAt: '2026-03-21T10:00:00.000Z',
    },
    'user-1',
    {
      getFoodById: () => null,
      search: async () => [brandFood],
      hydrateFoodForDiarySelection: async () => brandFood,
      isSuspiciousFood: () => false,
    }
  );

  assert.equal(result.kind, 'resolved');
  if (result.kind !== 'resolved') return;
  assert.equal(result.food.id, 'food-brand');
  assert.equal(result.food.source, 'brand');
});
