import { useState, useEffect, useRef } from 'react';
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
  const previousExercisesRef = useRef<Exercise[]>([]);
  const isInitializedRef = useRef(false);

  // Управление overflow body
  useEffect(() => {
    if (isOpen) {
      document.body.style.overflow = 'hidden';
    } else {
      document.body.style.overflow = '';
      // Сбрасываем при закрытии
      isInitializedRef.current = false;
      previousExercisesRef.current = [];
    }
    return () => {
      document.body.style.overflow = '';
    };
  }, [isOpen]);

  // Инициализация и добавление новых упражнений
  useEffect(() => {
    if (!isOpen) return;

    if (!isInitializedRef.current && exercises.length > 0) {
      // Первая инициализация
      setEditedExercises(
        exercises.map(ex => ({
          exercise: ex,
          sets: 3,
          reps: 12,
          weight: 20,
        }))
      );
      setSelectedDayOfWeek(null);
      setSaveForEachWeek(false);
      isInitializedRef.current = true;
      previousExercisesRef.current = exercises;
    } else if (isInitializedRef.current && exercises.length > 0) {
      // Добавление новых упражнений к существующим
      const previousIds = new Set(previousExercisesRef.current.map(ex => ex.id));
      const newExercises = exercises.filter(ex => !previousIds.has(ex.id));
      
      if (newExercises.length > 0) {
        const newSelectedExercises = newExercises.map(ex => ({
          exercise: ex,
          sets: 3,
          reps: 12,
          weight: 20,
        }));
        setEditedExercises(prev => [...prev, ...newSelectedExercises]);
        previousExercisesRef.current = exercises;
      }
    }
  }, [exercises, isOpen]);

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
        className="fixed inset-0 bg-black bg-opacity-50 z-[50] transition-opacity"
        onClick={onClose}
      />

      {/* Modal - Centered */}
      <div className="fixed inset-0 z-[50] flex items-center justify-center p-1 min-[376px]:p-2 sm:p-4">
        <div
          className="bg-white dark:bg-gray-900 rounded-lg sm:rounded-xl shadow-2xl w-full max-w-2xl max-h-[95vh] sm:max-h-[90vh] overflow-hidden flex flex-col min-w-[320px]"
          onClick={(e) => e.stopPropagation()}
        >
          {/* Header */}
          <div className="px-2 min-[376px]:px-3 sm:px-4 py-2 min-[376px]:py-2.5 sm:py-3 border-b border-gray-200 dark:border-gray-700 flex items-center justify-between flex-shrink-0">
            <h2 className="text-xs min-[376px]:text-sm sm:text-lg font-semibold text-gray-900 dark:text-white uppercase">
              ВЫБРАННЫЕ УПРАЖНЕНИЯ
            </h2>
            <button
              onClick={onClose}
              className="p-1 min-[376px]:p-1.5 sm:p-2 hover:bg-gray-100 dark:hover:bg-gray-800 rounded-lg transition-colors flex-shrink-0"
              aria-label="Закрыть"
            >
              <X className="w-4 h-4 min-[376px]:w-4.5 sm:w-5 sm:h-5 text-gray-700 dark:text-gray-300" />
            </button>
          </div>

          {/* Content */}
          <div className="overflow-y-auto flex-1 px-2 min-[376px]:px-3 sm:px-4 py-2 min-[376px]:py-3 sm:py-4">
            {/* Exercises Table */}
            {editedExercises.length === 0 ? (
              <div className="py-8 sm:py-12 text-center">
                <p className="text-xs sm:text-sm text-gray-500 dark:text-gray-400">
                  Нет упражнений для настройки
                </p>
              </div>
            ) : (
              <div className="overflow-x-auto mb-4 sm:mb-6 -mx-2 min-[376px]:-mx-3 sm:-mx-4 px-2 min-[376px]:px-3 sm:px-4">
                <table className="w-full border-collapse min-w-[280px]">
                  <thead>
                    <tr className="border-b border-gray-200 dark:border-gray-700">
                      <th className="text-left py-1.5 min-[376px]:py-2 px-1 min-[376px]:px-2 text-[10px] min-[376px]:text-xs font-semibold text-gray-700 dark:text-gray-300 uppercase">
                        <span className="hidden min-[376px]:inline">Название упражнения</span>
                        <span className="min-[376px]:hidden">Упражнение</span>
                      </th>
                      <th className="text-right py-1.5 min-[376px]:py-2 pl-1 min-[376px]:pl-2 pr-2 min-[376px]:pr-3 text-[10px] min-[376px]:text-xs font-semibold text-gray-700 dark:text-gray-300 uppercase w-16 min-[376px]:w-20">
                        Подходы
                      </th>
                      <th className="text-right py-1.5 min-[376px]:py-2 pl-1 min-[376px]:pl-2 pr-2 min-[376px]:pr-3 text-[10px] min-[376px]:text-xs font-semibold text-gray-700 dark:text-gray-300 uppercase w-16 min-[376px]:w-20">
                        Повторы
                      </th>
                      <th className="text-right py-1.5 min-[376px]:py-2 pl-1 min-[376px]:pl-2 pr-2 min-[376px]:pr-3 text-[10px] min-[376px]:text-xs font-semibold text-gray-700 dark:text-gray-300 uppercase w-16 min-[376px]:w-20">
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
                          <td className="py-2 min-[376px]:py-3 px-1 min-[376px]:px-2">
                            <div className="min-w-0 max-w-[140px] min-[376px]:max-w-none">
                              <div className="text-[11px] min-[376px]:text-xs sm:text-sm font-medium text-gray-900 dark:text-white break-words overflow-wrap-anywhere">
                                {item.exercise.name}
                              </div>
                              {primaryMuscle && (
                                <div className="text-[10px] min-[376px]:text-xs text-gray-500 dark:text-gray-400 mt-0.5 break-words overflow-wrap-anywhere">
                                  {primaryMuscle}
                                </div>
                              )}
                            </div>
                          </td>
                          <td className="py-2 min-[376px]:py-3 pl-1 min-[376px]:pl-2 pr-2 min-[376px]:pr-3">
                            <div className="flex items-center justify-end gap-0.5 min-[376px]:gap-1">
                              <button
                                onClick={() => handleDecrement(index, 'sets')}
                                className="p-0.5 min-[376px]:p-1 hover:bg-gray-200 dark:hover:bg-gray-700 rounded transition-colors"
                              >
                                <Minus className="w-2.5 h-2.5 min-[376px]:w-3 min-[376px]:h-3 text-gray-600 dark:text-gray-400" />
                              </button>
                              <input
                                type="number"
                                min="0"
                                value={item.sets}
                                onChange={(e) => handleUpdate(index, 'sets', parseInt(e.target.value) || 0)}
                                className="w-10 min-[376px]:w-12 px-0.5 min-[376px]:px-1 py-0.5 min-[376px]:py-1 text-center text-[11px] min-[376px]:text-xs sm:text-sm font-medium rounded border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-900 text-gray-900 dark:text-white focus:outline-none focus:ring-1 focus:ring-green-500"
                              />
                              <button
                                onClick={() => handleIncrement(index, 'sets')}
                                className="p-0.5 min-[376px]:p-1 hover:bg-gray-200 dark:hover:bg-gray-700 rounded transition-colors"
                              >
                                <Plus className="w-2.5 h-2.5 min-[376px]:w-3 min-[376px]:h-3 text-gray-600 dark:text-gray-400" />
                              </button>
                            </div>
                          </td>
                          <td className="py-2 min-[376px]:py-3 pl-1 min-[376px]:pl-2 pr-2 min-[376px]:pr-3">
                            <div className="flex items-center justify-end gap-0.5 min-[376px]:gap-1">
                              <button
                                onClick={() => handleDecrement(index, 'reps')}
                                className="p-0.5 min-[376px]:p-1 hover:bg-gray-200 dark:hover:bg-gray-700 rounded transition-colors"
                              >
                                <Minus className="w-2.5 h-2.5 min-[376px]:w-3 min-[376px]:h-3 text-gray-600 dark:text-gray-400" />
                              </button>
                              <input
                                type="number"
                                min="0"
                                value={item.reps}
                                onChange={(e) => handleUpdate(index, 'reps', parseInt(e.target.value) || 0)}
                                className="w-10 min-[376px]:w-12 px-0.5 min-[376px]:px-1 py-0.5 min-[376px]:py-1 text-center text-[11px] min-[376px]:text-xs sm:text-sm font-medium rounded border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-900 text-gray-900 dark:text-white focus:outline-none focus:ring-1 focus:ring-green-500"
                              />
                              <button
                                onClick={() => handleIncrement(index, 'reps')}
                                className="p-0.5 min-[376px]:p-1 hover:bg-gray-200 dark:hover:bg-gray-700 rounded transition-colors"
                              >
                                <Plus className="w-2.5 h-2.5 min-[376px]:w-3 min-[376px]:h-3 text-gray-600 dark:text-gray-400" />
                              </button>
                            </div>
                          </td>
                          <td className="py-2 min-[376px]:py-3 pl-1 min-[376px]:pl-2 pr-2 min-[376px]:pr-3">
                            <div className="flex items-center justify-end gap-0.5 min-[376px]:gap-1">
                              <button
                                onClick={() => handleDecrement(index, 'weight', 0.5)}
                                className="p-0.5 min-[376px]:p-1 hover:bg-gray-200 dark:hover:bg-gray-700 rounded transition-colors"
                              >
                                <Minus className="w-2.5 h-2.5 min-[376px]:w-3 min-[376px]:h-3 text-gray-600 dark:text-gray-400" />
                              </button>
                              <input
                                type="number"
                                min="0"
                                step="0.5"
                                value={item.weight}
                                onChange={(e) => handleUpdate(index, 'weight', parseFloat(e.target.value) || 0)}
                                className="w-10 min-[376px]:w-12 px-0.5 min-[376px]:px-1 py-0.5 min-[376px]:py-1 text-center text-[11px] min-[376px]:text-xs sm:text-sm font-medium rounded border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-900 text-gray-900 dark:text-white focus:outline-none focus:ring-1 focus:ring-green-500"
                              />
                              <button
                                onClick={() => handleIncrement(index, 'weight', 0.5)}
                                className="p-0.5 min-[376px]:p-1 hover:bg-gray-200 dark:hover:bg-gray-700 rounded transition-colors"
                              >
                                <Plus className="w-2.5 h-2.5 min-[376px]:w-3 min-[376px]:h-3 text-gray-600 dark:text-gray-400" />
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
            <div className="mb-3 sm:mb-4">
              <p className="text-xs min-[376px]:text-sm font-medium text-gray-700 dark:text-gray-300 mb-2 min-[376px]:mb-3">
                Выбрать день недели тренировки:
              </p>
              <div className="flex items-center justify-center gap-1.5 min-[376px]:gap-2 sm:gap-3">
                {weekDays.map((day) => {
                  const isSelected = selectedDayOfWeek === day.dayOfWeek;
                  return (
                    <button
                      key={day.dayOfWeek}
                      onClick={() => setSelectedDayOfWeek(day.dayOfWeek)}
                      className={`w-8 h-8 min-[376px]:w-9 min-[376px]:h-9 sm:w-10 sm:h-10 rounded-full flex items-center justify-center text-[11px] min-[376px]:text-xs sm:text-sm font-semibold transition-colors ${
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
              <div className="mb-3 sm:mb-4 flex items-center gap-1.5 min-[376px]:gap-2">
                <input
                  type="checkbox"
                  id="saveForEachWeek"
                  checked={saveForEachWeek}
                  onChange={(e) => setSaveForEachWeek(e.target.checked)}
                  className="w-4 h-4 min-[376px]:w-5 min-[376px]:h-5 rounded border-gray-300 dark:border-gray-600 text-green-500 focus:ring-green-500 flex-shrink-0"
                />
                <label
                  htmlFor="saveForEachWeek"
                  className="text-xs min-[376px]:text-sm text-gray-700 dark:text-gray-300 cursor-pointer break-words overflow-wrap-anywhere"
                >
                  Сохранить на каждый {weekDays.find(d => d.dayOfWeek === selectedDayOfWeek)?.label || ''}?
                </label>
              </div>
            )}
          </div>

          {/* Footer */}
          <div className="px-2 min-[376px]:px-3 sm:px-4 py-2.5 min-[376px]:py-3 sm:py-4 border-t border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900 flex flex-col gap-2 min-[376px]:gap-2.5 sm:gap-3 flex-shrink-0">
            <button
              onClick={handleAddExercise}
              className="w-full py-2.5 min-[376px]:py-3 sm:py-3 px-3 min-[376px]:px-4 rounded-lg sm:rounded-xl font-semibold text-[11px] min-[376px]:text-xs sm:text-sm uppercase bg-gray-100 dark:bg-gray-800 text-gray-900 dark:text-white hover:bg-gray-200 dark:hover:bg-gray-700 transition-colors"
            >
              ДОБАВИТЬ УПРАЖНЕНИЕ
            </button>
            <button
              onClick={handleSave}
              disabled={editedExercises.length === 0}
              className="w-full py-2.5 min-[376px]:py-3 sm:py-3 px-3 min-[376px]:px-4 rounded-lg sm:rounded-xl font-semibold text-[11px] min-[376px]:text-xs sm:text-sm uppercase bg-gray-900 dark:bg-white text-white dark:text-gray-900 hover:bg-gray-800 dark:hover:bg-gray-100 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
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

