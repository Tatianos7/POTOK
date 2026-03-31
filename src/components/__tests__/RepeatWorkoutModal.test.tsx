import test from 'node:test';
import assert from 'node:assert/strict';
import { renderToStaticMarkup } from 'react-dom/server';

import RepeatWorkoutModal from '../RepeatWorkoutModal';
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
    sets: 3,
    reps: 12,
    weight: 30,
    displayAmount: 30,
    displayUnit: 'кг',
    baseUnit: 'кг',
    exercise: { id: 'exercise-2', name: 'Армейский жим', category_id: 'shoulders', is_custom: false },
  },
];

test('repeat modal shows source workout exercises', () => {
  const html = renderToStaticMarkup(
    <RepeatWorkoutModal
      isOpen={true}
      sourceDate="2026-03-20"
      entries={entries}
      onClose={() => {}}
      onConfirm={async () => {}}
    />,
  );

  assert.match(html, /Жим лёжа/);
  assert.match(html, /Армейский жим/);
  assert.match(html, /Источник: 2026-03-20/);
});

test('repeat modal allows selecting target date', () => {
  const html = renderToStaticMarkup(
    <RepeatWorkoutModal
      isOpen={true}
      sourceDate="2026-03-20"
      entries={entries}
      onClose={() => {}}
      onConfirm={async () => {}}
    />,
  );

  assert.match(html, /type="date"/);
  assert.match(html, /Целевая дата/);
});

test('repeat modal renders subset selection controls', () => {
  const html = renderToStaticMarkup(
    <RepeatWorkoutModal
      isOpen={true}
      sourceDate="2026-03-20"
      entries={entries}
      onClose={() => {}}
      onConfirm={async () => {}}
    />,
  );

  assert.match(html, /type="checkbox"/);
  assert.match(html, /Что повторить/);
});
