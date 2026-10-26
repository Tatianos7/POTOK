import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import test from 'node:test';
import vm from 'node:vm';

// Diagnostic baseline: these assertions reproduce OPEN findings, not release approval.
// No network, database, real accounts, credentials or application initialization.
const {default: ts} = await import(process.env.POTOK_AUDIT_TYPESCRIPT_MODULE || 'typescript');
function load(file, name, client) {
  const source = readFileSync(new URL('../../../src/services/' + file, import.meta.url), 'utf8');
  const compiled = ts.transpileModule(source, {compilerOptions: {
    target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.CommonJS,
  }}).outputText;
  const exports = {};
  vm.runInNewContext(compiled, {exports, console, require(id) {
    assert.equal(id, '../lib/supabaseClient', 'Unexpected dependency; review audit scope');
    return {supabase: null};
  }}, {filename: file + '.audit.cjs'});
  return new exports[name](client);
}
function fixture(payload) {
  let account = 'A';
  const calls = [];
  const client = {
    auth: {getUser: async () => ({data: {user: {id: account}}, error: null})},
    rpc: async (name, args) => {
      calls.push({name, args});
      if (name === 'has_verified_entitlement_v1') return {data: false, error: null};
      if (name === 'get_entitlements') return {data: payload, error: null};
      if (name === 'get_paywall_state') return {data: {locked: true, reason: 'spatial_locked'}, error: null};
      assert.fail('Unreviewed RPC: ' + name);
    },
  };
  return {client, calls, switchTo: id => {account = id;},
    legacy: load('entitlementService.ts', 'EntitlementService', client),
    verified: load('adminAccessService.ts', 'AdminAccessService', client)};
}

test('OPEN: legacy pro tier permits pose while verified Premium and spatial paywall deny', async () => {
  const f = fixture({tier: 'pro', flags: {can_spatial: false, can_voice: false}});
  assert.equal((await f.verified.getVerifiedCurrentUserCapabilities('A')).premium, false);
  assert.equal((await f.legacy.getPaywallState('spatial', 'A')).locked, true);
  assert.equal((await f.legacy.canRealtimePose('A')).allowed, true);
});

test('OPEN: voice flag alone enables spatial/pose despite free tier and false spatial flag', async () => {
  const f = fixture({tier: 'free', flags: {can_voice: true, can_spatial: false}});
  assert.equal((await f.legacy.canRealtimePose('A')).allowed, true);
  assert.equal(f.calls.some(c => c.name === 'has_verified_entitlement_v1'), false);
});

test('OPEN: legacy adaptation/explanation flags permit while verified Premium denies', async () => {
  const f = fixture({tier: 'pro', flags: {can_adapt: true, can_explain: true}});
  assert.equal((await f.verified.getVerifiedCurrentUserCapabilities('A')).premium, false);
  assert.equal(await f.legacy.canAdaptProgram('A'), true);
  assert.equal(await f.legacy.canExplain('A'), true);
});

test('OPEN: malformed string false is truthy in the unvalidated legacy DTO', async () => {
  const f = fixture({tier: 'free', flags: {can_spatial: 'false', can_adapt: 'false', can_explain: 'false'}});
  assert.equal((await f.legacy.canRealtimePose('A')).allowed, true);
  assert.equal(await f.legacy.canAdaptProgram('A'), true);
  assert.equal(await f.legacy.canExplain('A'), true);
});

test('BOUNDARY: Free plan viewing/generation fallback is existing policy, not proof of paid bypass', async () => {
  const f = fixture({tier: 'free', flags: {}});
  assert.equal(await f.legacy.canGenerateProgram('A'), true);
  assert.equal(await f.legacy.canAdaptProgram('A'), false);
  assert.equal(await f.legacy.canExplain('A'), false);
  assert.equal((await f.legacy.canRealtimePose('A')).allowed, false);
});

test('BOUNDARY: mismatched account and RPC failures already reject rather than grant', async () => {
  const f = fixture({tier: 'pro', flags: {can_adapt: true}});
  f.switchTo('B');
  await assert.rejects(f.legacy.canAdaptProgram('A'), /Пользователь изменился/);
  assert.equal(f.calls.length, 0);
  f.switchTo('A');
  f.client.rpc = async () => ({data: null, error: new Error('synthetic unavailable')});
  await assert.rejects(f.legacy.canAdaptProgram('A'), /synthetic unavailable/);
});

test('OPEN: an A response finishing after switch to B is not rechecked by legacy capability helper', async () => {
  const f = fixture(null);
  let finish;
  let started;
  const entered = new Promise(resolve => {started = resolve;});
  f.client.rpc = async name => {
    assert.equal(name, 'get_entitlements');
    started();
    return new Promise(resolve => {finish = resolve;});
  };
  const pending = f.legacy.canAdaptProgram('A');
  await entered;
  f.switchTo('B');
  finish({data: {tier: 'pro', flags: {can_adapt: true}}, error: null});
  assert.equal(await pending, true);
  // Demonstrates stale client completion, not a server cross-account read or write.
});
