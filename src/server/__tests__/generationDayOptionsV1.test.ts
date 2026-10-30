import assert from 'node:assert/strict';
import test from 'node:test';
import { createGenerationDayOptionsV1 } from '../generationDayOptionsV1';
import { generationMenuCandidateSourceContractV1 } from '../generationMenuCandidatesV1';
import { fullFixture, fixtureWeekValidationInput, fixtureValidationResults, resignEntry, useRecipe, id,
  type FullFixture } from '../../utils/__tests__/trustedGeneratedWeekFixturesV1';
import { validateWeekSnapshotRawV2 } from '../../utils/adaptiveNutritionMealBalanceV1';

function source(f: FullFixture) {
  return JSON.stringify({ contract: generationMenuCandidateSourceContractV1, requestOperationId: f.context.input.operation.requestId,
    contextRaw: f.contextRaw, policiesRaw: f.policiesRaw, goalProfile: 'MAINTENANCE',
    slotRevisions: f.plan.graph.days.flatMap(day => day.slots.map(slot => ({ slotId: slot.slotId,
      mealSnapshotRevision: slot.mealSnapshotRevision }))) });
}
function issueSyntheticWarning(f: FullFixture, slotId: string, mealSnapshotDigest: string) {
  return JSON.stringify(resignEntry({ ...f.set.entries[0], slotId, mealSnapshotDigest }));
}
function harness(f: FullFixture, warning?: (slotId: string, mealDigest: string) => string | null) {
  const calls = { source: 0, warnings: 0 };
  const generator = createGenerationDayOptionsV1({ async loadPreparationRaw(request) {
    calls.source++; assert.equal(request, f.context.input.operation.requestId); return source(f);
  } }, { async loadMealWarningRaw(request, slot, meal, evidence, policies) {
    calls.warnings++;
    assert.equal(request, f.context.input.operation.requestId);
    assert.equal(evidence, f.evidence.digest); assert.equal(policies, f.policies.digest);
    return warning ? warning(slot, meal) : issueSyntheticWarning(f, slot, meal);
  } });
  return { calls, run: (limits?: string) => generator.generate(f.context.input.operation.requestId, limits) };
}
function twoPortionFixture(slots = 1) {
  return fullFixture(state => {
    state.context.input.goalNutritionTarget.calories = { min: '100.000', target: '150.000', max: '400.000' };
    for (const day of state.evidence.distributionPolicy.days) for (const b of [...day.nutritionBounds, ...day.distributionBounds]) {
      b.bounds.maximum = { calories: '200.000', protein: '20.000', fat: '10.000', carbs: '20.000', fiber: '4.000' };
    }
  }, slots);
}

test('connects catalog preparation, actual day validation and real week search with one source read', async () => {
  const f = await fullFixture(); const h = harness(f);
  const result = await h.run(); assert.equal(result.status, 'FEASIBLE_PROPOSAL');
  if (result.status !== 'FEASIBLE_PROPOSAL') return;
  assert.equal(h.calls.source, 1); assert.equal(h.calls.warnings, 7);
  assert.deepEqual(JSON.parse(result.week.weekRaw), fixtureWeekValidationInput(f));
  assert.deepEqual(result.week.validation, await validateWeekSnapshotRawV2(result.week.weekRaw, f.rawContext.candidateManifestRaw));
  assert.deepEqual(result.week.validation, (await fixtureValidationResults(f)).week);
  assert.equal(result.days.length, 7);
  assert.ok(result.days.every(d => d.feasible === 1 && d.invalid === 0));
  assert.equal(Object.isFrozen(result.days[0]), true);
  assert.equal('plan' in result, false);
});

test('retains the exact independently supplied warning bytes, including whitespace', async () => {
  const f = await fullFixture();
  const issued = new Map(f.set.entries.map(e => [e.slotId, JSON.stringify(e, null, 2)]));
  const result = await harness(f, slot => issued.get(slot)!).run();
  assert.equal(result.status, 'FEASIBLE_PROPOSAL'); if (result.status !== 'FEASIBLE_PROPOSAL') return;
  assert.deepEqual(result.selectedWarningEntriesRaw, [...issued].sort(([a], [b]) => a < b ? -1 : 1).map(([, raw]) => raw));
});

test('checks the complete day target across slots rather than accepting separately valid meals', async () => {
  const f = await fullFixture(state => {
    state.context.input.goalNutritionTarget.calories = { min: '200.000', target: '200.000', max: '200.000' };
    for (const day of state.evidence.distributionPolicy.days) for (const b of [...day.nutritionBounds, ...day.distributionBounds]) {
      b.bounds.maximum = { calories: '200.000', protein: '20.000', fat: '10.000', carbs: '20.000', fiber: '4.000' };
    }
  }, 2);
  const result = await harness(f).run(); assert.equal(result.status, 'FEASIBLE_PROPOSAL');
  if (result.status !== 'FEASIBLE_PROPOSAL') return;
  assert.ok(result.days.every(d => d.evaluated === 4 && d.invalid === 3 && d.feasible === 1));
});

test('rejects repeated recipes within a day even when every meal is individually admissible', async () => {
  const f = await fullFixture(state => { useRecipe(state, 1, 0); }, 2);
  const result = await harness(f).run(); assert.equal(result.status, 'NO_FEASIBLE_DAY');
  assert.equal(result.days[0].feasible, 0); assert.equal(result.days[0].invalid, 1);
});

test('retains cross-day repeat limits after day assembly', async () => {
  const f = await fullFixture(state => { for (const e of state.context.manifest.entries) e.repeatFamily = 'same'; });
  const result = await harness(f).run(); assert.equal(result.status, 'NO_FEASIBLE_WEEK_IN_POOL');
  assert.ok(result.days.every(d => d.feasible === 1)); assert.equal('week' in result, false);
});

test('missing warning source blocks rather than fabricating five false signals', async () => {
  const f = await fullFixture(); const result = await harness(f, () => null).run();
  assert.equal(result.status, 'BLOCKED_WARNING_EVIDENCE'); assert.equal('week' in result, false);
  assert.equal(result.days[0].missingWarningOptions, 1);
});

test('known options remain usable when another portion lacks independent warning evidence', async () => {
  const f = await twoPortionFixture();
  const result = await harness(f, (slot, digest) => {
    const row = f.set.entries.find(e => e.slotId === slot && e.mealSnapshotDigest === digest);
    return row ? JSON.stringify(row) : null;
  }).run();
  assert.equal(result.status, 'FEASIBLE_PROPOSAL'); if (result.status !== 'FEASIBLE_PROPOSAL') return;
  assert.ok(result.days.every(d => d.missingWarningOptions === 1 && d.feasible === 1));
});

test('incomplete warning coverage cannot prove exhaustive week infeasibility', async () => {
  const f = await fullFixture(state => {
    for (const e of state.context.manifest.entries) e.repeatFamily = 'same';
    for (const day of state.evidence.distributionPolicy.days) for (const b of [...day.nutritionBounds, ...day.distributionBounds]) {
      b.bounds.maximum = { calories: '200.000', protein: '20.000', fat: '10.000', carbs: '20.000', fiber: '4.000' };
    }
  });
  const result = await harness(f, (slot, digest) => {
    const row = f.set.entries.find(e => e.slotId === slot && e.mealSnapshotDigest === digest);
    return row ? JSON.stringify(row) : null;
  }).run();
  assert.equal(result.status, 'BLOCKED_WARNING_EVIDENCE');
});

test('keeps permitted warnings in the actual selected week', async () => {
  const f = await fullFixture(state => {
    state.balance.policy.allowedWarningCodes.push('LONG_PREPARATION_BURDEN'); state.balance.policy.allowedWarningCodes.sort();
  });
  const result = await harness(f, (slotId, mealSnapshotDigest) => JSON.stringify(resignEntry({ ...f.set.entries[0], slotId, mealSnapshotDigest,
    signals: { ...f.set.entries[0].signals, longPreparationBurden: true } }))).run();
  assert.equal(result.status, 'FEASIBLE_PROPOSAL'); if (result.status !== 'FEASIBLE_PROPOSAL') return;
  assert.equal(result.week.validation.status, 'VALID_WITH_WARNINGS');
  assert.ok(result.week.validation.reasons.some(r => r.code === 'LONG_PREPARATION_BURDEN'));
});

test('replayed, corrupt and duplicate-key warning entries abort instead of becoming skipped options', async () => {
  const f = await fullFixture();
  for (const raw of [JSON.stringify(f.set.entries[1]), JSON.stringify({ ...f.set.entries[0], digest: '0'.repeat(64) }),
    JSON.stringify(f.set.entries[0]).replace('{', '{"signals":{},'), {} as unknown as string]) {
    await assert.rejects(harness(f, () => raw).run());
  }
});

test('day search work limits are distinct from infeasibility and precede warning reads', async () => {
  const f = await twoPortionFixture(); const h = harness(f);
  const result = await h.run('{"maxDayEvaluations":1,"maxWeekEvaluations":1024}');
  assert.equal(result.status, 'DAY_SEARCH_LIMIT_REACHED'); assert.equal(h.calls.warnings, 0);
});

test('weekly search budget remains explicit after feasible day alternatives are assembled', async () => {
  const f = await fullFixture(state => {
    state.evidence.ordinaryFallback.status = 'UNAVAILABLE_SPECIALTY'; state.evidence.ordinaryFallback.ordinaryWeekDigest = null;
    for (const day of state.evidence.distributionPolicy.days) for (const b of [...day.nutritionBounds, ...day.distributionBounds]) {
      b.bounds.maximum = { calories: '200.000', protein: '20.000', fat: '10.000', carbs: '20.000', fiber: '4.000' };
    }
  });
  assert.equal((await harness(f).run('{"maxDayEvaluations":1024,"maxWeekEvaluations":1}')).status, 'SEARCH_LIMIT_REACHED');
});

test('does not silently cut a day pool down to the sixteen-option weekly interface', async () => {
  const f = await fullFixture(state => {
    state.context.input.goalNutritionTarget.calories = { min: '100.000', target: '150.000', max: '2000.000' };
    for (const e of state.context.manifest.entries) e.portionRules.assignedServingsMaximum = '20.000';
    for (const day of state.evidence.distributionPolicy.days) for (const b of [...day.nutritionBounds, ...day.distributionBounds]) {
      b.bounds.maximum = { calories: '2000.000', protein: '200.000', fat: '100.000', carbs: '200.000', fiber: '40.000' };
    }
  });
  const result = await harness(f).run(); assert.equal(result.status, 'RESOURCE_LIMIT_REACHED');
  assert.equal('week' in result, false);
});

test('missing source and empty meal pools do not call the warning source', async () => {
  const generator = createGenerationDayOptionsV1({ async loadPreparationRaw() { return null; } }, {
    async loadMealWarningRaw() { throw new Error('must_not_read'); } });
  assert.equal((await generator.generate(id(44))).status, 'BLOCKED_SOURCE_MISSING');
  const f = await fullFixture(state => { state.context.preference.hard.excludedMealTypes = ['dinner']; });
  const h = harness(f); assert.equal((await h.run()).status, 'INCOMPLETE_MEAL_POOL'); assert.equal(h.calls.warnings, 0);
});

test('invalid identifiers and budgets fail before source access', async () => {
  const generator = createGenerationDayOptionsV1({ async loadPreparationRaw() { throw new Error('must_not_read'); } }, {
    async loadMealWarningRaw() { throw new Error('must_not_read'); } });
  await assert.rejects(generator.generate('bad'), /INVALID_DAY_PREPARATION_REQUEST/);
  for (const value of [0, -1, 1.5, 1025, null, '1']) {
    await assert.rejects(generator.generate(id(44), JSON.stringify({ maxDayEvaluations: value, maxWeekEvaluations: 1 })), /BUDGET/);
  }
  await assert.rejects(generator.generate(id(44), '{"maxDayEvaluations":1,"maxWeekEvaluations":1,"maxDayEvaluations":2}'), /Duplicate/);
});

test('repeated calls preserve deterministic proposals and perform fresh independent reads', async () => {
  const f = await fullFixture(); const h = harness(f);
  assert.deepEqual(await h.run(), await h.run()); assert.equal(h.calls.source, 2); assert.equal(h.calls.warnings, 14);
});
