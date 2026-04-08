import test from 'node:test';
import assert from 'node:assert/strict';

import {
  cacheCoversWorkoutProgressPeriod,
  getWorkoutProgressHistoryFetchRange,
  mergeWorkoutProgressObservationCache,
  type WorkoutProgressObservationCache,
} from '../workoutProgressCache';
import type { WorkoutProgressObservation } from '../../types/workout';
import { buildWorkoutProgressList, filterWorkoutProgressObservationsByRange } from '../workoutProgress';

function createObservation(
  exerciseGroupKey: string,
  date: string,
  values: { sets: number; reps: number; weight: number },
): WorkoutProgressObservation {
  return {
    exerciseGroupKey,
    exerciseId: `${exerciseGroupKey}-exercise`,
    exerciseName: exerciseGroupKey,
    date,
    entryId: `${exerciseGroupKey}-${date}-${values.weight}`,
    sets: values.sets,
    reps: values.reps,
    weight: values.weight,
  };
}

test('progress observations are reused safely when month switch stays within already loaded history window', () => {
  const cache: WorkoutProgressObservationCache = {
    userId: 'user-1',
    coveredTo: '2026-04-30',
    observations: [],
  };

  assert.equal(cacheCoversWorkoutProgressPeriod(cache, 'user-1', '2026-03-31'), true);
  assert.equal(cacheCoversWorkoutProgressPeriod(cache, 'user-1', '2026-04-30'), true);
});

test('no unnecessary reload happens when cached history already covers requested period', () => {
  const fetchRange = getWorkoutProgressHistoryFetchRange(
    {
      userId: 'user-1',
      coveredTo: '2026-04-30',
      observations: [],
    },
    'user-1',
    '2026-03-31',
    '1900-01-01',
  );

  assert.equal(fetchRange.shouldFetch, false);
});

test('cache fetch range requests only missing tail when history needs extension', () => {
  const fetchRange = getWorkoutProgressHistoryFetchRange(
    {
      userId: 'user-1',
      coveredTo: '2026-03-31',
      observations: [],
    },
    'user-1',
    '2026-04-30',
    '1900-01-01',
  );

  assert.equal(fetchRange.shouldFetch, true);
  assert.equal(fetchRange.from, '2026-04-01');
  assert.equal(fetchRange.to, '2026-04-30');
});

test('progress rows remain correct when derived from reused observations', () => {
  const allObservations = [
    createObservation('hold', '2026-02-10', { sets: 3, reps: 12, weight: 20 }),
    createObservation('hold', '2026-03-10', { sets: 3, reps: 17, weight: 25 }),
    createObservation('hold', '2026-04-10', { sets: 3, reps: 16, weight: 24 }),
  ];

  const cache = mergeWorkoutProgressObservationCache(null, 'user-1', '2026-04-30', allObservations);
  const displayObservations = filterWorkoutProgressObservationsByRange(cache.observations, '2026-04-01', '2026-04-30');
  const rows = buildWorkoutProgressList(displayObservations, cache.observations);

  assert.equal(rows.length, 1);
  assert.equal(rows[0].latestReps, 16);
  assert.equal(rows[0].latestWeight, 24);
  assert.equal(rows[0].repsTrend, 'return');
  assert.equal(rows[0].weightTrend, 'return');
});
