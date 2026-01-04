/**
 * Сервис для работы с Open Food Facts API
 * Использует официальный публичный API как справочник
 * Не сохраняет сырые данные, только нормализованные продукты
 */

import { Food } from '../types';
import { normalizeFoodData } from '../utils/normalizeFoodData';

interface OpenFoodFactsProduct {
  product_name?: string;
  product_name_en?: string;
  code?: string;
  nutriments?: {
    energy_kcal_100g?: number;
    proteins_100g?: number;
    fat_100g?: number;
    carbohydrates_100g?: number;
  };
  categories?: string;
  brands?: string;
  image_url?: string;
  image_small_url?: string;
}

interface OpenFoodFactsResponse {
  products?: OpenFoodFactsProduct[];
  count?: number;
}

/**
 * Сервис для работы с Open Food Facts
 */
class OpenFoodFactsService {
  private readonly API_BASE = 'https://world.openfoodfacts.org/cgi/search.pl';
  private readonly MAX_RESULTS = 20;

  /**
   * Поиск продуктов в Open Food Facts
   * @param query - Поисковый запрос
   * @returns Массив нормализованных продуктов
   */
  async searchProducts(query: string): Promise<Food[]> {
    if (!query || !query.trim()) {
      return [];
    }

    try {
      const searchUrl = new URL(this.API_BASE);
      searchUrl.searchParams.set('search_terms', query.trim());
      searchUrl.searchParams.set('search_simple', '1');
      searchUrl.searchParams.set('action', 'process');
      searchUrl.searchParams.set('json', '1');
      searchUrl.searchParams.set('page_size', this.MAX_RESULTS.toString());
      searchUrl.searchParams.set('fields', 'product_name,product_name_en,code,nutriments,categories,brands,image_url,image_small_url');

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

      const data: OpenFoodFactsResponse = await response.json();
      
      if (!data.products || !Array.isArray(data.products)) {
        return [];
      }

      // Нормализуем и фильтруем продукты
      const normalized: Food[] = [];
      
      for (const product of data.products) {
        const normalizedFood = normalizeFoodData(
          {
            name: product.product_name || product.product_name_en || '',
            name_original: product.product_name_en || product.product_name,
            barcode: product.code || null,
            calories: product.nutriments?.energy_kcal_100g,
            protein: product.nutriments?.proteins_100g,
            fat: product.nutriments?.fat_100g,
            carbs: product.nutriments?.carbohydrates_100g,
            category: this.extractCategory(product.categories),
            brand: product.brands || null,
            photo: product.image_url || product.image_small_url || null,
            aliases: [],
          },
          'core',
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
   * Извлекает категорию из строки категорий Open Food Facts
   */
  private extractCategory(categories?: string): string | undefined {
    if (!categories) return undefined;
    
    // Open Food Facts использует формат: "category1,category2,category3"
    const parts = categories.split(',').map(c => c.trim());
    return parts[0] || undefined;
  }
}

export const openFoodFactsService = new OpenFoodFactsService();

