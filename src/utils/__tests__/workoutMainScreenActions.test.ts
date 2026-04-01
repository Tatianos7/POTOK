import test from 'node:test';
import assert from 'node:assert/strict';

import { WORKOUT_BOTTOM_ACTIONS, WORKOUT_HEADER_ACTIONS } from '../workoutMainScreenActions';

test('history entry point moved to workout header area and remains accessible', () => {
  assert.ok(WORKOUT_HEADER_ACTIONS.includes('history'));
});

test('bottom action bar no longer renders planner button', () => {
  assert.deepEqual(WORKOUT_BOTTOM_ACTIONS, ['add-workout']);
});

test('add button remains accessible and functional as bottom primary action', () => {
  assert.ok(WORKOUT_BOTTOM_ACTIONS.includes('add-workout'));
});
