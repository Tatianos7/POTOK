import type { PersistedWorkoutExerciseMediaItem } from '../services/userExerciseMediaService';
import type { WorkoutEntry } from '../types/workout';
import { formatWorkoutMetricValue, normalizeWorkoutMetricType } from './workoutEntryMetric';

export interface WorkoutExerciseProgressMetricRow {
  date: string;
  entryId: string;
  exerciseName: string;
  sets: number;
  reps: number;
  metricValueLabel: string;
}

export interface WorkoutExerciseProgressMediaGroup {
  date: string;
  items: PersistedWorkoutExerciseMediaItem[];
}

function compareWorkoutEntries(left: WorkoutEntry, right: WorkoutEntry): number {
  return (
    (left.workout_day?.date ?? '').localeCompare(right.workout_day?.date ?? '') ||
    (left.created_at ?? '').localeCompare(right.created_at ?? '') ||
    left.id.localeCompare(right.id)
  );
}

export function getWorkoutExerciseProgressGroupKey(entry: Pick<WorkoutEntry, 'canonical_exercise_id' | 'exercise_id'>): string {
  return entry.canonical_exercise_id ?? entry.exercise_id;
}

export function buildWorkoutExerciseProgressMetricRows(
  entries: WorkoutEntry[],
  exerciseGroupKey: string,
): WorkoutExerciseProgressMetricRow[] {
  return entries
    .filter((entry) => getWorkoutExerciseProgressGroupKey(entry) === exerciseGroupKey)
    .slice()
    .sort(compareWorkoutEntries)
    .reverse()
    .flatMap((entry) => {
      const date = entry.workout_day?.date;
      if (!date) return [];

      return [{
        date,
        entryId: entry.id,
        exerciseName: entry.exercise?.name ?? 'Упражнение',
        sets: Number(entry.sets) || 0,
        reps: Number(entry.reps) || 0,
        metricValueLabel: formatWorkoutMetricValue(
          entry.displayAmount ?? entry.weight,
          normalizeWorkoutMetricType(entry.metricType),
          entry.metricUnit ?? entry.displayUnit,
        ),
      }];
    });
}

export function groupWorkoutExerciseProgressMediaByDate(
  items: PersistedWorkoutExerciseMediaItem[],
  fallbackDatesByWorkoutEntryId: Map<string, string> = new Map(),
): WorkoutExerciseProgressMediaGroup[] {
  const groups = new Map<string, PersistedWorkoutExerciseMediaItem[]>();

  items.forEach((item) => {
    const date = item.workout_date ?? (item.workout_entry_id ? fallbackDatesByWorkoutEntryId.get(item.workout_entry_id) : null);
    if (!date) return;

    const current = groups.get(date) ?? [];
    current.push(item);
    groups.set(date, current);
  });

  return Array.from(groups.entries())
    .map(([date, groupedItems]) => ({
      date,
      items: groupedItems
        .slice()
        .sort((left, right) => right.created_at.localeCompare(left.created_at) || right.file_path.localeCompare(left.file_path)),
    }))
    .sort((left, right) => right.date.localeCompare(left.date));
}
