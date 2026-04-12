import test from 'node:test';
import assert from 'node:assert/strict';

import { getWorkoutHeaderActionIds } from '../Workouts';

test('main workout screen no longer renders whole-workout edit action', () => {
  assert.deepEqual(getWorkoutHeaderActionIds(), ['history', 'note', 'delete']);
  assert.equal(getWorkoutHeaderActionIds().includes('edit' as never), false);
});
