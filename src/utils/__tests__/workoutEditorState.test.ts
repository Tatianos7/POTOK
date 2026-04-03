import test from 'node:test';
import assert from 'node:assert/strict';

import type { SelectedExercise } from '../../types/workout';
import { updateSelectedExerciseField } from '../workoutEditorState';

const items: SelectedExercise[] = [
  {
    exercise: { id: 'exercise-1', name: 'Жим', category_id: 'c1', is_custom: false },
    sets: 3,
    reps: 10,
    weight: 20,
  },
  {
    exercise: { id: 'exercise-2', name: 'Тяга', category_id: 'c1', is_custom: false },
    sets: 4,
    reps: 8,
    weight: 60,
  },
];

test('editing one field preserves references for unchanged workout editor rows', () => {
  const updated = updateSelectedExerciseField(items, 0, 'weight', 88);

  assert.notEqual(updated, items);
  assert.notEqual(updated[0], items[0]);
  assert.equal(updated[1], items[1]);
  assert.equal(updated[0].weight, 88);
});
