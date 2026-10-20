import assert from 'node:assert/strict';
import test from 'node:test';
import {
  AdaptiveNutritionReadOnlyEntryController,
} from '../adaptiveNutritionReadOnlyEntry';
import type {
  AdaptiveNutritionDiscoveryResult,
  AdaptiveNutritionPendingGenerationDiscoveryV1,
  AdaptiveNutritionReadSession,
} from '../adaptiveNutritionReadOnlyService';
import type { AdaptiveNutritionReadModelV1, AdaptiveNutritionReadResult } from '../adaptiveNutritionPersistenceService';

const ids = {
  accountA: '11000000-0000-4000-8000-000000000001',
  accountB: '11000000-0000-4000-8000-000000000002',
  selectionA: '22000000-0000-4000-8000-000000000001',
  selectionB: '22000000-0000-4000-8000-000000000002',
  plan: '33000000-0000-4000-8000-000000000001',
  goal: '44000000-0000-4000-8000-000000000001',
  history: '55000000-0000-4000-8000-000000000001',
  diary: '66000000-0000-4000-8000-000000000001',
  slot: '77000000-0000-4000-8000-000000000001',
  snapshot: '88000000-0000-4000-8000-000000000001',
  portion: '99000000-0000-4000-8000-000000000001',
};
const today = '2026-09-22';
const dates = ['2026-09-21', '2026-09-22', '2026-09-23', '2026-09-24', '2026-09-25', '2026-09-26', '2026-09-27'];

function discovery(selectionId = ids.selectionA): AdaptiveNutritionDiscoveryResult {
  return { kind: 'ready', selectionId, weekAnchor: dates[0], timeZone: 'Europe/Moscow',
    status: 'active', contractVersion: 1 };
}

function pendingDiscovery(selectionId = ids.selectionA): AdaptiveNutritionPendingGenerationDiscoveryV1 {
  return { kind: 'pending_generation', selectionId, weekAnchor: dates[0], timeZone: 'Europe/Moscow',
    status: 'pending_generation', contractVersion: 1, goalRevision: ids.goal };
}

function pendingForWeek(
  weekAnchor: string,
  selectionId = ids.selectionA,
): AdaptiveNutritionPendingGenerationDiscoveryV1 {
  return { ...pendingDiscovery(selectionId), weekAnchor };
}

function model(selectionId = ids.selectionA): AdaptiveNutritionReadModelV1 {
  return {
    kind: 'ready', selectionId, weekAnchor: dates[0], timeZone: 'Europe/Moscow', status: 'active',
    originKind: 'generated', originLineage: { source: 'goal-plan-engine-v1' },
    planRevision: ids.plan, goalRevision: ids.goal, historyRevision: ids.history, diaryRevision: ids.diary,
    graph: { plan_revision: ids.plan, goal_revision: ids.goal, graph_snapshot: { days: dates.map((date, index) => ({
      date,
      slots: index === 1 ? [{ slotId: ids.slot, snapshot: {
        snapshotRevision: ids.snapshot, recipeRevision: null, portionRevision: ids.portion,
      } }] : [],
    })) } },
    events: [], exactOperationId: null,
  };
}

function deferred<T>() {
  let resolve!: (value: T) => void;
  const promise = new Promise<T>((done) => { resolve = done; });
  return { promise, resolve };
}

function transport(input: {
  discover?: (session: AdaptiveNutritionReadSession) => Promise<AdaptiveNutritionDiscoveryResult> | AdaptiveNutritionDiscoveryResult;
  read?: (session: AdaptiveNutritionReadSession, selectionId: string) => Promise<AdaptiveNutritionReadResult> | AdaptiveNutritionReadResult;
} = {}) {
  let generation = 0;
  return {
    beginSession(accountId: string) { generation += 1; return { accountId, generation }; },
    endSession() { generation += 1; },
    async discoverCurrent(session: AdaptiveNutritionReadSession) {
      return input.discover ? input.discover(session) : discovery();
    },
    async readCurrent(session: AdaptiveNutritionReadSession, selectionId: string) {
      return input.read ? input.read(session, selectionId) : model(selectionId);
    },
  };
}

test('one discovered selection becomes an exact authoritative read-only week', async () => {
  const api = transport();
  const controller = new AdaptiveNutritionReadOnlyEntryController(api);
  await controller.start(ids.accountA, today, 'Europe/Moscow');
  assert.equal(controller.snapshot().phase, 'ready');
  assert.equal(controller.snapshot().selectionId, ids.selectionA);
  assert.equal(controller.snapshot().weekAnchor, dates[0]);
  assert.equal(controller.snapshot().goalRevision, ids.goal);
  assert.equal(controller.snapshot().slots.length, 1);
  assert.equal('mutate' in api, false);
});

test('pending selection binds selection, week and goal without reading a graph', async () => {
  let reads = 0;
  const api = transport({
    discover: () => pendingDiscovery(),
    read: () => { reads += 1; return model(); },
  });
  const controller = new AdaptiveNutritionReadOnlyEntryController(api);
  await controller.start(ids.accountA, today, 'Europe/Moscow');
  assert.deepEqual(controller.snapshot(), {
    phase: 'pending_generation', accountId: ids.accountA, today, timeZone: 'Europe/Moscow',
    selectionId: ids.selectionA, weekAnchor: dates[0], goalRevision: ids.goal,
    model: null, slots: [],
  });
  assert.equal(reads, 0);
  assert.equal('mutate' in api, false);
});

test('pending rejects past and future weeks and clears their binding without graph reads', async () => {
  let result = pendingForWeek('2026-10-12');
  let reads = 0;
  const controller = new AdaptiveNutritionReadOnlyEntryController(transport({
    discover: () => result,
    read: () => { reads += 1; return model(); },
  }));
  await controller.start(ids.accountA, '2026-10-12', 'Europe/Moscow');
  assert.equal(controller.snapshot().phase, 'pending_generation');
  for (const weekAnchor of ['2026-10-05', '2026-10-19']) {
    result = pendingForWeek(weekAnchor);
    await controller.start(ids.accountA, '2026-10-12', 'Europe/Moscow');
    assert.deepEqual(controller.snapshot(), {
      phase: 'unavailable', accountId: ids.accountA, today: '2026-10-12', timeZone: 'Europe/Moscow',
      selectionId: null, weekAnchor: null, goalRevision: null, model: null, slots: [],
    });
  }
  assert.equal(reads, 0);
});

test('pending current week follows civil Sunday to Monday and year boundaries', async () => {
  for (const [currentDay, weekAnchor] of [
    ['2027-01-03', '2026-12-28'],
    ['2027-01-04', '2027-01-04'],
  ] as const) {
    let reads = 0;
    const controller = new AdaptiveNutritionReadOnlyEntryController(transport({
      discover: () => pendingForWeek(weekAnchor),
      read: () => { reads += 1; return model(); },
    }));
    await controller.start(ids.accountA, currentDay, 'Europe/Moscow');
    assert.equal(controller.snapshot().phase, 'pending_generation');
    assert.equal(controller.snapshot().weekAnchor, weekAnchor);
    assert.equal(reads, 0);
  }
});

test('invalid today fails pending closed without throwing or retaining metadata', async () => {
  const controller = new AdaptiveNutritionReadOnlyEntryController(transport({
    discover: () => pendingDiscovery(),
  }));
  await assert.doesNotReject(controller.start(ids.accountA, '2026-02-30', 'Europe/Moscow'));
  assert.deepEqual(controller.snapshot(), {
    phase: 'unavailable', accountId: ids.accountA, today: '2026-02-30', timeZone: 'Europe/Moscow',
    selectionId: null, weekAnchor: null, goalRevision: null, model: null, slots: [],
  });
});

test('pending becomes ready only after a new explicit start and confirmed discovery/read', async () => {
  let pending = true;
  let discoveries = 0;
  let reads = 0;
  const controller = new AdaptiveNutritionReadOnlyEntryController(transport({
    discover: () => { discoveries += 1; return pending ? pendingDiscovery() : discovery(); },
    read: () => { reads += 1; return model(); },
  }));
  await controller.start(ids.accountA, today, 'Europe/Moscow');
  assert.equal(controller.snapshot().phase, 'pending_generation');
  assert.equal(reads, 0);
  pending = false;
  assert.equal(controller.snapshot().phase, 'pending_generation');
  await controller.start(ids.accountA, today, 'Europe/Moscow');
  assert.equal(controller.snapshot().phase, 'ready');
  assert.equal(discoveries, 2);
  assert.equal(reads, 1);
});

test('pending clears a previous ready model and slots', async () => {
  let result: AdaptiveNutritionDiscoveryResult = discovery();
  const controller = new AdaptiveNutritionReadOnlyEntryController(transport({ discover: () => result }));
  await controller.start(ids.accountA, today, 'Europe/Moscow');
  assert.equal(controller.snapshot().phase, 'ready');
  result = pendingDiscovery();
  await controller.start(ids.accountA, today, 'Europe/Moscow');
  assert.equal(controller.snapshot().phase, 'pending_generation');
  assert.equal(controller.snapshot().model, null);
  assert.deepEqual(controller.snapshot().slots, []);
});

test('no active plan and ambiguous discovery do not fall back to a plan', async () => {
  for (const kind of ['no_active_plan', 'ambiguous'] as const) {
    const controller = new AdaptiveNutritionReadOnlyEntryController(transport({
      discover: () => ({ kind }),
    }));
    await controller.start(ids.accountA, today, 'Europe/Moscow');
    assert.equal(controller.snapshot().phase, kind);
    assert.equal(controller.snapshot().model, null);
    assert.deepEqual(controller.snapshot().slots, []);
  }
});

test('discovery/read disagreement fails closed', async () => {
  const controller = new AdaptiveNutritionReadOnlyEntryController(transport({
    read: () => model(ids.selectionB),
  }));
  await controller.start(ids.accountA, today, 'Europe/Moscow');
  assert.equal(controller.snapshot().phase, 'unavailable');
  assert.equal(controller.snapshot().model, null);
});

test('A to B switch discards a late A discovery response', async () => {
  const lateA = deferred<AdaptiveNutritionDiscoveryResult>();
  const api = transport({
    discover: (session) => session.accountId === ids.accountA ? lateA.promise : discovery(ids.selectionB),
    read: (_session, selectionId) => model(selectionId),
  });
  const controller = new AdaptiveNutritionReadOnlyEntryController(api);
  const startA = controller.start(ids.accountA, today, 'Europe/Moscow');
  await controller.start(ids.accountB, today, 'Europe/Moscow');
  lateA.resolve(discovery(ids.selectionA));
  await startA;
  assert.equal(controller.snapshot().accountId, ids.accountB);
  assert.equal(controller.snapshot().selectionId, ids.selectionB);
});

test('A to B switch and stop discard late pending responses', async () => {
  const lateA = deferred<AdaptiveNutritionDiscoveryResult>();
  const lateB = deferred<AdaptiveNutritionDiscoveryResult>();
  const api = transport({
    discover: (session) => session.accountId === ids.accountA ? lateA.promise : lateB.promise,
  });
  const controller = new AdaptiveNutritionReadOnlyEntryController(api);
  const startA = controller.start(ids.accountA, today, 'Europe/Moscow');
  const startB = controller.start(ids.accountB, today, 'Europe/Moscow');
  lateA.resolve(pendingDiscovery(ids.selectionA));
  await startA;
  assert.equal(controller.snapshot().accountId, ids.accountB);
  assert.equal(controller.snapshot().selectionId, null);
  controller.stop();
  lateB.resolve(pendingDiscovery(ids.selectionB));
  await startB;
  assert.deepEqual(controller.snapshot(), {
    phase: 'idle', accountId: null, today: null, timeZone: null, selectionId: null,
    weekAnchor: null, goalRevision: null, model: null, slots: [],
  });
});
