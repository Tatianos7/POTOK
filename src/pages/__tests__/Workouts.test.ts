import test from 'node:test';
import assert from 'node:assert/strict';

import {
  buildCurrentWorkoutMuscleMapMuscles,
  filterWorkoutCatalogCategories,
  getWorkoutHeaderActionIds,
} from '../Workouts';
import type { WorkoutEntry } from '../../types/workout';

test('main workout screen no longer renders whole-workout edit action', () => {
  assert.deepEqual(getWorkoutHeaderActionIds(), ['history', 'note', 'delete']);
  assert.equal(getWorkoutHeaderActionIds().includes('edit' as never), false);
});

test('main workout catalog categories hide full body category', () => {
  const categories = filterWorkoutCatalogCategories([
    { id: 'legs', name: 'Ноги', order: 5 },
    { id: 'full-body', name: 'Все тело', order: 8 },
    { id: 'cardio', name: 'Кардио', order: 7 },
  ]);

  assert.deepEqual(categories.map((category) => category.name), ['Ноги', 'Кардио']);
});

const createEntry = (
  exerciseId: string,
  exerciseName: string,
  categoryId = 'strength',
): WorkoutEntry => ({
  id: `entry-${exerciseId}`,
  workout_day_id: 'day-1',
  exercise_id: exerciseId,
  sets: 3,
  reps: 10,
  weight: 20,
  exercise: {
    id: exerciseId,
    name: exerciseName,
    category_id: categoryId,
    is_custom: false,
  },
});

test('current workout muscle map stays empty without selected workout entries', () => {
  assert.deepEqual(buildCurrentWorkoutMuscleMapMuscles([]), {
    primaryMuscles: [],
    secondaryMuscles: [],
  });
});

test('current workout muscle map aggregates primary and secondary muscles', () => {
  const result = buildCurrentWorkoutMuscleMapMuscles([
    createEntry('standing_barbell_press', 'Жим штанги стоя'),
  ]);

  assert.ok(result.primaryMuscles.includes('front_delts'));
  assert.ok(result.primaryMuscles.includes('triceps'));
  assert.ok(result.secondaryMuscles.includes('trapezoid'));
  assert.ok(result.secondaryMuscles.includes('core_muscles'));
});

test('current workout muscle map uses custom exercise linked muscles as primary fallback', () => {
  const customEntry = createEntry('custom-leg-curl', 'Свое упражнение');
  customEntry.exercise = {
    ...customEntry.exercise!,
    is_custom: true,
    muscles: [
      { id: 'm-hamstrings', name: 'Бицепс бедра' },
      { id: 'm-biceps', name: 'Бицепс' },
      { id: 'm-lower-chest', name: 'Грудь — низ' },
    ],
  };

  const result = buildCurrentWorkoutMuscleMapMuscles([customEntry]);

  assert.ok(result.primaryMuscles.includes('hamstrings'));
  assert.ok(result.primaryMuscles.includes('biceps'));
  assert.ok(result.primaryMuscles.includes('chest'));
  assert.deepEqual(result.secondaryMuscles, []);
});

test('current workout muscle map normalizes custom exercise muscle labels to supported map keys', () => {
  const customEntry = createEntry('custom-full-map', 'Свое упражнение на все зоны');
  customEntry.exercise = {
    ...customEntry.exercise!,
    is_custom: true,
    muscles: [
      { id: 'm-glute', name: 'Ягодичная' },
      { id: 'm-quad', name: 'Квадрицепс' },
      { id: 'm-abductors', name: 'Отводящие мышцы бедра' },
      { id: 'm-traps-middle', name: 'Трапеция — средняя' },
      { id: 'm-calves', name: 'Икроножные мышцы' },
      { id: 'm-lower-back', name: 'Поясница' },
    ],
  };

  const result = buildCurrentWorkoutMuscleMapMuscles([customEntry]);

  assert.ok(result.primaryMuscles.includes('glutes'));
  assert.ok(result.primaryMuscles.includes('quads'));
  assert.ok(result.primaryMuscles.includes('abductors'));
  assert.ok(result.primaryMuscles.includes('traps_middle'));
  assert.ok(result.primaryMuscles.includes('calves'));
  assert.ok(result.primaryMuscles.includes('lower_back'));
  assert.deepEqual(result.secondaryMuscles, []);
});

test('current workout muscle map normalizes custom adductors and rhomboids labels', () => {
  const customEntry = createEntry('custom-inner-thigh-upper-back', 'Свое упражнение на приводящие и верх спины');
  customEntry.exercise = {
    ...customEntry.exercise!,
    is_custom: true,
    muscles: [
      { id: 'm-adductors', name: 'Приводящие' },
      { id: 'm-rhomboids', name: 'Ромбовидные' },
    ],
  };

  const result = buildCurrentWorkoutMuscleMapMuscles([customEntry]);

  assert.ok(result.primaryMuscles.includes('adductors'));
  assert.ok(result.primaryMuscles.includes('rhomboids'));
  assert.deepEqual(result.secondaryMuscles, []);
});

test('current workout muscle map expands full body custom muscle to curated map keys', () => {
  const customEntry = createEntry('custom-full-body', 'Свое упражнение на все тело');
  customEntry.exercise = {
    ...customEntry.exercise!,
    is_custom: true,
    muscles: [
      { id: 'm-full-body', name: 'Все тело' },
    ],
  };

  const result = buildCurrentWorkoutMuscleMapMuscles([customEntry]);

  [
    'front_delts',
    'side_delts',
    'rear_delts',
    'chest',
    'upper_chest',
    'biceps',
    'triceps',
    'forearms',
    'lats',
    'trapezoid',
    'rhomboids',
    'lower_back',
    'abs',
    'obliques',
    'glutes',
    'quads',
    'hamstrings',
    'adductors',
    'abductors',
    'calves',
  ].forEach((key) => {
    assert.ok(result.primaryMuscles.includes(key as never), `${key} should be included`);
  });
  assert.equal(result.primaryMuscles.includes('cardio'), false);
  assert.equal(result.primaryMuscles.includes('front_neck'), false);
  assert.equal(result.primaryMuscles.includes('tibialis_anterior'), false);
  assert.deepEqual(result.secondaryMuscles, []);
});

test('current workout muscle map ignores unknown custom muscles while deduping known aliases', () => {
  const customEntry = createEntry('custom-duplicates', 'Свое упражнение с дублями мышц');
  customEntry.exercise = {
    ...customEntry.exercise!,
    is_custom: true,
    muscles: [
      { id: 'm-glute-1', name: 'Ягодичная' },
      { id: 'm-glute-2', name: 'Ягодичные мышцы' },
      { id: 'm-unknown', name: 'Неизвестная мышца' },
    ],
  };

  const result = buildCurrentWorkoutMuscleMapMuscles([customEntry]);

  assert.deepEqual(result.primaryMuscles, ['glutes']);
  assert.deepEqual(result.secondaryMuscles, []);
});

test('current workout muscle map resolves glute custom muscle labels and ids', () => {
  const customEntry = createEntry('custom-glutes', 'Свое упражнение на ягодичные');
  customEntry.exercise = {
    ...customEntry.exercise!,
    is_custom: true,
    muscles: [
      { id: 'Большая ягодичная', name: 'Старый label через id' },
      { id: 'm-glutes', name: 'Ягодичные мышцы' },
      { id: 'm-glutes-large', name: 'Ягодицы — большая' },
      { id: 'm-glutes-middle', name: 'Ягодицы — средняя' },
      { id: 'm-glutes-small', name: 'Ягодицы — малая' },
    ],
  };

  const result = buildCurrentWorkoutMuscleMapMuscles([customEntry]);

  assert.deepEqual(result.primaryMuscles, ['glutes']);
  assert.deepEqual(result.secondaryMuscles, []);
});

test('current workout muscle map stays hidden for custom exercise without muscles', () => {
  const customEntry = createEntry('custom-empty', 'Свое упражнение без мышц');
  customEntry.exercise = {
    ...customEntry.exercise!,
    is_custom: true,
    muscles: [],
  };

  assert.deepEqual(buildCurrentWorkoutMuscleMapMuscles([customEntry]), {
    primaryMuscles: [],
    secondaryMuscles: [],
  });
});

test('current workout muscle map keeps primary muscles out of secondary list', () => {
  const result = buildCurrentWorkoutMuscleMapMuscles([
    createEntry('standing_barbell_biceps_curl', 'Подъём штанги на бицепс'),
    createEntry('barbell_chin-ups', 'Тяга штанги к подбородку'),
  ]);

  assert.ok(result.primaryMuscles.includes('biceps'));
  assert.equal(result.secondaryMuscles.includes('biceps'), false);
});

test('current workout muscle map keeps custom primary muscles out of secondary list', () => {
  const customEntry = createEntry('custom-primary-secondary', 'Свое упражнение с дублями');
  customEntry.exercise = {
    ...customEntry.exercise!,
    is_custom: true,
    primary_muscles: ['Бицепс'],
    secondary_muscles: ['Бицепс', 'Трицепс'],
    muscles: [],
  };

  const result = buildCurrentWorkoutMuscleMapMuscles([customEntry]);

  assert.deepEqual(result.primaryMuscles, ['biceps']);
  assert.deepEqual(result.secondaryMuscles, ['triceps']);
});

test('current workout muscle map skips unknown exercises safely', () => {
  const result = buildCurrentWorkoutMuscleMapMuscles([
    createEntry('unknown-id', 'Тестовое упражнение'),
  ]);

  assert.deepEqual(result, {
    primaryMuscles: [],
    secondaryMuscles: [],
  });
});

test('current workout muscle map does not pass cardio pseudo muscle to MuscleMap', () => {
  const result = buildCurrentWorkoutMuscleMapMuscles([
    createEntry('treadmill_running', 'Бег на дорожке', 'cardio'),
  ]);

  assert.equal(result.primaryMuscles.includes('cardio'), false);
  assert.equal(result.secondaryMuscles.includes('cardio'), false);
});
