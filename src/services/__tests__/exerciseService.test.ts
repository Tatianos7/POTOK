import test from 'node:test';
import assert from 'node:assert/strict';

import { buildExerciseMuscleLinkRows, canDeleteCustomExercise, canEditCustomExercise, exerciseService } from '../exerciseService';
import type { Exercise, Muscle } from '../../types/workout';

function installLocalStorageMock() {
  const storage = new Map<string, string>();
  Object.defineProperty(globalThis, 'localStorage', {
    configurable: true,
    value: {
      getItem: (key: string) => storage.get(key) ?? null,
      setItem: (key: string, value: string) => {
        storage.set(key, value);
      },
      removeItem: (key: string) => {
        storage.delete(key);
      },
      clear: () => {
        storage.clear();
      },
    },
  });
}

function createExercise(name: string, muscles: string[], overrides?: Partial<Exercise>): Exercise {
  return {
    id: overrides?.id ?? `id-${name}-${muscles.join('-') || 'none'}`,
    name,
    category_id: overrides?.category_id ?? 'category-1',
    is_custom: overrides?.is_custom ?? false,
    created_by_user_id: overrides?.created_by_user_id ?? null,
    muscles: muscles.map((muscle) => ({ id: '', name: muscle } as Muscle)),
    ...overrides,
  };
}

test.beforeEach(() => {
  installLocalStorageMock();
});

test('muscles survive category fetch mapping from view rows', () => {
  const service = exerciseService as any;

  const mapped = service.mapExerciseFromViewRow('category-1', {
    id: 'exercise-1',
    exercise_name: 'Жим штанги лёжа',
    canonical_exercise_id: 'exercise-1',
    muscles: ['Грудь', 'Грудь (верх)'],
  }) as Exercise;

  assert.equal(mapped.name, 'Жим штанги лёжа');
  assert.deepEqual(
    mapped.muscles?.map((muscle) => muscle.name),
    ['Средний пучок', 'Верхний пучок'],
  );
});

test('direct fallback path preserves muscles', () => {
  const service = exerciseService as any;

  const mapped = service.mapExerciseFromDirectRow({
    id: 'exercise-2',
    name: 'Скручивания',
    category_id: 'category-2',
    is_custom: false,
    exercise_muscles: [{ muscle: { id: 'm-1', name: 'Прямая мышца живота' } }],
  }) as Exercise;

  assert.equal(mapped.name, 'Скручивания');
  assert.deepEqual(mapped.muscles?.map((muscle) => muscle.name), ['Прямая — верх']);
});

test('dedup keeps version with muscles', () => {
  const service = exerciseService as any;

  const deduplicated = service.mergeExerciseRecords([
    createExercise('Подтягивания', []),
    createExercise('Подтягивания', ['Широчайшие']),
  ]) as Exercise[];

  assert.equal(deduplicated.length, 1);
  assert.deepEqual(deduplicated[0].muscles?.map((muscle) => muscle.name), ['Широчайшие']);
});

test('local fallback returns cached category exercises', () => {
  const service = exerciseService as any;
  const exercises = [createExercise('Жим гантелей', ['Средний пучок'])];

  service.saveExercisesByCategoryToLocalStorage('category-3', exercises);
  const cached = service.getExercisesByCategoryFromLocalStorage('category-3') as Exercise[];

  assert.equal(cached.length, 1);
  assert.equal(cached[0].name, 'Жим гантелей');
  assert.deepEqual(cached[0].muscles?.map((muscle) => muscle.name), ['Средний пучок']);
});

test('custom exercises local read path returns only user-owned custom exercises', () => {
  const service = exerciseService as any;
  const userExercises = [
    createExercise('Мой жим в тренажере', ['Средний пучок'], {
      is_custom: true,
      created_by_user_id: 'user-1',
    }),
  ];
  const otherUserExercises = [
    createExercise('Чужое упражнение', ['Широчайшие'], {
      is_custom: true,
      created_by_user_id: 'user-2',
    }),
  ];

  service.saveCustomExercisesToLocalStorage('user-1', userExercises);
  service.saveCustomExercisesToLocalStorage('user-2', otherUserExercises);

  const cached = service.getCustomExercisesFromLocalStorage('user-1') as Exercise[];

  assert.equal(cached.length, 1);
  assert.equal(cached[0].name, 'Мой жим в тренажере');
  assert.equal(cached[0].created_by_user_id, 'user-1');
});

test('muscles are preserved for custom exercises in local read path', () => {
  const service = exerciseService as any;
  const customExercises = [
    createExercise('Махи в кроссовере', ['Задний пучок', 'Средний пучок'], {
      is_custom: true,
      created_by_user_id: 'user-1',
      category_id: 'category-shoulders',
    }),
  ];

  service.saveCustomExercisesToLocalStorage('user-1', customExercises);
  const cached = service.getCustomExercisesFromLocalStorage('user-1') as Exercise[];

  assert.deepEqual(
    cached[0].muscles?.map((muscle) => muscle.name),
    ['Задний пучок', 'Средний пучок'],
  );
});

test('custom browse list still shows user-owned custom exercise when muscle links are missing', () => {
  const service = exerciseService as any;
  const customExercises = [
    createExercise('Старое пользовательское упражнение', [], {
      id: 'custom-old',
      is_custom: true,
      created_by_user_id: 'user-1',
    }),
    createExercise('Новое пользовательское упражнение', ['Широчайшие'], {
      id: 'custom-new',
      is_custom: true,
      created_by_user_id: 'user-1',
    }),
  ];

  const merged = service.mergeExerciseRecords(customExercises) as Exercise[];

  assert.equal(merged.length, 2);
  assert.deepEqual(
    merged.map((exercise) => exercise.name),
    ['Старое пользовательское упражнение', 'Новое пользовательское упражнение'],
  );
});

test('only owner can edit custom exercise', () => {
  assert.equal(
    canEditCustomExercise({ is_custom: true, created_by_user_id: 'user-1' }, 'user-1'),
    true,
  );
  assert.equal(
    canEditCustomExercise({ is_custom: true, created_by_user_id: 'user-2' }, 'user-1'),
    false,
  );
});

test('system exercise cannot be edited through custom edit path', () => {
  assert.equal(
    canEditCustomExercise({ is_custom: false, created_by_user_id: null }, 'user-1'),
    false,
  );
});

test('only owner can delete custom exercise', () => {
  assert.equal(
    canDeleteCustomExercise({ is_custom: true, created_by_user_id: 'user-1' }, 'user-1'),
    true,
  );
  assert.equal(
    canDeleteCustomExercise({ is_custom: true, created_by_user_id: 'user-2' }, 'user-1'),
    false,
  );
});

test('system exercise cannot be deleted through custom delete path', () => {
  assert.equal(
    canDeleteCustomExercise({ is_custom: false, created_by_user_id: null }, 'user-1'),
    false,
  );
});

test('editing custom exercise replaces muscle links correctly', () => {
  assert.deepEqual(buildExerciseMuscleLinkRows('exercise-1', ['m-1', 'm-2']), [
    { exercise_id: 'exercise-1', muscle_id: 'm-1' },
    { exercise_id: 'exercise-1', muscle_id: 'm-2' },
  ]);
});

test('direct-row muscle mapping preserves muscle ids for custom exercise editing', () => {
  const service = exerciseService as any;

  const mapped = service.mapExerciseFromDirectRow({
    id: 'exercise-3',
    name: 'Разведение в тренажёре',
    category_id: 'category-3',
    is_custom: true,
    created_by_user_id: 'user-1',
    exercise_muscles: [{ muscle: { id: 'm-rear-delt', name: 'Задние дельты' } }],
  }) as Exercise;

  assert.equal(mapped.muscles?.[0]?.id, 'm-rear-delt');
  assert.ok(mapped.muscles?.[0]?.name);
});
