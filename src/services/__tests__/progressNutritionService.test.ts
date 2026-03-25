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

test('day still shows deficit with target and data', () => {
  const result = aggregateNutritionProgress(
    [row({ date: '2026-03-18', calories: 1500 })],
    new Map([['food-1', 'Яйцо']]),
    '2026-03-18',
    'day',
    2000
  );

  assert.equal(result.deficit?.is_visible, true);
  assert.equal(result.deficit?.target_calories, 2000);
  assert.equal(result.periodCoverage?.days_with_data, 1);
  assert.equal(result.periodCoverage?.coverage_ratio, 1);
});

test('7-day period scales target by 7 days', () => {
  const result = aggregateNutritionProgress(
    [
      row({ date: '2026-03-12', calories: 2000 }),
      row({ id: 'row-2', date: '2026-03-13', calories: 2000 }),
      row({ id: 'row-3', date: '2026-03-14', calories: 2000 }),
      row({ id: 'row-4', date: '2026-03-15', calories: 2000 }),
      row({ id: 'row-5', date: '2026-03-16', calories: 2000 }),
      row({ id: 'row-6', date: '2026-03-17', calories: 2000 }),
      row({ id: 'row-7', date: '2026-03-18', calories: 2000 }),
    ],
    new Map([['food-1', 'Яйцо']]),
    '2026-03-18',
    'week',
    2000
  );

  assert.equal(result.deficit?.target_calories, 14000);
  assert.equal(result.deficit?.value, 0);
  assert.equal(result.deficit?.is_visible, true);
  assert.equal(result.periodCoverage?.coverage_ratio, 1);
});

test('30-day period scales target by 30 days', () => {
  const result = aggregateNutritionProgress(
    Array.from({ length: 30 }, (_, index) =>
      row({
        id: `row-${index + 1}`,
        date: new Date(Date.UTC(2026, 1, 17 + index)).toISOString().slice(0, 10),
        calories: 2000,
      })
    ),
    new Map([['food-1', 'Яйцо']]),
    '2026-03-18',
    'month',
    2000
  );

  assert.equal(result.deficit?.target_calories, 60000);
  assert.equal(result.deficit?.value, 0);
});

test('7-day period hides deficit when coverage is low', () => {
  const result = aggregateNutritionProgress(
    [
      row({ date: '2026-03-17', calories: 1800 }),
      row({ id: 'row-2', date: '2026-03-18', calories: 1900 }),
    ],
    new Map([['food-1', 'Яйцо']]),
    '2026-03-18',
    'week',
    2000
  );

  assert.equal(result.periodCoverage?.days_with_data, 2);
  assert.equal(result.periodCoverage?.coverage_ratio, Number((2 / 7).toFixed(4)));
  assert.equal(result.deficit?.is_visible, false);
  assert.equal(result.deficit?.value, null);
});

test('7-day period shows deficit when coverage is at least 0.8', () => {
  const result = aggregateNutritionProgress(
    [
      row({ date: '2026-03-13', calories: 1800 }),
      row({ id: 'row-2', date: '2026-03-14', calories: 1900 }),
      row({ id: 'row-3', date: '2026-03-15', calories: 2000 }),
      row({ id: 'row-4', date: '2026-03-16', calories: 1700 }),
      row({ id: 'row-5', date: '2026-03-17', calories: 2100 }),
      row({ id: 'row-6', date: '2026-03-18', calories: 2000 }),
    ],
    new Map([['food-1', 'Яйцо']]),
    '2026-03-18',
    'week',
    2000
  );

  assert.equal(result.periodCoverage?.days_with_data, 6);
  assert.equal(result.periodCoverage?.coverage_ratio, Number((6 / 7).toFixed(4)));
  assert.equal(result.deficit?.is_visible, true);
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
          row({ canonical_food_id: 'food-1', date: '2026-03-12', weight: 200, calories: 220 }),
          row({ id: 'row-2', date: '2026-03-13', canonical_food_id: 'food-1', weight: 180, calories: 210 }),
          row({ id: 'row-3', date: '2026-03-14', canonical_food_id: 'food-1', weight: 190, calories: 215 }),
          row({ id: 'row-4', date: '2026-03-15', canonical_food_id: 'food-1', weight: 175, calories: 205 }),
          row({ id: 'row-5', date: '2026-03-16', canonical_food_id: 'food-1', weight: 160, calories: 190 }),
          row({ id: 'row-6', date: '2026-03-17', canonical_food_id: null, idempotency_key: '2026-03-17:dinner:recipe_1', calories: 300, protein: 20, fat: 10, carbs: 15 }),
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

  assert.equal(result.total.calories, 1340);
  assert.equal(result.topFoods?.[0]?.product_name, 'Тунец');
  assert.equal(result.coverage?.included_canonical_count, 5);
  assert.equal(result.coverage?.included_recipe_snapshot_count, 1);
  assert.equal(result.deficit?.is_visible, true);
});

test('custom period scales target by actual day count', async () => {
  const service = new ProgressNutritionService({
    diaryRepo: {
      async listByUserAndDateRange() {
        return Array.from({ length: 14 }, (_, index) =>
          row({
            id: `row-${index + 1}`,
            date: new Date(Date.UTC(2026, 2, 5 + index)).toISOString().slice(0, 10),
            calories: 2000,
          })
        );
      },
    },
    foodsRepo: {
      async findNamesByIds(ids: string[]) {
        return ids.map((id) => ({ id, name: 'Яйцо' }));
      },
    },
    goalRepo: {
      async getUserGoal() {
        return { calories: 2000 };
      },
    },
  });

  const result = await service.getNutritionProgressForRange('user-1', '2026-03-05', '2026-03-18');

  assert.equal(result.deficit?.target_calories, 28000);
  assert.equal(result.deficit?.value, 0);
  assert.equal(result.deficit?.is_visible, true);
});

test('custom or long period uses the same coverage rule', async () => {
  const service = new ProgressNutritionService({
    diaryRepo: {
      async listByUserAndDateRange() {
        return [
          row({ date: '2026-01-01', calories: 2000 }),
          row({ id: 'row-2', date: '2026-01-10', calories: 2100 }),
          row({ id: 'row-3', date: '2026-01-20', calories: 1900 }),
        ];
      },
    },
    foodsRepo: {
      async findNamesByIds(ids: string[]) {
        return ids.map((id) => ({ id, name: 'Яйцо' }));
      },
    },
    goalRepo: {
      async getUserGoal() {
        return { calories: 2000 };
      },
    },
  });

  const result = await service.getNutritionProgressForRange('user-1', '2026-01-01', '2026-01-31');

  assert.equal(result.periodCoverage?.days_with_data, 3);
  assert.equal(result.deficit?.is_visible, false);
  assert.equal(result.deficit?.value, null);
});

test('long periods do not collapse to 30 days', async () => {
  const service = new ProgressNutritionService({
    diaryRepo: {
      async listByUserAndDateRange() {
        return [row({ date: '2026-03-18', calories: 182000 })];
      },
    },
    foodsRepo: {
      async findNamesByIds(ids: string[]) {
        return ids.map((id) => ({ id, name: 'Яйцо' }));
      },
    },
    goalRepo: {
      async getUserGoal() {
        return { calories: 2000 };
      },
    },
  });

  const quarter = await service.getNutritionProgressForRange('user-1', '2026-01-01', '2026-03-31');
  const halfYear = await service.getNutritionProgressForRange('user-1', '2025-10-01', '2026-03-31');
  const year = await service.getNutritionProgressForRange('user-1', '2025-04-01', '2026-03-31');

  assert.equal(quarter.deficit?.target_calories, 180000);
  assert.equal(halfYear.deficit?.target_calories, 364000);
  assert.equal(year.deficit?.target_calories, 730000);
});

test('no data state remains safe for scaled periods', async () => {
  const service = new ProgressNutritionService({
    diaryRepo: {
      async listByUserAndDateRange() {
        return [];
      },
    },
    foodsRepo: {
      async findNamesByIds() {
        return [];
      },
    },
    goalRepo: {
      async getUserGoal() {
        return { calories: 2000 };
      },
    },
  });

  const result = await service.getNutritionProgressForRange('user-1', '2026-01-01', '2026-03-31');

  assert.equal(result.calories?.has_data, false);
  assert.equal(result.deficit?.is_visible, false);
  assert.equal(result.deficit?.value, null);
});
