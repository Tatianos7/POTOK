import test from 'node:test';
import assert from 'node:assert/strict';

import {
  WORKOUT_BOTTOM_BAR_CLASS,
  WORKOUT_MAIN_CONTAINER_CLASS,
  WORKOUT_SCREEN_BACKGROUND,
} from '../workoutLayout';

test('workout main screen bottom action bar remains anchored to bottom container', () => {
  assert.match(WORKOUT_MAIN_CONTAINER_CLASS, /flex/);
  assert.match(WORKOUT_MAIN_CONTAINER_CLASS, /min-h-screen/);
  assert.match(WORKOUT_MAIN_CONTAINER_CLASS, /flex-col/);
  assert.match(WORKOUT_BOTTOM_BAR_CLASS, /mt-auto/);
});

test('workout screens use white background as intended', () => {
  assert.equal(WORKOUT_SCREEN_BACKGROUND, '#FFFFFF');
});

test('history entry point remains accessible through bottom bar contract', () => {
  assert.match(WORKOUT_BOTTOM_BAR_CLASS, /border-t/);
  assert.match(WORKOUT_BOTTOM_BAR_CLASS, /bg-white/);
});
