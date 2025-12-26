import { useState, useEffect } from 'react';

interface SaveMealAsRecipeModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSave: (name: string, note?: string) => void;
}

const SaveMealAsRecipeModal = ({ isOpen, onClose, onSave }: SaveMealAsRecipeModalProps) => {
  const [name, setName] = useState('');
  const [note, setNote] = useState('');

  // Сбрасываем поля при открытии
  useEffect(() => {
    if (isOpen) {
      setName('');
      setNote('');
    }
  }, [isOpen]);

  if (!isOpen) return null;

  const handleSave = () => {
    const trimmedName = name.trim();
    if (!trimmedName) {
      alert('Введите название рецепта');
      return;
    }
    onSave(trimmedName, note.trim() || undefined);
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-white dark:bg-gray-800 rounded-2xl w-full max-w-md shadow-xl">
        {/* Header */}
        <div className="p-6 pb-4">
          <h2 className="text-lg font-bold text-gray-900 dark:text-white text-center uppercase">
            Сохранить как рецепт
          </h2>
        </div>

        {/* Content */}
        <div className="px-6 pb-6 space-y-4">
          {/* Название рецепта */}
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
              Название рецепта <span className="text-red-500">*</span>
            </label>
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Введите название рецепта"
              className="w-full px-4 py-3 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white placeholder-gray-400 dark:placeholder-gray-500 focus:ring-2 focus:ring-green-500 focus:border-transparent"
              autoFocus
            />
          </div>

          {/* Заметка к рецепту */}
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
              Заметка к рецепту
            </label>
            <textarea
              value={note}
              onChange={(e) => setNote(e.target.value)}
              placeholder="Добавьте заметку (необязательно)"
              className="w-full min-h-[100px] px-4 py-3 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white placeholder-gray-400 dark:placeholder-gray-500 focus:ring-2 focus:ring-green-500 focus:border-transparent resize-none"
            />
          </div>
        </div>

        {/* Footer buttons */}
        <div className="px-6 pb-6 flex justify-end gap-4">
          <button
            onClick={onClose}
            className="text-green-600 dark:text-green-400 font-semibold uppercase hover:opacity-70 transition-opacity"
          >
            Отмена
          </button>
          <button
            onClick={handleSave}
            className="text-green-600 dark:text-green-400 font-semibold uppercase hover:opacity-70 transition-opacity"
          >
            Сохранить
          </button>
        </div>
      </div>
    </div>
  );
};

export default SaveMealAsRecipeModal;

