import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

import { recipeImagesService } from '../recipeImagesService.ts';

const currentDir = dirname(fileURLToPath(import.meta.url));

function installLocalStorageMock() {
  const storage = new Map<string, string>();
  Object.defineProperty(globalThis, 'localStorage', {
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
    configurable: true,
  });
}

test('recipe image service saves and reads recipe image fallback by recipe id', async () => {
  installLocalStorageMock();

  await recipeImagesService.saveImage('user-1', 'recipe-1', 'data:image/jpeg;base64,abc');

  assert.equal(
    await recipeImagesService.getImageByRecipeId('user-1', 'recipe-1'),
    'data:image/jpeg;base64,abc'
  );
  assert.deepEqual(await recipeImagesService.getImagesByRecipeIds('user-1', ['recipe-1', 'recipe-2']), {
    'recipe-1': 'data:image/jpeg;base64,abc',
  });
});

test('RecipeDetails photo replacement uses image service, not recipe save/update path', () => {
  const source = readFileSync(resolve(currentDir, '../../pages/RecipeDetails.tsx'), 'utf8');
  const handleFileChangeStart = source.indexOf('const handleFileChange');
  const handleMealTypeStart = source.indexOf('const handleMealTypeSelected', handleFileChangeStart);
  const handleFileChangeSource = source.slice(handleFileChangeStart, handleMealTypeStart);

  assert.notEqual(handleFileChangeStart, -1);
  assert.match(handleFileChangeSource, /recipeImagesService\.readFileAsDataUrl\(file\)/);
  assert.match(handleFileChangeSource, /recipeImagesService\.saveImage\(user\.id,\s*recipe\.id,\s*imageDataUrl\)/);
  assert.equal(handleFileChangeSource.includes('recipesService.saveRecipe'), false);
});

test('RecipeAnalyzer saves selected photo after recipe creation succeeds', () => {
  const source = readFileSync(resolve(currentDir, '../../pages/RecipeAnalyzer.tsx'), 'utf8');

  assert.match(source, /const savedRecipe = await recipesService\.createRecipeFromAnalyzer/);
  assert.match(source, /recipeImagesService\.saveImage\(user\.id,\s*savedRecipe\.id,\s*recipeImage\)/);
});

test('recipe cards use image fallback service for rendered thumbnails', () => {
  const gridSource = readFileSync(resolve(currentDir, '../../components/RecipesGrid.tsx'), 'utf8');
  const listSource = readFileSync(resolve(currentDir, '../../components/RecipesList.tsx'), 'utf8');

  assert.match(gridSource, /recipeImagesService\.getImagesByRecipeIds/);
  assert.match(gridSource, /const image = recipeImages\[recipe\.id\] \?\? recipe\.image/);
  assert.match(listSource, /recipeImagesService\.getImagesByRecipeIds/);
  assert.match(listSource, /const image = recipeImages\[recipe\.id\] \?\? recipe\.image/);
});
