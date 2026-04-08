import test from 'node:test';
import assert from 'node:assert/strict';

import {
  buildWorkoutProgressList,
  filterWorkoutProgressObservationsByRange,
  getWorkoutMetricTrend,
  groupWorkoutProgressRows,
} from '../workoutProgress';
import type { WorkoutProgressObservation } from '../../types/workout';

function createObservation(
  exerciseGroupKey: string,
  date: string,
  values: { sets: number; reps: number; weight: number },
  overrides: Partial<WorkoutProgressObservation> = {},
): WorkoutProgressObservation {
  return {
    exerciseGroupKey,
    exerciseId: overrides.exerciseId ?? `${exerciseGroupKey}-exercise`,
    exerciseName: overrides.exerciseName ?? exerciseGroupKey,
    date,
    entryId: overrides.entryId ?? `${exerciseGroupKey}-${date}-${values.weight}`,
    createdAt: overrides.createdAt,
    sets: values.sets,
    reps: values.reps,
    weight: values.weight,
  };
}

test('observations are grouped into one row per exerciseGroupKey', () => {
  const groups = groupWorkoutProgressRows([
    createObservation('bench', '2026-03-20', { sets: 3, reps: 10, weight: 70 }),
    createObservation('bench', '2026-03-21', { sets: 4, reps: 8, weight: 80 }),
    createObservation('squat', '2026-03-21', { sets: 5, reps: 5, weight: 100 }),
  ]);

  assert.equal(groups.length, 2);
  assert.equal(groups[0].exerciseGroupKey, 'bench');
  assert.equal(groups[1].exerciseGroupKey, 'squat');
});

test('progress grouping safely falls back to exercise_id', () => {
  const rows = buildWorkoutProgressList([
    createObservation('exercise-fly', '2026-03-20', { sets: 4, reps: 12, weight: 25 }, {
      exerciseId: 'exercise-fly',
      exerciseName: 'Бабочка',
    }),
    createObservation('exercise-fly', '2026-03-22', { sets: 4, reps: 15, weight: 30 }, {
      exerciseId: 'exercise-fly',
      exerciseName: 'Бабочка',
    }),
  ]);

  assert.equal(rows.length, 1);
  assert.equal(rows[0].exerciseGroupKey, 'exercise-fly');
  assert.equal(rows[0].exerciseName, 'Бабочка');
});

test('multiple observations of same exercise within one day collapse to last day observation', () => {
  const rows = buildWorkoutProgressList([
    createObservation('bench', '2026-03-20', { sets: 3, reps: 10, weight: 70 }, {
      entryId: 'entry-1',
      createdAt: '2026-03-20T08:00:00.000Z',
    }),
    createObservation('bench', '2026-03-20', { sets: 4, reps: 8, weight: 80 }, {
      entryId: 'entry-2',
      createdAt: '2026-03-20T09:00:00.000Z',
    }),
  ]);

  assert.equal(rows.length, 1);
  assert.equal(rows[0].latestSets, 4);
  assert.equal(rows[0].latestReps, 8);
  assert.equal(rows[0].latestWeight, 80);
});

test('latest sets reps and weight are chosen correctly', () => {
  const rows = buildWorkoutProgressList([
    createObservation('bench', '2026-03-20', { sets: 3, reps: 10, weight: 70 }),
    createObservation('bench', '2026-03-22', { sets: 5, reps: 6, weight: 90 }),
  ]);

  assert.equal(rows[0].latestSets, 5);
  assert.equal(rows[0].latestReps, 6);
  assert.equal(rows[0].latestWeight, 90);
  assert.equal(rows[0].lastDate, '2026-03-22');
});

test('derived progress rows remain correct when display window is filtered from full history input', () => {
  const allObservations = [
    createObservation('bench', '2026-02-20', { sets: 3, reps: 10, weight: 70 }),
    createObservation('bench', '2026-03-20', { sets: 4, reps: 8, weight: 80 }),
    createObservation('bench', '2026-04-20', { sets: 5, reps: 6, weight: 90 }),
  ];

  const displayObservations = filterWorkoutProgressObservationsByRange(allObservations, '2026-04-01', '2026-04-30');
  const rows = buildWorkoutProgressList(displayObservations, allObservations);

  assert.equal(displayObservations.length, 1);
  assert.equal(rows.length, 1);
  assert.equal(rows[0].latestSets, 5);
  assert.equal(rows[0].latestReps, 6);
  assert.equal(rows[0].latestWeight, 90);
});

test('progress row latest values still come from selected month', () => {
  const displayRows = [
    createObservation('hold', '2026-04-10', { sets: 3, reps: 16, weight: 24 }, {
      exerciseName: 'Изометрические удержания в подтягиваниях',
    }),
  ];
  const historyRows = [
    createObservation('hold', '2026-02-10', { sets: 3, reps: 12, weight: 20 }, {
      exerciseName: 'Изометрические удержания в подтягиваниях',
    }),
    createObservation('hold', '2026-03-10', { sets: 3, reps: 17, weight: 25 }, {
      exerciseName: 'Изометрические удержания в подтягиваниях',
    }),
    ...displayRows,
  ];

  const rows = buildWorkoutProgressList(displayRows, historyRows);

  assert.equal(rows.length, 1);
  assert.equal(rows[0].latestSets, 3);
  assert.equal(rows[0].latestReps, 16);
  assert.equal(rows[0].latestWeight, 24);
  assert.equal(rows[0].lastDate, '2026-04-10');
});

test('trend is calculated from full exercise history, not only selected month', () => {
  const displayRows = [
    createObservation('hold', '2026-04-10', { sets: 3, reps: 16, weight: 24 }),
  ];
  const historyRows = [
    createObservation('hold', '2026-02-10', { sets: 3, reps: 12, weight: 20 }),
    createObservation('hold', '2026-03-10', { sets: 3, reps: 17, weight: 25 }),
    ...displayRows,
  ];

  const rows = buildWorkoutProgressList(displayRows, historyRows);

  assert.equal(rows[0].repsTrend, 'return');
  assert.equal(rows[0].weightTrend, 'return');
});

test('month switching does not reset baseline or peak incorrectly', () => {
  const marchRows = buildWorkoutProgressList(
    [createObservation('hold', '2026-03-10', { sets: 3, reps: 17, weight: 25 })],
    [
      createObservation('hold', '2026-02-10', { sets: 3, reps: 12, weight: 20 }),
      createObservation('hold', '2026-03-10', { sets: 3, reps: 17, weight: 25 }),
    ],
  );
  const aprilRows = buildWorkoutProgressList(
    [createObservation('hold', '2026-04-10', { sets: 3, reps: 16, weight: 24 })],
    [
      createObservation('hold', '2026-02-10', { sets: 3, reps: 12, weight: 20 }),
      createObservation('hold', '2026-03-10', { sets: 3, reps: 17, weight: 25 }),
      createObservation('hold', '2026-04-10', { sets: 3, reps: 16, weight: 24 }),
    ],
  );

  assert.equal(marchRows[0].repsTrend, 'up');
  assert.equal(marchRows[0].weightTrend, 'up');
  assert.equal(aprilRows[0].repsTrend, 'return');
  assert.equal(aprilRows[0].weightTrend, 'return');
});

test('trend up is calculated correctly', () => {
  assert.equal(getWorkoutMetricTrend([20, 30]), 'up');
  assert.equal(getWorkoutMetricTrend([60, 63]), 'up');
  assert.equal(getWorkoutMetricTrend([60, 63, 61, 63, 64]), 'up');
  assert.equal(getWorkoutMetricTrend([60, 62, 64, 63, 63, 63, 64]), 'up');
});

test('trend down is calculated correctly', () => {
  assert.equal(getWorkoutMetricTrend([30, 20]), 'down');
  assert.equal(getWorkoutMetricTrend([12, 17, 9]), 'down');
  assert.equal(getWorkoutMetricTrend([60, 63, 61, 63, 64, 59]), 'down');
});

test('trend return is calculated correctly for pattern like 20 -> 30 -> 20', () => {
  assert.equal(getWorkoutMetricTrend([20, 30, 20]), 'return');
  assert.equal(getWorkoutMetricTrend([20, 25, 22]), 'return');
  assert.equal(getWorkoutMetricTrend([60, 63, 61]), 'return');
  assert.equal(getWorkoutMetricTrend([60, 63, 61, 63]), 'return');
});

test('neutral is calculated correctly', () => {
  assert.equal(getWorkoutMetricTrend([20]), 'neutral');
  assert.equal(getWorkoutMetricTrend([20, 20]), 'neutral');
  assert.equal(getWorkoutMetricTrend([20, 30, 30]), 'neutral');
  assert.equal(getWorkoutMetricTrend([60, 60, 60]), 'neutral');
  assert.equal(getWorkoutMetricTrend([60, 62, 64, 63, 63, 63]), 'neutral');
});
