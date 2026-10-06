import {
  decodeMealSnapshotV1,
  type MealComponentRoleV1,
  type MealCompositionPolicyV1,
  type MealSnapshotV1,
} from './adaptiveNutritionMealCompositionV1';
import type { GraphMealTypeV1, GraphNutritionV1 } from './adaptiveNutritionGraphV1';
import type { AdaptiveNutritionCandidateManifestV2 } from './adaptiveNutritionAuthoritiesV1';
import { assertRawJsonWithoutDuplicateKeysV1 } from './adaptiveNutritionWireV1';

export const mealBalanceContractV1 = 'potok-adaptive-meal-balance-v1' as const;
export const goalNutritionTargetContractV1 = 'potok-adaptive-goal-nutrition-target-v1' as const;
export const goalTargetFitInputContractV1 = 'potok-adaptive-goal-target-fit-input-v1' as const;
export const goalTargetFitResultContractV1 = 'potok-adaptive-goal-target-fit-result-v1' as const;
export const mealCandidateEvidenceContractV1 = 'potok-adaptive-meal-candidate-evidence-v1' as const;
export const mealCandidateEvidenceContractV2 = 'potok-adaptive-meal-candidate-evidence-v2' as const;
export const mealValidatorInputContractV1 = 'potok-adaptive-meal-validator-input-v1' as const;
export const dayValidatorInputContractV1 = 'potok-adaptive-day-validator-input-v1' as const;
export const weekValidatorInputContractV1 = 'potok-adaptive-week-validator-input-v1' as const;
export const weekValidatorInputContractV2 = 'potok-adaptive-week-validator-input-v2' as const;
export const balancePolicyContractV1 = 'potok-adaptive-balance-policy-v1' as const;
export const optimizationPolicyContractV1 = 'potok-adaptive-optimization-policy-v1' as const;
export const optimizationInputContractV1 = 'potok-adaptive-optimization-input-v1' as const;
export const optimizationResultContractV1 = 'potok-adaptive-optimization-result-v1' as const;
export const validatorResultContractV1 = 'potok-adaptive-validator-result-v1' as const;

export type MealSourceKindV1 = 'COMPLETE_RECIPE' | 'COMPOSED_MEAL';
export type ValidatorScopeV1 = 'MEAL' | 'DAY' | 'WEEK';
export type ValidatorStatusV1 = 'VALID' | 'VALID_WITH_WARNINGS' | 'INVALID' | 'BLOCKED_MISSING_EVIDENCE';
export type ValidatorSeverityV1 = 'WARNING' | 'ERROR' | 'BLOCKER';
export type AccessibilityClassV1 = 'COMMON_RU_RETAIL' | 'SEASONAL_BUT_COMMON'
  | 'SPECIALTY_PRODUCT_REQUIRED' | 'EXPENSIVE_OPTIONAL' | 'ACCESSIBILITY_BLOCKED';

export type ValidatorReasonCodeV1 =
  | 'PUBLICATION_NOT_APPROVED'
  | 'CANONICAL_EVIDENCE_MISSING'
  | 'NUTRITION_EVIDENCE_MISSING'
  | 'NUTRITION_SUM_MISMATCH'
  | 'ALLERGEN_EVIDENCE_MISSING'
  | 'DIETARY_EVIDENCE_MISSING'
  | 'COMPOSITION_EVIDENCE_MISSING'
  | 'PORTION_POLICY_MISSING'
  | 'REPEAT_EVIDENCE_MISSING'
  | 'STALE_POLICY_REVISION'
  | 'DIGEST_MISMATCH'
  | 'ANCHOR_MISSING'
  | 'MULTIPLE_ANCHORS'
  | 'MISSING_REQUIRED_COMPANION'
  | 'ROLE_PATTERN_NOT_ALLOWED'
  | 'ROLE_CONFLICT'
  | 'DUPLICATE_ROLE'
  | 'DUPLICATE_RECIPE'
  | 'PAIRING_NOT_REVIEWED'
  | 'INCOMPATIBLE_PAIRING'
  | 'COMPONENT_LIMIT_EXCEEDED'
  | 'PORTION_OUTSIDE_REVIEWED_RANGE'
  | 'PORTION_NOT_REPRESENTABLE'
  | 'DISCRETE_FRACTION_REQUIRED'
  | 'PORTION_NUTRITION_MISMATCH'
  | 'ALLERGEN_CONFLICT'
  | 'INTOLERANCE_CONFLICT'
  | 'DIETARY_PATTERN_CONFLICT'
  | 'USER_EXCLUSION_CONFLICT'
  | 'MEAL_TYPE_NOT_ALLOWED'
  | 'ACCESSIBILITY_BLOCKED'
  | 'REQUIRED_PROTEIN_SOURCE_MISSING'
  | 'REQUIRED_PRODUCE_MISSING'
  | 'SPECIALTY_DEPENDENCY_REQUIRED'
  | 'EXPENSIVE_DEPENDENCY_REQUIRED'
  | 'SPECIALTY_LIMIT_EXCEEDED'
  | 'EXPENSIVE_LIMIT_EXCEEDED'
  | 'DAY_RECIPE_REPEAT_EXCEEDED'
  | 'WEEK_RECIPE_REPEAT_EXCEEDED'
  | 'WEEK_REPEAT_FAMILY_EXCEEDED'
  | 'WEEK_INGREDIENT_REPEAT_EXCEEDED'
  | 'MEAL_TARGET_MISMATCH'
  | 'DAY_TARGET_MISMATCH'
  | 'MEAL_DISTRIBUTION_MISMATCH'
  | 'GOAL_EVIDENCE_MISSING'
  | 'DAY_DISTRIBUTION_EVIDENCE_MISSING'
  | 'REQUIRED_SLOT_MISSING'
  | 'UNEXPECTED_SLOT'
  | 'DAY_DATE_MISMATCH'
  | 'WEEK_DATE_SEQUENCE_INVALID'
  | 'TIMEZONE_MISMATCH'
  | 'WEEK_POLICY_MISMATCH'
  | 'GOAL_REVISION_MISMATCH'
  | 'PLAN_REVISION_MISMATCH'
  | 'SOFT_TARGET_FIT_DEVIATION'
  | 'REPETITION_LIMIT_APPROACHING'
  | 'LONG_PREPARATION_BURDEN'
  | 'SHOPPING_LIST_BURDEN'
  | 'OPTIONAL_SPECIALTY_USED'
  | 'OPTIONAL_EXPENSIVE_USED'
  | 'LOWER_CONVENIENCE_SCORE';

export interface ValidatorReasonV1 {
  code: ValidatorReasonCodeV1;
  severity: ValidatorSeverityV1;
  path: string;
  evidenceRevision: string | null;
}

export interface ValidatorResultV1 {
  contract: typeof validatorResultContractV1;
  status: ValidatorStatusV1;
  scope: ValidatorScopeV1;
  policyRevision: string;
  subjectDigest: string;
  reasons: ValidatorReasonV1[];
}

export interface NutritionBoundsV1 {
  minimum: GraphNutritionV1;
  target: GraphNutritionV1;
  maximum: GraphNutritionV1;
}

export interface NutritionTargetAxisV1 {
  target: string;
  min: string;
  max: string;
}

export interface GoalNutritionTargetV1 {
  contract: typeof goalNutritionTargetContractV1;
  goalRevision: string;
  targetPolicyRevision: string;
  calories: NutritionTargetAxisV1;
  protein: NutritionTargetAxisV1 | null;
  fat: NutritionTargetAxisV1 | null;
  carbs: NutritionTargetAxisV1 | null;
  fiber: NutritionTargetAxisV1 | null;
}

export interface GoalTargetFitInputV1 {
  contract: typeof goalTargetFitInputContractV1;
  goalTarget: GoalNutritionTargetV1;
  expected: {
    goalRevision: string;
    targetPolicyRevision: string;
  };
  actualNutrition: GraphNutritionV1;
}

export interface GoalTargetFitResultV1 {
  contract: typeof goalTargetFitResultContractV1;
  goalRevision: string;
  targetPolicyRevision: string;
  calories: NutritionTargetAxisV1 & { actual: string };
  score: string;
  digest: string;
}

export interface BalancePolicyV1 {
  contract: typeof balancePolicyContractV1;
  policyRevision: string;
  maxComponents: 5;
  exactRecipePerWeek: 2;
  exactRecipePerDay: 1;
  repeatFamilyPerWeek: 3;
  dominantIngredientFamilyPerWeek: 4;
  specialtyMealsPerWeek: 1;
  expensiveMealsPerWeek: 2;
  allowedWarningCodes: ValidatorReasonCodeV1[];
}

export interface OptimizationPolicyV1 {
  contract: typeof optimizationPolicyContractV1;
  policyRevision: string;
  weights: {
    targetFit: '0.400';
    diversity: '0.250';
    convenience: '0.200';
    shoppingReuse: '0.150';
  };
}

export interface MealComponentEvidenceV1 {
  contract: typeof mealCandidateEvidenceContractV1;
  mealComponentId: string;
  recipeRevision: string;
  publicationStatus: 'PUBLISHED' | 'MISSING';
  publicationRevision: string | null;
  canonicalStatus: 'READY' | 'MISSING';
  canonicalEvidenceRevision: string | null;
  nutritionStatus: 'COMPLETE' | 'MISSING';
  nutritionEvidenceRevision: string | null;
  allergenStatus: 'REVIEWED' | 'MISSING';
  allergenEvidenceRevision: string | null;
  dietaryStatus: 'REVIEWED' | 'MISSING';
  dietaryEvidenceRevision: string | null;
  portionPolicyRevision: string | null;
  accessibility: AccessibilityClassV1;
  allergens: string[];
  dietaryTags: string[];
  ingredientFamilies: string[];
  dominantIngredientFamily: string;
  repeatFamily: string;
  assignedServingsMinimum: string;
  assignedServingsMaximum: string;
  proteinSource: boolean;
  produceSource: boolean;
}

/** Independent classification axes, admitted only against a separately pinned manifest. */
export interface MealComponentEvidenceV2 extends Omit<MealComponentEvidenceV1, 'contract'> {
  contract: typeof mealCandidateEvidenceContractV2;
  recipeId: string;
  portionRevision: string;
  eligibilityRevision: string;
  manifestRevision: string;
  manifestDigest: string;
  specialty: boolean;
  expensive: boolean;
}

export interface UserFoodConstraintsV1 {
  revisionId: string;
  excludedAllergens: string[];
  excludedIngredientFamilies: string[];
  requiredDietaryTags: string[];
  forbiddenDietaryTags: string[];
}

export interface MealValidationInputV1 {
  contract: typeof mealValidatorInputContractV1;
  sourceKind: MealSourceKindV1;
  meal: MealSnapshotV1;
  compositionPolicy: MealCompositionPolicyV1;
  balancePolicy: BalancePolicyV1;
  expected: {
    goalRevision: string;
    compositionPolicyRevision: string;
  };
  userConstraints: UserFoodConstraintsV1;
  componentEvidence: MealComponentEvidenceV1[];
  nutritionBounds: NutritionBoundsV1;
  requirements: {
    proteinSourceRequired: boolean;
    produceRequired: boolean;
  };
  warningSignals: {
    softTargetFitDeviation: boolean;
    longPreparationBurden: boolean;
    shoppingListBurden: boolean;
    lowerConvenienceScore: boolean;
    repetitionApproachingLimit: boolean;
  };
}

export interface DaySlotV1 {
  sortOrder: number;
  slotId: string;
  mealType: GraphMealTypeV1;
}

export interface DayMealV1 extends DaySlotV1 {
  date: string;
  validationInput: MealValidationInputV1;
}

export interface DayValidationInputV1 {
  contract: typeof dayValidatorInputContractV1;
  date: string;
  timezone: string;
  goalRevision: string;
  targetPolicyRevision: string;
  planRevision: string;
  compositionPolicyRevision: string;
  balancePolicy: BalancePolicyV1;
  requiredSlots: DaySlotV1[];
  meals: DayMealV1[];
  goalTarget: GoalNutritionTargetV1 | null;
  distributionBounds: Array<{
    sortOrder: number;
    slotId: string;
    bounds: NutritionBoundsV1;
  }> | null;
}

export interface OrdinaryFallbackProofV1 {
  candidatePoolDigest: string;
  status: 'VALID' | 'UNAVAILABLE_SPECIALTY' | 'UNAVAILABLE_EXPENSIVE' | 'UNAVAILABLE_BOTH';
  ordinaryWeekDigest: string | null;
}

export interface WeekValidationInputV1 {
  contract: typeof weekValidatorInputContractV1;
  weekAnchor: string;
  timezone: string;
  goalRevision: string;
  targetPolicyRevision: string;
  planRevision: string;
  compositionPolicyRevision: string;
  balancePolicy: BalancePolicyV1;
  days: DayValidationInputV1[];
  ordinaryFallbackProof: OrdinaryFallbackProofV1;
}

export interface OptimizationCandidateV1 {
  candidateId: string;
  sourceKind: MealSourceKindV1;
  validation: ValidatorResultV1;
  optimizationPolicyRevision: string;
  metrics: {
    targetFit: string;
    diversity: string;
    convenience: string;
    shoppingReuse: string;
  };
  patternOrder: number;
  componentIdentitySequence: string[];
}

export interface OptimizationInputV1 {
  contract: typeof optimizationInputContractV1;
  policy: OptimizationPolicyV1;
  candidates: OptimizationCandidateV1[];
}

export interface OptimizationResultV1 {
  contract: typeof optimizationResultContractV1;
  policyRevision: string;
  selectedCandidateId: string;
  sourceKind: MealSourceKindV1;
  score: string;
  digest: string;
}

const uuidPattern = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/;
const decimalPattern = /^(0|[1-9][0-9]{0,8})\.[0-9]{3}$/;
const datePattern = /^\d{4}-\d{2}-\d{2}$/;
const digestPattern = /^[0-9a-f]{64}$/;
const tokenPattern = /^[a-z0-9][a-z0-9._-]{0,127}$/;
const nutritionKeys: ReadonlyArray<keyof GraphNutritionV1> = ['calories', 'protein', 'fat', 'carbs', 'fiber'];
const mealTypes: readonly GraphMealTypeV1[] = ['breakfast', 'lunch', 'dinner', 'snack'];
const roles: readonly MealComponentRoleV1[] = [
  'MAIN_COMPONENT', 'CARB_SIDE', 'VEGETABLE_SIDE', 'SALAD', 'EXTRA', 'SAUCE', 'BEVERAGE',
];
const allowedWarningCodes: readonly ValidatorReasonCodeV1[] = [
  'SOFT_TARGET_FIT_DEVIATION', 'REPETITION_LIMIT_APPROACHING', 'LONG_PREPARATION_BURDEN',
  'SHOPPING_LIST_BURDEN', 'OPTIONAL_SPECIALTY_USED', 'OPTIONAL_EXPENSIVE_USED',
  'LOWER_CONVENIENCE_SCORE',
];
const validatorReasonCodes: readonly ValidatorReasonCodeV1[] = [
  'PUBLICATION_NOT_APPROVED', 'CANONICAL_EVIDENCE_MISSING', 'NUTRITION_EVIDENCE_MISSING',
  'NUTRITION_SUM_MISMATCH', 'ALLERGEN_EVIDENCE_MISSING', 'DIETARY_EVIDENCE_MISSING',
  'COMPOSITION_EVIDENCE_MISSING', 'PORTION_POLICY_MISSING', 'REPEAT_EVIDENCE_MISSING',
  'STALE_POLICY_REVISION', 'DIGEST_MISMATCH', 'ANCHOR_MISSING', 'MULTIPLE_ANCHORS',
  'MISSING_REQUIRED_COMPANION', 'ROLE_PATTERN_NOT_ALLOWED', 'ROLE_CONFLICT', 'DUPLICATE_ROLE',
  'DUPLICATE_RECIPE', 'PAIRING_NOT_REVIEWED', 'INCOMPATIBLE_PAIRING', 'COMPONENT_LIMIT_EXCEEDED',
  'PORTION_OUTSIDE_REVIEWED_RANGE', 'PORTION_NOT_REPRESENTABLE', 'DISCRETE_FRACTION_REQUIRED',
  'PORTION_NUTRITION_MISMATCH', 'ALLERGEN_CONFLICT', 'INTOLERANCE_CONFLICT',
  'DIETARY_PATTERN_CONFLICT', 'USER_EXCLUSION_CONFLICT', 'MEAL_TYPE_NOT_ALLOWED',
  'ACCESSIBILITY_BLOCKED', 'REQUIRED_PROTEIN_SOURCE_MISSING', 'REQUIRED_PRODUCE_MISSING',
  'SPECIALTY_DEPENDENCY_REQUIRED', 'EXPENSIVE_DEPENDENCY_REQUIRED', 'SPECIALTY_LIMIT_EXCEEDED',
  'EXPENSIVE_LIMIT_EXCEEDED', 'DAY_RECIPE_REPEAT_EXCEEDED', 'WEEK_RECIPE_REPEAT_EXCEEDED',
  'WEEK_REPEAT_FAMILY_EXCEEDED', 'WEEK_INGREDIENT_REPEAT_EXCEEDED', 'MEAL_TARGET_MISMATCH',
  'DAY_TARGET_MISMATCH', 'MEAL_DISTRIBUTION_MISMATCH', 'GOAL_EVIDENCE_MISSING',
  'DAY_DISTRIBUTION_EVIDENCE_MISSING', 'REQUIRED_SLOT_MISSING', 'UNEXPECTED_SLOT',
  'DAY_DATE_MISMATCH', 'WEEK_DATE_SEQUENCE_INVALID', 'TIMEZONE_MISMATCH', 'WEEK_POLICY_MISMATCH',
  'GOAL_REVISION_MISMATCH', 'PLAN_REVISION_MISMATCH', 'SOFT_TARGET_FIT_DEVIATION',
  'REPETITION_LIMIT_APPROACHING', 'LONG_PREPARATION_BURDEN', 'SHOPPING_LIST_BURDEN',
  'OPTIONAL_SPECIALTY_USED', 'OPTIONAL_EXPENSIVE_USED', 'LOWER_CONVENIENCE_SCORE',
];

function record(value: unknown, keys: readonly string[], label: string): Record<string, unknown> {
  if (!value || typeof value !== 'object' || Array.isArray(value)
      || Object.getPrototypeOf(value) !== Object.prototype) throw new Error(`invalid_${label}`);
  const actual = Object.keys(value);
  if (actual.length !== keys.length || !keys.every((key) => actual.includes(key))) {
    throw new Error(`invalid_${label}_fields`);
  }
  return value as Record<string, unknown>;
}

function uuid(value: unknown, label: string): string {
  if (typeof value !== 'string' || !uuidPattern.test(value)) throw new Error(`invalid_${label}_uuid`);
  return value;
}

function enumValue<T extends string>(value: unknown, values: readonly T[], label: string): T {
  if (typeof value !== 'string' || !values.includes(value as T)) throw new Error(`invalid_${label}`);
  return value as T;
}

function bool(value: unknown, label: string): boolean {
  if (typeof value !== 'boolean') throw new Error(`invalid_${label}`);
  return value;
}

function integer(value: unknown, label: string, minimum = 0): number {
  if (!Number.isSafeInteger(value) || (value as number) < minimum) throw new Error(`invalid_${label}`);
  return value as number;
}

function decimalMinor(value: unknown, label: string): bigint {
  if (typeof value !== 'string' || !decimalPattern.test(value)) throw new Error(`invalid_${label}_decimal`);
  return BigInt(value.replace('.', ''));
}

function unitIntervalMinor(value: unknown, label: string): bigint {
  const result = decimalMinor(value, label);
  if (result > 1_000n) throw new Error(`invalid_${label}_range`);
  return result;
}

function decimalFromMinor(value: bigint): string {
  if (value < 0n) throw new Error('negative_decimal');
  return `${value / 1_000n}.${String(value % 1_000n).padStart(3, '0')}`;
}

function sortedTokens(value: unknown, label: string, allowEmpty = true): string[] {
  if (!Array.isArray(value) || (!allowEmpty && value.length === 0)) throw new Error(`invalid_${label}`);
  const result = value.map((item) => {
    if (typeof item !== 'string' || !tokenPattern.test(item)) throw new Error(`invalid_${label}`);
    return item;
  });
  if (new Set(result).size !== result.length || JSON.stringify([...result].sort()) !== JSON.stringify(result)) {
    throw new Error(`noncanonical_${label}`);
  }
  return result;
}

function sortedEnums<T extends string>(value: unknown, values: readonly T[], label: string): T[] {
  if (!Array.isArray(value)) throw new Error(`invalid_${label}`);
  const result = value.map((item) => enumValue(item, values, label));
  if (new Set(result).size !== result.length || JSON.stringify([...result].sort()) !== JSON.stringify(result)) {
    throw new Error(`noncanonical_${label}`);
  }
  return result;
}

function sortedUuids(value: unknown, label: string): string[] {
  if (!Array.isArray(value)) throw new Error(`invalid_${label}`);
  const result = value.map((item) => uuid(item, label));
  if (new Set(result).size !== result.length || JSON.stringify([...result].sort()) !== JSON.stringify(result)) {
    throw new Error(`noncanonical_${label}`);
  }
  return result;
}

function nutrition(value: unknown, label: string): GraphNutritionV1 {
  const row = record(value, nutritionKeys, label);
  return Object.fromEntries(nutritionKeys.map((key) => [
    key,
    decimalFromMinor(decimalMinor(row[key], `${label}_${key}`)),
  ])) as unknown as GraphNutritionV1;
}

function nutritionBounds(value: unknown, label: string): NutritionBoundsV1 {
  const row = record(value, ['minimum', 'target', 'maximum'], label);
  const minimum = nutrition(row.minimum, `${label}_minimum`);
  const target = nutrition(row.target, `${label}_target`);
  const maximum = nutrition(row.maximum, `${label}_maximum`);
  for (const key of nutritionKeys) {
    const min = decimalMinor(minimum[key], `${label}_${key}_minimum`);
    const targetValue = decimalMinor(target[key], `${label}_${key}_target`);
    const max = decimalMinor(maximum[key], `${label}_${key}_maximum`);
    if (min > targetValue || targetValue > max) throw new Error(`invalid_${label}_${key}_order`);
  }
  return { minimum, target, maximum };
}

function nutritionTargetAxis(value: unknown, label: string): NutritionTargetAxisV1 {
  const row = record(value, ['target', 'min', 'max'], label);
  const target = decimalFromMinor(decimalMinor(row.target, `${label}_target`));
  const min = decimalFromMinor(decimalMinor(row.min, `${label}_min`));
  const max = decimalFromMinor(decimalMinor(row.max, `${label}_max`));
  if (decimalMinor(min, `${label}_min`) > decimalMinor(target, `${label}_target`)
      || decimalMinor(target, `${label}_target`) > decimalMinor(max, `${label}_max`)) {
    throw new Error(`invalid_${label}_order`);
  }
  return { target, min, max };
}

export function decodeGoalNutritionTargetV1(value: unknown): GoalNutritionTargetV1 {
  const row = record(value, ['contract', 'goalRevision', 'targetPolicyRevision', 'calories',
    'protein', 'fat', 'carbs', 'fiber'], 'goal_nutrition_target');
  if (row.contract !== goalNutritionTargetContractV1) throw new Error('unsupported_goal_nutrition_target');
  const optionalAxis = (axis: unknown, label: string): NutritionTargetAxisV1 | null =>
    axis === null ? null : nutritionTargetAxis(axis, label);
  return {
    contract: goalNutritionTargetContractV1,
    goalRevision: uuid(row.goalRevision, 'goal_target_goal_revision'),
    targetPolicyRevision: uuid(row.targetPolicyRevision, 'target_policy_revision'),
    calories: nutritionTargetAxis(row.calories, 'goal_target_calories'),
    protein: optionalAxis(row.protein, 'goal_target_protein'),
    fat: optionalAxis(row.fat, 'goal_target_fat'),
    carbs: optionalAxis(row.carbs, 'goal_target_carbs'),
    fiber: optionalAxis(row.fiber, 'goal_target_fiber'),
  };
}

function axisContains(axis: NutritionTargetAxisV1, actual: string, label: string): boolean {
  const value = decimalMinor(actual, `${label}_actual`);
  return value >= decimalMinor(axis.min, `${label}_min`) && value <= decimalMinor(axis.max, `${label}_max`);
}

function calorieTargetFitMinor(axis: NutritionTargetAxisV1, actual: string): bigint {
  const value = decimalMinor(actual, 'target_fit_actual');
  const target = decimalMinor(axis.target, 'target_fit_target');
  const min = decimalMinor(axis.min, 'target_fit_min');
  const max = decimalMinor(axis.max, 'target_fit_max');
  if (value < min || value > max) throw new Error('target_fit_outside_hard_bounds');
  if (value === target) return 1_000n;
  const distance = value < target ? target - value : value - target;
  const lowerSpan = target - min;
  const upperSpan = max - target;
  const span = lowerSpan > upperSpan ? lowerSpan : upperSpan;
  if (span === 0n) throw new Error('target_fit_zero_span');
  const penalty = (distance * 1_000n + span / 2n) / span;
  return penalty >= 1_000n ? 0n : 1_000n - penalty;
}

export async function calculateGoalTargetFitV1(value: unknown): Promise<GoalTargetFitResultV1> {
  const row = record(value, ['contract', 'goalTarget', 'expected', 'actualNutrition'], 'goal_target_fit_input');
  if (row.contract !== goalTargetFitInputContractV1) throw new Error('unsupported_goal_target_fit_input');
  const goalTarget = decodeGoalNutritionTargetV1(row.goalTarget);
  const expected = record(row.expected, ['goalRevision', 'targetPolicyRevision'], 'goal_target_fit_expected');
  const expectedGoalRevision = uuid(expected.goalRevision, 'expected_goal_revision');
  const expectedTargetPolicyRevision = uuid(expected.targetPolicyRevision, 'expected_target_policy_revision');
  if (goalTarget.goalRevision !== expectedGoalRevision) throw new Error('contradictory_goal_revision_binding');
  if (goalTarget.targetPolicyRevision !== expectedTargetPolicyRevision) {
    throw new Error('stale_target_policy_revision');
  }
  const actualNutrition = nutrition(row.actualNutrition, 'goal_target_fit_actual_nutrition');
  const withoutDigest = {
    contract: goalTargetFitResultContractV1,
    goalRevision: goalTarget.goalRevision,
    targetPolicyRevision: goalTarget.targetPolicyRevision,
    calories: { ...goalTarget.calories, actual: actualNutrition.calories },
    score: decimalFromMinor(calorieTargetFitMinor(goalTarget.calories, actualNutrition.calories)),
  } as const;
  return { ...withoutDigest, digest: await digest({ goalTarget, actualNutrition, result: withoutDigest }) };
}

function addNutrition(values: GraphNutritionV1[]): GraphNutritionV1 {
  return Object.fromEntries(nutritionKeys.map((key) => [key, decimalFromMinor(values.reduce(
    (sum, value) => sum + decimalMinor(value[key], `nutrition_${key}`), 0n,
  ))])) as unknown as GraphNutritionV1;
}

function withinBounds(value: GraphNutritionV1, bounds: NutritionBoundsV1): boolean {
  return nutritionKeys.every((key) => {
    const actual = decimalMinor(value[key], `actual_${key}`);
    return actual >= decimalMinor(bounds.minimum[key], `minimum_${key}`)
      && actual <= decimalMinor(bounds.maximum[key], `maximum_${key}`);
  });
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

async function digest(value: unknown): Promise<string> {
  const bytes = new TextEncoder().encode(canonicalJson(value));
  if (!globalThis.crypto?.subtle) throw new Error('sha256_unavailable');
  const hash = await globalThis.crypto.subtle.digest('SHA-256', bytes);
  return Array.from(new Uint8Array(hash), (byte) => byte.toString(16).padStart(2, '0')).join('');
}

function validDate(value: unknown, label: string): string {
  if (typeof value !== 'string' || !datePattern.test(value)) throw new Error(`invalid_${label}`);
  const parsed = new Date(`${value}T00:00:00.000Z`);
  if (Number.isNaN(parsed.getTime()) || parsed.toISOString().slice(0, 10) !== value) throw new Error(`invalid_${label}`);
  return value;
}

function addDays(value: string, days: number): string {
  const parsed = new Date(`${value}T00:00:00.000Z`);
  parsed.setUTCDate(parsed.getUTCDate() + days);
  return parsed.toISOString().slice(0, 10);
}

function canonicalTimezone(value: unknown): string {
  if (typeof value !== 'string' || value.length > 64 || !/^[A-Za-z_]+(?:\/[A-Za-z0-9_+.-]+)+$/.test(value)) {
    throw new Error('invalid_timezone');
  }
  try {
    const resolved = new Intl.DateTimeFormat('en-US', { timeZone: value }).resolvedOptions().timeZone;
    if (resolved !== value) throw new Error('noncanonical_timezone');
  } catch {
    throw new Error('invalid_timezone');
  }
  return value;
}

function reason(code: ValidatorReasonCodeV1, severity: ValidatorSeverityV1, path: string,
  evidenceRevision: string | null = null): ValidatorReasonV1 {
  return { code, severity, path, evidenceRevision };
}

function normalizeReasons(values: ValidatorReasonV1[]): ValidatorReasonV1[] {
  const rank: Record<ValidatorSeverityV1, number> = { BLOCKER: 0, ERROR: 1, WARNING: 2 };
  const keys = new Set<string>();
  return [...values].sort((left, right) => rank[left.severity] - rank[right.severity]
    || left.code.localeCompare(right.code) || left.path.localeCompare(right.path)
    || (left.evidenceRevision ?? '').localeCompare(right.evidenceRevision ?? '')).filter((item) => {
    const key = `${item.severity}|${item.code}|${item.path}|${item.evidenceRevision ?? ''}`;
    if (keys.has(key)) return false;
    keys.add(key);
    return true;
  });
}

async function result(scope: ValidatorScopeV1, policyRevision: string, subject: unknown,
  inputReasons: ValidatorReasonV1[]): Promise<ValidatorResultV1> {
  const reasons = normalizeReasons(inputReasons);
  const status: ValidatorStatusV1 = reasons.some((item) => item.severity === 'BLOCKER')
    ? 'BLOCKED_MISSING_EVIDENCE'
    : reasons.some((item) => item.severity === 'ERROR') ? 'INVALID'
      : reasons.length > 0 ? 'VALID_WITH_WARNINGS' : 'VALID';
  return {
    contract: validatorResultContractV1,
    status,
    scope,
    policyRevision,
    subjectDigest: await digest({ contract: mealBalanceContractV1, scope, policyRevision, subject, reasons }),
    reasons,
  };
}

export function decodeBalancePolicyV1(value: unknown): BalancePolicyV1 {
  const row = record(value, ['contract', 'policyRevision', 'maxComponents', 'exactRecipePerWeek',
    'exactRecipePerDay', 'repeatFamilyPerWeek', 'dominantIngredientFamilyPerWeek',
    'specialtyMealsPerWeek', 'expensiveMealsPerWeek', 'allowedWarningCodes'], 'balance_policy');
  if (row.contract !== balancePolicyContractV1) throw new Error('unsupported_balance_policy');
  const warnings = sortedEnums(row.allowedWarningCodes, allowedWarningCodes, 'allowed_warning_codes');
  if (row.maxComponents !== 5 || row.exactRecipePerWeek !== 2 || row.exactRecipePerDay !== 1
      || row.repeatFamilyPerWeek !== 3 || row.dominantIngredientFamilyPerWeek !== 4
      || row.specialtyMealsPerWeek !== 1 || row.expensiveMealsPerWeek !== 2) {
    throw new Error('unsupported_balance_policy_values');
  }
  return {
    contract: balancePolicyContractV1,
    policyRevision: uuid(row.policyRevision, 'balance_policy_revision'),
    maxComponents: 5,
    exactRecipePerWeek: 2,
    exactRecipePerDay: 1,
    repeatFamilyPerWeek: 3,
    dominantIngredientFamilyPerWeek: 4,
    specialtyMealsPerWeek: 1,
    expensiveMealsPerWeek: 2,
    allowedWarningCodes: warnings,
  };
}

export function decodeOptimizationPolicyV1(value: unknown): OptimizationPolicyV1 {
  const row = record(value, ['contract', 'policyRevision', 'weights'], 'optimization_policy');
  if (row.contract !== optimizationPolicyContractV1) throw new Error('unsupported_optimization_policy');
  const weights = record(row.weights, ['targetFit', 'diversity', 'convenience', 'shoppingReuse'],
    'optimization_weights');
  if (weights.targetFit !== '0.400' || weights.diversity !== '0.250'
      || weights.convenience !== '0.200' || weights.shoppingReuse !== '0.150') {
    throw new Error('unsupported_optimization_weights');
  }
  return {
    contract: optimizationPolicyContractV1,
    policyRevision: uuid(row.policyRevision, 'optimization_policy_revision'),
    weights: { targetFit: '0.400', diversity: '0.250', convenience: '0.200', shoppingReuse: '0.150' },
  };
}

function decodeCompositionPolicy(value: unknown): MealCompositionPolicyV1 {
  const row = record(value, ['policyRevision', 'maxComponents', 'patterns', 'nutritionWeights'], 'composition_policy');
  if (row.maxComponents !== 5) throw new Error('composition_policy_max_components_must_be_5');
  if (!Array.isArray(row.patterns) || row.patterns.length === 0) throw new Error('invalid_composition_patterns');
  const patterns = row.patterns.map((item, patternIndex) => {
    const pattern = record(item, ['patternId', 'allowedMealTypes', 'roles'], `composition_pattern_${patternIndex}`);
    if (typeof pattern.patternId !== 'string' || !tokenPattern.test(pattern.patternId)) throw new Error('invalid_pattern_id');
    if (!Array.isArray(pattern.allowedMealTypes) || pattern.allowedMealTypes.length === 0) {
      throw new Error('invalid_pattern_meal_types');
    }
    const allowed = pattern.allowedMealTypes.map((mealType) => enumValue(mealType, mealTypes, 'pattern_meal_type'));
    if (new Set(allowed).size !== allowed.length) throw new Error('duplicate_pattern_meal_type');
    if (allowed.some((mealType, index) => index > 0
      && mealTypes.indexOf(allowed[index - 1]) >= mealTypes.indexOf(mealType))) {
      throw new Error('noncanonical_pattern_meal_types');
    }
    if (!Array.isArray(pattern.roles) || pattern.roles.length === 0) throw new Error('invalid_pattern_roles');
    const patternRoles = pattern.roles.map((role) => enumValue(role, roles, 'pattern_role'));
    if (new Set(patternRoles).size !== patternRoles.length) throw new Error('duplicate_role_entries');
    if (patternRoles.length > 5) throw new Error('pattern_component_limit_exceeded');
    return { patternId: pattern.patternId, allowedMealTypes: allowed, roles: patternRoles };
  });
  if (new Set(patterns.map((item) => item.patternId)).size !== patterns.length) throw new Error('duplicate_pattern_id');
  const weights = record(row.nutritionWeights, nutritionKeys, 'composition_nutrition_weights');
  const nutritionWeights = Object.fromEntries(nutritionKeys.map((key) => [key,
    integer(weights[key], `composition_weight_${key}`)])) as Record<keyof GraphNutritionV1, number>;
  return {
    policyRevision: uuid(row.policyRevision, 'composition_policy_revision'),
    maxComponents: 5,
    patterns,
    nutritionWeights,
  };
}

const componentEvidenceKeysV1 = ['contract', 'mealComponentId', 'recipeRevision', 'publicationStatus',
    'publicationRevision', 'canonicalStatus', 'canonicalEvidenceRevision', 'nutritionStatus',
    'nutritionEvidenceRevision', 'allergenStatus', 'allergenEvidenceRevision', 'dietaryStatus',
    'dietaryEvidenceRevision', 'portionPolicyRevision', 'accessibility', 'allergens', 'dietaryTags',
    'ingredientFamilies', 'dominantIngredientFamily', 'repeatFamily', 'assignedServingsMinimum',
    'assignedServingsMaximum', 'proteinSource', 'produceSource'] as const;

function decodeEvidence(value: unknown): MealComponentEvidenceV1 {
  const row = record(value, componentEvidenceKeysV1, 'component_evidence');
  if (row.contract !== mealCandidateEvidenceContractV1) throw new Error('unsupported_component_evidence');
  const minimum = decimalFromMinor(decimalMinor(row.assignedServingsMinimum, 'assigned_servings_minimum'));
  const maximum = decimalFromMinor(decimalMinor(row.assignedServingsMaximum, 'assigned_servings_maximum'));
  if (decimalMinor(minimum, 'assigned_servings_minimum') <= 0n
      || decimalMinor(minimum, 'assigned_servings_minimum') > decimalMinor(maximum, 'assigned_servings_maximum')) {
    throw new Error('invalid_assigned_servings_range');
  }
  const optionalUuid = (item: unknown, label: string) => item === null ? null : uuid(item, label);
  const ingredientFamilies = sortedTokens(row.ingredientFamilies, 'ingredient_families', false);
  if (typeof row.dominantIngredientFamily !== 'string'
      || !ingredientFamilies.includes(row.dominantIngredientFamily)) throw new Error('invalid_dominant_ingredient_family');
  return {
    contract: mealCandidateEvidenceContractV1,
    mealComponentId: uuid(row.mealComponentId, 'evidence_component'),
    recipeRevision: uuid(row.recipeRevision, 'evidence_recipe_revision'),
    publicationStatus: enumValue(row.publicationStatus, ['PUBLISHED', 'MISSING'] as const, 'publication_status'),
    publicationRevision: optionalUuid(row.publicationRevision, 'publication_revision'),
    canonicalStatus: enumValue(row.canonicalStatus, ['READY', 'MISSING'] as const, 'canonical_status'),
    canonicalEvidenceRevision: optionalUuid(row.canonicalEvidenceRevision, 'canonical_evidence_revision'),
    nutritionStatus: enumValue(row.nutritionStatus, ['COMPLETE', 'MISSING'] as const, 'nutrition_status'),
    nutritionEvidenceRevision: optionalUuid(row.nutritionEvidenceRevision, 'nutrition_evidence_revision'),
    allergenStatus: enumValue(row.allergenStatus, ['REVIEWED', 'MISSING'] as const, 'allergen_status'),
    allergenEvidenceRevision: optionalUuid(row.allergenEvidenceRevision, 'allergen_evidence_revision'),
    dietaryStatus: enumValue(row.dietaryStatus, ['REVIEWED', 'MISSING'] as const, 'dietary_status'),
    dietaryEvidenceRevision: optionalUuid(row.dietaryEvidenceRevision, 'dietary_evidence_revision'),
    portionPolicyRevision: optionalUuid(row.portionPolicyRevision, 'portion_policy_revision'),
    accessibility: enumValue(row.accessibility, ['COMMON_RU_RETAIL', 'SEASONAL_BUT_COMMON',
      'SPECIALTY_PRODUCT_REQUIRED', 'EXPENSIVE_OPTIONAL', 'ACCESSIBILITY_BLOCKED'] as const, 'accessibility'),
    allergens: sortedTokens(row.allergens, 'allergens'),
    dietaryTags: sortedTokens(row.dietaryTags, 'dietary_tags'),
    ingredientFamilies,
    dominantIngredientFamily: row.dominantIngredientFamily,
    repeatFamily: typeof row.repeatFamily === 'string' && tokenPattern.test(row.repeatFamily)
      ? row.repeatFamily : (() => { throw new Error('invalid_repeat_family'); })(),
    assignedServingsMinimum: minimum,
    assignedServingsMaximum: maximum,
    proteinSource: bool(row.proteinSource, 'protein_source'),
    produceSource: bool(row.produceSource, 'produce_source'),
  };
}

function decodeUserConstraints(value: unknown): UserFoodConstraintsV1 {
  const row = record(value, ['revisionId', 'excludedAllergens', 'excludedIngredientFamilies',
    'requiredDietaryTags', 'forbiddenDietaryTags'], 'user_constraints');
  const requiredDietaryTags = sortedTokens(row.requiredDietaryTags, 'required_dietary_tags');
  const forbiddenDietaryTags = sortedTokens(row.forbiddenDietaryTags, 'forbidden_dietary_tags');
  if (requiredDietaryTags.some((tag) => forbiddenDietaryTags.includes(tag))) {
    throw new Error('contradictory_dietary_constraints');
  }
  return {
    revisionId: uuid(row.revisionId, 'user_constraints_revision'),
    excludedAllergens: sortedTokens(row.excludedAllergens, 'excluded_allergens'),
    excludedIngredientFamilies: sortedTokens(row.excludedIngredientFamilies, 'excluded_ingredient_families'),
    requiredDietaryTags,
    forbiddenDietaryTags,
  };
}

function warning(balancePolicy: BalancePolicyV1, code: ValidatorReasonCodeV1, path: string,
  evidenceRevision: string | null = null): ValidatorReasonV1[] {
  return balancePolicy.allowedWarningCodes.includes(code) ? [reason(code, 'WARNING', path, evidenceRevision)] : [];
}

function structuralReasonsFromRawMeal(value: unknown): ValidatorReasonV1[] {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return [];
  const components = (value as { components?: unknown }).components;
  if (!Array.isArray(components)) return [];
  const anchors = components.filter((component) => component && typeof component === 'object'
    && !Array.isArray(component)
    && (component as { eligibility?: { anchorKind?: unknown } }).eligibility?.anchorKind !== 'NONE');
  if (anchors.length === 0) return [reason('ANCHOR_MISSING', 'ERROR', 'meal.components')];
  if (anchors.length > 1) return [reason('MULTIPLE_ANCHORS', 'ERROR', 'meal.components')];
  return [reason('MISSING_REQUIRED_COMPANION', 'ERROR', 'meal.components')];
}

function decodeMealInput(value: unknown): Omit<MealValidationInputV1, 'meal'> & { meal: unknown } {
  const row = record(value, ['contract', 'sourceKind', 'meal', 'compositionPolicy', 'balancePolicy', 'expected',
    'userConstraints', 'componentEvidence', 'nutritionBounds', 'requirements', 'warningSignals'], 'meal_validation_input');
  if (row.contract !== mealValidatorInputContractV1) throw new Error('unsupported_meal_validation_input');
  const expected = record(row.expected, ['goalRevision', 'compositionPolicyRevision'], 'meal_expected');
  const requirements = record(row.requirements, ['proteinSourceRequired', 'produceRequired'], 'meal_requirements');
  const warningSignals = record(row.warningSignals, ['softTargetFitDeviation', 'longPreparationBurden',
    'shoppingListBurden', 'lowerConvenienceScore', 'repetitionApproachingLimit'], 'meal_warning_signals');
  if (!Array.isArray(row.componentEvidence)) throw new Error('invalid_component_evidence');
  const componentEvidence = row.componentEvidence.map(decodeEvidence);
  if (new Set(componentEvidence.map((item) => item.mealComponentId)).size !== componentEvidence.length) {
    throw new Error('duplicate_component_evidence_identity');
  }
  return {
    contract: mealValidatorInputContractV1,
    sourceKind: enumValue(row.sourceKind, ['COMPLETE_RECIPE', 'COMPOSED_MEAL'] as const, 'source_kind'),
    meal: row.meal,
    compositionPolicy: decodeCompositionPolicy(row.compositionPolicy),
    balancePolicy: decodeBalancePolicyV1(row.balancePolicy),
    expected: {
      goalRevision: uuid(expected.goalRevision, 'expected_goal_revision'),
      compositionPolicyRevision: uuid(expected.compositionPolicyRevision, 'expected_composition_policy_revision'),
    },
    userConstraints: decodeUserConstraints(row.userConstraints),
    componentEvidence,
    nutritionBounds: nutritionBounds(row.nutritionBounds, 'meal_nutrition_bounds'),
    requirements: {
      proteinSourceRequired: bool(requirements.proteinSourceRequired, 'protein_source_required'),
      produceRequired: bool(requirements.produceRequired, 'produce_required'),
    },
    warningSignals: {
      softTargetFitDeviation: bool(warningSignals.softTargetFitDeviation, 'soft_target_fit_deviation'),
      longPreparationBurden: bool(warningSignals.longPreparationBurden, 'long_preparation_burden'),
      shoppingListBurden: bool(warningSignals.shoppingListBurden, 'shopping_list_burden'),
      lowerConvenienceScore: bool(warningSignals.lowerConvenienceScore, 'lower_convenience_score'),
      repetitionApproachingLimit: bool(warningSignals.repetitionApproachingLimit,
        'repetition_approaching_limit'),
    },
  };
}

export async function validateMealSnapshotV1(value: unknown): Promise<ValidatorResultV1> {
  const input = decodeMealInput(value);
  const reasons: ValidatorReasonV1[] = [];
  let meal: MealSnapshotV1;
  try {
    meal = await decodeMealSnapshotV1(input.meal);
  } catch (error) {
    const message = error instanceof Error ? error.message : 'invalid_meal_snapshot';
    if (message.includes('fields') || message.startsWith('invalid_') || message.startsWith('unsupported_')) throw error;
    if (message.includes('discrete_increment')) reasons.push(reason('DISCRETE_FRACTION_REQUIRED', 'ERROR', 'meal'));
    else if (message.includes('nutrition')) reasons.push(reason('NUTRITION_SUM_MISMATCH', 'ERROR', 'meal'));
    else if (message.includes('digest')) reasons.push(reason('DIGEST_MISMATCH', 'BLOCKER', 'meal.digest'));
    else reasons.push(...structuralReasonsFromRawMeal(input.meal));
    return result('MEAL', input.balancePolicy.policyRevision, input, reasons);
  }

  if (meal.components.length > input.balancePolicy.maxComponents) {
    reasons.push(reason('COMPONENT_LIMIT_EXCEEDED', 'ERROR', 'meal.components'));
  }
  const mealRoles = meal.components.map((component) => component.eligibility.role);
  if (new Set(mealRoles).size !== mealRoles.length) reasons.push(reason('DUPLICATE_ROLE', 'ERROR', 'meal.components'));
  if (new Set(meal.components.map((component) => component.recipeRevision)).size !== meal.components.length) {
    reasons.push(reason('DUPLICATE_RECIPE', 'ERROR', 'meal.components'));
  }
  const matchingPattern = input.compositionPolicy.patterns.find((pattern) =>
    pattern.allowedMealTypes.includes(meal.mealType)
      && JSON.stringify(pattern.roles) === JSON.stringify(mealRoles));
  if (!matchingPattern) reasons.push(reason('ROLE_PATTERN_NOT_ALLOWED', 'ERROR', 'meal.components'));
  if (input.compositionPolicy.policyRevision !== input.expected.compositionPolicyRevision
      || meal.compositionPolicyRevision !== input.expected.compositionPolicyRevision) {
    reasons.push(reason('STALE_POLICY_REVISION', 'BLOCKER', 'compositionPolicyRevision'));
  }
  if (meal.goalRevision !== input.expected.goalRevision) {
    reasons.push(reason('GOAL_REVISION_MISMATCH', 'BLOCKER', 'meal.goalRevision'));
  }
  if (input.sourceKind === 'COMPLETE_RECIPE'
      && (meal.components.length !== 1 || meal.components[0].eligibility.anchorKind !== 'COMPLETE')) {
    reasons.push(reason('ROLE_CONFLICT', 'ERROR', 'sourceKind'));
  }
  if (!withinBounds(meal.nutrition, input.nutritionBounds)) {
    reasons.push(reason('MEAL_TARGET_MISMATCH', 'ERROR', 'meal.nutrition'));
  }

  const evidenceByComponent = new Map(input.componentEvidence.map((item) => [item.mealComponentId, item]));
  if (evidenceByComponent.size !== meal.components.length
      || meal.components.some((component) => !evidenceByComponent.has(component.mealComponentId))) {
    reasons.push(reason('PUBLICATION_NOT_APPROVED', 'BLOCKER', 'componentEvidence'));
  }
  if (JSON.stringify(input.componentEvidence.map((item) => item.mealComponentId))
      !== JSON.stringify(meal.components.map((component) => component.mealComponentId))) {
    throw new Error('noncanonical_component_evidence_order');
  }
  const alignedEvidence: MealComponentEvidenceV1[] = [];
  for (const component of meal.components) {
    const evidence = evidenceByComponent.get(component.mealComponentId);
    if (!evidence) continue;
    alignedEvidence.push(evidence);
    const path = `componentEvidence.${component.mealComponentId}`;
    if (evidence.recipeRevision !== component.recipeRevision) {
      reasons.push(reason('STALE_POLICY_REVISION', 'BLOCKER', `${path}.recipeRevision`));
    }
    if (evidence.repeatFamily !== component.eligibility.repeatFamily) {
      reasons.push(reason('REPEAT_EVIDENCE_MISSING', 'BLOCKER', `${path}.repeatFamily`));
    }
    if (evidence.publicationStatus !== 'PUBLISHED' || evidence.publicationRevision === null) {
      reasons.push(reason('PUBLICATION_NOT_APPROVED', 'BLOCKER', path));
    }
    if (evidence.canonicalStatus !== 'READY' || evidence.canonicalEvidenceRevision === null) {
      reasons.push(reason('CANONICAL_EVIDENCE_MISSING', 'BLOCKER', path));
    }
    if (evidence.nutritionStatus !== 'COMPLETE' || evidence.nutritionEvidenceRevision === null) {
      reasons.push(reason('NUTRITION_EVIDENCE_MISSING', 'BLOCKER', path));
    }
    if (evidence.allergenStatus !== 'REVIEWED' || evidence.allergenEvidenceRevision === null) {
      reasons.push(reason('ALLERGEN_EVIDENCE_MISSING', 'BLOCKER', path));
    }
    if (evidence.dietaryStatus !== 'REVIEWED' || evidence.dietaryEvidenceRevision === null) {
      reasons.push(reason('DIETARY_EVIDENCE_MISSING', 'BLOCKER', path));
    }
    if (evidence.portionPolicyRevision === null) reasons.push(reason('PORTION_POLICY_MISSING', 'BLOCKER', path));
    if (evidence.accessibility === 'ACCESSIBILITY_BLOCKED') {
      reasons.push(reason('ACCESSIBILITY_BLOCKED', 'ERROR', path));
    }
    if (evidence.allergens.some((allergen) => input.userConstraints.excludedAllergens.includes(allergen))) {
      reasons.push(reason('ALLERGEN_CONFLICT', 'ERROR', path, evidence.allergenEvidenceRevision));
    }
    if (evidence.ingredientFamilies.some((family) => input.userConstraints.excludedIngredientFamilies.includes(family))) {
      reasons.push(reason('USER_EXCLUSION_CONFLICT', 'ERROR', path));
    }
    if (input.userConstraints.requiredDietaryTags.some((tag) => !evidence.dietaryTags.includes(tag))
        || input.userConstraints.forbiddenDietaryTags.some((tag) => evidence.dietaryTags.includes(tag))) {
      reasons.push(reason('DIETARY_PATTERN_CONFLICT', 'ERROR', path, evidence.dietaryEvidenceRevision));
    }
    const assigned = decimalMinor(component.assignedPortion.assignedServings, `${path}_assigned_servings`);
    if (assigned < decimalMinor(evidence.assignedServingsMinimum, `${path}_minimum`)
        || assigned > decimalMinor(evidence.assignedServingsMaximum, `${path}_maximum`)) {
      reasons.push(reason('PORTION_OUTSIDE_REVIEWED_RANGE', 'ERROR', path, evidence.portionPolicyRevision));
    }
    if (evidence.accessibility === 'SPECIALTY_PRODUCT_REQUIRED') {
      reasons.push(...warning(input.balancePolicy, 'OPTIONAL_SPECIALTY_USED', path, evidence.publicationRevision));
    }
    if (evidence.accessibility === 'EXPENSIVE_OPTIONAL') {
      reasons.push(...warning(input.balancePolicy, 'OPTIONAL_EXPENSIVE_USED', path, evidence.publicationRevision));
    }
  }
  if (input.requirements.proteinSourceRequired && !alignedEvidence.some((item) => item.proteinSource)) {
    reasons.push(reason('REQUIRED_PROTEIN_SOURCE_MISSING', 'ERROR', 'requirements.proteinSourceRequired'));
  }
  if (input.requirements.produceRequired && !alignedEvidence.some((item) => item.produceSource)) {
    reasons.push(reason('REQUIRED_PRODUCE_MISSING', 'ERROR', 'requirements.produceRequired'));
  }
  const warningSignals: Array<[boolean, ValidatorReasonCodeV1, string]> = [
    [input.warningSignals.softTargetFitDeviation, 'SOFT_TARGET_FIT_DEVIATION', 'warningSignals.softTargetFitDeviation'],
    [input.warningSignals.longPreparationBurden, 'LONG_PREPARATION_BURDEN', 'warningSignals.longPreparationBurden'],
    [input.warningSignals.shoppingListBurden, 'SHOPPING_LIST_BURDEN', 'warningSignals.shoppingListBurden'],
    [input.warningSignals.lowerConvenienceScore, 'LOWER_CONVENIENCE_SCORE', 'warningSignals.lowerConvenienceScore'],
    [input.warningSignals.repetitionApproachingLimit, 'REPETITION_LIMIT_APPROACHING',
      'warningSignals.repetitionApproachingLimit'],
  ];
  for (const [enabled, code, path] of warningSignals) if (enabled) reasons.push(...warning(input.balancePolicy, code, path));
  return result('MEAL', input.balancePolicy.policyRevision, { ...input, meal }, reasons);
}

function decodeSlot(value: unknown, label: string): DaySlotV1 {
  const row = record(value, ['sortOrder', 'slotId', 'mealType'], label);
  return {
    sortOrder: integer(row.sortOrder, `${label}_sort_order`),
    slotId: uuid(row.slotId, `${label}_slot`),
    mealType: enumValue(row.mealType, mealTypes, `${label}_meal_type`),
  };
}

function validateSlotOrder(values: DaySlotV1[], label: string): void {
  if (values.some((item, index) => item.sortOrder !== index)) throw new Error(`noncanonical_${label}_order`);
  if (new Set(values.map((item) => item.slotId)).size !== values.length) throw new Error(`duplicate_${label}_slot`);
}

function decodeDayInput(value: unknown, timezoneDecoder = canonicalTimezone): DayValidationInputV1 {
  const row = record(value, ['contract', 'date', 'timezone', 'goalRevision', 'targetPolicyRevision', 'planRevision',
    'compositionPolicyRevision', 'balancePolicy', 'requiredSlots', 'meals', 'goalTarget',
    'distributionBounds'], 'day_validation_input');
  if (row.contract !== dayValidatorInputContractV1) throw new Error('unsupported_day_validation_input');
  if (!Array.isArray(row.requiredSlots) || !Array.isArray(row.meals)) throw new Error('invalid_day_slots');
  const requiredSlots = row.requiredSlots.map((item, index) => decodeSlot(item, `required_slot_${index}`));
  validateSlotOrder(requiredSlots, 'required_slots');
  const meals = row.meals.map((item, index) => {
    const meal = record(item, ['sortOrder', 'slotId', 'mealType', 'date', 'validationInput'], `day_meal_${index}`);
    return {
      ...decodeSlot({ sortOrder: meal.sortOrder, slotId: meal.slotId, mealType: meal.mealType }, `day_meal_${index}`),
      date: validDate(meal.date, `day_meal_${index}_date`),
      validationInput: meal.validationInput as MealValidationInputV1,
    };
  });
  validateSlotOrder(meals, 'day_meals');
  let distributionBoundsValue: DayValidationInputV1['distributionBounds'] = null;
  if (row.distributionBounds !== null) {
    if (!Array.isArray(row.distributionBounds)) throw new Error('invalid_distribution_bounds');
    distributionBoundsValue = row.distributionBounds.map((item, index) => {
      const entry = record(item, ['sortOrder', 'slotId', 'bounds'], `distribution_bound_${index}`);
      return {
        sortOrder: integer(entry.sortOrder, `distribution_bound_${index}_sort_order`),
        slotId: uuid(entry.slotId, `distribution_bound_${index}_slot`),
        bounds: nutritionBounds(entry.bounds, `distribution_bound_${index}_bounds`),
      };
    });
    if (distributionBoundsValue.some((item, index) => item.sortOrder !== index)
        || new Set(distributionBoundsValue.map((item) => item.slotId)).size !== distributionBoundsValue.length) {
      throw new Error('noncanonical_distribution_bounds');
    }
  }
  return {
    contract: dayValidatorInputContractV1,
    date: validDate(row.date, 'day_date'),
    timezone: timezoneDecoder(row.timezone),
    goalRevision: uuid(row.goalRevision, 'day_goal_revision'),
    targetPolicyRevision: uuid(row.targetPolicyRevision, 'day_target_policy_revision'),
    planRevision: uuid(row.planRevision, 'day_plan_revision'),
    compositionPolicyRevision: uuid(row.compositionPolicyRevision, 'day_composition_policy_revision'),
    balancePolicy: decodeBalancePolicyV1(row.balancePolicy),
    requiredSlots,
    meals,
    goalTarget: row.goalTarget === null ? null : decodeGoalNutritionTargetV1(row.goalTarget),
    distributionBounds: distributionBoundsValue,
  };
}

export async function validateDaySnapshotV1(value: unknown): Promise<ValidatorResultV1> {
  return validateDayOwned(decodeDayInput(value));
}

async function validateDayOwned(input: DayValidationInputV1): Promise<ValidatorResultV1> {
  const reasons: ValidatorReasonV1[] = [];
  const required = new Map(input.requiredSlots.map((slot) => [slot.slotId, slot]));
  const actual = new Map(input.meals.map((meal) => [meal.slotId, meal]));
  let failedChild = false;
  for (const slot of input.requiredSlots) if (!actual.has(slot.slotId)) {
    reasons.push(reason('REQUIRED_SLOT_MISSING', 'ERROR', `requiredSlots.${slot.slotId}`));
  }
  for (const meal of input.meals) {
    const expected = required.get(meal.slotId);
    if (!expected) reasons.push(reason('UNEXPECTED_SLOT', 'ERROR', `meals.${meal.slotId}`));
    else if (expected.mealType !== meal.mealType) reasons.push(reason('MEAL_TYPE_NOT_ALLOWED', 'ERROR', `meals.${meal.slotId}`));
    if (meal.date !== input.date) reasons.push(reason('DAY_DATE_MISMATCH', 'ERROR', `meals.${meal.slotId}.date`));
    const mealInput = meal.validationInput;
    if (mealInput.expected.goalRevision !== input.goalRevision) {
      reasons.push(reason('GOAL_REVISION_MISMATCH', 'BLOCKER', `meals.${meal.slotId}`));
    }
    if (mealInput.expected.compositionPolicyRevision !== input.compositionPolicyRevision) {
      reasons.push(reason('STALE_POLICY_REVISION', 'BLOCKER', `meals.${meal.slotId}`));
    }
    const mealResult = await validateMealSnapshotV1(mealInput);
    failedChild ||= mealResult.status === 'INVALID' || mealResult.status === 'BLOCKED_MISSING_EVIDENCE';
    for (const child of mealResult.reasons) reasons.push({ ...child, path: `meals.${meal.slotId}.${child.path}` });
  }
  // Invalid child content is not authoritative nutrition or repeat evidence.
  // Preserve its structured reasons before attempting aggregate computations.
  if (failedChild) return result('DAY', input.balancePolicy.policyRevision, input, reasons);
  const decodedMeals = await Promise.all(input.meals.map((meal) => decodeMealSnapshotV1(meal.validationInput.meal)));
  const dayNutrition = addNutrition(decodedMeals.map((meal) => meal.nutrition));
  if (input.goalTarget === null) reasons.push(reason('GOAL_EVIDENCE_MISSING', 'BLOCKER', 'goalTarget'));
  else {
    if (input.goalTarget.goalRevision !== input.goalRevision) {
      reasons.push(reason('GOAL_REVISION_MISMATCH', 'BLOCKER', 'goalTarget.goalRevision'));
    }
    if (input.goalTarget.targetPolicyRevision !== input.targetPolicyRevision) {
      reasons.push(reason('STALE_POLICY_REVISION', 'BLOCKER', 'goalTarget.targetPolicyRevision'));
    }
    const suppliedAxes: Array<[keyof GraphNutritionV1, NutritionTargetAxisV1 | null]> = [
      ['calories', input.goalTarget.calories], ['protein', input.goalTarget.protein],
      ['fat', input.goalTarget.fat], ['carbs', input.goalTarget.carbs], ['fiber', input.goalTarget.fiber],
    ];
    if (suppliedAxes.some(([key, axis]) => axis !== null && !axisContains(axis, dayNutrition[key], `day_${key}`))) {
      reasons.push(reason('DAY_TARGET_MISMATCH', 'ERROR', 'nutrition'));
    }
  }
  if (input.distributionBounds === null) {
    reasons.push(reason('DAY_DISTRIBUTION_EVIDENCE_MISSING', 'BLOCKER', 'distributionBounds'));
  } else {
    const boundsBySlot = new Map(input.distributionBounds.map((entry) => [entry.slotId, entry.bounds]));
    for (let index = 0; index < input.meals.length; index += 1) {
      const bounds = boundsBySlot.get(input.meals[index].slotId);
      if (!bounds || !withinBounds(decodedMeals[index].nutrition, bounds)) {
        reasons.push(reason('MEAL_DISTRIBUTION_MISMATCH', 'ERROR', `meals.${input.meals[index].slotId}.nutrition`));
      }
    }
  }
  const recipeCounts = new Map<string, number>();
  for (const meal of decodedMeals) for (const component of meal.components) {
    recipeCounts.set(component.recipeRevision, (recipeCounts.get(component.recipeRevision) ?? 0) + 1);
  }
  if ([...recipeCounts.values()].some((count) => count > input.balancePolicy.exactRecipePerDay)) {
    reasons.push(reason('DAY_RECIPE_REPEAT_EXCEEDED', 'ERROR', 'meals'));
  }
  return result('DAY', input.balancePolicy.policyRevision, { ...input, nutrition: dayNutrition }, reasons);
}

function decodeFallbackProof(value: unknown): OrdinaryFallbackProofV1 {
  const row = record(value, ['candidatePoolDigest', 'status', 'ordinaryWeekDigest'], 'ordinary_fallback_proof');
  if (typeof row.candidatePoolDigest !== 'string' || !digestPattern.test(row.candidatePoolDigest)) {
    throw new Error('invalid_candidate_pool_digest');
  }
  const status = enumValue(row.status,
    ['VALID', 'UNAVAILABLE_SPECIALTY', 'UNAVAILABLE_EXPENSIVE', 'UNAVAILABLE_BOTH'] as const,
    'ordinary_fallback_status');
  if (status === 'VALID') {
    if (typeof row.ordinaryWeekDigest !== 'string' || !digestPattern.test(row.ordinaryWeekDigest)) {
      throw new Error('invalid_ordinary_week_digest');
    }
  } else if (row.ordinaryWeekDigest !== null) throw new Error('unexpected_ordinary_week_digest');
  return { candidatePoolDigest: row.candidatePoolDigest, status, ordinaryWeekDigest: row.ordinaryWeekDigest as string | null };
}

function decodeWeekInput(value: unknown, timezoneDecoder = canonicalTimezone): WeekValidationInputV1 {
  const row = record(value, ['contract', 'weekAnchor', 'timezone', 'goalRevision', 'targetPolicyRevision', 'planRevision',
    'compositionPolicyRevision', 'balancePolicy', 'days', 'ordinaryFallbackProof'], 'week_validation_input');
  if (row.contract !== weekValidatorInputContractV1) throw new Error('unsupported_week_validation_input');
  if (!Array.isArray(row.days)) throw new Error('invalid_week_days');
  return {
    contract: weekValidatorInputContractV1,
    weekAnchor: validDate(row.weekAnchor, 'week_anchor'),
    timezone: timezoneDecoder(row.timezone),
    goalRevision: uuid(row.goalRevision, 'week_goal_revision'),
    targetPolicyRevision: uuid(row.targetPolicyRevision, 'week_target_policy_revision'),
    planRevision: uuid(row.planRevision, 'week_plan_revision'),
    compositionPolicyRevision: uuid(row.compositionPolicyRevision, 'week_composition_policy_revision'),
    balancePolicy: decodeBalancePolicyV1(row.balancePolicy),
    days: row.days.map((day) => decodeDayInput(day, timezoneDecoder)),
    ordinaryFallbackProof: decodeFallbackProof(row.ordinaryFallbackProof),
  };
}

export async function validateWeekSnapshotV1(value: unknown): Promise<ValidatorResultV1> {
  return validateWeekOwned(decodeWeekInput(value));
}

// V1 keeps its legacy enum-based behavior. V2 passes manifest-bound independent axes.
async function validateWeekOwned(input: WeekValidationInputV1,
  axes?: ReadonlyMap<string, Pick<MealComponentEvidenceV2, 'specialty' | 'expensive'>>,
  versionedSubject?: unknown): Promise<ValidatorResultV1> {
  const reasons: ValidatorReasonV1[] = [];
  let failedChild = false;
  const monday = new Date(`${input.weekAnchor}T00:00:00.000Z`).getUTCDay() === 1;
  if (!monday || input.days.length !== 7
      || input.days.some((day, index) => day.date !== addDays(input.weekAnchor, index))) {
    reasons.push(reason('WEEK_DATE_SEQUENCE_INVALID', 'ERROR', 'days'));
  }
  for (const day of input.days) {
    if (day.timezone !== input.timezone) reasons.push(reason('TIMEZONE_MISMATCH', 'BLOCKER', `days.${day.date}.timezone`));
    if (day.goalRevision !== input.goalRevision) reasons.push(reason('GOAL_REVISION_MISMATCH', 'BLOCKER', `days.${day.date}`));
    if (day.targetPolicyRevision !== input.targetPolicyRevision) {
      reasons.push(reason('WEEK_POLICY_MISMATCH', 'BLOCKER', `days.${day.date}.targetPolicyRevision`));
    }
    if (day.planRevision !== input.planRevision) reasons.push(reason('PLAN_REVISION_MISMATCH', 'BLOCKER', `days.${day.date}`));
    if (day.compositionPolicyRevision !== input.compositionPolicyRevision
        || day.balancePolicy.policyRevision !== input.balancePolicy.policyRevision) {
      reasons.push(reason('WEEK_POLICY_MISMATCH', 'BLOCKER', `days.${day.date}`));
    }
    const dayResult = axes ? await validateDayOwned(day) : await validateDaySnapshotV1(day);
    failedChild ||= dayResult.status === 'INVALID' || dayResult.status === 'BLOCKED_MISSING_EVIDENCE';
    for (const child of dayResult.reasons) reasons.push({ ...child, path: `days.${day.date}.${child.path}` });
  }

  if (failedChild) return result('WEEK', input.balancePolicy.policyRevision, versionedSubject ?? input, reasons);

  const recipeCounts = new Map<string, number>();
  const familyCounts = new Map<string, number>();
  const ingredientCounts = new Map<string, number>();
  let specialtyMeals = 0;
  let expensiveMeals = 0;
  for (const day of input.days) for (const dayMeal of day.meals) {
    const meal = await decodeMealSnapshotV1(dayMeal.validationInput.meal);
    const evidence = new Map(dayMeal.validationInput.componentEvidence.map((item) => [item.mealComponentId, item]));
    let specialty = false;
    let expensive = false;
    for (const component of meal.components) {
      recipeCounts.set(component.recipeRevision, (recipeCounts.get(component.recipeRevision) ?? 0) + 1);
      const item = evidence.get(component.mealComponentId);
      if (!item) continue;
      familyCounts.set(item.repeatFamily, (familyCounts.get(item.repeatFamily) ?? 0) + 1);
      ingredientCounts.set(item.dominantIngredientFamily,
        (ingredientCounts.get(item.dominantIngredientFamily) ?? 0) + 1);
      if (axes) {
        const classification = axes.get(`${meal.mealSlotId}:${component.mealComponentId}`);
        if (!classification) throw new Error('missing_bound_component_axes');
        specialty ||= classification.specialty;
        expensive ||= classification.expensive;
      } else {
        specialty ||= item.accessibility === 'SPECIALTY_PRODUCT_REQUIRED';
        expensive ||= item.accessibility === 'EXPENSIVE_OPTIONAL';
      }
    }
    if (specialty) specialtyMeals += 1;
    if (expensive) expensiveMeals += 1;
  }
  if ([...recipeCounts.values()].some((count) => count > input.balancePolicy.exactRecipePerWeek)) {
    reasons.push(reason('WEEK_RECIPE_REPEAT_EXCEEDED', 'ERROR', 'days.meals'));
  }
  if ([...familyCounts.values()].some((count) => count > input.balancePolicy.repeatFamilyPerWeek)) {
    reasons.push(reason('WEEK_REPEAT_FAMILY_EXCEEDED', 'ERROR', 'days.meals'));
  }
  if ([...ingredientCounts.values()].some((count) => count > input.balancePolicy.dominantIngredientFamilyPerWeek)) {
    reasons.push(reason('WEEK_INGREDIENT_REPEAT_EXCEEDED', 'ERROR', 'days.meals'));
  }
  if (specialtyMeals > input.balancePolicy.specialtyMealsPerWeek) {
    reasons.push(reason('SPECIALTY_LIMIT_EXCEEDED', 'ERROR', 'days.meals'));
  }
  if (expensiveMeals > input.balancePolicy.expensiveMealsPerWeek) {
    reasons.push(reason('EXPENSIVE_LIMIT_EXCEEDED', 'ERROR', 'days.meals'));
  }
  if (input.ordinaryFallbackProof.status === 'UNAVAILABLE_SPECIALTY'
      || input.ordinaryFallbackProof.status === 'UNAVAILABLE_BOTH') {
    reasons.push(reason('SPECIALTY_DEPENDENCY_REQUIRED', 'ERROR', 'ordinaryFallbackProof'));
  }
  if (input.ordinaryFallbackProof.status === 'UNAVAILABLE_EXPENSIVE'
      || input.ordinaryFallbackProof.status === 'UNAVAILABLE_BOTH') {
    reasons.push(reason('EXPENSIVE_DEPENDENCY_REQUIRED', 'ERROR', 'ordinaryFallbackProof'));
  }
  return result('WEEK', input.balancePolicy.policyRevision, versionedSubject ?? input, reasons);
}

// RawV2 uses the already reviewed Graph V2 canonical timezone domain, including UTC.
// V1's slash-only timezone admission remains unchanged.
function canonicalTimezoneV2(value: unknown): string {
  if (typeof value !== 'string' || value.trim() !== value || value.length === 0 || value.length > 64) {
    throw new Error('invalid_timezone');
  }
  try {
    if (new Intl.DateTimeFormat('en-US', { timeZone: value }).resolvedOptions().timeZone !== value) {
      throw new Error('invalid_timezone');
    }
  } catch { throw new Error('invalid_timezone'); }
  return value;
}

function parseAxesRaw(raw: string): unknown {
  if (typeof raw !== 'string') throw new Error('accessibility_axes_raw_string_required');
  assertRawJsonWithoutDuplicateKeysV1(raw);
  return JSON.parse(raw) as unknown;
}

function freezeOwned<T>(value: T): T {
  if (value !== null && typeof value === 'object') {
    for (const child of Object.values(value)) freezeOwned(child);
    Object.freeze(value);
  }
  return value;
}

function legacyEvidence(evidence: MealComponentEvidenceV2): MealComponentEvidenceV1 {
  return Object.fromEntries(componentEvidenceKeysV1.map((key) => [key,
    key === 'contract' ? mealCandidateEvidenceContractV1 : evidence[key]])) as unknown as MealComponentEvidenceV1;
}

function decodeEvidenceV2Owned(value: unknown, manifest: AdaptiveNutritionCandidateManifestV2,
  meal: MealSnapshotV1): MealComponentEvidenceV2 {
  const row = record(value, [...componentEvidenceKeysV1, 'recipeId', 'portionRevision', 'eligibilityRevision',
    'manifestRevision', 'manifestDigest', 'specialty', 'expensive'], 'component_evidence_v2');
  if (row.contract !== mealCandidateEvidenceContractV2) throw new Error('unsupported_component_evidence_v2');
  const base = decodeEvidence(Object.fromEntries(componentEvidenceKeysV1.map((key) => [key,
    key === 'contract' ? mealCandidateEvidenceContractV1 : row[key]])));
  const recipeId = uuid(row.recipeId, 'axes_recipe');
  const portionRevision = uuid(row.portionRevision, 'axes_portion');
  const eligibilityRevision = uuid(row.eligibilityRevision, 'axes_eligibility');
  const specialty = bool(row.specialty, 'axes_specialty');
  const expensive = bool(row.expensive, 'axes_expensive');
  if (row.manifestRevision !== manifest.manifestRevision || row.manifestDigest !== manifest.digest) {
    throw new Error('component_axes_manifest_binding_mismatch');
  }
  const candidate = manifest.entries.find((entry) => entry.recipeId === recipeId
    && entry.recipeRevisionId === base.recipeRevision && entry.portionRevisionId === portionRevision
    && entry.eligibilityRevisionId === eligibilityRevision);
  const component = meal.components.find((entry) => entry.mealComponentId === base.mealComponentId);
  if (!candidate || !component || component.recipe.recipeId !== recipeId
      || component.recipeRevision !== base.recipeRevision || component.portionRevision !== portionRevision
      || component.eligibility.eligibilityRevisionId !== eligibilityRevision
      || !candidate.allowedMealTypes.includes(meal.mealType)
      || canonicalJson(component.recipe) !== canonicalJson(candidate.recipeSnapshot)) {
    throw new Error('component_axes_candidate_binding_mismatch');
  }
  for (const key of ['role', 'anchorKind', 'allowedMealTypes', 'requiredCompanionRoleSets', 'pairingTags',
    'incompatiblePairingTags', 'repeatFamily', 'energyClass', 'beverageClass'] as const) {
    if (canonicalJson(component.eligibility[key]) !== canonicalJson(candidate[key])) {
      throw new Error('component_axes_eligibility_binding_mismatch');
    }
  }
  const bindings = {
    publicationStatus: candidate.publicationStatus, publicationRevision: candidate.publicationRevision,
    canonicalEvidenceRevision: candidate.canonicalEvidenceRevision,
    nutritionEvidenceRevision: candidate.nutritionEvidenceRevision,
    allergenEvidenceRevision: candidate.allergenEvidenceRevision,
    dietaryEvidenceRevision: candidate.dietaryEvidenceRevision,
    accessibility: candidate.accessibility, allergens: candidate.allergenCodes, dietaryTags: candidate.dietaryCodes,
    dominantIngredientFamily: candidate.dominantIngredientFamily, repeatFamily: candidate.repeatFamily,
    assignedServingsMinimum: candidate.portionRules.assignedServingsMinimum,
    assignedServingsMaximum: candidate.portionRules.assignedServingsMaximum,
  };
  for (const key of Object.keys(bindings) as Array<keyof typeof bindings>) {
    if (canonicalJson(base[key]) !== canonicalJson(bindings[key])) throw new Error('component_axes_metadata_mismatch');
  }
  if (specialty !== candidate.specialty || expensive !== candidate.expensive) {
    throw new Error('component_axes_classification_mismatch');
  }
  return freezeOwned({ ...base, contract: mealCandidateEvidenceContractV2, recipeId, portionRevision,
    eligibilityRevision, manifestRevision: manifest.manifestRevision, manifestDigest: manifest.digest, specialty, expensive });
}

/** Raw-only boundary. The manifest must come from an independently trusted caller/source. */
export async function decodeMealComponentEvidenceRawV2(evidenceRaw: string, pinnedManifestRaw: string,
  mealSnapshotRaw: string): Promise<Readonly<MealComponentEvidenceV2>> {
  // Check every public argument before parsing or touching any object/Proxy.
  if ([evidenceRaw, pinnedManifestRaw, mealSnapshotRaw].some((raw) => typeof raw !== 'string')) {
    throw new Error('accessibility_axes_raw_string_required');
  }
  const evidence = parseAxesRaw(evidenceRaw);
  const manifestValue = parseAxesRaw(pinnedManifestRaw);
  const mealValue = parseAxesRaw(mealSnapshotRaw);
  const { decodeAdaptiveNutritionCandidateManifestV2 } = await import('./adaptiveNutritionAuthoritiesV1');
  const manifest = await decodeAdaptiveNutritionCandidateManifestV2(manifestValue);
  return decodeEvidenceV2Owned(evidence, manifest, await decodeMealSnapshotV1(mealValue));
}

/** V2 weekly counters use only independent manifest-bound boolean axes, never the enum. */
export async function validateWeekSnapshotRawV2(weekRaw: string, pinnedManifestRaw: string): Promise<ValidatorResultV1> {
  if (typeof weekRaw !== 'string' || typeof pinnedManifestRaw !== 'string') {
    throw new Error('accessibility_axes_raw_string_required');
  }
  const weekValue = parseAxesRaw(weekRaw);
  const manifestValue = parseAxesRaw(pinnedManifestRaw);
  const { decodeAdaptiveNutritionCandidateManifestV2 } = await import('./adaptiveNutritionAuthoritiesV1');
  const manifest = await decodeAdaptiveNutritionCandidateManifestV2(manifestValue);
  const row = record(weekValue, ['contract', 'weekAnchor', 'timezone', 'goalRevision', 'targetPolicyRevision', 'planRevision',
    'compositionPolicyRevision', 'balancePolicy', 'days', 'ordinaryFallbackProof'], 'week_validation_input_v2');
  if (row.contract !== weekValidatorInputContractV2 || !Array.isArray(row.days)) {
    throw new Error('unsupported_week_validation_input_v2');
  }
  const axes = new Map<string, MealComponentEvidenceV2>();
  const slots = new Set<string>();
  const days = [];
  for (const value of row.days) {
    const day = record(value, ['contract', 'date', 'timezone', 'goalRevision', 'targetPolicyRevision', 'planRevision',
      'compositionPolicyRevision', 'balancePolicy', 'requiredSlots', 'meals', 'goalTarget', 'distributionBounds'], 'axes_day');
    if (!Array.isArray(day.meals)) throw new Error('invalid_axes_meals');
    const meals = [];
    for (const dayMealValue of day.meals) {
      const dayMeal = record(dayMealValue, ['sortOrder', 'slotId', 'mealType', 'date', 'validationInput'], 'axes_day_meal');
      const validation = record(dayMeal.validationInput, ['contract', 'sourceKind', 'meal', 'compositionPolicy', 'balancePolicy',
        'expected', 'userConstraints', 'componentEvidence', 'nutritionBounds', 'requirements', 'warningSignals'], 'axes_meal_input');
      const meal = await decodeMealSnapshotV1(validation.meal);
      if (dayMeal.mealType !== meal.mealType) throw new Error('axes_meal_type_binding_mismatch');
      if (dayMeal.slotId !== meal.mealSlotId || slots.has(meal.mealSlotId)) throw new Error('ambiguous_axes_slot');
      slots.add(meal.mealSlotId);
      if (!Array.isArray(validation.componentEvidence) || validation.componentEvidence.length !== meal.components.length) {
        throw new Error('component_axes_coverage_mismatch');
      }
      const bound = validation.componentEvidence.map((entry) => decodeEvidenceV2Owned(entry, manifest, meal));
      if (bound.some((entry, index) => entry.mealComponentId !== meal.components[index].mealComponentId)) {
        throw new Error('component_axes_coverage_mismatch');
      }
      for (const entry of bound) axes.set(`${meal.mealSlotId}:${entry.mealComponentId}`, entry);
      meals.push({ ...dayMeal, validationInput: { ...validation, componentEvidence: bound.map(legacyEvidence) } });
    }
    days.push({ ...day, meals });
  }
  const input = decodeWeekInput({ ...row, contract: weekValidatorInputContractV1, days }, canonicalTimezoneV2);
  return freezeOwned(await validateWeekOwned(input, axes, weekValue));
}

function decodeOptimizationCandidate(value: unknown, policyRevision: string): OptimizationCandidateV1 {
  const row = record(value, ['candidateId', 'sourceKind', 'validation', 'optimizationPolicyRevision', 'metrics',
    'patternOrder', 'componentIdentitySequence'], 'optimization_candidate');
  if (row.optimizationPolicyRevision !== policyRevision) throw new Error('stale_optimization_policy_revision');
  const validation = record(row.validation, ['contract', 'status', 'scope', 'policyRevision', 'subjectDigest', 'reasons'],
    'candidate_validation');
  if (validation.contract !== validatorResultContractV1 || typeof validation.subjectDigest !== 'string'
      || !digestPattern.test(validation.subjectDigest) || !Array.isArray(validation.reasons)) {
    throw new Error('invalid_candidate_validation');
  }
  const reasons = validation.reasons.map((item, index) => {
    const row = record(item, ['code', 'severity', 'path', 'evidenceRevision'], `validation_reason_${index}`);
    if (typeof row.path !== 'string' || row.path.length === 0 || row.path.length > 256
        || !/^[A-Za-z0-9_.-]+$/.test(row.path)) throw new Error('invalid_validation_reason_path');
    return {
      code: enumValue(row.code, validatorReasonCodes, 'validation_reason_code'),
      severity: enumValue(row.severity, ['WARNING', 'ERROR', 'BLOCKER'] as const, 'validation_reason_severity'),
      path: row.path,
      evidenceRevision: row.evidenceRevision === null
        ? null : uuid(row.evidenceRevision, 'validation_reason_evidence_revision'),
    };
  });
  const canonicalReasons = normalizeReasons(reasons);
  if (JSON.stringify(reasons) !== JSON.stringify(canonicalReasons)) throw new Error('noncanonical_validation_reasons');
  const status = enumValue(validation.status,
    ['VALID', 'VALID_WITH_WARNINGS', 'INVALID', 'BLOCKED_MISSING_EVIDENCE'] as const, 'validation_status');
  const expectedStatus: ValidatorStatusV1 = reasons.some((item) => item.severity === 'BLOCKER')
    ? 'BLOCKED_MISSING_EVIDENCE'
    : reasons.some((item) => item.severity === 'ERROR') ? 'INVALID'
      : reasons.length > 0 ? 'VALID_WITH_WARNINGS' : 'VALID';
  if (status !== expectedStatus) throw new Error('contradictory_validation_status');
  const metrics = record(row.metrics, ['targetFit', 'diversity', 'convenience', 'shoppingReuse'],
    'optimization_metrics');
  for (const [key, metric] of Object.entries(metrics)) unitIntervalMinor(metric, `metric_${key}`);
  return {
    candidateId: uuid(row.candidateId, 'optimization_candidate'),
    sourceKind: enumValue(row.sourceKind, ['COMPLETE_RECIPE', 'COMPOSED_MEAL'] as const, 'optimization_source_kind'),
    validation: {
      contract: validatorResultContractV1,
      status,
      scope: enumValue(validation.scope, ['MEAL'] as const, 'validation_scope'),
      policyRevision: uuid(validation.policyRevision, 'validation_policy_revision'),
      subjectDigest: validation.subjectDigest,
      reasons,
    },
    optimizationPolicyRevision: policyRevision,
    metrics: {
      targetFit: decimalFromMinor(unitIntervalMinor(metrics.targetFit, 'target_fit')),
      diversity: decimalFromMinor(unitIntervalMinor(metrics.diversity, 'diversity')),
      convenience: decimalFromMinor(unitIntervalMinor(metrics.convenience, 'convenience')),
      shoppingReuse: decimalFromMinor(unitIntervalMinor(metrics.shoppingReuse, 'shopping_reuse')),
    },
    patternOrder: integer(row.patternOrder, 'pattern_order'),
    componentIdentitySequence: sortedUuids(row.componentIdentitySequence, 'component_identity_sequence'),
  };
}

function optimizationScore(candidate: OptimizationCandidateV1, policy: OptimizationPolicyV1): bigint {
  const products = (Object.keys(policy.weights) as Array<keyof OptimizationPolicyV1['weights']>).map((key) =>
    decimalMinor(policy.weights[key], `weight_${key}`) * decimalMinor(candidate.metrics[key], `metric_${key}`));
  return (products.reduce((sum, value) => sum + value, 0n) + 500n) / 1_000n;
}

export async function optimizeValidMealsV1(value: unknown): Promise<OptimizationResultV1> {
  const row = record(value, ['contract', 'policy', 'candidates'], 'optimization_input');
  if (row.contract !== optimizationInputContractV1) throw new Error('unsupported_optimization_input');
  const policy = decodeOptimizationPolicyV1(row.policy);
  if (!Array.isArray(row.candidates) || row.candidates.length === 0) throw new Error('optimization_candidates_required');
  const candidates = row.candidates.map((item) => decodeOptimizationCandidate(item, policy.policyRevision));
  if (new Set(candidates.map((item) => item.candidateId)).size !== candidates.length) {
    throw new Error('duplicate_optimization_candidate');
  }
  const eligible = candidates.filter((item) => item.validation.status === 'VALID'
    || item.validation.status === 'VALID_WITH_WARNINGS').map((candidate) => ({
    candidate,
    score: optimizationScore(candidate, policy),
  }));
  if (eligible.length === 0) throw new Error('no_valid_optimization_candidates');
  const statusRank = (status: ValidatorStatusV1) => status === 'VALID' ? 0 : 1;
  eligible.sort((left, right) => statusRank(left.candidate.validation.status) - statusRank(right.candidate.validation.status)
    || (left.score === right.score ? 0 : left.score > right.score ? -1 : 1)
    || (left.candidate.sourceKind === right.candidate.sourceKind ? 0
      : left.candidate.sourceKind === 'COMPLETE_RECIPE' ? -1 : 1)
    || left.candidate.patternOrder - right.candidate.patternOrder
    || left.candidate.componentIdentitySequence.join(':').localeCompare(right.candidate.componentIdentitySequence.join(':'))
    || left.candidate.candidateId.localeCompare(right.candidate.candidateId));
  const selected = eligible[0];
  const output = {
    contract: optimizationResultContractV1,
    policyRevision: policy.policyRevision,
    selectedCandidateId: selected.candidate.candidateId,
    sourceKind: selected.candidate.sourceKind,
    score: decimalFromMinor(selected.score),
  } as const;
  const canonicalCandidates = [...candidates].sort((left, right) => left.candidateId.localeCompare(right.candidateId));
  return { ...output, digest: await digest({
    contract: optimizationResultContractV1,
    policy,
    candidates: canonicalCandidates,
    output,
  }) };
}
