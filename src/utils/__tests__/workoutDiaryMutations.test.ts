import test from 'node:test';
import assert from 'node:assert/strict';

import {
  clearWorkoutEntriesForDay,
  removeWorkoutEntryFromList,
  updateWorkoutEntryInList,
} from '../workoutDiaryMutations';
import type { WorkoutEntry } from '../../types/workout';

const entries: WorkoutEntry[] = [
  {
    id: 'entry-1',
    workout_day_id: 'day-1',
    exercise_id: 'exercise-1',
    sets: 3,
    reps: 10,
    weight: 40,
    displayAmount: 40,
    displayUnit: 'кг',
    metricType: 'weight',
    metricUnit: 'кг',
    exercise: { id: 'exercise-1', name: 'Жим лёжа', category_id: 'chest', is_custom: false },
  },
  {
    id: 'entry-2',
    workout_day_id: 'day-1',
    exercise_id: 'exercise-2',
    sets: 2,
    reps: 12,
    weight: 0,
    displayAmount: 0,
    displayUnit: undefined,
    metricType: 'bodyweight',
    metricUnit: undefined,
    exercise: { id: 'exercise-2', name: 'Отжимания', category_id: 'chest', is_custom: false },
  },
];

test('single entry delete removes only the targeted workout entry', () => {
  const next = removeWorkoutEntryFromList(entries, 'entry-1');

  assert.deepEqual(next.map((entry) => entry.id), ['entry-2']);
  assert.equal(entries.length, 2, 'original entries should remain immutable');
});

test('single entry delete leaves entries unchanged when id is absent', () => {
  const next = removeWorkoutEntryFromList(entries, 'missing-entry');

  assert.deepEqual(next.map((entry) => entry.id), ['entry-1', 'entry-2']);
});

test('whole day delete clears the local workout entry list', () => {
  assert.deepEqual(clearWorkoutEntriesForDay(), []);
});

test('entry edit updates only metric fields for the targeted row', () => {
  const next = updateWorkoutEntryInList(entries, 'entry-2', {
    sets: 4,
    reps: 8,
    weight: 90,
    displayAmount: 90,
    displayUnit: 'кг',
    metricType: 'weight',
    metricUnit: 'кг',
  });

  assert.deepEqual(next[0], entries[0]);
  assert.equal(next[1].id, 'entry-2');
  assert.equal(next[1].sets, 4);
  assert.equal(next[1].reps, 8);
  assert.equal(next[1].weight, 90);
  assert.equal(next[1].displayAmount, 90);
  assert.equal(next[1].displayUnit, 'кг');
  assert.equal(next[1].metricType, 'weight');
  assert.equal(next[1].metricUnit, 'кг');
  assert.equal(next[1].exercise?.name, 'Отжимания');
});

test('entry edit leaves list unchanged when id is absent', () => {
  const next = updateWorkoutEntryInList(entries, 'missing-entry', {
    sets: 4,
    reps: 8,
    weight: 90,
    displayAmount: 90,
    displayUnit: 'кг',
    metricType: 'weight',
    metricUnit: 'кг',
  });

  assert.deepEqual(next, entries);
});
