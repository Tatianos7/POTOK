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
}

export function buildRepeatWorkoutOptions(entries: WorkoutEntry[]): RepeatWorkoutOption[] {
  const seen = new Set<string>();
  return entries
    .filter((entry) => {
      if (!entry.exercise_id || seen.has(entry.exercise_id)) {
        return false;
      }
      seen.add(entry.exercise_id);
      return true;
    })
    .map((entry) => ({
      exerciseId: entry.exercise_id,
      exerciseName: entry.exercise?.name || 'Неизвестное упражнение',
      sets: entry.sets,
      reps: entry.reps,
      weight: entry.displayAmount ?? entry.weight,
      metricType: normalizeWorkoutMetricType(entry.metricType),
      metricValueLabel: formatWorkoutMetricValue(
        entry.displayAmount ?? entry.weight,
        normalizeWorkoutMetricType(entry.metricType),
        entry.metricUnit ?? entry.displayUnit,
      ),
    }));
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
