import test from 'node:test';
import assert from 'node:assert/strict';

import {
  deriveProgressDailyGoalPeriodMetrics,
  deriveProgressDailyGoalState,
  normalizeProgressDailyGoalPreferences,
} from '../progressDailyGoal';

const periodDay = (
  date: string,
  input: Partial<{ caloriesLogged: number; calorieTarget: number | null; hasWorkoutEntries: boolean }> = {},
) => ({
  date,
  caloriesLogged: input.caloriesLogged ?? 0,
  calorieTarget: input.calorieTarget ?? 2000,
  hasWorkoutEntries: input.hasWorkoutEntries ?? false,
});

test('daily goal state displays 0 of 4 when no completion facts exist', () => {
  const state = deriveProgressDailyGoalState({
    caloriesLogged: 0,
    calorieTarget: 2000,
    hasWorkoutEntries: false,
    progressViewed: false,
    waterEnabled: false,
  });

  assert.equal(state.progressText, 'Выполнено 0 из 4');
  assert.equal(state.completedCount, 0);
  assert.equal(state.totalCount, 4);
  assert.equal(state.isComplete, false);
  assert.match(state.messageBody, /добавьте питание или активность/);
});

test('daily goal keeps nutrition pending when breakfast calories are far below target', () => {
  const state = deriveProgressDailyGoalState({
    caloriesLogged: 320,
    calorieTarget: 2000,
    hasWorkoutEntries: false,
    progressViewed: false,
    waterEnabled: false,
  });

  const nutrition = state.items.find((item) => item.id === 'nutrition');
  assert.equal(nutrition?.label, 'Питание в рамках цели');
  assert.equal(nutrition?.completed, false);
  assert.equal(nutrition?.note, 'Записано 320 ккал из 2000 ккал');
  assert.equal(state.progressText, 'Выполнено 0 из 4');
});

test('daily goal marks nutrition complete when calories are within target range', () => {
  const state = deriveProgressDailyGoalState({
    caloriesLogged: 1850,
    calorieTarget: 2000,
    hasWorkoutEntries: false,
    progressViewed: false,
    waterEnabled: false,
  });

  const nutrition = state.items.find((item) => item.id === 'nutrition');
  assert.equal(nutrition?.completed, true);
  assert.equal(nutrition?.note, 'Записано 1850 ккал из 2000 ккал');
  assert.equal(state.progressText, 'Выполнено 1 из 4');
});

test('daily goal keeps nutrition pending when calories exceed upper target range', () => {
  const state = deriveProgressDailyGoalState({
    caloriesLogged: 2250,
    calorieTarget: 2000,
    hasWorkoutEntries: false,
    progressViewed: false,
    waterEnabled: false,
  });

  const nutrition = state.items.find((item) => item.id === 'nutrition');
  assert.equal(nutrition?.completed, false);
  assert.equal(nutrition?.note, 'Записано 2250 ккал из 2000 ккал');
});

test('daily goal keeps nutrition pending when calorie target is missing', () => {
  const state = deriveProgressDailyGoalState({
    caloriesLogged: 1850,
    calorieTarget: null,
    hasWorkoutEntries: false,
    progressViewed: false,
    waterEnabled: false,
  });

  const nutrition = state.items.find((item) => item.id === 'nutrition');
  assert.equal(nutrition?.completed, false);
  assert.equal(nutrition?.note, 'Недостаточно данных');
});

test('daily goal marks activity complete when workout data exists', () => {
  const state = deriveProgressDailyGoalState({
    caloriesLogged: 0,
    calorieTarget: 2000,
    hasWorkoutEntries: true,
    progressViewed: false,
    waterEnabled: false,
  });

  const activity = state.items.find((item) => item.id === 'activity');
  assert.equal(activity?.completed, true);
  assert.equal(state.progressText, 'Выполнено 1 из 4');
});

test('daily goal keeps water disabled when water persistence is not enabled', () => {
  const state = deriveProgressDailyGoalState({
    caloriesLogged: 1900,
    calorieTarget: 2000,
    hasWorkoutEntries: true,
    progressViewed: true,
    waterGlasses: 4,
    waterEnabled: false,
  });

  const water = state.items.find((item) => item.id === 'water');
  assert.equal(water?.completed, false);
  assert.equal(water?.disabled, true);
  assert.equal(water?.note, 'Скоро');
  assert.equal(state.progressText, 'Выполнено 3 из 4');
  assert.equal(state.isComplete, true);
  assert.equal(state.messageTitle, 'Цель дня выполнена');
});

test('daily goal marks water complete when read-only water state is enabled and present', () => {
  const state = deriveProgressDailyGoalState({
    caloriesLogged: 0,
    calorieTarget: 2000,
    hasWorkoutEntries: false,
    progressViewed: false,
    waterGlasses: 2,
    waterEnabled: true,
  });

  const water = state.items.find((item) => item.id === 'water');
  assert.equal(water?.completed, true);
  assert.equal(water?.disabled, false);
  assert.equal(water?.note, '2 ст.');
  assert.equal(state.progressText, 'Выполнено 1 из 4');
});

test('daily goal shows success when all checklist items are complete', () => {
  const state = deriveProgressDailyGoalState({
    caloriesLogged: 2000,
    calorieTarget: 2000,
    hasWorkoutEntries: true,
    progressViewed: true,
    waterGlasses: 4,
    waterEnabled: true,
  });

  assert.equal(state.progressText, 'Выполнено 4 из 4');
  assert.equal(state.isComplete, true);
  assert.equal(state.messageTitle, 'Цель дня выполнена');
  assert.match(state.messageBody, /закрыли основные действия/);
});

test('daily goal period metrics count week and month objective completion', () => {
  const days = Array.from({ length: 30 }, (_, index) => {
    const day = String(index + 1).padStart(2, '0');
    const completed = [1, 2, 10, 24, 25, 26, 27].includes(index + 1);
    return periodDay(`2026-06-${day}`, {
      caloriesLogged: completed ? 2000 : 1200,
      hasWorkoutEntries: completed,
    });
  });

  const metrics = deriveProgressDailyGoalPeriodMetrics(days);

  assert.equal(metrics.weekCompletedDays, 4);
  assert.equal(metrics.weekTotalDays, 7);
  assert.equal(metrics.monthCompletedDays, 7);
  assert.equal(metrics.monthTotalDays, 30);
});

test('daily goal period metrics derive streak ending today or yesterday', () => {
  const days = Array.from({ length: 30 }, (_, index) => {
    const day = String(index + 1).padStart(2, '0');
    const completed = [26, 27, 28, 29].includes(index + 1);
    return periodDay(`2026-06-${day}`, {
      caloriesLogged: completed ? 2000 : 0,
      hasWorkoutEntries: completed,
    });
  });

  const metrics = deriveProgressDailyGoalPeriodMetrics(days);

  assert.equal(metrics.streakDays, 4);
});

test('daily goal period metrics show sparse data conclusion', () => {
  const metrics = deriveProgressDailyGoalPeriodMetrics([
    periodDay('2026-06-22'),
    periodDay('2026-06-23', { caloriesLogged: 2000 }),
    periodDay('2026-06-24'),
  ]);

  assert.equal(metrics.conclusion, 'Начните закрывать дни — здесь появится прогресс за месяц.');
});

test('daily goal period metrics do not use progress check or water history', () => {
  const metrics = deriveProgressDailyGoalPeriodMetrics([
    periodDay('2026-06-22', { caloriesLogged: 2000, hasWorkoutEntries: false }),
    periodDay('2026-06-23', { caloriesLogged: 0, hasWorkoutEntries: true }),
    periodDay('2026-06-24', { caloriesLogged: 2000, hasWorkoutEntries: true }),
  ]);

  assert.equal(metrics.monthCompletedDays, 1);
  assert.equal(metrics.streakDays, 1);
});

test('daily goal default preferences preserve current enabled checklist', () => {
  const preferences = normalizeProgressDailyGoalPreferences(null);

  assert.equal(preferences.enabled, true);
  assert.deepEqual(preferences.selectedItemIds, ['nutrition', 'activity', 'water', 'progress']);
});

test('daily goal preferences do not allow progress-only historical setup', () => {
  const preferences = normalizeProgressDailyGoalPreferences({
    enabled: true,
    selectedItemIds: ['progress'],
  });

  assert.deepEqual(preferences.selectedItemIds, ['nutrition', 'activity', 'water', 'progress']);
});

test('daily goal selected items affect checklist count', () => {
  const state = deriveProgressDailyGoalState({
    caloriesLogged: 2000,
    calorieTarget: 2000,
    hasWorkoutEntries: false,
    progressViewed: true,
    waterGlasses: 4,
    waterEnabled: true,
    preferences: {
      enabled: true,
      selectedItemIds: ['nutrition', 'progress'],
    },
  });

  assert.deepEqual(
    state.items.map((item) => item.id),
    ['nutrition', 'progress'],
  );
  assert.equal(state.completedCount, 2);
  assert.equal(state.totalCount, 2);
});

test('daily goal nutrition-only mode works', () => {
  const state = deriveProgressDailyGoalState({
    caloriesLogged: 2000,
    calorieTarget: 2000,
    hasWorkoutEntries: false,
    progressViewed: false,
    waterEnabled: false,
    preferences: {
      enabled: true,
      selectedItemIds: ['nutrition'],
    },
  });

  assert.deepEqual(state.items.map((item) => item.id), ['nutrition']);
  assert.equal(state.completedCount, 1);
  assert.equal(state.totalCount, 1);
  assert.equal(state.isComplete, true);
});

test('daily goal workout-only mode works', () => {
  const state = deriveProgressDailyGoalState({
    caloriesLogged: 0,
    calorieTarget: 2000,
    hasWorkoutEntries: true,
    progressViewed: false,
    waterEnabled: false,
    preferences: {
      enabled: true,
      selectedItemIds: ['activity'],
    },
  });

  assert.deepEqual(state.items.map((item) => item.id), ['activity']);
  assert.equal(state.completedCount, 1);
  assert.equal(state.totalCount, 1);
  assert.equal(state.isComplete, true);
});

test('daily goal month respects selected nutrition objective item', () => {
  const metrics = deriveProgressDailyGoalPeriodMetrics(
    [
      periodDay('2026-06-22', { caloriesLogged: 2000, hasWorkoutEntries: false }),
      periodDay('2026-06-23', { caloriesLogged: 1200, hasWorkoutEntries: true }),
      periodDay('2026-06-24', { caloriesLogged: 2000, hasWorkoutEntries: true }),
    ],
    ['nutrition'],
  );

  assert.equal(metrics.monthCompletedDays, 2);
});

test('daily goal month respects selected workout objective item', () => {
  const metrics = deriveProgressDailyGoalPeriodMetrics(
    [
      periodDay('2026-06-22', { caloriesLogged: 2000, hasWorkoutEntries: false }),
      periodDay('2026-06-23', { caloriesLogged: 1200, hasWorkoutEntries: true }),
      periodDay('2026-06-24', { caloriesLogged: 2000, hasWorkoutEntries: true }),
    ],
    ['activity'],
  );

  assert.equal(metrics.monthCompletedDays, 2);
});

test('daily goal month excludes water and progress check from history', () => {
  const metrics = deriveProgressDailyGoalPeriodMetrics(
    [
      periodDay('2026-06-22', { caloriesLogged: 2000, hasWorkoutEntries: false }),
      periodDay('2026-06-23', { caloriesLogged: 1200, hasWorkoutEntries: true }),
      periodDay('2026-06-24', { caloriesLogged: 2000, hasWorkoutEntries: true }),
    ],
    ['nutrition', 'water', 'progress'],
  );

  assert.equal(metrics.monthCompletedDays, 2);
});
