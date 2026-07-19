import test from 'node:test';
import assert from 'node:assert/strict';

import { runCombinedRecipeSave } from '../recipeCombinedSave';

test('combined recipe save skips diary when recipe save fails', async () => {
  let diaryCalled = false;

  const result = await runCombinedRecipeSave({
    saveRecipe: async () => {
      throw new Error('recipe_failed');
    },
    saveDiary: async () => {
      diaryCalled = true;
      return 'diary';
    },
  });

  assert.equal(result.recipe.status, 'rejected');
  assert.equal(result.diary.status, 'rejected');
  assert.equal(diaryCalled, false);
});

test('combined recipe save reports recipe success when diary save fails later', async () => {
  const result = await runCombinedRecipeSave({
    saveRecipe: async () => 'recipe',
    saveDiary: async () => {
      throw new Error('diary_failed');
    },
  });

  assert.equal(result.recipe.status, 'fulfilled');
  assert.equal(result.recipe.value, 'recipe');
  assert.equal(result.diary.status, 'rejected');
});
