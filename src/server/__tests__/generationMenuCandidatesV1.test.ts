import assert from 'node:assert/strict';
import test from 'node:test';
import { createGenerationMenuCandidatePreparerV1, generationMenuCandidateSourceContractV1 } from '../generationMenuCandidatesV1';
import { fullFixture as originalFullFixture, check, id, fixtureSeal, withoutDigest, type FullFixture } from '../../utils/__tests__/trustedGeneratedWeekFixturesV1';
import { sealAdaptiveNutritionCandidateManifestV2 } from '../../utils/adaptiveNutritionAuthoritiesV1';
import { trustedGenerationInputDigestV1 } from '../../utils/adaptiveNutritionGraphV2';
import { sealComponentValidationEvidenceV1, sealTrustedValidationEvidenceV1 } from '../../utils/trustedValidationEvidenceV1';
import { trustedValidationPoliciesContractV1, trustedValidationPoliciesEncodingV1,
  compositionPolicySnapshotContractV1, compositionPolicySnapshotEncodingV1 } from '../../utils/trustedValidationPoliciesV1';

const fullFixture: typeof originalFullFixture = async (...args) => structuredClone(await originalFullFixture(...args));

function source(f: FullFixture) {
  return { contract: generationMenuCandidateSourceContractV1, requestOperationId: f.context.input.operation.requestId,
    contextRaw: f.contextRaw, policiesRaw: f.policiesRaw, goalProfile: 'MAINTENANCE',
    slotRevisions: f.plan.graph.days.flatMap(day => day.slots.map(slot => ({
      slotId: slot.slotId, mealSnapshotRevision: slot.mealSnapshotRevision }))) };
}
async function run(f: FullFixture) {
  const raw = JSON.stringify(source(f));
  let loads = 0;
  const result = await createGenerationMenuCandidatePreparerV1({ async loadPreparationRaw(request) {
    loads++; assert.equal(request, f.context.input.operation.requestId); return raw;
  } }).prepare(f.context.input.operation.requestId);
  assert.equal(loads, 1);
  return result;
}
// Independent synthetic authority signing only; production never issues these receipts.
async function rebind(f: FullFixture) {
  f.context.manifest = await sealAdaptiveNutritionCandidateManifestV2(withoutDigest(f.context.manifest));
  f.context.input.candidateManifestDigest = f.context.manifest.digest;
  const e = f.evidence;
  e.generationInputDigest = await trustedGenerationInputDigestV1(f.context.input);
  e.candidateManifestDigest = f.context.manifest.digest;
  e.ordinaryFallback.candidateManifestDigest = f.context.manifest.digest;
  e.components = await Promise.all(e.components.map(c => sealComponentValidationEvidenceV1(withoutDigest(c))));
  e.components.sort((a, b) => `${a.slotId}:${a.mealComponentId}`.localeCompare(`${b.slotId}:${b.mealComponentId}`));
  f.evidence = await sealTrustedValidationEvidenceV1(withoutDigest(e), f.context);
  const composition = fixtureSeal(withoutDigest(f.policies.composition), compositionPolicySnapshotContractV1, compositionPolicySnapshotEncodingV1);
  f.policies = fixtureSeal({ ...withoutDigest(f.policies), composition, generationInputDigest: f.evidence.generationInputDigest,
    validationEvidenceDigest: f.evidence.digest }, trustedValidationPoliciesContractV1, trustedValidationPoliciesEncodingV1);
  f.rawContext.trustedGenerationInputRaw = JSON.stringify(f.context.input);
  f.rawContext.candidateManifestRaw = JSON.stringify(f.context.manifest);
  f.rawContext.trustedValidationEvidenceRaw = JSON.stringify(f.evidence);
  f.contextRaw = JSON.stringify(f.rawContext); f.policiesRaw = JSON.stringify(f.policies);
}
function widen(f: FullFixture) {
  for (const day of f.evidence.distributionPolicy.days) for (const b of [...day.nutritionBounds, ...day.distributionBounds]) {
    b.bounds.maximum = { calories: '300.000', protein: '30.000', fat: '15.000', carbs: '30.000', fiber: '6.000' };
  }
}

test('prepares actual catalog meals for all seven slots, identical to independently validated fixture meals', async () => {
  const f = await fullFixture();
  assert.equal((await check(f)).status, 'ACCEPTED');
  const before = f.contextRaw;
  const result = await run(f);
  assert.equal(result.status, 'PREPARED');
  if (result.status !== 'PREPARED') return;
  assert.equal(result.slots.length, 7);
  for (let i = 0; i < 7; i++) {
    assert.deepEqual(result.slots[i].meals.map(m => m.meal), [f.plan.graph.days[i].slots[0].mealSnapshot]);
    assert.deepEqual(result.slots[i].meals[0].componentEvidence, f.plan.graph.days[i].slots[0].componentEvidence);
    assert.equal(result.slots[i].meals[0].sourceKind, 'COMPLETE_RECIPE');
  }
  assert.equal(Object.isFrozen(result.slots[0].meals[0].meal.components), true);
  assert.equal(f.contextRaw, before);
  assert.equal('acceptedPlanRaw' in result, false);
});

test('enumerates reviewed portions and scales ingredients, grams and all nutrients with existing arithmetic', async () => {
  const f = await fullFixture(); widen(f); await rebind(f);
  const result = await run(f);
  assert.equal(result.status, 'PREPARED'); if (result.status !== 'PREPARED') return;
  const meals = result.slots[0].meals.map(m => m.meal);
  assert.equal(meals.length, 2);
  const doubled = meals.find(m => m.components[0].assignedPortion.assignedServings === '2.000')!;
  assert.equal(doubled.components[0].assignedPortion.assignedGrams, '200.000');
  assert.equal(doubled.components[0].ingredients[0].quantity.amount, '200.000');
  assert.deepEqual(doubled.nutrition, { calories: '200.000', protein: '20.000', fat: '10.000', carbs: '20.000', fiber: '4.000' });
});

test('uses the existing zero-origin portion increment grid, including a non-aligned minimum', async () => {
  const f = await fullFixture(); widen(f);
  f.context.manifest.entries[0].portionRules.assignedServingsMinimum = '1.100';
  f.context.manifest.entries[0].portionRules.assignedServingsIncrement = '0.500';
  await rebind(f);
  const result = await run(f); assert.equal(result.status, 'PREPARED'); if (result.status !== 'PREPARED') return;
  assert.deepEqual(result.slots[0].meals.map(m => m.meal.components[0].assignedPortion.assignedServings).sort(), ['1.500', '2.000']);
});

test('rejects fractional discrete ingredients without rounding to an invented piece count', async () => {
  const f = await fullFixture(state => {
    const entry = state.context.manifest.entries[0];
    entry.recipeSnapshot.ingredients[0].scaling = { mode: 'discrete', increment: '100.000' };
    entry.portionRules.componentIncrements = [{ componentId: entry.recipeSnapshot.ingredients[0].componentId, increment: '100.000' }];
    entry.portionRules.assignedServingsIncrement = '0.500';
  });
  widen(f); await rebind(f);
  const result = await run(f); assert.equal(result.status, 'PREPARED'); if (result.status !== 'PREPARED') return;
  assert.equal(result.slots[0].meals.length, 2);
  assert.ok(result.exclusions.some(e => e.reason === 'DISCRETE_PORTION_NOT_REPRESENTABLE' && e.assignedServings === '1.500'));
});

test('does not infer prepared-food grams from raw ingredient weights', async () => {
  const f = await fullFixture();
  // Make the measured cooked yield explicitly unknown in the reviewed catalog.
  f.context.manifest.entries[0].recipeSnapshot.baseYield.totalYieldGrams = null;
  const { candidateRecipeSnapshotDigestV2 } = await import('../../utils/adaptiveNutritionAuthoritiesV1');
  f.context.manifest.entries[0].recipeSnapshotDigest = await candidateRecipeSnapshotDigestV2(f.context.manifest.entries[0].recipeSnapshot);
  await rebind(f);
  const result = await run(f); assert.equal(result.status, 'PREPARED'); if (result.status !== 'PREPARED') return;
  assert.equal(result.slots[0].meals[0].meal.components[0].assignedPortion.assignedGrams, null);
});

test('honors hard recipe exclusions with an explicit incomplete slot', async () => {
  const f = await fullFixture(state => { state.context.preference.hard.excludedRecipeIds = [state.context.manifest.entries[0].recipeId]; });
  const result = await run(f); assert.equal(result.status, 'INCOMPLETE'); if (result.status !== 'INCOMPLETE') return;
  assert.equal(result.slots[0].meals.length, 0);
  assert.ok(result.exclusions.some(e => e.reason === 'RECIPE_EXCLUDED'));
});

test('blocks declared allergens and intolerance conflicts from the authoritative catalog', async () => {
  for (const kind of ['allergen', 'intolerance'] as const) {
    const f = await fullFixture(state => {
      if (kind === 'allergen') { state.context.manifest.entries[0].allergenCodes = ['milk']; state.context.safety.declaredAllergenCodes = ['milk']; }
      else { state.context.manifest.entries[0].intoleranceCodes = ['lactose']; state.context.safety.declaredIntoleranceCodes = ['lactose']; }
    });
    const result = await run(f); assert.equal(result.status, 'INCOMPLETE'); if (result.status !== 'INCOMPLETE') return;
    assert.ok(result.exclusions.some(e => e.reason === (kind === 'allergen' ? 'ALLERGEN_CONFLICT' : 'INTOLERANCE_CONFLICT')));
  }
});

test('does not convert soft dislikes into a hard food ban', async () => {
  const f = await fullFixture(state => { state.context.preference.soft.dislikedIngredientIds = state.context.manifest.entries[0].ingredientIds; });
  assert.equal((await run(f)).status, 'PREPARED');
});

test('honors ingredient, meal type and dietary exclusions independently', async () => {
  for (const kind of ['ingredient', 'meal', 'dietary'] as const) {
    const f = await fullFixture(state => {
      if (kind === 'ingredient') state.context.preference.hard.excludedIngredientIds = state.context.manifest.entries[0].ingredientIds;
      if (kind === 'meal') state.context.preference.hard.excludedMealTypes = ['dinner'];
      if (kind === 'dietary') state.context.preference.hard.dietaryPattern = 'VEGAN';
    });
    const result = await run(f); assert.equal(result.status, 'INCOMPLETE'); if (result.status !== 'INCOMPLETE') return;
    assert.ok(result.exclusions.some(e => e.reason === ({ ingredient: 'INGREDIENT_EXCLUDED', meal: 'MEAL_TYPE_EXCLUDED',
      dietary: 'DIETARY_PATTERN_CONFLICT' }[kind])));
  }
});

test('no admissible increment in the reviewed range is an explicit exclusion', async () => {
  const f = await fullFixture();
  Object.assign(f.context.manifest.entries[0].portionRules, { assignedServingsMinimum: '1.100', assignedServingsMaximum: '1.200',
    assignedServingsIncrement: '1.000' });
  await rebind(f);
  const result = await run(f); assert.equal(result.status, 'INCOMPLETE'); if (result.status !== 'INCOMPLETE') return;
  assert.ok(result.exclusions.some(e => e.reason === 'NO_REPRESENTABLE_PORTION'));
});

test('never treats a catalog recipe as reviewed for a slot without independent component evidence', async () => {
  const f = await fullFixture();
  const result = await run(f); assert.equal(result.status, 'PREPARED'); if (result.status !== 'PREPARED') return;
  assert.ok(result.exclusions.some(e => e.slotId === result.slots[0].slotId && e.recipeId === f.context.manifest.entries[1].recipeId
    && e.reason === 'COMPONENT_EVIDENCE_MISSING'));
  const bad = source(f); const context = JSON.parse(bad.contextRaw); const e = JSON.parse(context.trustedValidationEvidenceRaw);
  e.components = []; context.trustedValidationEvidenceRaw = JSON.stringify(e); bad.contextRaw = JSON.stringify(context);
  await assert.rejects(createGenerationMenuCandidatePreparerV1({ async loadPreparationRaw() { return JSON.stringify(bad); } })
    .prepare(f.context.input.operation.requestId));
});

test('enforces protein/produce requirements, both bounds and blocked accessibility', async () => {
  for (const kind of ['produce', 'maximum', 'minimum', 'accessibility'] as const) {
    const f = await fullFixture();
    if (kind === 'produce') f.evidence.distributionPolicy.days[0].requirements[0].produceRequired = true;
    if (kind === 'maximum') f.evidence.distributionPolicy.days[0].distributionBounds[0].bounds.maximum.calories = '100.000';
    if (kind === 'maximum') {
      f.evidence.distributionPolicy.days[0].nutritionBounds[0].bounds.minimum.calories = '150.000';
      f.evidence.distributionPolicy.days[0].nutritionBounds[0].bounds.target.calories = '150.000';
      f.evidence.distributionPolicy.days[0].nutritionBounds[0].bounds.maximum.calories = '200.000';
    }
    if (kind === 'minimum') {
      const b = f.evidence.distributionPolicy.days[0].nutritionBounds[0].bounds;
      b.minimum.calories = '110.000'; b.target.calories = '110.000'; b.maximum.calories = '110.000';
    }
    if (kind === 'accessibility') f.context.manifest.entries[0].accessibility = 'ACCESSIBILITY_BLOCKED';
    await rebind(f);
    const result = await run(f); assert.equal(result.status, 'INCOMPLETE'); if (result.status !== 'INCOMPLETE') return;
    assert.equal(result.slots[0].meals.length, 0);
  }
});

test('returns an atomic resource limit instead of silently truncating the portion range', async () => {
  const f = await fullFixture();
  f.context.manifest.entries[0].portionRules.assignedServingsIncrement = '0.001';
  await rebind(f);
  assert.deepEqual(await run(f), { status: 'RESOURCE_LIMIT_REACHED', requestOperationId: f.context.input.operation.requestId });
});

test('bounds the total portion candidate pool without returning an incomplete truncated pool', async () => {
  const f = await fullFixture();
  // 64 portions for each of two independently reviewed recipes in the same slot.
  for (const entry of f.context.manifest.entries.slice(0, 2)) {
    Object.assign(entry.portionRules, { assignedServingsMinimum: '1.000', assignedServingsMaximum: '64.000', assignedServingsIncrement: '1.000' });
  }
  const extra = structuredClone(f.evidence.components[1]); extra.slotId = f.evidence.components[0].slotId; extra.mealComponentId = id(9998);
  f.evidence.components.push(extra); await rebind(f);
  assert.equal((await run(f)).status, 'RESOURCE_LIMIT_REACHED');
});

test('composes a reviewed partial anchor with its required side; incompatible pairing is excluded', async () => {
  for (const incompatible of [false, true]) {
    const f = await fullFixture(); widen(f);
    const [main, side] = f.context.manifest.entries;
    main.anchorKind = 'PARTIAL'; main.requiredCompanionRoleSets = [['CARB_SIDE']];
    side.role = 'CARB_SIDE'; side.anchorKind = 'NONE';
    if (incompatible) { main.incompatiblePairingTags = ['bad']; side.pairingTags = ['bad']; }
    const component = structuredClone(f.evidence.components[1]);
    component.slotId = f.evidence.components[0].slotId; component.mealComponentId = id(9999); component.produceSource = true;
    f.evidence.components.push(component);
    f.evidence.distributionPolicy.days[0].requirements[0].produceRequired = true;
    f.policies.composition.policy.patterns.push({ patternId: 'main_side', allowedMealTypes: ['dinner'], roles: ['MAIN_COMPONENT', 'CARB_SIDE'] });
    await rebind(f);
    const result = await run(f); assert.ok(result.status === 'PREPARED' || result.status === 'INCOMPLETE');
    if (result.status !== 'PREPARED' && result.status !== 'INCOMPLETE') return;
    if (incompatible) assert.equal(result.slots[0].meals.length, 0);
    else {
      assert.ok(result.slots[0].meals.length > 0);
      assert.equal(result.slots[0].meals[0].meal.components.length, 2);
      assert.equal(result.slots[0].meals[0].sourceKind, 'COMPOSED_MEAL');
      assert.equal(result.slots[0].meals[0].meal.nutrition.calories, '200.000');
    }
  }
});

test('missing source blocks without fallback, invalid request never calls source', async () => {
  let loads = 0;
  const preparer = createGenerationMenuCandidatePreparerV1({ async loadPreparationRaw() { loads++; return null; } });
  await assert.rejects(preparer.prepare('bad'), /INVALID_MENU_CANDIDATE_REQUEST/); assert.equal(loads, 0);
  assert.deepEqual(await preparer.prepare(id(44)), { status: 'BLOCKED_SOURCE_MISSING', requestOperationId: id(44) });
  assert.equal(loads, 1);
});

test('request, source, policy and slot bindings cannot be substituted', async () => {
  const f = await fullFixture();
  for (const mutate of [
    (s: ReturnType<typeof source>) => { s.requestOperationId = id(9876); },
    (s: ReturnType<typeof source>) => { s.contextRaw = s.contextRaw.replace(f.context.manifest.digest, '0'.repeat(64)); },
    (s: ReturnType<typeof source>) => { s.policiesRaw = s.policiesRaw.replace(f.policies.digest, '0'.repeat(64)); },
    (s: ReturnType<typeof source>) => { s.slotRevisions.pop(); },
    (s: ReturnType<typeof source>) => { s.slotRevisions.push(s.slotRevisions[0]); },
  ]) {
    const s = source(f); mutate(s);
    await assert.rejects(createGenerationMenuCandidatePreparerV1({ async loadPreparationRaw() { return JSON.stringify(s); } })
      .prepare(f.context.input.operation.requestId));
  }
});

test('rejects duplicate keys, non-raw source values and unresolved/missing yield data', async () => {
  const f = await fullFixture(); const s = source(f); const raw = JSON.stringify(s);
  for (const malformed of [raw.replace('{', '{"goalProfile":"CUT",'), JSON.stringify({ ...s, contextRaw: s.contextRaw.replace('{', '{"contract":"x",') }),
    JSON.stringify({ ...s, contextRaw: s.contextRaw.replace('\\"servings\\":\\"1.000\\"', '\\"servings\\":null') }),
    {} as unknown as string]) {
    await assert.rejects(createGenerationMenuCandidatePreparerV1({ async loadPreparationRaw() { return malformed; } })
      .prepare(f.context.input.operation.requestId));
  }
});

test('repeated preparation is deterministic and does not reuse or mutate caller objects', async () => {
  const f = await fullFixture(); widen(f); await rebind(f);
  assert.deepEqual(await run(f), await run(f));
});
