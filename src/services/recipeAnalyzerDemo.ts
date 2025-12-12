import { demoProducts } from '../data/demoProducts';
import { CalculatedIngredient } from '../utils/nutritionCalculator';
import { parseRecipeText } from '../utils/recipeParser';
import { pieceWeights } from '../data/unitConversions';

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

function gramsFromParsed(amount: number | null, unit: string | null, name: string): number {
  if (amount === null || !unit) return 0;
  if (unit === 'g') return amount;
  if (unit === 'ml') return amount; // плотность ~1
  if (unit === 'pcs') {
    const key = Object.keys(pieceWeights).find((k) => name.toLowerCase().includes(k));
    return amount * (key ? pieceWeights[key] : pieceWeights['шт'] || 50);
  }
  return 0;
}

export function analyzeRecipeTextDemo(text: string): CalculatedIngredient[] {
  const parsed = parseRecipeText(text);
  return parsed.map((p) => {
    const grams = gramsFromParsed(p.amount, p.unit, p.name);
    const prod = matchDemoProduct(p.name);
    if (!prod) {
      return {
        ...p,
        amountGrams: grams,
        proteins: 0,
        fats: 0,
        carbs: 0,
        calories: 0,
      } as CalculatedIngredient;
    }
    const k = grams / 100;
    return {
      ...p,
      amountGrams: grams,
      proteins: prod.protein * k,
      fats: prod.fat * k,
      carbs: prod.carbs * k,
      calories: prod.calories * k,
    } as CalculatedIngredient;
  });
}

