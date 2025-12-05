import { useState, useEffect } from 'react';
import { Food, MealEntry } from '../types';
import { X } from 'lucide-react';

interface AddFoodToMealModalProps {
  food: Food | null;
  isOpen: boolean;
  onClose: () => void;
  onAdd: (entry: MealEntry) => void;
}

const AddFoodToMealModal = ({ food, isOpen, onClose, onAdd }: AddFoodToMealModalProps) => {
  const [weight, setWeight] = useState('100');
  const [calculated, setCalculated] = useState({
    calories: 0,
    protein: 0,
    fat: 0,
    carbs: 0,
  });

  useEffect(() => {
    if (food) {
      calculateNutrients();
    }
  }, [food, weight]);

  const calculateNutrients = () => {
    if (!food) return;

    const weightNum = parseFloat(weight) || 0;
    const k = weightNum / 100;

    setCalculated({
      calories: food.calories * k,
      protein: food.protein * k,
      fat: food.fat * k,
      carbs: food.carbs * k,
    });
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!food || !weight || parseFloat(weight) <= 0) {
      return;
    }

    const entry: MealEntry = {
      id: `meal_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      foodId: food.id,
      food,
      weight: parseFloat(weight),
      calories: calculated.calories,
      protein: calculated.protein,
      fat: calculated.fat,
      carbs: calculated.carbs,
    };

    onAdd(entry);
    setWeight('100');
    onClose();
  };

  if (!isOpen || !food) return null;

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
          <h2 className="text-lg font-semibold text-gray-900 dark:text-white">
            Добавить продукт
          </h2>
          <button
            onClick={onClose}
            className="p-2 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg transition-colors"
          >
            <X className="w-5 h-5 text-gray-700 dark:text-gray-300" />
          </button>
        </div>

        {/* Content */}
        <form onSubmit={handleSubmit} className="p-6 space-y-6">
          {/* Food Info */}
          <div className="flex items-center gap-4 p-4 rounded-lg border border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-900">
            {food.image && (
              <img
                src={food.image}
                alt={food.name}
                className="w-16 h-16 rounded-lg object-cover"
                onError={(e) => {
                  const target = e.target as HTMLImageElement;
                  target.style.display = 'none';
                }}
              />
            )}
            <div className="flex-1">
              <h3 className="text-sm font-semibold text-gray-900 dark:text-white">
                {food.name}
              </h3>
              {food.brand && (
                <p className="text-xs text-gray-500 dark:text-gray-400">
                  {food.brand}
                </p>
              )}
              <p className="text-xs text-gray-600 dark:text-gray-300 mt-1">
                {Math.round(food.calories)} ккал / 100г
              </p>
            </div>
          </div>

          {/* Weight Input */}
          <div>
            <label className="block text-sm font-medium text-gray-900 dark:text-white mb-2">
              Вес порции (г)
            </label>
            <input
              type="number"
              value={weight}
              onChange={(e) => {
                const value = e.target.value;
                if (value === '' || (!isNaN(parseFloat(value)) && parseFloat(value) >= 0)) {
                  setWeight(value);
                }
              }}
              min="0"
              step="1"
              className="w-full px-4 py-3 rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-green-500"
              placeholder="100"
              required
            />
          </div>

          {/* Calculated Nutrients */}
          <div className="p-4 rounded-lg border border-gray-200 dark:border-gray-700 bg-green-50 dark:bg-green-900/20">
            <h4 className="text-sm font-semibold text-gray-900 dark:text-white mb-3">
              Пищевая ценность:
            </h4>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <p className="text-xs text-gray-600 dark:text-gray-400">Калории</p>
                <p className="text-lg font-semibold text-gray-900 dark:text-white">
                  {Math.round(calculated.calories)} ккал
                </p>
              </div>
              <div>
                <p className="text-xs text-gray-600 dark:text-gray-400">Белки</p>
                <p className="text-lg font-semibold text-gray-900 dark:text-white">
                  {calculated.protein.toFixed(1)} г
                </p>
              </div>
              <div>
                <p className="text-xs text-gray-600 dark:text-gray-400">Жиры</p>
                <p className="text-lg font-semibold text-gray-900 dark:text-white">
                  {calculated.fat.toFixed(1)} г
                </p>
              </div>
              <div>
                <p className="text-xs text-gray-600 dark:text-gray-400">Углеводы</p>
                <p className="text-lg font-semibold text-gray-900 dark:text-white">
                  {calculated.carbs.toFixed(1)} г
                </p>
              </div>
            </div>
          </div>

          {/* Buttons */}
          <div className="flex gap-3">
            <button
              type="button"
              onClick={onClose}
              className="flex-1 py-3 rounded-lg border-2 border-gray-300 dark:border-gray-600 text-gray-900 dark:text-white font-semibold hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors"
            >
              Отмена
            </button>
            <button
              type="submit"
              disabled={!weight || parseFloat(weight) <= 0}
              className="flex-1 py-3 rounded-lg bg-gray-900 dark:bg-white text-white dark:text-gray-900 font-semibold hover:bg-gray-800 dark:hover:bg-gray-100 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            >
              Добавить
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

export default AddFoodToMealModal;

