import test from 'node:test';
import assert from 'node:assert/strict';

import {
  buildExerciseMuscleConfig,
  isValidMuscleKey,
  normalizeMuscleKeys,
  splitMusclesByView,
} from '../muscleMap';

test('isValidMuscleKey returns true for a valid muscle key', () => {
  assert.equal(isValidMuscleKey('chest'), true);
});

test('isValidMuscleKey returns false for invalid values', () => {
  assert.equal(isValidMuscleKey('invalid_muscle'), false);
  assert.equal(isValidMuscleKey(undefined), false);
  assert.equal(isValidMuscleKey(null), false);
});

test('normalizeMuscleKeys removes invalid values and duplicates while preserving order', () => {
  const result = normalizeMuscleKeys(['chest', 'invalid', 'chest', 'biceps']);

  assert.deepEqual(result, ['chest', 'biceps']);
});

test('normalizeMuscleKeys works with empty input', () => {
  assert.deepEqual(normalizeMuscleKeys([]), []);
  assert.deepEqual(normalizeMuscleKeys(undefined), []);
});

test('buildExerciseMuscleConfig builds safe primary and secondary arrays', () => {
  const result = buildExerciseMuscleConfig({
    primary: ['chest', 'chest', 'biceps', 'invalid'],
    secondary: ['obliques', 'biceps', 'obliques', 'trash'],
  });

  assert.deepEqual(result, {
    primary: ['chest', 'biceps'],
    secondary: ['obliques'],
  });
});

test('buildExerciseMuscleConfig works with empty and partial input', () => {
  assert.deepEqual(buildExerciseMuscleConfig(), { primary: [], secondary: [] });
  assert.deepEqual(buildExerciseMuscleConfig({ primary: ['lats', 'lats'] }), {
    primary: ['lats'],
    secondary: [],
  });
  assert.deepEqual(buildExerciseMuscleConfig({ secondary: ['glutes', 'glutes', 'bad'] }), {
    primary: [],
    secondary: ['glutes'],
  });
});

test('splitMusclesByView separates front and back muscles without losing primary-secondary roles', () => {
  const result = splitMusclesByView({
    primary: ['chest', 'lats', 'quads'],
    secondary: ['rear_delts', 'obliques', 'glutes'],
  });

  assert.deepEqual(result, {
    front: {
      primary: ['chest', 'quads'],
      secondary: ['obliques'],
    },
    back: {
      primary: ['lats'],
      secondary: ['rear_delts', 'glutes'],
    },
  });
});

test('splitMusclesByView returns empty buckets for empty inputs', () => {
  assert.deepEqual(splitMusclesByView({ primary: [], secondary: [] }), {
    front: { primary: [], secondary: [] },
    back: { primary: [], secondary: [] },
  });
});

test('user-like input remains valid and safe after normalization and config build', () => {
  const result = buildExerciseMuscleConfig({
    primary: ['chest', 'CHEST', 'front_delts', '', '123', 'biceps'],
    secondary: ['rear_delts', 'biceps', 'rear_delts', 'unknown', 'glutes'],
  });

  assert.deepEqual(result, {
    primary: ['chest', 'front_delts', 'biceps'],
    secondary: ['rear_delts', 'glutes'],
  });
});
