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
  const food = {
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
  if (!Object.prototype.hasOwnProperty.call(overrides, 'canonical_food_id')) {
    food.canonical_food_id = food.id;
  }
  return food;
}

test('nullable number helper preserves null and zero semantics', async () => {
  const { toNullableFiniteNumber } = await import('../foodService.ts');

  assert.equal(toNullableFiniteNumber(null), null);
  assert.equal(toNullableFiniteNumber(undefined), null);
  assert.equal(toNullableFiniteNumber(''), null);
  assert.equal(toNullableFiniteNumber(0), 0);
  assert.equal(toNullableFiniteNumber('0'), 0);
  assert.equal(toNullableFiniteNumber('2.5'), 2.5);
  assert.equal(toNullableFiniteNumber('not-a-number'), null);
});

test('Supabase food mapping preserves nullable fiber contract', async () => {
  const { foodService } = await import('../foodService.ts');
  const svc = foodService as any;
  const baseRow = {
    id: '550e8400-e29b-41d4-a716-446655440000',
    name: 'Яичница глазунья',
    calories: '196',
    protein: '13.6',
    fat: '14.8',
    carbs: '0.8',
    source: 'core',
    canonical_food_id: '550e8400-e29b-41d4-a716-446655440000',
    created_at: '2026-07-02T00:00:00.000Z',
    updated_at: '2026-07-02T00:00:00.000Z',
  };

  assert.equal(svc.mapSupabaseRowToFood({ ...baseRow, fiber: null }).fiber, null);
  assert.equal(svc.mapSupabaseRowToFood({ ...baseRow, fiber: 0 }).fiber, 0);
  assert.equal(svc.mapSupabaseRowToFood({ ...baseRow, fiber: '0' }).fiber, 0);
  assert.equal(svc.mapSupabaseRowToFood({ ...baseRow, fiber: '3.25' }).fiber, 3.25);
  assert.equal(svc.mapSupabaseRowToFood({ ...baseRow, fiber: 'bad' }).fiber, null);
});

test('selected product hydration preserves null fiber and UUID identity', async () => {
  const { foodService } = await import('../foodService.ts');
  const svc = foodService as any;
  const original = svc.getFoodByIdFresh;
  const canonicalId = '550e8400-e29b-41d4-a716-446655440000';

  svc.getFoodByIdFresh = async (id: string) => {
    if (id !== canonicalId) return null;
    return buildFood({
      id: canonicalId,
      canonical_food_id: canonicalId,
      calories: 196,
      protein: 13.6,
      fat: 14.8,
      carbs: 0.8,
      fiber: null,
    });
  };

  try {
    const hydrated = await foodService.hydrateFoodForDiarySelection(
      buildFood({
        id: canonicalId,
        canonical_food_id: canonicalId,
        fiber: 0,
      }) as any,
      'user-1'
    );

    assert.equal(hydrated.id, canonicalId);
    assert.equal(hydrated.canonical_food_id, canonicalId);
    assert.equal(hydrated.fiber, null);
  } finally {
    svc.getFoodByIdFresh = original;
  }
});

test('search results keep per-product nutrition values and do not apply category defaults to public foods', async () => {
  const { finalizeFoodSearchResults } = await import('../foodService.ts');

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
    })).sort((a, b) => a.id.localeCompare(b.id)),
    [
      { id: 'food-1', calories: 312, protein: 19.4, fat: 26.1, carbs: 0 },
      { id: 'food-2', calories: 131, protein: 26, fat: 2.6, carbs: 0 },
    ]
  );
});

test('search duplicate resolution prefers populated nutrition over stale zero-macro duplicate', async () => {
  const { finalizeFoodSearchResults } = await import('../foodService.ts');

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
  const { foodService } = await import('../foodService.ts');
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

test('selected product hydration returns authoritative zero-macro row so zero-shield can block it', async () => {
  const { foodService } = await import('../foodService.ts');
  const svc = foodService as any;
  const original = svc.getFoodByIdFresh;

  svc.getFoodByIdFresh = async (id: string) => {
    if (id !== 'food-incident') return null;
    return buildFood({
      id: 'food-incident',
      name: 'Антрекот из говядины',
      calories: 0,
      protein: 0,
      fat: 0,
      carbs: 0,
      source: 'core',
    });
  };

  try {
    const hydrated = await foodService.hydrateFoodForDiarySelection(
      buildFood({
        id: 'food-incident',
        name: 'Антрекот из говядины',
        calories: 312,
        protein: 19.4,
        fat: 26.1,
        carbs: 0,
        source: 'core',
      }) as any,
      'user-1'
    );

    assert.equal(hydrated.id, 'food-incident');
    assert.equal(hydrated.calories, 0);
    assert.equal(hydrated.protein, 0);
    assert.equal(hydrated.fat, 0);
    assert.equal(hydrated.carbs, 0);
  } finally {
    svc.getFoodByIdFresh = original;
  }
});

test('suspicious all-zero catalog foods are excluded from actionable search results', async () => {
  const { finalizeFoodSearchResults } = await import('../foodService.ts');

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
  const { finalizeFoodSearchResults } = await import('../foodService.ts');

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

test('ranking v1 keeps exact salt alias above garlic salt prefix despite zero macros', async () => {
  const { finalizeFoodSearchResults } = await import('../foodService.ts');

  const salt = buildFood({
    id: 'salt',
    stable_food_id: 'salt',
    name: 'Соль поваренная',
    aliases: ['соль'],
    source: 'core',
    category: 'seasonings',
    calories: 0,
    protein: 0,
    fat: 0,
    carbs: 0,
    canonical_food_id: 'salt',
  });
  const garlicSalt = buildFood({
    id: 'garlic-salt',
    stable_food_id: 'garlic_salt',
    name: 'Соль чесночная',
    source: 'core',
    category: 'seasonings',
    calories: 27,
    protein: 4.3,
    fat: 0.2,
    carbs: 1.9,
    canonical_food_id: 'garlic-salt',
  });

  const results = finalizeFoodSearchResults([garlicSalt as any, salt as any], 'соль', 10);

  assert.deepEqual(results.map((food) => food.id), ['salt', 'garlic-salt']);
});

test('UI search path keeps production salt row visible when Supabase row has no aliases', async () => {
  const { finalizeFoodSearchResults, isSuspiciousAllZeroCatalogFood } = await import('../foodService.ts');

  const salt = buildFood({
    id: '097b178d-bbed-48a2-ba91-d3fe4171fd52',
    stable_food_id: 'salt',
    name: 'Соль поваренная',
    normalized_name: 'соль поваренная',
    aliases: [],
    source: 'core',
    category: 'seasonings',
    calories: 0,
    protein: 0,
    fat: 0,
    carbs: 0,
    canonical_food_id: '097b178d-bbed-48a2-ba91-d3fe4171fd52',
  });
  const garlicSalt = buildFood({
    id: 'garlic-salt',
    stable_food_id: 'garlic_salt',
    name: 'Соль чесночная',
    normalized_name: 'соль чесночная',
    source: 'core',
    category: 'seasonings',
    calories: 27,
    protein: 4.3,
    fat: 0.2,
    carbs: 1.9,
    canonical_food_id: 'garlic-salt',
  });
  const pinkSalt = buildFood({
    id: 'pink-salt',
    stable_food_id: 'pink_himalayan_salt',
    name: 'Соль гималайская розовая',
    normalized_name: 'соль гималайская розовая',
    source: 'core',
    category: 'seasonings',
    calories: 1,
    protein: 0,
    fat: 0,
    carbs: 0,
    canonical_food_id: 'pink-salt',
  });

  assert.equal(isSuspiciousAllZeroCatalogFood(salt as any), false);

  const renderedSearchResults = finalizeFoodSearchResults([garlicSalt as any, pinkSalt as any, salt as any], 'соль', 30);

  assert.deepEqual(
    renderedSearchResults.map((food) => food.stable_food_id),
    ['salt', 'garlic_salt', 'pink_himalayan_salt']
  );
});

test('ranking v1 puts exact canonical before prefix and contains matches', async () => {
  const { finalizeFoodSearchResults } = await import('../foodService.ts');

  const results = finalizeFoodSearchResults([
    buildFood({ id: 'contains', stable_food_id: 'milk_coffee', name: 'Кофе с молоком', canonical_food_id: 'contains' }) as any,
    buildFood({ id: 'prefix', stable_food_id: 'milk_2_5', name: 'Молоко 2.5%', canonical_food_id: 'prefix' }) as any,
    buildFood({ id: 'exact', stable_food_id: 'milk', name: 'Молоко', canonical_food_id: 'exact' }) as any,
  ], 'молоко', 10);

  assert.deepEqual(results.map((food) => food.id), ['exact', 'prefix', 'contains']);
});

test('ranking v1 puts exact alias before canonical prefix', async () => {
  const { finalizeFoodSearchResults } = await import('../foodService.ts');

  const aliasExact = buildFood({
    id: 'alias-exact',
    stable_food_id: 'rolled_oats',
    name: 'Овсяные хлопья',
    aliases: ['овсянка'],
    canonical_food_id: 'alias-exact',
  });
  const canonicalPrefix = buildFood({
    id: 'canonical-prefix',
    stable_food_id: 'oatmeal_cookie',
    name: 'Овсянка печенье',
    canonical_food_id: 'canonical-prefix',
  });

  const results = finalizeFoodSearchResults([canonicalPrefix as any, aliasExact as any], 'овсянка', 10);

  assert.deepEqual(results.map((food) => food.id), ['alias-exact', 'canonical-prefix']);
});

test('ranking v1 keeps prefix candidates above substring noise for known broad queries', async () => {
  const { finalizeFoodSearchResults } = await import('../foodService.ts');

  const results = finalizeFoodSearchResults([
    buildFood({ id: 'cheese-substring', stable_food_id: 'pancakes_with_cheese', name: 'Блины с сыром', canonical_food_id: 'cheese-substring' }) as any,
    buildFood({ id: 'cheese-prefix', stable_food_id: 'gouda_cheese', name: 'Сыр гауда', canonical_food_id: 'cheese-prefix' }) as any,
    buildFood({ id: 'cheese-noise', stable_food_id: 'dry_sausage', name: 'Колбаса сырокопченая', canonical_food_id: 'cheese-noise' }) as any,
  ], 'сыр', 10);

  assert.equal(results[0].id, 'cheese-prefix');
});

test('ranking v1 keeps хлеб prefix above unrelated contains matches', async () => {
  const { finalizeFoodSearchResults } = await import('../foodService.ts');

  const results = finalizeFoodSearchResults([
    buildFood({ id: 'jackfruit', stable_food_id: 'jackfruit', name: 'Джекфрут (плод хлебного дерева)', canonical_food_id: 'jackfruit' }) as any,
    buildFood({ id: 'bread', stable_food_id: 'borodinsky_bread', name: 'Хлеб Бородинский', canonical_food_id: 'bread' }) as any,
  ], 'хлеб', 10);

  assert.deepEqual(results.map((food) => food.id), ['bread', 'jackfruit']);
});

test('ranking v1 keeps чай prefix above beverage-adjacent contains matches', async () => {
  const { finalizeFoodSearchResults } = await import('../foodService.ts');

  const results = finalizeFoodSearchResults([
    buildFood({ id: 'tea-bun', stable_food_id: 'tea_bun', name: 'Булочка к чаю', canonical_food_id: 'tea-bun' }) as any,
    buildFood({ id: 'green-tea', stable_food_id: 'green_tea', name: 'Чай зелёный', canonical_food_id: 'green-tea' }) as any,
  ], 'чай', 10);

  assert.deepEqual(results.map((food) => food.id), ['green-tea', 'tea-bun']);
});

test('ranking v1 keeps рыба alias prefix above contains matches', async () => {
  const { finalizeFoodSearchResults } = await import('../foodService.ts');

  const results = finalizeFoodSearchResults([
    buildFood({ id: 'roe', stable_food_id: 'flying_fish_roe', name: 'Икра летучей рыбы', canonical_food_id: 'roe' }) as any,
    buildFood({ id: 'ice-fish', stable_food_id: 'ice_fish', name: 'Ледяная рыба', aliases: ['рыба ледяная'], canonical_food_id: 'ice-fish' }) as any,
  ], 'рыба', 10);

  assert.deepEqual(results.map((food) => food.id), ['ice-fish', 'roe']);
});

test('ranking v1 keeps йогурт prefix above pastry contains matches without inventing generic', async () => {
  const { finalizeFoodSearchResults } = await import('../foodService.ts');

  const results = finalizeFoodSearchResults([
    buildFood({ id: 'pastry', stable_food_id: 'yogurtovoe_pastry', name: 'Пирожное Йогуртовое', canonical_food_id: 'pastry' }) as any,
    buildFood({ id: 'greek-yogurt', stable_food_id: 'greek_yogurt', name: 'Йогурт греческий', canonical_food_id: 'greek-yogurt' }) as any,
  ], 'йогурт', 10);

  assert.deepEqual(results.map((food) => food.id), ['greek-yogurt', 'pastry']);
});

test('ranking v1 does not auto-resolve broad query when there are no candidates', async () => {
  const { finalizeFoodSearchResults } = await import('../foodService.ts');

  assert.deepEqual(finalizeFoodSearchResults([], 'овсянка', 10), []);
});

test('ranking v1 deduplicates by canonical UUID and preserves better match', async () => {
  const { finalizeFoodSearchResults } = await import('../foodService.ts');

  const results = finalizeFoodSearchResults([
    buildFood({ id: 'db-hit', canonical_food_id: 'canonical-1', stable_food_id: 'oats', name: 'Хлопья овсяные' }) as any,
    buildFood({ id: 'alias-hit', canonical_food_id: 'canonical-1', stable_food_id: 'oats', name: 'Овсяные хлопья', aliases: ['овсянка'] }) as any,
  ], 'овсянка', 10);

  assert.equal(results.length, 1);
  assert.equal(results[0].id, 'alias-hit');
  assert.equal((results[0] as any).__searchMatch, undefined);
});

test('ranking v1 uses stable_food_id as deterministic final tie-breaker', async () => {
  const { finalizeFoodSearchResults } = await import('../foodService.ts');

  const results = finalizeFoodSearchResults([
    buildFood({ id: 'b', stable_food_id: 'banana_b', name: 'Банан спелый', canonical_food_id: 'b', popularity: 0 }) as any,
    buildFood({ id: 'a', stable_food_id: 'banana_a', name: 'Банан жёлтый', canonical_food_id: 'a', popularity: 0 }) as any,
  ], 'банан', 10);

  assert.deepEqual(results.map((food) => food.id), ['a', 'b']);
});

test('disambiguation policy exposes broad овсянка variants without one canonical alias', async () => {
  const { getFoodSearchDisambiguationPhrases } = await import('../foodService.ts');

  assert.deepEqual(getFoodSearchDisambiguationPhrases('овсянка'), [
    'овсяные хлопья',
    'овсяная крупа',
    'каша овсяная',
    'овсяная каша',
  ]);
});

test('disambiguation policy exposes broad чай variants without one canonical alias', async () => {
  const { getFoodSearchDisambiguationPhrases } = await import('../foodService.ts');

  assert.deepEqual(getFoodSearchDisambiguationPhrases('чай'), [
    'чай черный',
    'чай чёрный',
    'чай зеленый',
    'чай зелёный',
    'чай без сахара',
    'чай сухой',
    'чай с сахаром',
  ]);
});

test('овсянка disambiguation keeps raw flakes, raw groats, and cooked porridge as separate choices', async () => {
  const { finalizeFoodSearchResults } = await import('../foodService.ts');

  const results = finalizeFoodSearchResults([
    buildFood({ id: 'flakes', stable_food_id: 'oat_flakes', name: 'Овсяные хлопья', category: 'cereal', canonical_food_id: 'flakes' }) as any,
    buildFood({ id: 'groats', stable_food_id: 'oat_groats', name: 'Овсяная крупа', category: 'cereal', canonical_food_id: 'groats' }) as any,
    buildFood({ id: 'porridge', stable_food_id: 'oatmeal_porridge_water', name: 'Каша овсяная на воде', category: 'cereal', cooking_state: 'boiled', canonical_food_id: 'porridge' }) as any,
  ], 'овсянка', 10);

  assert.deepEqual(new Set(results.map((food) => food.id)), new Set(['flakes', 'groats', 'porridge']));
  assert.equal(results.length, 3);
});

test('чай disambiguation keeps drink, dry leaves, and sweetened tea separate', async () => {
  const { finalizeFoodSearchResults } = await import('../foodService.ts');

  const results = finalizeFoodSearchResults([
    buildFood({ id: 'green-drink', stable_food_id: 'green_tea', name: 'Чай зелёный', category: 'tea', canonical_food_id: 'green-drink' }) as any,
    buildFood({ id: 'dry-green', stable_food_id: 'dry_green_tea', name: 'Чай зелёный сухой', category: 'tea', canonical_food_id: 'dry-green' }) as any,
    buildFood({ id: 'sweet-tea', stable_food_id: 'tea_with_sugar', name: 'Чай с сахаром', category: 'tea', canonical_food_id: 'sweet-tea' }) as any,
  ], 'чай', 10);

  assert.deepEqual(results.map((food) => food.id), ['green-drink', 'sweet-tea', 'dry-green']);
});
