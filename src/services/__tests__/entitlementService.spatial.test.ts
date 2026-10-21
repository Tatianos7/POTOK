import assert from 'node:assert/strict';
import { test } from 'node:test';
import { EntitlementService } from '../entitlementService';

const userId = 'aaaaaaaa-aaaa-4aaa-aaaa-aaaaaaaaaaaa';

function serviceFor(tier: string, flags: Record<string, boolean>) {
  const client = {
    auth: { getUser: async () => ({ data: { user: { id: userId } }, error: null }) },
    rpc: async (name: string, args: { p_user_id: string }) => {
      assert.equal(name, 'get_entitlements');
      assert.equal(args.p_user_id, userId);
      return { data: { tier, flags }, error: null };
    },
  };
  return new EntitlementService(client as unknown as ConstructorParameters<typeof EntitlementService>[0]);
}

test('spatial access requires explicit can_spatial, regardless of tier or voice', async () => {
  for (const tier of ['free', 'pro', 'vision_pro', 'coach']) {
    for (const flags of [{}, { can_spatial: false }, { can_voice: true }]) {
      assert.equal((await serviceFor(tier, flags).canRealtimePose(userId)).allowed, false);
    }
    assert.equal(
      (await serviceFor(tier, { can_spatial: true }).canRealtimePose(userId)).allowed,
      true,
    );
  }
});

test('spatial access rejects account mismatch before calling RPC', async () => {
  await assert.rejects(
    serviceFor('vision_pro', { can_spatial: true }).canRealtimePose('bbbbbbbb-bbbb-4bbb-bbbb-bbbbbbbbbbbb'),
    /Пользователь изменился/,
  );
});
