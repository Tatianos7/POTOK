import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

import {
  buildWorkoutProgressRecommendation,
  getProgressMuscleMapMuscles,
  getWorkoutPeriodResultFromSummary,
} from '../ProgressWorkouts';
import type { WorkoutProgressSummary } from '../../services/workoutProgressService';
import type { WorkoutProgressRow } from '../../types/workout';

const currentDir = dirname(fileURLToPath(import.meta.url));
const source = readFileSync(resolve(currentDir, '../ProgressWorkouts.tsx'), 'utf8');

function createSummary(overrides: Partial<WorkoutProgressSummary> = {}): WorkoutProgressSummary {
  return {
    totalWorkouts: overrides.totalWorkouts ?? 0,
    workoutDates: overrides.workoutDates ?? [],
    totalExercises: overrides.totalExercises ?? 0,
    totalSets: overrides.totalSets ?? 0,
    totalVolume: overrides.totalVolume ?? 0,
    topMuscles: overrides.topMuscles ?? [],
    muscleCoverage: overrides.muscleCoverage ?? [],
    undertrainedMuscles: overrides.undertrainedMuscles ?? [],
  };
}

function createProgressRow(overrides: Partial<WorkoutProgressRow> = {}): WorkoutProgressRow {
  return {
    exerciseGroupKey: overrides.exerciseGroupKey ?? 'bench',
    exerciseName: overrides.exerciseName ?? 'Жим лежа',
    latestSets: overrides.latestSets ?? 4,
    latestReps: overrides.latestReps ?? 8,
    latestWeight: overrides.latestWeight ?? 80,
    latestMetricLabel: overrides.latestMetricLabel ?? '80 кг',
    setsTrend: overrides.setsTrend ?? 'neutral',
    repsTrend: overrides.repsTrend ?? 'neutral',
    weightTrend: overrides.weightTrend ?? 'neutral',
    lastDate: overrides.lastDate ?? '2026-06-24',
  };
}

test('progress muscle map preserves primary and secondary muscle roles', () => {
  const summary = createSummary({
    totalWorkouts: 1,
    workoutDates: ['2026-06-24'],
    totalExercises: 3,
    totalSets: 6,
    totalVolume: 1200,
    topMuscles: [],
    muscleCoverage: [
      {
        muscleKey: 'chest',
        label: 'Грудь',
        primaryCount: 2,
        secondaryCount: 0,
        score: 4,
        status: 'trained',
      },
      {
        muscleKey: 'biceps',
        label: 'Бицепс',
        primaryCount: 0,
        secondaryCount: 1,
        score: 1,
        status: 'undertrained',
      },
      {
        muscleKey: 'traps_middle',
        label: 'Средняя часть трапеций',
        primaryCount: 0,
        secondaryCount: 3,
        score: 3,
        status: 'trained',
      },
      {
        muscleKey: 'calves',
        label: 'Икры',
        primaryCount: 0,
        secondaryCount: 0,
        score: 0,
        status: 'missing',
      },
    ],
    undertrainedMuscles: [],
  });

  assert.deepEqual(getProgressMuscleMapMuscles(summary), {
    primaryMuscles: ['chest'],
    secondaryMuscles: ['biceps', 'traps_middle'],
  });
});

test('workout progress UI uses one recommendation block instead of split insight blocks', () => {
  assert.match(source, /Что сделать дальше/);
  assert.doesNotMatch(source, /Что помогает/);
  assert.doesNotMatch(source, /Что стоит поправить/);
});

test('workout progress UI keeps exercise progress directly after period result', () => {
  const mainSource = source.slice(source.indexOf('<main className='));
  const periodResultIndex = mainSource.indexOf('Результат за период');
  const exerciseProgressIndex = mainSource.indexOf('Прогресс по упражнениям');
  const muscleMapIndex = mainSource.indexOf('Тренируемые мышцы');
  const recommendationIndex = mainSource.indexOf('{workoutRecommendation.title}');

  assert.ok(periodResultIndex >= 0);
  assert.ok(exerciseProgressIndex > periodResultIndex);
  assert.ok(muscleMapIndex > exerciseProgressIndex);
  assert.ok(recommendationIndex > muscleMapIndex);
});

test('workout progress recommendation colors use green for good and amber for warnings', () => {
  assert.match(source, /accent: 'border-l-emerald-200'/);
  assert.match(source, /icon: 'bg-emerald-500\/10 text-emerald-700'/);
  assert.match(source, /accent: 'border-l-amber-200'/);
  assert.match(source, /icon: 'bg-amber-500\/10 text-amber-700'/);
});

test('workout period result shows no last workout when summary has no dates', () => {
  const result = getWorkoutPeriodResultFromSummary(createSummary(), {
    dayCount: 30,
    to: '2026-06-24',
  });

  assert.equal(result.totalWorkouts, 0);
  assert.equal(result.lastWorkout, 'нет данных');
});

test('workout period result labels today from summary workoutDates', () => {
  const result = getWorkoutPeriodResultFromSummary(createSummary({
    totalWorkouts: 1,
    workoutDates: ['2026-06-24'],
  }), {
    dayCount: 30,
    to: '2026-06-24',
  });

  assert.equal(result.lastWorkout, 'сегодня');
});

test('workout period result labels yesterday from summary workoutDates', () => {
  const result = getWorkoutPeriodResultFromSummary(createSummary({
    totalWorkouts: 1,
    workoutDates: ['2026-06-23'],
  }), {
    dayCount: 30,
    to: '2026-06-24',
  });

  assert.equal(result.lastWorkout, 'вчера');
});

test('workout period result labels older workout from summary workoutDates', () => {
  const result = getWorkoutPeriodResultFromSummary(createSummary({
    totalWorkouts: 1,
    workoutDates: ['2026-06-21'],
  }), {
    dayCount: 30,
    to: '2026-06-24',
  });

  assert.equal(result.lastWorkout, '3 дня назад');
});

test('workout period result does not require observations for last workout label', () => {
  const result = getWorkoutPeriodResultFromSummary(createSummary({
    totalWorkouts: 13,
    workoutDates: ['2026-06-10', '2026-06-24'],
  }), {
    dayCount: 30,
    to: '2026-06-24',
  });

  assert.equal(result.totalWorkouts, 13);
  assert.equal(result.lastWorkout, 'сегодня');
});

test('workout recommendation prioritizes no workouts state', () => {
  const recommendation = buildWorkoutProgressRecommendation({
    isExerciseProgressLoadedForPeriod: false,
    loadedMuscles: { primaryMuscles: [], secondaryMuscles: [] },
    period: 'month',
    rows: [],
    summary: createSummary(),
    workoutResult: {
      totalWorkouts: 0,
      averageFrequency: 'нет данных',
      lastWorkout: 'нет данных',
      longestGapDays: null,
    },
  });

  assert.equal(recommendation.tone, 'warning');
  assert.match(recommendation.body, /пока нет тренировок/);
});

test('workout recommendation flags low data before optimistic state', () => {
  const recommendation = buildWorkoutProgressRecommendation({
    isExerciseProgressLoadedForPeriod: false,
    loadedMuscles: { primaryMuscles: ['chest', 'back', 'legs'], secondaryMuscles: [] },
    period: 'month',
    rows: [createProgressRow({ weightTrend: 'up' })],
    summary: createSummary({
      totalWorkouts: 2,
      workoutDates: ['2026-06-20', '2026-06-24'],
    }),
    workoutResult: {
      totalWorkouts: 2,
      averageFrequency: 'реже 1 раза в неделю',
      lastWorkout: 'сегодня',
      longestGapDays: 2,
    },
  });

  assert.equal(recommendation.tone, 'warning');
  assert.match(recommendation.body, /Тренировок пока мало/);
});

test('workout recommendation flags long training gap', () => {
  const recommendation = buildWorkoutProgressRecommendation({
    isExerciseProgressLoadedForPeriod: false,
    loadedMuscles: { primaryMuscles: ['chest', 'back', 'legs'], secondaryMuscles: [] },
    period: 'month',
    rows: [createProgressRow({ weightTrend: 'up' })],
    summary: createSummary({
      totalWorkouts: 8,
      workoutDates: ['2026-06-01', '2026-06-20'],
    }),
    workoutResult: {
      totalWorkouts: 8,
      averageFrequency: '2 раза в неделю',
      lastWorkout: '4 дня назад',
      longestGapDays: 12,
    },
  });

  assert.equal(recommendation.tone, 'warning');
  assert.match(recommendation.body, /длинный перерыв/);
});

test('workout recommendation uses undertrained muscle labels from summary data only', () => {
  const recommendation = buildWorkoutProgressRecommendation({
    isExerciseProgressLoadedForPeriod: false,
    loadedMuscles: { primaryMuscles: ['chest', 'back', 'legs'], secondaryMuscles: [] },
    period: 'month',
    rows: [createProgressRow({ weightTrend: 'up' })],
    summary: createSummary({
      totalWorkouts: 8,
      workoutDates: ['2026-06-01', '2026-06-04', '2026-06-08', '2026-06-12'],
      muscleCoverage: [
        {
          muscleKey: 'chest',
          label: 'Грудь',
          primaryCount: 2,
          secondaryCount: 0,
          score: 4,
          status: 'undertrained',
        },
      ],
      undertrainedMuscles: [
        {
          muscleKey: 'chest',
          label: 'Грудь',
          reason: 'Нагрузка ниже целевого порога',
        },
      ],
    }),
    workoutResult: {
      totalWorkouts: 8,
      averageFrequency: '2 раза в неделю',
      lastWorkout: 'сегодня',
      longestGapDays: 2,
    },
  });

  assert.equal(recommendation.tone, 'warning');
  assert.match(recommendation.body, /Грудь/);
});

test('workout recommendation flags missing load data after observations are loaded', () => {
  const recommendation = buildWorkoutProgressRecommendation({
    isExerciseProgressLoadedForPeriod: true,
    loadedMuscles: { primaryMuscles: ['chest', 'back', 'legs'], secondaryMuscles: [] },
    period: 'month',
    rows: [createProgressRow({ latestSets: 0, latestReps: 0, latestWeight: 0, latestMetricLabel: '—' })],
    summary: createSummary({
      totalWorkouts: 8,
      workoutDates: ['2026-06-01', '2026-06-04', '2026-06-08', '2026-06-12'],
    }),
    workoutResult: {
      totalWorkouts: 8,
      averageFrequency: '2 раза в неделю',
      lastWorkout: 'сегодня',
      longestGapDays: 2,
    },
  });

  assert.equal(recommendation.tone, 'warning');
  assert.match(recommendation.body, /Данных по нагрузке мало/);
});

test('workout recommendation flags no exercise progress when loaded rows are flat', () => {
  const recommendation = buildWorkoutProgressRecommendation({
    isExerciseProgressLoadedForPeriod: true,
    loadedMuscles: { primaryMuscles: ['chest', 'back', 'legs'], secondaryMuscles: [] },
    period: 'month',
    rows: [createProgressRow()],
    summary: createSummary({
      totalWorkouts: 8,
      workoutDates: ['2026-06-01', '2026-06-04', '2026-06-08', '2026-06-12'],
    }),
    workoutResult: {
      totalWorkouts: 8,
      averageFrequency: '2 раза в неделю',
      lastWorkout: 'сегодня',
      longestGapDays: 2,
    },
  });

  assert.equal(recommendation.tone, 'warning');
  assert.match(recommendation.body, /нет явного роста/);
});

test('workout recommendation returns good state when data supports it', () => {
  const recommendation = buildWorkoutProgressRecommendation({
    isExerciseProgressLoadedForPeriod: true,
    loadedMuscles: { primaryMuscles: ['chest', 'back', 'legs'], secondaryMuscles: [] },
    period: 'month',
    rows: [createProgressRow({ weightTrend: 'up' })],
    summary: createSummary({
      totalWorkouts: 8,
      workoutDates: ['2026-06-01', '2026-06-04', '2026-06-08', '2026-06-12'],
    }),
    workoutResult: {
      totalWorkouts: 8,
      averageFrequency: '2 раза в неделю',
      lastWorkout: 'сегодня',
      longestGapDays: 2,
    },
  });

  assert.equal(recommendation.tone, 'good');
  assert.match(recommendation.body, /Вы двигаетесь хорошо/);
});
