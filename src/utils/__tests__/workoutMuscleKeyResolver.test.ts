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
