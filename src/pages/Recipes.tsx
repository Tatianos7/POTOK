import { useState, useEffect, useMemo, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { X, List, Grid, Filter } from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { recipesService } from '../services/recipesService';
import { Recipe, RecipeTab } from '../types/recipe';
import RecipeFilterDropdown, {
  RecipeTypeFilter,
  RecipeGoalFilter,
} from '../components/RecipeFilterDropdown';
import { foodService } from '../services/foodService';
import RecipesGrid from '../components/RecipesGrid';
import RecipesList from '../components/RecipesList';

type ViewMode = 'grid' | 'list';

const VIEW_MODE_STORAGE_KEY = 'potok_recipes_view_mode';

const Recipes = () => {
  const navigate = useNavigate();
  const { user, authStatus } = useAuth();

  const [activeTab, setActiveTab] = useState<RecipeTab>('my');
  const [recipes, setRecipes] = useState<Recipe[]>([]);
  const [typeFilter, setTypeFilter] = useState<RecipeTypeFilter>('all');
  const [goalFilter, setGoalFilter] = useState<RecipeGoalFilter>('all');
  const [isFilterDropdownOpen, setIsFilterDropdownOpen] = useState(false);
  const filterButtonRef = useRef<HTMLButtonElement>(null);

  // View mode state с сохранением в localStorage
  const [viewMode, setViewMode] = useState<ViewMode>(() => {
    const saved = localStorage.getItem(VIEW_MODE_STORAGE_KEY);
    return (saved === 'grid' || saved === 'list' ? saved : 'grid') as ViewMode;
  });

  // Сохранение viewMode в localStorage при изменении
  useEffect(() => {
    localStorage.setItem(VIEW_MODE_STORAGE_KEY, viewMode);
  }, [viewMode]);

  const toggleViewMode = () => {
    setViewMode((prev) => (prev === 'grid' ? 'list' : 'grid'));
  };

  useEffect(() => {
    let isActive = true;

    const loadRecipes = async () => {
      if (authStatus !== 'authenticated' || !user?.id) {
        if (isActive) {
          setRecipes([]);
        }
        return;
      }
      try {
        const loaded = await recipesService.getRecipesByTab(activeTab, user.id);
        if (!isActive) return;
        setRecipes(Array.isArray(loaded) ? loaded : []);
      } catch (error) {
        console.error('[Recipes] Failed to load recipes:', error);
        if (isActive) {
          setRecipes([]);
        }
      }
    };

    loadRecipes();
    // Сбрасываем фильтры при смене вкладки
    setTypeFilter('all');
    setGoalFilter('all');

    return () => {
      isActive = false;
    };
  }, [activeTab, authStatus, user?.id]);

  const handleRecipeClick = (recipe: Recipe) => {
    navigate(`/nutrition/recipes/${recipe.id}`);
  };

  // Функция проверки категории продукта
  const getFoodCategory = (ingredientName: string): string | null => {
    try {
      // Пытаемся найти продукт по имени через поиск
      // Используем синхронный подход: загружаем все продукты и ищем по имени
      const allFoods = foodService.getAllFoods(user?.id);
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
      console.warn('[Recipes] Error getting food category:', error);
    }
    return null;
  };

  // Проверка, является ли продукт животного происхождения
  const isAnimalProduct = (category: string | null): boolean => {
    if (!category) return false;
    const animalCategories = ['meat', 'fish', 'seafood', 'dairy', 'eggs', 'poultry'];
    return animalCategories.includes(category.toLowerCase());
  };

  // Фильтрация рецептов по типу
  const filterByType = (recipe: Recipe): boolean => {
    if (typeFilter === 'all') return true;

    const totalProtein = recipe.totalProteins || 0;
    const totalFat = recipe.totalFats || 0;
    const totalCarbs = recipe.totalCarbs || 0;

    switch (typeFilter) {
      case 'protein':
        // Белковые: белок > жир И белок > углеводы
        return totalProtein > totalFat && totalProtein > totalCarbs;

      case 'carbs':
        // Углеводные: углеводы > белок И углеводы > жир
        return totalCarbs > totalProtein && totalCarbs > totalFat;

      case 'keto':
        // Жировые (кето): жир > белок И жир > углеводы И углеводы < 20
        return totalFat > totalProtein && totalFat > totalCarbs && totalCarbs < 20;

      case 'vegetarian':
        // Вегетарианские: нет продуктов животного происхождения
        if (!recipe.ingredients || recipe.ingredients.length === 0) {
          return false;
        }
        return recipe.ingredients.every((ingredient) => {
          const category = getFoodCategory(ingredient.name);
          return !isAnimalProduct(category);
        });

      case 'fish':
        // Рыба: есть рыба/морепродукты И нет мяса/птицы
        if (!recipe.ingredients || recipe.ingredients.length === 0) {
          return false;
        }
        const hasFish = recipe.ingredients.some((ingredient) => {
          const category = getFoodCategory(ingredient.name);
          return category === 'fish' || category === 'seafood';
        });
        const hasMeat = recipe.ingredients.some((ingredient) => {
          const category = getFoodCategory(ingredient.name);
          return category === 'meat' || category === 'poultry';
        });
        return hasFish && !hasMeat;

      default:
        return true;
    }
  };

  // Фильтрация рецептов по цели
  const filterByGoal = (recipe: Recipe): boolean => {
    if (goalFilter === 'all') return true;

    const totalCalories = recipe.totalCalories || 0;
    const totalProtein = recipe.totalProteins || 0;
    const totalFat = recipe.totalFats || 0;
    const totalCarbs = recipe.totalCarbs || 0;

    switch (goalFilter) {
      case 'cutting':
        // Сушка: калории <= 400, белок >= 25, жир <= 20
        return totalCalories <= 400 && totalProtein >= 25 && totalFat <= 20;

      case 'bulking':
        // Набор: калории >= 500 И (белок >= 25 ИЛИ углеводы >= 40)
        return totalCalories >= 500 && (totalProtein >= 25 || totalCarbs >= 40);

      case 'maintenance':
        // Поддержание: калории 400-500 И баланс БЖУ (ни один макрос не доминирует более чем в 2 раза)
        const inCalorieRange = totalCalories >= 400 && totalCalories <= 500;
        if (!inCalorieRange) return false;

        // Проверка баланса: ни один макрос не доминирует более чем в 2 раза
        const maxMacro = Math.max(totalProtein, totalFat, totalCarbs);
        const minMacro = Math.min(
          totalProtein || 1,
          totalFat || 1,
          totalCarbs || 1
        );
        const isBalanced = maxMacro <= minMacro * 2;

        return isBalanced;

      default:
        return true;
    }
  };

  // Фильтрация рецептов (применяем оба фильтра)
  const filteredRecipes = useMemo(() => {
    return recipes.filter((recipe) => {
      const matchesType = filterByType(recipe);
      const matchesGoal = filterByGoal(recipe);
      return matchesType && matchesGoal;
    });
  }, [recipes, typeFilter, goalFilter, user?.id]);

  return (
    <div className="min-h-screen bg-white dark:bg-gray-900">
      {/* Header */}
      <header className="px-2 sm:px-4 md:px-6 lg:px-8 pt-4 pb-3 border-b border-gray-200 dark:border-gray-700">
        <div className="flex items-center justify-between mb-3">
          <div className="w-6" />
          <h1 className="text-sm font-semibold text-gray-900 dark:text-white uppercase flex-1 text-center">
            РЕЦЕПТЫ
          </h1>
          <button
            onClick={() => navigate(-1)}
            className="p-2 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors"
            aria-label="Закрыть"
          >
            <X className="w-5 h-5 text-gray-700 dark:text-gray-300" />
          </button>
        </div>

        {/* Tabs */}
        <div className="flex justify-center gap-6 text-[11px] uppercase text-gray-600 dark:text-gray-300 mb-3">
          <button
            onClick={() => setActiveTab('my')}
            className={`pb-2 border-b-2 transition-colors ${
              activeTab === 'my'
                ? 'border-gray-900 dark:border-gray-100 text-gray-900 dark:text-white font-semibold'
                : 'border-transparent'
            }`}
          >
            МОИ РЕЦЕПТЫ
          </button>
          <button
            onClick={() => setActiveTab('favorites')}
            className={`pb-2 border-b-2 transition-colors ${
              activeTab === 'favorites'
                ? 'border-gray-900 dark:border-gray-100 text-gray-900 dark:text-white font-semibold'
                : 'border-transparent'
            }`}
          >
            ИЗБРАННЫЕ
          </button>
          <button
            onClick={() => setActiveTab('collection')}
            className={`pb-2 border-b-2 transition-colors ${
              activeTab === 'collection'
                ? 'border-gray-900 dark:border-gray-100 text-gray-900 dark:text-white font-semibold'
                : 'border-transparent'
            }`}
          >
            СБОРНИК
          </button>
        </div>

        {/* Controls */}
        <div className="flex items-center justify-end gap-3">
          <button
            onClick={toggleViewMode}
            className={`p-1.5 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors ${
              viewMode === 'grid' ? 'bg-gray-100 dark:bg-gray-800' : ''
            }`}
            aria-label="Переключить вид"
          >
            {viewMode === 'grid' ? (
              <Grid className="w-4 h-4 text-gray-900 dark:text-gray-100" />
            ) : (
              <List className="w-4 h-4 text-gray-900 dark:text-gray-100" />
            )}
          </button>
          <button
            ref={filterButtonRef}
            onClick={() => setIsFilterDropdownOpen((prev) => !prev)}
            className={`p-1.5 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors relative ${
              typeFilter !== 'all' || goalFilter !== 'all'
                ? 'bg-green-100 dark:bg-green-900/20'
                : ''
            }`}
            aria-label="Фильтр"
          >
            <Filter className="w-4 h-4 text-gray-600 dark:text-gray-400" />
            {(typeFilter !== 'all' || goalFilter !== 'all') && (
              <span className="absolute top-0 right-0 w-2 h-2 bg-green-500 rounded-full"></span>
            )}
          </button>
        </div>
      </header>

      {/* Recipe Display */}
      <main className="px-2 sm:px-4 md:px-6 lg:px-8 py-4">
        {filteredRecipes.length === 0 ? (
          <div className="text-center text-sm text-gray-500 dark:text-gray-400 py-8">
            {recipes.length === 0
              ? 'Нет рецептов в этой категории'
              : 'Нет рецептов по выбранным фильтрам'}
          </div>
        ) : viewMode === 'grid' ? (
          <RecipesGrid recipes={filteredRecipes} onRecipeClick={handleRecipeClick} userId={user?.id} />
        ) : (
          <RecipesList recipes={filteredRecipes} onRecipeClick={handleRecipeClick} userId={user?.id} />
        )}
      </main>

      {/* Filter Dropdown */}
      <RecipeFilterDropdown
        isOpen={isFilterDropdownOpen}
        onClose={() => setIsFilterDropdownOpen(false)}
        anchorEl={filterButtonRef.current}
        typeFilter={typeFilter}
        goalFilter={goalFilter}
        onTypeFilterChange={setTypeFilter}
        onGoalFilterChange={setGoalFilter}
        onReset={() => {
          setTypeFilter('all');
          setGoalFilter('all');
        }}
        userGoal={user?.profile?.goal}
        onApplyRecommendation={() => {
          // Рекомендация уже применена через onTypeFilterChange и onGoalFilterChange
          console.log('[Recipes] Recommendation applied, user goal:', user?.profile?.goal);
        }}
      />
    </div>
  );
};

export default Recipes;

