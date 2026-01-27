import type { WorkoutEntry } from '../types/workout';

export const calculateVolume = (sets: number, reps: number, weight: number): number =>
  (Number(sets) || 0) * (Number(reps) || 0) * (Number(weight) || 0);

// Epley formula (weight * (1 + reps/30))
export const estimateOneRepMax = (weight: number, reps: number): number => {
  const safeWeight = Number(weight) || 0;
  const safeReps = Number(reps) || 0;
  if (safeWeight <= 0 || safeReps <= 0) return 0;
  return safeWeight * (1 + safeReps / 30);
};

export const aggregateWorkoutEntries = (entries: WorkoutEntry[]) => {
  const totals = entries.reduce(
    (acc, entry) => {
      acc.volume += calculateVolume(entry.sets, entry.reps, entry.weight);
      acc.sets += entry.sets;
      acc.reps += entry.reps;
      return acc;
    },
    { volume: 0, sets: 0, reps: 0 }
  );

  return {
    ...totals,
    exercises: entries.length,
  };
};
