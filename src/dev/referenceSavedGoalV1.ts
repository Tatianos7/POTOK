/** A saved point-target snapshot for the isolated reference test. Never an admitted
 * GoalNutritionTargetV1, medical policy or permission to activate a plan. */
export const referenceSavedGoalScope = 'SAVED_POINT_TARGETS_NOT_ADMITTED_POLICY';
export interface ReferenceSavedGoal {
  scope: typeof referenceSavedGoalScope; accountId: string; goalRevision: string | null; updatedAt: string;
  calories: number; protein: number; fat: number; carbs: number;
}
const uuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
export function decodeReferenceSavedGoal(value: unknown): ReferenceSavedGoal {
  if (!value || typeof value !== 'object' || Array.isArray(value)) throw Error('INVALID_SAVED_GOAL');
  const r = value as Record<string, unknown>;
  if (Object.keys(r).sort().join(',') !== 'accountId,calories,carbs,fat,goalRevision,protein,scope,updatedAt'
    || r.scope !== referenceSavedGoalScope || typeof r.accountId !== 'string' || !uuid.test(r.accountId)
    || (r.goalRevision !== null && (typeof r.goalRevision !== 'string' || !uuid.test(r.goalRevision)))
    || typeof r.updatedAt !== 'string' || r.updatedAt.length > 50
    || !/^\d{4}-\d{2}-\d{2}T.*(?:Z|[+-]\d{2}:\d{2})$/.test(r.updatedAt) || !Number.isFinite(Date.parse(r.updatedAt))) throw Error('INVALID_SAVED_GOAL');
  for (const axis of ['calories', 'protein', 'fat', 'carbs'] as const) {
    if (typeof r[axis] !== 'number' || !Number.isFinite(r[axis]) || Number(r[axis]) < 0 || Number(r[axis]) > 10000) throw Error('INVALID_SAVED_GOAL');
  }
  if (!Number.isInteger(r.calories) || Number(r.calories) <= 50 || Number(r.protein) <= 0 || Number(r.fat) <= 0) throw Error('INVALID_SAVED_GOAL');
  return {scope: referenceSavedGoalScope, accountId: r.accountId, goalRevision: r.goalRevision as string | null,
    updatedAt: r.updatedAt, calories: Number(r.calories), protein: Number(r.protein), fat: Number(r.fat), carbs: Number(r.carbs)};
}
