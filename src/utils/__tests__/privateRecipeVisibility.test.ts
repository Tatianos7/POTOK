import assert from 'node:assert/strict';
import test from 'node:test';
import type { Recipe } from '../../types/recipe';
import { visiblePrivateRecipes } from '../privateRecipeVisibility';

const recipe = (id: string, userId?: string, source: Recipe['source'] = 'manual'): Recipe => ({
  id, userId, source, name: id, createdAt: '', updatedAt: '',
});

test('Free recipes show only current users private content, never shared or unknown-owner rows', () => {
  const rows = [recipe('own', 'A'), recipe('foreign', 'B'), recipe('unknown'), recipe('catalog', 'A', 'default')];
  assert.deepEqual(visiblePrivateRecipes(rows, 'A').map((row) => row.id), ['own']);
  assert.deepEqual(visiblePrivateRecipes(rows, 'B').map((row) => row.id), ['foreign']);
  assert.equal(rows.length, 4);
});

test('account switch and logout hide old rows immediately without waiting for a new request', () => {
  const oldRows = [recipe('old', 'A')];
  assert.deepEqual(visiblePrivateRecipes(oldRows, 'B'), []);
  assert.deepEqual(visiblePrivateRecipes(oldRows, undefined), []);
  assert.deepEqual(visiblePrivateRecipes(oldRows, ''), []);
});
