import { Food } from '../types';
import ProductCard from './ProductCard';
import { X } from 'lucide-react';

interface ConfirmScannedFoodModalProps {
  food: Food | null;
  isOpen: boolean;
  onConfirm: (mealType: 'breakfast' | 'lunch' | 'dinner' | 'snack') => void;
  onReject: () => void;
}

const ConfirmScannedFoodModal = ({ food, isOpen, onConfirm, onReject }: ConfirmScannedFoodModalProps) => {
  if (!isOpen || !food) return null;

  const meals = [
    { id: 'breakfast', name: 'ЗАВТРАК' },
    { id: 'lunch', name: 'ОБЕД' },
    { id: 'dinner', name: 'УЖИН' },
    { id: 'snack', name: 'ПЕРЕКУС' },
  ] as const;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-50 p-4"
      onClick={onReject}
    >
      <div
        className="bg-white dark:bg-gray-800 rounded-xl shadow-xl w-full max-w-[calc(100vw-24px)] mobile-lg:max-w-md max-h-[90vh] overflow-y-auto overflow-x-hidden"
        onClick={(e) => e.stopPropagation()}
        style={{ maxWidth: 'calc(100vw - 24px)', boxSizing: 'border-box' }}
      >
        {/* Header */}
        <div className="sticky top-0 bg-white dark:bg-gray-800 border-b border-gray-200 dark:border-gray-700 px-4 mobile-lg:px-6 py-3 mobile-lg:py-4 flex items-center justify-between w-full max-w-full overflow-hidden">
          <h2 className="text-base mobile-lg:text-lg font-semibold text-gray-900 dark:text-white break-words">
            Продукт найден
          </h2>
          <button
            onClick={onReject}
            className="p-2 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg transition-colors"
          >
            <X className="w-5 h-5 text-gray-700 dark:text-gray-300" />
          </button>
        </div>

        {/* Content */}
        <div className="p-1.5 space-y-6 w-full max-w-full overflow-hidden" style={{ padding: '6px' }}>
          {/* Product Card */}
          <div className="p-3 mobile-lg:p-4 rounded-lg border border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-900 w-full max-w-full overflow-hidden">
            <ProductCard food={food} onClick={() => {}} />
          </div>

          {/* Meal Selection */}
          <div>
            <h3 className="text-sm font-semibold text-gray-900 dark:text-white mb-3">
              Добавить в:
            </h3>
            <div className="space-y-2">
              {meals.map((meal) => (
                <button
                  key={meal.id}
                  onClick={() => onConfirm(meal.id)}
                  className="w-full py-3 px-4 rounded-lg border-2 border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 text-gray-900 dark:text-white font-semibold hover:bg-gray-50 dark:hover:bg-gray-700 hover:border-green-500 dark:hover:border-green-500 transition-colors"
                >
                  {meal.name}
                </button>
              ))}
            </div>
          </div>

          {/* Reject Button */}
          <button
            onClick={onReject}
            className="w-full py-3 rounded-lg border-2 border-red-300 dark:border-red-600 text-red-600 dark:text-red-400 font-semibold hover:bg-red-50 dark:hover:bg-red-900/20 transition-colors"
          >
            Отклонить
          </button>
        </div>
      </div>
    </div>
  );
};

export default ConfirmScannedFoodModal;

