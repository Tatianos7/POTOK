import type {
  PremiumMealRecipeOption,
  PremiumMealSlot,
  PremiumPlan,
  PremiumPlanDay,
  PremiumRecipeDetail,
  PremiumShoppingListItem,
} from './premiumCatalogService';

export type TodayPlanKind = 'combined' | 'nutrition' | 'workout' | 'time_saver';

export interface TodayMealDetail {
  title: string;
  summary: string;
  calories: string;
  macroDetails: string;
  ingredients: string[];
  portionHints: string[];
  steps: string[];
  catalogSlotId?: string;
  catalogPrimaryRecipeId?: string;
}

export interface TodayPlanDay {
  day: number;
  macros: string;
  calories: string;
  macroDetails: string;
  meals: TodayMealDetail[];
  catalogDayId?: string;
  workout: {
    title: string;
    duration: string;
    focus: string;
  } | null;
}

export interface TodayPlan {
  id: string;
  kind: TodayPlanKind;
  title: string;
  subtitle: string;
  description: string;
  days: TodayPlanDay[];
}

export interface TodayReplacementOption extends TodayMealDetail {
  id: string;
  note: string;
  optionType: string;
  recipeId: string;
}

export interface TodayShoppingProduct {
  name: string;
  amount: number;
  unit: string;
  displayAmounts: string[];
  recipeIds: string[];
  isDerivedCatalogAmount?: boolean;
}

export interface TodayShoppingGroup {
  title: string;
  products: TodayShoppingProduct[];
}

export interface BuildTodayPlanInput {
  plan: PremiumPlan | null | undefined;
  days?: PremiumPlanDay[] | null;
  slotsByDayId?: Record<string, PremiumMealSlot[] | undefined>;
  primaryRecipeBySlotId?: Record<string, PremiumRecipeDetail | undefined>;
}

const mealTypeLabels: Record<string, string> = {
  breakfast: 'Завтрак',
  lunch: 'Обед',
  dinner: 'Ужин',
  snack: 'Перекус',
};

function formatNumber(value: number | null | undefined): string {
  if (value === null || value === undefined) return '0';
  return Number.isInteger(value) ? String(value) : value.toFixed(1);
}

function formatCalories(value: number | null | undefined): string {
  return `${formatNumber(value)} ккал`;
}

function formatMacroDetails(values: {
  protein: number | null | undefined;
  fat: number | null | undefined;
  carbs: number | null | undefined;
}): string {
  return `Б ${formatNumber(values.protein)} · Ж ${formatNumber(values.fat)} · У ${formatNumber(values.carbs)}`;
}

function formatMacroSummary(values: {
  calories: number | null | undefined;
  protein: number | null | undefined;
  fat: number | null | undefined;
  carbs: number | null | undefined;
}): string {
  return `${formatCalories(values.calories)} · ${formatMacroDetails(values)}`;
}

function mealTypeToTitle(mealType: PremiumMealSlot['mealType'] | string | null | undefined): string {
  if (!mealType) return 'Приём пищи';
  return mealTypeLabels[mealType] ?? mealType;
}

function planKindFromGoalType(goalType: string): TodayPlanKind {
  const normalized = goalType.toLowerCase();
  if (normalized.includes('time')) return 'time_saver';
  if (normalized.includes('workout') || normalized.includes('training')) return 'workout';
  return 'nutrition';
}

function formatIngredientName(name: string, amountG: number | null, displayAmount: string): string {
  const amount = displayAmount || (amountG === null ? '' : `${formatNumber(amountG)} г`);
  return amount ? `${name} — ${amount}` : name;
}

export function mapPremiumRecipeDetailToTodayMealDetail(
  recipe: PremiumRecipeDetail | null | undefined,
  slot?: PremiumMealSlot | null
): TodayMealDetail {
  const title = slot ? mealTypeToTitle(slot.mealType) : recipe?.category ? mealTypeToTitle(recipe.category) : 'Приём пищи';
  const summary = recipe?.title ?? slot?.title ?? 'Блюдо';
  const calories = formatCalories(slot?.calories ?? recipe?.calories);
  const macroDetails = formatMacroDetails({
    protein: slot?.protein ?? recipe?.protein,
    fat: slot?.fat ?? recipe?.fat,
    carbs: slot?.carbs ?? recipe?.carbs,
  });

  return {
    title,
    summary,
    calories,
    macroDetails,
    ingredients:
      recipe?.ingredients.map((ingredient) =>
        formatIngredientName(ingredient.name, ingredient.amountG, ingredient.displayAmount)
      ) ?? [],
    portionHints: recipe?.hints.map((hint) => hint.text) ?? [],
    steps: recipe?.steps.map((step) => step.instruction) ?? [],
  };
}

export function mapPremiumMealSlotsToTodayMeals(
  slots: PremiumMealSlot[] | null | undefined,
  primaryRecipeBySlotId: Record<string, PremiumRecipeDetail | undefined> = {}
): TodayMealDetail[] {
  return (slots ?? [])
    .slice()
    .sort((a, b) => a.sortOrder - b.sortOrder)
    .map((slot) => {
      const recipe = primaryRecipeBySlotId[slot.id];
      const meal = mapPremiumRecipeDetailToTodayMealDetail(recipe, slot);

      return {
        ...meal,
        title: mealTypeToTitle(slot.mealType),
        summary: recipe?.title ?? slot.title,
        calories: formatCalories(slot.calories),
        macroDetails: formatMacroDetails(slot),
        catalogSlotId: slot.id,
        catalogPrimaryRecipeId: recipe?.id,
      };
    });
}

export function mapPremiumPlanDaysToTodayDays(
  days: PremiumPlanDay[] | null | undefined,
  slotsByDayId: Record<string, PremiumMealSlot[] | undefined> = {},
  primaryRecipeBySlotId: Record<string, PremiumRecipeDetail | undefined> = {}
): TodayPlanDay[] {
  return (days ?? [])
    .slice()
    .sort((a, b) => a.dayNumber - b.dayNumber)
    .map((day) => {
      const workout =
        day.workoutTitle || day.workoutDurationMin || day.workoutFocus
          ? {
              title: day.workoutTitle || 'Активность',
              duration: day.workoutDurationMin === null ? '' : `${day.workoutDurationMin} минут`,
              focus: day.workoutFocus,
            }
          : null;

      return {
        day: day.dayNumber,
        macros: formatMacroSummary(day),
        calories: formatCalories(day.calories),
        macroDetails: formatMacroDetails(day),
        meals: mapPremiumMealSlotsToTodayMeals(slotsByDayId[day.id], primaryRecipeBySlotId),
        catalogDayId: day.id,
        workout,
      };
    });
}

export function mapPremiumPlanToTodayPlan(plan: PremiumPlan | null | undefined, days: TodayPlanDay[] = []): TodayPlan {
  if (!plan) {
    return {
      id: '',
      kind: 'nutrition',
      title: '',
      subtitle: '',
      description: '',
      days,
    };
  }

  return {
    id: plan.id,
    kind: planKindFromGoalType(plan.goalType),
    title: plan.title,
    subtitle: [plan.subtitle, `${plan.durationDays} дней`].filter(Boolean).join(' · '),
    description: plan.subtitle || `Read-only Premium catalog plan for ${plan.durationDays} days.`,
    days,
  };
}

export function mapMealRecipeOptionsToReplacementOptions(
  options: PremiumMealRecipeOption[] | null | undefined,
  recipeDetailsById: Record<string, PremiumRecipeDetail | undefined> = {}
): TodayReplacementOption[] {
  return (options ?? [])
    .slice()
    .sort((a, b) => a.sortOrder - b.sortOrder)
    .map((option) => {
      const recipe = option.recipeId ? recipeDetailsById[option.recipeId] : undefined;
      const meal = mapPremiumRecipeDetailToTodayMealDetail(recipe);
      const recipeSummary = recipe ? recipe.title : option.recipe?.title ?? option.label ?? 'Замена';

      return {
        ...meal,
        id: option.id,
        recipeId: option.recipeId,
        optionType: option.optionType,
        summary: recipeSummary,
        calories: recipe ? formatCalories(recipe.calories) : meal.calories,
        macroDetails: recipe ? formatMacroDetails(recipe) : meal.macroDetails,
        note: option.label || option.optionType || 'read-only option',
      };
    });
}

export function mapDerivedShoppingListToShoppingGroups(
  items: PremiumShoppingListItem[] | null | undefined
): TodayShoppingGroup[] {
  const products = (items ?? [])
    .slice()
    .sort((a, b) => a.name.localeCompare(b.name))
    .map((item) => ({
      name: item.name,
      amount: item.amountG ?? 0,
      unit: 'г',
      displayAmounts: item.displayAmounts,
      recipeIds: item.recipeIds,
      isDerivedCatalogAmount: true,
    }));

  return products.length === 0
    ? []
    : [
        {
          title: 'Список',
          products,
        },
      ];
}

export function buildTodayPlanFromPremiumCatalog(input: BuildTodayPlanInput): TodayPlan {
  const days = mapPremiumPlanDaysToTodayDays(input.days, input.slotsByDayId, input.primaryRecipeBySlotId);
  return mapPremiumPlanToTodayPlan(input.plan, days);
}
