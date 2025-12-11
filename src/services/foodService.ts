import { Food, UserCustomFood } from '../types';
import { CATEGORY_DEFAULTS } from '../data/categoryDefaults';

/**
 * Новая архитектура работы с продуктами:
 * - Источники: OpenFoodFacts, USDA (public domain), Manual (пользователь)
 * - Все названия сохраняются на русском (name), оригинал в name_original
 * - Макросы всегда числовые, autoFilled помечает автозаполнение
 * - Нет фильтрации по калориям: даже 0/низкокалорийные продукты показываются
 */

// === Внешние API типы ===
interface OpenFoodFactsProduct {
  product_name?: string;
  product_name_ru?: string;
  generic_name?: string;
  brands?: string;
  code?: string;
  image_front_small_url?: string;
  categories?: string;
  nutriments?: {
    'energy-kcal_100g'?: number;
    proteins_100g?: number;
    fat_100g?: number;
    carbohydrates_100g?: number;
  };
}

interface OpenFoodFactsProductResponse {
  status: number;
  product?: OpenFoodFactsProduct;
}

interface OpenFoodFactsSearchResponse {
  products?: OpenFoodFactsProduct[];
}

// USDA FoodData Central (public domain) типы
interface USDAFoodSearchResponse {
  foods?: USDAFoodItem[];
}

interface USDAFoodItem {
  fdcId: number;
  description: string;
  foodNutrients?: USDANutrient[];
  brandOwner?: string;
}

interface USDANutrient {
  nutrientNumber: string; // 208, 203, 204, 205
  value: number;
}

// === Конфигурация и ключи ===
const PRODUCTS_STORAGE_KEY = 'potok_products_v3';
const USER_CUSTOM_PRODUCTS_KEY = 'potok_user_products_v3';
const DB_VERSION_KEY = 'potok_products_version';
const DB_VERSION = '3.0'; // новая версия, полностью чистит старую базу

const USDA_API_KEY =
  typeof import.meta !== 'undefined' && (import.meta as any).env?.VITE_USDA_API_KEY
    ? (import.meta as any).env.VITE_USDA_API_KEY
    : '';

// Утилита: числовое значение с безопасным дефолтом
const toNumber = (value: unknown): number => {
  const n = Number(value);
  return Number.isFinite(n) ? n : 0;
};

class FoodService {
  constructor() {
    this.initializeStorage();
  }

  // Полная очистка старой базы при смене версии
  private initializeStorage() {
    const version = localStorage.getItem(DB_VERSION_KEY);
    if (version !== DB_VERSION) {
      localStorage.setItem(PRODUCTS_STORAGE_KEY, JSON.stringify([]));
      localStorage.setItem(DB_VERSION_KEY, DB_VERSION);
    }
  }

  // === Работа с локальным хранилищем ===
  private normalizeFood(raw: Partial<Food>): Food {
    const now = new Date().toISOString();
    return {
      id: raw.id ?? `food_${Date.now()}_${Math.random().toString(36).slice(2, 9)}`,
      name: raw.name ?? raw.name_original ?? 'Без названия',
      name_original: raw.name_original,
      barcode: raw.barcode ?? null,
      calories: toNumber(raw.calories),
      protein: toNumber(raw.protein),
      fat: toNumber(raw.fat),
      carbs: toNumber(raw.carbs),
      category: raw.category,
      brand: raw.brand ?? null,
      source: raw.source ?? 'local',
      photo: raw.photo ?? null,
      aliases: raw.aliases ?? [],
      autoFilled: raw.autoFilled ?? false,
      popularity: raw.popularity ?? 0,
      createdAt: raw.createdAt ?? now,
      updatedAt: now,
    };
  }

  private loadAll(): Food[] {
    try {
      const stored = localStorage.getItem(PRODUCTS_STORAGE_KEY);
      if (!stored) return [];
      const parsed: Food[] = JSON.parse(stored);
      return parsed.map(this.normalizeFood.bind(this));
    } catch (error) {
      console.error('Error loading products', error);
      return [];
    }
  }

  private saveAll(foods: Food[]) {
    try {
      localStorage.setItem(PRODUCTS_STORAGE_KEY, JSON.stringify(foods));
    } catch (error) {
      console.error('Error saving products', error);
    }
  }

  private loadUserFoods(userId: string): UserCustomFood[] {
    try {
      const stored = localStorage.getItem(`${USER_CUSTOM_PRODUCTS_KEY}_${userId}`);
      if (!stored) return [];
      const parsed: UserCustomFood[] = JSON.parse(stored);
      return parsed.map((item) => ({
        ...this.normalizeFood(item),
        userId,
        source: 'manual',
      }));
    } catch (error) {
      console.error('Error loading user foods', error);
      return [];
    }
  }

  private saveUserFoods(userId: string, foods: UserCustomFood[]) {
    try {
      localStorage.setItem(`${USER_CUSTOM_PRODUCTS_KEY}_${userId}`, JSON.stringify(foods));
    } catch (error) {
      console.error('Error saving user foods', error);
    }
  }

  // === Вспомогательные функции ===
  private normalizeRuName(name?: string): string {
    if (!name) return 'Без названия';
    let n = name.trim();
    // Заменяем украинские буквы на русские аналоги для отображения
    const map: Record<string, string> = {
      і: 'и',
      І: 'И',
      ї: 'и',
      Ї: 'И',
      є: 'е',
      Є: 'Е',
      ґ: 'г',
      Ґ: 'Г',
      '’': "'",
      'ʼ': "'",
    };
    n = n
      .split('')
      .map((ch) => map[ch] ?? ch)
      .join('');
    // Если уже есть русские буквы — ок
    if (/[а-яё]/i.test(n)) return n;
    // Иначе оставляем как есть (без внешнего перевода)
    return n;
  }

  private deriveCategoryFromText(text?: string): string | undefined {
    if (!text) return undefined;
    const t = text.toLowerCase();
    if (t.includes('vegetable') || t.includes('овощ')) return 'vegetables';
    if (t.includes('fruit') || t.includes('фрукт')) return 'fruits';
    if (t.includes('meat') || t.includes('мяс')) return 'meat';
    if (t.includes('fish') || t.includes('рыба')) return 'fish';
    if (t.includes('dairy') || t.includes('молок') || t.includes('cheese')) return 'dairy';
    if (t.includes('grain') || t.includes('круп') || t.includes('rice') || t.includes('bread')) return 'grains';
    if (t.includes('nut')) return 'nuts';
    if (t.includes('oil')) return 'oils';
    if (t.includes('drink') || t.includes('juice') || t.includes('water')) return 'beverages';
    return undefined;
  }

  private applyCategoryDefaults(food: Food): Food {
    if (food.calories && food.protein && food.fat && food.carbs) return food;
    const categoryKey = food.category || 'vegetables';
    const defaults = CATEGORY_DEFAULTS[categoryKey] || CATEGORY_DEFAULTS.vegetables;
    return {
      ...food,
      calories: food.calories || defaults.calories,
      protein: food.protein || defaults.protein,
      fat: food.fat || defaults.fat,
      carbs: food.carbs || defaults.carbs,
      autoFilled: true,
      updatedAt: new Date().toISOString(),
    };
  }

  private fuzzyMatch(query: string, text?: string | null): boolean {
    if (!text) return false;
    const q = query.toLowerCase().trim();
    const t = text.toLowerCase();
    if (!q) return false;
    if (t === q) return true;
    if (t.startsWith(q)) return true;
    if (t.includes(q)) return true;
    // простейший subsequence matching
    let qi = 0;
    for (let i = 0; i < t.length && qi < q.length; i++) {
      if (t[i] === q[qi]) qi++;
    }
    return qi === q.length;
  }

  // === OpenFoodFacts ===
  private mapOFFProduct(product: OpenFoodFactsProduct): Food | null {
    if (!product.product_name && !product.generic_name) return null;
    const nameOriginal = product.product_name?.trim() || product.generic_name?.trim() || 'Unknown';
    const ruCandidate =
      (product as any).product_name_ru?.trim() ||
      (product as any).generic_name_ru?.trim() ||
      product.product_name?.trim() ||
      product.generic_name?.trim();
    const nameRu = this.normalizeRuName(ruCandidate || nameOriginal);
    const nutriments = product.nutriments || {};
    const food: Food = this.normalizeFood({
      name: nameRu,
      name_original: nameOriginal,
      // @ts-ignore сохраняем русское имя для отображения
      name_ru: nameRu,
      barcode: product.code || null,
      brand: product.brands?.split(',')?.[0]?.trim() || null,
      calories: nutriments['energy-kcal_100g'],
      protein: nutriments.proteins_100g,
      fat: nutriments.fat_100g,
      carbs: nutriments.carbohydrates_100g,
      category: this.deriveCategoryFromText(product.categories),
      photo: product.image_front_small_url || null,
      source: 'openfoodfacts',
    });
    return this.applyCategoryDefaults(food);
  }

  private async fetchOFFByBarcode(barcode: string): Promise<Food | null> {
    try {
      const url = `https://world.openfoodfacts.org/api/v2/product/${barcode}`;
      const res = await fetch(url);
      if (!res.ok) return null;
      const data: OpenFoodFactsProductResponse = await res.json();
      if (data.status === 0 || !data.product) return null;
      return this.mapOFFProduct(data.product);
    } catch (error) {
      console.error('OFF barcode fetch error', error);
      return null;
    }
  }

  private async fetchOFFSearch(query: string, limit = 15): Promise<Food[]> {
    try {
      const url = `https://world.openfoodfacts.org/cgi/search.pl?search_terms=${encodeURIComponent(query)}&json=1&page_size=${limit}`;
      const res = await fetch(url);
      if (!res.ok) return [];
      const data: OpenFoodFactsSearchResponse = await res.json();
      if (!data.products?.length) return [];
      const mapped = data.products
        .map((p) => this.mapOFFProduct(p))
        .filter((p): p is Food => !!p);
      return mapped;
    } catch (error) {
      console.error('OFF search error', error);
      return [];
    }
  }

  // === USDA FoodData Central ===
  private mapUSDAToFood(item: USDAFoodItem): Food {
    const calories = item.foodNutrients?.find((n) => n.nutrientNumber === '208')?.value;
    const protein = item.foodNutrients?.find((n) => n.nutrientNumber === '203')?.value;
    const fat = item.foodNutrients?.find((n) => n.nutrientNumber === '204')?.value;
    const carbs = item.foodNutrients?.find((n) => n.nutrientNumber === '205')?.value;
    const nameOriginal = item.description?.trim() || 'Unknown';
    const nameRu = this.normalizeRuName(nameOriginal);
    const category = this.deriveCategoryFromText(nameOriginal);

    const food = this.normalizeFood({
      name: nameRu,
      name_original: nameOriginal,
      brand: item.brandOwner || null,
      calories,
      protein,
      fat,
      carbs,
      category,
      source: 'usda',
    });
    return this.applyCategoryDefaults(food);
  }

  private async fetchUSDASearch(query: string, limit = 10): Promise<Food[]> {
    if (!USDA_API_KEY) return [];
    try {
      const url = `https://api.nal.usda.gov/fdc/v1/foods/search?query=${encodeURIComponent(query)}&pageSize=${limit}&api_key=${USDA_API_KEY}`;
      const res = await fetch(url);
      if (!res.ok) return [];
      const data: USDAFoodSearchResponse = await res.json();
      if (!data.foods?.length) return [];
      return data.foods.map((item) => this.mapUSDAToFood(item));
    } catch (error) {
      console.error('USDA search error', error);
      return [];
    }
  }

  // === Основной pipeline ===
  private upsertFood(food: Food) {
    const foods = this.loadAll();
    const idx = foods.findIndex((f) => f.id === food.id || (food.barcode && f.barcode === food.barcode));
    if (idx >= 0) {
      foods[idx] = { ...foods[idx], ...food, updatedAt: new Date().toISOString() };
    } else {
      foods.push(food);
    }
    this.saveAll(foods);
  }

  private searchLocal(query: string, category?: string): Food[] {
    const all = this.loadAll();
    const q = query.toLowerCase().trim();
    const filtered = all.filter((f) => {
      if (category && f.category !== category) return false;
      return (
        this.fuzzyMatch(q, f.name) ||
        this.fuzzyMatch(q, f.name_original) ||
        this.fuzzyMatch(q, f.brand) ||
        (f.aliases || []).some((a) => this.fuzzyMatch(q, a))
      );
    });
    return filtered.sort((a, b) => (b.popularity ?? 0) - (a.popularity ?? 0));
  }

  private findLocalByBarcode(barcode: string): Food | null {
    const all = this.loadAll();
    return all.find((f) => f.barcode === barcode) || null;
  }

  async findByBarcode(barcode: string, _userId?: string): Promise<Food | null> {
    // 1) локально
    const local = this.findLocalByBarcode(barcode);
    if (local) return local;

    // 2) OpenFoodFacts
    const off = await this.fetchOFFByBarcode(barcode);
    if (off) {
      this.upsertFood(off);
      return off;
    }

    // 3) USDA (без штрихкода прямого поиска — пробуем как текст)
    const usda = await this.fetchUSDASearch(barcode, 1);
    if (usda[0]) {
      const product = { ...usda[0], barcode };
      this.upsertFood(product);
      return product;
    }

    return null;
  }

  async search(query: string, options?: { category?: string; limit?: number }): Promise<Food[]> {
    const limit = options?.limit ?? 30;
    const category = options?.category;

    const local = this.searchLocal(query, category);
    if (local.length >= limit) return local.slice(0, limit);

    // OpenFoodFacts
    const offResults = await this.fetchOFFSearch(query, limit);
    offResults.forEach((f) => this.upsertFood(f));

    // USDA (если есть ключ)
    const usdaResults = await this.fetchUSDASearch(query, limit);
    usdaResults.forEach((f) => this.upsertFood(f));

    const combined = [...local, ...offResults, ...usdaResults];
    const unique = Array.from(new Map(combined.map((f) => [f.barcode || f.id, f])).values());

    // автодополнение макросов при необходимости
    const normalized = unique.map((f) => (f.calories ? f : this.applyCategoryDefaults(f)));

    // сортируем по популярности и наличию точного совпадения
    const q = query.toLowerCase().trim();
    normalized.sort((a, b) => {
      const aExact = a.name.toLowerCase() === q || a.name_original?.toLowerCase() === q;
      const bExact = b.name.toLowerCase() === q || b.name_original?.toLowerCase() === q;
      if (aExact && !bExact) return -1;
      if (!aExact && bExact) return 1;
      return (b.popularity ?? 0) - (a.popularity ?? 0);
    });

    return normalized.slice(0, limit);
  }

  async searchByCategory(category: string, limit = 50): Promise<Food[]> {
    const local = this.searchLocal('', category);
    if (local.length >= limit) return local.slice(0, limit);
    // Попытаться дополнительно подтянуть из OFF/USDA по названию категории
    const off = await this.fetchOFFSearch(category, limit);
    off.forEach((f) => this.upsertFood(f));
    const usda = await this.fetchUSDASearch(category, limit);
    usda.forEach((f) => this.upsertFood(f));
    const combined = [...local, ...off, ...usda];
    const unique = Array.from(new Map(combined.map((f) => [f.barcode || f.id, f])).values());
    return unique.slice(0, limit);
  }

  // === Пользовательские продукты ===
  createCustomFood(userId: string, data: Omit<Food, 'id' | 'source' | 'createdAt' | 'updatedAt'>): UserCustomFood {
    const food: UserCustomFood = {
      ...this.normalizeFood(data),
      id: `manual_${Date.now()}_${Math.random().toString(36).slice(2, 9)}`,
      userId,
      source: 'manual',
    };
    const userFoods = this.loadUserFoods(userId);
    userFoods.push(food);
    this.saveUserFoods(userId, userFoods);
    return food;
  }

  saveFood(food: Food): void {
    this.upsertFood(this.normalizeFood(food));
  }

  getFoodById(id: string, userId?: string): Food | null {
    const all = this.loadAll();
    const local = all.find((f) => f.id === id);
    if (local) return local;
    if (userId) {
      const uf = this.loadUserFoods(userId).find((f) => f.id === id);
      if (uf) return uf;
    }
    return null;
  }
}

export const foodService = new FoodService();
