import test from 'node:test';
import assert from 'node:assert/strict';

import { runMyExercisesAction } from '../ExerciseCategorySheet';

test('МОИ УПРАЖНЕНИЯ triggers browse action, not create shortcut', () => {
  let browseCalled = 0;

  runMyExercisesAction(() => {
    browseCalled += 1;
  });

  assert.equal(browseCalled, 1);
});
