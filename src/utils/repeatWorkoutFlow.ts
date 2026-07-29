import type { WorkoutEntry } from '../types/workout';
import { formatWorkoutMetricValue, normalizeWorkoutMetricType } from './workoutEntryMetric';

export interface RepeatWorkoutOption {
  exerciseId: string;
  exerciseName: string;
  sets: number;
  reps: number;
  weight: number;
  metricType: WorkoutEntry['metricType'];
  metricValueLabel: string;
  disabledReason?: string;
}

function getRepeatOptionDisabledReason(entry: WorkoutEntry): string | undefined {
  if (entry.exercise?.is_custom === true && entry.exercise.archived_at) {
    const exerciseName = entry.exercise.name?.trim() || entry.exercise_name_snapshot?.trim() || 'Архивное упражнение';
    return `Архивное пользовательское упражнение: ${exerciseName}. Сначала восстановите упражнение.`;
  }

  return undefined;
}

export function buildRepeatWorkoutOptions(entries: WorkoutEntry[]): RepeatWorkoutOption[] {
  const options = new Map<string, RepeatWorkoutOption>();

  entries.forEach((entry) => {
    if (!entry.exercise_id) return;

    const disabledReason = getRepeatOptionDisabledReason(entry);
    const existing = options.get(entry.exercise_id);
    if (existing) {
      if (disabledReason && !existing.disabledReason) {
        options.set(entry.exercise_id, { ...existing, disabledReason });
      }
      return;
    }

    options.set(entry.exercise_id, {
      exerciseId: entry.exercise_id,
      exerciseName: entry.exercise?.name || entry.exercise_name_snapshot || 'Неизвестное упражнение',
      sets: entry.sets,
      reps: entry.reps,
      weight: entry.displayAmount ?? entry.weight,
      metricType: normalizeWorkoutMetricType(entry.metricType),
      metricValueLabel: formatWorkoutMetricValue(
        entry.displayAmount ?? entry.weight,
        normalizeWorkoutMetricType(entry.metricType),
        entry.metricUnit ?? entry.displayUnit,
      ),
      disabledReason,
    });
  });

  return Array.from(options.values());
}

export function getDefaultRepeatTargetDate(today = new Date()): string {
  const year = today.getFullYear();
  const month = String(today.getMonth() + 1).padStart(2, '0');
  const day = String(today.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

export async function runRepeatWorkoutCopy(params: {
  copyWorkoutEntriesToDate: (userId: string, sourceDate: string, targetDate: string, exerciseIds: string[]) => Promise<unknown>;
  userId: string;
  sourceDate: string;
  targetDate: string;
  exerciseIds: string[];
}): Promise<{ selectedDate: string; successMessage: string }> {
  await params.copyWorkoutEntriesToDate(params.userId, params.sourceDate, params.targetDate, params.exerciseIds);
  return {
    selectedDate: params.targetDate,
    successMessage: `Упражнения добавлены в тренировку на ${params.targetDate}`,
  };
}
