import { useState, useEffect } from 'react';
import { MealEntry } from '../types';
import { X, Pencil, Camera } from 'lucide-react';

interface EditMealEntryModalProps {
  entry: MealEntry | null;
  mealType: 'breakfast' | 'lunch' | 'dinner' | 'snack' | null;
  date: string;
  isOpen: boolean;
  onClose: () => void;
  onSave: (updatedEntry: MealEntry) => void;
  onDelete: () => void;
}

const mealTypeNames: Record<'breakfast' | 'lunch' | 'dinner' | 'snack', string> = {
  breakfast: 'ЗАВТРАК',
  lunch: 'ОБЕД',
  dinner: 'УЖИН',
  snack: 'ПЕРЕКУС',
};

const EditMealEntryModal = ({
  entry,
  mealType,
  date,
  isOpen,
  onClose,
  onSave,
  onDelete,
}: EditMealEntryModalProps) => {
  const [weight, setWeight] = useState<string>('');
  const [calculated, setCalculated] = useState({
    calories: 0,
    protein: 0,
    fat: 0,
    carbs: 0,
  });

  useEffect(() => {
    if (entry) {
      setWeight(entry.weight.toString());
      calculateNutrients(entry.weight);
    }
  }, [entry]);

  const calculateNutrients = (weightInGrams: number) => {
    if (!entry) return;

    const k = weightInGrams / 100;
    setCalculated({
      calories: entry.food.calories * k,
      protein: entry.food.protein * k,
      fat: entry.food.fat * k,
      carbs: entry.food.carbs * k,
    });
  };

  const handleWeightChange = (value: string) => {
    if (value === '' || (!isNaN(parseFloat(value)) && parseFloat(value) >= 0)) {
      setWeight(value);
      const weightNum = parseFloat(value) || 0;
      calculateNutrients(weightNum);
    }
  };

  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    const weekdays = ['воскресенье', 'понедельник', 'вторник', 'среда', 'четверг', 'пятница', 'суббота'];
    const months = ['января', 'февраля', 'марта', 'апреля', 'мая', 'июня', 'июля', 'августа', 'сентября', 'октября', 'ноября', 'декабря'];
    
    const weekday = weekdays[date.getDay()];
    const day = date.getDate();
    const month = months[date.getMonth()];
    
    return `${weekday} ${day} ${month}`;
  };

  const handleSave = () => {
    if (!entry || !weight || parseFloat(weight) <= 0) {
      return;
    }

    const weightNum = parseFloat(weight);
    const updatedEntry: MealEntry = {
      ...entry,
      weight: weightNum,
      calories: calculated.calories,
      protein: calculated.protein,
      fat: calculated.fat,
      carbs: calculated.carbs,
    };

    onSave(updatedEntry);
    onClose();
  };

  const handleDelete = () => {
    onDelete();
    onClose();
  };

  if (!isOpen || !entry || !mealType) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-50 p-4"
      onClick={onClose}
    >
      <div
        className="bg-white dark:bg-gray-800 rounded-xl shadow-xl max-w-md w-full max-h-[90vh] overflow-y-auto"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="sticky top-0 bg-white dark:bg-gray-800 border-b border-gray-200 dark:border-gray-700 px-6 py-4 flex items-center justify-between">
          <div className="flex-1">
            <h2 className="text-xl font-bold text-gray-900 dark:text-white text-center">
              {mealTypeNames[mealType]}
            </h2>
            <p className="text-sm text-gray-500 dark:text-gray-400 text-center mt-1">
              {formatDate(date)}
            </p>
          </div>
          <button
            onClick={onClose}
            className="p-2 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg transition-colors ml-4"
          >
            <X className="w-5 h-5 text-gray-700 dark:text-gray-300" />
          </button>
        </div>

        {/* Content */}
        <div className="p-6 space-y-6">
          {/* Food Name and Weight Input */}
          <div className="flex items-center justify-between gap-4">
            <div className="flex-1">
              <p className="text-base font-medium text-gray-900 dark:text-white">
                {entry.food.name}
              </p>
            </div>
            <div className="flex items-center gap-2">
              <span className="text-sm text-gray-500 dark:text-gray-400">Вес, г</span>
              <input
                type="number"
                value={weight}
                onChange={(e) => handleWeightChange(e.target.value)}
                min="0"
                step="1"
                className="w-20 px-3 py-2 rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-green-500 text-center"
                placeholder="150"
              />
            </div>
          </div>

          {/* Nutritional Information Cards */}
          <div className="grid grid-cols-2 gap-3">
            {/* Калории */}
            <div className="p-4 rounded-lg border-2 border-blue-500 bg-white dark:bg-gray-800">
              <p className="text-xs font-medium text-gray-600 dark:text-gray-400 mb-1">
                Калории
              </p>
              <p className="text-2xl font-bold text-gray-900 dark:text-white">
                {Math.round(calculated.calories)}
              </p>
            </div>

            {/* Белки */}
            <div className="p-4 rounded-lg border-2 border-orange-500 bg-white dark:bg-gray-800">
              <p className="text-xs font-medium text-gray-600 dark:text-gray-400 mb-1">
                Белки
              </p>
              <p className="text-2xl font-bold text-gray-900 dark:text-white">
                {Math.round(calculated.protein)}
              </p>
            </div>

            {/* Жиры */}
            <div className="p-4 rounded-lg border-2 border-yellow-500 bg-white dark:bg-gray-800">
              <p className="text-xs font-medium text-gray-600 dark:text-gray-400 mb-1">
                Жиры
              </p>
              <p className="text-2xl font-bold text-gray-900 dark:text-white">
                {Math.round(calculated.fat)}
              </p>
            </div>

            {/* Углеводы */}
            <div className="p-4 rounded-lg border-2 border-green-500 bg-white dark:bg-gray-800">
              <p className="text-xs font-medium text-gray-600 dark:text-gray-400 mb-1">
                Углеводы
              </p>
              <p className="text-2xl font-bold text-gray-900 dark:text-white">
                {Math.round(calculated.carbs)}
              </p>
            </div>
          </div>

          {/* Action Buttons */}
          <div className="flex gap-4 justify-center">
            <button
              type="button"
              className="flex flex-col items-center gap-2 p-4 rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors"
            >
              <Pencil className="w-5 h-5 text-gray-700 dark:text-gray-300" />
              <span className="text-xs font-medium text-gray-700 dark:text-gray-300">
                ДОБАВИТЬ ЗАМЕТКУ
              </span>
            </button>

            <button
              type="button"
              className="flex flex-col items-center gap-2 p-4 rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors"
            >
              <Camera className="w-5 h-5 text-gray-700 dark:text-gray-300" />
              <span className="text-xs font-medium text-gray-700 dark:text-gray-300">
                ДОБАВИТЬ ФОТО
              </span>
            </button>
          </div>

          {/* Bottom Action Buttons */}
          <div className="space-y-3 pt-4">
            <button
              type="button"
              onClick={handleDelete}
              className="w-full py-3 px-4 rounded-lg border-2 border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 text-gray-900 dark:text-white font-medium hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors"
            >
              УДАЛИТЬ
            </button>

            <button
              type="button"
              onClick={handleSave}
              className="w-full py-3 px-4 rounded-lg bg-gray-900 dark:bg-gray-700 text-white font-medium hover:bg-gray-800 dark:hover:bg-gray-600 transition-colors"
            >
              СОХРАНИТЬ
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default EditMealEntryModal;

