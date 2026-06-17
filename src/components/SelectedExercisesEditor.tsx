import { memo, useCallback, useEffect, useRef, useState } from 'react';
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
const EDITOR_ROW_TRACK_HEIGHT = 'min-h-[4rem] min-[376px]:min-h-[4.3rem]';
const EDITOR_ROW_GRID_CLASS = 'hidden sm:grid grid-cols-[28px_minmax(0,1fr)_56px_60px_68px] min-[376px]:grid-cols-[28px_minmax(0,1fr)_56px_60px_68px] sm:grid-cols-[1.75rem_minmax(0,1fr)_5rem_5rem_6.5rem]';
const MOBILE_NUMBER_INPUT_CLASS_NAME = 'h-9 min-h-9 w-full rounded-lg border border-gray-300 bg-white px-1.5 py-0 text-center text-sm font-medium leading-none text-gray-900 focus:outline-none focus:ring-1 focus:ring-green-500 dark:border-gray-600 dark:bg-gray-900 dark:text-white';

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
  const desktopMetricButtonRef = useRef<HTMLButtonElement | null>(null);
  const mobileMetricButtonRef = useRef<HTMLButtonElement | null>(null);
  const metricPopupRef = useRef<HTMLDivElement | null>(null);
  const desktopUnitButtonRef = useRef<HTMLButtonElement | null>(null);
  const mobileUnitButtonRef = useRef<HTMLButtonElement | null>(null);
  const unitPopupRef = useRef<HTMLDivElement | null>(null);
  const activeMetricAnchorRef = useRef<HTMLButtonElement | null>(null);
  const activeUnitAnchorRef = useRef<HTMLButtonElement | null>(null);
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
      const anchor =
        activeMetricAnchorRef.current ??
        mobileMetricButtonRef.current ??
        desktopMetricButtonRef.current;
      if (!anchor) return;
      const rect = anchor.getBoundingClientRect();
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
      if (mobileMetricButtonRef.current?.contains(target)) return;
      if (desktopMetricButtonRef.current?.contains(target)) return;
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
      const anchor =
        activeUnitAnchorRef.current ??
        mobileUnitButtonRef.current ??
        desktopUnitButtonRef.current;
      if (!anchor) return;
      const rect = anchor.getBoundingClientRect();
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
      if (mobileUnitButtonRef.current?.contains(target)) return;
      if (desktopUnitButtonRef.current?.contains(target)) return;
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
  const isMobileMetricMenu = isMetricPickerOpen && activeMetricAnchorRef.current === mobileMetricButtonRef.current;
  const isMobileUnitMenu = isUnitPickerOpen && activeUnitAnchorRef.current === mobileUnitButtonRef.current;
  const isDesktopMetricMenu = isMetricPickerOpen && !isMobileMetricMenu;
  const isDesktopUnitMenu = isUnitPickerOpen && !isMobileUnitMenu;
  const exerciseNameBlock = (
    <div className="min-w-0">
      <div className="text-[13px] font-medium leading-tight text-gray-900 break-words whitespace-normal [overflow-wrap:break-word] dark:text-white sm:text-[11px] min-[376px]:sm:text-xs sm:font-medium sm:leading-4 sm:[overflow-wrap:anywhere]">
        {item.exercise.name}
      </div>
      {primaryMuscle && (
        <div className="mt-1 text-[10px] leading-4 text-gray-500 break-words whitespace-normal [overflow-wrap:break-word] dark:text-gray-400 sm:mt-0.5 sm:text-[10px] min-[376px]:sm:text-xs sm:leading-4 sm:[overflow-wrap:anywhere]">
          {primaryMuscle}
        </div>
      )}
    </div>
  );

  const setsControl = (
    <div className={`grid ${EDITOR_ROW_TRACK_HEIGHT} grid-rows-[1fr_auto] items-stretch justify-items-center`}>
      <input
        {...getWorkoutIntegerInputProps()}
        value={setsDraft}
        onChange={(e) => {
          setSetsDraft(sanitizeWorkoutIntegerInput(e.target.value));
          onIntegerChange(index, 'sets', e.target.value);
        }}
        className="self-end h-10 w-full rounded-lg border border-gray-300 bg-white px-1.5 py-1.5 text-center text-sm font-medium text-gray-900 focus:outline-none focus:ring-1 focus:ring-green-500 dark:border-gray-600 dark:bg-gray-900 dark:text-white sm:h-auto sm:w-12 sm:rounded sm:px-1.5 sm:py-1 sm:text-[11px] min-[376px]:sm:w-14 min-[376px]:sm:px-2 min-[376px]:sm:py-1.5 min-[376px]:sm:text-xs"
      />
    </div>
  );

  const repsControl = (
    <div className={`grid ${EDITOR_ROW_TRACK_HEIGHT} grid-rows-[1fr_auto] items-stretch justify-items-center`}>
      <input
        {...getWorkoutIntegerInputProps()}
        value={repsDraft}
        onChange={(e) => {
          setRepsDraft(sanitizeWorkoutIntegerInput(e.target.value));
          onIntegerChange(index, 'reps', e.target.value);
        }}
        className="self-end h-10 w-full rounded-lg border border-gray-300 bg-white px-1.5 py-1.5 text-center text-sm font-medium text-gray-900 focus:outline-none focus:ring-1 focus:ring-green-500 dark:border-gray-600 dark:bg-gray-900 dark:text-white sm:h-auto sm:w-12 sm:rounded sm:px-1.5 sm:py-1 sm:text-[11px] min-[376px]:sm:w-14 min-[376px]:sm:px-2 min-[376px]:sm:py-1.5 min-[376px]:sm:text-xs"
      />
    </div>
  );

  const metricControl = (
    <div className={`grid ${EDITOR_ROW_TRACK_HEIGHT} grid-rows-[auto_1fr_auto] items-stretch justify-items-center`}>
      <div className="flex w-full max-w-[4.25rem] items-center justify-center gap-1 self-start sm:max-w-[5.5rem] min-[376px]:sm:max-w-[6.25rem] sm:gap-1">
        <button
          ref={desktopMetricButtonRef}
          type="button"
          onClick={(e) => {
            activeMetricAnchorRef.current = e.currentTarget;
            setMetricDraft(metricType);
            setIsMetricPickerOpen((current) => !current);
            setIsUnitPickerOpen(false);
          }}
          className={`${supportsUnitSelector ? 'flex-1 min-w-0' : 'w-full'} h-[34px] rounded-md border border-green-200 bg-green-50/80 px-1 py-0.5 text-[9px] font-medium leading-none text-green-800 transition-colors hover:bg-green-100 dark:border-green-900/40 dark:bg-green-950/30 dark:text-green-200 sm:h-auto sm:rounded-lg sm:px-2 sm:py-1 sm:text-[10px]`}
        >
          <span className="flex items-center justify-center gap-1">
            <span className="truncate">{getMetricLabel(metricType)}</span>
            <span aria-hidden="true" className="shrink-0">▼</span>
          </span>
        </button>
        {supportsUnitSelector ? (
          <button
            ref={desktopUnitButtonRef}
            type="button"
            onClick={(e) => {
              activeUnitAnchorRef.current = e.currentTarget;
              setUnitDraft(normalizeWorkoutMetricUnit(metricType, item.metricUnit));
              setIsMetricPickerOpen(false);
              setIsUnitPickerOpen((current) => !current);
            }}
            className="h-[34px] w-7 shrink-0 rounded-md border border-green-200 bg-green-50/80 px-0.5 py-0.5 text-[9px] font-medium leading-none text-green-800 transition-colors hover:bg-green-100 dark:border-green-900/40 dark:bg-green-950/30 dark:text-green-200 sm:h-auto sm:w-[2.25rem] sm:rounded-lg sm:px-1.5 sm:py-1 sm:text-[10px] min-[376px]:sm:w-[2.5rem]"
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
          className="h-10 w-full rounded-lg border border-gray-300 bg-white px-1.5 py-1.5 text-center text-sm font-medium text-gray-900 focus:outline-none focus:ring-1 focus:ring-green-500 disabled:cursor-not-allowed disabled:bg-gray-100 disabled:text-gray-400 dark:border-gray-600 dark:bg-gray-900 dark:text-white dark:disabled:bg-gray-800 sm:h-auto sm:w-[3.25rem] sm:rounded sm:px-1.5 sm:py-1 sm:text-[11px] min-[376px]:sm:w-14 min-[376px]:sm:px-2 min-[376px]:sm:py-1.5 min-[376px]:sm:text-xs"
        />
      </div>
      {isDesktopMetricMenu ? (
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
                  className="flex min-h-9 w-full min-w-[72px] items-center justify-between rounded-md px-3 py-2 text-left text-[11px] whitespace-nowrap text-gray-700 hover:bg-gray-50 dark:text-gray-200 dark:hover:bg-gray-800"
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
      {supportsUnitSelector && isDesktopUnitMenu ? (
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
                  className="flex min-h-9 w-full min-w-[72px] items-center justify-between rounded-md px-3 py-2 text-left text-[11px] whitespace-nowrap text-gray-700 hover:bg-gray-50 dark:text-gray-200 dark:hover:bg-gray-800"
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
  );

  const mobileMetricSelector = (
    <div className="relative flex w-full items-center justify-center">
      <div className="flex items-center justify-center gap-1.5">
        <button
          ref={mobileMetricButtonRef}
          type="button"
          onClick={(e) => {
            activeMetricAnchorRef.current = e.currentTarget;
            setMetricDraft(metricType);
            setIsMetricPickerOpen((current) => !current);
            setIsUnitPickerOpen(false);
          }}
          className="h-[34px] min-h-[34px] min-w-[56px] shrink-0 rounded-md border border-green-200 bg-green-50/80 px-2 py-0 text-[11px] font-medium leading-none text-green-800 transition-colors hover:bg-green-100 whitespace-nowrap overflow-visible text-clip dark:border-green-900/40 dark:bg-green-950/30 dark:text-green-200"
        >
          <span className="flex items-center justify-center gap-1">
            <span>{getMetricLabel(metricType)}</span>
            <span aria-hidden="true" className="shrink-0">▼</span>
          </span>
        </button>
        {supportsUnitSelector ? (
          <button
            ref={mobileUnitButtonRef}
            type="button"
            onClick={(e) => {
              activeUnitAnchorRef.current = e.currentTarget;
              setUnitDraft(normalizeWorkoutMetricUnit(metricType, item.metricUnit));
              setIsMetricPickerOpen(false);
              setIsUnitPickerOpen((current) => !current);
            }}
            className="h-[34px] min-h-[34px] min-w-[40px] shrink-0 rounded-md border border-green-200 bg-green-50/80 px-2 py-0 text-sm font-medium leading-none text-green-800 transition-colors hover:bg-green-100 whitespace-nowrap overflow-visible text-clip dark:border-green-900/40 dark:bg-green-950/30 dark:text-green-200"
          >
            <span className="flex items-center justify-center gap-0.5">
              <span>{normalizeWorkoutMetricUnit(metricType, item.metricUnit)}</span>
              <span aria-hidden="true" className="shrink-0">▼</span>
            </span>
          </button>
        ) : null}
      </div>
      {isMobileMetricMenu ? (
        <div
          ref={metricPopupRef}
          className="absolute left-1/2 top-full z-[80] mt-2 w-[9.5rem] max-w-[calc(100vw-2rem)] -translate-x-1/2 rounded-lg border border-gray-200 bg-white p-2.5 shadow-xl dark:border-gray-700 dark:bg-gray-900"
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
      {supportsUnitSelector && isMobileUnitMenu ? (
        <div
          ref={unitPopupRef}
          className="absolute right-0 top-full z-[80] mt-2 w-24 max-w-[calc(100vw-2rem)] rounded-lg border border-gray-200 bg-white p-2 shadow-xl dark:border-gray-700 dark:bg-gray-900"
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
  );

  const mobileWeightInput = (
    <input
      {...getWorkoutWeightInputProps()}
      value={metricType === 'none' ? '0' : weightDraft}
      disabled={!isMetricEditable}
      onChange={(e) => {
        setWeightDraft(sanitizeWorkoutWeightInput(e.target.value));
        onWeightChange(index, e.target.value);
      }}
      className={`${MOBILE_NUMBER_INPUT_CLASS_NAME} disabled:cursor-not-allowed disabled:bg-gray-100 disabled:text-gray-400 dark:disabled:bg-gray-800`}
    />
  );

  const mobileSetsInput = (
    <input
      {...getWorkoutIntegerInputProps()}
      value={setsDraft}
      onChange={(e) => {
        setSetsDraft(sanitizeWorkoutIntegerInput(e.target.value));
        onIntegerChange(index, 'sets', e.target.value);
      }}
      className={MOBILE_NUMBER_INPUT_CLASS_NAME}
    />
  );

  const mobileRepsInput = (
    <input
      {...getWorkoutIntegerInputProps()}
      value={repsDraft}
      onChange={(e) => {
        setRepsDraft(sanitizeWorkoutIntegerInput(e.target.value));
        onIntegerChange(index, 'reps', e.target.value);
      }}
      className={MOBILE_NUMBER_INPUT_CLASS_NAME}
    />
  );

  return (
    <div className="border-b border-gray-200 py-3 dark:border-gray-800 sm:py-0">
      <div className="sm:hidden">
        <div className="min-w-0 px-1 pb-2">
          {exerciseNameBlock}
        </div>
        <div className="grid grid-cols-3 items-end gap-3 px-1">
          <div className="flex min-w-0 flex-col justify-end gap-2">
            <div className="flex h-10 items-center justify-center text-[9px] font-semibold uppercase tracking-[0.08em] text-gray-700 dark:text-gray-300">
              Подход
            </div>
            {mobileSetsInput}
          </div>
          <div className="flex min-w-0 flex-col justify-end gap-2">
            <div className="flex h-10 items-center justify-center text-[9px] font-semibold uppercase tracking-[0.08em] text-gray-700 dark:text-gray-300">
              Повтор
            </div>
            {mobileRepsInput}
          </div>
          <div className="flex min-w-0 flex-col justify-end gap-2">
            {mobileMetricSelector}
            {mobileWeightInput}
          </div>
        </div>
      </div>

      <div className={`${EDITOR_ROW_GRID_CLASS} items-start gap-x-0`}>
        <div className="flex justify-center sm:py-2 sm:min-[376px]:py-3" aria-hidden="true">
          <span className="text-sm leading-5 text-gray-300 dark:text-gray-600">⋮</span>
        </div>
        <div className="min-w-0 sm:py-2 sm:min-[376px]:py-3 sm:px-2">
          {exerciseNameBlock}
        </div>
        <div className="sm:py-2 sm:min-[376px]:py-3 sm:px-2">
          {setsControl}
        </div>
        <div className="sm:py-2 sm:min-[376px]:py-3 sm:px-2">
          {repsControl}
        </div>
        <div className="sm:py-2 sm:min-[376px]:py-3 sm:px-2">
          {metricControl}
        </div>
      </div>
    </div>
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
          <div className="relative px-2 min-[376px]:px-3 sm:px-4 py-2 min-[376px]:py-2.5 sm:py-3 border-b border-gray-200 dark:border-gray-700 flex items-center justify-center flex-shrink-0">
            <h2 className="text-center text-xs min-[376px]:text-sm sm:text-lg font-semibold text-gray-900 dark:text-white uppercase">
              {title}
            </h2>
            <button
              onClick={onClose}
              className="absolute right-2 min-[376px]:right-3 sm:right-4 p-1 min-[376px]:p-1.5 sm:p-2 hover:bg-gray-100 dark:hover:bg-gray-800 rounded-lg transition-colors flex-shrink-0"
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
                  <div className="w-full">
                    <div className={`${EDITOR_ROW_GRID_CLASS} border-b border-gray-200 dark:border-gray-700`}>
                      <div aria-hidden="true" />
                      <div className="w-full min-w-0 justify-self-start px-2 py-1.5 text-left text-[10px] font-semibold text-gray-700 dark:text-gray-300 min-[376px]:py-2 min-[376px]:text-xs">
                        <span className="block w-full leading-tight italic sm:uppercase sm:not-italic">Упражнение</span>
                      </div>
                      <div className="px-2 py-1.5 text-center text-[9px] font-semibold whitespace-nowrap text-gray-700 dark:text-gray-300 min-[376px]:py-2 min-[376px]:text-[10px] sm:uppercase">
                        Подход
                      </div>
                      <div className="px-2 py-1.5 text-center text-[9px] font-semibold whitespace-nowrap text-gray-700 dark:text-gray-300 min-[376px]:py-2 min-[376px]:text-[10px] sm:uppercase">
                        Повтор
                      </div>
                      <div className="px-2 py-1.5 text-center text-[9px] font-semibold whitespace-nowrap text-gray-700 dark:text-gray-300 min-[376px]:py-2 min-[376px]:text-[10px] sm:uppercase">
                        Вес
                      </div>
                    </div>
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
                  </div>
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
