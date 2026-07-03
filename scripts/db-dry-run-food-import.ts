import fs from 'node:fs';
import path from 'node:path';
import process from 'node:process';
import { createClient } from '@supabase/supabase-js';
import xlsx from 'xlsx';

type Severity = 'error' | 'warning';
type Verdict = 'PASS' | 'PASS_WITH_WARNINGS' | 'FAIL';
type FoodStatus = 'INSERT_CANDIDATE' | 'EXACT_MATCH' | 'UPDATE_CANDIDATE' | 'CONFLICT' | 'SKIP';
type AliasStatus = 'INSERT_CANDIDATE' | 'EXACT_MATCH' | 'CONFLICT' | 'SKIP';
type ResolverStatus = 'resolved' | 'ambiguous' | 'unresolved';

type DbRow = Record<string, unknown>;
type ExcelRow = Record<string, unknown>;

interface Finding {
  severity: Severity;
  type: string;
  idOrAlias: string;
  excelValue: string;
  dbValue: string;
  reason: string;
}

interface UpdateCandidate {
  id: string;
  field: string;
  excelValue: string;
  dbValue: string;
}

interface SheetRow {
  row: ExcelRow;
  rowNumber: number;
}

interface SheetData {
  headers: string[];
  rows: SheetRow[];
  headerRowNumber: number | null;
}

interface FoodCoreImportDto {
  rowNumber: number;
  id: string;
  canonical_name: string;
  normalized_name: string;
  display_name: string;
  category: string;
  product_scope: string;
  source: string;
  canonical_food_id: string;
  calories_100g: number | null;
  protein_100g: number | null;
  fat_100g: number | null;
  carbs_100g: number | null;
  fiber_100g?: number | null;
  cooking_state?: string;
}

interface AliasImportDto {
  rowNumber: number;
  alias: string;
  normalized_alias: string;
  canonical_id: string;
  canonical_name: string;
  type: string;
  comment: string;
}

interface ResolverResult {
  query: string;
  normalizedQuery: string;
  status: ResolverStatus;
  matchedCanonicalId: string;
  matchedCanonicalName: string;
  matchSource: string;
}

interface EnvResult {
  url: string | null;
  key: string | null;
  urlPresent: boolean;
  keyPresent: boolean;
  keyType: 'service-role' | 'anon' | 'missing';
  missing: string[];
}

const REPORT_PATH = path.resolve(process.cwd(), 'reports/food-core-db-dry-run-report.md');
const PAGE_SIZE = 1000;

const REQUIRED_FOOD_COLUMNS = [
  'id',
  'canonical_name',
  'normalized_name',
  'display_name',
  'category',
  'product_scope',
  'source',
  'canonical_food_id',
  'calories_100g',
  'protein_100g',
  'fat_100g',
  'carbs_100g',
];

const REQUIRED_ALIAS_COLUMNS = [
  'alias',
  'canonical_id',
  'canonical_name',
  'normalized_alias',
  'type',
  'comment',
];

const RESOLVER_SMOKE_QUERIES = [
  'картошка',
  'курогрудь',
  'греча',
  'гречка',
  'овсянка',
  'яблоки',
  'кефир',
  'молоко 3.2',
  'творог 5',
  'рис отварной',
  'макароны отварные',
  'банан',
  'яйцо',
  'сыр',
  'курица',
];

const normalizeText = (value: unknown): string =>
  String(value ?? '')
    .toLowerCase()
    .replace(/ё/g, 'е')
    .replace(/[^a-z0-9а-я]+/gi, ' ')
    .replace(/\s+/g, ' ')
    .trim();

const cellText = (row: ExcelRow, field: string): string => String(row[field] ?? '').trim();

const toNumber = (value: unknown): number | null => {
  if (typeof value === 'number') return Number.isFinite(value) ? value : null;
  const text = String(value ?? '').trim().replace(',', '.');
  if (!text) return null;
  const parsed = Number(text);
  return Number.isFinite(parsed) ? parsed : null;
};

const toComparableNumber = (value: unknown): number | null => {
  const number = toNumber(value);
  if (number === null) return null;
  return Math.round(number * 1000) / 1000;
};

const escapeMarkdown = (value: unknown): string =>
  String(value ?? '')
    .replace(/\|/g, '\\|')
    .replace(/\n/g, ' ');

const loadEnvFile = (filePath: string) => {
  if (!fs.existsSync(filePath)) return;
  const lines = fs.readFileSync(filePath, 'utf8').split(/\r?\n/);
  for (const line of lines) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#')) continue;
    const match = trimmed.match(/^([A-Za-z_][A-Za-z0-9_]*)=(.*)$/);
    if (!match) continue;
    const [, key, rawValue] = match;
    if (process.env[key] !== undefined) continue;
    process.env[key] = rawValue.replace(/^['"]|['"]$/g, '');
  }
};

const loadLocalEnv = () => {
  for (const fileName of ['.env.local', '.env']) {
    loadEnvFile(path.resolve(process.cwd(), fileName));
  }
};

const resolveEnv = (): EnvResult => {
  loadLocalEnv();
  const url = process.env.VITE_SUPABASE_URL ?? process.env.SUPABASE_URL ?? null;
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY ?? null;
  const anonKey = process.env.VITE_SUPABASE_ANON_KEY ?? process.env.SUPABASE_ANON_KEY ?? null;
  const key = serviceRoleKey ?? anonKey;
  const missing: string[] = [];

  if (!url) missing.push('VITE_SUPABASE_URL or SUPABASE_URL');
  if (!key) missing.push('SUPABASE_SERVICE_ROLE_KEY or VITE_SUPABASE_ANON_KEY');

  return {
    url,
    key,
    urlPresent: Boolean(url),
    keyPresent: Boolean(key),
    keyType: serviceRoleKey ? 'service-role' : anonKey ? 'anon' : 'missing',
    missing,
  };
};

const getRawSheetRows = (workbook: xlsx.WorkBook, sheetName: string): unknown[][] => {
  const sheet = workbook.Sheets[sheetName];
  if (!sheet) return [];
  return xlsx.utils.sheet_to_json<unknown[]>(sheet, {
    header: 1,
    defval: '',
    raw: false,
    blankrows: false,
  });
};

const rowToHeaders = (row: unknown[]): string[] =>
  row.map((value) => String(value ?? '').trim()).filter(Boolean);

const findHeaderRowIndex = (rawRows: unknown[][], requiredColumns: string[]): number | null => {
  const maxScanRows = Math.min(rawRows.length, 20);
  for (let index = 0; index < maxScanRows; index += 1) {
    const headers = rowToHeaders(rawRows[index] ?? []);
    const headerSet = new Set(headers);
    if (requiredColumns.every((column) => headerSet.has(column))) return index;
  }
  return rawRows.length > 0 ? 0 : null;
};

const readSheetData = (workbook: xlsx.WorkBook, sheetName: string, requiredColumns: string[]): SheetData => {
  const rawRows = getRawSheetRows(workbook, sheetName);
  const headerRowIndex = findHeaderRowIndex(rawRows, requiredColumns);
  if (headerRowIndex === null) return { headers: [], rows: [], headerRowNumber: null };

  const headers = rowToHeaders(rawRows[headerRowIndex] ?? []);
  const rows: SheetRow[] = [];

  for (let index = headerRowIndex + 1; index < rawRows.length; index += 1) {
    const rawRow = rawRows[index] ?? [];
    if (rawRow.every((value) => String(value ?? '').trim().length === 0)) continue;

    const row: ExcelRow = {};
    headers.forEach((header, columnIndex) => {
      row[header] = rawRow[columnIndex] ?? '';
    });
    rows.push({ row, rowNumber: index + 1 });
  }

  return { headers, rows, headerRowNumber: headerRowIndex + 1 };
};

const findSheetName = (workbook: xlsx.WorkBook, candidates: string[]): string | null => {
  const normalizedCandidates = candidates.map((candidate) => candidate.toLowerCase());
  return workbook.SheetNames.find((sheetName) => normalizedCandidates.includes(sheetName.toLowerCase())) ?? null;
};

const buildFoodDtos = (workbook: xlsx.WorkBook): FoodCoreImportDto[] => {
  if (!workbook.Sheets.foods_import) return [];
  const sheetData = readSheetData(workbook, 'foods_import', REQUIRED_FOOD_COLUMNS);
  const hasColumn = (column: string) => sheetData.headers.includes(column);

  return sheetData.rows.map(({ row, rowNumber }) => {
    const dto: FoodCoreImportDto = {
      rowNumber,
      id: cellText(row, 'id'),
      canonical_name: cellText(row, 'canonical_name'),
      normalized_name: cellText(row, 'normalized_name'),
      display_name: cellText(row, 'display_name'),
      category: cellText(row, 'category'),
      product_scope: cellText(row, 'product_scope'),
      source: cellText(row, 'source'),
      canonical_food_id: cellText(row, 'canonical_food_id'),
      calories_100g: toNumber(row.calories_100g),
      protein_100g: toNumber(row.protein_100g),
      fat_100g: toNumber(row.fat_100g),
      carbs_100g: toNumber(row.carbs_100g),
    };

    if (hasColumn('fiber_100g')) dto.fiber_100g = toNumber(row.fiber_100g);
    if (hasColumn('cooking_state')) dto.cooking_state = cellText(row, 'cooking_state');
    return dto;
  });
};

const buildAliasDtos = (workbook: xlsx.WorkBook): AliasImportDto[] => {
  if (!workbook.Sheets.ALIASES) return [];
  const sheetData = readSheetData(workbook, 'ALIASES', REQUIRED_ALIAS_COLUMNS);
  return sheetData.rows.map(({ row, rowNumber }) => ({
    rowNumber,
    alias: cellText(row, 'alias'),
    normalized_alias: cellText(row, 'normalized_alias'),
    canonical_id: cellText(row, 'canonical_id'),
    canonical_name: cellText(row, 'canonical_name'),
    type: cellText(row, 'type'),
    comment: cellText(row, 'comment'),
  }));
};

const countBy = <T>(items: T[], getValue: (item: T) => string | null | undefined): Map<string, number> => {
  const counts = new Map<string, number>();
  for (const item of items) {
    const value = String(getValue(item) ?? '').trim() || '(empty)';
    counts.set(value, (counts.get(value) ?? 0) + 1);
  }
  return counts;
};

const fetchAllRows = async (
  client: ReturnType<typeof createClient>,
  tableName: string
): Promise<{ rows: DbRow[]; error: string | null }> => {
  const rows: DbRow[] = [];
  for (let from = 0; ; from += PAGE_SIZE) {
    const to = from + PAGE_SIZE - 1;
    const { data, error } = await client.from(tableName).select('*').range(from, to);
    if (error) {
      return { rows, error: `${error.code ?? 'unknown'}: ${error.message}` };
    }
    const page = (data ?? []) as DbRow[];
    rows.push(...page);
    if (page.length < PAGE_SIZE) break;
  }
  return { rows, error: null };
};

const dbText = (row: DbRow | undefined, field: string): string => String(row?.[field] ?? '').trim();
const dbHasValue = (row: DbRow | undefined, field: string): boolean => row?.[field] !== undefined && row?.[field] !== null;

const dbId = (row: DbRow): string => dbText(row, 'id');
const dbStableFoodId = (row: DbRow): string => dbText(row, 'stable_food_id');
const dbName = (row: DbRow): string => dbText(row, 'name') || dbText(row, 'canonical_name') || dbText(row, 'display_name');
const dbCanonicalId = (row: DbRow): string => dbText(row, 'canonical_food_id') || dbText(row, 'id');
const dbAliasCanonicalId = (row: DbRow): string =>
  dbText(row, 'canonical_food_id') || dbText(row, 'canonical_id') || dbText(row, 'food_id');

const compareTextField = (
  updates: UpdateCandidate[],
  id: string,
  field: string,
  excelValue: string,
  dbValue: string
) => {
  if (excelValue.trim() !== dbValue.trim()) {
    updates.push({ id, field, excelValue, dbValue });
  }
};

const compareNumberField = (
  updates: UpdateCandidate[],
  id: string,
  field: string,
  excelValue: number | null | undefined,
  dbValue: unknown
) => {
  const excelNumber = excelValue ?? null;
  const dbNumber = toComparableNumber(dbValue);
  if (excelNumber === null && dbNumber === null) return;
  if (toComparableNumber(excelNumber) !== dbNumber) {
    updates.push({
      id,
      field,
      excelValue: excelNumber === null ? '' : String(excelNumber),
      dbValue: dbNumber === null ? '' : String(dbNumber),
    });
  }
};

const addConflict = (
  conflicts: Finding[],
  type: string,
  idOrAlias: string,
  excelValue: string,
  dbValue: string,
  reason: string,
  severity: Severity = 'error'
) => {
  conflicts.push({ severity, type, idOrAlias, excelValue, dbValue, reason });
};

const compareFoods = (foods: FoodCoreImportDto[], dbFoods: DbRow[]) => {
  const byId = new Map(dbFoods.map((row) => [dbId(row), row]).filter(([id]) => Boolean(id)));
  const hasStableFoodId = dbFoods.some((row) => Object.prototype.hasOwnProperty.call(row, 'stable_food_id'));
  const byStableFoodId = new Map(
    dbFoods
      .map((row) => [dbStableFoodId(row), row] as const)
      .filter(([stableFoodId]) => Boolean(stableFoodId))
  );
  const byNormalizedName = new Map<string, DbRow[]>();
  const updates: UpdateCandidate[] = [];
  const conflicts: Finding[] = [];
  const statuses = new Map<FoodStatus, number>();
  const bump = (status: FoodStatus) => statuses.set(status, (statuses.get(status) ?? 0) + 1);

  for (const row of dbFoods) {
    const normalizedName = dbText(row, 'normalized_name');
    if (!normalizedName) continue;
    const list = byNormalizedName.get(normalizedName) ?? [];
    list.push(row);
    byNormalizedName.set(normalizedName, list);
  }

  for (const [normalizedName, rows] of byNormalizedName) {
    const coreRows = rows.filter((row) => dbText(row, 'source').toLowerCase() === 'core');
    if (coreRows.length > 1) {
      addConflict(
        conflicts,
        'DB_DATA_QUALITY',
        normalizedName,
        '',
        coreRows.map((row) => dbText(row, 'id')).join(', '),
        'DB contains multiple core foods with the same normalized_name.',
        'warning'
      );
    }
  }

  const excelIds = new Set(foods.map((food) => food.id).filter(Boolean));
  const dbSemanticIds = hasStableFoodId ? new Set(Array.from(byStableFoodId.keys())) : new Set(Array.from(byId.keys()));

  if (!hasStableFoodId) {
    addConflict(
      conflicts,
      'SCHEMA_STABLE_FOOD_ID',
      'foods.stable_food_id',
      'required for Food Core v02',
      'missing',
      'DB does not expose stable_food_id; Excel semantic ids cannot be compared safely.',
      'warning'
    );
  }

  for (const food of foods) {
    if (!food.id || !food.normalized_name || !food.canonical_food_id) {
      bump('SKIP');
      continue;
    }

    if (!excelIds.has(food.canonical_food_id) && !dbSemanticIds.has(food.canonical_food_id)) {
      addConflict(
        conflicts,
        'FOOD_CANONICAL_LINK',
        food.id,
        food.canonical_food_id,
        '',
        'Excel canonical_food_id does not exist in Excel or DB.'
      );
      bump('CONFLICT');
      continue;
    }

    const normalizedNameRows = byNormalizedName.get(food.normalized_name) ?? [];
    const normalizedNameOtherIds = normalizedNameRows
      .map((row) => (hasStableFoodId ? dbStableFoodId(row) || dbId(row) : dbId(row)))
      .filter((id) => id && id !== food.id);
    if (normalizedNameOtherIds.length > 0) {
      addConflict(
        conflicts,
        'FOOD_NORMALIZED_NAME',
        food.id,
        food.normalized_name,
        normalizedNameOtherIds.join(', '),
        'Excel normalized_name is already used by another DB food id.'
      );
      bump('CONFLICT');
      continue;
    }

    const dbFood = hasStableFoodId ? byStableFoodId.get(food.id) : byId.get(food.id);
    if (!dbFood) {
      bump('INSERT_CANDIDATE');
      continue;
    }

    const dbSource = dbText(dbFood, 'source').toLowerCase();
    const dbCreatedByUserId = dbText(dbFood, 'created_by_user_id');
    const dbBrand = dbText(dbFood, 'brand') || dbText(dbFood, 'normalized_brand') || dbText(dbFood, 'barcode');
    if (dbSource && dbSource !== 'core') {
      addConflict(conflicts, 'FOOD_ID', food.id, 'source=core', `source=${dbSource}`, 'DB id exists but is not a core food.');
      bump('CONFLICT');
      continue;
    }
    if (dbCreatedByUserId) {
      addConflict(
        conflicts,
        'FOOD_ID',
        food.id,
        'created_by_user_id empty',
        dbCreatedByUserId,
        'DB id exists as a user-owned food.'
      );
      bump('CONFLICT');
      continue;
    }
    if (dbBrand && dbBrand !== 'no_brand') {
      addConflict(conflicts, 'FOOD_ID', food.id, 'core/no brand', dbBrand, 'DB row looks like brand/barcode food.');
      bump('CONFLICT');
      continue;
    }

    const currentUpdatesCount = updates.length;
    compareTextField(updates, food.id, 'name/canonical_name', food.canonical_name, dbName(dbFood));
    compareTextField(updates, food.id, 'normalized_name', food.normalized_name, dbText(dbFood, 'normalized_name'));
    compareTextField(updates, food.id, 'source', food.source, dbText(dbFood, 'source'));
    if (hasStableFoodId) compareTextField(updates, food.id, 'stable_food_id', food.id, dbStableFoodId(dbFood));
    compareTextField(updates, food.id, 'canonical_food_id_uuid', dbId(dbFood), dbCanonicalId(dbFood));
    if (dbHasValue(dbFood, 'category')) compareTextField(updates, food.id, 'category', food.category, dbText(dbFood, 'category'));
    compareNumberField(updates, food.id, 'calories', food.calories_100g, dbFood.calories);
    compareNumberField(updates, food.id, 'protein', food.protein_100g, dbFood.protein);
    compareNumberField(updates, food.id, 'fat', food.fat_100g, dbFood.fat);
    compareNumberField(updates, food.id, 'carbs', food.carbs_100g, dbFood.carbs);
    if (food.fiber_100g !== undefined && dbHasValue(dbFood, 'fiber')) {
      compareNumberField(updates, food.id, 'fiber', food.fiber_100g, dbFood.fiber);
    }

    bump(updates.length > currentUpdatesCount ? 'UPDATE_CANDIDATE' : 'EXACT_MATCH');
  }

  return { statuses, updates, conflicts };
};

const compareAliases = (aliases: AliasImportDto[], dbAliases: DbRow[] | null, dbFoods: DbRow[]) => {
  const statuses = new Map<AliasStatus, number>();
  const conflicts: Finding[] = [];
  const bump = (status: AliasStatus) => statuses.set(status, (statuses.get(status) ?? 0) + 1);
  const stableToUuid = new Map(
    dbFoods
      .map((row) => [dbStableFoodId(row), dbId(row)] as const)
      .filter(([stableFoodId, uuid]) => Boolean(stableFoodId && uuid))
  );

  if (!dbAliases) {
    for (const alias of aliases) bump(alias.normalized_alias ? 'SKIP' : 'SKIP');
    return { statuses, conflicts };
  }

  const byNormalizedAlias = new Map<string, DbRow[]>();
  for (const row of dbAliases) {
    const normalizedAlias = dbText(row, 'normalized_alias') || normalizeText(dbText(row, 'alias'));
    if (!normalizedAlias) continue;
    const list = byNormalizedAlias.get(normalizedAlias) ?? [];
    list.push(row);
    byNormalizedAlias.set(normalizedAlias, list);
  }

  for (const alias of aliases) {
    if (!alias.normalized_alias) {
      bump('SKIP');
      continue;
    }
    const rows = byNormalizedAlias.get(alias.normalized_alias) ?? [];
    const expectedCanonicalUuid = stableToUuid.get(alias.canonical_id);
    if (!expectedCanonicalUuid) {
      addConflict(
        conflicts,
        'ALIAS_CANONICAL_RESOLUTION',
        alias.normalized_alias,
        alias.canonical_id,
        '',
        'Alias canonical_id could not be resolved through DB foods.stable_food_id.',
        'warning'
      );
      bump('SKIP');
      continue;
    }
    if (rows.length === 0) {
      bump('INSERT_CANDIDATE');
      continue;
    }
    const canonicalIds = new Set(rows.map((row) => dbAliasCanonicalId(row)).filter(Boolean));
    if (canonicalIds.size === 1 && canonicalIds.has(expectedCanonicalUuid)) {
      bump('EXACT_MATCH');
      continue;
    }
    addConflict(
      conflicts,
      'ALIAS_NORMALIZED_ALIAS',
      alias.normalized_alias,
      expectedCanonicalUuid,
      Array.from(canonicalIds).join(', '),
      'DB normalized_alias points to a different canonical food id.'
    );
    bump('CONFLICT');
  }

  return { statuses, conflicts };
};

const uniqueFoods = (foods: FoodCoreImportDto[]): FoodCoreImportDto[] => {
  const map = new Map<string, FoodCoreImportDto>();
  for (const food of foods) {
    if (food.id && !map.has(food.id)) map.set(food.id, food);
  }
  return Array.from(map.values());
};

const runResolverSimulation = (foods: FoodCoreImportDto[], aliases: AliasImportDto[]): ResolverResult[] => {
  const foodsById = new Map(foods.map((food) => [food.id, food]));
  const aliasIndex = new Map<string, FoodCoreImportDto[]>();
  const normalizedNameIndex = new Map<string, FoodCoreImportDto[]>();
  const canonicalNameIndex = new Map<string, FoodCoreImportDto[]>();

  const addFood = (index: Map<string, FoodCoreImportDto[]>, key: string, food: FoodCoreImportDto) => {
    if (!key) return;
    index.set(key, uniqueFoods([...(index.get(key) ?? []), food]));
  };

  for (const alias of aliases) {
    const food = foodsById.get(alias.canonical_id);
    if (food) addFood(aliasIndex, normalizeText(alias.normalized_alias || alias.alias), food);
  }
  for (const food of foods) {
    addFood(normalizedNameIndex, normalizeText(food.normalized_name), food);
    addFood(canonicalNameIndex, normalizeText(food.canonical_name), food);
  }

  const resolveFrom = (query: string, index: Map<string, FoodCoreImportDto[]>, source: string): ResolverResult | null => {
    const normalizedQuery = normalizeText(query);
    const candidates = index.get(normalizedQuery) ?? [];
    if (candidates.length === 0) return null;
    if (candidates.length > 1) {
      return {
        query,
        normalizedQuery,
        status: 'ambiguous',
        matchedCanonicalId: candidates.map((food) => food.id).join(', '),
        matchedCanonicalName: candidates.map((food) => food.canonical_name).join(', '),
        matchSource: source,
      };
    }
    const food = candidates[0];
    return {
      query,
      normalizedQuery,
      status: 'resolved',
      matchedCanonicalId: food.id,
      matchedCanonicalName: food.canonical_name,
      matchSource: source,
    };
  };

  return RESOLVER_SMOKE_QUERIES.map((query) => {
    return (
      resolveFrom(query, aliasIndex, 'alias') ??
      resolveFrom(query, normalizedNameIndex, 'normalized_name') ??
      resolveFrom(query, canonicalNameIndex, 'canonical_name fallback') ?? {
        query,
        normalizedQuery: normalizeText(query),
        status: 'unresolved',
        matchedCanonicalId: '',
        matchedCanonicalName: '',
        matchSource: '',
      }
    );
  });
};

const countCoreFoods = (rows: DbRow[]): number => rows.filter((row) => dbText(row, 'source').toLowerCase() === 'core').length;
const countBrandFoods = (rows: DbRow[]): number =>
  rows.filter((row) => Boolean(dbText(row, 'brand') || dbText(row, 'barcode') || dbText(row, 'normalized_brand'))).length;
const countUserFoods = (rows: DbRow[]): number => rows.filter((row) => Boolean(dbText(row, 'created_by_user_id'))).length;

const statusCount = <T extends string>(counts: Map<T, number>, status: T): number => counts.get(status) ?? 0;

const countTable = (title: string, counts: Map<string, number>): string => {
  const rows = Array.from(counts.entries()).sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]));
  if (rows.length === 0) return `## ${title}\n\n_No data._\n`;
  return [
    `## ${title}`,
    '',
    '| Value | Count |',
    '|---|---:|',
    ...rows.map(([value, count]) => `| ${escapeMarkdown(value)} | ${count} |`),
    '',
  ].join('\n');
};

const conflictsTable = (title: string, findings: Finding[]): string => {
  if (findings.length === 0) return `## ${title}\n\n_None._\n`;
  return [
    `## ${title}`,
    '',
    '| Type | ID / normalized_alias | Excel value | DB value | Reason | Severity |',
    '|---|---|---|---|---|---|',
    ...findings.map((finding) =>
      `| ${escapeMarkdown(finding.type)} | ${escapeMarkdown(finding.idOrAlias)} | ${escapeMarkdown(finding.excelValue)} | ${escapeMarkdown(finding.dbValue)} | ${escapeMarkdown(finding.reason)} | ${finding.severity} |`
    ),
    '',
  ].join('\n');
};

const updatesTable = (updates: UpdateCandidate[]): string => {
  if (updates.length === 0) return '## Update Candidates Sample\n\n_None._\n';
  return [
    '## Update Candidates Sample',
    '',
    '| ID | Field | Excel value | DB value |',
    '|---|---|---|---|',
    ...updates.slice(0, 50).map((update) =>
      `| ${escapeMarkdown(update.id)} | ${escapeMarkdown(update.field)} | ${escapeMarkdown(update.excelValue)} | ${escapeMarkdown(update.dbValue)} |`
    ),
    updates.length > 50 ? `\n_Showing 50 of ${updates.length} changed fields._\n` : '',
  ].join('\n');
};

const resolverTable = (results: ResolverResult[]): string => [
  '## Resolver Smoke Summary',
  '',
  `- Resolved: ${results.filter((result) => result.status === 'resolved').length}`,
  `- Ambiguous: ${results.filter((result) => result.status === 'ambiguous').length}`,
  `- Unresolved: ${results.filter((result) => result.status === 'unresolved').length}`,
  '',
  '| Query | Normalized query | Status | Canonical ID | Canonical name | Match source |',
  '|---|---|---|---|---|---|',
  ...results.map((result) =>
    `| ${escapeMarkdown(result.query)} | ${escapeMarkdown(result.normalizedQuery)} | ${result.status} | ${escapeMarkdown(result.matchedCanonicalId)} | ${escapeMarkdown(result.matchedCanonicalName)} | ${escapeMarkdown(result.matchSource)} |`
  ),
  '',
].join('\n');

const buildReport = (params: {
  filePath: string;
  timestamp: string;
  env: EnvResult;
  sheetNames: string[];
  metadataRows: number;
  foods: FoodCoreImportDto[];
  aliases: AliasImportDto[];
  dbFoods: DbRow[];
  dbAliases: DbRow[] | null;
  schemaWarnings: string[];
  foodStatuses: Map<FoodStatus, number>;
  aliasStatuses: Map<AliasStatus, number>;
  conflicts: Finding[];
  updates: UpdateCandidate[];
  resolverResults: ResolverResult[];
  verdict: Verdict;
  dbReadError: string | null;
}) => [
  '# Food Core DB-aware Dry Run Report',
  '',
  `- File path: ${params.filePath}`,
  `- Timestamp: ${params.timestamp}`,
  '- Dry run mode: DB-aware v2',
  `- Final verdict: **${params.verdict}**`,
  '',
  '## Safety Notes',
  '',
  '- No database writes were performed.',
  '- Supabase was contacted read-only.',
  '- Only select queries were used.',
  '- food_diary_entries were NOT queried.',
  '- diary history was NOT recalculated.',
  '- recipes were NOT touched.',
  '- favorites were NOT touched.',
  '',
  '## Env Check',
  '',
  `- Supabase URL present: ${params.env.urlPresent ? 'yes' : 'no'}`,
  `- Supabase key present: ${params.env.keyPresent ? 'yes' : 'no'}`,
  `- Key type used: ${params.env.keyType}`,
  `- Missing env: ${params.env.missing.length > 0 ? params.env.missing.join(', ') : 'none'}`,
  '',
  '## Excel Summary',
  '',
  `- Sheet names: ${params.sheetNames.join(', ')}`,
  `- Foods count: ${params.foods.length}`,
  `- Aliases count: ${params.aliases.length}`,
  `- Metadata rows: ${params.metadataRows}`,
  '- Validator status: not run in this script',
  '',
  '## DB Summary',
  '',
  `- foods rows fetched: ${params.dbFoods.length}`,
  `- core foods count: ${countCoreFoods(params.dbFoods)}`,
  `- brand foods count: ${countBrandFoods(params.dbFoods)}`,
  `- user foods count: ${countUserFoods(params.dbFoods)}`,
  `- aliases rows fetched: ${params.dbAliases ? params.dbAliases.length : 'skipped'}`,
  `- DB read error: ${params.dbReadError ?? 'none'}`,
  `- Schema warnings: ${params.schemaWarnings.length > 0 ? params.schemaWarnings.join('; ') : 'none'}`,
  '',
  '## Food Comparison Summary',
  '',
  `- insert candidates: ${statusCount(params.foodStatuses, 'INSERT_CANDIDATE')}`,
  `- exact matches: ${statusCount(params.foodStatuses, 'EXACT_MATCH')}`,
  `- update candidates: ${statusCount(params.foodStatuses, 'UPDATE_CANDIDATE')}`,
  `- conflicts: ${statusCount(params.foodStatuses, 'CONFLICT')}`,
  `- skipped: ${statusCount(params.foodStatuses, 'SKIP')}`,
  '',
  '## Alias Comparison Summary',
  '',
  `- insert candidates: ${statusCount(params.aliasStatuses, 'INSERT_CANDIDATE')}`,
  `- exact matches: ${statusCount(params.aliasStatuses, 'EXACT_MATCH')}`,
  `- conflicts: ${statusCount(params.aliasStatuses, 'CONFLICT')}`,
  `- skipped: ${statusCount(params.aliasStatuses, 'SKIP')}`,
  '',
  countTable('Excel Category Summary', countBy(params.foods, (food) => food.category)),
  countTable('Excel Source Breakdown', countBy(params.foods, (food) => food.source)),
  countTable('Excel Product Scope Breakdown', countBy(params.foods, (food) => food.product_scope)),
  countTable('Excel Alias Type Breakdown', countBy(params.aliases, (alias) => alias.type)),
  conflictsTable('Conflicts Table', params.conflicts),
  updatesTable(params.updates),
  resolverTable(params.resolverResults),
].join('\n');

const main = async () => {
  const fileArg = process.argv[2];
  if (!fileArg) {
    console.error('Usage: npm run db-dry-run:food-import -- ./data/food-core/Food_Core_v02_with_aliases.xlsx');
    process.exit(1);
  }

  const filePath = path.resolve(process.cwd(), fileArg);
  const timestamp = new Date().toISOString();
  const env = resolveEnv();
  const schemaWarnings: string[] = [];
  let dbReadError: string | null = null;
  let dbFoods: DbRow[] = [];
  let dbAliases: DbRow[] | null = null;

  if (!fs.existsSync(filePath)) {
    console.error(`File not found: ${filePath}`);
    process.exit(1);
  }

  const workbook = xlsx.readFile(filePath, { cellDates: false });
  const metadataSheetName = findSheetName(workbook, ['Metadata', 'METADATA', 'metadata']);
  const metadataRows = metadataSheetName
    ? getRawSheetRows(workbook, metadataSheetName).filter((row) =>
        row.some((value) => String(value ?? '').trim().length > 0)
      ).length
    : 0;
  const foods = buildFoodDtos(workbook);
  const aliases = buildAliasDtos(workbook);

  if (env.missing.length === 0 && env.url && env.key) {
    const client = createClient(env.url, env.key, {
      auth: { persistSession: false, autoRefreshToken: false },
    });

    const foodsResult = await fetchAllRows(client, 'foods');
    if (foodsResult.error) {
      dbReadError = `foods read failed: ${foodsResult.error}`;
    } else {
      dbFoods = foodsResult.rows;
    }

    const aliasesResult = await fetchAllRows(client, 'food_aliases');
    if (aliasesResult.error) {
      schemaWarnings.push(`food_aliases unavailable or unreadable: ${aliasesResult.error}`);
    } else {
      dbAliases = aliasesResult.rows;
    }
  } else {
    dbReadError = `Missing env: ${env.missing.join(', ')}`;
  }

  const foodComparison = compareFoods(foods, dbFoods);
  const aliasComparison = compareAliases(aliases, dbAliases, dbFoods);
  const resolverResults = runResolverSimulation(foods, aliases);
  const conflicts = [...foodComparison.conflicts, ...aliasComparison.conflicts];
  const hardConflicts = conflicts.filter((conflict) => conflict.severity === 'error');

  const verdict: Verdict =
    env.missing.length > 0 || dbReadError || hardConflicts.length > 0
      ? 'FAIL'
      : schemaWarnings.length > 0 || foodComparison.updates.length > 0 || conflicts.length > 0
        ? 'PASS_WITH_WARNINGS'
        : 'PASS';

  const report = buildReport({
    filePath,
    timestamp,
    env,
    sheetNames: workbook.SheetNames,
    metadataRows,
    foods,
    aliases,
    dbFoods,
    dbAliases,
    schemaWarnings,
    foodStatuses: foodComparison.statuses,
    aliasStatuses: aliasComparison.statuses,
    conflicts,
    updates: foodComparison.updates,
    resolverResults,
    verdict,
    dbReadError,
  });

  fs.mkdirSync(path.dirname(REPORT_PATH), { recursive: true });
  fs.writeFileSync(REPORT_PATH, report, 'utf8');

  console.log('DB Dry Run v2');
  console.log(`Excel foods: ${foods.length}`);
  console.log(`Excel aliases: ${aliases.length}`);
  console.log(`DB foods: ${dbFoods.length}`);
  console.log(`DB aliases: ${dbAliases ? dbAliases.length : 'skipped'}`);
  console.log(`Insert candidates: ${statusCount(foodComparison.statuses, 'INSERT_CANDIDATE')}`);
  console.log(`Exact matches: ${statusCount(foodComparison.statuses, 'EXACT_MATCH')}`);
  console.log(`Update candidates: ${statusCount(foodComparison.statuses, 'UPDATE_CANDIDATE')}`);
  console.log(`Conflicts: ${statusCount(foodComparison.statuses, 'CONFLICT')}`);
  console.log(`Alias conflicts: ${statusCount(aliasComparison.statuses, 'CONFLICT')}`);
  console.log(`Verdict: ${verdict}`);
  console.log(`Report: ${path.relative(process.cwd(), REPORT_PATH)}`);

  process.exit(verdict === 'FAIL' ? 1 : 0);
};

main().catch((error: unknown) => {
  console.error(error instanceof Error ? error.message : String(error));
  process.exit(1);
});
