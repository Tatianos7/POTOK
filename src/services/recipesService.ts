import { Recipe, RecipeTab } from '../types/recipe';
import { trackEvent } from './analyticsService';
import { supabase } from '../lib/supabaseClient';
import { aiMealPlansService } from './aiMealPlansService';
import { normalizeFoodText } from '../utils/foodNormalizer';
import {
  getOptionalSupabaseResourceState,
  isOptionalSupabaseResourceMissingError,
  setOptionalSupabaseResourceState,
} from '../utils/optionalSupabaseResource';

export class RecipeSaveValidationError extends Error {
  code: 'unresolved_ingredients';
  unresolvedIngredients: string[];

  constructor(message: string, unresolvedIngredients: string[]) {
    super(message);
    this.name = 'RecipeSaveValidationError';
    this.code = 'unresolved_ingredients';
    this.unresolvedIngredients = unresolvedIngredients;
  }
}

export function ensureRecipeIngredientsResolved(
  ingredients: Array<{ name: string; canonical_food_id?: string | null }>
): void {
  const isValidUUID = (value: unknown): value is string =>
    typeof value === 'string' &&
    /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(value);

  const unresolvedIngredients = ingredients
    .filter((ingredient) => !ingredient.canonical_food_id || !isValidUUID(ingredient.canonical_food_id))
    .map((ingredient) => ingredient.name)
    .filter(Boolean);

  if (unresolvedIngredients.length > 0) {
    throw new RecipeSaveValidationError('Some ingredients are not matched to foods catalog', unresolvedIngredients);
  }
}

class RecipesService {
  private async listOptionalRelationRecipeIds(
    table: 'favorite_recipes' | 'recipe_collections',
    userId: string
  ): Promise<string[]> {
    if (!supabase) {
      return [];
    }

    const cachedState = getOptionalSupabaseResourceState(table);
    if (cachedState === 'missing') {
      return [];
    }

    const { data, error } = await supabase
      .from(table)
      .select('recipe_id')
      .eq('user_id', userId);

    if (error) {
      if (isOptionalSupabaseResourceMissingError(error)) {
        setOptionalSupabaseResourceState(table, 'missing');
        return [];
      }
      throw error;
    }

    setOptionalSupabaseResourceState(table, 'present');
    return (data || []).map((row: any) => row.recipe_id).filter(Boolean);
  }

  private mapGraphRowToIngredient(row: any) {
    const grams = Number(row.amount_g) || 0;
    const calories100 = Number(row.food?.calories) || 0;
    const proteins100 = Number(row.food?.protein) || 0;
    const fats100 = Number(row.food?.fat) || 0;
    const carbs100 = Number(row.food?.carbs) || 0;
    const k = grams / 100;

    return {
      name: row.food?.name || 'Unknown',
      canonical_food_id: row.food_id ?? null,
      quantity: grams,
      unit: 'г',
      grams,
      calories: calories100 * k,
      proteins: proteins100 * k,
      fats: fats100 * k,
      carbs: carbs100 * k,
    };
  }

  private async loadIngredientsFromGraph(recipeIds: string[]): Promise<Map<string, Recipe['ingredients']>> {
    const map = new Map<string, Recipe['ingredients']>();
    if (!supabase || recipeIds.length === 0) return map;

    const { data, error } = await supabase
      .from('recipe_ingredients')
      .select('recipe_id, food_id, amount_g, food:foods(id,name,calories,protein,fat,carbs)')
      .in('recipe_id', recipeIds);

    if (error || !data) {
      return map;
    }

    for (const row of data) {
      const recipeId = String((row as any).recipe_id ?? '');
      if (!recipeId) continue;
      if (!map.has(recipeId)) map.set(recipeId, []);
      const list = map.get(recipeId)!;
      list.push(this.mapGraphRowToIngredient(row));
    }

    return map;
  }

  private applyGraphIngredients(recipes: Recipe[], graph: Map<string, Recipe['ingredients']>): Recipe[] {
    return recipes.map((recipe) => {
      const graphIngredients = graph.get(recipe.id);
      if (graphIngredients && graphIngredients.length > 0) {
        return {
          ...recipe,
          ingredients: graphIngredients,
        };
      }
      return recipe;
    });
  }

  private async logZeroTotalsDiagnostics(recipeId: string): Promise<void> {
    if (!supabase) return;
    const { data, error } = await supabase
      .from('recipe_ingredients')
      .select('food_id, amount_g, food:foods(id,name,calories,protein,fat,carbs)')
      .eq('recipe_id', recipeId);
    if (error || !data) return;

    const invalidRows = data
      .map((row: any) => ({
        food_id: row.food_id,
        food_name: row.food?.name || 'unknown',
        amount_g: Number(row.amount_g) || 0,
        calories: Number(row.food?.calories),
        protein: Number(row.food?.protein),
        fat: Number(row.food?.fat),
        carbs: Number(row.food?.carbs),
      }))
      .filter((row) =>
        !Number.isFinite(row.calories) ||
        !Number.isFinite(row.protein) ||
        !Number.isFinite(row.fat) ||
        !Number.isFinite(row.carbs) ||
        ((row.calories || 0) === 0 && (row.protein || 0) === 0 && (row.fat || 0) === 0 && (row.carbs || 0) === 0)
      );

    if (invalidRows.length > 0) {
      console.warn('[recipesService] recompute_recipe_totals produced zero/invalid nutrients for foods:', {
        recipeId,
        invalidRows,
      });
    }
  }

  private isValidUUID(id: string): boolean {
    return /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(id);
  }

  private async getSessionUserId(userId?: string): Promise<string> {
    if (!supabase) {
      throw new Error('Supabase не инициализирован');
    }

    const { data, error } = await supabase.auth.getUser();
    if (error || !data?.user?.id) {
      throw new Error('Пользователь не авторизован');
    }

    if (userId && userId !== data.user.id) {
      console.warn('[recipesService] Передан userId не совпадает с сессией');
    }

    return data.user.id;
  }

  private async resolveCanonicalFoodId(name: string): Promise<string | null> {
    if (!supabase) {
      throw new Error('Supabase не инициализирован');
    }
    const normalized = normalizeFoodText(name);
    if (!normalized) {
      return null;
    }

    const { data: foods, error: foodError } = await supabase
      .from('foods')
      .select('id')
      .eq('normalized_name', normalized)
      .limit(1);
    if (!foodError && foods && foods.length > 0) {
      return foods[0].id;
    }

    const { data: aliases, error: aliasError } = await supabase
      .from('food_aliases')
      .select('canonical_food_id')
      .eq('normalized_alias', normalized)
      .limit(1);
    if (!aliasError && aliases && aliases.length > 0) {
      return aliases[0].canonical_food_id;
    }

    return null;
  }

  private async assertNoRecipeConflict(recipeId: string, expectedUpdatedAt?: string): Promise<void> {
    if (!expectedUpdatedAt) {
      return;
    }
    if (!supabase) {
      throw new Error('Supabase не инициализирован');
    }
    const { data, error } = await supabase
      .from('recipes')
      .select('updated_at')
      .eq('id', recipeId)
      .single();
    if (error) {
      throw error;
    }
    const currentUpdatedAt = data?.updated_at;
    if (currentUpdatedAt && currentUpdatedAt !== expectedUpdatedAt) {
      throw new Error('[recipesService] Conflict detected: recipe was updated');
    }
  }

  private mapRowToRecipe(row: any): Recipe {
    return {
      id: row.id,
      name: row.name,
      image: row.image ?? null,
      totalCalories: Number(row.total_calories) || 0,
      totalProteins: Number(row.protein) || 0,
      totalFats: Number(row.fat) || 0,
      totalCarbs: Number(row.carbs) || 0,
      ingredients: Array.isArray(row.ingredients) ? row.ingredients : [],
      instructions: row.instructions ?? undefined,
      source: row.source ?? 'manual',
      createdAt: row.created_at,
      updatedAt: row.updated_at,
      userId: row.user_id,
    };
  }

  private assertIngredients(ingredients: Recipe['ingredients']): void {
    if (!ingredients || ingredients.length === 0) {
      throw new Error('[recipesService] Recipe has no ingredients');
    }

    const invalid = ingredients.some((ing) =>
      !ing.name ||
      !Number.isFinite(ing.grams) ||
      ing.grams < 0 ||
      !Number.isFinite(ing.calories) ||
      ing.calories < 0 ||
      !Number.isFinite(ing.proteins) ||
      ing.proteins < 0 ||
      !Number.isFinite(ing.fats) ||
      ing.fats < 0 ||
      !Number.isFinite(ing.carbs) ||
      ing.carbs < 0
    );

    if (invalid) {
      throw new Error('[recipesService] Invalid ingredient values');
    }
  }

  private calcTotals(ingredients: Recipe['ingredients']) {
    const totals = ingredients?.reduce(
      (sum, ing) => ({
        calories: sum.calories + (ing.calories || 0),
        proteins: sum.proteins + (ing.proteins || 0),
        fats: sum.fats + (ing.fats || 0),
        carbs: sum.carbs + (ing.carbs || 0),
      }),
      { calories: 0, proteins: 0, fats: 0, carbs: 0 }
    );

    return totals ?? { calories: 0, proteins: 0, fats: 0, carbs: 0 };
  }

  async getAllRecipes(userId: string): Promise<Recipe[]> {
    if (!supabase) {
      throw new Error('Supabase не инициализирован');
    }
    const sessionUserId = await this.getSessionUserId(userId);
    const { data, error } = await supabase
      .from('recipes')
      .select('*')
      .eq('user_id', sessionUserId)
      .order('created_at', { ascending: false })
      .limit(200);

    if (error) {
      throw error;
    }

    const recipes = (data || []).map((row) => this.mapRowToRecipe(row));
    const graph = await this.loadIngredientsFromGraph(recipes.map((recipe) => recipe.id));
    return this.applyGraphIngredients(recipes, graph);
  }

  async getRecipesByTab(tab: RecipeTab, userId?: string): Promise<Recipe[]> {
    if (!supabase) {
      return [];
    }

    if (!userId) {
      return [];
    }

    const sessionUserId = await this.getSessionUserId(userId);

    if (tab === 'my') {
      return this.getAllRecipes(sessionUserId);
    }

    if (tab === 'favorites') {
      const ids = await this.listOptionalRelationRecipeIds('favorite_recipes', sessionUserId);
      if (ids.length === 0) {
        return [];
      }
      const { data, error: recipesError } = await supabase
        .from('recipes')
        .select('*')
        .in('id', ids)
        .order('created_at', { ascending: false });

      if (recipesError) {
        throw recipesError;
      }

      const recipes = (data || []).map((row) => this.mapRowToRecipe(row));
      const graph = await this.loadIngredientsFromGraph(recipes.map((recipe) => recipe.id));
      return this.applyGraphIngredients(recipes, graph);
    }

    if (tab === 'collection') {
      const ids = await this.listOptionalRelationRecipeIds('recipe_collections', sessionUserId);
      if (ids.length === 0) {
        return [];
      }
      const { data, error: recipesError } = await supabase
        .from('recipes')
        .select('*')
        .in('id', ids)
        .order('created_at', { ascending: false });

      if (recipesError) {
        throw recipesError;
      }

      const recipes = (data || []).map((row) => this.mapRowToRecipe(row));
      const graph = await this.loadIngredientsFromGraph(recipes.map((recipe) => recipe.id));
      return this.applyGraphIngredients(recipes, graph);
    }

    return [];
  }

  async addToFavorites(recipeId: string, userId: string): Promise<void> {
    if (!supabase) {
      throw new Error('Supabase не инициализирован');
    }
    const sessionUserId = await this.getSessionUserId(userId);
    const { error } = await supabase
      .from('favorite_recipes')
      .upsert({ user_id: sessionUserId, recipe_id: recipeId }, { onConflict: 'user_id,recipe_id' });
    if (error) {
      throw error;
    }
  }

  async removeFromFavorites(recipeId: string, userId: string): Promise<void> {
    if (!supabase) {
      throw new Error('Supabase не инициализирован');
    }
    const sessionUserId = await this.getSessionUserId(userId);
    const { error } = await supabase
      .from('favorite_recipes')
      .delete()
      .eq('user_id', sessionUserId)
      .eq('recipe_id', recipeId);
    if (error) {
      throw error;
    }
  }

  async addToCollection(recipeId: string, userId: string): Promise<void> {
    if (!supabase) {
      throw new Error('Supabase не инициализирован');
    }
    const sessionUserId = await this.getSessionUserId(userId);
    const { error } = await supabase
      .from('recipe_collections')
      .upsert({ user_id: sessionUserId, recipe_id: recipeId }, { onConflict: 'user_id,recipe_id' });
    if (error) {
      throw error;
    }
  }

  async removeFromCollection(recipeId: string, userId: string): Promise<void> {
    if (!supabase) {
      throw new Error('Supabase не инициализирован');
    }
    const sessionUserId = await this.getSessionUserId(userId);
    const { error } = await supabase
      .from('recipe_collections')
      .delete()
      .eq('user_id', sessionUserId)
      .eq('recipe_id', recipeId);
    if (error) {
      throw error;
    }
  }

  async saveRecipe(recipe: Recipe): Promise<Recipe> {
    if (!supabase) {
      throw new Error('Supabase не инициализирован');
    }
    if (!recipe.userId) {
      throw new Error('[recipesService] Missing userId');
    }
    if (!recipe.name || recipe.name.trim().length === 0) {
      throw new Error('[recipesService] Missing recipe name');
    }

    const sessionUserId = await this.getSessionUserId(recipe.userId);
    const ingredients = recipe.ingredients ?? [];
    const enrichedIngredients = await Promise.all(
      ingredients.map(async (ingredient) => {
        if (ingredient.canonical_food_id) {
          return ingredient;
        }
        try {
          const canonicalId = await this.resolveCanonicalFoodId(ingredient.name);
          return { ...ingredient, canonical_food_id: canonicalId };
        } catch (error) {
          return ingredient;
        }
      })
    );
    this.assertIngredients(enrichedIngredients);
    ensureRecipeIngredientsResolved(enrichedIngredients);
    const totals = this.calcTotals(enrichedIngredients);

    const payload: any = {
      user_id: sessionUserId,
      name: recipe.name,
      ingredients: enrichedIngredients,
      total_calories: totals.calories,
      protein: totals.proteins,
      fat: totals.fats,
      carbs: totals.carbs,
      updated_at: new Date().toISOString(),
    };

    let saved: Recipe;

    if (recipe.id && this.isValidUUID(recipe.id)) {
      await this.assertNoRecipeConflict(recipe.id, recipe.updatedAt);
      const { data, error } = await supabase
        .from('recipes')
        .upsert({ id: recipe.id, ...payload }, { onConflict: 'id' })
        .select('*')
        .single();

      if (error) {
        throw error;
      }
      saved = this.mapRowToRecipe(data);
    } else {
      const { data, error } = await supabase
        .from('recipes')
        .insert(payload)
        .select('*')
        .single();

      if (error) {
        throw error;
      }
      saved = this.mapRowToRecipe(data);
    }

    const ingredientRows = enrichedIngredients.map((ingredient) => ({
      recipe_id: saved.id,
      food_id: ingredient.canonical_food_id as string,
      amount_g: Number(ingredient.grams) || 0,
    }));

    const { error: deleteIngredientsError } = await supabase
      .from('recipe_ingredients')
      .delete()
      .eq('recipe_id', saved.id);
    if (deleteIngredientsError) {
      throw deleteIngredientsError;
    }

    if (ingredientRows.length > 0) {
      const { error: insertIngredientsError } = await supabase
        .from('recipe_ingredients')
        .insert(ingredientRows);
      if (insertIngredientsError) {
        throw insertIngredientsError;
      }
    }

    const { error: recomputeError } = await supabase.rpc('recompute_recipe_totals', {
      recipe_id: saved.id,
    });
    if (recomputeError) {
      throw recomputeError;
    }

    const { data: refreshedRecipe, error: refreshError } = await supabase
      .from('recipes')
      .select('*')
      .eq('id', saved.id)
      .eq('user_id', sessionUserId)
      .single();
    if (!refreshError && refreshedRecipe) {
      saved = this.mapRowToRecipe(refreshedRecipe);
    }

    if ((saved.totalCalories ?? 0) === 0 && ingredientRows.length > 0) {
      await this.logZeroTotalsDiagnostics(saved.id);
    }

    void trackEvent({
      name: 'save_recipe',
      userId: sessionUserId,
      metadata: {
        recipe_id: saved.id,
        source: saved.source || 'manual',
      },
    });

    try {
      await aiMealPlansService.markMealPlansOutdated(sessionUserId);
    } catch (error) {
      console.error('[recipesService] Error marking AI meal plans outdated:', error);
    }

    return saved;
  }

  async createRecipeFromMeal(data: {
    name: string;
    note?: string;
    mealEntries: Array<{
      foodId: string;
      food: {
        id: string;
        name: string;
        canonical_food_id?: string | null;
      };
      weight: number;
      calories: number;
      protein: number;
      fat: number;
      carbs: number;
    }>;
    userId: string;
  }): Promise<Recipe> {
    const ingredients = data.mealEntries.map((entry) => ({
      name: entry.food.name,
      canonical_food_id: entry.food.canonical_food_id ?? null,
      quantity: entry.weight,
      unit: 'г',
      grams: entry.weight,
      calories: entry.calories,
      proteins: entry.protein,
      fats: entry.fat,
      carbs: entry.carbs,
    }));

    const totals = this.calcTotals(ingredients);

    const recipe: Recipe = {
      id: '',
      name: data.name,
      image: null,
      totalCalories: totals.calories,
      totalProteins: totals.proteins,
      totalFats: totals.fats,
      totalCarbs: totals.carbs,
      ingredients,
      instructions: data.note || undefined,
      source: 'meal',
      userId: data.userId,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };

    return this.saveRecipe(recipe);
  }

  async createRecipeFromAnalyzer(data: {
    name: string;
    image?: string | null;
    totalCalories: number;
    totalProteins: number;
    totalFats: number;
    totalCarbs: number;
    ingredients: Array<{
      name: string;
      quantity: number;
      unit: string;
      grams: number;
      calories: number;
      proteins: number;
      fats: number;
      carbs: number;
      display_amount?: string | null;
      display_unit?: string | null;
    }>;
    userId: string;
  }): Promise<Recipe> {
    const recipe: Recipe = {
      id: '',
      name: data.name,
      image: data.image || null,
      totalCalories: data.totalCalories,
      totalProteins: data.totalProteins,
      totalFats: data.totalFats,
      totalCarbs: data.totalCarbs,
      ingredients: data.ingredients,
      source: 'recipe_analyzer',
      userId: data.userId,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };

    return this.saveRecipe(recipe);
  }

  async deleteRecipe(recipeId: string, userId: string): Promise<void> {
    if (!supabase) {
      throw new Error('Supabase не инициализирован');
    }
    const sessionUserId = await this.getSessionUserId(userId);
    const { error } = await supabase
      .from('recipes')
      .delete()
      .eq('id', recipeId)
      .eq('user_id', sessionUserId);

    if (error) {
      throw error;
    }

    try {
      await aiMealPlansService.markMealPlansOutdated(sessionUserId);
    } catch (error) {
      console.error('[recipesService] Error marking AI meal plans outdated:', error);
    }
  }

  async requestMealPlan(
    userId: string,
    context: { goals?: { calories: number; protein: number; fat: number; carbs: number } | null; preferences?: Record<string, unknown> } = {}
  ): Promise<void> {
    const sessionUserId = await this.getSessionUserId(userId);
    await aiMealPlansService.queueMealPlan(sessionUserId, {
      goals: context.goals ?? null,
      preferences: context.preferences ?? undefined,
    });
  }

  async getRecipeById(recipeId: string, userId: string): Promise<Recipe | null> {
    if (!supabase) {
      throw new Error('Supabase не инициализирован');
    }
    const sessionUserId = await this.getSessionUserId(userId);
    const { data, error } = await supabase
      .from('recipes')
      .select('*')
      .eq('id', recipeId)
      .eq('user_id', sessionUserId)
      .single();

    if (error) {
      return null;
    }

    const recipe = this.mapRowToRecipe(data);
    const graph = await this.loadIngredientsFromGraph([recipe.id]);
    const withGraph = this.applyGraphIngredients([recipe], graph);
    return withGraph[0] ?? recipe;
  }
}

export const recipesService = new RecipesService();
