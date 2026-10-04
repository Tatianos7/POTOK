import assert from 'node:assert/strict';
import test from 'node:test';
import {
  adaptiveMealCompositionEligibilityV1_1,
  composeAdaptiveMealV1,
  type MealAnchorKindV1,
  type MealComponentCandidateV1,
  type MealComponentRoleV1,
  type MealCompositionPolicyV1,
  type MealSnapshotV1,
} from '../adaptiveNutritionMealCompositionV1';
import {
  balancePolicyContractV1,
  calculateGoalTargetFitV1,
  dayValidatorInputContractV1,
  decodeGoalNutritionTargetV1,
  goalNutritionTargetContractV1,
  goalTargetFitInputContractV1,
  mealCandidateEvidenceContractV1,
  mealValidatorInputContractV1,
  optimizationInputContractV1,
  optimizationPolicyContractV1,
  optimizeValidMealsV1,
  validateDaySnapshotV1,
  validateMealSnapshotV1,
  validateWeekSnapshotV1,
  validatorResultContractV1,
  weekValidatorInputContractV1,
  type AccessibilityClassV1,
  type BalancePolicyV1,
  type DayValidationInputV1,
  type GoalNutritionTargetV1,
  type MealComponentEvidenceV1,
  type MealSourceKindV1,
  type MealValidationInputV1,
  type OptimizationCandidateV1,
  type OptimizationPolicyV1,
  type ValidatorReasonCodeV1,
  type ValidatorResultV1,
  type WeekValidationInputV1,
} from '../adaptiveNutritionMealBalanceV1';
import {
  scalePremiumRecipeCollectionV1,
  type GraphMealTypeV1,
  type GraphNutritionV1,
  type GraphRecipeSnapshotV1,
} from '../adaptiveNutritionGraphV1';

const n = (calories: string, protein = '20.000', fat = '10.000', carbs = '30.000', fiber = '5.000'):
GraphNutritionV1 => ({ calories, protein, fat, carbs, fiber });
const zero = n('0.000', '0.000', '0.000', '0.000', '0.000');
const high = n('9999.000', '9999.000', '9999.000', '9999.000', '9999.000');
const nutritionKeys = ['calories', 'protein', 'fat', 'carbs', 'fiber'] as const;
const decimalMinor = (value: string): bigint => BigInt(value.replace('.', ''));
const decimalFromMinor = (value: bigint): string =>
  `${value / 1_000n}.${String(value % 1_000n).padStart(3, '0')}`;
const sumNutrition = (values: GraphNutritionV1[]): GraphNutritionV1 => Object.fromEntries(
  nutritionKeys.map((key) => [key, decimalFromMinor(values.reduce(
    (sum, value) => sum + decimalMinor(value[key]), 0n,
  ))]),
) as unknown as GraphNutritionV1;
const uuid = (value: number): string => `${value.toString(16).padStart(8, '0')}-0000-4000-8000-${String(value).padStart(12, '0')}`;
const hash = (character: string): string => character.repeat(64);
let nextId = 20_000;
const id = (): string => uuid(nextId++);

interface CandidateOptions {
  role?: MealComponentRoleV1;
  anchorKind?: MealAnchorKindV1;
  required?: MealComponentRoleV1[][];
  allowedMealTypes?: GraphMealTypeV1[];
  recipeRevision?: string;
  repeatFamily?: string;
  nutrition?: GraphNutritionV1;
}

function candidate(options: CandidateOptions = {}): MealComponentCandidateV1 {
  const recipeRevision = options.recipeRevision ?? id();
  const role = options.role ?? 'MAIN_COMPONENT';
  const value = options.nutrition ?? n('300.000');
  const recipe: GraphRecipeSnapshotV1 = {
    recipeId: id(),
    recipeRevisionId: recipeRevision,
    displayNameSnapshot: `Synthetic ${recipeRevision}`,
    baseYield: { servings: '1.000', servingLabel: 'порция', totalYieldGrams: '100.000' },
    fullRecipeNutrition: value,
    ingredients: [{
      componentId: id(),
      recipeRevisionId: recipeRevision,
      identity: { kind: 'canonical_food', canonicalFoodId: id() },
      displayNameSnapshot: 'Synthetic ingredient',
      state: 'as-sold',
      quantity: { amount: '100.000', unit: 'g' },
      normalizedGrams: '100.000',
      normalizationEvidenceRef: null,
      scaling: { mode: 'continuous' },
      nutrition: value,
      sortOrder: 0,
    }],
  };
  const preview = scalePremiumRecipeCollectionV1(recipe, '1.000');
  return {
    mealComponentId: id(),
    eligibility: {
      contract: adaptiveMealCompositionEligibilityV1_1,
      eligibilityRevisionId: id(),
      recipeRevisionId: recipeRevision,
      compositionPolicyRevision: uuid(10),
      role,
      anchorKind: options.anchorKind ?? (role === 'MAIN_COMPONENT' ? 'COMPLETE' : 'NONE'),
      allowedMealTypes: options.allowedMealTypes ?? ['breakfast', 'lunch', 'dinner', 'snack'],
      requiredCompanionRoleSets: options.required ?? [],
      pairingTags: [],
      incompatiblePairingTags: [],
      repeatFamily: options.repeatFamily ?? `family_${nextId}`,
      energyClass: 'BALANCED',
      beverageClass: role === 'BEVERAGE' ? 'NON_CALORIC' : 'NOT_BEVERAGE',
    },
    recipeRevision,
    portionRevision: id(),
    recipe,
    assignedPortion: {
      source: 'potok_generator',
      portionRevisionId: '',
      assignedServings: '1.000',
      servingMultiplier: preview.scaleFactor,
      assignedGrams: '100.000',
    },
    ingredients: preview.ingredients,
    nutrition: preview.nutrition,
  };
}

function finalizeCandidate(value: MealComponentCandidateV1): MealComponentCandidateV1 {
  value.assignedPortion.portionRevisionId = value.portionRevision;
  return value;
}

function compositionPolicy(patterns: MealComponentRoleV1[][], maxComponents = 5): MealCompositionPolicyV1 {
  return {
    policyRevision: uuid(10),
    maxComponents,
    patterns: patterns.map((roles, index) => ({
      patternId: `policy_pattern_${index}`,
      allowedMealTypes: ['breakfast', 'lunch', 'dinner', 'snack'],
      roles,
    })),
    nutritionWeights: { calories: 1, protein: 1, fat: 1, carbs: 1, fiber: 1 },
  };
}

const warningCodes: ValidatorReasonCodeV1[] = [
  'LONG_PREPARATION_BURDEN', 'LOWER_CONVENIENCE_SCORE', 'OPTIONAL_EXPENSIVE_USED',
  'OPTIONAL_SPECIALTY_USED', 'REPETITION_LIMIT_APPROACHING', 'SHOPPING_LIST_BURDEN',
  'SOFT_TARGET_FIT_DEVIATION',
].sort() as ValidatorReasonCodeV1[];

function balancePolicy(): BalancePolicyV1 {
  return {
    contract: balancePolicyContractV1,
    policyRevision: uuid(11),
    maxComponents: 5,
    exactRecipePerWeek: 2,
    exactRecipePerDay: 1,
    repeatFamilyPerWeek: 3,
    dominantIngredientFamilyPerWeek: 4,
    specialtyMealsPerWeek: 1,
    expensiveMealsPerWeek: 2,
    allowedWarningCodes: warningCodes,
  };
}

function evidence(component: MealComponentCandidateV1, overrides: Partial<MealComponentEvidenceV1> = {}):
MealComponentEvidenceV1 {
  return {
    contract: mealCandidateEvidenceContractV1,
    mealComponentId: component.mealComponentId,
    recipeRevision: component.recipeRevision,
    publicationStatus: 'PUBLISHED',
    publicationRevision: id(),
    canonicalStatus: 'READY',
    canonicalEvidenceRevision: id(),
    nutritionStatus: 'COMPLETE',
    nutritionEvidenceRevision: id(),
    allergenStatus: 'REVIEWED',
    allergenEvidenceRevision: id(),
    dietaryStatus: 'REVIEWED',
    dietaryEvidenceRevision: id(),
    portionPolicyRevision: component.portionRevision,
    accessibility: 'COMMON_RU_RETAIL',
    allergens: [],
    dietaryTags: [],
    ingredientFamilies: ['ordinary_food'],
    dominantIngredientFamily: 'ordinary_food',
    repeatFamily: component.eligibility.repeatFamily,
    assignedServingsMinimum: '1.000',
    assignedServingsMaximum: '1.000',
    proteinSource: true,
    produceSource: true,
    ...overrides,
  };
}

async function mealFrom(components: MealComponentCandidateV1[], roles: MealComponentRoleV1[],
  mealType: GraphMealTypeV1 = 'dinner', maxComponents = 5, slotId = id()): Promise<MealSnapshotV1> {
  const finalized = components.map(finalizeCandidate);
  const result = await composeAdaptiveMealV1({
    mealSlotId: slotId,
    mealSnapshotRevision: id(),
    mealType,
    goalRevision: uuid(12),
    goalProfile: 'MAINTENANCE',
    policy: compositionPolicy([roles], maxComponents),
    slotTarget: sumNutrition(finalized.map((item) => item.nutrition)),
    slotHardMaximum: high,
    currentDayNutrition: zero,
    dayTarget: high,
    dayHardMaximum: high,
    excludedRecipeRevisions: [],
    excludedRepeatFamilies: [],
    candidates: finalized,
  });
  assert.equal(result.status, 'COMPLETE');
  if (result.status !== 'COMPLETE') throw new Error('fixture_meal_incomplete');
  return result.meal;
}

function bounds(value: GraphNutritionV1): { minimum: GraphNutritionV1; target: GraphNutritionV1;
  maximum: GraphNutritionV1 } {
  return { minimum: zero, target: value, maximum: high };
}

function goalTarget(calories: { target: string; min: string; max: string },
  optional: Partial<Record<'protein' | 'fat' | 'carbs' | 'fiber', { target: string; min: string; max: string }>> = {},
  targetPolicyRevision = uuid(17)): GoalNutritionTargetV1 {
  return {
    contract: goalNutritionTargetContractV1,
    goalRevision: uuid(12),
    targetPolicyRevision,
    calories,
    protein: optional.protein ?? null,
    fat: optional.fat ?? null,
    carbs: optional.carbs ?? null,
    fiber: optional.fiber ?? null,
  };
}

function mealInput(meal: MealSnapshotV1, components: MealComponentCandidateV1[], roles: MealComponentRoleV1[],
  sourceKind: MealSourceKindV1 = components.length === 1 ? 'COMPLETE_RECIPE' : 'COMPOSED_MEAL',
  evidenceOverrides: Array<Partial<MealComponentEvidenceV1>> = []): MealValidationInputV1 {
  return {
    contract: mealValidatorInputContractV1,
    sourceKind,
    meal,
    compositionPolicy: compositionPolicy([roles]),
    balancePolicy: balancePolicy(),
    expected: { goalRevision: uuid(12), compositionPolicyRevision: uuid(10) },
    userConstraints: {
      revisionId: uuid(13), excludedAllergens: [], excludedIngredientFamilies: [],
      requiredDietaryTags: [], forbiddenDietaryTags: [],
    },
    componentEvidence: components.map((item, index) => evidence(item, evidenceOverrides[index])),
    nutritionBounds: bounds(meal.nutrition),
    requirements: { proteinSourceRequired: false, produceRequired: false },
    warningSignals: {
      softTargetFitDeviation: false, longPreparationBurden: false, shoppingListBurden: false,
      lowerConvenienceScore: false, repetitionApproachingLimit: false,
    },
  };
}

function dayInput(date: string, meals: MealValidationInputV1[], target?: GoalNutritionTargetV1): DayValidationInputV1 {
  const slots = meals.map((meal, sortOrder) => ({ sortOrder, slotId: meal.meal.mealSlotId, mealType: meal.meal.mealType }));
  const total = sumNutrition(meals.map((meal) => meal.meal.nutrition));
  return {
    contract: dayValidatorInputContractV1,
    date,
    timezone: 'Europe/Moscow',
    goalRevision: uuid(12),
    targetPolicyRevision: target?.targetPolicyRevision ?? uuid(17),
    planRevision: uuid(14),
    compositionPolicyRevision: uuid(10),
    balancePolicy: balancePolicy(),
    requiredSlots: slots,
    meals: meals.map((validationInput, sortOrder) => ({ ...slots[sortOrder], date, validationInput })),
    goalTarget: target ?? goalTarget({ target: total.calories, min: total.calories, max: total.calories }, {
      protein: { target: total.protein, min: total.protein, max: total.protein },
      fat: { target: total.fat, min: total.fat, max: total.fat },
      carbs: { target: total.carbs, min: total.carbs, max: total.carbs },
      fiber: { target: total.fiber, min: total.fiber, max: total.fiber },
    }),
    distributionBounds: meals.map((meal, sortOrder) => ({
      sortOrder, slotId: meal.meal.mealSlotId, bounds: bounds(meal.meal.nutrition),
    })),
  };
}

function weekInput(days: DayValidationInputV1[], fallbackStatus: WeekValidationInputV1['ordinaryFallbackProof']['status']
  = 'VALID'): WeekValidationInputV1 {
  return {
    contract: weekValidatorInputContractV1,
    weekAnchor: '2026-09-28',
    timezone: 'Europe/Moscow',
    goalRevision: uuid(12),
    targetPolicyRevision: uuid(17),
    planRevision: uuid(14),
    compositionPolicyRevision: uuid(10),
    balancePolicy: balancePolicy(),
    days,
    ordinaryFallbackProof: {
      candidatePoolDigest: hash('a'),
      status: fallbackStatus,
      ordinaryWeekDigest: fallbackStatus === 'VALID' ? hash('b') : null,
    },
  };
}

async function sevenDays(options: { sharedRecipes?: Map<number, MealComponentCandidateV1>;
  repeatFamily?: (day: number) => string; dominant?: (day: number) => string;
  accessibility?: (day: number) => AccessibilityClassV1 } = {}): Promise<DayValidationInputV1[]> {
  const days: DayValidationInputV1[] = [];
  for (let day = 0; day < 7; day += 1) {
    const item = options.sharedRecipes?.get(day) ?? candidate({ repeatFamily: options.repeatFamily?.(day) });
    const meal = await mealFrom([item], ['MAIN_COMPONENT'], 'dinner');
    const input = mealInput(meal, [item], ['MAIN_COMPONENT'], 'COMPLETE_RECIPE', [{
      repeatFamily: item.eligibility.repeatFamily,
      dominantIngredientFamily: options.dominant?.(day) ?? `ingredient_${day}`,
      ingredientFamilies: [options.dominant?.(day) ?? `ingredient_${day}`],
      accessibility: options.accessibility?.(day) ?? 'COMMON_RU_RETAIL',
    }]);
    const date = new Date('2026-09-28T00:00:00.000Z');
    date.setUTCDate(date.getUTCDate() + day);
    days.push(dayInput(date.toISOString().slice(0, 10), [input]));
  }
  return days;
}

function validResult(status: ValidatorResultV1['status'] = 'VALID'): ValidatorResultV1 {
  const reasons: ValidatorResultV1['reasons'] = status === 'INVALID' ? [{
    code: 'MEAL_TARGET_MISMATCH', severity: 'ERROR', path: 'nutritionBounds', evidenceRevision: null,
  }] : status === 'BLOCKED_MISSING_EVIDENCE' ? [{
    code: 'GOAL_EVIDENCE_MISSING', severity: 'BLOCKER', path: 'nutritionBounds', evidenceRevision: null,
  }] : status === 'VALID_WITH_WARNINGS' ? [{
    code: 'SOFT_TARGET_FIT_DEVIATION', severity: 'WARNING', path: 'nutritionBounds', evidenceRevision: null,
  }] : [];
  return {
    contract: validatorResultContractV1,
    status,
    scope: 'MEAL',
    policyRevision: uuid(11),
    subjectDigest: hash('c'),
    reasons,
  };
}

const optimizationPolicy = (revision = uuid(15)): OptimizationPolicyV1 => ({
  contract: optimizationPolicyContractV1,
  policyRevision: revision,
  weights: { targetFit: '0.400', diversity: '0.250', convenience: '0.200', shoppingReuse: '0.150' },
});

function optimizationCandidate(overrides: Partial<OptimizationCandidateV1> = {}): OptimizationCandidateV1 {
  const policyRevision = overrides.optimizationPolicyRevision ?? uuid(15);
  return {
    candidateId: id(),
    sourceKind: 'COMPOSED_MEAL',
    validation: validResult(),
    optimizationPolicyRevision: policyRevision,
    metrics: { targetFit: '0.800', diversity: '0.800', convenience: '0.800', shoppingReuse: '0.800' },
    patternOrder: 0,
    componentIdentitySequence: [id()].sort(),
    ...overrides,
  };
}

const calorieCorridor = (): GoalNutritionTargetV1 => goalTarget({
  target: '1650.000', min: '1600.000', max: '1700.000',
});

async function validateCalorieDay(actualCalories: string): Promise<ValidatorResultV1> {
  const item = candidate({ nutrition: n(actualCalories) });
  const meal = await mealFrom([item], ['MAIN_COMPONENT'], 'dinner');
  return validateDaySnapshotV1(dayInput('2026-09-28', [
    mealInput(meal, [item], ['MAIN_COMPONENT']),
  ], calorieCorridor()));
}

const targetFitInput = (actualCalories: string, target = calorieCorridor(),
  expectedTargetPolicyRevision = target.targetPolicyRevision) => ({
  contract: goalTargetFitInputContractV1,
  goalTarget: target,
  expected: { goalRevision: uuid(12), targetPolicyRevision: expectedTargetPolicyRevision },
  actualNutrition: n(actualCalories),
});

test('21: six components are invalid with COMPONENT_LIMIT_EXCEEDED', async () => {
  const components = [
    candidate(), candidate({ role: 'CARB_SIDE' }), candidate({ role: 'VEGETABLE_SIDE' }),
    candidate({ role: 'SALAD' }), candidate({ role: 'EXTRA' }), candidate({ role: 'SAUCE' }),
  ];
  const roles = components.map((item) => item.eligibility.role);
  const meal = await mealFrom(components, roles, 'dinner', 6);
  const input = mealInput(meal, components, roles.slice(0, 5));
  const checked = await validateMealSnapshotV1(input);
  assert.equal(checked.status, 'INVALID');
  assert.ok(checked.reasons.some((item) => item.code === 'COMPONENT_LIMIT_EXCEEDED'));
});

test('22: five-component reviewed pattern is valid', async () => {
  const components = [candidate(), candidate({ role: 'CARB_SIDE' }), candidate({ role: 'VEGETABLE_SIDE' }),
    candidate({ role: 'SALAD' }), candidate({ role: 'SAUCE' })];
  const roles = components.map((item) => item.eligibility.role);
  const meal = await mealFrom(components, roles);
  assert.equal((await validateMealSnapshotV1(mealInput(meal, components, roles))).status, 'VALID');
});

test('23: a third exact recipe occurrence in one week is rejected', async () => {
  const shared = candidate();
  const days = await sevenDays({ sharedRecipes: new Map([[0, shared], [2, shared], [4, shared]]) });
  const checked = await validateWeekSnapshotV1(weekInput(days));
  assert.ok(checked.reasons.some((item) => item.code === 'WEEK_RECIPE_REPEAT_EXCEEDED'));
});

test('24: the same recipe twice on one civil day is rejected', async () => {
  const shared = candidate();
  const first = await mealFrom([shared], ['MAIN_COMPONENT'], 'lunch');
  const second = await mealFrom([shared], ['MAIN_COMPONENT'], 'dinner');
  const checked = await validateDaySnapshotV1(dayInput('2026-10-05', [
    mealInput(first, [shared], ['MAIN_COMPONENT']), mealInput(second, [shared], ['MAIN_COMPONENT']),
  ]));
  assert.ok(checked.reasons.some((item) => item.code === 'DAY_RECIPE_REPEAT_EXCEEDED'));
});

test('25: a fourth repeatFamily occurrence in one week is rejected', async () => {
  const days = await sevenDays({ repeatFamily: (day) => day < 4 ? 'shared_family' : `family_${day}` });
  const checked = await validateWeekSnapshotV1(weekInput(days));
  assert.ok(checked.reasons.some((item) => item.code === 'WEEK_REPEAT_FAMILY_EXCEEDED'));
});

test('26: a fifth dominant ingredient family occurrence in one week is rejected', async () => {
  const days = await sevenDays({ dominant: (day) => day < 5 ? 'shared_ingredient' : `ingredient_${day}` });
  const checked = await validateWeekSnapshotV1(weekInput(days));
  assert.ok(checked.reasons.some((item) => item.code === 'WEEK_INGREDIENT_REPEAT_EXCEEDED'));
});

test('27: one optional specialty meal is valid with an allowed warning', async () => {
  const days = await sevenDays({ accessibility: (day) => day === 0 ? 'SPECIALTY_PRODUCT_REQUIRED' : 'COMMON_RU_RETAIL' });
  const checked = await validateWeekSnapshotV1(weekInput(days));
  assert.equal(checked.status, 'VALID_WITH_WARNINGS');
  assert.ok(checked.reasons.some((item) => item.code === 'OPTIONAL_SPECIALTY_USED'));
});

test('28: a second specialty meal exceeds the week policy', async () => {
  const days = await sevenDays({ accessibility: (day) => day < 2 ? 'SPECIALTY_PRODUCT_REQUIRED' : 'COMMON_RU_RETAIL' });
  const checked = await validateWeekSnapshotV1(weekInput(days));
  assert.ok(checked.reasons.some((item) => item.code === 'SPECIALTY_LIMIT_EXCEEDED'));
});

test('29: two expensive optional meals are allowed', async () => {
  const days = await sevenDays({ accessibility: (day) => day < 2 ? 'EXPENSIVE_OPTIONAL' : 'COMMON_RU_RETAIL' });
  const checked = await validateWeekSnapshotV1(weekInput(days));
  assert.equal(checked.status, 'VALID_WITH_WARNINGS');
  assert.ok(!checked.reasons.some((item) => item.code === 'EXPENSIVE_LIMIT_EXCEEDED'));
});

test('30: a third expensive optional meal exceeds the week policy', async () => {
  const days = await sevenDays({ accessibility: (day) => day < 3 ? 'EXPENSIVE_OPTIONAL' : 'COMMON_RU_RETAIL' });
  const checked = await validateWeekSnapshotV1(weekInput(days));
  assert.ok(checked.reasons.some((item) => item.code === 'EXPENSIVE_LIMIT_EXCEEDED'));
});

test('31: a plan dependent on specialty content fails closed', async () => {
  const checked = await validateWeekSnapshotV1(weekInput(await sevenDays(), 'UNAVAILABLE_SPECIALTY'));
  assert.ok(checked.reasons.some((item) => item.code === 'SPECIALTY_DEPENDENCY_REQUIRED'));
});

test('32: a plan dependent on expensive optional content fails closed', async () => {
  const checked = await validateWeekSnapshotV1(weekInput(await sevenDays(), 'UNAVAILABLE_EXPENSIVE'));
  assert.ok(checked.reasons.some((item) => item.code === 'EXPENSIVE_DEPENDENCY_REQUIRED'));
});

test('33: a lunch+dinner eligibility revision is valid at lunch', async () => {
  const item = candidate({ allowedMealTypes: ['lunch', 'dinner'] });
  const meal = await mealFrom([item], ['MAIN_COMPONENT'], 'lunch');
  assert.equal((await validateMealSnapshotV1(mealInput(meal, [item], ['MAIN_COMPONENT']))).status, 'VALID');
});

test('34: the same lunch+dinner eligibility revision is valid at dinner', async () => {
  const item = candidate({ allowedMealTypes: ['lunch', 'dinner'] });
  const meal = await mealFrom([item], ['MAIN_COMPONENT'], 'dinner');
  assert.equal((await validateMealSnapshotV1(mealInput(meal, [item], ['MAIN_COMPONENT']))).status, 'VALID');
});

test('35: source lineage cannot authorize dinner when allowedMealTypes contains only lunch', async () => {
  const item = finalizeCandidate(candidate({ allowedMealTypes: ['lunch'] }));
  const result = await composeAdaptiveMealV1({
    mealSlotId: id(), mealSnapshotRevision: id(), mealType: 'dinner', goalRevision: uuid(12),
    goalProfile: 'MAINTENANCE', policy: compositionPolicy([['MAIN_COMPONENT']]),
    slotTarget: item.nutrition, slotHardMaximum: high, currentDayNutrition: zero,
    dayTarget: high, dayHardMaximum: high, excludedRecipeRevisions: [], excludedRepeatFamilies: [],
    candidates: [item],
  });
  assert.equal(result.status, 'INCOMPLETE');
});

test('36: legacy meal_type is irrelevant when reviewed allowedMealTypes authorizes dinner', async () => {
  const item = candidate({ allowedMealTypes: ['dinner'] });
  const meal = await mealFrom([item], ['MAIN_COMPONENT'], 'dinner');
  assert.equal((await validateMealSnapshotV1(mealInput(meal, [item], ['MAIN_COMPONENT']))).status, 'VALID');
});

test('37: invalid candidate with a perfect score is never optimized', async () => {
  const policy = optimizationPolicy();
  const invalid = optimizationCandidate({ validation: validResult('INVALID'), optimizationPolicyRevision: policy.policyRevision,
    metrics: { targetFit: '1.000', diversity: '1.000', convenience: '1.000', shoppingReuse: '1.000' } });
  const valid = optimizationCandidate({ optimizationPolicyRevision: policy.policyRevision,
    metrics: { targetFit: '0.500', diversity: '0.500', convenience: '0.500', shoppingReuse: '0.500' } });
  const result = await optimizeValidMealsV1({ contract: optimizationInputContractV1, policy, candidates: [invalid, valid] });
  assert.equal(result.selectedCandidateId, valid.candidateId);
  assert.equal(result.score, '0.500');
});

test('38: equal valid scores prefer COMPLETE_RECIPE only as a deterministic tie-break', async () => {
  const policy = optimizationPolicy();
  const composed = optimizationCandidate({ sourceKind: 'COMPOSED_MEAL', optimizationPolicyRevision: policy.policyRevision });
  const complete = optimizationCandidate({ sourceKind: 'COMPLETE_RECIPE', optimizationPolicyRevision: policy.policyRevision });
  const result = await optimizeValidMealsV1({ contract: optimizationInputContractV1, policy,
    candidates: [composed, complete] });
  assert.equal(result.selectedCandidateId, complete.candidateId);
});

test('39: repeated optimization with identical bytes and revisions is byte-identical', async () => {
  const policy = optimizationPolicy();
  const firstCandidate = optimizationCandidate({ optimizationPolicyRevision: policy.policyRevision });
  const value = { contract: optimizationInputContractV1, policy, candidates: [firstCandidate] };
  assert.deepEqual(await optimizeValidMealsV1(value), await optimizeValidMealsV1(structuredClone(value)));
});

test('40: changed optimization revision changes digest and stale candidates cannot be reused', async () => {
  const firstPolicy = optimizationPolicy(uuid(15));
  const firstCandidate = optimizationCandidate({ optimizationPolicyRevision: firstPolicy.policyRevision });
  const first = await optimizeValidMealsV1({ contract: optimizationInputContractV1,
    policy: firstPolicy, candidates: [firstCandidate] });
  const secondPolicy = optimizationPolicy(uuid(16));
  await assert.rejects(() => optimizeValidMealsV1({ contract: optimizationInputContractV1,
    policy: secondPolicy, candidates: [firstCandidate] }), /stale_optimization_policy_revision/);
  const rebound = { ...firstCandidate, optimizationPolicyRevision: secondPolicy.policyRevision };
  const second = await optimizeValidMealsV1({ contract: optimizationInputContractV1,
    policy: secondPolicy, candidates: [rebound] });
  assert.notEqual(first.digest, second.digest);
});

test('strict optimization DTO rejects unknown validator reason codes', async () => {
  const policy = optimizationPolicy();
  const value = optimizationCandidate({ optimizationPolicyRevision: policy.policyRevision });
  value.validation = {
    ...value.validation,
    status: 'INVALID',
    reasons: [{ code: 'UNKNOWN_REASON' as ValidatorReasonCodeV1, severity: 'ERROR', path: 'meal',
      evidenceRevision: null }],
  };
  await assert.rejects(() => optimizeValidMealsV1({
    contract: optimizationInputContractV1,
    policy,
    candidates: [value],
  }), /invalid_validation_reason_code/);
});

test('44: exact calorie target inside its hard corridor is valid', async () => {
  assert.equal((await validateCalorieDay('1650.000')).status, 'VALID');
});

test('45: a non-exact calorie value inside the hard corridor is valid', async () => {
  assert.equal((await validateCalorieDay('1648.000')).status, 'VALID');
});

test('46: the upper calorie boundary is inclusive', async () => {
  assert.equal((await validateCalorieDay('1700.000')).status, 'VALID');
});

test('47: the lower calorie boundary is inclusive', async () => {
  assert.equal((await validateCalorieDay('1600.000')).status, 'VALID');
});

test('48: calories above the hard maximum are invalid', async () => {
  const result = await validateCalorieDay('1700.001');
  assert.equal(result.status, 'INVALID');
  assert.ok(result.reasons.some((item) => item.code === 'DAY_TARGET_MISMATCH'));
});

test('49: calories below the hard minimum are invalid', async () => {
  const result = await validateCalorieDay('1599.999');
  assert.equal(result.status, 'INVALID');
  assert.ok(result.reasons.some((item) => item.code === 'DAY_TARGET_MISMATCH'));
});

test('50: 1648 ranks closer to 1650 than 1675 with the same hard corridor', async () => {
  const closer = await calculateGoalTargetFitV1(targetFitInput('1648.000'));
  const farther = await calculateGoalTargetFitV1(targetFitInput('1675.000'));
  assert.equal(closer.score, '0.960');
  assert.equal(farther.score, '0.500');
  assert.ok(decimalMinor(closer.score) > decimalMinor(farther.score));
});

test('51: practical 1640 remains eligible while an exact but DISCRETE-invalid candidate is rejected', async () => {
  assert.equal((await validateCalorieDay('1640.000')).status, 'VALID');
  const policy = optimizationPolicy();
  const practicalFit = await calculateGoalTargetFitV1(targetFitInput('1640.000'));
  const practical = optimizationCandidate({ optimizationPolicyRevision: policy.policyRevision,
    metrics: { targetFit: practicalFit.score, diversity: '0.500', convenience: '0.500', shoppingReuse: '0.500' } });
  const invalidExact = optimizationCandidate({ optimizationPolicyRevision: policy.policyRevision,
    validation: {
      ...validResult('INVALID'),
      reasons: [{ code: 'DISCRETE_FRACTION_REQUIRED', severity: 'ERROR', path: 'meal.components.0',
        evidenceRevision: null }],
    },
    metrics: { targetFit: '1.000', diversity: '1.000', convenience: '1.000', shoppingReuse: '1.000' } });
  const result = await optimizeValidMealsV1({
    contract: optimizationInputContractV1, policy, candidates: [invalidExact, practical],
  });
  assert.equal(result.selectedCandidateId, practical.candidateId);
});

test('52: an unauthorized optional side stays invalid even when it reaches the exact calorie target', async () => {
  const main = candidate({ nutrition: n('1640.000') });
  const extra = candidate({ role: 'EXTRA', anchorKind: 'NONE', nutrition: n('10.000') });
  const meal = await mealFrom([main, extra], ['MAIN_COMPONENT', 'EXTRA'], 'dinner');
  const input = mealInput(meal, [main, extra], ['MAIN_COMPONENT', 'EXTRA'], 'COMPOSED_MEAL');
  input.compositionPolicy = compositionPolicy([['MAIN_COMPONENT']]);
  const result = await validateMealSnapshotV1(input);
  assert.equal(meal.nutrition.calories, '1650.000');
  assert.equal(result.status, 'INVALID');
  assert.ok(result.reasons.some((item) => item.code === 'ROLE_PATTERN_NOT_ALLOWED'));
});

test('53: a Goal target rejects min greater than target', () => {
  assert.throws(() => decodeGoalNutritionTargetV1(goalTarget({
    target: '1650.000', min: '1650.001', max: '1700.000',
  })), /invalid_goal_target_calories_order/);
});

test('54: a Goal target rejects target greater than max', () => {
  assert.throws(() => decodeGoalNutritionTargetV1(goalTarget({
    target: '1700.001', min: '1600.000', max: '1700.000',
  })), /invalid_goal_target_calories_order/);
});

test('55: required calorie bounds cannot be omitted', () => {
  const malformed = { ...calorieCorridor(), calories: { target: '1650.000', max: '1700.000' } };
  assert.throws(() => decodeGoalNutritionTargetV1(malformed), /invalid_goal_target_calories_fields/);
});

test('56: changed target policy revision cannot reuse stale target-fit evidence', async () => {
  const changed = calorieCorridor();
  changed.targetPolicyRevision = uuid(18);
  await assert.rejects(() => calculateGoalTargetFitV1(targetFitInput('1650.000', changed, uuid(17))),
    /stale_target_policy_revision/);
});

test('57: identical Goal target bytes and revisions produce byte-identical target-fit evidence', async () => {
  const value = targetFitInput('1648.000');
  assert.deepEqual(await calculateGoalTargetFitV1(value), await calculateGoalTargetFitV1(structuredClone(value)));
});
