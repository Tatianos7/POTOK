export interface TodayGoalSummary {
  goalType: string;
  startWeight?: number;
  currentWeight?: number;
  targetWeight?: number;
}

export interface TodayGoalStorageReader {
  getItem(key: string): string | null;
}

function toWeight(value: unknown): number | undefined {
  const weight = Number(value);
  return Number.isFinite(weight) && weight > 0 ? weight : undefined;
}

function parseTodayGoalSummary(raw: string | null): TodayGoalSummary | null {
  if (!raw) return null;

  try {
    const parsed = JSON.parse(raw) as unknown;
    if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) return null;

    const payload = parsed as Record<string, unknown>;
    const goalType = String(payload.goalType ?? payload.goal_type ?? '');
    const currentWeight = toWeight(payload.currentWeight ?? payload.current_weight);
    const targetWeight = toWeight(payload.targetWeight ?? payload.target_weight);
    const startWeight =
      toWeight(payload.startWeight ?? payload.start_weight ?? payload.initialWeight) ?? currentWeight;
    const hasGoalPayload = Boolean(
      goalType || currentWeight || targetWeight || payload.calories || payload.proteins || payload.protein,
    );

    if (!hasGoalPayload) return null;

    return {
      goalType: goalType || 'maintain',
      startWeight,
      currentWeight,
      targetWeight,
    };
  } catch {
    return null;
  }
}

export function getTodayGoalSummaryForUser(
  currentUserId: string | null | undefined,
  storage?: TodayGoalStorageReader | null,
): TodayGoalSummary | null {
  const normalizedUserId = currentUserId?.trim();
  if (!normalizedUserId) return null;

  try {
    const resolvedStorage =
      storage === undefined ? (typeof window === 'undefined' ? null : window.localStorage) : storage;
    if (!resolvedStorage) return null;

    return parseTodayGoalSummary(resolvedStorage.getItem(`goal_${normalizedUserId}`));
  } catch {
    return null;
  }
}
