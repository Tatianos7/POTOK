import { useState, useEffect } from 'react';
import { X, Plus, Minus } from 'lucide-react';
import { Exercise, SelectedExercise } from '../types/workout';

interface SelectedExercisesEditorProps {
  isOpen: boolean;
  onClose: () => void;
  exercises: Exercise[];
  onSave: (exercises: SelectedExercise[]) => void;
  onAddExercise?: () => void;
}

const weekDays = [
  { label: 'П', dayOfWeek: 1, fullName: 'Понедельник' },
  { label: 'В', dayOfWeek: 2, fullName: 'Вторник' },
  { label: 'С', dayOfWeek: 3, fullName: 'Среда' },
  { label: 'Ч', dayOfWeek: 4, fullName: 'Четверг' },
  { label: 'П', dayOfWeek: 5, fullName: 'Пятница' },
  { label: 'С', dayOfWeek: 6, fullName: 'Суббота' },
  { label: 'В', dayOfWeek: 0, fullName: 'Воскресенье' },
];

const SelectedExercisesEditor = ({
  isOpen,
  onClose,
  exercises,
  onSave,
  onAddExercise,
}: SelectedExercisesEditorProps) => {
  const [editedExercises, setEditedExercises] = useState<SelectedExercise[]>([]);
  const [selectedDayOfWeek, setSelectedDayOfWeek] = useState<number | null>(null);
  const [saveForEachWeek, setSaveForEachWeek] = useState(false);

  useEffect(() => {
    if (isOpen) {
      document.body.style.overflow = 'hidden';
      // Инициализируем с дефолтными значениями
      setEditedExercises(
        exercises.map(ex => ({
          exercise: ex,
          sets: 3,
          reps: 12,
          weight: 20,
        }))
      );
      // Сбрасываем выбор дня недели
      setSelectedDayOfWeek(null);
      setSaveForEachWeek(false);
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

  const handleSave = () => {
    onSave(editedExercises);
    onClose();
  };

  const handleAddExercise = () => {
    if (onAddExercise) {
      onAddExercise();
    }
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
          className="bg-white dark:bg-gray-900 rounded-xl shadow-2xl w-full max-w-2xl max-h-[90vh] overflow-hidden flex flex-col"
          onClick={(e) => e.stopPropagation()}
        >
          {/* Header */}
          <div className="px-4 py-3 border-b border-gray-200 dark:border-gray-700 flex items-center justify-between flex-shrink-0">
            <h2 className="text-lg font-semibold text-gray-900 dark:text-white uppercase">
              ВЫБРАННЫЕ УПРАЖНЕНИЯ
            </h2>
            <button
              onClick={onClose}
              className="p-2 hover:bg-gray-100 dark:hover:bg-gray-800 rounded-lg transition-colors"
              aria-label="Закрыть"
            >
              <X className="w-5 h-5 text-gray-700 dark:text-gray-300" />
            </button>
          </div>

          {/* Content */}
          <div className="overflow-y-auto flex-1 px-4 py-4">
            {/* Exercises Table */}
            {editedExercises.length === 0 ? (
              <div className="py-12 text-center">
                <p className="text-sm text-gray-500 dark:text-gray-400">
                  Нет упражнений для настройки
                </p>
              </div>
            ) : (
              <div className="overflow-x-auto mb-6">
                <table className="w-full border-collapse">
                  <thead>
                    <tr className="border-b border-gray-200 dark:border-gray-700">
                      <th className="text-left py-2 px-2 text-xs font-semibold text-gray-700 dark:text-gray-300 uppercase">
                        Название упражнения
                      </th>
                      <th className="text-center py-2 px-2 text-xs font-semibold text-gray-700 dark:text-gray-300 uppercase w-20">
                        Подходы
                      </th>
                      <th className="text-center py-2 px-2 text-xs font-semibold text-gray-700 dark:text-gray-300 uppercase w-20">
                        Повторы
                      </th>
                      <th className="text-center py-2 px-2 text-xs font-semibold text-gray-700 dark:text-gray-300 uppercase w-20">
                        Вес
                      </th>
                    </tr>
                  </thead>
                  <tbody>
                    {editedExercises.map((item, index) => {
                      const primaryMuscle = item.exercise.muscles?.[0]?.name || '';
                      return (
                        <tr
                          key={`${item.exercise.id}-${index}`}
                          className="border-b border-gray-100 dark:border-gray-800"
                        >
                          <td className="py-3 px-2">
                            <div className="min-w-0">
                              <div className="text-sm font-medium text-gray-900 dark:text-white break-words">
                                {item.exercise.name}
                              </div>
                              {primaryMuscle && (
                                <div className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">
                                  {primaryMuscle}
                                </div>
                              )}
                            </div>
                          </td>
                          <td className="py-3 px-2">
                            <div className="flex items-center justify-center gap-1">
                              <button
                                onClick={() => handleDecrement(index, 'sets')}
                                className="p-1 hover:bg-gray-200 dark:hover:bg-gray-700 rounded transition-colors"
                              >
                                <Minus className="w-3 h-3 text-gray-600 dark:text-gray-400" />
                              </button>
                              <input
                                type="number"
                                min="0"
                                value={item.sets}
                                onChange={(e) => handleUpdate(index, 'sets', parseInt(e.target.value) || 0)}
                                className="w-12 px-1 py-1 text-center text-sm font-medium rounded border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-900 text-gray-900 dark:text-white focus:outline-none focus:ring-1 focus:ring-green-500"
                              />
                              <button
                                onClick={() => handleIncrement(index, 'sets')}
                                className="p-1 hover:bg-gray-200 dark:hover:bg-gray-700 rounded transition-colors"
                              >
                                <Plus className="w-3 h-3 text-gray-600 dark:text-gray-400" />
                              </button>
                            </div>
                          </td>
                          <td className="py-3 px-2">
                            <div className="flex items-center justify-center gap-1">
                              <button
                                onClick={() => handleDecrement(index, 'reps')}
                                className="p-1 hover:bg-gray-200 dark:hover:bg-gray-700 rounded transition-colors"
                              >
                                <Minus className="w-3 h-3 text-gray-600 dark:text-gray-400" />
                              </button>
                              <input
                                type="number"
                                min="0"
                                value={item.reps}
                                onChange={(e) => handleUpdate(index, 'reps', parseInt(e.target.value) || 0)}
                                className="w-12 px-1 py-1 text-center text-sm font-medium rounded border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-900 text-gray-900 dark:text-white focus:outline-none focus:ring-1 focus:ring-green-500"
                              />
                              <button
                                onClick={() => handleIncrement(index, 'reps')}
                                className="p-1 hover:bg-gray-200 dark:hover:bg-gray-700 rounded transition-colors"
                              >
                                <Plus className="w-3 h-3 text-gray-600 dark:text-gray-400" />
                              </button>
                            </div>
                          </td>
                          <td className="py-3 px-2">
                            <div className="flex items-center justify-center gap-1">
                              <button
                                onClick={() => handleDecrement(index, 'weight', 0.5)}
                                className="p-1 hover:bg-gray-200 dark:hover:bg-gray-700 rounded transition-colors"
                              >
                                <Minus className="w-3 h-3 text-gray-600 dark:text-gray-400" />
                              </button>
                              <input
                                type="number"
                                min="0"
                                step="0.5"
                                value={item.weight}
                                onChange={(e) => handleUpdate(index, 'weight', parseFloat(e.target.value) || 0)}
                                className="w-12 px-1 py-1 text-center text-sm font-medium rounded border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-900 text-gray-900 dark:text-white focus:outline-none focus:ring-1 focus:ring-green-500"
                              />
                              <button
                                onClick={() => handleIncrement(index, 'weight', 0.5)}
                                className="p-1 hover:bg-gray-200 dark:hover:bg-gray-700 rounded transition-colors"
                              >
                                <Plus className="w-3 h-3 text-gray-600 dark:text-gray-400" />
                              </button>
                            </div>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}

            {/* Week Day Selection */}
            <div className="mb-4">
              <p className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-3">
                Выбрать день недели тренировки:
              </p>
              <div className="flex items-center justify-center gap-3">
                {weekDays.map((day) => {
                  const isSelected = selectedDayOfWeek === day.dayOfWeek;
                  return (
                    <button
                      key={day.dayOfWeek}
                      onClick={() => setSelectedDayOfWeek(day.dayOfWeek)}
                      className={`w-10 h-10 rounded-full flex items-center justify-center text-sm font-semibold transition-colors ${
                        isSelected
                          ? 'bg-green-500 text-white'
                          : 'bg-gray-100 dark:bg-gray-800 text-gray-700 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-700'
                      }`}
                      title={day.fullName}
                    >
                      {isSelected ? '✓' : day.label}
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Save for each week checkbox */}
            {selectedDayOfWeek !== null && (
              <div className="mb-4 flex items-center gap-2">
                <input
                  type="checkbox"
                  id="saveForEachWeek"
                  checked={saveForEachWeek}
                  onChange={(e) => setSaveForEachWeek(e.target.checked)}
                  className="w-5 h-5 rounded border-gray-300 dark:border-gray-600 text-green-500 focus:ring-green-500"
                />
                <label
                  htmlFor="saveForEachWeek"
                  className="text-sm text-gray-700 dark:text-gray-300 cursor-pointer"
                >
                  Сохранить на каждый {weekDays.find(d => d.dayOfWeek === selectedDayOfWeek)?.label || ''}?
                </label>
              </div>
            )}
          </div>

          {/* Footer */}
          <div className="px-4 py-4 border-t border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900 flex flex-col gap-3 flex-shrink-0">
            <button
              onClick={handleAddExercise}
              className="w-full py-3 px-4 rounded-xl font-semibold text-sm uppercase bg-gray-100 dark:bg-gray-800 text-gray-900 dark:text-white hover:bg-gray-200 dark:hover:bg-gray-700 transition-colors"
            >
              ДОБАВИТЬ УПРАЖНЕНИЕ
            </button>
            <button
              onClick={handleSave}
              disabled={editedExercises.length === 0}
              className="w-full py-3 px-4 rounded-xl font-semibold text-sm uppercase bg-gray-900 dark:bg-white text-white dark:text-gray-900 hover:bg-gray-800 dark:hover:bg-gray-100 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            >
              СОХРАНИТЬ
            </button>
          </div>
        </div>
      </div>
    </>
  );
};

export default SelectedExercisesEditor;

