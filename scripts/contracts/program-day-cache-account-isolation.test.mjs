import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';
import vm from 'node:vm';
import ts from 'typescript';

// Execute the actual service with controlled Auth/RPC/storage boundaries.
// No Supabase connection, Vite environment, or dependency side effects.
const source = readFileSync(new URL('../../src/services/programDeliveryService.ts', import.meta.url), 'utf8');
const compiled = ts.transpileModule(source, {
  compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020 },
}).outputText;

function fixture() {
  let account = 'A';
  let authError = null;
  let rpcHandler = async () => ({ data: { marker: 'fresh-A' }, error: null });
  const accesses = [];
  const entries = new Map();
  const key = 'program_delivery_day_A_program_2026-10-24';
  const client = {
    auth: { getUser: async () => ({ data: { user: account ? { id: account } : null }, error: authError }) },
    rpc: (...args) => rpcHandler(...args),
  };
  const exports = {};
  vm.runInNewContext(compiled, {
    exports,
    require(name) {
      if (name === '../lib/supabaseClient') return { supabase: client };
      if (name === './entitlementService') return { entitlementService: {} };
      if (name === './adminAccessService') return { adminAccessService: {} };
      if (name === './programGenerationService') return { programGenerationService: {} };
      throw new Error(`Unexpected dependency: ${name}`);
    },
    localStorage: {
      getItem(k) { accesses.push(['get', k]); return entries.get(k) ?? null; },
      setItem(k, value) { accesses.push(['set', k]); entries.set(k, value); },
      removeItem(k) { accesses.push(['remove', k]); entries.delete(k); },
    },
    // Preserve Error identity so injected network exceptions follow the real catch path.
    Error, console,
  }, { filename: 'programDeliveryService.cjs' });
  return {
    service: exports.programDeliveryService, accesses, entries, key,
    switchAccount(value) { account = value; },
    failAuth(value) { authError = value; },
    onRpc(handler) { rpcHandler = handler; },
  };
}

function deferred() {
  let resolve;
  let reject;
  const promise = new Promise((yes, no) => { resolve = yes; reject = no; });
  return { promise, resolve, reject };
}

async function inFlight(f) {
  const started = deferred();
  const response = deferred();
  f.onRpc(() => { started.resolve(); return response.promise; });
  const result = f.service.getProgramDayDetails('program', '2026-10-24');
  await started.promise;
  return { result, response };
}

test('A request completing after switch to B rejects before returning or caching A data', async () => {
  const f = fixture();
  const { result, response } = await inFlight(f);
  f.switchAccount('B');
  response.resolve({ data: { marker: 'secret-A' }, error: null });
  await assert.rejects(result, /Пользователь изменился/);
  assert.deepEqual(f.accesses, []);
});

test('A network failure after switch to B cannot read cached A data', async () => {
  const f = fixture();
  f.entries.set(f.key, JSON.stringify({ marker: 'cached-A' }));
  const { result, response } = await inFlight(f);
  f.switchAccount('B');
  response.reject(new Error('Failed to fetch'));
  await assert.rejects(result, /Пользователь изменился/);
  assert.deepEqual(f.accesses, []);
});

test('logout or failed Auth during RPC blocks success and offline fallback', async () => {
  for (const offline of [false, true]) {
    for (const failedAuth of [false, true]) {
      const f = fixture();
      f.entries.set(f.key, JSON.stringify({ marker: 'cached-A' }));
      const { result, response } = await inFlight(f);
      if (failedAuth) f.failAuth(new Error('auth unavailable'));
      else f.switchAccount(null);
      if (offline) response.reject(new Error('NetworkError'));
      else response.resolve({ data: { marker: 'secret-A' }, error: null });
      await assert.rejects(result, /не авторизован/);
      assert.deepEqual(f.accesses, []);
    }
  }
});

test('stable A success returns and caches fresh data under A key only', async () => {
  const f = fixture();
  const result = await f.service.getProgramDayDetails('program', '2026-10-24');
  assert.equal(result.marker, 'fresh-A');
  assert.deepEqual(f.accesses, [['set', f.key]]);
  assert.equal(JSON.parse(f.entries.get(f.key)).marker, 'fresh-A');
});

test('stable A network failure may use only its own cache', async () => {
  const f = fixture();
  f.entries.set(f.key, JSON.stringify({ marker: 'cached-A' }));
  f.onRpc(async () => { throw new Error('Network request failed'); });
  assert.equal((await f.service.getProgramDayDetails('program', '2026-10-24')).marker, 'cached-A');
  assert.deepEqual(f.accesses, [['get', f.key]]);
});

test('RPC authorization/server errors cannot be replaced with cached data', async () => {
  for (const error of [{ code: '42501', message: 'permission denied' }, new Error('server rejected')]) {
    const f = fixture();
    f.entries.set(f.key, JSON.stringify({ marker: 'cached-A' }));
    f.onRpc(async () => ({ data: null, error }));
    await assert.rejects(f.service.getProgramDayDetails('program', '2026-10-24'), e => e === error);
    assert.deepEqual(f.accesses, []);
  }
});

test('missing Auth performs neither RPC nor storage access', async () => {
  const f = fixture();
  f.switchAccount(null);
  f.onRpc(() => { assert.fail('RPC must not be called'); });
  await assert.rejects(f.service.getProgramDayDetails('program', '2026-10-24'), /не авторизован/);
  assert.deepEqual(f.accesses, []);
});

test('malformed own-account offline cache is removed and the original network failure propagates', async () => {
  const f = fixture();
  const failure = new Error('Failed to fetch');
  f.entries.set(f.key, '{broken');
  f.onRpc(async () => { throw failure; });
  await assert.rejects(f.service.getProgramDayDetails('program', '2026-10-24'), e => e === failure);
  assert.deepEqual(f.accesses, [['get', f.key], ['remove', f.key]]);
});
