import test from 'node:test';
import assert from 'node:assert/strict';

import { findWorkoutHistoryDaySummary } from '../workoutHistorySelection';
import type { WorkoutHistoryDaySummary } from '../../types/workout';

const items: WorkoutHistoryDaySummary[] = [
  {
    workout_day_id: 'day-1',
    date: '2026-03-29',
    exercise_count: 3,
    total_sets: 12,
    total_volume: 4200,
  },
  {
    workout_day_id: 'day-2',
    date: '2026-03-28',
    exercise_count: 2,
    total_sets: 7,
    total_volume: 1900,
  },
];

test('history screen resolves selected date through calendar-first contract', () => {
  const selected = findWorkoutHistoryDaySummary(items, '2026-03-29');

  assert.equal(selected?.workout_day_id, 'day-1');
  assert.equal(selected?.exercise_count, 3);
});

test('history screen resolves selected date to empty summary when day is absent', () => {
  const selected = findWorkoutHistoryDaySummary(items, '2026-03-10');

  assert.equal(selected, null);
});
