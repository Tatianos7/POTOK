import assert from 'node:assert/strict';
import test from 'node:test';
import type { SupabaseClient } from '@supabase/supabase-js';
import { AdaptiveNutritionPersistenceService, isAdaptiveNutritionRuntimeEnabled } from '../adaptiveNutritionPersistenceService';
import { adaptiveNutritionCanonicalEncodingV1, adaptiveNutritionSha256HexV1,
  decodeAdaptiveNutritionWireEnvelopeV1 } from '../../utils/adaptiveNutritionWireV1';

const ids = {
  accountA: '00000000-0000-4000-8000-000000000001',
  accountB: '00000000-0000-4000-8000-000000000002',
  selection: '00000000-0000-4000-8000-000000000003',
  plan: '00000000-0000-4000-8000-000000000004',
  goal: '00000000-0000-4000-8000-000000000005',
  history: '00000000-0000-4000-8000-000000000006',
  diary: '00000000-0000-4000-8000-000000000007',
  key: '00000000-0000-4000-8000-000000000008',
  slot: '00000000-0000-4000-8000-000000000009',
  snapshot: '00000000-0000-4000-8000-00000000000a',
  portion: '00000000-0000-4000-8000-00000000000b',
  operation: '00000000-0000-4000-8000-00000000000c',
};

type TestAction = 'SKIPPED' | 'REPLACE' | 'UNDO_ANNOTATION' | 'FACT'
  | 'CONSUMED_AS_PLANNED' | 'CONSUMED_MODIFIED' | 'EXTRA_FOOD';

function rawRequest(action: TestAction = 'SKIPPED') {
  const slot = { slotId: ids.slot, date: '2026-09-21', snapshot: {
    snapshotRevision: ids.snapshot, recipeRevision: null, portionRevision: ids.portion } };
  const actual = { items: [{ foodRef: ids.snapshot, amount: '1.00', unit: 'g', state: 'raw' }] };
  const wireAction = action === 'REPLACE'
    ? { type: action, slot, replacementOfferId: '00000000-0000-4000-8000-00000000000d' }
    : action === 'UNDO_ANNOTATION'
      ? { type: action, targetEventId: '00000000-0000-4000-8000-00000000000e' }
      : action === 'CONSUMED_MODIFIED'
        ? { type: action, slot, actual }
        : action === 'EXTRA_FOOD'
          ? { type: action, date: '2026-09-21', mealType: 'snack', actual }
          : action === 'FACT'
            ? { type: action }
            : { type: action, slot };
  return JSON.stringify({
    contract: 'adaptive-nutrition-v1-proposed',
    expected: { accountId: ids.accountA, planId: ids.selection, planRevision: ids.plan,
      goalRevision: ids.goal, historyRevision: ids.history, diaryRevision: ids.diary,
      weekAnchor: '2026-09-21', timeZone: 'Europe/Moscow' },
    idempotencyKey: ids.key,
    explicitConfirmation: true,
    action: wireAction,
  });
}

function settled(digest: string) {
  return { kind: 'settled', operation_id: ids.operation, idempotency_key: ids.key,
    digest_version: adaptiveNutritionCanonicalEncodingV1, request_digest_hex: digest,
    outcome: 'accepted', reason: null, result: { operation_id: ids.operation,
      selection_id: ids.selection, plan_revision: ids.plan, goal_revision: ids.goal,
      history_revision: ids.history, diary_revision: ids.diary },
    committed_at: '2026-09-21T12:00:00Z' };
}

function ready(operationId: string | null) {
  return { kind: 'ready', selection_id: ids.selection, week_anchor: '2026-09-21',
    timezone: 'Europe/Moscow', status: 'active', origin_kind: 'generated', origin_lineage: {},
    plan_revision: ids.plan, goal_revision: ids.goal, history_revision: ids.history,
    diary_revision: ids.diary, graph: { plan_revision: ids.plan, goal_revision: ids.goal,
      graph_snapshot: { days: [] } },
    events: [], exact_operation_id: operationId };
}

type RpcResult = { data: unknown; error: { code?: string; message: string } | null };
function client(options: {
  account?: () => string | null;
  rpc: (name: string, args: Record<string, unknown>) => Promise<RpcResult> | RpcResult;
  calls?: string[];
}) {
  return {
    auth: { async getUser() {
      options.calls?.push('auth');
      const accountId = options.account?.() ?? ids.accountA;
      return { data: { user: accountId ? { id: accountId } : null }, error: null };
    } },
    async rpc(name: string, args: Record<string, unknown>) {
      options.calls?.push(name);
      return options.rpc(name, args);
    },
  } as unknown as Pick<SupabaseClient, 'auth' | 'rpc'>;
}

function enabledService(mockClient: Pick<SupabaseClient, 'auth' | 'rpc'>) {
  return new AdaptiveNutritionPersistenceService(mockClient, true);
}

test('strict duplicate-aware decoder runs before mutation transport and FACT actions stay disabled', async () => {
  const calls: string[] = [];
  const service = enabledService(client({ calls, rpc: () => ({ data: null, error: null }) }));
  const session = service.beginSession(ids.accountA);
  const duplicate = rawRequest().replace(`"idempotencyKey":"${ids.key}"`,
    `"idempotencyKey":"${ids.key}","idempotencyKey":"${ids.key}"`);
  assert.match((await service.mutate(session, duplicate) as { reason: string }).reason, /Duplicate JSON key/);
  for (const action of ['FACT', 'CONSUMED_AS_PLANNED', 'CONSUMED_MODIFIED', 'EXTRA_FOOD'] as const) {
    const result = await service.mutate(session, rawRequest(action));
    assert.equal(result.kind, 'invalid-request', action);
  }
  assert.deepEqual(calls, []);
});

test('successful SKIPPED sends the byte-identical raw envelope and accepts the server digest', async () => {
  const raw = rawRequest('SKIPPED');
  const digest = await adaptiveNutritionSha256HexV1(decodeAdaptiveNutritionWireEnvelopeV1(raw).canonicalBytes);
  const calls: Array<{ name: string; args: Record<string, unknown> }> = [];
  const service = enabledService(client({ rpc(name, args) {
    calls.push({ name, args });
    return { data: settled(digest), error: null };
  } }));
  const result = await service.mutate(service.beginSession(ids.accountA), raw);
  assert.equal(result.kind, 'settled');
  assert.deepEqual(calls, [{ name: 'adaptive_nutrition_mutate_v1', args: { p_request_text: raw } }]);
  assert.equal('p_client_digest' in calls[0].args, false);
});

test('forged server digest, foreign request account and explicit server CAS/entitlement errors fail closed', async () => {
  const raw = rawRequest();
  const service = enabledService(client({ rpc: () => ({ data: settled('0'.repeat(64)), error: null }) }));
  const session = service.beginSession(ids.accountA);
  assert.deepEqual(await service.mutate(session, raw), { kind: 'invalid-server-response' });

  const foreign = JSON.stringify({ ...JSON.parse(raw) as Record<string, unknown>, expected: {
    ...(JSON.parse(raw) as { expected: Record<string, unknown> }).expected, accountId: ids.accountB } });
  assert.deepEqual(await service.mutate(session, foreign), { kind: 'session-stale' });

  for (const [code, kind] of [['40001', 'conflict'], ['42501', 'denied']] as const) {
    const errors = enabledService(client({ rpc: () => ({ data: null, error: { code, message: code } }) }));
    assert.deepEqual(await errors.mutate(errors.beginSession(ids.accountA), raw), { kind });
  }
});

test('lookup and exact read remain available after entitlement loss while current read is denied', async () => {
  const digest = await adaptiveNutritionSha256HexV1(decodeAdaptiveNutritionWireEnvelopeV1(rawRequest()).canonicalBytes);
  const service = enabledService(client({ rpc(name, args) {
    if (name === 'adaptive_nutrition_lookup_v1') return { data: settled(digest), error: null };
    if (name === 'adaptive_nutrition_read_v1' && args.p_operation_id === ids.operation) {
      return { data: ready(ids.operation), error: null };
    }
    return { data: { kind: 'denied' }, error: null };
  } }));
  const session = service.beginSession(ids.accountA);
  const lookup = await service.lookup(session, ids.key);
  if (lookup.kind !== 'settled') assert.fail('settled own receipt required');
  assert.equal((await service.readExact(session, ids.selection, lookup)).kind, 'ready');
  assert.deepEqual(await service.readCurrent(session, ids.selection), { kind: 'denied' });
});

test('A→B→A generation makes every late A response stale even if auth returns to A', async () => {
  let release: ((value: RpcResult) => void) | undefined;
  const pending = new Promise<RpcResult>((resolve) => { release = resolve; });
  const service = enabledService(client({ rpc: () => pending }));
  const oldA = service.beginSession(ids.accountA);
  const request = service.readCurrent(oldA, ids.selection);
  service.beginSession(ids.accountB);
  service.beginSession(ids.accountA);
  release?.({ data: ready(null), error: null });
  assert.deepEqual(await request, { kind: 'session-stale' });
});

test('read adapter rejects mismatched exact/current identities instead of accepting a stale graph', async () => {
  const service = enabledService(client({ rpc(_name, args) {
    if (args.p_operation_id === null) return { data: ready(ids.operation), error: null };
    return { data: { ...ready(ids.operation), history_revision: ids.plan }, error: null };
  } }));
  const session = service.beginSession(ids.accountA);
  assert.deepEqual(await service.readCurrent(session, ids.selection), { kind: 'invalid-server-response' });
  const digest = await adaptiveNutritionSha256HexV1(decodeAdaptiveNutritionWireEnvelopeV1(rawRequest()).canonicalBytes);
  const receipt = settled(digest);
  assert.deepEqual(await service.readExact(session, ids.selection, {
    kind: 'settled', operationId: receipt.operation_id, idempotencyKey: receipt.idempotency_key,
    digestVersion: receipt.digest_version, requestDigestHex: receipt.request_digest_hex,
    outcome: receipt.outcome as 'accepted', reason: receipt.reason, result: receipt.result,
    committedAt: receipt.committed_at,
  }), { kind: 'invalid-server-response' });
});

test('feature flag OFF returns unavailable with zero auth or RPC calls', async () => {
  assert.equal(isAdaptiveNutritionRuntimeEnabled(), false);
  const calls: string[] = [];
  const service = new AdaptiveNutritionPersistenceService(client({ calls,
    rpc: () => ({ data: settled('0'.repeat(64)), error: null }) }));
  const session = service.beginSession(ids.accountA);
  assert.deepEqual(await service.mutate(session, rawRequest()), { kind: 'unavailable' });
  assert.deepEqual(await service.lookup(session, ids.key), { kind: 'unavailable' });
  assert.deepEqual(await service.readCurrent(session, ids.selection), { kind: 'unavailable' });
  assert.deepEqual(calls, []);
});

test('timeout stays UNKNOWN and lookup uses the original idempotency key', async () => {
  const raw = rawRequest();
  const digest = await adaptiveNutritionSha256HexV1(decodeAdaptiveNutritionWireEnvelopeV1(raw).canonicalBytes);
  const calls: Array<{ name: string; args: Record<string, unknown> }> = [];
  const service = enabledService(client({ rpc(name, args) {
    calls.push({ name, args });
    return name === 'adaptive_nutrition_mutate_v1'
      ? { data: null, error: { message: 'network timeout' } }
      : { data: settled(digest), error: null };
  } }));
  const session = service.beginSession(ids.accountA);
  assert.deepEqual(await service.mutate(session, raw), { kind: 'unknown' });
  assert.equal((await service.lookup(session, ids.key)).kind, 'settled');
  assert.deepEqual(calls, [
    { name: 'adaptive_nutrition_mutate_v1', args: { p_request_text: raw } },
    { name: 'adaptive_nutrition_lookup_v1', args: { p_idempotency_key: ids.key } },
  ]);
});

test('exact replay after session restart reuses the original raw payload and key', async () => {
  const raw = rawRequest();
  const digest = await adaptiveNutritionSha256HexV1(decodeAdaptiveNutritionWireEnvelopeV1(raw).canonicalBytes);
  const sent: string[] = [];
  let first = true;
  const service = enabledService(client({ rpc(_name, args) {
    sent.push(args.p_request_text as string);
    if (first) {
      first = false;
      return { data: { kind: 'unknown' }, error: null };
    }
    return { data: settled(digest), error: null };
  } }));
  const originalSession = service.beginSession(ids.accountA);
  assert.deepEqual(await service.mutate(originalSession, raw), { kind: 'unknown' });
  service.endSession();
  const resumedSession = service.beginSession(ids.accountA);
  assert.equal((await service.mutate(resumedSession, raw)).kind, 'settled');
  assert.deepEqual(sent, [raw, raw]);
  assert.equal(JSON.parse(sent[1]).idempotencyKey, ids.key);
});

test('same-key payload mismatch and stale revision errors map to conflict', async () => {
  for (const message of ['idempotency key payload mismatch', 'stale adaptive plan revision']) {
    const service = enabledService(client({ rpc: () => ({ data: null,
      error: { code: '40001', message } }) }));
    assert.deepEqual(await service.mutate(service.beginSession(ids.accountA), rawRequest()), { kind: 'conflict' });
  }
});

test('new paid effect maps entitlement loss to denied', async () => {
  const service = enabledService(client({ rpc: () => ({ data: null,
    error: { code: '42501', message: 'verified Premium entitlement required' } }) }));
  assert.deepEqual(await service.mutate(service.beginSession(ids.accountA), rawRequest()), { kind: 'denied' });
});

test('explicit server recovery kinds map without being mistaken for malformed receipts', async () => {
  for (const kind of ['unknown', 'denied', 'conflict'] as const) {
    const service = enabledService(client({ rpc: () => ({ data: { kind }, error: null }) }));
    assert.deepEqual(await service.mutate(service.beginSession(ids.accountA), rawRequest()), { kind });
  }
});

test('foreign authenticated account response is discarded after dispatch', async () => {
  const raw = rawRequest();
  const digest = await adaptiveNutritionSha256HexV1(decodeAdaptiveNutritionWireEnvelopeV1(raw).canonicalBytes);
  let actor = ids.accountA;
  let release: ((value: RpcResult) => void) | undefined;
  const pending = new Promise<RpcResult>((resolve) => { release = resolve; });
  const service = enabledService(client({ account: () => actor, rpc: () => pending }));
  const request = service.mutate(service.beginSession(ids.accountA), raw);
  await new Promise<void>((resolve) => setImmediate(resolve));
  actor = ids.accountB;
  release?.({ data: settled(digest), error: null });
  assert.deepEqual(await request, { kind: 'session-stale' });
});

test('REPLACE dispatch accepts only the strict server-offer-id wire shape', async () => {
  const calls: Array<Record<string, unknown>> = [];
  const raw = rawRequest('REPLACE');
  const digest = await adaptiveNutritionSha256HexV1(decodeAdaptiveNutritionWireEnvelopeV1(raw).canonicalBytes);
  const service = enabledService(client({ rpc(_name, args) {
    calls.push(args);
    return { data: settled(digest), error: null };
  } }));
  const session = service.beginSession(ids.accountA);
  assert.equal((await service.mutate(session, raw)).kind, 'settled');
  const parsed = JSON.parse(raw) as { action: Record<string, unknown> };
  const forgedGraph = JSON.stringify({ ...JSON.parse(raw) as Record<string, unknown>,
    action: { ...parsed.action, replacementGraph: { days: [] } } });
  assert.equal((await service.mutate(session, forgedGraph)).kind, 'invalid-request');
  assert.deepEqual(calls, [{ p_request_text: raw }]);
});
