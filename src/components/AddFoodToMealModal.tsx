import { useState, useEffect, useMemo, useRef } from 'react';
import { Food, MealEntry } from '../types';
import { X } from 'lucide-react';
import { convertDisplayToGrams, FoodDisplayUnit } from '../utils/foodUnits';
import { getFoodDisplayName } from '../utils/foodDisplayName';
import FoodSourceBadge from './FoodSourceBadge';
import { getQuickFoodPresets, getSafeDisplayUnit, getSupportedFoodDisplayUnits } from '../utils/foodMeasurementPresets';
import { submitModalAction } from '../utils/asyncModalSubmit';

type Unit = FoodDisplayUnit;

interface AddFoodToMealModalProps {
  food: Food | null;
  isOpen: boolean;
  onClose: () => void;
  onAdd: (entry: MealEntry) => Promise<void> | void;
  defaultWeight?: number; // Предзаполненные граммы для часто используемых продуктов
}

const AddFoodToMealModal = ({ food, isOpen, onClose, onAdd, defaultWeight }: AddFoodToMealModalProps) => {
  const isValidUUID = (value?: string | null): boolean =>
    Boolean(value) && /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(String(value));

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
  const [isSaving, setIsSaving] = useState(false);
  const submitLock = useRef({ current: false });
  const [calculated, setCalculated] = useState({
    calories: 0,
    protein: 0,
    fat: 0,
    carbs: 0,
  });
  const supportedUnits = useMemo(
    () => (food ? getSupportedFoodDisplayUnits(food) : (['г'] as Unit[])),
    [food]
  );
  const quickPresets = useMemo(
    () =>
      (food ? getQuickFoodPresets(food) : [{ quantity: 100, unit: 'г' as Unit, label: '100 г' }]).filter(
        (preset) => !(preset.unit === 'г' && preset.quantity === 100)
      ),
    [food]
  );

  useEffect(() => {
    if (food) {
      calculateNutrients();
    }
  }, [food, quantity, unit]);

  useEffect(() => {
    if (!food) return;
    const safeUnit = getSafeDisplayUnit(unit, supportedUnits);
    if (safeUnit !== unit) {
      setUnit(safeUnit);
    }
  }, [food, supportedUnits, unit]);

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

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!food || !quantity || parseFloat(quantity) <= 0) {
      return;
    }

    const canonicalFoodId =
      isValidUUID(food.canonical_food_id) ? food.canonical_food_id : (isValidUUID(food.id) ? food.id : null);

    if (!canonicalFoodId) {
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
      canonicalFoodId,
    };

    setIsSaving(true);
    try {
      await submitModalAction(
        submitLock.current,
        () => onAdd(entry),
        () => {
          setQuantity('100');
          setUnit('г');
          onClose();
        }
      );
    } catch (error) {
      console.error('[AddFoodToMealModal] Failed to save entry:', error);
      alert('Не удалось сохранить продукт. Проверьте соединение и попробуйте снова.');
    } finally {
      setIsSaving(false);
    }
  };

  if (!isOpen || !food) return null;

  const canSubmit =
    Boolean(quantity) &&
    parseFloat(quantity) > 0 &&
    (isValidUUID(food.canonical_food_id) || isValidUUID(food.id));

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-50 p-3 mobile-lg:p-4"
      onClick={() => { if (!isSaving) onClose(); }}
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
            onClick={() => { if (!isSaving) onClose(); }}
            className="p-2 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg transition-colors disabled:opacity-50"
            disabled={isSaving}
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
                <FoodSourceBadge food={food} className="flex-shrink-0" />
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
                disabled={isSaving}
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
                disabled={isSaving}
                className="px-3 mobile-lg:px-4 py-3 rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-green-500 flex-shrink-0"
                style={{ boxSizing: 'border-box' }}
              >
                {supportedUnits.map((option) => (
                  <option key={option} value={option}>
                    {option}
                  </option>
                ))}
              </select>
            </div>
          </div>

          {/* Quick Amount Buttons */}
          <div className="flex gap-2 flex-wrap">
            {quickPresets.map((preset) => (
              <button
                key={`${preset.quantity}-${preset.unit}`}
                type="button"
                onClick={() => handleQuickButton(preset.quantity, preset.unit)}
                className="px-4 py-2 rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 text-sm font-medium text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors disabled:opacity-50"
                disabled={isSaving}
              >
                {preset.label}
              </button>
            ))}
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
              onClick={() => { if (!isSaving) onClose(); }}
              className="flex-1 min-w-0 py-3 rounded-lg border-2 border-gray-300 dark:border-gray-600 text-gray-900 dark:text-white font-semibold hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors"
            >
              Отмена
            </button>
            <button
              type="submit"
              disabled={!canSubmit || isSaving}
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
