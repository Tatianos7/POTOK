import { useEffect, useMemo, useRef, useState, type FC } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { Calendar, ChevronDown, ChevronUp, X } from 'lucide-react';
import MuscleMap from '../components/muscle-map/MuscleMap';
import { useAuth } from '../context/AuthContext';
import WorkoutProgressMonthPicker from '../components/WorkoutProgressMonthPicker';
import WorkoutProgressList from '../components/WorkoutProgressList';
import type { WorkoutProgressSummary } from '../services/workoutProgressService';
import { workoutProgressService } from '../services/workoutProgressService';
import { workoutService } from '../services/workoutService';
import type { WorkoutProgressObservation, WorkoutProgressRow } from '../types/workout';
import { buildWorkoutProgressList, filterWorkoutProgressObservationsByRange } from '../utils/workoutProgress';
import {
  cacheCoversWorkoutProgressPeriod,
  getWorkoutProgressHistoryFetchRange,
  mergeWorkoutProgressObservationCache,
  type WorkoutProgressObservationCache,
} from '../utils/workoutProgressCache';
import {
  applyWorkoutProgressMonthSelection,
  formatWorkoutProgressMonthLabel,
  getWorkoutProgressMonthPeriod,
} from '../utils/workoutProgressPeriod';
import { getLocalDayKey } from '../utils/dayKey';
import ScreenContainer from '../ui/components/ScreenContainer';
import Button from '../ui/components/Button';
import { colors, spacing, typography } from '../ui/theme/tokens';
import { WORKOUT_SCREEN_BACKGROUND } from '../utils/workoutLayout';
import { getDefaultWorkoutHistoryRange } from '../utils/workoutHistoryRange';

let progressObservationsCache: WorkoutProgressObservationCache | null = null;

const ProgressWorkouts: FC = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const { user } = useAuth();
  const defaultDate = getLocalDayKey();
  const locationState = location.state as { selectedMonthDate?: string; returnTo?: string } | null;
  const locationSelectedMonthDate = locationState?.selectedMonthDate;
  const closeRoute = locationState?.returnTo === 'workouts' ? '/workouts' : '/progress';
  const range = useMemo(() => getDefaultWorkoutHistoryRange(), []);
  const pickerRef = useRef<HTMLDivElement>(null);
  const [selectedMonthDate, setSelectedMonthDate] = useState(locationSelectedMonthDate ?? defaultDate);
  const [isCalendarOpen, setIsCalendarOpen] = useState(false);
  const [observations, setObservations] = useState<WorkoutProgressObservation[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [summary, setSummary] = useState<WorkoutProgressSummary | null>(null);
  const [isSummaryLoading, setIsSummaryLoading] = useState(false);

  const period = useMemo(() => getWorkoutProgressMonthPeriod(selectedMonthDate), [selectedMonthDate]);
  const periodLabel = useMemo(() => formatWorkoutProgressMonthLabel(selectedMonthDate), [selectedMonthDate]);
  const trendHistoryStart = '1900-01-01';
  const rows = useMemo<WorkoutProgressRow[]>(() => {
    const displayObservations = filterWorkoutProgressObservationsByRange(observations, period.from, period.to);
    return buildWorkoutProgressList(displayObservations, observations);
  }, [observations, period.from, period.to]);
  const trainedMuscles = useMemo(() => {
    if (!summary) {
      return [];
    }

    return summary.muscleCoverage
      .filter((item) => item.status === 'trained')
      .map((item) => item.muscleKey);
  }, [summary]);

  useEffect(() => {
    if (!isCalendarOpen) return;

    const handlePointerDown = (event: MouseEvent) => {
      if (pickerRef.current && !pickerRef.current.contains(event.target as Node)) {
        setIsCalendarOpen(false);
      }
    };

    document.addEventListener('mousedown', handlePointerDown);
    return () => document.removeEventListener('mousedown', handlePointerDown);
  }, [isCalendarOpen]);

  useEffect(() => {
    if (!user?.id) return;

    let isMounted = true;
    setErrorMessage(null);

    if (cacheCoversWorkoutProgressPeriod(progressObservationsCache, user.id, period.to)) {
      setObservations(progressObservationsCache!.observations);
      setIsLoading(false);
      return () => {
        isMounted = false;
      };
    }

    const fetchRange = getWorkoutProgressHistoryFetchRange(
      progressObservationsCache,
      user.id,
      period.to,
      trendHistoryStart,
    );

    if (!fetchRange.shouldFetch) {
      setIsLoading(false);
      return () => {
        isMounted = false;
      };
    }

    setIsLoading(true);

    workoutService
      .getWorkoutProgressObservations(user.id, fetchRange.from, fetchRange.to)
      .then((nextObservations) => {
        if (!isMounted) return;
        progressObservationsCache = mergeWorkoutProgressObservationCache(
          progressObservationsCache,
          user.id,
          period.to,
          nextObservations,
        );
        setObservations(progressObservationsCache.observations);
      })
      .catch((error: any) => {
        if (!isMounted) return;
        console.error('[ProgressWorkouts] load failed', error);
        if (!progressObservationsCache || progressObservationsCache.userId !== user.id) {
          setObservations([]);
        }
        setErrorMessage(error?.message || 'Не удалось загрузить прогресс тренировок');
      })
      .finally(() => {
        if (isMounted) {
          setIsLoading(false);
        }
      });

    return () => {
      isMounted = false;
    };
  }, [period.from, period.to, user?.id]);

  useEffect(() => {
    if (!user?.id) return;

    let isMounted = true;
    setIsSummaryLoading(true);

    workoutProgressService
      .getWorkoutProgressSummary({
        userId: user.id,
        dateFrom: period.from,
        dateTo: period.to,
        period: 'month',
      })
      .then((nextSummary) => {
        if (!isMounted) return;
        setSummary(nextSummary);
      })
      .catch((error: any) => {
        if (!isMounted) return;
        console.error('[ProgressWorkouts] summary failed', error);
        setSummary(null);
      })
      .finally(() => {
        if (isMounted) {
          setIsSummaryLoading(false);
        }
      });

    return () => {
      isMounted = false;
    };
  }, [period.from, period.to, user?.id]);

  return (
    <ScreenContainer backgroundColor={WORKOUT_SCREEN_BACKGROUND}>
      <header className="flex items-center justify-between" style={{ marginBottom: spacing.lg }}>
        <div style={{ width: 32 }} />
        <h1 style={{ ...typography.title, textTransform: 'uppercase', textAlign: 'center' }}>
          Прогресс тренировок
        </h1>
        <Button variant="ghost" size="sm" onClick={() => navigate(closeRoute)} aria-label="Закрыть">
          <X className="h-5 w-5" style={{ color: colors.text.secondary }} />
        </Button>
      </header>

      <main className="flex-1 overflow-y-auto min-h-0 space-y-3" style={{ paddingBottom: spacing.lg }}>
        <div ref={pickerRef} className="relative bg-white px-1 py-2">
          <button
            type="button"
            onClick={() => setIsCalendarOpen((current) => !current)}
            className="flex w-full items-center justify-between gap-3 text-left"
            aria-expanded={isCalendarOpen}
            aria-label="Выбрать период прогресса тренировок"
          >
            <div className="flex items-center gap-3">
              <Calendar className="h-5 w-5 text-gray-500" />
              <div>
                <div className="text-[15px] font-medium text-gray-800">Выбрать период</div>
                <div className="text-[12px] capitalize text-gray-500">{periodLabel}</div>
              </div>
            </div>
            {isCalendarOpen ? (
              <ChevronUp className="h-4 w-4 text-gray-500" />
            ) : (
              <ChevronDown className="h-4 w-4 text-gray-500" />
            )}
          </button>

          {isCalendarOpen ? (
            <WorkoutProgressMonthPicker
              selectedMonthDate={selectedMonthDate}
              onMonthSelect={(date) => {
                const next = applyWorkoutProgressMonthSelection(date);
                setSelectedMonthDate(next.selectedMonthDate);
                setIsCalendarOpen(next.isCalendarOpen);
              }}
              minDate={range.from}
              maxDate={range.to}
            />
          ) : null}
        </div>

        {errorMessage ? (
          <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800">
            {errorMessage}
          </div>
        ) : null}

        <section className="space-y-3">
          <div className="rounded-xl border border-gray-200 bg-white px-3 py-2.5">
            <div className="flex flex-wrap items-baseline gap-x-1.5 gap-y-1 text-[15px] leading-snug text-gray-700">
              <span>Количество тренировок за период:</span>
              <span className="shrink-0 whitespace-nowrap font-extrabold text-gray-950">
                {isSummaryLoading ? '...' : (summary?.totalWorkouts ?? 0)}
              </span>
            </div>
          </div>

          <div className="rounded-xl border border-gray-200 bg-white px-4 py-4">
            <div className="text-[11px] font-semibold uppercase tracking-[0.12em] text-gray-500">
              Тренируемые мышцы
            </div>
            {isSummaryLoading ? (
              <div className="mt-3 text-sm text-gray-500">Обновляем мышечную карту...</div>
            ) : (summary?.totalWorkouts ?? 0) > 0 && trainedMuscles.length > 0 ? (
              <div className="mt-3 space-y-3">
                <MuscleMap primaryMuscles={trainedMuscles} size="compact" />
                <div className="text-xs text-gray-500">
                  Мышцы которые получили нагрузку за период.
                </div>
              </div>
            ) : (
              <div className="mt-3 text-sm text-gray-500">
                За выбранный период пока нет данных, чтобы показать тренируемые мышечные группы.
              </div>
            )}
          </div>
        </section>

        <WorkoutProgressList
          rows={rows}
          isLoading={isLoading}
          onRowSelect={(row) => {
            navigate(`/progress/workouts/${encodeURIComponent(row.exerciseGroupKey)}`, {
              state: {
                exerciseName: row.exerciseName,
                selectedMonthDate,
              },
            });
          }}
        />
      </main>
    </ScreenContainer>
  );
};

export default ProgressWorkouts;
