import { normalizeFoodText } from '../../src/utils/foodNormalizer';

export interface CatalogFood {
  id: string;
  stable_food_id: string | null;
  canonical_food_id: string | null;
  name: string;
  source: string;
  verified: boolean;
  needs_review: boolean;
  is_searchable: boolean;
  calories: number;
  protein: number;
  fat: number;
  carbs: number;
  fiber: number | null;
}

export interface RecipeCandidate {
  stable_recipe_id: string;
  title: string;
  description: string;
  category: 'breakfast' | 'lunch' | 'dinner' | 'snack';
  servings: number;
  preparation_time_min: number;
  tags: string[];
  provenance: string;
  steps: string[];
  ingredients: Array<{ stable_food_id: string; amount_g: number }>;
}

type Nutrition = { calories: number; protein: number; fat: number; carbs: number; fiber: number | null };
type Issue = { code: string; ingredient?: string; related_recipe?: string };
interface RecipeValidation {
  stable_recipe_id: string;
  status: 'valid' | 'review' | 'rejected';
  issues: Issue[];
  ingredients: Array<{ food_id: string; stable_food_id: string; amount_g: number }>;
  totals: Nutrition | null;
  per_serving: Nutrition | null;
}

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const categories = new Set(['breakfast', 'lunch', 'dinner', 'snack']);
const positive = (value: unknown): value is number => typeof value === 'number' && Number.isFinite(value) && value > 0;
const text = (value: unknown): value is string => typeof value === 'string' && value.trim().length > 0;
const round = (n: number) => Math.round(n * 100) / 100;

const scale = (nutrition: Nutrition, divisor: number): Nutrition => ({
  calories: round(nutrition.calories / divisor), protein: round(nutrition.protein / divisor),
  fat: round(nutrition.fat / divisor), carbs: round(nutrition.carbs / divisor),
  fiber: nutrition.fiber === null ? null : round(nutrition.fiber / divisor),
});

function validCandidate(value: RecipeCandidate): boolean {
  return Boolean(value && text(value.stable_recipe_id) && /^[a-z0-9_]+$/.test(value.stable_recipe_id) &&
    text(value.title) && text(value.description) && categories.has(value.category) &&
    positive(value.servings) && Number.isInteger(value.servings) && value.servings <= 20 &&
    positive(value.preparation_time_min) && value.preparation_time_min <= 480 &&
    text(value.provenance) && Array.isArray(value.tags) && value.tags.every(text) &&
    Array.isArray(value.steps) && value.steps.length > 0 && value.steps.every(text) &&
    Array.isArray(value.ingredients) && value.ingredients.length > 0 &&
    value.ingredients.every((ingredient) => ingredient && text(ingredient.stable_food_id) && positive(ingredient.amount_g) && ingredient.amount_g <= 10000));
}

/** Offline preflight only. No DB client, credentials, writes, or invented macros. */
export function validateRecipeCandidates(recipes: RecipeCandidate[], foods: CatalogFood[]) {
  const byStableId = new Map<string, CatalogFood[]>();
  for (const food of foods) {
    if (!food || !text(food.stable_food_id)) continue;
    byStableId.set(food.stable_food_id, [...(byStableId.get(food.stable_food_id) ?? []), food]);
  }
  const results: RecipeValidation[] = recipes.map((recipe) => {
    const result: RecipeValidation = {
      stable_recipe_id: recipe?.stable_recipe_id ?? '', status: 'rejected', issues: [], ingredients: [], totals: null, per_serving: null,
    };
    if (!validCandidate(recipe)) {
      result.issues.push({ code: 'invalid_recipe_content' });
      return result;
    }
    const totals: Nutrition = { calories: 0, protein: 0, fat: 0, carbs: 0, fiber: 0 };
    for (const ingredient of recipe.ingredients) {
      const matches = byStableId.get(ingredient.stable_food_id) ?? [];
      const issue = (code: string) => result.issues.push({ code, ingredient: ingredient.stable_food_id });
      if (matches.length === 0) { issue('unresolved_food'); continue; }
      if (matches.length !== 1) { issue('ambiguous_food'); continue; }
      const food = matches[0];
      if (!UUID.test(food.id) || food.canonical_food_id !== food.id) { issue('invalid_canonical_identity'); continue; }
      if (food.source !== 'core' && food.source !== 'brand') { issue('private_food_not_publishable'); continue; }
      if (food.verified !== true || food.needs_review !== false || food.is_searchable !== true) { issue('food_needs_review'); continue; }
      const required = [food.calories, food.protein, food.fat, food.carbs];
      if (required.some((n) => typeof n !== 'number' || !Number.isFinite(n) || n < 0) ||
          (food.fiber !== null && (typeof food.fiber !== 'number' || !Number.isFinite(food.fiber) || food.fiber < 0))) {
        issue('invalid_food_macros'); continue;
      }
      if (food.calories > 900 || food.protein > 100 || food.fat > 100 || food.carbs > 100 ||
          (food.fiber !== null && food.fiber > 100) || food.protein + food.fat + food.carbs > 110) {
        issue('food_macro_outlier'); continue;
      }
      const k = ingredient.amount_g / 100;
      totals.calories += food.calories * k;
      totals.protein += food.protein * k;
      totals.fat += food.fat * k;
      totals.carbs += food.carbs * k;
      totals.fiber = totals.fiber === null || food.fiber === null ? null : totals.fiber + food.fiber * k;
      result.ingredients.push({ food_id: food.id, stable_food_id: ingredient.stable_food_id, amount_g: ingredient.amount_g });
    }
    // Never expose incomplete totals as a recipe's nutrition.
    if (result.issues.length) return result;
    const perServing = scale(totals, recipe.servings);
    result.totals = scale(totals, 1);
    result.per_serving = perServing;
    if (totals.calories === 0 && totals.protein === 0 && totals.fat === 0 && totals.carbs === 0) {
      result.issues.push({ code: 'zero_macro_recipe' });
      return result;
    }
    if (perServing.calories < 50 || perServing.calories > 1500) result.issues.push({ code: 'calorie_outlier' });
    const estimatedEnergy = 4 * perServing.protein + 9 * perServing.fat + 4 * perServing.carbs;
    if (Math.abs(estimatedEnergy - perServing.calories) > Math.max(100, perServing.calories * 0.3)) result.issues.push({ code: 'macro_outlier' });
    result.status = result.issues.length ? 'review' : 'valid';
    return result;
  });

  const signatures = results.map((row, index) => {
    if (!row.totals) return null;
    const amounts = new Map<string, number>();
    for (const ingredient of row.ingredients) amounts.set(ingredient.food_id, (amounts.get(ingredient.food_id) ?? 0) + ingredient.amount_g / recipes[index].servings);
    return [...amounts].sort(([a], [b]) => a.localeCompare(b)).map(([id, grams]) => `${id}:${round(grams)}`).join('|');
  });
  for (let i = 0; i < results.length; i += 1) {
    for (let j = 0; j < i; j += 1) {
      const sameId = results[i].stable_recipe_id && results[i].stable_recipe_id === results[j].stable_recipe_id;
      const sameContent = signatures[i] !== null && signatures[i] === signatures[j];
      const a = new Set(results[i].ingredients.map((ingredient) => ingredient.food_id));
      const b = new Set(results[j].ingredients.map((ingredient) => ingredient.food_id));
      const union = new Set([...a, ...b]);
      const overlap = [...a].filter((id) => b.has(id)).length;
      const near = signatures[i] !== null && signatures[j] !== null && (
        normalizeFoodText(recipes[i].title) === normalizeFoodText(recipes[j].title) ||
        (union.size > 0 && overlap / union.size >= 0.8)
      );
      if (!sameId && !sameContent && !near) continue;
      const code = sameId || sameContent ? 'duplicate_recipe' : 'near_duplicate_recipe';
      for (const [current, other] of [[i, j], [j, i]]) {
        results[current].issues.push({ code, related_recipe: results[other].stable_recipe_id });
        if (results[current].status !== 'rejected') results[current].status = code === 'duplicate_recipe' ? 'rejected' : 'review';
      }
    }
  }
  const count = (code: string) => results.filter((row) => row.issues.some((issue) => issue.code === code)).length;
  const foodCount = (code: string) => new Set(results.flatMap((row) => row.issues.filter((issue) => issue.code === code).map((issue) => issue.ingredient))).size;
  return {
    mode: 'offline_dry_run' as const,
    publishable: false as const,
    summary: {
      total_recipes: results.length, valid: results.filter((r) => r.status === 'valid').length,
      rejected: results.filter((r) => r.status === 'rejected').length, review: results.filter((r) => r.status === 'review').length,
      unresolved_foods: foodCount('unresolved_food'), ambiguous_foods: foodCount('ambiguous_food'),
      duplicates: count('duplicate_recipe'), near_duplicates: count('near_duplicate_recipe'),
      calorie_outliers: count('calorie_outlier'), macro_outliers: results.filter((r) => r.issues.some((i) => i.code === 'macro_outlier' || i.code === 'food_macro_outlier')).length,
    },
    recipes: results,
  };
}
