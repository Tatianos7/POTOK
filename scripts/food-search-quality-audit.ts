import fs from 'node:fs';
import path from 'node:path';
import process from 'node:process';
import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import {
  broadManualSelectionQueries,
  foodSearchQualityCases,
  knownWarningQueries,
  type SearchIssueCode,
  type SearchQualityCase,
} from './food-search-quality-cases.js';

type Severity = 'critical' | 'high' | 'medium' | 'low';
type MatchSource =
  | 'canonical_exact'
  | 'normalized_exact'
  | 'alias_exact'
  | 'canonical_prefix'
  | 'alias_prefix'
  | 'canonical_contains'
  | 'alias_contains'
  | 'db_text_search'
  | 'none';

type DbFood = {
  id: string;
  stable_food_id: string | null;
  canonical_food_id: string | null;
  name: string | null;
  normalized_name: string | null;
  source: string | null;
  category: string | null;
  cooking_state: string | null;
  brand: string | null;
  calories: number | null;
  protein: number | null;
  fat: number | null;
  carbs: number | null;
  fiber: number | null;
  verified: boolean | null;
  popularity: number | null;
};

type DbAlias = {
  id: string;
  alias: string | null;
  normalized_alias: string | null;
  canonical_food_id: string | null;
};

type RankedResult = {
  rank: number;
  food: DbFood;
  matchSource: MatchSource;
  score: number;
  reason: string;
};

type QueryAudit = {
  testCase: SearchQualityCase;
  normalizedQuery: string;
  aliases: DbAlias[];
  exactGeneric: DbFood | null;
  exactCanonicalMatches: DbFood[];
  exactAliasTargets: DbFood[];
  top10: RankedResult[];
  v1Top10: RankedResult[];
  issues: Array<{ code: SearchIssueCode; severity: Severity; detail: string }>;
};

const STAGING_REF = 'ozidryfvhkcbtpnulakq';
const PRODUCTION_REF = 'dtsdnhbcwpbfrhcazqkb';
const REPORT_PATH = path.resolve(process.cwd(), 'reports/food-search-quality-audit.md');
const MANUAL_DISAMBIGUATION_POLICY: Record<string, string[]> = {
  овсянка: ['овсяные хлопья', 'овсяная крупа', 'каша овсяная', 'овсяная каша'],
  чай: ['чай черный', 'чай чёрный', 'чай зеленый', 'чай зелёный', 'чай без сахара', 'чай сухой', 'чай с сахаром'],
};

export const normalizeSearchText = (value: unknown): string =>
  String(value ?? '')
    .toLowerCase()
    .replace(/[^a-z0-9а-яё]+/gi, ' ')
    .replace(/\s+/g, ' ')
    .trim();

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

const createStagingClient = (): { client: SupabaseClient; ref: string; keyKind: 'anon' | 'service-role' } => {
  ['.env.local', '.env', '.env.staging.local'].forEach((fileName) => {
    loadEnvFile(path.resolve(process.cwd(), fileName));
  });

  const url = process.env.STAGING_SUPABASE_URL;
  const anonKey = process.env.STAGING_SUPABASE_ANON_KEY;
  const serviceRoleKey = process.env.STAGING_SUPABASE_SERVICE_ROLE_KEY;
  const keyKind = anonKey ? 'anon' : 'service-role';
  const key = anonKey || serviceRoleKey;
  const ref = getProjectRef(url);

  if (ref !== STAGING_REF) {
    throw new Error(`staging target mismatch: expected ${STAGING_REF}, got ${ref ?? 'missing'}`);
  }
  if (ref === PRODUCTION_REF) {
    throw new Error('production project must not be used for food search quality audit');
  }
  if (!url || !key) {
    throw new Error('missing staging Supabase URL/key for read-only audit');
  }

  return {
    client: createClient(url, key, { auth: { persistSession: false, autoRefreshToken: false } }),
    ref,
    keyKind,
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

const textSearchFoods = async (client: SupabaseClient, query: string): Promise<DbFood[]> => {
  const { data, error } = await client
    .from('foods')
    .select('id,stable_food_id,canonical_food_id,name,normalized_name,source,category,cooking_state,brand,calories,protein,fat,carbs,fiber,verified,popularity')
    .in('source', ['core', 'brand'])
    .textSearch('search_vector', query.trim(), { config: 'russian', type: 'websearch' })
    .order('popularity', { ascending: false })
    .limit(100);
  if (error) throw new Error(`foods text search failed for "${query}": ${error.message}`);
  return (data ?? []) as DbFood[];
};

const sourcePriority = (source: string | null): number => {
  if (source === 'user') return 3;
  if (source === 'core') return 2;
  return 1;
};

const matchLevelScore = (source: MatchSource): number => {
  switch (source) {
    case 'canonical_exact': return 100;
    case 'normalized_exact': return 98;
    case 'alias_exact': return 95;
    case 'canonical_prefix': return 80;
    case 'alias_prefix': return 75;
    case 'canonical_contains': return 60;
    case 'alias_contains': return 55;
    case 'db_text_search': return 50;
    default: return 0;
  }
};

const matchLevelRank = (source: MatchSource): number => {
  switch (source) {
    case 'canonical_exact': return 1;
    case 'normalized_exact': return 1;
    case 'alias_exact': return 2;
    case 'canonical_prefix': return 3;
    case 'alias_prefix': return 4;
    case 'canonical_contains': return 5;
    case 'alias_contains': return 6;
    default: return 7;
  }
};

const startsWithSearchTerm = (value: string, query: string): boolean => value === query || value.startsWith(`${query} `);
const containsSearchTerm = (value: string, query: string): boolean =>
  value === query || value.includes(` ${query} `) || value.startsWith(`${query} `) || value.endsWith(` ${query}`);

const inferV1MatchSource = (food: DbFood, query: string, aliasSources: MatchSource[]): MatchSource => {
  const normalizedQuery = normalizeSearchText(query);
  const normalizedName = String(food.normalized_name ?? '');
  const canonicalName = normalizeSearchText(food.name);
  if (canonicalName === normalizedQuery || normalizedName === normalizedQuery) return 'canonical_exact';
  if (aliasSources.includes('alias_exact')) return 'alias_exact';
  if (startsWithSearchTerm(normalizedName, normalizedQuery) || startsWithSearchTerm(canonicalName, normalizedQuery)) return 'canonical_prefix';
  if (aliasSources.includes('alias_prefix')) return 'alias_prefix';
  if (containsSearchTerm(normalizedName, normalizedQuery) || containsSearchTerm(canonicalName, normalizedQuery) || normalizedName.includes(normalizedQuery) || canonicalName.includes(normalizedQuery)) return 'canonical_contains';
  if (aliasSources.includes('alias_contains')) return 'alias_contains';
  return 'db_text_search';
};

const isDisambiguationCandidate = (food: DbFood, phrase: string): boolean => {
  const normalizedPhrase = normalizeSearchText(phrase);
  const names = [
    normalizeSearchText(food.name),
    String(food.normalized_name ?? ''),
  ].filter(Boolean);

  return names.some((name) => (
    name === normalizedPhrase ||
    startsWithSearchTerm(name, normalizedPhrase) ||
    containsSearchTerm(name, normalizedPhrase) ||
    name.includes(normalizedPhrase)
  ));
};

const inferMatchSource = (food: DbFood, query: string, aliasSources: MatchSource[]): MatchSource => {
  const normalizedQuery = normalizeSearchText(query);
  const normalizedName = String(food.normalized_name ?? '');
  const canonicalName = normalizeSearchText(food.name);
  if (canonicalName === normalizedQuery) return 'canonical_exact';
  if (normalizedName === normalizedQuery) return 'normalized_exact';
  if (aliasSources.includes('alias_exact')) return 'alias_exact';
  if (normalizedName.startsWith(normalizedQuery) || canonicalName.startsWith(normalizedQuery)) return 'canonical_prefix';
  if (aliasSources.includes('alias_prefix')) return 'alias_prefix';
  if (normalizedName.includes(normalizedQuery) || canonicalName.includes(normalizedQuery)) return 'canonical_contains';
  if (aliasSources.includes('alias_contains')) return 'alias_contains';
  return 'db_text_search';
};

const aliasSource = (alias: DbAlias, normalizedQuery: string): MatchSource | null => {
  const normalizedAlias = String(alias.normalized_alias ?? '');
  if (normalizedAlias === normalizedQuery) return 'alias_exact';
  if (normalizedAlias.startsWith(normalizedQuery)) return 'alias_prefix';
  if (normalizedAlias.includes(normalizedQuery)) return 'alias_contains';
  return null;
};

const aliasSourceV1 = (alias: DbAlias, normalizedQuery: string): MatchSource | null => {
  const normalizedAlias = String(alias.normalized_alias ?? '');
  if (normalizedAlias === normalizedQuery) return 'alias_exact';
  if (startsWithSearchTerm(normalizedAlias, normalizedQuery)) return 'alias_prefix';
  if (containsSearchTerm(normalizedAlias, normalizedQuery) || normalizedAlias.includes(normalizedQuery)) return 'alias_contains';
  return null;
};

const currentServiceSort = (items: Array<{ food: DbFood; matchSource: MatchSource }>, query: string): RankedResult[] => {
  const normalizedQuery = normalizeSearchText(query);
  const byKey = new Map<string, { food: DbFood; matchSource: MatchSource }>();

  for (const item of items) {
    const key = `${normalizeSearchText(item.food.name)}_${normalizeSearchText(item.food.brand)}`;
    const existing = byKey.get(key);
    if (!existing) {
      byKey.set(key, item);
      continue;
    }

    const existingPriority = sourcePriority(existing.food.source);
    const nextPriority = sourcePriority(item.food.source);
    if (
      nextPriority > existingPriority ||
      (nextPriority === existingPriority && (item.food.popularity ?? 0) > (existing.food.popularity ?? 0))
    ) {
      byKey.set(key, item);
    }
  }

  return Array.from(byKey.values())
    .sort((a, b) => {
      const aSource = sourcePriority(a.food.source);
      const bSource = sourcePriority(b.food.source);
      if (aSource !== bSource) return bSource - aSource;

      const aExact = normalizeSearchText(a.food.name) === normalizedQuery;
      const bExact = normalizeSearchText(b.food.name) === normalizedQuery;
      if (aExact && !bExact) return -1;
      if (!aExact && bExact) return 1;

      const popularityDelta = (b.food.popularity ?? 0) - (a.food.popularity ?? 0);
      if (popularityDelta !== 0) return popularityDelta;

      return String(a.food.name ?? '').localeCompare(String(b.food.name ?? ''), 'ru');
    })
    .slice(0, 10)
    .map((item, index) => ({
      rank: index + 1,
      food: item.food,
      matchSource: item.matchSource,
      score: matchLevelScore(item.matchSource),
      reason: [
        `current final sort: source=${item.food.source ?? 'unknown'}`,
        normalizeSearchText(item.food.name) === normalizedQuery ? 'exact display name' : 'not exact display name',
        `popularity=${item.food.popularity ?? 0}`,
        `observed match=${item.matchSource}`,
      ].join('; '),
    }));
};

const specificityScore = (food: DbFood, normalizedQuery: string): number => {
  const normalizedName = normalizeSearchText(food.name);
  const extraLength = Math.max(0, normalizedName.length - normalizedQuery.length);
  const tokenCount = normalizedName ? normalizedName.split(' ').length : 99;
  return extraLength + tokenCount * 2;
};

const stableTieBreaker = (food: DbFood): string => String(food.stable_food_id ?? food.canonical_food_id ?? food.id ?? food.name ?? '');

const rankingV1Sort = (items: Array<{ food: DbFood; matchSource: MatchSource }>, query: string): RankedResult[] => {
  const normalizedQuery = normalizeSearchText(query);
  const byCanonical = new Map<string, { food: DbFood; matchSource: MatchSource }>();

  for (const item of items) {
    const key = item.food.canonical_food_id || item.food.id;
    const existing = byCanonical.get(key);
    if (!existing) {
      byCanonical.set(key, item);
      continue;
    }
    if (matchLevelRank(item.matchSource) < matchLevelRank(existing.matchSource)) {
      byCanonical.set(key, item);
    }
  }

  return Array.from(byCanonical.values())
    .sort((a, b) => {
      const matchDelta = matchLevelRank(a.matchSource) - matchLevelRank(b.matchSource);
      if (matchDelta !== 0) return matchDelta;

      const sourceDelta = sourcePriority(b.food.source) - sourcePriority(a.food.source);
      if (sourceDelta !== 0) return sourceDelta;

      if ((a.food.verified ?? false) !== (b.food.verified ?? false)) {
        return (b.food.verified ? 1 : 0) - (a.food.verified ? 1 : 0);
      }

      const specificityDelta = specificityScore(a.food, normalizedQuery) - specificityScore(b.food, normalizedQuery);
      if (specificityDelta !== 0) return specificityDelta;

      const popularityDelta = (b.food.popularity ?? 0) - (a.food.popularity ?? 0);
      if (popularityDelta !== 0) return popularityDelta;

      return stableTieBreaker(a.food).localeCompare(stableTieBreaker(b.food), 'en');
    })
    .slice(0, 10)
    .map((item, index) => ({
      rank: index + 1,
      food: item.food,
      matchSource: item.matchSource,
      score: matchLevelScore(item.matchSource),
      reason: [
        `ranking v1: match-level=${matchLevelRank(item.matchSource)}`,
        `source=${item.food.source ?? 'unknown'}`,
        `verified=${item.food.verified ?? false}`,
        `specificity=${specificityScore(item.food, normalizedQuery)}`,
        `popularity=${item.food.popularity ?? 0}`,
        `tie=${stableTieBreaker(item.food)}`,
      ].join('; '),
    }));
};

const auditQuery = async (
  client: SupabaseClient,
  testCase: SearchQualityCase,
  foods: DbFood[],
  aliases: DbAlias[]
): Promise<QueryAudit> => {
  const query = testCase.query;
  const normalizedQuery = normalizeSearchText(query);
  const foodById = new Map(foods.map((food) => [food.id, food]));
  const exactCanonicalMatches = foods.filter((food) => normalizeSearchText(food.name) === normalizedQuery || food.normalized_name === normalizedQuery);
  const queryAliases = aliases.filter((alias) => alias.normalized_alias === normalizedQuery);
  const exactAliasTargets = queryAliases
    .map((alias) => alias.canonical_food_id ? foodById.get(alias.canonical_food_id) ?? null : null)
    .filter((food): food is DbFood => Boolean(food));
  const exactGeneric = exactCanonicalMatches.find((food) => food.source === 'core') ?? exactCanonicalMatches[0] ?? null;

  const dbTextResults = await textSearchFoods(client, query);
  const aliasMatches = aliases
    .map((alias) => {
      const source = aliasSource(alias, normalizedQuery);
      const food = alias.canonical_food_id ? foodById.get(alias.canonical_food_id) ?? null : null;
      return source && food ? { food, source } : null;
    })
    .filter((item): item is { food: DbFood; source: MatchSource } => Boolean(item));
  const aliasMatchesV1 = aliases
    .map((alias) => {
      const source = aliasSourceV1(alias, normalizedQuery);
      const food = alias.canonical_food_id ? foodById.get(alias.canonical_food_id) ?? null : null;
      return source && food ? { food, source } : null;
    })
    .filter((item): item is { food: DbFood; source: MatchSource } => Boolean(item));
  const disambiguationMatchesV1: Array<{ food: DbFood; source: MatchSource }> = [];
  for (const phrase of MANUAL_DISAMBIGUATION_POLICY[normalizedQuery] ?? []) {
    const phraseFoods = await textSearchFoods(client, phrase);
    phraseFoods
      .filter((food) => isDisambiguationCandidate(food, phrase))
      .forEach((food) => disambiguationMatchesV1.push({ food, source: 'alias_prefix' }));
  }

  const aliasSourcesByFood = new Map<string, MatchSource[]>();
  for (const item of aliasMatches) {
    aliasSourcesByFood.set(item.food.id, [...(aliasSourcesByFood.get(item.food.id) ?? []), item.source]);
  }
  const aliasSourcesByFoodV1 = new Map<string, MatchSource[]>();
  for (const item of aliasMatchesV1) {
    aliasSourcesByFoodV1.set(item.food.id, [...(aliasSourcesByFoodV1.get(item.food.id) ?? []), item.source]);
  }

  const merged = [
    ...dbTextResults.map((food) => ({ food, matchSource: inferMatchSource(food, query, aliasSourcesByFood.get(food.id) ?? []) })),
    ...aliasMatches.map((item) => ({ food: item.food, matchSource: inferMatchSource(item.food, query, [item.source]) })),
  ];
  const v1Merged = [
    ...dbTextResults.map((food) => ({ food, matchSource: inferV1MatchSource(food, query, aliasSourcesByFoodV1.get(food.id) ?? []) })),
    ...aliasMatchesV1.map((item) => ({ food: item.food, matchSource: inferV1MatchSource(item.food, query, [item.source]) })),
    ...disambiguationMatchesV1.map((item) => ({ food: item.food, matchSource: item.source })),
  ];
  const top10 = currentServiceSort(merged, query);
  const v1Top10 = rankingV1Sort(v1Merged, query);
  const issues = classifyQuery(testCase, exactGeneric, exactAliasTargets, top10);

  return {
    testCase,
    normalizedQuery,
    aliases: queryAliases,
    exactGeneric,
    exactCanonicalMatches,
    exactAliasTargets,
    top10,
    v1Top10,
    issues,
  };
};

export const classifyQuery = (
  testCase: SearchQualityCase,
  exactGeneric: DbFood | null,
  exactAliasTargets: DbFood[],
  top10: RankedResult[]
): Array<{ code: SearchIssueCode; severity: Severity; detail: string }> => {
  const issues: Array<{ code: SearchIssueCode; severity: Severity; detail: string }> = [];
  const stableIds = top10.map((item) => item.food.stable_food_id ?? item.food.id);
  const duplicateIds = stableIds.filter((id, index) => stableIds.indexOf(id) !== index);
  const genericRank = exactGeneric ? top10.find((item) => item.food.id === exactGeneric.id)?.rank ?? null : null;

  if (duplicateIds.length > 0) {
    issues.push({ code: 'DUPLICATE_CANONICAL_RESULT', severity: 'high', detail: `Duplicate canonical ids in top10: ${Array.from(new Set(duplicateIds)).join(', ')}` });
  }

  if (testCase.genericPolicy === 'manual_selection') {
    issues.push({ code: 'BROAD_QUERY_SHOULD_SHOW_CHOICES', severity: 'medium', detail: testCase.notes });
    if (top10.length === 0) {
      issues.push({ code: 'DATA_QUALITY_ISSUE', severity: 'medium', detail: 'No candidates returned for a common broad query; likely missing alias or canonical coverage.' });
    } else {
      const top = top10[0];
      if (top && ['canonical_contains', 'alias_contains', 'db_text_search'].includes(top.matchSource)) {
        const strongerDetail = top10.slice(1).some((item) => ['canonical_prefix', 'alias_prefix', 'canonical_exact', 'alias_exact'].includes(item.matchSource))
          ? ' above stronger prefix/exact candidates'
          : ' without a safer prefix/exact choice list';
        issues.push({ code: 'SPECIFIC_RESULT_TOO_HIGH', severity: 'medium', detail: `Contains/text-search result "${top.food.name}" ranks${strongerDetail}.` });
      }
    }
  } else if (!exactGeneric) {
    issues.push({ code: 'MISSING_GENERIC_CANONICAL', severity: 'high', detail: 'No exact generic canonical row matched the normalized query.' });
  } else if (!genericRank || genericRank > 3) {
    issues.push({ code: 'GENERIC_EXISTS_LOW_RANK', severity: 'high', detail: `Generic candidate exists but rank is ${genericRank ?? 'not in top10'}.` });
  }

  if (exactAliasTargets.length > 1) {
    issues.push({ code: 'ALIAS_TARGET_WRONG', severity: 'medium', detail: `Exact alias maps to multiple canonical foods: ${exactAliasTargets.map((food) => food.stable_food_id ?? food.name).join(', ')}` });
  }

  const top = top10[0];
  if (top && testCase.genericPolicy === 'required' && exactGeneric && top.food.id !== exactGeneric.id && top.matchSource !== 'canonical_exact') {
    issues.push({ code: 'SPECIFIC_RESULT_TOO_HIGH', severity: 'medium', detail: `Top result "${top.food.name}" is above generic "${exactGeneric.name}".` });
  }

  if (issues.length === 0) {
    issues.push({ code: 'ACCEPTABLE', severity: 'low', detail: 'No blocking issue found for current policy.' });
  }

  return issues;
};

const issueCounts = (audits: QueryAudit[]) => {
  const flat = audits.flatMap((audit) => audit.issues).filter((issue) => issue.code !== 'ACCEPTABLE');
  return {
    dataGaps: flat.filter((issue) => ['MISSING_GENERIC_CANONICAL', 'DATA_QUALITY_ISSUE'].includes(issue.code)).length,
    rankingGaps: flat.filter((issue) => ['GENERIC_EXISTS_LOW_RANK', 'SPECIFIC_RESULT_TOO_HIGH', 'RANDOM_DB_ORDER', 'DUPLICATE_CANONICAL_RESULT', 'COOKING_STATE_MISMATCH', 'CATEGORY_MISMATCH'].includes(issue.code)).length,
    aliasGaps: flat.filter((issue) => issue.code === 'ALIAS_TARGET_WRONG' || (issue.code === 'DATA_QUALITY_ISSUE' && issue.detail.includes('alias'))).length,
  };
};

const mdTable = (headers: string[], rows: Array<Array<string | number | null | undefined>>): string => {
  const header = `| ${headers.join(' |')} |`;
  const sep = `| ${headers.map(() => '---').join(' | ')} |`;
  const body = rows.map((row) => `| ${row.map((cell) => String(cell ?? '').replace(/\|/g, '\\|')).join(' | ')} |`);
  return [header, sep, ...body].join('\n');
};

const renderTopRows = (audit: QueryAudit): string => mdTable(
  ['rank', 'name', 'stable_food_id', 'match source', 'category', 'cooking_state', 'reason'],
  audit.top10.map((item) => [
    item.rank,
    item.food.name,
    item.food.stable_food_id,
    item.matchSource,
    item.food.category,
    item.food.cooking_state,
    item.reason,
  ])
);

const renderReport = (
  projectRef: string,
  keyKind: string,
  counts: Record<string, number>,
  audits: QueryAudit[]
): string => {
  const countsByIssue = issueCounts(audits);
  const genericCoverage = audits.filter((audit) => audit.testCase.genericPolicy === 'required');
  const genericCovered = genericCoverage.filter((audit) => Boolean(audit.exactGeneric));
  const missingGeneric = genericCoverage.filter((audit) => !audit.exactGeneric);
  const knownAudits = audits.filter((audit) => (knownWarningQueries as readonly string[]).includes(audit.testCase.query));
  const verdict = countsByIssue.dataGaps > 0 && countsByIssue.rankingGaps > 0
    ? 'SEARCH_QUALITY_MIXED_GAPS'
    : countsByIssue.dataGaps > 0
      ? 'SEARCH_QUALITY_DATA_GAPS_FOUND'
      : countsByIssue.rankingGaps > 0
        ? 'SEARCH_QUALITY_RANKING_GAPS_FOUND'
        : 'SEARCH_QUALITY_READY_FOR_IMPLEMENTATION';

  const lines: string[] = [
    '# Food Search Quality Audit',
    '',
    `- Timestamp: ${new Date().toISOString()}`,
    '- Mode: read-only staging audit',
    `- Staging project ref: ${projectRef}`,
    '- Production used: no',
    '- DB writes: no',
    '- Excel changed: no',
    `- Supabase key kind used for reads: ${keyKind}`,
    `- Final verdict: **${verdict}**`,
    '',
    '## Current Search Algorithm',
    '',
    mdTable(
      ['phase', 'current behavior', 'risk'],
      [
        ['1', 'User foods from localStorage/Supabase are appended first when userId is present.', 'User rows outrank public rows in final sort.'],
        ['2', 'Public foods are read with PostgREST textSearch(search_vector, websearch) ordered by popularity desc, limit 100.', 'DB text-search ranking is mostly lost later.'],
        ['3', 'Exact alias lookup is equality-only on food_aliases.normalized_alias; alias target foods are appended after text search.', 'Alias exact has no explicit final ranking boost.'],
        ['4', 'Fallback local cache is used only when public Supabase search returns no rows.', 'Stale cache should not affect staging when DB returns rows.'],
        ['5', 'finalizeFoodSearchResults dedupes by normalized name + brand.', 'Different canonical UUIDs with different names can both remain.'],
        ['6', 'Final sort: user first, core before brand, exact display name, then popularity desc.', 'No explicit prefix/contains/generic/specificity/cooking-state ranking.'],
      ]
    ),
    '',
    '## Generic Product Coverage',
    '',
    `- Required generic queries checked: ${genericCoverage.length}`,
    `- Exact generic canonical covered: ${genericCovered.length}`,
    `- Missing exact generic canonical: ${missingGeneric.length}`,
    '',
    mdTable(
      ['query', 'generic canonical exists', 'stable_food_id', 'exact canonical name', 'aliases', 'category', 'cooking_state', 'current rank'],
      audits.map((audit) => [
        audit.testCase.query,
        audit.exactGeneric ? 'yes' : 'no',
        audit.exactGeneric?.stable_food_id ?? '',
        audit.exactGeneric?.name ?? '',
        audit.aliases.map((alias) => alias.alias).filter(Boolean).join(', '),
        audit.exactGeneric?.category ?? '',
        audit.exactGeneric?.cooking_state ?? '',
        audit.exactGeneric ? audit.top10.find((item) => item.food.id === audit.exactGeneric?.id)?.rank ?? 'not top10' : '',
      ])
    ),
    '',
    '## Common Query Top Results',
    '',
  ];

  for (const audit of audits) {
    lines.push(`### ${audit.testCase.query}`, '', renderTopRows(audit), '');
  }

  lines.push(
    '## Known Warnings Analysis',
    '',
  );
  for (const audit of knownAudits) {
    lines.push(
      `### ${audit.testCase.query}`,
      '',
      `- Policy: ${audit.testCase.genericPolicy}`,
      `- Exact generic: ${audit.exactGeneric ? `${audit.exactGeneric.name} (${audit.exactGeneric.stable_food_id})` : 'none'}`,
      `- Exact alias targets: ${audit.exactAliasTargets.map((food) => `${food.name} (${food.stable_food_id})`).join(', ') || 'none'}`,
      `- Issues: ${audit.issues.map((issue) => `${issue.code}/${issue.severity}: ${issue.detail}`).join('; ')}`,
      ''
    );
  }

  lines.push(
    '## Ranking v1 Before/After',
    '',
    mdTable(
      ['query', 'before top3', 'after top3', 'change'],
      knownAudits.map((audit) => {
        const before = audit.top10.slice(0, 3).map((item) => `${item.food.name} (${item.matchSource})`).join('; ') || 'no results';
        const after = audit.v1Top10.slice(0, 3).map((item) => `${item.food.name} (${item.matchSource})`).join('; ') || 'no results';
        return [audit.testCase.query, before, after, before === after ? 'unchanged' : 'changed'];
      })
    ),
    ''
  );

  lines.push(
    '## Severity Classification',
    '',
    mdTable(
      ['query', 'issue', 'severity', 'detail'],
      audits.flatMap((audit) => audit.issues.map((issue) => [
        audit.testCase.query,
        issue.code,
        issue.severity,
        issue.detail,
      ]))
    ),
    '',
    '## Proposed Ranking Contract v1',
    '',
    '1. exact canonical normalized_name',
    '2. exact alias',
    '3. canonical prefix',
    '4. alias prefix',
    '5. canonical contains',
    '6. alias contains',
    '7. within equal match level: prefer safe generic/base product only when nutrition semantics are trustworthy',
    '8. prefer core/verified rows over lower-trust sources',
    '9. prefer requested cooking_state when query implies one',
    '10. deterministic tie-breaker: specificity score, popularity, stable_food_id lexical order',
    '',
    'Do not force a generic winner for broad/unsafe nutrition categories such as cheese, fish, broad bread, broad tea, and broad meat queries. Those should be manual-selection lists.',
    '',
    '## Proposed Data Corrections',
    '',
    '### A. New canonical products',
    '',
    ...missingGeneric.map((audit) => `- ${audit.testCase.query}: consider a canonical only if a trustworthy nutrition profile exists. Risk: false average nutrition if category is broad.`),
    '',
    '### B. Alias corrections',
    '',
    '- Reject broad alias: овсянка -> one canonical. Rationale: can mean oat flakes, oat groats, or cooked oatmeal.',
    '- Disambiguation policy: овсянка -> овсяные хлопья; овсяная крупа; каша овсяная; овсяная каша.',
    '- Accepted unambiguous alias proposal: овсяные хлопья -> oat_flakes. Rationale: raw/dried flakes.',
    '- Accepted unambiguous alias proposal: овсяная крупа -> oat_groats. Rationale: raw/dried groats.',
    '- Accepted unambiguous alias proposal: овсяная каша на воде -> oatmeal_porridge_with_water. Rationale: prepared boiled porridge.',
    '- Reject broad alias: чай -> one canonical. Rationale: can mean prepared unsweetened drink, dry leaves, or sweetened/additive tea.',
    '- Disambiguation policy: чай -> чай черный; чай чёрный; чай зеленый; чай зелёный; чай без сахара; чай сухой; чай с сахаром.',
    '- Accepted unambiguous alias proposal: чай зелёный -> green_tea. Rationale: prepared green tea row exists.',
    '- Accepted unambiguous alias proposal: чай зелёный сухой -> dry_green_tea. Rationale: dry leaves row exists.',
    '- Accepted unambiguous alias proposal: чай чёрный без сахара -> unsweetened_black_tea. Rationale: prepared unsweetened black tea row exists.',
    '- Accepted unambiguous alias proposal: чай чёрный байховый сухой -> dry_black_baikhovi_tea. Rationale: dry black tea leaves row exists.',
    '- Reject broad alias: чай с сахаром -> one canonical. Rationale: sugar/lemon/milk variants differ; use exact sweetened variants only.',
    '',
    '### C. Ranking changes',
    '',
    '- Preserve match source through service results and sort by deterministic match-level before popularity.',
    '- Add specificity/cooking-state tie-breakers after match-level.',
    '- Keep broad manual-selection queries as candidate lists rather than one automatic generic result.',
    '',
    '### D. Manual-selection queries',
    '',
    broadManualSelectionQueries.map((query) => `- ${query}`).join('\n'),
    '',
    '## Regression Test Matrix',
    '',
    mdTable(
      ['query', 'group', 'generic policy', 'notes'],
      foodSearchQualityCases.map((item) => [item.query, item.group, item.genericPolicy, item.notes])
    ),
    '',
    '## Recommended Implementation Phases',
    '',
    '1. Add ranking metadata and deterministic scorer without changing Food Core data.',
    '2. Add alias-only corrections for clear user-language redirects.',
    '3. Add canonical products only where nutrition profile is trustworthy.',
    '4. Re-run staging browser search smoke and diary smoke only if runtime selection contract changes.',
    '',
    '## Final Verdict',
    '',
    `**${verdict}**`,
    '',
    '## Safety',
    '',
    `- foods count observed: ${counts.foods}`,
    `- food_aliases count observed: ${counts.food_aliases}`,
    '- Food Core apply was not run.',
    '- SQL was not executed.',
    '- Staging DB was not changed.',
    '- Production was not used.',
    '- Excel was not changed.',
    '- Diary, recipes, and favorites were not changed.',
    ''
  );

  return lines.join('\n');
};

export async function runFoodSearchQualityAudit() {
  const { client, ref, keyKind } = createStagingClient();
  const counts = {
    foods: await countRows(client, 'foods'),
    food_aliases: await countRows(client, 'food_aliases'),
  };

  const foods = await fetchAll<DbFood>(
    client,
    'foods',
    'id,stable_food_id,canonical_food_id,name,normalized_name,source,category,cooking_state,brand,calories,protein,fat,carbs,fiber,verified,popularity'
  );
  const aliases = await fetchAll<DbAlias>(client, 'food_aliases', 'id,alias,normalized_alias,canonical_food_id');

  const audits: QueryAudit[] = [];
  for (const testCase of foodSearchQualityCases) {
    audits.push(await auditQuery(client, testCase, foods, aliases));
  }

  const report = renderReport(ref, keyKind, counts, audits);
  fs.mkdirSync(path.dirname(REPORT_PATH), { recursive: true });
  fs.writeFileSync(REPORT_PATH, report);

  const countsByIssue = issueCounts(audits);
  const genericRequired = audits.filter((audit) => audit.testCase.genericPolicy === 'required');
  const summary = {
    verdict: report.match(/\*\*(SEARCH_QUALITY_[A-Z_]+)\*\*/)?.[1] ?? 'SEARCH_QUALITY_AUDIT_FAIL',
    reportPath: path.relative(process.cwd(), REPORT_PATH),
    queriesAudited: audits.length,
    genericCoverage: {
      required: genericRequired.length,
      covered: genericRequired.filter((audit) => Boolean(audit.exactGeneric)).length,
      missing: genericRequired.filter((audit) => !audit.exactGeneric).map((audit) => audit.testCase.query),
    },
    issueCounts: countsByIssue,
    knownWarnings: audits
      .filter((audit) => (knownWarningQueries as readonly string[]).includes(audit.testCase.query))
      .map((audit) => ({
        query: audit.testCase.query,
        top3: audit.top10.slice(0, 3).map((item) => item.food.stable_food_id ?? item.food.name),
        issues: audit.issues.map((issue) => issue.code),
      })),
    dbWrites: false,
    productionUsed: false,
  };
  console.log(JSON.stringify(summary, null, 2));
}

const isCliEntry = process.argv[1] ? path.resolve(process.argv[1]) === path.resolve(new URL(import.meta.url).pathname) : false;

if (isCliEntry) {
  runFoodSearchQualityAudit().catch((error) => {
    console.error(error instanceof Error ? error.message : error);
    process.exitCode = 1;
  });
}
