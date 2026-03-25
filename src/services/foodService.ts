import { Food, UserCustomFood } from '../types';
import { CATEGORY_DEFAULTS } from '../data/categoryDefaults';
import { barcodeLookupService } from './barcodeLookupService';
import { supabase } from '../lib/supabaseClient';
import {
  assertValidFoodMacros,
  buildNormalizedBrand,
  buildNormalizedName,
  normalizeFoodText,
  validateNutrition,
} from '../utils/foodNormalizer';
// TODO: Re-enable Open Food Facts / USDA when stable
// import { openFoodFactsService } from './openFoodFactsService';
// import { usdaService } from './usdaService';
// import { foodCache } from '../utils/foodCache';

// Кэш для отслеживания доступности таблицы foods в Supabase
let foodsTableExistsCache: boolean | null = null;

/**
 * Архитектура работы с продуктами (РОССИЙСКАЯ БАЗА):
 * - Источник по умолчанию: Росстат / Скурихин (seed в проекте)
 * - Дополнительно: пользовательские продукты и ручные добавления (moderation)
 * - Полный оффлайн: без внешних запросов, все данные локально
 * - Поиск по штрих-коду: ean_index, при отсутствии — возврат not_found
 */

// === Конфигурация и ключи ===
const PRODUCTS_STORAGE_KEY = 'potok_products_russia_v1';
const EAN_INDEX_STORAGE_KEY = 'potok_ean_index_v1';
const USER_CUSTOM_PRODUCTS_KEY = 'potok_user_products_v1';
const DB_VERSION_KEY = 'potok_products_version';
const DB_VERSION = 'cache-1.0';

// Утилита: числовое значение с безопасным дефолтом
const toNumber = (value: unknown): number => {
  const n = Number(value);
  return Number.isFinite(n) ? n : 0;
};

const getSourcePriority = (source: Food['source']): number => {
  switch (source) {
    case 'user':
      return 3;
    case 'core':
      return 2;
    case 'brand':
    default:
      return 1;
  }
};

const VALID_ZERO_MACRO_FOOD_NAMES = new Set([
  'вода',
  'water',
]);

export const hasUsableFoodNutrition = (
  food: Pick<Food, 'calories' | 'protein' | 'fat' | 'carbs' | 'fiber'>
): boolean => {
  const calories = toNumber(food.calories);
  const protein = toNumber(food.protein);
  const fat = toNumber(food.fat);
  const carbs = toNumber(food.carbs);
  const fiber = toNumber(food.fiber);

  if ([calories, protein, fat, carbs, fiber].some((value) => value < 0)) {
    return false;
  }

  return calories > 0 || protein > 0 || fat > 0 || carbs > 0 || fiber > 0;
};

export const isAllZeroMacroFood = (
  food: Pick<Food, 'calories' | 'protein' | 'fat' | 'carbs'>
): boolean => {
  return (
    toNumber(food.calories) === 0 &&
    toNumber(food.protein) === 0 &&
    toNumber(food.fat) === 0 &&
    toNumber(food.carbs) === 0
  );
};

export const isAllowedZeroMacroFood = (
  food: Pick<Food, 'name' | 'calories' | 'protein' | 'fat' | 'carbs'>
): boolean => {
  if (!isAllZeroMacroFood(food)) {
    return false;
  }

  return VALID_ZERO_MACRO_FOOD_NAMES.has(buildNormalizedName(food.name));
};

export const isSuspiciousAllZeroCatalogFood = (
  food: Pick<Food, 'name' | 'source' | 'calories' | 'protein' | 'fat' | 'carbs'>
): boolean => {
  if (food.source !== 'core' && food.source !== 'brand') {
    return false;
  }

  return isAllZeroMacroFood(food) && !isAllowedZeroMacroFood(food);
};

export const shouldApplySearchNutritionFallback = (food: Food): boolean => {
  if (food.source !== 'user') {
    return false;
  }

  return !hasUsableFoodNutrition(food);
};

export const preferSearchFoodCandidate = (existing: Food, candidate: Food): Food => {
  const existingHasNutrition = hasUsableFoodNutrition(existing);
  const candidateHasNutrition = hasUsableFoodNutrition(candidate);

  if (!existingHasNutrition && candidateHasNutrition) {
    return candidate;
  }

  if (existingHasNutrition && !candidateHasNutrition) {
    return existing;
  }

  const existingPriority = getSourcePriority(existing.source);
  const candidatePriority = getSourcePriority(candidate.source);

  if (candidatePriority > existingPriority) {
    return candidate;
  }

  if (existingPriority > candidatePriority) {
    return existing;
  }

  if ((candidate.verified ?? false) && !(existing.verified ?? false)) {
    return candidate;
  }

  if ((existing.verified ?? false) && !(candidate.verified ?? false)) {
    return existing;
  }

  if ((candidate.popularity ?? 0) > (existing.popularity ?? 0)) {
    return candidate;
  }

  return existing;
};

export const finalizeFoodSearchResults = (foods: Food[], query: string, limit = 30): Food[] => {
  const byKey = new Map<string, Food>();
  const normalizedQuery = query.toLowerCase().trim();

  for (const food of foods) {
    if (isSuspiciousAllZeroCatalogFood(food)) {
      continue;
    }

    const key = `${buildNormalizedName(food.name)}_${buildNormalizedBrand(food.brand ?? null)}`;
    const existing = byKey.get(key);
    byKey.set(key, existing ? preferSearchFoodCandidate(existing, food) : food);
  }

  const results = Array.from(byKey.values()).map((food) => (
    shouldApplySearchNutritionFallback(food) ? {
      ...food,
      ...CATEGORY_DEFAULTS[food.category || 'vegetables'] || CATEGORY_DEFAULTS.vegetables,
      fiber: food.fiber ?? 0,
      autoFilled: true,
      updatedAt: new Date().toISOString(),
    } : food
  ));

  results.sort((a, b) => {
    const aIsUser = a.source === 'user';
    const bIsUser = b.source === 'user';
    if (aIsUser && !bIsUser) return -1;
    if (!aIsUser && bIsUser) return 1;

    if (!aIsUser && !bIsUser) {
      if (a.source === 'core' && b.source === 'brand') return -1;
      if (a.source === 'brand' && b.source === 'core') return 1;
    }

    const aExact = a.name.toLowerCase() === normalizedQuery || a.name_original?.toLowerCase() === normalizedQuery;
    const bExact = b.name.toLowerCase() === normalizedQuery || b.name_original?.toLowerCase() === normalizedQuery;
    if (aExact && !bExact) return -1;
    if (!aExact && bExact) return 1;

    return (b.popularity ?? 0) - (a.popularity ?? 0);
  });

  return results.slice(0, limit);
};

class FoodService {
  constructor() {
    this.initializeStorage();
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
      console.warn('[foodService] Передан userId не совпадает с сессией');
    }

    return data.user.id;
  }

  // Инициализация кеша (без mock-данных)
  private initializeStorage() {
    const version = localStorage.getItem(DB_VERSION_KEY);
    if (version !== DB_VERSION) {
      localStorage.setItem(PRODUCTS_STORAGE_KEY, JSON.stringify([]));
      localStorage.setItem(EAN_INDEX_STORAGE_KEY, JSON.stringify([]));
      localStorage.setItem(DB_VERSION_KEY, DB_VERSION);
    }
  }

  // === Работа с локальным хранилищем ===
  private normalizeFood(raw: Partial<Food>): Food {
    const now = new Date().toISOString();
    const normalizedName = buildNormalizedName(raw.name ?? raw.name_original ?? '');
    const normalizedBrand = buildNormalizedBrand(raw.brand ?? null);
    const nutritionVersion = raw.nutrition_version ?? 1;
    const unit = raw.unit ?? 'g';
    const fiber = toNumber(raw.fiber);
    const { suspicious } = validateNutrition({
      calories: toNumber(raw.calories),
      protein: toNumber(raw.protein),
      fat: toNumber(raw.fat),
      carbs: toNumber(raw.carbs),
      fiber,
    });
    return {
      id: raw.id ?? `food_${Date.now()}_${Math.random().toString(36).slice(2, 9)}`,
      name: raw.name ?? raw.name_original ?? 'Без названия',
      name_original: raw.name_original,
      barcode: raw.barcode ?? null,
      calories: toNumber(raw.calories),
      protein: toNumber(raw.protein),
      fat: toNumber(raw.fat),
      carbs: toNumber(raw.carbs),
      fiber,
      unit,
      category: raw.category,
      brand: raw.brand ?? null,
      source: raw.source ?? 'core', // По умолчанию базовый продукт
      created_by_user_id: raw.created_by_user_id ?? null,
      canonical_food_id: raw.canonical_food_id ?? raw.id ?? null,
      normalized_name: normalizedName,
      normalized_brand: normalizedBrand || null,
      nutrition_version: nutritionVersion,
      verified: raw.verified ?? (raw.source === 'core' || raw.source === 'brand'),
      suspicious: raw.suspicious ?? suspicious,
      confidenceScore: raw.confidenceScore ?? (raw.verified ? 0.95 : 0.7),
      sourceVersion: raw.sourceVersion ?? null,
      allergens: raw.allergens ?? [],
      intolerances: raw.intolerances ?? [],
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
      if (!stored) {
        return [];
      }
      const parsed: Food[] = JSON.parse(stored);
      if (!Array.isArray(parsed) || parsed.length === 0) {
        return [];
      }
      return parsed;
    } catch (error) {
      console.error('[FoodService] Error loading products:', error);
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

  private mergeAndSavePublicFoods(foods: Food[]) {
    const current = this.loadAll();
    const byId = new Map<string, Food>();

    current.forEach((food) => {
      byId.set(food.id, food);
    });

    foods.forEach((food) => {
      const existing = byId.get(food.id);
      byId.set(food.id, existing ? preferSearchFoodCandidate(existing, food) : food);
    });

    this.saveAll(Array.from(byId.values()));
  }

  private loadUserFoods(userId: string): UserCustomFood[] {
    try {
      const stored = localStorage.getItem(`${USER_CUSTOM_PRODUCTS_KEY}_${userId}`);
      if (!stored) return [];
      const parsed: UserCustomFood[] = JSON.parse(stored);
      return parsed.map((item) => ({
        ...this.normalizeFood(item),
        userId,
        source: 'user', // Изменено с 'manual' на 'user'
        created_by_user_id: userId, // Обязательно для пользовательских продуктов
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

  // ВРЕМЕННО НЕ ИСПОЛЬЗУЮТСЯ: для mockFoodDatabase используем простой includes
  // Функции оставлены для будущего использования с реальной базой
  // private normalizeText(text: string): string { ... }
  // private stemRu(word: string): string { ... }

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
    
    if (all.length === 0) {
      this.initializeStorage();
      const retry = this.loadAll();
      if (retry.length === 0) {
        return [];
      }
      return this.searchLocal(query, category);
    }
    
    const filtered = all.filter((f) => {
      if (category && f.category !== category) return false;
      if (!q) return true;
      const nameLower = (f.name || '').toLowerCase();
      const nameOriginalLower = (f.name_original || '').toLowerCase();
      const aliases = f.aliases || [];
      const nameMatch = nameLower.includes(q);
      const nameOriginalMatch = nameOriginalLower.includes(q);
      const aliasMatch = aliases.some(alias => alias.toLowerCase().includes(q));
      return nameMatch || aliasMatch || nameOriginalMatch;
    });
    
    return filtered.sort((a, b) => (b.popularity ?? 0) - (a.popularity ?? 0));
  }

  private findLocalByBarcode(barcode: string): Food | null {
    const all = this.loadAll();
    return all.find((f) => f.barcode === barcode) || null;
  }

  async findByBarcode(barcode: string, _userId?: string): Promise<Food | null> {
    const cleaned = barcode?.trim();
    if (!cleaned) return null;

    // 1) прямое попадание в ean_index
    const eanEntry = barcodeLookupService.findProductId(cleaned);
    if (eanEntry?.productId) {
      const product = await this.getFoodByIdFresh(eanEntry.productId, _userId);
      if (product) return product;
    }

    // 2) локальный поиск по полю barcode
    const local = this.findLocalByBarcode(cleaned);
    if (local) return local;

    // 3) not found — вернуть null (UI может показать форму добавления)
    return null;
  }

  /**
   * Поиск продуктов с приоритетом пользовательских продуктов
   * Объединяет результаты из всех источников:
   * 1) Пользовательские продукты (localStorage + Supabase)
   * 2) Базовые продукты (локальная справочная база)
   * 3) Локальная таблица foods (localStorage)
   * 4) Supabase (открытые базы, если таблица существует)
   * 
   * TODO: Re-enable Open Food Facts / USDA when stable
   */
  async search(
    query: string, 
    options?: { 
      category?: string; 
      limit?: number;
      userId?: string; // Для фильтрации пользовательских продуктов
    }
  ): Promise<Food[]> {
    const limit = options?.limit ?? 30;
    const category = options?.category;
    const userId = options?.userId;
    const q = query.toLowerCase().trim();

    // Если запрос пустой, возвращаем пустой массив
    if (!q) {
      return [];
    }

    const allResults: Food[] = [];

    // 1. Пользовательские продукты (localStorage + Supabase)
    if (userId) {
      // Из localStorage
      const localUserFoods = this.loadUserFoods(userId).filter((f) => {
        if (category && f.category !== category) return false;
        if (!q) return true;
        const nameMatch = f.name.toLowerCase().includes(q);
        const aliasMatch = f.aliases?.some(alias => alias.toLowerCase().includes(q));
        return nameMatch || aliasMatch;
      });
      allResults.push(...localUserFoods);

      // Из Supabase (только если таблица существует)
      const foodsTableExists = await this.checkFoodsTableExists();
      if (foodsTableExists) {
        try {
          const supabaseUserFoods = await this.loadUserFoodsFromSupabase(userId);
        const filtered = supabaseUserFoods.filter((f) => {
          if (category && f.category !== category) return false;
          if (!q) return true;
          const nameMatch = f.name.toLowerCase().includes(q);
          const aliasMatch = f.aliases?.some(alias => alias.toLowerCase().includes(q));
          return nameMatch || aliasMatch;
        });
        filtered.forEach((food) => {
          if (!allResults.find((f) => f.id === food.id)) {
            allResults.push(food);
          }
        });
        } catch (error) {
          // Продолжаем работу без Supabase - это нормально, если таблица не создана
        }
      }
    }

    // 2. Supabase (открытые базы) - полнотекстовый поиск
    // Пробуем загрузить, но не блокируем основной поиск при ошибках
    const foodsTableExists = await this.checkFoodsTableExists();
    let hasPublicSupabaseResults = false;
    if (supabase && q && foodsTableExists) {
      try {
        const supabaseFoods = await Promise.race([
          this.loadPublicFoodsFromSupabase(query),
          new Promise<Food[]>((resolve) => setTimeout(() => resolve([]), 2000)) // Таймаут 2 секунды
        ]);
        const filtered = category 
          ? supabaseFoods.filter((f) => f.category === category)
          : supabaseFoods;
        hasPublicSupabaseResults = filtered.length > 0;
        filtered.forEach((food) => {
          if (!allResults.find((f) => this.isDuplicate(f, food))) {
            allResults.push(food);
          }
        });

        const normalizedQuery = normalizeFoodText(query);
        if (normalizedQuery) {
          const { data: aliasRows } = await supabase
            .from('food_aliases')
            .select('canonical_food_id')
            .eq('normalized_alias', normalizedQuery)
            .limit(20);
          const aliasIds = (aliasRows || []).map((row: any) => row.canonical_food_id).filter(Boolean);
          if (aliasIds.length > 0) {
            const { data: aliasFoods } = await supabase
              .from('foods')
              .select('*')
              .in('id', aliasIds)
              .limit(50);
            (aliasFoods || []).forEach((row: any) => {
              const food = this.mapSupabaseRowToFood(row);
              if (!allResults.find((f) => this.isDuplicate(f, food))) {
                allResults.push(food);
              }
            });
          }
        }
      } catch (error) {
        // Продолжаем работу без Supabase
      }
    }

    // 3. Локальный cache для публичных продуктов используем только как fallback,
    // чтобы stale cache не подменял актуальные данные из Supabase.
    if (!hasPublicSupabaseResults) {
      try {
        const localFoods = this.searchLocal(query, category).filter((f) => {
          if (f.source === 'user') {
            return userId && f.created_by_user_id === userId;
          }
          return f.source === 'core' || f.source === 'brand';
        });
        allResults.push(...localFoods);
      } catch (error) {
        // Продолжаем работу даже при ошибке
      }
    }

    // TODO: Re-enable Open Food Facts / USDA when stable
    // 5. Open Food Facts API - ОТКЛЮЧЕНО
    // 6. USDA API - ОТКЛЮЧЕНО

    return finalizeFoodSearchResults(allResults, q, limit);
  }

  /**
   * Проверяет, являются ли два продукта дубликатами
   * Дубликаты определяются по name + calories + macros
   */
  private isDuplicate(food1: Food, food2: Food): boolean {
    const nameMatch =
      buildNormalizedName(food1.name) === buildNormalizedName(food2.name);
    const brandMatch =
      buildNormalizedBrand(food1.brand ?? null) === buildNormalizedBrand(food2.brand ?? null);

    return nameMatch && brandMatch;
  }

  /**
   * Поиск с группировкой результатов по источникам
   * Возвращает объект с разделением на пользовательские и базовые продукты
   * Использует источники: localStorage, базовые продукты, Supabase
   * TODO: Re-enable Open Food Facts / USDA when stable
   */
  async searchGrouped(
    query: string,
    options?: { category?: string; limit?: number; userId?: string }
  ): Promise<{ userFoods: Food[]; publicFoods: Food[] }> {
    const userId = options?.userId;
    const limit = options?.limit ?? 30;
    const category = options?.category;
    const q = query.toLowerCase().trim();

    // Получаем все результаты через основной метод search
    const allResults = await this.search(query, { category, limit: limit * 2, userId });

    // Разделяем на пользовательские и базовые/общие
    const userFoods = allResults.filter((f) => f.source === 'user');
    const publicFoods = allResults.filter((f) => f.source !== 'user');

    // Сортировка внутри каждой группы
    const sortFoods = (foods: Food[]) => {
      return finalizeFoodSearchResults(foods, q, limit);
    };

    return {
      userFoods: sortFoods(userFoods),
      publicFoods: sortFoods(publicFoods),
    };
  }

  async searchByCategory(category: string, limit = 50): Promise<Food[]> {
    const foodsTableExists = await this.checkFoodsTableExists();
    if (supabase && foodsTableExists) {
      const supabaseFoods = await this.loadPublicFoodsFromSupabase();
      const filtered = supabaseFoods.filter((f) => f.category === category);
      return filtered.slice(0, limit);
    }
    const local = this.searchLocal('', category);
    return local.slice(0, limit);
  }

  // === Работа с Supabase ===
  /**
   * Проверяем, существует ли таблица foods в Supabase (кэшируем результат)
   */
  private async checkFoodsTableExists(): Promise<boolean> {
    if (foodsTableExistsCache !== null) {
      return foodsTableExistsCache;
    }

    if (!supabase) {
      foodsTableExistsCache = false;
      return false;
    }

    try {
      // Пробуем сделать простой запрос к таблице
      const { error } = await supabase
        .from('foods')
        .select('id')
        .limit(1);

      if (error) {
        if (error.code === 'PGRST205') {
          // Таблица не найдена
          foodsTableExistsCache = false;
          return false;
        }
        // Другая ошибка - считаем, что таблица существует, но есть проблема с доступом
        foodsTableExistsCache = true;
        return true;
      }

      foodsTableExistsCache = true;
      return true;
    } catch (error) {
      foodsTableExistsCache = false;
      return false;
    }
  }

  /**
   * Маппинг строки Supabase в Food
   */
  private mapSupabaseRowToFood(row: any): Food {
    return {
      id: row.id,
      name: row.name,
      name_original: row.name_original || undefined,
      barcode: row.barcode || null,
      calories: Number(row.calories) || 0,
      protein: Number(row.protein) || 0,
      fat: Number(row.fat) || 0,
      carbs: Number(row.carbs) || 0,
      fiber: Number(row.fiber) || 0,
      unit: row.unit || 'g',
      category: row.category || undefined,
      brand: row.brand || null,
      source: row.source as Food['source'],
      created_by_user_id: row.created_by_user_id || null,
      canonical_food_id: row.canonical_food_id || row.id || null,
      normalized_name: row.normalized_name || undefined,
      normalized_brand: row.normalized_brand || null,
      nutrition_version: row.nutrition_version ?? 1,
      verified: row.verified ?? false,
      suspicious: row.suspicious ?? false,
      confidenceScore: row.confidence_score ?? 0.7,
      sourceVersion: row.source_version ?? null,
      allergens: row.allergens || [],
      intolerances: row.intolerances || [],
      photo: row.photo || null,
      aliases: row.aliases || [],
      autoFilled: row.auto_filled || false,
      popularity: row.popularity || 0,
      createdAt: row.created_at || new Date().toISOString(),
      updatedAt: row.updated_at || new Date().toISOString(),
    };
  }

  /**
   * Загружает пользовательские продукты из Supabase
   */
  private async loadUserFoodsFromSupabase(userId: string): Promise<Food[]> {
    if (!supabase) return [];

    try {
      const sessionUserId = await this.getSessionUserId(userId);
      const { data, error } = await supabase
        .from('foods')
        .select('*')
        .eq('source', 'user')
        .eq('created_by_user_id', sessionUserId)
        .order('created_at', { ascending: false });

      if (error) {
        // Если таблица не найдена (PGRST205), сбрасываем кэш и используем только localStorage
        if (error.code === 'PGRST205') {
          foodsTableExistsCache = false;
        }
        return [];
      }

      if (!data) return [];

      const mapped = data.map((row) => this.mapSupabaseRowToFood(row));
      const userFoods = mapped.map((food) => ({
        ...food,
        userId: sessionUserId,
        source: 'user' as const,
        created_by_user_id: sessionUserId,
      }));
      this.saveUserFoods(sessionUserId, userFoods as UserCustomFood[]);
      return mapped;
    } catch (error) {
      // Продолжаем работу без Supabase
      return [];
    }
  }

  /**
   * Загружает открытые продукты из Supabase (core, brand)
   */
  private async loadPublicFoodsFromSupabase(query?: string): Promise<Food[]> {
    if (!supabase) return [];

    try {
      let queryBuilder = supabase
        .from('foods')
        .select('*')
        .in('source', ['core', 'brand'])
        .limit(100);

      if (query && query.trim()) {
        queryBuilder = queryBuilder.textSearch('search_vector', query.trim(), { config: 'russian', type: 'websearch' });
      }

      const { data, error } = await queryBuilder.order('popularity', { ascending: false });

      if (error) {
        // Если таблица не найдена (PGRST205), сбрасываем кэш
        if (error.code === 'PGRST205') {
          foodsTableExistsCache = false;
        }
        return [];
      }

      if (!data) return [];

      const mapped = data.map((row) => this.mapSupabaseRowToFood(row));
      this.mergeAndSavePublicFoods(mapped);
      return mapped;
    } catch (error) {
      // Продолжаем работу без Supabase
      return [];
    }
  }

  private async loadFoodByIdFromSupabase(foodId: string, userId?: string): Promise<Food | null> {
    if (!supabase || !this.isValidUUID(foodId)) return null;

    const foodsTableExists = await this.checkFoodsTableExists();
    if (!foodsTableExists) return null;

    try {
      let sessionUserId: string | undefined;
      if (userId) {
        try {
          sessionUserId = await this.getSessionUserId(userId);
        } catch {
          sessionUserId = userId;
        }
      }

      const { data, error } = await supabase
        .from('foods')
        .select('*')
        .eq('id', foodId)
        .maybeSingle();

      if (error || !data) {
        return null;
      }

      const mapped = this.mapSupabaseRowToFood(data);
      if (mapped.source === 'user' && sessionUserId && mapped.created_by_user_id !== sessionUserId) {
        return null;
      }

      if (mapped.source === 'user' && sessionUserId) {
        const cachedUserFoods = this.loadUserFoods(sessionUserId);
        const nextUserFoods = cachedUserFoods.filter((food) => food.id !== mapped.id);
        nextUserFoods.push({
          ...mapped,
          userId: sessionUserId,
          source: 'user',
          created_by_user_id: sessionUserId,
        });
        this.saveUserFoods(sessionUserId, nextUserFoods as UserCustomFood[]);
      } else {
        this.mergeAndSavePublicFoods([mapped]);
      }

      return mapped;
    } catch {
      return null;
    }
  }

  async getFoodByIdFresh(id: string, userId?: string): Promise<Food | null> {
    const fresh = await this.loadFoodByIdFromSupabase(id, userId);
    if (fresh) return fresh;
    return this.getFoodById(id, userId);
  }

  async hydrateFoodForDiarySelection(food: Food, userId?: string): Promise<Food> {
    const candidateIds = [
      food.id,
      food.canonical_food_id ?? null,
    ].filter((value, index, arr): value is string => Boolean(value) && arr.indexOf(value) === index);

    let freshestCandidate: Food | null = null;

    for (const candidateId of candidateIds) {
      const fresh = await this.getFoodByIdFresh(candidateId, userId);
      if (!fresh) {
        continue;
      }

      if (!freshestCandidate) {
        freshestCandidate = fresh;
      }

      if (hasUsableFoodNutrition(fresh)) {
        return fresh;
      }
    }

    return freshestCandidate ?? food;
  }

  // === Пользовательские продукты ===
  /**
   * Создает пользовательский продукт
   * Сохраняет в localStorage и Supabase
   */
  async createUserFood(
    food: Food,
    userId: string
  ): Promise<UserCustomFood> {
    if (!supabase) {
      throw new Error('Supabase не инициализирован');
    }
    const sessionUserId = await this.getSessionUserId(userId);
    assertValidFoodMacros({
      calories: Number(food.calories),
      protein: Number(food.protein),
      fat: Number(food.fat),
      carbs: Number(food.carbs),
      fiber: Number(food.fiber) || 0,
    });
    const userFood: UserCustomFood = {
      ...this.normalizeFood(food),
      id: '',
      userId: sessionUserId,
      source: 'user',
      created_by_user_id: sessionUserId,
    };

    // Синхронизируем с Supabase
    try {
      const { data, error } = await supabase.from('foods').insert({
        name: userFood.name,
        name_original: userFood.name_original || null,
        barcode: userFood.barcode,
        calories: userFood.calories,
        protein: userFood.protein,
        fat: userFood.fat,
        carbs: userFood.carbs,
        fiber: userFood.fiber ?? 0,
        unit: userFood.unit ?? 'g',
        category: userFood.category || null,
        brand: userFood.brand,
        source: 'user',
        created_by_user_id: sessionUserId,
        canonical_food_id: null,
        normalized_name: userFood.normalized_name,
        normalized_brand: userFood.normalized_brand,
        nutrition_version: userFood.nutrition_version ?? 1,
        verified: userFood.verified ?? false,
        suspicious: userFood.suspicious ?? false,
        confidence_score: userFood.confidenceScore ?? 0.7,
        source_version: userFood.sourceVersion ?? null,
        allergens: userFood.allergens ?? [],
        intolerances: userFood.intolerances ?? [],
        photo: userFood.photo,
        aliases: userFood.aliases || [],
        auto_filled: userFood.autoFilled || false,
        popularity: userFood.popularity || 0,
      }).select('*').single();

      if (error) {
        console.error('[FoodService] Error saving to Supabase:', error);
        throw error;
      }
      if (!data?.id) {
        throw new Error('[FoodService] Supabase did not return id for created food');
      }
      if (!data.canonical_food_id) {
        const { error: canonicalError } = await supabase
          .from('foods')
          .update({ canonical_food_id: data.id })
          .eq('id', data.id)
          .eq('created_by_user_id', sessionUserId);
        if (canonicalError) {
          console.warn('[FoodService] Failed to backfill canonical_food_id for user food:', canonicalError.message);
        } else {
          data.canonical_food_id = data.id;
        }
      }
      userFood.id = data.id;
      userFood.canonical_food_id = data.canonical_food_id || data.id;
      const userFoods = this.loadUserFoods(sessionUserId);
      userFoods.push(userFood);
      this.saveUserFoods(sessionUserId, userFoods);
    } catch (error) {
      console.error('[FoodService] Error syncing with Supabase:', error);
      throw error;
    }

    return userFood;
  }

  /**
   * Обновляет пользовательский продукт
   */
  async updateUserFood(
    foodId: string,
    food: Partial<Food>,
    userId: string
  ): Promise<void> {
    if (!supabase) {
      throw new Error('Supabase не инициализирован');
    }
    const sessionUserId = await this.getSessionUserId(userId);
    const userFoods = this.loadUserFoods(sessionUserId);
    const index = userFoods.findIndex((f) => f.id === foodId);
    
    if (index >= 0) {
      const updated: UserCustomFood = {
        ...userFoods[index],
        ...food,
        source: 'user', // Гарантируем, что source всегда 'user' для пользовательских продуктов
        created_by_user_id: userFoods[index].created_by_user_id, // Сохраняем существующий created_by_user_id
        updatedAt: new Date().toISOString(),
      };

      assertValidFoodMacros({
        calories: Number(updated.calories),
        protein: Number(updated.protein),
        fat: Number(updated.fat),
        carbs: Number(updated.carbs),
        fiber: Number(updated.fiber) || 0,
      });

      try {
        if (!this.isValidUUID(foodId)) {
          return;
        }
        const updateData: any = {};
        const normalizedName = buildNormalizedName(updated.name);
        const normalizedBrand = buildNormalizedBrand(updated.brand ?? null);
        const { suspicious } = validateNutrition({
          calories: Number(updated.calories) || 0,
          protein: Number(updated.protein) || 0,
          fat: Number(updated.fat) || 0,
          carbs: Number(updated.carbs) || 0,
          fiber: Number(updated.fiber) || 0,
        });
        
        if (food.name !== undefined) updateData.name = food.name;
        if (food.name_original !== undefined) updateData.name_original = food.name_original;
        if (food.barcode !== undefined) updateData.barcode = food.barcode;
        if (food.calories !== undefined) updateData.calories = food.calories;
        if (food.protein !== undefined) updateData.protein = food.protein;
        if (food.fat !== undefined) updateData.fat = food.fat;
        if (food.carbs !== undefined) updateData.carbs = food.carbs;
        if (food.fiber !== undefined) updateData.fiber = food.fiber;
        if (food.unit !== undefined) updateData.unit = food.unit;
        if (food.category !== undefined) updateData.category = food.category;
        if (food.brand !== undefined) updateData.brand = food.brand;
        if (food.photo !== undefined) updateData.photo = food.photo;
        if (food.aliases !== undefined) updateData.aliases = food.aliases;
        updateData.normalized_name = normalizedName;
        updateData.normalized_brand = normalizedBrand;
        updateData.nutrition_version = updated.nutrition_version ?? 1;
        updateData.verified = updated.verified ?? false;
        updateData.suspicious = updated.suspicious ?? suspicious;
        updateData.confidence_score = updated.confidenceScore ?? 0.7;
        updateData.source_version = updated.sourceVersion ?? null;
        updateData.allergens = updated.allergens ?? [];
        updateData.intolerances = updated.intolerances ?? [];

        const { error } = await supabase
          .from('foods')
          .update(updateData)
          .eq('id', foodId)
          .eq('created_by_user_id', sessionUserId)
          .eq('source', 'user');

        if (error) {
          console.error('[FoodService] Error updating in Supabase:', error);
          throw error;
        }
        userFoods[index] = updated;
        this.saveUserFoods(sessionUserId, userFoods);
      } catch (error) {
        console.error('[FoodService] Error syncing update with Supabase:', error);
        throw error;
      }
    }
  }

  /**
   * Удаляет пользовательский продукт
   */
  async deleteUserFood(foodId: string, userId: string): Promise<void> {
    if (!supabase) {
      throw new Error('Supabase не инициализирован');
    }
    const sessionUserId = await this.getSessionUserId(userId);
    const userFoods = this.loadUserFoods(sessionUserId);
    const filtered = userFoods.filter((f) => f.id !== foodId);

    try {
      if (!this.isValidUUID(foodId)) {
        return;
      }
      const { error } = await supabase
        .from('foods')
        .delete()
        .eq('id', foodId)
        .eq('created_by_user_id', sessionUserId)
        .eq('source', 'user');

      if (error) {
        console.error('[FoodService] Error deleting from Supabase:', error);
        throw error;
      }
      this.saveUserFoods(sessionUserId, filtered);
    } catch (error) {
      console.error('[FoodService] Error syncing delete with Supabase:', error);
      throw error;
    }
  }

  /**
   * Создает пользовательский продукт только через Supabase
   */
  async createCustomFood(
    userId: string,
    data: Omit<Food, 'id' | 'source' | 'created_by_user_id' | 'createdAt' | 'updatedAt'>
  ): Promise<UserCustomFood> {
    const food: Food = {
      ...this.normalizeFood(data),
      source: 'user',
      created_by_user_id: userId,
    };

    return this.createUserFood(food, userId);
  }

  /**
   * Manual branded product remains a private user-owned food row.
   * `brand` is stored as an attribute, but the row still uses `source='user'`.
   * It must not be treated as a shared/public `source='brand'` catalog product.
   */
  async createManualBrandedFood(
    userId: string,
    data: Omit<Food, 'id' | 'source' | 'created_by_user_id' | 'createdAt' | 'updatedAt'>
  ): Promise<UserCustomFood> {
    return this.createCustomFood(userId, data);
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

  getAllFoods(userId?: string): Food[] {
    const all = this.loadAll();
    if (userId) {
      const userFoods = this.loadUserFoods(userId);
      return [...all, ...userFoods];
    }
    return all;
  }
}

export const foodService = new FoodService();
