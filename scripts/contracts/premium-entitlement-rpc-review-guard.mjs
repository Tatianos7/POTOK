// Static review guard: run with node --test scripts/contracts/premium-entitlement-rpc-review-guard.mjs
// No Supabase connection or cloud mutations. The review SQL is intentionally not deployed.
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const read = (path) => readFileSync(new URL('../../' + path, import.meta.url), 'utf8');
const sql = read('supabase/migration_drafts/premium_rpc_authority_hardening_review_20261021.sql');
const client = read('src/services/entitlementService.ts');
const acceptance = read('scripts/contracts/supabase-auth-postgrest-acceptance.mjs');

test('entitlement RPC draft rejects anonymous and cross-account requests', () => {
  assert.match(sql, /CREATE OR REPLACE FUNCTION public\.get_entitlements\(p_user_id uuid DEFAULT NULL\)/i);
  assert.match(sql, /auth\.role\(\)\s*<>\s*'authenticated'/i);
  assert.match(sql, /resolved_user\s*<>\s*caller/i);
  assert.match(sql, /ERRCODE\s*=\s*'42501'/i);
  assert.match(sql, /REVOKE ALL ON FUNCTION public\.get_entitlements\(uuid\) FROM PUBLIC,anon,authenticated/i);
  assert.match(sql, /GRANT EXECUTE ON FUNCTION public\.get_entitlements\(uuid\) TO authenticated,service_role/i);
});

test('client validates current authenticated identity before RPC', () => {
  assert.match(client, /this\.client\.auth\.getUser\(\)/);
  assert.match(client, /userId\s*&&\s*userId\s*!==\s*data\.user\.id/);
  assert.match(client, /rpc\('get_entitlements',[\s\S]*?p_user_id:\s*sessionUserId/);
  assert.match(client, /rpc\('get_paywall_state',[\s\S]*?p_user_id:\s*sessionUserId/);
});

test('disposable PostgREST suite retains identity and paywall scenarios', () => {
  for (const phrase of ['Cross-account entitlement read', 'Anonymous ', 'Default entitlement read', 'Own entitlement read']) {
    assert.ok(acceptance.includes(phrase), 'Missing scenario: ' + phrase);
  }
  assert.ok(acceptance.includes('dtsdnhbcwpbfrhcazqkb.supabase.co'));
  assert.ok(acceptance.includes('ozidryfvhkcbtpnulakq.supabase.co'));
});
