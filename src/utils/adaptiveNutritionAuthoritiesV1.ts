import {
  type MealAnchorKindV1,
  type MealBeverageClassV1,
  type MealComponentRoleV1,
  type MealEnergyClassV1,
} from './adaptiveNutritionMealCompositionV1';
import { type AccessibilityClassV1 } from './adaptiveNutritionMealBalanceV1';
import {
  decodeGraphRecipeSnapshotV1,
  type GraphMealTypeV1,
  type GraphRecipeSnapshotV1,
} from './adaptiveNutritionGraphV1';
import { sharedAccountGateContractV1 } from './adaptiveNutritionGraphV2';

export const nutritionPreferenceSnapshotContractV1 = 'potok-nutrition-preference-snapshot-v1' as const;
export const nutritionSafetySnapshotContractV1 = 'potok-nutrition-safety-snapshot-v1' as const;
export const adaptiveNutritionCandidateManifestContractV2 = 'potok-adaptive-candidate-manifest-v2' as const;
export const adaptiveNutritionCandidateManifestEncodingV2 =
  'potok-adaptive-candidate-manifest-v2-canonical-json-v1' as const;

export type DietaryPatternV1 = 'UNSPECIFIED' | 'VEGETARIAN' | 'VEGAN';
export type AuthorityKindV1 = 'PREFERENCE' | 'SAFETY';

export interface NutritionPreferenceSnapshotV1 {
  contract: typeof nutritionPreferenceSnapshotContractV1;
  accountId: string;
  revisionId: string;
  supersedesRevisionId: string | null;
  hard: {
    dietaryPattern: DietaryPatternV1;
    excludedMealTypes: GraphMealTypeV1[];
    excludedIngredientIds: string[];
    excludedRecipeIds: string[];
  };
  soft: {
    likedIngredientIds: string[];
    dislikedIngredientIds: string[];
    conveniencePreference: string | null;
    mealStylePreferences: string[];
  };
  createdAt: string;
  digest: string;
}

export interface NutritionSafetySnapshotV1 {
  contract: typeof nutritionSafetySnapshotContractV1;
  accountId: string;
  revisionId: string;
  supersedesRevisionId: string | null;
  declaredAllergenCodes: string[];
  declaredIntoleranceCodes: string[];
  dietaryHardExclusionCodes: string[];
  createdAt: string;
  digest: string;
}

export interface NutritionAuthorityHeadV1 {
  accountId: string;
  preferenceRevision: string;
  safetyRevision: string;
  headRevision: string;
}

export interface CandidateManifestComponentIncrementV2 {
  componentId: string;
  increment: string;
}

export interface AdaptiveNutritionCandidateManifestEntryV2 {
  recipeId: string;
  recipeRevisionId: string;
  portionRevisionId: string;
  eligibilityRevisionId: string;
  publicationRevision: string;
  publicationStatus: 'PUBLISHED';
  canonicalEvidenceRevision: string;
  canonicalEvidenceDigest: string;
  nutritionEvidenceRevision: string;
  nutritionEvidenceDigest: string;
  allergenEvidenceRevision: string;
  dietaryEvidenceRevision: string;
  ingredientIds: string[];
  allergenCodes: string[];
  intoleranceCodes: string[];
  dietaryCodes: string[];
  allowedMealTypes: GraphMealTypeV1[];
  role: MealComponentRoleV1;
  anchorKind: MealAnchorKindV1;
  requiredCompanionRoleSets: MealComponentRoleV1[][];
  pairingTags: string[];
  incompatiblePairingTags: string[];
  repeatFamily: string;
  energyClass: MealEnergyClassV1;
  beverageClass: MealBeverageClassV1;
  dominantIngredientFamily: string;
  accessibility: AccessibilityClassV1;
  specialty: boolean;
  expensive: boolean;
  portionRules: {
    mode: 'HYBRID';
    assignedServingsMinimum: string;
    assignedServingsMaximum: string;
    assignedServingsIncrement: string;
    componentIncrements: CandidateManifestComponentIncrementV2[];
  };
  recipeSnapshot: GraphRecipeSnapshotV1;
  recipeSnapshotDigest: string;
}

export interface AdaptiveNutritionCandidateManifestV2 {
  contract: typeof adaptiveNutritionCandidateManifestContractV2;
  encoding: typeof adaptiveNutritionCandidateManifestEncodingV2;
  manifestRevision: string;
  supersedesManifestRevision: string | null;
  publicationState: 'PUBLISHED';
  publishedAt: string;
  entries: AdaptiveNutritionCandidateManifestEntryV2[];
  digest: string;
}

export interface GenerationAuthorityBindingV1 {
  accountGateContract: typeof sharedAccountGateContractV1;
  preferenceRevision: string;
  safetyRevision: string;
  candidateManifestRevision: string;
  candidateManifestDigest: string;
}

export type AuthorityCasResultV1 =
  | { status: 'MATCH' }
  | { status: 'CONFLICT_STALE_INPUT'; reason: 'ACCOUNT_GATE_CONTRACT_STALE'
    | 'PREFERENCE_REVISION_STALE' | 'SAFETY_REVISION_STALE' | 'CATALOG_MANIFEST_STALE' };

export interface CandidateAuthorityInputV1 {
  recipeId: string;
  recipeRevisionId: string;
  portionRevisionId: string;
  eligibilityRevisionId: string;
  mealType: GraphMealTypeV1;
}

export type CandidateAuthorityResultV1 =
  | { status: 'ELIGIBLE'; optimizationSignals: { likedIngredientIds: string[]; dislikedIngredientIds: string[];
    conveniencePreference: string | null; mealStylePreferences: string[] } }
  | { status: 'BLOCKED'; reason: 'MISSING_SAFETY_AUTHORITY' | 'MISSING_PREFERENCE_AUTHORITY'
    | 'ACCOUNT_AUTHORITY_MISMATCH' | 'MANIFEST_NOT_PUBLISHED' | 'MANIFEST_COMPONENT_MISSING'
    | 'MEAL_TYPE_EXCLUDED' | 'INGREDIENT_EXCLUDED' | 'RECIPE_EXCLUDED' | 'DIETARY_PATTERN_CONFLICT'
    | 'ALLERGEN_CONFLICT' | 'INTOLERANCE_CONFLICT' | 'DIETARY_HARD_EXCLUSION' };

export interface AccountGateLockV1 {
  kind: 'SHARED_ACCOUNT_GATE';
  contract: typeof sharedAccountGateContractV1;
  accountId: string;
  resource: string;
}

export interface EntitlementCapabilityLockV1 {
  kind: 'ENTITLEMENT_CAPABILITY_SECONDARY';
  accountId: string;
  capability: 'premium' | 'admin';
  resource: string;
}

const uuidPattern = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/;
const digestPattern = /^[0-9a-f]{64}$/;
const tokenPattern = /^[a-z0-9][a-z0-9._-]{0,127}$/;
const decimalPattern = /^(0|[1-9][0-9]{0,8})\.[0-9]{3}$/;
const timestampPattern = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d{3})?Z$/;
const mealTypes: readonly GraphMealTypeV1[] = ['breakfast', 'lunch', 'dinner', 'snack'];
const accessibilityClasses: readonly AccessibilityClassV1[] = [
  'COMMON_RU_RETAIL', 'SEASONAL_BUT_COMMON', 'SPECIALTY_PRODUCT_REQUIRED',
  'EXPENSIVE_OPTIONAL', 'ACCESSIBILITY_BLOCKED',
];
const componentRoles: readonly MealComponentRoleV1[] = [
  'MAIN_COMPONENT', 'CARB_SIDE', 'VEGETABLE_SIDE', 'SALAD', 'EXTRA', 'SAUCE', 'BEVERAGE',
];
const energyClasses: readonly MealEnergyClassV1[] = ['LIGHTER', 'BALANCED', 'ENERGY_DENSE'];
const beverageClasses: readonly MealBeverageClassV1[] = ['NOT_BEVERAGE', 'NON_CALORIC', 'CALORIC'];

function record(value: unknown, keys: readonly string[], label: string): Record<string, unknown> {
  if (!value || typeof value !== 'object' || Array.isArray(value)
      || Object.getPrototypeOf(value) !== Object.prototype
      || Object.keys(value).length !== keys.length
      || !keys.every((key) => Object.prototype.hasOwnProperty.call(value, key))) {
    throw new Error(`invalid_${label}_fields`);
  }
  return value as Record<string, unknown>;
}

function uuid(value: unknown, label: string): string {
  if (typeof value !== 'string' || !uuidPattern.test(value)) throw new Error(`invalid_${label}_uuid`);
  return value;
}

function optionalUuid(value: unknown, label: string): string | null {
  return value === null ? null : uuid(value, label);
}

function digest(value: unknown, label: string): string {
  if (typeof value !== 'string' || !digestPattern.test(value)) throw new Error(`invalid_${label}_digest`);
  return value;
}

function timestamp(value: unknown, label: string): string {
  if (typeof value !== 'string' || !timestampPattern.test(value)
      || new Date(value).toISOString() !== (value.length === 20 ? value.replace('Z', '.000Z') : value)) {
    throw new Error(`invalid_${label}_timestamp`);
  }
  return value;
}

function enumValue<T extends string>(value: unknown, allowed: readonly T[], label: string): T {
  if (typeof value !== 'string' || !allowed.includes(value as T)) throw new Error(`invalid_${label}`);
  return value as T;
}

function sortedUnique<T>(value: unknown, decode: (item: unknown) => T, key: (item: T) => string,
  label: string): T[] {
  if (!Array.isArray(value)) throw new Error(`invalid_${label}`);
  const result = value.map(decode);
  const keys = result.map(key);
  if (new Set(keys).size !== keys.length || JSON.stringify([...keys].sort()) !== JSON.stringify(keys)) {
    throw new Error(`noncanonical_${label}`);
  }
  return result;
}

function uuidList(value: unknown, label: string): string[] {
  return sortedUnique(value, (item) => uuid(item, label), (item) => item, label);
}

function token(value: unknown, label: string): string {
  if (typeof value !== 'string' || !tokenPattern.test(value)) throw new Error(`invalid_${label}`);
  return value;
}

function tokenList(value: unknown, label: string): string[] {
  return sortedUnique(value, (item) => token(item, label), (item) => item, label);
}

function mealTypeList(value: unknown, label: string): GraphMealTypeV1[] {
  if (!Array.isArray(value)) throw new Error(`invalid_${label}`);
  const result = value.map((item) => enumValue(item, mealTypes, label));
  if (new Set(result).size !== result.length
      || JSON.stringify([...result].sort((a, b) => mealTypes.indexOf(a) - mealTypes.indexOf(b)))
        !== JSON.stringify(result)) throw new Error(`noncanonical_${label}`);
  return result;
}

function canonicalJson(value: unknown): string {
  if (value === null || typeof value === 'string' || typeof value === 'boolean') return JSON.stringify(value);
  if (typeof value === 'number') {
    if (!Number.isSafeInteger(value)) throw new Error('canonical_numbers_must_be_integers');
    return JSON.stringify(value);
  }
  if (Array.isArray(value)) return `[${value.map(canonicalJson).join(',')}]`;
  if (value && typeof value === 'object' && Object.getPrototypeOf(value) === Object.prototype) {
    const row = value as Record<string, unknown>;
    return `{${Object.keys(row).sort().map((key) => `${JSON.stringify(key)}:${canonicalJson(row[key])}`).join(',')}}`;
  }
  throw new Error('unsupported_canonical_value');
}

function canonicalBytes(value: unknown): Uint8Array {
  return new TextEncoder().encode(canonicalJson(value));
}

async function sha256(value: unknown): Promise<string> {
  if (!globalThis.crypto?.subtle) throw new Error('sha256_unavailable');
  const bytes = canonicalBytes(value);
  const hash = await globalThis.crypto.subtle.digest('SHA-256', new Uint8Array(bytes).buffer);
  return Array.from(new Uint8Array(hash), (byte) => byte.toString(16).padStart(2, '0')).join('');
}

export async function candidateRecipeSnapshotDigestV2(value: unknown): Promise<string> {
  return sha256(decodeGraphRecipeSnapshotV1(value));
}

function decimal(value: unknown, label: string, positive = false): string {
  if (typeof value !== 'string' || !decimalPattern.test(value)) throw new Error(`invalid_${label}_decimal`);
  const minor = BigInt(value.replace('.', ''));
  if (positive ? minor <= 0n : minor < 0n) throw new Error(`invalid_${label}_value`);
  return value;
}

function decodePreferenceWithoutDigest(value: unknown): Omit<NutritionPreferenceSnapshotV1, 'digest'> {
  const row = record(value, ['contract', 'accountId', 'revisionId', 'supersedesRevisionId', 'hard', 'soft',
    'createdAt'], 'nutrition_preference_snapshot');
  if (row.contract !== nutritionPreferenceSnapshotContractV1) throw new Error('unsupported_preference_contract');
  const hard = record(row.hard, ['dietaryPattern', 'excludedMealTypes', 'excludedIngredientIds',
    'excludedRecipeIds'], 'preference_hard');
  const soft = record(row.soft, ['likedIngredientIds', 'dislikedIngredientIds', 'conveniencePreference',
    'mealStylePreferences'], 'preference_soft');
  return {
    contract: nutritionPreferenceSnapshotContractV1,
    accountId: uuid(row.accountId, 'preference_account'),
    revisionId: uuid(row.revisionId, 'preference_revision'),
    supersedesRevisionId: optionalUuid(row.supersedesRevisionId, 'preference_supersedes'),
    hard: {
      dietaryPattern: enumValue(hard.dietaryPattern, ['UNSPECIFIED', 'VEGETARIAN', 'VEGAN'] as const,
        'dietary_pattern'),
      excludedMealTypes: mealTypeList(hard.excludedMealTypes, 'excluded_meal_types'),
      excludedIngredientIds: uuidList(hard.excludedIngredientIds, 'excluded_ingredient_ids'),
      excludedRecipeIds: uuidList(hard.excludedRecipeIds, 'excluded_recipe_ids'),
    },
    soft: {
      likedIngredientIds: uuidList(soft.likedIngredientIds, 'liked_ingredient_ids'),
      dislikedIngredientIds: uuidList(soft.dislikedIngredientIds, 'disliked_ingredient_ids'),
      conveniencePreference: soft.conveniencePreference === null ? null
        : token(soft.conveniencePreference, 'convenience_preference'),
      mealStylePreferences: tokenList(soft.mealStylePreferences, 'meal_style_preferences'),
    },
    createdAt: timestamp(row.createdAt, 'preference_created_at'),
  };
}

export async function sealNutritionPreferenceSnapshotV1(
  value: Omit<NutritionPreferenceSnapshotV1, 'digest'>,
): Promise<NutritionPreferenceSnapshotV1> {
  const normalized = decodePreferenceWithoutDigest(value);
  return { ...normalized, digest: await sha256(normalized) };
}

export async function decodeNutritionPreferenceSnapshotV1(value: unknown): Promise<NutritionPreferenceSnapshotV1> {
  const row = record(value, ['contract', 'accountId', 'revisionId', 'supersedesRevisionId', 'hard', 'soft',
    'createdAt', 'digest'], 'nutrition_preference_snapshot');
  const withoutDigest = { ...row };
  delete withoutDigest.digest;
  const normalized = decodePreferenceWithoutDigest(withoutDigest);
  const actual = digest(row.digest, 'preference');
  if (actual !== await sha256(normalized)) throw new Error('preference_digest_mismatch');
  return { ...normalized, digest: actual };
}

export async function nutritionPreferenceSnapshotCanonicalBytesV1(value: unknown): Promise<Uint8Array> {
  const snapshot = await decodeNutritionPreferenceSnapshotV1(value);
  const content: Record<string, unknown> = { ...snapshot };
  delete content.digest;
  return canonicalBytes(content);
}

function decodeSafetyWithoutDigest(value: unknown): Omit<NutritionSafetySnapshotV1, 'digest'> {
  const row = record(value, ['contract', 'accountId', 'revisionId', 'supersedesRevisionId',
    'declaredAllergenCodes', 'declaredIntoleranceCodes', 'dietaryHardExclusionCodes',
    'createdAt'], 'nutrition_safety_snapshot');
  if (row.contract !== nutritionSafetySnapshotContractV1) throw new Error('unsupported_safety_contract');
  return {
    contract: nutritionSafetySnapshotContractV1,
    accountId: uuid(row.accountId, 'safety_account'),
    revisionId: uuid(row.revisionId, 'safety_revision'),
    supersedesRevisionId: optionalUuid(row.supersedesRevisionId, 'safety_supersedes'),
    declaredAllergenCodes: tokenList(row.declaredAllergenCodes, 'declared_allergen_codes'),
    declaredIntoleranceCodes: tokenList(row.declaredIntoleranceCodes, 'declared_intolerance_codes'),
    dietaryHardExclusionCodes: tokenList(row.dietaryHardExclusionCodes, 'dietary_hard_exclusion_codes'),
    createdAt: timestamp(row.createdAt, 'safety_created_at'),
  };
}

export async function sealNutritionSafetySnapshotV1(
  value: Omit<NutritionSafetySnapshotV1, 'digest'>,
): Promise<NutritionSafetySnapshotV1> {
  const normalized = decodeSafetyWithoutDigest(value);
  return { ...normalized, digest: await sha256(normalized) };
}

export async function decodeNutritionSafetySnapshotV1(value: unknown): Promise<NutritionSafetySnapshotV1> {
  const row = record(value, ['contract', 'accountId', 'revisionId', 'supersedesRevisionId',
    'declaredAllergenCodes', 'declaredIntoleranceCodes', 'dietaryHardExclusionCodes',
    'createdAt', 'digest'], 'nutrition_safety_snapshot');
  const withoutDigest = { ...row };
  delete withoutDigest.digest;
  const normalized = decodeSafetyWithoutDigest(withoutDigest);
  const actual = digest(row.digest, 'safety');
  if (actual !== await sha256(normalized)) throw new Error('safety_digest_mismatch');
  return { ...normalized, digest: actual };
}

export async function nutritionSafetySnapshotCanonicalBytesV1(value: unknown): Promise<Uint8Array> {
  const snapshot = await decodeNutritionSafetySnapshotV1(value);
  const content: Record<string, unknown> = { ...snapshot };
  delete content.digest;
  return canonicalBytes(content);
}

function decodeIncrement(value: unknown): CandidateManifestComponentIncrementV2 {
  const row = record(value, ['componentId', 'increment'], 'manifest_component_increment');
  return { componentId: uuid(row.componentId, 'manifest_component'),
    increment: decimal(row.increment, 'manifest_component_increment', true) };
}

async function decodeManifestEntry(value: unknown): Promise<AdaptiveNutritionCandidateManifestEntryV2> {
  const row = record(value, ['recipeId', 'recipeRevisionId', 'portionRevisionId', 'eligibilityRevisionId',
    'publicationRevision', 'publicationStatus', 'canonicalEvidenceRevision', 'canonicalEvidenceDigest',
    'nutritionEvidenceRevision', 'nutritionEvidenceDigest', 'allergenEvidenceRevision',
    'dietaryEvidenceRevision', 'ingredientIds', 'allergenCodes', 'intoleranceCodes', 'dietaryCodes',
    'allowedMealTypes', 'role', 'anchorKind', 'requiredCompanionRoleSets',
    'pairingTags', 'incompatiblePairingTags', 'repeatFamily', 'energyClass', 'beverageClass',
    'dominantIngredientFamily', 'accessibility', 'specialty', 'expensive', 'portionRules',
    'recipeSnapshot', 'recipeSnapshotDigest'], 'candidate_manifest_entry');
  if (row.publicationStatus !== 'PUBLISHED') throw new Error('manifest_entry_not_published');
  const recipeSnapshot = decodeGraphRecipeSnapshotV1(row.recipeSnapshot);
  const recipeId = uuid(row.recipeId, 'manifest_recipe');
  const recipeRevisionId = uuid(row.recipeRevisionId, 'manifest_recipe_revision');
  if (recipeSnapshot.recipeId !== recipeId || recipeSnapshot.recipeRevisionId !== recipeRevisionId) {
    throw new Error('manifest_recipe_snapshot_binding_mismatch');
  }
  const role = enumValue(row.role, componentRoles, 'manifest_role');
  const anchorKind = enumValue(row.anchorKind, ['COMPLETE', 'PARTIAL', 'NONE'] as const, 'manifest_anchor_kind');
  const allowedMealTypes = mealTypeList(row.allowedMealTypes, 'manifest_allowed_meal_types');
  const requiredCompanionRoleSets = Array.isArray(row.requiredCompanionRoleSets)
    ? row.requiredCompanionRoleSets.map((set, index) => {
      if (!Array.isArray(set)) throw new Error(`invalid_manifest_companion_set_${index}`);
      const result = set.map((item) => enumValue(item, componentRoles, `manifest_companion_set_${index}`));
      if (result.includes('MAIN_COMPONENT') || result.includes('BEVERAGE')
          || new Set(result).size !== result.length
          || JSON.stringify([...result].sort((a, b) => componentRoles.indexOf(a) - componentRoles.indexOf(b)))
            !== JSON.stringify(result)) throw new Error(`invalid_manifest_companion_set_${index}`);
      return result;
    }) : (() => { throw new Error('invalid_manifest_companion_sets'); })();
  const companionKeys = requiredCompanionRoleSets.map((set) => set.join('|'));
  if (new Set(companionKeys).size !== companionKeys.length
      || JSON.stringify([...companionKeys].sort()) !== JSON.stringify(companionKeys)) {
    throw new Error('noncanonical_manifest_companion_sets');
  }
  if ((anchorKind === 'PARTIAL') !== (requiredCompanionRoleSets.length > 0)) {
    throw new Error('manifest_anchor_companion_mismatch');
  }
  const portion = record(row.portionRules, ['mode', 'assignedServingsMinimum', 'assignedServingsMaximum',
    'assignedServingsIncrement', 'componentIncrements'], 'manifest_portion_rules');
  if (portion.mode !== 'HYBRID') throw new Error('manifest_requires_hybrid_portions');
  const minimum = decimal(portion.assignedServingsMinimum, 'assigned_servings_minimum', true);
  const maximum = decimal(portion.assignedServingsMaximum, 'assigned_servings_maximum', true);
  if (BigInt(minimum.replace('.', '')) > BigInt(maximum.replace('.', ''))) {
    throw new Error('manifest_portion_range_invalid');
  }
  const componentIncrements = sortedUnique(portion.componentIncrements, decodeIncrement,
    (item) => item.componentId, 'manifest_component_increments');
  const discreteComponents = recipeSnapshot.ingredients.filter((item) => item.scaling.mode === 'discrete');
  if (componentIncrements.length !== discreteComponents.length
      || discreteComponents.some((component) => {
        if (component.scaling.mode !== 'discrete') return true;
        const componentIncrement = component.scaling.increment;
        return !componentIncrements.some((increment) => increment.componentId === component.componentId
          && increment.increment === componentIncrement);
      })) {
    throw new Error('manifest_component_increment_binding_mismatch');
  }
  const recipeSnapshotDigest = digest(row.recipeSnapshotDigest, 'recipe_snapshot');
  if (recipeSnapshotDigest !== await sha256(recipeSnapshot)) throw new Error('recipe_snapshot_digest_mismatch');
  if (typeof row.specialty !== 'boolean' || typeof row.expensive !== 'boolean') {
    throw new Error('invalid_manifest_accessibility_flags');
  }
  if ((row.accessibility === 'SPECIALTY_PRODUCT_REQUIRED' && !row.specialty)
      || (row.accessibility === 'EXPENSIVE_OPTIONAL' && !row.expensive)) {
    throw new Error('manifest_accessibility_axes_inconsistent');
  }
  return {
    recipeId, recipeRevisionId,
    portionRevisionId: uuid(row.portionRevisionId, 'manifest_portion_revision'),
    eligibilityRevisionId: uuid(row.eligibilityRevisionId, 'manifest_eligibility_revision'),
    publicationRevision: uuid(row.publicationRevision, 'manifest_publication_revision'),
    publicationStatus: 'PUBLISHED',
    canonicalEvidenceRevision: uuid(row.canonicalEvidenceRevision, 'canonical_evidence_revision'),
    canonicalEvidenceDigest: digest(row.canonicalEvidenceDigest, 'canonical_evidence'),
    nutritionEvidenceRevision: uuid(row.nutritionEvidenceRevision, 'nutrition_evidence_revision'),
    nutritionEvidenceDigest: digest(row.nutritionEvidenceDigest, 'nutrition_evidence'),
    allergenEvidenceRevision: uuid(row.allergenEvidenceRevision, 'allergen_evidence_revision'),
    dietaryEvidenceRevision: uuid(row.dietaryEvidenceRevision, 'dietary_evidence_revision'),
    ingredientIds: uuidList(row.ingredientIds, 'manifest_ingredient_ids'),
    allergenCodes: tokenList(row.allergenCodes, 'manifest_allergen_codes'),
    intoleranceCodes: tokenList(row.intoleranceCodes, 'manifest_intolerance_codes'),
    dietaryCodes: tokenList(row.dietaryCodes, 'manifest_dietary_codes'),
    allowedMealTypes, role, anchorKind, requiredCompanionRoleSets,
    pairingTags: tokenList(row.pairingTags, 'manifest_pairing_tags'),
    incompatiblePairingTags: tokenList(row.incompatiblePairingTags, 'manifest_incompatible_tags'),
    repeatFamily: token(row.repeatFamily, 'manifest_repeat_family'),
    energyClass: enumValue(row.energyClass, energyClasses, 'manifest_energy_class'),
    beverageClass: enumValue(row.beverageClass, beverageClasses, 'manifest_beverage_class'),
    dominantIngredientFamily: token(row.dominantIngredientFamily, 'manifest_dominant_ingredient_family'),
    accessibility: enumValue(row.accessibility, accessibilityClasses, 'manifest_accessibility'),
    specialty: row.specialty, expensive: row.expensive,
    portionRules: {
      mode: 'HYBRID', assignedServingsMinimum: minimum, assignedServingsMaximum: maximum,
      assignedServingsIncrement: decimal(portion.assignedServingsIncrement, 'assigned_servings_increment', true),
      componentIncrements,
    },
    recipeSnapshot, recipeSnapshotDigest,
  };
}

function manifestIdentity(entry: AdaptiveNutritionCandidateManifestEntryV2): string {
  return [entry.recipeId, entry.recipeRevisionId, entry.portionRevisionId, entry.eligibilityRevisionId].join(':');
}

async function decodeManifestWithoutDigest(value: unknown): Promise<Omit<AdaptiveNutritionCandidateManifestV2, 'digest'>> {
  const row = record(value, ['contract', 'encoding', 'manifestRevision', 'supersedesManifestRevision',
    'publicationState', 'publishedAt', 'entries'], 'candidate_manifest');
  if (row.contract !== adaptiveNutritionCandidateManifestContractV2
      || row.encoding !== adaptiveNutritionCandidateManifestEncodingV2) throw new Error('unsupported_manifest_contract');
  if (row.publicationState !== 'PUBLISHED') throw new Error('manifest_not_published');
  if (!Array.isArray(row.entries)) throw new Error('invalid_manifest_entries');
  const entries = await Promise.all(row.entries.map(decodeManifestEntry));
  const identities = entries.map(manifestIdentity);
  if (new Set(identities).size !== identities.length
      || JSON.stringify([...identities].sort()) !== JSON.stringify(identities)) {
    throw new Error('noncanonical_or_duplicate_manifest_entries');
  }
  return {
    contract: adaptiveNutritionCandidateManifestContractV2,
    encoding: adaptiveNutritionCandidateManifestEncodingV2,
    manifestRevision: uuid(row.manifestRevision, 'manifest_revision'),
    supersedesManifestRevision: optionalUuid(row.supersedesManifestRevision, 'manifest_supersedes'),
    publicationState: 'PUBLISHED',
    publishedAt: timestamp(row.publishedAt, 'manifest_published_at'),
    entries,
  };
}

export async function sealAdaptiveNutritionCandidateManifestV2(
  value: Omit<AdaptiveNutritionCandidateManifestV2, 'digest'>,
): Promise<AdaptiveNutritionCandidateManifestV2> {
  const normalized = await decodeManifestWithoutDigest(value);
  return { ...normalized, digest: await sha256(normalized) };
}

export async function decodeAdaptiveNutritionCandidateManifestV2(
  value: unknown,
): Promise<AdaptiveNutritionCandidateManifestV2> {
  const row = record(value, ['contract', 'encoding', 'manifestRevision', 'supersedesManifestRevision',
    'publicationState', 'publishedAt', 'entries', 'digest'], 'candidate_manifest');
  const withoutDigest = { ...row };
  delete withoutDigest.digest;
  const normalized = await decodeManifestWithoutDigest(withoutDigest);
  const actual = digest(row.digest, 'manifest');
  if (actual !== await sha256(normalized)) throw new Error('manifest_digest_mismatch');
  return { ...normalized, digest: actual };
}

export async function adaptiveNutritionCandidateManifestCanonicalBytesV2(value: unknown): Promise<Uint8Array> {
  const manifest = await decodeAdaptiveNutritionCandidateManifestV2(value);
  const content: Record<string, unknown> = { ...manifest };
  delete content.digest;
  return canonicalBytes(content);
}

export function compareGenerationAuthorityBindingV1(
  expected: GenerationAuthorityBindingV1,
  current: GenerationAuthorityBindingV1,
): AuthorityCasResultV1 {
  if (expected.accountGateContract !== current.accountGateContract) {
    return { status: 'CONFLICT_STALE_INPUT', reason: 'ACCOUNT_GATE_CONTRACT_STALE' };
  }
  if (expected.preferenceRevision !== current.preferenceRevision) {
    return { status: 'CONFLICT_STALE_INPUT', reason: 'PREFERENCE_REVISION_STALE' };
  }
  if (expected.safetyRevision !== current.safetyRevision) {
    return { status: 'CONFLICT_STALE_INPUT', reason: 'SAFETY_REVISION_STALE' };
  }
  if (expected.candidateManifestRevision !== current.candidateManifestRevision
      || expected.candidateManifestDigest !== current.candidateManifestDigest) {
    return { status: 'CONFLICT_STALE_INPUT', reason: 'CATALOG_MANIFEST_STALE' };
  }
  return { status: 'MATCH' };
}

export function validateCandidateAuthoritiesV1(value: {
  accountId: string;
  candidate: CandidateAuthorityInputV1;
  preference: NutritionPreferenceSnapshotV1 | null;
  safety: NutritionSafetySnapshotV1 | null;
  manifest: AdaptiveNutritionCandidateManifestV2;
}): CandidateAuthorityResultV1 {
  if (!value.safety) return { status: 'BLOCKED', reason: 'MISSING_SAFETY_AUTHORITY' };
  if (!value.preference) return { status: 'BLOCKED', reason: 'MISSING_PREFERENCE_AUTHORITY' };
  if (value.preference.accountId !== value.accountId || value.safety.accountId !== value.accountId) {
    return { status: 'BLOCKED', reason: 'ACCOUNT_AUTHORITY_MISMATCH' };
  }
  if (value.manifest.publicationState !== 'PUBLISHED') return { status: 'BLOCKED', reason: 'MANIFEST_NOT_PUBLISHED' };
  const identity = [value.candidate.recipeId, value.candidate.recipeRevisionId,
    value.candidate.portionRevisionId, value.candidate.eligibilityRevisionId].join(':');
  const entry = value.manifest.entries.find((item) => manifestIdentity(item) === identity);
  if (!entry || !entry.allowedMealTypes.includes(value.candidate.mealType)) {
    return { status: 'BLOCKED', reason: 'MANIFEST_COMPONENT_MISSING' };
  }
  if (value.preference.hard.excludedMealTypes.includes(value.candidate.mealType)) {
    return { status: 'BLOCKED', reason: 'MEAL_TYPE_EXCLUDED' };
  }
  if (value.preference.hard.excludedRecipeIds.includes(value.candidate.recipeId)) {
    return { status: 'BLOCKED', reason: 'RECIPE_EXCLUDED' };
  }
  if (entry.ingredientIds.some((item) => value.preference?.hard.excludedIngredientIds.includes(item))) {
    return { status: 'BLOCKED', reason: 'INGREDIENT_EXCLUDED' };
  }
  if (entry.allergenCodes.some((item) => value.safety?.declaredAllergenCodes.includes(item))) {
    return { status: 'BLOCKED', reason: 'ALLERGEN_CONFLICT' };
  }
  if (entry.intoleranceCodes.some((item) => value.safety?.declaredIntoleranceCodes.includes(item))) {
    return { status: 'BLOCKED', reason: 'INTOLERANCE_CONFLICT' };
  }
  if (entry.dietaryCodes.some((item) => value.safety?.dietaryHardExclusionCodes.includes(item))) {
    return { status: 'BLOCKED', reason: 'DIETARY_HARD_EXCLUSION' };
  }
  if (value.preference.hard.dietaryPattern !== 'UNSPECIFIED'
      && !entry.dietaryCodes.includes(value.preference.hard.dietaryPattern.toLowerCase())) {
    return { status: 'BLOCKED', reason: 'DIETARY_PATTERN_CONFLICT' };
  }
  return {
    status: 'ELIGIBLE',
    optimizationSignals: {
      likedIngredientIds: value.preference.soft.likedIngredientIds,
      dislikedIngredientIds: value.preference.soft.dislikedIngredientIds,
      conveniencePreference: value.preference.soft.conveniencePreference,
      mealStylePreferences: value.preference.soft.mealStylePreferences,
    },
  };
}

export function sharedAccountGateV1(accountId: string): AccountGateLockV1 {
  const normalized = uuid(accountId, 'account_gate_account');
  return { kind: 'SHARED_ACCOUNT_GATE', contract: sharedAccountGateContractV1,
    accountId: normalized, resource: `${sharedAccountGateContractV1}:${normalized}` };
}

export function entitlementCapabilitySecondaryLockV1(accountId: string,
  capability: 'premium' | 'admin'): EntitlementCapabilityLockV1 {
  const normalized = uuid(accountId, 'entitlement_lock_account');
  return { kind: 'ENTITLEMENT_CAPABILITY_SECONDARY', accountId: normalized, capability,
    resource: `potok-entitlement-capability-v2:${normalized}:${capability}` };
}

export function validateAccountLockOrderV1(
  locks: Array<AccountGateLockV1 | EntitlementCapabilityLockV1>,
): void {
  if (locks.length === 0 || locks[0].kind !== 'SHARED_ACCOUNT_GATE') throw new Error('shared_account_gate_required_first');
  const accountId = locks[0].accountId;
  if (locks.some((lock) => lock.accountId !== accountId)) throw new Error('mixed_account_lock_sequence');
  const capabilityLocks = locks.slice(1);
  if (capabilityLocks.some((lock) => lock.kind !== 'ENTITLEMENT_CAPABILITY_SECONDARY')) {
    throw new Error('invalid_secondary_lock');
  }
  const capabilities = capabilityLocks.map((lock) => (lock as EntitlementCapabilityLockV1).capability);
  if (new Set(capabilities).size !== capabilities.length
      || JSON.stringify([...capabilities].sort()) !== JSON.stringify(capabilities)) {
    throw new Error('noncanonical_secondary_lock_order');
  }
}
