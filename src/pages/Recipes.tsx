import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { X, List, Filter } from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { recipesService } from '../services/recipesService';
import { Recipe, RecipeTab } from '../types/recipe';

const Recipes = () => {
  const navigate = useNavigate();
  const { user } = useAuth();

  const [activeTab, setActiveTab] = useState<RecipeTab>('my');
  const [recipes, setRecipes] = useState<Recipe[]>([]);

  useEffect(() => {
    if (user?.id) {
      const loadedRecipes = recipesService.getRecipesByTab(activeTab, user.id);
      setRecipes(loadedRecipes);
    } else {
      const loadedRecipes = recipesService.getRecipesByTab(activeTab);
      setRecipes(loadedRecipes);
    }
  }, [activeTab, user?.id]);

  const handleRecipeClick = (recipe: Recipe) => {
    // TODO: открыть детальную страницу рецепта или модальное окно
    console.log('Recipe clicked:', recipe);
  };

  return (
    <div className="min-h-screen bg-white dark:bg-gray-900">
      {/* Header */}
      <header className="px-4 pt-4 pb-3 border-b border-gray-200 dark:border-gray-700">
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
            className="p-1.5 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors"
            aria-label="Переключить вид"
          >
            <List className="w-4 h-4 text-gray-600 dark:text-gray-400" />
          </button>
          <button
            className="p-1.5 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors"
            aria-label="Фильтр"
          >
            <Filter className="w-4 h-4 text-gray-600 dark:text-gray-400" />
          </button>
        </div>
      </header>

      {/* Recipe Grid */}
      <main className="px-4 py-4">
        {recipes.length === 0 ? (
          <div className="text-center text-sm text-gray-500 dark:text-gray-400 py-8">
            Нет рецептов в этой категории
          </div>
        ) : (
          <div className="grid grid-cols-3 gap-3">
            {recipes.map((recipe) => (
              <button
                key={recipe.id}
                onClick={() => handleRecipeClick(recipe)}
                className="flex flex-col items-center gap-1 text-left"
              >
                {/* Recipe Image */}
                <div className="w-full aspect-square rounded-xl overflow-hidden border border-gray-300 dark:border-gray-700">
                  {recipe.image ? (
                    <img
                      src={recipe.image}
                      alt={recipe.name}
                      className="w-full h-full object-cover"
                      onError={(e) => {
                        // Fallback если изображение не загрузилось
                        (e.target as HTMLImageElement).src = 'https://via.placeholder.com/200x200?text=Recipe';
                      }}
                    />
                  ) : (
                    <div className="w-full h-full bg-gray-200 dark:bg-gray-700 flex items-center justify-center">
                      <span className="text-gray-400 text-xs">Нет фото</span>
                    </div>
                  )}
                </div>

                {/* Recipe Name */}
                <div className="text-center text-[11px] text-gray-800 dark:text-gray-200 leading-tight w-full">
                  <div className="font-medium">{recipe.name || 'НАЗВАНИЕ'}</div>
                  {/* КБЖУ на 100г */}
                  {recipe.caloriesPer100 > 0 && (
                    <div className="text-[10px] text-gray-600 dark:text-gray-400 mt-0.5">
                      {Math.round(recipe.caloriesPer100)} ккал. 100г
                    </div>
                  )}
                </div>
              </button>
            ))}
          </div>
        )}
      </main>
    </div>
  );
};

export default Recipes;

