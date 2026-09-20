import type { NutritionScope } from '../types/adaptiveNutrition';
import { nutritionWeekDates, shiftNutritionDate } from './nutritionWeek';

export interface PlannedShoppingMeal {
  date: string;
  slotId: string;
  recipeId: string;
  servings: number;
}

/** Catalog annotation supplied only after canonical review, never title resolution. */
export interface ShoppingRecipeComposition {
  recipeId: string;
  baseServings: number;
  ingredients: Array<{
    name: string;
    canonicalFoodId: string | null;
    state: 'raw' | 'dry' | 'frozen' | 'cooked' | 'as-sold';
    grams: number | null;
  }>;
}

export function deriveActiveWeekShoppingPreview(input: {
  currentUserId: string;
  scope: NutritionScope;
  today: string;
  fromDate: string;
  dayCount: 1 | 2 | 3 | 7;
  meals: PlannedShoppingMeal[];
  compositions: ShoppingRecipeComposition[];
}) {
  if (!input.currentUserId.trim() || input.scope.userId !== input.currentUserId ||
      Object.values(input.scope).some((value) => !value.trim())) throw new Error('invalid_shopping_scope');
  if (![1, 2, 3, 7].includes(input.dayCount)) throw new Error('invalid_shopping_period');
  const week = new Set(nutritionWeekDates(input.today));
  const dates = Array.from({ length: input.dayCount }, (_, i) => shiftNutritionDate(input.fromDate, i));
  if (dates.some((date) => !week.has(date))) throw new Error('shopping_period_outside_active_week');
  const selected = input.meals.filter((meal) => dates.includes(meal.date));
  const seen = new Set<string>();
  const products = new Map<string, { canonicalFoodId: string; state: ShoppingRecipeComposition['ingredients'][number]['state'];
    name: string; grams: number; recipeIds: string[] }>();
  const issues: Array<{ date: string; slotId: string; reason: string }> = [];
  for (const meal of selected) {
    const occurrence = `${meal.date}:${meal.slotId}`;
    if (!meal.slotId.trim() || !meal.recipeId.trim() || seen.has(occurrence)) throw new Error('duplicate_or_invalid_shopping_slot');
    seen.add(occurrence);
    const candidates = input.compositions.filter((recipe) => recipe.recipeId === meal.recipeId);
    const recipe = candidates.length === 1 ? candidates[0] : null;
    if (!recipe || !Number.isFinite(meal.servings) || meal.servings <= 0 ||
        !Number.isFinite(recipe.baseServings) || recipe.baseServings <= 0 || !recipe.ingredients.length) {
      issues.push({ date: meal.date, slotId: meal.slotId, reason: 'composition_or_portion_unavailable' });
      continue;
    }
    for (const ingredient of recipe.ingredients) {
      const foodId = ingredient.canonicalFoodId;
      if (!foodId || !/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(foodId) ||
          ingredient.grams === null || !Number.isFinite(ingredient.grams) || ingredient.grams <= 0) {
        issues.push({ date: meal.date, slotId: meal.slotId, reason: 'canonical_amount_unavailable' });
        continue;
      }
      const grams = ingredient.grams * (meal.servings / recipe.baseServings);
      const key = `${foodId}:${ingredient.state}`;
      const previous = products.get(key);
      const total = (previous?.grams ?? 0) + grams;
      if (!Number.isFinite(total) || total <= 0) {
        issues.push({ date: meal.date, slotId: meal.slotId, reason: 'amount_overflow' });
        continue;
      }
      products.set(key, { canonicalFoodId: foodId, state: ingredient.state, name: previous?.name ?? ingredient.name,
        grams: total, recipeIds: [...new Set([...(previous?.recipeIds ?? []), meal.recipeId])] });
    }
  }
  // Do not return a partial list that appears sufficient for the selected meals.
  return { scope: { ...input.scope }, fromDate: dates[0], toDate: dates[dates.length - 1],
    status: issues.length ? 'review-required' as const : 'preview' as const,
    products: issues.length ? [] : [...products.values()], issues, selectedMealCount: selected.length,
    createsDiaryFact: false as const };
}
