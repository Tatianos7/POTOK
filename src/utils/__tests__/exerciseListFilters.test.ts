import test from 'node:test';
import assert from 'node:assert/strict';

import type { Exercise } from '../../types/workout';
import { deriveAvailableMuscles, filterExercisesForList } from '../exerciseListFilters';

function createExercise(id: string, name: string, muscles: string[]): Exercise {
  return {
    id,
    name,
    category_id: 'category-1',
    is_custom: false,
    muscles: muscles.map((muscle) => ({ id: muscle, name: muscle })),
  };
}

test('availableMuscles is derived correctly from exercises with muscles', () => {
  const exercises = [
    createExercise('1', 'Жим лёжа', ['Грудь', 'Грудь (верх)']),
    createExercise('2', 'Скручивания', ['Прямая мышца живота']),
  ];

  const muscles = deriveAvailableMuscles(exercises);

  assert.deepEqual(
    muscles.map((muscle) => muscle.name),
    ['Верхний пучок', 'Прямая — верх', 'Средний пучок'],
  );
});

test('muscle filter narrows exercise list correctly', () => {
  const exercises = [
    createExercise('1', 'Жим лёжа', ['Грудь']),
    createExercise('2', 'Подтягивания', ['Широчайшие']),
  ];

  const filtered = filterExercisesForList(exercises, '', new Set(['Средний пучок']));

  assert.equal(filtered.length, 1);
  assert.equal(filtered[0].name, 'Жим лёжа');
});

test('search and muscle filter coexist correctly', () => {
  const exercises = [
    createExercise('1', 'Жим лёжа', ['Грудь']),
    createExercise('2', 'Жим сидя', ['Плечи']),
    createExercise('3', 'Подтягивания', ['Широчайшие']),
  ];

  const filtered = filterExercisesForList(exercises, 'жим', new Set(['Плечи']));

  assert.equal(filtered.length, 1);
  assert.equal(filtered[0].name, 'Жим сидя');
});

test('selected exercises do not get lost after filter apply because filtering is id-based and non-destructive', () => {
  const exercises = [
    createExercise('1', 'Жим лёжа', ['Грудь']),
    createExercise('2', 'Подтягивания', ['Широчайшие']),
  ];

  const filtered = filterExercisesForList(exercises, '', new Set(['Средний пучок']));
  const selectedIds = new Set(['1', '2']);
  const selected = exercises.filter((exercise) => selectedIds.has(exercise.id));

  assert.equal(filtered.length, 1);
  assert.equal(selected.length, 2);
  assert.deepEqual(
    selected.map((exercise) => exercise.name),
    ['Жим лёжа', 'Подтягивания'],
  );
});

test('no false Нет доступных мышц when muscles exist', () => {
  const exercises = [createExercise('1', 'Жим лёжа', ['Грудь'])];

  const muscles = deriveAvailableMuscles(exercises);

  assert.equal(muscles.length, 1);
  assert.equal(muscles[0].name, 'Средний пучок');
});

test('custom browse filter has muscles when custom exercise carries muscle links', () => {
  const exercises = [
    {
      ...createExercise('custom-1', 'Мой жим в тренажёре', ['Грудь']),
      is_custom: true,
      created_by_user_id: 'user-1',
    },
  ];

  const muscles = deriveAvailableMuscles(exercises);
  const filtered = filterExercisesForList(exercises, '', new Set(['Средний пучок']));

  assert.equal(muscles.length, 1);
  assert.equal(muscles[0].name, 'Средний пучок');
  assert.equal(filtered.length, 1);
  assert.equal(filtered[0].name, 'Мой жим в тренажёре');
});

test('custom exercise without muscle links stays visible in base browse list', () => {
  const exercises = [
    {
      ...createExercise('custom-legacy', 'Старое упражнение без мышц', []),
      is_custom: true,
      created_by_user_id: 'user-1',
    },
    {
      ...createExercise('custom-new', 'Новое упражнение', ['Грудь']),
      is_custom: true,
      created_by_user_id: 'user-1',
    },
  ];

  const filtered = filterExercisesForList(exercises, '', new Set());

  assert.equal(filtered.length, 2);
  assert.deepEqual(
    filtered.map((exercise) => exercise.name),
    ['Старое упражнение без мышц', 'Новое упражнение'],
  );
});

test('muscle filter ignores custom exercises without muscle links but keeps linked ones', () => {
  const exercises = [
    {
      ...createExercise('custom-legacy', 'Старое упражнение без мышц', []),
      is_custom: true,
      created_by_user_id: 'user-1',
    },
    {
      ...createExercise('custom-new', 'Новое упражнение', ['Грудь']),
      is_custom: true,
      created_by_user_id: 'user-1',
    },
  ];

  const filtered = filterExercisesForList(exercises, '', new Set(['Средний пучок']));

  assert.equal(filtered.length, 1);
  assert.equal(filtered[0].name, 'Новое упражнение');
});

test('edited custom exercise stays discoverable by updated name in browse search', () => {
  const exercises = [
    {
      ...createExercise('custom-1', 'Тяга в наклоне узким хватом', ['Широчайшие']),
      is_custom: true,
      created_by_user_id: 'user-1',
    },
  ];

  const filtered = filterExercisesForList(exercises, 'узким', new Set());

  assert.equal(filtered.length, 1);
  assert.equal(filtered[0].name, 'Тяга в наклоне узким хватом');
});
