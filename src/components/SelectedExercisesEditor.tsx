import { useState, useEffect } from 'react';
import { X, Plus, Minus } from 'lucide-react';
import { Exercise, SelectedExercise } from '../types/workout';

interface SelectedExercisesEditorProps {
  isOpen: boolean;
  onClose: () => void;
  exercises: Exercise[];
  onSave: (exercises: SelectedExercise[]) => void;
}

const SelectedExercisesEditor = ({
  isOpen,
  onClose,
  exercises,
  onSave,
}: SelectedExercisesEditorProps) => {
  const [editedExercises, setEditedExercises] = useState<SelectedExercise[]>([]);

  useEffect(() => {
    if (isOpen) {
      document.body.style.overflow = 'hidden';
      // Инициализируем с дефолтными значениями
      setEditedExercises(
        exercises.map(ex => ({
          exercise: ex,
          sets: 3,
          reps: 12,
          weight: 0,
        }))
      );
    } else {
      document.body.style.overflow = '';
    }
    return () => {
      document.body.style.overflow = '';
    };
  }, [isOpen, exercises]);

  const handleUpdate = (index: number, field: 'sets' | 'reps' | 'weight', value: number) => {
    const updated = [...editedExercises];
    updated[index] = {
      ...updated[index],
      [field]: Math.max(0, value),
    };
    setEditedExercises(updated);
  };

  const handleIncrement = (index: number, field: 'sets' | 'reps' | 'weight', step: number = 1) => {
    const current = editedExercises[index][field];
    handleUpdate(index, field, current + step);
  };

  const handleDecrement = (index: number, field: 'sets' | 'reps' | 'weight', step: number = 1) => {
    const current = editedExercises[index][field];
    handleUpdate(index, field, Math.max(0, current - step));
  };

  const handleRemove = (index: number) => {
    const updated = editedExercises.filter((_, i) => i !== index);
    setEditedExercises(updated);
  };

  const handleSave = () => {
    onSave(editedExercises);
    onClose();
  };

  if (!isOpen) return null;

  return (
    <>
      {/* Overlay */}
      <div
        className="fixed inset-0 bg-black bg-opacity-50 z-40 transition-opacity"
        onClick={onClose}
      />

      {/* Modal - Centered */}
      <div className="fixed inset-0 z-50 flex items-center justify-center p-2 min-[376px]:p-4">
        <div
          className="bg-white dark:bg-gray-900 rounded-xl shadow-2xl w-full max-w-md max-h-[90vh] overflow-hidden flex flex-col"
          onClick={(e) => e.stopPropagation()}
        >

          {/* Header */}
          <div className="px-4 py-3 border-b border-gray-200 dark:border-gray-700 flex items-center justify-between flex-shrink-0">
            <h2 className="text-lg font-semibold text-gray-900 dark:text-white uppercase">
              Настройка упражнений
            </h2>
            <button
              onClick={onClose}
              className="p-2 hover:bg-gray-100 dark:hover:bg-gray-800 rounded-lg transition-colors"
              aria-label="Закрыть"
            >
              <X className="w-5 h-5 text-gray-700 dark:text-gray-300" />
            </button>
          </div>

          {/* Exercises List */}
          <div className="overflow-y-auto flex-1">
          {editedExercises.length === 0 ? (
            <div className="px-4 py-12 text-center">
              <p className="text-sm text-gray-500 dark:text-gray-400">
                Нет упражнений для настройки
              </p>
            </div>
          ) : (
            <div className="px-4 py-4 space-y-4">
              {editedExercises.map((item, index) => {
                const primaryMuscle = item.exercise.muscles?.[0]?.name || '';

                return (
                  <div
                    key={`${item.exercise.id}-${index}`}
                    className="bg-gray-50 dark:bg-gray-800 rounded-xl p-4 space-y-3"
                  >
                    {/* Exercise Header */}
                    <div className="flex items-start justify-between">
                      <div className="flex-1 min-w-0">
                        <h3 className="text-sm font-semibold text-gray-900 dark:text-white truncate">
                          {item.exercise.name}
                        </h3>
                        {primaryMuscle && (
                          <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5 truncate">
                            {primaryMuscle}
                          </p>
                        )}
                      </div>
                      <button
                        onClick={() => handleRemove(index)}
                        className="p-1 hover:bg-gray-200 dark:hover:bg-gray-700 rounded-lg transition-colors ml-2 flex-shrink-0"
                        aria-label="Удалить"
                      >
                        <X className="w-4 h-4 text-gray-500 dark:text-gray-400" />
                      </button>
                    </div>

                    {/* Input Fields */}
                    <div className="grid grid-cols-3 gap-3">
                      {/* Подходы */}
                      <div>
                        <label className="block text-xs font-medium text-gray-700 dark:text-gray-300 mb-1.5">
                          Подходы
                        </label>
                        <div className="flex items-center gap-1">
                          <button
                            onClick={() => handleDecrement(index, 'sets')}
                            className="p-1.5 hover:bg-gray-200 dark:hover:bg-gray-700 rounded-lg transition-colors"
                          >
                            <Minus className="w-4 h-4 text-gray-600 dark:text-gray-400" />
                          </button>
                          <input
                            type="number"
                            min="0"
                            value={item.sets}
                            onChange={(e) => handleUpdate(index, 'sets', parseInt(e.target.value) || 0)}
                            className="w-full px-2 py-1.5 text-center text-sm font-medium rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-900 text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-green-500"
                          />
                          <button
                            onClick={() => handleIncrement(index, 'sets')}
                            className="p-1.5 hover:bg-gray-200 dark:hover:bg-gray-700 rounded-lg transition-colors"
                          >
                            <Plus className="w-4 h-4 text-gray-600 dark:text-gray-400" />
                          </button>
                        </div>
                      </div>

                      {/* Повторы */}
                      <div>
                        <label className="block text-xs font-medium text-gray-700 dark:text-gray-300 mb-1.5">
                          Повторы
                        </label>
                        <div className="flex items-center gap-1">
                          <button
                            onClick={() => handleDecrement(index, 'reps')}
                            className="p-1.5 hover:bg-gray-200 dark:hover:bg-gray-700 rounded-lg transition-colors"
                          >
                            <Minus className="w-4 h-4 text-gray-600 dark:text-gray-400" />
                          </button>
                          <input
                            type="number"
                            min="0"
                            value={item.reps}
                            onChange={(e) => handleUpdate(index, 'reps', parseInt(e.target.value) || 0)}
                            className="w-full px-2 py-1.5 text-center text-sm font-medium rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-900 text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-green-500"
                          />
                          <button
                            onClick={() => handleIncrement(index, 'reps')}
                            className="p-1.5 hover:bg-gray-200 dark:hover:bg-gray-700 rounded-lg transition-colors"
                          >
                            <Plus className="w-4 h-4 text-gray-600 dark:text-gray-400" />
                          </button>
                        </div>
                      </div>

                      {/* Вес */}
                      <div>
                        <label className="block text-xs font-medium text-gray-700 dark:text-gray-300 mb-1.5">
                          Вес (кг)
                        </label>
                        <div className="flex items-center gap-1">
                          <button
                            onClick={() => handleDecrement(index, 'weight', 0.5)}
                            className="p-1.5 hover:bg-gray-200 dark:hover:bg-gray-700 rounded-lg transition-colors"
                          >
                            <Minus className="w-4 h-4 text-gray-600 dark:text-gray-400" />
                          </button>
                          <input
                            type="number"
                            min="0"
                            step="0.5"
                            value={item.weight}
                            onChange={(e) => handleUpdate(index, 'weight', parseFloat(e.target.value) || 0)}
                            className="w-full px-2 py-1.5 text-center text-sm font-medium rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-900 text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-green-500"
                          />
                          <button
                            onClick={() => handleIncrement(index, 'weight', 0.5)}
                            className="p-1.5 hover:bg-gray-200 dark:hover:bg-gray-700 rounded-lg transition-colors"
                          >
                            <Plus className="w-4 h-4 text-gray-600 dark:text-gray-400" />
                          </button>
                        </div>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>

          {/* Footer */}
          <div className="px-4 py-4 border-t border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900 flex gap-3 flex-shrink-0">
            <button
              onClick={onClose}
              className="flex-1 py-3 min-[376px]:py-4 px-4 rounded-xl font-semibold text-sm min-[376px]:text-base uppercase bg-gray-100 dark:bg-gray-800 text-gray-900 dark:text-white hover:bg-gray-200 dark:hover:bg-gray-700 transition-colors"
            >
              Отмена
            </button>
            <button
              onClick={handleSave}
              disabled={editedExercises.length === 0}
              className="flex-1 py-3 min-[376px]:py-4 px-4 rounded-xl font-semibold text-sm min-[376px]:text-base uppercase bg-gray-900 dark:bg-white text-white dark:text-gray-900 hover:bg-gray-800 dark:hover:bg-gray-100 transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
            >
              <span>✅ ОК</span>
            </button>
          </div>
        </div>
      </div>
    </>
  );
};

export default SelectedExercisesEditor;

