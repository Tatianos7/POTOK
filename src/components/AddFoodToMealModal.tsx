import { useState, useEffect } from 'react';
import { Food, MealEntry } from '../types';
import { X } from 'lucide-react';
import { convertDisplayToGrams, FoodDisplayUnit, foodDisplayUnits } from '../utils/foodUnits';
import { getFoodDisplayName } from '../utils/foodDisplayName';

type Unit = FoodDisplayUnit;

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
  const [unit, setUnit] = useState<Unit>('г');
  
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
  const calculateNutrients = () => {
    if (!food) return;

    const quantityNum = parseFloat(quantity) || 0;
    const weightInGrams = convertDisplayToGrams(quantityNum, unit, food.name);
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
    
    // Все продукты поддерживают граммы, миллилитры и литры
    if (u === 'г' || u === 'мл' || u === 'л') return true;

    // Для штук проверяем категорию или название продукта
    if (u === 'шт') {
      const foodName = food.name.toLowerCase();
      const pieceCategories = ['яйцо', 'яблоко', 'банан', 'помидор', 'огурец', 'морковь', 'картофель', 'лук'];
      return pieceCategories.some(cat => foodName.includes(cat)) || food.category === 'fruits' || food.category === 'vegetables';
    }

    // Для ложек и порций разрешаем по умолчанию
    if (u === 'ст.л' || u === 'ч.л' || u === 'порция') {
      return true;
    }
    
    return false;
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!food || !quantity || parseFloat(quantity) <= 0) {
      return;
    }

    const quantityNum = parseFloat(quantity);
    const weightInGrams = convertDisplayToGrams(quantityNum, unit, food.name);

    const entry: MealEntry = {
      id: `meal_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      foodId: food.id,
      food,
      weight: weightInGrams,
      calories: calculated.calories,
      protein: calculated.protein,
      fat: calculated.fat,
      carbs: calculated.carbs,
      baseUnit: 'г',
      displayUnit: unit,
      displayAmount: quantityNum,
    };

    onAdd(entry);
    setQuantity('100');
    setUnit('г');
    onClose();
  };

  if (!isOpen || !food) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-50 p-3 mobile-lg:p-4"
      onClick={onClose}
    >
      <div
        className="bg-white dark:bg-gray-800 rounded-xl shadow-xl w-full max-w-[calc(100vw-24px)] mobile-lg:max-w-md max-h-[90vh] overflow-y-auto overflow-x-hidden"
        onClick={(e) => e.stopPropagation()}
        style={{ maxWidth: 'calc(100vw - 24px)', boxSizing: 'border-box' }}
      >
        {/* Header */}
        <div className="sticky top-0 bg-white dark:bg-gray-800 border-b border-gray-200 dark:border-gray-700 px-4 mobile-lg:px-6 py-3 mobile-lg:py-4 flex items-center justify-between">
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
        <form onSubmit={handleSubmit} className="space-y-6" style={{ padding: '10px' }}>
          {/* Food Info */}
          <div className="flex items-start gap-3 mobile-lg:gap-4 p-3 mobile-lg:p-4 rounded-lg border border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-900 overflow-hidden">
            {food.photo && (
              <img
                src={food.photo}
                alt={food.name}
                className="w-12 h-12 mobile-lg:w-16 mobile-lg:h-16 rounded-lg object-cover flex-shrink-0"
                style={{ maxWidth: '100%', height: 'auto' }}
                onError={(e) => {
                  const target = e.target as HTMLImageElement;
                  target.style.display = 'none';
                }}
              />
            )}
            <div className="flex-1 min-w-0 overflow-hidden">
              <div className="flex items-center gap-2 overflow-hidden">
                <h3 
                  className="text-sm font-semibold text-gray-900 dark:text-white truncate flex-1 min-w-0"
                >
                  {getFoodDisplayName(food)}
                </h3>
                <p className="text-xs text-gray-600 dark:text-gray-300 whitespace-nowrap flex-shrink-0">
                  {Math.round(food.calories)} ккал / 100г
                </p>
              </div>
            </div>
          </div>

          {/* Quantity Input */}
          <div className="w-full max-w-full overflow-hidden">
            <label className="block text-sm font-medium text-gray-900 dark:text-white mb-2">
              Количество
            </label>
            <div className="flex gap-2 w-full max-w-full">
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
                step={unit === 'шт' ? '1' : '0.1'}
                className="flex-1 min-w-0 px-3 mobile-lg:px-4 py-3 rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-green-500 max-w-full"
                placeholder="100"
                required
                style={{ boxSizing: 'border-box' }}
              />
              <select
                value={unit}
                onChange={(e) => setUnit(e.target.value as Unit)}
                className="px-3 mobile-lg:px-4 py-3 rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-green-500 flex-shrink-0"
                style={{ boxSizing: 'border-box' }}
              >
                {foodDisplayUnits.map((option) => (
                  <option key={option} value={option} disabled={!isUnitSupported(option)}>
                    {option}
                  </option>
                ))}
              </select>
            </div>
          </div>

          {/* Quick Amount Buttons */}
          <div className="flex gap-2 flex-wrap">
            <button
              type="button"
              onClick={() => handleQuickButton(100, 'г')}
              className="px-4 py-2 rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 text-sm font-medium text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors"
            >
              100 г
            </button>
            <button
              type="button"
              onClick={() => handleQuickButton(1, 'шт')}
              disabled={!isUnitSupported('шт')}
              className="px-4 py-2 rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 text-sm font-medium text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            >
              1 шт
            </button>
            <button
              type="button"
              onClick={() => handleQuickButton(100, 'мл')}
              className="px-4 py-2 rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 text-sm font-medium text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors"
            >
              100 мл
            </button>
            <button
              type="button"
              onClick={() => handleQuickButton(1, 'ст.л')}
              className="px-4 py-2 rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 text-sm font-medium text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors"
            >
              1 ст.л
            </button>
            <button
              type="button"
              onClick={() => handleQuickButton(1, 'ч.л')}
              className="px-4 py-2 rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 text-sm font-medium text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors"
            >
              1 ч.л
            </button>
            <button
              type="button"
              onClick={() => handleQuickButton(1, 'порция')}
              className="px-4 py-2 rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 text-sm font-medium text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors"
            >
              1 порция
            </button>
            <button
              type="button"
              onClick={() => {
                setQuantity('1');
                setUnit('л');
              }}
              className="px-4 py-2 rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 text-sm font-medium text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors"
            >
              1 л
            </button>
          </div>

          {/* Calculated Nutrients */}
          <div className="p-3 mobile-lg:p-4 rounded-lg border border-gray-200 dark:border-gray-700 bg-green-50 dark:bg-green-900/20 w-full max-w-full overflow-hidden">
            <h4 className="text-sm font-semibold text-gray-900 dark:text-white mb-3">
              Пищевая ценность:
            </h4>
            <div className="grid grid-cols-2 gap-2 mobile-lg:gap-3 w-full max-w-full">
              <div className="flex flex-col items-center w-full max-w-full overflow-hidden">
                <div className="text-xs text-gray-600 dark:text-gray-400 mb-2 text-center">Калории</div>
                <div className="border-2 border-blue-400 rounded-xl py-2 mobile-lg:py-3 px-2 mobile-lg:px-3 text-center w-full max-w-full">
                  <div className="text-base mobile-lg:text-lg font-semibold text-gray-900 dark:text-white">
                    {Math.round(calculated.calories)}
                  </div>
                </div>
              </div>
              <div className="flex flex-col items-center w-full max-w-full overflow-hidden">
                <div className="text-xs text-gray-600 dark:text-gray-400 mb-2 text-center">Белки</div>
                <div className="border-2 border-orange-400 rounded-xl py-2 mobile-lg:py-3 px-2 mobile-lg:px-3 text-center w-full max-w-full">
                  <div className="text-base mobile-lg:text-lg font-semibold text-gray-900 dark:text-white">
                    {calculated.protein.toFixed(1)}
                  </div>
                </div>
              </div>
              <div className="flex flex-col items-center w-full max-w-full overflow-hidden">
                <div className="text-xs text-gray-600 dark:text-gray-400 mb-2 text-center">Жиры</div>
                <div className="border-2 border-yellow-400 rounded-xl py-2 mobile-lg:py-3 px-2 mobile-lg:px-3 text-center w-full max-w-full">
                  <div className="text-base mobile-lg:text-lg font-semibold text-gray-900 dark:text-white">
                    {calculated.fat.toFixed(1)}
                  </div>
                </div>
              </div>
              <div className="flex flex-col items-center w-full max-w-full overflow-hidden">
                <div className="text-xs text-gray-600 dark:text-gray-400 mb-2 text-center">Углеводы</div>
                <div className="border-2 border-green-500 rounded-xl py-2 mobile-lg:py-3 px-2 mobile-lg:px-3 text-center w-full max-w-full">
                  <div className="text-base mobile-lg:text-lg font-semibold text-gray-900 dark:text-white">
                    {calculated.carbs.toFixed(1)}
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* Buttons */}
          <div className="flex gap-2 mobile-lg:gap-3 w-full max-w-full">
            <button
              type="button"
              onClick={onClose}
              className="flex-1 min-w-0 py-3 rounded-lg border-2 border-gray-300 dark:border-gray-600 text-gray-900 dark:text-white font-semibold hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors"
            >
              Отмена
            </button>
            <button
              type="submit"
              disabled={!quantity || parseFloat(quantity) <= 0}
              className="flex-1 min-w-0 py-3 rounded-lg bg-gray-900 dark:bg-white text-white dark:text-gray-900 font-semibold hover:bg-gray-800 dark:hover:bg-gray-100 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
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

