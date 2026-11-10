import {decodeReferenceSavedGoal, type ReferenceSavedGoal} from '../dev/referenceSavedGoalV1';
import {referenceDayHasDistinctStaples} from '../dev/referenceStapleVarietyV1';
import {decodeReferenceExcludedIds, referenceExclusionScope} from '../dev/referenceRecipeExclusionsV1';
import {decodeAuthoringRecipeCatalog, matchAuthoringRecipe, type AuthoringRecipeCatalog} from '../dev/authoringRecipeCatalog';
import {decodeAuthoringWeekReport, type AuthoringReport} from '../dev/authoringWeekReport';

export type StagingRealWeekView = {savedGoal: ReferenceSavedGoal | null; snapshot: string; excludedRecipes: {id: string; name: string}[]; capacity: {required: number; maximum: number | null; shortfall: number | null}; report: AuthoringReport; catalog: AuthoringRecipeCatalog; sourceRecipes: number; eligibleRecipes: number; minimumWeekCaloriesProvenUnreachable: boolean};
export function decodeReferenceWeekCalorieCapacity(value: unknown, target: number): boolean {
  if (!value || typeof value !== 'object' || Array.isArray(value) || !Number.isInteger(target) || target < 1 || target > 10000) throw Error('INVALID_CALORIE_CAPACITY');
  const capacity = value as Record<string, unknown>;
  const amount = (v: unknown): bigint | null => typeof v === 'string' && /^(0|[1-9][0-9]{0,8})\.[0-9]{3}$/.test(v) ? BigInt(v.replace('.', '')) : null;
  if (!['REQUIRED_WEEK_MINIMUM_UNREACHABLE', 'REQUIRED_WEEK_MINIMUM_NOT_PROVEN'].includes(String(capacity.status))) throw Error('INVALID_CALORIE_CAPACITY');
  const required = amount(capacity.requiredWeekKcal), maximum = amount(capacity.optimisticMaximumWeekKcal), shortfall = amount(capacity.provenWeekShortfallKcal);
  const unreachable = capacity.status === 'REQUIRED_WEEK_MINIMUM_UNREACHABLE';
  if (required !== BigInt(target) * 7000n || (capacity.optimisticMaximumWeekKcal !== null && maximum === null)
    || (unreachable ? maximum === null || shortfall === null || shortfall <= 0n || maximum + shortfall !== required
      : capacity.provenWeekShortfallKcal !== null || (maximum !== null && maximum < required))) throw Error('INVALID_CALORIE_CAPACITY');
  return unreachable;
}
export function decodeStagingRealWeek(value: unknown): StagingRealWeekView {
  if (!value || typeof value !== 'object' || Array.isArray(value)) throw Error('INVALID_TEST_RESPONSE');
  const r = value as Record<string, unknown>;
  if (r.contract !== 'potok-staging-real-reference-week-v1' || r.mode !== 'REFERENCE_MENU_TEST_NOT_ACTIVE_PLAN'
    || r.noDatabaseWrites !== true || r.verifiedNutrition !== false || r.mayActivate !== false
    || r.notPersonalized !== true || r.omittedAuthorNotes !== true
    || !Number.isSafeInteger(r.sourceRecipeCount) || !Number.isSafeInteger(r.eligibleReferenceRecipes)
    || Number(r.sourceRecipeCount) < Number(r.eligibleReferenceRecipes) || Number(r.eligibleReferenceRecipes) < 1) throw Error('INVALID_TEST_RESPONSE');
  let excludedRecipes: {id: string; name: string}[] = [];
  if (r.exclusions !== undefined) {
    const exclusion = r.exclusions as {scope?: unknown; recipes?: unknown};
    if (!exclusion || exclusion.scope !== referenceExclusionScope || !Array.isArray(exclusion.recipes)) throw Error('INVALID_REFERENCE_EXCLUSIONS');
    excludedRecipes = exclusion.recipes.map((v: unknown) => {
      if (!v || typeof v !== 'object' || Array.isArray(v)) throw Error('INVALID_REFERENCE_EXCLUSIONS');
      const item = v as Record<string, unknown>;
      if (typeof item.id !== 'string' || typeof item.name !== 'string' || !item.name.trim() || item.name.length > 500) throw Error('INVALID_REFERENCE_EXCLUSIONS');
      return {id: item.id, name: item.name};
    });
    const ids = decodeReferenceExcludedIds(excludedRecipes.map(r => r.id));
    if (ids.join('|') !== excludedRecipes.map(r => r.id).join('|')) throw Error('INVALID_REFERENCE_EXCLUSIONS');
  }
  const report = decodeAuthoringWeekReport(r.report), catalog = decodeAuthoringRecipeCatalog(r.catalog);
  if (!report.calorieCorridor) throw Error('CALORIE_CORRIDOR_REQUIRED');
  const unreachable = decodeReferenceWeekCalorieCapacity(r.calorieCapacity, report.calorieCorridor.minimumKcal);
  const ids = new Set(report.days.flatMap(d => d.meals.map(m => m.recipeId)));
  if (catalog.sourceHash !== report.sourceHash || catalog.recipes.size !== ids.size || [...ids].some(id => !catalog.recipes.has(id))) throw Error('CATALOG_RESPONSE_MISMATCH');
  const uses = new Map<string, number>();
  for (const day of report.days) for (const meal of day.meals) uses.set(meal.recipeId, (uses.get(meal.recipeId) ?? 0) + 1);
  if ([...uses.values()].some(n => n > 2)) throw Error('REFERENCE_REPEAT_LIMIT_EXCEEDED');
  if (excludedRecipes.some(r => ids.has(r.id))) throw Error('EXCLUDED_RECIPE_RETURNED');
  for (const day of report.days) for (const meal of day.meals) {
    if (matchAuthoringRecipe(catalog, report, meal).error) throw Error('CATALOG_RESPONSE_MISMATCH');
  }
  if (report.dailyStapleVariety && report.days.some(day => !referenceDayHasDistinctStaples(day.meals.map(m => catalog.recipes.get(m.recipeId)!)))) throw Error('REFERENCE_DAILY_STAPLE_REPEAT');
  const savedGoal = r.savedGoal === undefined ? null : decodeReferenceSavedGoal(r.savedGoal);
  if (savedGoal && savedGoal.calories !== report.target) throw Error('SAVED_GOAL_TARGET_MISMATCH');
  const capacity = r.calorieCapacity as Record<string, string | null>;
  return {savedGoal, snapshot: JSON.stringify(value), excludedRecipes, capacity: {required: Number(capacity.requiredWeekKcal), maximum: capacity.optimisticMaximumWeekKcal === null ? null : Number(capacity.optimisticMaximumWeekKcal), shortfall: capacity.provenWeekShortfallKcal === null ? null : Number(capacity.provenWeekShortfallKcal)}, report, catalog, sourceRecipes: Number(r.sourceRecipeCount), eligibleRecipes: Number(r.eligibleReferenceRecipes), minimumWeekCaloriesProvenUnreachable: unreachable};
}

export async function requestStagingRealWeek(accountId: string, target: number, weekStart: string, ports: {
  userId: () => Promise<string | null>; token: () => Promise<string | null>; send: typeof fetch;
}, excludedRecipeIds: string[] = [], goalSource?: 'SAVED_GOAL'): Promise<StagingRealWeekView> {
  const excluded = decodeReferenceExcludedIds(excludedRecipeIds);
  if (await ports.userId() !== accountId) throw Error('SESSION_CHANGED');
  const token = await ports.token();
  if (!token) throw Error('AUTH_REQUIRED');
  const controller = new AbortController(), timeout = setTimeout(() => controller.abort(), 15000);
  let response: Response, raw: string;
  try {
    response = await ports.send('/api/staging-real-week', {method: 'POST', cache: 'no-store', signal: controller.signal,
      headers: {Authorization: 'Bearer ' + token, 'Content-Type': 'application/json'}, body: JSON.stringify({... (goalSource === 'SAVED_GOAL' ? {goalSource} : {target}), weekStart, ...(excluded.length ? {excludedRecipeIds: excluded} : {})})});
    raw = await response.text();
  } finally {clearTimeout(timeout);}
  if (!response.ok) {
    let code: unknown;try {code = JSON.parse(raw).error;} catch {code = undefined;}
    if (['SAVED_GOAL_MISSING', 'SAVED_GOAL_UNAVAILABLE', 'INVALID_SAVED_GOAL', 'SAVED_GOAL_CHANGED'].includes(String(code))) throw Error(String(code));
    throw Error(response.status === 401 ? 'AUTH_REQUIRED' : 'TEST_UNAVAILABLE');
  }
  if (new Blob([raw]).size > 2_000_000) throw Error('RESPONSE_TOO_LARGE');
  const result = decodeStagingRealWeek(JSON.parse(raw));
  if (goalSource === 'SAVED_GOAL' ? !result.savedGoal || result.savedGoal.accountId !== accountId : Boolean(result.savedGoal) || result.report.target !== target) throw Error('SAVED_GOAL_SOURCE_CHANGED');
  if ((goalSource !== 'SAVED_GOAL' && result.report.target !== target) || (result.report.days.length && result.report.days[0].date !== weekStart)) throw Error('SCENARIO_CHANGED');
  if (result.excludedRecipes.map(r => r.id).join('|') !== excluded.join('|')) throw Error('EXCLUSION_SCOPE_CHANGED');
  if (await ports.userId() !== accountId) throw Error('SESSION_CHANGED');
  return result;
}
