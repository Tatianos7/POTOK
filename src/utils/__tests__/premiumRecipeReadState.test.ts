import assert from 'node:assert/strict';
import test from 'node:test';
import { readPremiumRecipeCatalog } from '../premiumRecipeReadState';

test('catalog success returns only catalog content, including an honest empty collection', async () => {
  const rows = [{ id: 'catalog-recipe' }];
  assert.deepEqual(await readPremiumRecipeCatalog(async () => ({ ok: true, source: 'supabase', data: rows }), []), { status: 'catalog', data: rows });
  assert.deepEqual(await readPremiumRecipeCatalog(async () => ({ ok: true, source: 'supabase', data: [] }), []), { status: 'empty', data: [] });
});

test('failure payloads and rejected reads never expose fallback recipes', async () => {
  assert.deepEqual(await readPremiumRecipeCatalog(async () => ({ ok: false, source: 'fallback', error: 'read_failed', data: ['demo-recipe'] }), []), { status: 'unavailable', data: [] });
  assert.deepEqual(await readPremiumRecipeCatalog(async () => { throw new Error('network error'); }, []), { status: 'unavailable', data: [] });
});

test('missing and unavailable recipe details remain distinct', async () => {
  assert.deepEqual(await readPremiumRecipeCatalog(async () => ({ ok: true, source: 'supabase', data: null }), null), { status: 'empty', data: null });
  assert.deepEqual(await readPremiumRecipeCatalog(async () => ({ ok: false, source: 'fallback', error: 'supabase_unavailable', data: null }), null), { status: 'unavailable', data: null });
});
