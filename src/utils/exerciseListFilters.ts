import type { Exercise, Muscle } from '../types/workout';
import { normalizeMuscleName, normalizeMuscleNames } from './muscleNormalizer';

export function deriveAvailableMuscles(exercises: Exercise[]): Muscle[] {
  const musclesMap = new Map<string, Muscle>();

  exercises.forEach((exercise) => {
    exercise.muscles?.forEach((muscle) => {
      const normalizedName = normalizeMuscleName(muscle.name || '');
      if (!normalizedName) return;
      if (!musclesMap.has(normalizedName)) {
        musclesMap.set(normalizedName, { id: normalizedName, name: normalizedName });
      }
    });
  });

  return Array.from(musclesMap.values()).sort((a, b) => a.name.localeCompare(b.name, 'ru'));
}

export function dedupeExercisesForList(exercises: Exercise[]): Exercise[] {
  const exercisesMap = new Map<string, Exercise>();

  exercises.forEach((exercise) => {
    const exerciseName = exercise.name.trim();
    if (!exerciseName) return;

    const currentMuscles = exercise.muscles ?? [];
    const existing = exercisesMap.get(exerciseName);
    if (!existing) {
      exercisesMap.set(exerciseName, exercise);
      return;
    }

    const existingMuscles = existing.muscles ?? [];
    const existingHasMuscles = existingMuscles.length > 0;
    const currentHasMuscles = currentMuscles.length > 0;

    if (currentHasMuscles && !existingHasMuscles) {
      exercisesMap.set(exerciseName, exercise);
      return;
    }

    if (!currentHasMuscles && existingHasMuscles) {
      return;
    }

    const mergedMuscles = normalizeMuscleNames([
      ...existingMuscles.map((muscle) => muscle.name),
      ...currentMuscles.map((muscle) => muscle.name),
    ]).map((name) => ({ id: name, name }));

    exercisesMap.set(exerciseName, {
      ...existing,
      muscles: mergedMuscles,
    });
  });

  return Array.from(exercisesMap.values());
}

export function filterExercisesForList(
  exercises: Exercise[],
  searchTerm: string,
  selectedMuscles: Set<string>,
): Exercise[] {
  let filtered = dedupeExercisesForList(exercises);

  if (searchTerm.trim()) {
    const term = searchTerm.toLowerCase();
    filtered = filtered.filter(
      (exercise) =>
        exercise.name.toLowerCase().includes(term) ||
        exercise.muscles?.some((muscle) => (muscle.name || '').toLowerCase().includes(term)),
    );
  }

  if (selectedMuscles.size > 0) {
    filtered = filtered.filter((exercise) => {
      if (!exercise.muscles || exercise.muscles.length === 0) return false;
      return exercise.muscles.some((muscle) => {
        const normalizedName = normalizeMuscleName(muscle.name || '');
        return selectedMuscles.has(muscle.name) || selectedMuscles.has(normalizedName);
      });
    });
  }

  return filtered;
}
