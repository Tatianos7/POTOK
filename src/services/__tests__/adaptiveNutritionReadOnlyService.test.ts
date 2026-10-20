import assert from 'node:assert/strict';
import test from 'node:test';
import { readFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import type { SupabaseClient } from '@supabase/supabase-js';
import {
  AdaptiveNutritionReadOnlyService,
  decodeAdaptiveNutritionPendingGenerationDiscoveryV1,
  isAdaptiveNutritionReadEnabled,
} from '../adaptiveNutritionReadOnlyService';

const ids = {
  accountA: '10000000-0000-4000-8000-000000000001',
  accountB: '10000000-0000-4000-8000-000000000002',
  selection: '20000000-0000-4000-8000-000000000001',
  plan: '30000000-0000-4000-8000-000000000001',
  goal: '40000000-0000-4000-8000-000000000001',
  history: '50000000-0000-4000-8000-000000000001',
  diary: '60000000-0000-4000-8000-000000000001',
};

type RpcResult = { data: unknown; error: { message: string } | null };
function client(input: {
  account?: () => string | null;
  rpc: (name: string, args: Record<string, unknown>) => Promise<RpcResult> | RpcResult;
  calls?: Array<{ name: string; args?: Record<string, unknown> }>;
}) {
  return {
    auth: { async getUser() {
      input.calls?.push({ name: 'auth' });
      const id = input.account?.() ?? ids.accountA;
      return { data: { user: id ? { id } : null }, error: null };
    } },
    async rpc(name: string, args: Record<string, unknown>) {
      input.calls?.push({ name, args });
      return input.rpc(name, args);
    },
  } as unknown as Pick<SupabaseClient, 'auth' | 'rpc'>;
}

const discovery = () => ({
  kind: 'ready', selection_id: ids.selection, week_anchor: '2026-09-21', timezone: 'Europe/Moscow',
  status: 'active', contract_version: 1,
});

const pendingDiscovery = () => ({
  kind: 'pending_generation', selection_id: ids.selection, week_anchor: '2026-09-21',
  timezone: 'Europe/Moscow', status: 'pending_generation', contract_version: 1,
  goal_revision: ids.goal,
});

const read = () => ({
  kind: 'ready', selection_id: ids.selection, week_anchor: '2026-09-21', timezone: 'Europe/Moscow',
  status: 'active', origin_kind: 'generated', origin_lineage: { source: 'goal-plan-engine-v1' },
  plan_revision: ids.plan, goal_revision: ids.goal, history_revision: ids.history, diary_revision: ids.diary,
  graph: { plan_revision: ids.plan, goal_revision: ids.goal, graph_snapshot: { days: [] } },
  events: [], exact_operation_id: null,
});

test('read gate defaults OFF with zero auth and RPC calls', async () => {
  assert.equal(isAdaptiveNutritionReadEnabled(), false);
  const calls: Array<{ name: string }> = [];
  const service = new AdaptiveNutritionReadOnlyService(client({ calls,
    rpc: () => ({ data: discovery(), error: null }) }));
  const session = service.beginSession(ids.accountA);
  assert.deepEqual(await service.discoverCurrent(session, 'Europe/Moscow'), { kind: 'unavailable' });
  assert.deepEqual(await service.readCurrent(session, ids.selection), { kind: 'unavailable' });
  assert.deepEqual(calls, []);
});

test('discovery and current read use only account-bound read RPCs', async () => {
  const calls: Array<{ name: string; args?: Record<string, unknown> }> = [];
  const service = new AdaptiveNutritionReadOnlyService(client({ calls, rpc(name, args) {
    if (name === 'adaptive_nutrition_discover_current_v1') {
      assert.deepEqual(args, { p_timezone: 'Europe/Moscow' });
      return { data: discovery(), error: null };
    }
    assert.equal(name, 'adaptive_nutrition_read_v1');
    assert.deepEqual(args, { p_selection_id: ids.selection, p_operation_id: null });
    return { data: read(), error: null };
  } }), true);
  const session = service.beginSession(ids.accountA);
  const found = await service.discoverCurrent(session, 'Europe/Moscow');
  assert.equal(found.kind, 'ready');
  assert.equal((await service.readCurrent(session, ids.selection)).kind, 'ready');
  assert.deepEqual(calls.filter((call) => call.name !== 'auth').map((call) => call.name), [
    'adaptive_nutrition_discover_current_v1', 'adaptive_nutrition_read_v1',
  ]);
  assert.equal(calls.some((call) => /mutate/i.test(call.name)), false);
});

test('strict pending discovery preserves selection, week and goal without changing ready contract', async () => {
  assert.deepEqual(decodeAdaptiveNutritionPendingGenerationDiscoveryV1(pendingDiscovery()), {
    kind: 'pending_generation', selectionId: ids.selection, weekAnchor: '2026-09-21',
    timeZone: 'Europe/Moscow', status: 'pending_generation', contractVersion: 1,
    goalRevision: ids.goal,
  });
  const service = new AdaptiveNutritionReadOnlyService(client({
    rpc: () => ({ data: pendingDiscovery(), error: null }),
  }), true);
  assert.equal((await service.discoverCurrent(service.beginSession(ids.accountA), 'Europe/Moscow')).kind,
    'pending_generation');
  assert.deepEqual(Object.keys(discovery()).sort(), [
    'contract_version', 'kind', 'selection_id', 'status', 'timezone', 'week_anchor',
  ]);
});

test('pending discovery rejects malformed, missing and extra contract fields', () => {
  const missingGoal = { ...pendingDiscovery() } as Record<string, unknown>;
  delete missingGoal.goal_revision;
  const invalid: unknown[] = [
    { ...pendingDiscovery(), extra: true },
    missingGoal,
    { ...pendingDiscovery(), selection_id: 'not-a-uuid' },
    { ...pendingDiscovery(), goal_revision: 'not-a-uuid' },
    { ...pendingDiscovery(), status: 'active' },
    { ...pendingDiscovery(), contract_version: 2 },
    { ...pendingDiscovery(), week_anchor: '2026-09-22' },
    { ...pendingDiscovery(), week_anchor: '2026-02-30' },
    { ...pendingDiscovery(), timezone: 'Invalid/Timezone' },
  ];
  for (const value of invalid) {
    assert.equal(decodeAdaptiveNutritionPendingGenerationDiscoveryV1(value), null);
  }
});

test('pending discovery must match the requested timezone', async () => {
  const service = new AdaptiveNutritionReadOnlyService(client({
    rpc: () => ({ data: { ...pendingDiscovery(), timezone: 'UTC' }, error: null }),
  }), true);
  assert.deepEqual(await service.discoverCurrent(service.beginSession(ids.accountA), 'Europe/Moscow'),
    { kind: 'invalid-server-response' });
});

test('zero and multiple selection outcomes remain explicit and fail closed', async () => {
  for (const kind of ['no_active_plan', 'ambiguous'] as const) {
    const service = new AdaptiveNutritionReadOnlyService(client({
      rpc: () => ({ data: { kind }, error: null }),
    }), true);
    assert.deepEqual(await service.discoverCurrent(service.beginSession(ids.accountA), 'Europe/Moscow'), { kind });
  }
  const archived = new AdaptiveNutritionReadOnlyService(client({
    rpc: () => ({ data: { ...discovery(), status: 'archived' }, error: null }),
  }), true);
  assert.deepEqual(await archived.discoverCurrent(archived.beginSession(ids.accountA), 'Europe/Moscow'),
    { kind: 'invalid-server-response' });
});

test('account mismatch and late A response are discarded', async () => {
  let actor = ids.accountB;
  const mismatched = new AdaptiveNutritionReadOnlyService(client({ account: () => actor,
    rpc: () => ({ data: discovery(), error: null }) }), true);
  assert.deepEqual(await mismatched.discoverCurrent(mismatched.beginSession(ids.accountA), 'Europe/Moscow'),
    { kind: 'session-stale' });

  let release: ((value: RpcResult) => void) | undefined;
  const pending = new Promise<RpcResult>((resolve) => { release = resolve; });
  actor = ids.accountA;
  const late = new AdaptiveNutritionReadOnlyService(client({ account: () => actor, rpc: () => pending }), true);
  const oldA = late.beginSession(ids.accountA);
  const request = late.discoverCurrent(oldA, 'Europe/Moscow');
  late.beginSession(ids.accountB);
  actor = ids.accountB;
  release?.({ data: discovery(), error: null });
  assert.deepEqual(await request, { kind: 'session-stale' });
});

test('read-only client source has no selection override, smoke identity, storage, or mutation transport', () => {
  const currentDir = dirname(fileURLToPath(import.meta.url));
  const source = readFileSync(resolve(currentDir, '../adaptiveNutritionReadOnlyService.ts'), 'utf8');
  assert.doesNotMatch(source, /localStorage|sessionStorage|VITE_ADAPTIVE_NUTRITION_SMOKE|7e710000-/);
  assert.doesNotMatch(source, /adaptive_nutrition_mutate_v1|\.from\(|\.insert\(|\.update\(|\.upsert\(|\.delete\(/);
  assert.doesNotMatch(source, /adaptive_nutrition_generate_v\d|setInterval\(/);
  assert.match(source, /adaptive_nutrition_discover_current_v1/);
  assert.match(source, /adaptive_nutrition_read_v1/);
  assert.doesNotMatch(source, /p_account|account_id:/);
});
