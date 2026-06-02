import type { Exercise, Muscle } from '../types/workout';
import type { ExerciseCategory } from '../types/workout';
import { getExerciseContentForExercise } from './exerciseContentLookup';
import { normalizeMuscleName, normalizeMuscleNames } from './muscleNormalizer';

type CategoryMuscleFilter = {
  id: string;
  name: string;
  muscleKeys: readonly string[];
  muscleNames?: readonly string[];
};

const CATEGORY_MUSCLE_FILTERS: Record<string, readonly CategoryMuscleFilter[]> = {
  arms: [
    { id: 'arms-biceps', name: 'Бицепс', muscleKeys: ['biceps'], muscleNames: ['Бицепс', 'Бицепсы'] },
    { id: 'arms-triceps', name: 'Трицепс', muscleKeys: ['triceps'], muscleNames: ['Трицепс', 'Трицепсы'] },
  ],
  chest: [
    {
      id: 'chest-main',
      name: 'Грудные мышцы',
      muscleKeys: ['chest'],
      muscleNames: ['Грудные мышцы', 'Грудь', 'Грудь — середина', 'Грудь (середина)', 'Средний пучок'],
    },
    {
      id: 'chest-upper',
      name: 'Верх грудных мышц',
      muscleKeys: ['upper_chest'],
      muscleNames: ['Верх грудных мышц', 'Грудь — верх', 'Грудь (верх)', 'Верхний пучок'],
    },
  ],
  back: [
    {
      id: 'back-lats',
      name: 'Широчайшие',
      muscleKeys: ['lats', 'teres_major'],
      muscleNames: ['Широчайшие', 'Широчайшие мышцы спины', 'Большая круглая мышца'],
    },
    {
      id: 'back-trapezius',
      name: 'Трапециевидные',
      muscleKeys: [
        'traps',
        'trapezius',
        'trapezoid',
        'upper_traps',
        'middle_traps',
        'lower_traps',
        'traps_upper',
        'traps_middle',
        'traps_lower',
      ],
      muscleNames: [
        'Трапециевидные',
        'Трапециевидная мышца',
        'Трапеции',
        'Трапеция',
        'Верх трапеций',
        'Средняя часть трапеций',
        'Нижняя часть трапеций',
      ],
    },
    {
      id: 'back-lower-back',
      name: 'Поясница',
      muscleKeys: ['lower_back'],
      muscleNames: ['Поясница'],
    },
    {
      id: 'back-erectors',
      name: 'Разгибатели спины',
      muscleKeys: ['erectors'],
      muscleNames: ['Разгибатели спины'],
    },
  ],
  legs: [
    {
      id: 'legs-quads',
      name: 'Квадрицепс',
      muscleKeys: ['quads'],
      muscleNames: ['Квадрицепс', 'Квадрицепсы'],
    },
    {
      id: 'legs-hamstrings',
      name: 'Бицепс бедра',
      muscleKeys: ['hamstrings'],
      muscleNames: ['Бицепс бедра', 'Задняя поверхность бедра'],
    },
    {
      id: 'legs-glutes',
      name: 'Ягодичные мышцы',
      muscleKeys: ['glutes'],
      muscleNames: ['Ягодичные мышцы', 'Ягодицы', 'Ягодичная'],
    },
    {
      id: 'legs-adductors',
      name: 'Приводящие мышцы',
      muscleKeys: ['adductors'],
      muscleNames: ['Приводящие мышцы', 'Приводящие'],
    },
    {
      id: 'legs-abductors',
      name: 'Отводящие мышцы бедра',
      muscleKeys: ['abductors'],
      muscleNames: ['Отводящие мышцы бедра', 'Отводящие мышцы'],
    },
    {
      id: 'legs-calves',
      name: 'Икроножные мышцы',
      muscleKeys: ['calves'],
      muscleNames: ['Икроножные мышцы', 'Икроножные'],
    },
  ],
  abs: [
    {
      id: 'abs-abs',
      name: 'Пресс',
      muscleKeys: ['abs', 'core', 'core_muscles', 'core_front', 'lower_abs', 'lower_core'],
      muscleNames: ['Пресс', 'Прямая мышца живота', 'Прямая — верх', 'Прямая — низ', 'Кор', 'Нижний кор'],
    },
    {
      id: 'abs-obliques',
      name: 'Косые мышцы живота',
      muscleKeys: ['obliques', 'obliques_front'],
      muscleNames: ['Косые мышцы живота', 'Косые мышцы', 'Косые'],
    },
  ],
};

function normalizeCategoryValue(value?: string | null) {
  return String(value ?? '').trim().toLowerCase();
}

function getCategoryFilterKey(category?: ExerciseCategory | null): string | null {
  const candidates = [
    normalizeCategoryValue(category?.id),
    normalizeCategoryValue(category?.name),
  ];

  if (candidates.some((value) => value === 'arms' || value === 'руки')) return 'arms';
  if (candidates.some((value) => value === 'chest' || value === 'грудь')) return 'chest';
  if (candidates.some((value) => value === 'back' || value === 'спина')) return 'back';
  if (candidates.some((value) => value === 'legs' || value === 'ноги')) return 'legs';
  if (candidates.some((value) => value === 'abs' || value === 'core' || value === 'пресс')) return 'abs';

  return null;
}

function getExercisePrimaryMuscleKeys(exercise: Exercise): string[] {
  const content = getExerciseContentForExercise({
    id: exercise.id,
    exercise_id: exercise.canonical_exercise_id ?? null,
    canonical_exercise_id: exercise.canonical_exercise_id ?? null,
    name: exercise.name,
    normalized_name: exercise.normalized_name ?? null,
    category_id: exercise.category_id,
    category: exercise.category,
  });

  return content?.primary_muscles ?? [];
}

function getCuratedFiltersForCategory(category?: ExerciseCategory | null) {
  const categoryKey = getCategoryFilterKey(category);
  return categoryKey ? CATEGORY_MUSCLE_FILTERS[categoryKey] : undefined;
}

function exerciseMatchesCuratedFilter(exercise: Exercise, filter: CategoryMuscleFilter) {
  const primaryKeys = getExercisePrimaryMuscleKeys(exercise);
  if (primaryKeys.length > 0) {
    const filterKeys = new Set(filter.muscleKeys);
    return primaryKeys.some((key) => filterKeys.has(key));
  }

  const filterNames = new Set([filter.name, ...(filter.muscleNames ?? [])].map(normalizeMuscleName));
  return (exercise.muscles ?? []).some((muscle) => filterNames.has(normalizeMuscleName(muscle.name || '')));
}

export function deriveAvailableMuscles(exercises: Exercise[], category?: ExerciseCategory | null): Muscle[] {
  const curatedFilters = getCuratedFiltersForCategory(category);

  if (curatedFilters) {
    return curatedFilters
      .filter((filter) => exercises.some((exercise) => exerciseMatchesCuratedFilter(exercise, filter)))
      .map((filter) => ({ id: filter.id, name: filter.name }));
  }

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
  category?: ExerciseCategory | null,
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
    const curatedFilters = getCuratedFiltersForCategory(category);

    if (curatedFilters) {
      const selectedFilters = curatedFilters.filter((filter) => selectedMuscles.has(filter.name));
      filtered = filtered.filter((exercise) =>
        selectedFilters.some((filter) => exerciseMatchesCuratedFilter(exercise, filter)),
      );
    } else {
      filtered = filtered.filter((exercise) => {
        if (!exercise.muscles || exercise.muscles.length === 0) return false;
        return exercise.muscles.some((muscle) => {
          const normalizedName = normalizeMuscleName(muscle.name || '');
          return selectedMuscles.has(muscle.name) || selectedMuscles.has(normalizedName);
        });
      });
    }
  }

  return filtered;
}
