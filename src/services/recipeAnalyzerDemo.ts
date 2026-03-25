import { demoProducts } from '../data/demoProducts';
import { CalculatedIngredient } from '../utils/nutritionCalculator';
import { parseRecipeText } from '../utils/recipeParser';

// Простое сопоставление ингредиента к демо-продукту по подстроке/алиасам
function matchDemoProduct(name: string) {
  const lower = name.toLowerCase();
  return (
    demoProducts.find(
      (p) =>
        p.name.toLowerCase().includes(lower) ||
        p.aliases?.some((a) => lower.includes(a.toLowerCase()))
    ) || null
  );
}

export function analyzeRecipeTextDemo(text: string): CalculatedIngredient[] {
  const parsed = parseRecipeText(text);
  return parsed.map((p) => {
    // Используем amountGrams из парсера (уже правильно рассчитано)
    const grams = p.amountGrams;
    const prod = matchDemoProduct(p.name);
    if (!prod) {
      return {
        ...p,
        proteins: 0,
        fats: 0,
        carbs: 0,
        calories: 0,
        canonical_food_id: null,
        resolution_status: 'unresolved',
        resolution_reason: 'catalog_unmatched',
      } as CalculatedIngredient;
    }
    const k = grams / 100;
    return {
      ...p,
      proteins: prod.protein * k,
      fats: prod.fat * k,
      carbs: prod.carbs * k,
      calories: prod.calories * k,
      canonical_food_id: null,
      resolution_status: 'unresolved',
      resolution_reason: 'demo_match_only',
    } as CalculatedIngredient;
  });
}
