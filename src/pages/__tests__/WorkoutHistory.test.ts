import test from 'node:test';
import assert from 'node:assert/strict';

import { createWorkoutHistoryRepeatSnapshot } from '../WorkoutHistory';
import { runRepeatWorkoutCopy } from '../../utils/repeatWorkoutFlow';
import type { WorkoutEntry } from '../../types/workout';

const historyEntries: WorkoutEntry[] = [
  {
    id: 'entry-13',
    workout_day_id: 'day-13',
    exercise_id: 'exercise-1',
    sets: 4,
    reps: 8,
    weight: 70,
    displayAmount: 70,
    displayUnit: 'кг',
    baseUnit: 'кг',
    exercise: { id: 'exercise-1', name: 'Жим лёжа', category_id: 'chest', is_custom: false },
  },
];

test('repeat snapshot captures selected historical date as sourceDate', () => {
  const snapshot = createWorkoutHistoryRepeatSnapshot('2026-04-13', historyEntries);

  assert.equal(snapshot.sourceDate, '2026-04-13');
  assert.equal(snapshot.entries.length, 1);
  assert.equal(snapshot.entries[0].id, 'entry-13');
});

test('repeat flow uses selected historical date and keeps target date independent', async () => {
  const calls: Array<{ sourceDate: string; targetDate: string; exerciseIds: string[] }> = [];
  const snapshot = createWorkoutHistoryRepeatSnapshot('2026-04-13', historyEntries);

  await runRepeatWorkoutCopy({
    copyWorkoutEntriesToDate: async (_userId, sourceDate, targetDate, exerciseIds) => {
      calls.push({ sourceDate, targetDate, exerciseIds });
      return [];
    },
    userId: 'user-1',
    sourceDate: snapshot.sourceDate,
    targetDate: '2026-04-15',
    exerciseIds: ['exercise-1'],
  });

  assert.deepEqual(calls, [{
    sourceDate: '2026-04-13',
    targetDate: '2026-04-15',
    exerciseIds: ['exercise-1'],
  }]);
});

