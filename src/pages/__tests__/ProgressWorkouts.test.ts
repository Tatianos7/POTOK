import test from 'node:test';
import assert from 'node:assert/strict';

import { getProgressMuscleMapMuscles } from '../ProgressWorkouts';
import type { WorkoutProgressSummary } from '../../services/workoutProgressService';

test('progress muscle map includes trained and undertrained muscles only', () => {
  const summary: WorkoutProgressSummary = {
    totalWorkouts: 1,
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
        muscleKey: 'calves',
        label: 'Икры',
        primaryCount: 0,
        secondaryCount: 0,
        score: 0,
        status: 'missing',
      },
    ],
    undertrainedMuscles: [],
  };

  assert.deepEqual(getProgressMuscleMapMuscles(summary), ['chest', 'biceps']);
});
