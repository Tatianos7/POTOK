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
  componentValidationEvidenceDigestV1, componentValidationEvidenceCanonicalBytesV1,
  sealComponentValidationEvidenceV1, decodeComponentValidationEvidenceRawV1,
  sealPlanEligibilityEvidenceV1, sealTrustedValidationEvidenceV1, decodeTrustedValidationEvidenceV1,
  decodeTrustedValidationEvidenceRawV1, assertTrustedValidationEvidencePinnedV1,
  trustedValidationEvidenceCanonicalBytesV1,
} from '../trustedValidationEvidenceV1';

const id = (n: number) => `00000000-0000-4000-8000-${String(n).padStart(12, '0')}`;
const h = (s: string) => s.repeat(64);
const nutrition: GraphNutritionV1 = { calories: '100.000', protein: '10.000', fat: '5.000', carbs: '10.000', fiber: '2.000' };
const zero: GraphNutritionV1 = { calories: '0.000', protein: '0.000', fat: '0.000', carbs: '0.000', fiber: '0.000' };

async function fixture() {
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

test('valid explicitly supplied evidence is bound, frozen, raw decoded and canonically hashed', async () => {
  const { evidence, context } = await fixture();
  assert.deepEqual(await decodeTrustedValidationEvidenceRawV1(JSON.stringify(evidence), context), evidence);
  assert.ok(Object.isFrozen(evidence.distributionPolicy.days[0].requirements));
  assert.throws(() => { evidence.components[0].proteinSource = false; }, TypeError);
  const bytes = await trustedValidationEvidenceCanonicalBytesV1(evidence, context);
  assert.equal(createHash('sha256').update(bytes).digest('hex'), evidence.digest);
  assert.deepEqual(await assertTrustedValidationEvidencePinnedV1(evidence, evidence, context), evidence);
});

test('component domain is independent of canonical/nutrition digests and deterministic across object key order', async () => {
  const { evidence } = await fixture();
  const content = withoutDigest(evidence.components[0]);
  const reversed = Object.fromEntries(Object.entries(content).reverse());
  assert.equal(await componentValidationEvidenceDigestV1(content), await componentValidationEvidenceDigestV1(reversed));
  assert.deepEqual(componentValidationEvidenceCanonicalBytesV1(content), componentValidationEvidenceCanonicalBytesV1(reversed));
  assert.notEqual(evidence.components[0].digest, content.canonicalEvidenceDigest);
  assert.notEqual(evidence.components[0].digest, content.nutritionEvidenceDigest);
  assert.notEqual(await componentValidationEvidenceDigestV1({ ...content, produceSource: true }), evidence.components[0].digest);
  assert.equal(createHash('sha256').update(componentValidationEvidenceCanonicalBytesV1(content)).digest('hex'), evidence.components[0].digest);
});

for (const scenario of ['unknown', 'wrong-type', 'duplicate-component', 'missing-distribution', 'policy', 'missing-component',
  'canonical-digest', 'nutrition-digest', 'missing-eligibility', 'false-eligibility', 'missing-fallback',
  'missing-ordinary-digest', 'decimal', 'missing-requirement', 'missing-family', 'ambiguous-binding',
  'fallback-policy', 'slot-date', 'unknown-component', 'digest-tamper'] as const) {
  test(`fail closed: ${scenario}`, async () => {
    const { evidence, context } = await fixture();
    const draft = structuredClone(withoutDigest(evidence));
    if (scenario === 'unknown') Object.assign(draft, { generatorAuthority: true });
    if (scenario === 'wrong-type') (draft.components[0] as unknown as Record<string, unknown>).proteinSource = 1;
    if (scenario === 'duplicate-component') draft.components.push(draft.components[0]);
    if (scenario === 'missing-distribution') delete (draft as Partial<typeof draft>).distributionPolicy;
    if (scenario === 'policy') draft.distributionPolicy.policyRevision = id(99);
    if (scenario === 'missing-component') draft.components = [];
    if (scenario === 'canonical-digest' || scenario === 'nutrition-digest') {
      const content = withoutDigest(draft.components[0]);
      if (scenario === 'canonical-digest') content.canonicalEvidenceDigest = h('e');
      else content.nutritionEvidenceDigest = h('e');
      draft.components[0] = await sealComponentValidationEvidenceV1(content);
    }
    if (scenario === 'missing-eligibility') draft.planEligibility = [];
    if (scenario === 'false-eligibility') (draft.planEligibility[0] as unknown as Record<string, unknown>).planEligible = false;
    if (scenario === 'missing-fallback') delete (draft as Partial<typeof draft>).ordinaryFallback;
    if (scenario === 'missing-ordinary-digest') draft.ordinaryFallback.ordinaryWeekDigest = null;
    if (scenario === 'decimal') draft.distributionPolicy.days[0].nutritionBounds[0].bounds.target.calories = '1e2';
    if (scenario === 'missing-requirement') draft.distributionPolicy.days[0].requirements = [];
    if (scenario === 'missing-family') draft.components[0].ingredientFamilies = [];
    if (scenario === 'ambiguous-binding') {
      const extra = await sealComponentValidationEvidenceV1({ ...withoutDigest(draft.components[0]), mealComponentId: id(52) });
      draft.components.push(extra);
    }
    if (scenario === 'fallback-policy') draft.ordinaryFallback.validationPolicyRevision = id(99);
    if (scenario === 'slot-date') draft.distributionPolicy.days[0].date = '2026-09-29';
    if (scenario === 'unknown-component') Object.assign(draft.components[0], { extra: 'bad' });
    if (scenario === 'digest-tamper') {
      await assert.rejects(decodeTrustedValidationEvidenceV1({ ...draft, digest: h('e') }, context));
    } else await assert.rejects(sealTrustedValidationEvidenceV1(draft, context));
  });
}

test('duplicate raw keys including escaped and nested names reject before parsing', async () => {
  const { evidence, context } = await fixture();
  const raw = JSON.stringify(evidence);
  await assert.rejects(decodeTrustedValidationEvidenceRawV1(raw.replace('"accountId":', '"accountId":"ignored","accountId":'), context));
  await assert.rejects(decodeTrustedValidationEvidenceRawV1(raw.replace('"proteinSource":true', '"proteinSource":false,"protein\\u0053ource":true'), context));
  const component = JSON.stringify(evidence.components[0]);
  await assert.rejects(decodeComponentValidationEvidenceRawV1(component.replace('"slotId":', '"slotId":"ignored","slotId":')));
});

test('self-consistent substituted evidence cannot replace separately pinned caller evidence', async () => {
  const { evidence, context } = await fixture();
  const content = structuredClone(withoutDigest(evidence));
  content.components[0] = await sealComponentValidationEvidenceV1({ ...withoutDigest(content.components[0]), produceSource: true });
  const hostile = await sealTrustedValidationEvidenceV1(content, context);
  await assert.rejects(assertTrustedValidationEvidencePinnedV1(hostile, evidence, context), /SUBSTITUTION/);
});

test('pinned account/selection/week/manifest/preference/safety digests cannot be substituted', async () => {
  const { evidence, context } = await fixture();
  for (const key of ['accountId', 'selectionId', 'weekStartLocal', 'timezone', 'generationInputDigest', 'candidateManifestRevision',
    'candidateManifestDigest', 'preferenceRevision', 'preferenceDigest', 'safetyRevision', 'safetyDigest'] as const) {
    const draft = structuredClone(withoutDigest(evidence));
    draft[key] = key.endsWith('Digest') ? h('e') : key === 'weekStartLocal' ? '2026-10-05' : key === 'timezone' ? 'Europe/Moscow' : id(99);
    await assert.rejects(sealTrustedValidationEvidenceV1(draft, context), /MISMATCH/);
  }
});

test('fallback unavailable semantics preserved without synthesizing a VALID proof', async () => {
  const { evidence, context } = await fixture();
  const draft = structuredClone(withoutDigest(evidence));
  draft.ordinaryFallback.status = 'UNAVAILABLE_BOTH'; draft.ordinaryFallback.ordinaryWeekDigest = null;
  const supplied = await sealTrustedValidationEvidenceV1(draft, context);
  assert.equal(supplied.ordinaryFallback.status, 'UNAVAILABLE_BOTH');
  assert.equal(supplied.ordinaryFallback.ordinaryWeekDigest, null);
});

test('duplicate eligibility and missing or sparse slot evidence reject without normalization', async () => {
  const { evidence, context } = await fixture();
  const duplicate = structuredClone(withoutDigest(evidence));
  duplicate.planEligibility.push(duplicate.planEligibility[0]);
  await assert.rejects(sealTrustedValidationEvidenceV1(duplicate, context), /PLAN_ELIGIBILITY/);
  const sparse = structuredClone(withoutDigest(evidence));
  delete sparse.distributionPolicy.days[0].requiredSlots[0];
  await assert.rejects(sealTrustedValidationEvidenceV1(sparse, context));
  const malformed = structuredClone(withoutDigest(evidence));
  delete (malformed.components[0] as Partial<typeof malformed.components[0]>).portionPolicyRevision;
  await assert.rejects(sealTrustedValidationEvidenceV1(malformed, context), /COMPONENT/);
});

test('only exact scale-3 supplied decimals are accepted; numeric and float-like bounds reject', async () => {
  const { evidence, context } = await fixture();
  for (const value of ['100', '100.0', '0100.000', '+100.000', '-0.000', '1e2', '100.0000', 100]) {
    const bad = structuredClone(withoutDigest(evidence));
    (bad.distributionPolicy.days[0].nutritionBounds[0].bounds.target as unknown as Record<string, unknown>).calories = value;
    await assert.rejects(sealTrustedValidationEvidenceV1(bad, context), /DECIMAL/);
  }
});
