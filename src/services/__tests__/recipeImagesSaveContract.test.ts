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

  const result = await recipeImagesService.saveImage('user-1', 'recipe-1', 'data:image/jpeg;base64,abc');

  assert.equal(result.persistence, 'local');
  assert.equal(result.storagePath, null);
  assert.equal(result.displayUrl, 'data:image/jpeg;base64,abc');

  assert.equal(
    await recipeImagesService.getImageByRecipeId('user-1', 'recipe-1'),
    'data:image/jpeg;base64,abc'
  );
  assert.deepEqual(await recipeImagesService.getImagesByRecipeIds('user-1', ['recipe-1', 'recipe-2']), {
    'recipe-1': 'data:image/jpeg;base64,abc',
  });
});

test('recipe image service keeps production storage contract stable', () => {
  const source = readFileSync(resolve(currentDir, '../recipeImagesService.ts'), 'utf8');

  assert.match(source, /const RECIPE_PHOTOS_BUCKET = 'recipe-photos'/);
  assert.match(source, /return `user\/\$\{userId\}\/recipes\/\$\{recipeId\}\/cover\.jpg`/);
  assert.match(source, /\.from\(RECIPE_PHOTOS_BUCKET\)[\s\S]*\.upload\(storagePath,\s*blob,\s*{[\s\S]*upsert: true/);
  assert.match(source, /\.from\(RECIPE_PHOTOS_BUCKET\)[\s\S]*\.createSignedUrl\(storagePath,\s*SIGNED_URL_TTL_SECONDS\)/);
  assert.match(source, /\.from\('recipes'\)[\s\S]*\.update\({ image: storagePath }\)/);
  assert.equal(source.includes('update({ image: storagePath, updated_at'), false);
});

test('RecipeDetails photo replacement uses image service, not recipe save/update path', () => {
  const source = readFileSync(resolve(currentDir, '../../pages/RecipeDetails.tsx'), 'utf8');
  const handleFileChangeStart = source.indexOf('const handleFileChange');
  const handleMealTypeStart = source.indexOf('const handleMealTypeSelected', handleFileChangeStart);
  const handleFileChangeSource = source.slice(handleFileChangeStart, handleMealTypeStart);

  assert.notEqual(handleFileChangeStart, -1);
  assert.match(handleFileChangeSource, /recipeImagesService\.readFileAsDataUrl\(file\)/);
  assert.match(handleFileChangeSource, /const result = await recipeImagesService\.saveImage\(user\.id,\s*recipe\.id,\s*imageDataUrl\)/);
  assert.match(handleFileChangeSource, /setRecipe\({ \.\.\.recipe,\s*image: result\.displayUrl }\)/);
  assert.equal(handleFileChangeSource.includes('recipesService.saveRecipe'), false);
});

test('RecipeAnalyzer saves selected photo after recipe creation succeeds', () => {
  const source = readFileSync(resolve(currentDir, '../../pages/RecipeAnalyzer.tsx'), 'utf8');

  assert.match(source, /const savedRecipe = await recipesService\.createRecipeFromAnalyzer/);
  assert.match(source, /recipeImagesService\.saveImage\(user\.id,\s*savedRecipe\.id,\s*recipeImage\)/);
});

test('recipe cards render only resolved image URLs, never raw storage paths', () => {
  const gridSource = readFileSync(resolve(currentDir, '../../components/RecipesGrid.tsx'), 'utf8');
  const listSource = readFileSync(resolve(currentDir, '../../components/RecipesList.tsx'), 'utf8');

  assert.match(gridSource, /recipeImagesService\.getImagesByRecipeIds/);
  assert.match(gridSource, /paths\[recipe\.id\] = recipe\.image/);
  assert.match(gridSource, /const image = recipeImages\[recipe\.id\] \?\? null/);
  assert.equal(gridSource.includes('?? recipe.image'), false);
  assert.match(listSource, /recipeImagesService\.getImagesByRecipeIds/);
  assert.match(listSource, /paths\[recipe\.id\] = recipe\.image/);
  assert.match(listSource, /const image = recipeImages\[recipe\.id\] \?\? null/);
  assert.equal(listSource.includes('?? recipe.image'), false);
});

test('RecipeDetails does not render raw recipe image storage path if signing fails', () => {
  const source = readFileSync(resolve(currentDir, '../../pages/RecipeDetails.tsx'), 'utf8');
  const loadRecipeStart = source.indexOf('const loadRecipe = async () =>');
  const macrosStart = source.indexOf('// Вычисляем КБЖУ', loadRecipeStart);
  const loadRecipeSource = source.slice(loadRecipeStart, macrosStart);

  assert.notEqual(loadRecipeStart, -1);
  assert.match(loadRecipeSource, /recipeImagesService\.getImageByRecipeId\(user\.id,\s*id,\s*loadedRecipe\.image\)/);
  assert.match(loadRecipeSource, /setRecipe\({ \.\.\.loadedRecipe,\s*image: displayImage \?\? null }\)/);
  assert.equal(loadRecipeSource.includes('displayImage ?? loadedRecipe.image'), false);
});
