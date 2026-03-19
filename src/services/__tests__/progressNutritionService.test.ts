import test from 'node:test';
import assert from 'node:assert/strict';

import {
  ProgressNutritionService,
  aggregateNutritionProgress,
  getNutritionPeriodRange,
  type DiaryNutritionRow,
} from '../progressNutritionService';

function row(overrides: Partial<DiaryNutritionRow>): DiaryNutritionRow {
  return {
    id: 'row-1',
    user_id: 'user-1',
    date: '2026-03-18',
    canonical_food_id: 'food-1',
    product_name: 'Diary Label',
    weight: 100,
    calories: 120,
    protein: 10,
    fat: 4,
    carbs: 12,
    idempotency_key: '2026-03-18:breakfast:food-1',
    ...overrides,
  };
}

test('aggregates use diary snapshot only', () => {
  const result = aggregateNutritionProgress(
    [row({ calories: 250, protein: 20, fat: 9, carbs: 18 })],
    new Map([['food-1', 'Яйцо']]),
    '2026-03-18',
    'day',
    null
  );

  assert.equal(result.total.calories, 250);
  assert.equal(result.macros?.protein_g, 20);
  assert.equal(result.topFoods?.[0]?.product_name, 'Яйцо');
});

test('recipe-origin entries count into calories and macros when allowed', () => {
  const result = aggregateNutritionProgress(
    [
      row({ canonical_food_id: null, idempotency_key: '2026-03-18:lunch:recipe_123', calories: 300, protein: 22, fat: 10, carbs: 14 }),
    ],
    new Map(),
    '2026-03-18',
    'day',
    null
  );

  assert.equal(result.calories?.total, 300);
  assert.equal(result.macros?.protein_g, 22);
  assert.equal(result.coverage?.included_recipe_snapshot_count, 1);
  assert.equal(result.topFoods?.length, 0);
});

test('fallback and unresolved rows are excluded', () => {
  const result = aggregateNutritionProgress(
    [
      row({ canonical_food_id: null, idempotency_key: 'weak-text-entry', calories: 200 }),
      row({ canonical_food_id: null, idempotency_key: null, calories: 150 }),
    ],
    new Map(),
    '2026-03-18',
    'day',
    null
  );

  assert.equal(result.calories?.has_data, false);
  assert.equal(result.coverage?.excluded_fallback_count, 2);
});

test('top foods use canonical food name from foods table', () => {
  const result = aggregateNutritionProgress(
    [
      row({ canonical_food_id: 'food-1', product_name: 'Diary Label 1', weight: 250 }),
      row({ id: 'row-2', canonical_food_id: 'food-1', product_name: 'Diary Label 2', weight: 100, calories: 80, protein: 5, fat: 2, carbs: 10 }),
    ],
    new Map([['food-1', 'Куриная грудка']]),
    '2026-03-18',
    'week',
    null
  );

  assert.equal(result.topFoods?.[0]?.product_name, 'Куриная грудка');
  assert.equal(result.topFoods?.[0]?.total_weight_g, 350);
});

test('deficit hidden without target and computed with target', () => {
  const noTarget = aggregateNutritionProgress([row({ calories: 500 })], new Map([['food-1', 'Яйцо']]), '2026-03-18', 'day', null);
  const withTarget = aggregateNutritionProgress([row({ calories: 500 })], new Map([['food-1', 'Яйцо']]), '2026-03-18', 'day', 1700);

  assert.equal(noTarget.deficit?.is_visible, false);
  assert.equal(noTarget.deficit?.value, null);
  assert.equal(withTarget.deficit?.is_visible, true);
  assert.equal(withTarget.deficit?.value, 1200);
});

test('no data differs from zero totals', () => {
  const noData = aggregateNutritionProgress([], new Map(), '2026-03-18', 'day', null);
  const zeroData = aggregateNutritionProgress(
    [row({ calories: 0, protein: 0, fat: 0, carbs: 0, weight: 50 })],
    new Map([['food-1', 'Вода']]),
    '2026-03-18',
    'day',
    null
  );

  assert.equal(noData.calories?.has_data, false);
  assert.equal(zeroData.calories?.has_data, true);
  assert.equal(zeroData.calories?.total, 0);
});

test('week and month period semantics use trailing windows including anchor date', () => {
  assert.deepEqual(getNutritionPeriodRange('2026-03-18', 'day'), {
    start: '2026-03-18',
    end: '2026-03-18',
  });
  assert.deepEqual(getNutritionPeriodRange('2026-03-18', 'week'), {
    start: '2026-03-12',
    end: '2026-03-18',
  });
  assert.deepEqual(getNutritionPeriodRange('2026-03-18', 'month'), {
    start: '2026-02-17',
    end: '2026-03-18',
  });
});

test('service returns top foods and coverage from repositories', async () => {
  const service = new ProgressNutritionService({
    diaryRepo: {
      async listByUserAndDateRange() {
        return [
          row({ canonical_food_id: 'food-1', weight: 200, calories: 220 }),
          row({ id: 'row-2', date: '2026-03-17', canonical_food_id: null, idempotency_key: '2026-03-17:dinner:recipe_1', calories: 300, protein: 20, fat: 10, carbs: 15 }),
        ];
      },
    },
    foodsRepo: {
      async findNamesByIds(ids: string[]) {
        return ids.map((id) => ({ id, name: id === 'food-1' ? 'Тунец' : id }));
      },
    },
    goalRepo: {
      async getUserGoal() {
        return { calories: 2000 };
      },
    },
  });

  const result = await service.getNutritionProgress('user-1', '2026-03-18', 'week');

  assert.equal(result.total.calories, 520);
  assert.equal(result.topFoods?.[0]?.product_name, 'Тунец');
  assert.equal(result.coverage?.included_canonical_count, 1);
  assert.equal(result.coverage?.included_recipe_snapshot_count, 1);
  assert.equal(result.deficit?.is_visible, true);
});
