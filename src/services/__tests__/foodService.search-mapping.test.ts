import test from 'node:test';
import assert from 'node:assert/strict';

class LocalStorageMock {
  private readonly store = new Map<string, string>();

  getItem(key: string): string | null {
    return this.store.has(key) ? this.store.get(key)! : null;
  }

  setItem(key: string, value: string): void {
    this.store.set(key, value);
  }

  removeItem(key: string): void {
    this.store.delete(key);
  }

  clear(): void {
    this.store.clear();
  }
}

const localStorageMock = new LocalStorageMock();
(globalThis as any).localStorage = localStorageMock;

function buildFood(overrides: Record<string, unknown> = {}) {
  const now = new Date('2026-03-18T10:00:00.000Z').toISOString();
  return {
    id: 'food-1',
    name: 'Антрекот из говядины',
    calories: 250,
    protein: 26,
    fat: 15,
    carbs: 0,
    fiber: 0,
    source: 'core',
    canonical_food_id: 'food-1',
    createdAt: now,
    updatedAt: now,
    ...overrides,
  };
}

test('search results keep per-product nutrition values and do not apply category defaults to public foods', async () => {
  const { finalizeFoodSearchResults } = await import('../foodService');

  const entrecote = buildFood({
    id: 'food-1',
    name: 'Антрекот из говядины',
    category: 'meat',
    calories: 312,
    protein: 19.4,
    fat: 26.1,
    carbs: 0,
  });

  const leanBeef = buildFood({
    id: 'food-2',
    name: 'Говядина постная',
    category: 'meat',
    calories: 131,
    protein: 26,
    fat: 2.6,
    carbs: 0,
  });

  const results = finalizeFoodSearchResults([entrecote as any, leanBeef as any], 'говядина', 10);

  assert.equal(results.length, 2);
  assert.deepEqual(
    results.map((food) => ({
      id: food.id,
      calories: food.calories,
      protein: food.protein,
      fat: food.fat,
      carbs: food.carbs,
    })),
    [
      { id: 'food-1', calories: 312, protein: 19.4, fat: 26.1, carbs: 0 },
      { id: 'food-2', calories: 131, protein: 26, fat: 2.6, carbs: 0 },
    ]
  );
});

test('search duplicate resolution prefers populated nutrition over stale zero-macro duplicate', async () => {
  const { finalizeFoodSearchResults } = await import('../foodService');

  const stale = buildFood({
    id: 'food-stale',
    name: 'Антрекот из говядины',
    category: 'meat',
    calories: 0,
    protein: 0,
    fat: 0,
    carbs: 0,
    verified: false,
    popularity: 1,
  });

  const fresh = buildFood({
    id: 'food-fresh',
    name: 'Антрекот из говядины',
    category: 'meat',
    calories: 312,
    protein: 19.4,
    fat: 26.1,
    carbs: 0,
    verified: true,
    popularity: 5,
  });

  const results = finalizeFoodSearchResults([stale as any, fresh as any], 'антрекот', 10);

  assert.equal(results.length, 1);
  assert.equal(results[0].id, 'food-fresh');
  assert.equal(results[0].calories, 312);
  assert.equal(results[0].protein, 19.4);
  assert.equal(results[0].fat, 26.1);
});

test('selected product hydration preserves authoritative nutrition metadata', async () => {
  const { foodService } = await import('../foodService');
  const svc = foodService as any;
  const original = svc.getFoodByIdFresh;

  svc.getFoodByIdFresh = async (id: string) => {
    if (id !== 'food-1') return null;
    return buildFood({
      id: 'food-1',
      calories: 312,
      protein: 19.4,
      fat: 26.1,
      carbs: 0,
    });
  };

  try {
    const hydrated = await foodService.hydrateFoodForDiarySelection(
      buildFood({
        id: 'food-1',
        calories: 0,
        protein: 0,
        fat: 0,
        carbs: 0,
      }) as any,
      'user-1'
    );

    assert.equal(hydrated.calories, 312);
    assert.equal(hydrated.protein, 19.4);
    assert.equal(hydrated.fat, 26.1);
    assert.equal(hydrated.carbs, 0);
  } finally {
    svc.getFoodByIdFresh = original;
  }
});

test('suspicious all-zero catalog foods are excluded from actionable search results', async () => {
  const { finalizeFoodSearchResults } = await import('../foodService');

  const brokenCatalogFood = buildFood({
    id: 'food-bad',
    name: 'Антрекот из говядины',
    source: 'core',
    category: 'meat',
    calories: 0,
    protein: 0,
    fat: 0,
    carbs: 0,
  });

  const validFood = buildFood({
    id: 'food-good',
    name: 'Говядина постная',
    source: 'core',
    category: 'meat',
    calories: 131,
    protein: 26,
    fat: 2.6,
    carbs: 0,
  });

  const results = finalizeFoodSearchResults([brokenCatalogFood as any, validFood as any], 'говядина', 10);

  assert.equal(results.length, 1);
  assert.equal(results[0].id, 'food-good');
});

test('valid zero-macro whitelist item stays visible in search results', async () => {
  const { finalizeFoodSearchResults } = await import('../foodService');

  const water = buildFood({
    id: 'food-water',
    name: 'Вода',
    source: 'core',
    category: 'beverages',
    calories: 0,
    protein: 0,
    fat: 0,
    carbs: 0,
  });

  const results = finalizeFoodSearchResults([water as any], 'вода', 10);

  assert.equal(results.length, 1);
  assert.equal(results[0].id, 'food-water');
});
