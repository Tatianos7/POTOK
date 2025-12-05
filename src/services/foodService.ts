import { Food, UserCustomFood, FoodSource } from '../types';

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

  // Get all foods from localStorage
  private getAllFoods(): Food[] {
    try {
      const stored = localStorage.getItem(this.FOODS_STORAGE_KEY);
      return stored ? JSON.parse(stored) : [];
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
    
    return {
      id: `food_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      name: product.product_name.trim(),
      brand: product.brands?.trim() || null,
      calories: nutriments['energy-kcal_100g'] || 0,
      protein: nutriments.proteins_100g || 0,
      fat: nutriments.fat_100g || 0,
      carbs: nutriments.carbohydrates_100g || 0,
      barcode: product.code || null,
      image: product.image_front_small_url || null,
      source,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };
  }

  // Search in local database
  searchLocal(query: string, userId?: string): Food[] {
    const allFoods = this.getAllFoods();
    const queryLower = query.toLowerCase().trim();

    if (!queryLower) return [];

    // Search in all foods
    let results = allFoods.filter(
      (food) =>
        food.name.toLowerCase().includes(queryLower) ||
        (food.brand && food.brand.toLowerCase().includes(queryLower))
    );

    // Add user custom foods if userId provided
    if (userId) {
      const customFoods = this.getUserCustomFoods(userId);
      const customResults = customFoods.filter(
        (food) =>
          food.name.toLowerCase().includes(queryLower) ||
          (food.brand && food.brand.toLowerCase().includes(queryLower))
      );
      results = [...results, ...customResults];
    }

    // Remove duplicates and sort by relevance
    const uniqueResults = Array.from(
      new Map(results.map((food) => [food.id, food])).values()
    );

    return uniqueResults.sort((a, b) => {
      const aNameMatch = a.name.toLowerCase().startsWith(queryLower);
      const bNameMatch = b.name.toLowerCase().startsWith(queryLower);
      if (aNameMatch && !bNameMatch) return -1;
      if (!aNameMatch && bNameMatch) return 1;
      return a.name.localeCompare(b.name);
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
    const existingIndex = foods.findIndex((f) => f.id === food.id);
    
    if (existingIndex >= 0) {
      foods[existingIndex] = { ...food, updatedAt: new Date().toISOString() };
    } else {
      foods.push(food);
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

