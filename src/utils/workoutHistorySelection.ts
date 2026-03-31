import type { WorkoutHistoryDaySummary } from '../types/workout';

export function findWorkoutHistoryDaySummary(
  items: WorkoutHistoryDaySummary[],
  selectedDate: string | null,
): WorkoutHistoryDaySummary | null {
  if (!selectedDate) return null;
  return items.find((item) => item.date === selectedDate) ?? null;
}
