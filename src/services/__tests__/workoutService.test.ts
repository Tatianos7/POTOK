import test from 'node:test';
import assert from 'node:assert/strict';

import {
  buildWorkoutEntryUpdatePatch,
  buildWorkoutHistoryDaySummaries,
  buildWorkoutProgressObservations,
  isMetricTypeSchemaCacheError,
  readCachedMetricTypeSchemaCapability,
  serializeMetricTypeSchemaCapability,
  stripMetricTypeFromLegacyWorkoutUpdatePatch,
  stripMetricTypeFromLegacyWorkoutWriteRows,
  workoutService,
} from '../workoutService';
import { supabase } from '../../lib/supabaseClient';
import type { WorkoutEntry } from '../../types/workout';

const USER_ID = 'user-1';
const DATE = '2026-03-25';
const STORAGE_KEY = `potok_workout_entries_${USER_ID}`;

function createEntry(
  id: string,
  name: string,
  overrides: Partial<WorkoutEntry> = {},
): WorkoutEntry {
  return {
    id,
    workout_day_id: overrides.workout_day_id ?? `day-${DATE}`,
    exercise_id: overrides.exercise_id ?? `exercise-${id}`,
    canonical_exercise_id: overrides.canonical_exercise_id ?? overrides.exercise_id ?? `exercise-${id}`,
    metricType: overrides.metricType ?? 'weight',
    sets: overrides.sets ?? 3,
    reps: overrides.reps ?? 10,
    weight: overrides.weight ?? 50,
    displayAmount: overrides.displayAmount ?? overrides.weight ?? 50,
    displayUnit: overrides.displayUnit ?? 'кг',
    baseUnit: overrides.baseUnit ?? 'кг',
    idempotencyKey: overrides.idempotencyKey,
    exercise: {
      id: overrides.exercise?.id ?? overrides.exercise_id ?? `exercise-${id}`,
      name: overrides.exercise?.name ?? name,
      category_id: overrides.exercise?.category_id ?? 'category-1',
      is_custom: overrides.exercise?.is_custom ?? false,
    },
    created_at: overrides.created_at,
    updated_at: overrides.updated_at,
  };
}

function installBrowserStubs() {
  const storage = new Map<string, string>();
  const eventTarget = new EventTarget();

  const localStorageStub = {
    getItem: (key: string) => storage.get(key) ?? null,
    setItem: (key: string, value: string) => {
      storage.set(key, value);
    },
    removeItem: (key: string) => {
      storage.delete(key);
    },
    clear: () => {
      storage.clear();
    },
  };

  Object.defineProperty(globalThis, 'localStorage', {
    configurable: true,
    value: localStorageStub,
  });

  const windowStub = {
    addEventListener: eventTarget.addEventListener.bind(eventTarget),
    removeEventListener: eventTarget.removeEventListener.bind(eventTarget),
    dispatchEvent: eventTarget.dispatchEvent.bind(eventTarget),
  };

  Object.defineProperty(globalThis, 'window', {
    configurable: true,
    value: windowStub,
  });

  if (typeof globalThis.CustomEvent === 'undefined') {
    class CustomEventStub<T = unknown> extends Event {
      detail: T;

      constructor(type: string, init?: CustomEventInit<T>) {
        super(type, init);
        this.detail = init?.detail as T;
      }
    }

    Object.defineProperty(globalThis, 'CustomEvent', {
      configurable: true,
      value: CustomEventStub,
    });
  }

  return { storage, windowStub };
}

function seedWorkoutStorage(entriesByDate: Record<string, WorkoutEntry[]>) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(entriesByDate));
}

function readWorkoutStorage(): Record<string, WorkoutEntry[]> {
  const raw = localStorage.getItem(STORAGE_KEY);
  return raw ? JSON.parse(raw) : {};
}

test.beforeEach(() => {
  installBrowserStubs();
});

test('single delete really removes workout entry and updates synced state in local-only mode', async (t) => {
  if (supabase) {
    t.skip('Тест рассчитан на local-only режим без Supabase');
    return;
  }

  const first = createEntry('entry-1', 'Присед');
  const second = createEntry('entry-2', 'Жим');
  seedWorkoutStorage({ [DATE]: [first, second] });

  let syncedEntries: WorkoutEntry[] | null = null;
  const listener = (event: Event) => {
    syncedEntries = (event as CustomEvent<{ date: string; entries: WorkoutEntry[] }>).detail.entries;
  };
  window.addEventListener('workouts-synced', listener as EventListener);
  t.after(() => window.removeEventListener('workouts-synced', listener as EventListener));

  await workoutService.deleteWorkoutEntry('entry-1', USER_ID, DATE);

  const stored = readWorkoutStorage();
  assert.equal(stored[DATE].length, 1);
  assert.equal(stored[DATE][0].id, 'entry-2');
  if (!syncedEntries) {
    assert.fail('Ожидали событие workouts-synced');
  }
  const eventEntries = syncedEntries as WorkoutEntry[];
  assert.equal(eventEntries.length, 1);
  assert.equal(eventEntries[0].id, 'entry-2');
});

test('whole day delete removes entries only for selected day in local-only mode', async (t) => {
  if (supabase) {
    t.skip('Тест рассчитан на local-only режим без Supabase');
    return;
  }

  seedWorkoutStorage({
    [DATE]: [createEntry('entry-1', 'Присед'), createEntry('entry-2', 'Жим')],
    '2026-03-26': [createEntry('entry-3', 'Тяга')],
  });

  await workoutService.deleteWorkoutDay(USER_ID, DATE);

  const stored = readWorkoutStorage();
  assert.deepEqual(stored[DATE], []);
  assert.equal(stored['2026-03-26'].length, 1);
  assert.equal(stored['2026-03-26'][0].id, 'entry-3');
});

test('edit updates only workout entry and preserves exercise definition in local-only mode', async (t) => {
  if (supabase) {
    t.skip('Тест рассчитан на local-only режим без Supabase');
    return;
  }

  const entry = createEntry('entry-1', 'Присед');
  seedWorkoutStorage({ [DATE]: [entry] });

  const updated = await workoutService.updateWorkoutEntry(
    'entry-1',
    { sets: 5, reps: 8, weight: 72.5 },
    undefined,
    { userId: USER_ID, date: DATE },
  );

  assert.equal(updated.sets, 5);
  assert.equal(updated.reps, 8);
  assert.equal(updated.weight, 72.5);
  assert.equal(updated.displayAmount, 72.5);
  assert.equal(updated.metricType, 'weight');
  assert.equal(updated.exercise?.name, 'Присед');

  const stored = readWorkoutStorage();
  assert.equal(stored[DATE].length, 1);
  assert.equal(stored[DATE][0].sets, 5);
  assert.equal(stored[DATE][0].reps, 8);
  assert.equal(stored[DATE][0].weight, 72.5);
  assert.equal(stored[DATE][0].exercise?.name, 'Присед');
});

test('metric_type is saved correctly in local-only workout entry edit flow', async (t) => {
  if (supabase) {
    t.skip('Тест рассчитан на local-only режим без Supabase');
    return;
  }

  seedWorkoutStorage({ [DATE]: [createEntry('entry-1', 'Планка', { metricType: 'weight', weight: 20 })] });

  const updated = await workoutService.updateWorkoutEntry(
    'entry-1',
    { metricType: 'time', metricUnit: 'мин', weight: 30 },
    undefined,
    { userId: USER_ID, date: DATE },
  );

  assert.equal(updated.metricType, 'time');
  assert.equal(updated.weight, 30);
  assert.equal(updated.displayAmount, 30);
  assert.equal(updated.displayUnit, 'мин');
  assert.equal(updated.metricUnit, 'мин');
});

test('failed single delete without persistence context does not mutate local state', async (t) => {
  if (supabase) {
    t.skip('Тест рассчитан на local-only режим без Supabase');
    return;
  }

  seedWorkoutStorage({ [DATE]: [createEntry('entry-1', 'Присед')] });

  await assert.rejects(() => workoutService.deleteWorkoutEntry('entry-1'), /Supabase не инициализирован/);

  const stored = readWorkoutStorage();
  assert.equal(stored[DATE].length, 1);
  assert.equal(stored[DATE][0].id, 'entry-1');
});

test('failed edit without persistence context does not mutate local state', async (t) => {
  if (supabase) {
    t.skip('Тест рассчитан на local-only режим без Supabase');
    return;
  }

  seedWorkoutStorage({ [DATE]: [createEntry('entry-1', 'Присед')] });

  await assert.rejects(
    () => workoutService.updateWorkoutEntry('entry-1', { sets: 4, reps: 10, weight: 60 }),
    /Supabase не инициализирован/,
  );

  const stored = readWorkoutStorage();
  assert.equal(stored[DATE][0].sets, 3);
  assert.equal(stored[DATE][0].reps, 10);
  assert.equal(stored[DATE][0].weight, 50);
});

test('workout entry edit updates weight patch correctly for persisted read-side', () => {
  const patch = buildWorkoutEntryUpdatePatch({ weight: 72.5 });

  assert.equal(patch.weight, 72.5);
  assert.equal(patch.display_amount, 72.5);
});

test('workout entry edit patch resets none metric value to zero', () => {
  const patch = buildWorkoutEntryUpdatePatch({ metricType: 'none', weight: 25 });

  assert.equal(patch.metric_type, 'none');
  assert.equal(patch.weight, 0);
  assert.equal(patch.display_amount, 0);
});

test('workout entry edit patch stores selected distance unit without conversion', () => {
  const patch = buildWorkoutEntryUpdatePatch({ metricType: 'distance', metricUnit: 'м', weight: 400 });

  assert.equal(patch.metric_type, 'distance');
  assert.equal(patch.weight, 400);
  assert.equal(patch.display_amount, 400);
  assert.equal(patch.display_unit, 'м');
  assert.equal(patch.base_unit, 'м');
});

test('metric_type schema cache error is detected correctly', () => {
  assert.equal(
    isMetricTypeSchemaCacheError({
      message: "Could not find the 'metric_type' column of 'workout_entries' in the schema cache",
    }),
    true,
  );
  assert.equal(isMetricTypeSchemaCacheError({ message: 'row level security violation' }), false);
});

test('metric_type schema capability cache roundtrip is read correctly', () => {
  const raw = serializeMetricTypeSchemaCapability(false, 1_000);
  assert.equal(readCachedMetricTypeSchemaCapability(raw, 1_500, 10_000), false);
});

test('expired metric_type schema capability cache is ignored', () => {
  const raw = serializeMetricTypeSchemaCapability(false, 1_000);
  assert.equal(readCachedMetricTypeSchemaCapability(raw, 20_000, 5_000), null);
});

test('legacy metric fallback strips metric_type from write rows without breaking add flow payload', () => {
  const rows = stripMetricTypeFromLegacyWorkoutWriteRows([
    {
      workout_day_id: 'day-1',
      exercise_id: 'exercise-1',
      metric_type: 'time',
      sets: 3,
      reps: 12,
      weight: 30,
      base_unit: 'сек',
      display_unit: 'сек',
      display_amount: 30,
      idempotency_key: 'key-1',
    },
  ]);

  assert.equal('metric_type' in rows[0], false);
  assert.equal(rows[0].weight, 30);
  assert.equal(rows[0].display_amount, 30);
  assert.equal(rows[0].display_unit, 'кг');
});

test('legacy metric fallback strips metric_type from update patch safely', () => {
  const patch = stripMetricTypeFromLegacyWorkoutUpdatePatch({
    metric_type: 'distance',
    weight: 2,
    display_amount: 2,
    display_unit: 'км',
  });

  assert.equal('metric_type' in patch, false);
  assert.equal(patch.weight, 2);
  assert.equal(patch.display_amount, 2);
  assert.equal(patch.display_unit, 'кг');
});

test('getWorkoutProgressObservations returns persisted observation rows for period mapping', () => {
  const observations = buildWorkoutProgressObservations(
    [
      {
        id: 'entry-2',
        workout_day_id: 'day-2',
        created_at: '2026-03-21T08:00:00.000Z',
        exercise_id: 'exercise-bench',
        sets: 4,
        reps: 8,
        weight: 80,
        exercise: {
          id: 'exercise-bench',
          name: 'Жим лежа',
          canonical_exercise_id: 'canonical-bench',
        },
      },
      {
        id: 'entry-1',
        workout_day_id: 'day-1',
        created_at: '2026-03-20T08:00:00.000Z',
        exercise_id: 'exercise-bench',
        sets: 3,
        reps: 10,
        weight: 70,
        exercise: {
          id: 'exercise-bench',
          name: 'Жим лежа',
          canonical_exercise_id: 'canonical-bench',
        },
      },
    ],
    new Map([
      ['day-1', '2026-03-20'],
      ['day-2', '2026-03-21'],
    ]),
  );

  assert.equal(observations.length, 2);
  assert.equal(observations[0].exerciseGroupKey, 'canonical-bench');
  assert.equal(observations[0].exerciseId, 'exercise-bench');
  assert.equal(observations[0].exerciseName, 'Жим лежа');
  assert.equal(observations[0].date, '2026-03-20');
  assert.equal(observations[1].date, '2026-03-21');
});

test('getWorkoutProgressObservations mapping safely falls back to exercise_id when canonical_exercise_id is absent', () => {
  const observations = buildWorkoutProgressObservations(
    [
      {
        id: 'entry-1',
        workout_day_id: 'day-1',
        created_at: '2026-03-20T08:00:00.000Z',
        exercise_id: 'exercise-superman',
        sets: 2,
        reps: 30,
        weight: 3,
        exercise: {
          id: 'exercise-superman',
          name: 'Супермен',
        },
      },
    ],
    new Map([['day-1', '2026-03-20']]),
  );

  assert.equal(observations.length, 1);
  assert.equal(observations[0].exerciseGroupKey, 'exercise-superman');
  assert.equal(observations[0].exerciseId, 'exercise-superman');
  assert.equal(observations[0].exerciseName, 'Супермен');
});

test('repeat copy creates new workout entries on target date', async (t) => {
  if (supabase) {
    t.skip('Тест рассчитан на local-only режим без Supabase');
    return;
  }

  const sourceDate = '2026-03-20';
  const targetDate = '2026-03-25';
  seedWorkoutStorage({
    [sourceDate]: [
      createEntry('source-1', 'Жим', {
        workout_day_id: `day-${sourceDate}`,
        exercise_id: 'exercise-bench',
        sets: 4,
        reps: 8,
        weight: 70,
      }),
    ],
    [targetDate]: [],
  });

  const copied = await workoutService.copyWorkoutEntriesToDate(
    USER_ID,
    sourceDate,
    targetDate,
    ['exercise-bench'],
  );

  assert.equal(copied.length, 1);
  assert.equal(copied[0].exercise_id, 'exercise-bench');
  assert.equal(copied[0].sets, 4);
  assert.equal(copied[0].reps, 8);
  assert.equal(copied[0].weight, 70);
  assert.match(copied[0].idempotencyKey ?? '', /^repeat:/);
});

test('repeat copy does not mutate source historical day', async (t) => {
  if (supabase) {
    t.skip('Тест рассчитан на local-only режим без Supabase');
    return;
  }

  const sourceDate = '2026-03-20';
  const sourceEntry = createEntry('source-1', 'Тяга', {
    workout_day_id: `day-${sourceDate}`,
    exercise_id: 'exercise-deadlift',
    sets: 5,
    reps: 5,
    weight: 100,
  });

  seedWorkoutStorage({
    [sourceDate]: [sourceEntry],
    [DATE]: [],
  });

  await workoutService.copyWorkoutEntriesToDate(USER_ID, sourceDate, DATE, ['exercise-deadlift']);

  const stored = readWorkoutStorage();
  assert.equal(stored[sourceDate].length, 1);
  assert.equal(stored[sourceDate][0].id, 'source-1');
  assert.equal(stored[sourceDate][0].sets, 5);
  assert.equal(stored[sourceDate][0].reps, 5);
  assert.equal(stored[sourceDate][0].weight, 100);
});

test('repeat copy preserves sets reps and weight from source entries', async (t) => {
  if (supabase) {
    t.skip('Тест рассчитан на local-only режим без Supabase');
    return;
  }

  const sourceDate = '2026-03-20';
  seedWorkoutStorage({
    [sourceDate]: [
      createEntry('source-1', 'Армейский жим', {
        workout_day_id: `day-${sourceDate}`,
        exercise_id: 'exercise-press',
        sets: 3,
        reps: 12,
        weight: 30,
      }),
    ],
    [DATE]: [],
  });

  const copied = await workoutService.copyWorkoutEntriesToDate(USER_ID, sourceDate, DATE, ['exercise-press']);
  const copiedEntry = copied.find((entry) => entry.exercise_id === 'exercise-press');

  assert.equal(copiedEntry?.sets, 3);
  assert.equal(copiedEntry?.reps, 12);
  assert.equal(copiedEntry?.weight, 30);
});

test('repeat copy does not silently replace existing target day entries with same exercise', async (t) => {
  if (supabase) {
    t.skip('Тест рассчитан на local-only режим без Supabase');
    return;
  }

  const sourceDate = '2026-03-20';
  const targetDate = '2026-03-25';
  const existingTargetEntry = createEntry('target-1', 'Жим', {
    workout_day_id: `day-${targetDate}`,
    exercise_id: 'exercise-bench',
    sets: 2,
    reps: 6,
    weight: 80,
    idempotencyKey: `${targetDate}:exercise-bench`,
  });

  seedWorkoutStorage({
    [sourceDate]: [
      createEntry('source-1', 'Жим', {
        workout_day_id: `day-${sourceDate}`,
        exercise_id: 'exercise-bench',
        sets: 4,
        reps: 10,
        weight: 60,
      }),
    ],
    [targetDate]: [existingTargetEntry],
  });

  const copied = await workoutService.copyWorkoutEntriesToDate(
    USER_ID,
    sourceDate,
    targetDate,
    ['exercise-bench'],
  );

  assert.equal(copied.length, 2);
  const sameExerciseEntries = copied.filter((entry) => entry.exercise_id === 'exercise-bench');
  assert.equal(sameExerciseEntries.length, 2);
  assert.ok(sameExerciseEntries.some((entry) => entry.id === 'target-1'));
  assert.ok(sameExerciseEntries.some((entry) => entry.id !== 'target-1' && entry.sets === 4 && entry.reps === 10 && entry.weight === 60));
});

test('returns workout history day summaries for date range', () => {
  const summaries = buildWorkoutHistoryDaySummaries([
    {
      workout_day_id: 'day-1',
      date: '2026-03-20',
      exercise_id: 'exercise-1',
      sets: 3,
      reps: 10,
      weight: 50,
    },
    {
      workout_day_id: 'day-1',
      date: '2026-03-20',
      exercise_id: 'exercise-2',
      sets: 4,
      reps: 8,
      weight: 60,
    },
    {
      workout_day_id: 'day-2',
      date: '2026-03-19',
      exercise_id: 'exercise-3',
      sets: 5,
      reps: 5,
      weight: 100,
    },
  ]);

  assert.equal(summaries.length, 2);
  assert.equal(summaries[0].workout_day_id, 'day-1');
  assert.equal(summaries[1].workout_day_id, 'day-2');
});

test('excludes empty days without workout entries', () => {
  const summaries = buildWorkoutHistoryDaySummaries([]);
  assert.deepEqual(summaries, []);
});

test('computes exercise_count correctly', () => {
  const summaries = buildWorkoutHistoryDaySummaries([
    {
      workout_day_id: 'day-1',
      date: '2026-03-20',
      exercise_id: 'exercise-1',
      sets: 3,
      reps: 10,
      weight: 50,
    },
    {
      workout_day_id: 'day-1',
      date: '2026-03-20',
      exercise_id: 'exercise-1',
      sets: 3,
      reps: 12,
      weight: 52.5,
    },
    {
      workout_day_id: 'day-1',
      date: '2026-03-20',
      exercise_id: 'exercise-2',
      sets: 4,
      reps: 8,
      weight: 60,
    },
  ]);

  assert.equal(summaries[0].exercise_count, 2);
});

test('computes total_sets correctly', () => {
  const summaries = buildWorkoutHistoryDaySummaries([
    {
      workout_day_id: 'day-1',
      date: '2026-03-20',
      exercise_id: 'exercise-1',
      sets: 3,
      reps: 10,
      weight: 50,
    },
    {
      workout_day_id: 'day-1',
      date: '2026-03-20',
      exercise_id: 'exercise-2',
      sets: 4,
      reps: 8,
      weight: 60,
    },
  ]);

  assert.equal(summaries[0].total_sets, 7);
});

test('computes total_volume correctly', () => {
  const summaries = buildWorkoutHistoryDaySummaries([
    {
      workout_day_id: 'day-1',
      date: '2026-03-20',
      exercise_id: 'exercise-1',
      sets: 3,
      reps: 10,
      weight: 50,
    },
    {
      workout_day_id: 'day-1',
      date: '2026-03-20',
      exercise_id: 'exercise-2',
      sets: 4,
      reps: 8,
      weight: 60,
    },
  ]);

  assert.equal(summaries[0].total_volume, 3 * 10 * 50 + 4 * 8 * 60);
});
