import { useEffect, useMemo, useRef, useState } from 'react';
import { X } from 'lucide-react';

import type { WorkoutEntry } from '../types/workout';
import { submitModalAction } from '../utils/asyncModalSubmit';
import { buildRepeatWorkoutOptions, getDefaultRepeatTargetDate } from '../utils/repeatWorkoutFlow';

interface RepeatWorkoutModalProps {
  isOpen: boolean;
  sourceDate: string;
  entries: WorkoutEntry[];
  isSubmitting?: boolean;
  onClose: () => void;
  onConfirm: (targetDate: string, exerciseIds: string[]) => Promise<void>;
}

const RepeatWorkoutModal = ({
  isOpen,
  sourceDate,
  entries,
  isSubmitting = false,
  onClose,
  onConfirm,
}: RepeatWorkoutModalProps) => {
  const options = useMemo(() => buildRepeatWorkoutOptions(entries), [entries]);
  const [targetDate, setTargetDate] = useState(() => getDefaultRepeatTargetDate());
  const [selectedExerciseIds, setSelectedExerciseIds] = useState<Set<string>>(new Set());
  const submitLockRef = useRef({ current: false });

  useEffect(() => {
    if (!isOpen) return;
    setTargetDate(getDefaultRepeatTargetDate());
    setSelectedExerciseIds(new Set(options.map((item) => item.exerciseId)));
  }, [isOpen, options]);

  if (!isOpen) return null;

  const handleToggleExercise = (exerciseId: string) => {
    if (isSubmitting) return;
    setSelectedExerciseIds((current) => {
      const next = new Set(current);
      if (next.has(exerciseId)) {
        next.delete(exerciseId);
      } else {
        next.add(exerciseId);
      }
      return next;
    });
  };

  const handleConfirm = async () => {
    if (selectedExerciseIds.size === 0) return;

    await submitModalAction(
      submitLockRef.current,
      async () => {
        await onConfirm(targetDate, Array.from(selectedExerciseIds));
      },
      onClose,
    );
  };

  return (
    <div className="fixed inset-0 z-[60] flex items-end justify-center bg-black/50">
      <div className="max-h-[90vh] w-full max-w-md overflow-y-auto rounded-t-2xl bg-white dark:bg-gray-900">
        <div className="flex items-center justify-between border-b border-gray-200 p-4 dark:border-gray-700">
          <div>
            <h2 className="text-base font-semibold uppercase text-gray-900 dark:text-white">
              Повторить тренировку
            </h2>
            <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">
              Источник: {sourceDate}
            </p>
          </div>
          <button
            type="button"
            onClick={() => {
              if (!isSubmitting) onClose();
            }}
            className="rounded-lg p-2 transition-colors hover:bg-gray-100 dark:hover:bg-gray-800"
            aria-label="Закрыть повтор тренировки"
          >
            <X className="h-5 w-5 text-gray-600 dark:text-gray-400" />
          </button>
        </div>

        <div className="space-y-5 p-4">
          <div>
            <label className="mb-2 block text-sm font-medium text-gray-700 dark:text-gray-300">
              Целевая дата
            </label>
            <input
              type="date"
              value={targetDate}
              min={getDefaultRepeatTargetDate()}
              onChange={(event) => setTargetDate(event.target.value)}
              className="w-full rounded-lg border border-gray-300 bg-white px-4 py-2 text-sm text-gray-900 focus:border-transparent focus:ring-2 focus:ring-green-500 dark:border-gray-600 dark:bg-gray-800 dark:text-white"
            />
            <p className="mt-2 text-xs text-gray-500 dark:text-gray-400">
              Выбранные упражнения будут добавлены к тренировке на эту дату. Существующие записи не заменяются.
            </p>
          </div>

          <div>
            <div className="mb-2 block text-sm font-medium text-gray-700 dark:text-gray-300">
              Что повторить
            </div>
            <div className="space-y-2">
              {options.map((item) => {
                const checked = selectedExerciseIds.has(item.exerciseId);
                return (
                  <label
                    key={item.exerciseId}
                    className="flex items-start gap-3 rounded-lg border border-gray-200 p-3 transition-colors hover:bg-gray-50 dark:border-gray-700 dark:hover:bg-gray-800"
                  >
                    <input
                      type="checkbox"
                      checked={checked}
                      onChange={() => handleToggleExercise(item.exerciseId)}
                      className="mt-1 h-4 w-4 accent-green-600"
                    />
                    <div className="min-w-0 flex-1">
                      <div className="text-sm font-medium text-gray-900 dark:text-white">
                        {item.exerciseName}
                      </div>
                      <div className="mt-1 text-xs text-gray-500 dark:text-gray-400">
                        {item.sets} x {item.reps} x {item.weight} кг
                      </div>
                    </div>
                  </label>
                );
              })}
            </div>
          </div>
        </div>

        <div className="flex gap-3 border-t border-gray-200 p-4 dark:border-gray-700">
          <button
            type="button"
            onClick={() => {
              if (!isSubmitting) onClose();
            }}
            disabled={isSubmitting}
            className="flex-1 rounded-lg border border-gray-300 bg-white px-4 py-3 text-sm font-medium text-gray-900 transition-colors hover:bg-gray-50 disabled:opacity-50 dark:border-gray-600 dark:bg-gray-800 dark:text-white dark:hover:bg-gray-700"
          >
            Отмена
          </button>
          <button
            type="button"
            onClick={() => void handleConfirm()}
            disabled={isSubmitting || selectedExerciseIds.size === 0}
            className="flex-1 rounded-lg bg-green-600 px-4 py-3 text-sm font-semibold text-white transition-colors hover:bg-green-700 disabled:opacity-50"
          >
            {isSubmitting ? 'Повторяем...' : 'Повторить'}
          </button>
        </div>
      </div>
    </div>
  );
};

export default RepeatWorkoutModal;
