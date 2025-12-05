import { Food, UserCustomFood, FoodSource } from '../types';
import { FOODS_DATABASE, FoodDatabaseItem } from '../data/foodsDatabase';

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

  // Initialize database from FOODS_DATABASE if not already done
  private initializeDatabase(): void {
    try {
      const initialized = localStorage.getItem(this.FOODS_DB_INITIALIZED_KEY);
      if (initialized === 'true') return;

      const existingFoods = this.getAllFoods();
      const existingIds = new Set(existingFoods.map(f => f.id));

      // Convert database items to Food format
      const dbFoods: Food[] = FOODS_DATABASE.filter((item: FoodDatabaseItem) => {
        // Skip if already exists
        return !existingIds.has(item.id);
      }).map((item: FoodDatabaseItem) => {
        return {
          id: item.id,
          name: item.name_ru, // Use Russian name as primary
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

      // Merge with existing foods
      const allFoods = [...existingFoods, ...dbFoods];
      this.saveFoods(allFoods);
      localStorage.setItem(this.FOODS_DB_INITIALIZED_KEY, 'true');
    } catch (error) {
      console.error('Error initializing database:', error);
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

  // Convert OpenFoodFacts product to Food
  private convertOpenFoodFactsToFood(product: OpenFoodFactsProduct, source: FoodSource = 'api'): Food | null {
    if (!product.product_name) return null;

    const nutriments = product.nutriments || {};
    
    // Normalize values - convert to numbers, use 0 as default
    const calories = Number(nutriments['energy-kcal_100g']) || 0;
    const protein = Number(nutriments.proteins_100g) || 0;
    const fat = Number(nutriments.fat_100g) || 0;
    const carbs = Number(nutriments.carbohydrates_100g) || 0;
    
    return {
      id: `food_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      name: product.product_name.trim(),
      brand: product.brands?.trim() || null,
      calories,
      protein,
      fat,
      carbs,
      barcode: product.code || null,
      image: product.image_front_small_url || null,
      source,
      aliases: [],
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };
  }

  // Search in local database - improved with aliases and multiple name fields
  searchLocal(query: string, userId?: string): Food[] {
    const allFoods = this.getAllFoods();
    const queryLower = query.toLowerCase().trim();

    if (!queryLower) return [];

    // Search function that checks all possible fields
    const matchesQuery = (food: Food): boolean => {
      const searchFields: string[] = [];
      
      if (food.name) searchFields.push(food.name.toLowerCase());
      if (food.name_ru) searchFields.push(food.name_ru.toLowerCase());
      if (food.name_en) searchFields.push(food.name_en.toLowerCase());
      if (food.brand) searchFields.push(food.brand.toLowerCase());
      if (food.aliases) {
        searchFields.push(...food.aliases.map(a => a.toLowerCase()));
      }

      return searchFields.some(field => field.includes(queryLower));
    };

    // Search in all foods - NO FILTERING BY CALORIES
    let results = allFoods.filter(matchesQuery);

    // Add user custom foods if userId provided
    if (userId) {
      const customFoods = this.getUserCustomFoods(userId);
      const customResults = customFoods.filter(matchesQuery);
      results = [...results, ...customResults];
    }

    // Remove duplicates and sort by relevance
    const uniqueResults = Array.from(
      new Map(results.map((food) => [food.id, food])).values()
    );

    return uniqueResults.sort((a, b) => {
      // Prioritize exact matches
      const aExact = a.name?.toLowerCase() === queryLower || 
                     a.name_ru?.toLowerCase() === queryLower ||
                     a.name_en?.toLowerCase() === queryLower;
      const bExact = b.name?.toLowerCase() === queryLower || 
                     b.name_ru?.toLowerCase() === queryLower ||
                     b.name_en?.toLowerCase() === queryLower;
      
      if (aExact && !bExact) return -1;
      if (!aExact && bExact) return 1;
      
      // Then prioritize starts with
      const aStarts = a.name?.toLowerCase().startsWith(queryLower) ||
                      a.name_ru?.toLowerCase().startsWith(queryLower) ||
                      a.name_en?.toLowerCase().startsWith(queryLower);
      const bStarts = b.name?.toLowerCase().startsWith(queryLower) ||
                      b.name_ru?.toLowerCase().startsWith(queryLower) ||
                      b.name_en?.toLowerCase().startsWith(queryLower);
      
      if (aStarts && !bStarts) return -1;
      if (!aStarts && bStarts) return 1;
      
      return (a.name || '').localeCompare(b.name || '');
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
  async searchOpenFoodFacts(query: string): Promise<Food[]> {
    try {
      const encodedQuery = encodeURIComponent(query);
      const url = `https://world.openfoodfacts.org/cgi/search.pl?search_terms=${encodedQuery}&json=1&page_size=20`;

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
        const food = this.convertOpenFoodFactsToFood(product, 'api');
        if (food) {
          // Check if already exists in local DB
          const existing = this.getAllFoods().find((f) => f.barcode === food.barcode);
          if (!existing) {
            // Save to local DB
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
      const url = `https://world.openfoodfacts.org/api/v0/product/${barcode}.json`;

      const response = await fetch(url);
      if (!response.ok) {
        return null;
      }

      const data: OpenFoodFactsResponse = await response.json();
      if (data.status === 0 || !data.product) {
        return null;
      }

      const food = this.convertOpenFoodFactsToFood(data.product, 'api');
      if (food) {
        // Check if already exists in local DB
        const existing = this.getAllFoods().find((f) => f.barcode === food.barcode);
        if (!existing) {
          // Save to local DB
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
    // First search locally
    const localResults = this.searchLocal(query, userId);
    
    // If we have good local results, return them
    if (localResults.length >= 5) {
      return localResults;
    }

    // Also search in API
    const apiResults = await this.searchOpenFoodFacts(query);
    
    // Combine and deduplicate
    const allResults = [...localResults, ...apiResults];
    const uniqueResults = Array.from(
      new Map(allResults.map((food) => [food.id, food])).values()
    );

    return uniqueResults;
  }

  // Combined barcode search: local first, then API
  async findByBarcode(barcode: string, userId?: string): Promise<Food | null> {
    // First check local
    const local = this.findByBarcodeLocal(barcode, userId);
    if (local) {
      return local;
    }

    // Then check API
    const api = await this.getByBarcodeFromAPI(barcode);
    return api;
  }

  // Save food to local database
  saveFood(food: Food): void {
    const foods = this.getAllFoods();
    
    // Normalize food values before saving
    const normalizedFood: Food = {
      ...food,
      calories: Number(food.calories) || 0,
      protein: Number(food.protein) || 0,
      fat: Number(food.fat) || 0,
      carbs: Number(food.carbs) || 0,
      aliases: food.aliases || [],
    };
    
    const existingIndex = foods.findIndex((f) => f.id === normalizedFood.id);
    
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

  // Get food by ID
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
}

export const foodService = new FoodService();

