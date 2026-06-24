import test from 'node:test';
import assert from 'node:assert/strict';

import { getProgressMuscleMapMuscles, getWorkoutPeriodResultFromSummary } from '../ProgressWorkouts';
import type { WorkoutProgressSummary } from '../../services/workoutProgressService';

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
