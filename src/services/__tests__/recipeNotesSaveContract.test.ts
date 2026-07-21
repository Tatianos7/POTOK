import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const currentDir = dirname(fileURLToPath(import.meta.url));

test('createRecipeFromMeal persists modal note through recipeNotesService', () => {
  const source = readFileSync(resolve(currentDir, '../recipesService.ts'), 'utf8');

  assert.match(source, /recipeNotesService\.saveNote\(data\.userId,\s*savedRecipe\.id,\s*data\.note\)/);
});

test('createRecipeFromMeal does not fail already-created recipe when optional note save fails', () => {
  const source = readFileSync(resolve(currentDir, '../recipesService.ts'), 'utf8');
  const createFromMealStart = source.indexOf('async createRecipeFromMeal');
  const createFromAnalyzerStart = source.indexOf('async createRecipeFromAnalyzer', createFromMealStart);
  const createFromMealSource = source.slice(createFromMealStart, createFromAnalyzerStart);

  assert.notEqual(createFromMealStart, -1);
  assert.match(createFromMealSource, /const savedRecipe = await this\.saveRecipe\(recipe\)/);
  assert.match(createFromMealSource, /try\s*{\s*await recipeNotesService\.saveNote\(data\.userId,\s*savedRecipe\.id,\s*data\.note\)/s);
  assert.match(createFromMealSource, /console\.warn\('\[recipesService\] Recipe saved, but note persistence failed:'/);
  assert.match(createFromMealSource, /return savedRecipe/);
});

test('recipeNotesService uses Supabase upsert as production write path', () => {
  const source = readFileSync(resolve(currentDir, '../recipeNotesService.ts'), 'utf8');
  const saveNoteStart = source.indexOf('async saveNote');
  const upsertIndex = source.indexOf('.upsert(', saveNoteStart);
  const conflictIndex = source.indexOf("onConflict: 'user_id,recipe_id'", saveNoteStart);
  const tableCheckIndex = source.indexOf('const tableExists = await this.checkTableExists();', saveNoteStart);

  assert.notEqual(saveNoteStart, -1);
  assert.notEqual(upsertIndex, -1);
  assert.notEqual(conflictIndex, -1);
  assert.notEqual(tableCheckIndex, -1);
  assert.equal(tableCheckIndex < upsertIndex, true);
});

test('recipeNotesService reads optional note with maybeSingle to avoid 406 on missing row', () => {
  const source = readFileSync(resolve(currentDir, '../recipeNotesService.ts'), 'utf8');
  const getNoteStart = source.indexOf('async getNoteByRecipeId');
  const getNotesStart = source.indexOf('async getNotesByRecipeIds', getNoteStart);
  const getNoteSource = source.slice(getNoteStart, getNotesStart);

  assert.notEqual(getNoteStart, -1);
  assert.match(getNoteSource, /\.maybeSingle\(\)/);
  assert.equal(getNoteSource.includes('.single()'), false);
});

test('recipeNotesService does not decide insert/update from local fallback state', () => {
  const source = readFileSync(resolve(currentDir, '../recipeNotesService.ts'), 'utf8');
  const saveNoteStart = source.indexOf('async saveNote');
  const deleteNoteStart = source.indexOf('async deleteNote', saveNoteStart);
  const saveNoteSource = source.slice(saveNoteStart, deleteNoteStart);

  assert.equal(saveNoteSource.includes('const existingNote = await this.getNoteByRecipeId'), false);
  assert.equal(saveNoteSource.includes('.update({'), false);
  assert.equal(saveNoteSource.includes('.insert({'), false);
});
