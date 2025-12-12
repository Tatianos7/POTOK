import { demoProducts } from '../data/demoProducts';
import { parseIngredients, ParsedIngredient } from '../utils/ingredientParser';
import { CalculatedIngredient } from '../utils/nutritionCalculator';

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

function calcForIngredient(p: ParsedIngredient): CalculatedIngredient {
  const prod = matchDemoProduct(p.name);
  if (!prod) {
    return {
      ...p,
      proteins: 0,
      fats: 0,
      carbs: 0,
      calories: 0,
    };
  }
  const k = p.amountGrams / 100;
  return {
    ...p,
    proteins: prod.protein * k,
    fats: prod.fat * k,
    carbs: prod.carbs * k,
    calories: prod.calories * k,
  };
}

export function analyzeRecipeTextDemo(text: string): CalculatedIngredient[] {
  const parsed = parseIngredients(text);
  return parsed.map(calcForIngredient);
}

