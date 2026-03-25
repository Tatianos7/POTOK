import test from 'node:test';
import assert from 'node:assert/strict';

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

test('adding manual product to favorites falls back cleanly when onConflict constraint is missing', async () => {
  installLocalStorageMock();
  const { saveFavoriteProductWithFallback } = await import('../favoritesService');
  const calls: string[] = [];

  const result = await saveFavoriteProductWithFallback(
    {
      async upsert() {
        calls.push('upsert');
        return {
          error: {
            message: 'there is no unique or exclusion constraint matching the ON CONFLICT specification',
          },
        };
      },
      async selectIdByKey() {
        calls.push('select');
        return { data: null, error: null };
      },
      async insert() {
        calls.push('insert');
        return { error: null };
      },
    },
    {
      userId: 'user-1',
      canonicalFoodId: 'food-1',
      productName: 'Йогурт',
      payload: {
        user_id: 'user-1',
        product_name: 'Йогурт',
        canonical_food_id: 'food-1',
      },
    }
  );

  assert.equal(result.error, null);
  assert.equal(result.usedFallback, true);
  assert.deepEqual(calls, ['upsert', 'select', 'insert']);
});

test('repeated add does not create duplicate favorite when existing row is found in fallback path', async () => {
  installLocalStorageMock();
  const { saveFavoriteProductWithFallback } = await import('../favoritesService');
  const calls: string[] = [];

  const result = await saveFavoriteProductWithFallback(
    {
      async upsert() {
        calls.push('upsert');
        return {
          error: {
            message: 'there is no unique or exclusion constraint matching the ON CONFLICT specification',
          },
        };
      },
      async selectIdByKey() {
        calls.push('select');
        return { data: { id: 'fav-1' }, error: null };
      },
      async insert() {
        calls.push('insert');
        return { error: null };
      },
    },
    {
      userId: 'user-1',
      canonicalFoodId: 'food-1',
      productName: 'Йогурт',
      payload: {
        user_id: 'user-1',
        product_name: 'Йогурт',
        canonical_food_id: 'food-1',
      },
    }
  );

  assert.equal(result.error, null);
  assert.equal(result.usedFallback, true);
  assert.deepEqual(calls, ['upsert', 'select']);
});

test('existing favorite flow does not regress when upsert succeeds normally', async () => {
  installLocalStorageMock();
  const { saveFavoriteProductWithFallback } = await import('../favoritesService');
  const calls: string[] = [];

  const result = await saveFavoriteProductWithFallback(
    {
      async upsert() {
        calls.push('upsert');
        return { error: null };
      },
      async selectIdByKey() {
        calls.push('select');
        return { data: null, error: null };
      },
      async insert() {
        calls.push('insert');
        return { error: null };
      },
    },
    {
      userId: 'user-1',
      canonicalFoodId: 'food-1',
      productName: 'Йогурт',
      payload: {
        user_id: 'user-1',
        product_name: 'Йогурт',
        canonical_food_id: 'food-1',
      },
    }
  );

  assert.equal(result.error, null);
  assert.equal(result.usedFallback, false);
  assert.deepEqual(calls, ['upsert']);
});
