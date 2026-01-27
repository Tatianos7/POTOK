import { Food, UserCustomFood } from '../types';
import { CATEGORY_DEFAULTS } from '../data/categoryDefaults';
import { barcodeLookupService } from './barcodeLookupService';
import { supabase } from '../lib/supabaseClient';
import { buildNormalizedBrand, buildNormalizedName, normalizeFoodText, validateNutrition } from '../utils/foodNormalizer';
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
      fiber: food.fiber ?? 0,
      autoFilled: true,
      updatedAt: new Date().toISOString(),
    };
  }

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
      const product = this.getFoodById(eanEntry.productId);
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

    // 2. Локальный cache (read-only), если он уже заполнен из Supabase
    // Фильтруем: показываем только core/brand или user продукты текущего пользователя
    try {
      const localFoods = this.searchLocal(query, category).filter(
        (f) => {
          if (f.source === 'user') {
            // Показываем только пользовательские продукты текущего пользователя
            return userId && f.created_by_user_id === userId;
          }
          // Показываем core и brand продукты всем
          return f.source === 'core' || f.source === 'brand';
        }
      );
      allResults.push(...localFoods);
    } catch (error) {
      // Продолжаем работу даже при ошибке
    }

    // 3. Supabase (открытые базы) - полнотекстовый поиск
    // Пробуем загрузить, но не блокируем основной поиск при ошибках
    const foodsTableExists = await this.checkFoodsTableExists();
    if (supabase && q && foodsTableExists) {
      try {
        const supabaseFoods = await Promise.race([
          this.loadPublicFoodsFromSupabase(query),
          new Promise<Food[]>((resolve) => setTimeout(() => resolve([]), 2000)) // Таймаут 2 секунды
        ]);
        const filtered = category 
          ? supabaseFoods.filter((f) => f.category === category)
          : supabaseFoods;
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

    // TODO: Re-enable Open Food Facts / USDA when stable
    // 5. Open Food Facts API - ОТКЛЮЧЕНО
    // 6. USDA API - ОТКЛЮЧЕНО

    // Удаляем дубликаты по name + calories + macros
    const unique = this.removeDuplicates(allResults);

    // Автодополнение макросов при необходимости
    const normalized = unique.map((f) => (f.calories ? f : this.applyCategoryDefaults(f)));

    // Сортируем: пользовательские продукты всегда выше, затем core, затем brand, затем по популярности
    normalized.sort((a, b) => {
      // Приоритет пользовательских продуктов
      const aIsUser = a.source === 'user';
      const bIsUser = b.source === 'user';
      if (aIsUser && !bIsUser) return -1;
      if (!aIsUser && bIsUser) return 1;

      // Приоритет core над brand
      if (!aIsUser && !bIsUser) {
        if (a.source === 'core' && b.source === 'brand') return -1;
        if (a.source === 'brand' && b.source === 'core') return 1;
      }

      // Точное совпадение
      const aExact = a.name.toLowerCase() === q || a.name_original?.toLowerCase() === q;
      const bExact = b.name.toLowerCase() === q || b.name_original?.toLowerCase() === q;
      if (aExact && !bExact) return -1;
      if (!aExact && bExact) return 1;

      // Популярность
      return (b.popularity ?? 0) - (a.popularity ?? 0);
    });

    return normalized.slice(0, limit);
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
   * Удаляет дубликаты из массива продуктов
   */
  private removeDuplicates(foods: Food[]): Food[] {
    const seen = new Set<string>();
    const unique: Food[] = [];

    for (const food of foods) {
      const key = `${buildNormalizedName(food.name)}_${buildNormalizedBrand(food.brand ?? null)}`;
      
      if (!seen.has(key)) {
        seen.add(key);
        unique.push(food);
      }
    }

    return unique;
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
      return foods
        .map((f) => (f.calories ? f : this.applyCategoryDefaults(f)))
        .sort((a, b) => {
          const aExact = a.name.toLowerCase() === q || a.name_original?.toLowerCase() === q;
          const bExact = b.name.toLowerCase() === q || b.name_original?.toLowerCase() === q;
          if (aExact && !bExact) return -1;
          if (!aExact && bExact) return 1;
          return (b.popularity ?? 0) - (a.popularity ?? 0);
        })
        .slice(0, limit);
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
      canonical_food_id: row.canonical_food_id || null,
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
        queryBuilder = queryBuilder.textSearch('search_vector', query.trim(), { config: 'russian' });
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
      this.saveAll(mapped);
      return mapped;
    } catch (error) {
      // Продолжаем работу без Supabase
      return [];
    }
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
