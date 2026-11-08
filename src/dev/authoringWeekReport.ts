/** Local authoring reports only. This is not a trusted-plan decoder. */
import {referenceCalorieCorridorV1, referenceCaloriesFitCorridorV1, type ReferenceCalorieCorridorV1} from './referenceCalorieCorridorV1';
const axes = ['calories', 'protein', 'fat', 'carbs', 'fiber'] as const;
type Nutrition = Record<typeof axes[number], number>;
export interface AuthoringMeal {
  slot: string; recipeId: string; name: string; sourcePrimaryCategory: string;
  sourceDeclaredServings: number; assignedSourceServings: 1; measuredGrams: null;
  referenceNutrition: Nutrition; verified: false;
}
export interface AuthoringReport {
  calorieCorridor?: ReferenceCalorieCorridorV1;
  status: string; target: number; sourceName: string; sourceHash: string;
  scope: string; assumptions: string[]; notAssessed: string[];
  days: {date: string; referenceNutrition: Nutrition; meals: AuthoringMeal[]}[];
}
export const MAX_AUTHORING_FILE_BYTES = 2_000_000;
const failure = () => { throw new Error('Файл не соответствует формату тестового отчёта. Меню не открыто.'); };
function object(value: unknown): Record<string, unknown> {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return failure();
  return value as Record<string, unknown>;
}
function label(value: unknown): string {
  if (typeof value !== 'string' || !value.trim() || value.length > 500) return failure();
  return value;
}
function numeric(value: unknown): number {
  if (typeof value !== 'number' || !Number.isFinite(value) || value < 0 || value > 1e6) return failure();
  return value;
}
function nutrition(value: unknown, decimals = false): Nutrition {
  const input = object(value);
  return Object.fromEntries(axes.map(axis => {
    const raw = input[axis];
    if (decimals && (typeof raw !== 'string' || !/^\d+\.\d{3}$/.test(raw))) return failure();
    return [axis, numeric(decimals ? Number(raw) : raw)];
  })) as Nutrition;
}
const statuses = new Set(['REFERENCE_WEEK_PREVIEW', 'INCOMPLETE_CATEGORY_POOL',
  'NO_REFERENCE_DAY_IN_EVALUATED_SHORTLISTS', 'WEEK_SEARCH_LIMIT_REACHED', 'NO_REFERENCE_WEEK_IN_RETAINED_POOL', 'NO_REFERENCE_WEEK_IN_CALORIE_CORRIDOR']);
export function decodeAuthoringWeekReport(value: unknown): AuthoringReport {
  const r = object(value);
  if (r.contract !== 'potok-recipe-authoring-week-preview-v1' || r.runtimePublishable !== false
    || r.mayActivate !== false || r.usage !== 'OFFLINE_UNVERIFIED_REFERENCE_EXPERIMENT'
    || r.portionBasis !== 'ONE_SOURCE_DECLARED_SERVING_NO_SCALING'
    || r.physicalReview !== 'DEFERRED_UNTIL_OWNER_PRELAUNCH_TESTING') return failure();
  const status = label(r.status);
  if (!statuses.has(status)) return failure();
  const s = object(r.scenario), source = object(r.source);
  const target = numeric(s.dailyCalorieTarget);
  let calorieCorridor: ReferenceCalorieCorridorV1 | undefined;
  if (r.calorieCorridor !== undefined) {
    const declared = object(r.calorieCorridor), expected = referenceCalorieCorridorV1(target);
    if (declared.contract !== expected.contract || declared.minimumKcal !== expected.minimumKcal || declared.maximumKcal !== expected.maximumKcal) return failure();
    calorieCorridor = expected;
  }
  if (status === 'NO_REFERENCE_WEEK_IN_CALORIE_CORRIDOR' && !calorieCorridor) return failure();
  if (!Number.isInteger(target) || target < 1 || target > 10000
    || !Number.isInteger(s.maxRecipeUses) || Number(s.maxRecipeUses) < 1 || Number(s.maxRecipeUses) > 7
    || !Array.isArray(s.slots) || s.slots.length < 1 || s.slots.length > 7) return failure();
  const slots = s.slots.map(x => label(object(x).label));
  if (new Set(slots).size !== slots.length) return failure();
  const weekStart = label(s.weekStart);
  const start = Date.parse(weekStart + 'T00:00:00Z');
  if (!/^\d{4}-\d{2}-\d{2}$/.test(weekStart) || !Number.isFinite(start)
    || new Date(start).toISOString().slice(0, 10) !== weekStart) return failure();
  if (typeof source.sha256 !== 'string' || !/^[a-f0-9]{64}$/.test(source.sha256)
    || !Array.isArray(r.notAssessed) || !r.notAssessed.length || r.notAssessed.length > 50
    || !Array.isArray(r.assumptions) || r.assumptions.length !== slots.length
    || !Array.isArray(r.days) || r.days.length !== (status === 'REFERENCE_WEEK_PREVIEW' ? 7 : 0)) return failure();
  const assumptions = r.assumptions.map((value, i) => {
    const a = object(value);
    if (a.slot !== slots[i] || a.applicabilityVerified !== false || !Array.isArray(a.sourceCategories)
      || !a.sourceCategories.length || a.sourceCategories.length > 20) return failure();
    return `${slots[i]}: ${a.sourceCategories.map(label).join(', ')} — применимость не подтверждена`;
  });
  const uses = new Map<string, number>();
  const days = r.days.map((value, index) => {
    const day = object(value);
    const date = new Date(start + index * 86400000).toISOString().slice(0, 10);
    if (day.date !== date || !Array.isArray(day.meals) || day.meals.length !== slots.length) return failure();
    const meals = day.meals.map((value, i): AuthoringMeal => {
      const meal = object(value);
      if (meal.slot !== slots[i] || meal.assignedSourceServings !== 1 || meal.measuredGrams !== null || meal.verified !== false) return failure();
      const recipeId = label(meal.recipeId);
      uses.set(recipeId, (uses.get(recipeId) ?? 0) + 1);
      const servings = numeric(meal.sourceDeclaredServings);
      if (servings <= 0) return failure();
      return {slot: slots[i], recipeId, name: label(meal.name), sourcePrimaryCategory: label(meal.sourcePrimaryCategory),
        sourceDeclaredServings: servings, assignedSourceServings: 1, measuredGrams: null, verified: false,
        referenceNutrition: nutrition(meal.referenceNutrition)};
    });
    if (new Set(meals.map(m => m.recipeId)).size !== meals.length) return failure();
    const total = nutrition(day.referenceNutrition, true);
    if (calorieCorridor && !referenceCaloriesFitCorridorV1(target, total.calories)) return failure();
    for (const axis of axes) {
      if (Math.round(total[axis] * 1000) !== meals.reduce((sum, m) => sum + Math.round(m.referenceNutrition[axis] * 1000), 0)) return failure();
    }
    return {date, meals, referenceNutrition: total};
  });
  if ([...uses.values()].some(count => count > Number(s.maxRecipeUses))) return failure();
  const scope = status === 'REFERENCE_WEEK_PREVIEW' ? label(r.scope) : '';
  if (scope && !['BEST_EVALUATED_PREFIX', 'BEST_IN_RETAINED_POOL', 'CALORIE_REFINED_REFERENCE_WEEK'].includes(scope)) return failure();
  return {status, target, sourceName: label(source.fileName), sourceHash: source.sha256, scope,
    assumptions, notAssessed: r.notAssessed.map(label), days, ...(calorieCorridor ? {calorieCorridor} : {})};
}
