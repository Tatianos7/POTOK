import { useState, useEffect } from 'react';
import { X } from 'lucide-react';

interface EditGoalModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSave: (data: { calories: string; proteins: string; fats: string; carbs: string }) => Promise<void> | void;
  initialData: {
    calories: string;
    proteins: string;
    fats: string;
    carbs: string;
  };
  bmr?: number | null;
  weight?: number | null;
}

const recalculateMacros = (weight: number, calories: number) => {
  if (!Number.isFinite(weight) || !Number.isFinite(calories) || weight <= 0 || calories <= 0) {
    return null;
  }

  const proteins = Math.round(weight * 2);
  const fats = Math.round(weight * 0.9);
  const caloriesProtein = proteins * 4;
  const caloriesFat = fats * 9;
  const caloriesForCarbs = calories - caloriesProtein - caloriesFat;
  if (caloriesForCarbs <= 0) {
    return {
      proteins,
      fats,
      carbs: 0,
    };
  }
  const carbsExact = caloriesForCarbs / 4;
  const carbsFloor = Math.floor(carbsExact);
  const carbsCeil = Math.ceil(carbsExact);
  const totalWithFloor = caloriesProtein + caloriesFat + carbsFloor * 4;
  const totalWithCeil = caloriesProtein + caloriesFat + carbsCeil * 4;
  const diffFloor = Math.abs(totalWithFloor - calories);
  const diffCeil = Math.abs(totalWithCeil - calories);
  const carbs = diffFloor <= diffCeil ? carbsFloor : carbsCeil;
  return {
    proteins,
    fats,
    carbs,
  };
};

const EditGoalModal = ({ isOpen, onClose, onSave, initialData, bmr, weight }: EditGoalModalProps) => {
  const [formData, setFormData] = useState({
    calories: initialData.calories || '',
    proteins: initialData.proteins || '',
    fats: initialData.fats || '',
    carbs: initialData.carbs || '',
  });

  const bmrValue = Number(bmr);
  const caloriesValue = Number(formData.calories);
  const showBmrWarning =
    Number.isFinite(bmrValue) &&
    Number.isFinite(caloriesValue) &&
    bmrValue > 0 &&
    caloriesValue > 0 &&
    caloriesValue < bmrValue;

  useEffect(() => {
    if (isOpen) {
      document.body.style.overflow = 'hidden';
      // Обновляем данные формы при открытии модального окна
      setFormData({
        calories: initialData.calories || '',
        proteins: initialData.proteins || '',
        fats: initialData.fats || '',
        carbs: initialData.carbs || '',
      });
    } else {
      document.body.style.overflow = '';
    }
    return () => {
      document.body.style.overflow = '';
    };
  }, [isOpen, initialData]);

  if (!isOpen) return null;

  const handleChange = (field: keyof typeof formData) => (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = e.target.value;
    // Разрешаем только числа
    if (value === '' || /^\d+$/.test(value)) {
      setFormData((prev) => ({
        ...prev,
        [field]: value,
      }));
    }
  };

  const handleCaloriesChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = e.target.value;
    if (value !== '' && !/^\d+$/.test(value)) return;

    setFormData((prev) => {
      const nextCalories = value;
      const next = {
        ...prev,
        calories: nextCalories,
      };
      const weightValue = Number(weight);
      const caloriesNumber = Number(nextCalories);
      const macros = recalculateMacros(weightValue, caloriesNumber);
      if (macros) {
        return {
          ...next,
          proteins: String(macros.proteins),
          fats: String(macros.fats),
          carbs: String(macros.carbs),
        };
      }
      return next;
    });
  };

  const handleCaloriesBlur = () => {
    const weightValue = Number(weight);
    const caloriesNumber = Number(formData.calories);
    const macros = recalculateMacros(weightValue, caloriesNumber);
    if (!macros) return;
    setFormData((prev) => ({
      ...prev,
      proteins: String(macros.proteins),
      fats: String(macros.fats),
      carbs: String(macros.carbs),
    }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      await onSave(formData);
      onClose();
    } catch {
      // Keep modal open when save fails; parent shows error message.
    }
  };

  const inputClasses = 'w-full max-w-full px-2 min-[376px]:px-3 py-1.5 min-[376px]:py-2 rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 text-gray-900 dark:text-white text-xs min-[376px]:text-sm focus:outline-none focus:ring-2 focus:ring-green-500';

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-50 p-2 min-[376px]:p-4">
      <div className="bg-white dark:bg-gray-900 rounded-xl w-full max-w-[calc(100vw-16px)] min-[376px]:max-w-md max-h-[90vh] overflow-y-auto">
        {/* Header */}
        <header className="px-2 min-[376px]:px-4 py-3 min-[376px]:py-4 flex items-center justify-between border-b border-gray-200 dark:border-gray-700 sticky top-0 bg-white dark:bg-gray-900 z-10 w-full max-w-full overflow-hidden">
          <div className="flex-1"></div>
          <h1 className="text-base min-[376px]:text-lg font-semibold text-gray-900 dark:text-white flex-1 text-center uppercase whitespace-nowrap">
            РЕДАКТИРОВАТЬ ЦЕЛЬ
          </h1>
          <div className="flex-1 flex justify-end">
            <button
              onClick={onClose}
              className="p-1.5 min-[376px]:p-2 hover:bg-gray-100 dark:hover:bg-gray-800 rounded-lg transition-colors flex-shrink-0"
              aria-label="Закрыть"
            >
              <X className="w-5 h-5 min-[376px]:w-6 min-[376px]:h-6 text-gray-700 dark:text-gray-300" />
            </button>
          </div>
        </header>

        <form onSubmit={handleSubmit} className="px-2 min-[376px]:px-4 py-4 min-[376px]:py-6 space-y-4 min-[376px]:space-y-6 w-full max-w-full overflow-hidden">
          {/* Calories */}
          <div className="w-full max-w-full overflow-hidden">
            <label className="block text-xs min-[376px]:text-sm font-medium text-gray-700 dark:text-gray-300 mb-1.5 min-[376px]:mb-2">
              Калории
            </label>
            <input
              type="text"
              inputMode="numeric"
              value={formData.calories}
              onChange={handleCaloriesChange}
              onBlur={handleCaloriesBlur}
              className={inputClasses}
              style={{ boxSizing: 'border-box' }}
              placeholder="0"
            />
            {showBmrWarning && (
              <div className="mt-1 text-[11px] text-red-600">
                Это ниже базового обмена. Может быть опасно для здоровья.
              </div>
            )}
          </div>

          {/* Proteins */}
          <div className="w-full max-w-full overflow-hidden">
            <label className="block text-xs min-[376px]:text-sm font-medium text-gray-700 dark:text-gray-300 mb-1.5 min-[376px]:mb-2">
              Белки (г)
            </label>
            <input
              type="text"
              inputMode="numeric"
              value={formData.proteins}
              onChange={handleChange('proteins')}
              className={inputClasses}
              style={{ boxSizing: 'border-box' }}
              placeholder="0"
            />
          </div>

          {/* Fats */}
          <div className="w-full max-w-full overflow-hidden">
            <label className="block text-xs min-[376px]:text-sm font-medium text-gray-700 dark:text-gray-300 mb-1.5 min-[376px]:mb-2">
              Жиры (г)
            </label>
            <input
              type="text"
              inputMode="numeric"
              value={formData.fats}
              onChange={handleChange('fats')}
              className={inputClasses}
              style={{ boxSizing: 'border-box' }}
              placeholder="0"
            />
          </div>

          {/* Carbs */}
          <div className="w-full max-w-full overflow-hidden">
            <label className="block text-xs min-[376px]:text-sm font-medium text-gray-700 dark:text-gray-300 mb-1.5 min-[376px]:mb-2">
              Углеводы (г)
            </label>
            <input
              type="text"
              inputMode="numeric"
              value={formData.carbs}
              onChange={handleChange('carbs')}
              className={inputClasses}
              style={{ boxSizing: 'border-box' }}
              placeholder="0"
            />
          </div>

          {/* Save Button */}
          <button
            type="submit"
            className="w-full max-w-full py-3 min-[376px]:py-4 rounded-xl font-semibold text-xs min-[376px]:text-base uppercase bg-gray-900 text-white dark:bg-white dark:text-gray-900 hover:bg-gray-800 dark:hover:bg-gray-100 transition-colors"
            style={{ boxSizing: 'border-box' }}
          >
            СОХРАНИТЬ
          </button>
        </form>
      </div>
    </div>
  );
};

export default EditGoalModal;
