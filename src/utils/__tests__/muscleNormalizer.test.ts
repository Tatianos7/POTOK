import test from 'node:test';
import assert from 'node:assert/strict';

import { areMuscleNamesSynonymous, normalizeMuscleName } from '../muscleNormalizer';

test('normalizeMuscleName maps general trapezius names to one readable value', () => {
  assert.equal(normalizeMuscleName('Трапециевидная мышца'), 'Трапециевидная мышца');
  assert.equal(normalizeMuscleName('Трапеции'), 'Трапециевидная мышца');
  assert.equal(normalizeMuscleName('trapezius'), 'Трапециевидная мышца');
  assert.equal(normalizeMuscleName('traps'), 'Трапециевидная мышца');
});

test('normalizeMuscleName preserves specific trapezius segments', () => {
  assert.equal(normalizeMuscleName('Верх трапеций'), 'Верх трапеций');
  assert.equal(normalizeMuscleName('Средняя часть трапеций'), 'Средняя часть трапеций');
  assert.equal(normalizeMuscleName('Низ трапеций'), 'Нижняя часть трапеций');
});

test('areMuscleNamesSynonymous matches common trapezius synonyms', () => {
  assert.equal(areMuscleNamesSynonymous('Трапеции', 'trapezius'), true);
  assert.equal(areMuscleNamesSynonymous('Верх трапеций', 'upper_traps'), true);
  assert.equal(areMuscleNamesSynonymous('Средняя часть трапеций', 'middle_traps'), true);
  assert.equal(areMuscleNamesSynonymous('Низ трапеций', 'lower_traps'), true);
});
