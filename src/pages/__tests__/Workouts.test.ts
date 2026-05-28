import test from 'node:test';
import assert from 'node:assert/strict';

import { buildCurrentWorkoutMuscleMapMuscles, getWorkoutHeaderActionIds } from '../Workouts';
import type { WorkoutEntry } from '../../types/workout';

test('main workout screen no longer renders whole-workout edit action', () => {
  assert.deepEqual(getWorkoutHeaderActionIds(), ['history', 'note', 'delete']);
  assert.equal(getWorkoutHeaderActionIds().includes('edit' as never), false);
});

const createEntry = (
  exerciseId: string,
  exerciseName: string,
  categoryId = 'strength',
): WorkoutEntry => ({
  id: `entry-${exerciseId}`,
  workout_day_id: 'day-1',
  exercise_id: exerciseId,
  sets: 3,
  reps: 10,
  weight: 20,
  exercise: {
    id: exerciseId,
    name: exerciseName,
    category_id: categoryId,
    is_custom: false,
  },
});

test('current workout muscle map stays empty without selected workout entries', () => {
  assert.deepEqual(buildCurrentWorkoutMuscleMapMuscles([]), {
    primaryMuscles: [],
    secondaryMuscles: [],
  });
});

test('current workout muscle map aggregates primary and secondary muscles', () => {
  const result = buildCurrentWorkoutMuscleMapMuscles([
    createEntry('standing_barbell_press', 'Жим штанги стоя'),
  ]);

  assert.ok(result.primaryMuscles.includes('front_delts'));
  assert.ok(result.primaryMuscles.includes('triceps'));
  assert.ok(result.secondaryMuscles.includes('trapezoid'));
  assert.ok(result.secondaryMuscles.includes('core_muscles'));
});

test('current workout muscle map keeps primary muscles out of secondary list', () => {
  const result = buildCurrentWorkoutMuscleMapMuscles([
    createEntry('standing_barbell_biceps_curl', 'Подъём штанги на бицепс'),
    createEntry('barbell_chin-ups', 'Тяга штанги к подбородку'),
  ]);

  assert.ok(result.primaryMuscles.includes('biceps'));
  assert.equal(result.secondaryMuscles.includes('biceps'), false);
});

test('current workout muscle map skips unknown exercises safely', () => {
  const result = buildCurrentWorkoutMuscleMapMuscles([
    createEntry('unknown-id', 'Тестовое упражнение'),
  ]);

  assert.deepEqual(result, {
    primaryMuscles: [],
    secondaryMuscles: [],
  });
});

test('current workout muscle map does not pass cardio pseudo muscle to MuscleMap', () => {
  const result = buildCurrentWorkoutMuscleMapMuscles([
    createEntry('treadmill_running', 'Бег на дорожке', 'cardio'),
  ]);

  assert.equal(result.primaryMuscles.includes('cardio'), false);
  assert.equal(result.secondaryMuscles.includes('cardio'), false);
});
