import { Food, UserCustomFood, FoodSource } from '../types';
import { FOODS_DATABASE, FoodDatabaseItem } from '../data/foodsDatabase';
import generateLargeFoodsDatabase from '../data/foodsDatabaseGenerator';
import { CATEGORY_DEFAULTS } from '../data/categoryDefaults';

// OpenFoodFacts API types
interface OpenFoodFactsProduct {
  product_name?: string;
  brands?: string;
  nutriments?: {
    'energy-kcal_100g'?: number;
    proteins_100g?: number;
    fat_100g?: number;
    carbohydrates_100g?: number;
  };
  code?: string;
  image_front_small_url?: string;
  categories?: string;
}

interface OpenFoodFactsResponse {
  status: number;
  product?: OpenFoodFactsProduct;
}

interface OpenFoodFactsSearchResponse {
  products?: OpenFoodFactsProduct[];
}

class FoodService {
  private readonly FOODS_STORAGE_KEY = 'potok_foods';
  private readonly USER_CUSTOM_FOODS_STORAGE_KEY = 'potok_user_custom_foods';
  private readonly FOODS_DB_INITIALIZED_KEY = 'potok_foods_db_initialized';
  private readonly FOODS_DB_VERSION_KEY = 'potok_foods_db_version';
  private readonly FOODS_DB_VERSION = '2.0'; // Версия базы для обновления

  constructor() {
    this.initializeDatabase();
  }

  // Initialize database from FOODS_DATABASE and extended database
  private initializeDatabase(): void {
    try {
      const initialized = localStorage.getItem(this.FOODS_DB_INITIALIZED_KEY);
      const dbVersion = localStorage.getItem(this.FOODS_DB_VERSION_KEY);
      
      // Если база уже инициализирована и версия совпадает, пропускаем
      if (initialized === 'true' && dbVersion === this.FOODS_DB_VERSION) {
        return;
      }

      const existingFoods = this.getAllFoodsRaw();
      const existingIds = new Set(existingFoods.map(f => f.id));
      const existingBarcodes = new Set(existingFoods.map(f => f.barcode).filter(Boolean));

      // Конвертируем старую базу FOODS_DATABASE
      const dbFoods: Food[] = FOODS_DATABASE.filter((item: FoodDatabaseItem) => {
        return !existingIds.has(item.id);
      }).map((item: FoodDatabaseItem) => {
        return {
          id: item.id,
          name: item.name_ru,
          name_ru: item.name_ru,
          name_en: item.name_en,
          brand: null,
          calories: Number(item.calories) || 0,
          protein: Number(item.protein) || 0,
          fat: Number(item.fat) || 0,
          carbs: Number(item.carbs) || 0,
          barcode: null,
          image: null,
          source: 'local' as FoodSource,
          category: item.category,
          aliases: item.aliases || [],
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
        };
      });

      // Конвертируем расширенную базу
      const extendedDb = generateLargeFoodsDatabase();
      const extendedFoods: Food[] = extendedDb
        .filter(item => !existingIds.has(item.id) && (item.barcode ? !existingBarcodes.has(item.barcode) : true))
        .map(item => ({
          id: item.id,
          name: item.name_ru,
          name_ru: item.name_ru,
          name_en: item.name_en,
          brand: item.brand || null,
          calories: Number(item.calories) || 0,
          protein: Number(item.protein) || 0,
          fat: Number(item.fat) || 0,
          carbs: Number(item.carbs) || 0,
          barcode: item.barcode || null,
          image: null,
          source: 'local' as FoodSource,
          category: item.category,
          aliases: item.aliases || [],
          serving_size: item.serving_size || 100,
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
        }));

      // Объединяем все продукты
      const allFoods = [...existingFoods, ...dbFoods, ...extendedFoods];
      this.saveFoods(allFoods);
      localStorage.setItem(this.FOODS_DB_INITIALIZED_KEY, 'true');
      localStorage.setItem(this.FOODS_DB_VERSION_KEY, this.FOODS_DB_VERSION);
    } catch (error) {
      console.error('Error initializing database:', error);
    }
  }

  // Get all foods from localStorage (raw, without initialization)
  private getAllFoodsRaw(): Food[] {
    try {
      const stored = localStorage.getItem(this.FOODS_STORAGE_KEY);
      if (!stored) return [];
      
      const foods: Food[] = JSON.parse(stored);
      return foods.map(food => ({
        ...food,
        calories: Number(food.calories) || 0,
        protein: Number(food.protein) || 0,
        fat: Number(food.fat) || 0,
        carbs: Number(food.carbs) || 0,
        aliases: food.aliases || [],
      }));
    } catch (error) {
      console.error('Error loading foods:', error);
      return [];
    }
  }

  // Get all foods from localStorage
  private getAllFoods(): Food[] {
    try {
      // Initialize database on first access
      this.initializeDatabase();
      
      const stored = localStorage.getItem(this.FOODS_STORAGE_KEY);
      if (!stored) return [];
      
      const foods: Food[] = JSON.parse(stored);
      
      // Normalize and fix all foods - ensure numbers are numbers, not strings
      // ВАЖНО: НЕ ФИЛЬТРУЕМ ПО КАЛОРИЯМ! Все продукты должны быть доступны
      return foods.map(food => ({
        ...food,
        calories: Number(food.calories) || 0,
        protein: Number(food.protein) || 0,
        fat: Number(food.fat) || 0,
        carbs: Number(food.carbs) || 0,
        aliases: food.aliases || [],
      }));
    } catch (error) {
      console.error('Error loading foods:', error);
      return [];
    }
  }

  // Save foods to localStorage
  private saveFoods(foods: Food[]): void {
    try {
      localStorage.setItem(this.FOODS_STORAGE_KEY, JSON.stringify(foods));
    } catch (error) {
      console.error('Error saving foods:', error);
    }
  }

  // Get user custom foods
  private getUserCustomFoods(userId: string): UserCustomFood[] {
    try {
      const stored = localStorage.getItem(`${this.USER_CUSTOM_FOODS_STORAGE_KEY}_${userId}`);
      return stored ? JSON.parse(stored) : [];
    } catch (error) {
      console.error('Error loading user custom foods:', error);
      return [];
    }
  }

  // Save user custom foods
  private saveUserCustomFoods(userId: string, foods: UserCustomFood[]): void {
    try {
      localStorage.setItem(`${this.USER_CUSTOM_FOODS_STORAGE_KEY}_${userId}`, JSON.stringify(foods));
    } catch (error) {
      console.error('Error saving user custom foods:', error);
    }
  }

  // Автозаполнение БЖУ из категории по умолчанию
  private getCategoryDefaults(category: string): { calories: number; protein: number; fat: number; carbs: number } {
    const defaults = CATEGORY_DEFAULTS[category] || CATEGORY_DEFAULTS.vegetables;
    return {
      calories: defaults.calories,
      protein: defaults.protein,
      fat: defaults.fat,
      carbs: defaults.carbs,
    };
  }

  // Проверка, нужно ли автозаполнение БЖУ
  private needsAutoFill(food: Food): boolean {
    return (
      food.calories === 0 &&
      food.protein === 0 &&
      food.fat === 0 &&
      food.carbs === 0
    ) || (
      !food.calories &&
      !food.protein &&
      !food.fat &&
      !food.carbs
    );
  }

  // Автозаполнение БЖУ для продукта
  private async autoFillNutrition(food: Food): Promise<Food> {
    // Если БЖУ уже есть, возвращаем как есть
    if (!this.needsAutoFill(food)) {
      return food;
    }

    // Пытаемся получить из OpenFoodFacts
    if (food.name || food.name_ru || food.name_en) {
      const searchQuery = food.name_ru || food.name_en || food.name || '';
      try {
        const apiResults = await this.searchOpenFoodFacts(searchQuery, 1);
        if (apiResults.length > 0 && !this.needsAutoFill(apiResults[0])) {
          // Обновляем продукт с данными из API
          const updatedFood: Food = {
            ...food,
            calories: apiResults[0].calories || 0,
            protein: apiResults[0].protein || 0,
            fat: apiResults[0].fat || 0,
            carbs: apiResults[0].carbs || 0,
            updatedAt: new Date().toISOString(),
          };
          this.saveFood(updatedFood);
          return updatedFood;
        }
      } catch (error) {
        console.error('Error auto-filling from API:', error);
      }
    }

    // Если API не помог, используем значения по умолчанию для категории
    if (food.category) {
      const defaults = this.getCategoryDefaults(food.category);
      const updatedFood: Food = {
        ...food,
        calories: defaults.calories,
        protein: defaults.protein,
        fat: defaults.fat,
        carbs: defaults.carbs,
        updatedAt: new Date().toISOString(),
      };
      this.saveFood(updatedFood);
      return updatedFood;
    }

    // Если категории нет, возвращаем как есть (значения 0)
    return food;
  }

  // Convert OpenFoodFacts product to Food
  private convertOpenFoodFactsToFood(product: OpenFoodFactsProduct, source: FoodSource = 'openfoodfacts'): Food | null {
    if (!product.product_name) return null;

    const nutriments = product.nutriments || {};
    
    // Normalize values - convert to numbers, use 0 as default
    const calories = Number(nutriments['energy-kcal_100g']) || 0;
    const protein = Number(nutriments.proteins_100g) || 0;
    const fat = Number(nutriments.fat_100g) || 0;
    const carbs = Number(nutriments.carbohydrates_100g) || 0;
    
    // Определяем категорию из OpenFoodFacts
    let category = 'unknown';
    if (product.categories) {
      const categoriesLower = product.categories.toLowerCase();
      if (categoriesLower.includes('vegetable') || categoriesLower.includes('овощ')) category = 'vegetables';
      else if (categoriesLower.includes('fruit') || categoriesLower.includes('фрукт')) category = 'fruits';
      else if (categoriesLower.includes('meat') || categoriesLower.includes('мясо')) category = 'meat';
      else if (categoriesLower.includes('fish') || categoriesLower.includes('рыба')) category = 'fish';
      else if (categoriesLower.includes('dairy') || categoriesLower.includes('молочн')) category = 'dairy';
      else if (categoriesLower.includes('grain') || categoriesLower.includes('зерн')) category = 'grains';
    }
    
    return {
      id: `food_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      name: product.product_name.trim(),
      name_ru: product.product_name.trim(), // По умолчанию используем product_name
      name_en: product.product_name.trim(),
      brand: product.brands?.trim() || null,
      calories,
      protein,
      fat,
      carbs,
      barcode: product.code || null,
      image: product.image_front_small_url || null,
      source,
      category,
      aliases: [],
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };
  }

  // Расширенный поиск с фаззи-матчингом
  private fuzzyMatch(query: string, text: string): boolean {
    if (!text) return false;
    const queryLower = query.toLowerCase();
    const textLower = text.toLowerCase();
    
    // Точное совпадение
    if (textLower === queryLower) return true;
    
    // Начинается с
    if (textLower.startsWith(queryLower)) return true;
    
    // Содержит
    if (textLower.includes(queryLower)) return true;
    
    // Фаззи-матчинг: проверяем, есть ли все символы запроса в тексте
    let queryIndex = 0;
    for (let i = 0; i < textLower.length && queryIndex < queryLower.length; i++) {
      if (textLower[i] === queryLower[queryIndex]) {
        queryIndex++;
      }
    }
    return queryIndex === queryLower.length;
  }

  // Search in local database - расширенный поиск
  searchLocal(query: string, userId?: string): Food[] {
    const allFoods = this.getAllFoods();
    const queryLower = query.toLowerCase().trim();

    if (!queryLower) return [];

    // Функция поиска, проверяющая все возможные поля
    const matchesQuery = (food: Food): boolean => {
      const searchFields: string[] = [];
      
      if (food.name) searchFields.push(food.name);
      if (food.name_ru) searchFields.push(food.name_ru);
      if (food.name_en) searchFields.push(food.name_en);
      if (food.brand) searchFields.push(food.brand);
      if (food.category) searchFields.push(food.category);
      if (food.barcode) searchFields.push(food.barcode);
      if (food.aliases) {
        searchFields.push(...food.aliases);
      }

      // Проверяем все поля на совпадение
      return searchFields.some(field => {
        if (!field) return false;
        return this.fuzzyMatch(queryLower, field);
      });
    };

    // Поиск во всех продуктах - БЕЗ ФИЛЬТРАЦИИ ПО КАЛОРИЯМ
    let results = allFoods.filter(matchesQuery);

    // Добавляем пользовательские продукты, если userId предоставлен
    if (userId) {
      const customFoods = this.getUserCustomFoods(userId);
      const customResults = customFoods.filter(matchesQuery);
      results = [...results, ...customResults];
    }

    // Удаляем дубликаты и сортируем по релевантности
    const uniqueResults = Array.from(
      new Map(results.map((food) => [food.id, food])).values()
    );

    return uniqueResults.sort((a, b) => {
      // Приоритет 1: точное совпадение
      const aExact = a.name?.toLowerCase() === queryLower || 
                     a.name_ru?.toLowerCase() === queryLower ||
                     a.name_en?.toLowerCase() === queryLower ||
                     (a.aliases || []).some(alias => alias.toLowerCase() === queryLower);
      const bExact = b.name?.toLowerCase() === queryLower || 
                     b.name_ru?.toLowerCase() === queryLower ||
                     b.name_en?.toLowerCase() === queryLower ||
                     (b.aliases || []).some(alias => alias.toLowerCase() === queryLower);
      
      if (aExact && !bExact) return -1;
      if (!aExact && bExact) return 1;
      
      // Приоритет 2: начинается с
      const aStarts = a.name?.toLowerCase().startsWith(queryLower) ||
                      a.name_ru?.toLowerCase().startsWith(queryLower) ||
                      a.name_en?.toLowerCase().startsWith(queryLower) ||
                      (a.aliases || []).some(alias => alias.toLowerCase().startsWith(queryLower));
      const bStarts = b.name?.toLowerCase().startsWith(queryLower) ||
                      b.name_ru?.toLowerCase().startsWith(queryLower) ||
                      b.name_en?.toLowerCase().startsWith(queryLower) ||
                      (b.aliases || []).some(alias => alias.toLowerCase().startsWith(queryLower));
      
      if (aStarts && !bStarts) return -1;
      if (!aStarts && bStarts) return 1;
      
      // Приоритет 3: алфавитный порядок
      return (a.name || a.name_ru || '').localeCompare(b.name || b.name_ru || '');
    });
  }

  // Find by barcode in local database
  findByBarcodeLocal(barcode: string, userId?: string): Food | null {
    const allFoods = this.getAllFoods();
    let found: Food | undefined = allFoods.find((food) => food.barcode === barcode);

    if (!found && userId) {
      const customFoods = this.getUserCustomFoods(userId);
      const customFound = customFoods.find((food) => food.barcode === barcode);
      if (customFound) {
        found = customFound as Food;
      }
    }

    return found || null;
  }

  // Search in OpenFoodFacts API
  async searchOpenFoodFacts(query: string, limit: number = 20): Promise<Food[]> {
    try {
      const encodedQuery = encodeURIComponent(query);
      const url = `https://world.openfoodfacts.org/cgi/search.pl?search_terms=${encodedQuery}&json=1&page_size=${limit}`;

      const response = await fetch(url);
      if (!response.ok) {
        throw new Error('API request failed');
      }

      const data: OpenFoodFactsSearchResponse = await response.json();
      if (!data.products || data.products.length === 0) {
        return [];
      }

      const foods: Food[] = [];
      for (const product of data.products) {
        const food = this.convertOpenFoodFactsToFood(product, 'openfoodfacts');
        if (food) {
          // Проверяем, существует ли уже в локальной БД
          const existing = this.getAllFoods().find((f) => f.barcode === food.barcode);
          if (!existing && food.barcode) {
            // Сохраняем в локальную БД
            this.saveFood(food);
          }
          foods.push(food);
        }
      }

      return foods;
    } catch (error) {
      console.error('Error searching OpenFoodFacts:', error);
      return [];
    }
  }

  // Get product by barcode from OpenFoodFacts API
  async getByBarcodeFromAPI(barcode: string): Promise<Food | null> {
    try {
      // Используем новый API v2
      const url = `https://world.openfoodfacts.org/api/v2/product/${barcode}`;

      const response = await fetch(url);
      if (!response.ok) {
        return null;
      }

      const data: OpenFoodFactsResponse = await response.json();
      if (data.status === 0 || !data.product) {
        return null;
      }

      const food = this.convertOpenFoodFactsToFood(data.product, 'openfoodfacts');
      if (food) {
        // Проверяем, существует ли уже в локальной БД
        const existing = this.getAllFoods().find((f) => f.barcode === food.barcode);
        if (!existing) {
          // Сохраняем в локальную БД
          this.saveFood(food);
        }
        return food;
      }

      return null;
    } catch (error) {
      console.error('Error fetching from OpenFoodFacts:', error);
      return null;
    }
  }

  // Combined search: local first, then API
  async search(query: string, userId?: string): Promise<Food[]> {
    // Сначала ищем локально
    const localResults = this.searchLocal(query, userId);
    
    // Если есть хорошие локальные результаты, возвращаем их
    if (localResults.length >= 10) {
      return localResults;
    }

    // Также ищем в API
    const apiResults = await this.searchOpenFoodFacts(query);
    
    // Объединяем и удаляем дубликаты
    const allResults = [...localResults, ...apiResults];
    const uniqueResults = Array.from(
      new Map(allResults.map((food) => [food.id, food])).values()
    );

    // Автозаполнение БЖУ для продуктов с нулевыми значениями
    const resultsWithNutrition = await Promise.all(
      uniqueResults.map(food => this.autoFillNutrition(food))
    );

    return resultsWithNutrition;
  }

  // Combined barcode search: local first, then API
  async findByBarcode(barcode: string, userId?: string): Promise<Food | null> {
    // Сначала проверяем локально
    const local = this.findByBarcodeLocal(barcode, userId);
    if (local) {
      // Автозаполнение БЖУ, если нужно
      return await this.autoFillNutrition(local);
    }

    // Затем проверяем API
    const api = await this.getByBarcodeFromAPI(barcode);
    if (api) {
      // Автозаполнение БЖУ, если нужно
      return await this.autoFillNutrition(api);
    }

    return null;
  }

  // Save food to local database
  saveFood(food: Food): void {
    const foods = this.getAllFoods();
    
    // Нормализуем значения перед сохранением
    const normalizedFood: Food = {
      ...food,
      calories: Number(food.calories) || 0,
      protein: Number(food.protein) || 0,
      fat: Number(food.fat) || 0,
      carbs: Number(food.carbs) || 0,
      aliases: food.aliases || [],
    };
    
    const existingIndex = foods.findIndex((f) => f.id === normalizedFood.id || 
      (normalizedFood.barcode && f.barcode === normalizedFood.barcode));
    
    if (existingIndex >= 0) {
      foods[existingIndex] = { ...normalizedFood, updatedAt: new Date().toISOString() };
    } else {
      foods.push(normalizedFood);
    }
    
    this.saveFoods(foods);
  }

  // Create user custom food
  createCustomFood(userId: string, foodData: Omit<Food, 'id' | 'source' | 'createdAt' | 'updatedAt'>): UserCustomFood {
    const customFood: UserCustomFood = {
      ...foodData,
      id: `custom_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      userId,
      source: 'custom',
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };

    const customFoods = this.getUserCustomFoods(userId);
    customFoods.push(customFood);
    this.saveUserCustomFoods(userId, customFoods);

    return customFood;
  }

  // Get food by ID (синхронная версия)
  getFoodById(foodId: string, userId?: string): Food | null {
    const allFoods = this.getAllFoods();
    let found: Food | undefined = allFoods.find((food) => food.id === foodId);

    if (!found && userId) {
      const customFoods = this.getUserCustomFoods(userId);
      const customFound = customFoods.find((food) => food.id === foodId);
      if (customFound) {
        found = customFound as Food;
      }
    }

    return found || null;
  }

  // Get food by ID with auto-fill (асинхронная версия)
  async getFoodByIdWithAutoFill(foodId: string, userId?: string): Promise<Food | null> {
    const found = this.getFoodById(foodId, userId);
    if (found) {
      return await this.autoFillNutrition(found);
    }
    return null;
  }
}

export const foodService = new FoodService();
