/**
 * Local interactive Staging Auth -> RPC smoke test. NO credentials in CLI args,
 * shell history, GitHub, or logs; DO NOT redirect process output to shared logs.
 * Only reads Nutrition V2; the operator separately grants/revokes short-lived
 * admin entitlement using the owner-controlled database functions.
 */
import assert from 'node:assert/strict';
import { createInterface } from 'node:readline/promises';
import { stdin, stdout } from 'node:process';
import { createClient } from '@supabase/supabase-js';

const ORIGIN = 'https://ozidryfvhkcbtpnulakq.supabase.co';
const EMAIL = 'fitnessup@ya.ru';
const UUID = '00000000-0000-4000-8000-000000000001';
const prompt = createInterface({ input: stdin, output: stdout });
let client;
try {
  console.log('POTOK / Staging ONLY. OTP and publishable key remain on this laptop.');
  console.log('Use an sb_publishable_... or legacy anon key, NEVER service_role/secret.');
  const key = (await prompt.question('Staging publishable/anon key (local only): ')).trim();
  let publicKey = /^sb_publishable_[A-Za-z0-9_-]+$/.test(key);
  if (!publicKey && /^[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+$/.test(key)) {
    try { publicKey = JSON.parse(Buffer.from(key.split('.')[1], 'base64url').toString('utf8')).role === 'anon'; } catch { /* deny */ }
  }
  assert.ok(publicKey, 'PUBLIC_ANON_KEY_REQUIRED_NO_SECRET_KEYS');
  client = createClient(ORIGIN, key, { auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false } });
  const sent = await client.auth.signInWithOtp({ email: EMAIL, options: { shouldCreateUser: false } });
  assert.ifError(sent.error);
  console.log('Email OTP requested from Staging. Do not paste it into ChatGPT.');
  const otp = (await prompt.question('6-digit email OTP (local only): ')).trim();
  assert.match(otp, /^[0-9]{6,8}$/, 'EMAIL_OTP_REQUIRED');
  const verifiedOtp = await client.auth.verifyOtp({ email: EMAIL, token: otp, type: 'email' });
  assert.ifError(verifiedOtp.error);
  const user = await client.auth.getUser();
  assert.ok(!user.error && user.data.user?.email?.toLowerCase() === EMAIL, 'STAGING_AUTH_ACCOUNT_MISMATCH');
  console.log('LIVE_STAGING_AUTH_CONFIRMED (no token exposed)');

  async function phase(admin) {
    for (const [label, name, args] of [
      ['receipt', 'food_nutrition_receipt_v2', { p_idempotency_reference: UUID }],
      ['current', 'food_nutrition_current_v2', { p_canonical_food_id: UUID, p_food_state: 'raw' }],
    ]) {
      const { data, error } = await client.rpc(name, args);
      if (!admin) {
        assert.ok(error?.code === '42501' && error.message.includes('VERIFIED_ADMIN_REQUIRED'),
          'NON_ADMIN_' + label.toUpperCase() + '_GATE_NOT_PROVEN');
        console.log(label + ': verified admin gate rejected normal user');
      } else if (label === 'receipt') {
        assert.ok(error?.code === 'P0002' && error.message.includes('REQUEST_NOT_FOUND'),
          'ADMIN_RECEIPT_READER_NOT_CONFIRMED');
        console.log('receipt: admin authorization passed; no receipt (expected)');
      } else {
        assert.ifError(error);
        assert.ok(data?.kind === 'UNRESOLVED' && data.foodId === UUID, 'ADMIN_CURRENT_READER_NOT_CONFIRMED');
        console.log('current: admin authorization passed; unresolved (expected)');
      }
    }
  }
  await phase(false);
  console.log('NONADMIN_PASS. Ask ChatGPT to enable short-lived Staging admin now.');
  const ready = (await prompt.question('After ChatGPT confirms grant, type GO and press Enter: ')).trim();
  assert.equal(ready, 'GO', 'ADMIN_PHASE_NOT_STARTED');
  const stillUser = await client.auth.getUser();
  assert.ok(!stillUser.error && stillUser.data.user?.id === user.data.user.id, 'AUTH_SESSION_CHANGED');
  await phase(true);
  console.log('ADMIN_PASS. Tell ChatGPT immediately: revoke Staging admin.');
} catch (err) {
  console.error('STAGING_PROBE_FAILED:', err instanceof Error ? err.message : 'UNKNOWN');
  process.exitCode = 1;
} finally {
  try { await client?.auth.signOut({ scope: 'local' }); } catch { /* no tokens logged */ }
  prompt.close();
}
