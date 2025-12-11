import { useState, useEffect } from 'react';
import { X } from 'lucide-react';
import { LocalIngredient } from '../services/localAIFoodAnalyzer';

interface RecipeAnalyzeResultSheetProps {
  isOpen: boolean;
  ingredients: LocalIngredient[];
  onChange: (ings: LocalIngredient[]) => void;
  onConfirm: (ings: LocalIngredient[]) => void;
  onReject: () => void;
}

const RecipeAnalyzeResultSheet = ({
  isOpen,
  ingredients,
  onChange,
  onConfirm,
  onReject,
}: RecipeAnalyzeResultSheetProps) => {
  const [localIngs, setLocalIngs] = useState<LocalIngredient[]>(ingredients);

  useEffect(() => {
    setLocalIngs(ingredients);
  }, [ingredients]);

  const handleGramChange = (id: string, value: string) => {
    const grams = value === '' ? undefined : Math.max(0, parseFloat(value));
    const updated = localIngs.map((ing) =>
      ing.id === id ? { ...ing, grams } : ing
    );
    setLocalIngs(updated);
    onChange(updated);
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-black bg-opacity-50" onClick={onReject}>
      <div
        className="w-full max-w-md bg-white dark:bg-gray-900 rounded-t-3xl shadow-2xl p-5 space-y-4 transform transition-transform duration-200 ease-out"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between">
          <h3 className="text-base font-semibold text-gray-900 dark:text-white">
            Найденные ингредиенты
          </h3>
          <button
            onClick={onReject}
            className="p-2 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors"
            aria-label="Закрыть"
          >
            <X className="w-5 h-5 text-gray-700 dark:text-gray-300" />
          </button>
        </div>

        <div className="max-h-[60vh] overflow-y-auto space-y-3">
          {localIngs.length === 0 && (
            <p className="text-sm text-gray-600 dark:text-gray-400">
              Не удалось определить ингредиенты. Попробуйте другое фото или выберите другое изображение.
            </p>
          )}
          {localIngs.map((ing) => (
            <div
              key={ing.id}
              className="p-3 rounded-xl border border-gray-200 dark:border-gray-800 bg-gray-50 dark:bg-gray-800"
            >
              <div className="flex items-center justify-between gap-2 mb-2">
                <p className="text-sm font-semibold text-gray-900 dark:text-white">
                  {ing.name}
                </p>
                {ing.caloriesPer100 && (
                  <span className="text-xs text-gray-500 dark:text-gray-400">
                    {Math.round(ing.caloriesPer100)} ккал / 100г
                  </span>
                )}
              </div>
              <div className="flex items-center gap-2">
                <label className="text-xs text-gray-600 dark:text-gray-400 whitespace-nowrap">
                  Грамм:
                </label>
                <input
                  type="number"
                  min="0"
                  value={ing.grams ?? ''}
                  onChange={(e) => handleGramChange(ing.id, e.target.value)}
                  className="w-28 px-3 py-2 rounded-lg border border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-900 text-gray-900 dark:text-white text-sm focus:outline-none focus:ring-2 focus:ring-green-500"
                  placeholder="—"
                />
              </div>
            </div>
          ))}
        </div>

        <div className="flex flex-col gap-2">
          <button
            onClick={() => onConfirm(localIngs)}
            className="w-full py-3 rounded-xl bg-gray-900 dark:bg-white text-white dark:text-gray-900 font-semibold text-sm hover:bg-gray-800 dark:hover:bg-gray-100 transition-colors"
          >
            Подтвердить добавление
          </button>
          <button
            onClick={() => onChange(localIngs)}
            className="w-full py-3 rounded-xl border border-gray-300 dark:border-gray-700 text-gray-900 dark:text-white font-semibold text-sm bg-white dark:bg-gray-900 hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors"
          >
            Редактировать
          </button>
          <button
            onClick={onReject}
            className="w-full py-3 rounded-xl border border-gray-300 dark:border-gray-700 text-gray-900 dark:text-white font-semibold text-sm bg-white dark:bg-gray-900 hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors"
          >
            Отклонить
          </button>
        </div>
      </div>
    </div>
  );
};

export default RecipeAnalyzeResultSheet;

