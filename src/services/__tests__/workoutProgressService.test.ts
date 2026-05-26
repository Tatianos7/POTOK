import test from 'node:test';
import assert from 'node:assert/strict';

import type { WorkoutEntry } from '../../types/workout';
import {
  buildWorkoutProgressSummaryFromEntries,
  DEFAULT_WORKOUT_COVERAGE_KEYS,
} from '../workoutProgressService';

function createWorkoutEntry(
  id: string,
  overrides: Partial<WorkoutEntry> = {},
): WorkoutEntry {
  return {
    id,
    workout_day_id: overrides.workout_day_id ?? 'day-1',
    exercise_id: overrides.exercise_id ?? 'exercise-1',
    canonical_exercise_id: overrides.canonical_exercise_id ?? overrides.exercise_id ?? 'exercise-1',
    metricType: overrides.metricType ?? 'weight',
    metricUnit: overrides.metricUnit,
    sets: overrides.sets ?? 3,
    reps: overrides.reps ?? 12,
    weight: overrides.weight ?? 20,
    exercise: {
      id: overrides.exercise?.id ?? overrides.exercise_id ?? 'exercise-1',
      name: overrides.exercise?.name ?? 'Жим лёжа',
      category_id: overrides.exercise?.category_id ?? 'chest',
      is_custom: overrides.exercise?.is_custom ?? false,
      canonical_exercise_id: overrides.exercise?.canonical_exercise_id ?? overrides.canonical_exercise_id ?? overrides.exercise_id ?? 'exercise-1',
    },
    workout_day: overrides.workout_day ?? {
      id: overrides.workout_day_id ?? 'day-1',
      user_id: 'user-1',
      date: '2026-05-20',
    },
  };
}

test('summary counts total exercises and total sets', () => {
  const entries = [
    createWorkoutEntry('entry-1', {
      exercise_id: 'barbell_back_squat',
      canonical_exercise_id: 'barbell_back_squat',
      exercise: { id: 'barbell_back_squat', name: 'Приседания со штангой', category_id: 'legs', is_custom: false },
      sets: 4,
    }),
    createWorkoutEntry('entry-2', {
      workout_day_id: 'day-2',
      workout_day: { id: 'day-2', user_id: 'user-1', date: '2026-05-21' },
      exercise_id: 'crunch',
      canonical_exercise_id: 'crunch',
      exercise: { id: 'crunch', name: 'Скручивания', category_id: 'abs', is_custom: false },
      sets: 3,
    }),
  ];

  const summary = buildWorkoutProgressSummaryFromEntries(entries, 'week');

  assert.equal(summary.totalExercises, 2);
  assert.equal(summary.totalSets, 7);
  assert.equal(summary.totalWorkouts, 2);
});

test('primary muscles weigh more than secondary muscles', () => {
  const summary = buildWorkoutProgressSummaryFromEntries([
    createWorkoutEntry('entry-1', {
      exercise_id: 'crunch',
      canonical_exercise_id: 'crunch',
      exercise: { id: 'crunch', name: 'Скручивания', category_id: 'abs', is_custom: false },
      sets: 3,
    }),
  ], 'week');

  const abs = summary.topMuscles.find((item) => item.muscleKey === 'abs');
  const obliques = summary.topMuscles.find((item) => item.muscleKey === 'obliques');

  assert.ok(abs);
  assert.ok(obliques);
  assert.ok(abs.score > obliques.score);
  assert.equal(abs.primaryCount, 3);
  assert.equal(obliques.secondaryCount, 3);
});

test('summary builds top muscles for mixed entries', () => {
  const summary = buildWorkoutProgressSummaryFromEntries([
    createWorkoutEntry('entry-1', {
      exercise_id: 'barbell_back_squat',
      canonical_exercise_id: 'barbell_back_squat',
      exercise: { id: 'barbell_back_squat', name: 'Приседания со штангой', category_id: 'legs', is_custom: false },
      sets: 4,
    }),
    createWorkoutEntry('entry-2', {
      exercise_id: 'glute_bridge',
      canonical_exercise_id: 'glute_bridge',
      exercise: { id: 'glute_bridge', name: 'Ягодичный мост', category_id: 'legs', is_custom: false },
      sets: 2,
    }),
  ], 'week');

  const topKeys = summary.topMuscles.map((item) => item.muscleKey);
  assert.ok(topKeys.includes('quads'));
  assert.ok(topKeys.includes('glutes'));
});

test('missing and undertrained muscles are identified', () => {
  const summary = buildWorkoutProgressSummaryFromEntries([
    createWorkoutEntry('entry-1', {
      exercise_id: 'crunch',
      canonical_exercise_id: 'crunch',
      exercise: { id: 'crunch', name: 'Скручивания', category_id: 'abs', is_custom: false },
      sets: 1,
    }),
  ], 'week');

  const absCoverage = summary.muscleCoverage.find((item) => item.muscleKey === 'abs');
  const latsCoverage = summary.muscleCoverage.find((item) => item.muscleKey === 'lats');

  assert.ok(absCoverage);
  assert.ok(latsCoverage);
  assert.equal(absCoverage.status, 'undertrained');
  assert.equal(latsCoverage.status, 'missing');
  assert.ok(summary.undertrainedMuscles.some((item) => item.muscleKey === 'lats'));
});

test('unknown exercise does not break summary builder', () => {
  const summary = buildWorkoutProgressSummaryFromEntries([
    createWorkoutEntry('entry-1', {
      exercise_id: 'unknown-exercise',
      canonical_exercise_id: 'unknown-exercise',
      exercise: { id: 'unknown-exercise', name: 'Неизвестное упражнение', category_id: 'custom', is_custom: false },
      sets: 5,
    }),
  ], 'week');

  assert.equal(summary.totalExercises, 1);
  assert.equal(summary.totalSets, 5);
  assert.equal(summary.topMuscles.length, 0);
  assert.equal(summary.muscleCoverage.length, DEFAULT_WORKOUT_COVERAGE_KEYS.length);
});

test('cardio-only workout counts workouts without contributing to muscle coverage', () => {
  const summary = buildWorkoutProgressSummaryFromEntries([
    createWorkoutEntry('entry-1', {
      exercise_id: 'treadmill_running',
      canonical_exercise_id: 'treadmill_running',
      exercise: { id: 'treadmill_running', name: 'Беговая дорожка', category_id: 'cardio', is_custom: false },
      sets: 20,
    }),
  ], 'month');

  const trainedMuscles = summary.muscleCoverage.filter((item) => item.status === 'trained');
  const scoredMuscles = summary.muscleCoverage.filter((item) => item.score > 0);

  assert.equal(summary.totalWorkouts, 1);
  assert.equal(summary.totalExercises, 1);
  assert.equal(trainedMuscles.length, 0);
  assert.equal(scoredMuscles.length, 0);
  assert.equal(summary.topMuscles.length, 0);
  assert.equal(summary.muscleCoverage.length, DEFAULT_WORKOUT_COVERAGE_KEYS.length);
  assert.ok(summary.undertrainedMuscles.length > 0);
});
