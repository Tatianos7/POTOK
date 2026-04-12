import test from 'node:test';
import assert from 'node:assert/strict';

import {
  formatWorkoutMetricValue,
  getWorkoutMetricLabel,
  getWorkoutMetricUnit,
  getWorkoutMetricUnitOptions,
  normalizeWorkoutMetricType,
  normalizeWorkoutMetricUnit,
  normalizeWorkoutMetricValue,
  supportsWorkoutMetricUnitSelection,
} from '../workoutEntryMetric';

test('old workout entries safely fall back to weight metric', () => {
  assert.equal(normalizeWorkoutMetricType(undefined), 'weight');
  assert.equal(normalizeWorkoutMetricType('unexpected'), 'weight');
});

test('none metric forces stored value to zero', () => {
  assert.equal(normalizeWorkoutMetricValue('none', 42), 0);
});

test('time metric supports sec and min units', () => {
  assert.equal(getWorkoutMetricLabel('time'), 'Время');
  assert.deepEqual(getWorkoutMetricUnitOptions('time').map((item) => item.label), ['сек', 'мин']);
  assert.equal(normalizeWorkoutMetricUnit('time', 'мин'), 'мин');
  assert.equal(formatWorkoutMetricValue(30, 'time', 'сек'), '30 сек');
  assert.equal(formatWorkoutMetricValue(5, 'time', 'мин'), '5 мин');
});

test('distance metric supports m and km units', () => {
  assert.deepEqual(getWorkoutMetricUnitOptions('distance').map((item) => item.label), ['м', 'км']);
  assert.equal(normalizeWorkoutMetricUnit('distance', 'м'), 'м');
  assert.equal(formatWorkoutMetricValue(400, 'distance', 'м'), '400 м');
  assert.equal(formatWorkoutMetricValue(2, 'distance', 'км'), '2 км');
});

test('weight bodyweight and none do not expose extra unit selector semantics', () => {
  assert.equal(supportsWorkoutMetricUnitSelection('weight'), false);
  assert.equal(supportsWorkoutMetricUnitSelection('bodyweight'), false);
  assert.equal(supportsWorkoutMetricUnitSelection('none'), false);
  assert.equal(getWorkoutMetricUnit('weight', null), 'кг');
  assert.equal(getWorkoutMetricUnit('bodyweight', null), 'св. вес');
});
