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

test('recipeNotesService does not decide insert/update from local fallback state', () => {
  const source = readFileSync(resolve(currentDir, '../recipeNotesService.ts'), 'utf8');
  const saveNoteStart = source.indexOf('async saveNote');
  const deleteNoteStart = source.indexOf('async deleteNote', saveNoteStart);
  const saveNoteSource = source.slice(saveNoteStart, deleteNoteStart);

  assert.equal(saveNoteSource.includes('const existingNote = await this.getNoteByRecipeId'), false);
  assert.equal(saveNoteSource.includes('.update({'), false);
  assert.equal(saveNoteSource.includes('.insert({'), false);
});
