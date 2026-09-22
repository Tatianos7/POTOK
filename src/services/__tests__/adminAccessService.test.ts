import test from 'node:test';
import assert from 'node:assert/strict';
import type { SupabaseClient } from '@supabase/supabase-js';

type CapabilityResult = { data: boolean | null; error: { message: string } | null };
type EntitlementClient = Pick<SupabaseClient, 'auth' | 'rpc'>;

const buildClient = ({
  sessionUserId = 'account-a',
  sessionUserIds,
  results,
  calls,
}: {
  sessionUserId?: string | null;
  sessionUserIds?: Array<string | null>;
  results: Record<'premium' | 'admin', CapabilityResult>;
  calls: string[];
}) => ({
  auth: {
    async getUser() {
      calls.push('auth:getUser');
      const currentUserId = sessionUserIds?.shift() ?? sessionUserId;
      return {
        data: { user: currentUserId ? { id: currentUserId } : null },
        error: null,
      };
    },
  },
  async rpc(name: string, args: { p_capability: 'premium' | 'admin' }) {
    calls.push(`${name}:${args.p_capability}`);
    return results[args.p_capability];
  },
});

test('verified server predicate is the only source of Premium/admin UI capabilities', async () => {
  const { AdminAccessService } = await import('../adminAccessService.ts');
  const calls: string[] = [];
  const service = new AdminAccessService(buildClient({
    calls,
    results: {
      premium: { data: false, error: null },
      admin: { data: true, error: null },
    },
  }) as unknown as EntitlementClient);

  assert.deepEqual(await service.getVerifiedCurrentUserCapabilities('account-a'), {
    premium: false,
    admin: true,
    premiumVerified: true,
    adminVerified: true,
  });
  assert.deepEqual(calls, [
    'auth:getUser',
    'has_verified_entitlement_v1:premium',
    'has_verified_entitlement_v1:admin',
    'auth:getUser',
  ]);
});

test('account mismatch fails closed before entitlement RPC', async () => {
  const { AdminAccessService } = await import('../adminAccessService.ts');
  const calls: string[] = [];
  const service = new AdminAccessService(buildClient({
    sessionUserId: 'account-b',
    calls,
    results: {
      premium: { data: true, error: null },
      admin: { data: true, error: null },
    },
  }) as unknown as EntitlementClient);

  assert.deepEqual(await service.getVerifiedCurrentUserCapabilities('account-a'), {
    premium: false,
    admin: false,
    premiumVerified: false,
    adminVerified: false,
  });
  assert.deepEqual(calls, ['auth:getUser']);
});

test('account switch during verified predicate reads discards both results', async () => {
  const { AdminAccessService } = await import('../adminAccessService.ts');
  const calls: string[] = [];
  const service = new AdminAccessService(buildClient({
    sessionUserIds: ['account-a', 'account-b'],
    calls,
    results: {
      premium: { data: true, error: null },
      admin: { data: true, error: null },
    },
  }) as unknown as EntitlementClient);

  assert.deepEqual(await service.getVerifiedCurrentUserCapabilities('account-a'), {
    premium: false,
    admin: false,
    premiumVerified: false,
    adminVerified: false,
  });
});

test('missing predicate, malformed result, and blank account fail closed', async () => {
  const { AdminAccessService } = await import('../adminAccessService.ts');
  const calls: string[] = [];
  const service = new AdminAccessService(buildClient({
    calls,
    results: {
      premium: { data: null, error: null },
      admin: { data: null, error: { message: 'function does not exist' } },
    },
  }) as unknown as EntitlementClient);

  assert.equal(await service.verifyCurrentUserIsAdmin('account-a'), false);
  assert.equal(await service.verifyCurrentUserIsAdmin(' '), false);
  assert.equal(await new AdminAccessService(null).verifyCurrentUserIsAdmin('account-a'), false);
});
