import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';

import { getExerciseContentForExercise } from '../exerciseContentLookup';
import { exerciseContentMap } from '../../data/exerciseContent';

test('getExerciseContentForExercise resolves content by canonical exercise id', () => {
  const result = getExerciseContentForExercise({
    id: '4f34b013-2045-4be0-a6b1-8cf4aa96a111',
    canonical_exercise_id: 'machine_biceps_curl',
    name: 'Сгибание рук в тренажёре на бицепс',
  });

  assert.equal(result?.exercise_id, 'machine_biceps_curl');
  assert.equal(result?.technique_image_url, '/exercises/arms/machine_biceps_curl.png');
});

test('getExerciseContentForExercise falls back to normalized exercise name when id is uuid', () => {
  const result = getExerciseContentForExercise({
    id: '9f5df7c2-e65f-43de-b4b5-0663ced9213f',
    name: 'Подтягивания обратным хватом (узкие или средние)',
  });

  assert.equal(result?.exercise_id, 'chin_ups_underhand');
  assert.equal(result?.technique_image_url, '/exercises/arms/chin_ups_underhand.png');
});

test('getExerciseContentForExercise resolves nested workout-like exercise payloads', () => {
  const result = getExerciseContentForExercise({
    exercise_id: '8b4e5f60-d5f3-42e3-9f19-a9eb4ee89d3d',
    exercise: {
      canonical_exercise_id: 'overhead_cable_triceps_extension',
      name: 'Разгибание рук в блоке сверху («пуловер на трицепс»)',
    },
  });

  assert.equal(result?.exercise_id, 'overhead_cable_triceps_extension');
  assert.equal(result?.technique_image_url, '/exercises/arms/overhead_cable_triceps_extension.png');
});

test('getExerciseContentForExercise resolves close grip bench press by short runtime name', () => {
  const result = getExerciseContentForExercise({
    id: '4dc4f0d9-2b4a-4d80-b8b8-6c2bd503c712',
    name: 'Жим лёжа узким хватом',
  });

  assert.equal(result?.exercise_id, 'close_grip_bench_press');
  assert.equal(result?.technique_image_url, '/exercises/arms/close_grip_bench_press.png');
});

test('getExerciseContentForExercise resolves chest content by uuid plus runtime name', () => {
  const result = getExerciseContentForExercise({
    id: 'f2d6c873-45e7-4b63-a582-dc44f56d5f0b',
    name: 'Отжимания от пола',
  });

  assert.equal(result?.exercise_id, 'pushups_classic');
  assert.equal(result?.technique_image_url, '/exercises/chest/pushups_classic.png');
});

test('getExerciseContentForExercise resolves legacy ring pushups by uuid plus short runtime name', () => {
  const result = getExerciseContentForExercise({
    id: '7f2f1f9b-2c33-4dc4-8a72-222222222222',
    name: 'Отжимания на кольцах',
  });

  assert.equal(result?.exercise_id, 'ring_pushups');
  assert.equal(result?.technique_image_url, '/exercises/chest/ring_pushups.png');
});

test('getExerciseContentForExercise resolves back content by uuid plus runtime names', () => {
  const cases = [
    ['Тяга штанги в наклоне', 'barbell_row'],
    ['Становая тяга (классическая)', 'deadlift_classic'],
    ['Румынская становая тяга', 'romanian_deadlift'],
    ['Горизонтальная тяга сидя (Seated Cable Row)', 'seated_cable_row'],
    ['Тяга верхнего блока к груди', 'upper_block_row_to_chest'],
    ['Подтягивания широким хватом', 'pull_ups_wide_grip'],
    ['Подтягивания средним хватом', 'pull_ups_medium_grip'],
    ['Подтягивания обратным хватом («chin-ups»)', 'chin_ups_underhand_back'],
    ['Тяга в тренажёре «Горка» (Inverted Row Machine)', 'inverted_row_machine'],
  ] as const;

  for (const [name, expectedId] of cases) {
    const result = getExerciseContentForExercise({
      id: '9c2fbe56-09de-49da-85c4-333333333333',
      name,
    });

    assert.equal(result?.exercise_id, expectedId, `Expected ${expectedId} for "${name}"`);
    assert.equal(result?.technique_image_url, `/exercises/back/${expectedId}.png`);
  }
});

test('getExerciseContentForExercise resolves legacy wide grip lat pulldown runtime name', () => {
  const result = getExerciseContentForExercise({
    id: 'd7703651-1111-4444-9999-aaaaaaaaaaaa',
    name: 'Вертикальная тяга широким хватом',
  });

  assert.equal(result?.exercise_id, 'lat_pulldown_wide_grip');
  assert.equal(result?.technique_image_url, '/exercises/back/lat_pulldown_wide_grip.png');
});

test('getExerciseContentForExercise resolves legacy close grip lat pulldown runtime name', () => {
  const result = getExerciseContentForExercise({
    id: 'a2777345-1111-4444-9999-bbbbbbbbbbbb',
    name: 'Вертикальная тяга узким хватом',
  });

  assert.equal(result?.exercise_id, 'lat_pulldown_close_or_underhand');
  assert.equal(result?.technique_image_url, '/exercises/back/lat_pulldown_close_or_underhand.png');
});

test('getExerciseContentForExercise resolves plain hyperextension to bench or ball hyperextension', () => {
  const result = getExerciseContentForExercise({
    id: 'bf2b4035-1111-4444-9999-cccccccccccc',
    name: 'Гиперэкстензия',
  });

  assert.equal(result?.exercise_id, 'bench_or_ball_hyperextension');
  assert.equal(result?.technique_image_url, '/exercises/back/bench_or_ball_hyperextension.png');
});

test('getExerciseContentForExercise resolves machine hyperextension by runtime name', () => {
  const result = getExerciseContentForExercise({
    id: 'bf2b4035-1111-4444-9999-dddddddddddd',
    name: 'Гиперэкстензия в тренажёре',
  });

  assert.equal(result?.exercise_id, 'machine_hyperextension');
  assert.equal(result?.technique_image_url, '/exercises/back/machine_hyperextension.png');
});

test('getExerciseContentForExercise keeps reverse hyperextension separate from regular hyperextension', () => {
  const result = getExerciseContentForExercise({
    id: 'bf2b4035-1111-4444-9999-eeeeeeeeeeee',
    name: 'Обратная гиперэкстензия',
  });

  assert.equal(result?.exercise_id, 'reverse_hyperextension');
  assert.notEqual(result?.exercise_id, 'bench_or_ball_hyperextension');
});

test('getExerciseContentForExercise resolves legs content by uuid plus runtime names', () => {
  const cases = [
    ['Степ-апы', 'stairs_or_stepups'],
    ['Степ ап', 'stairs_or_stepups'],
    ['Ягодичный мост', 'glute_bridge'],
    ['Мостик', 'glute_bridge'],
    ['Мостик одной ногой', 'single_leg_glute_bridge'],
    ['Подъёмы на носки у стены', 'wall_calf_raise'],
    ['Подъемы на носки', 'calf_raise_variations'],
    ['Подъемы на носки стоя', 'calf_raise_variations'],
    ['Подъёмы на носки сидя', 'calf_raise_variations'],
    ['Приседания', 'bodyweight_squat'],
    ['Приседания классические', 'bodyweight_squat'],
    ['Приседания с гантелью', 'goblet_squat'],
    ['Приседания с гантелью у груди', 'goblet_squat'],
    ['Болгарские приседания', 'dumbbell_bulgarian_split_squat'],
    ['Болгарские сплит приседания', 'dumbbell_bulgarian_split_squat'],
    ['Выпады', 'bodyweight_lunges'],
    ['Выпады вперед', 'bodyweight_lunges'],
    ['Выпады назад', 'bodyweight_lunges'],
    ['Боковые выпады', 'side_lunge'],
    ['Прыжки в приседе', 'jump_squat'],
    ['Стульчик', 'wall_sit'],
    ['Стульчик у стены', 'wall_sit'],
    ['Отведение ног в стороны', 'machine_hip_abduction'],
    ['Приведение ног', 'machine_hip_adduction'],
    ['Отведение ног назад в тренажере', 'machine_leg_kickback'],
    ['Отведение ноги назад в тренажёре', 'machine_glute_kickback'],
    ['Становая тяга на одной ноге', 'single_leg_rdl'],
  ] as const;

  for (const [name, expectedId] of cases) {
    const result = getExerciseContentForExercise({
      id: '11111111-2222-4333-8444-555555555555',
      name,
    });

    assert.equal(result?.exercise_id, expectedId, `Expected ${expectedId} for "${name}"`);
  }
});

test('all chest exercise images exist and match canonical public path', () => {
  const chestExercises = Object.values(exerciseContentMap).filter((exercise) => exercise.category === 'chest');

  assert.ok(chestExercises.length > 0);

  for (const exercise of chestExercises) {
    assert.equal(
      exercise.technique_image_url,
      `/exercises/chest/${exercise.exercise_id}.png`,
      `Unexpected technique_image_url for ${exercise.exercise_id}`,
    );

    const absoluteImagePath = path.resolve(
      process.cwd(),
      'public',
      exercise.technique_image_url.replace(/^\//, ''),
    );

    assert.ok(
      fs.existsSync(absoluteImagePath),
      `Missing chest image file for ${exercise.exercise_id}: ${absoluteImagePath}`,
    );
  }
});

test('all back exercise images exist and match canonical public path', () => {
  const backExercises = Object.values(exerciseContentMap).filter((exercise) => exercise.category === 'back');

  assert.ok(backExercises.length > 0);

  for (const exercise of backExercises) {
    assert.equal(
      exercise.technique_image_url,
      `/exercises/back/${exercise.exercise_id}.png`,
      `Unexpected technique_image_url for ${exercise.exercise_id}`,
    );

    const absoluteImagePath = path.resolve(
      process.cwd(),
      'public',
      exercise.technique_image_url.replace(/^\//, ''),
    );

    assert.ok(
      fs.existsSync(absoluteImagePath),
      `Missing back image file for ${exercise.exercise_id}: ${absoluteImagePath}`,
    );
  }
});
