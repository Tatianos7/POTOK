import { getExerciseStableContentId, isLikelyUuid } from './exerciseMedia';
import { exerciseContentMap } from '../data/exerciseContent';
import { resolveCanonicalExerciseContentIdByName } from './exerciseContentLookup';

type ExerciseLike = {
  exercise_id?: string | null;
  content_id?: string | null;
  canonical_exercise_id?: string | null;
  slug?: string | null;
  key?: string | null;
  name?: string | null;
  user_id?: string | null;
  created_by_user_id?: string | null;
  source?: string | null;
} | null | undefined;

export function normalizeExerciseDisplayName(name?: string | null) {
  return String(name ?? '')
    .toLowerCase()
    .replace(/ё/g, 'е')
    .replace(/[«»"'`]/g, '')
    .replace(/\([^)]*\)/g, ' ')
    .replace(/[!?.,:;+/\\]+/g, ' ')
    .replace(/[–—-]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

const canonicalContentIds = new Set(Object.keys(exerciseContentMap));
const canonicalExerciseNameToId = new Map(
  Object.values(exerciseContentMap)
    .map((exercise) => [normalizeExerciseDisplayName(exercise.exercise_name), exercise.exercise_id] as const)
    .filter(([name]) => Boolean(name)),
);
const canonicalExerciseNames = new Set(canonicalExerciseNameToId.keys());

export function getExerciseDedupKey(exercise: ExerciseLike) {
  const stableContentId = getExerciseStableContentId(exercise);

  if (stableContentId && !isLikelyUuid(stableContentId)) {
    return stableContentId;
  }

  const normalizedName = normalizeExerciseDisplayName(exercise?.name);

  if (!normalizedName) {
    return null;
  }

  return resolveCanonicalExerciseContentIdByName(exercise?.name)
    ?? canonicalExerciseNameToId.get(normalizedName)
    ?? normalizedName;
}

function isUserExercise(exercise: ExerciseLike) {
  return Boolean(
    exercise?.user_id
      || exercise?.created_by_user_id
      || exercise?.source === 'user',
  );
}

function isCanonicalExercise(exercise: ExerciseLike) {
  const idCandidates = [
    exercise?.exercise_id,
    exercise?.content_id,
    exercise?.canonical_exercise_id,
  ]
    .map((value) => String(value ?? '').trim())
    .filter(Boolean);

  if (idCandidates.some((candidate) => canonicalContentIds.has(candidate))) {
    return true;
  }

  const normalizedName = normalizeExerciseDisplayName(exercise?.name);

  if (normalizedName && canonicalExerciseNames.has(normalizedName)) {
    return true;
  }

  return Boolean(resolveCanonicalExerciseContentIdByName(exercise?.name));
}

function hasCanonicalContentId(exercise: ExerciseLike) {
  const stableContentId = getExerciseStableContentId(exercise);
  return Boolean(stableContentId && canonicalContentIds.has(stableContentId));
}

function getExercisePriority(exercise: ExerciseLike) {
  if (isUserExercise(exercise)) {
    return 4;
  }

  if (hasCanonicalContentId(exercise)) {
    return 3;
  }

  if (isCanonicalExercise(exercise)) {
    return 2;
  }

  return 1;
}

export function dedupeExercisesForUi<T extends ExerciseLike>(exercises: T[]) {
  const seen = new Map<string, { exercise: T; index: number }>();
  const result: T[] = [];

  for (const exercise of exercises) {
    if (isUserExercise(exercise)) {
      result.push(exercise);
      continue;
    }

    const dedupKey = getExerciseDedupKey(exercise);

    if (!dedupKey) {
      result.push(exercise);
      continue;
    }

    const existing = seen.get(dedupKey);

    if (!existing) {
      seen.set(dedupKey, { exercise, index: result.length });
      result.push(exercise);
      continue;
    }

    const nextPriority = getExercisePriority(exercise);
    const existingPriority = getExercisePriority(existing.exercise);

    if (nextPriority > existingPriority) {
      result[existing.index] = exercise;
      seen.set(dedupKey, { exercise, index: existing.index });
    }
  }

  return result;
}
