import test from 'node:test';
import assert from 'node:assert/strict';

import { validateGoalInput, type GoalInputLike } from '../goalValidation';

const validGoalInput: GoalInputLike = {
  age: '32',
  weight: '72',
  height: '174',
  lifestyle: 'moderate',
  goal: 'weight-loss',
  targetWeight: '68',
};

test('empty age does not pass goal validation', () => {
  const result = validateGoalInput({ ...validGoalInput, age: '' });

  assert.equal(result.isValid, false);
  assert.equal(result.errors.age, 'Укажите возраст от 18 до 100 лет.');
});

test('age below 18 does not pass goal validation', () => {
  const result = validateGoalInput({ ...validGoalInput, age: '17' });

  assert.equal(result.isValid, false);
  assert.equal(result.errors.age, 'Укажите возраст от 18 до 100 лет.');
});

test('age above 100 does not pass goal validation', () => {
  const result = validateGoalInput({ ...validGoalInput, age: '101' });

  assert.equal(result.isValid, false);
  assert.equal(result.errors.age, 'Укажите возраст от 18 до 100 лет.');
});

test('weight below 30 does not pass goal validation', () => {
  const result = validateGoalInput({ ...validGoalInput, weight: '29' });

  assert.equal(result.isValid, false);
  assert.equal(result.errors.weight, 'Укажите вес от 30 до 300 кг.');
});

test('weight above 300 does not pass goal validation', () => {
  const result = validateGoalInput({ ...validGoalInput, weight: '301' });

  assert.equal(result.isValid, false);
  assert.equal(result.errors.weight, 'Укажите вес от 30 до 300 кг.');
});

test('height below 120 does not pass goal validation', () => {
  const result = validateGoalInput({ ...validGoalInput, height: '119' });

  assert.equal(result.isValid, false);
  assert.equal(result.errors.height, 'Укажите рост от 120 до 250 см.');
});

test('height above 250 does not pass goal validation', () => {
  const result = validateGoalInput({ ...validGoalInput, height: '251' });

  assert.equal(result.isValid, false);
  assert.equal(result.errors.height, 'Укажите рост от 120 до 250 см.');
});

test('missing activity does not pass goal validation', () => {
  const result = validateGoalInput({ ...validGoalInput, lifestyle: '' });

  assert.equal(result.isValid, false);
  assert.equal(result.errors.lifestyle, 'Выберите уровень активности.');
});

test('missing goal type does not pass goal validation', () => {
  const result = validateGoalInput({ ...validGoalInput, goal: '' });

  assert.equal(result.isValid, false);
  assert.equal(result.errors.goal, 'Выберите цель.');
});

test('valid goal input passes validation', () => {
  const result = validateGoalInput(validGoalInput);

  assert.equal(result.isValid, true);
  assert.deepEqual(result.errors, {});
});

test('weight loss passes when target weight is lower than current weight', () => {
  const result = validateGoalInput({ ...validGoalInput, goal: 'weight-loss', weight: '70', targetWeight: '69' });

  assert.equal(result.isValid, true);
});

test('weight loss fails when target weight is equal to current weight', () => {
  const result = validateGoalInput({ ...validGoalInput, goal: 'weight-loss', weight: '70', targetWeight: '70' });

  assert.equal(result.isValid, false);
  assert.equal(result.errors.targetWeight, 'Для похудения целевой вес должен быть меньше текущего.');
});

test('weight loss fails when target weight is higher than current weight', () => {
  const result = validateGoalInput({ ...validGoalInput, goal: 'weight-loss', weight: '70', targetWeight: '80' });

  assert.equal(result.isValid, false);
  assert.equal(result.errors.targetWeight, 'Для похудения целевой вес должен быть меньше текущего.');
});

test('mass gain passes when target weight is higher than current weight', () => {
  const result = validateGoalInput({ ...validGoalInput, goal: 'gain', weight: '70', targetWeight: '71' });

  assert.equal(result.isValid, true);
});

test('mass gain fails when target weight is equal to current weight', () => {
  const result = validateGoalInput({ ...validGoalInput, goal: 'gain', weight: '70', targetWeight: '70' });

  assert.equal(result.isValid, false);
  assert.equal(result.errors.targetWeight, 'Для набора массы целевой вес должен быть больше текущего.');
});

test('mass gain fails when target weight is lower than current weight', () => {
  const result = validateGoalInput({ ...validGoalInput, goal: 'gain', weight: '70', targetWeight: '60' });

  assert.equal(result.isValid, false);
  assert.equal(result.errors.targetWeight, 'Для набора массы целевой вес должен быть больше текущего.');
});

test('maintain goal does not require target weight', () => {
  const { targetWeight: _targetWeight, ...input } = validGoalInput;
  const result = validateGoalInput({ ...input, goal: 'maintain' });

  assert.equal(result.isValid, true);
  assert.equal(result.errors.targetWeight, undefined);
});
