import { useState } from 'react';
import { X } from 'lucide-react';

interface MealTypeSelectorModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSelect: (mealType: 'breakfast' | 'lunch' | 'dinner' | 'snack', date: string) => void;
  defaultDate?: string;
}

const mealLabels: Record<'breakfast' | 'lunch' | 'dinner' | 'snack', string> = {
  breakfast: 'Завтрак',
  lunch: 'Обед',
  dinner: 'Ужин',
  snack: 'Перекус',
};

const MealTypeSelectorModal = ({ isOpen, onClose, onSelect, defaultDate }: MealTypeSelectorModalProps) => {
  const [selectedMealType, setSelectedMealType] = useState<'breakfast' | 'lunch' | 'dinner' | 'snack'>('breakfast');
  const [selectedDate, setSelectedDate] = useState(defaultDate || new Date().toISOString().split('T')[0]);

  if (!isOpen) return null;

  const handleConfirm = () => {
    onSelect(selectedMealType, selectedDate);
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-end justify-center bg-black bg-opacity-50 animate-fade-in"
      onClick={onClose}
    >
      <div
        className="w-full max-w-md bg-white dark:bg-gray-900 rounded-t-3xl shadow-2xl p-5 space-y-4 animate-slide-up"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between">
          <h3 className="text-sm font-semibold text-gray-900 dark:text-white">Выберите прием пищи</h3>
          <button
            onClick={onClose}
            className="p-2 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors"
            aria-label="Закрыть"
          >
            <X className="w-5 h-5 text-gray-700 dark:text-gray-300" />
          </button>
        </div>

        {/* Date Selector */}
        <div className="space-y-1">
          <label className="text-xs text-gray-600 dark:text-gray-400">Дата</label>
          <input
            type="date"
            value={selectedDate}
            onChange={(e) => setSelectedDate(e.target.value)}
            className="w-full h-12 rounded-xl border border-gray-300 dark:border-gray-700 px-3 text-sm text-gray-900 dark:text-white bg-white dark:bg-gray-800 focus:outline-none focus:ring-2 focus:ring-green-500"
          />
        </div>

        {/* Meal Type Selector */}
        <div className="grid grid-cols-2 gap-2">
          {(['breakfast', 'lunch', 'dinner', 'snack'] as const).map((mealType) => (
            <button
              key={mealType}
              onClick={() => setSelectedMealType(mealType)}
              className={`py-3 rounded-xl border-2 text-center text-sm font-semibold transition-colors ${
                selectedMealType === mealType
                  ? 'border-green-500 bg-green-50 dark:bg-green-900/20 text-green-600 dark:text-green-400'
                  : 'border-gray-300 dark:border-gray-700 text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-800'
              }`}
            >
              {mealLabels[mealType]}
            </button>
          ))}
        </div>

        {/* Confirm Button */}
        <button
          onClick={handleConfirm}
          className="w-full py-3 rounded-xl bg-black text-white text-sm font-semibold hover:bg-gray-800 transition-colors"
        >
          ДОБАВИТЬ В МЕНЮ
        </button>
      </div>
    </div>
  );
};

export default MealTypeSelectorModal;

