import {decodeAuthoringRecipeCatalog, matchAuthoringRecipe, type AuthoringRecipeCatalog} from '../dev/authoringRecipeCatalog';
import {decodeAuthoringWeekReport, type AuthoringReport} from '../dev/authoringWeekReport';

export type StagingRealWeekView = {snapshot: string; report: AuthoringReport; catalog: AuthoringRecipeCatalog; sourceRecipes: number; eligibleRecipes: number; minimumWeekCaloriesProvenUnreachable: boolean};
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
  const report = decodeAuthoringWeekReport(r.report), catalog = decodeAuthoringRecipeCatalog(r.catalog);
  if (!report.calorieCorridor) throw Error('CALORIE_CORRIDOR_REQUIRED');
  const unreachable = decodeReferenceWeekCalorieCapacity(r.calorieCapacity, report.calorieCorridor.minimumKcal);
  const ids = new Set(report.days.flatMap(d => d.meals.map(m => m.recipeId)));
  if (catalog.sourceHash !== report.sourceHash || catalog.recipes.size !== ids.size || [...ids].some(id => !catalog.recipes.has(id))) throw Error('CATALOG_RESPONSE_MISMATCH');
  for (const day of report.days) for (const meal of day.meals) {
    if (matchAuthoringRecipe(catalog, report, meal).error) throw Error('CATALOG_RESPONSE_MISMATCH');
  }
  return {snapshot: JSON.stringify(value), report, catalog, sourceRecipes: Number(r.sourceRecipeCount), eligibleRecipes: Number(r.eligibleReferenceRecipes), minimumWeekCaloriesProvenUnreachable: unreachable};
}

export async function requestStagingRealWeek(accountId: string, target: number, weekStart: string, ports: {
  userId: () => Promise<string | null>; token: () => Promise<string | null>; send: typeof fetch;
}): Promise<StagingRealWeekView> {
  if (await ports.userId() !== accountId) throw Error('SESSION_CHANGED');
  const token = await ports.token();
  if (!token) throw Error('AUTH_REQUIRED');
  const controller = new AbortController(), timeout = setTimeout(() => controller.abort(), 15000);
  let response: Response, raw: string;
  try {
    response = await ports.send('/api/staging-real-week', {method: 'POST', cache: 'no-store', signal: controller.signal,
      headers: {Authorization: 'Bearer ' + token, 'Content-Type': 'application/json'}, body: JSON.stringify({target, weekStart})});
    raw = await response.text();
  } finally {clearTimeout(timeout);}
  if (!response.ok) throw Error(response.status === 401 ? 'AUTH_REQUIRED' : 'TEST_UNAVAILABLE');
  if (new Blob([raw]).size > 2_000_000) throw Error('RESPONSE_TOO_LARGE');
  const result = decodeStagingRealWeek(JSON.parse(raw));
  if (result.report.target !== target || (result.report.days.length && result.report.days[0].date !== weekStart)) throw Error('SCENARIO_CHANGED');
  if (await ports.userId() !== accountId) throw Error('SESSION_CHANGED');
  return result;
}
