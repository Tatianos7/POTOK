import assert from 'node:assert/strict';
import test from 'node:test';
import type { NutritionDomainCommand, NutritionPlanReadModel, NutritionPortionSnapshot,
  NutritionSimulationState, NutritionSnapshotRevision } from '../../types/nutritionPersistence';
import { createNutritionSimulation, effectiveSimulatedDiary, effectiveSimulatedSkips, getSimulationShoppingSelection,
  nutritionCommandFingerprint, reduceNutritionSimulation, simulationShoppingRevision } from '../nutritionPersistence';

const current = { accountId: 'fixture-account', today: '2026-09-16' };
function snapshot(id = 'original', amount = 100): NutritionPortionSnapshot {
  return { recipeId: id, recipeRevision: `${id}-recipe-v1`, snapshotRevision: `${id}-snapshot-v1`, portionRevision: `${id}-portion-v1`, servings: 1,
    foods: [{ foodRef: 'synthetic-test-food-reference', name: 'Synthetic food', amount, unit: 'g', state: 'raw',
      nutrition: { calories: amount, protein: amount / 10, fat: amount / 20, carbs: amount / 5 } }] };
}
function graph(): NutritionPlanReadModel {
  return { context: { accountId: current.accountId, planId: 'fixture-plan', planRevision: 'server-read-plan-v1',
    goalRevision: 'server-read-goal-v1', weekAnchor: '2026-09-14', timeZone: 'Europe/Moscow' }, status: 'active',
    slots: [{ date: current.today, slotId: 'lunch', snapshot: snapshot() },
      { date: '2026-09-17', slotId: 'lunch', snapshot: snapshot() }] };
}
const start = () => createNutritionSimulation(graph(), current.accountId, current.today);
const revision = (s: NutritionPortionSnapshot): NutritionSnapshotRevision => ({ snapshotRevision: s.snapshotRevision,
  recipeRevision: s.recipeRevision, portionRevision: s.portionRevision });
const envelope = (s: NutritionSimulationState, id = `fixture-key-${s.localSequence}`) => ({ expected: structuredClone(s.graph.context),
  idempotencyKey: id, expectedLocalSequence: s.localSequence });
function meal(s: NutritionSimulationState, action: 'CONSUMED_AS_PLANNED' | 'SKIPPED' = 'CONSUMED_AS_PLANNED'): NutritionDomainCommand {
  return { ...envelope(s), type: 'MEAL', action, date: current.today, slotId: 'lunch', expectedSnapshot: revision(s.graph.slots[0].snapshot) };
}
function confirm(s: NutritionSimulationState, command: NutritionDomainCommand) {
  const proposed = reduceNutritionSimulation(s, { type: 'PROPOSE', command }, current);
  const previewed = reduceNutritionSimulation(proposed, { type: 'PREVIEW' }, current);
  return reduceNutritionSimulation(previewed, { type: 'CONFIRM', idempotencyKey: command.idempotencyKey,
    previewFingerprint: previewed.pending!.fingerprint, explicitConfirmation: true }, current);
}
function replacement(s: NutritionSimulationState): NutritionDomainCommand {
  return { ...envelope(s), type: 'REPLACE', date: current.today, slotId: 'lunch',
    expectedSnapshot: revision(s.graph.slots[0].snapshot), replacement: snapshot('replacement', 150) };
}

test('PLAN is never FACT; propose/preview do not append history or change plan', () => {
  const s = start(); const before = structuredClone(s);
  const proposed = reduceNutritionSimulation(s, { type: 'PROPOSE', command: meal(s) }, current);
  assert.equal(proposed.pending?.stage, 'proposed');
  const previewed = reduceNutritionSimulation(proposed, { type: 'PREVIEW' }, current);
  assert.equal(previewed.pending?.stage, 'previewed');
  assert.deepEqual(effectiveSimulatedDiary(previewed), []);
  assert.deepEqual(previewed.graph, s.graph);
  assert.deepEqual(s, before);
  assert.equal(reduceNutritionSimulation(previewed, { type: 'CANCEL' }, current).pending, null);
});

test('as-planned confirmation copies exact recipe/portion snapshot and never mutates source', () => {
  const s = start(); const before = structuredClone(s);
  const result = confirm(s, meal(s));
  assert.equal(result.mode, 'local-simulation');
  assert.equal(result.networkWritesEnabled, false);
  assert.deepEqual(result.history[0].effect, { kind: 'diary-snapshot', date: current.today, slotId: 'lunch',
    snapshot: s.graph.slots[0].snapshot, supersedes: null });
  assert.deepEqual(result.graph, s.graph);
  assert.deepEqual(s, before);
  result.graph.slots[0].snapshot.foods[0].amount = 999;
  const fact = effectiveSimulatedDiary(result)[0].effect;
  assert.equal(fact.kind === 'diary-snapshot' && fact.snapshot.foods[0].amount, 100);
});

test('modified meal uses actual payload exclusively; no planned amount default', () => {
  const s = start();
  const command: NutritionDomainCommand = { ...envelope(s), type: 'MEAL', action: 'CONSUMED_MODIFIED',
    date: current.today, slotId: 'lunch', expectedSnapshot: revision(s.graph.slots[0].snapshot), actual: snapshot('actual', 40) };
  const result = confirm(s, command);
  const fact = effectiveSimulatedDiary(result)[0].effect;
  assert.equal(fact.kind === 'diary-snapshot' && fact.snapshot.foods[0].amount, 40);
  assert.equal(result.graph.slots[0].snapshot.foods[0].amount, 100);
  const missing = { ...command } as Partial<typeof command>;
  delete missing.actual;
  assert.throws(() => confirm(s, missing as NutritionDomainCommand), /snapshot/);
});

test('skip is annotation only; extra food is independent and never compensates tomorrow', () => {
  const s = start(); const before = structuredClone(s.graph);
  const skipped = confirm(s, meal(s, 'SKIPPED'));
  assert.equal(skipped.history[0].effect.kind, 'skip-annotation');
  assert.deepEqual(effectiveSimulatedDiary(skipped), []);
  const extra = confirm(skipped, { ...envelope(skipped), type: 'MEAL', action: 'EXTRA_FOOD', date: current.today,
    slotId: null, actual: snapshot('extra', 70) });
  const fact = effectiveSimulatedDiary(extra)[0].effect;
  assert.equal(fact.kind, 'diary-snapshot');
  assert.equal(fact.slotId, null);
  assert.deepEqual(extra.graph, before);
  assert.equal(extra.localPlanSequence, 0);
});

test('confirmation without reviewed preview or explicit consent fails atomically', () => {
  const s = start(); const command = meal(s);
  const proposed = reduceNutritionSimulation(s, { type: 'PROPOSE', command }, current);
  const before = structuredClone(proposed);
  assert.throws(() => reduceNutritionSimulation(proposed, { type: 'CONFIRM', idempotencyKey: command.idempotencyKey,
    previewFingerprint: proposed.pending!.fingerprint, explicitConfirmation: true }, current), /preview/);
  const previewed = reduceNutritionSimulation(proposed, { type: 'PREVIEW' }, current);
  assert.throws(() => reduceNutritionSimulation(previewed, { type: 'CONFIRM', idempotencyKey: command.idempotencyKey,
    previewFingerprint: proposed.pending!.fingerprint, explicitConfirmation: false as unknown as true }, current), /explicit/);
  assert.deepEqual(proposed, before);
});

test('exact retries are idempotent; changed payload under the same key conflicts', () => {
  const s = start(); const command = meal(s); const result = confirm(s, command);
  assert.equal(reduceNutritionSimulation(result, { type: 'PROPOSE', command: structuredClone(command) }, current), result);
  assert.equal(reduceNutritionSimulation(result, { type: 'CONFIRM', idempotencyKey: command.idempotencyKey,
    previewFingerprint: nutritionCommandFingerprint(command), explicitConfirmation: true }, current), result);
  assert.throws(() => reduceNutritionSimulation(result, { type: 'PROPOSE', command: { ...command, action: 'SKIPPED' } as NutritionDomainCommand }, current), /idempotency/);
  assert.equal(result.history.length, 1);
  assert.throws(() => confirm(result, meal(result)), /already_consumed/);
});

test('account, plan, goal, anchor and timezone mismatches reject before any local effect', () => {
  const s = start();
  for (const key of ['accountId', 'planId', 'planRevision', 'goalRevision', 'weekAnchor', 'timeZone'] as const) {
    const command = meal(s); command.expected[key] = 'different';
    assert.throws(() => confirm(s, command), /revision_conflict/, key);
  }
  assert.throws(() => reduceNutritionSimulation(s, { type: 'PROPOSE', command: meal(s) }, { ...current, accountId: 'other' }), /account/);
  assert.deepEqual(s.history, []);
});

test('concurrent local commands and stale snapshot/portion/recipe revisions fail closed', () => {
  const s = start(); const old = replacement(s); const updated = confirm(s, meal(s, 'SKIPPED'));
  old.idempotencyKey = 'concurrent-other-command';
  assert.throws(() => confirm(updated, old), /revision_conflict/);
  for (const key of ['snapshotRevision', 'recipeRevision', 'portionRevision'] as const) {
    const command = meal(s);
    if ('expectedSnapshot' in command) command.expectedSnapshot[key] = 'stale';
    assert.throws(() => confirm(s, command), /snapshot_conflict/);
  }
});

test('future consumption and provisional next week are rejected; civil week respects DST', () => {
  const s = start(); const command = meal(s);
  assert.throws(() => confirm(s, { ...command, date: '2026-09-17' } as NutritionDomainCommand), /future/);
  assert.throws(() => createNutritionSimulation({ ...graph(), status: 'provisional' }, current.accountId, current.today), /inactive/);
  assert.throws(() => reduceNutritionSimulation(s, { type: 'CANCEL' }, { ...current, today: '2026-09-21' }), /inactive/);
  const dst = graph(); dst.context.weekAnchor = '2026-03-23'; dst.context.timeZone = 'Europe/Berlin'; dst.slots = [];
  assert.doesNotThrow(() => createNutritionSimulation(dst, current.accountId, '2026-03-29'));
  dst.context.timeZone = 'invalid/zone';
  assert.throws(() => createNutritionSimulation(dst, current.accountId, '2026-03-29'), /timezone/);
});

test('replacement changes PLAN only after confirmation; shopping rejects old revision', () => {
  const s = start(); const oldRevision = simulationShoppingRevision(s); const command = replacement(s);
  const proposed = reduceNutritionSimulation(s, { type: 'PROPOSE', command }, current);
  const selection = getSimulationShoppingSelection(proposed, { ...current, expectedRevision: oldRevision });
  assert.equal(selection.slots[0].snapshot.recipeId, 'original');
  const result = confirm(s, command);
  assert.equal(effectiveSimulatedDiary(result).length, 0);
  assert.equal(result.graph.context.planRevision, s.graph.context.planRevision); // Never fabricate a server token.
  assert.equal(result.localPlanSequence, 1);
  assert.throws(() => getSimulationShoppingSelection(result, { ...current, expectedRevision: oldRevision }), /shopping_revision/);
  const next = getSimulationShoppingSelection(result, { ...current, expectedRevision: simulationShoppingRevision(result) });
  assert.equal(next.slots[0].snapshot.recipeId, 'replacement');
  assert.equal(next.slots[0].snapshot.foods[0].amount, 150);
  assert.equal(next.slots[1].snapshot.recipeId, 'original');
  assert.equal(next.slots[1].snapshot.foods[0].amount, 100);
  assert.notEqual(next.slots[0].snapshot.portionRevision, selection.slots[0].snapshot.portionRevision);
});

test('replacement cannot rewrite an earlier consumption snapshot', () => {
  const eaten = confirm(start(), meal(start()));
  const replaced = confirm(eaten, replacement(eaten));
  const fact = effectiveSimulatedDiary(replaced)[0].effect;
  assert.equal(fact.kind === 'diary-snapshot' && fact.snapshot.recipeId, 'original');
  assert.equal(replaced.graph.slots[0].snapshot.recipeId, 'replacement');
});

test('edit and undo append superseding history; originals remain and never resurrect silently', () => {
  const s = start(); const eaten = confirm(s, meal(s));
  const original = structuredClone(eaten.history[0]);
  const edited = confirm(eaten, { ...envelope(eaten), type: 'REVISE_FACT', operation: 'EDIT',
    targetEventId: eaten.history[0].eventId, actual: snapshot('edited', 60) });
  assert.equal(edited.history.length, 2);
  assert.deepEqual(edited.history[0], original);
  const effective = effectiveSimulatedDiary(edited);
  assert.equal(effective.length, 1);
  assert.equal(effective[0].eventId, edited.history[1].eventId);
  assert.throws(() => confirm(edited, { ...envelope(edited), type: 'REVISE_FACT', operation: 'UNDO', targetEventId: original.eventId }), /stale/);
  const undone = confirm(edited, { ...envelope(edited), type: 'REVISE_FACT', operation: 'UNDO', targetEventId: effective[0].eventId });
  assert.equal(undone.history.length, 3);
  assert.deepEqual(undone.history[0], original);
  assert.deepEqual(effectiveSimulatedDiary(undone), []);
  assert.deepEqual(undone.graph, s.graph);
  assert.equal(simulationShoppingRevision(undone), simulationShoppingRevision(s));
});

test('tampered preview payload and changed plan content require a new review', () => {
  const s = start();
  const proposed = reduceNutritionSimulation(s, { type: 'PROPOSE', command: meal(s) }, current);
  const changed = structuredClone(proposed);
  changed.pending!.command.idempotencyKey = 'different';
  assert.throws(() => reduceNutritionSimulation(changed, { type: 'PREVIEW' }, current), /changed_preview/);
  const contentChanged = structuredClone(proposed);
  contentChanged.graph.slots[0].snapshot.foods[0].amount = 125;
  assert.throws(() => reduceNutritionSimulation(contentChanged, { type: 'PREVIEW' }, current), /changed_snapshot/);
});

test('malformed graph, missing keys and forbidden skip payloads are rejected', () => {
  const duplicate = graph(); duplicate.slots.push(duplicate.slots[0]);
  assert.throws(() => createNutritionSimulation(duplicate, current.accountId, current.today), /duplicate/);
  const invalid = graph(); invalid.slots[0].snapshot.foods[0].nutrition.calories = NaN;
  assert.throws(() => createNutritionSimulation(invalid, current.accountId, current.today), /nutrition/);
  const s = start();
  assert.throws(() => confirm(s, { ...meal(s), idempotencyKey: '' }), /idempotency/);
  assert.throws(() => confirm(s, { ...meal(s, 'SKIPPED'), actual: snapshot() } as unknown as NutritionDomainCommand), /skip/);
  assert.throws(() => confirm(s, { ...meal(s), actual: snapshot() } as unknown as NutritionDomainCommand), /exact_snapshot/);
});

test('canonical command content identity is key-order independent and rejects ambiguous numbers', () => {
  assert.equal(nutritionCommandFingerprint({ b: 2, a: 1 }), nutritionCommandFingerprint({ a: 1, b: 2 }));
  for (const value of [NaN, Infinity, undefined]) assert.throws(() => nutritionCommandFingerprint({ value }), /invalid_command/);
});

test('one snapshot or portion revision cannot silently describe contradictory amounts', () => {
  const conflicting = graph(); conflicting.slots[1].snapshot.foods[0].amount = 90;
  assert.throws(() => createNutritionSimulation(conflicting, current.accountId, current.today), /contradictory_snapshot/);
  const s = start(); const actual = snapshot('original', 90);
  actual.snapshotRevision = 'new-snapshot-same-portion';
  assert.throws(() => confirm(s, { ...envelope(s), type: 'MEAL', action: 'EXTRA_FOOD', date: current.today,
    slotId: null, actual }), /contradictory_portion/);
});

test('skip undo is a retained annotation revision, never a consumed fact', () => {
  const s = start(); const skipped = confirm(s, meal(s, 'SKIPPED'));
  assert.equal(effectiveSimulatedSkips(skipped).length, 1);
  assert.throws(() => confirm(skipped, meal(skipped, 'SKIPPED')), /already_skipped/);
  const undone = confirm(skipped, { ...envelope(skipped), type: 'UNDO_ANNOTATION', targetEventId: skipped.history[0].eventId });
  assert.equal(undone.history.length, 2);
  assert.equal(undone.history[0].effect.kind, 'skip-annotation');
  assert.equal(undone.history[1].effect.kind, 'annotation-retraction');
  assert.deepEqual(effectiveSimulatedSkips(undone), []);
  assert.deepEqual(effectiveSimulatedDiary(undone), []);
});

test('confirmed replacement supplies exact new consumption; restoring old plan keeps both revisions', () => {
  const s = start(); const replaced = confirm(s, replacement(s));
  const eaten = confirm(replaced, meal(replaced));
  const fact = effectiveSimulatedDiary(eaten)[0].effect;
  assert.equal(fact.kind === 'diary-snapshot' && fact.snapshot.recipeId, 'replacement');
  const restore: NutritionDomainCommand = { ...envelope(eaten), type: 'REPLACE', date: current.today, slotId: 'lunch',
    expectedSnapshot: revision(eaten.graph.slots[0].snapshot), replacement: s.graph.slots[0].snapshot };
  const restored = confirm(eaten, restore);
  assert.equal(restored.graph.slots[0].snapshot.recipeId, 'original');
  assert.equal(restored.localPlanSequence, 2);
  assert.equal(restored.history.filter(({ effect }) => effect.kind === 'plan-replacement').length, 2);
  const retained = effectiveSimulatedDiary(restored)[0].effect;
  assert.equal(retained.kind === 'diary-snapshot' && retained.snapshot.recipeId, 'replacement');
});
