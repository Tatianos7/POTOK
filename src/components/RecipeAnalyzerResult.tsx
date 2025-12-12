import React from 'react';
import { CalculatedIngredient, NutritionTotals } from '../utils/nutritionCalculator';
import RecipeIngredientsTable from './RecipeIngredientsTable';

interface Props {
  items: CalculatedIngredient[];
  totals: NutritionTotals;
  onSaveMenu: () => void;
  onSaveRecipes: () => void;
  onSaveBoth: () => void;
}

const RecipeAnalyzerResult: React.FC<Props> = ({ items, totals, onSaveMenu, onSaveRecipes, onSaveBoth }) => {
  const hasItems = items.length > 0;

  return (
    <div className="space-y-4">
      {hasItems ? (
        <>
          <RecipeIngredientsTable items={items} />

          <div className="px-2 text-sm text-gray-800">
            <div className="flex justify-between">
              <span className="font-semibold">ИТОГО</span>
              <span className="text-right text-gray-900">{Math.round(totals.total.calories)} ккал</span>
            </div>
            <div className="flex justify-between text-[12px] text-gray-600">
              <span>На 100 г</span>
              <span>{`${totals.per100.proteins.toFixed(2)} / ${totals.per100.fats.toFixed(2)} / ${totals.per100.carbs.toFixed(2)} / ${Math.round(
                totals.per100.calories
              )} ккал`}</span>
            </div>
          </div>
        </>
      ) : (
        <div className="text-center text-sm text-gray-500 pt-4">Здесь появится результат анализа</div>
      )}

      <div className="space-y-3 pt-2">
        <button
          onClick={onSaveMenu}
          className="w-full h-12 rounded-full border border-gray-800 text-gray-900 text-sm font-semibold"
        >
          СОХРАНИТЬ В МЕНЮ
        </button>
        <button
          onClick={onSaveRecipes}
          className="w-full h-12 rounded-full border border-gray-800 text-gray-900 text-sm font-semibold"
        >
          СОХРАНИТЬ В МОИ РЕЦЕПТЫ
        </button>
        <button
          onClick={onSaveBoth}
          className="w-full h-12 rounded-full bg-black text-white text-sm font-semibold"
        >
          СОХРАНИТЬ В МОИ РЕЦЕПТЫ И В МЕНЮ
        </button>
      </div>
    </div>
  );
};

export default RecipeAnalyzerResult;

