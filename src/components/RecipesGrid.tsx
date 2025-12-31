import { Recipe } from '../types/recipe';
import { getRecipeBadges } from '../utils/recipeBadges';
import RecipeBadge from './RecipeBadge';

interface RecipesGridProps {
  recipes: Recipe[];
  onRecipeClick: (recipe: Recipe) => void;
  userId?: string;
}

const RecipesGrid = ({ recipes, onRecipeClick, userId }: RecipesGridProps) => {
  return (
    <div className="grid grid-cols-2 gap-3">
      {recipes.map((recipe) => {
        const badges = getRecipeBadges(recipe, userId);
        
        return (
          <button
            key={recipe.id}
            onClick={() => onRecipeClick(recipe)}
            className="flex flex-col gap-2 text-left bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 overflow-hidden hover:shadow-md transition-shadow relative"
          >
            {/* Recipe Image */}
            <div className="w-full aspect-square rounded-t-xl overflow-hidden bg-gray-200 dark:bg-gray-700 relative">
              {recipe.image ? (
                <img
                  src={recipe.image}
                  alt={recipe.name}
                  className="w-full h-full object-cover"
                  onError={(e) => {
                    (e.target as HTMLImageElement).src = 'https://via.placeholder.com/200x200?text=Recipe';
                  }}
                />
              ) : (
                <div className="w-full h-full flex items-center justify-center">
                  <span className="text-gray-400 text-xs">Нет фото</span>
                </div>
              )}
              
              {/* Badges overlay */}
              {badges.length > 0 && (
                <div className="absolute top-2 left-2 flex flex-col gap-1 z-10">
                  {badges.map((badge, idx) => (
                    <RecipeBadge key={idx} badge={badge} size="sm" />
                  ))}
                </div>
              )}
            </div>

          {/* Recipe Info */}
          <div className="px-3 pb-3 space-y-1">
            {/* Recipe Name */}
            <div className="font-medium text-sm text-gray-900 dark:text-white line-clamp-2">
              {recipe.name || 'НАЗВАНИЕ'}
            </div>

            {/* Calories */}
            <div className="text-xs text-gray-600 dark:text-gray-400">
              {recipe.totalCalories && recipe.totalCalories > 0
                ? `${Math.round(recipe.totalCalories)} ккал`
                : recipe.caloriesPer100 && recipe.caloriesPer100 > 0
                ? `${Math.round(recipe.caloriesPer100)} ккал / 100г`
                : '—'}
            </div>

            {/* БЖУ */}
            {(recipe.totalProteins || recipe.totalFats || recipe.totalCarbs) && (
              <div className="text-[10px] text-gray-500 dark:text-gray-500 flex gap-2">
                {recipe.totalProteins && recipe.totalProteins > 0 && (
                  <span>Б: {Math.round(recipe.totalProteins)}г</span>
                )}
                {recipe.totalFats && recipe.totalFats > 0 && (
                  <span>Ж: {Math.round(recipe.totalFats)}г</span>
                )}
                {recipe.totalCarbs && recipe.totalCarbs > 0 && (
                  <span>У: {Math.round(recipe.totalCarbs)}г</span>
                )}
              </div>
            )}
          </div>
          </button>
        );
      })}
    </div>
  );
};

export default RecipesGrid;

