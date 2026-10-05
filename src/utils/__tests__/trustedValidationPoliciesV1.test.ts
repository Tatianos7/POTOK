import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import test from 'node:test';
import {
  sealAdaptiveNutritionCandidateManifestV2, candidateRecipeSnapshotDigestV2,
  sealNutritionPreferenceSnapshotV1, sealNutritionSafetySnapshotV1,
  adaptiveNutritionCandidateManifestContractV2, adaptiveNutritionCandidateManifestEncodingV2,
  nutritionPreferenceSnapshotContractV1, nutritionSafetySnapshotContractV1,
} from '../adaptiveNutritionAuthoritiesV1';
import {
  trustedGenerationInputContractV1, sharedAccountGateContractV1, trustedGenerationInputDigestV1,
  type TrustedGenerationInputV1,
} from '../adaptiveNutritionGraphV2';
import { goalNutritionTargetContractV1 } from '../adaptiveNutritionMealBalanceV1';
import type { GraphNutritionV1, GraphRecipeSnapshotV1 } from '../adaptiveNutritionGraphV1';
import {
  trustedValidationEvidenceContractV1, componentValidationEvidenceContractV1,
  mealDistributionPolicyContractV1, ordinaryFallbackEvidenceContractV1, planEligibilityEvidenceContractV1,
  sealComponentValidationEvidenceV1,
  sealPlanEligibilityEvidenceV1, sealTrustedValidationEvidenceV1,
} from '../trustedValidationEvidenceV1';

const id = (n: number) => `00000000-0000-4000-8000-${String(n).padStart(12, '0')}`;
const h = (s: string) => s.repeat(64);
const nutrition: GraphNutritionV1 = { calories: '100.000', protein: '10.000', fat: '5.000', carbs: '10.000', fiber: '2.000' };
const zero: GraphNutritionV1 = { calories: '0.000', protein: '0.000', fat: '0.000', carbs: '0.000', fiber: '0.000' };

async function evidenceFixture() {
  const recipe: GraphRecipeSnapshotV1 = {
    recipeId: id(10), recipeRevisionId: id(11), displayNameSnapshot: 'Synthetic only',
    baseYield: { servings: '1.000', servingLabel: 'portion', totalYieldGrams: '100.000' },
    fullRecipeNutrition: nutrition, ingredients: [{ componentId: id(12), recipeRevisionId: id(11),
      identity: { kind: 'canonical_food', canonicalFoodId: id(13) }, displayNameSnapshot: 'Synthetic food',
      state: 'as-sold', quantity: { amount: '100.000', unit: 'g' }, normalizedGrams: '100.000',
      normalizationEvidenceRef: null, scaling: { mode: 'continuous' }, nutrition, sortOrder: 0 }],
  };
  const manifest = await sealAdaptiveNutritionCandidateManifestV2({
    contract: adaptiveNutritionCandidateManifestContractV2, encoding: adaptiveNutritionCandidateManifestEncodingV2,
    manifestRevision: id(20), supersedesManifestRevision: null, publicationState: 'PUBLISHED',
    publishedAt: '2026-09-28T00:00:00.000Z', entries: [{
      recipeId: id(10), recipeRevisionId: id(11), portionRevisionId: id(14), eligibilityRevisionId: id(15),
      publicationRevision: id(16), publicationStatus: 'PUBLISHED', canonicalEvidenceRevision: id(17), canonicalEvidenceDigest: h('a'),
      nutritionEvidenceRevision: id(18), nutritionEvidenceDigest: h('b'), allergenEvidenceRevision: id(19), dietaryEvidenceRevision: id(21),
      ingredientIds: [id(13)], allergenCodes: [], intoleranceCodes: [], dietaryCodes: [], allowedMealTypes: ['dinner'],
      role: 'MAIN_COMPONENT', anchorKind: 'COMPLETE', requiredCompanionRoleSets: [], pairingTags: [], incompatiblePairingTags: [],
      repeatFamily: 'synthetic', energyClass: 'BALANCED', beverageClass: 'NOT_BEVERAGE', dominantIngredientFamily: 'synthetic_family',
      accessibility: 'COMMON_RU_RETAIL', specialty: false, expensive: false,
      portionRules: { mode: 'HYBRID', assignedServingsMinimum: '1.000', assignedServingsMaximum: '2.000',
        assignedServingsIncrement: '1.000', componentIncrements: [] }, recipeSnapshot: recipe,
      recipeSnapshotDigest: await candidateRecipeSnapshotDigestV2(recipe),
    }],
  });
  const preference = await sealNutritionPreferenceSnapshotV1({ contract: nutritionPreferenceSnapshotContractV1,
    accountId: id(1), revisionId: id(30), supersedesRevisionId: null, createdAt: '2026-09-28T00:00:00.000Z',
    hard: { dietaryPattern: 'UNSPECIFIED', excludedMealTypes: [], excludedIngredientIds: [], excludedRecipeIds: [] },
    soft: { likedIngredientIds: [], dislikedIngredientIds: [], conveniencePreference: null, mealStylePreferences: [] } });
  const safety = await sealNutritionSafetySnapshotV1({ contract: nutritionSafetySnapshotContractV1, accountId: id(1),
    revisionId: id(31), supersedesRevisionId: null, createdAt: '2026-09-28T00:00:00.000Z',
    declaredAllergenCodes: [], declaredIntoleranceCodes: [], dietaryHardExclusionCodes: [] });
  const input: TrustedGenerationInputV1 = {
    contract: trustedGenerationInputContractV1, accountGateContract: sharedAccountGateContractV1, accountId: id(1),
    selection: { selectionId: id(2), planSelectionRevision: id(3), expectedStatus: 'pending_generation',
      expectedPlanRevision: null, proposedPlanRevision: id(4) }, weekStartLocal: '2026-09-28', timezone: 'UTC',
    goalNutritionTarget: { contract: goalNutritionTargetContractV1, goalRevision: id(5), targetPolicyRevision: id(6),
      calories: { min: '100.000', target: '150.000', max: '200.000' }, protein: null, fat: null, carbs: null, fiber: null },
    preferenceRevision: id(30), safetyRevision: id(31), entitlementEvidenceRevision: id(32),
    candidateManifestRevision: manifest.manifestRevision, candidateManifestDigest: manifest.digest,
    compositionPolicyRevision: id(40), validationPolicyRevision: id(41), optimizationPolicyRevision: id(42), generationPolicyRevision: id(43),
    operation: { requestId: id(44), idempotencyKey: id(45) },
  };
  const entry = manifest.entries[0];
  const component = await sealComponentValidationEvidenceV1({ contract: componentValidationEvidenceContractV1,
    recipeId: entry.recipeId, recipeRevisionId: entry.recipeRevisionId, portionRevisionId: entry.portionRevisionId,
    eligibilityRevisionId: entry.eligibilityRevisionId, slotId: id(50), mealComponentId: id(51),
    publicationRevision: entry.publicationRevision, ingredientFamilies: ['synthetic_family'], proteinSource: true, produceSource: false,
    portionPolicyRevision: id(52), canonicalEvidenceRevision: entry.canonicalEvidenceRevision,
    canonicalEvidenceDigest: entry.canonicalEvidenceDigest, nutritionEvidenceRevision: entry.nutritionEvidenceRevision,
    nutritionEvidenceDigest: entry.nutritionEvidenceDigest, allergenEvidenceRevision: entry.allergenEvidenceRevision,
    dietaryEvidenceRevision: entry.dietaryEvidenceRevision });
  const eligibility = await sealPlanEligibilityEvidenceV1({ contract: planEligibilityEvidenceContractV1, recipeId: entry.recipeId,
    recipeRevisionId: entry.recipeRevisionId, portionRevisionId: entry.portionRevisionId, eligibilityRevisionId: entry.eligibilityRevisionId,
    planEligible: true, evidenceRevision: id(53) });
  const context = { input, manifest, preference, safety };
  const evidence = await sealTrustedValidationEvidenceV1({ contract: trustedValidationEvidenceContractV1,
    accountId: input.accountId, selectionId: input.selection.selectionId, weekStartLocal: input.weekStartLocal, timezone: input.timezone,
    generationInputDigest: await trustedGenerationInputDigestV1(input), validationPolicyRevision: input.validationPolicyRevision,
    compositionPolicyRevision: input.compositionPolicyRevision, optimizationPolicyRevision: input.optimizationPolicyRevision,
    candidateManifestRevision: manifest.manifestRevision, candidateManifestDigest: manifest.digest,
    preferenceRevision: preference.revisionId, preferenceDigest: preference.digest, safetyRevision: safety.revisionId, safetyDigest: safety.digest,
    distributionPolicy: { contract: mealDistributionPolicyContractV1, policyRevision: input.validationPolicyRevision,
      compositionPolicyRevision: input.compositionPolicyRevision, days: Array.from({ length: 7 }, (_, i) => ({
        date: `2026-${i < 3 ? '09' : '10'}-${String(i < 3 ? 28 + i : i - 2).padStart(2, '0')}`,
        requiredSlots: i === 0 ? [{ slotId: id(50), sortOrder: 0, mealType: 'dinner' as const }] : [],
        nutritionBounds: i === 0 ? [{ slotId: id(50), bounds: { minimum: zero, target: nutrition, maximum: nutrition } }] : [],
        requirements: i === 0 ? [{ slotId: id(50), proteinSourceRequired: true, produceRequired: false }] : [],
        distributionBounds: i === 0 ? [{ slotId: id(50), sortOrder: 0, bounds: { minimum: zero, target: nutrition, maximum: nutrition } }] : [],
      })) }, components: [component], ordinaryFallback: { contract: ordinaryFallbackEvidenceContractV1,
      validationPolicyRevision: input.validationPolicyRevision, candidateManifestRevision: manifest.manifestRevision,
      candidateManifestDigest: manifest.digest, candidatePoolDigest: h('c'), status: 'VALID', ordinaryWeekDigest: h('d') },
    planEligibility: [eligibility] }, context);
  return { evidence, context };
}

function withoutDigest<T extends { digest: string }>(value: T): Omit<T, 'digest'> {
  const { digest, ...content } = value;
  assert.equal(typeof digest, 'string');
  return content;
}

import {
  compositionPolicySnapshotContractV1, balancePolicySnapshotContractV1, trustedValidationPoliciesContractV1,
  type CompositionPolicySnapshotV1,
  sealCompositionPolicySnapshotV1, sealBalancePolicySnapshotV1, sealTrustedValidationPoliciesV1,
  decodeCompositionPolicySnapshotV1, decodeCompositionPolicySnapshotRawV1,
  decodeBalancePolicySnapshotV1, decodeBalancePolicySnapshotRawV1,
  decodeTrustedValidationPoliciesV1, decodeTrustedValidationPoliciesRawV1,
  assertTrustedValidationPoliciesPinnedV1, trustedValidationPoliciesCanonicalBytesV1,
} from '../trustedValidationPoliciesV1';
import { balancePolicyContractV1 } from '../adaptiveNutritionMealBalanceV1';

// Synthetic values exist only in this test; production never creates a policy.
async function fixture() {
  const { evidence, context: authority } = await evidenceFixture();
  const context = { ...authority, evidence };
  const composition = await sealCompositionPolicySnapshotV1({ contract: compositionPolicySnapshotContractV1,
    policy: { policyRevision: context.input.compositionPolicyRevision, maxComponents: 5,
      patterns: [{ patternId: 'synthetic_complete', allowedMealTypes: ['dinner'], roles: ['MAIN_COMPONENT'] }],
      nutritionWeights: { calories: 2, protein: 1, fat: 1, carbs: 1, fiber: 1 } } }, context.input);
  const balance = await sealBalancePolicySnapshotV1({ contract: balancePolicySnapshotContractV1,
    policy: { contract: balancePolicyContractV1, policyRevision: context.input.validationPolicyRevision,
      maxComponents: 5, exactRecipePerWeek: 2, exactRecipePerDay: 1, repeatFamilyPerWeek: 3,
      dominantIngredientFamilyPerWeek: 4, specialtyMealsPerWeek: 1, expensiveMealsPerWeek: 2,
      allowedWarningCodes: ['OPTIONAL_SPECIALTY_USED'] } }, context.input);
  const aggregate = await sealTrustedValidationPoliciesV1({ contract: trustedValidationPoliciesContractV1,
    generationInputDigest: evidence.generationInputDigest, validationEvidenceDigest: evidence.digest,
    composition, balance }, context);
  return { context, composition, balance, aggregate };
}

function reorder(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(reorder);
  if (value && typeof value === 'object') return Object.fromEntries(Object.entries(value).reverse().map(([k,v]) => [k,reorder(v)]));
  return value;
}

test('valid explicit policies and aggregate normalize immutably without modifying caller', async () => {
  const { context, composition, balance, aggregate } = await fixture();
  assert.deepEqual(await decodeCompositionPolicySnapshotRawV1(JSON.stringify(composition), context.input), composition);
  assert.deepEqual(await decodeBalancePolicySnapshotRawV1(JSON.stringify(balance), context.input), balance);
  assert.deepEqual(await decodeTrustedValidationPoliciesRawV1(JSON.stringify(aggregate), context), aggregate);
  assert.ok(Object.isFrozen(aggregate.composition.policy.patterns[0].roles));
  assert.ok(Object.isFrozen(aggregate.balance.policy.allowedWarningCodes));
  const caller = structuredClone(withoutDigest(composition));
  await sealCompositionPolicySnapshotV1(caller, context.input);
  assert.equal(Object.isFrozen(caller.policy.patterns), false);
});
test('lexical key order and independent exact SHA-256 recomputation', async () => {
  const { context, composition, aggregate } = await fixture();
  assert.deepEqual(await decodeCompositionPolicySnapshotV1(reorder(composition), context.input), composition);
  assert.deepEqual(await decodeTrustedValidationPoliciesV1(reorder(aggregate), context), aggregate);
  const bytes = await trustedValidationPoliciesCanonicalBytesV1(aggregate, context);
  assert.equal(createHash('sha256').update(bytes).digest('hex'), aggregate.digest);
  assert.deepEqual(await assertTrustedValidationPoliciesPinnedV1(aggregate, aggregate, context), aggregate);
});
for (const [name, mutate] of [
  ['unknown field', (v: Record<string, unknown>) => { v.extra = true; }],
  ['missing field', (v: Record<string, unknown>) => { delete v.nutritionWeights; }],
  ['wrong type', (v: Record<string, unknown>) => { v.maxComponents = '5'; }],
  ['wrong revision', (v: Record<string, unknown>) => { v.policyRevision = id(999); }],
  ['duplicate pattern', (v: Record<string, unknown>) => { const a = v.patterns as unknown[]; a.push(structuredClone(a[0])); }],
  ['invalid meal type', (v: Record<string, unknown>) => { (v.patterns as Array<Record<string, unknown>>)[0].allowedMealTypes = ['supper']; }],
  ['invalid role', (v: Record<string, unknown>) => { (v.patterns as Array<Record<string, unknown>>)[0].roles = ['UNKNOWN']; }],
  ['noncanonical meal order', (v: Record<string, unknown>) => { (v.patterns as Array<Record<string, unknown>>)[0].allowedMealTypes = ['dinner','breakfast']; }],
  ['noncanonical role order', (v: Record<string, unknown>) => { (v.patterns as Array<Record<string, unknown>>)[0].roles = ['SAUCE','MAIN_COMPONENT']; }],
  ['all zero weights', (v: Record<string, unknown>) => { v.nutritionWeights = { calories: 0, protein: 0, fat: 0, carbs: 0, fiber: 0 }; }],
  ['fractional weight', (v: Record<string, unknown>) => { (v.nutritionWeights as Record<string, unknown>).calories = 0.1; }],
  ['negative zero', (v: Record<string, unknown>) => { (v.nutritionWeights as Record<string, unknown>).calories = -0; }],
  ['sparse patterns', (v: Record<string, unknown>) => { delete (v.patterns as unknown[])[0]; }],
] as const) test(`composition rejects ${name}`, async () => {
  const { context, composition } = await fixture();
  const content = structuredClone(withoutDigest(composition));
  mutate(content.policy as unknown as Record<string, unknown>);
  await assert.rejects(sealCompositionPolicySnapshotV1(content, context.input));
});
for (const [name, mutate] of [
  ['missing warning codes', (v: Record<string, unknown>) => { delete v.allowedWarningCodes; }],
  ['unknown warning code', (v: Record<string, unknown>) => { v.allowedWarningCodes = ['UNKNOWN']; }],
  ['duplicate warning code', (v: Record<string, unknown>) => { v.allowedWarningCodes = ['OPTIONAL_SPECIALTY_USED','OPTIONAL_SPECIALTY_USED']; }],
  ['wrong warning type', (v: Record<string, unknown>) => { v.allowedWarningCodes = false; }],
  ['noncanonical warnings', (v: Record<string, unknown>) => { v.allowedWarningCodes = ['OPTIONAL_SPECIALTY_USED','OPTIONAL_EXPENSIVE_USED']; }],
  ['wrong revision', (v: Record<string, unknown>) => { v.policyRevision = id(999); }],
  ['unknown field', (v: Record<string, unknown>) => { v.extra = true; }],
  ['changed numeric limits', (v: Record<string, unknown>) => { v.exactRecipePerWeek = 3; }],
  ['coerced limit', (v: Record<string, unknown>) => { v.maxComponents = '5'; }],
] as const) test(`balance rejects ${name}`, async () => {
  const { context, balance } = await fixture();
  const content = structuredClone(withoutDigest(balance));
  mutate(content.policy as unknown as Record<string, unknown>);
  await assert.rejects(sealBalancePolicySnapshotV1(content, context.input));
});
for (const kind of ['composition','balance','aggregate'] as const) test(`${kind} rejects raw duplicate and escaped equivalent keys`, async () => {
  const { context, composition, balance, aggregate } = await fixture();
  const value = { composition, balance, aggregate }[kind];
  const decode = kind === 'composition' ? (s: string) => decodeCompositionPolicySnapshotRawV1(s,context.input)
    : kind === 'balance' ? (s: string) => decodeBalancePolicySnapshotRawV1(s,context.input)
      : (s: string) => decodeTrustedValidationPoliciesRawV1(s,context);
  const raw = JSON.stringify(value);
  await assert.rejects(decode(raw.replace('{', '{"contract":"substitute",')));
  await assert.rejects(decode(raw.replace('{', '{"\\u0063ontract":"substitute",')));
});
test('changed patterns, ordering and warnings change digest; independently pinned package rejects substitutes', async () => {
  const { context, composition, balance, aggregate } = await fixture();
  const c = structuredClone(withoutDigest(composition));
  c.policy.patterns[0].allowedMealTypes = ['lunch'];
  const replacement = await sealCompositionPolicySnapshotV1(c, context.input);
  assert.notEqual(replacement.digest, composition.digest);
  const b = structuredClone(withoutDigest(balance)); b.policy.allowedWarningCodes = [];
  const balanceReplacement = await sealBalancePolicySnapshotV1(b, context.input);
  assert.notEqual(balanceReplacement.digest, balance.digest);
  for (const delta of [{ composition: replacement }, { balance: balanceReplacement }]) {
    const hostile = await sealTrustedValidationPoliciesV1({ ...withoutDigest(aggregate), ...delta }, context);
    await assert.rejects(assertTrustedValidationPoliciesPinnedV1(hostile, aggregate, context), /SUBSTITUTION/);
  }
  c.policy.patterns.push({ patternId: 'second_synthetic', allowedMealTypes: ['dinner'], roles: ['MAIN_COMPONENT'] });
  const first = await sealCompositionPolicySnapshotV1(c, context.input);
  c.policy.patterns.reverse();
  assert.notEqual((await sealCompositionPolicySnapshotV1(c, context.input)).digest, first.digest);
});
for (const field of ['composition','balance','generationInputDigest','validationEvidenceDigest'] as const) test(`aggregate requires exact ${field}`, async () => {
  const { context, aggregate } = await fixture();
  const content = structuredClone(withoutDigest(aggregate)) as unknown as Record<string, unknown>;
  if (field.endsWith('Digest')) content[field] = h('f'); else delete content[field];
  await assert.rejects(sealTrustedValidationPoliciesV1(content as unknown as Omit<typeof aggregate,'digest'>, context));
});
for (const kind of ['composition','balance','aggregate'] as const) test(`${kind} rejects digest tamper`, async () => {
  const { context, composition, balance, aggregate } = await fixture();
  if (kind === 'composition') await assert.rejects(decodeCompositionPolicySnapshotV1({ ...composition,digest: h('f') },context.input), /DIGEST/);
  else if (kind === 'balance') await assert.rejects(decodeBalancePolicySnapshotV1({ ...balance,digest: h('f') },context.input), /DIGEST/);
  else await assert.rejects(decodeTrustedValidationPoliciesV1({ ...aggregate,digest: h('f') },context), /DIGEST/);
});
test('aggregate cannot rebind policies to a substituted evidence package', async () => {
  const { context, aggregate } = await fixture();
  const changed = structuredClone(withoutDigest(context.evidence));
  changed.ordinaryFallback.candidatePoolDigest = h('e');
  const evidence = await sealTrustedValidationEvidenceV1(changed, context);
  await assert.rejects(decodeTrustedValidationPoliciesV1(aggregate, { ...context, evidence }), /BINDING/);
});
test('missing entire policies and unsupported envelope fields reject without defaults', async () => {
  const { context, composition, aggregate } = await fixture();
  await assert.rejects(decodeCompositionPolicySnapshotV1({ ...composition, extra: 1 }, context.input));
  await assert.rejects(decodeTrustedValidationPoliciesV1({ ...aggregate, extra: 1 }, context));
  const bad = structuredClone(withoutDigest(aggregate));
  (bad as unknown as Record<string,unknown>).composition = null;
  await assert.rejects(sealTrustedValidationPoliciesV1(bad, context));
});

class HostileRolesArray extends Array<string> {
  override map<U>(): U[] { return ['MAIN_COMPONENT'] as U[]; }
}
class PolicyArraySubclass<T> extends Array<T> {}

for (const [name, mutate] of [
  ['roles subclass with overridden map', (p: CompositionPolicySnapshotV1['policy']) => {
    p.patterns[0].roles = new HostileRolesArray('UNKNOWN_ROLE') as typeof p.patterns[0]['roles'];
  }],
  ['patterns subclass', (p: CompositionPolicySnapshotV1['policy']) => {
    p.patterns = new PolicyArraySubclass(...p.patterns);
  }],
  ['non-enumerable pattern', (p: CompositionPolicySnapshotV1['policy']) => {
    Object.defineProperty(p.patterns, '0', { enumerable: false });
  }],
  ['non-enumerable role', (p: CompositionPolicySnapshotV1['policy']) => {
    Object.defineProperty(p.patterns[0].roles, '0', { enumerable: false });
  }],
  ['sparse patterns', (p: CompositionPolicySnapshotV1['policy']) => { delete p.patterns[0]; }],
  ['extra string property', (p: CompositionPolicySnapshotV1['policy']) => {
    Object.defineProperty(p.patterns, 'extra', { value: true });
  }],
  ['extra symbol property', (p: CompositionPolicySnapshotV1['policy']) => {
    Object.defineProperty(p.patterns, Symbol('extra'), { value: true });
  }],
  ['modified prototype', (p: CompositionPolicySnapshotV1['policy']) => {
    Object.setPrototypeOf(p.patterns[0].roles, Object.create(Array.prototype));
  }],
  ['accessor index', (p: CompositionPolicySnapshotV1['policy']) => {
    Object.defineProperty(p.patterns, '0', { enumerable: true, get() { throw new Error('GETTER_MUST_NOT_RUN'); } });
  }],
  ['own overridden map', (p: CompositionPolicySnapshotV1['policy']) => {
    Object.defineProperty(p.patterns, 'map', { value() { throw new Error('MAP_MUST_NOT_RUN'); } });
  }],
] as const) test(`array boundary rejects ${name}`, async () => {
  const { context, composition } = await fixture();
  const candidate = structuredClone(withoutDigest(composition));
  mutate(candidate.policy);
  await assert.rejects(sealCompositionPolicySnapshotV1(candidate, context.input), /INVALID_POLICY_ARRAY/);
});

test('plain arrays retain canonical digest, order and raw decode behavior', async () => {
  const { context, composition, balance, aggregate } = await fixture();
  assert.equal(Object.getPrototypeOf(composition.policy.patterns), Array.prototype);
  assert.deepEqual(await sealCompositionPolicySnapshotV1(structuredClone(withoutDigest(composition)), context.input), composition);
  assert.deepEqual(await decodeCompositionPolicySnapshotRawV1(JSON.stringify(composition), context.input), composition);
  assert.deepEqual(await decodeBalancePolicySnapshotRawV1(JSON.stringify(balance), context.input), balance);
  assert.deepEqual(await decodeTrustedValidationPoliciesRawV1(JSON.stringify(aggregate), context), aggregate);
});

function proxyWithoutMethodTrust<T extends object>(target: T, replacement: unknown, calls: { count: number }): T {
  return new Proxy(target, { get(object, key, receiver) {
    if (key === 'map') return () => { calls.count += 1; return replacement; };
    return Reflect.get(object, key, receiver);
  } });
}
test('Proxy UNKNOWN_ROLE cannot substitute valid roles via map', async () => {
  const { context, composition } = await fixture();
  const candidate = structuredClone(withoutDigest(composition));
  const calls = { count: 0 };
  candidate.policy.patterns[0].roles = proxyWithoutMethodTrust(['UNKNOWN_ROLE'] as unknown as typeof candidate.policy.patterns[0]['roles'], ['MAIN_COMPONENT'], calls);
  await assert.rejects(sealCompositionPolicySnapshotV1(candidate, context.input));
  assert.equal(calls.count, 0);
});
test('Proxy patterns uses underlying invalid descriptor content, never map substitution', async () => {
  const { context, composition } = await fixture();
  const candidate = structuredClone(withoutDigest(composition));
  const replacement = structuredClone(candidate.policy.patterns);
  candidate.policy.patterns[0].patternId = 'INVALID TOKEN';
  const calls = { count: 0 };
  candidate.policy.patterns = proxyWithoutMethodTrust(candidate.policy.patterns, replacement, calls);
  await assert.rejects(sealCompositionPolicySnapshotV1(candidate, context.input));
  assert.equal(calls.count, 0);
});
test('Proxy pattern get cannot repair invalid underlying roles', async () => {
  const { context, composition } = await fixture();
  const candidate = structuredClone(withoutDigest(composition));
  candidate.policy.patterns[0].roles = ['UNKNOWN_ROLE'] as unknown as typeof candidate.policy.patterns[0]['roles'];
  let reads = 0;
  candidate.policy.patterns[0] = new Proxy(candidate.policy.patterns[0], { get(target,key,receiver) {
    reads += 1;
    if (key === 'roles') return ['MAIN_COMPONENT'];
    return Reflect.get(target,key,receiver);
  } });
  await assert.rejects(sealCompositionPolicySnapshotV1(candidate, context.input));
  assert.equal(reads, 0);
});
test('Proxy pattern and policy get cannot alter accepted values or canonical digest', async () => {
  const { context, composition } = await fixture();
  const candidate = structuredClone(withoutDigest(composition));
  let reads = 0;
  candidate.policy.patterns[0] = new Proxy(candidate.policy.patterns[0], { get() { reads += 1; return 'SUBSTITUTED'; } });
  candidate.policy = new Proxy(candidate.policy, { get() { reads += 1; return 'SUBSTITUTED'; } });
  assert.deepEqual(await sealCompositionPolicySnapshotV1(candidate,context.input),composition);
  assert.equal(reads,0);
});
test('Proxy warning map cannot repair UNKNOWN warning code', async () => {
  const { context, balance } = await fixture();
  const candidate = structuredClone(withoutDigest(balance));
  const calls = { count: 0 };
  candidate.policy.allowedWarningCodes = proxyWithoutMethodTrust(['UNKNOWN'] as unknown as typeof candidate.policy.allowedWarningCodes, ['OPTIONAL_SPECIALTY_USED'],calls);
  await assert.rejects(sealBalancePolicySnapshotV1(candidate,context.input));
  assert.equal(calls.count,0);
});
test('Proxy snapshot envelope and pinned input get never override descriptor values', async () => {
  const { context, composition } = await fixture();
  let reads = 0;
  const proposed = new Proxy(structuredClone(composition),{get(){reads += 1;return 'SUBSTITUTED';}});
  const input = new Proxy(context.input,{get(){reads += 1;return 'SUBSTITUTED';}});
  assert.deepEqual(await decodeCompositionPolicySnapshotV1(proposed,input),composition);
  assert.equal(reads,0);
});
test('Proxy aggregate, context and evidence are detached before downstream decoding', async () => {
  const { context, aggregate } = await fixture();
  let reads = 0;
  const hostile = <T extends object>(v:T):T => new Proxy(v,{get(){reads += 1;return 'SUBSTITUTED';}});
  const pinnedContext = hostile({ ...context, evidence: hostile(structuredClone(context.evidence)) });
  assert.deepEqual(await decodeTrustedValidationPoliciesV1(hostile(structuredClone(aggregate)),pinnedContext),aggregate);
  assert.deepEqual(await trustedValidationPoliciesCanonicalBytesV1(hostile(structuredClone(aggregate)),pinnedContext),
    await trustedValidationPoliciesCanonicalBytesV1(aggregate,context));
  assert.equal(reads,0);
});
test('normal plain policy digests remain byte-identical to pre-fix snapshots', async () => {
  const { composition, balance, aggregate } = await fixture();
  assert.equal(composition.digest,'89b5e7c38c61bdb2dd05e5a9412a4b91aade28f169a9cf5d3dd77df176786ffa');
  assert.equal(balance.digest,'c055c8df77fb39d34f519205e3fd33a5cadf2edc28bf3340e2f2f4937fdae2ba');
  assert.equal(aggregate.digest,'f2ba00fbc9cbf2e038067625e246864f61c93e74953b0d440cce2af6f7999bc0');
});
