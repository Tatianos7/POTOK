import { useState, useEffect } from 'react';
import { Recipe } from '../types/recipe';
import { getRecipeBadges } from '../utils/recipeBadges';
import RecipeBadge from './RecipeBadge';
import { recipeNotesService } from '../services/recipeNotesService';

interface RecipesGridProps {
  recipes: Recipe[];
  onRecipeClick: (recipe: Recipe) => void;
  userId?: string;
}

const RecipesGrid = ({ recipes, onRecipeClick, userId }: RecipesGridProps) => {
  const [recipeNotes, setRecipeNotes] = useState<Record<string, string>>({});

  // Загружаем заметки для всех рецептов
  useEffect(() => {
    if (!userId || recipes.length === 0) return;

    const recipeIds = recipes.map((r) => r.id);
    recipeNotesService.getNotesByRecipeIds(userId, recipeIds).then((notes) => {
      setRecipeNotes(notes);
    }).catch((error) => {
      console.error('[RecipesGrid] Error loading notes:', error);
    });
  }, [recipes, userId]);

  return (
    <div className="grid grid-cols-2 gap-2 min-[376px]:gap-3 w-full max-w-full">
      {recipes.map((recipe) => {
        const badges = getRecipeBadges(recipe, userId);
        const note = recipeNotes[recipe.id];
        
        return (
          <button
            key={recipe.id}
            onClick={() => onRecipeClick(recipe)}
            className="flex flex-col gap-1.5 min-[376px]:gap-2 text-left bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 overflow-hidden hover:shadow-md transition-shadow relative w-full max-w-full"
            style={{ boxSizing: 'border-box' }}
          >
            {/* Recipe Image */}
            <div className="w-full aspect-square rounded-t-xl overflow-hidden bg-gray-200 dark:bg-gray-700 relative">
              {recipe.image ? (
                <img
                  src={recipe.image}
                  alt={recipe.name}
                  className="w-full h-full max-w-full max-h-full object-cover"
                  style={{ maxWidth: '100%', height: 'auto' }}
                  onError={(e) => {
                    const target = e.target as HTMLImageElement;
                    target.style.display = 'none';
                  }}
                />
              ) : (
                <div className="w-full h-full flex items-center justify-center">
                  <span className="text-gray-400 text-[9px] min-[376px]:text-xs break-words overflow-wrap-anywhere">Нет фото</span>
                </div>
              )}
              
              {/* Badges overlay */}
              {badges.length > 0 && (
                <div className="absolute top-1 min-[376px]:top-2 left-1 min-[376px]:left-2 flex flex-col gap-1 z-10">
                  {badges.map((badge, idx) => (
                    <RecipeBadge key={idx} badge={badge} size="sm" />
                  ))}
                </div>
              )}
            </div>

          {/* Recipe Info */}
          <div className="px-1.5 min-[376px]:px-3 pb-1.5 min-[376px]:pb-3 space-y-1 w-full max-w-full overflow-hidden" style={{ boxSizing: 'border-box' }}>
            {/* Recipe Name */}
            <div className="font-medium text-xs min-[376px]:text-sm text-gray-900 dark:text-white line-clamp-2 break-words overflow-wrap-anywhere"
              style={{ 
                wordBreak: 'break-word',
                overflowWrap: 'anywhere',
                hyphens: 'auto'
              }}
            >
              {recipe.name || 'НАЗВАНИЕ'}
            </div>

            {/* Calories */}
            <div className="text-[10px] min-[376px]:text-xs text-gray-600 dark:text-gray-400 break-words overflow-wrap-anywhere">
              {recipe.totalCalories && recipe.totalCalories > 0
                ? `${Math.round(recipe.totalCalories)} ккал`
                : recipe.caloriesPer100 && recipe.caloriesPer100 > 0
                ? `${Math.round(recipe.caloriesPer100)} ккал / 100г`
                : '—'}
            </div>

            {/* БЖУ */}
            {(recipe.totalProteins || recipe.totalFats || recipe.totalCarbs) && (
              <div className="text-[9px] min-[376px]:text-[10px] text-gray-500 dark:text-gray-500 flex flex-wrap gap-1 min-[376px]:gap-2">
                {recipe.totalProteins && recipe.totalProteins > 0 && (
                  <span className="shrink-0">Б: {Math.round(recipe.totalProteins)}г</span>
                )}
                {recipe.totalFats && recipe.totalFats > 0 && (
                  <span className="shrink-0">Ж: {Math.round(recipe.totalFats)}г</span>
                )}
                {recipe.totalCarbs && recipe.totalCarbs > 0 && (
                  <span className="shrink-0">У: {Math.round(recipe.totalCarbs)}г</span>
                )}
              </div>
            )}

            {/* Состав рецепта */}
            {recipe.ingredients && recipe.ingredients.length > 0 && (
              <div className="mt-1 min-[376px]:mt-1.5 pt-1 min-[376px]:pt-1.5 border-t border-gray-200 dark:border-gray-700">
                <div className="text-[8px] min-[376px]:text-[9px] font-semibold text-gray-600 dark:text-gray-400 mb-0.5">
                  Состав:
                </div>
                <div className="text-[8px] min-[376px]:text-[9px] text-gray-500 dark:text-gray-500 line-clamp-2 break-words overflow-wrap-anywhere">
                  {recipe.ingredients.slice(0, 2).map((ing, idx) => (
                    <span key={idx}>
                      {ing.name}
                      {idx < Math.min(1, recipe.ingredients!.length - 1) && ', '}
                    </span>
                  ))}
                  {recipe.ingredients.length > 2 && '...'}
                </div>
              </div>
            )}

            {/* Заметка к рецепту */}
            {note && (
              <div className="mt-1 min-[376px]:mt-1.5 pt-1 min-[376px]:pt-1.5 border-t border-gray-200 dark:border-gray-700">
                <div className="text-[8px] min-[376px]:text-[9px] font-semibold text-gray-600 dark:text-gray-400 mb-0.5">
                  Заметка:
                </div>
                <div className="text-[8px] min-[376px]:text-[9px] text-gray-500 dark:text-gray-500 line-clamp-2 break-words overflow-wrap-anywhere">
                  {note}
                </div>
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

