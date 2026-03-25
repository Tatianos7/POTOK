import test from 'node:test';
import assert from 'node:assert/strict';

import {
  clearOptionalSupabaseResourceState,
  getOptionalSupabaseResourceState,
  isOptionalSupabaseResourceMissingError,
  setOptionalSupabaseResourceState,
} from '../optionalSupabaseResource';

test('detects missing optional supabase resource errors', () => {
  assert.equal(isOptionalSupabaseResourceMissingError({ code: 'PGRST205' }), true);
  assert.equal(isOptionalSupabaseResourceMissingError({ code: 'PGRST204' }), true);
  assert.equal(isOptionalSupabaseResourceMissingError({ message: 'HTTP 404 Not Found' }), true);
  assert.equal(isOptionalSupabaseResourceMissingError({ code: '23505' }), false);
});

test('stores and clears optional supabase resource state', () => {
  clearOptionalSupabaseResourceState('recipe_notes');
  assert.equal(getOptionalSupabaseResourceState('recipe_notes'), null);

  setOptionalSupabaseResourceState('recipe_notes', 'missing');
  assert.equal(getOptionalSupabaseResourceState('recipe_notes'), 'missing');

  clearOptionalSupabaseResourceState('recipe_notes');
  assert.equal(getOptionalSupabaseResourceState('recipe_notes'), null);
});

