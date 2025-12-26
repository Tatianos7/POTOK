import { Recipe, RecipeTab } from '../types/recipe';
import { trackEvent } from './analyticsService';
import { supabase } from '../lib/supabaseClient';
import { toUUID } from '../utils/uuid';

class RecipesService {
  private readonly RECIPES_STORAGE_KEY = 'potok_recipes';
  private readonly FAVORITES_STORAGE_KEY = 'potok_recipe_favorites';
  private readonly COLLECTION_STORAGE_KEY = 'potok_recipe_collection';

  // Получить все рецепты
  getAllRecipes(_userId?: string): Recipe[] {
    try {
      const stored = localStorage.getItem(this.RECIPES_STORAGE_KEY);
      if (!stored) {
        // Инициализируем дефолтные рецепты при первом запуске
        const defaultRecipes = this.getDefaultRecipes();
        this.initializeRecipes(defaultRecipes);
        return defaultRecipes;
      }
      const recipes: Recipe[] = JSON.parse(stored);
      // Если рецептов нет, инициализируем дефолтные
      if (recipes.length === 0) {
        const defaultRecipes = this.getDefaultRecipes();
        this.initializeRecipes(defaultRecipes);
        return defaultRecipes;
      }
      return recipes;
    } catch {
      const defaultRecipes = this.getDefaultRecipes();
      this.initializeRecipes(defaultRecipes);
      return defaultRecipes;
    }
  }

  // Инициализировать рецепты в localStorage
  private initializeRecipes(recipes: Recipe[]): void {
    localStorage.setItem(this.RECIPES_STORAGE_KEY, JSON.stringify(recipes));
  }

  // Получить рецепты по вкладке
  getRecipesByTab(tab: RecipeTab, userId?: string): Recipe[] {
    const allRecipes = this.getAllRecipes(userId);
    
    switch (tab) {
      case 'my':
        return allRecipes.filter((r) => r.userId === userId);
      case 'favorites':
        const favorites = this.getFavoriteIds(userId);
        return allRecipes.filter((r) => favorites.includes(r.id));
      case 'collection':
        const collection = this.getCollectionIds(userId);
        return allRecipes.filter((r) => collection.includes(r.id));
      default:
        return allRecipes;
    }
  }

  // Получить избранные ID
  private getFavoriteIds(userId?: string): string[] {
    try {
      const key = userId ? `${this.FAVORITES_STORAGE_KEY}_${userId}` : this.FAVORITES_STORAGE_KEY;
      const stored = localStorage.getItem(key);
      return stored ? JSON.parse(stored) : [];
    } catch {
      return [];
    }
  }

  // Получить ID из коллекции
  private getCollectionIds(userId?: string): string[] {
    try {
      const key = userId ? `${this.COLLECTION_STORAGE_KEY}_${userId}` : this.COLLECTION_STORAGE_KEY;
      const stored = localStorage.getItem(key);
      return stored ? JSON.parse(stored) : [];
    } catch {
      return [];
    }
  }

  // Добавить в избранное
  addToFavorites(recipeId: string, userId?: string): void {
    const favorites = this.getFavoriteIds(userId);
    if (!favorites.includes(recipeId)) {
      favorites.push(recipeId);
      const key = userId ? `${this.FAVORITES_STORAGE_KEY}_${userId}` : this.FAVORITES_STORAGE_KEY;
      localStorage.setItem(key, JSON.stringify(favorites));
    }
  }

  // Удалить из избранного
  removeFromFavorites(recipeId: string, userId?: string): void {
    const favorites = this.getFavoriteIds(userId);
    const updated = favorites.filter((id) => id !== recipeId);
    const key = userId ? `${this.FAVORITES_STORAGE_KEY}_${userId}` : this.FAVORITES_STORAGE_KEY;
    localStorage.setItem(key, JSON.stringify(updated));
  }

  // Добавить в коллекцию
  addToCollection(recipeId: string, userId?: string): void {
    const collection = this.getCollectionIds(userId);
    if (!collection.includes(recipeId)) {
      collection.push(recipeId);
      const key = userId ? `${this.COLLECTION_STORAGE_KEY}_${userId}` : this.COLLECTION_STORAGE_KEY;
      localStorage.setItem(key, JSON.stringify(collection));
    }
  }

  // Удалить из коллекции
  removeFromCollection(recipeId: string, userId?: string): void {
    const collection = this.getCollectionIds(userId);
    const updated = collection.filter((id) => id !== recipeId);
    const key = userId ? `${this.COLLECTION_STORAGE_KEY}_${userId}` : this.COLLECTION_STORAGE_KEY;
    localStorage.setItem(key, JSON.stringify(updated));
  }

  // Сохранить рецепт
  async saveRecipe(recipe: Recipe): Promise<void> {
    // Save to localStorage first
    const allRecipes = this.getAllRecipes(recipe.userId);
    const existingIndex = allRecipes.findIndex((r) => r.id === recipe.id);
    
    if (existingIndex >= 0) {
      allRecipes[existingIndex] = { ...recipe, updatedAt: new Date().toISOString() };
    } else {
      allRecipes.push(recipe);
    }
    
    localStorage.setItem(this.RECIPES_STORAGE_KEY, JSON.stringify(allRecipes));

    // Try to save to Supabase (only user recipes)
    if (supabase && recipe.userId) {
      try {
        // Calculate totals from ingredients
        if (!recipe.ingredients) {
          console.warn('[recipesService] Recipe has no ingredients, skipping Supabase save');
          return;
        }
        const totalCalories = recipe.ingredients.reduce((sum, ing) => sum + (ing.calories || 0), 0);
        const totalProtein = recipe.ingredients.reduce((sum, ing) => sum + (ing.proteins || 0), 0);
        const totalFat = recipe.ingredients.reduce((sum, ing) => sum + (ing.fats || 0), 0);
        const totalCarbs = recipe.ingredients.reduce((sum, ing) => sum + (ing.carbs || 0), 0);

        const uuidUserId = toUUID(recipe.userId);
        const { error } = await supabase
          .from('recipes')
          .upsert({
            id: recipe.id,
            user_id: uuidUserId,
            name: recipe.name,
            ingredients: recipe.ingredients,
            total_calories: totalCalories,
            protein: totalProtein,
            fat: totalFat,
            carbs: totalCarbs,
            updated_at: new Date().toISOString(),
          }, {
            onConflict: 'id',
          });

        if (error) {
          console.error('[recipesService] Supabase save error:', error);
        }
      } catch (err) {
        console.error('[recipesService] Supabase save connection error:', err);
      }
    }

    // Аналитика: сохранён рецепт пользователем
    if (recipe.userId) {
      void trackEvent({
        name: 'save_recipe',
        userId: recipe.userId,
        metadata: {
          recipe_id: recipe.id,
          source: recipe.source || 'manual',
        },
      });
    }
  }

  // Создать рецепт из приёма пищи
  createRecipeFromMeal(data: {
    name: string;
    note?: string;
    mealEntries: Array<{
      foodId: string;
      food: {
        id: string;
        name: string;
      };
      weight: number;
      calories: number;
      protein: number;
      fat: number;
      carbs: number;
    }>;
    userId: string;
  }): Recipe {
    // Преобразуем MealEntry в формат ингредиентов рецепта
    const ingredients = data.mealEntries.map((entry) => ({
      name: entry.food.name,
      quantity: entry.weight,
      unit: 'г',
      grams: entry.weight,
      calories: entry.calories,
      proteins: entry.protein,
      fats: entry.fat,
      carbs: entry.carbs,
    }));

    // Вычисляем общие значения
    const totalCalories = ingredients.reduce((sum, ing) => sum + ing.calories, 0);
    const totalProteins = ingredients.reduce((sum, ing) => sum + ing.proteins, 0);
    const totalFats = ingredients.reduce((sum, ing) => sum + ing.fats, 0);
    const totalCarbs = ingredients.reduce((sum, ing) => sum + ing.carbs, 0);

    // Генерируем уникальный ID и преобразуем в UUID для Supabase
    const uniqueId = `recipe_meal_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    const recipeId = toUUID(uniqueId);

    const recipe: Recipe = {
      id: recipeId,
      name: data.name,
      image: null,
      totalCalories,
      totalProteins,
      totalFats,
      totalCarbs,
      ingredients,
      instructions: data.note || undefined,
      source: 'meal',
      userId: data.userId,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };

    this.saveRecipe(recipe);
    return recipe;
  }

  // Создать рецепт из анализатора
  createRecipeFromAnalyzer(data: {
    name: string;
    image?: string | null;
    totalCalories: number;
    totalProteins: number;
    totalFats: number;
    totalCarbs: number;
    ingredients: Array<{
      name: string;
      quantity: number;
      unit: string;
      grams: number;
      calories: number;
      proteins: number;
      fats: number;
      carbs: number;
    }>;
    userId: string;
  }): Recipe {
    // Генерируем уникальный ID и преобразуем в UUID для Supabase
    const uniqueId = `recipe_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    const recipeId = toUUID(uniqueId);

    const recipe: Recipe = {
      id: recipeId,
      name: data.name,
      image: data.image || null,
      totalCalories: data.totalCalories,
      totalProteins: data.totalProteins,
      totalFats: data.totalFats,
      totalCarbs: data.totalCarbs,
      ingredients: data.ingredients,
      source: 'recipe_analyzer',
      userId: data.userId,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };

    this.saveRecipe(recipe);
    return recipe;
  }

  // Удалить рецепт
  deleteRecipe(recipeId: string, userId?: string): void {
    const allRecipes = this.getAllRecipes(userId);
    const updated = allRecipes.filter((r) => r.id !== recipeId);
    localStorage.setItem(this.RECIPES_STORAGE_KEY, JSON.stringify(updated));
  }

  // Получить рецепт по ID
  getRecipeById(recipeId: string, userId?: string): Recipe | null {
    const allRecipes = this.getAllRecipes(userId);
    return allRecipes.find((r) => r.id === recipeId) || null;
  }

  // Дефолтные рецепты (для демонстрации)
  private getDefaultRecipes(): Recipe[] {
    const now = new Date().toISOString();
    return [
      {
        id: 'r1',
        name: 'Рыба запеченная',
        image: 'https://images.unsplash.com/photo-1544947950-fa07a98d237f?auto=format&fit=crop&w=600&q=80',
        caloriesPer100: 112,
        proteinsPer100: 20,
        fatsPer100: 3,
        carbsPer100: 0,
        source: 'default',
        createdAt: now,
        updatedAt: now,
      },
      {
        id: 'r2',
        name: 'Поке-боул',
        image: 'https://images.unsplash.com/photo-1576045057995-568f588f82fb?auto=format&fit=crop&w=600&q=80',
        caloriesPer100: 150,
        proteinsPer100: 12,
        fatsPer100: 5,
        carbsPer100: 18,
        source: 'default',
        createdAt: now,
        updatedAt: now,
      },
      {
        id: 'r3',
        name: 'Тушеное мясо',
        image: 'https://images.unsplash.com/photo-1558030006-450675393462?auto=format&fit=crop&w=600&q=80',
        caloriesPer100: 180,
        proteinsPer100: 25,
        fatsPer100: 8,
        carbsPer100: 5,
        source: 'default',
        createdAt: now,
        updatedAt: now,
      },
      {
        id: 'r4',
        name: 'Паэлья',
        image: 'https://images.unsplash.com/photo-1534939561126-855b8675edd7?auto=format&fit=crop&w=600&q=80',
        caloriesPer100: 200,
        proteinsPer100: 15,
        fatsPer100: 7,
        carbsPer100: 25,
        source: 'default',
        createdAt: now,
        updatedAt: now,
      },
      {
        id: 'r5',
        name: 'Рыба в фольге',
        image: 'https://images.unsplash.com/photo-1544947950-fa07a98d237f?auto=format&fit=crop&w=600&q=80',
        caloriesPer100: 120,
        proteinsPer100: 22,
        fatsPer100: 4,
        carbsPer100: 1,
        source: 'default',
        createdAt: now,
        updatedAt: now,
      },
      {
        id: 'r6',
        name: 'Лосось с овощами',
        image: 'https://images.unsplash.com/photo-1467003909585-2f8a72700288?auto=format&fit=crop&w=600&q=80',
        caloriesPer100: 160,
        proteinsPer100: 24,
        fatsPer100: 6,
        carbsPer100: 8,
        source: 'default',
        createdAt: now,
        updatedAt: now,
      },
      {
        id: 'r7',
        name: 'Свежий салат',
        image: 'https://images.unsplash.com/photo-1512621776951-a57141f2eefd?auto=format&fit=crop&w=600&q=80',
        caloriesPer100: 50,
        proteinsPer100: 2,
        fatsPer100: 2,
        carbsPer100: 6,
        source: 'default',
        createdAt: now,
        updatedAt: now,
      },
      {
        id: 'r8',
        name: 'Фруктовый салат',
        image: 'https://images.unsplash.com/photo-1565299624946-b28f40a0ae38?auto=format&fit=crop&w=600&q=80',
        caloriesPer100: 80,
        proteinsPer100: 1,
        fatsPer100: 0,
        carbsPer100: 18,
        source: 'default',
        createdAt: now,
        updatedAt: now,
      },
      {
        id: 'r9',
        name: 'Слоеный пирог',
        image: 'https://images.unsplash.com/photo-1565958011703-44f9829ba187?auto=format&fit=crop&w=600&q=80',
        caloriesPer100: 350,
        proteinsPer100: 8,
        fatsPer100: 20,
        carbsPer100: 35,
        source: 'default',
        createdAt: now,
        updatedAt: now,
      },
      {
        id: 'r10',
        name: 'Жареная рыба',
        image: 'https://images.unsplash.com/photo-1544947950-fa07a98d237f?auto=format&fit=crop&w=600&q=80',
        caloriesPer100: 180,
        proteinsPer100: 23,
        fatsPer100: 9,
        carbsPer100: 2,
        source: 'default',
        createdAt: now,
        updatedAt: now,
      },
      {
        id: 'r11',
        name: 'Голубцы',
        image: 'https://images.unsplash.com/photo-1565299624946-b28f40a0ae38?auto=format&fit=crop&w=600&q=80',
        caloriesPer100: 140,
        proteinsPer100: 12,
        fatsPer100: 6,
        carbsPer100: 12,
        source: 'default',
        createdAt: now,
        updatedAt: now,
      },
      {
        id: 'r12',
        name: 'Лосось с овощами',
        image: 'https://images.unsplash.com/photo-1467003909585-2f8a72700288?auto=format&fit=crop&w=600&q=80',
        caloriesPer100: 160,
        proteinsPer100: 24,
        fatsPer100: 6,
        carbsPer100: 8,
        source: 'default',
        createdAt: now,
        updatedAt: now,
      },
    ];
  }
}

export const recipesService = new RecipesService();

