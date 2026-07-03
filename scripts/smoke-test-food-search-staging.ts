import fs from 'node:fs';
import path from 'node:path';
import process from 'node:process';
import { fileURLToPath } from 'node:url';
import { createClient, type SupabaseClient } from '@supabase/supabase-js';

type DbFood = {
  id: string;
  stable_food_id: string | null;
  canonical_food_id: string | null;
  name: string | null;
  normalized_name: string | null;
  source: string | null;
  category: string | null;
  cooking_state: string | null;
};

type DbAlias = {
  id: string;
  alias: string | null;
  normalized_alias: string | null;
  canonical_food_id: string | null;
};

type SearchStatus = 'resolved' | 'ambiguous' | 'unresolved';
type MatchSource = 'canonical_name' | 'normalized_name' | 'alias' | 'none';
type SmokeCategory =
  | 'canonical_exact'
  | 'normalized_variation'
  | 'alias_exact'
  | 'alias_punctuation'
  | 'short_common'
  | 'misspelling_alias'
  | 'unknown'
  | 'ambiguity';

type SmokeCase = {
  category: SmokeCategory;
  input: string;
  expectedStatus: SearchStatus;
  expectedStableFoodId?: string | null;
  expectedUuid?: string | null;
  source: string;
  notes: string;
};

type SearchResult = {
  input: string;
  normalizedQuery: string;
  status: SearchStatus;
  matchSource: MatchSource;
  candidateCount: number;
  matchedIds: string[];
  matchedStableFoodIds: string[];
  matchedNames: string[];
};

export const normalizeFoodTextForDb = (value: unknown): string =>
  String(value ?? '')
    .toLowerCase()
    .replace(/[^a-z0-9а-яё]+/gi, ' ')
    .replace(/\s+/g, ' ')
    .trim();

const STAGING_REF = 'ozidryfvhkcbtpnulakq';
const PRODUCTION_REF = 'dtsdnhbcwpbfrhcazqkb';

const loadEnvFile = (filePath: string) => {
  if (!fs.existsSync(filePath)) return;
  for (const line of fs.readFileSync(filePath, 'utf8').split(/\r?\n/)) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#')) continue;
    const match = trimmed.match(/^([A-Za-z_][A-Za-z0-9_]*)=(.*)$/);
    if (!match) continue;
    const [, key, rawValue] = match;
    if (process.env[key] === undefined) {
      process.env[key] = rawValue.replace(/^['"]|['"]$/g, '');
    }
  }
};

const getProjectRef = (url: string | null | undefined): string | null => {
  const match = String(url ?? '').match(/^https:\/\/([a-z0-9-]+)\.supabase\.co\/?$/i);
  return match?.[1] ?? null;
};

const createStagingClient = (keyKind: 'service-role' | 'anon'): { client: SupabaseClient; ref: string } => {
  ['.env.local', '.env', '.env.staging.local'].forEach((fileName) => {
    loadEnvFile(path.resolve(process.cwd(), fileName));
  });

  const url = process.env.STAGING_SUPABASE_URL;
  const key = keyKind === 'service-role'
    ? process.env.STAGING_SUPABASE_SERVICE_ROLE_KEY
    : process.env.STAGING_SUPABASE_ANON_KEY;
  const ref = getProjectRef(url);
  const liveRef = getProjectRef(process.env.VITE_SUPABASE_URL ?? process.env.SUPABASE_URL);

  if (ref !== STAGING_REF) {
    throw new Error(`staging target mismatch: expected ${STAGING_REF}, got ${ref ?? 'missing'}`);
  }
  if (ref === PRODUCTION_REF || liveRef === ref) {
    throw new Error('production/live project must not be used for staging smoke test');
  }
  if (!url || !key) {
    throw new Error(`missing staging ${keyKind} env`);
  }

  return {
    client: createClient(url, key, { auth: { persistSession: false, autoRefreshToken: false } }),
    ref,
  };
};

const fetchAll = async <T>(client: SupabaseClient, table: string, select: string): Promise<T[]> => {
  const rows: T[] = [];
  for (let from = 0; ; from += 1000) {
    const { data, error } = await client.from(table).select(select).range(from, from + 999);
    if (error) throw new Error(`${table} read failed: ${error.message}`);
    rows.push(...((data ?? []) as T[]));
    if (!data || data.length < 1000) break;
  }
  return rows;
};

const countRows = async (client: SupabaseClient, table: string): Promise<number> => {
  const { count, error } = await client.from(table).select('*', { head: true, count: 'exact' });
  if (error) throw new Error(`${table} count failed: ${error.message}`);
  return count ?? 0;
};

export const resolveDbLevel = (input: string, foods: DbFood[], aliases: DbAlias[]): SearchResult => {
  const normalizedQuery = normalizeFoodTextForDb(input);
  if (!normalizedQuery) {
    return toSearchResult(input, normalizedQuery, 'none', []);
  }
  const foodById = new Map(foods.map((food) => [food.id, food]));

  const exactName = foods.filter((food) => normalizeFoodTextForDb(food.name) === normalizedQuery);
  if (exactName.length > 0) {
    return toSearchResult(input, normalizedQuery, 'canonical_name', exactName);
  }

  const normalizedName = foods.filter((food) => food.normalized_name === normalizedQuery);
  if (normalizedName.length > 0) {
    return toSearchResult(input, normalizedQuery, 'normalized_name', normalizedName);
  }

  const aliasTargets = aliases
    .filter((alias) => alias.normalized_alias === normalizedQuery)
    .map((alias) => alias.canonical_food_id ? foodById.get(alias.canonical_food_id) ?? null : null)
    .filter((food): food is DbFood => Boolean(food));
  if (aliasTargets.length > 0) {
    return toSearchResult(input, normalizedQuery, 'alias', aliasTargets);
  }

  const fuzzyTargets = foods.filter((food) => {
    const normalizedNameText = String(food.normalized_name ?? '');
    return normalizedNameText.includes(normalizedQuery) || normalizedQuery.includes(normalizedNameText);
  });
  return toSearchResult(input, normalizedQuery, fuzzyTargets.length ? 'normalized_name' : 'none', fuzzyTargets);
};

const toSearchResult = (
  input: string,
  normalizedQuery: string,
  matchSource: MatchSource,
  candidates: DbFood[]
): SearchResult => {
  const byId = new Map<string, DbFood>();
  for (const food of candidates) {
    byId.set(food.id, food);
  }
  const unique = Array.from(byId.values());
  return {
    input,
    normalizedQuery,
    status: unique.length === 0 ? 'unresolved' : unique.length === 1 ? 'resolved' : 'ambiguous',
    matchSource: unique.length === 0 ? 'none' : matchSource,
    candidateCount: unique.length,
    matchedIds: unique.map((food) => food.id),
    matchedStableFoodIds: unique.map((food) => food.stable_food_id ?? ''),
    matchedNames: unique.map((food) => food.name ?? ''),
  };
};

const pickEvery = <T>(rows: T[], count: number): T[] => {
  if (rows.length <= count) return rows;
  const out: T[] = [];
  const step = Math.max(1, Math.floor(rows.length / count));
  for (let index = 0; index < rows.length && out.length < count; index += step) {
    out.push(rows[index]);
  }
  return out;
};

const buildSmokeCases = (foods: DbFood[], aliases: DbAlias[]): SmokeCase[] => {
  const foodById = new Map(foods.map((food) => [food.id, food]));
  const aliasWithTarget = aliases
    .map((alias) => ({ alias, food: alias.canonical_food_id ? foodById.get(alias.canonical_food_id) ?? null : null }))
    .filter((item): item is { alias: DbAlias; food: DbFood } => Boolean(item.food && item.alias.alias));

  const cases: SmokeCase[] = [];
  for (const food of pickEvery(foods.filter((food) => food.name && food.stable_food_id), 10)) {
    cases.push({
      category: 'canonical_exact',
      input: food.name ?? '',
      expectedStatus: 'resolved',
      expectedStableFoodId: food.stable_food_id,
      expectedUuid: food.id,
      source: 'foods.name',
      notes: 'exact canonical food name',
    });
  }

  for (const food of pickEvery(foods.filter((food) => food.name && /[,.()%-]/.test(food.name ?? '')), 10)) {
    cases.push({
      category: 'normalized_variation',
      input: String(food.name).replace(/[,.()%-]+/g, ' ').toUpperCase(),
      expectedStatus: 'resolved',
      expectedStableFoodId: food.stable_food_id,
      expectedUuid: food.id,
      source: 'foods.name variation',
      notes: 'case/punctuation variation resolved by DB-style normalization',
    });
  }

  for (const item of pickEvery(aliasWithTarget, 10)) {
    cases.push({
      category: 'alias_exact',
      input: item.alias.alias ?? '',
      expectedStatus: 'resolved',
      expectedStableFoodId: item.food.stable_food_id,
      expectedUuid: item.food.id,
      source: 'food_aliases.alias',
      notes: 'exact alias match',
    });
  }

  const specialInputs = [
    'ацидофилин 0,1%',
    'ацидофилин 0.1%',
    'ацидофилин 3,2%',
    'ацидофилин 3.2%',
    'баклажаны по-корейски',
    'баклажаны по корейски',
    'кус-кус приготовленный',
    'кус кус приготовленный',
    'булочки для хот-догов',
    'булочки для хот догов',
    'кефир 1,5%',
    'кефир 1.5%',
    'кофе по-венски',
    'кофе по венски',
    'копчёно-варёная грудинка',
    'копчёно варёная грудинка',
  ];
  for (const input of specialInputs) {
    const result = resolveDbLevel(input, foods, aliases);
    cases.push({
      category: 'alias_punctuation',
      input,
      expectedStatus: result.status,
      expectedStableFoodId: result.matchedStableFoodIds[0] ?? null,
      expectedUuid: result.matchedIds[0] ?? null,
      source: 'required punctuation smoke case',
      notes: 'required collapsed alias/canonical punctuation variant',
    });
  }

  for (const input of ['чай', 'кофе', 'рис', 'сыр', 'яйцо']) {
    cases.push({ category: 'short_common', input, expectedStatus: 'ambiguous', source: 'common query', notes: 'expected broad query' });
  }

  for (const input of ['кефр', 'молко', 'грэчка', 'йогрут', 'тварог']) {
    cases.push({ category: 'misspelling_alias', input, expectedStatus: 'unresolved', source: 'misspelling probe', notes: 'no fuzzy typo resolver expected' });
  }

  for (const input of ['zzzz-not-food', 'несуществующий продукт xyz', 'еда из параллельной вселенной', 'юююююю продукт', 'квертифуд']) {
    cases.push({ category: 'unknown', input, expectedStatus: 'unresolved', source: 'negative control', notes: 'must not auto-create or guess' });
  }

  for (const input of ['мол', 'кеф', 'сыр', 'кур', 'хлеб']) {
    cases.push({ category: 'ambiguity', input, expectedStatus: 'ambiguous', source: 'broad catalog query', notes: 'must not pick one silently' });
  }

  return cases;
};

const summarizeAliasCoverage = (foods: DbFood[], aliases: DbAlias[]) => {
  const aliasCountByFood = new Map<string, number>();
  for (const alias of aliases) {
    if (!alias.canonical_food_id) continue;
    aliasCountByFood.set(alias.canonical_food_id, (aliasCountByFood.get(alias.canonical_food_id) ?? 0) + 1);
  }
  const buckets = {
    withoutAliases: 0,
    oneAlias: 0,
    twoToFiveAliases: 0,
    moreThanFiveAliases: 0,
    maxAliases: 0,
  };
  for (const food of foods) {
    const count = aliasCountByFood.get(food.id) ?? 0;
    if (count === 0) buckets.withoutAliases += 1;
    if (count === 1) buckets.oneAlias += 1;
    if (count >= 2 && count <= 5) buckets.twoToFiveAliases += 1;
    if (count > 5) buckets.moreThanFiveAliases += 1;
    buckets.maxAliases = Math.max(buckets.maxAliases, count);
  }
  const withoutAliasSamples = foods
    .filter((food) => (aliasCountByFood.get(food.id) ?? 0) === 0)
    .slice(0, 20)
    .map((food) => ({ stable_food_id: food.stable_food_id, name: food.name, category: food.category }));
  const maxAliasSamples = foods
    .map((food) => ({ stable_food_id: food.stable_food_id, name: food.name, category: food.category, alias_count: aliasCountByFood.get(food.id) ?? 0 }))
    .sort((a, b) => b.alias_count - a.alias_count)
    .slice(0, 20);
  return { buckets, withoutAliasSamples, maxAliasSamples };
};

const qualityQueries = [
  'яйцо',
  'молоко',
  'кефир',
  'творог',
  'сыр',
  'курица',
  'гречка',
  'рис',
  'овсянка',
  'яблоко',
  'банан',
  'хлеб',
  'картофель',
  'помидор',
  'огурец',
  'кофе',
  'чай',
  'рыба',
  'говядина',
  'йогурт',
];

const topResults = (query: string, foods: DbFood[], aliases: DbAlias[]) => {
  const normalizedQuery = normalizeFoodTextForDb(query);
  const foodById = new Map(foods.map((food) => [food.id, food]));
  const scored = new Map<string, { food: DbFood; score: number; sources: Set<string> }>();
  const add = (food: DbFood, score: number, source: string) => {
    const existing = scored.get(food.id);
    if (!existing || score > existing.score) {
      scored.set(food.id, { food, score, sources: new Set([source]) });
    } else if (existing.score === score) {
      existing.sources.add(source);
    }
  };
  for (const food of foods) {
    const normalizedName = String(food.normalized_name ?? '');
    if (normalizedName === normalizedQuery) add(food, 100, 'normalized_name_exact');
    else if (normalizedName.startsWith(normalizedQuery)) add(food, 80, 'normalized_name_prefix');
    else if (normalizedName.includes(normalizedQuery)) add(food, 60, 'normalized_name_contains');
  }
  for (const alias of aliases) {
    const food = alias.canonical_food_id ? foodById.get(alias.canonical_food_id) : null;
    if (!food) continue;
    const normalizedAlias = String(alias.normalized_alias ?? '');
    if (normalizedAlias === normalizedQuery) add(food, 95, 'alias_exact');
    else if (normalizedAlias.startsWith(normalizedQuery)) add(food, 75, 'alias_prefix');
    else if (normalizedAlias.includes(normalizedQuery)) add(food, 55, 'alias_contains');
  }
  return Array.from(scored.values())
    .sort((a, b) => b.score - a.score || String(a.food.name ?? '').localeCompare(String(b.food.name ?? ''), 'ru'))
    .slice(0, 10)
    .map((item) => ({
      stable_food_id: item.food.stable_food_id,
      name: item.food.name,
      category: item.food.category,
      cooking_state: item.food.cooking_state,
      score: item.score,
      sources: Array.from(item.sources).join(','),
    }));
};

const statusOk = (testCase: SmokeCase, result: SearchResult): boolean => {
  if (testCase.expectedStatus === 'resolved') {
    return result.status === 'resolved' && (!testCase.expectedUuid || result.matchedIds.includes(testCase.expectedUuid));
  }
  return result.status === testCase.expectedStatus;
};

export async function runSmoke() {
  const { client, ref } = createStagingClient('service-role');
  const anon = createStagingClient('anon');

  const counts: Record<string, number> = {};
  for (const table of ['foods', 'food_aliases', 'food_diary_entries', 'recipes', 'recipe_ingredients', 'favorite_products']) {
    counts[table] = await countRows(client, table);
  }

  const foods = await fetchAll<DbFood>(
    client,
    'foods',
    'id,stable_food_id,canonical_food_id,name,normalized_name,source,category,cooking_state'
  );
  const aliases = await fetchAll<DbAlias>(client, 'food_aliases', 'id,alias,normalized_alias,canonical_food_id');

  const foodIds = new Set(foods.map((food) => food.id));
  const dataIntegrity = {
    coreRows: foods.length,
    aliases: aliases.length,
    foodIdentityViolations: foods.filter((food) =>
      !food.id ||
      !food.stable_food_id ||
      !food.canonical_food_id ||
      food.id !== food.canonical_food_id ||
      !String(food.name ?? '').trim() ||
      !String(food.normalized_name ?? '').trim()
    ).length,
    aliasViolations: aliases.filter((alias) =>
      !String(alias.alias ?? '').trim() ||
      !String(alias.normalized_alias ?? '').trim() ||
      !alias.canonical_food_id ||
      !foodIds.has(alias.canonical_food_id)
    ).length,
  };

  const aliasCoverage = summarizeAliasCoverage(foods, aliases);
  const smokeCases = buildSmokeCases(foods, aliases);
  const smokeResults = smokeCases.map((testCase) => {
    const result = resolveDbLevel(testCase.input, foods, aliases);
    return { testCase, result, pass: statusOk(testCase, result) };
  });

  const categorySummary = smokeResults.reduce<Record<string, { total: number; passed: number; failed: number }>>((acc, item) => {
    const key = item.testCase.category;
    acc[key] ??= { total: 0, passed: 0, failed: 0 };
    acc[key].total += 1;
    if (item.pass) acc[key].passed += 1;
    else acc[key].failed += 1;
    return acc;
  }, {});

  const quality = qualityQueries.map((query) => {
    const results = topResults(query, foods, aliases);
    const hasRelevantTop3 = results.slice(0, 3).some((item) => normalizeFoodTextForDb(item.name).includes(normalizeFoodTextForDb(query)));
    const names = new Set(results.map((item) => normalizeFoodTextForDb(item.name)));
    return {
      query,
      top10: results,
      classification: !hasRelevantTop3 ? 'NO_RELEVANT_TOP_RESULT' : names.size < results.length ? 'DUPLICATE_RESULTS' : 'ACCEPTABLE',
    };
  });

  const { count: anonFoodsCount, error: anonFoodsError } = await anon.client
    .from('foods')
    .select('*', { head: true, count: 'exact' });
  const { count: anonAliasesCount, error: anonAliasesError } = await anon.client
    .from('food_aliases')
    .select('*', { head: true, count: 'exact' });

  const summary = {
    target: 'staging',
    projectRef: ref,
    productionUsed: false,
    counts,
    dataIntegrity,
    aliasCoverage,
    smoke: {
      total: smokeResults.length,
      passed: smokeResults.filter((item) => item.pass).length,
      failed: smokeResults.filter((item) => !item.pass).length,
      categorySummary,
      failures: smokeResults
        .filter((item) => !item.pass)
        .map((item) => ({
          category: item.testCase.category,
          input: item.testCase.input,
          expectedStatus: item.testCase.expectedStatus,
          actualStatus: item.result.status,
          candidates: item.result.candidateCount,
          matchedStableFoodIds: item.result.matchedStableFoodIds,
        })),
      samples: smokeResults.slice(0, 25).map((item) => ({
        category: item.testCase.category,
        input: item.testCase.input,
        expectedStatus: item.testCase.expectedStatus,
        actualStatus: item.result.status,
        matchSource: item.result.matchSource,
        candidateCount: item.result.candidateCount,
        matchedStableFoodIds: item.result.matchedStableFoodIds.slice(0, 5),
        matchedNames: item.result.matchedNames.slice(0, 5),
      })),
    },
    punctuation: smokeResults
      .filter((item) => item.testCase.category === 'alias_punctuation')
      .map((item) => ({
        input: item.testCase.input,
        normalized: item.result.normalizedQuery,
        status: item.result.status,
        candidateCount: item.result.candidateCount,
        matchedStableFoodIds: item.result.matchedStableFoodIds,
        matchedNames: item.result.matchedNames,
        pass: item.pass,
      })),
    quality,
    visibility: {
      serviceRoleFoods: counts.foods,
      serviceRoleAliases: counts.food_aliases,
      anonFoods: anonFoodsError ? null : anonFoodsCount ?? 0,
      anonAliases: anonAliasesError ? null : anonAliasesCount ?? 0,
      anonFoodsError: anonFoodsError?.message ?? null,
      anonAliasesError: anonAliasesError?.message ?? null,
      authenticatedVisibility: 'AUTHENTICATED_VISIBILITY_NOT_TESTED',
    },
  };

  console.log(JSON.stringify(summary, null, 2));

  const criticalFailures =
    counts.foods !== 2199 ||
    counts.food_aliases !== 3311 ||
    dataIntegrity.foodIdentityViolations > 0 ||
    dataIntegrity.aliasViolations > 0 ||
    smokeResults.filter((item) => !item.pass).length > 0 ||
    anonFoodsError ||
    anonAliasesError;

  if (criticalFailures) {
    process.exitCode = 1;
  }
}

const isCliEntry = process.argv[1]
  ? fileURLToPath(import.meta.url) === path.resolve(process.argv[1])
  : false;

if (isCliEntry) {
  runSmoke().catch((error) => {
    console.error(error instanceof Error ? error.message : error);
    process.exitCode = 1;
  });
}
