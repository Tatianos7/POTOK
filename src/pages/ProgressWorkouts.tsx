import { useEffect, useMemo, useState, type FC } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { ChevronDown, Target, X } from 'lucide-react';
import MuscleMap from '../components/muscle-map/MuscleMap';
import { useAuth } from '../context/AuthContext';
import WorkoutProgressList from '../components/WorkoutProgressList';
import type { WorkoutProgressPeriod, WorkoutProgressSummary } from '../services/workoutProgressService';
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
  formatWorkoutProgressPeriodLabel,
  getWorkoutProgressPeriod,
  type WorkoutProgressQuickPeriod,
} from '../utils/workoutProgressPeriod';
import { getLocalDayKey } from '../utils/dayKey';
import ScreenContainer from '../ui/components/ScreenContainer';
import { spacing } from '../ui/theme/tokens';
import { WORKOUT_SCREEN_BACKGROUND } from '../utils/workoutLayout';

let progressObservationsCache: WorkoutProgressObservationCache | null = null;

const PERIOD_OPTIONS: Array<{ key: WorkoutProgressQuickPeriod; label: string }> = [
  { key: 'day', label: 'День' },
  { key: 'week', label: '7 дней' },
  { key: 'month', label: '30 дней' },
  { key: 'year', label: 'Год' },
];

export type WorkoutProgressRecommendationTone = 'good' | 'warning';

export type WorkoutProgressRecommendation = {
  tone: WorkoutProgressRecommendationTone;
  title: string;
  body: string;
};

type WorkoutPeriodResult = {
  totalWorkouts: number;
  averageFrequency: string;
  lastWorkout: string;
  longestGapDays: number | null;
};

function toSummaryPeriod(period: WorkoutProgressQuickPeriod): WorkoutProgressPeriod {
  if (period === 'week') {
    return 'week';
  }

  if (period === 'month') {
    return 'month';
  }

  return 'custom';
}

function parseDayKey(dayKey: string): Date {
  const [year, month, day] = dayKey.split('-').map(Number);
  return new Date(year, month - 1, day);
}

function formatTimesPerWeek(value: number): string {
  if (!Number.isFinite(value) || value <= 0) {
    return 'нет данных';
  }

  if (value < 1) {
    return 'реже 1 раза в неделю';
  }

  const nearestInteger = Math.round(value);
  const isCloseToInteger = Math.abs(value - nearestInteger) < 0.05;

  if (isCloseToInteger) {
    const suffix = nearestInteger === 1 ? 'раз' : 'раза';
    return `${nearestInteger} ${suffix} в неделю`;
  }

  return `около ${nearestInteger} раз в неделю`;
}

function formatDaysAgo(days: number): string {
  const absDays = Math.max(0, days);
  const lastTwoDigits = absDays % 100;
  const lastDigit = absDays % 10;

  if (lastTwoDigits >= 11 && lastTwoDigits <= 14) {
    return `${absDays} дней назад`;
  }

  if (lastDigit === 1) {
    return `${absDays} день назад`;
  }

  if (lastDigit >= 2 && lastDigit <= 4) {
    return `${absDays} дня назад`;
  }

  return `${absDays} дней назад`;
}

function formatMuscleLabels(labels: string[]): string {
  return labels.slice(0, 2).join(', ');
}

function getWorkoutRecommendationMinimumWorkouts(period: WorkoutProgressQuickPeriod): number {
  if (period === 'week') return 3;
  if (period === 'month') return 8;
  if (period === 'year') return 48;
  return 1;
}

function getWorkoutRecommendationLongGapThreshold(period: WorkoutProgressQuickPeriod): number {
  if (period === 'week') return 3;
  if (period === 'year') return 30;
  return 10;
}

function formatLastWorkoutLabel(lastDate: string | null, anchorDate: string): string {
  if (!lastDate) {
    return 'нет данных';
  }

  const diffMs = parseDayKey(anchorDate).getTime() - parseDayKey(lastDate).getTime();
  const diffDays = Math.max(0, Math.round(diffMs / 86400000));

  if (diffDays === 0) {
    return 'сегодня';
  }

  if (diffDays === 1) {
    return 'вчера';
  }

  return formatDaysAgo(diffDays);
}

function getLongestWorkoutGapDays(workoutDates: string[]): number | null {
  if (workoutDates.length < 2) {
    return null;
  }

  let longestGap = 0;

  for (let index = 1; index < workoutDates.length; index += 1) {
    const currentDate = parseDayKey(workoutDates[index]);
    const previousDate = parseDayKey(workoutDates[index - 1]);
    const gapDays = Math.max(0, Math.round((currentDate.getTime() - previousDate.getTime()) / 86400000) - 1);
    longestGap = Math.max(longestGap, gapDays);
  }

  return longestGap;
}

export function getWorkoutPeriodResultFromSummary(
  summary: WorkoutProgressSummary | null,
  period: { dayCount: number; to: string },
): WorkoutPeriodResult {
  const workoutDates = Array.from(new Set(summary?.workoutDates ?? [])).sort();
  const lastWorkoutDate = workoutDates[workoutDates.length - 1] ?? null;
  const totalWorkouts = summary?.totalWorkouts ?? workoutDates.length;

  return {
    totalWorkouts,
    averageFrequency: period.dayCount >= 7 && totalWorkouts > 0
      ? formatTimesPerWeek((totalWorkouts / period.dayCount) * 7)
      : 'Недостаточно данных',
    lastWorkout: formatLastWorkoutLabel(lastWorkoutDate, period.to),
    longestGapDays: getLongestWorkoutGapDays(workoutDates),
  };
}

export function getProgressMuscleMapMuscles(
  summary: WorkoutProgressSummary | null,
): { primaryMuscles: string[]; secondaryMuscles: string[] } {
  if (!summary) {
    return { primaryMuscles: [], secondaryMuscles: [] };
  }

  const primaryMuscles: string[] = [];
  const secondaryMuscles: string[] = [];

  summary.muscleCoverage.forEach((item) => {
    if (item.primaryCount > 0) {
      primaryMuscles.push(item.muscleKey);
      return;
    }

    if (item.secondaryCount > 0) {
      secondaryMuscles.push(item.muscleKey);
    }
  });

  return { primaryMuscles, secondaryMuscles };
}

export function buildWorkoutProgressRecommendation({
  isExerciseProgressLoadedForPeriod,
  loadedMuscles,
  period,
  rows,
  summary,
  workoutResult,
}: {
  isExerciseProgressLoadedForPeriod: boolean;
  loadedMuscles: { primaryMuscles: string[]; secondaryMuscles: string[] };
  period: WorkoutProgressQuickPeriod;
  rows: WorkoutProgressRow[];
  summary: WorkoutProgressSummary | null;
  workoutResult: WorkoutPeriodResult;
}): WorkoutProgressRecommendation {
  const totalWorkouts = workoutResult.totalWorkouts;
  const minimumWorkouts = getWorkoutRecommendationMinimumWorkouts(period);
  const loadedMuscleCount = new Set([
    ...loadedMuscles.primaryMuscles,
    ...loadedMuscles.secondaryMuscles,
  ]).size;
  const hasLoadData = rows.some((row) => row.latestSets > 0 || row.latestReps > 0 || row.latestWeight > 0);
  const hasExerciseProgress = rows.some((row) =>
    row.setsTrend === 'up' || row.repsTrend === 'up' || row.weightTrend === 'up'
  );
  const longGapThreshold = getWorkoutRecommendationLongGapThreshold(period);
  const hasLongGap = workoutResult.longestGapDays !== null && workoutResult.longestGapDays >= longGapThreshold;
  const undertrainedLabels = (summary?.undertrainedMuscles ?? [])
    .filter((muscle) => {
      const coverage = summary?.muscleCoverage.find((item) => item.muscleKey === muscle.muscleKey);
      return (coverage?.score ?? 0) > 0;
    })
    .map((muscle) => muscle.label)
    .filter((label): label is string => Boolean(label?.trim()));

  if (totalWorkouts === 0) {
    return {
      tone: 'warning',
      title: 'Что сделать дальше',
      body: 'За выбранный период пока нет тренировок. Добавьте 1-2 тренировки, чтобы увидеть динамику и нагрузку по мышцам.',
    };
  }

  if (period !== 'day' && totalWorkouts < minimumWorkouts) {
    return {
      tone: 'warning',
      title: 'Что сделать дальше',
      body: 'Тренировок пока мало для точной оценки. Продолжайте вести дневник - после нескольких тренировок Progress станет полезнее.',
    };
  }

  if (hasLongGap) {
    return {
      tone: 'warning',
      title: 'Что сделать дальше',
      body: 'Был длинный перерыв. Начните с короткой тренировки и верните регулярность.',
    };
  }

  if (isExerciseProgressLoadedForPeriod && !hasLoadData) {
    return {
      tone: 'warning',
      title: 'Что сделать дальше',
      body: 'Данных по нагрузке мало. Заполняйте вес, время или дистанцию, чтобы видеть прогресс.',
    };
  }

  if (loadedMuscleCount > 0 && loadedMuscleCount < 3) {
    return {
      tone: 'warning',
      title: 'Что сделать дальше',
      body: 'Нагрузка распределена неравномерно. Добавьте упражнения на группы, которые сейчас отстают.',
    };
  }

  if (undertrainedLabels.length > 0) {
    return {
      tone: 'warning',
      title: 'Что сделать дальше',
      body: `Нагрузка распределена неравномерно. Добавьте нагрузку на ${formatMuscleLabels(undertrainedLabels)}.`,
    };
  }

  if (isExerciseProgressLoadedForPeriod && rows.length > 0 && hasLoadData && !hasExerciseProgress) {
    return {
      tone: 'warning',
      title: 'Что сделать дальше',
      body: 'Пока нет явного роста по упражнениям. Попробуйте постепенно добавить вес, повторы, время или дистанцию.',
    };
  }

  return {
    tone: 'good',
    title: 'Что сделать дальше',
    body: 'Вы двигаетесь хорошо: тренировки идут регулярно, а нагрузка покрывает несколько групп мышц. Продолжайте в том же темпе.',
  };
}

const ProgressWorkouts: FC = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const { user } = useAuth();
  const locationState = location.state as { selectedMonthDate?: string; returnTo?: string } | null;
  const locationSelectedMonthDate = locationState?.selectedMonthDate;
  const [anchorDate] = useState(locationSelectedMonthDate ?? getLocalDayKey());
  const [selectedPeriod, setSelectedPeriod] = useState<WorkoutProgressQuickPeriod>('month');
  const [observations, setObservations] = useState<WorkoutProgressObservation[]>([]);
  const [isExerciseProgressLoading, setIsExerciseProgressLoading] = useState(false);
  const [exerciseProgressErrorMessage, setExerciseProgressErrorMessage] = useState<string | null>(null);
  const [summary, setSummary] = useState<WorkoutProgressSummary | null>(null);
  const [isSummaryLoading, setIsSummaryLoading] = useState(false);
  const [isExerciseListOpen, setIsExerciseListOpen] = useState(false);
  const [workoutSyncVersion, setWorkoutSyncVersion] = useState(0);

  const period = useMemo(() => getWorkoutProgressPeriod(anchorDate, selectedPeriod), [anchorDate, selectedPeriod]);
  const periodLabel = useMemo(
    () => formatWorkoutProgressPeriodLabel(anchorDate, selectedPeriod),
    [anchorDate, selectedPeriod],
  );
  const summaryPeriod = useMemo(() => toSummaryPeriod(selectedPeriod), [selectedPeriod]);
  const trendHistoryStart = '1900-01-01';
  const displayObservations = useMemo(
    () => filterWorkoutProgressObservationsByRange(observations, period.from, period.to),
    [observations, period.from, period.to],
  );
  const rows = useMemo<WorkoutProgressRow[]>(() => {
    return buildWorkoutProgressList(displayObservations, observations);
  }, [displayObservations, observations]);
  const loadedMuscles = useMemo(() => getProgressMuscleMapMuscles(summary), [summary]);
  const workoutResult = useMemo(() => {
    return getWorkoutPeriodResultFromSummary(summary, period);
  }, [period, summary]);
  const isExerciseProgressLoadedForPeriod = useMemo(
    () => cacheCoversWorkoutProgressPeriod(progressObservationsCache, user?.id ?? '', period.to),
    [period.to, user?.id, observations],
  );
  const workoutRecommendation = useMemo(() => buildWorkoutProgressRecommendation({
    isExerciseProgressLoadedForPeriod,
    loadedMuscles,
    period: selectedPeriod,
    rows,
    summary,
    workoutResult,
  }), [isExerciseProgressLoadedForPeriod, loadedMuscles, rows, selectedPeriod, summary, workoutResult]);
  const recommendationStyle = workoutRecommendation.tone === 'good'
    ? {
        accent: 'border-l-emerald-200',
        icon: 'bg-emerald-500/10 text-emerald-700',
      }
    : {
        accent: 'border-l-amber-200',
        icon: 'bg-amber-500/10 text-amber-700',
      };

  useEffect(() => {
    const handleWorkoutsSynced = () => {
      progressObservationsCache = null;
      setObservations([]);
      setWorkoutSyncVersion((version) => version + 1);
    };

    window.addEventListener('workouts-synced', handleWorkoutsSynced as EventListener);
    return () => {
      window.removeEventListener('workouts-synced', handleWorkoutsSynced as EventListener);
    };
  }, []);

  useEffect(() => {
    if (!user?.id) return;
    if (!isExerciseListOpen) {
      setIsExerciseProgressLoading(false);
      return;
    }

    let isMounted = true;
    setExerciseProgressErrorMessage(null);

    if (cacheCoversWorkoutProgressPeriod(progressObservationsCache, user.id, period.to)) {
      setObservations(progressObservationsCache!.observations);
      setIsExerciseProgressLoading(false);
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
      setIsExerciseProgressLoading(false);
      return () => {
        isMounted = false;
      };
    }

    setIsExerciseProgressLoading(true);

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
        setExerciseProgressErrorMessage('Не удалось загрузить прогресс упражнений.');
      })
      .finally(() => {
        if (isMounted) {
          setIsExerciseProgressLoading(false);
        }
      });

    return () => {
      isMounted = false;
    };
  }, [isExerciseListOpen, period.from, period.to, user?.id, workoutSyncVersion]);

  useEffect(() => {
    if (!user?.id) return;

    let isMounted = true;
    setIsSummaryLoading(true);

    workoutProgressService
      .getWorkoutProgressSummary({
        userId: user.id,
        dateFrom: period.from,
        dateTo: period.to,
        period: summaryPeriod,
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
  }, [period.from, period.to, summaryPeriod, user?.id, workoutSyncVersion]);

  return (
    <ScreenContainer backgroundColor={WORKOUT_SCREEN_BACKGROUND}>
      <header className="mb-4">
        <div className="flex items-center justify-between gap-3">
          <h1 className="min-w-0 text-2xl font-semibold tracking-tight text-stone-950">Тренировки</h1>
          <button
            type="button"
            className="inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-white text-stone-600 transition hover:bg-stone-100 hover:text-stone-900"
            onClick={() => navigate('/progress')}
            aria-label="Закрыть"
          >
            <X className="h-5 w-5" />
          </button>
        </div>
        <p className="mt-1 text-sm leading-6 text-stone-600">{periodLabel}</p>
      </header>

      <main className="flex-1 overflow-y-auto min-h-0 space-y-3" style={{ paddingBottom: spacing.lg }}>
        <div className="grid grid-cols-4 gap-1.5">
          {PERIOD_OPTIONS.map((option) => (
            <button
              key={option.key}
              type="button"
              onClick={() => setSelectedPeriod(option.key)}
              className={`min-w-0 rounded-full px-2 py-2 text-xs font-medium transition sm:text-sm ${
                selectedPeriod === option.key
                  ? 'bg-stone-950 text-white shadow-lg shadow-stone-950/15'
                  : 'bg-white text-stone-700 hover:bg-stone-100'
              }`}
            >
              {option.label}
            </button>
          ))}
        </div>

        <section className="rounded-xl border border-gray-200 bg-white p-6">
          <div className="mb-4 text-sm font-medium text-stone-900">Результат за период</div>
          <div className="divide-y divide-stone-100 border-y border-stone-100">
            <div className="flex items-start justify-between gap-4 py-3">
              <div className="min-w-0">
                <div className="text-sm font-medium text-stone-700">Тренировок</div>
                <div className="mt-0.5 text-xs text-stone-400">за выбранный период</div>
              </div>
              <div className="max-w-[58%] break-words text-right text-sm font-semibold leading-5 text-stone-900">
                {isSummaryLoading ? '...' : workoutResult.totalWorkouts}
              </div>
            </div>
            <div className="flex items-start justify-between gap-4 py-3">
              <div className="min-w-0">
                <div className="text-sm font-medium text-stone-700">Средняя частота</div>
                <div className="mt-0.5 text-xs text-stone-400">в пересчёте на неделю</div>
              </div>
              <div className="max-w-[58%] break-words text-right text-sm font-semibold leading-5 text-stone-900">
                {isSummaryLoading ? '...' : workoutResult.averageFrequency}
              </div>
            </div>
            <div className="flex items-start justify-between gap-4 py-3">
              <div className="min-w-0">
                <div className="text-sm font-medium text-stone-700">Последняя тренировка</div>
                <div className="mt-0.5 text-xs text-stone-400">относительно периода</div>
              </div>
              <div className="max-w-[58%] break-words text-right text-sm font-semibold leading-5 text-stone-900">
                {isSummaryLoading ? '...' : workoutResult.lastWorkout}
              </div>
            </div>
          </div>
        </section>

        <section className="rounded-xl border border-emerald-100 bg-emerald-50/40">
          <button
            type="button"
            className="flex w-full items-start justify-between gap-3 px-4 py-4 text-left transition hover:bg-emerald-50/70"
            onClick={() => setIsExerciseListOpen((current) => !current)}
            aria-expanded={isExerciseListOpen}
          >
            <span className="min-w-0">
              <span className="block text-sm font-medium text-stone-900">Прогресс по упражнениям</span>
              <span className="mt-1 block text-sm leading-6 text-stone-500">
                Детали по упражнениям за выбранный период
              </span>
            </span>
            <ChevronDown
              className={`mt-0.5 h-5 w-5 shrink-0 text-stone-500 transition-transform ${
                isExerciseListOpen ? 'rotate-180' : ''
              }`}
              aria-hidden="true"
            />
          </button>

          {isExerciseListOpen ? (
            <div className="border-t border-emerald-100 bg-white px-4 py-4">
              {exerciseProgressErrorMessage ? (
                <div className="bg-white px-1 py-6 text-sm text-red-700">
                  {exerciseProgressErrorMessage}
                </div>
              ) : isExerciseProgressLoading ? (
                <div className="bg-white px-1 py-6 text-sm text-gray-500">
                  Загружаем прогресс упражнений...
                </div>
              ) : (
                <WorkoutProgressList
                  rows={rows}
                  onRowSelect={(row) => {
                    navigate(`/progress/workouts/${encodeURIComponent(row.exerciseGroupKey)}`, {
                      state: {
                        exerciseName: row.exerciseName,
                        selectedMonthDate: anchorDate,
                      },
                    });
                  }}
                />
              )}
            </div>
          ) : null}
        </section>

        <section className="rounded-xl border border-gray-200 bg-white px-4 py-4">
          <div className="text-[11px] font-semibold uppercase tracking-[0.12em] text-gray-500">
            Тренируемые мышцы
          </div>
          {isSummaryLoading ? (
            <div className="mt-3 text-sm text-gray-500">Обновляем мышечную карту...</div>
          ) : (summary?.totalWorkouts ?? 0) > 0 &&
            (loadedMuscles.primaryMuscles.length > 0 || loadedMuscles.secondaryMuscles.length > 0) ? (
            <div className="mt-3 space-y-3">
              <MuscleMap
                primaryMuscles={loadedMuscles.primaryMuscles}
                secondaryMuscles={loadedMuscles.secondaryMuscles}
                size="compact"
              />
              <div className="text-xs text-gray-500">
                Мышцы которые получили нагрузку за период.
              </div>
            </div>
          ) : (
            <div className="mt-3 text-sm text-gray-500">
              За выбранный период пока нет данных, чтобы показать тренируемые мышечные группы.
            </div>
          )}
        </section>

        <section className={`rounded-xl border border-gray-200 border-l-4 bg-white p-4 ${recommendationStyle.accent}`}>
          <div className="flex items-start gap-2.5">
            <div className={`mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-full ${recommendationStyle.icon}`}>
              <Target className="h-4 w-4" />
            </div>
            <div className="min-w-0">
              <div className="text-sm font-medium leading-5 text-stone-900">{workoutRecommendation.title}</div>
              <p className="mt-0.5 text-sm leading-5 text-stone-600">{workoutRecommendation.body}</p>
            </div>
          </div>
        </section>
      </main>
    </ScreenContainer>
  );
};

export default ProgressWorkouts;
