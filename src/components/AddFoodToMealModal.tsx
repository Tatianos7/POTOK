import { useState, useEffect } from 'react';
import { Food, MealEntry } from '../types';
import { X } from 'lucide-react';
import { pieceWeights } from '../data/unitConversions';

type Unit = 'g' | 'ml' | 'pcs' | 'l';

interface AddFoodToMealModalProps {
  food: Food | null;
  isOpen: boolean;
  onClose: () => void;
  onAdd: (entry: MealEntry) => void;
  defaultWeight?: number; // Предзаполненные граммы для часто используемых продуктов
}

const AddFoodToMealModal = ({ food, isOpen, onClose, onAdd, defaultWeight }: AddFoodToMealModalProps) => {
  const [quantity, setQuantity] = useState(() => {
    // Если передан defaultWeight, используем его, иначе дефолт 100
    return defaultWeight ? defaultWeight.toString() : '100';
  });
  const [unit, setUnit] = useState<Unit>('g');
  
  // Обновляем quantity при изменении food или defaultWeight
  useEffect(() => {
    if (food && defaultWeight) {
      setQuantity(defaultWeight.toString());
    } else if (food && !defaultWeight) {
      setQuantity('100');
    }
  }, [food, defaultWeight]);
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
  }, [food, quantity, unit]);

  // Конвертируем количество в граммы для расчета КБЖУ
  const convertToGrams = (qty: number, u: Unit): number => {
    switch (u) {
      case 'g':
        return qty;
      case 'ml':
        return qty; // 1 мл ≈ 1 г для воды и большинства жидкостей
      case 'l':
        return qty * 1000; // 1 л = 1000 мл = 1000 г
      case 'pcs':
        // Используем средний вес из pieceWeights или дефолтное значение
        const foodName = food?.name.toLowerCase() || '';
        const pieceWeight = Object.entries(pieceWeights).find(([key]) =>
          foodName.includes(key)
        )?.[1] || 50; // дефолт 50г на штуку
        return qty * pieceWeight;
      default:
        return qty;
    }
  };

  const calculateNutrients = () => {
    if (!food) return;

    const quantityNum = parseFloat(quantity) || 0;
    const weightInGrams = convertToGrams(quantityNum, unit);
    const k = weightInGrams / 100;

    setCalculated({
      calories: food.calories * k,
      protein: food.protein * k,
      fat: food.fat * k,
      carbs: food.carbs * k,
    });
  };

  // Обработчик быстрых кнопок
  const handleQuickButton = (qty: number, u: Unit) => {
    setQuantity(qty.toString());
    setUnit(u);
  };

  // Проверка, поддерживает ли продукт данную единицу измерения
  const isUnitSupported = (u: Unit): boolean => {
    if (!food) return false;
    
    // Все продукты поддерживают граммы и миллилитры
    if (u === 'g' || u === 'ml' || u === 'l') return true;
    
    // Для штук проверяем категорию или название продукта
    if (u === 'pcs') {
      const foodName = food.name.toLowerCase();
      const pieceCategories = ['яйцо', 'яблоко', 'банан', 'помидор', 'огурец', 'морковь', 'картофель', 'лук'];
      return pieceCategories.some(cat => foodName.includes(cat)) || food.category === 'fruits' || food.category === 'vegetables';
    }
    
    return false;
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!food || !quantity || parseFloat(quantity) <= 0) {
      return;
    }

    const quantityNum = parseFloat(quantity);
    const weightInGrams = convertToGrams(quantityNum, unit);

    const entry: MealEntry = {
      id: `meal_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      foodId: food.id,
      food,
      weight: weightInGrams,
      calories: calculated.calories,
      protein: calculated.protein,
      fat: calculated.fat,
      carbs: calculated.carbs,
    };

    onAdd(entry);
    setQuantity('100');
    setUnit('g');
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
            {food.photo && (
              <img
                src={food.photo}
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

          {/* Quantity Input */}
          <div>
            <label className="block text-sm font-medium text-gray-900 dark:text-white mb-2">
              Количество
            </label>
            <div className="flex gap-2">
              <input
                type="number"
                value={quantity}
                onChange={(e) => {
                  const value = e.target.value;
                  if (value === '' || (!isNaN(parseFloat(value)) && parseFloat(value) >= 0)) {
                    setQuantity(value);
                  }
                }}
                min="0"
                step={unit === 'pcs' ? '1' : '1'}
                className="flex-1 px-4 py-3 rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-green-500"
                placeholder="100"
                required
              />
              <select
                value={unit}
                onChange={(e) => setUnit(e.target.value as Unit)}
                className="px-4 py-3 rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-green-500"
              >
                <option value="g">г</option>
                <option value="ml">мл</option>
                <option value="pcs">шт</option>
                <option value="l">л</option>
              </select>
            </div>
          </div>

          {/* Quick Amount Buttons */}
          <div className="flex gap-2 flex-wrap">
            <button
              type="button"
              onClick={() => handleQuickButton(100, 'g')}
              className="px-4 py-2 rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 text-sm font-medium text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors"
            >
              100 г
            </button>
            <button
              type="button"
              onClick={() => handleQuickButton(1, 'pcs')}
              disabled={!isUnitSupported('pcs')}
              className="px-4 py-2 rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 text-sm font-medium text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            >
              1 шт
            </button>
            <button
              type="button"
              onClick={() => handleQuickButton(100, 'ml')}
              className="px-4 py-2 rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 text-sm font-medium text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors"
            >
              100 мл
            </button>
            <button
              type="button"
              onClick={() => {
                setQuantity('1');
                setUnit('l');
              }}
              className="px-4 py-2 rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 text-sm font-medium text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors"
            >
              1 л
            </button>
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
              disabled={!quantity || parseFloat(quantity) <= 0}
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

