import type {
  PremiumCatalogResult,
  PremiumMealRecipeOption,
  PremiumMealSlot,
  PremiumPlan,
  PremiumPlanDay,
  PremiumPlanDetail,
  PremiumRecipe,
  PremiumRecipeDetail,
  PremiumShoppingListItem,
} from '../services/premiumCatalogService';

export const premiumFixturePlan: PremiumPlan = {
  id: 'premium-fixture-plan-1',
  title: 'staging_fixture_weight_loss_14_day_plan',
  subtitle: 'Mounted async test fixture',
  goalType: 'weight_loss',
  durationDays: 14,
  difficulty: 'fixture_easy',
  isActive: true,
};

export const premiumFixtureDays: PremiumPlanDay[] = [
  {
    id: 'premium-fixture-day-1',
    planId: premiumFixturePlan.id,
    dayNumber: 1,
    calories: 1850,
    protein: 135,
    fat: 58,
    carbs: 190,
    workoutTitle: 'fixture_light_walk',
    workoutDurationMin: 30,
    workoutFocus: 'recovery',
  },
  {
    id: 'premium-fixture-day-2',
    planId: premiumFixturePlan.id,
    dayNumber: 2,
    calories: 1900,
    protein: 140,
    fat: 60,
    carbs: 195,
    workoutTitle: '',
    workoutDurationMin: null,
    workoutFocus: '',
  },
];

export const premiumFixtureMealSlots: PremiumMealSlot[] = [
  {
    id: 'premium-fixture-slot-breakfast',
    dayId: premiumFixtureDays[0].id,
    mealType: 'breakfast',
    title: 'fixture_breakfast_slot',
    calories: 410,
    protein: 31,
    fat: 10,
    carbs: 52,
    sortOrder: 1,
  },
  {
    id: 'premium-fixture-slot-lunch',
    dayId: premiumFixtureDays[0].id,
    mealType: 'lunch',
    title: 'fixture_lunch_slot',
    calories: 560,
    protein: 45,
    fat: 16,
    carbs: 58,
    sortOrder: 2,
  },
  {
    id: 'premium-fixture-slot-dinner',
    dayId: premiumFixtureDays[0].id,
    mealType: 'dinner',
    title: 'fixture_dinner_slot',
    calories: 610,
    protein: 43,
    fat: 24,
    carbs: 48,
    sortOrder: 3,
  },
  {
    id: 'premium-fixture-slot-snack',
    dayId: premiumFixtureDays[0].id,
    mealType: 'snack',
    title: 'fixture_snack_slot',
    calories: 260,
    protein: 24,
    fat: 6,
    carbs: 28,
    sortOrder: 4,
  },
];

export const premiumFixtureRecipe: PremiumRecipeDetail = {
  id: 'premium-fixture-recipe-oats',
  title: 'fixture_protein_oats',
  category: 'breakfast',
  calories: 410,
  protein: 31,
  fat: 10,
  carbs: 52,
  cookingTimeMin: 10,
  difficultyLabel: 'fixture_easy',
  isActive: true,
  ingredients: [
    {
      id: 'premium-fixture-ingredient-oats',
      recipeId: 'premium-fixture-recipe-oats',
      name: 'fixture_oats',
      amountG: 45,
      displayAmount: 'half cup oats',
      sortOrder: 1,
    },
    {
      id: 'premium-fixture-ingredient-yogurt',
      recipeId: 'premium-fixture-recipe-oats',
      name: 'fixture_yogurt',
      amountG: 150,
      displayAmount: 'small cup yogurt',
      sortOrder: 2,
    },
  ],
  steps: [
    {
      id: 'premium-fixture-step-oats-1',
      recipeId: 'premium-fixture-recipe-oats',
      stepNumber: 1,
      instruction: 'Mix oats with yogurt.',
    },
    {
      id: 'premium-fixture-step-oats-2',
      recipeId: 'premium-fixture-recipe-oats',
      stepNumber: 2,
      instruction: 'Rest for five minutes.',
    },
  ],
  hints: [
    {
      id: 'premium-fixture-hint-oats',
      recipeId: 'premium-fixture-recipe-oats',
      text: 'No scale: use one small bowl.',
      sortOrder: 1,
    },
  ],
};

export const premiumFixtureReplacementRecipe: PremiumRecipeDetail = {
  ...premiumFixtureRecipe,
  id: 'premium-fixture-recipe-eggs',
  title: 'fixture_egg_plate',
  calories: 390,
  protein: 29,
  fat: 18,
  carbs: 28,
  ingredients: [
    {
      id: 'premium-fixture-ingredient-eggs',
      recipeId: 'premium-fixture-recipe-eggs',
      name: 'fixture_eggs',
      amountG: 120,
      displayAmount: 'two eggs',
      sortOrder: 1,
    },
  ],
  steps: [
    {
      id: 'premium-fixture-step-eggs-1',
      recipeId: 'premium-fixture-recipe-eggs',
      stepNumber: 1,
      instruction: 'Cook eggs until set.',
    },
  ],
  hints: [
    {
      id: 'premium-fixture-hint-eggs',
      recipeId: 'premium-fixture-recipe-eggs',
      text: 'No scale: two medium eggs.',
      sortOrder: 1,
    },
  ],
};

export const premiumFixtureRecipeLibrary: PremiumRecipe[] = [premiumFixtureRecipe, premiumFixtureReplacementRecipe].map(
  ({ ingredients, steps, hints, ...recipe }) => recipe
);

export const premiumFixtureReplacementOptions: PremiumMealRecipeOption[] = [
  {
    id: 'premium-fixture-option-primary',
    mealSlotId: premiumFixtureMealSlots[0].id,
    recipeId: premiumFixtureRecipe.id,
    optionType: 'primary',
    label: 'fixture_primary',
    sortOrder: 1,
    recipe: premiumFixtureRecipe,
  },
  {
    id: 'premium-fixture-option-replacement',
    mealSlotId: premiumFixtureMealSlots[0].id,
    recipeId: premiumFixtureReplacementRecipe.id,
    optionType: 'replacement',
    label: 'fixture_replacement',
    sortOrder: 2,
    recipe: premiumFixtureReplacementRecipe,
  },
];

export const premiumFixtureShoppingItems: PremiumShoppingListItem[] = [
  {
    name: 'fixture_oats',
    amountG: 45,
    displayAmounts: ['half cup oats'],
    recipeIds: [premiumFixtureRecipe.id],
  },
  {
    name: 'fixture_yogurt',
    amountG: 150,
    displayAmounts: ['small cup yogurt'],
    recipeIds: [premiumFixtureRecipe.id],
  },
  {
    name: 'fixture_eggs',
    amountG: 120,
    displayAmounts: ['two eggs'],
    recipeIds: [premiumFixtureReplacementRecipe.id],
  },
];

export const premiumFixturePlanDetail: PremiumPlanDetail = {
  ...premiumFixturePlan,
  days: premiumFixtureDays,
};

export function catalogSuccess<T>(data: T): PremiumCatalogResult<T> {
  return {
    ok: true,
    source: 'supabase',
    data,
  };
}

export function catalogUnavailable<T>(data: T): PremiumCatalogResult<T> {
  return {
    ok: false,
    source: 'fallback',
    error: 'supabase_unavailable',
    data,
  };
}

export function catalogReadFailed<T>(data: T): PremiumCatalogResult<T> {
  return {
    ok: false,
    source: 'fallback',
    error: 'read_failed',
    data,
  };
}

export function catalogEmptyArray<T>(): PremiumCatalogResult<T[]> {
  return catalogSuccess<T[]>([]);
}

export function createPremiumReadOnlyServiceFixture(overrides: Partial<PremiumReadOnlyServiceMock> = {}) {
  const calls: string[] = [];
  const service: PremiumReadOnlyServiceMock = {
    calls,
    async getActivePremiumPlans() {
      calls.push('getActivePremiumPlans');
      return catalogSuccess([premiumFixturePlan]);
    },
    async getPremiumPlanDetail(planId: string) {
      calls.push(`getPremiumPlanDetail:${planId}`);
      return catalogSuccess(premiumFixturePlanDetail);
    },
    async getPremiumPlanDays(planId: string) {
      calls.push(`getPremiumPlanDays:${planId}`);
      return catalogSuccess(premiumFixtureDays);
    },
    async getPremiumPlanDay(planId: string, dayNumber: number) {
      calls.push(`getPremiumPlanDay:${planId}:${dayNumber}`);
      return catalogSuccess(premiumFixtureDays.find((day) => day.dayNumber === dayNumber) ?? null);
    },
    async getPremiumMealSlots(dayId: string) {
      calls.push(`getPremiumMealSlots:${dayId}`);
      return catalogSuccess(premiumFixtureMealSlots.filter((slot) => slot.dayId === dayId));
    },
    async getPremiumRecipeLibrary() {
      calls.push('getPremiumRecipeLibrary');
      return catalogSuccess(premiumFixtureRecipeLibrary);
    },
    async getPremiumRecipeDetail(recipeId: string) {
      calls.push(`getPremiumRecipeDetail:${recipeId}`);
      const recipes = [premiumFixtureRecipe, premiumFixtureReplacementRecipe];
      return catalogSuccess(recipes.find((recipe) => recipe.id === recipeId) ?? null);
    },
    async getMealRecipeOptions(slotId: string) {
      calls.push(`getMealRecipeOptions:${slotId}`);
      return catalogSuccess(premiumFixtureReplacementOptions.filter((option) => option.mealSlotId === slotId));
    },
    async buildDerivedShoppingList(planId: string, dayRange: { startDay: number; endDay: number }) {
      calls.push(`buildDerivedShoppingList:${planId}:${dayRange.startDay}-${dayRange.endDay}`);
      return catalogSuccess(premiumFixtureShoppingItems);
    },
  };

  return {
    ...service,
    ...overrides,
    calls,
  };
}

export type PremiumReadOnlyServiceMock = {
  calls: string[];
  getActivePremiumPlans: () => Promise<PremiumCatalogResult<PremiumPlan[]>>;
  getPremiumPlanDetail: (planId: string) => Promise<PremiumCatalogResult<PremiumPlanDetail | null>>;
  getPremiumPlanDays: (planId: string) => Promise<PremiumCatalogResult<PremiumPlanDay[]>>;
  getPremiumPlanDay: (planId: string, dayNumber: number) => Promise<PremiumCatalogResult<PremiumPlanDay | null>>;
  getPremiumMealSlots: (dayId: string) => Promise<PremiumCatalogResult<PremiumMealSlot[]>>;
  getPremiumRecipeLibrary: () => Promise<PremiumCatalogResult<PremiumRecipe[]>>;
  getPremiumRecipeDetail: (recipeId: string) => Promise<PremiumCatalogResult<PremiumRecipeDetail | null>>;
  getMealRecipeOptions: (slotId: string) => Promise<PremiumCatalogResult<PremiumMealRecipeOption[]>>;
  buildDerivedShoppingList: (
    planId: string,
    dayRange: { startDay: number; endDay: number }
  ) => Promise<PremiumCatalogResult<PremiumShoppingListItem[]>>;
};
