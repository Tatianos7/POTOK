import {
  decodeGraphRecipeSnapshotV1,
  scalePremiumRecipeCollectionV1,
  type GraphAssignedPortionV1,
  type GraphComponentV1,
  type GraphMealTypeV1,
  type GraphNutritionV1,
  type GraphRecipeSnapshotV1,
} from './adaptiveNutritionGraphV1';

export const adaptiveMealCompositionContractV1_1 = 'potok-adaptive-meal-composition-v1.1' as const;
export const adaptiveMealCompositionEncodingV1_1 = 'potok-adaptive-meal-composition-canonical-json-v1.1' as const;
export const adaptiveMealCompositionEligibilityV1_1 = 'potok-adaptive-meal-composition-eligibility-v1.1' as const;

export type MealComponentRoleV1 =
  | 'MAIN_COMPONENT'
  | 'CARB_SIDE'
  | 'VEGETABLE_SIDE'
  | 'SALAD'
  | 'EXTRA'
  | 'SAUCE'
  | 'BEVERAGE';

export type MealAnchorKindV1 = 'COMPLETE' | 'PARTIAL' | 'NONE';
export type MealEnergyClassV1 = 'LIGHTER' | 'BALANCED' | 'ENERGY_DENSE';
export type MealGoalProfileV1 = 'WEIGHT_LOSS' | 'CUT' | 'MAINTENANCE' | 'MASS_GAIN';
export type MealBeverageClassV1 = 'NOT_BEVERAGE' | 'NON_CALORIC' | 'CALORIC';

export interface MealCompositionEligibilitySnapshotV1 {
  contract: typeof adaptiveMealCompositionEligibilityV1_1;
  eligibilityRevisionId: string;
  recipeRevisionId: string;
  compositionPolicyRevision: string;
  role: MealComponentRoleV1;
  anchorKind: MealAnchorKindV1;
  allowedMealTypes: GraphMealTypeV1[];
  requiredCompanionRoleSets: MealComponentRoleV1[][];
  pairingTags: string[];
  incompatiblePairingTags: string[];
  repeatFamily: string;
  energyClass: MealEnergyClassV1;
  beverageClass: MealBeverageClassV1;
}

export interface MealComponentCandidateV1 {
  mealComponentId: string;
  eligibility: MealCompositionEligibilitySnapshotV1;
  recipeRevision: string;
  portionRevision: string;
  recipe: GraphRecipeSnapshotV1;
  assignedPortion: GraphAssignedPortionV1;
  ingredients: GraphComponentV1[];
  nutrition: GraphNutritionV1;
}

export interface MealComponentSnapshotV1 extends MealComponentCandidateV1 {
  sortOrder: number;
}

export interface MealCompositionPatternV1 {
  patternId: string;
  allowedMealTypes: GraphMealTypeV1[];
  roles: MealComponentRoleV1[];
}

export interface MealCompositionPolicyV1 {
  policyRevision: string;
  maxComponents: number;
  patterns: MealCompositionPatternV1[];
  nutritionWeights: Record<keyof GraphNutritionV1, number>;
}

export interface MealComposerInputV1 {
  mealSlotId: string;
  mealSnapshotRevision: string;
  mealType: GraphMealTypeV1;
  goalRevision: string;
  goalProfile: MealGoalProfileV1;
  policy: MealCompositionPolicyV1;
  slotTarget: GraphNutritionV1;
  slotHardMaximum: GraphNutritionV1;
  currentDayNutrition: GraphNutritionV1;
  dayTarget: GraphNutritionV1;
  dayHardMaximum: GraphNutritionV1;
  excludedRecipeRevisions: string[];
  excludedRepeatFamilies: string[];
  candidates: MealComponentCandidateV1[];
}

export interface MealSnapshotV1 {
  contractVersion: 1;
  mealSnapshotRevision: string;
  mealSlotId: string;
  goalRevision: string;
  mealType: GraphMealTypeV1;
  compositionPolicyRevision: string;
  components: MealComponentSnapshotV1[];
  nutrition: GraphNutritionV1;
  digest: string;
}

export type MealCompositionResultV1 =
  | { status: 'COMPLETE'; meal: MealSnapshotV1; score: string }
  | { status: 'INCOMPLETE'; reasons: string[] };

const uuidPattern = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/;
const decimalPattern = /^(0|[1-9][0-9]{0,8})\.[0-9]{3}$/;
const digestPattern = /^[0-9a-f]{64}$/;
const tokenPattern = /^[a-z0-9][a-z0-9._-]{0,127}$/;
const tagPattern = /^[a-z0-9][a-z0-9_-]{0,63}$/;
const mealTypes: readonly GraphMealTypeV1[] = ['breakfast', 'lunch', 'dinner', 'snack'];
const roles: readonly MealComponentRoleV1[] = [
  'MAIN_COMPONENT', 'CARB_SIDE', 'VEGETABLE_SIDE', 'SALAD', 'EXTRA', 'SAUCE', 'BEVERAGE',
];
const anchorKinds: readonly MealAnchorKindV1[] = ['COMPLETE', 'PARTIAL', 'NONE'];
const energyClasses: readonly MealEnergyClassV1[] = ['LIGHTER', 'BALANCED', 'ENERGY_DENSE'];
const beverageClasses: readonly MealBeverageClassV1[] = ['NOT_BEVERAGE', 'NON_CALORIC', 'CALORIC'];
const nutritionKeys: ReadonlyArray<keyof GraphNutritionV1> = ['calories', 'protein', 'fat', 'carbs', 'fiber'];
const scale = 1_000n;

function requireRecord(value: unknown, keys: readonly string[], label: string): Record<string, unknown> {
  if (!value || typeof value !== 'object' || Array.isArray(value)
      || Object.getPrototypeOf(value) !== Object.prototype
      || Object.keys(value).length !== keys.length
      || !keys.every((key) => Object.prototype.hasOwnProperty.call(value, key))) {
    throw new Error(`invalid_${label}_fields`);
  }
  return value as Record<string, unknown>;
}

function requireUuid(value: unknown, label: string): string {
  if (typeof value !== 'string' || !uuidPattern.test(value)) throw new Error(`invalid_${label}_uuid`);
  return value;
}

function requireEnum<T extends string>(value: unknown, values: readonly T[], label: string): T {
  if (typeof value !== 'string' || !values.includes(value as T)) throw new Error(`invalid_${label}`);
  return value as T;
}

function decimalMinor(value: unknown, label: string, positive = false): bigint {
  if (typeof value !== 'string' || !decimalPattern.test(value)) throw new Error(`invalid_${label}_decimal`);
  const minor = BigInt(value.replace('.', ''));
  if (positive ? minor <= 0n : minor < 0n) throw new Error(`invalid_${label}_value`);
  return minor;
}

function decimalFromMinor(value: bigint): string {
  if (value < 0n) throw new Error('negative_decimal');
  return `${value / scale}.${String(value % scale).padStart(3, '0')}`;
}

function multiplyDivide(left: string, multiplier: string, divisor: string, label: string): string {
  const numerator = decimalMinor(left, `${label}_left`) * decimalMinor(multiplier, `${label}_multiplier`, true);
  const denominator = decimalMinor(divisor, `${label}_divisor`, true);
  return decimalFromMinor((numerator + denominator / 2n) / denominator);
}

function requireNutrition(value: unknown, label: string): GraphNutritionV1 {
  const row = requireRecord(value, nutritionKeys, label);
  return Object.fromEntries(nutritionKeys.map((key) => [
    key, decimalFromMinor(decimalMinor(row[key], `${label}_${key}`)),
  ])) as unknown as GraphNutritionV1;
}

function addNutrition(values: GraphNutritionV1[]): GraphNutritionV1 {
  return Object.fromEntries(nutritionKeys.map((key) => [key, decimalFromMinor(values.reduce(
    (total, value) => total + decimalMinor(value[key], `nutrition_${key}`), 0n,
  ))])) as unknown as GraphNutritionV1;
}

function sameNutrition(left: GraphNutritionV1, right: GraphNutritionV1): boolean {
  return nutritionKeys.every((key) => left[key] === right[key]);
}

function requireSortedUnique<T extends string>(
  value: unknown,
  allowed: readonly T[],
  label: string,
  allowEmpty: boolean,
): T[] {
  if (!Array.isArray(value) || (!allowEmpty && value.length === 0)) throw new Error(`invalid_${label}`);
  const normalized = value.map((item) => requireEnum(item, allowed, label));
  if (new Set(normalized).size !== normalized.length) throw new Error(`duplicate_${label}`);
  const ordered = [...normalized].sort((left, right) => allowed.indexOf(left) - allowed.indexOf(right));
  if (JSON.stringify(ordered) !== JSON.stringify(normalized)) throw new Error(`noncanonical_${label}_order`);
  return normalized;
}

function requireTags(value: unknown, label: string): string[] {
  if (!Array.isArray(value)) throw new Error(`invalid_${label}`);
  const result = value.map((item) => {
    if (typeof item !== 'string' || !tagPattern.test(item)) throw new Error(`invalid_${label}`);
    return item;
  });
  if (new Set(result).size !== result.length || JSON.stringify([...result].sort()) !== JSON.stringify(result)) {
    throw new Error(`noncanonical_${label}`);
  }
  return result;
}

function requireSortedUniqueUuids(value: unknown, label: string): string[] {
  if (!Array.isArray(value)) throw new Error(`invalid_${label}`);
  const result = value.map((item) => requireUuid(item, label));
  if (new Set(result).size !== result.length || JSON.stringify([...result].sort()) !== JSON.stringify(result)) {
    throw new Error(`noncanonical_${label}`);
  }
  return result;
}

export function decodeMealCompositionEligibilityV1(value: unknown): MealCompositionEligibilitySnapshotV1 {
  const row = requireRecord(value, ['contract', 'eligibilityRevisionId', 'recipeRevisionId',
    'compositionPolicyRevision', 'role', 'anchorKind', 'allowedMealTypes', 'requiredCompanionRoleSets',
    'pairingTags', 'incompatiblePairingTags', 'repeatFamily', 'energyClass', 'beverageClass'], 'meal_eligibility');
  if (row.contract !== adaptiveMealCompositionEligibilityV1_1) throw new Error('unsupported_meal_eligibility_contract');
  const role = requireEnum(row.role, roles, 'meal_component_role');
  const anchorKind = requireEnum(row.anchorKind, anchorKinds, 'anchor_kind');
  if (!Array.isArray(row.requiredCompanionRoleSets)) throw new Error('invalid_required_companion_sets');
  const requiredCompanionRoleSets = row.requiredCompanionRoleSets.map((set, index) => {
    const result = requireSortedUnique(set, roles, `required_companion_set_${index}`, false);
    if (result.includes('MAIN_COMPONENT') || result.includes('BEVERAGE')) {
      throw new Error('invalid_required_companion_role');
    }
    return result;
  });
  const setKeys = requiredCompanionRoleSets.map((set) => set.join('|'));
  if (new Set(setKeys).size !== setKeys.length || JSON.stringify([...setKeys].sort()) !== JSON.stringify(setKeys)) {
    throw new Error('noncanonical_required_companion_sets');
  }
  if (anchorKind === 'COMPLETE' && requiredCompanionRoleSets.length !== 0) {
    throw new Error('complete_anchor_cannot_require_companions');
  }
  if (anchorKind === 'PARTIAL' && requiredCompanionRoleSets.length === 0) {
    throw new Error('partial_anchor_requires_companion_metadata');
  }
  if (anchorKind === 'NONE' && requiredCompanionRoleSets.length !== 0) {
    throw new Error('non_anchor_cannot_require_companions');
  }
  const beverageClass = requireEnum(row.beverageClass, beverageClasses, 'beverage_class');
  if ((role === 'BEVERAGE') !== (beverageClass !== 'NOT_BEVERAGE')) throw new Error('beverage_role_mismatch');
  if (typeof row.repeatFamily !== 'string' || !tagPattern.test(row.repeatFamily)) {
    throw new Error('invalid_repeat_family');
  }
  return {
    contract: adaptiveMealCompositionEligibilityV1_1,
    eligibilityRevisionId: requireUuid(row.eligibilityRevisionId, 'eligibility_revision'),
    recipeRevisionId: requireUuid(row.recipeRevisionId, 'eligibility_recipe_revision'),
    compositionPolicyRevision: requireUuid(row.compositionPolicyRevision, 'composition_policy_revision'),
    role,
    anchorKind,
    allowedMealTypes: requireSortedUnique(row.allowedMealTypes, mealTypes, 'allowed_meal_types', false),
    requiredCompanionRoleSets,
    pairingTags: requireTags(row.pairingTags, 'pairing_tags'),
    incompatiblePairingTags: requireTags(row.incompatiblePairingTags, 'incompatible_pairing_tags'),
    repeatFamily: row.repeatFamily,
    energyClass: requireEnum(row.energyClass, energyClasses, 'energy_class'),
    beverageClass,
  };
}

function requireAssignedPortion(value: unknown, recipe: GraphRecipeSnapshotV1): GraphAssignedPortionV1 {
  const row = requireRecord(value, ['source', 'portionRevisionId', 'assignedServings', 'servingMultiplier',
    'assignedGrams'], 'meal_assigned_portion');
  if (row.source !== 'potok_generator') throw new Error('meal_portion_requires_generator');
  const assignedServings = decimalFromMinor(decimalMinor(row.assignedServings, 'assigned_servings', true));
  const servingMultiplier = decimalFromMinor(decimalMinor(row.servingMultiplier, 'serving_multiplier', true));
  const expectedMultiplier = multiplyDivide('1.000', assignedServings, recipe.baseYield.servings, 'serving_multiplier');
  if (servingMultiplier !== expectedMultiplier) throw new Error('meal_portion_multiplier_mismatch');
  const assignedGrams = row.assignedGrams === null ? null
    : decimalFromMinor(decimalMinor(row.assignedGrams, 'assigned_grams', true));
  if ((recipe.baseYield.totalYieldGrams === null) !== (assignedGrams === null)) {
    throw new Error('meal_assigned_grams_basis_mismatch');
  }
  if (assignedGrams !== null && recipe.baseYield.totalYieldGrams !== null
      && assignedGrams !== multiplyDivide(recipe.baseYield.totalYieldGrams, assignedServings,
        recipe.baseYield.servings, 'assigned_grams')) {
    throw new Error('meal_assigned_grams_mismatch');
  }
  return {
    source: 'potok_generator',
    portionRevisionId: requireUuid(row.portionRevisionId, 'portion_revision'),
    assignedServings, servingMultiplier, assignedGrams,
  };
}

function normalizeCandidate(value: unknown): MealComponentCandidateV1 {
  const row = requireRecord(value, ['mealComponentId', 'eligibility', 'recipeRevision', 'portionRevision', 'recipe',
    'assignedPortion', 'ingredients', 'nutrition'], 'meal_component_candidate');
  const eligibility = decodeMealCompositionEligibilityV1(row.eligibility);
  const recipe = decodeGraphRecipeSnapshotV1(row.recipe);
  const recipeRevision = requireUuid(row.recipeRevision, 'component_recipe_revision');
  if (recipeRevision !== recipe.recipeRevisionId || recipeRevision !== eligibility.recipeRevisionId) {
    throw new Error('meal_component_recipe_revision_mismatch');
  }
  const assignedPortion = requireAssignedPortion(row.assignedPortion, recipe);
  const portionRevision = requireUuid(row.portionRevision, 'component_portion_revision');
  if (portionRevision !== assignedPortion.portionRevisionId) throw new Error('meal_component_portion_revision_mismatch');
  const expected = scalePremiumRecipeCollectionV1(recipe, assignedPortion.assignedServings);
  for (const component of expected.ingredients) {
    if (component.scaling.mode === 'discrete'
        && decimalMinor(component.quantity.amount, 'scaled_piece_amount', true)
          % decimalMinor(component.scaling.increment, 'piece_increment', true) !== 0n) {
      throw new Error('meal_component_discrete_increment_violation');
    }
  }
  if (JSON.stringify(row.ingredients) !== JSON.stringify(expected.ingredients)) {
    throw new Error('meal_component_ingredients_mismatch');
  }
  const nutrition = requireNutrition(row.nutrition, 'meal_component_nutrition');
  if (!sameNutrition(nutrition, expected.nutrition)) throw new Error('meal_component_nutrition_mismatch');
  if (eligibility.beverageClass === 'NON_CALORIC'
      && nutritionKeys.some((key) => decimalMinor(nutrition[key], `beverage_${key}`) !== 0n)) {
    throw new Error('non_caloric_beverage_must_have_zero_nutrition');
  }
  if (eligibility.beverageClass === 'CALORIC' && decimalMinor(nutrition.calories, 'beverage_calories') === 0n) {
    throw new Error('caloric_beverage_requires_calories');
  }
  return {
    mealComponentId: requireUuid(row.mealComponentId, 'meal_component'), eligibility,
    recipeRevision, portionRevision, recipe, assignedPortion,
    ingredients: expected.ingredients, nutrition,
  };
}

export function decodeMealCompositionPolicyV1(value: unknown): MealCompositionPolicyV1 {
  const row = requireRecord(value, ['policyRevision', 'maxComponents', 'patterns', 'nutritionWeights'],
    'meal_composition_policy');
  if (!Number.isSafeInteger(row.maxComponents) || (row.maxComponents as number) < 1
      || (row.maxComponents as number) > 6) throw new Error('invalid_max_components');
  if (!Array.isArray(row.patterns) || row.patterns.length === 0 || row.patterns.length > 32) {
    throw new Error('invalid_composition_patterns');
  }
  const patterns = row.patterns.map((valuePattern) => {
    const pattern = requireRecord(valuePattern, ['patternId', 'allowedMealTypes', 'roles'], 'composition_pattern');
    if (typeof pattern.patternId !== 'string' || !tokenPattern.test(pattern.patternId)) throw new Error('invalid_pattern_id');
    const patternRoles = requireSortedUnique(pattern.roles, roles, 'pattern_roles', false);
    if (patternRoles.length > (row.maxComponents as number)) throw new Error('pattern_exceeds_max_components');
    return {
      patternId: pattern.patternId,
      allowedMealTypes: requireSortedUnique(pattern.allowedMealTypes, mealTypes, 'pattern_meal_types', false),
      roles: patternRoles,
    };
  });
  if (new Set(patterns.map((pattern) => pattern.patternId)).size !== patterns.length) {
    throw new Error('duplicate_pattern_id');
  }
  const weights = requireRecord(row.nutritionWeights, nutritionKeys, 'nutrition_weights');
  const nutritionWeights = Object.fromEntries(nutritionKeys.map((key) => {
    const weight = weights[key];
    if (!Number.isSafeInteger(weight) || (weight as number) < 0 || (weight as number) > 1_000) {
      throw new Error(`invalid_${key}_weight`);
    }
    return [key, weight];
  })) as Record<keyof GraphNutritionV1, number>;
  if (Object.values(nutritionWeights).every((weight) => weight === 0)) throw new Error('nutrition_weights_required');
  return {
    policyRevision: requireUuid(row.policyRevision, 'policy_revision'),
    maxComponents: row.maxComponents as number, patterns, nutritionWeights,
  };
}

function withinMaximum(value: GraphNutritionV1, maximum: GraphNutritionV1): boolean {
  return nutritionKeys.every((key) => decimalMinor(value[key], `value_${key}`)
    <= decimalMinor(maximum[key], `maximum_${key}`));
}

function compatible(components: MealComponentCandidateV1[]): boolean {
  if (new Set(components.map((component) => component.recipeRevision)).size !== components.length) return false;
  return components.every((component, index) => components.every((other, otherIndex) => index === otherIndex
    || !component.eligibility.incompatiblePairingTags.some((tag) => other.eligibility.pairingTags.includes(tag))));
}

function complete(components: MealComponentCandidateV1[]): boolean {
  const anchors = components.filter((component) => component.eligibility.anchorKind !== 'NONE');
  if (anchors.length !== 1) return false;
  const anchor = anchors[0];
  if (anchor.eligibility.anchorKind === 'COMPLETE') return true;
  const presentRoles = new Set(components.map((component) => component.eligibility.role));
  return anchor.eligibility.requiredCompanionRoleSets.every((alternatives) => alternatives.some((role) => presentRoles.has(role)));
}

function cartesian<T>(groups: T[][]): T[][] {
  return groups.reduce<T[][]>((rows, group) => rows.flatMap((row) => group.map((item) => [...row, item])), [[]]);
}

function distance(
  meal: GraphNutritionV1,
  currentDay: GraphNutritionV1,
  slotTarget: GraphNutritionV1,
  dayTarget: GraphNutritionV1,
  weights: Record<keyof GraphNutritionV1, number>,
): bigint {
  return nutritionKeys.reduce((score, key) => {
    const mealValue = decimalMinor(meal[key], `meal_${key}`);
    const currentValue = decimalMinor(currentDay[key], `current_${key}`);
    const slotValue = decimalMinor(slotTarget[key], `slot_${key}`);
    const dayValue = decimalMinor(dayTarget[key], `day_${key}`);
    const mealDistance = mealValue > slotValue ? mealValue - slotValue : slotValue - mealValue;
    const afterValue = currentValue + mealValue;
    const dayDistance = afterValue > dayValue ? afterValue - dayValue : dayValue - afterValue;
    return score + (mealDistance + dayDistance) * BigInt(weights[key]);
  }, 0n);
}

function goalEnergyRank(goal: MealGoalProfileV1, energyClass: MealEnergyClassV1): number {
  const orders: Record<MealGoalProfileV1, MealEnergyClassV1[]> = {
    WEIGHT_LOSS: ['LIGHTER', 'BALANCED', 'ENERGY_DENSE'],
    CUT: ['LIGHTER', 'BALANCED', 'ENERGY_DENSE'],
    MAINTENANCE: ['BALANCED', 'LIGHTER', 'ENERGY_DENSE'],
    MASS_GAIN: ['ENERGY_DENSE', 'BALANCED', 'LIGHTER'],
  };
  return orders[goal].indexOf(energyClass);
}

function canonicalJson(value: unknown): string {
  if (value === null || typeof value === 'string' || typeof value === 'boolean' || typeof value === 'number') {
    if (typeof value === 'number' && !Number.isSafeInteger(value)) throw new Error('canonical_numbers_must_be_integers');
    return JSON.stringify(value);
  }
  if (Array.isArray(value)) return `[${value.map(canonicalJson).join(',')}]`;
  if (value && typeof value === 'object' && Object.getPrototypeOf(value) === Object.prototype) {
    const row = value as Record<string, unknown>;
    return `{${Object.keys(row).sort().map((key) => `${JSON.stringify(key)}:${canonicalJson(row[key])}`).join(',')}}`;
  }
  throw new Error('unsupported_canonical_meal_value');
}

function mealDigestPayload(meal: Omit<MealSnapshotV1, 'digest'>): Uint8Array {
  return new TextEncoder().encode(canonicalJson({
    encoding: adaptiveMealCompositionEncodingV1_1,
    contract: adaptiveMealCompositionContractV1_1,
    meal,
  }));
}

async function sha256Hex(bytes: Uint8Array): Promise<string> {
  const subtle = globalThis.crypto?.subtle;
  if (!subtle) throw new Error('sha256_unavailable');
  const stable = new Uint8Array(bytes.byteLength);
  stable.set(bytes);
  const digest = await subtle.digest('SHA-256', stable.buffer);
  return Array.from(new Uint8Array(digest), (byte) => byte.toString(16).padStart(2, '0')).join('');
}

export async function composeAdaptiveMealV1(rawInput: unknown): Promise<MealCompositionResultV1> {
  const row = requireRecord(rawInput, ['mealSlotId', 'mealSnapshotRevision', 'mealType', 'goalRevision', 'goalProfile',
    'policy', 'slotTarget', 'slotHardMaximum', 'currentDayNutrition', 'dayTarget', 'dayHardMaximum',
    'excludedRecipeRevisions', 'excludedRepeatFamilies', 'candidates'], 'meal_composer_input');
  const policy = decodeMealCompositionPolicyV1(row.policy);
  const mealType = requireEnum(row.mealType, mealTypes, 'meal_type');
  const goalProfile = requireEnum(row.goalProfile,
    ['WEIGHT_LOSS', 'CUT', 'MAINTENANCE', 'MASS_GAIN'] as const, 'goal_profile');
  const slotTarget = requireNutrition(row.slotTarget, 'slot_target');
  const slotHardMaximum = requireNutrition(row.slotHardMaximum, 'slot_hard_maximum');
  const currentDayNutrition = requireNutrition(row.currentDayNutrition, 'current_day_nutrition');
  const dayTarget = requireNutrition(row.dayTarget, 'day_target');
  const dayHardMaximum = requireNutrition(row.dayHardMaximum, 'day_hard_maximum');
  const excludedRecipeRevisions = requireSortedUniqueUuids(row.excludedRecipeRevisions, 'excluded_recipe_revisions');
  const excludedRepeatFamilies = requireTags(row.excludedRepeatFamilies, 'excluded_repeat_families');
  if (!Array.isArray(row.candidates) || row.candidates.length === 0 || row.candidates.length > 64) {
    throw new Error('invalid_meal_candidates');
  }
  const candidates = row.candidates.map(normalizeCandidate).filter((candidate) =>
    candidate.eligibility.compositionPolicyRevision === policy.policyRevision
      && candidate.eligibility.allowedMealTypes.includes(mealType)
      && !excludedRecipeRevisions.includes(candidate.recipeRevision)
      && !excludedRepeatFamilies.includes(candidate.eligibility.repeatFamily));
  if (new Set(candidates.map((candidate) => candidate.mealComponentId)).size !== candidates.length) {
    throw new Error('duplicate_meal_component_id');
  }

  const ranked: Array<{ components: MealComponentCandidateV1[]; nutrition: GraphNutritionV1; score: bigint;
    goalRank: number; patternIndex: number; stableKey: string }> = [];
  policy.patterns.forEach((pattern, patternIndex) => {
    if (!pattern.allowedMealTypes.includes(mealType)) return;
    const groups = pattern.roles.map((role) => candidates
      .filter((candidate) => candidate.eligibility.role === role)
      .sort((left, right) => left.mealComponentId.localeCompare(right.mealComponentId)));
    if (groups.some((group) => group.length === 0)) return;
    for (const components of cartesian(groups)) {
      if (!compatible(components) || !complete(components)) continue;
      const nutrition = addNutrition(components.map((component) => component.nutrition));
      const afterDay = addNutrition([currentDayNutrition, nutrition]);
      if (!withinMaximum(nutrition, slotHardMaximum) || !withinMaximum(afterDay, dayHardMaximum)) continue;
      ranked.push({
        components, nutrition,
        score: distance(nutrition, currentDayNutrition, slotTarget, dayTarget, policy.nutritionWeights),
        goalRank: components.reduce((sum, component) => sum + goalEnergyRank(goalProfile,
          component.eligibility.energyClass), 0),
        patternIndex,
        stableKey: components.map((component) => component.mealComponentId).join(':'),
      });
    }
  });
  ranked.sort((left, right) => left.score === right.score
    ? left.goalRank - right.goalRank || left.patternIndex - right.patternIndex || left.stableKey.localeCompare(right.stableKey)
    : left.score < right.score ? -1 : 1);
  if (ranked.length === 0) return { status: 'INCOMPLETE', reasons: ['NO_COMPLETE_COMPATIBLE_COMPOSITION'] };

  const selected = ranked[0];
  const components: MealComponentSnapshotV1[] = selected.components.map((candidate, sortOrder) => ({
    ...structuredClone(candidate), sortOrder,
  }));
  const withoutDigest: Omit<MealSnapshotV1, 'digest'> = {
    contractVersion: 1,
    mealSnapshotRevision: requireUuid(row.mealSnapshotRevision, 'meal_snapshot_revision'),
    mealSlotId: requireUuid(row.mealSlotId, 'meal_slot'),
    goalRevision: requireUuid(row.goalRevision, 'goal_revision'),
    mealType,
    compositionPolicyRevision: policy.policyRevision,
    components,
    nutrition: selected.nutrition,
  };
  const digest = await sha256Hex(mealDigestPayload(withoutDigest));
  return { status: 'COMPLETE', meal: { ...withoutDigest, digest }, score: selected.score.toString() };
}

export async function decodeMealSnapshotV1(value: unknown): Promise<MealSnapshotV1> {
  const row = requireRecord(value, ['contractVersion', 'mealSnapshotRevision', 'mealSlotId', 'goalRevision', 'mealType',
    'compositionPolicyRevision', 'components', 'nutrition', 'digest'], 'meal_snapshot');
  if (row.contractVersion !== 1) throw new Error('unsupported_meal_snapshot_contract');
  if (!Array.isArray(row.components) || row.components.length === 0 || row.components.length > 6) {
    throw new Error('invalid_meal_snapshot_components');
  }
  const components = row.components.map((valueComponent, sortOrder): MealComponentSnapshotV1 => {
    const component = requireRecord(valueComponent, ['mealComponentId', 'eligibility', 'recipeRevision',
      'portionRevision', 'recipe', 'assignedPortion', 'ingredients', 'nutrition', 'sortOrder'], 'meal_component_snapshot');
    if (component.sortOrder !== sortOrder) throw new Error('meal_component_order_mismatch');
    const { sortOrder: _validatedOrder, ...candidate } = component;
    void _validatedOrder;
    return { ...normalizeCandidate(candidate), sortOrder };
  });
  if (new Set(components.map((component) => component.mealComponentId)).size !== components.length) {
    throw new Error('duplicate_meal_component_id');
  }
  const mealType = requireEnum(row.mealType, mealTypes, 'meal_type');
  if (components.some((component) => !component.eligibility.allowedMealTypes.includes(mealType))) {
    throw new Error('meal_component_type_not_allowed');
  }
  if (!compatible(components) || !complete(components)) throw new Error('incomplete_meal_snapshot');
  const nutrition = requireNutrition(row.nutrition, 'meal_snapshot_nutrition');
  if (!sameNutrition(nutrition, addNutrition(components.map((component) => component.nutrition)))) {
    throw new Error('meal_snapshot_nutrition_mismatch');
  }
  if (typeof row.digest !== 'string' || !digestPattern.test(row.digest)) throw new Error('invalid_meal_digest');
  const withoutDigest: Omit<MealSnapshotV1, 'digest'> = {
    contractVersion: 1,
    mealSnapshotRevision: requireUuid(row.mealSnapshotRevision, 'meal_snapshot_revision'),
    mealSlotId: requireUuid(row.mealSlotId, 'meal_slot'),
    goalRevision: requireUuid(row.goalRevision, 'goal_revision'),
    mealType,
    compositionPolicyRevision: requireUuid(row.compositionPolicyRevision, 'composition_policy_revision'),
    components, nutrition,
  };
  if (components.some((component) => component.eligibility.compositionPolicyRevision
    !== withoutDigest.compositionPolicyRevision)) throw new Error('meal_policy_revision_mismatch');
  const expectedDigest = await sha256Hex(mealDigestPayload(withoutDigest));
  if (row.digest !== expectedDigest) throw new Error('meal_digest_mismatch');
  return { ...withoutDigest, digest: row.digest };
}
