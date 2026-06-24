import test from 'node:test';
import assert from 'node:assert/strict';

import {
  createProgressHubService,
  progressHubTestUtils,
  type ProgressHubData,
} from '../progressHubService';
import type { MeasurementHistory } from '../measurementsService';
import type { WorkoutProgressSummary } from '../workoutProgressService';
import type { NutritionStats } from '../../types/progressDashboard';

const emptyNutritionStats = (overrides: Partial<NutritionStats> = {}): NutritionStats => ({
  average: {
    calories: 0,
    protein: 0,
    fat: 0,
    carbs: 0,
  },
  total: {
    calories: 0,
    protein: 0,
    fat: 0,
    carbs: 0,
  },
  calories: {
    total: 0,
    has_data: false,
  },
  periodCoverage: {
    days_with_data: 0,
    coverage_ratio: 0,
  },
  deficit: {
    value: null,
    has_data: false,
    is_visible: false,
    target_calories: null,
  },
  ...overrides,
});

const workoutSummary = (overrides: Partial<WorkoutProgressSummary> = {}): WorkoutProgressSummary => ({
  totalWorkouts: 0,
  workoutDates: [],
  totalExercises: 0,
  totalSets: 0,
  totalVolume: 0,
  topMuscles: [],
  muscleCoverage: [],
  undertrainedMuscles: [],
  ...overrides,
});

function createMeasurement(date: string, values: Partial<Record<'weight' | 'waist', string>>): MeasurementHistory {
  return {
    id: date,
    date,
    photos: [],
    additionalPhotos: [],
    measurements: [
      ...(values.weight ? [{ id: 'weight', name: 'Вес', value: values.weight }] : []),
      ...(values.waist ? [{ id: 'waist', name: 'Талия', value: values.waist }] : []),
    ],
  };
}

async function getHubData(overrides?: {
  goal?: Parameters<typeof progressHubTestUtils.buildGoalSummary>[0];
  nutrition?: NutritionStats;
  measurements?: MeasurementHistory[];
  workouts?: WorkoutProgressSummary;
  failNutrition?: boolean;
  failGoal?: boolean;
}): Promise<ProgressHubData> {
  const service = createProgressHubService({
    goalRepo: {
      async getUserGoal() {
        if (overrides?.failGoal) throw new Error('goal failed');
        return overrides?.goal ?? null;
      },
    },
    nutritionRepo: {
      async getNutritionProgressForRange() {
        if (overrides?.failNutrition) throw new Error('nutrition failed');
        return overrides?.nutrition ?? emptyNutritionStats();
      },
    },
    measurementsRepo: {
      async getMeasurementHistory() {
        return overrides?.measurements ?? [];
      },
    },
    workoutsRepo: {
      async getWorkoutProgressSummary() {
        return overrides?.workouts ?? workoutSummary();
      },
    },
    getToday: () => '2026-06-24',
  });

  return service.getProgressHubData('user-1');
}

test('builds fixed 30 day period ending today', async () => {
  const result = await getHubData();

  assert.equal(result.period.startDate, '2026-05-26');
  assert.equal(result.period.endDate, '2026-06-24');
  assert.equal(result.period.totalDays, 30);
});

test('no goal returns empty goal summary and attention message', async () => {
  const result = await getHubData();

  assert.equal(result.goal.state, 'empty');
  assert.equal(result.goal.hasGoal, false);
  assert.ok(result.attentionMessages.includes('Цель не задана.'));
});

test('nutrition summary reports logged days and data sufficiency', async () => {
  const result = await getHubData({
    nutrition: emptyNutritionStats({
      average: { calories: 1840, protein: 90, fat: 60, carbs: 210 },
      calories: { total: 55200, has_data: true },
      periodCoverage: { days_with_data: 24, coverage_ratio: 0.8 },
      deficit: { value: 0, has_data: true, is_visible: true, target_calories: 54000 },
    }),
  });

  assert.equal(result.nutrition.state, 'ok');
  assert.equal(result.nutrition.averageCalories, 1840);
  assert.equal(result.nutrition.caloriesTarget, 1800);
  assert.equal(result.nutrition.averageCalorieBalance, 40);
  assert.equal(result.nutrition.loggedDays, 24);
  assert.equal(result.nutrition.hasEnoughData, true);
  assert.equal(result.attentionMessages.includes('Питание заполнено не полностью.'), false);
});

test('measurements summary calculates 30 day deltas from valid points', async () => {
  const result = await getHubData({
    measurements: [
      createMeasurement('2026-05-20', { weight: '80', waist: '90' }),
      createMeasurement('2026-05-26', { weight: '78,5', waist: '88' }),
      createMeasurement('2026-06-24', { weight: '76', waist: '84.5' }),
    ],
  });

  assert.equal(result.measurements.state, 'ok');
  assert.equal(result.measurements.recordsCount30d, 2);
  assert.equal(result.measurements.latestWeight, 76);
  assert.equal(result.measurements.latestMeasurementDate, '2026-06-24');
  assert.equal(result.measurements.weightDelta30d, -2.5);
  assert.equal(result.measurements.waistDelta30d, -3.5);
});

test('measurements summary uses latest valid weight point, not just latest row', async () => {
  const result = await getHubData({
    measurements: [
      createMeasurement('2026-06-01', { weight: '70' }),
      createMeasurement('2026-06-24', { waist: '80' }),
    ],
  });

  assert.equal(result.measurements.latestWeight, 70);
  assert.equal(result.measurements.latestMeasurementDate, '2026-06-24');
  assert.equal(result.measurements.weightDelta30d, null);
});

test('workouts summary formats frequency and last workout label', async () => {
  const result = await getHubData({
    workouts: workoutSummary({
      totalWorkouts: 10,
      workoutDates: ['2026-06-01', '2026-06-23'],
    }),
  });

  assert.equal(result.workouts.state, 'ok');
  assert.equal(result.workouts.workoutsCount30d, 10);
  assert.equal(result.workouts.averageFrequencyLabel, 'около 2 раз в неделю');
  assert.equal(result.workouts.lastWorkoutDate, '2026-06-23');
  assert.equal(result.workouts.lastWorkoutLabel, 'вчера');
});

test('attention messages include sparse nutrition, no measurements and no recent workouts', async () => {
  const result = await getHubData({
    goal: {
      calories: 1800,
      protein: 120,
      fat: 60,
      carbs: 190,
      goal_type: 'weight-loss',
      current_weight: 80,
      target_weight: 74,
    },
    nutrition: emptyNutritionStats({
      calories: { total: 1200, has_data: true },
      average: { calories: 1200, protein: 50, fat: 30, carbs: 130 },
      periodCoverage: { days_with_data: 3, coverage_ratio: 0.1 },
    }),
    workouts: workoutSummary({
      totalWorkouts: 1,
      workoutDates: ['2026-06-01'],
    }),
  });

  assert.deepEqual(result.attentionMessages, [
    'Питание заполнено не полностью.',
    'Нет новых замеров за 30 дней.',
    'Нет тренировок последние 14 дней.',
  ]);
});

test('partial source errors do not break the whole hub payload', async () => {
  const result = await getHubData({
    failNutrition: true,
    measurements: [createMeasurement('2026-06-24', { weight: '70' })],
  });

  assert.equal(result.nutrition.state, 'error');
  assert.equal(result.measurements.state, 'ok');
  assert.equal(result.measurements.latestWeight, 70);
});

test('goal load error is not reported as missing goal attention', async () => {
  const result = await getHubData({ failGoal: true });

  assert.equal(result.goal.state, 'error');
  assert.equal(result.attentionMessages.includes('Цель не задана.'), false);
});
