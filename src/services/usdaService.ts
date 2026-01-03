/**
 * Сервис для работы с USDA FoodData Central API
 * Использует открытый USDA API как справочник
 * Не сохраняет сырые данные, только нормализованные продукты
 */

import { Food } from '../types';
import { normalizeFoodData } from '../utils/normalizeFoodData';

interface USDANutrient {
  nutrientId: number;
  nutrientName: string;
  value: number;
  unitName: string;
}

interface USDAFoodItem {
  fdcId: number;
  description: string;
  brandOwner?: string;
  foodNutrients?: USDANutrient[];
  foodCategory?: {
    description: string;
  };
}

interface USDASearchResponse {
  foods?: USDAFoodItem[];
  totalHits?: number;
}

/**
 * Сервис для работы с USDA FoodData Central
 */
class USDAService {
  private readonly API_BASE = 'https://api.nal.usda.gov/fdc/v1';
  // USDA API требует регистрации для получения ключа
  // Для демо можно использовать публичный доступ, но с ограничениями
  private readonly API_KEY = (import.meta.env as { VITE_USDA_API_KEY?: string }).VITE_USDA_API_KEY || 'DEMO_KEY';
  private readonly MAX_RESULTS = 20;

  /**
   * Поиск продуктов в USDA
   * @param query - Поисковый запрос
   * @returns Массив нормализованных продуктов
   */
  async searchProducts(query: string): Promise<Food[]> {
    if (!query || !query.trim()) {
      return [];
    }

    try {
      const searchUrl = new URL(`${this.API_BASE}/foods/search`);
      searchUrl.searchParams.set('query', query.trim());
      searchUrl.searchParams.set('pageSize', this.MAX_RESULTS.toString());
      searchUrl.searchParams.set('api_key', this.API_KEY);
      searchUrl.searchParams.set('dataType', 'Foundation,SR Legacy'); // Только основные базы

      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 10000); // Таймаут 10 секунд

      const response = await fetch(searchUrl.toString(), {
        method: 'GET',
        headers: {
          'Accept': 'application/json',
        },
        signal: controller.signal,
      });

      clearTimeout(timeoutId);

      if (!response.ok) {
        return [];
      }

      const data: USDASearchResponse = await response.json();
      
      if (!data.foods || !Array.isArray(data.foods)) {
        return [];
      }

      // Нормализуем и фильтруем продукты
      const normalized: Food[] = [];
      
      for (const food of data.foods) {
        // Извлекаем макросы из nutrients
        const nutrients = this.extractNutrients(food.foodNutrients || []);
        
        const normalizedFood = normalizeFoodData(
          {
            name: food.description,
            name_original: food.description,
            barcode: null, // USDA не предоставляет штрих-коды
            calories: nutrients.energy,
            protein: nutrients.protein,
            fat: nutrients.fat,
            carbs: nutrients.carbs,
            category: food.foodCategory?.description,
            brand: food.brandOwner || null,
            photo: null, // USDA не предоставляет фото
            aliases: [],
          },
          'usda',
          null
        );

        if (normalizedFood) {
          normalized.push(normalizedFood);
        }
      }

      return normalized;
    } catch (error) {
      if (error instanceof Error && error.name === 'AbortError') {
        // Таймаут - это нормально, просто возвращаем пустой массив
        return [];
      }
      return [];
    }
  }

  /**
   * Извлекает макросы из массива nutrients USDA
   */
  private extractNutrients(nutrients: USDANutrient[]): {
    energy: number;
    protein: number;
    fat: number;
    carbs: number;
  } {
    const result = {
      energy: 0,
      protein: 0,
      fat: 0,
      carbs: 0,
    };

    for (const nutrient of nutrients) {
      const name = nutrient.nutrientName.toLowerCase();
      const value = nutrient.value || 0;

      // USDA использует разные ID для одних и тех же нутриентов
      // Проверяем по названию
      if (name.includes('energy') || name.includes('calories')) {
        result.energy = value;
      } else if (name.includes('protein')) {
        result.protein = value;
      } else if (name.includes('fat') && !name.includes('saturated')) {
        result.fat = value;
      } else if (name.includes('carbohydrate') || name.includes('carbs')) {
        result.carbs = value;
      }
    }

    return result;
  }
}

export const usdaService = new USDAService();

