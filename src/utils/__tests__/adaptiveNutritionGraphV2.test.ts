import assert from 'node:assert/strict';
import test from 'node:test';
import {
  adaptiveMealCompositionEligibilityV1_1,
  composeAdaptiveMealV1,
  type MealAnchorKindV1,
  type MealComponentCandidateV1,
  type MealComponentRoleV1,
  type MealSnapshotV1,
} from '../adaptiveNutritionMealCompositionV1';
import { goalNutritionTargetContractV1, type GoalNutritionTargetV1 } from '../adaptiveNutritionMealBalanceV1';
import {
  adaptiveNutritionGraphSha256HexV1,
  decodeAdaptiveNutritionGraphV1,
  encodeAdaptiveNutritionGraphCanonicalV1,
  scalePremiumRecipeCollectionV1,
  type AdaptiveNutritionGraphV1,
  type GraphNutritionV1,
  type GraphRecipeSnapshotV1,
} from '../adaptiveNutritionGraphV1';
import {
  adaptiveNutritionGraphContractV2,
  adaptiveNutritionGraphSha256HexV2,
  bindGeneratedWeekPlanV1,
  decodeAdaptiveNutritionGraphV2,
  decodeTrustedGenerationInputV1,
  encodeAdaptiveNutritionGraphCanonicalV2,
  finalizeGeneratedWeekPlanV1,
  generatedWeekPlanContractV1,
  resolveGenerationReplayV1,
  sealAdaptiveNutritionGraphV2,
  sharedAccountGateContractV1,
  trustedGenerationInputContractV1,
  trustedGenerationInputDigestV1,
  type AdaptiveNutritionGraphDraftV2,
  type AdaptiveNutritionGraphV2,
  type GenerationAuthorityRecheckV1,
  type GraphV2ComponentEvidenceBinding,
  type TrustedGenerationInputV1,
} from '../adaptiveNutritionGraphV2';

const uuid = (value: number): string =>
  `${value.toString(16).padStart(8, '0')}-0000-4000-8000-${String(value).padStart(12, '0')}`;
const hash = (character: string): string => character.repeat(64);
const nutrition = (calories: string, protein = '10.000', fat = '5.000', carbs = '20.000',
  fiber = '3.000'): GraphNutritionV1 => ({ calories, protein, fat, carbs, fiber });
const zero = nutrition('0.000', '0.000', '0.000', '0.000', '0.000');
const high = nutrition('9999.000', '9999.000', '9999.000', '9999.000', '9999.000');
const nutritionKeys = ['calories', 'protein', 'fat', 'carbs', 'fiber'] as const;
const sumNutrition = (values: GraphNutritionV1[]): GraphNutritionV1 => Object.fromEntries(
  nutritionKeys.map((key) => [key, `${values.reduce((sum, value) => sum + BigInt(value[key].replace('.', '')), 0n)
    / 1_000n}.${String(values.reduce((sum, value) => sum + BigInt(value[key].replace('.', '')), 0n)
    % 1_000n).padStart(3, '0')}`]),
) as unknown as GraphNutritionV1;

let nextId = 70_000;
const id = (): string => uuid(nextId++);
const policyRevision = uuid(600);
const goalRevision = uuid(601);
const targetPolicyRevision = uuid(602);

test('full authoritative Goal target rejects altered calories and optional macros with identical revisions', async () => {
  const graph = await graphFixture();
  const input = structuredClone(generationInput(graph));
  assert.equal(input.goalNutritionTarget.calories.target, '1400.000');
  for (const alter of [
    (target: GoalNutritionTargetV1) => { target.calories = { target: '9000.000', min: '8000.000', max: '10000.000' }; },
    (target: GoalNutritionTargetV1) => { target.protein = { target: '100.000', min: '80.000', max: '120.000' }; },
    (target: GoalNutritionTargetV1) => { target.calories.max = '3000.000'; },
  ]) {
    const changed = structuredClone(graph);
    alter(changed.goalNutritionTarget);
    await assert.rejects(bindGeneratedWeekPlanV1(input, changed), /GOAL_TARGET_MISMATCH/);
    await assert.rejects(finalizeGeneratedWeekPlanV1(input, changed, authority(input)), /GOAL_TARGET_MISMATCH/);
  }
  await bindGeneratedWeekPlanV1(input, graph);
});

function candidate(role: MealComponentRoleV1, anchorKind: MealAnchorKindV1,
  requiredCompanionRoleSets: MealComponentRoleV1[][] = []): MealComponentCandidateV1 {
  const recipeId = id();
  const recipeRevision = id();
  const portionRevision = id();
  const componentId = id();
  const ingredientId = id();
  const foodId = id();
  const value = nutrition('100.000');
  const recipe: GraphRecipeSnapshotV1 = {
    recipeId,
    recipeRevisionId: recipeRevision,
    displayNameSnapshot: `Synthetic ${role}`,
    baseYield: { servings: '1.000', servingLabel: 'portion', totalYieldGrams: '100.000' },
    fullRecipeNutrition: value,
    ingredients: [{
      componentId: ingredientId,
      recipeRevisionId: recipeRevision,
      identity: { kind: 'canonical_food', canonicalFoodId: foodId },
      displayNameSnapshot: `Synthetic ingredient ${role}`,
      state: 'as-sold',
      quantity: { amount: '100.000', unit: 'g' },
      normalizedGrams: '100.000',
      normalizationEvidenceRef: null,
      scaling: { mode: 'continuous' },
      nutrition: value,
      sortOrder: 0,
    }],
  };
  const scaled = scalePremiumRecipeCollectionV1(recipe, '1.000');
  return {
    mealComponentId: componentId,
    eligibility: {
      contract: adaptiveMealCompositionEligibilityV1_1,
      eligibilityRevisionId: id(),
      recipeRevisionId: recipeRevision,
      compositionPolicyRevision: policyRevision,
      role,
      anchorKind,
      allowedMealTypes: ['breakfast', 'lunch', 'dinner', 'snack'],
      requiredCompanionRoleSets,
      pairingTags: [],
      incompatiblePairingTags: [],
      repeatFamily: `synthetic_${componentId.slice(0, 8)}`,
      energyClass: 'BALANCED',
      beverageClass: role === 'BEVERAGE' ? 'NON_CALORIC' : 'NOT_BEVERAGE',
    },
    recipeRevision,
    portionRevision,
    recipe,
    assignedPortion: {
      source: 'potok_generator',
      portionRevisionId: portionRevision,
      assignedServings: '1.000',
      servingMultiplier: scaled.scaleFactor,
      assignedGrams: '100.000',
    },
    ingredients: scaled.ingredients,
    nutrition: scaled.nutrition,
  };
}

async function meal(components: MealComponentCandidateV1[], roles: MealComponentRoleV1[],
  slotId: string): Promise<MealSnapshotV1> {
  const result = await composeAdaptiveMealV1({
    mealSlotId: slotId,
    mealSnapshotRevision: id(),
    mealType: 'lunch',
    goalRevision,
    goalProfile: 'MAINTENANCE',
    policy: {
      policyRevision,
      maxComponents: components.length,
      patterns: [{ patternId: 'synthetic_pattern', allowedMealTypes: ['breakfast', 'lunch', 'dinner', 'snack'], roles }],
      nutritionWeights: { calories: 1, protein: 1, fat: 1, carbs: 1, fiber: 1 },
    },
    slotTarget: sumNutrition(components.map((item) => item.nutrition)),
    slotHardMaximum: high,
    currentDayNutrition: zero,
    dayTarget: high,
    dayHardMaximum: high,
    excludedRecipeRevisions: [],
    excludedRepeatFamilies: [],
    candidates: components,
  });
  assert.equal(result.status, 'COMPLETE');
  if (result.status !== 'COMPLETE') throw new Error('synthetic_meal_fixture_failed');
  return result.meal;
}

function evidenceFor(snapshot: MealSnapshotV1): GraphV2ComponentEvidenceBinding[] {
  return snapshot.components.map((component) => ({
    mealComponentId: component.mealComponentId,
    eligibilityRevisionId: component.eligibility.eligibilityRevisionId,
    publicationRevision: id(),
    canonicalEvidenceRevision: id(),
    nutritionEvidenceRevision: id(),
    allergenEvidenceRevision: id(),
    dietaryEvidenceRevision: id(),
    evidenceDigest: hash('a'),
  }));
}

function goalTarget(): GoalNutritionTargetV1 {
  const axis = { target: '1400.000', min: '1000.000', max: '2200.000' };
  return {
    contract: goalNutritionTargetContractV1,
    goalRevision,
    targetPolicyRevision,
    calories: axis,
    protein: null,
    fat: null,
    carbs: null,
    fiber: null,
  };
}

async function graphFixture(componentCount = 1): Promise<AdaptiveNutritionGraphV2> {
  const slotId = id();
  const complete = componentCount === 1;
  const components = complete
    ? [candidate('MAIN_COMPONENT', 'COMPLETE')]
    : [candidate('MAIN_COMPONENT', 'PARTIAL', [['CARB_SIDE'], ['VEGETABLE_SIDE']]),
      candidate('CARB_SIDE', 'NONE'), candidate('VEGETABLE_SIDE', 'NONE'),
      ...(componentCount >= 4 ? [candidate('SALAD', 'NONE')] : []),
      ...(componentCount >= 5 ? [candidate('EXTRA', 'NONE')] : []),
      ...(componentCount >= 6 ? [candidate('SAUCE', 'NONE')] : [])];
  const snapshot = await meal(components, components.map((item) => item.eligibility.role), slotId);
  const sourceKind = complete ? 'COMPLETE_RECIPE' as const : 'COMPOSED_MEAL' as const;
  const graph: AdaptiveNutritionGraphDraftV2 = {
    contract: adaptiveNutritionGraphContractV2,
    contractVersion: 2,
    selectionId: uuid(610),
    planSelectionRevision: uuid(611),
    planRevision: uuid(612),
    weekStartLocal: '2026-09-21',
    timezone: 'Europe/Moscow',
    goalRevision,
    targetPolicyRevision,
    goalNutritionTarget: goalTarget(),
    preferenceRevision: uuid(613),
    safetyRevision: uuid(614),
    catalogManifestRevision: uuid(615),
    candidateManifestDigest: hash('b'),
    compositionPolicyRevision: policyRevision,
    validationPolicyRevision: uuid(616),
    optimizationPolicyRevision: uuid(617),
    generationPolicyRevision: uuid(618),
    days: Array.from({ length: 7 }, (_, dayIndex) => {
      const date = `2026-09-${String(21 + dayIndex).padStart(2, '0')}`;
      const slots = dayIndex === 0 ? [{
        slotId,
        civilDate: date,
        mealType: 'lunch' as const,
        sortOrder: 0,
        sourceKind,
        mealSnapshotRevision: snapshot.mealSnapshotRevision,
        mealSnapshot: snapshot,
        validationResultDigest: hash('c'),
        generatorDecisionEvidence: {
          decisionPath: sourceKind,
          generationPolicyRevision: uuid(618),
          candidateManifestDigest: hash('b'),
          candidateSetDigest: hash('d'),
          selectedCandidateDigest: hash('e'),
          optimizationResultDigest: hash('f'),
        },
        goalRevision,
        targetPolicyRevision,
        compositionPolicyRevision: policyRevision,
        validationPolicyRevision: uuid(616),
        optimizationPolicyRevision: uuid(617),
        catalogManifestRevision: uuid(615),
        componentEvidence: evidenceFor(snapshot),
      }] : [];
      return {
        date,
        dayIndex,
        slots,
        nutritionTotal: slots.length === 0 ? zero : snapshot.nutrition,
        validationResultDigest: hash('1'),
      };
    }),
    weekValidationResultDigest: hash('2'),
    weekOptimizationResultDigest: hash('3'),
  };
  return sealAdaptiveNutritionGraphV2(graph);
}

function generationInput(graph: AdaptiveNutritionGraphV2): TrustedGenerationInputV1 {
  return {
    contract: trustedGenerationInputContractV1,
    accountGateContract: sharedAccountGateContractV1,
    accountId: uuid(620),
    selection: {
      selectionId: graph.selectionId,
      planSelectionRevision: graph.planSelectionRevision,
      expectedStatus: 'pending_generation',
      expectedPlanRevision: null,
      proposedPlanRevision: graph.planRevision,
    },
    weekStartLocal: graph.weekStartLocal,
    timezone: graph.timezone,
    goalNutritionTarget: graph.goalNutritionTarget,
    preferenceRevision: graph.preferenceRevision,
    safetyRevision: graph.safetyRevision,
    entitlementEvidenceRevision: uuid(621),
    candidateManifestRevision: graph.catalogManifestRevision,
    candidateManifestDigest: graph.candidateManifestDigest,
    compositionPolicyRevision: graph.compositionPolicyRevision,
    validationPolicyRevision: graph.validationPolicyRevision,
    optimizationPolicyRevision: graph.optimizationPolicyRevision,
    generationPolicyRevision: graph.generationPolicyRevision,
    operation: { requestId: uuid(622), idempotencyKey: uuid(623) },
  };
}

function authority(input: TrustedGenerationInputV1): GenerationAuthorityRecheckV1 {
  return {
    accountGateContract: input.accountGateContract,
    accountId: input.accountId,
    selectionId: input.selection.selectionId,
    weekStartLocal: input.weekStartLocal,
    timezone: input.timezone,
    entitlement: 'verified',
    planSelectionRevision: input.selection.planSelectionRevision,
    expectedStatus: 'pending_generation',
    expectedPlanRevision: null,
    goalRevision: input.goalNutritionTarget.goalRevision,
    targetPolicyRevision: input.goalNutritionTarget.targetPolicyRevision,
    preferenceRevision: input.preferenceRevision,
    safetyRevision: input.safetyRevision,
    entitlementEvidenceRevision: input.entitlementEvidenceRevision,
    candidateManifestRevision: input.candidateManifestRevision,
    candidateManifestDigest: input.candidateManifestDigest,
    compositionPolicyRevision: input.compositionPolicyRevision,
    validationPolicyRevision: input.validationPolicyRevision,
    optimizationPolicyRevision: input.optimizationPolicyRevision,
    generationPolicyRevision: input.generationPolicyRevision,
  };
}

function reopenGraphDraft(graph: AdaptiveNutritionGraphV2): AdaptiveNutritionGraphDraftV2 {
  return {
    ...structuredClone(graph),
    days: graph.days.map((day) => ({
      ...structuredClone(day),
      slots: day.slots.map(({ canonicalSnapshotDigest: _digest, ...slot }) => {
        void _digest;
        return structuredClone(slot);
      }),
    })),
  };
}

function graphV1Fixture(): AdaptiveNutritionGraphV1 {
  return {
    contract_version: 1,
    selection_id: uuid(800),
    plan_revision: uuid(801),
    goal_revision: uuid(802),
    week_anchor: '2026-09-21',
    timezone: 'Europe/Moscow',
    generated_at: '2026-09-20T12:00:00.000Z',
    generation: { generatorVersion: 'synthetic-v1', contentRevision: uuid(803) },
    days: Array.from({ length: 7 }, (_, dayIndex) => ({
      date: `2026-09-${String(21 + dayIndex).padStart(2, '0')}`,
      dayIndex,
      targetSnapshot: nutrition('1400.000'),
      slots: [],
    })),
  };
}

test('1 COMPLETE_RECIPE slot encodes and decodes losslessly', async () => {
  const graph = await graphFixture();
  assert.deepEqual(await decodeAdaptiveNutritionGraphV2(graph), graph);
  assert.equal(graph.days[0].slots[0].mealSnapshot.components[0].eligibility.anchorKind, 'COMPLETE');
});

test('2 COMPOSED_MEAL with three independent components is lossless', async () => {
  const graph = await graphFixture(3);
  const decoded = await decodeAdaptiveNutritionGraphV2(graph);
  assert.equal(decoded.days[0].slots[0].mealSnapshot.components.length, 3);
  assert.deepEqual(decoded.days[0].slots[0].mealSnapshot, graph.days[0].slots[0].mealSnapshot);
});

test('3 COMPOSED_MEAL accepts five components', async () => {
  assert.equal((await graphFixture(5)).days[0].slots[0].mealSnapshot.components.length, 5);
});

test('4 six components fail closed', async () => {
  await assert.rejects(graphFixture(6), /component_limit_exceeded/);
});

test('5 component order is preserved in canonical bytes', async () => {
  const graph = await graphFixture(3);
  const order = graph.days[0].slots[0].mealSnapshot.components.map((item) => item.mealComponentId);
  assert.deepEqual((await decodeAdaptiveNutritionGraphV2(graph)).days[0].slots[0]
    .mealSnapshot.components.map((item) => item.mealComponentId), order);
});

test('6 independent recipe revisions survive graph binding', async () => {
  const components = (await graphFixture(3)).days[0].slots[0].mealSnapshot.components;
  assert.equal(new Set(components.map((item) => item.recipeRevision)).size, 3);
});

test('7 independent portion revisions survive graph binding', async () => {
  const components = (await graphFixture(3)).days[0].slots[0].mealSnapshot.components;
  assert.equal(new Set(components.map((item) => item.portionRevision)).size, 3);
});

test('8 independent eligibility revisions survive graph binding', async () => {
  const components = (await graphFixture(3)).days[0].slots[0].mealSnapshot.components;
  assert.equal(new Set(components.map((item) => item.eligibility.eligibilityRevisionId)).size, 3);
});

test('9 anchor-only projection cannot pass the MealSnapshot digest', async () => {
  const graph = await graphFixture(3);
  graph.days[0].slots[0].mealSnapshot.components.splice(1);
  await assert.rejects(decodeAdaptiveNutritionGraphV2(graph), /meal_digest|incomplete_meal_snapshot|nutrition/);
});

test('10 synthetic composite recipe identity is an unknown forbidden slot field', async () => {
  const graph = await graphFixture(3) as unknown as Record<string, unknown>;
  const day = (graph.days as Array<Record<string, unknown>>)[0];
  const slot = (day.slots as Array<Record<string, unknown>>)[0];
  slot.syntheticCompositeRecipeId = uuid(999);
  await assert.rejects(decodeAdaptiveNutritionGraphV2(graph), /graph_v2_slot_fields/);
});

test('11 composed components remain in one slot and are not split', async () => {
  const graph = await graphFixture(3);
  assert.equal(graph.days[0].slots.length, 1);
  assert.equal(graph.days[0].slots[0].mealSnapshot.components.length, 3);
});

test('12 Graph v1 canonical bytes and digest remain deterministic', async () => {
  const graph = graphV1Fixture();
  const before = encodeAdaptiveNutritionGraphCanonicalV1(graph);
  assert.deepEqual(encodeAdaptiveNutritionGraphCanonicalV1(decodeAdaptiveNutritionGraphV1(graph)), before);
  assert.equal(await adaptiveNutritionGraphSha256HexV1(graph), await adaptiveNutritionGraphSha256HexV1(graph));
});

test('13 Graph v1 decoder rejects Graph v2', async () => {
  const graph = await graphFixture();
  assert.throws(() => decodeAdaptiveNutritionGraphV1(graph), /graph_fields/);
});

test('14 Graph v2 decoder rejects Graph v1', async () => {
  await assert.rejects(decodeAdaptiveNutritionGraphV2(graphV1Fixture()), /graph_v2_fields/);
});

test('15 identical Graph v2 inputs produce byte-identical digest', async () => {
  const graph = await graphFixture(3);
  assert.deepEqual(await encodeAdaptiveNutritionGraphCanonicalV2(graph), await encodeAdaptiveNutritionGraphCanonicalV2(graph));
  assert.equal(await adaptiveNutritionGraphSha256HexV2(graph), await adaptiveNutritionGraphSha256HexV2(graph));
});

test('16 changing one component revision invalidates or changes canonical identity', async () => {
  const graph = await graphFixture(3);
  const original = await adaptiveNutritionGraphSha256HexV2(graph);
  const draft = reopenGraphDraft(graph);
  draft.days[0].slots[0].componentEvidence[0].publicationRevision = id();
  const changed = await sealAdaptiveNutritionGraphV2(draft);
  assert.notEqual(original, await adaptiveNutritionGraphSha256HexV2(changed));
});

test('17 stale Goal revision is rejected by CAS', async () => {
  const graph = await graphFixture();
  const input = generationInput(graph);
  const recheck = authority(input);
  recheck.goalRevision = id();
  assert.deepEqual(await finalizeGeneratedWeekPlanV1(input, graph, recheck),
    { status: 'GENERATION_CONFLICT_STALE_INPUT', reason: 'GOAL_REVISION_STALE' });
});

test('18 stale target policy revision is rejected by CAS', async () => {
  const graph = await graphFixture();
  const input = generationInput(graph);
  const recheck = authority(input);
  recheck.targetPolicyRevision = id();
  assert.equal((await finalizeGeneratedWeekPlanV1(input, graph, recheck)).status, 'GENERATION_CONFLICT_STALE_INPUT');
});

test('19 stale manifest digest is rejected by CAS', async () => {
  const graph = await graphFixture();
  const input = generationInput(graph);
  const recheck = authority(input);
  recheck.candidateManifestDigest = hash('9');
  assert.equal((await finalizeGeneratedWeekPlanV1(input, graph, recheck)).status, 'GENERATION_CONFLICT_STALE_INPUT');
});

test('20 sourceKind must match snapshot anchor structure', async () => {
  const graph = await graphFixture(3);
  graph.days[0].slots[0].sourceKind = 'COMPLETE_RECIPE';
  await assert.rejects(decodeAdaptiveNutritionGraphV2(graph), /complete_source_mismatch/);
});

test('21 COMPLETE_RECIPE with multiple components is rejected', async () => {
  const graph = await graphFixture(3);
  graph.days[0].slots[0].sourceKind = 'COMPLETE_RECIPE';
  await assert.rejects(decodeAdaptiveNutritionGraphV2(graph), /complete_source_mismatch/);
});

test('22 COMPOSED_MEAL without PARTIAL anchor is rejected', async () => {
  const graph = await graphFixture();
  graph.days[0].slots[0].sourceKind = 'COMPOSED_MEAL';
  await assert.rejects(decodeAdaptiveNutritionGraphV2(graph), /composed_source_mismatch/);
});

test('23 COMPOSED_MEAL with two anchors is rejected by immutable MealSnapshot validation', async () => {
  const graph = await graphFixture(3);
  graph.days[0].slots[0].mealSnapshot.components[1].eligibility.anchorKind = 'PARTIAL';
  await assert.rejects(decodeAdaptiveNutritionGraphV2(graph), /anchor|meal_digest|eligibility/);
});

test('24 GeneratedWeekPlanV1 binds Graph v2 without re-authoring', async () => {
  const graph = await graphFixture(3);
  const input = generationInput(graph);
  const plan = await bindGeneratedWeekPlanV1(input, graph);
  assert.equal(plan.contract, generatedWeekPlanContractV1);
  assert.deepEqual(plan.graph, graph);
  assert.equal(plan.graphDigest, await adaptiveNutritionGraphSha256HexV2(graph));
  assert.equal(plan.generationInputDigest, await trustedGenerationInputDigestV1(input));
});

test('25 Graph v2 is PLAN-only and strict decoding rejects FACT fields', async () => {
  const graph = await graphFixture() as unknown as Record<string, unknown>;
  graph.facts = [{ event: 'CONSUMED' }];
  await assert.rejects(decodeAdaptiveNutritionGraphV2(graph), /graph_v2_fields/);
});

test('26 authoring content without immutable publication evidence remains ineligible', async () => {
  const graph = await graphFixture() as unknown as AdaptiveNutritionGraphV2;
  graph.days[0].slots[0].componentEvidence = [];
  await assert.rejects(decodeAdaptiveNutritionGraphV2(graph), /component_evidence_binding_mismatch/);
});

test('strict generation input rejects unknown authority and non-Monday input', async () => {
  const graph = await graphFixture();
  const input = generationInput(graph) as unknown as Record<string, unknown>;
  input.clientPremium = true;
  assert.throws(() => decodeTrustedGenerationInputV1(input), /trusted_generation_input_fields/);
  const wrongWeek = generationInput(graph);
  wrongWeek.weekStartLocal = '2026-09-22';
  assert.throws(() => decodeTrustedGenerationInputV1(wrongWeek), /week_start_not_monday/);
});

test('entitlement recheck denies generation after revoke or expiry', async () => {
  const graph = await graphFixture();
  const input = generationInput(graph);
  assert.equal((await finalizeGeneratedWeekPlanV1(input, graph, { ...authority(input), entitlement: 'revoked' })).status,
    'GENERATION_ENTITLEMENT_DENIED');
  assert.equal((await finalizeGeneratedWeekPlanV1(input, graph, { ...authority(input), entitlement: 'expired' })).status,
    'GENERATION_ENTITLEMENT_DENIED');
});

test('CAS rejects account, selection and week identity changes without rebasing', async () => {
  const graph = await graphFixture();
  const input = generationInput(graph);
  assert.equal((await finalizeGeneratedWeekPlanV1(input, graph,
    { ...authority(input), accountId: id() })).status, 'GENERATION_CONFLICT_STALE_INPUT');
  assert.equal((await finalizeGeneratedWeekPlanV1(input, graph,
    { ...authority(input), selectionId: id() })).status, 'GENERATION_CONFLICT_STALE_INPUT');
  assert.equal((await finalizeGeneratedWeekPlanV1(input, graph,
    { ...authority(input), timezone: 'Europe/London' })).status, 'GENERATION_CONFLICT_STALE_INPUT');
});

test('idempotency distinguishes exact replay, unknown result and payload mismatch', async () => {
  const graph = await graphFixture();
  const input = generationInput(graph);
  const generationInputDigest = await trustedGenerationInputDigestV1(input);
  const attempt = { accountId: input.accountId, weekStartLocal: input.weekStartLocal,
    idempotencyKey: input.operation.idempotencyKey, generationInputDigest };
  assert.deepEqual(resolveGenerationReplayV1(null, attempt), { status: 'NEW' });
  assert.deepEqual(resolveGenerationReplayV1({ ...attempt, state: 'in_progress', resultDigest: null }, attempt),
    { status: 'UNKNOWN' });
  assert.deepEqual(resolveGenerationReplayV1({ ...attempt, state: 'settled', resultDigest: hash('8') }, attempt),
    { status: 'EXACT_REPLAY', resultDigest: hash('8') });
  assert.equal(resolveGenerationReplayV1({ ...attempt, state: 'settled', resultDigest: hash('8') },
    { ...attempt, generationInputDigest: hash('7') }).status, 'GENERATION_CONFLICT_IDEMPOTENCY');
});
