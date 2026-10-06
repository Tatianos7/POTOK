import assert from 'node:assert/strict';
import test from 'node:test';

import type { GraphRecipeSnapshotV1 } from '../adaptiveNutritionGraphV1';
import {
  adaptiveNutritionCandidateManifestContractV2,
  adaptiveNutritionCandidateManifestEncodingV2,
  candidateRecipeSnapshotDigestV2,
  compareGenerationAuthorityBindingV1,
  decodeAdaptiveNutritionCandidateManifestV2,
  entitlementCapabilitySecondaryLockV1,
  nutritionPreferenceSnapshotContractV1,
  nutritionSafetySnapshotContractV1,
  sealAdaptiveNutritionCandidateManifestV2,
  sealNutritionPreferenceSnapshotV1,
  sealNutritionSafetySnapshotV1,
  sharedAccountGateV1,
  validateAccountLockOrderV1,
  validateCandidateAuthoritiesV1,
  type AdaptiveNutritionCandidateManifestEntryV2,
  type AdaptiveNutritionCandidateManifestV2,
  type CandidateAuthorityInputV1,
  type GenerationAuthorityBindingV1,
  type NutritionPreferenceSnapshotV1,
  type NutritionSafetySnapshotV1,
} from '../adaptiveNutritionAuthoritiesV1';
import { sharedAccountGateContractV1 } from '../adaptiveNutritionGraphV2';

const uuid = (value: number): string =>
  `${value.toString(16).padStart(8, '0')}-0000-4000-8000-${String(value).padStart(12, '0')}`;
const hash = (character: string): string => character.repeat(64);
const accountA = uuid(1);
const accountB = uuid(2);
const ingredientId = uuid(20);

for (const [accessibility, specialty, expensive, accepted] of [
  ['SPECIALTY_PRODUCT_REQUIRED', true, false, true],
  ['SPECIALTY_PRODUCT_REQUIRED', false, false, false],
  ['EXPENSIVE_OPTIONAL', false, true, true],
  ['EXPENSIVE_OPTIONAL', false, false, false],
  ['COMMON_RU_RETAIL', true, false, true],
  ['COMMON_RU_RETAIL', false, true, true],
  ['COMMON_RU_RETAIL', true, true, true],
  ['SPECIALTY_PRODUCT_REQUIRED', true, true, true],
  ['EXPENSIVE_OPTIONAL', true, true, true],
  ['SEASONAL_BUT_COMMON', true, true, true],
  ['ACCESSIBILITY_BLOCKED', true, true, true],
] as const) {
  test(`manifest axes ${accessibility}/${specialty}/${expensive}: ${accepted ? 'accept' : 'reject'}`, async () => {
    const entry = { ...await manifestEntry(), accessibility, specialty, expensive };
    if (accepted) {
      const decoded = await decodeAdaptiveNutritionCandidateManifestV2(await manifest([entry]));
      assert.equal(decoded.entries[0].specialty, specialty);
      assert.equal(decoded.entries[0].expensive, expensive);
    } else {
      await assert.rejects(manifest([entry]), /manifest_accessibility_axes_inconsistent/);
      const existing = await manifest();
      Object.assign(existing.entries[0], { accessibility, specialty, expensive });
      await assert.rejects(decodeAdaptiveNutritionCandidateManifestV2(existing), /manifest_accessibility_axes_inconsistent/);
    }
  });
}

function recipeSnapshot(seed = 10): GraphRecipeSnapshotV1 {
  const recipeRevisionId = uuid(seed + 1);
  const nutrition = { calories: '100.000', protein: '10.000', fat: '5.000', carbs: '12.000', fiber: '3.000' };
  return {
    recipeId: uuid(seed),
    recipeRevisionId,
    displayNameSnapshot: `Synthetic recipe ${seed}`,
    baseYield: { servings: '1.000', servingLabel: 'portion', totalYieldGrams: '100.000' },
    fullRecipeNutrition: nutrition,
    ingredients: [{
      componentId: ingredientId,
      recipeRevisionId,
      identity: { kind: 'canonical_food', canonicalFoodId: uuid(seed + 2) },
      displayNameSnapshot: 'Synthetic ingredient',
      state: 'as-sold',
      quantity: { amount: '100.000', unit: 'g' },
      normalizedGrams: '100.000',
      normalizationEvidenceRef: null,
      scaling: { mode: 'continuous' },
      nutrition,
      sortOrder: 0,
    }],
  };
}

async function manifestEntry(seed = 10): Promise<AdaptiveNutritionCandidateManifestEntryV2> {
  const recipe = recipeSnapshot(seed);
  return {
    recipeId: recipe.recipeId,
    recipeRevisionId: recipe.recipeRevisionId,
    portionRevisionId: uuid(seed + 3),
    eligibilityRevisionId: uuid(seed + 4),
    publicationRevision: uuid(seed + 5),
    publicationStatus: 'PUBLISHED',
    canonicalEvidenceRevision: uuid(seed + 6),
    canonicalEvidenceDigest: hash('a'),
    nutritionEvidenceRevision: uuid(seed + 7),
    nutritionEvidenceDigest: hash('b'),
    allergenEvidenceRevision: uuid(seed + 8),
    dietaryEvidenceRevision: uuid(seed + 9),
    ingredientIds: [uuid(seed + 2)],
    allergenCodes: [],
    intoleranceCodes: [],
    dietaryCodes: [],
    allowedMealTypes: ['breakfast', 'lunch', 'dinner', 'snack'],
    role: 'MAIN_COMPONENT',
    anchorKind: 'COMPLETE',
    requiredCompanionRoleSets: [],
    pairingTags: [],
    incompatiblePairingTags: [],
    repeatFamily: `synthetic_${seed}`,
    energyClass: 'BALANCED',
    beverageClass: 'NOT_BEVERAGE',
    dominantIngredientFamily: `synthetic_${seed}`,
    accessibility: 'COMMON_RU_RETAIL',
    specialty: false,
    expensive: false,
    portionRules: {
      mode: 'HYBRID',
      assignedServingsMinimum: '0.500',
      assignedServingsMaximum: '2.000',
      assignedServingsIncrement: '0.500',
      componentIncrements: [],
    },
    recipeSnapshot: recipe,
    recipeSnapshotDigest: await candidateRecipeSnapshotDigestV2(recipe),
  };
}

async function manifest(entries?: AdaptiveNutritionCandidateManifestEntryV2[]): Promise<AdaptiveNutritionCandidateManifestV2> {
  return sealAdaptiveNutritionCandidateManifestV2({
    contract: adaptiveNutritionCandidateManifestContractV2,
    encoding: adaptiveNutritionCandidateManifestEncodingV2,
    manifestRevision: uuid(100),
    supersedesManifestRevision: null,
    publicationState: 'PUBLISHED',
    publishedAt: '2026-09-27T12:00:00.000Z',
    entries: entries ?? [await manifestEntry()],
  });
}

async function preference(overrides: Partial<NutritionPreferenceSnapshotV1['hard']> = {},
  softOverrides: Partial<NutritionPreferenceSnapshotV1['soft']> = {}): Promise<NutritionPreferenceSnapshotV1> {
  return sealNutritionPreferenceSnapshotV1({
    contract: nutritionPreferenceSnapshotContractV1,
    accountId: accountA,
    revisionId: uuid(200),
    supersedesRevisionId: null,
    hard: {
      dietaryPattern: 'UNSPECIFIED',
      excludedMealTypes: [],
      excludedIngredientIds: [],
      excludedRecipeIds: [],
      ...overrides,
    },
    soft: {
      likedIngredientIds: [],
      dislikedIngredientIds: [],
      conveniencePreference: null,
      mealStylePreferences: [],
      ...softOverrides,
    },
    createdAt: '2026-09-27T12:00:00.000Z',
  });
}

async function safety(overrides: Partial<Omit<NutritionSafetySnapshotV1, 'contract' | 'accountId' | 'revisionId'
  | 'supersedesRevisionId' | 'createdAt' | 'digest'>> = {}): Promise<NutritionSafetySnapshotV1> {
  return sealNutritionSafetySnapshotV1({
    contract: nutritionSafetySnapshotContractV1,
    accountId: accountA,
    revisionId: uuid(201),
    supersedesRevisionId: null,
    declaredAllergenCodes: [],
    declaredIntoleranceCodes: [],
    dietaryHardExclusionCodes: [],
    createdAt: '2026-09-27T12:00:00.000Z',
    ...overrides,
  });
}

function candidate(entry: AdaptiveNutritionCandidateManifestEntryV2): CandidateAuthorityInputV1 {
  return {
    recipeId: entry.recipeId,
    recipeRevisionId: entry.recipeRevisionId,
    portionRevisionId: entry.portionRevisionId,
    eligibilityRevisionId: entry.eligibilityRevisionId,
    mealType: 'breakfast',
  };
}

function binding(overrides: Partial<GenerationAuthorityBindingV1> = {}): GenerationAuthorityBindingV1 {
  return {
    accountGateContract: sharedAccountGateContractV1,
    preferenceRevision: uuid(200),
    safetyRevision: uuid(201),
    candidateManifestRevision: uuid(100),
    candidateManifestDigest: hash('c'),
    ...overrides,
  };
}

test('1 explicit empty preference snapshot is valid and digest-bound', async () => {
  const snapshot = await preference();
  assert.equal(snapshot.hard.excludedIngredientIds.length, 0);
  assert.match(snapshot.digest, /^[0-9a-f]{64}$/);
});

test('2 explicit empty safety snapshot is valid and digest-bound', async () => {
  const snapshot = await safety();
  assert.equal(snapshot.declaredAllergenCodes.length, 0);
  assert.match(snapshot.digest, /^[0-9a-f]{64}$/);
});

test('3 missing required safety snapshot blocks generation eligibility', async () => {
  const entry = await manifestEntry();
  assert.deepEqual(validateCandidateAuthoritiesV1({
    accountId: accountA, candidate: candidate(entry), preference: await preference(), safety: null,
    manifest: await manifest([entry]),
  }), { status: 'BLOCKED', reason: 'MISSING_SAFETY_AUTHORITY' });
});

test('4 preference revision change during generation fails CAS', () => {
  assert.deepEqual(compareGenerationAuthorityBindingV1(binding(), binding({ preferenceRevision: uuid(202) })),
    { status: 'CONFLICT_STALE_INPUT', reason: 'PREFERENCE_REVISION_STALE' });
});

test('5 safety revision change during generation fails CAS', () => {
  assert.deepEqual(compareGenerationAuthorityBindingV1(binding(), binding({ safetyRevision: uuid(203) })),
    { status: 'CONFLICT_STALE_INPUT', reason: 'SAFETY_REVISION_STALE' });
});

test('6 soft dislike remains an optimization signal and does not reject', async () => {
  const entry = await manifestEntry();
  const result = validateCandidateAuthoritiesV1({
    accountId: accountA,
    candidate: candidate(entry),
    preference: await preference({}, { dislikedIngredientIds: entry.ingredientIds }),
    safety: await safety(),
    manifest: await manifest([entry]),
  });
  assert.equal(result.status, 'ELIGIBLE');
  if (result.status === 'ELIGIBLE') {
    assert.deepEqual(result.optimizationSignals.dislikedIngredientIds, entry.ingredientIds);
  }
});

test('7 hard ingredient exclusion rejects the candidate', async () => {
  const entry = await manifestEntry();
  assert.deepEqual(validateCandidateAuthoritiesV1({
    accountId: accountA,
    candidate: candidate(entry),
    preference: await preference({ excludedIngredientIds: entry.ingredientIds }),
    safety: await safety(),
    manifest: await manifest([entry]),
  }), { status: 'BLOCKED', reason: 'INGREDIENT_EXCLUDED' });
});

test('8 declared allergen conflict rejects the candidate', async () => {
  const entry = await manifestEntry();
  const allergenicEntry = { ...entry, allergenCodes: ['milk'] };
  assert.deepEqual(validateCandidateAuthoritiesV1({
    accountId: accountA, candidate: candidate(allergenicEntry), preference: await preference(),
    safety: await safety({ declaredAllergenCodes: ['milk'] }), manifest: await manifest([allergenicEntry]),
  }), { status: 'BLOCKED', reason: 'ALLERGEN_CONFLICT' });
});

test('9 product allergen evidence cannot substitute for a user safety snapshot', async () => {
  const entry = await manifestEntry();
  assert.ok(entry.allergenEvidenceRevision);
  assert.deepEqual(validateCandidateAuthoritiesV1({
    accountId: accountA, candidate: candidate(entry), preference: await preference(), safety: null,
    manifest: await manifest([entry]),
  }), { status: 'BLOCKED', reason: 'MISSING_SAFETY_AUTHORITY' });
});

test('10 exact published manifest component identity is eligible', async () => {
  const entry = await manifestEntry();
  assert.equal(validateCandidateAuthoritiesV1({
    accountId: accountA, candidate: candidate(entry), preference: await preference(), safety: await safety(),
    manifest: await manifest([entry]),
  }).status, 'ELIGIBLE');
});

test('11 component missing from exact manifest revision is blocked', async () => {
  const entry = await manifestEntry();
  const other = await manifestEntry(30);
  assert.deepEqual(validateCandidateAuthoritiesV1({
    accountId: accountA, candidate: candidate(other), preference: await preference(), safety: await safety(),
    manifest: await manifest([entry]),
  }), { status: 'BLOCKED', reason: 'MANIFEST_COMPONENT_MISSING' });
});

test('12 duplicate manifest component identity is rejected', async () => {
  const entry = await manifestEntry();
  await assert.rejects(manifest([entry, entry]), /noncanonical_or_duplicate_manifest_entries/);
});

test('13 unpublished recipe entry is rejected before publication', async () => {
  const entry = await manifestEntry();
  await assert.rejects(manifest([{ ...entry, publicationStatus: 'DRAFT' } as never]), /manifest_entry_not_published/);
});

test('14 stale candidate manifest revision fails CAS', () => {
  assert.deepEqual(compareGenerationAuthorityBindingV1(binding(), binding({ candidateManifestRevision: uuid(101) })),
    { status: 'CONFLICT_STALE_INPUT', reason: 'CATALOG_MANIFEST_STALE' });
});

test('15 candidate manifest digest mismatch fails strict decode', async () => {
  const value = await manifest();
  await assert.rejects(decodeAdaptiveNutritionCandidateManifestV2({ ...value, digest: hash('f') }),
    /manifest_digest_mismatch/);
});

test('16 replacement offer cannot decode as publication manifest authority', async () => {
  await assert.rejects(decodeAdaptiveNutritionCandidateManifestV2({
    offerId: uuid(400), selectionId: uuid(401), expiresAt: '2026-09-27T13:00:00.000Z',
  }), /invalid_candidate_manifest_fields/);
});

test('17 entitlement revoke and PLAN activation serialize on the same account gate', () => {
  assert.equal(sharedAccountGateV1(accountA).resource, sharedAccountGateV1(accountA).resource);
});

test('18 entitlement capability lock is valid only after the shared account gate', () => {
  const gate = sharedAccountGateV1(accountA);
  const secondary = entitlementCapabilitySecondaryLockV1(accountA, 'premium');
  assert.throws(() => validateAccountLockOrderV1([secondary]), /shared_account_gate_required_first/);
  assert.doesNotThrow(() => validateAccountLockOrderV1([gate, secondary]));
});

test('19 same-account concurrent activation and revoke use one deterministic resource', () => {
  const activationGate = sharedAccountGateV1(accountA);
  const revokeGate = sharedAccountGateV1(accountA);
  assert.deepEqual(activationGate, revokeGate);
});

test('20 different accounts have independent account-gate resources', () => {
  assert.notEqual(sharedAccountGateV1(accountA).resource, sharedAccountGateV1(accountB).resource);
});

test('21 historical graph authority references remain pinned after current heads advance', () => {
  const historical = binding();
  const current = binding({ preferenceRevision: uuid(210), safetyRevision: uuid(211),
    candidateManifestRevision: uuid(110), candidateManifestDigest: hash('d') });
  assert.deepEqual(historical, binding());
  assert.equal(compareGenerationAuthorityBindingV1(historical, current).status, 'CONFLICT_STALE_INPUT');
});

test('22 authoring-only recipes absent from the published manifest remain ineligible', async () => {
  const authoringRecipe = await manifestEntry(50);
  assert.deepEqual(validateCandidateAuthoritiesV1({
    accountId: accountA, candidate: candidate(authoringRecipe), preference: await preference(),
    safety: await safety(), manifest: await manifest([]),
  }), { status: 'BLOCKED', reason: 'MANIFEST_COMPONENT_MISSING' });
});
