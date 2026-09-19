import assert from 'node:assert/strict';
import test from 'node:test';
import type { Food } from '../../types';
import { filterVisibleFoods } from '../../utils/myProductsVisibility';

const food = (id: string, source: Food['source'], owner?: string): Food => ({
  id, source, name: 'Йогурт', canonical_food_id: id,
  created_by_user_id: owner, calories: 60, protein: 3, fat: 2, carbs: 7,
  createdAt: '2026-09-18', updatedAt: '2026-09-18',
});

test('merged food visibility includes public and own rows only', () => {
  const rows = [food('core', 'core'), food('brand', 'brand'), food('own', 'user', 'A'), food('foreign', 'user', 'B'), food('orphan', 'user')];
  assert.deepEqual(filterVisibleFoods(rows, 'A').map((row) => row.id), ['core', 'brand', 'own']);
  assert.deepEqual(filterVisibleFoods(rows).map((row) => row.id), ['core', 'brand']);
  assert.deepEqual(filterVisibleFoods(rows, '').map((row) => row.id), ['core', 'brand']);
});

test('search filters stale private candidates before ranking and limiting', async () => {
  const originalStorage = Object.getOwnPropertyDescriptor(globalThis, 'localStorage');
  const cache = new Map<string, string>();
  Object.defineProperty(globalThis, 'localStorage', {
    configurable: true,
    value: { getItem: (key: string) => cache.get(key) ?? null, setItem: (key: string, value: string) => cache.set(key, value) },
  });
  const { foodService } = await import('../foodService');
  const service = foodService as unknown as {
    loadUserFoods(userId: string): Food[];
    checkFoodsTableExists(): Promise<boolean>;
    searchLocal(query: string, category?: string): Food[];
  };
  const originals = {
    loadUserFoods: service.loadUserFoods,
    checkFoodsTableExists: service.checkFoodsTableExists,
    searchLocal: service.searchLocal,
  };
  service.loadUserFoods = () => [food('foreign', 'user', 'B'), food('own', 'user', 'A')];
  service.checkFoodsTableExists = async () => false;
  service.searchLocal = () => [food('public', 'core')];
  try {
    const result = await foodService.search('йогурт', { userId: 'A', limit: 1 });
    assert.deepEqual(result.map((row) => row.id), ['own']);
    const anonymous = await foodService.search('йогурт');
    assert.deepEqual(anonymous.map((row) => row.id), ['public']);
  } finally {
    Object.assign(service, originals);
    if (originalStorage) Object.defineProperty(globalThis, 'localStorage', originalStorage);
    else Reflect.deleteProperty(globalThis, 'localStorage');
  }
});
