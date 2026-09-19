import { parseRecipeText } from '../utils/recipeParser';
import { foodService } from './foodService';
import { CalculatedIngredient } from '../utils/nutritionCalculator';
import { normalizeFoodText } from '../utils/foodNormalizer';
import { canonicalFoodResolver, type FoodResolution } from './canonicalFoodResolver';

const unique = (values: string[]): string[] => {
  const seen = new Set<string>();
  return values
    .map((value) => value.trim())
    .filter(Boolean)
    .filter((value) => {
      const key = normalizeFoodText(value);
      if (!key || seen.has(key)) return false;
      seen.add(key);
      return true;
    });
};

const getIngredientSearchQueries = (name: string): string[] => {
  const normalized = name.trim().toLowerCase();
  const variants = [normalized];

  if (normalized.endsWith('ицы')) {
    variants.push(normalized.replace(/ицы$/i, 'ица'));
  }
  if (normalized.endsWith('ы')) {
    variants.push(normalized.replace(/ы$/i, 'а'));
  }
  if (normalized.endsWith('а')) {
    variants.push(normalized.replace(/а$/i, ''));
  }
  if (/^луковиц[аы]$/i.test(normalized)) {
    variants.push('лук');
  }

  return unique(variants);
};

type AnalyzerOptions = {
  userId?: string;
  resolve?: (query: string, userId?: string) => Promise<FoodResolution>;
};

const resolveIngredientFood = async (name: string, options: AnalyzerOptions): Promise<FoodResolution> => {
  const resolve = options.resolve ?? canonicalFoodResolver.resolve;
  for (const query of getIngredientSearchQueries(name)) {
    const result = await resolve(query, options.userId);
    // Never make ambiguity or a partial/failed read disappear by trying a shorter query.
    if (result.status !== 'unresolved' || result.reason !== 'no_match') return result;
  }
  return { status: 'unresolved', food: null, candidates: [], reason: 'no_match' };
};

export async function analyzeRecipeTextReal(text: string, options: AnalyzerOptions = {}): Promise<CalculatedIngredient[]> {
  const parsed = parseRecipeText(text);
  const results: CalculatedIngredient[] = [];

  for (const p of parsed) {
    const gramsEquivalent = p.quantity_g ?? p.gramsEquivalent ?? p.amountGrams;

    if (p.unitConversionWarning || !Number.isFinite(gramsEquivalent) || gramsEquivalent <= 0) {
      results.push({
        ...p,
        proteins: 0,
        fats: 0,
        carbs: 0,
        calories: 0,
        canonical_food_id: null,
        resolution_status: 'unresolved',
        resolution_reason: 'unit_conversion_missing',
        warning: p.unitConversionWarning ?? 'Не удалось определить количество в граммах.',
      });
      continue;
    }

    const resolution = await resolveIngredientFood(p.name, options);
    if (resolution.status !== 'resolved') {
      // Ranked search may suggest names, but can never assign identity.
      const suggestions = resolution.candidates.length ? resolution.candidates :
        resolution.reason === 'no_match' ? await foodService.search(p.name, { userId: options.userId, limit: 3 }).catch(() => []) : [];
      results.push({
        ...p, proteins: 0, fats: 0, carbs: 0, calories: 0, canonical_food_id: null,
        resolution_status: resolution.status,
        resolution_reason: resolution.status === 'ambiguous' ? 'catalog_ambiguous' :
          resolution.reason === 'unavailable' ? 'catalog_unavailable' : 'catalog_unmatched',
        candidate_food_names: unique(suggestions.map((food) => food.name)).slice(0, 3),
        warning: resolution.status === 'ambiguous' ? 'Найдено несколько продуктов. Уточните название ингредиента.' :
          resolution.reason === 'unavailable' ? 'Каталог недоступен. Повторите анализ позже.' : 'Ингредиент не найден в каталоге.',
      });
      continue;
    }
    const prod = resolution.food;
    const canonicalFoodId = prod.canonical_food_id;
    const nutrition = [prod.protein, prod.fat, prod.carbs, prod.calories];
    if (nutrition.some((value) => !Number.isFinite(value) || value < 0 || !Number.isFinite(value * (gramsEquivalent / 100)))) {
      results.push({
        ...p, proteins: 0, fats: 0, carbs: 0, calories: 0, canonical_food_id: null,
        resolution_status: 'unresolved', resolution_reason: 'invalid_nutrition',
        warning: 'Пищевая ценность продукта требует проверки.',
      });
      continue;
    }

    const k = gramsEquivalent / 100;
    results.push({
      ...p,
      proteins: prod.protein * k,
      fats: prod.fat * k,
      carbs: prod.carbs * k,
      calories: prod.calories * k,
      canonical_food_id: canonicalFoodId,
      resolution_status: 'resolved',
      resolution_reason: 'catalog_match',
      resolved_food_name: prod.name,
    });
  }

  return results;
}
