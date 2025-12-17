import { useState, useEffect } from 'react';
import { X } from 'lucide-react';

interface SaveRecipeModalProps {
  isOpen: boolean;
  onClose: () => void;
  recipeName: string;
  recipeImage?: string | null;
  totalCalories: number;
  totalProteins: number;
  totalFats: number;
  totalCarbs: number;
  onSave: (name: string) => void;
}

const SaveRecipeModal = ({
  isOpen,
  onClose,
  recipeName: initialName,
  recipeImage,
  totalCalories,
  totalProteins,
  totalFats,
  totalCarbs,
  onSave,
}: SaveRecipeModalProps) => {
  const [name, setName] = useState(initialName);

  useEffect(() => {
    if (isOpen) {
      setName(initialName);
    }
  }, [isOpen, initialName]);

  if (!isOpen) return null;

  const handleSave = () => {
    const trimmedName = name.trim();
    if (!trimmedName) {
      alert('Введите название рецепта');
      return;
    }
    onSave(trimmedName);
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
          <h3 className="text-sm font-semibold text-gray-900 dark:text-white">Сохранить рецепт</h3>
          <button
            onClick={onClose}
            className="p-2 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors"
            aria-label="Закрыть"
          >
            <X className="w-5 h-5 text-gray-700 dark:text-gray-300" />
          </button>
        </div>

        {/* Recipe Name Input */}
        <div className="space-y-1">
          <label className="text-xs text-gray-600 dark:text-gray-400">Название рецепта</label>
          <input
            type="text"
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="Введите название рецепта"
            className="w-full h-12 rounded-xl border border-gray-300 dark:border-gray-700 px-3 text-sm text-gray-900 dark:text-white bg-white dark:bg-gray-800 focus:outline-none focus:ring-2 focus:ring-green-500"
          />
        </div>

        {/* Recipe Image Preview */}
        <div className="space-y-1">
          <label className="text-xs text-gray-600 dark:text-gray-400">Превью рецепта</label>
          <div className="w-full aspect-square rounded-xl overflow-hidden border border-gray-300 dark:border-gray-700 bg-gray-100 dark:bg-gray-800">
            {recipeImage ? (
              <img
                src={recipeImage}
                alt={name || 'Рецепт'}
                className="w-full h-full object-cover"
                onError={(e) => {
                  // Fallback если изображение не загрузилось
                  (e.target as HTMLImageElement).style.display = 'none';
                  (e.target as HTMLImageElement).parentElement!.innerHTML =
                    '<div class="w-full h-full flex items-center justify-center text-gray-400 text-sm">Нет фото</div>';
                }}
              />
            ) : (
              <div className="w-full h-full flex items-center justify-center text-gray-400 dark:text-gray-500 text-sm">
                Нет фото
              </div>
            )}
          </div>
        </div>

        {/* Total Calories */}
        <div className="bg-gray-50 dark:bg-gray-800 rounded-xl p-4">
          <div className="text-xs text-gray-600 dark:text-gray-400 mb-2">Общая калорийность рецепта</div>
          <div className="text-2xl font-bold text-gray-900 dark:text-white">
            {Math.round(totalCalories)} ккал
          </div>
          <div className="text-xs text-gray-500 dark:text-gray-400 mt-2">
            Б: {totalProteins.toFixed(1)}г / Ж: {totalFats.toFixed(1)}г / У: {totalCarbs.toFixed(1)}г
          </div>
        </div>

        {/* Save Button */}
        <button
          onClick={handleSave}
          className="w-full py-3 rounded-xl bg-black text-white text-sm font-semibold hover:bg-gray-800 transition-colors"
        >
          СОХРАНИТЬ
        </button>
      </div>
    </div>
  );
};

export default SaveRecipeModal;

