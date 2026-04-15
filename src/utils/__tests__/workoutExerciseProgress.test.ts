import test from 'node:test';
import assert from 'node:assert/strict';
import type { PersistedWorkoutExerciseMediaItem } from '../../services/userExerciseMediaService';
import type { WorkoutEntry } from '../../types/workout';
import {
  buildWorkoutExerciseProgressMetricRows,
  getWorkoutExerciseProgressGroupKey,
  groupWorkoutExerciseProgressMediaByDate,
} from '../workoutExerciseProgress';

function createEntry(id: string, date: string, overrides: Partial<WorkoutEntry> = {}): WorkoutEntry {
  return {
    id,
    workout_day_id: `day-${date}`,
    exercise_id: 'exercise-1',
    canonical_exercise_id: 'canonical-1',
    metricType: 'weight',
    metricUnit: 'кг',
    sets: 4,
    reps: 8,
    weight: 80,
    displayAmount: 80,
    displayUnit: 'кг',
    created_at: `${date}T08:00:00.000Z`,
    exercise: {
      id: 'exercise-1',
      name: 'Жим лежа',
      category_id: 'category-1',
      is_custom: false,
    },
    workout_day: {
      id: `day-${date}`,
      user_id: 'user-1',
      date,
    },
    ...overrides,
  };
}

test('progress exercise screen shows metrics rows for selected month', () => {
  const rows = buildWorkoutExerciseProgressMetricRows(
    [
      createEntry('entry-1', '2026-04-05'),
      createEntry('entry-2', '2026-04-12', { displayAmount: 85, weight: 85 }),
    ],
    'canonical-1',
  );

  assert.equal(rows.length, 2);
  assert.equal(rows[0].date, '2026-04-12');
  assert.equal(rows[0].metricValueLabel, '85 кг');
});

test('metrics dates remain visible even when media is absent', () => {
  const rows = buildWorkoutExerciseProgressMetricRows(
    [
      createEntry('entry-1', '2026-04-05'),
      createEntry('entry-2', '2026-04-12', { metricType: 'time', metricUnit: 'сек', displayAmount: 90, weight: 90, reps: 1 }),
    ],
    'canonical-1',
  );

  assert.deepEqual(rows.map((row) => row.date), ['2026-04-12', '2026-04-05']);
  assert.equal(rows[0].metricValueLabel, '90 сек');
});

test('progress exercise screen rows still build in legacy metric schema mode', () => {
  const rows = buildWorkoutExerciseProgressMetricRows(
    [
      createEntry('entry-1', '2026-04-05', {
        metricType: undefined,
        metricUnit: undefined,
        displayAmount: undefined,
        displayUnit: undefined,
        baseUnit: undefined,
        weight: 70,
      }),
    ],
    'canonical-1',
  );

  assert.equal(rows.length, 1);
  assert.equal(rows[0].metricValueLabel, '70 кг');
});

test('media block groups media by date and omits dates without media', () => {
  const groups = groupWorkoutExerciseProgressMediaByDate([
    {
      id: 'media-1',
      user_id: 'user-1',
      exercise_id: 'exercise-1',
      workout_entry_id: 'entry-1',
      workout_date: '2026-04-12',
      file_path: 'user-1/exercise-1/file-1.jpg',
      file_type: 'image',
      created_at: '2026-04-12T10:00:00.000Z',
      kind: 'image',
      previewUrl: 'https://signed.example/file-1.jpg',
    },
    {
      id: 'media-2',
      user_id: 'user-1',
      exercise_id: 'exercise-1',
      workout_entry_id: 'entry-2',
      workout_date: '2026-04-12',
      file_path: 'user-1/exercise-1/file-2.jpg',
      file_type: 'video',
      created_at: '2026-04-12T11:00:00.000Z',
      kind: 'video',
      previewUrl: 'https://signed.example/file-2.mp4',
    },
    {
      id: 'media-3',
      user_id: 'user-1',
      exercise_id: 'exercise-1',
      workout_entry_id: 'entry-3',
      workout_date: '2026-04-10',
      file_path: 'user-1/exercise-1/file-3.jpg',
      file_type: 'image',
      created_at: '2026-04-10T09:00:00.000Z',
      kind: 'image',
      previewUrl: 'https://signed.example/file-3.jpg',
    },
  ] satisfies PersistedWorkoutExerciseMediaItem[]);

  assert.equal(groups.length, 2);
  assert.equal(groups[0].date, '2026-04-12');
  assert.equal(groups[0].items.length, 2);
  assert.equal(groups[0].items[0].id, 'media-2');
});

test('media rows without workout_date are grouped using fallback workout entry date', () => {
  const groups = groupWorkoutExerciseProgressMediaByDate(
    [
      {
        id: 'media-1',
        user_id: 'user-1',
        exercise_id: 'exercise-1',
        workout_entry_id: 'entry-1',
        workout_date: null,
        file_path: 'user-1/exercise-1/file-1.jpg',
        file_type: 'image',
        created_at: '2026-04-12T10:00:00.000Z',
        kind: 'image',
        previewUrl: 'https://signed.example/file-1.jpg',
      },
    ] satisfies PersistedWorkoutExerciseMediaItem[],
    new Map([['entry-1', '2026-04-12']]),
  );

  assert.equal(groups.length, 1);
  assert.equal(groups[0].date, '2026-04-12');
  assert.equal(groups[0].items[0].id, 'media-1');
});

test('valid historical media is not silently dropped when workout_date is absent', () => {
  const groups = groupWorkoutExerciseProgressMediaByDate(
    [
      {
        id: 'media-1',
        user_id: 'user-1',
        exercise_id: 'exercise-1',
        workout_entry_id: 'entry-1',
        workout_date: null,
        file_path: 'user-1/exercise-1/file-1.jpg',
        file_type: 'video',
        created_at: '2026-04-11T10:00:00.000Z',
        kind: 'video',
        previewUrl: 'https://signed.example/file-1.mp4',
      },
      {
        id: 'media-2',
        user_id: 'user-1',
        exercise_id: 'exercise-1',
        workout_entry_id: 'entry-2',
        workout_date: '2026-04-10',
        file_path: 'user-1/exercise-1/file-2.jpg',
        file_type: 'image',
        created_at: '2026-04-10T10:00:00.000Z',
        kind: 'image',
        previewUrl: 'https://signed.example/file-2.jpg',
      },
    ] satisfies PersistedWorkoutExerciseMediaItem[],
    new Map([['entry-1', '2026-04-11']]),
  );

  assert.deepEqual(groups.map((group) => group.date), ['2026-04-11', '2026-04-10']);
});

test('exercise progress grouping keeps canonical key fallback stable', () => {
  assert.equal(getWorkoutExerciseProgressGroupKey(createEntry('entry-1', '2026-04-05')), 'canonical-1');
  assert.equal(
    getWorkoutExerciseProgressGroupKey(createEntry('entry-2', '2026-04-05', { canonical_exercise_id: null, exercise_id: 'exercise-fallback' })),
    'exercise-fallback',
  );
});
