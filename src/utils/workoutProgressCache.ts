import type { WorkoutProgressObservation } from '../types/workout';

export interface WorkoutProgressObservationCache {
  userId: string;
  coveredTo: string;
  observations: WorkoutProgressObservation[];
}

function nextDay(date: string): string {
  const [year, month, day] = date.split('-').map(Number);
  const value = new Date(year, month - 1, day);
  value.setDate(value.getDate() + 1);
  return `${value.getFullYear()}-${String(value.getMonth() + 1).padStart(2, '0')}-${String(value.getDate()).padStart(2, '0')}`;
}

export function cacheCoversWorkoutProgressPeriod(
  cache: WorkoutProgressObservationCache | null,
  userId: string,
  requestedTo: string,
): boolean {
  return Boolean(cache && cache.userId === userId && cache.coveredTo >= requestedTo);
}

export function getWorkoutProgressHistoryFetchRange(
  cache: WorkoutProgressObservationCache | null,
  userId: string,
  requestedTo: string,
  fullHistoryStart: string,
): { shouldFetch: boolean; from: string; to: string } {
  if (!cache || cache.userId !== userId) {
    return {
      shouldFetch: true,
      from: fullHistoryStart,
      to: requestedTo,
    };
  }

  if (cache.coveredTo >= requestedTo) {
    return {
      shouldFetch: false,
      from: '',
      to: requestedTo,
    };
  }

  return {
    shouldFetch: true,
    from: nextDay(cache.coveredTo),
    to: requestedTo,
  };
}

export function mergeWorkoutProgressObservationCache(
  cache: WorkoutProgressObservationCache | null,
  userId: string,
  requestedTo: string,
  nextObservations: WorkoutProgressObservation[],
): WorkoutProgressObservationCache {
  const merged = new Map<string, WorkoutProgressObservation>();

  if (cache && cache.userId === userId) {
    cache.observations.forEach((observation) => {
      merged.set(observation.entryId, observation);
    });
  }

  nextObservations.forEach((observation) => {
    merged.set(observation.entryId, observation);
  });

  const observations = Array.from(merged.values()).sort((a, b) =>
    a.date.localeCompare(b.date) ||
    (a.createdAt ?? '').localeCompare(b.createdAt ?? '') ||
    a.entryId.localeCompare(b.entryId),
  );

  return {
    userId,
    coveredTo: cache && cache.userId === userId && cache.coveredTo > requestedTo ? cache.coveredTo : requestedTo,
    observations,
  };
}
