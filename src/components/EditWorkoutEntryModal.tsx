import { useEffect, useMemo, useState } from 'react';
import { X } from 'lucide-react';
import type { WorkoutEntry } from '../types/workout';
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

interface EditWorkoutEntryModalProps {
  isOpen: boolean;
  entry: WorkoutEntry | null;
  isSaving?: boolean;
  onClose: () => void;
  onSave: (updates: { sets: number; reps: number; weight: number }) => Promise<void> | void;
}

const EditWorkoutEntryModal = ({ isOpen, entry, isSaving = false, onClose, onSave }: EditWorkoutEntryModalProps) => {
  const [sets, setSets] = useState('0');
  const [reps, setReps] = useState('0');
  const [weight, setWeight] = useState('0');

  useEffect(() => {
    if (!isOpen || !entry) return;
    setSets(buildWorkoutIntegerDraft(entry.sets));
    setReps(buildWorkoutIntegerDraft(entry.reps));
    setWeight(buildWorkoutWeightDraft(entry.displayAmount ?? entry.weight));
  }, [isOpen, entry]);

  useEffect(() => {
    if (!isOpen) return;
    document.body.style.overflow = 'hidden';
    return () => {
      document.body.style.overflow = '';
    };
  }, [isOpen]);

  const parsed = useMemo(
    () => ({
      sets: parseWorkoutIntegerInput(sets),
      reps: parseWorkoutIntegerInput(reps),
      weight: parseWorkoutWeightInput(weight),
    }),
    [sets, reps, weight],
  );

  const canSave = entry && parsed.sets > 0 && parsed.reps >= 0 && parsed.weight >= 0 && !isSaving;

  const handleSubmit = async () => {
    if (!canSave) return;
    await onSave(parsed);
  };

  if (!isOpen || !entry) return null;

  return (
    <>
      <div className="fixed inset-0 z-[60] bg-black/50" onClick={isSaving ? undefined : onClose} />
      <div className="fixed inset-0 z-[60] flex items-center justify-center p-4">
        <div
          className="w-full max-w-md rounded-2xl bg-white shadow-2xl dark:bg-gray-900"
          onClick={(event) => event.stopPropagation()}
        >
          <div className="flex items-center justify-between border-b border-gray-200 px-4 py-3 dark:border-gray-700">
            <div>
              <h2 className="text-sm font-semibold uppercase text-gray-900 dark:text-white">Редактировать упражнение</h2>
              <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">{entry.exercise?.name || 'Упражнение'}</p>
            </div>
            <button
              onClick={onClose}
              disabled={isSaving}
              className="rounded-lg p-2 transition-colors hover:bg-gray-100 disabled:cursor-not-allowed disabled:opacity-50 dark:hover:bg-gray-800"
              aria-label="Закрыть"
            >
              <X className="h-5 w-5 text-gray-600 dark:text-gray-300" />
            </button>
          </div>

          <div className="space-y-4 px-4 py-4">
            <label className="block">
              <span className="mb-1 block text-xs font-medium uppercase text-gray-600 dark:text-gray-300">Подходы</span>
              <input
                {...getWorkoutIntegerInputProps()}
                value={sets}
                disabled={isSaving}
                onChange={(event) => setSets(sanitizeWorkoutIntegerInput(event.target.value))}
                className="w-full rounded-xl border border-gray-300 px-3 py-2 text-sm text-gray-900 outline-none focus:border-green-500 dark:border-gray-700 dark:bg-gray-950 dark:text-white"
              />
            </label>

            <label className="block">
              <span className="mb-1 block text-xs font-medium uppercase text-gray-600 dark:text-gray-300">Повторы</span>
              <input
                {...getWorkoutIntegerInputProps()}
                value={reps}
                disabled={isSaving}
                onChange={(event) => setReps(sanitizeWorkoutIntegerInput(event.target.value))}
                className="w-full rounded-xl border border-gray-300 px-3 py-2 text-sm text-gray-900 outline-none focus:border-green-500 dark:border-gray-700 dark:bg-gray-950 dark:text-white"
              />
            </label>

            <label className="block">
              <span className="mb-1 block text-xs font-medium uppercase text-gray-600 dark:text-gray-300">Вес, кг</span>
              <input
                {...getWorkoutWeightInputProps()}
                value={weight}
                disabled={isSaving}
                onChange={(event) => setWeight(sanitizeWorkoutWeightInput(event.target.value))}
                className="w-full rounded-xl border border-gray-300 px-3 py-2 text-sm text-gray-900 outline-none focus:border-green-500 dark:border-gray-700 dark:bg-gray-950 dark:text-white"
              />
            </label>
          </div>

          <div className="flex gap-3 border-t border-gray-200 px-4 py-3 dark:border-gray-700">
            <button
              onClick={onClose}
              disabled={isSaving}
              className="flex-1 rounded-xl border border-gray-300 px-4 py-2 text-sm font-semibold uppercase text-gray-700 transition-colors hover:bg-gray-100 disabled:cursor-not-allowed disabled:opacity-50 dark:border-gray-700 dark:text-gray-200 dark:hover:bg-gray-800"
            >
              Отмена
            </button>
            <button
              onClick={() => void handleSubmit()}
              disabled={!canSave}
              className="flex-1 rounded-xl bg-gray-900 px-4 py-2 text-sm font-semibold uppercase text-white transition-colors hover:bg-gray-800 disabled:cursor-not-allowed disabled:opacity-50 dark:bg-white dark:text-gray-900 dark:hover:bg-gray-100"
            >
              {isSaving ? 'Сохранение...' : 'Сохранить'}
            </button>
          </div>
        </div>
      </div>
    </>
  );
};

export default EditWorkoutEntryModal;
