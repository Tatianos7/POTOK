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
    metricType: overrides.metricType,
    metricUnit: overrides.metricUnit,
    displayAmount: overrides.displayAmount,
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

test('multiple observations of same exercise within one day collapse to best weight observation', () => {
  const rows = buildWorkoutProgressList([
    createObservation('bench', '2026-03-20', { sets: 3, reps: 10, weight: 70 }, {
      entryId: 'entry-1',
      createdAt: '2026-03-20T09:00:00.000Z',
    }),
    createObservation('bench', '2026-03-20', { sets: 4, reps: 8, weight: 80 }, {
      entryId: 'entry-2',
      createdAt: '2026-03-20T08:00:00.000Z',
    }),
  ]);

  assert.equal(rows.length, 1);
  assert.equal(rows[0].latestSets, 4);
  assert.equal(rows[0].latestReps, 8);
  assert.equal(rows[0].latestWeight, 80);
  assert.equal(rows[0].latestMetricLabel, '80 кг');
});

test('equal best value chooses latest same-day observation', () => {
  const rows = buildWorkoutProgressList([
    createObservation('bench', '2026-03-20', { sets: 3, reps: 10, weight: 80 }, {
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

test('progress list formats latest metric label for time and distance observations', () => {
  const rows = buildWorkoutProgressList([
    createObservation('run', '2026-03-20', { sets: 1, reps: 1, weight: 20 }, {
      metricType: 'time',
      metricUnit: 'мин',
      displayAmount: 20,
      exerciseName: 'Беговая дорожка',
    }),
    createObservation('walk', '2026-03-20', { sets: 1, reps: 1, weight: 2 }, {
      metricType: 'distance',
      metricUnit: 'км',
      displayAmount: 2,
      exerciseName: 'Ходьба',
    }),
  ]);

  assert.equal(rows.length, 2);
  assert.equal(rows.find((row) => row.exerciseGroupKey === 'run')?.latestMetricLabel, '20 мин');
  assert.equal(rows.find((row) => row.exerciseGroupKey === 'walk')?.latestMetricLabel, '2 км');
});

test('time and distance same-day progress rows choose max metric value', () => {
  const rows = buildWorkoutProgressList([
    createObservation('run', '2026-03-20', { sets: 1, reps: 1, weight: 20 }, {
      metricType: 'time',
      metricUnit: 'мин',
      displayAmount: 20,
      createdAt: '2026-03-20T09:00:00.000Z',
    }),
    createObservation('run', '2026-03-20', { sets: 1, reps: 1, weight: 35 }, {
      metricType: 'time',
      metricUnit: 'мин',
      displayAmount: 35,
      createdAt: '2026-03-20T08:00:00.000Z',
    }),
    createObservation('walk', '2026-03-20', { sets: 1, reps: 1, weight: 2 }, {
      metricType: 'distance',
      metricUnit: 'км',
      displayAmount: 2,
      createdAt: '2026-03-20T09:00:00.000Z',
    }),
    createObservation('walk', '2026-03-20', { sets: 1, reps: 1, weight: 3 }, {
      metricType: 'distance',
      metricUnit: 'км',
      displayAmount: 3,
      createdAt: '2026-03-20T08:00:00.000Z',
    }),
  ]);

  assert.equal(rows.find((row) => row.exerciseGroupKey === 'run')?.latestMetricLabel, '35 мин');
  assert.equal(rows.find((row) => row.exerciseGroupKey === 'walk')?.latestMetricLabel, '3 км');
});

test('same-day distance comparison uses base meters instead of raw display amount', () => {
  const rows = buildWorkoutProgressList([
    createObservation('walk', '2026-03-20', { sets: 1, reps: 1, weight: 500 }, {
      metricType: 'distance',
      metricUnit: 'м',
      displayAmount: 500,
      entryId: 'distance-500m',
      createdAt: '2026-03-20T09:00:00.000Z',
    }),
    createObservation('walk', '2026-03-20', { sets: 1, reps: 1, weight: 1 }, {
      metricType: 'distance',
      metricUnit: 'км',
      displayAmount: 1,
      entryId: 'distance-1km',
      createdAt: '2026-03-20T08:00:00.000Z',
    }),
  ]);

  assert.equal(rows.length, 1);
  assert.equal(rows[0].latestMetricLabel, '1 км');
});

test('same-day equal distance base values choose latest observation and keep display unit', () => {
  const rows = buildWorkoutProgressList([
    createObservation('walk', '2026-03-20', { sets: 1, reps: 1, weight: 1 }, {
      metricType: 'distance',
      metricUnit: 'км',
      displayAmount: 1,
      entryId: 'distance-1km',
      createdAt: '2026-03-20T08:00:00.000Z',
    }),
    createObservation('walk', '2026-03-20', { sets: 1, reps: 1, weight: 1000 }, {
      metricType: 'distance',
      metricUnit: 'м',
      displayAmount: 1000,
      entryId: 'distance-1000m',
      createdAt: '2026-03-20T09:00:00.000Z',
    }),
  ]);

  assert.equal(rows.length, 1);
  assert.equal(rows[0].latestMetricLabel, '1000 м');
});

test('same-day time comparison uses base seconds instead of raw display amount', () => {
  const rows = buildWorkoutProgressList([
    createObservation('plank', '2026-03-20', { sets: 1, reps: 1, weight: 90 }, {
      metricType: 'time',
      metricUnit: 'сек',
      displayAmount: 90,
      entryId: 'time-90s',
      createdAt: '2026-03-20T09:00:00.000Z',
    }),
    createObservation('plank', '2026-03-20', { sets: 1, reps: 1, weight: 2 }, {
      metricType: 'time',
      metricUnit: 'мин',
      displayAmount: 2,
      entryId: 'time-2m',
      createdAt: '2026-03-20T08:00:00.000Z',
    }),
  ]);

  assert.equal(rows.length, 1);
  assert.equal(rows[0].latestMetricLabel, '2 мин');
});

test('same-day equal time base values choose latest observation and keep display unit', () => {
  const rows = buildWorkoutProgressList([
    createObservation('plank', '2026-03-20', { sets: 1, reps: 1, weight: 2 }, {
      metricType: 'time',
      metricUnit: 'мин',
      displayAmount: 2,
      entryId: 'time-2m',
      createdAt: '2026-03-20T08:00:00.000Z',
    }),
    createObservation('plank', '2026-03-20', { sets: 1, reps: 1, weight: 120 }, {
      metricType: 'time',
      metricUnit: 'сек',
      displayAmount: 120,
      entryId: 'time-120s',
      createdAt: '2026-03-20T09:00:00.000Z',
    }),
  ]);

  assert.equal(rows.length, 1);
  assert.equal(rows[0].latestMetricLabel, '120 сек');
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
