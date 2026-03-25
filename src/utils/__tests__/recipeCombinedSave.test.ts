import test from 'node:test';
import assert from 'node:assert/strict';

import { runCombinedRecipeSave } from '../recipeCombinedSave';

test('both operations succeed -> full success', async () => {
  const result = await runCombinedRecipeSave({
    saveRecipe: async () => 'recipe-1',
    saveDiary: async () => 'entry-1',
  });

  assert.deepEqual(result, {
    recipe: { status: 'fulfilled', value: 'recipe-1' },
    diary: { status: 'fulfilled', value: 'entry-1' },
  });
});

test('recipe save succeeds and diary save fails -> partial success reported correctly', async () => {
  const result = await runCombinedRecipeSave({
    saveRecipe: async () => 'recipe-1',
    saveDiary: async () => {
      throw new Error('diary failed');
    },
  });

  assert.equal(result.recipe.status, 'fulfilled');
  assert.equal(result.recipe.value, 'recipe-1');
  assert.equal(result.diary.status, 'rejected');
  assert.match(String(result.diary.reason), /diary failed/);
});

test('diary save succeeds and recipe save fails -> partial success reported correctly', async () => {
  const result = await runCombinedRecipeSave({
    saveRecipe: async () => {
      throw new Error('recipe failed');
    },
    saveDiary: async () => 'entry-1',
  });

  assert.equal(result.recipe.status, 'rejected');
  assert.match(String(result.recipe.reason), /recipe failed/);
  assert.equal(result.diary.status, 'fulfilled');
  assert.equal(result.diary.value, 'entry-1');
});

test('both fail -> error state', async () => {
  const result = await runCombinedRecipeSave({
    saveRecipe: async () => {
      throw new Error('recipe failed');
    },
    saveDiary: async () => {
      throw new Error('diary failed');
    },
  });

  assert.equal(result.recipe.status, 'rejected');
  assert.equal(result.diary.status, 'rejected');
  assert.match(String(result.recipe.reason), /recipe failed/);
  assert.match(String(result.diary.reason), /diary failed/);
});

