import { useEffect, useMemo, useState } from 'react';
import { X } from 'lucide-react';
import type { WorkoutEntry, WorkoutMetricType, WorkoutMetricUnit } from '../types/workout';
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
import {
  WORKOUT_METRIC_OPTIONS,
  WORKOUT_DISTANCE_UNIT_OPTIONS,
  WORKOUT_TIME_UNIT_OPTIONS,
  getWorkoutMetricLabel,
  getWorkoutMetricUnit,
  isWorkoutMetricValueEditable,
  normalizeWorkoutMetricType,
  normalizeWorkoutMetricUnit,
  normalizeWorkoutMetricValue,
  supportsWorkoutMetricUnitSelection,
} from '../utils/workoutEntryMetric';

interface EditWorkoutEntryModalProps {
  isOpen: boolean;
  entry: WorkoutEntry | null;
  isSaving?: boolean;
  onClose: () => void;
  onSave: (updates: { sets: number; reps: number; weight: number; metricType: WorkoutMetricType; metricUnit?: WorkoutMetricUnit }) => Promise<void> | void;
}

const EditWorkoutEntryModal = ({ isOpen, entry, isSaving = false, onClose, onSave }: EditWorkoutEntryModalProps) => {
  const [sets, setSets] = useState('0');
  const [reps, setReps] = useState('0');
  const [weight, setWeight] = useState('0');
  const [metricType, setMetricType] = useState<WorkoutMetricType>('weight');
  const [metricUnit, setMetricUnit] = useState<WorkoutMetricUnit>('кг');
  const [metricDraft, setMetricDraft] = useState<WorkoutMetricType>('weight');
  const [isMetricPickerOpen, setIsMetricPickerOpen] = useState(false);
  const [unitDraft, setUnitDraft] = useState<WorkoutMetricUnit>('кг');
  const [isUnitPickerOpen, setIsUnitPickerOpen] = useState(false);

  useEffect(() => {
    if (!isOpen || !entry) return;
    const nextMetricType = normalizeWorkoutMetricType(entry.metricType);
    setSets(buildWorkoutIntegerDraft(entry.sets));
    setReps(buildWorkoutIntegerDraft(entry.reps));
    setWeight(buildWorkoutWeightDraft(normalizeWorkoutMetricValue(nextMetricType, entry.displayAmount ?? entry.weight)));
    setMetricType(nextMetricType);
    setMetricUnit(normalizeWorkoutMetricUnit(nextMetricType, entry.metricUnit ?? entry.displayUnit));
    setMetricDraft(nextMetricType);
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
      weight: normalizeWorkoutMetricValue(metricType, parseWorkoutWeightInput(weight)),
      metricType,
      metricUnit: normalizeWorkoutMetricUnit(metricType, metricUnit),
    }),
    [sets, reps, weight, metricType, metricUnit],
  );

  const canSave = entry && parsed.sets > 0 && parsed.reps >= 0 && parsed.weight >= 0 && !isSaving;

  const supportsUnitSelector = supportsWorkoutMetricUnitSelection(metricType);
  const unitOptions = metricType === 'time' ? WORKOUT_TIME_UNIT_OPTIONS : WORKOUT_DISTANCE_UNIT_OPTIONS;

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

            <div className="relative block">
              <div className="mb-1 flex items-center justify-between gap-3">
                <span className="block text-xs font-medium uppercase text-gray-600 dark:text-gray-300">
                  {getWorkoutMetricLabel(metricType)}{getWorkoutMetricUnit(metricType, metricUnit) ? `, ${getWorkoutMetricUnit(metricType, metricUnit)}` : ''}
                </span>
                <button
                  type="button"
                  onClick={() => {
                    setMetricDraft(metricType);
                    setIsMetricPickerOpen((current) => !current);
                  }}
                  className="rounded-lg border border-gray-300 px-3 py-1 text-xs font-semibold uppercase text-gray-700 transition-colors hover:bg-gray-100 dark:border-gray-700 dark:text-gray-200 dark:hover:bg-gray-800"
                >
                  {getWorkoutMetricLabel(metricType)} ▼
                </button>
              </div>
              {supportsUnitSelector ? (
                <div className="mb-2 flex items-center justify-end">
                  <button
                    type="button"
                    onClick={() => {
                      setUnitDraft(normalizeWorkoutMetricUnit(metricType, metricUnit));
                      setIsUnitPickerOpen((current) => !current);
                    }}
                    className="rounded-lg border border-green-200 bg-green-50/80 px-3 py-1 text-[11px] font-semibold text-green-800 transition-colors hover:bg-green-100 dark:border-green-900/40 dark:bg-green-950/30 dark:text-green-200"
                  >
                    {normalizeWorkoutMetricUnit(metricType, metricUnit)} ▼
                  </button>
                </div>
              ) : null}
              <input
                {...getWorkoutWeightInputProps()}
                value={metricType === 'none' ? '0' : weight}
                disabled={isSaving || !isWorkoutMetricValueEditable(metricType)}
                onChange={(event) => setWeight(sanitizeWorkoutWeightInput(event.target.value))}
                className="w-full rounded-xl border border-gray-300 px-3 py-2 text-sm text-gray-900 outline-none focus:border-green-500 disabled:cursor-not-allowed disabled:bg-gray-100 disabled:text-gray-400 dark:border-gray-700 dark:bg-gray-950 dark:text-white dark:disabled:bg-gray-800"
              />
              {isMetricPickerOpen ? (
                <div className="absolute right-0 top-full z-20 mt-2 w-40 max-w-[calc(100vw-2rem)] rounded-lg border border-gray-200 bg-white p-2.5 shadow-xl dark:border-gray-700 dark:bg-gray-900">
                  <div className="space-y-1.5">
                    {WORKOUT_METRIC_OPTIONS.map((option) => {
                      const checked = metricDraft === option.value;
                      return (
                        <button
                          key={option.value}
                          type="button"
                          onClick={() => setMetricDraft(option.value)}
                          className="flex w-full items-center justify-between rounded-md px-1 py-1 text-left text-xs text-gray-700 hover:bg-gray-50 dark:text-gray-200 dark:hover:bg-gray-800"
                        >
                          <span>{option.label}</span>
                          <span className={`h-3.5 w-3.5 rounded-full border ${checked ? 'border-green-500 bg-green-500' : 'border-gray-400'}`} />
                        </button>
                      );
                    })}
                  </div>
                  <div className="mt-2.5 flex items-center justify-between gap-2 border-t border-gray-100 pt-2 dark:border-gray-800">
                    <button
                      type="button"
                      onClick={() => {
                        setMetricDraft(metricType);
                        setIsMetricPickerOpen(false);
                      }}
                      className="text-[11px] font-semibold uppercase text-gray-500"
                    >
                      Отменить
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        setMetricType(metricDraft);
                        setMetricUnit(normalizeWorkoutMetricUnit(metricDraft, metricUnit));
                        setIsUnitPickerOpen(false);
                        if (metricDraft === 'none') {
                          setWeight('0');
                        }
                        setIsMetricPickerOpen(false);
                      }}
                      className="text-[11px] font-semibold uppercase text-green-600"
                    >
                      ОК
                    </button>
                  </div>
                </div>
              ) : null}
              {supportsUnitSelector && isUnitPickerOpen ? (
                <div className="absolute left-0 top-full z-20 mt-2 w-24 max-w-[calc(100vw-2rem)] rounded-lg border border-gray-200 bg-white p-2 shadow-xl dark:border-gray-700 dark:bg-gray-900">
                  <div className="space-y-1.5">
                    {unitOptions.map((option) => {
                      const checked = unitDraft === option.value;
                      return (
                        <button
                          key={String(option.value)}
                          type="button"
                          onClick={() => setUnitDraft(option.value)}
                          className="flex w-full items-center justify-between rounded-md px-1 py-1 text-left text-[11px] text-gray-700 hover:bg-gray-50 dark:text-gray-200 dark:hover:bg-gray-800"
                        >
                          <span>{option.label}</span>
                          <span className={`h-3.5 w-3.5 rounded-full border ${checked ? 'border-green-500 bg-green-500' : 'border-gray-400'}`} />
                        </button>
                      );
                    })}
                  </div>
                  <div className="mt-2 flex items-center justify-between gap-2 border-t border-gray-100 pt-2 dark:border-gray-800">
                    <button
                      type="button"
                      onClick={() => {
                        setUnitDraft(normalizeWorkoutMetricUnit(metricType, metricUnit));
                        setIsUnitPickerOpen(false);
                      }}
                      className="text-[10px] font-semibold uppercase text-gray-500"
                    >
                      Отмена
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        setMetricUnit(unitDraft);
                        setIsUnitPickerOpen(false);
                      }}
                      className="text-[10px] font-semibold uppercase text-green-600"
                    >
                      ОК
                    </button>
                  </div>
                </div>
              ) : null}
            </div>
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
