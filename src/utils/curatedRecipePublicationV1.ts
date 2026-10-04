import type { CuratedRecipeTag } from '../types/adaptiveNutrition';
import type { AdaptiveCatalogManifestRecipeV1 } from './adaptiveNutritionActivationV1';
import {
  decodeGraphRecipeSnapshotV1,
  type GraphComponentV1,
  type GraphFoodStateV1,
  type GraphMealTypeV1,
  type GraphNutritionV1,
  type GraphQuantityUnitV1,
  type GraphRecipeSnapshotV1,
} from './adaptiveNutritionGraphV1';

export const curatedRecipePublicationContractV1 = 'potok-curated-recipe-publication-v1' as const;

export type CuratedRecipePublicationBlockerCodeV1 =
  | 'RECIPE_ID_MISSING'
  | 'RECIPE_NAME_IDENTITY_FORBIDDEN'
  | 'RECIPE_STATUS_NOT_REVIEWED'
  | 'BASE_SERVINGS_MISSING'
  | 'BASE_SERVINGS_INVALID'
  | 'NUTRITION_MISSING'
  | 'FIBER_MISSING'
  | 'NUTRITION_BASIS_UNCLEAR'
  | 'NUTRITION_CONTRIBUTION_MISMATCH'
  | 'INGREDIENT_AMOUNT_MISSING'
  | 'INGREDIENT_UNIT_INVALID'
  | 'INGREDIENT_ID_DUPLICATE'
  | 'INGREDIENT_ORDER_INVALID'
  | 'CANONICAL_UNRESOLVED'
  | 'CANONICAL_AMBIGUOUS'
  | 'CANONICAL_FOOD_ID_MISSING'
  | 'CANONICAL_POINTER_INVALID'
  | 'CANONICAL_FOOD_INACCESSIBLE'
  | 'CANONICAL_EVIDENCE_MISSING'
  | 'NON_NUTRITIVE_APPROVAL_MISSING'
  | 'PORTION_POLICY_MISSING'
  | 'DISCRETE_INCREMENT_MISSING'
  | 'STEP_SEQUENCE_INVALID'
  | 'TAG_NOT_REVIEWED'
  | 'MEAL_TYPE_INVALID'
  | 'ALLERGEN_CONTRACT_BLOCKED'
  | 'DIETARY_CONTRACT_BLOCKED'
  | 'SOURCE_CONFLICT'
  | 'YIELD_CONFLICT'
  | 'PUBLICATION_IDENTITY_INVALID';

export type CuratedRecipePublicationScopeV1 = 'collection' | 'adaptive_plan' | 'both';

export interface CuratedRecipePublicationBlockerV1 {
  code: CuratedRecipePublicationBlockerCodeV1;
  path: string;
  scope: CuratedRecipePublicationScopeV1;
}

export interface CuratedRecipeNutritionAuthoringV1 {
  calories: string | null;
  protein: string | null;
  fat: string | null;
  carbs: string | null;
  fiber: string | null;
  basis: 'full_recipe' | 'per_serving' | 'unknown';
  authority: 'reviewed' | 'reference_only' | 'unknown';
  evidenceRef: string | null;
  evidenceDigest: string | null;
}

export interface CuratedRecipeCanonicalPointerV1 {
  foodStableId: string;
  canonicalFoodId: string;
  source: 'core' | 'brand' | 'private' | 'unknown';
  sharedCatalogAccessible: boolean;
  evidenceRevision: string;
  evidenceDigest: string;
}

export interface CuratedRecipeIngredientAuthoringV1 {
  ingredientRowId: string;
  sortOrder: number;
  nameRu: string;
  nameEn: string | null;
  amount: string | null;
  unit: GraphQuantityUnitV1 | string | null;
  weightG: string | null;
  optional: boolean;
  preparationNote: string | null;
  state: GraphFoodStateV1;
  componentKind: 'food' | 'approved_non_food';
  foodStableId: string | null;
  canonicalStatus: 'RESOLVED' | 'UNRESOLVED' | 'AMBIGUOUS' | 'NOT_APPLICABLE';
  canonical: CuratedRecipeCanonicalPointerV1 | null;
  approvedNonFoodEvidenceRef: string | null;
  normalizationEvidenceRef: string | null;
  nutrition: CuratedRecipeNutritionAuthoringV1;
  scalingMode: 'continuous' | 'discrete' | null;
  discreteIncrement: string | null;
}

export interface CuratedRecipeStepAuthoringV1 {
  stepRowId: string;
  stepOrder: number;
  instruction: string;
  durationMinutes: number | null;
  temperatureCelsius: number | null;
}

export interface CuratedRecipeTagAuthoringV1 {
  value: CuratedRecipeTag | string;
  reviewStatus: 'approved' | 'needs_review';
}

export interface CuratedRecipeAuthoringV1 {
  contract: typeof curatedRecipePublicationContractV1;
  authoringRecipeId: string | null;
  nameRu: string;
  nameEn: string | null;
  description: string;
  status: 'DRAFT' | 'NEEDS_REVIEW' | 'REVIEWED';
  baseYield: {
    servings: string | null;
    servingLabel: string;
    totalWeightG: string | null;
    servingWeightG: string | null;
  };
  nutrition: CuratedRecipeNutritionAuthoringV1;
  ingredients: CuratedRecipeIngredientAuthoringV1[];
  steps: CuratedRecipeStepAuthoringV1[];
  tags: CuratedRecipeTagAuthoringV1[];
  eligibility: {
    collectionVisible: boolean;
    planEligible: boolean;
    allowedMealTypes: Array<GraphMealTypeV1 | string>;
  };
  safety: {
    allergenReview: 'reviewed' | 'blocked';
    allergenEvidenceRef: string | null;
    dietaryReview: 'reviewed' | 'blocked';
    dietaryEvidenceRef: string | null;
  };
  source: {
    workbookRevision: string | null;
    recipeEvidenceRef: string | null;
  };
}

export interface CuratedRecipePublicationReadinessV1 {
  status: 'READY_FOR_PUBLICATION' | 'BLOCKED';
  collectionStatus: 'READY_FOR_PUBLICATION' | 'BLOCKED' | 'NOT_REQUESTED';
  adaptivePlanStatus: 'READY_FOR_PUBLICATION' | 'BLOCKED' | 'NOT_REQUESTED';
  blockers: CuratedRecipePublicationBlockerV1[];
}

export interface CuratedRecipePublicationIdentityBoundaryV1 {
  recipeId: string;
  recipeRevisionId: string;
  portionRevisionId: string;
  eligibilityRevisionId: string;
  assignedServingsIncrement: string;
  components: Record<string, {
    componentId: string;
    normalizationEvidenceId: string | null;
    approvedNonFoodDefinitionId: string | null;
  }>;
}

export interface ImmutableRecipeRevisionCandidateV1 {
  contract: typeof curatedRecipePublicationContractV1;
  authoringRecipeId: string;
  recipeId: string;
  recipeRevisionId: string;
  recipeSnapshot: GraphRecipeSnapshotV1;
  preparation: CuratedRecipeStepAuthoringV1[];
  source: { workbookRevision: string; recipeEvidenceRef: string };
}

export interface ImmutablePortionRevisionCandidateV1 {
  contract: typeof curatedRecipePublicationContractV1;
  portionRevisionId: string;
  recipeRevisionId: string;
  policy: 'hybrid';
  assignedServingsIncrement: string;
  componentIncrements: Array<{ componentId: string; increment: string }>;
  collectionScaling: {
    policy: 'exact_proportional';
    fractionalPiecesAllowed: true;
    createsRevision: false;
  };
}

export interface RecipeEligibilityRevisionCandidateV1 {
  contract: typeof curatedRecipePublicationContractV1;
  eligibilityRevisionId: string;
  recipeRevisionId: string;
  portionRevisionId: string;
  collectionVisible: boolean;
  planEligible: true;
  allowedMealTypes: GraphMealTypeV1[];
  reviewedTags: string[];
  evidenceVersion: string;
  safety: {
    allergenEvidenceRef: string;
    dietaryEvidenceRef: string;
  };
}

export interface CuratedRecipePublicationCandidatesV1 {
  readiness: CuratedRecipePublicationReadinessV1;
  recipeRevision: ImmutableRecipeRevisionCandidateV1 | null;
  portionRevision: ImmutablePortionRevisionCandidateV1 | null;
  eligibilityRevision: RecipeEligibilityRevisionCandidateV1 | null;
  manifestTuple: AdaptiveCatalogManifestRecipeV1 | null;
}

const uuidPattern = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/;
const decimalPattern = /^(0|[1-9][0-9]{0,8})\.[0-9]{3}$/;
const digestPattern = /^[0-9a-f]{64}$/;
const stableKeyPattern = /^[a-z0-9][a-z0-9_-]{0,127}$/;
const mealTypes: readonly GraphMealTypeV1[] = ['breakfast', 'lunch', 'dinner', 'snack'];
const reviewedTags: readonly CuratedRecipeTag[] = [
  'bulk', 'cut', 'energy-dense', 'high-volume', 'high_carb', 'high_protein', 'keto',
  'lower-carb', 'lower-fat', 'post-workout', 'pre-workout', 'vegan',
];
const scale = 1_000n;
const nutritionFields: ReadonlyArray<keyof GraphNutritionV1> = ['calories', 'protein', 'fat', 'carbs', 'fiber'];

function decimalMinor(value: unknown, positive: boolean): bigint | null {
  if (typeof value !== 'string' || !decimalPattern.test(value)) return null;
  const minor = BigInt(value.replace('.', ''));
  if (positive ? minor <= 0n : minor < 0n) return null;
  return minor;
}

function decimalFromMinor(value: bigint): string {
  return `${value / scale}.${String(value % scale).padStart(3, '0')}`;
}

function exactMultiply(left: string, right: string): string | null {
  const product = decimalMinor(left, false)! * decimalMinor(right, false)!;
  return product % scale === 0n ? decimalFromMinor(product / scale) : null;
}

function addNutrition(values: GraphNutritionV1[]): GraphNutritionV1 {
  const sum = (key: keyof GraphNutritionV1) => decimalFromMinor(values.reduce(
    (total, value) => total + decimalMinor(value[key], false)!, 0n,
  ));
  return {
    calories: sum('calories'), protein: sum('protein'), fat: sum('fat'),
    carbs: sum('carbs'), fiber: sum('fiber'),
  };
}

function pushBlocker(
  blockers: CuratedRecipePublicationBlockerV1[],
  code: CuratedRecipePublicationBlockerCodeV1,
  path: string,
  scope: CuratedRecipePublicationScopeV1 = 'both',
): void {
  blockers.push({ code, path, scope });
}

function normalizeBlockers(blockers: CuratedRecipePublicationBlockerV1[]): CuratedRecipePublicationBlockerV1[] {
  return [...new Map(blockers.map((item) => [`${item.code}:${item.path}:${item.scope}`, item])).values()]
    .sort((left, right) => `${left.code}:${left.path}:${left.scope}`.localeCompare(
      `${right.code}:${right.path}:${right.scope}`,
    ));
}

function nutritionFromAuthoring(
  value: CuratedRecipeNutritionAuthoringV1,
  servings: string,
  path: string,
  blockers: CuratedRecipePublicationBlockerV1[],
): GraphNutritionV1 | null {
  for (const key of nutritionFields) {
    if (value[key] === null) {
      pushBlocker(blockers, key === 'fiber' ? 'FIBER_MISSING' : 'NUTRITION_MISSING', `${path}.${key}`);
    } else if (decimalMinor(value[key], false) === null) {
      pushBlocker(blockers, 'NUTRITION_MISSING', `${path}.${key}`);
    }
  }
  if (value.basis === 'unknown') pushBlocker(blockers, 'NUTRITION_BASIS_UNCLEAR', `${path}.basis`);
  if (value.authority !== 'reviewed' || !value.evidenceRef || !value.evidenceDigest
      || !digestPattern.test(value.evidenceDigest)) {
    pushBlocker(blockers, 'SOURCE_CONFLICT', `${path}.evidence`);
  }
  if (nutritionFields.some((key) => decimalMinor(value[key], false) === null) || value.basis === 'unknown') return null;
  const normalized = Object.fromEntries(nutritionFields.map((key) => [key, value[key]])) as unknown as GraphNutritionV1;
  if (value.basis === 'full_recipe') return normalized;
  const full = Object.fromEntries(nutritionFields.map((key) => [key, exactMultiply(normalized[key], servings)]));
  if (nutritionFields.some((key) => full[key] === null)) {
    pushBlocker(blockers, 'SOURCE_CONFLICT', `${path}.per_serving_scale`);
    return null;
  }
  return full as unknown as GraphNutritionV1;
}

function auditCanonicalIngredient(
  ingredient: CuratedRecipeIngredientAuthoringV1,
  path: string,
  blockers: CuratedRecipePublicationBlockerV1[],
): void {
  if (ingredient.componentKind === 'approved_non_food') {
    if (!ingredient.approvedNonFoodEvidenceRef || ingredient.canonicalStatus !== 'NOT_APPLICABLE') {
      pushBlocker(blockers, 'NON_NUTRITIVE_APPROVAL_MISSING', path);
    }
    return;
  }
  if (ingredient.canonicalStatus === 'UNRESOLVED') pushBlocker(blockers, 'CANONICAL_UNRESOLVED', path);
  if (ingredient.canonicalStatus === 'AMBIGUOUS') pushBlocker(blockers, 'CANONICAL_AMBIGUOUS', path);
  if (ingredient.canonicalStatus !== 'RESOLVED') pushBlocker(blockers, 'CANONICAL_POINTER_INVALID', path);
  if (!ingredient.foodStableId || !ingredient.canonical?.canonicalFoodId) {
    pushBlocker(blockers, 'CANONICAL_FOOD_ID_MISSING', path);
    if (!ingredient.canonical?.evidenceRevision || !ingredient.canonical?.evidenceDigest) {
      pushBlocker(blockers, 'CANONICAL_EVIDENCE_MISSING', path);
    }
    return;
  }
  const pointer = ingredient.canonical;
  if (!uuidPattern.test(pointer.canonicalFoodId) || pointer.foodStableId !== ingredient.foodStableId
      || !stableKeyPattern.test(pointer.foodStableId) || !['core', 'brand'].includes(pointer.source)) {
    pushBlocker(blockers, 'CANONICAL_POINTER_INVALID', path);
  }
  if (!pointer.sharedCatalogAccessible || pointer.source === 'private') {
    pushBlocker(blockers, 'CANONICAL_FOOD_INACCESSIBLE', path);
  }
  if (!pointer.evidenceRevision || !digestPattern.test(pointer.evidenceDigest)) {
    pushBlocker(blockers, 'CANONICAL_EVIDENCE_MISSING', path);
  }
}

export function auditCuratedRecipePublicationV1(
  authoring: CuratedRecipeAuthoringV1,
): CuratedRecipePublicationReadinessV1 {
  const blockers: CuratedRecipePublicationBlockerV1[] = [];
  if (!authoring.nameRu.trim() || !authoring.baseYield.servingLabel.trim()) {
    pushBlocker(blockers, 'SOURCE_CONFLICT', 'recipe.display');
  }
  if (authoring.ingredients.length === 0) pushBlocker(blockers, 'SOURCE_CONFLICT', 'ingredients');
  const authoringId = authoring.authoringRecipeId;
  if (!authoringId || !stableKeyPattern.test(authoringId)) pushBlocker(blockers, 'RECIPE_ID_MISSING', 'authoringRecipeId');
  if (authoringId && [authoring.nameRu, authoring.nameEn].filter(Boolean).some(
    (name) => name!.trim().toLocaleLowerCase('ru-RU') === authoringId.trim().toLocaleLowerCase('ru-RU'),
  )) pushBlocker(blockers, 'RECIPE_NAME_IDENTITY_FORBIDDEN', 'authoringRecipeId');
  if (authoring.status !== 'REVIEWED') pushBlocker(blockers, 'RECIPE_STATUS_NOT_REVIEWED', 'status');

  const servings = authoring.baseYield.servings;
  if (servings === null) pushBlocker(blockers, 'BASE_SERVINGS_MISSING', 'baseYield.servings');
  else if (decimalMinor(servings, true) === null) pushBlocker(blockers, 'BASE_SERVINGS_INVALID', 'baseYield.servings');
  const validServings = servings !== null && decimalMinor(servings, true) !== null ? servings : '1.000';
  const recipeNutrition = nutritionFromAuthoring(authoring.nutrition, validServings, 'nutrition', blockers);

  const totalWeight = authoring.baseYield.totalWeightG;
  const servingWeight = authoring.baseYield.servingWeightG;
  if (totalWeight !== null && decimalMinor(totalWeight, true) === null) {
    pushBlocker(blockers, 'YIELD_CONFLICT', 'baseYield.totalWeightG');
  }
  if (servingWeight !== null && decimalMinor(servingWeight, true) === null) {
    pushBlocker(blockers, 'YIELD_CONFLICT', 'baseYield.servingWeightG');
  }
  if (servings && totalWeight && servingWeight
      && decimalMinor(servings, true) !== null && decimalMinor(totalWeight, true) !== null
      && decimalMinor(servingWeight, true) !== null && exactMultiply(servingWeight, servings) !== totalWeight) {
    pushBlocker(blockers, 'YIELD_CONFLICT', 'baseYield');
  }

  const ingredientIds = new Set<string>();
  const orders = new Set<number>();
  const ingredientNutrition: GraphNutritionV1[] = [];
  authoring.ingredients.forEach((ingredient, index) => {
    const path = `ingredients[${index}]`;
    if (!ingredient.ingredientRowId || ingredientIds.has(ingredient.ingredientRowId)) {
      pushBlocker(blockers, 'INGREDIENT_ID_DUPLICATE', `${path}.ingredientRowId`);
    }
    ingredientIds.add(ingredient.ingredientRowId);
    if (!Number.isSafeInteger(ingredient.sortOrder) || ingredient.sortOrder < 0 || orders.has(ingredient.sortOrder)) {
      pushBlocker(blockers, 'INGREDIENT_ORDER_INVALID', `${path}.sortOrder`);
    }
    orders.add(ingredient.sortOrder);
    if (ingredient.amount === null) pushBlocker(blockers, 'INGREDIENT_AMOUNT_MISSING', `${path}.amount`);
    else if (decimalMinor(ingredient.amount, true) === null) pushBlocker(blockers, 'INGREDIENT_AMOUNT_MISSING', `${path}.amount`);
    if (!['g', 'ml', 'piece'].includes(ingredient.unit ?? '')) {
      pushBlocker(blockers, 'INGREDIENT_UNIT_INVALID', `${path}.unit`);
    }
    auditCanonicalIngredient(ingredient, path, blockers);
    const componentNutrition = nutritionFromAuthoring(ingredient.nutrition, '1.000', `${path}.nutrition`, blockers);
    if (componentNutrition) ingredientNutrition.push(componentNutrition);

    if (ingredient.scalingMode === null) pushBlocker(blockers, 'PORTION_POLICY_MISSING', `${path}.scalingMode`, 'adaptive_plan');
    if (ingredient.unit === 'piece' && ingredient.scalingMode !== 'discrete') {
      pushBlocker(blockers, 'PORTION_POLICY_MISSING', `${path}.scalingMode`, 'adaptive_plan');
    }
    if (ingredient.unit !== 'piece' && ingredient.scalingMode === 'discrete') {
      pushBlocker(blockers, 'PORTION_POLICY_MISSING', `${path}.scalingMode`, 'adaptive_plan');
    }
    if (ingredient.scalingMode === 'discrete'
        && decimalMinor(ingredient.discreteIncrement, true) === null) {
      pushBlocker(blockers, 'DISCRETE_INCREMENT_MISSING', `${path}.discreteIncrement`, 'adaptive_plan');
    }
    if (ingredient.unit === 'g' && ingredient.amount && ingredient.weightG !== ingredient.amount) {
      pushBlocker(blockers, 'YIELD_CONFLICT', `${path}.weightG`);
    }
    if ((ingredient.unit === 'ml' || ingredient.unit === 'piece')
        && (decimalMinor(ingredient.weightG, true) === null || !ingredient.normalizationEvidenceRef)) {
      pushBlocker(blockers, 'SOURCE_CONFLICT', `${path}.normalization`);
    }
  });
  if (orders.size !== authoring.ingredients.length
      || [...orders].some((order) => order >= authoring.ingredients.length)) {
    pushBlocker(blockers, 'INGREDIENT_ORDER_INVALID', 'ingredients');
  }
  if (recipeNutrition && ingredientNutrition.length === authoring.ingredients.length) {
    const total = addNutrition(ingredientNutrition);
    if (nutritionFields.some((key) => recipeNutrition[key] !== total[key])) {
      pushBlocker(blockers, 'NUTRITION_CONTRIBUTION_MISMATCH', 'nutrition');
    }
  }

  const stepIds = new Set<string>();
  const stepOrders = new Set<number>();
  authoring.steps.forEach((step, index) => {
    if (!step.stepRowId || stepIds.has(step.stepRowId) || !Number.isSafeInteger(step.stepOrder)
        || step.stepOrder < 1 || stepOrders.has(step.stepOrder) || !step.instruction.trim()) {
      pushBlocker(blockers, 'STEP_SEQUENCE_INVALID', `steps[${index}]`);
    }
    stepIds.add(step.stepRowId);
    stepOrders.add(step.stepOrder);
  });
  if (authoring.steps.length === 0 || [...stepOrders].some((order) => order > authoring.steps.length)) {
    pushBlocker(blockers, 'STEP_SEQUENCE_INVALID', 'steps');
  }

  const tags = new Set<string>();
  authoring.tags.forEach((tag, index) => {
    if (tag.reviewStatus !== 'approved' || !reviewedTags.includes(tag.value as CuratedRecipeTag)
        || tags.has(tag.value)) pushBlocker(blockers, 'TAG_NOT_REVIEWED', `tags[${index}]`);
    tags.add(tag.value);
  });
  const meals = new Set<string>();
  authoring.eligibility.allowedMealTypes.forEach((meal, index) => {
    if (!mealTypes.includes(meal as GraphMealTypeV1) || meals.has(meal)) {
      pushBlocker(blockers, 'MEAL_TYPE_INVALID', `eligibility.allowedMealTypes[${index}]`);
    }
    meals.add(meal);
  });
  if (authoring.eligibility.planEligible && meals.size === 0) {
    pushBlocker(blockers, 'MEAL_TYPE_INVALID', 'eligibility.allowedMealTypes', 'adaptive_plan');
  }
  if (!authoring.eligibility.planEligible) {
    pushBlocker(blockers, 'SOURCE_CONFLICT', 'eligibility.planEligible', 'adaptive_plan');
  }
  if (authoring.safety.allergenReview !== 'reviewed' || !authoring.safety.allergenEvidenceRef) {
    pushBlocker(blockers, 'ALLERGEN_CONTRACT_BLOCKED', 'safety.allergenReview');
  }
  if (authoring.safety.dietaryReview !== 'reviewed' || !authoring.safety.dietaryEvidenceRef) {
    pushBlocker(blockers, 'DIETARY_CONTRACT_BLOCKED', 'safety.dietaryReview');
  }
  if (!authoring.source.workbookRevision || !authoring.source.recipeEvidenceRef) {
    pushBlocker(blockers, 'SOURCE_CONFLICT', 'source');
  }

  const normalized = normalizeBlockers(blockers);
  const blockedFor = (scope: 'collection' | 'adaptive_plan') => normalized.some(
    (item) => item.scope === 'both' || item.scope === scope,
  );
  const collectionStatus = authoring.eligibility.collectionVisible
    ? (blockedFor('collection') ? 'BLOCKED' : 'READY_FOR_PUBLICATION') : 'NOT_REQUESTED';
  const adaptivePlanStatus = authoring.eligibility.planEligible
    ? (blockedFor('adaptive_plan') ? 'BLOCKED' : 'READY_FOR_PUBLICATION') : 'NOT_REQUESTED';
  return {
    status: normalized.length === 0 ? 'READY_FOR_PUBLICATION' : 'BLOCKED',
    collectionStatus,
    adaptivePlanStatus,
    blockers: normalized,
  };
}

function validatePublicationIdentities(
  authoring: CuratedRecipeAuthoringV1,
  identities: CuratedRecipePublicationIdentityBoundaryV1,
): CuratedRecipePublicationBlockerV1[] {
  const blockers: CuratedRecipePublicationBlockerV1[] = [];
  for (const [path, value] of Object.entries({
    recipeId: identities.recipeId,
    recipeRevisionId: identities.recipeRevisionId,
    portionRevisionId: identities.portionRevisionId,
    eligibilityRevisionId: identities.eligibilityRevisionId,
  })) if (!uuidPattern.test(value)) pushBlocker(blockers, 'PUBLICATION_IDENTITY_INVALID', `identities.${path}`);
  if (decimalMinor(identities.assignedServingsIncrement, true) === null) {
    pushBlocker(blockers, 'PUBLICATION_IDENTITY_INVALID', 'identities.assignedServingsIncrement');
  }
  authoring.ingredients.forEach((ingredient) => {
    const identity = identities.components[ingredient.ingredientRowId];
    if (!identity || !uuidPattern.test(identity.componentId)) {
      pushBlocker(blockers, 'PUBLICATION_IDENTITY_INVALID', `identities.components.${ingredient.ingredientRowId}`);
      return;
    }
    if (ingredient.componentKind === 'approved_non_food'
        && (!identity.approvedNonFoodDefinitionId || !uuidPattern.test(identity.approvedNonFoodDefinitionId))) {
      pushBlocker(blockers, 'PUBLICATION_IDENTITY_INVALID',
        `identities.components.${ingredient.ingredientRowId}.approvedNonFoodDefinitionId`);
    }
    if ((ingredient.unit === 'ml' || ingredient.unit === 'piece')
        && (!identity.normalizationEvidenceId || !uuidPattern.test(identity.normalizationEvidenceId))) {
      pushBlocker(blockers, 'PUBLICATION_IDENTITY_INVALID',
        `identities.components.${ingredient.ingredientRowId}.normalizationEvidenceId`);
    }
  });
  return normalizeBlockers(blockers);
}

export function compileCuratedRecipePublicationV1(
  authoring: CuratedRecipeAuthoringV1,
  identities: CuratedRecipePublicationIdentityBoundaryV1,
): CuratedRecipePublicationCandidatesV1 {
  const readiness = auditCuratedRecipePublicationV1(authoring);
  const identityBlockers = validatePublicationIdentities(authoring, identities);
  if (identityBlockers.length > 0 || readiness.status === 'BLOCKED') {
    return {
      readiness: identityBlockers.length === 0 ? readiness : {
        ...readiness, status: 'BLOCKED',
        collectionStatus: authoring.eligibility.collectionVisible ? 'BLOCKED' : 'NOT_REQUESTED',
        adaptivePlanStatus: authoring.eligibility.planEligible ? 'BLOCKED' : 'NOT_REQUESTED',
        blockers: normalizeBlockers([...readiness.blockers, ...identityBlockers]),
      },
      recipeRevision: null, portionRevision: null, eligibilityRevision: null, manifestTuple: null,
    };
  }

  const servings = authoring.baseYield.servings!;
  const fullRecipeNutrition = nutritionFromAuthoring(authoring.nutrition, servings, 'nutrition', [])!;
  const ingredients: GraphComponentV1[] = [...authoring.ingredients]
    .sort((left, right) => left.sortOrder - right.sortOrder)
    .map((ingredient) => {
      const identity = identities.components[ingredient.ingredientRowId];
      const nutrition = nutritionFromAuthoring(ingredient.nutrition, '1.000', 'ingredient.nutrition', [])!;
      return {
        componentId: identity.componentId,
        recipeRevisionId: identities.recipeRevisionId,
        identity: ingredient.componentKind === 'food'
          ? { kind: 'canonical_food' as const, canonicalFoodId: ingredient.canonical!.canonicalFoodId }
          : { kind: 'approved_non_food' as const, componentDefinitionId: identity.approvedNonFoodDefinitionId! },
        displayNameSnapshot: ingredient.nameRu,
        state: ingredient.state,
        quantity: { amount: ingredient.amount!, unit: ingredient.unit as GraphQuantityUnitV1 },
        normalizedGrams: ingredient.unit === 'g' ? ingredient.amount! : ingredient.weightG,
        normalizationEvidenceRef: ingredient.unit === 'g' ? null : identity.normalizationEvidenceId,
        scaling: ingredient.scalingMode === 'discrete'
          ? { mode: 'discrete' as const, increment: ingredient.discreteIncrement! }
          : { mode: 'continuous' as const },
        nutrition,
        sortOrder: ingredient.sortOrder,
      };
    });
  const recipeSnapshot = decodeGraphRecipeSnapshotV1({
    recipeId: identities.recipeId,
    recipeRevisionId: identities.recipeRevisionId,
    displayNameSnapshot: authoring.nameRu,
    baseYield: {
      servings,
      servingLabel: authoring.baseYield.servingLabel,
      totalYieldGrams: authoring.baseYield.totalWeightG,
    },
    fullRecipeNutrition,
    ingredients,
  });
  const componentIncrements = recipeSnapshot.ingredients.flatMap((ingredient) => (
    ingredient.scaling.mode === 'discrete'
      ? [{ componentId: ingredient.componentId, increment: ingredient.scaling.increment }] : []
  )).sort((left, right) => left.componentId.localeCompare(right.componentId));
  const allowedMealTypes = ([...authoring.eligibility.allowedMealTypes]
    .sort((left, right) => mealTypes.indexOf(left as GraphMealTypeV1)
      - mealTypes.indexOf(right as GraphMealTypeV1))) as GraphMealTypeV1[];
  const approvedTags = authoring.tags.map((tag) => tag.value).sort();
  const recipeRevision: ImmutableRecipeRevisionCandidateV1 = {
    contract: curatedRecipePublicationContractV1,
    authoringRecipeId: authoring.authoringRecipeId!,
    recipeId: identities.recipeId,
    recipeRevisionId: identities.recipeRevisionId,
    recipeSnapshot,
    preparation: [...authoring.steps].sort((left, right) => left.stepOrder - right.stepOrder),
    source: {
      workbookRevision: authoring.source.workbookRevision!,
      recipeEvidenceRef: authoring.source.recipeEvidenceRef!,
    },
  };
  const portionRevision: ImmutablePortionRevisionCandidateV1 = {
    contract: curatedRecipePublicationContractV1,
    portionRevisionId: identities.portionRevisionId,
    recipeRevisionId: identities.recipeRevisionId,
    policy: 'hybrid',
    assignedServingsIncrement: identities.assignedServingsIncrement,
    componentIncrements,
    collectionScaling: {
      policy: 'exact_proportional', fractionalPiecesAllowed: true, createsRevision: false,
    },
  };
  const eligibilityRevision: RecipeEligibilityRevisionCandidateV1 = {
    contract: curatedRecipePublicationContractV1,
    eligibilityRevisionId: identities.eligibilityRevisionId,
    recipeRevisionId: identities.recipeRevisionId,
    portionRevisionId: identities.portionRevisionId,
    collectionVisible: authoring.eligibility.collectionVisible,
    planEligible: true,
    allowedMealTypes,
    reviewedTags: approvedTags,
    evidenceVersion: authoring.source.workbookRevision!,
    safety: {
      allergenEvidenceRef: authoring.safety.allergenEvidenceRef!,
      dietaryEvidenceRef: authoring.safety.dietaryEvidenceRef!,
    },
  };
  const manifestTuple: AdaptiveCatalogManifestRecipeV1 = {
    recipeId: identities.recipeId,
    recipeRevisionId: identities.recipeRevisionId,
    portionRevisionId: identities.portionRevisionId,
    eligibilityRevisionId: identities.eligibilityRevisionId,
    recipeSnapshot,
    allowedMealTypes,
    reviewedTags: approvedTags,
    planEligible: true,
    portionRules: {
      mode: 'hybrid', assignedServingsIncrement: identities.assignedServingsIncrement, componentIncrements,
    },
  };
  return { readiness, recipeRevision, portionRevision, eligibilityRevision, manifestTuple };
}
