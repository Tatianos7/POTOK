import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import test from 'node:test';
import vm from 'node:vm';

// Client containment regressions. Server write-path authorization remains a separate release gate.
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
function fixture(payload, premium = false) {
  let account = 'A';
  const calls = [];
  const client = {
    auth: {getUser: async () => ({data: {user: {id: account}}, error: null})},
    rpc: async (name, args) => {
      calls.push({name, args});
      if (name === 'has_verified_entitlement_v1') return {data: args.p_capability === 'premium' ? premium : false, error: null};
      if (name === 'get_entitlements') return {data: payload, error: null};
      if (name === 'get_paywall_state') return {data: {locked: true, reason: 'spatial_locked'}, error: null};
      assert.fail('Unreviewed RPC: ' + name);
    },
  };
  return {client, calls, switchTo: id => {account = id;},
    legacy: load('entitlementService.ts', 'EntitlementService', client),
    verified: load('adminAccessService.ts', 'AdminAccessService', client)};
}

test('legacy pro tier cannot permit pose when spatial flag and verified Premium deny', async () => {
  const f = fixture({tier: 'pro', flags: {can_spatial: false, can_voice: false}});
  assert.equal((await f.verified.getVerifiedCurrentUserCapabilities('A')).premium, false);
  assert.equal((await f.legacy.getPaywallState('spatial', 'A')).locked, true);
  assert.equal((await f.legacy.canRealtimePose('A')).allowed, false);
});

test('voice flag alone cannot enable spatial/pose', async () => {
  const f = fixture({tier: 'free', flags: {can_voice: true, can_spatial: false}});
  assert.equal((await f.legacy.canRealtimePose('A')).allowed, false);
  assert.equal(f.calls.some(c => c.name === 'has_verified_entitlement_v1'), false);
});

test('legacy adaptation/explanation flags cannot permit when verified Premium denies', async () => {
  const f = fixture({tier: 'pro', flags: {can_adapt: true, can_explain: true}});
  assert.equal((await f.verified.getVerifiedCurrentUserCapabilities('A')).premium, false);
  assert.equal(await f.legacy.canAdaptProgram('A'), false);
  assert.equal(await f.legacy.canExplain('A'), false);
});

test('malformed string false never permits a feature even with verified Premium', async () => {
  const f = fixture({tier: 'free', flags: {can_spatial: 'false', can_adapt: 'false', can_explain: 'false', can_view_plan: 'false'}}, true);
  assert.equal((await f.legacy.canRealtimePose('A')).allowed, false);
  assert.equal(await f.legacy.canAdaptProgram('A'), false);
  assert.equal(await f.legacy.canExplain('A'), false);
  assert.equal(await f.legacy.canGenerateProgram('A'), false);
});

test('verified Premium plus exact feature flags permits; tier and voice remain insufficient', async () => {
  const f = fixture({tier: 'pro', flags: {can_spatial: true, can_adapt: true, can_explain: true}}, true);
  assert.equal((await f.legacy.canRealtimePose('A')).allowed, true);
  assert.equal(await f.legacy.canAdaptProgram('A'), true);
  assert.equal(await f.legacy.canExplain('A'), true);
  const voiceOnly = fixture({tier: 'vision_pro', flags: {can_voice: true, can_spatial: false}}, true);
  assert.equal((await voiceOnly.legacy.canRealtimePose('A')).allowed, false);
  assert(f.calls.filter(c => c.name === 'has_verified_entitlement_v1').every(c => c.args.p_capability === 'premium'));
});

test('missing, malformed or failed verified predicate never falls back to legacy permission', async () => {
  for (const result of [{data: 'true', error: null}, {data: null, error: null}, {data: true, error: new Error('missing RPC')}]) {
    const f = fixture({tier: 'pro', flags: {can_adapt: true, can_explain: true, can_spatial: true}});
    const rpc = f.client.rpc;
    f.client.rpc = async (name, args) => name === 'has_verified_entitlement_v1' ? result : rpc(name, args);
    assert.equal(await f.legacy.canAdaptProgram('A'), false);
    assert.equal(await f.legacy.canExplain('A'), false);
    assert.equal((await f.legacy.canRealtimePose('A')).allowed, false);
  }
});

test('invalid entitlement responses and flag containers never authorize through coercion', async () => {
  for (const value of [null, [], 'paid']) {
    await assert.rejects(fixture(value, true).legacy.canGenerateProgram('A'), /Некорректный ответ/);
  }
  for (const flags of ['true', [], 1]) {
    const f = fixture({tier: 'pro', flags}, true);
    assert.equal(await f.legacy.canGenerateProgram('A'), false);
    assert.equal(await f.legacy.canAdaptProgram('A'), false);
  }
});

test('verified response finishing after account switch rejects and never authorizes B', async () => {
  const f = fixture({tier: 'pro', flags: {can_adapt: true}});
  const rpc = f.client.rpc;
  let finish, started;
  const entered = new Promise(resolve => {started = resolve;});
  f.client.rpc = async (name, args) => {
    if (name !== 'has_verified_entitlement_v1') return rpc(name, args);
    started();
    return new Promise(resolve => {finish = resolve;});
  };
  const pending = f.legacy.canAdaptProgram('A');
  await entered;
  f.switchTo('B');
  finish({data: true, error: null});
  await assert.rejects(pending, /Пользователь изменился/);
});

test('raw paywall reads also reject stale account completion', async () => {
  const f = fixture({tier: 'free', flags: {}});
  f.client.rpc = async () => { f.switchTo('B'); return {data: {locked: false}, error: null}; };
  await assert.rejects(f.legacy.getPaywallState('spatial', 'A'), /Пользователь изменился/);
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

test('an A response finishing after switch to B rejects before granting a capability', async () => {
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
  await assert.rejects(pending, /Пользователь изменился/);
  // Reject the stale client completion; this is not a server authorization test.
});
