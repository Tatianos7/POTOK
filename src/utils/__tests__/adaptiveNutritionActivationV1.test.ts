import assert from 'node:assert/strict';
import test from 'node:test';
import {
  activationPayloadSha256HexV1,
  adaptiveActivationForbiddenEffectsV1,
  adaptiveActivationLockOrderV1,
  adaptiveCatalogManifestSha256HexV1,
  canonicalAdaptiveNutritionGraphSha256HexV1,
  decodeCanonicalAdaptiveNutritionGraphEnvelopeRawV1,
  decodePlanActivatedReceiptWireV1,
  buildPotokAdaptiveGoalSnapshotV1,
  decodeAdaptiveCatalogManifestV1,
  decodePlanActivatedReceiptV1,
  encodePotokAdaptiveGoalSnapshotCanonicalV1,
  planActivatedReceiptContractV1,
  potokAdaptiveGoalSnapshotSha256HexV1,
  resolveActivationReplayV1,
  validateActivateGeneratedWeekV1,
  type ActivateGeneratedWeekV1,
  type AdaptiveCatalogManifestV1,
  type PlanActivatedReceiptV1,
} from '../adaptiveNutritionActivationV1';
import { encodeAdaptiveNutritionGraphCanonicalV1, scalePremiumRecipeCollectionV1 } from '../adaptiveNutritionGraphV1';
import type {
  AdaptiveNutritionGraphV1,
  GraphComponentV1,
  GraphNutritionV1,
  GraphRecipeSnapshotV1,
} from '../adaptiveNutritionGraphV1';

const ids = {
  account: '81000000-0000-4000-8000-000000000001',
  selection: '81000000-0000-4000-8000-000000000002',
  goal: '81000000-0000-4000-8000-000000000003',
  history: '81000000-0000-4000-8000-000000000004',
  diary: '81000000-0000-4000-8000-000000000005',
  plan: '81000000-0000-4000-8000-000000000006',
  idempotency: '81000000-0000-4000-8000-000000000007',
  operation: '81000000-0000-4000-8000-000000000008',
  manifest: '82000000-0000-4000-8000-000000000001',
  recipe: '82000000-0000-4000-8000-000000000002',
  recipeRevision: '82000000-0000-4000-8000-000000000003',
  portionRevision: '82000000-0000-4000-8000-000000000004',
  eligibilityRevision: '82000000-0000-4000-8000-000000000005',
  component: '82000000-0000-4000-8000-000000000006',
  food: '82000000-0000-4000-8000-000000000007',
  evidence: '82000000-0000-4000-8000-000000000008',
  content: '82000000-0000-4000-8000-000000000009',
  snapshot: '82000000-0000-4000-8000-000000000010',
};

const nutrition = (calories: string, protein: string, fat: string, carbs: string, fiber: string): GraphNutritionV1 =>
  ({ calories, protein, fat, carbs, fiber });

function baseComponent(): GraphComponentV1 {
  return {
    componentId: ids.component,
    recipeRevisionId: ids.recipeRevision,
    identity: { kind: 'canonical_food', canonicalFoodId: ids.food },
    displayNameSnapshot: 'Яйцо', state: 'as-sold',
    quantity: { amount: '4.000', unit: 'piece' },
    normalizedGrams: '200.000', normalizationEvidenceRef: ids.evidence,
    scaling: { mode: 'discrete', increment: '1.000' },
    nutrition: nutrition('400.000', '28.000', '28.000', '2.000', '0.000'), sortOrder: 0,
  };
}

function recipeSnapshot(): GraphRecipeSnapshotV1 {
  return {
    recipeId: ids.recipe, recipeRevisionId: ids.recipeRevision,
    displayNameSnapshot: 'Омлет',
    baseYield: { servings: '4.000', servingLabel: 'порция', totalYieldGrams: '200.000' },
    fullRecipeNutrition: nutrition('400.000', '28.000', '28.000', '2.000', '0.000'),
    ingredients: [baseComponent()],
  };
}

function assignedComponent(): GraphComponentV1 {
  return {
    ...baseComponent(), quantity: { amount: '1.000', unit: 'piece' },
    normalizedGrams: '50.000', nutrition: nutrition('100.000', '7.000', '7.000', '0.500', '0.000'),
  };
}

function graph(): AdaptiveNutritionGraphV1 {
  const dates = ['2026-09-21', '2026-09-22', '2026-09-23', '2026-09-24',
    '2026-09-25', '2026-09-26', '2026-09-27'];
  return {
    contract_version: 1, selection_id: ids.selection, plan_revision: ids.plan,
    goal_revision: ids.goal, week_anchor: dates[0], timezone: 'Europe/Moscow',
    generated_at: '2026-09-20T12:00:00.000Z',
    generation: { generatorVersion: 'trusted-generator-v1', contentRevision: ids.content },
    days: dates.map((date, dayIndex) => ({
      date, dayIndex, targetSnapshot: null,
      slots: dayIndex === 0 ? [{
        slotId: '83000000-0000-4000-8000-000000000001', mealType: 'breakfast', sortOrder: 0,
        displayLabel: null, plannedLocalTime: '08:00',
        snapshot: {
          snapshotRevision: ids.snapshot, recipeRevision: ids.recipeRevision,
          portionRevision: ids.portionRevision, recipe: recipeSnapshot(),
          assignedPortion: { source: 'potok_generator', portionRevisionId: ids.portionRevision,
            assignedServings: '1.000', servingMultiplier: '0.250', assignedGrams: '50.000' },
          ingredients: [assignedComponent()],
          nutrition: nutrition('100.000', '7.000', '7.000', '0.500', '0.000'),
        },
      }] : [],
    })),
  };
}

function goalSnapshot() {
  return buildPotokAdaptiveGoalSnapshotV1({
    accountId: ids.account, goalRevision: ids.goal, calories: '2000', protein: '120.00',
    fat: '70.0', carbs: '230.000', goalType: 'Похудение',
  });
}

function manifest(): AdaptiveCatalogManifestV1 {
  return {
    contract: 'potok-adaptive-catalog-manifest-v1', manifestRevision: ids.manifest,
    recipes: [{
      recipeId: ids.recipe, recipeRevisionId: ids.recipeRevision, portionRevisionId: ids.portionRevision,
      eligibilityRevisionId: ids.eligibilityRevision, recipeSnapshot: recipeSnapshot(),
      allowedMealTypes: ['breakfast'], reviewedTags: ['high_protein'], planEligible: true,
      portionRules: { mode: 'hybrid', assignedServingsIncrement: '1.000',
        componentIncrements: [{ componentId: ids.component, increment: '1.000' }] },
    }],
  };
}

test('activation enforces reviewed servings increments even for continuous components', () => {
  const c = command();
  const m = manifest();
  m.recipes[0].portionRules.assignedServingsIncrement = '2.000';
  assert.equal(c.graph.days[0].slots[0].snapshot.assignedPortion.assignedServings, '1.000');
  assert.throws(() => validateActivateGeneratedWeekV1(c, m), /activation_assigned_servings_increment_mismatch/);
  m.recipes[0].portionRules.assignedServingsIncrement = '0.500';
  assert.doesNotThrow(() => validateActivateGeneratedWeekV1(c, m));
  const multiple = structuredClone(c);
  const snapshot = multiple.graph.days[0].slots[0].snapshot;
  const scaled = scalePremiumRecipeCollectionV1(snapshot.recipe, '2.000');
  snapshot.assignedPortion = { ...snapshot.assignedPortion, assignedServings: '2.000',
    servingMultiplier: scaled.scaleFactor, assignedGrams: '100.000' };
  snapshot.ingredients = scaled.ingredients;
  snapshot.nutrition = scaled.nutrition;
  m.recipes[0].portionRules.assignedServingsIncrement = '2.000';
  assert.doesNotThrow(() => validateActivateGeneratedWeekV1(multiple, m));
  const slot = c.graph.days[0].slots[0];
  slot.snapshot.recipe.ingredients[0].scaling = { mode: 'continuous' };
  slot.snapshot.ingredients[0].scaling = { mode: 'continuous' };
  m.recipes[0].recipeSnapshot = structuredClone(slot.snapshot.recipe);
  m.recipes[0].portionRules.componentIncrements = [];
  m.recipes[0].portionRules.assignedServingsIncrement = '2.000';
  assert.throws(() => validateActivateGeneratedWeekV1(c, m), /activation_assigned_servings_increment_mismatch/);
  m.recipes[0].portionRules.assignedServingsIncrement = '0.500';
  assert.doesNotThrow(() => validateActivateGeneratedWeekV1(c, m));
});

function command(): ActivateGeneratedWeekV1 {
  return {
    contract: 'potok-adaptive-nutrition-activate-generated-week-v1',
    authority: { source: 'server_selection', accountId: ids.account },
    operation: { idempotencyKey: ids.idempotency, proposedPlanRevision: ids.plan },
    expected: { selectionId: ids.selection, status: 'pending_generation', planRevision: null,
      goalRevision: ids.goal, historyRevision: ids.history, diaryRevision: ids.diary,
      weekAnchor: '2026-09-21', timezone: 'Europe/Moscow' },
    goalSnapshot: goalSnapshot(),
    catalogAuthority: { source: 'published_server_manifest', manifestRevision: ids.manifest },
    graph: graph(),
  };
}

function receipt(): PlanActivatedReceiptV1 {
  return {
    kind: 'settled', contract: planActivatedReceiptContractV1, outcome: 'accepted',
    operationId: ids.operation, idempotencyKey: ids.idempotency, selectionId: ids.selection,
    status: 'active', planRevision: ids.plan, goalRevision: ids.goal,
    historyRevision: ids.history, diaryRevision: ids.diary, weekAnchor: '2026-09-21',
    timezone: 'Europe/Moscow', graphDigestHex: 'ab'.repeat(32),
    committedAt: '2026-09-20T12:01:00.000Z', eventIds: [],
  };
}

function mutate<T>(value: T, callback: (draft: T) => void): T {
  const draft = structuredClone(value);
  callback(draft);
  return draft;
}

test('GoalSnapshotV1 uses the exact authoritative allowlist and normalizes scale 3', () => {
  assert.deepEqual(goalSnapshot(), {
    contract: 'potok-adaptive-goal-snapshot-v1', accountId: ids.account, goalRevision: ids.goal,
    goalType: 'Похудение',
    nutritionTargets: { calories: '2000.000', protein: '120.000', fat: '70.000', carbs: '230.000' },
  });
  assert.throws(() => buildPotokAdaptiveGoalSnapshotV1({
    accountId: ids.account, goalRevision: ids.goal, calories: '2000', protein: '120', fat: '70', carbs: '230',
    goalType: null, fiber: '30',
  }), /goal_snapshot_source_fields/);
});

test('GoalSnapshotV1 rejects client/profile/training fields and invalid targets', () => {
  for (const forbidden of ['email', 'trainingPlace', 'allergies', 'updatedAt']) {
    assert.throws(() => buildPotokAdaptiveGoalSnapshotV1({
      accountId: ids.account, goalRevision: ids.goal, calories: '2000', protein: '120', fat: '70', carbs: '230',
      goalType: null, [forbidden]: 'forbidden',
    }), /goal_snapshot_source_fields/);
  }
  assert.throws(() => buildPotokAdaptiveGoalSnapshotV1({
    accountId: ids.account, goalRevision: ids.goal, calories: '0', protein: '120', fat: '70', carbs: '230',
    goalType: null,
  }), /goal_calories_value/);
});

test('Goal canonical bytes and digest are deterministic', async () => {
  const first = goalSnapshot();
  const second = { nutritionTargets: first.nutritionTargets, goalType: first.goalType,
    goalRevision: first.goalRevision, accountId: first.accountId, contract: first.contract };
  assert.deepEqual(encodePotokAdaptiveGoalSnapshotCanonicalV1(first),
    encodePotokAdaptiveGoalSnapshotCanonicalV1(second));
  assert.equal(await potokAdaptiveGoalSnapshotSha256HexV1(first),
    await potokAdaptiveGoalSnapshotSha256HexV1(second));
});

test('catalog manifest pins eligible recipe, HYBRID rules, meal types and canonical snapshot', async () => {
  const decoded = decodeAdaptiveCatalogManifestV1(manifest());
  assert.equal(decoded.recipes[0].portionRules.mode, 'hybrid');
  assert.match(await adaptiveCatalogManifestSha256HexV1(decoded), /^[0-9a-f]{64}$/);
  assert.throws(() => decodeAdaptiveCatalogManifestV1(mutate(manifest(), (value) => {
    value.recipes[0].portionRules.componentIncrements[0].increment = '0.500';
  })), /portion_rules_snapshot_mismatch/);
});

test('activation command binds Graph, Goal, selection and manifest exactly', async () => {
  const decoded = validateActivateGeneratedWeekV1(command(), manifest());
  assert.equal(decoded.graph.plan_revision, ids.plan);
  assert.equal(decoded.goalSnapshot.goalRevision, ids.goal);
  assert.match(await activationPayloadSha256HexV1(decoded, manifest()), /^[0-9a-f]{64}$/);
});

test('protected canonical boundary reconstructs exact Graph bytes and authoritative digest', async () => {
  const raw = new TextDecoder().decode(encodeAdaptiveNutritionGraphCanonicalV1(graph()));
  const decoded = decodeCanonicalAdaptiveNutritionGraphEnvelopeRawV1(raw);
  assert.deepEqual(decoded.graph, graph());
  assert.equal(new TextDecoder().decode(decoded.canonicalBytes), raw);
  const digest = await canonicalAdaptiveNutritionGraphSha256HexV1(raw);
  assert.match(digest, /^[0-9a-f]{64}$/);
  assert.equal(await canonicalAdaptiveNutritionGraphSha256HexV1(raw), digest);
});

test('protected canonical boundary rejects noncanonical, duplicate and malformed raw envelopes', () => {
  const raw = new TextDecoder().decode(encodeAdaptiveNutritionGraphCanonicalV1(graph()));
  const reordered = raw.replace(
    /^\{"contract":([^,]+),"encoding":([^,]+),/,
    '{"encoding":$2,"contract":$1,',
  );
  assert.throws(() => decodeCanonicalAdaptiveNutritionGraphEnvelopeRawV1(reordered),
    /noncanonical_graph_envelope/);

  const duplicate = raw.replace(
    /^\{"contract":([^,]+),/,
    '{"contract":$1,"\\u0063ontract":$1,',
  );
  assert.throws(() => decodeCanonicalAdaptiveNutritionGraphEnvelopeRawV1(duplicate), /Duplicate JSON key/);

  const extra = raw.replace(/}$/, ',"callerDigest":"' + '00'.repeat(32) + '"}');
  assert.throws(() => decodeCanonicalAdaptiveNutritionGraphEnvelopeRawV1(extra), /graph_envelope_fields/);
  assert.throws(() => decodeCanonicalAdaptiveNutritionGraphEnvelopeRawV1('{"graph":'),
    /Invalid JSON value|Unterminated JSON object|invalid_graph_envelope_json/);
});

test('activation command cannot supply a digest or its own manifest authority', () => {
  assert.throws(() => validateActivateGeneratedWeekV1({
    ...command(), callerDigest: '00'.repeat(32),
  }, manifest()), /activation_command_fields/);
  assert.throws(() => validateActivateGeneratedWeekV1({
    ...command(), catalogManifest: manifest(),
  }, manifest()), /activation_command_fields/);
});

test('activation rejects stale Goal/Graph and non-manifest content', () => {
  assert.throws(() => validateActivateGeneratedWeekV1(mutate(command(), (value) => {
    value.goalSnapshot.goalRevision = '84000000-0000-4000-8000-000000000001';
  }), manifest()), /goal_binding_mismatch/);
  assert.throws(() => validateActivateGeneratedWeekV1(mutate(command(), (value) => {
    value.graph.selection_id = '84000000-0000-4000-8000-000000000002';
  }), manifest()), /graph_binding_mismatch/);
  assert.throws(() => validateActivateGeneratedWeekV1(command(), mutate(manifest(), (value) => {
    value.recipes[0].allowedMealTypes = ['dinner'];
  })), /content_not_in_manifest/);
  assert.throws(() => validateActivateGeneratedWeekV1(mutate(command(), (value) => {
    value.catalogAuthority.manifestRevision = '84000000-0000-4000-8000-000000000003';
  }), manifest()), /catalog_authority_revision_mismatch/);
});

test('PLAN_ACTIVATED receipt is settled, accepted and intentionally event-free', () => {
  assert.deepEqual(decodePlanActivatedReceiptV1(receipt()), receipt());
  assert.deepEqual(decodePlanActivatedReceiptWireV1({
    kind: 'settled', contract: planActivatedReceiptContractV1, outcome: 'accepted',
    operation_id: ids.operation, idempotency_key: ids.idempotency, selection_id: ids.selection,
    status: 'active', plan_revision: ids.plan, goal_revision: ids.goal,
    history_revision: ids.history, diary_revision: ids.diary, week_anchor: '2026-09-21',
    timezone: 'Europe/Moscow', graph_digest_hex: 'ab'.repeat(32),
    committed_at: '2026-09-20T12:01:00.000Z', event_ids: [],
  }), receipt());
  assert.throws(() => decodePlanActivatedReceiptV1({ ...receipt(), eventIds: [ids.operation] }),
    /invalid_activation_receipt/);
  assert.throws(() => decodePlanActivatedReceiptV1({ ...receipt(), outcome: 'conflict' }),
    /invalid_activation_receipt/);
});

test('idempotency exact replay returns original receipt and changed payload conflicts', () => {
  const existing = { accountId: ids.account, idempotencyKey: ids.idempotency,
    payloadDigestHex: 'cd'.repeat(32), outcome: 'accepted' as const, receipt: receipt() };
  assert.deepEqual(resolveActivationReplayV1(existing, {
    accountId: ids.account, idempotencyKey: ids.idempotency, payloadDigestHex: 'cd'.repeat(32),
  }), { kind: 'replay', receipt: receipt() });
  assert.deepEqual(resolveActivationReplayV1(existing, {
    accountId: ids.account, idempotencyKey: ids.idempotency, payloadDigestHex: 'ef'.repeat(32),
  }), { kind: 'conflict', reason: 'idempotency_payload_mismatch' });
  assert.deepEqual(resolveActivationReplayV1({ ...existing, outcome: 'in_progress', receipt: null }, {
    accountId: ids.account, idempotencyKey: ids.idempotency, payloadDigestHex: 'cd'.repeat(32),
  }), { kind: 'unknown' });
});

test('lock order and forbidden effects encode event-free initial activation', () => {
  assert.deepEqual(adaptiveActivationLockOrderV1, [
    'account_advisory_lock', 'operation_idempotency_lookup', 'selection_for_update',
    'goal_for_update', 'immutable_catalog_manifest_reads',
  ]);
  assert.deepEqual(adaptiveActivationForbiddenEffectsV1,
    ['FACT', 'PLAN_REPLACED', 'adaptive_event', 'diary_entry', 'replacement', 'shopping_mutation']);
});
