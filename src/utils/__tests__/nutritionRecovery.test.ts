import assert from 'node:assert/strict';
import test from 'node:test';
import type { NutritionDomainCommand, NutritionPlanReadModel } from '../../types/nutritionPersistence';
import { beginNutritionRead, createNutritionRecovery, nutritionRecoveryView, receiveNutritionOutcome, receiveNutritionRead,
  resetNutritionRecovery, reviewNutritionRecoveryCommand, simulateNutritionAttempt, simulateNutritionRetry, nutritionRecoveryPreviewView,
  timeoutNutritionAttempt, type NutritionRecoveryState } from '../nutritionRecovery';

const binding = { accountId: 'fixture-A', planId: 'fixture-plan', weekAnchor: '2026-09-14', timeZone: 'Europe/Moscow', today: '2026-09-16' };
function model(planRevision = 'opaque-plan-alpha', goalRevision = 'opaque-goal-alpha'): NutritionPlanReadModel {
  return { context: { accountId: binding.accountId, planId: binding.planId, weekAnchor: binding.weekAnchor,
    timeZone: binding.timeZone, planRevision, goalRevision }, status: 'active', slots: [{ date: binding.today, slotId: 'lunch',
    snapshot: { recipeId: 'fixture-recipe', recipeRevision: 'recipe-alpha', snapshotRevision: 'snapshot-alpha', portionRevision: 'portion-alpha',
      servings: 1, foods: [{ foodRef: 'synthetic-test-reference', name: 'Synthetic food', amount: 100, unit: 'g', state: 'raw',
        nutrition: { calories: 100, protein: 10, fat: 5, carbs: 20 } }] } }] };
}
function load(state = createNutritionRecovery(binding), value = model()) {
  const reading = beginNutritionRead(state);
  return receiveNutritionRead(reading, reading.readTicket!, { kind: 'success', model: value });
}
function command(state: NutritionRecoveryState, idempotencyKey = 'fixture-key'): NutritionDomainCommand {
  const snapshot = state.model!.slots[0].snapshot;
  return { type: 'MEAL', action: 'CONSUMED_AS_PLANNED', expected: structuredClone(state.model!.context),
    expectedLocalSequence: 0, idempotencyKey, date: binding.today, slotId: 'lunch', expectedSnapshot: {
      snapshotRevision: snapshot.snapshotRevision, recipeRevision: snapshot.recipeRevision, portionRevision: snapshot.portionRevision } };
}
function startAttempt(state = load(), cmd = command(state)) {
  const reviewed = reviewNutritionRecoveryCommand(state, cmd);
  return simulateNutritionAttempt(reviewed, { fingerprint: reviewed.pending!.fingerprint, explicitConfirmation: true });
}
function accepted(state: NutritionRecoveryState, revision = model().context) {
  const op = state.operation!;
  return receiveNutritionOutcome(state, op.ticket, { accountId: binding.accountId, planId: binding.planId,
    idempotencyKey: op.command.idempotencyKey, fingerprint: op.fingerprint, outcome: 'accepted', revision });
}

test('new recovery binding validates calendar, timezone and account without creating a server revision', () => {
  for (const changes of [{ accountId: '' }, { planId: '' }, { timeZone: 'invalid/zone' },
    { weekAnchor: '2026-09-15' }, { today: '2026-02-30' }]) {
    assert.throws(() => createNutritionRecovery({ ...binding, ...changes }));
  }
  const empty = createNutritionRecovery(binding);
  assert.equal(empty.model, null);
  assert.deepEqual(empty.observed, []);
  assert.equal(empty.requiredReadRevision, null);
});

test('only latest requested read may update model; late success/failure is ignored', () => {
  const first = beginNutritionRead(createNutritionRecovery(binding));
  const second = beginNutritionRead(first);
  const before = structuredClone(second);
  assert.equal(receiveNutritionRead(second, first.readTicket!, { kind: 'success', model: model() }), second);
  assert.equal(receiveNutritionRead(second, first.readTicket!, { kind: 'failed' }), second);
  assert.deepEqual(second, before);
  const ready = receiveNutritionRead(second, second.readTicket!, { kind: 'success', model: model() });
  assert.equal(ready.status, 'ready');
  assert.equal(nutritionRecoveryView(ready, binding).canSubmit, false);
});

test('A→B→A session reset rejects old tickets and immediately hides foreign data', () => {
  const first = beginNutritionRead(load());
  const b = { ...binding, accountId: 'fixture-B' };
  assert.deepEqual(nutritionRecoveryView(first, b), { status: 'empty', model: null, outcome: null, canSubmit: false });
  const switched = resetNutritionRecovery(first, b).state;
  const back = beginNutritionRead(resetNutritionRecovery(switched, binding).state);
  assert.equal(receiveNutritionRead(back, first.readTicket!, { kind: 'success', model: model() }), back);
  assert.equal(back.model, null);
  assert.equal(back.session, 2);
});

test('foreign account/plan/week/timezone and malformed responses fail closed', () => {
  for (const key of ['accountId', 'planId', 'weekAnchor', 'timeZone'] as const) {
    const reading = beginNutritionRead(load()); const foreign = model(); foreign.context[key] = 'foreign';
    const next = receiveNutritionRead(reading, reading.readTicket!, { kind: 'success', model: foreign });
    assert.equal(next.status, 'conflict', key); assert.equal(next.model, null);
  }
  const reading = beginNutritionRead(load()); const incomplete = model(); incomplete.slots[0].snapshot.foods = [];
  assert.equal(receiveNutritionRead(reading, reading.readTicket!, { kind: 'success', model: incomplete }).status, 'conflict');
});

test('identical refresh preserves review; changed goal/plan revision invalidates it', () => {
  const base = load(); const reviewed = reviewNutritionRecoveryCommand(base, command(base));
  assert.deepEqual(load(reviewed).pending, reviewed.pending);
  for (const updated of [model('new-plan'), model('opaque-plan-alpha', 'new-goal')]) {
    const next = load(reviewed, updated);
    assert.equal(next.status, 'ready'); assert.equal(next.pending, null);
    assert.throws(() => simulateNutritionAttempt(next, { fingerprint: reviewed.pending!.fingerprint, explicitConfirmation: true }), /confirmation/);
  }
});

test('same revision with changed graph/snapshot content conflicts; known retired revisions never return', () => {
  const base = load();
  const changed = model(); changed.slots[0].snapshot.foods[0].amount = 200;
  assert.equal(load(base, changed).status, 'conflict');
  changed.context.planRevision = 'new-plan';
  assert.equal(load(base, changed).status, 'conflict'); // Same snapshot revision, different content.
  const advanced = load(base, model('z-revision'));
  assert.equal(advanced.status, 'ready');
  assert.equal(load(advanced, model()).status, 'conflict');
  assert.equal(load(advanced, model('a-unseen-revision')).status, 'ready'); // No invented lexical ordering.
});

test('failed refresh removes clickable model and pending review without assuming an operation failed', () => {
  const active = startAttempt(); const reading = beginNutritionRead(active);
  const failed = receiveNutritionRead(reading, reading.readTicket!, { kind: 'failed' });
  assert.equal(failed.model, null); assert.equal(failed.pending, null);
  assert.equal(failed.status, 'unavailable'); assert.equal(failed.operation!.status, 'awaiting-outcome');
});

test('timeout means unknown; model refresh never proves mutation success or rejection', () => {
  const active = startAttempt(); const unknown = timeoutNutritionAttempt(active, active.operation!.ticket);
  assert.equal(unknown.operation!.status, 'outcome-unknown');
  const refreshed = load(unknown, model('new-read-revision'));
  assert.equal(refreshed.operation!.status, 'outcome-unknown');
  assert.throws(() => reviewNutritionRecoveryCommand(refreshed, command(refreshed, 'different-key')), /not_ready/);
  assert.deepEqual(active.model, load().model);
  assert.equal(active.networkWritesEnabled, false);
});

test('explicit retry preserves original payload, key and expected revisions after a new read', () => {
  const active = startAttempt(); const original = structuredClone(active.operation!.command);
  const refreshed = load(timeoutNutritionAttempt(active, active.operation!.ticket), model('new-read-revision'));
  assert.throws(() => simulateNutritionRetry(refreshed, false as unknown as true), /retry/);
  const retry = simulateNutritionRetry(refreshed, true);
  assert.deepEqual(retry.operation!.command, original);
  assert.equal(retry.operation!.ticket.idempotencyKey, active.operation!.ticket.idempotencyKey);
  assert.notEqual(retry.operation!.ticket.attempt, active.operation!.ticket.attempt);
  assert.equal(receiveNutritionOutcome(retry, active.operation!.ticket, { accountId: binding.accountId, planId: binding.planId,
    idempotencyKey: original.idempotencyKey, fingerprint: active.operation!.fingerprint, outcome: 'conflict' }), retry);
});

test('wrong account, payload, key or revision receipts cannot settle an unknown outcome', () => {
  const active = startAttempt(); const op = active.operation!;
  for (const changes of [{ accountId: 'foreign' }, { planId: 'foreign' }, { idempotencyKey: 'foreign' }, { fingerprint: 'wrong' }]) {
    const next = receiveNutritionOutcome(active, op.ticket, { accountId: binding.accountId, planId: binding.planId,
      idempotencyKey: op.command.idempotencyKey, fingerprint: op.fingerprint, outcome: 'accepted', revision: model().context, ...changes });
    assert.equal(next.operation!.status, 'outcome-unknown');
  }
  assert.equal(accepted(active, { ...model().context, goalRevision: 'changed-goal' }).operation!.status, 'outcome-unknown');
});

test('accepted receipt requires matching fresh read; it does not manufacture diary facts or a graph', () => {
  const active = startAttempt(); const waiting = accepted(active);
  assert.equal(waiting.operation!.status, 'accepted'); assert.equal(waiting.model, null);
  assert.equal(waiting.status, 'empty');
  assert.equal(load(waiting, model('unproven-successor')).status, 'conflict');
  const refreshed = load(waiting);
  assert.equal(refreshed.status, 'ready'); assert.equal(refreshed.requiredReadRevision, null);
  assert.throws(() => reviewNutritionRecoveryCommand(refreshed, command(refreshed)), /existing_operation/);
  assert.equal(nutritionRecoveryView(refreshed, binding).canSubmit, false);
});

test('accepted replacement must return a new revision and its exact confirmed snapshot', () => {
  const base = load(); const c = command(base);
  const replacement = structuredClone(base.model!.slots[0].snapshot);
  replacement.recipeId = 'new-recipe'; replacement.recipeRevision = 'new-recipe-revision';
  replacement.snapshotRevision = 'new-snapshot'; replacement.portionRevision = 'new-portion';
  const cmd: NutritionDomainCommand = { type: 'REPLACE', expected: c.expected, expectedLocalSequence: 0, idempotencyKey: 'replace-key',
    date: binding.today, slotId: 'lunch', expectedSnapshot: 'expectedSnapshot' in c ? c.expectedSnapshot : replacement, replacement };
  const active = startAttempt(base, cmd);
  assert.equal(accepted(active).operation!.status, 'outcome-unknown');
  const nextModel = model('replacement-revision'); nextModel.slots[0].snapshot = replacement;
  const waiting = accepted(active, nextModel.context);
  assert.equal(load(waiting, model('replacement-revision')).status, 'conflict');
  const reconciled = load(waiting, nextModel);
  assert.equal(reconciled.status, 'ready');
  assert.equal(reconciled.model!.slots[0].snapshot.recipeId, 'new-recipe');
});

test('conflict discards review/model and requires refresh; it never rebases the command automatically', () => {
  const active = startAttempt(); const op = active.operation!;
  const conflicted = receiveNutritionOutcome(active, op.ticket, { accountId: binding.accountId, planId: binding.planId,
    idempotencyKey: op.command.idempotencyKey, fingerprint: op.fingerprint, outcome: 'conflict' });
  assert.equal(conflicted.status, 'conflict'); assert.equal(conflicted.model, null);
  assert.equal(conflicted.operation!.status, 'conflict');
  const refreshed = load(conflicted, model('new-read'));
  assert.equal(refreshed.pending, null);
  assert.deepEqual(refreshed.operation!.command, op.command);
  assert.throws(() => simulateNutritionRetry(refreshed, true), /unknown/);
});

test('late pre-outcome read cannot overwrite receipt requirements', () => {
  const reading = beginNutritionRead(startAttempt()); const ticket = reading.readTicket!;
  const waiting = accepted(reading);
  assert.equal(receiveNutritionRead(waiting, ticket, { kind: 'success', model: model() }), waiting);
});

test('account reset surfaces detached unresolved operation instead of silently calling it a failure', () => {
  const active = startAttempt(); const before = structuredClone(active);
  const reset = resetNutritionRecovery(active, { ...binding, accountId: 'fixture-B' });
  assert.equal(reset.detachedOperation!.status, 'outcome-unknown');
  assert.equal(reset.detachedOperation!.command.expected.accountId, binding.accountId);
  assert.equal(reset.state.operation, null); assert.equal(reset.state.model, null);
  assert.deepEqual(active, before);
  assert.equal(nutritionRecoveryView(reset.state, reset.state.binding).outcome, null);
});

test('tampered command or changed reviewed content cannot start an attempt', () => {
  const base = load(); const reviewed = reviewNutritionRecoveryCommand(base, command(base));
  const altered = structuredClone(reviewed); altered.pending!.command.idempotencyKey = 'changed';
  assert.throws(() => simulateNutritionAttempt(altered, { fingerprint: reviewed.pending!.fingerprint, explicitConfirmation: true }), /changed/);
  const changedModel = structuredClone(reviewed); changedModel.model!.slots[0].snapshot.foods[0].amount = 150;
  assert.throws(() => simulateNutritionAttempt(changedModel, { fingerprint: reviewed.pending!.fingerprint, explicitConfirmation: true }), /changed/);
  assert.throws(() => simulateNutritionAttempt(reviewed, { fingerprint: reviewed.pending!.fingerprint, explicitConfirmation: false as unknown as true }), /confirmation/);
});

test('timezone, day and week changes invalidate old reads/outcomes without losing the unresolved operation', () => {
  for (const nextBinding of [{ ...binding, timeZone: 'Europe/Berlin' }, { ...binding, today: '2026-09-17' },
    { ...binding, today: '2026-09-21', weekAnchor: '2026-09-21' }]) {
    const active = beginNutritionRead(startAttempt());
    const reset = resetNutritionRecovery(active, nextBinding);
    const reading = beginNutritionRead(reset.state);
    assert.equal(receiveNutritionRead(reading, active.readTicket!, { kind: 'success', model: model() }), reading);
    const op = active.operation!;
    assert.equal(receiveNutritionOutcome(reading, op.ticket, { accountId: binding.accountId, planId: binding.planId,
      idempotencyKey: op.command.idempotencyKey, fingerprint: op.fingerprint, outcome: 'accepted', revision: model().context }), reading);
    assert.equal(reset.detachedOperation?.status, 'outcome-unknown');
    assert.equal(nutritionRecoveryView(active, nextBinding).model, null);
  }
});

test('preview controls require matching plan/goal revisions and a resolved result', () => {
  const state = load(); const expected = { planRevision: model().context.planRevision, goalRevision: model().context.goalRevision };
  assert.equal(nutritionRecoveryPreviewView(state, binding, expected).canReview, true);
  for (const changes of [{ planRevision: 'old-plan' }, { goalRevision: 'old-goal' }]) {
    assert.equal(nutritionRecoveryPreviewView(state, binding, { ...expected, ...changes }).phase, 'revision-mismatch');
  }
  const active = startAttempt(state); const unknown = timeoutNutritionAttempt(active, active.operation!.ticket);
  assert.equal(nutritionRecoveryPreviewView(unknown, binding, expected).phase, 'outcome-unknown');
  assert.equal(nutritionRecoveryPreviewView(accepted(active), binding, expected).phase, 'refresh-required');
  assert.equal(nutritionRecoveryPreviewView(unknown, { ...binding, accountId: 'other' }, expected).phase, 'empty');
});

test('A→B→A retains unresolved work, prevents a new key and retries the original command under a fresh session', () => {
  const active = startAttempt(); const original = structuredClone(active.operation!.command);
  const otherBinding = { ...binding, accountId: 'fixture-B' };
  const other = resetNutritionRecovery(active, otherBinding).state;
  assert.equal(nutritionRecoveryView(other, otherBinding).outcome, null);
  const back = load(resetNutritionRecovery(other, binding).state);
  assert.equal(back.operation!.status, 'outcome-unknown');
  assert.throws(() => reviewNutritionRecoveryCommand(back, command(back, 'new-key')), /not_ready/);
  const retry = simulateNutritionRetry(back, true);
  assert.deepEqual(retry.operation!.command, original);
  assert.equal(retry.operation!.ticket.session, 2);
  assert.notEqual(retry.operation!.ticket.session, active.operation!.ticket.session);
  assert.equal(retry.detachedOperations.length, 0);
});

test('unresolved action from another week/timezone stays quarantined and cannot authorize a new action', () => {
  const active = startAttempt(); const nextBinding = { ...binding, timeZone: 'Europe/Berlin' };
  const reset = resetNutritionRecovery(active, nextBinding).state;
  const nextModel = model(); nextModel.context.timeZone = nextBinding.timeZone;
  const loaded = load(reset, nextModel);
  assert.equal(loaded.operation, null);
  assert.equal(loaded.detachedOperations.length, 1);
  assert.equal(nutritionRecoveryView(loaded, nextBinding).outcome, 'outcome-unknown');
  assert.throws(() => reviewNutritionRecoveryCommand(loaded, command(loaded, 'new-key')), /not_ready/);
});

test('settled idempotency keys remain account scoped across a session reset', () => {
  const done = load(accepted(startAttempt()));
  const back = load(resetNutritionRecovery(done, binding).state);
  assert.throws(() => reviewNutritionRecoveryCommand(back, command(back)), /existing_operation/);
  const otherBinding = { ...binding, accountId: 'fixture-B' };
  const otherModel = model(); otherModel.context.accountId = otherBinding.accountId;
  const other = load(resetNutritionRecovery(done, otherBinding).state, otherModel);
  assert.doesNotThrow(() => reviewNutritionRecoveryCommand(other, command(other)));
});
