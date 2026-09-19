import assert from 'node:assert/strict';
import test from 'node:test';
import type { SupabaseClient } from '@supabase/supabase-js';
import { EntitlementService } from '../entitlementService';

function fixture(userId: string | null, authError: Error | null = null) {
  const calls: Array<{ name: string; args: Record<string, unknown> }> = [];
  const payload = { tier: 'free', flags: { can_view_plan: true, can_spatial: false } };
  const client = {
    auth: { getUser: async () => ({ data: { user: userId ? { id: userId } : null }, error: authError }) },
    rpc: async (name: string, args: Record<string, unknown>) => {
      calls.push({ name, args });
      return { data: payload, error: null };
    },
  } as unknown as Pick<SupabaseClient, 'auth' | 'rpc'>;
  return { service: new EntitlementService(client), calls, payload };
}

test('entitlement reads and capability helpers never substitute account B for requested A', async () => {
  const { service, calls } = fixture('B');
  for (const read of [
    () => service.getEntitlements('A'),
    () => service.getPaywallState('spatial', 'A'),
    () => service.canRealtimePose('A'),
    () => service.canGenerateProgram('A'),
    () => service.canAdaptProgram('A'),
    () => service.canExplain('A'),
  ]) {
    await assert.rejects(read, /Пользователь изменился/);
  }
  assert.deepEqual(calls, []);
});

test('missing or failed authentication performs no entitlement RPC', async () => {
  for (const [userId, error] of [[null, null], ['A', new Error('auth unavailable')]] as const) {
    const { service, calls } = fixture(userId, error);
    await assert.rejects(service.getEntitlements('A'), /не авторизован/);
    await assert.rejects(service.getPaywallState('adaptation', 'A'), /не авторизован/);
    assert.deepEqual(calls, []);
  }
  await assert.rejects(new EntitlementService(null).getEntitlements('A'), /не инициализирован/);
});

test('matching account reads use its exact ID and preserve existing Free capability policy', async () => {
  const { service, calls, payload } = fixture('A');
  assert.equal(await service.getEntitlements('A'), payload);
  assert.equal(await service.getPaywallState('spatial', 'A'), payload);
  assert.deepEqual(calls, [
    { name: 'get_entitlements', args: { p_user_id: 'A' } },
    { name: 'get_paywall_state', args: { p_feature: 'spatial', p_user_id: 'A' } },
  ]);
  assert.equal(await service.canGenerateProgram('A'), true);
  assert.deepEqual(await service.canRealtimePose('A'), { allowed: false, plan: 'free', flags: payload.flags });
});

test('legacy reads without an explicit user still require and use the current authenticated account', async () => {
  const { service, calls } = fixture('B');
  await service.getEntitlements();
  await service.getPaywallState('explainability');
  assert.deepEqual(calls, [
    { name: 'get_entitlements', args: { p_user_id: 'B' } },
    { name: 'get_paywall_state', args: { p_feature: 'explainability', p_user_id: 'B' } },
  ]);
});
