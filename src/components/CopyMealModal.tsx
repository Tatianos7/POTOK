import { useState } from 'react';
import { X } from 'lucide-react';
import { MealEntry } from '../types';

interface CopyMealModalProps {
  isOpen: boolean;
  onClose: () => void;
  onCopy: (targetDate: string, targetMealType: 'breakfast' | 'lunch' | 'dinner' | 'snack') => void;
  sourceMealType: 'breakfast' | 'lunch' | 'dinner' | 'snack';
  entries: MealEntry[];
}

const mealTypeNames: Record<'breakfast' | 'lunch' | 'dinner' | 'snack', string> = {
  breakfast: 'Завтрак',
  lunch: 'Обед',
  dinner: 'Ужин',
  snack: 'Перекус',
};

const CopyMealModal = ({ isOpen, onClose, onCopy, sourceMealType, entries }: CopyMealModalProps) => {
  const [selectedDate, setSelectedDate] = useState(() => {
    const today = new Date();
    const year = today.getFullYear();
    const month = String(today.getMonth() + 1).padStart(2, '0');
    const day = String(today.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
  });
  const [selectedMealType, setSelectedMealType] = useState<'breakfast' | 'lunch' | 'dinner' | 'snack'>(sourceMealType);

  if (!isOpen) return null;

  // Получаем сегодняшнюю дату
  const getTodayDate = () => {
    const today = new Date();
    const year = today.getFullYear();
    const month = String(today.getMonth() + 1).padStart(2, '0');
    const day = String(today.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
  };

  // Получаем максимальную дату (+14 дней)
  const getMaxDate = () => {
    const today = new Date();
    today.setDate(today.getDate() + 14);
    const year = today.getFullYear();
    const month = String(today.getMonth() + 1).padStart(2, '0');
    const day = String(today.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
  };

  const todayStr = getTodayDate();
  const maxDateStr = getMaxDate();

  const handleCopy = () => {
    if (entries.length === 0) {
      alert('Нет продуктов для копирования');
      return;
    }
    onCopy(selectedDate, selectedMealType);
    onClose();
  };

  const handleDateChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const newDate = e.target.value;
    // Проверяем, что дата в допустимом диапазоне
    if (newDate >= todayStr && newDate <= maxDateStr) {
      setSelectedDate(newDate);
    }
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-end justify-center z-50">
      <div className="bg-white dark:bg-gray-800 rounded-t-2xl w-full max-w-md max-h-[90vh] overflow-y-auto">
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b border-gray-200 dark:border-gray-700">
          <h2 className="text-lg font-semibold text-gray-900 dark:text-white">
            Копировать приём пищи
          </h2>
          <button
            onClick={onClose}
            className="p-2 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg transition-colors"
            aria-label="Закрыть"
          >
            <X className="w-5 h-5 text-gray-600 dark:text-gray-400" />
          </button>
        </div>

        {/* Content */}
        <div className="p-4 space-y-6">
          {/* Выбор даты */}
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
              Выберите дату
            </label>
            <div className="relative">
              <input
                type="date"
                value={selectedDate}
                onChange={handleDateChange}
                min={todayStr}
                max={maxDateStr}
                className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-green-500 focus:border-transparent"
              />
            </div>
            <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">
              Можно выбрать дату от сегодня до +14 дней
            </p>
          </div>

          {/* Выбор приёма пищи */}
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-3">
              Выберите приём пищи
            </label>
            <div className="space-y-2">
              {(['breakfast', 'lunch', 'dinner', 'snack'] as const).map((mealType) => (
                <label
                  key={mealType}
                  className="flex items-center p-3 border border-gray-200 dark:border-gray-700 rounded-lg cursor-pointer hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors"
                >
                  <input
                    type="radio"
                    name="mealType"
                    value={mealType}
                    checked={selectedMealType === mealType}
                    onChange={() => setSelectedMealType(mealType)}
                    className="w-4 h-4 text-green-600 focus:ring-green-500 border-gray-300 dark:border-gray-600 accent-green-600"
                  />
                  <span className="ml-3 text-sm font-medium text-gray-900 dark:text-white">
                    {mealTypeNames[mealType]}
                  </span>
                </label>
              ))}
            </div>
          </div>

          {/* Информация о копируемых данных */}
          <div className="p-3 bg-gray-50 dark:bg-gray-900 rounded-lg">
            <p className="text-xs text-gray-600 dark:text-gray-400 mb-1">
              Будет скопировано:
            </p>
            <p className="text-sm font-medium text-gray-900 dark:text-white">
              {entries.length} {entries.length === 1 ? 'продукт' : entries.length < 5 ? 'продукта' : 'продуктов'} из {mealTypeNames[sourceMealType]}
            </p>
          </div>
        </div>

        {/* Footer buttons */}
        <div className="p-4 border-t border-gray-200 dark:border-gray-700 flex gap-3">
          <button
            onClick={onClose}
            className="flex-1 py-3 px-4 rounded-lg border-2 border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 text-gray-900 dark:text-white font-medium hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors"
          >
            Отмена
          </button>
          <button
            onClick={handleCopy}
            className="flex-1 py-3 px-4 rounded-lg bg-green-600 text-white font-medium hover:bg-green-700 transition-colors"
          >
            Копировать
          </button>
        </div>
      </div>
    </div>
  );
};

export default CopyMealModal;

