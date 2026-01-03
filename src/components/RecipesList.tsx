import { useState, useEffect } from 'react';
import { Recipe } from '../types/recipe';
import { getRecipeBadges } from '../utils/recipeBadges';
import RecipeBadge from './RecipeBadge';
import { recipeNotesService } from '../services/recipeNotesService';

interface RecipesListProps {
  recipes: Recipe[];
  onRecipeClick: (recipe: Recipe) => void;
  userId?: string;
}

const RecipesList = ({ recipes, onRecipeClick, userId }: RecipesListProps) => {
  const [recipeNotes, setRecipeNotes] = useState<Record<string, string>>({});

  // Загружаем заметки для всех рецептов
  useEffect(() => {
    if (!userId || recipes.length === 0) return;

    const recipeIds = recipes.map((r) => r.id);
    recipeNotesService.getNotesByRecipeIds(userId, recipeIds).then((notes) => {
      setRecipeNotes(notes);
    }).catch((error) => {
      console.error('[RecipesList] Error loading notes:', error);
    });
  }, [recipes, userId]);

  return (
    <div className="space-y-2">
      {recipes.map((recipe) => {
        const badges = getRecipeBadges(recipe, userId);
        const note = recipeNotes[recipe.id];
        
        return (
          <button
            key={recipe.id}
            onClick={() => onRecipeClick(recipe)}
            className="w-full flex items-center gap-3 p-3 bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 hover:shadow-md transition-shadow text-left"
          >
            {/* Recipe Image (миниатюра) */}
            <div className="w-20 h-20 flex-shrink-0 rounded-lg overflow-hidden bg-gray-200 dark:bg-gray-700">
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
                  <span className="text-gray-400 text-[10px]">Нет фото</span>
                </div>
              )}
            </div>

            {/* Recipe Info */}
            <div className="flex-1 min-w-0 space-y-1">
              {/* Recipe Name */}
              <div className="font-medium text-sm text-gray-900 dark:text-white line-clamp-1">
                {recipe.name || 'НАЗВАНИЕ'}
              </div>
              
              {/* Badges */}
              {badges.length > 0 && (
                <div className="flex flex-wrap gap-1">
                  {badges.map((badge, idx) => (
                    <RecipeBadge key={idx} badge={badge} size="sm" />
                  ))}
                </div>
              )}

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
              <div className="text-[11px] text-gray-500 dark:text-gray-500">
                {recipe.totalProteins && recipe.totalProteins > 0 && (
                  <span className="mr-3">Белки: {Math.round(recipe.totalProteins)}г</span>
                )}
                {recipe.totalFats && recipe.totalFats > 0 && (
                  <span className="mr-3">Жиры: {Math.round(recipe.totalFats)}г</span>
                )}
                {recipe.totalCarbs && recipe.totalCarbs > 0 && (
                  <span>Углеводы: {Math.round(recipe.totalCarbs)}г</span>
                )}
              </div>
            )}

            {/* Состав рецепта */}
            {recipe.ingredients && recipe.ingredients.length > 0 && (
              <div className="mt-2 pt-2 border-t border-gray-200 dark:border-gray-700">
                <div className="text-[10px] font-semibold text-gray-600 dark:text-gray-400 mb-1">
                  Состав:
                </div>
                <div className="text-[10px] text-gray-500 dark:text-gray-500 line-clamp-2">
                  {recipe.ingredients.slice(0, 3).map((ing, idx) => (
                    <span key={idx}>
                      {ing.name}
                      {idx < Math.min(2, recipe.ingredients!.length - 1) && ', '}
                    </span>
                  ))}
                  {recipe.ingredients.length > 3 && '...'}
                </div>
              </div>
            )}

            {/* Заметка к рецепту */}
            {note && (
              <div className="mt-2 pt-2 border-t border-gray-200 dark:border-gray-700">
                <div className="text-[10px] font-semibold text-gray-600 dark:text-gray-400 mb-1">
                  Заметка:
                </div>
                <div className="text-[10px] text-gray-500 dark:text-gray-500 line-clamp-2">
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

export default RecipesList;

