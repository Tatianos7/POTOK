import { useState } from 'react';
import { UserCustomFood } from '../types';
import { foodService } from '../services/foodService';
import { X } from 'lucide-react';

interface CreateCustomFoodModalProps {
  isOpen: boolean;
  onClose: () => void;
  onCreated: (food: UserCustomFood) => void;
  userId: string;
}

const CreateCustomFoodModal = ({ isOpen, onClose, onCreated, userId }: CreateCustomFoodModalProps) => {
  const [formData, setFormData] = useState({
    name: '',
    brand: '',
    calories: '',
    protein: '',
    fat: '',
    carbs: '',
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();

    const food = foodService.createCustomFood(userId, {
      name: formData.name.trim(),
      brand: formData.brand.trim() || null,
      calories: parseFloat(formData.calories) || 0,
      protein: parseFloat(formData.protein) || 0,
      fat: parseFloat(formData.fat) || 0,
      carbs: parseFloat(formData.carbs) || 0,
      barcode: null,
      image: null,
    });

    onCreated(food);
    
    // Reset form
    setFormData({
      name: '',
      brand: '',
      calories: '',
      protein: '',
      fat: '',
      carbs: '',
    });
    
    onClose();
  };

  if (!isOpen) return null;

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
            Создать свой продукт
          </h2>
          <button
            onClick={onClose}
            className="p-2 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg transition-colors"
          >
            <X className="w-5 h-5 text-gray-700 dark:text-gray-300" />
          </button>
        </div>

        {/* Content */}
        <form onSubmit={handleSubmit} className="p-6 space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-900 dark:text-white mb-2">
              Название продукта *
            </label>
            <input
              type="text"
              value={formData.name}
              onChange={(e) => setFormData({ ...formData, name: e.target.value })}
              className="w-full px-4 py-3 rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-green-500"
              placeholder="Например: Яблоко"
              required
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-900 dark:text-white mb-2">
              Бренд (необязательно)
            </label>
            <input
              type="text"
              value={formData.brand}
              onChange={(e) => setFormData({ ...formData, brand: e.target.value })}
              className="w-full px-4 py-3 rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-green-500"
              placeholder="Например: Красная цена"
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-900 dark:text-white mb-2">
                Калории (на 100г) *
              </label>
              <input
                type="number"
                value={formData.calories}
                onChange={(e) => setFormData({ ...formData, calories: e.target.value })}
                min="0"
                step="0.1"
                className="w-full px-4 py-3 rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-green-500"
                placeholder="0"
                required
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-900 dark:text-white mb-2">
                Белки (на 100г) *
              </label>
              <input
                type="number"
                value={formData.protein}
                onChange={(e) => setFormData({ ...formData, protein: e.target.value })}
                min="0"
                step="0.1"
                className="w-full px-4 py-3 rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-green-500"
                placeholder="0"
                required
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-900 dark:text-white mb-2">
                Жиры (на 100г) *
              </label>
              <input
                type="number"
                value={formData.fat}
                onChange={(e) => setFormData({ ...formData, fat: e.target.value })}
                min="0"
                step="0.1"
                className="w-full px-4 py-3 rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-green-500"
                placeholder="0"
                required
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-900 dark:text-white mb-2">
                Углеводы (на 100г) *
              </label>
              <input
                type="number"
                value={formData.carbs}
                onChange={(e) => setFormData({ ...formData, carbs: e.target.value })}
                min="0"
                step="0.1"
                className="w-full px-4 py-3 rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-green-500"
                placeholder="0"
                required
              />
            </div>
          </div>

          {/* Buttons */}
          <div className="flex gap-3 pt-4">
            <button
              type="button"
              onClick={onClose}
              className="flex-1 py-3 rounded-lg border-2 border-gray-300 dark:border-gray-600 text-gray-900 dark:text-white font-semibold hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors"
            >
              Отмена
            </button>
            <button
              type="submit"
              className="flex-1 py-3 rounded-lg bg-gray-900 dark:bg-white text-white dark:text-gray-900 font-semibold hover:bg-gray-800 dark:hover:bg-gray-100 transition-colors"
            >
              Создать
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

export default CreateCustomFoodModal;

