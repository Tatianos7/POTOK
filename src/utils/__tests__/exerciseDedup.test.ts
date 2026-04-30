import test from 'node:test';
import assert from 'node:assert/strict';

import {
  dedupeExercisesForUi,
  getExerciseDedupKey,
  normalizeExerciseDisplayName,
} from '../exerciseDedup';

type ExerciseFixture = {
  id: string;
  name: string;
  exercise_id?: string | null;
  content_id?: string | null;
  canonical_exercise_id?: string | null;
  slug?: string | null;
  key?: string | null;
  user_id?: string | null;
  created_by_user_id?: string | null;
  source?: string | null;
};

test('normalizeExerciseDisplayName normalizes punctuation, brackets and spacing', () => {
  assert.equal(
    normalizeExerciseDisplayName('  Бабочка — "Pec Deck"  '),
    'бабочка pec deck',
  );
});

test('canonical beats legacy duplicate by similar chest exercise name', () => {
  const legacy: ExerciseFixture = {
    id: 'legacy-1',
    name: 'Жим в тренажёре лёжа',
  };

  const canonical: ExerciseFixture = {
    id: 'canonical-1',
    canonical_exercise_id: 'machine_chest_press_flat',
    name: 'Жим в тренажёре лёжа (грудной тренажёр)',
  };

  const result = dedupeExercisesForUi([legacy, canonical]);

  assert.equal(result.length, 1);
  assert.equal(result[0].canonical_exercise_id, 'machine_chest_press_flat');
});

test('user-created exercise is not removed when it matches canonical by name', () => {
  const canonical: ExerciseFixture = {
    id: 'canonical-2',
    canonical_exercise_id: 'pec_deck_fly',
    name: 'Бабочка (машина для сведения рук — Pec Deck)',
  };

  const userExercise: ExerciseFixture = {
    id: 'user-1',
    name: 'Бабочка (Pec Deck)',
    created_by_user_id: 'user-42',
  };

  const result = dedupeExercisesForUi([canonical, userExercise]);

  assert.equal(result.length, 2);
  assert.deepEqual(result.map((item) => item.id), ['canonical-2', 'user-1']);
});

test('UUID is not used as dedup key', () => {
  const uuidValue = '123e4567-e89b-12d3-a456-426614174000';
  const uuidOnly: ExerciseFixture = {
    id: 'uuid-only',
    canonical_exercise_id: uuidValue,
    name: 'Бабочка (Pec Deck)',
  };

  const dedupKey = getExerciseDedupKey(uuidOnly);

  assert.notEqual(dedupKey, uuidValue);
  assert.ok(dedupKey);
});

test('Бабочка variants collapse into one entry', () => {
  const first: ExerciseFixture = {
    id: 'pec-1',
    name: 'Бабочка (Pec Deck)',
  };

  const second: ExerciseFixture = {
    id: 'pec-2',
    name: 'Бабочка (машина для сведения рук — Pec Deck)',
    canonical_exercise_id: 'pec_deck_fly',
  };

  const result = dedupeExercisesForUi([first, second]);

  assert.equal(result.length, 1);
  assert.equal(result[0].canonical_exercise_id, 'pec_deck_fly');
});

test('Жим в тренажёре лёжа variants collapse into one entry', () => {
  const first: ExerciseFixture = {
    id: 'press-1',
    name: 'Жим в тренажёре лёжа',
  };

  const second: ExerciseFixture = {
    id: 'press-2',
    name: 'Жим в тренажёре лёжа (грудной тренажёр)',
    canonical_exercise_id: 'machine_chest_press_flat',
  };

  const result = dedupeExercisesForUi([first, second]);

  assert.equal(result.length, 1);
  assert.equal(result[0].canonical_exercise_id, 'machine_chest_press_flat');
});

test('list order stays stable after dedupe', () => {
  const result = dedupeExercisesForUi<ExerciseFixture>([
    {
      id: 'first',
      canonical_exercise_id: 'pec_deck_fly',
      name: 'Бабочка (машина для сведения рук — Pec Deck)',
    },
    {
      id: 'duplicate',
      name: 'Бабочка (Pec Deck)',
    },
    {
      id: 'third',
      canonical_exercise_id: 'crossover_mid',
      name: 'Кроссовер по центру',
    },
  ]);

  assert.deepEqual(result.map((item) => item.id), ['first', 'third']);
});

test('canonical back exercise beats legacy uuid duplicate when alias points to same content', () => {
  const legacy: ExerciseFixture = {
    id: 'legacy-back-1',
    name: 'Вертикальная тяга широким хватом',
  };

  const canonical: ExerciseFixture = {
    id: 'canonical-back-1',
    canonical_exercise_id: 'lat_pulldown_wide_grip',
    name: 'Тяга верхнего блока широким хватом',
  };

  const result = dedupeExercisesForUi([legacy, canonical]);

  assert.equal(result.length, 1);
  assert.equal(result[0].canonical_exercise_id, 'lat_pulldown_wide_grip');
});
