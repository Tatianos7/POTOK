import { useState, useEffect } from 'react';
import { X } from 'lucide-react';

interface EditGoalModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSave: (data: { calories: string; proteins: string; fats: string; carbs: string }) => void;
  initialData: {
    calories: string;
    proteins: string;
    fats: string;
    carbs: string;
  };
}

const EditGoalModal = ({ isOpen, onClose, onSave, initialData }: EditGoalModalProps) => {
  const [formData, setFormData] = useState({
    calories: initialData.calories || '',
    proteins: initialData.proteins || '',
    fats: initialData.fats || '',
    carbs: initialData.carbs || '',
  });

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

  const handleChange = (field: keyof typeof formData) => (
    e: React.ChangeEvent<HTMLInputElement>
  ) => {
    const value = e.target.value;
    // Разрешаем только числа
    if (value === '' || /^\d+$/.test(value)) {
      setFormData((prev) => ({
        ...prev,
        [field]: value,
      }));
    }
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onSave(formData);
    onClose();
  };

  const inputClasses = 'w-full px-3 py-2 rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-green-500';

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-50 p-4">
      <div className="bg-white dark:bg-gray-900 rounded-xl w-full max-w-md max-h-[90vh] overflow-y-auto" style={{ minWidth: '360px' }}>
        {/* Header */}
        <header className="px-4 py-4 flex items-center justify-between border-b border-gray-200 dark:border-gray-700 sticky top-0 bg-white dark:bg-gray-900 z-10">
          <div className="flex-1"></div>
          <h1 className="text-lg font-semibold text-gray-900 dark:text-white flex-1 text-center uppercase whitespace-nowrap">
            РЕДАКТИРОВАТЬ ЦЕЛЬ
          </h1>
          <div className="flex-1 flex justify-end">
            <button
              onClick={onClose}
              className="p-2 hover:bg-gray-100 dark:hover:bg-gray-800 rounded-lg transition-colors"
              aria-label="Закрыть"
            >
              <X className="w-6 h-6 text-gray-700 dark:text-gray-300" />
            </button>
          </div>
        </header>

        <form onSubmit={handleSubmit} className="px-4 py-6 space-y-6">
          {/* Calories */}
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
              Калории
            </label>
            <input
              type="text"
              inputMode="numeric"
              value={formData.calories}
              onChange={handleChange('calories')}
              className={inputClasses}
              placeholder="0"
            />
          </div>

          {/* Proteins */}
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
              Белки (г)
            </label>
            <input
              type="text"
              inputMode="numeric"
              value={formData.proteins}
              onChange={handleChange('proteins')}
              className={inputClasses}
              placeholder="0"
            />
          </div>

          {/* Fats */}
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
              Жиры (г)
            </label>
            <input
              type="text"
              inputMode="numeric"
              value={formData.fats}
              onChange={handleChange('fats')}
              className={inputClasses}
              placeholder="0"
            />
          </div>

          {/* Carbs */}
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
              Углеводы (г)
            </label>
            <input
              type="text"
              inputMode="numeric"
              value={formData.carbs}
              onChange={handleChange('carbs')}
              className={inputClasses}
              placeholder="0"
            />
          </div>

          {/* Save Button */}
          <button
            type="submit"
            className="w-full py-4 rounded-xl font-semibold text-base uppercase bg-gray-900 text-white dark:bg-white dark:text-gray-900 hover:bg-gray-800 dark:hover:bg-gray-100 transition-colors"
          >
            СОХРАНИТЬ
          </button>
        </form>
      </div>
    </div>
  );
};

export default EditGoalModal;

