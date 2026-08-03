import test from 'node:test';
import assert from 'node:assert/strict';

test('applyApprovedAlias calls the admin-approved alias apply RPC explicitly', async () => {
  const { AliasApplyService } = await import('../aliasApplyService.ts');
  const calls: any[] = [];
  const client = {
    async rpc(name: string, payload: any) {
      calls.push({ name, payload });
      return {
        data: [{ result: 'applied', alias_id: 'alias-1', error: null }],
        error: null,
      };
    },
  };

  const service = new AliasApplyService(client as any);
  const result = await service.applyApprovedAlias('review-1', '  греча  ', '  approved  ');

  assert.deepEqual(calls, [
    {
      name: 'apply_admin_approved_food_alias',
      payload: {
        p_review_id: 'review-1',
        p_alias: 'греча',
        p_comment: 'approved',
      },
    },
  ]);
  assert.deepEqual(result, {
    result: 'applied',
    aliasId: 'alias-1',
    error: null,
  });
});

test('applyApprovedAlias sends blank alias and comment as null', async () => {
  const { AliasApplyService } = await import('../aliasApplyService.ts');
  let payload: any = null;
  const client = {
    async rpc(_name: string, rpcPayload: any) {
      payload = rpcPayload;
      return {
        data: [{ result: 'duplicate_alias', alias_id: null, error: 'Alias already exists' }],
        error: null,
      };
    },
  };

  const service = new AliasApplyService(client as any);
  const result = await service.applyApprovedAlias('review-1', '   ', ' ');

  assert.deepEqual(payload, {
    p_review_id: 'review-1',
    p_alias: null,
    p_comment: null,
  });
  assert.equal(result.result, 'duplicate_alias');
  assert.equal(result.aliasId, null);
  assert.equal(result.error, 'Alias already exists');
});

test('applyApprovedAlias returns insert_failed when RPC returns no row', async () => {
  const { AliasApplyService } = await import('../aliasApplyService.ts');
  const client = {
    async rpc() {
      return { data: [], error: null };
    },
  };

  const service = new AliasApplyService(client as any);
  const result = await service.applyApprovedAlias('review-1');

  assert.deepEqual(result, {
    result: 'insert_failed',
    aliasId: null,
    error: 'RPC did not return an apply result.',
  });
});

test('applyApprovedAlias propagates RPC errors without direct table writes', async () => {
  const { AliasApplyService } = await import('../aliasApplyService.ts');
  const client = {
    from() {
      throw new Error('service must not write tables directly');
    },
    async rpc() {
      return { data: null, error: new Error('permission denied') };
    },
  };

  const service = new AliasApplyService(client as any);

  await assert.rejects(() => service.applyApprovedAlias('review-1'), /permission denied/);
});
