import { RecipeTypeFilter, RecipeGoalFilter } from '../components/RecipeFilterDropdown';

export interface FilterRecommendation {
  typeFilter?: RecipeTypeFilter;
  goalFilter?: RecipeGoalFilter;
}

/**
 * Определяет рекомендованные фильтры на основе цели пользователя
 */
export const getRecommendedFiltersByGoal = (goal?: string): FilterRecommendation => {
  if (!goal) {
    return {};
  }

  const normalizedGoal = goal.toLowerCase().trim();

  // Сушка
  if (normalizedGoal.includes('сушка') || normalizedGoal.includes('cutting') || normalizedGoal === 'cutting') {
    return {
      typeFilter: 'protein', // Белковые рецепты
      goalFilter: 'cutting', // Фильтр по цели "Сушка"
    };
  }

  // Набор
  if (normalizedGoal.includes('набор') || normalizedGoal.includes('bulking') || normalizedGoal === 'bulking') {
    return {
      typeFilter: 'carbs', // Углеводные рецепты
      goalFilter: 'bulking', // Фильтр по цели "Набор"
    };
  }

  // Поддержание
  if (
    normalizedGoal.includes('поддержание') ||
    normalizedGoal.includes('maintenance') ||
    normalizedGoal === 'maintenance'
  ) {
    return {
      typeFilter: 'all', // Все рецепты
      goalFilter: 'maintenance', // Фильтр по цели "Поддержание"
    };
  }

  return {};
};

/**
 * Проверяет, является ли фильтр рекомендованным
 */
export const isRecommendedFilter = (
  typeFilter: RecipeTypeFilter,
  goalFilter: RecipeGoalFilter,
  userGoal?: string
): boolean => {
  const recommendation = getRecommendedFiltersByGoal(userGoal);
  
  // Если нет рекомендации, возвращаем false
  if (!recommendation.typeFilter && !recommendation.goalFilter) {
    return false;
  }
  
  // Проверяем, совпадает ли текущий выбор с рекомендацией
  const typeMatches = !recommendation.typeFilter || recommendation.typeFilter === typeFilter;
  const goalMatches = !recommendation.goalFilter || recommendation.goalFilter === goalFilter;
  
  // Рекомендация активна, если текущий выбор совпадает с рекомендацией
  return typeMatches && goalMatches;
};

