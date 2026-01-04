import { CATEGORY_DEFAULTS } from '../data/categoryDefaults';
import { Food } from '../types';

export interface AnalyzedIngredient {
  id: string;
  name: string;
  grams?: number;
  caloriesPer100?: number;
  proteinPer100?: number;
  fatPer100?: number;
  carbsPer100?: number;
}

type HFResult = Array<{ label: string; score: number }>;

const HF_API_TOKEN =
  typeof import.meta !== 'undefined' && (import.meta as any)?.env?.VITE_HF_API_TOKEN
    ? (import.meta as any).env.VITE_HF_API_TOKEN
    : '';

const FOOD_LABEL_MAP: Record<string, { ru: string; category: keyof typeof CATEGORY_DEFAULTS }> = {
  'bell pepper': { ru: 'Перец болгарский', category: 'vegetables' },
  'pepper': { ru: 'Перец', category: 'vegetables' },
  'tomato': { ru: 'Помидор', category: 'vegetables' },
  'chicken breast': { ru: 'Курица', category: 'meat' },
  'chicken': { ru: 'Курица', category: 'meat' },
  'rice': { ru: 'Рис отварной', category: 'grains' },
  'salmon': { ru: 'Лосось', category: 'fish' },
  'beef': { ru: 'Говядина', category: 'meat' },
  'pork': { ru: 'Свинина', category: 'meat' },
  'cheese': { ru: 'Сыр', category: 'dairy' },
  'milk': { ru: 'Молоко', category: 'dairy' },
  'egg': { ru: 'Яйцо', category: 'dairy' },
  'bread': { ru: 'Хлеб', category: 'grains' },
  'apple': { ru: 'Яблоко', category: 'fruits' },
  'banana': { ru: 'Банан', category: 'fruits' },
  'orange': { ru: 'Апельсин', category: 'fruits' },
  'pizza': { ru: 'Пицца', category: 'fastfood' },
  'burger': { ru: 'Бургер', category: 'fastfood' },
  'sandwich': { ru: 'Сэндвич', category: 'fastfood' },
  'salad': { ru: 'Салат', category: 'vegetables' },
  'pasta': { ru: 'Макароны', category: 'grains' },
  'noodles': { ru: 'Лапша', category: 'grains' },
  'potato': { ru: 'Картофель', category: 'vegetables' },
  'avocado': { ru: 'Авокадо', category: 'fruits' },
};

const defaultForCategory = (category?: keyof typeof CATEGORY_DEFAULTS) => {
  if (category && CATEGORY_DEFAULTS[category]) return CATEGORY_DEFAULTS[category];
  return CATEGORY_DEFAULTS.vegetables;
};

class RecipePhotoAnalyzer {
  private async requestHF(model: string, file: File): Promise<HFResult> {
    if (!HF_API_TOKEN) {
      throw new Error('HF token is missing. Set VITE_HF_API_TOKEN in .env');
    }
    const url = `https://api-inference.huggingface.co/models/${model}`;
    const res = await fetch(url, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${HF_API_TOKEN}`,
        'Content-Type': file.type || 'application/octet-stream',
      },
      body: file,
    });

    if (!res.ok) {
      const text = await res.text();
      throw new Error(`HF inference failed: ${res.status} ${text}`);
    }

    const data = (await res.json()) as HFResult;
    return data;
  }

  private mapLabel(label: string): { name: string; category: keyof typeof CATEGORY_DEFAULTS | undefined } {
    const key = label.toLowerCase();
    if (FOOD_LABEL_MAP[key]) {
      return { name: FOOD_LABEL_MAP[key].ru, category: FOOD_LABEL_MAP[key].category };
    }
    // Fallback: capitalize original label
    const name = key.charAt(0).toUpperCase() + key.slice(1);
    return { name, category: undefined };
  }

  private toIngredient(label: string): AnalyzedIngredient {
    const mapped = this.mapLabel(label);
    const defaults = defaultForCategory(mapped.category);
    return {
      id: `ing_${crypto.randomUUID()}`,
      name: mapped.name,
      grams: undefined,
      caloriesPer100: defaults.calories,
      proteinPer100: defaults.protein,
      fatPer100: defaults.fat,
      carbsPer100: defaults.carbs,
    };
  }

  async analyze(file: File): Promise<AnalyzedIngredient[]> {
    if (!file || file.size === 0) {
      throw new Error('Не удалось определить ингредиенты. Попробуйте другое фото.');
    }

    const models = ['nateraw/food-101', 'microsoft/beit-base-patch16-224-pt22k-ft22k'];
    let results: HFResult = [];
    let lastError: unknown = null;

    for (const model of models) {
      try {
        const r = await this.requestHF(model, file);
        if (Array.isArray(r) && r.length) {
          results = r;
          break;
        }
      } catch (err) {
        lastError = err;
      }
    }

    if (!results.length) {
      throw lastError || new Error('Не удалось определить ингредиенты. Попробуйте другое фото.');
    }

    const filtered = results.filter((item) => item.score >= 0.15);
    if (!filtered.length) {
      throw new Error('Не удалось определить ингредиенты. Попробуйте другое фото.');
    }

    return filtered.map((item) => this.toIngredient(item.label));
  }

  /**
   * Преобразование ингредиента в Food с автозаполнением макросов.
   */
  toFood(ing: AnalyzedIngredient): Food {
    const defaults = defaultForCategory(undefined);
    const calories = ing.caloriesPer100 ?? defaults.calories;
    const protein = ing.proteinPer100 ?? defaults.protein;
    const fat = ing.fatPer100 ?? defaults.fat;
    const carbs = ing.carbsPer100 ?? defaults.carbs;

    return {
      id: `recipe_${crypto.randomUUID()}`,
      name: ing.name,
      name_original: ing.name,
      calories,
      protein,
      fat,
      carbs,
      barcode: null,
      category: undefined,
      brand: null,
      source: 'user',
      photo: null,
      aliases: [],
      autoFilled: true,
      popularity: 0,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };
  }
}

export const recipePhotoAnalyzer = new RecipePhotoAnalyzer();

