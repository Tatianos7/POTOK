import { memo, useCallback, useEffect, useRef, useState } from 'react';
import { X } from 'lucide-react';
import { Exercise, SelectedExercise } from '../types/workout';
import {
  buildWorkoutIntegerDraft,
  getWorkoutIntegerInputProps,
  parseWorkoutIntegerInput,
  sanitizeWorkoutIntegerInput,
} from '../utils/workoutNumericInput';
import {
  buildWorkoutWeightDraft,
  getWorkoutWeightInputProps,
  parseWorkoutWeightInput,
  sanitizeWorkoutWeightInput,
} from '../utils/workoutEntryWeightInput';
import { updateSelectedExerciseField } from '../utils/workoutEditorState';

interface SelectedExercisesEditorProps {
  isOpen: boolean;
  onClose: () => void;
  exercises: Exercise[];
  initialSelectedExercises?: SelectedExercise[];
  onSave: (exercises: SelectedExercise[]) => void;
  onAddExercise?: () => void;
  isSaving?: boolean;
  title?: string;
}

interface SelectedExerciseEditorRowProps {
  item: SelectedExercise;
  index: number;
  onIntegerChange: (index: number, field: 'sets' | 'reps', rawValue: string) => void;
  onWeightChange: (index: number, rawValue: string) => void;
}

const SelectedExerciseEditorRow = memo(function SelectedExerciseEditorRow({
  item,
  index,
  onIntegerChange,
  onWeightChange,
}: SelectedExerciseEditorRowProps) {
  const [setsDraft, setSetsDraft] = useState(() => buildWorkoutIntegerDraft(item.sets));
  const [repsDraft, setRepsDraft] = useState(() => buildWorkoutIntegerDraft(item.reps));
  const [weightDraft, setWeightDraft] = useState(() => buildWorkoutWeightDraft(item.weight));

  useEffect(() => {
    setSetsDraft(buildWorkoutIntegerDraft(item.sets));
  }, [item.sets]);

  useEffect(() => {
    setRepsDraft(buildWorkoutIntegerDraft(item.reps));
  }, [item.reps]);

  useEffect(() => {
    setWeightDraft(buildWorkoutWeightDraft(item.weight));
  }, [item.weight]);

  const primaryMuscle = item.exercise.muscles?.[0]?.name || '';

  return (
    <tr className="border-b border-gray-100 dark:border-gray-800">
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
        <div className="flex items-center justify-end">
          <input
            {...getWorkoutIntegerInputProps()}
            value={setsDraft}
            onChange={(e) => {
              setSetsDraft(sanitizeWorkoutIntegerInput(e.target.value));
              onIntegerChange(index, 'sets', e.target.value);
            }}
            className="w-12 min-[376px]:w-14 px-1.5 min-[376px]:px-2 py-1 min-[376px]:py-1.5 text-center text-[11px] min-[376px]:text-xs sm:text-sm font-medium rounded border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-900 text-gray-900 dark:text-white focus:outline-none focus:ring-1 focus:ring-green-500"
          />
        </div>
      </td>
      <td className="py-2 min-[376px]:py-3 pl-1 min-[376px]:pl-2 pr-2 min-[376px]:pr-3">
        <div className="flex items-center justify-end">
          <input
            {...getWorkoutIntegerInputProps()}
            value={repsDraft}
            onChange={(e) => {
              setRepsDraft(sanitizeWorkoutIntegerInput(e.target.value));
              onIntegerChange(index, 'reps', e.target.value);
            }}
            className="w-12 min-[376px]:w-14 px-1.5 min-[376px]:px-2 py-1 min-[376px]:py-1.5 text-center text-[11px] min-[376px]:text-xs sm:text-sm font-medium rounded border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-900 text-gray-900 dark:text-white focus:outline-none focus:ring-1 focus:ring-green-500"
          />
        </div>
      </td>
      <td className="py-2 min-[376px]:py-3 pl-1 min-[376px]:pl-2 pr-2 min-[376px]:pr-3">
        <div className="flex items-center justify-center">
          <input
            {...getWorkoutWeightInputProps()}
            value={weightDraft}
            onChange={(e) => {
              setWeightDraft(sanitizeWorkoutWeightInput(e.target.value));
              onWeightChange(index, e.target.value);
            }}
            className="w-12 min-[376px]:w-14 px-1.5 min-[376px]:px-2 py-1 min-[376px]:py-1.5 text-center text-[11px] min-[376px]:text-xs sm:text-sm font-medium rounded border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-900 text-gray-900 dark:text-white focus:outline-none focus:ring-1 focus:ring-green-500"
          />
        </div>
      </td>
    </tr>
  );
});

const SelectedExercisesEditor = ({
  isOpen,
  onClose,
  exercises,
  initialSelectedExercises,
  onSave,
  onAddExercise,
  isSaving = false,
  title = 'ВЫБРАННЫЕ УПРАЖНЕНИЯ',
}: SelectedExercisesEditorProps) => {
  const [editedExercises, setEditedExercises] = useState<SelectedExercise[]>([]);
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

    if (!isInitializedRef.current && initialSelectedExercises && initialSelectedExercises.length > 0) {
      setEditedExercises(initialSelectedExercises);
      isInitializedRef.current = true;
      previousExercisesRef.current = initialSelectedExercises.map((item) => item.exercise);
    } else if (!isInitializedRef.current && exercises.length > 0) {
      // Первая инициализация
      const nextExercises = exercises.map(ex => ({
          exercise: ex,
          sets: 3,
          reps: 12,
          weight: 20,
        }));
      setEditedExercises(nextExercises);
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
  }, [exercises, initialSelectedExercises, isOpen]);

  const handleIntegerDraftChange = useCallback((
    index: number,
    field: 'sets' | 'reps',
    rawValue: string,
  ) => {
    setEditedExercises((current) =>
      updateSelectedExerciseField(current, index, field, parseWorkoutIntegerInput(rawValue)),
    );
  }, []);

  const handleWeightDraftChange = useCallback((index: number, rawValue: string) => {
    setEditedExercises((current) =>
      updateSelectedExerciseField(current, index, 'weight', parseWorkoutWeightInput(rawValue)),
    );
  }, []);

  const handleSave = () => {
    if (isSaving) return;
    onSave(editedExercises);
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
              {title}
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
              <div className="overflow-x-auto mb-4 sm:mb-6 -mx-2 min-[376px]:-mx-3 sm:-mx-4 pl-2 min-[376px]:pl-3 sm:pl-4">
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
                      <th className="text-center py-1.5 min-[376px]:py-2 pl-1 min-[376px]:pl-2 pr-2 min-[376px]:pr-3 text-[10px] min-[376px]:text-xs font-semibold text-gray-700 dark:text-gray-300 uppercase w-16 min-[376px]:w-20">
                        Вес, кг
                      </th>
                    </tr>
                  </thead>
                  <tbody>
                    {editedExercises.map((item, index) => {
                      return (
                        <SelectedExerciseEditorRow
                          key={`${item.exercise.id}-${index}`}
                          item={item}
                          index={index}
                          onIntegerChange={handleIntegerDraftChange}
                          onWeightChange={handleWeightDraftChange}
                        />
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}

          </div>

          {/* Footer */}
          <div className="px-2 min-[376px]:px-3 sm:px-4 py-2.5 min-[376px]:py-3 sm:py-4 border-t border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900 flex flex-col gap-2 min-[376px]:gap-2.5 sm:gap-3 flex-shrink-0">
            {onAddExercise && (
              <button
                onClick={handleAddExercise}
                className="w-full py-2.5 min-[376px]:py-3 sm:py-3 px-3 min-[376px]:px-4 rounded-lg sm:rounded-xl font-semibold text-[11px] min-[376px]:text-xs sm:text-sm uppercase bg-gray-100 dark:bg-gray-800 text-gray-900 dark:text-white hover:bg-gray-200 dark:hover:bg-gray-700 transition-colors"
              >
                ДОБАВИТЬ УПРАЖНЕНИЕ
              </button>
            )}
            <button
              onClick={handleSave}
              disabled={editedExercises.length === 0 || isSaving}
              className="w-full py-2.5 min-[376px]:py-3 sm:py-3 px-3 min-[376px]:px-4 rounded-lg sm:rounded-xl font-semibold text-[11px] min-[376px]:text-xs sm:text-sm uppercase bg-gray-900 dark:bg-white text-white dark:text-gray-900 hover:bg-gray-800 dark:hover:bg-gray-100 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {isSaving ? 'СОХРАНЕНИЕ...' : 'СОХРАНИТЬ'}
            </button>
          </div>
        </div>
      </div>
    </>
  );
};

export default SelectedExercisesEditor;
