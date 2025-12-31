import { Recipe } from '../types/recipe';
import { foodService } from '../services/foodService';

export type BadgeType =
  | 'protein'
  | 'carbs'
  | 'keto'
  | 'vegetarian'
  | 'fish'
  | 'cutting'
  | 'bulking'
  | 'maintenance';

export interface RecipeBadge {
  type: BadgeType;
  label: string;
  emoji: string;
  priority: number; // Меньше = выше приоритет
}

// Функция проверки категории продукта
const getFoodCategory = (ingredientName: string, userId?: string): string | null => {
  try {
    const allFoods = foodService.getAllFoods(userId);
    const normalizedName = ingredientName.toLowerCase().trim();
    const found = allFoods.find(
      (food) =>
        food.name.toLowerCase().includes(normalizedName) ||
        food.name_original?.toLowerCase().includes(normalizedName) ||
        food.aliases?.some((alias) => alias.toLowerCase().includes(normalizedName))
    );
    if (found) {
      return found.category || null;
    }
  } catch (error) {
    console.warn('[recipeBadges] Error getting food category:', error);
  }
  return null;
};

// Проверка, является ли продукт животного происхождения
const isAnimalProduct = (category: string | null): boolean => {
  if (!category) return false;
  const animalCategories = ['meat', 'fish', 'seafood', 'dairy', 'eggs', 'poultry'];
  return animalCategories.includes(category.toLowerCase());
};

// Определение бейджей рецепта
export const getRecipeBadges = (recipe: Recipe, userId?: string): RecipeBadge[] => {
  const badges: RecipeBadge[] = [];

  const totalCalories = recipe.totalCalories || 0;
  const totalProtein = recipe.totalProteins || 0;
  const totalFat = recipe.totalFats || 0;
  const totalCarbs = recipe.totalCarbs || 0;

  // 1. Цель пользователя (приоритет 1-3)
  if (totalCalories <= 400 && totalProtein >= 25 && totalFat <= 20) {
    badges.push({
      type: 'cutting',
      label: 'Сушка',
      emoji: '🎯',
      priority: 1,
    });
  }

  if (totalCalories >= 500 && (totalProtein >= 25 || totalCarbs >= 40)) {
    badges.push({
      type: 'bulking',
      label: 'Набор',
      emoji: '🎯',
      priority: 2,
    });
  }

  if (totalCalories >= 400 && totalCalories <= 500) {
    const maxMacro = Math.max(totalProtein, totalFat, totalCarbs);
    const minMacro = Math.min(
      totalProtein || 1,
      totalFat || 1,
      totalCarbs || 1
    );
    const isBalanced = maxMacro <= minMacro * 2;
    if (isBalanced) {
      badges.push({
        type: 'maintenance',
        label: 'Поддержание',
        emoji: '🎯',
        priority: 3,
      });
    }
  }

  // 2. Тип рецепта (приоритет 4-6)
  if (totalProtein > totalFat && totalProtein > totalCarbs) {
    badges.push({
      type: 'protein',
      label: 'Белковый',
      emoji: '🥩',
      priority: 4,
    });
  }

  if (totalCarbs > totalProtein && totalCarbs > totalFat) {
    badges.push({
      type: 'carbs',
      label: 'Углеводный',
      emoji: '🍚',
      priority: 5,
    });
  }

  if (totalFat > totalProtein && totalFat > totalCarbs && totalCarbs < 20) {
    badges.push({
      type: 'keto',
      label: 'Жировой / Кето',
      emoji: '🥑',
      priority: 6,
    });
  }

  // 3. Специальные типы (приоритет 7-8)
  if (recipe.ingredients && recipe.ingredients.length > 0) {
    // Вегетарианский
    const isVegetarian = recipe.ingredients.every((ingredient) => {
      const category = getFoodCategory(ingredient.name, userId);
      return !isAnimalProduct(category);
    });
    if (isVegetarian) {
      badges.push({
        type: 'vegetarian',
        label: 'Вегетарианский',
        emoji: '🌱',
        priority: 7,
      });
    }

    // Рыба
    const hasFish = recipe.ingredients.some((ingredient) => {
      const category = getFoodCategory(ingredient.name, userId);
      return category === 'fish' || category === 'seafood';
    });
    const hasMeat = recipe.ingredients.some((ingredient) => {
      const category = getFoodCategory(ingredient.name, userId);
      return category === 'meat' || category === 'poultry';
    });
    if (hasFish && !hasMeat) {
      badges.push({
        type: 'fish',
        label: 'Рыба',
        emoji: '🐟',
        priority: 8,
      });
    }
  }

  // Сортируем по приоритету и ограничиваем до 3 бейджей
  return badges.sort((a, b) => a.priority - b.priority).slice(0, 3);
};

