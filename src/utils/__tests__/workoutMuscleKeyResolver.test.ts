import test from 'node:test';
import assert from 'node:assert/strict';

import { resolveWorkoutMuscleKeys } from '../workoutMuscleKeyResolver';

test('resolveWorkoutMuscleKeys maps glute labels and legacy aliases to glutes', () => {
  const aliases = [
    'Ягодичные мышцы',
    'Ягодичная',
    'Ягодицы',
    'Ягодицы — большая',
    'Ягодицы — средняя',
    'Ягодицы — малая',
    'Ягодицы - большая',
    'Ягодицы - средняя',
    'Ягодицы - малая',
    'Ягодицы-большая',
    'Ягодицы-средняя',
    'Ягодицы-малая',
    'Большая ягодичная',
    'Средняя ягодичная',
    'Малая ягодичная',
    'glutes',
  ];

  aliases.forEach((alias) => {
    assert.deepEqual(resolveWorkoutMuscleKeys([alias]), ['glutes'], `${alias} should resolve to glutes`);
  });
});

test('resolveWorkoutMuscleKeys dedupes glute aliases', () => {
  assert.deepEqual(resolveWorkoutMuscleKeys(['Ягодичные мышцы', 'Большая ягодичная', 'glutes']), ['glutes']);
});

test('resolveWorkoutMuscleKeys maps middle delt labels and ids to side_delts', () => {
  const aliases = [
    'Средняя дельта',
    'Средние дельты',
    'Средний пучок дельт',
    'Средняя дельтовидная',
    'middle_delts',
    'middle delts',
    'middle_deltoid',
    'middle deltoid',
    'lateral_delts',
    'lateral delts',
    'lateral_deltoid',
    'lateral deltoid',
    'deltoids middle',
    'shoulders lateral',
    'side_delts',
  ];

  aliases.forEach((alias) => {
    assert.deepEqual(resolveWorkoutMuscleKeys([alias]), ['side_delts'], `${alias} should resolve to side_delts`);
  });
});
