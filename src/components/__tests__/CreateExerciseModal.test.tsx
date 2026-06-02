import test from 'node:test';
import assert from 'node:assert/strict';

import {
  FULL_BODY_CATEGORY_NAME,
  buildCreateExerciseCategoryOptions,
  buildTargetMuscleOptions,
} from '../CreateExerciseModal';
import { muscleLabels } from '../../data/muscles/muscleLabels';
import type { ExerciseCategory, Muscle } from '../../types/workout';

const createMuscle = (name: string, id = name): Muscle => ({ id, name });
const createCategory = (name: string, id = name, order = 1): ExerciseCategory => ({ id, name, order });

test('custom exercise target muscle options hide noisy duplicate labels', () => {
  const options = buildTargetMuscleOptions([
    createMuscle('Брахиалис'),
    createMuscle('Грудь'),
    createMuscle('Грудь — верх'),
    createMuscle('Грудь (низ)'),
    createMuscle('Кор'),
    createMuscle('Нижний кор'),
    createMuscle('Прямая мышца живота'),
    createMuscle('Прямая мышца живота-верх'),
    createMuscle('Ягодицы-большая'),
    createMuscle('Бицепс'),
    createMuscle('Трицепс'),
  ]);

  const labels = options.map((muscle) => muscle.name);

  assert.deepEqual(labels, [muscleLabels.chest, muscleLabels.glutes, 'Бицепс', 'Трицепс']);
});

test('custom exercise target muscle options keep one readable chest label', () => {
  const options = buildTargetMuscleOptions([
    createMuscle('Грудь', 'chest-alias'),
    createMuscle('Грудь — верх', 'upper-chest-alias'),
    createMuscle('Грудь — низ', 'lower-chest-alias'),
    createMuscle('Грудь — середина', 'middle-chest-alias'),
    createMuscle('Грудь (верх)', 'upper-chest-parentheses'),
    createMuscle('Грудь (низ)', 'lower-chest-parentheses'),
    createMuscle('Грудь (середина)', 'middle-chest-parentheses'),
    createMuscle(muscleLabels.chest, 'chest'),
  ]);

  assert.deepEqual(options.map((muscle) => muscle.name), [muscleLabels.chest]);
  assert.equal(options[0]?.id, 'chest');
});

test('custom exercise target muscle options show one readable obliques label', () => {
  const options = buildTargetMuscleOptions([
    createMuscle('Косая', 'obliques-alias-1'),
    createMuscle('Косые', 'obliques-alias-2'),
    createMuscle('Косые мышцы', 'obliques-alias-3'),
    createMuscle(muscleLabels.obliques, 'obliques'),
  ]);

  assert.deepEqual(options.map((muscle) => muscle.name), [muscleLabels.obliques]);
  assert.equal(options[0]?.id, 'obliques');
});

test('custom exercise target muscle options keep unique readable labels', () => {
  const options = buildTargetMuscleOptions([
    createMuscle('Бицепс', 'biceps'),
    createMuscle('Бицепс', 'biceps-copy'),
    createMuscle(muscleLabels.obliques, 'obliques'),
    createMuscle('Бицепс бедра', 'hamstrings'),
  ]);

  assert.deepEqual(options.map((muscle) => muscle.name), [
    'Бицепс',
    muscleLabels.obliques,
    'Бицепс бедра',
  ]);
});

test('custom exercise target muscle options replace glute aliases with one readable label', () => {
  const options = buildTargetMuscleOptions([
    createMuscle('Ягодицы', 'glute-alias-0'),
    createMuscle('Ягодицы — большая', 'glute-alias-long-1'),
    createMuscle('Ягодицы — средняя', 'glute-alias-long-2'),
    createMuscle('Ягодицы — малая', 'glute-alias-long-3'),
    createMuscle('Ягодицы - большая', 'glute-alias-spaced-1'),
    createMuscle('Ягодицы - средняя', 'glute-alias-spaced-2'),
    createMuscle('Ягодицы - малая', 'glute-alias-spaced-3'),
    createMuscle('Ягодицы-большая', 'glute-alias-tight-1'),
    createMuscle('Ягодицы-средняя', 'glute-alias-tight-2'),
    createMuscle('Ягодицы-малая', 'glute-alias-tight-3'),
    createMuscle('Ягодичная', 'glute-alias-1'),
    createMuscle('Ягодичная - большая', 'glute-alias-2'),
    createMuscle('Ягодичная - средняя', 'glute-alias-3'),
    createMuscle('Ягодичная - малая', 'glute-alias-4'),
    createMuscle(muscleLabels.glutes, 'glutes'),
  ]);

  assert.deepEqual(options.map((muscle) => muscle.name), [muscleLabels.glutes]);
  assert.equal(options[0]?.id, 'glutes');
});

test('custom exercise target muscle options show readable abductors label', () => {
  const options = buildTargetMuscleOptions([
    createMuscle('Отводящие мышцы', 'abductors'),
    createMuscle('hip_abductors', 'hip_abductors'),
    createMuscle(muscleLabels.abductors, 'abductors'),
  ]);

  assert.deepEqual(options.map((muscle) => muscle.name), [muscleLabels.abductors]);
  assert.equal(options[0]?.id, 'abductors');
});

test('custom exercise target muscle options do not synthesize abductors without source muscle', () => {
  const options = buildTargetMuscleOptions([
    createMuscle('Бицепс', 'biceps'),
  ]);

  assert.equal(options.some((muscle) => muscle.name === muscleLabels.abductors), false);
});

test('custom exercise category options include real full body category when provided by data source', () => {
  const options = buildCreateExerciseCategoryOptions([
    createCategory('Ноги', 'legs', 5),
    createCategory(FULL_BODY_CATEGORY_NAME, 'full-body-category', 8),
  ]);

  assert.deepEqual(
    options.map((category) => category.name),
    ['Ноги', FULL_BODY_CATEGORY_NAME],
  );
  assert.equal(options.find((category) => category.name === FULL_BODY_CATEGORY_NAME)?.id, 'full-body-category');
});
