import type { WorkoutEntry } from '../types/workout';

export const removeWorkoutEntryFromList = (entries: WorkoutEntry[], entryId: string): WorkoutEntry[] =>
  entries.filter((entry) => entry.id !== entryId);

export const clearWorkoutEntriesForDay = (): WorkoutEntry[] => [];

export const updateWorkoutEntryInList = (
  entries: WorkoutEntry[],
  entryId: string,
  updates: Pick<WorkoutEntry, 'sets' | 'reps' | 'weight' | 'displayAmount' | 'displayUnit' | 'metricType' | 'metricUnit'>,
): WorkoutEntry[] =>
  entries.map((entry) =>
    entry.id === entryId
      ? {
          ...entry,
          sets: updates.sets,
          reps: updates.reps,
          weight: updates.weight,
          displayAmount: updates.displayAmount,
          displayUnit: updates.displayUnit,
          metricType: updates.metricType,
          metricUnit: updates.metricUnit,
        }
      : entry,
  );
