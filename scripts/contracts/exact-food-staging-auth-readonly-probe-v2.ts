/**
 * Read-only hosted Staging smoke probe for Nutrition V2 RPCs.
 * Requires a real, already-issued user access token; never creates a session,
 * calls the write-capable review RPC, prints tokens, or uses service-role keys.
 *
 * Usage (in a trusted local shell/CI secret store):
 * POTOK_STAGING_PUBLISHABLE_KEY=... POTOK_STAGING_USER_ACCESS_TOKEN=... \
 * POTOK_EXPECT_ADMIN=yes|no npx tsx scripts/contracts/exact-food-staging-auth-readonly-probe-v2.ts
 *
 * A successful admin probe demonstrates authenticated access to the two
 * read-only RPCs, NOT approval/issuance, recipe publication or generator readiness.
 */
import assert from 'node:assert/strict';
import { createClient } from '@supabase/supabase-js';

const ORIGIN = 'https://ozidryfvhkcbtpnulakq.supabase.co';
const key = process.env.POTOK_STAGING_PUBLISHABLE_KEY ?? '';
const token = process.env.POTOK_STAGING_USER_ACCESS_TOKEN ?? '';
const expected = process.env.POTOK_EXPECT_ADMIN;
const uuid = '00000000-0000-4000-8000-000000000001';

function fail(message: string): never { throw Error(message); }
function isPublishableKey(value: string): boolean {
  if (/^sb_publishable_[A-Za-z0-9_-]+$/.test(value)) return true;
  if (!/^[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+$/.test(value)) return false;
  try {
    const payload = JSON.parse(Buffer.from(value.split('.')[1], 'base64url').toString('utf8')) as { role?: unknown };
    return payload.role === 'anon';
  } catch { return false; }
}
if (!isPublishableKey(key) || !token || /\s/.test(token) || !['yes','no'].includes(expected ?? '')) {
  fail('STAGING_USER_CREDENTIALS_AND_EXPLICIT_EXPECTATION_REQUIRED');
}
const client = createClient(ORIGIN, key, {
  global: { headers: { Authorization: `Bearer ${token}` } },
  auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
});
const verified = await client.auth.getUser(token);
assert.ok(!verified.error && verified.data.user && !verified.data.user.is_anonymous, 'LIVE_AUTH_USER_REQUIRED');
const userId = verified.data.user.id;
const calls = [
  ['receipt', 'food_nutrition_receipt_v2', { p_idempotency_reference: uuid }],
  ['current', 'food_nutrition_current_v2', { p_canonical_food_id: uuid, p_food_state: 'raw' }],
] as const;
for (const [label, rpc, args] of calls) {
  const { data, error } = await client.rpc(rpc, args);
  const after = await client.auth.getUser(token);
  assert.ok(!after.error && after.data.user?.id === userId, 'AUTH_CHANGED_DURING_PROBE');
  if (expected === 'no') {
    // Non-admin must never receive a successful RPC result, even if no row exists.
    assert.ok(error && /AUTH_REQUIRED|ADMIN_REQUIRED|NOT_ADMIN|FORBIDDEN|INSUFFICIENT_PRIVILEGE/i.test(error.message),\n      `NON_ADMIN_${label.toUpperCase()}_DENIAL_NOT_PROVEN`);
    console.log(`${label}: denied (expected)`);
  } else {
    if (error) fail(`ADMIN_${label.toUpperCase()}_RPC_FAILED (inspect securely on host)`);
    assert.ok(data !== undefined, `ADMIN_${label.toUpperCase()}_NO_RESULT`);
    console.log(`${label}: reached RPC (read-only)`);
  }
}
console.log('Staging Nutrition V2 read-only Auth probe complete; review/issuance NOT tested.');
