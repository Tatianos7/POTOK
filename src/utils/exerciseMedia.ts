const CATEGORY_MAP: Record<string, string> = {
  руки: 'arms',
  плечи: 'shoulders',
  грудь: 'chest',
  спина: 'back',
  ноги: 'legs',
  ягодицы: 'glutes',
  пресс: 'abs',
  кардио: 'cardio',
};

type ExerciseLike = {
  exercise_id?: string | null;
  content_id?: string | null;
  canonical_exercise_id?: string | null;
  slug?: string | null;
  key?: string | null;
} | null | undefined;

export function isLikelyUuid(value?: string | null) {
  if (!value) {
    return false;
  }

  return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value);
}

export function normalizeExerciseCategory(category?: string | null) {
  const normalized = String(category ?? '').trim().toLowerCase();

  if (!normalized) {
    return null;
  }

  return CATEGORY_MAP[normalized] ?? normalized;
}

export function buildExerciseImageUrl(exerciseId?: string | null, category?: string | null) {
  const normalizedExerciseId = String(exerciseId ?? '').trim();
  const normalizedCategory = normalizeExerciseCategory(category);

  if (!normalizedExerciseId || !normalizedCategory) {
    return null;
  }

  return `/exercises/${normalizedCategory}/${normalizedExerciseId}.png`;
}

export function getExerciseStableContentId(exercise: ExerciseLike) {
  const candidates = [
    exercise?.exercise_id,
    exercise?.content_id,
    exercise?.canonical_exercise_id,
    exercise?.slug,
    exercise?.key,
  ];

  for (const candidate of candidates) {
    const normalizedCandidate = String(candidate ?? '').trim();

    if (!normalizedCandidate || isLikelyUuid(normalizedCandidate)) {
      continue;
    }

    return normalizedCandidate;
  }

  return null;
}
