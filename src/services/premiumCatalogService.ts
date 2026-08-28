import type { SupabaseClient } from '@supabase/supabase-js';
import { supabase } from '../lib/supabaseClient';

export const PREMIUM_CATALOG_READ_MODE = 'staging_readonly';

export function isPremiumCatalogStagingReadMode(): boolean {
  const mode =
    typeof import.meta !== 'undefined'
      ? (import.meta as unknown as { env?: Record<string, string | undefined> }).env?.VITE_PREMIUM_CATALOG_READ_MODE
      : undefined;

  return mode === PREMIUM_CATALOG_READ_MODE;
}

export type PremiumCatalogError = 'supabase_unavailable' | 'read_failed';

export type PremiumCatalogResult<T> =
  | { ok: true; data: T; source: 'supabase' }
  | { ok: false; data: T; source: 'fallback'; error: PremiumCatalogError };

export interface PremiumPlanRow {
  id: string;
  title: string;
  subtitle: string | null;
  goal_type: string | null;
  duration_days: number;
  difficulty: string | null;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

export interface PremiumPlanDayRow {
  id: string;
  premium_plan_id: string;
  day_number: number;
  calories: number | null;
  protein: number | string | null;
  fat: number | string | null;
  carbs: number | string | null;
  workout_title: string | null;
  workout_duration_min: number | null;
  workout_focus: string | null;
  created_at: string;
  updated_at: string;
}

export interface PremiumMealSlotRow {
  id: string;
  premium_plan_day_id: string;
  meal_type: 'breakfast' | 'lunch' | 'dinner' | 'snack' | null;
  title: string;
  calories: number | null;
  protein: number | string | null;
  fat: number | string | null;
  carbs: number | string | null;
  sort_order: number;
}

export interface PremiumRecipeRow {
  id: string;
  title: string;
  category: string | null;
  calories: number | null;
  protein: number | string | null;
  fat: number | string | null;
  carbs: number | string | null;
  cooking_time_min: number | null;
  difficulty_label: string | null;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

export interface PremiumRecipeIngredientRow {
  id: string;
  premium_recipe_id: string;
  ingredient_name: string;
  amount_g: number | string | null;
  display_amount: string | null;
  sort_order: number;
}

export interface PremiumRecipeStepRow {
  id: string;
  premium_recipe_id: string;
  step_number: number;
  instruction: string;
}

export interface PremiumRecipeHintRow {
  id: string;
  premium_recipe_id: string;
  hint_text: string;
  sort_order: number;
}

export interface PremiumMealRecipeOptionRow {
  id: string;
  premium_meal_slot_id: string;
  premium_recipe_id: string;
  option_type: string | null;
  label: string | null;
  sort_order: number;
}

export interface PremiumPlan {
  id: string;
  title: string;
  subtitle: string;
  goalType: string;
  durationDays: number;
  difficulty: string;
  isActive: boolean;
}

export interface PremiumPlanDay {
  id: string;
  planId: string;
  dayNumber: number;
  calories: number | null;
  protein: number | null;
  fat: number | null;
  carbs: number | null;
  workoutTitle: string;
  workoutDurationMin: number | null;
  workoutFocus: string;
}

export interface PremiumMealSlot {
  id: string;
  dayId: string;
  mealType: PremiumMealSlotRow['meal_type'];
  title: string;
  calories: number | null;
  protein: number | null;
  fat: number | null;
  carbs: number | null;
  sortOrder: number;
}

export interface PremiumRecipe {
  id: string;
  title: string;
  category: string;
  calories: number | null;
  protein: number | null;
  fat: number | null;
  carbs: number | null;
  cookingTimeMin: number | null;
  difficultyLabel: string;
  isActive: boolean;
}

export interface PremiumRecipeIngredient {
  id: string;
  recipeId: string;
  name: string;
  amountG: number | null;
  displayAmount: string;
  sortOrder: number;
}

export interface PremiumRecipeStep {
  id: string;
  recipeId: string;
  stepNumber: number;
  instruction: string;
}

export interface PremiumRecipeHint {
  id: string;
  recipeId: string;
  text: string;
  sortOrder: number;
}

export interface PremiumMealRecipeOption {
  id: string;
  mealSlotId: string;
  recipeId: string;
  optionType: string;
  label: string;
  sortOrder: number;
  recipe?: PremiumRecipe;
}

export interface PremiumPlanDetail extends PremiumPlan {
  days: PremiumPlanDay[];
}

export interface PremiumRecipeDetail extends PremiumRecipe {
  ingredients: PremiumRecipeIngredient[];
  steps: PremiumRecipeStep[];
  hints: PremiumRecipeHint[];
}

export interface PremiumShoppingListItem {
  name: string;
  amountG: number | null;
  displayAmounts: string[];
  recipeIds: string[];
}

export interface PremiumShoppingDayRange {
  startDay: number;
  endDay: number;
}

export interface PremiumCatalogService {
  getActivePremiumPlans(): Promise<PremiumCatalogResult<PremiumPlan[]>>;
  getPremiumPlanDetail(planId: string): Promise<PremiumCatalogResult<PremiumPlanDetail | null>>;
  getPremiumPlanDays(planId: string): Promise<PremiumCatalogResult<PremiumPlanDay[]>>;
  getPremiumPlanDay(planId: string, dayNumber: number): Promise<PremiumCatalogResult<PremiumPlanDay | null>>;
  getPremiumMealSlots(dayId: string): Promise<PremiumCatalogResult<PremiumMealSlot[]>>;
  getPremiumRecipeLibrary(): Promise<PremiumCatalogResult<PremiumRecipe[]>>;
  getPremiumRecipeDetail(recipeId: string): Promise<PremiumCatalogResult<PremiumRecipeDetail | null>>;
  getMealRecipeOptions(slotId: string): Promise<PremiumCatalogResult<PremiumMealRecipeOption[]>>;
  buildDerivedShoppingList(
    planId: string,
    dayRange: PremiumShoppingDayRange
  ): Promise<PremiumCatalogResult<PremiumShoppingListItem[]>>;
}

function toNumber(value: number | string | null | undefined): number | null {
  if (value === null || value === undefined) return null;
  const numberValue = Number(value);
  return Number.isFinite(numberValue) ? numberValue : null;
}

function fallback<T>(data: T, error: PremiumCatalogError): PremiumCatalogResult<T> {
  return { ok: false, data, source: 'fallback', error };
}

function success<T>(data: T): PremiumCatalogResult<T> {
  return { ok: true, data, source: 'supabase' };
}

export function mapPremiumPlan(row: PremiumPlanRow): PremiumPlan {
  return {
    id: row.id,
    title: row.title,
    subtitle: row.subtitle ?? '',
    goalType: row.goal_type ?? '',
    durationDays: row.duration_days,
    difficulty: row.difficulty ?? '',
    isActive: row.is_active,
  };
}

export function mapPremiumPlanDay(row: PremiumPlanDayRow): PremiumPlanDay {
  return {
    id: row.id,
    planId: row.premium_plan_id,
    dayNumber: row.day_number,
    calories: row.calories,
    protein: toNumber(row.protein),
    fat: toNumber(row.fat),
    carbs: toNumber(row.carbs),
    workoutTitle: row.workout_title ?? '',
    workoutDurationMin: row.workout_duration_min,
    workoutFocus: row.workout_focus ?? '',
  };
}

export function mapPremiumMealSlot(row: PremiumMealSlotRow): PremiumMealSlot {
  return {
    id: row.id,
    dayId: row.premium_plan_day_id,
    mealType: row.meal_type,
    title: row.title,
    calories: row.calories,
    protein: toNumber(row.protein),
    fat: toNumber(row.fat),
    carbs: toNumber(row.carbs),
    sortOrder: row.sort_order,
  };
}

export function mapPremiumRecipe(row: PremiumRecipeRow): PremiumRecipe {
  return {
    id: row.id,
    title: row.title,
    category: row.category ?? '',
    calories: row.calories,
    protein: toNumber(row.protein),
    fat: toNumber(row.fat),
    carbs: toNumber(row.carbs),
    cookingTimeMin: row.cooking_time_min,
    difficultyLabel: row.difficulty_label ?? '',
    isActive: row.is_active,
  };
}

export function mapPremiumRecipeIngredient(row: PremiumRecipeIngredientRow): PremiumRecipeIngredient {
  return {
    id: row.id,
    recipeId: row.premium_recipe_id,
    name: row.ingredient_name,
    amountG: toNumber(row.amount_g),
    displayAmount: row.display_amount ?? '',
    sortOrder: row.sort_order,
  };
}

export function mapPremiumRecipeStep(row: PremiumRecipeStepRow): PremiumRecipeStep {
  return {
    id: row.id,
    recipeId: row.premium_recipe_id,
    stepNumber: row.step_number,
    instruction: row.instruction,
  };
}

export function mapPremiumRecipeHint(row: PremiumRecipeHintRow): PremiumRecipeHint {
  return {
    id: row.id,
    recipeId: row.premium_recipe_id,
    text: row.hint_text,
    sortOrder: row.sort_order,
  };
}

export function mapPremiumMealRecipeOption(row: PremiumMealRecipeOptionRow): PremiumMealRecipeOption {
  return {
    id: row.id,
    mealSlotId: row.premium_meal_slot_id,
    recipeId: row.premium_recipe_id,
    optionType: row.option_type ?? '',
    label: row.label ?? '',
    sortOrder: row.sort_order,
  };
}

export function createPremiumCatalogService(client: SupabaseClient | null = supabase): PremiumCatalogService {
  const unavailable = <T>(data: T) => fallback(data, 'supabase_unavailable');
  const readFailed = <T>(data: T) => fallback(data, 'read_failed');

  const service: PremiumCatalogService = {
    async getActivePremiumPlans() {
      if (!client) return unavailable([]);

      const { data, error } = await client
        .from('premium_plans')
        .select('id,title,subtitle,goal_type,duration_days,difficulty,is_active,created_at,updated_at')
        .eq('is_active', true)
        .order('created_at', { ascending: false });

      if (error) return readFailed([]);
      return success(((data ?? []) as PremiumPlanRow[]).map(mapPremiumPlan));
    },

    async getPremiumPlanDetail(planId) {
      if (!client) return unavailable(null);

      const planQuery = await client
        .from('premium_plans')
        .select('id,title,subtitle,goal_type,duration_days,difficulty,is_active,created_at,updated_at')
        .eq('id', planId)
        .maybeSingle();

      if (planQuery.error) return readFailed(null);
      if (!planQuery.data) return success(null);

      const daysQuery = await service.getPremiumPlanDays(planId);
      return success({
        ...mapPremiumPlan(planQuery.data as PremiumPlanRow),
        days: daysQuery.data,
      });
    },

    async getPremiumPlanDays(planId) {
      if (!client) return unavailable([]);

      const { data, error } = await client
        .from('premium_plan_days')
        .select(
          'id,premium_plan_id,day_number,calories,protein,fat,carbs,workout_title,workout_duration_min,workout_focus,created_at,updated_at'
        )
        .eq('premium_plan_id', planId)
        .order('day_number', { ascending: true });

      if (error) return readFailed([]);
      return success(((data ?? []) as PremiumPlanDayRow[]).map(mapPremiumPlanDay));
    },

    async getPremiumPlanDay(planId, dayNumber) {
      if (!client) return unavailable(null);

      const { data, error } = await client
        .from('premium_plan_days')
        .select(
          'id,premium_plan_id,day_number,calories,protein,fat,carbs,workout_title,workout_duration_min,workout_focus,created_at,updated_at'
        )
        .eq('premium_plan_id', planId)
        .eq('day_number', dayNumber)
        .maybeSingle();

      if (error) return readFailed(null);
      return success(data ? mapPremiumPlanDay(data as PremiumPlanDayRow) : null);
    },

    async getPremiumMealSlots(dayId) {
      if (!client) return unavailable([]);

      const { data, error } = await client
        .from('premium_meal_slots')
        .select('id,premium_plan_day_id,meal_type,title,calories,protein,fat,carbs,sort_order')
        .eq('premium_plan_day_id', dayId)
        .order('sort_order', { ascending: true });

      if (error) return readFailed([]);
      return success(((data ?? []) as PremiumMealSlotRow[]).map(mapPremiumMealSlot));
    },

    async getPremiumRecipeLibrary() {
      if (!client) return unavailable([]);

      const { data, error } = await client
        .from('premium_recipes')
        .select('id,title,category,calories,protein,fat,carbs,cooking_time_min,difficulty_label,is_active,created_at,updated_at')
        .eq('is_active', true)
        .order('category', { ascending: true })
        .order('title', { ascending: true });

      if (error) return readFailed([]);
      return success(((data ?? []) as PremiumRecipeRow[]).map(mapPremiumRecipe));
    },

    async getPremiumRecipeDetail(recipeId) {
      if (!client) return unavailable(null);

      const recipeQuery = await client
        .from('premium_recipes')
        .select('id,title,category,calories,protein,fat,carbs,cooking_time_min,difficulty_label,is_active,created_at,updated_at')
        .eq('id', recipeId)
        .maybeSingle();

      if (recipeQuery.error) return readFailed(null);
      if (!recipeQuery.data) return success(null);

      const ingredientsQuery = await client
        .from('premium_recipe_ingredients')
        .select('id,premium_recipe_id,ingredient_name,amount_g,display_amount,sort_order')
        .eq('premium_recipe_id', recipeId)
        .order('sort_order', { ascending: true });

      const stepsQuery = await client
        .from('premium_recipe_steps')
        .select('id,premium_recipe_id,step_number,instruction')
        .eq('premium_recipe_id', recipeId)
        .order('step_number', { ascending: true });

      const hintsQuery = await client
        .from('premium_recipe_hints')
        .select('id,premium_recipe_id,hint_text,sort_order')
        .eq('premium_recipe_id', recipeId)
        .order('sort_order', { ascending: true });

      if (ingredientsQuery.error || stepsQuery.error || hintsQuery.error) return readFailed(null);

      return success({
        ...mapPremiumRecipe(recipeQuery.data as PremiumRecipeRow),
        ingredients: ((ingredientsQuery.data ?? []) as PremiumRecipeIngredientRow[]).map(mapPremiumRecipeIngredient),
        steps: ((stepsQuery.data ?? []) as PremiumRecipeStepRow[]).map(mapPremiumRecipeStep),
        hints: ((hintsQuery.data ?? []) as PremiumRecipeHintRow[]).map(mapPremiumRecipeHint),
      });
    },

    async getMealRecipeOptions(slotId) {
      if (!client) return unavailable([]);

      const { data, error } = await client
        .from('premium_meal_recipe_options')
        .select('id,premium_meal_slot_id,premium_recipe_id,option_type,label,sort_order')
        .eq('premium_meal_slot_id', slotId)
        .order('sort_order', { ascending: true });

      if (error) return readFailed([]);

      const options = ((data ?? []) as PremiumMealRecipeOptionRow[]).map(mapPremiumMealRecipeOption);
      const recipeIds = Array.from(new Set(options.map((option) => option.recipeId)));

      if (recipeIds.length === 0) return success(options);

      const recipeQuery = await client
        .from('premium_recipes')
        .select('id,title,category,calories,protein,fat,carbs,cooking_time_min,difficulty_label,is_active,created_at,updated_at')
        .in('id', recipeIds);

      if (recipeQuery.error) return readFailed([]);

      const recipesById = new Map(
        ((recipeQuery.data ?? []) as PremiumRecipeRow[]).map((row) => [row.id, mapPremiumRecipe(row)])
      );

      return success(options.map((option) => ({ ...option, recipe: recipesById.get(option.recipeId) })));
    },

    async buildDerivedShoppingList(planId, dayRange) {
      if (!client) return unavailable([]);

      const daysQuery = await client
        .from('premium_plan_days')
        .select('id')
        .eq('premium_plan_id', planId)
        .gte('day_number', dayRange.startDay)
        .lte('day_number', dayRange.endDay);

      if (daysQuery.error) return readFailed([]);

      const dayIds = ((daysQuery.data ?? []) as Array<{ id: string }>).map((day) => day.id);
      if (dayIds.length === 0) return success([]);

      const slotsQuery = await client
        .from('premium_meal_slots')
        .select('id')
        .in('premium_plan_day_id', dayIds);

      if (slotsQuery.error) return readFailed([]);

      const slotIds = ((slotsQuery.data ?? []) as Array<{ id: string }>).map((slot) => slot.id);
      if (slotIds.length === 0) return success([]);

      const optionsQuery = await client
        .from('premium_meal_recipe_options')
        .select('premium_recipe_id,option_type')
        .in('premium_meal_slot_id', slotIds)
        .eq('option_type', 'primary');

      if (optionsQuery.error) return readFailed([]);

      const recipeIds = Array.from(
        new Set(((optionsQuery.data ?? []) as Array<{ premium_recipe_id: string }>).map((option) => option.premium_recipe_id))
      );
      if (recipeIds.length === 0) return success([]);

      const ingredientsQuery = await client
        .from('premium_recipe_ingredients')
        .select('premium_recipe_id,ingredient_name,amount_g,display_amount')
        .in('premium_recipe_id', recipeIds);

      if (ingredientsQuery.error) return readFailed([]);

      const byName = new Map<string, PremiumShoppingListItem>();
      for (const ingredient of (ingredientsQuery.data ?? []) as Array<
        Pick<PremiumRecipeIngredientRow, 'premium_recipe_id' | 'ingredient_name' | 'amount_g' | 'display_amount'>
      >) {
        const existing =
          byName.get(ingredient.ingredient_name) ??
          ({
            name: ingredient.ingredient_name,
            amountG: 0,
            displayAmounts: [],
            recipeIds: [],
          } satisfies PremiumShoppingListItem);
        const amountG = toNumber(ingredient.amount_g);
        existing.amountG = existing.amountG === null || amountG === null ? null : existing.amountG + amountG;
        if (ingredient.display_amount) existing.displayAmounts.push(ingredient.display_amount);
        if (!existing.recipeIds.includes(ingredient.premium_recipe_id)) existing.recipeIds.push(ingredient.premium_recipe_id);
        byName.set(ingredient.ingredient_name, existing);
      }

      return success(Array.from(byName.values()).sort((a, b) => a.name.localeCompare(b.name)));
    },
  };

  return service;
}

export const premiumCatalogService = createPremiumCatalogService();
