import test from 'node:test';
import assert from 'node:assert/strict';

import { getMuscleLabel } from '../muscleLabels';

test('getMuscleLabel returns russian label for teres_major', () => {
  assert.equal(getMuscleLabel('teres_major'), 'Большая круглая мышца');
});

test('getMuscleLabel returns russian label for forearms_back', () => {
  assert.equal(getMuscleLabel('forearms_back'), 'Предплечья');
});

test('getMuscleLabel keeps common back muscle keys translated', () => {
  assert.equal(getMuscleLabel('lats'), 'Широчайшие мышцы спины');
  assert.equal(getMuscleLabel('rhomboids'), 'Ромбовидные мышцы');
  assert.equal(getMuscleLabel('lower_back'), 'Поясница');
  assert.equal(getMuscleLabel('rear_delts'), 'Задние дельты');
});
