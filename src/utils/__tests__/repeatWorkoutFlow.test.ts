import test from 'node:test';
import assert from 'node:assert/strict';

import {
  buildRepeatWorkoutOptions,
  getDefaultRepeatTargetDate,
  runRepeatWorkoutCopy,
} from '../repeatWorkoutFlow';
import type { WorkoutEntry } from '../../types/workout';

const entries: WorkoutEntry[] = [
  {
    id: 'entry-1',
    workout_day_id: 'day-1',
    exercise_id: 'exercise-1',
    sets: 4,
    reps: 8,
    weight: 70,
    displayAmount: 70,
    displayUnit: 'кг',
    baseUnit: 'кг',
    exercise: { id: 'exercise-1', name: 'Жим лёжа', category_id: 'chest', is_custom: false },
  },
  {
    id: 'entry-2',
    workout_day_id: 'day-1',
    exercise_id: 'exercise-2',
    metricType: 'time',
    metricUnit: 'мин',
    sets: 3,
    reps: 12,
    weight: 30,
    displayAmount: 30,
    displayUnit: 'мин',
    baseUnit: 'мин',
    exercise: { id: 'exercise-2', name: 'Армейский жим', category_id: 'shoulders', is_custom: false },
  },
];

test('repeat modal allows selecting subset of exercises through repeat options list', () => {
  const options = buildRepeatWorkoutOptions(entries);

  assert.equal(options.length, 2);
  assert.deepEqual(
    options.map((item) => item.exerciseId),
    ['exercise-1', 'exercise-2'],
  );
  assert.equal(options[1].metricValueLabel, '30 мин');
});

test('repeat flow preserves per-row metric_type and metric_unit labels', () => {
  const options = buildRepeatWorkoutOptions([
    {
      ...entries[0],
      metricType: 'distance',
      metricUnit: 'км',
      weight: 5,
      displayAmount: 5,
      displayUnit: 'км',
      baseUnit: 'км',
    },
    entries[1],
  ]);

  assert.equal(options[0].metricType, 'distance');
  assert.equal(options[0].metricValueLabel, '5 км');
  assert.equal(options[1].metricType, 'time');
  assert.equal(options[1].metricValueLabel, '30 мин');
});

test('repeat modal allows selecting target date via default date contract', () => {
  assert.equal(getDefaultRepeatTargetDate(new Date('2026-03-31T12:00:00.000Z')), '2026-03-31');
});

test('confirm calls copyWorkoutEntriesToDate with expected sourceDate targetDate and exerciseIds', async () => {
  const calls: Array<{ userId: string; sourceDate: string; targetDate: string; exerciseIds: string[] }> = [];

  const result = await runRepeatWorkoutCopy({
    copyWorkoutEntriesToDate: async (userId, sourceDate, targetDate, exerciseIds) => {
      calls.push({ userId, sourceDate, targetDate, exerciseIds });
    },
    userId: 'user-1',
    sourceDate: '2026-03-20',
    targetDate: '2026-04-01',
    exerciseIds: ['exercise-1'],
  });

  assert.deepEqual(calls, [
    {
      userId: 'user-1',
      sourceDate: '2026-03-20',
      targetDate: '2026-04-01',
      exerciseIds: ['exercise-1'],
    },
  ]);
  assert.equal(result.selectedDate, '2026-04-01');
});
