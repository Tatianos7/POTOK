import {brotliDecompressSync} from 'node:zlib';
import {createHash} from 'node:crypto';
import {decodeAuthoringRecipeCatalog, authoringSearchInput} from '../dev/authoringRecipeCatalog';
import {decodeAuthoringWeekReport} from '../dev/authoringWeekReport';
import {previewRecipeAuthoringWeekV1, type AuthoringWeekScenarioV1} from '../dev/authoringWeekSearchV1';
import pins from '../../docs/premium/staging-reference-catalog-20261108.json';
import {analyzeWeekInputCalorieCapacityV1} from '../../scripts/contracts/week-input-calorie-capacity-v1';
import {decodeReferenceExcludedIds, excludeReferenceRecipes, referenceExclusionScope} from '../dev/referenceRecipeExclusionsV1';
import {constrainReferenceWeekToCorridorV1} from '../dev/referenceCalorieCorridorV1';

type Req = {method?: string; headers: Record<string, string | string[] | undefined>; body?: unknown};
type Res = {status: (code: number) => Res; setHeader: (key: string, value: string) => Res; json: (value: unknown) => void};
const staging = 'https://ozidryfvhkcbtpnulakq.supabase.co';
export const realWeekTestContract = 'potok-staging-real-reference-week-v1';
export const testTargets = [1400, 1600, 1800, 2000] as const;
const uuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

function scenario(target: number, weekStart: string): AuthoringWeekScenarioV1 {
  return {contract: 'potok-authoring-week-scenario-v1', enforceDailyStapleVariety: true, weekStart, dailyCalorieTarget: target, tolerancePercent: 10,
    slots: [
      {label: 'Завтрак', sourceCategories: ['BREAKFAST'], targetSharePercent: 25},
      {label: 'Обед', sourceCategories: ['LUNCH'], targetSharePercent: 30},
      {label: 'Ужин — тестовое использование категории LUNCH', sourceCategories: ['LUNCH'], targetSharePercent: 30},
      {label: 'Перекус', sourceCategories: ['SNACK'], targetSharePercent: 15},
    ], rankedCandidatePoolSize: 12, shortlistPerSlot: 4, dayPoolSize: 4,
    maxDayEvaluations: 256, maxWeekEvaluations: 1024, maxRecipeUses: 2};
}

/** Private server input, never a client asset or canonical/publication source. */
export function readStagingReferenceCatalog(packed: string | undefined) {
  if (!packed || packed.length > 60000 || !/^[A-Za-z0-9+/]+={0,2}$/.test(packed)) throw Error('CATALOG_UNAVAILABLE');
  const compressed = Buffer.from(packed, 'base64');
  if (compressed.toString('base64') !== packed) throw Error('CATALOG_INVALID');
  const raw = brotliDecompressSync(compressed, {maxOutputLength: 2_000_000});
  if (createHash('sha256').update(raw).digest('hex') !== pins.projectedCatalogSha256) throw Error('CATALOG_PIN_MISMATCH');
  const packet = JSON.parse(raw.toString('utf8')) as Record<string, unknown>;
  const decoded = decodeAuthoringRecipeCatalog(packet);
  if (decoded.sourceHash !== pins.originalWorkbookSha256 || decoded.recipes.size !== pins.recipes) throw Error('CATALOG_SOURCE_MISMATCH');
  return {packet, decoded};
}

export function buildStagingReferenceWeek(packed: string | undefined, target: number, weekStart: string, excludedRecipeIds: string[] = []) {
  const {packet, decoded} = readStagingReferenceCatalog(packed);
  const excluded = decodeReferenceExcludedIds(excludedRecipeIds);
  const input = excludeReferenceRecipes(authoringSearchInput(decoded), excluded);
  const settings = scenario(target, weekStart);
  const eligible = input.recipes.filter(r => r.numericReferenceTestInputAvailable && r.sourceStatus !== 'BLOCKED');
  const capacity = analyzeWeekInputCalorieCapacityV1(eligible.map(r => ({recipeId: r.recipeId,
    sourceCategory: String(r.sourceRecipe.meal_type_primary), caloriesPerDeclaredServing: String(r.referenceNutrition.values.calories)})),
    {...settings, tolerancePercent: 0});
  const report = constrainReferenceWeekToCorridorV1(previewRecipeAuthoringWeekV1(input, settings));
  const requiredWeek = BigInt(report.calorieCorridor.minimumKcal) * 7000n;
  const maximumWeek = capacity.optimisticMaximumWeekKcal === null ? null : BigInt(capacity.optimisticMaximumWeekKcal.replace('.', ''));
  const shortfall = maximumWeek !== null && maximumWeek < requiredWeek ? requiredWeek - maximumWeek : null;
  const fixed = (n: bigint) => `${n / 1000n}.${String(n % 1000n).padStart(3, '0')}`;
  const view = decodeAuthoringWeekReport(report);
  const ids = new Set(view.days.flatMap(d => d.meals.map(m => m.recipeId)));
  const recipes = (packet.recipes as {recipeId: string}[]).filter(r => ids.has(r.recipeId));
  return {contract: realWeekTestContract, mode: 'REFERENCE_MENU_TEST_NOT_ACTIVE_PLAN',
    noDatabaseWrites: true, verifiedNutrition: false, mayActivate: false, notPersonalized: true,
    exclusions: {scope: referenceExclusionScope, recipes: excluded.map(id => ({id, name: decoded.recipes.get(id)!.name}))},
    sourceRecipeCount: decoded.recipes.size, eligibleReferenceRecipes: eligible.length,
    calorieCapacity: {status: shortfall === null ? 'REQUIRED_WEEK_MINIMUM_NOT_PROVEN' : 'REQUIRED_WEEK_MINIMUM_UNREACHABLE',
      requiredWeekKcal: fixed(requiredWeek), optimisticMaximumWeekKcal: capacity.optimisticMaximumWeekKcal,
      provenWeekShortfallKcal: shortfall === null ? null : fixed(shortfall)},
    report, catalog: {...packet, recipes},
    omittedAuthorNotes: true};
}

/** POST-only preview: the only remote operation is GET /auth/v1/user. */
export function createStagingRealWeekHandler(env: Record<string, string | undefined>, authFetch: typeof fetch = fetch) {
  return async (req: Req, res: Res): Promise<void> => {
    res.setHeader('Cache-Control', 'private, no-store'); res.setHeader('Vary', 'Authorization');
    res.setHeader('X-Content-Type-Options', 'nosniff');
    if (env.VERCEL_ENV !== 'preview' || env.VITE_POTOK_STAGING_PREVIEW !== 'true'
      || env.VITE_SUPABASE_URL !== staging || env.POTOK_STAGING_REFERENCE_TEST_ENABLED !== 'true') {
      res.status(503).json({error: 'STAGING_REFERENCE_TEST_DISABLED'}); return;
    }
    if (req.method !== 'POST') {res.setHeader('Allow', 'POST'); res.status(405).json({error: 'METHOD_NOT_ALLOWED'}); return;}
    const input = req.body as Record<string, unknown> | null;
    if (!input || typeof input !== 'object' || Array.isArray(input) || !['target,weekStart', 'excludedRecipeIds,target,weekStart'].includes(Object.keys(input).sort().join(','))
      || !(testTargets as readonly unknown[]).includes(input.target) || typeof input.weekStart !== 'string'
      || !/^\d{4}-\d{2}-\d{2}$/.test(input.weekStart)
      || !Number.isFinite(Date.parse(input.weekStart + 'T00:00:00Z'))
      || new Date(input.weekStart + 'T00:00:00Z').toISOString().slice(0, 10) !== input.weekStart) {
      res.status(400).json({error: 'INVALID_TEST_SCENARIO'}); return;
    }
    let excluded: string[];
    try {excluded = decodeReferenceExcludedIds(input.excludedRecipeIds);} catch {res.status(400).json({error: 'INVALID_REFERENCE_EXCLUSIONS'}); return;}
    const auth = req.headers.authorization;
    if (typeof auth !== 'string' || auth.length > 8192 || !/^Bearer [^\s,]+$/i.test(auth)) {
      res.status(401).json({error: 'AUTH_REQUIRED'}); return;
    }
    const key = env.VITE_SUPABASE_ANON_KEY;
    let publicKey = Boolean(key && /^sb_publishable_[A-Za-z0-9_-]{12,}$/.test(key));
    if (key && key.length < 4096 && key.split('.').length === 3) {
      try {const claims = JSON.parse(Buffer.from(key.split('.')[1], 'base64url').toString('utf8'));
        publicKey = claims.role === 'anon' && claims.ref === 'ozidryfvhkcbtpnulakq';} catch {publicKey = false;}
    }
    if (!key || !publicKey) {res.status(503).json({error: 'STAGING_PUBLIC_KEY_MISSING'}); return;}
    try {
      const controller = new AbortController(); const timeout = setTimeout(() => controller.abort(), 5000);
      let remote: Response;
      try {remote = await authFetch(staging + '/auth/v1/user', {method: 'GET', signal: controller.signal, cache: 'no-store',
        headers: {Authorization: auth, apikey: key, Accept: 'application/json'}});} finally {clearTimeout(timeout);}
      if (!remote.ok) {res.status(remote.status === 401 || remote.status === 403 ? 401 : 503).json({error: 'AUTH_UNAVAILABLE_OR_DENIED'}); return;}
      const user = await remote.json() as {id?: unknown};
      if (typeof user.id !== 'string' || !uuid.test(user.id)) {res.status(401).json({error: 'AUTH_INVALID_USER'}); return;}
      res.status(200).json(buildStagingReferenceWeek(env.POTOK_STAGING_REFERENCE_CATALOG_BR64, input.target as number, input.weekStart, excluded));
    } catch (error) {
      if (error instanceof Error && error.message === 'UNKNOWN_REFERENCE_RECIPE') res.status(400).json({error: 'UNKNOWN_REFERENCE_RECIPE'});
      else res.status(503).json({error: 'REFERENCE_MENU_TEMPORARILY_UNAVAILABLE'});
    }
  };
}
export default createStagingRealWeekHandler(process.env);
