import test from 'node:test';
import assert from 'node:assert/strict';

import { lookupExerciseContent, normalizeExerciseName } from '../exerciseContentLookup';

test('normalizeExerciseName removes noisy punctuation and normalizes spacing', () => {
  assert.equal(
    normalizeExerciseName('Подъёмы на грудь (Push Press) со штангой'),
    'подъемы на грудь push press со штангой',
  );
});

test('lookupExerciseContent resolves requested shoulder exercise variants', () => {
  const cases = [
    ['Жим штанги стоя', 'standing_barbell_press'],
    ['Тяга к подбородку в тренажёре', 'machine_chin-ups'],
    ['Тяга штанги к подбородку', 'barbell_chin-ups'],
    ['Разведение гантелей в стороны', 'dumbbell_lateral_raises'],
    ['Разведение гантелей в наклоне', 'bent-over_dumbbell_flyes'],
    ['Жим штанги за голову', 'barbell_overhead_press'],
    ['Изолированный подъём рук в тренажёре (махи в стороны)', 'Isolated_arm_raises_on_a_machine'],
    ['Подъёмы на грудь (Push Press) со штангой', 'push_press_with_a_barbell'],
    ['Подъёмы на грудь (Push Press) с гантелями', 'push_press_with_a_barbell'],
    ['Армейский жим с гирей (одной рукой)', 'military_press_with_a_kettlebell'],
  ] as const;

  cases.forEach(([exerciseName, expectedId]) => {
    const content = lookupExerciseContent({ exerciseName });
    assert.ok(content, `Expected content for ${exerciseName}`);
    assert.equal(content.exercise_id, expectedId);
  });
});
