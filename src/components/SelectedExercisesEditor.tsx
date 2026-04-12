import { memo, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { X } from 'lucide-react';
import { Exercise, SelectedExercise, WorkoutMetricType, WorkoutMetricUnit } from '../types/workout';
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
import { updateSelectedExerciseField, updateSelectedExerciseMetricType } from '../utils/workoutEditorState';
import {
  DEFAULT_WORKOUT_METRIC_TYPE,
  WORKOUT_DISTANCE_UNIT_OPTIONS,
  WORKOUT_METRIC_OPTIONS,
  WORKOUT_TIME_UNIT_OPTIONS,
  normalizeWorkoutMetricType,
  normalizeWorkoutMetricUnit,
  normalizeWorkoutMetricValue,
  isWorkoutMetricValueEditable,
  supportsWorkoutMetricUnitSelection,
} from '../utils/workoutEntryMetric';

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
  onMetricTypeChange: (index: number, metricType: WorkoutMetricType) => void;
  onUnitChange: (index: number, metricUnit: WorkoutMetricUnit) => void;
}

type MetricPopupPlacement = {
  left: number;
  top: number;
  directionX: 'left' | 'right';
  directionY: 'up' | 'down';
};

const METRIC_PICKER_WIDTH = 152;
const METRIC_PICKER_ESTIMATED_HEIGHT = 220;
const METRIC_PICKER_MARGIN = 8;
const EDITOR_ROW_TRACK_HEIGHT = 'min-h-[4.35rem] min-[376px]:min-h-[4.6rem]';

function getMetricLabel(metricType: WorkoutMetricType): string {
  switch (metricType) {
    case 'distance':
      return 'Дист';
    case 'bodyweight':
      return 'Свой вес';
    case 'time':
      return 'Время';
    case 'none':
      return 'Без метрики';
    case 'weight':
    default:
      return 'Вес';
  }
}

export function resolveMetricPickerPlacement(
  anchorRect: { left: number; right: number; top: number; bottom: number },
  viewport: { width: number; height: number },
  popupSize: { width: number; height: number },
): MetricPopupPlacement {
  const canOpenRight = anchorRect.left + popupSize.width <= viewport.width - METRIC_PICKER_MARGIN;
  const canOpenDown = anchorRect.bottom + popupSize.height <= viewport.height - METRIC_PICKER_MARGIN;

  const left = canOpenRight
    ? Math.max(METRIC_PICKER_MARGIN, anchorRect.left)
    : Math.max(METRIC_PICKER_MARGIN, anchorRect.right - popupSize.width);
  const top = canOpenDown
    ? Math.max(METRIC_PICKER_MARGIN, anchorRect.bottom + 6)
    : Math.max(METRIC_PICKER_MARGIN, anchorRect.top - popupSize.height - 6);

  return {
    left,
    top,
    directionX: canOpenRight ? 'right' : 'left',
    directionY: canOpenDown ? 'down' : 'up',
  };
}

const SelectedExerciseEditorRow = memo(function SelectedExerciseEditorRow({
  item,
  index,
  onIntegerChange,
  onWeightChange,
  onMetricTypeChange,
  onUnitChange,
}: SelectedExerciseEditorRowProps) {
  const [setsDraft, setSetsDraft] = useState(() => buildWorkoutIntegerDraft(item.sets));
  const [repsDraft, setRepsDraft] = useState(() => buildWorkoutIntegerDraft(item.reps));
  const [weightDraft, setWeightDraft] = useState(() => buildWorkoutWeightDraft(item.weight));
  const [isMetricPickerOpen, setIsMetricPickerOpen] = useState(false);
  const [metricDraft, setMetricDraft] = useState<WorkoutMetricType>(() =>
    normalizeWorkoutMetricType(item.metricType),
  );
  const [isUnitPickerOpen, setIsUnitPickerOpen] = useState(false);
  const [unitDraft, setUnitDraft] = useState<WorkoutMetricUnit>(() =>
    normalizeWorkoutMetricUnit(normalizeWorkoutMetricType(item.metricType), item.metricUnit),
  );
  const metricButtonRef = useRef<HTMLButtonElement | null>(null);
  const metricPopupRef = useRef<HTMLDivElement | null>(null);
  const unitButtonRef = useRef<HTMLButtonElement | null>(null);
  const unitPopupRef = useRef<HTMLDivElement | null>(null);
  const [metricPopupPlacement, setMetricPopupPlacement] = useState<MetricPopupPlacement>({
    left: METRIC_PICKER_MARGIN,
    top: METRIC_PICKER_MARGIN,
    directionX: 'right',
    directionY: 'down',
  });
  const [unitPopupPlacement, setUnitPopupPlacement] = useState<MetricPopupPlacement>({
    left: METRIC_PICKER_MARGIN,
    top: METRIC_PICKER_MARGIN,
    directionX: 'right',
    directionY: 'down',
  });

  useEffect(() => {
    setSetsDraft(buildWorkoutIntegerDraft(item.sets));
  }, [item.sets]);

  useEffect(() => {
    setRepsDraft(buildWorkoutIntegerDraft(item.reps));
  }, [item.reps]);

  useEffect(() => {
    setWeightDraft(buildWorkoutWeightDraft(item.weight));
  }, [item.weight]);

  useEffect(() => {
    setMetricDraft(normalizeWorkoutMetricType(item.metricType));
  }, [item.metricType]);

  useEffect(() => {
    setUnitDraft(normalizeWorkoutMetricUnit(normalizeWorkoutMetricType(item.metricType), item.metricUnit));
  }, [item.metricType, item.metricUnit]);

  useEffect(() => {
    if (!isMetricPickerOpen) return;

    const updatePlacement = () => {
      if (!metricButtonRef.current) return;
      const rect = metricButtonRef.current.getBoundingClientRect();
      setMetricPopupPlacement(
        resolveMetricPickerPlacement(
          rect,
          { width: window.innerWidth, height: window.innerHeight },
          { width: METRIC_PICKER_WIDTH, height: metricPopupRef.current?.offsetHeight ?? METRIC_PICKER_ESTIMATED_HEIGHT },
        ),
      );
    };

    const handleOutsideClick = (event: MouseEvent) => {
      const target = event.target as Node;
      if (metricButtonRef.current?.contains(target)) return;
      if (metricPopupRef.current?.contains(target)) return;
      setIsMetricPickerOpen(false);
    };

    const handleEscape = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        setIsMetricPickerOpen(false);
      }
    };

    updatePlacement();
    window.addEventListener('resize', updatePlacement);
    window.addEventListener('scroll', updatePlacement, true);
    window.addEventListener('mousedown', handleOutsideClick);
    window.addEventListener('keydown', handleEscape);
    return () => {
      window.removeEventListener('resize', updatePlacement);
      window.removeEventListener('scroll', updatePlacement, true);
      window.removeEventListener('mousedown', handleOutsideClick);
      window.removeEventListener('keydown', handleEscape);
    };
  }, [isMetricPickerOpen]);

  useEffect(() => {
    if (!isUnitPickerOpen) return;

    const updatePlacement = () => {
      if (!unitButtonRef.current) return;
      const rect = unitButtonRef.current.getBoundingClientRect();
      setUnitPopupPlacement(
        resolveMetricPickerPlacement(
          rect,
          { width: window.innerWidth, height: window.innerHeight },
          { width: 96, height: unitPopupRef.current?.offsetHeight ?? 160 },
        ),
      );
    };

    const handleOutsideClick = (event: MouseEvent) => {
      const target = event.target as Node;
      if (unitButtonRef.current?.contains(target)) return;
      if (unitPopupRef.current?.contains(target)) return;
      setIsUnitPickerOpen(false);
    };

    const handleEscape = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        setIsUnitPickerOpen(false);
      }
    };

    updatePlacement();
    window.addEventListener('resize', updatePlacement);
    window.addEventListener('scroll', updatePlacement, true);
    window.addEventListener('mousedown', handleOutsideClick);
    window.addEventListener('keydown', handleEscape);
    return () => {
      window.removeEventListener('resize', updatePlacement);
      window.removeEventListener('scroll', updatePlacement, true);
      window.removeEventListener('mousedown', handleOutsideClick);
      window.removeEventListener('keydown', handleEscape);
    };
  }, [isUnitPickerOpen]);

  const primaryMuscle = item.exercise.muscles?.[0]?.name || '';
  const metricType = normalizeWorkoutMetricType(item.metricType);
  const isMetricEditable = isWorkoutMetricValueEditable(metricType);
  const supportsUnitSelector = supportsWorkoutMetricUnitSelection(metricType);
  const unitOptions = metricType === 'time' ? WORKOUT_TIME_UNIT_OPTIONS : WORKOUT_DISTANCE_UNIT_OPTIONS;

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
        <div className={`grid ${EDITOR_ROW_TRACK_HEIGHT} grid-rows-[1fr_auto] items-stretch justify-items-end`}>
          <input
            {...getWorkoutIntegerInputProps()}
            value={setsDraft}
            onChange={(e) => {
              setSetsDraft(sanitizeWorkoutIntegerInput(e.target.value));
              onIntegerChange(index, 'sets', e.target.value);
            }}
            className="self-end w-12 min-[376px]:w-14 px-1.5 min-[376px]:px-2 py-1 min-[376px]:py-1.5 text-center text-[11px] min-[376px]:text-xs sm:text-sm font-medium rounded border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-900 text-gray-900 dark:text-white focus:outline-none focus:ring-1 focus:ring-green-500"
          />
        </div>
      </td>
      <td className="py-2 min-[376px]:py-3 pl-1 min-[376px]:pl-2 pr-2 min-[376px]:pr-3">
        <div className={`grid ${EDITOR_ROW_TRACK_HEIGHT} grid-rows-[1fr_auto] items-stretch justify-items-end`}>
          <input
            {...getWorkoutIntegerInputProps()}
            value={repsDraft}
            onChange={(e) => {
              setRepsDraft(sanitizeWorkoutIntegerInput(e.target.value));
              onIntegerChange(index, 'reps', e.target.value);
            }}
            className="self-end w-12 min-[376px]:w-14 px-1.5 min-[376px]:px-2 py-1 min-[376px]:py-1.5 text-center text-[11px] min-[376px]:text-xs sm:text-sm font-medium rounded border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-900 text-gray-900 dark:text-white focus:outline-none focus:ring-1 focus:ring-green-500"
          />
        </div>
      </td>
      <td className="py-2 min-[376px]:py-3 pl-1 min-[376px]:pl-2 pr-2 min-[376px]:pr-3">
        <div className={`grid ${EDITOR_ROW_TRACK_HEIGHT} grid-rows-[auto_1fr_auto] items-stretch justify-items-center`}>
          <div className="flex w-full max-w-[5.5rem] min-[376px]:max-w-[6.25rem] items-center justify-center gap-1 self-start">
            <button
              ref={metricButtonRef}
              type="button"
              onClick={() => {
                setMetricDraft(metricType);
                setIsMetricPickerOpen((current) => !current);
                setIsUnitPickerOpen(false);
              }}
              className={`${supportsUnitSelector ? 'flex-1 min-w-0' : 'w-full'} rounded-lg border border-green-200 bg-green-50/80 px-2 py-1 text-[10px] font-medium text-green-800 transition-colors hover:bg-green-100 dark:border-green-900/40 dark:bg-green-950/30 dark:text-green-200`}
            >
              <span className="flex items-center justify-center gap-1">
                <span className="truncate">{getMetricLabel(metricType)}</span>
                <span aria-hidden="true" className="shrink-0">▼</span>
              </span>
            </button>
            {supportsUnitSelector ? (
              <button
                ref={unitButtonRef}
                type="button"
                onClick={() => {
                  setUnitDraft(normalizeWorkoutMetricUnit(metricType, item.metricUnit));
                  setIsMetricPickerOpen(false);
                  setIsUnitPickerOpen((current) => !current);
                }}
                className="w-[2.25rem] min-[376px]:w-[2.5rem] shrink-0 rounded-lg border border-green-200 bg-green-50/80 px-1.5 py-1 text-[10px] font-medium text-green-800 transition-colors hover:bg-green-100 dark:border-green-900/40 dark:bg-green-950/30 dark:text-green-200"
              >
                <span className="flex items-center justify-center gap-0.5">
                  <span className="truncate">{normalizeWorkoutMetricUnit(metricType, item.metricUnit)}</span>
                  <span aria-hidden="true" className="shrink-0">▼</span>
                </span>
              </button>
            ) : null}
          </div>
          <div className="flex w-full items-end justify-center self-end">
            <input
              {...getWorkoutWeightInputProps()}
              value={metricType === 'none' ? '0' : weightDraft}
              disabled={!isMetricEditable}
              onChange={(e) => {
                setWeightDraft(sanitizeWorkoutWeightInput(e.target.value));
                onWeightChange(index, e.target.value);
              }}
              className="w-[3.25rem] min-[376px]:w-14 px-1.5 min-[376px]:px-2 py-1 min-[376px]:py-1.5 text-center text-[11px] min-[376px]:text-xs sm:text-sm font-medium rounded border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-900 text-gray-900 dark:text-white focus:outline-none focus:ring-1 focus:ring-green-500 disabled:cursor-not-allowed disabled:bg-gray-100 disabled:text-gray-400 dark:disabled:bg-gray-800"
            />
          </div>
          {isMetricPickerOpen ? (
            <div
              ref={metricPopupRef}
              className="fixed z-[70] max-w-[calc(100vw-16px)] rounded-lg border border-gray-200 bg-white p-2.5 shadow-xl dark:border-gray-700 dark:bg-gray-900"
              style={{
                left: metricPopupPlacement.left,
                top: metricPopupPlacement.top,
                width: METRIC_PICKER_WIDTH,
              }}
            >
              <div className="space-y-1.5">
                {WORKOUT_METRIC_OPTIONS.map((option) => {
                  const checked = metricDraft === option.value;
                  return (
                    <button
                      key={option.value}
                      type="button"
                      onClick={() => setMetricDraft(option.value)}
                      className="flex w-full items-center justify-between rounded-md px-1 py-1 text-left text-[11px] text-gray-700 hover:bg-gray-50 dark:text-gray-200 dark:hover:bg-gray-800"
                    >
                      <span>{getMetricLabel(option.value)}</span>
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
                  className="text-[10px] font-semibold uppercase tracking-wide text-gray-500"
                >
                  Отменить
                </button>
                <button
                  type="button"
                  onClick={() => {
                    onMetricTypeChange(index, metricDraft);
                    setIsMetricPickerOpen(false);
                    setIsUnitPickerOpen(false);
                  }}
                  className="text-[10px] font-semibold uppercase tracking-wide text-green-600"
                >
                  ОК
                </button>
              </div>
            </div>
          ) : null}
          {supportsUnitSelector && isUnitPickerOpen ? (
            <div
              ref={unitPopupRef}
              className="fixed z-[70] w-24 max-w-[calc(100vw-16px)] rounded-lg border border-gray-200 bg-white p-2 shadow-xl dark:border-gray-700 dark:bg-gray-900"
              style={{
                left: unitPopupPlacement.left,
                top: unitPopupPlacement.top,
              }}
            >
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
                    setUnitDraft(normalizeWorkoutMetricUnit(metricType, item.metricUnit));
                    setIsUnitPickerOpen(false);
                  }}
                  className="text-[10px] font-semibold uppercase tracking-wide text-gray-500"
                >
                  Отмена
                </button>
                <button
                  type="button"
                  onClick={() => {
                    onUnitChange(index, unitDraft);
                    setIsUnitPickerOpen(false);
                  }}
                  className="text-[10px] font-semibold uppercase tracking-wide text-green-600"
                >
                  ОК
                </button>
              </div>
            </div>
          ) : null}
        </div>
      </td>
    </tr>
  );
});

const createDefaultSelectedExercise = (exercise: Exercise): SelectedExercise => ({
  exercise,
  metricType: DEFAULT_WORKOUT_METRIC_TYPE,
  metricUnit: normalizeWorkoutMetricUnit(DEFAULT_WORKOUT_METRIC_TYPE, null),
  sets: 3,
  reps: 12,
  weight: 20,
});

const buildInitialEditedExercises = (
  exercises: Exercise[],
  initialSelectedExercises?: SelectedExercise[],
): SelectedExercise[] => {
  if (initialSelectedExercises && initialSelectedExercises.length > 0) {
    return initialSelectedExercises.map((item) => ({
      ...item,
      metricType: normalizeWorkoutMetricType(item.metricType),
      metricUnit: normalizeWorkoutMetricUnit(normalizeWorkoutMetricType(item.metricType), item.metricUnit),
      weight: normalizeWorkoutMetricValue(normalizeWorkoutMetricType(item.metricType), item.weight),
    }));
  }

  if (exercises.length > 0) {
    return exercises.map(createDefaultSelectedExercise);
  }

  return [];
};

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
  const [editedExercises, setEditedExercises] = useState<SelectedExercise[]>(() =>
    buildInitialEditedExercises(exercises, initialSelectedExercises),
  );
  const previousExercisesRef = useRef<Exercise[]>(
    initialSelectedExercises && initialSelectedExercises.length > 0
      ? initialSelectedExercises.map((item) => item.exercise)
      : exercises,
  );
  const isInitializedRef = useRef(
    (initialSelectedExercises?.length ?? 0) > 0 || exercises.length > 0,
  );

  useEffect(() => {
    if (isOpen) {
      document.body.style.overflow = 'hidden';
    } else {
      document.body.style.overflow = '';
      isInitializedRef.current = false;
      previousExercisesRef.current = [];
      setEditedExercises([]);
    }
    return () => {
      document.body.style.overflow = '';
    };
  }, [isOpen]);

  useEffect(() => {
    if (!isOpen) return;

    if (!isInitializedRef.current && initialSelectedExercises && initialSelectedExercises.length > 0) {
      setEditedExercises(buildInitialEditedExercises([], initialSelectedExercises));
      isInitializedRef.current = true;
      previousExercisesRef.current = initialSelectedExercises.map((item) => item.exercise);
    } else if (!isInitializedRef.current && exercises.length > 0) {
      setEditedExercises(buildInitialEditedExercises(exercises));
      isInitializedRef.current = true;
      previousExercisesRef.current = exercises;
    } else if (isInitializedRef.current && exercises.length > 0) {
      const previousIds = new Set(previousExercisesRef.current.map((ex) => ex.id));
      const newExercises = exercises.filter((ex) => !previousIds.has(ex.id));

      if (newExercises.length > 0) {
        setEditedExercises((prev) => [...prev, ...newExercises.map(createDefaultSelectedExercise)]);
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
    setEditedExercises((current) => {
      const metricType = normalizeWorkoutMetricType(current[index]?.metricType);
      return updateSelectedExerciseField(current, index, 'weight', normalizeWorkoutMetricValue(metricType, parseWorkoutWeightInput(rawValue)));
    });
  }, []);

  const handleUnitChange = useCallback((index: number, metricUnit: WorkoutMetricUnit) => {
    setEditedExercises((current) => {
      const metricType = normalizeWorkoutMetricType(current[index]?.metricType);
      return updateSelectedExerciseField(
        current,
        index,
        'metricUnit',
        normalizeWorkoutMetricUnit(metricType, metricUnit),
      );
    });
  }, []);

  const handleMetricTypeChange = useCallback((index: number, metricType: WorkoutMetricType) => {
    setEditedExercises((current) => updateSelectedExerciseMetricType(current, index, metricType));
  }, []);

  const handleSave = () => {
    if (isSaving) return;
    onSave(editedExercises.map((item) => ({
      ...item,
      metricType: normalizeWorkoutMetricType(item.metricType),
      metricUnit: normalizeWorkoutMetricUnit(normalizeWorkoutMetricType(item.metricType), item.metricUnit),
      weight: normalizeWorkoutMetricValue(normalizeWorkoutMetricType(item.metricType), item.weight),
    })));
  };

  if (!isOpen) return null;

  return (
    <>
      <div
        className="fixed inset-0 bg-black bg-opacity-50 z-[50] transition-opacity"
        onClick={onClose}
      />

      <div className="fixed inset-0 z-[50] flex items-center justify-center p-1 min-[376px]:p-2 sm:p-4">
        <div
          className="bg-white dark:bg-gray-900 rounded-lg sm:rounded-xl shadow-2xl w-full max-w-2xl h-[min(92dvh,42rem)] min-h-[26rem] overflow-hidden flex flex-col min-w-[320px]"
          onClick={(e) => e.stopPropagation()}
        >
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

          <div className="flex-1 min-h-0 overflow-hidden px-2 min-[376px]:px-3 sm:px-4 py-2 min-[376px]:py-3 sm:py-4">
            {editedExercises.length === 0 ? (
              <div className="flex h-full min-h-[12rem] items-center justify-center py-8 sm:py-12 text-center">
                <p className="text-xs sm:text-sm text-gray-500 dark:text-gray-400">
                  Нет упражнений для настройки
                </p>
              </div>
            ) : (
              <div className="h-full min-h-[14rem] overflow-y-auto overflow-x-hidden overscroll-contain pr-1">
                <div className="-mx-2 min-[376px]:-mx-3 sm:-mx-4 pl-2 min-[376px]:pl-3 sm:pl-4 pr-2 min-[376px]:pr-3 sm:pr-4 pb-3">
                  <table className="w-full min-w-[320px] border-collapse table-fixed">
                  <thead>
                    <tr className="border-b border-gray-200 dark:border-gray-700">
                      <th className="w-auto text-left py-1.5 min-[376px]:py-2 px-1 min-[376px]:px-2 text-[10px] min-[376px]:text-xs font-semibold text-gray-700 dark:text-gray-300 uppercase">
                        <span className="hidden min-[376px]:inline">Название упражнения</span>
                        <span className="min-[376px]:hidden">Упражнение</span>
                      </th>
                      <th className="text-right py-1.5 min-[376px]:py-2 pl-1 min-[376px]:pl-2 pr-2 min-[376px]:pr-3 text-[10px] min-[376px]:text-xs font-semibold text-gray-700 dark:text-gray-300 uppercase w-16 min-[376px]:w-20">
                        Подходы
                      </th>
                      <th className="text-right py-1.5 min-[376px]:py-2 pl-1 min-[376px]:pl-2 pr-2 min-[376px]:pr-3 text-[10px] min-[376px]:text-xs font-semibold text-gray-700 dark:text-gray-300 uppercase w-16 min-[376px]:w-20">
                        Повторы
                      </th>
                      <th className="text-center py-1.5 min-[376px]:py-2 pl-1 min-[376px]:pl-2 pr-2 min-[376px]:pr-3 text-[10px] min-[376px]:text-xs font-semibold text-gray-700 dark:text-gray-300 uppercase w-20 min-[376px]:w-24">
                        Метрика
                      </th>
                    </tr>
                  </thead>
                  <tbody>
                    {editedExercises.map((item, index) => (
                      <SelectedExerciseEditorRow
                        key={`${item.exercise.id}-${index}`}
                        item={item}
                        index={index}
                        onIntegerChange={handleIntegerDraftChange}
                        onWeightChange={handleWeightDraftChange}
                        onMetricTypeChange={handleMetricTypeChange}
                        onUnitChange={handleUnitChange}
                      />
                    ))}
                  </tbody>
                </table>
                </div>
              </div>
            )}
          </div>

          <div className="px-2 min-[376px]:px-3 sm:px-4 py-2.5 min-[376px]:py-3 sm:py-4 border-t border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900 flex flex-col gap-2 min-[376px]:gap-2.5 sm:gap-3 flex-shrink-0">
            {onAddExercise && (
              <button
                onClick={onAddExercise}
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
