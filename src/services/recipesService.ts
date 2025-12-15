import { Recipe, RecipeTab } from '../types/recipe';

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
  saveRecipe(recipe: Recipe): void {
    const allRecipes = this.getAllRecipes(recipe.userId);
    const existingIndex = allRecipes.findIndex((r) => r.id === recipe.id);
    
    if (existingIndex >= 0) {
      allRecipes[existingIndex] = { ...recipe, updatedAt: new Date().toISOString() };
    } else {
      allRecipes.push(recipe);
    }
    
    localStorage.setItem(this.RECIPES_STORAGE_KEY, JSON.stringify(allRecipes));
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
        createdAt: now,
        updatedAt: now,
      },
    ];
  }
}

export const recipesService = new RecipesService();

