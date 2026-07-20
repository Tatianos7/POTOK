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

test('recipeNotesService writes local fallback before Supabase table check', () => {
  const source = readFileSync(resolve(currentDir, '../recipeNotesService.ts'), 'utf8');
  const saveNoteStart = source.indexOf('async saveNote');
  const saveLocalIndex = source.indexOf('this.saveLocalStorageNotes(userId, localNotes);', saveNoteStart);
  const tableCheckIndex = source.indexOf('const tableExists = await this.checkTableExists();', saveNoteStart);

  assert.notEqual(saveNoteStart, -1);
  assert.notEqual(saveLocalIndex, -1);
  assert.notEqual(tableCheckIndex, -1);
  assert.equal(saveLocalIndex < tableCheckIndex, true);
});
