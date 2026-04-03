import test from 'node:test';
import assert from 'node:assert/strict';

import {
  buildWorkoutIntegerDraft,
  getWorkoutIntegerInputProps,
  parseWorkoutIntegerInput,
  sanitizeWorkoutIntegerInput,
} from '../workoutNumericInput';

test('sets and reps inputs remove leading zero artifacts', () => {
  assert.equal(sanitizeWorkoutIntegerInput('03'), '3');
  assert.equal(sanitizeWorkoutIntegerInput('012'), '12');
  assert.equal(sanitizeWorkoutIntegerInput('0005'), '5');
});

test('sets and reps inputs preserve intended numeric value', () => {
  assert.equal(parseWorkoutIntegerInput('12'), 12);
  assert.equal(parseWorkoutIntegerInput('003'), 3);
  assert.equal(buildWorkoutIntegerDraft(8), '8');
});

test('workout integer inputs render without spinner controls as intended', () => {
  assert.deepEqual(getWorkoutIntegerInputProps(), {
    type: 'text',
    inputMode: 'numeric',
  });
});
