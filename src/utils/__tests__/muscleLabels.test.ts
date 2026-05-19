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
  assert.equal(getMuscleLabel('cardio'), 'Кардио');
});

test('getMuscleLabel keeps general and specific trapezius labels readable', () => {
  assert.equal(getMuscleLabel('trapezoid'), 'Трапециевидная мышца');
  assert.equal(getMuscleLabel('traps'), 'Трапециевидная мышца');
  assert.equal(getMuscleLabel('trapezius'), 'Трапециевидная мышца');
  assert.equal(getMuscleLabel('upper_traps'), 'Верх трапеций');
  assert.equal(getMuscleLabel('middle_traps'), 'Средняя часть трапеций');
  assert.equal(getMuscleLabel('lower_traps'), 'Нижняя часть трапеций');
});
