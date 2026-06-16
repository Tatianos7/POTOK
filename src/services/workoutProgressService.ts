import { exerciseContentMap } from '../data/exerciseContent';
import { getMuscleLabel } from '../data/muscles/muscleLabels';
import { muscleMapRegions } from '../data/muscles/muscleMapRegions';
import { isMuscleKey, type MuscleKey } from '../data/muscles/types';
import type { WorkoutEntry } from '../types/workout';
import { getExerciseContentForExercise } from '../utils/exerciseContentLookup';
import { resolveWorkoutMuscleKeys } from '../utils/workoutMuscleKeyResolver';
import { calculateVolume } from '../utils/workoutMetrics';
import { workoutService } from './workoutService';

export type WorkoutProgressPeriod = 'week' | 'month' | 'custom';

export type WorkoutProgressStatus = 'trained' | 'undertrained' | 'missing';

export interface WorkoutProgressTopMuscle {
  muscleKey: string;
  label: string;
  score: number;
  primaryCount: number;
  secondaryCount: number;
}

export interface WorkoutProgressCoverageRow {
  muscleKey: string;
  label: string;
  primaryCount: number;
  secondaryCount: number;
  score: number;
  status: WorkoutProgressStatus;
}

export interface WorkoutProgressUndertrainedMuscle {
  muscleKey: string;
  label: string;
  reason: string;
}

export interface WorkoutProgressSummary {
  totalWorkouts: number;
  totalExercises: number;
  totalSets: number;
  totalVolume: number;
  topMuscles: WorkoutProgressTopMuscle[];
  muscleCoverage: WorkoutProgressCoverageRow[];
  undertrainedMuscles: WorkoutProgressUndertrainedMuscle[];
}

export interface GetWorkoutProgressSummaryInput {
  userId: string;
  dateFrom: string;
  dateTo: string;
  period?: WorkoutProgressPeriod;
}

type MuscleAccumulator = {
  primaryCount: number;
  secondaryCount: number;
  score: number;
};

const PRIMARY_MUSCLE_WEIGHT = 2;
const SECONDARY_MUSCLE_WEIGHT = 1;
const TOP_MUSCLE_LIMIT = 8;

const PERIOD_SCORE_TARGET: Record<WorkoutProgressPeriod, number> = {
  week: 4,
  month: 12,
  custom: 6,
};

const COVERAGE_KEY_ALIASES: Partial<Record<MuscleKey, MuscleKey>> = {
  middle_delts: 'side_delts',
  forearms_back: 'forearms',
  core: 'abs',
  core_muscles: 'abs',
  traps: 'trapezoid',
  trapezius: 'trapezoid',
  lower_traps: 'trapezoid',
};

function canonicalizeCoverageMuscleKey(key: string): MuscleKey | null {
  if (!isMuscleKey(key)) {
    return null;
  }

  const canonical = COVERAGE_KEY_ALIASES[key] ?? key;
  if (canonical === 'cardio') {
    return null;
  }

  return canonical;
}

function isCardioExerciseContent(content: { category?: string | null }): boolean {
  return content.category === 'cardio';
}

function isCardioWorkoutEntry(entry: WorkoutEntry): boolean {
  return entry.exercise?.category_id === 'cardio';
}

function getExerciseLinkedMuscleCandidates(exercise: WorkoutEntry['exercise']): string[] {
  return (exercise?.muscles ?? []).flatMap((muscle) => [
    muscle.canonical_muscle_id ?? '',
    muscle.id ?? '',
    muscle.name ?? '',
  ]);
}

function getFallbackWorkoutMuscles(entry: WorkoutEntry): { primaryMuscles: MuscleKey[]; secondaryMuscles: MuscleKey[] } {
  if (isCardioWorkoutEntry(entry)) {
    return { primaryMuscles: [], secondaryMuscles: [] };
  }

  const exercisePrimaryMuscles = entry.exercise?.primary_muscles?.filter((value): value is string => Boolean(value?.trim())) ?? [];
  const exerciseSecondaryMuscles = entry.exercise?.secondary_muscles?.filter((value): value is string => Boolean(value?.trim())) ?? [];
  const linkedMuscles = getExerciseLinkedMuscleCandidates(entry.exercise);

  const primaryMuscles = resolveWorkoutMuscleKeys(exercisePrimaryMuscles.length > 0 ? exercisePrimaryMuscles : linkedMuscles)
    .map(canonicalizeCoverageMuscleKey)
    .filter((key): key is MuscleKey => Boolean(key));
  const primarySet = new Set(primaryMuscles);
  const secondaryMuscles = resolveWorkoutMuscleKeys(exerciseSecondaryMuscles)
    .map(canonicalizeCoverageMuscleKey)
    .filter((key): key is MuscleKey => key !== null && !primarySet.has(key));

  return { primaryMuscles, secondaryMuscles };
}

function getSnapshotWorkoutMuscles(entry: WorkoutEntry): { primaryMuscles: MuscleKey[]; secondaryMuscles: MuscleKey[] } | null {
  const primaryMuscles = (entry.primary_muscles_snapshot ?? [])
    .map(canonicalizeCoverageMuscleKey)
    .filter((key): key is MuscleKey => Boolean(key));
  const primarySet = new Set(primaryMuscles);
  const secondaryMuscles = (entry.secondary_muscles_snapshot ?? [])
    .map(canonicalizeCoverageMuscleKey)
    .filter((key): key is MuscleKey => key !== null && !primarySet.has(key));

  if (primaryMuscles.length > 0 || secondaryMuscles.length > 0) {
    return { primaryMuscles, secondaryMuscles };
  }

  const jsonMuscles = entry.muscles_snapshot ?? [];
  if (jsonMuscles.length === 0) {
    return null;
  }

  const jsonPrimary = jsonMuscles
    .filter((item) => item.source !== 'secondary')
    .map((item) => canonicalizeCoverageMuscleKey(item.key))
    .filter((key): key is MuscleKey => Boolean(key));
  const jsonPrimarySet = new Set(jsonPrimary);
  const jsonSecondary = jsonMuscles
    .filter((item) => item.source === 'secondary')
    .map((item) => canonicalizeCoverageMuscleKey(item.key))
    .filter((key): key is MuscleKey => key !== null && !jsonPrimarySet.has(key));

  return jsonPrimary.length > 0 || jsonSecondary.length > 0
    ? { primaryMuscles: jsonPrimary, secondaryMuscles: jsonSecondary }
    : null;
}

function buildCoverageMuscleKeys(): MuscleKey[] {
  const keys = new Set<MuscleKey>();

  Object.values(exerciseContentMap).forEach((item) => {
    if (isCardioExerciseContent(item)) {
      return;
    }

    [...item.primary_muscles, ...item.secondary_muscles].forEach((rawKey) => {
      const canonical = canonicalizeCoverageMuscleKey(rawKey);
      if (canonical) {
        keys.add(canonical);
      }
    });
  });

  Object.entries(muscleMapRegions).forEach(([rawKey, regions]) => {
    if (!regions.front?.length && !regions.back?.length) {
      return;
    }

    const canonical = canonicalizeCoverageMuscleKey(rawKey);
    if (canonical) {
      keys.add(canonical);
    }
  });

  return Array.from(keys).sort((a, b) => getMuscleLabel(a).localeCompare(getMuscleLabel(b), 'ru'));
}

export const DEFAULT_WORKOUT_COVERAGE_KEYS = buildCoverageMuscleKeys();

function createAccumulator(): MuscleAccumulator {
  return {
    primaryCount: 0,
    secondaryCount: 0,
    score: 0,
  };
}

function getEntrySetCount(entry: WorkoutEntry): number {
  return Math.max(0, Number(entry.sets) || 0);
}

function getEntryExposureMultiplier(entry: WorkoutEntry): number {
  return Math.max(1, getEntrySetCount(entry));
}

function getEntryVolume(entry: WorkoutEntry): number {
  const metricType = entry.metricType ?? 'weight';
  if (metricType !== 'weight' && metricType !== 'bodyweight') {
    return 0;
  }

  return calculateVolume(
    Math.max(0, Number(entry.sets) || 0),
    Math.max(0, Number(entry.reps) || 0),
    Math.max(0, Number(entry.weight) || 0),
  );
}

function incrementMuscle(
  accumulator: Map<MuscleKey, MuscleAccumulator>,
  muscleKey: MuscleKey,
  role: 'primary' | 'secondary',
  exposureMultiplier: number,
) {
  const current = accumulator.get(muscleKey) ?? createAccumulator();
  if (role === 'primary') {
    current.primaryCount += exposureMultiplier;
    current.score += PRIMARY_MUSCLE_WEIGHT * exposureMultiplier;
  } else {
    current.secondaryCount += exposureMultiplier;
    current.score += SECONDARY_MUSCLE_WEIGHT * exposureMultiplier;
  }
  accumulator.set(muscleKey, current);
}

function incrementMuscleKeys(
  accumulator: Map<MuscleKey, MuscleAccumulator>,
  muscleKeys: MuscleKey[],
  role: 'primary' | 'secondary',
  exposureMultiplier: number,
) {
  muscleKeys.forEach((muscleKey) => {
    incrementMuscle(accumulator, muscleKey, role, exposureMultiplier);
  });
}

function buildCoverageStatus(score: number, period: WorkoutProgressPeriod): WorkoutProgressStatus {
  if (score <= 0) {
    return 'missing';
  }

  return score < PERIOD_SCORE_TARGET[period] ? 'undertrained' : 'trained';
}

function buildUndertrainedReason(
  muscleKey: MuscleKey,
  score: number,
  status: WorkoutProgressStatus,
  period: WorkoutProgressPeriod,
): string {
  if (status === 'missing') {
    return `За выбранный период не найдено упражнений на группу "${getMuscleLabel(muscleKey)}".`;
  }

  return `Нагрузка на группу "${getMuscleLabel(muscleKey)}" ниже целевого порога ${PERIOD_SCORE_TARGET[period]} (текущий score: ${score}).`;
}

export function buildWorkoutProgressSummaryFromEntries(
  entries: WorkoutEntry[],
  period: WorkoutProgressPeriod = 'custom',
): WorkoutProgressSummary {
  const totalWorkouts = new Set(
    entries
      .map((entry) => entry.workout_day?.date || entry.workout_day_id)
      .filter(Boolean),
  ).size;

  const accumulator = new Map<MuscleKey, MuscleAccumulator>();
  let totalSets = 0;
  let totalVolume = 0;

  entries.forEach((entry) => {
    totalSets += getEntrySetCount(entry);
    totalVolume += getEntryVolume(entry);

    const exposureMultiplier = getEntryExposureMultiplier(entry);
    const snapshotMuscles = getSnapshotWorkoutMuscles(entry);
    if (snapshotMuscles) {
      incrementMuscleKeys(accumulator, snapshotMuscles.primaryMuscles, 'primary', exposureMultiplier);
      incrementMuscleKeys(accumulator, snapshotMuscles.secondaryMuscles, 'secondary', exposureMultiplier);
      return;
    }

    const content = getExerciseContentForExercise({
      exercise_id: entry.exercise_id,
      canonical_exercise_id: entry.canonical_exercise_id,
      name: entry.exercise?.name,
      category: entry.exercise?.category_id,
      exercise: entry.exercise,
    });

    if (content) {
      if (isCardioExerciseContent(content)) {
        return;
      }

      const primaryMuscles = content.primary_muscles
        .map(canonicalizeCoverageMuscleKey)
        .filter((key): key is MuscleKey => Boolean(key));
      const primarySet = new Set(primaryMuscles);
      const secondaryMuscles = content.secondary_muscles
        .map(canonicalizeCoverageMuscleKey)
        .filter((key): key is MuscleKey => key !== null && !primarySet.has(key));

      incrementMuscleKeys(accumulator, primaryMuscles, 'primary', exposureMultiplier);
      incrementMuscleKeys(accumulator, secondaryMuscles, 'secondary', exposureMultiplier);
      return;
    }

    const fallbackMuscles = getFallbackWorkoutMuscles(entry);
    incrementMuscleKeys(accumulator, fallbackMuscles.primaryMuscles, 'primary', exposureMultiplier);
    incrementMuscleKeys(accumulator, fallbackMuscles.secondaryMuscles, 'secondary', exposureMultiplier);
  });

  const muscleCoverage = DEFAULT_WORKOUT_COVERAGE_KEYS.map((muscleKey) => {
    const current = accumulator.get(muscleKey) ?? createAccumulator();
    const status = buildCoverageStatus(current.score, period);

    return {
      muscleKey,
      label: getMuscleLabel(muscleKey),
      primaryCount: current.primaryCount,
      secondaryCount: current.secondaryCount,
      score: current.score,
      status,
    } satisfies WorkoutProgressCoverageRow;
  });

  const topMuscles = muscleCoverage
    .filter((item) => item.score > 0)
    .sort((a, b) => (
      b.score - a.score ||
      b.primaryCount - a.primaryCount ||
      a.label.localeCompare(b.label, 'ru')
    ))
    .slice(0, TOP_MUSCLE_LIMIT)
    .map((item) => ({
      muscleKey: item.muscleKey,
      label: item.label,
      score: item.score,
      primaryCount: item.primaryCount,
      secondaryCount: item.secondaryCount,
    }));

  const undertrainedMuscles = muscleCoverage
    .filter((item) => item.status !== 'trained')
    .map((item) => ({
      muscleKey: item.muscleKey,
      label: item.label,
      reason: buildUndertrainedReason(item.muscleKey as MuscleKey, item.score, item.status, period),
    }));

  return {
    totalWorkouts,
    totalExercises: entries.length,
    totalSets,
    totalVolume,
    topMuscles,
    muscleCoverage,
    undertrainedMuscles,
  };
}

export async function getWorkoutProgressSummary({
  userId,
  dateFrom,
  dateTo,
  period = 'custom',
}: GetWorkoutProgressSummaryInput): Promise<WorkoutProgressSummary> {
  const entries = await workoutService.getWorkoutProgressEntryDetails(userId, dateFrom, dateTo);
  return buildWorkoutProgressSummaryFromEntries(entries, period);
}

export const workoutProgressService = {
  getWorkoutProgressSummary,
};
