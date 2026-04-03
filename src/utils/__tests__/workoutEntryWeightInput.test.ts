import test from 'node:test';
import assert from 'node:assert/strict';

import {
  buildWorkoutWeightDraft,
  getWorkoutWeightInputProps,
  parseWorkoutWeightInput,
  sanitizeWorkoutWeightInput,
} from '../workoutEntryWeightInput';

test('weight input does not introduce leading zero when replacing value', () => {
  assert.equal(sanitizeWorkoutWeightInput('090'), '90');
  assert.equal(sanitizeWorkoutWeightInput('030'), '30');
  assert.equal(sanitizeWorkoutWeightInput('005'), '5');
});

test('weight input preserves intended numeric value during edit', () => {
  assert.equal(sanitizeWorkoutWeightInput('90'), '90');
  assert.equal(sanitizeWorkoutWeightInput('72.5'), '72.5');
  assert.equal(sanitizeWorkoutWeightInput('072.5'), '72.5');
  assert.equal(sanitizeWorkoutWeightInput('0.5'), '0.5');
});

test('whole workout editor weight input does not introduce leading zero when replacing value', () => {
  const nextDraft = sanitizeWorkoutWeightInput('088');

  assert.equal(nextDraft, '88');
  assert.equal(parseWorkoutWeightInput(nextDraft), 88);
});

test('single entry editor weight input does not introduce leading zero when replacing value', () => {
  const nextDraft = sanitizeWorkoutWeightInput('090');

  assert.equal(nextDraft, '90');
  assert.equal(buildWorkoutWeightDraft(90), '90');
});

test('workout weight inputs render without spinner controls as intended', () => {
  assert.deepEqual(getWorkoutWeightInputProps(), {
    type: 'text',
    inputMode: 'decimal',
  });
});
