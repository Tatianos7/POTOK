import test from 'node:test';
import assert from 'node:assert/strict';

import { workoutService } from '../workoutService';
import { supabase } from '../../lib/supabaseClient';
import type { WorkoutEntry } from '../../types/workout';

const USER_ID = 'user-1';
const DATE = '2026-03-25';
const STORAGE_KEY = `potok_workout_entries_${USER_ID}`;

function createEntry(id: string, name: string): WorkoutEntry {
  return {
    id,
    workout_day_id: `day-${DATE}`,
    exercise_id: `exercise-${id}`,
    canonical_exercise_id: `exercise-${id}`,
    sets: 3,
    reps: 10,
    weight: 50,
    displayAmount: 50,
    displayUnit: 'кг',
    baseUnit: 'кг',
    exercise: {
      id: `exercise-${id}`,
      name,
      category_id: 'category-1',
      is_custom: false,
    },
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
  assert.equal(updated.exercise?.name, 'Присед');

  const stored = readWorkoutStorage();
  assert.equal(stored[DATE].length, 1);
  assert.equal(stored[DATE][0].sets, 5);
  assert.equal(stored[DATE][0].reps, 8);
  assert.equal(stored[DATE][0].weight, 72.5);
  assert.equal(stored[DATE][0].exercise?.name, 'Присед');
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
