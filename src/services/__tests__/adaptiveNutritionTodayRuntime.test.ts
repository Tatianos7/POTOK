import test from 'node:test';
import assert from 'node:assert/strict';
import {
  AdaptiveNutritionTodayRuntimeController,
  activeAdaptiveNutritionAnnotations,
} from '../adaptiveNutritionTodayRuntime';
import type {
  AdaptiveNutritionMutationResult,
  AdaptiveNutritionReadModelV1,
  AdaptiveNutritionReadResult,
  AdaptiveNutritionReceiptV1,
  AdaptiveNutritionRuntimeSession,
} from '../adaptiveNutritionPersistenceService';
import { adaptiveNutritionSha256HexV1, decodeAdaptiveNutritionWireEnvelopeV1 } from '../../utils/adaptiveNutritionWireV1';

const ids = {
  accountA: '10000000-0000-4000-8000-000000000001',
  accountB: '10000000-0000-4000-8000-000000000002',
  selectionA: '20000000-0000-4000-8000-000000000001',
  selectionB: '20000000-0000-4000-8000-000000000002',
  plan0: '30000000-0000-4000-8000-000000000001',
  plan1: '30000000-0000-4000-8000-000000000002',
  goal: '40000000-0000-4000-8000-000000000001',
  history0: '50000000-0000-4000-8000-000000000001',
  history1: '50000000-0000-4000-8000-000000000002',
  diary: '60000000-0000-4000-8000-000000000001',
  slot: '70000000-0000-4000-8000-000000000001',
  snapshot: '71000000-0000-4000-8000-000000000001',
  portion: '72000000-0000-4000-8000-000000000001',
  event: '73000000-0000-4000-8000-000000000001',
  retraction: '73000000-0000-4000-8000-000000000002',
  offer: '74000000-0000-4000-8000-000000000001',
  operation: '75000000-0000-4000-8000-000000000001',
  key: '76000000-0000-4000-8000-000000000001',
};

const today = '2026-09-22';
const week = ['2026-09-21', '2026-09-22', '2026-09-23', '2026-09-24', '2026-09-25', '2026-09-26', '2026-09-27'];

function model(overrides: Partial<AdaptiveNutritionReadModelV1> = {}): AdaptiveNutritionReadModelV1 {
  const planRevision = overrides.planRevision ?? ids.plan0;
  const historyRevision = overrides.historyRevision ?? ids.history0;
  return {
    kind: 'ready', selectionId: ids.selectionA, weekAnchor: week[0], timeZone: 'Europe/Moscow',
    status: 'active', originKind: 'generated', originLineage: {}, planRevision,
    goalRevision: ids.goal, historyRevision, diaryRevision: ids.diary,
    graph: { plan_revision: planRevision, goal_revision: ids.goal, graph_snapshot: { days: week.map((date, index) => ({
      date, slots: index === 1 ? [{ slotId: ids.slot, snapshot: {
        snapshotRevision: ids.snapshot, recipeRevision: null, portionRevision: ids.portion,
      } }] : [],
    })) } },
    events: [], exactOperationId: null, ...overrides,
  };
}

function receipt(outcome: AdaptiveNutritionReceiptV1['outcome'] = 'accepted', digest = 'a'.repeat(64)): AdaptiveNutritionReceiptV1 {
  return {
    kind: 'settled', operationId: ids.operation, idempotencyKey: ids.key,
    digestVersion: 'potok-adaptive-nutrition-canonical-json-v1', requestDigestHex: digest,
    outcome, reason: null, committedAt: '2026-09-22T12:00:00Z',
    result: outcome === 'accepted' ? { contract: 'adaptive-nutrition-receipt-v1', outcome: 'accepted',
      operation_id: ids.operation, selection_id: ids.selectionA,
      plan_revision: ids.plan0, goal_revision: ids.goal, history_revision: ids.history1,
      diary_revision: ids.diary, event_ids: [ids.event] } : null,
  };
}

type Deferred<T> = { promise: Promise<T>; resolve: (value: T) => void };
function deferred<T>(): Deferred<T> {
  let resolve!: (value: T) => void;
  return { promise: new Promise<T>((done) => { resolve = done; }), resolve };
}

function transport(input: {
  current?: () => Promise<ReturnType<typeof model>>;
  mutate?: (raw: string) => Promise<AdaptiveNutritionMutationResult>;
  lookup?: () => Promise<AdaptiveNutritionMutationResult>;
  exact?: (receiptValue: AdaptiveNutritionReceiptV1) => Promise<AdaptiveNutritionReadResult>;
} = {}) {
  let generation = 0;
  const calls = { current: 0, mutate: [] as string[], lookup: [] as string[], exact: 0, end: 0 };
  return {
    calls,
    api: {
      beginSession(accountId: string): AdaptiveNutritionRuntimeSession {
        generation += 1;
        return { accountId, generation };
      },
      endSession() { calls.end += 1; },
      async readCurrent() { calls.current += 1; return input.current ? input.current() : model(); },
      async readExact(_session: AdaptiveNutritionRuntimeSession, _selection: string, value: AdaptiveNutritionReceiptV1) {
        calls.exact += 1;
        return input.exact ? input.exact(value) : model({ exactOperationId: value.operationId });
      },
      async lookup(_session: AdaptiveNutritionRuntimeSession, key: string) {
        calls.lookup.push(key);
        return input.lookup ? input.lookup() : { kind: 'unknown' as const };
      },
      async mutate(_session: AdaptiveNutritionRuntimeSession, raw: string) {
        calls.mutate.push(raw);
        return input.mutate ? input.mutate(raw) : receipt();
      },
    },
  };
}

test('SKIPPED waits for receipt-bound exact read before reporting confirmed', async () => {
  const mock = transport({ exact: async (value) => model({
    historyRevision: ids.history1, exactOperationId: value.operationId,
    events: [{ event_id: ids.event, kind: 'ANNOTATION', slot_id: ids.slot, local_date: today,
      supersedes_event_id: null }],
  }) });
  const controller = new AdaptiveNutritionTodayRuntimeController(mock.api, () => ids.key);
  await controller.start(ids.accountA, ids.selectionA, today);
  await controller.skip(ids.slot);

  assert.equal(controller.snapshot().phase, 'ready');
  assert.equal(controller.snapshot().notice, 'confirmed');
  assert.equal(mock.calls.exact, 1);
  const sent = JSON.parse(mock.calls.mutate[0]) as { action: { type: string }; expected: { accountId: string } };
  assert.equal(sent.action.type, 'SKIPPED');
  assert.equal(sent.expected.accountId, ids.accountA);
});

test('timeout stays UNKNOWN and lookup settles the original key through exact read', async () => {
  let raw = '';
  const mock = transport({ mutate: async (value) => { raw = value; return { kind: 'unknown' }; },
    lookup: async () => receipt('accepted', await adaptiveNutritionSha256HexV1(
      decodeAdaptiveNutritionWireEnvelopeV1(raw).canonicalBytes)) });
  const controller = new AdaptiveNutritionTodayRuntimeController(mock.api, () => ids.key);
  await controller.start(ids.accountA, ids.selectionA, today);
  await controller.skip(ids.slot);
  assert.equal(controller.snapshot().phase, 'unknown');
  assert.equal(controller.snapshot().pending?.idempotencyKey, ids.key);
  assert.equal(mock.calls.mutate[0], controller.snapshot().pending?.rawRequest);

  await controller.resolveUnknown();
  assert.deepEqual(mock.calls.lookup, [ids.key]);
  assert.equal(mock.calls.mutate.length, 1);
  assert.equal(controller.snapshot().phase, 'ready');
  assert.equal(controller.snapshot().notice, 'confirmed');
});

test('confirmed technical and invariant errors stay distinct and discard retryable intent', async () => {
  for (const kind of ['technical-failure', 'server-integrity'] as const) {
    const mock = transport({ mutate: async () => ({ kind }) });
    const controller = new AdaptiveNutritionTodayRuntimeController(mock.api, () => ids.key);
    await controller.start(ids.accountA, ids.selectionA, today);
    await controller.skip(ids.slot);
    assert.equal(controller.snapshot().phase, kind);
    assert.equal(controller.snapshot().pending, null);
    assert.equal(mock.calls.mutate.length, 1);
    assert.deepEqual(mock.calls.lookup, []);
  }
});

test('account switch quarantines dispatched A intent before a late response and never applies it to B', async () => {
  const lateA = deferred<AdaptiveNutritionMutationResult>();
  let raw = '';
  const mock = transport({ mutate: async (value) => { raw = value; return lateA.promise; },
    lookup: async () => receipt('accepted', await adaptiveNutritionSha256HexV1(
      decodeAdaptiveNutritionWireEnvelopeV1(raw).canonicalBytes)) });
  const controller = new AdaptiveNutritionTodayRuntimeController(mock.api, () => ids.key);
  await controller.start(ids.accountA, ids.selectionA, today);
  const submitA = controller.skip(ids.slot);
  await new Promise<void>((resolve) => setImmediate(resolve));
  const originalRaw = mock.calls.mutate[0];

  await controller.start(ids.accountB, ids.selectionB, today);
  lateA.resolve(receipt());
  await submitA;
  assert.equal(controller.snapshot().accountId, ids.accountB);
  assert.notEqual(controller.snapshot().notice, 'confirmed');

  controller.stop();
  await controller.start(ids.accountA, ids.selectionA, today);
  assert.equal(controller.snapshot().phase, 'unknown');
  assert.equal(controller.snapshot().pending?.idempotencyKey, ids.key);
  assert.equal(controller.snapshot().pending?.rawRequest, originalRaw);
  assert.equal(mock.calls.mutate.length, 1);
  await controller.resolveUnknown();
  assert.equal(controller.snapshot().phase, 'ready');
  controller.stop();
});

test('UNKNOWN is quarantined across logout and account switch, then reuses the original A key', async () => {
  let raw = '';
  const mock = transport({ mutate: async (value) => { raw = value; return { kind: 'unknown' }; },
    lookup: async () => receipt('accepted', await adaptiveNutritionSha256HexV1(
      decodeAdaptiveNutritionWireEnvelopeV1(raw).canonicalBytes)) });
  const controller = new AdaptiveNutritionTodayRuntimeController(mock.api, () => ids.key);
  await controller.start(ids.accountA, ids.selectionA, today);
  await controller.skip(ids.slot);
  controller.stop();

  await controller.start(ids.accountB, ids.selectionB, today);
  assert.equal(controller.snapshot().accountId, ids.accountB);
  assert.notEqual(controller.snapshot().phase, 'unknown');
  controller.stop();

  await controller.start(ids.accountA, ids.selectionA, today);
  assert.equal(controller.snapshot().phase, 'unknown');
  assert.equal(controller.snapshot().pending?.idempotencyKey, ids.key);
  await controller.resolveUnknown();
  assert.deepEqual(mock.calls.lookup, [ids.key]);
  assert.equal(controller.snapshot().phase, 'ready');
});

test('failed exact read preserves the byte-identical intent through stop, A→B→A and strict lookup recovery', async () => {
  let raw = '';
  let exactCalls = 0;
  let lookupCalls = 0;
  const mock = transport({
    mutate: async (value) => {
      raw = value;
      const digest = await adaptiveNutritionSha256HexV1(
        decodeAdaptiveNutritionWireEnvelopeV1(raw).canonicalBytes);
      return receipt('accepted', digest);
    },
    exact: async (value) => {
      exactCalls += 1;
      return exactCalls === 1
        ? { kind: 'invalid-server-response' }
        : model({ exactOperationId: value.operationId, historyRevision: ids.history1 });
    },
    lookup: async () => {
      lookupCalls += 1;
      const digest = await adaptiveNutritionSha256HexV1(
        decodeAdaptiveNutritionWireEnvelopeV1(raw).canonicalBytes);
      return lookupCalls === 1
        ? { ...receipt('accepted', digest), idempotencyKey: ids.offer }
        : receipt('accepted', digest);
    },
  });
  const controller = new AdaptiveNutritionTodayRuntimeController(mock.api, () => ids.key);
  await controller.start(ids.accountA, ids.selectionA, today);
  await controller.skip(ids.slot);
  assert.equal(controller.snapshot().phase, 'unknown');
  assert.equal(controller.snapshot().pending?.rawRequest, raw);
  await controller.skip(ids.slot);
  assert.equal(mock.calls.mutate.length, 1);

  controller.stop();
  await controller.start(ids.accountB, ids.selectionB, today);
  assert.notEqual(controller.snapshot().phase, 'unknown');
  controller.stop();
  await controller.start(ids.accountA, ids.selectionA, today);
  assert.equal(controller.snapshot().phase, 'unknown');
  assert.equal(controller.snapshot().pending?.rawRequest, raw);

  await controller.resolveUnknown();
  assert.equal(controller.snapshot().phase, 'unknown');
  assert.equal(controller.snapshot().pending?.rawRequest, raw);
  assert.equal(exactCalls, 1);
  await controller.resolveUnknown();
  assert.equal(controller.snapshot().phase, 'ready');
  assert.equal(controller.snapshot().pending, null);
  assert.equal(exactCalls, 2);
  assert.equal(mock.calls.mutate.length, 1);
  controller.stop();
});

test('thrown mutation, lookup and exact transports keep the account-scoped operation recoverable', async () => {
  let raw = '';
  let mutationAttempts = 0;
  let lookupAttempts = 0;
  let exactAttempts = 0;
  const mock = transport({
    mutate: async (value) => {
      raw = value;
      mutationAttempts += 1;
      throw new Error('mutation response lost');
    },
    lookup: async () => {
      lookupAttempts += 1;
      if (lookupAttempts === 1) throw new Error('lookup response lost');
      const digest = await adaptiveNutritionSha256HexV1(
        decodeAdaptiveNutritionWireEnvelopeV1(raw).canonicalBytes);
      return receipt('accepted', digest);
    },
    exact: async (value) => {
      exactAttempts += 1;
      if (exactAttempts === 1) throw new Error('exact read response lost');
      return model({ exactOperationId: value.operationId, historyRevision: ids.history1 });
    },
  });
  const controller = new AdaptiveNutritionTodayRuntimeController(mock.api, () => ids.key);
  await controller.start(ids.accountA, ids.selectionA, today);
  await controller.skip(ids.slot);
  assert.equal(controller.snapshot().phase, 'unknown');
  assert.equal(controller.snapshot().pending?.rawRequest, raw);
  assert.equal(mutationAttempts, 1);

  await controller.resolveUnknown();
  assert.equal(controller.snapshot().phase, 'unknown');
  await controller.resolveUnknown();
  assert.equal(controller.snapshot().phase, 'unknown');
  assert.equal(controller.snapshot().pending?.rawRequest, raw);

  controller.stop();
  await controller.start(ids.accountB, ids.selectionB, today);
  controller.stop();
  await controller.start(ids.accountA, ids.selectionA, today);
  assert.equal(controller.snapshot().phase, 'unknown');
  await controller.resolveUnknown();
  assert.equal(controller.snapshot().phase, 'ready');
  assert.equal(mutationAttempts, 1);
  assert.equal(lookupAttempts, 3);
  assert.equal(exactAttempts, 2);
  controller.stop();
});

test('stale conflict refreshes but never reports optimistic success', async () => {
  let reads = 0;
  const refreshed = model({ planRevision: ids.plan1 });
  const mock = transport({
    current: async () => (++reads === 1 ? model() : refreshed),
    mutate: async () => ({ kind: 'conflict' }),
  });
  const controller = new AdaptiveNutritionTodayRuntimeController(mock.api, () => ids.key);
  await controller.start(ids.accountA, ids.selectionA, today);
  await controller.skip(ids.slot);
  assert.equal(controller.snapshot().phase, 'conflict');
  assert.equal(controller.snapshot().model?.planRevision, ids.plan1);
  assert.equal(controller.snapshot().notice, null);
  controller.acknowledgeConflict();
  assert.equal(controller.snapshot().phase, 'ready');
});

test('UNDO_ANNOTATION targets only a live own annotation and reconciles receipt', async () => {
  const annotated = model({ events: [{ event_id: ids.event, kind: 'ANNOTATION', slot_id: ids.slot,
    local_date: today, supersedes_event_id: null }] });
  const retracted = model({ historyRevision: ids.history1, exactOperationId: ids.operation,
    events: [...annotated.events, { event_id: ids.retraction, kind: 'ANNOTATION_RETRACTION', slot_id: ids.slot,
      local_date: today, supersedes_event_id: ids.event }] });
  const mock = transport({ current: async () => annotated, exact: async () => retracted });
  const controller = new AdaptiveNutritionTodayRuntimeController(mock.api, () => ids.key);
  await controller.start(ids.accountA, ids.selectionA, today);
  assert.equal(activeAdaptiveNutritionAnnotations(controller.snapshot().model!).length, 1);
  await controller.undoAnnotation(ids.event);
  assert.equal((JSON.parse(mock.calls.mutate[0]) as { action: { type: string } }).action.type, 'UNDO_ANNOTATION');
  assert.equal(activeAdaptiveNutritionAnnotations(controller.snapshot().model!).length, 0);
});

test('REPLACE is inert without an offer and reconciles a server-accepted new plan revision', async () => {
  const replacement = receipt();
  replacement.result = { ...replacement.result, plan_revision: ids.plan1 };
  const mock = transport({ mutate: async () => replacement,
    exact: async () => model({ planRevision: ids.plan1, exactOperationId: ids.operation }) });
  const controller = new AdaptiveNutritionTodayRuntimeController(mock.api, () => ids.key);
  await controller.start(ids.accountA, ids.selectionA, today);
  await controller.replace(ids.slot, null);
  assert.equal(mock.calls.mutate.length, 0);
  await controller.replace(ids.slot, ids.offer);
  const sent = JSON.parse(mock.calls.mutate[0]) as { action: { type: string; replacementOfferId: string } };
  assert.deepEqual(sent.action, { type: 'REPLACE', slot: {
    slotId: ids.slot, date: today, snapshot: {
      snapshotRevision: ids.snapshot, recipeRevision: null, portionRevision: ids.portion,
    },
  }, replacementOfferId: ids.offer });
  assert.equal(controller.snapshot().model?.planRevision, ids.plan1);
});

test('entitlement denial blocks another action and exposes no FACT dispatch API', async () => {
  const mock = transport({ mutate: async () => ({ kind: 'denied' }) });
  const controller = new AdaptiveNutritionTodayRuntimeController(mock.api, () => ids.key);
  await controller.start(ids.accountA, ids.selectionA, today);
  await controller.skip(ids.slot);
  assert.equal(controller.snapshot().phase, 'denied');
  await controller.skip(ids.slot);
  assert.equal(mock.calls.mutate.length, 1);
  assert.equal('consumeAsPlanned' in controller, false);
  assert.equal('consumeModified' in controller, false);
  assert.equal('extraFood' in controller, false);
});

test('A→B switch discards a late A read', async () => {
  const lateA = deferred<AdaptiveNutritionReadModelV1>();
  let reads = 0;
  const modelB = model({ selectionId: ids.selectionB });
  const mock = transport({ current: async () => (++reads === 1 ? lateA.promise : modelB) });
  const controller = new AdaptiveNutritionTodayRuntimeController(mock.api, () => ids.key);
  const startA = controller.start(ids.accountA, ids.selectionA, today);
  await controller.start(ids.accountB, ids.selectionB, today);
  lateA.resolve(model());
  await startA;
  assert.equal(controller.snapshot().accountId, ids.accountB);
  assert.equal(controller.snapshot().model?.selectionId, ids.selectionB);
});
