import { useState, useEffect } from 'react';
import { Food } from '../types';
import { X } from 'lucide-react';
import { getFoodDisplayName } from '../utils/foodDisplayName';
import { FoodDisplayUnit, foodDisplayUnits } from '../utils/foodUnits';

interface ScanConfirmBottomSheetProps {
  food: Food | null;
  isOpen: boolean;
  onConfirm: (
    mealType: 'breakfast' | 'lunch' | 'dinner' | 'snack',
    amount: number,
    unit: FoodDisplayUnit
  ) => void;
  onReject: () => void;
}

const ScanConfirmBottomSheet = ({ food, isOpen, onConfirm, onReject }: ScanConfirmBottomSheetProps) => {
  const [selectedMeal, setSelectedMeal] = useState<'breakfast' | 'lunch' | 'dinner' | 'snack' | null>(null);
  const [weight, setWeight] = useState('100');
  const [unit, setUnit] = useState<FoodDisplayUnit>('г');
  const [isDragging, setIsDragging] = useState(false);
  const [startY, setStartY] = useState(0);
  const [currentY, setCurrentY] = useState(0);

  useEffect(() => {
    if (isOpen && food) {
      setSelectedMeal(null);
      setWeight('100');
      setUnit('г');
    }
  }, [isOpen, food]);

  // Не рендерим, если нет продукта
  if (!food) return null;

  const meals = [
    { id: 'breakfast' as const, name: 'Завтрак' },
    { id: 'lunch' as const, name: 'Обед' },
    { id: 'dinner' as const, name: 'Ужин' },
    { id: 'snack' as const, name: 'Перекус' },
  ];

  const handleConfirm = () => {
    if (!selectedMeal || !weight || parseFloat(weight) < 1) return;
    onConfirm(selectedMeal, parseFloat(weight), unit);
  };

  const handleWeightChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = e.target.value;
    if (value === '' || (!isNaN(parseFloat(value)) && parseFloat(value) >= 0)) {
      setWeight(value);
    }
  };

  // Swipe down to close
  const handleTouchStart = (e: React.TouchEvent) => {
    setIsDragging(true);
    setStartY(e.touches[0].clientY);
    setCurrentY(e.touches[0].clientY);
  };

  const handleTouchMove = (e: React.TouchEvent) => {
    if (!isDragging) return;
    const newY = e.touches[0].clientY;
    setCurrentY(newY);
    
    // Only allow dragging down
    if (newY > startY) {
      const diff = newY - startY;
      if (diff > 100) {
        onReject();
        setIsDragging(false);
      }
    }
  };

  const handleTouchEnd = () => {
    setIsDragging(false);
    setStartY(0);
    setCurrentY(0);
  };

  if (!isOpen || !food) return null;

  const canConfirm = selectedMeal !== null && weight && parseFloat(weight) >= 1;
  const dragOffset = isDragging && currentY > startY ? currentY - startY : 0;

  return (
    <>
      {/* Backdrop */}
      <div
        className="fixed inset-0 bg-black bg-opacity-50 z-50 transition-opacity"
        onClick={onReject}
      />

      {/* Bottom Sheet */}
      <div
        className="fixed bottom-0 left-0 right-0 z-50 bg-white dark:bg-gray-800 rounded-t-3xl shadow-2xl max-h-[90vh] overflow-y-auto transition-transform"
        style={{
          transform: dragOffset > 0 ? `translateY(${dragOffset}px)` : 'translateY(0)',
        }}
        onTouchStart={handleTouchStart}
        onTouchMove={handleTouchMove}
        onTouchEnd={handleTouchEnd}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Drag Handle */}
        <div className="flex justify-center pt-4 pb-2">
          <div className="w-12 h-1.5 bg-gray-300 dark:bg-gray-600 rounded-full"></div>
        </div>

        {/* Header */}
        <div className="px-6 pb-4 border-b border-gray-200 dark:border-gray-700">
          <div className="flex items-center justify-between">
            <h2 className="text-lg font-semibold text-gray-900 dark:text-white">
              Продукт найден
            </h2>
            <button
              onClick={onReject}
              className="p-2 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg transition-colors"
            >
              <X className="w-5 h-5 text-gray-700 dark:text-gray-300" />
            </button>
          </div>
        </div>

        {/* Content */}
        <div className="px-6 py-6 space-y-6">
          {/* Product Info */}
          <div className="p-4 rounded-lg border border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-900">
            <div className="flex items-start gap-4">
              {food.photo && (
                <img
                  src={food.photo}
                  alt={food.name}
                  className="w-16 h-16 rounded-lg object-cover flex-shrink-0"
                  onError={(e) => {
                    const target = e.target as HTMLImageElement;
                    target.style.display = 'none';
                  }}
                />
              )}
              <div className="flex-1 min-w-0">
                <h3 className="text-base font-semibold text-gray-900 dark:text-white mb-1">
                  {getFoodDisplayName(food)}
                </h3>
                <div className="flex items-center gap-4 text-sm">
                  <div>
                    <span className="text-gray-600 dark:text-gray-400">Калории: </span>
                    <span className="font-semibold text-gray-900 dark:text-white">
                      {Math.round(food.calories)} ккал
                    </span>
                  </div>
                  <div>
                    <span className="text-gray-600 dark:text-gray-400">Б: </span>
                    <span className="font-semibold text-gray-900 dark:text-white">
                      {food.protein.toFixed(1)}г
                    </span>
                  </div>
                  <div>
                    <span className="text-gray-600 dark:text-gray-400">Ж: </span>
                    <span className="font-semibold text-gray-900 dark:text-white">
                      {food.fat.toFixed(1)}г
                    </span>
                  </div>
                  <div>
                    <span className="text-gray-600 dark:text-gray-400">У: </span>
                    <span className="font-semibold text-gray-900 dark:text-white">
                      {food.carbs.toFixed(1)}г
                    </span>
                  </div>
                </div>
                <p className="text-xs text-gray-500 dark:text-gray-400 mt-2">
                  на 100 г
                </p>
              </div>
            </div>
          </div>

          {/* Meal Selection */}
          <div>
            <label className="block text-sm font-medium text-gray-900 dark:text-white mb-3">
              Выберите приём пищи *
            </label>
            <div className="grid grid-cols-2 gap-3">
              {meals.map((meal) => (
                <button
                  key={meal.id}
                  onClick={() => setSelectedMeal(meal.id)}
                  className={`py-3 px-4 rounded-lg border-2 font-semibold transition-colors ${
                    selectedMeal === meal.id
                      ? 'border-green-500 bg-green-50 dark:bg-green-900/20 text-green-700 dark:text-green-300'
                      : 'border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 text-gray-900 dark:text-white hover:border-gray-400 dark:hover:border-gray-500'
                  }`}
                >
                  {meal.name}
                </button>
              ))}
            </div>
          </div>

          {/* Amount Input */}
          <div>
            <label className="block text-sm font-medium text-gray-900 dark:text-white mb-2">
              Количество *
            </label>
            <div className="flex gap-2">
              <input
                type="number"
                value={weight}
                onChange={handleWeightChange}
                min="1"
                step={unit === 'шт' ? '1' : '0.1'}
                className="w-full px-4 py-3 rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-green-500 text-center text-lg font-semibold"
                placeholder="100"
                required
              />
              <select
                value={unit}
                onChange={(e) => setUnit(e.target.value as FoodDisplayUnit)}
                className="px-4 py-3 rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-green-500"
              >
                {foodDisplayUnits.map((option) => (
                  <option key={option} value={option}>
                    {option}
                  </option>
                ))}
              </select>
            </div>
          </div>

          {/* Buttons */}
          <div className="flex gap-3 pt-2">
            <button
              onClick={onReject}
              className="flex-1 py-3 rounded-lg border-2 border-gray-300 dark:border-gray-600 text-gray-900 dark:text-white font-semibold hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors"
            >
              Отклонить
            </button>
            <button
              onClick={handleConfirm}
              disabled={!canConfirm}
              className="flex-1 py-3 rounded-lg bg-gray-900 dark:bg-white text-white dark:text-gray-900 font-semibold hover:bg-gray-800 dark:hover:bg-gray-100 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            >
              Подтвердить
            </button>
          </div>
        </div>
      </div>
    </>
  );
};

export default ScanConfirmBottomSheet;

