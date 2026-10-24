import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';
import vm from 'node:vm';
import ts from 'typescript';

const source = readFileSync(new URL('../../src/services/foodIngestionService.ts', import.meta.url), 'utf8');
const compiled = ts.transpileModule(source, {
  compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020 },
}).outputText;

test('catalog import advances nutrition version without rewriting historical diary snapshots', async () => {
  const snapshot = { calories: 101, protein: 3, fat: 2, carbs: 16, fiber: 1 };
  const before = structuredClone(snapshot);
  const writes = [];
  const rpcCalls = [];
  const outdated = [];
  const staged = {
    name: 'Test food', normalized_name: 'test_food', normalized_brand: '',
    calories: 200, protein: 10, fat: 5, carbs: 25, fiber: 2,
  };
  const client = {
    auth: { getUser: async () => ({ data: { user: { id: 'A' } }, error: null }) },
    rpc(name) {
      rpcCalls.push(name);
      assert.fail(`Import must not invoke RPC ${name}`);
    },
    from(table) {
      let operation = 'select';
      let payload;
      const query = {
        select() { return query; },
        eq() { return query; },
        in() { return query; },
        limit() { return query; },
        upsert(value) { operation = 'upsert'; payload = value; return query; },
        update(value) { operation = 'update'; payload = value; return query; },
        then(resolve, reject) {
          return Promise.resolve().then(() => {
            if (operation !== 'select') {
              assert.ok(['foods', 'food_aliases', 'food_import_batches'].includes(table), `Unexpected write: ${table}`);
              writes.push({ table, operation, payload });
            }
            if (table === 'food_import_staging') return { data: [staged], error: null };
            if (table === 'foods' && operation === 'select') {
              return { data: [{ id: 'food', normalized_name: 'test_food', normalized_brand: '', nutrition_version: 2 }], error: null };
            }
            if (table === 'foods') return { data: [{ id: 'food', name: 'Test food', nutrition_version: 3 }], error: null };
            if (table === 'food_diary_entries') return { data: [{ date: '2026-10-20' }, { date: '2026-10-20' }], error: null };
            return { data: null, error: null };
          }).then(resolve, reject);
        },
      };
      return query;
    },
  };
  const exports = {};
  vm.runInNewContext(compiled, {
    exports, Error, console,
    require(name) {
      if (name === '../lib/supabaseClient') return { supabase: client };
      if (name === '../utils/foodImportPipeline' || name === '../utils/foodNormalizer') return {};
      if (name === './aiRecommendationsService') return {
        aiRecommendationsService: { markDayRecommendationOutdated: async (...args) => { outdated.push(args); } },
      };
      throw new Error(`Unexpected dependency: ${name}`);
    },
  }, { filename: 'foodIngestionService.cjs' });
  const result = await exports.foodIngestionService.commitBatch('batch');
  assert.equal(result.inserted, 1);
  assert.deepEqual(rpcCalls, []);
  assert.equal(writes.find(w => w.table === 'foods').payload[0].nutrition_version, 3);
  assert.equal(writes.find(w => w.table === 'food_import_batches').payload.status, 'committed');
  assert.deepEqual(snapshot, before);
  assert.deepEqual(outdated, [['A', '2026-10-20']]);
});
