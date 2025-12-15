import { useMemo, useState } from 'react';
import { X } from 'lucide-react';
import { recipeDiaryService } from '../services/recipeDiaryService';
import { useAuth } from '../context/AuthContext';

interface SaveRecipeToDiarySheetProps {
  isOpen: boolean;
  onClose: () => void;
  recipeName: string;
  per100: { calories: number; proteins: number; fats: number; carbs: number };
  defaultMealType?: 'breakfast' | 'lunch' | 'dinner' | 'snack';
  date: string;
  onSaved?: () => void;
}

const mealLabels: Record<'breakfast' | 'lunch' | 'dinner' | 'snack', string> = {
  breakfast: 'Завтрак',
  lunch: 'Обед',
  dinner: 'Ужин',
  snack: 'Перекус',
};

const SaveRecipeToDiarySheet = ({
  isOpen,
  onClose,
  recipeName,
  per100,
  defaultMealType,
  date,
  onSaved,
}: SaveRecipeToDiarySheetProps) => {
  const { user } = useAuth();
  const [weight, setWeight] = useState<number>(100);
  const [mealType, setMealType] = useState<'breakfast' | 'lunch' | 'dinner' | 'snack'>(defaultMealType || 'breakfast');

  const multiplier = useMemo(() => (weight && weight > 0 ? weight / 100 : 0), [weight]);
  const calories = useMemo(() => Math.round(per100.calories * multiplier), [per100.calories, multiplier]);
  const proteins = useMemo(() => Math.round(per100.proteins * multiplier * 10) / 10, [per100.proteins, multiplier]);
  const fats = useMemo(() => Math.round(per100.fats * multiplier * 10) / 10, [per100.fats, multiplier]);
  const carbs = useMemo(() => Math.round(per100.carbs * multiplier * 10) / 10, [per100.carbs, multiplier]);

  if (!isOpen) return null;

  const handleSave = () => {
    if (!user?.id) return;
    const targetMeal = defaultMealType || mealType;
    recipeDiaryService.saveRecipeEntry({
      userId: user.id,
      date,
      mealType: targetMeal,
      recipeName: recipeName?.trim() || 'Рецепт',
      weight: weight || 0,
      per100,
      totals: { calories, proteins, fats, carbs },
    });
    onClose();
    onSaved?.();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-black bg-opacity-50" onClick={onClose}>
      <div
        className="w-full max-w-md bg-white dark:bg-gray-900 rounded-t-3xl shadow-2xl p-5 space-y-4"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between">
          <div className="flex flex-col">
            <span className="text-xs text-gray-500">
              {defaultMealType ? mealLabels[defaultMealType] : 'Выберите прием пищи'}
            </span>
            <span className="text-[10px] text-gray-400">{date}</span>
          </div>
          <button
            onClick={onClose}
            className="p-2 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors"
            aria-label="Закрыть"
          >
            <X className="w-5 h-5 text-gray-700 dark:text-gray-300" />
          </button>
        </div>

        <div className="space-y-1">
          <div className="text-sm font-semibold text-gray-900 dark:text-white">{recipeName || 'Рецепт'}</div>
          <div className="flex items-center gap-2 text-xs text-gray-500">
            <span>Вес, г</span>
            <input
              type="number"
              min={1}
              value={weight}
              onChange={(e) => setWeight(Math.max(0, Number(e.target.value) || 0))}
              className="w-20 h-8 border border-gray-300 rounded-md px-2 text-sm text-gray-900 dark:text-white bg-white dark:bg-gray-800"
            />
          </div>
        </div>

        <div className="grid grid-cols-2 gap-3 text-center text-sm font-semibold">
          <div className="border-2 border-blue-400 rounded-xl py-3">
            <div className="text-gray-800 dark:text-white">Калории</div>
            <div className="text-gray-900 dark:text-white text-lg">{calories}</div>
          </div>
          <div className="border-2 border-orange-400 rounded-xl py-3">
            <div className="text-gray-800 dark:text-white">Белки</div>
            <div className="text-gray-900 dark:text-white text-lg">{proteins}</div>
          </div>
          <div className="border-2 border-yellow-400 rounded-xl py-3">
            <div className="text-gray-800 dark:text-white">Жиры</div>
            <div className="text-gray-900 dark:text-white text-lg">{fats}</div>
          </div>
          <div className="border-2 border-green-500 rounded-xl py-3">
            <div className="text-gray-800 dark:text-white">Углеводы</div>
            <div className="text-gray-900 dark:text-white text-lg">{carbs}</div>
          </div>
        </div>

        {!defaultMealType && (
          <div className="grid grid-cols-4 gap-2 text-xs">
            {(['breakfast', 'lunch', 'dinner', 'snack'] as const).map((m) => (
              <button
                key={m}
                onClick={() => setMealType(m)}
                className={`py-2 rounded-lg border text-center ${
                  mealType === m ? 'border-green-500 text-green-600' : 'border-gray-300 text-gray-700'
                }`}
              >
                {mealLabels[m]}
              </button>
            ))}
          </div>
        )}

        <div className="space-y-2 pt-2">
          <button
            onClick={handleSave}
            className="w-full py-3 rounded-xl bg-black text-white text-sm font-semibold hover:bg-gray-800"
          >
            СОХРАНИТЬ
          </button>
          <button
            onClick={onClose}
            className="w-full py-3 rounded-xl border border-gray-400 text-sm font-semibold text-gray-800 dark:text-gray-200"
          >
            УДАЛИТЬ
          </button>
        </div>
      </div>
    </div>
  );
};

export default SaveRecipeToDiarySheet;