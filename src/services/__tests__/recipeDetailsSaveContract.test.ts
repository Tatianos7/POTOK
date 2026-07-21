import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const currentDir = dirname(fileURLToPath(import.meta.url));

test('RecipeDetails save preserves loaded updatedAt for conflict check', () => {
  const source = readFileSync(resolve(currentDir, '../../pages/RecipeDetails.tsx'), 'utf8');
  const saveButtonStart = source.indexOf('Сохраняем текущее состояние рецепта со всеми изменениями');
  const saveCallIndex = source.indexOf('recipesService.saveRecipe(updatedRecipe)', saveButtonStart);
  const saveBlockSource = source.slice(saveButtonStart, saveCallIndex);

  assert.notEqual(saveButtonStart, -1);
  assert.notEqual(saveCallIndex, -1);
  assert.equal(saveBlockSource.includes('updatedAt: new Date().toISOString()'), false);
  assert.match(saveBlockSource, /const updatedRecipe: Recipe = {\s*\.\.\.recipe,\s*}/s);
});
