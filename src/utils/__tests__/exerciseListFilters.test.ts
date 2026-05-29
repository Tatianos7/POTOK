import test from 'node:test';
import assert from 'node:assert/strict';

import type { Exercise } from '../../types/workout';
import { deriveAvailableMuscles, filterExercisesForList } from '../exerciseListFilters';

function createExercise(id: string, name: string, muscles: string[], categoryId = 'category-1'): Exercise {
  return {
    id,
    name,
    category_id: categoryId,
    is_custom: false,
    muscles: muscles.map((muscle) => ({ id: muscle, name: muscle })),
  };
}

function createContentExercise(
  canonicalId: string,
  name: string,
  categoryId: 'arms' | 'back' | 'abs',
  runtimeMuscles: string[] = [],
): Exercise {
  return {
    ...createExercise(`runtime-${canonicalId}`, name, runtimeMuscles, categoryId),
    canonical_exercise_id: canonicalId,
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

test('arms category exposes only biceps and triceps muscle filters', () => {
  const exercises = [
    createContentExercise('standing_barbell_biceps_curl', 'Подъём штанги на бицепс', 'arms'),
    createContentExercise('close_grip_bench_press', 'Жим узким хватом', 'arms'),
  ];

  const muscles = deriveAvailableMuscles(exercises, { id: 'arms', name: 'Руки', order: 1 });

  assert.deepEqual(muscles.map((muscle) => muscle.name), ['Бицепс', 'Трицепс']);
  assert.equal(muscles.some((muscle) => muscle.name === 'Широчайшие'), false);
  assert.equal(muscles.some((muscle) => muscle.name === 'Средний пучок'), false);
});

test('back category exposes curated primary back filters without biceps or glutes', () => {
  const exercises = [
    createContentExercise('barbell_row', 'Тяга штанги в наклоне', 'back'),
    createContentExercise('barbell_shrug', 'Шраги со штангой', 'back'),
    createContentExercise('deadlift_classic', 'Становая тяга', 'back'),
  ];

  const muscles = deriveAvailableMuscles(exercises, { id: 'back', name: 'Спина', order: 2 });

  assert.deepEqual(muscles.map((muscle) => muscle.name), ['Широчайшие', 'Трапециевидные', 'Поясница']);
  assert.equal(muscles.some((muscle) => muscle.name === 'Бицепс'), false);
  assert.equal(muscles.some((muscle) => muscle.name === 'Ягодицы'), false);
});

test('abs category exposes user-facing abs filters without core technical labels', () => {
  const exercises = [
    createContentExercise('crunch', 'Скручивания', 'abs'),
    createContentExercise('side_plank', 'Боковая планка', 'abs'),
  ];

  const muscles = deriveAvailableMuscles(exercises, { id: 'abs', name: 'Пресс', order: 3 });

  assert.deepEqual(muscles.map((muscle) => muscle.name), ['Пресс', 'Косые мышцы живота']);
  assert.equal(muscles.some((muscle) => muscle.name === 'Кор'), false);
  assert.equal(muscles.some((muscle) => muscle.name === 'Нижний кор'), false);
});

test('curated category filters use primary muscles and do not expose secondary muscles automatically', () => {
  const exercises = [
    createContentExercise('barbell_row', 'Тяга штанги в наклоне', 'back'),
  ];

  const muscles = deriveAvailableMuscles(exercises, { id: 'back', name: 'Спина', order: 2 });
  const filteredByLats = filterExercisesForList(
    exercises,
    '',
    new Set(['Широчайшие']),
    { id: 'back', name: 'Спина', order: 2 },
  );
  const filteredByBiceps = filterExercisesForList(
    exercises,
    '',
    new Set(['Бицепс']),
    { id: 'back', name: 'Спина', order: 2 },
  );

  assert.deepEqual(muscles.map((muscle) => muscle.name), ['Широчайшие']);
  assert.equal(filteredByLats.length, 1);
  assert.equal(filteredByBiceps.length, 0);
});

test('trapezius curated filter matches trapezius primary aliases', () => {
  const exercises = [
    createContentExercise('barbell_shrug', 'Шраги со штангой', 'back'),
    createContentExercise('barbell_row', 'Тяга штанги в наклоне', 'back'),
  ];

  const filtered = filterExercisesForList(
    exercises,
    '',
    new Set(['Трапециевидные']),
    { id: 'back', name: 'Спина', order: 2 },
  );

  assert.equal(filtered.length, 1);
  assert.equal(filtered[0].name, 'Шраги со штангой');
});
