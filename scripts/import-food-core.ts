import fs from 'node:fs';
import path from 'node:path';
import process from 'node:process';
import { randomUUID } from 'node:crypto';
import { fileURLToPath } from 'node:url';
import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import xlsx from 'xlsx';

type ImportMode = 'dry-run' | 'apply';
type ImportTarget = 'staging' | 'development' | 'production';
type Verdict = 'DRY_RUN_PASS' | 'STAGING_APPLY_PASS' | 'STAGING_APPLY_WITH_WARNINGS' | 'SCHEMA_DATA_CONTRACT_FAIL' | 'FAIL';
type DbRow = Record<string, unknown>;
type ExcelRow = Record<string, unknown>;

interface Args {
  file: string;
  mode: ImportMode;
  target: ImportTarget;
  confirmProductionImport: string;
  allowAliasRemap: boolean;
  allowUpsert: boolean;
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

interface FoodDto {
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
  fiber_100g: number | null;
  cooking_state: string;
  verified: string;
  is_verified: string;
  needs_review: string;
  is_searchable: string;
  brand: string;
  normalized_brand: string;
}

interface AliasDto {
  rowNumber: number;
  alias: string;
  normalized_alias: string;
  canonical_id: string;
  canonical_name: string;
  type: string;
  comment: string;
}

interface AliasInsertCandidate {
  alias: AliasDto;
  canonicalUuid: string;
  dbNormalizedAlias: string;
}

interface AliasDedupedEquivalent {
  alias: AliasDto;
  representative: AliasDto;
  dbNormalizedAlias: string;
}

interface Finding {
  severity: 'error' | 'warning';
  area: string;
  message: string;
}

interface Preflight {
  dbFoods: DbRow[];
  dbAliases: DbRow[];
  foodAliasTableExists: boolean;
  foodSchema: Set<string>;
  aliasSchema: Set<string>;
  foodInsertCandidates: FoodDto[];
  foodSkippedExisting: FoodDto[];
  foodIdConflicts: Array<{ food: FoodDto; db: DbRow; reason: string }>;
  normalizedNameLegacyConflicts: Array<{ food: FoodDto; db: DbRow }>;
  normalizedNameUserBrandWarnings: Array<{ food: FoodDto; db: DbRow }>;
  aliasInsertCandidates: AliasInsertCandidate[];
  aliasSkippedExisting: AliasDto[];
  aliasDedupedEquivalents: AliasDedupedEquivalent[];
  aliasConflicts: Array<{ alias: AliasDto; db?: DbRow; reason: string }>;
  aliasResolutionErrors: Array<{ alias: AliasDto; reason: string }>;
  schemaWarnings: string[];
  schemaErrors: string[];
  schemaDataContractIssues: SchemaDataContractIssue[];
  schemaDataContractWarnings: SchemaDataContractIssue[];
  generatedFoodIdsByStableId: Map<string, string>;
  foodUuidByStableId: Map<string, string>;
}

interface DbColumnContract {
  column: string;
  required: boolean;
  defaultValue: unknown;
  type: string;
}

interface SchemaDataContractIssue {
  table: string;
  column: string;
  excelField: string;
  dbNullable: boolean;
  dbDefault: unknown;
  excelNullCount: number;
  sampleStableFoodIds: string[];
  message: string;
}

interface ApplySummary {
  foodsInserted: number;
  foodsSkipped: number;
  foodBatchesAttempted: number;
  foodRowsFailed: number;
  foodInsertFailures: string[];
  aliasesInserted: number;
  aliasesSkipped: number;
  aliasBatchesAttempted: number;
  aliasRowsFailed: number;
  aliasInsertFailures: string[];
  aliasPhaseStarted: boolean;
  aliasPhaseSkippedReason: string;
}

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

const EXPECTED_FOODS_COUNT = 2200;
const EXPECTED_EXCEL_ALIAS_ROWS_COUNT = 3417;
const EXPECTED_METADATA_COUNT = 6;
const PAGE_SIZE = 1000;
const BATCH_SIZE = 100;
const REPORT_PATH = path.resolve(process.cwd(), 'reports/food-core-import-report.md');
const PRODUCTION_CONFIRMATION = 'I_UNDERSTAND_THIS_WRITES_PRODUCTION';
const PRODUCTION_PROJECT_REF = 'dtsdnhbcwpbfrhcazqkb';

const allowedStagingProjectRefs: string[] = [
  'ozidryfvhkcbtpnulakq',
];

const ownerApprovedManualAccept = [
  'Сыр Эмменталь',
  'Помидор',
  'Петрушка',
];

const keepLegacyForHistory = [
  'Куриная грудка',
  'Куриное филе',
  'Тунец в растительном масле',
  'Бефстроганов из говядины',
];

const cellText = (row: ExcelRow, field: string): string => String(row[field] ?? '').trim();
const dbText = (row: DbRow, field: string): string => String(row[field] ?? '').trim();

const toNumber = (value: unknown): number | null => {
  if (typeof value === 'number') return Number.isFinite(value) ? value : null;
  const text = String(value ?? '').trim().replace(',', '.');
  if (!text) return null;
  const parsed = Number(text);
  return Number.isFinite(parsed) ? parsed : null;
};

const normalizeText = (value: unknown): string =>
  String(value ?? '')
    .toLowerCase()
    .replace(/ё/g, 'е')
    .replace(/[^a-z0-9а-я]+/gi, ' ')
    .replace(/\s+/g, ' ')
    .trim();

export const normalizeFoodTextForDb = (value: unknown): string =>
  String(value ?? '')
    .toLowerCase()
    .replace(/[^a-z0-9а-яё]+/gi, ' ')
    .trim();

const escapeMarkdown = (value: unknown): string =>
  String(value ?? '').replace(/\|/g, '\\|').replace(/\n/g, ' ');

const parseArgs = (): Args => {
  const raw = process.argv.slice(2);
  const getValue = (flag: string): string => {
    const index = raw.indexOf(flag);
    return index >= 0 ? String(raw[index + 1] ?? '') : '';
  };
  const file = getValue('--file');
  const modeValue = getValue('--mode') || 'dry-run';
  const targetValue = getValue('--target') || 'staging';

  if (!['dry-run', 'apply'].includes(modeValue)) {
    throw new Error(`Invalid --mode "${modeValue}". Use dry-run or apply.`);
  }
  if (!['staging', 'development', 'production'].includes(targetValue)) {
    throw new Error(`Invalid --target "${targetValue}". Use staging, development, or production.`);
  }

  return {
    file,
    mode: modeValue as ImportMode,
    target: targetValue as ImportTarget,
    confirmProductionImport: getValue('--confirm-production-import'),
    allowAliasRemap: raw.includes('--allow-alias-remap'),
    allowUpsert: raw.includes('--allow-upsert'),
  };
};

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

const loadLocalEnv = (target: ImportTarget) => {
  const fileNames = target === 'staging'
    ? ['.env.local', '.env', '.env.staging.local']
    : ['.env.local', '.env'];
  for (const fileName of fileNames) {
    loadEnvFile(path.resolve(process.cwd(), fileName));
  }
};

const getProjectRef = (url: string | null): string | null => {
  if (!url) return null;
  const match = url.match(/^https:\/\/([a-z0-9-]+)\.supabase\.co\/?$/i);
  return match?.[1] ?? null;
};

const isPlaceholderValue = (value: string | null): boolean =>
  !value || /^<.*>$/.test(value) || value.includes('<') || value.includes('>');

const resolveEnv = (args: Args) => {
  loadLocalEnv(args.target);
  const currentUrl = process.env.VITE_SUPABASE_URL ?? process.env.SUPABASE_URL ?? null;
  const currentFallbackUrl = process.env.SUPABASE_URL ?? null;
  const rawStagingUrl = process.env.STAGING_SUPABASE_URL ?? null;
  const stagingUrl = isPlaceholderValue(rawStagingUrl) ? null : rawStagingUrl;
  const projectEnv = process.env.SUPABASE_PROJECT_ENV ?? null;
  const rawServiceRoleKey = args.target === 'staging'
    ? process.env.STAGING_SUPABASE_SERVICE_ROLE_KEY ?? null
    : process.env.SUPABASE_SERVICE_ROLE_KEY ?? null;
  const rawAnonKey = args.target === 'staging'
    ? process.env.STAGING_SUPABASE_ANON_KEY ?? null
    : process.env.VITE_SUPABASE_ANON_KEY ?? process.env.SUPABASE_ANON_KEY ?? null;
  const serviceRoleKey = isPlaceholderValue(rawServiceRoleKey) ? null : rawServiceRoleKey;
  const anonKey = isPlaceholderValue(rawAnonKey) ? null : rawAnonKey;
  const url = args.target === 'staging'
    ? stagingUrl
    : currentUrl;
  const key = serviceRoleKey ?? anonKey;
  const missing: string[] = [];
  const warnings: string[] = [];
  const projectRef = getProjectRef(url);
  const currentProjectRef = getProjectRef(currentUrl);

  if (args.target === 'staging') {
    if (isPlaceholderValue(stagingUrl)) missing.push('STAGING_SUPABASE_URL');
    if (isPlaceholderValue(serviceRoleKey)) missing.push('STAGING_SUPABASE_SERVICE_ROLE_KEY');
    if (stagingUrl && (stagingUrl === currentUrl || stagingUrl === currentFallbackUrl)) {
      missing.push('STAGING_SUPABASE_URL must differ from VITE_SUPABASE_URL/SUPABASE_URL');
    }
    if (projectEnv !== 'staging') {
      missing.push('SUPABASE_PROJECT_ENV=staging');
    }
    if (!projectRef) {
      missing.push('parseable STAGING_SUPABASE_URL project ref');
    }
    if (projectRef === PRODUCTION_PROJECT_REF) {
      missing.push(`staging project ref must not equal production ref ${PRODUCTION_PROJECT_REF}`);
    }
    if (args.mode === 'apply' && projectRef && !allowedStagingProjectRefs.includes(projectRef)) {
      missing.push(`staging project ref ${projectRef} must be added to allowedStagingProjectRefs before apply`);
    }
    if (args.mode === 'dry-run' && projectRef && !allowedStagingProjectRefs.includes(projectRef)) {
      warnings.push(`staging project ref ${projectRef} is not allowlisted; dry-run is allowed, apply will fail`);
    }
  } else {
    if (isPlaceholderValue(url)) missing.push('VITE_SUPABASE_URL or SUPABASE_URL');
    if (isPlaceholderValue(key)) missing.push('SUPABASE_SERVICE_ROLE_KEY or VITE_SUPABASE_ANON_KEY');
  }

  return {
    url,
    key,
    projectRef,
    currentProjectRef,
    projectEnv,
    keyType: serviceRoleKey ? 'service-role' : anonKey ? 'anon' : 'missing',
    missing,
    warnings,
  };
};

const rawRows = (workbook: xlsx.WorkBook, sheetName: string): unknown[][] => {
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

const findHeaderRowIndex = (rows: unknown[][], requiredColumns: string[]): number | null => {
  for (let index = 0; index < Math.min(rows.length, 20); index += 1) {
    const headers = rowToHeaders(rows[index] ?? []);
    const headerSet = new Set(headers);
    if (requiredColumns.every((column) => headerSet.has(column))) return index;
  }
  return rows.length > 0 ? 0 : null;
};

const readSheetData = (workbook: xlsx.WorkBook, sheetName: string, requiredColumns: string[]): SheetData => {
  const rows = rawRows(workbook, sheetName);
  const headerRowIndex = findHeaderRowIndex(rows, requiredColumns);
  if (headerRowIndex === null) return { headers: [], rows: [], headerRowNumber: null };

  const headers = rowToHeaders(rows[headerRowIndex] ?? []);
  const out: SheetRow[] = [];

  for (let index = headerRowIndex + 1; index < rows.length; index += 1) {
    const rawRow = rows[index] ?? [];
    if (rawRow.every((value) => String(value ?? '').trim().length === 0)) continue;
    const row: ExcelRow = {};
    headers.forEach((header, columnIndex) => {
      row[header] = rawRow[columnIndex] ?? '';
    });
    out.push({ row, rowNumber: index + 1 });
  }

  return { headers, rows: out, headerRowNumber: headerRowIndex + 1 };
};

const findSheetName = (workbook: xlsx.WorkBook, candidates: string[]): string | null => {
  const normalized = candidates.map((name) => name.toLowerCase());
  return workbook.SheetNames.find((sheetName) => normalized.includes(sheetName.toLowerCase())) ?? null;
};

const parseExcel = (filePath: string) => {
  const workbook = xlsx.readFile(filePath, { cellDates: false });
  const foodsSheet = readSheetData(workbook, 'foods_import', REQUIRED_FOOD_COLUMNS);
  const aliasesSheetName = findSheetName(workbook, ['ALIASES', 'aliases']);
  const metadataSheetName = findSheetName(workbook, ['Metadata', 'METADATA', 'metadata']);
  const aliasesSheet = aliasesSheetName
    ? readSheetData(workbook, aliasesSheetName, REQUIRED_ALIAS_COLUMNS)
    : { headers: [], rows: [], headerRowNumber: null };
  const metadataRows = metadataSheetName ? rawRows(workbook, metadataSheetName).filter((row) =>
    !row.every((value) => String(value ?? '').trim() === '')
  ) : [];

  const foods: FoodDto[] = foodsSheet.rows.map(({ row, rowNumber }) => ({
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
    fiber_100g: toNumber(row.fiber_100g),
    cooking_state: cellText(row, 'cooking_state'),
    verified: cellText(row, 'verified'),
    is_verified: cellText(row, 'is_verified'),
    needs_review: cellText(row, 'needs_review'),
    is_searchable: cellText(row, 'is_searchable'),
    brand: cellText(row, 'brand'),
    normalized_brand: cellText(row, 'normalized_brand'),
  }));

  const aliases: AliasDto[] = aliasesSheet.rows.map(({ row, rowNumber }) => ({
    rowNumber,
    alias: cellText(row, 'alias'),
    normalized_alias: cellText(row, 'normalized_alias'),
    canonical_id: cellText(row, 'canonical_id'),
    canonical_name: cellText(row, 'canonical_name'),
    type: cellText(row, 'type'),
    comment: cellText(row, 'comment'),
  }));

  return {
    workbook,
    sheetNames: workbook.SheetNames,
    foods,
    aliases,
    metadataRows,
    aliasesSheetName,
    metadataSheetName,
    foodsHeaders: foodsSheet.headers,
    aliasesHeaders: aliasesSheet.headers,
  };
};

const validateBeforeImport = (foods: FoodDto[], aliases: AliasDto[]): Finding[] => {
  const findings: Finding[] = [];
  const foodIds = new Set<string>();
  const aliasByNormalized = new Map<string, AliasDto>();

  for (const food of foods) {
    if (!food.id) findings.push({ severity: 'error', area: 'foods_import', message: `Row ${food.rowNumber}: id is required.` });
    if (!food.canonical_food_id) findings.push({ severity: 'error', area: 'foods_import', message: `Row ${food.rowNumber}: canonical_food_id is required.` });
    if (food.id && food.canonical_food_id && food.id !== food.canonical_food_id) {
      findings.push({ severity: 'error', area: 'foods_import', message: `Row ${food.rowNumber}: core canonical_food_id must equal id.` });
    }
    if (food.source !== 'core') findings.push({ severity: 'error', area: 'foods_import', message: `Row ${food.rowNumber}: source must be core.` });
    if (!['core', 'generic'].includes(food.product_scope)) {
      findings.push({ severity: 'error', area: 'foods_import', message: `Row ${food.rowNumber}: product_scope must be core or generic.` });
    }
    if (!food.normalized_name) findings.push({ severity: 'error', area: 'foods_import', message: `Row ${food.rowNumber}: normalized_name is required.` });
    for (const field of ['calories_100g', 'protein_100g', 'fat_100g', 'carbs_100g'] as const) {
      if (food[field] === null) findings.push({ severity: 'error', area: 'foods_import', message: `Row ${food.rowNumber}: ${field} must be numeric.` });
    }
    if (food.id && foodIds.has(food.id)) findings.push({ severity: 'error', area: 'foods_import', message: `Row ${food.rowNumber}: duplicate id ${food.id}.` });
    if (food.id) foodIds.add(food.id);
  }

  for (const alias of aliases) {
    if (!alias.alias) findings.push({ severity: 'error', area: 'ALIASES', message: `Row ${alias.rowNumber}: alias is required.` });
    if (!alias.normalized_alias) findings.push({ severity: 'error', area: 'ALIASES', message: `Row ${alias.rowNumber}: normalized_alias is required.` });
    if (!alias.canonical_id) findings.push({ severity: 'error', area: 'ALIASES', message: `Row ${alias.rowNumber}: canonical_id is required.` });
    if (alias.canonical_id && !foodIds.has(alias.canonical_id)) {
      findings.push({ severity: 'error', area: 'ALIASES', message: `Row ${alias.rowNumber}: canonical_id ${alias.canonical_id} is not present in foods_import.` });
    }
    const existing = aliasByNormalized.get(alias.normalized_alias);
    if (existing) {
      findings.push({
        severity: 'error',
        area: 'ALIASES',
        message: `Row ${alias.rowNumber}: duplicate normalized_alias "${alias.normalized_alias}" also appears on row ${existing.rowNumber}.`,
      });
    }
    if (alias.normalized_alias) aliasByNormalized.set(alias.normalized_alias, alias);
  }

  if (foods.length !== EXPECTED_FOODS_COUNT) {
    findings.push({ severity: foods.length === 0 ? 'error' : 'warning', area: 'Excel', message: `Expected ${EXPECTED_FOODS_COUNT} foods, got ${foods.length}.` });
  }
  if (aliases.length !== EXPECTED_EXCEL_ALIAS_ROWS_COUNT) {
    findings.push({ severity: aliases.length === 0 ? 'error' : 'warning', area: 'Excel', message: `Expected ${EXPECTED_EXCEL_ALIAS_ROWS_COUNT} raw Excel alias rows, got ${aliases.length}.` });
  }

  return findings;
};

const fetchAllRows = async (supabase: SupabaseClient, table: string): Promise<{ rows: DbRow[]; exists: boolean; error?: string }> => {
  const rows: DbRow[] = [];
  for (let from = 0; ; from += PAGE_SIZE) {
    const { data, error } = await supabase.from(table).select('*').range(from, from + PAGE_SIZE - 1);
    if (error) {
      const code = String(error.code ?? '');
      if (code === '42P01' || code === 'PGRST205' || /Could not find|does not exist/i.test(error.message)) {
        return { rows: [], exists: false, error: error.message };
      }
      throw new Error(`${table} read failed: ${code}: ${error.message}`);
    }
    rows.push(...(data ?? []));
    if ((data ?? []).length < PAGE_SIZE) break;
  }
  return { rows, exists: true };
};

const rowHasCreatedByUser = (row: DbRow): boolean => Boolean(dbText(row, 'created_by_user_id'));
const rowLooksBrand = (row: DbRow): boolean => Boolean(dbText(row, 'brand')) || Boolean(dbText(row, 'barcode')) || dbText(row, 'source') === 'brand';

export const exactFoodMatch = (food: FoodDto, db: DbRow): boolean => {
  const name = dbText(db, 'name');
  const expectedNormalizedName = normalizeFoodTextForDb(food.display_name || food.canonical_name);
  return (
    dbText(db, 'stable_food_id') === food.id &&
    name === (food.display_name || food.canonical_name) &&
    dbText(db, 'normalized_name') === expectedNormalizedName &&
    dbText(db, 'source') === 'core' &&
    toNumber(db.calories) === food.calories_100g &&
    toNumber(db.protein) === food.protein_100g &&
    toNumber(db.fat) === food.fat_100g &&
    toNumber(db.carbs) === food.carbs_100g
  );
};

const aliasTargetColumn = (schema: Set<string>): string | null => {
  if (schema.has('canonical_food_id')) return 'canonical_food_id';
  if (schema.has('food_id')) return 'food_id';
  if (schema.has('canonical_id')) return 'canonical_id';
  return null;
};

const columnExists = async (supabase: SupabaseClient, table: string, column: string): Promise<boolean> => {
  const { error } = await supabase.from(table).select(column).limit(1);
  return !error;
};

const detectColumns = async (
  supabase: SupabaseClient,
  table: string,
  candidateColumns: string[]
): Promise<Set<string>> => {
  const columns = new Set<string>();
  for (const column of candidateColumns) {
    if (await columnExists(supabase, table, column)) {
      columns.add(column);
    }
  }
  return columns;
};

const fetchOpenApiColumnContracts = async (
  baseUrl: string | null,
  key: string | null,
  table: string
): Promise<Map<string, DbColumnContract>> => {
  const contracts = new Map<string, DbColumnContract>();
  if (!baseUrl || !key) return contracts;
  try {
    const response = await fetch(`${baseUrl.replace(/\/$/, '')}/rest/v1/`, {
      headers: {
        apikey: key,
        authorization: `Bearer ${key}`,
      },
    });
    if (!response.ok) return contracts;
    const spec = await response.json() as {
      definitions?: Record<string, { required?: string[]; properties?: Record<string, { type?: string; format?: string; default?: unknown }> }>;
      components?: { schemas?: Record<string, { required?: string[]; properties?: Record<string, { type?: string; format?: string; default?: unknown }> }> };
    };
    const schema = spec.definitions?.[table] ?? spec.components?.schemas?.[table];
    if (!schema?.properties) return contracts;
    const required = new Set(schema.required ?? []);
    for (const [column, property] of Object.entries(schema.properties)) {
      contracts.set(column, {
        column,
        required: required.has(column),
        defaultValue: property.default,
        type: property.format ?? property.type ?? 'unknown',
      });
    }
  } catch {
    return contracts;
  }
  return contracts;
};

export const evaluateSchemaDataContracts = (
  foods: FoodDto[],
  contracts: Map<string, DbColumnContract>
): SchemaDataContractIssue[] => {
  const mappedFields: Array<{ column: string; excelField: keyof FoodDto; requiredByImporter: boolean }> = [
    { column: 'name', excelField: 'display_name', requiredByImporter: true },
    { column: 'stable_food_id', excelField: 'id', requiredByImporter: true },
    { column: 'normalized_name', excelField: 'normalized_name', requiredByImporter: true },
    { column: 'calories', excelField: 'calories_100g', requiredByImporter: true },
    { column: 'protein', excelField: 'protein_100g', requiredByImporter: true },
    { column: 'fat', excelField: 'fat_100g', requiredByImporter: true },
    { column: 'carbs', excelField: 'carbs_100g', requiredByImporter: true },
    { column: 'fiber', excelField: 'fiber_100g', requiredByImporter: false },
    { column: 'source', excelField: 'source', requiredByImporter: true },
    { column: 'canonical_food_id', excelField: 'canonical_food_id', requiredByImporter: true },
    { column: 'brand', excelField: 'brand', requiredByImporter: false },
    { column: 'normalized_brand', excelField: 'normalized_brand', requiredByImporter: false },
    { column: 'category', excelField: 'category', requiredByImporter: false },
    { column: 'product_scope', excelField: 'product_scope', requiredByImporter: false },
    { column: 'data_source', excelField: 'source', requiredByImporter: false },
    { column: 'cooking_state', excelField: 'cooking_state', requiredByImporter: false },
  ];

  const issues: SchemaDataContractIssue[] = [];
  for (const { column, excelField, requiredByImporter } of mappedFields) {
    const contract = contracts.get(column);
    if (!contract) {
      if (requiredByImporter) {
        issues.push({
          table: 'foods',
          column,
          excelField: String(excelField),
          dbNullable: false,
          dbDefault: null,
          excelNullCount: foods.length,
          sampleStableFoodIds: foods.slice(0, 10).map((food) => food.id),
          message: `foods.${column} is required by importer but was not present in DB schema cache.`,
        });
      }
      continue;
    }
    const nullRows = foods.filter((food) => food[excelField] === null || String(food[excelField] ?? '').trim() === '');
    if (contract.required && nullRows.length > 0) {
      issues.push({
        table: 'foods',
        column,
        excelField: String(excelField),
        dbNullable: false,
        dbDefault: contract.defaultValue ?? null,
        excelNullCount: nullRows.length,
        sampleStableFoodIds: nullRows.slice(0, 10).map((food) => food.id),
        message: `SCHEMA_DATA_CONTRACT_FAIL: foods.${column} is NOT NULL but Excel ${String(excelField)} has ${nullRows.length} null/blank rows.`,
      });
    }
  }
  return issues;
};

export const evaluateSchemaDataContractWarnings = (
  foods: FoodDto[],
  contracts: Map<string, DbColumnContract>
): SchemaDataContractIssue[] => {
  const warnings: SchemaDataContractIssue[] = [];
  const optionalNutrients: Array<{ column: string; excelField: keyof FoodDto }> = [
    { column: 'fiber', excelField: 'fiber_100g' },
  ];

  for (const { column, excelField } of optionalNutrients) {
    const contract = contracts.get(column);
    if (!contract || contract.required || contract.defaultValue == null) continue;
    const nullRows = foods.filter((food) => food[excelField] === null || String(food[excelField] ?? '').trim() === '');
    if (nullRows.length > 0) {
      warnings.push({
        table: 'foods',
        column,
        excelField: String(excelField),
        dbNullable: true,
        dbDefault: contract.defaultValue,
        excelNullCount: nullRows.length,
        sampleStableFoodIds: nullRows.slice(0, 10).map((food) => food.id),
        message: `unexpected_default_for_nullable_optional_nutrient: foods.${column} is nullable but has default ${String(contract.defaultValue)} while Excel ${String(excelField)} has ${nullRows.length} null/blank rows.`,
      });
    }
  }

  return warnings;
};

const dbPreflight = async (
  supabase: SupabaseClient,
  foods: FoodDto[],
  aliases: AliasDto[],
  env?: { url: string | null; key: string | null }
): Promise<Preflight> => {
  const foodsRead = await fetchAllRows(supabase, 'foods');
  if (!foodsRead.exists) throw new Error(`foods table is required but was not readable: ${foodsRead.error ?? 'missing'}`);

  const aliasesRead = await fetchAllRows(supabase, 'food_aliases');
  const dbFoods = foodsRead.rows;
  const dbAliases = aliasesRead.rows;
  const foodSchema = await detectColumns(supabase, 'foods', [
    'id',
    'stable_food_id',
    'name',
    'normalized_name',
    'calories',
    'protein',
    'fat',
    'carbs',
    'source',
    'canonical_food_id',
    'fiber',
    'is_verified',
    'verified',
    'needs_review',
    'is_searchable',
    'category',
    'product_scope',
    'data_source',
    'cooking_state',
    'brand',
    'normalized_brand',
    'created_by_user_id',
    'barcode',
  ]);
  const aliasSchema = aliasesRead.exists
    ? await detectColumns(supabase, 'food_aliases', [
        'id',
        'alias',
        'normalized_alias',
        'canonical_food_id',
        'food_id',
        'canonical_id',
        'source',
        'type',
        'comment',
        'created_by_user_id',
      ])
    : new Set<string>();
  const dbFoodByStableId = new Map(dbFoods.map((row) => [dbText(row, 'stable_food_id'), row]).filter(([stableId]) => stableId));
  const dbFoodsByNormalized = new Map<string, DbRow[]>();
  const dbAliasesByNormalized = new Map(dbAliases.map((row) => [dbText(row, 'normalized_alias'), row]));
  const generatedFoodIdsByStableId = new Map<string, string>();
  const foodUuidByStableId = new Map<string, string>();

  for (const row of dbFoods) {
    const stableId = dbText(row, 'stable_food_id');
    const uuid = dbText(row, 'id');
    if (stableId && uuid) {
      foodUuidByStableId.set(stableId, uuid);
    }
    const normalized = dbText(row, 'normalized_name');
    if (!normalized) continue;
    const rows = dbFoodsByNormalized.get(normalized) ?? [];
    rows.push(row);
    dbFoodsByNormalized.set(normalized, rows);
  }

  const preflight: Preflight = {
    dbFoods,
    dbAliases,
    foodAliasTableExists: aliasesRead.exists,
    foodSchema,
    aliasSchema,
    foodInsertCandidates: [],
    foodSkippedExisting: [],
    foodIdConflicts: [],
    normalizedNameLegacyConflicts: [],
    normalizedNameUserBrandWarnings: [],
    aliasInsertCandidates: [],
    aliasSkippedExisting: [],
    aliasDedupedEquivalents: [],
    aliasConflicts: [],
    aliasResolutionErrors: [],
    schemaWarnings: [],
    schemaErrors: [],
    schemaDataContractIssues: [],
    schemaDataContractWarnings: [],
    generatedFoodIdsByStableId,
    foodUuidByStableId,
  };

  for (const column of ['id', 'stable_food_id', 'name', 'normalized_name', 'calories', 'protein', 'fat', 'carbs', 'source', 'canonical_food_id']) {
    if (!foodSchema.has(column)) preflight.schemaErrors.push(`foods.${column} column is required for stable Food Core import.`);
  }
  for (const column of ['fiber', 'is_verified', 'verified', 'needs_review', 'is_searchable', 'category', 'product_scope', 'data_source', 'cooking_state', 'brand', 'normalized_brand']) {
    if (!foodSchema.has(column)) preflight.schemaWarnings.push(`Optional foods.${column} was not observed and will be skipped if absent.`);
  }
  if (!aliasesRead.exists) {
    preflight.schemaWarnings.push(`food_aliases table was not readable: ${aliasesRead.error ?? 'missing'}. Alias import will be skipped.`);
  }

  const foodColumnContracts = await fetchOpenApiColumnContracts(env?.url ?? null, env?.key ?? null, 'foods');
  if (foodColumnContracts.size > 0) {
    preflight.schemaDataContractIssues = evaluateSchemaDataContracts(foods, foodColumnContracts);
    preflight.schemaDataContractWarnings = evaluateSchemaDataContractWarnings(foods, foodColumnContracts);
    preflight.schemaErrors.push(...preflight.schemaDataContractIssues.map((issue) => issue.message));
    preflight.schemaWarnings.push(...preflight.schemaDataContractWarnings.map((warning) => warning.message));
  } else {
    preflight.schemaWarnings.push('OpenAPI schema cache was not readable; DB nullability/data contract checks were skipped.');
  }

  for (const food of foods) {
    const existing = dbFoodByStableId.get(food.id);
    if (!existing) {
      const generatedUuid = randomUUID();
      generatedFoodIdsByStableId.set(food.id, generatedUuid);
      foodUuidByStableId.set(food.id, generatedUuid);
      preflight.foodInsertCandidates.push(food);
    } else if (exactFoodMatch(food, existing)) {
      foodUuidByStableId.set(food.id, dbText(existing, 'id'));
      preflight.foodSkippedExisting.push(food);
    } else {
      const reason = dbText(existing, 'source') !== 'core' || rowHasCreatedByUser(existing)
        ? 'existing stable_food_id belongs to non-authoritative/user-owned row'
        : 'existing stable_food_id differs from import row';
      foodUuidByStableId.set(food.id, dbText(existing, 'id'));
      preflight.foodIdConflicts.push({ food, db: existing, reason });
    }

    const normalizedMatches = dbFoodsByNormalized.get(food.normalized_name) ?? [];
    for (const match of normalizedMatches) {
      if (dbText(match, 'stable_food_id') === food.id) continue;
      if (rowHasCreatedByUser(match) || rowLooksBrand(match)) {
        preflight.normalizedNameUserBrandWarnings.push({ food, db: match });
      } else {
        preflight.normalizedNameLegacyConflicts.push({ food, db: match });
      }
    }
  }

  if (aliasesRead.exists) {
    const targetColumn = aliasTargetColumn(aliasSchema);
    if (!targetColumn) {
      preflight.schemaErrors.push('food_aliases target column was not detected: expected canonical_food_id, food_id, or canonical_id.');
    }
    const aliasGroups = new Map<string, AliasInsertCandidate[]>();
    for (const alias of aliases) {
      const canonicalUuid = foodUuidByStableId.get(alias.canonical_id);
      if (!canonicalUuid) {
        preflight.aliasResolutionErrors.push({
          alias,
          reason: `Alias canonical_id ${alias.canonical_id} could not be resolved through foods.stable_food_id.`,
        });
        continue;
      }
      const dbNormalizedAlias = normalizeFoodTextForDb(alias.alias);
      if (!dbNormalizedAlias) {
        preflight.aliasResolutionErrors.push({
          alias,
          reason: `Alias row ${alias.rowNumber} normalized to an empty DB alias key.`,
        });
        continue;
      }
      const rows = aliasGroups.get(dbNormalizedAlias) ?? [];
      rows.push({ alias, canonicalUuid, dbNormalizedAlias });
      aliasGroups.set(dbNormalizedAlias, rows);
    }

    const aliasDedup = dedupeAliasCandidatesByDbNormalizedAlias(Array.from(aliasGroups.values()).flat());
    preflight.aliasDedupedEquivalents.push(...aliasDedup.dedupedEquivalents);
    preflight.aliasConflicts.push(...aliasDedup.conflicts);

    for (const representative of aliasDedup.insertCandidates) {
      const dbNormalizedAlias = representative.dbNormalizedAlias;
      const existing = dbAliasesByNormalized.get(dbNormalizedAlias);
      if (!existing) {
        preflight.aliasInsertCandidates.push(representative);
      } else {
        const existingTarget = targetColumn ? dbText(existing, targetColumn) : '';
        if (existingTarget === representative.canonicalUuid) {
          preflight.aliasSkippedExisting.push(representative.alias);
        } else {
          preflight.aliasConflicts.push({
            alias: representative.alias,
            db: existing,
            reason: `normalized_alias exists and points to ${existingTarget || '(unknown target)'}, expected ${representative.canonicalUuid}`,
          });
        }
      }
    }
  }

  return preflight;
};

export const dedupeAliasCandidatesByDbNormalizedAlias = (candidates: AliasInsertCandidate[]): {
  insertCandidates: AliasInsertCandidate[];
  dedupedEquivalents: AliasDedupedEquivalent[];
  conflicts: Array<{ alias: AliasDto; reason: string }>;
} => {
  const groups = new Map<string, AliasInsertCandidate[]>();
  for (const candidate of candidates) {
    const rows = groups.get(candidate.dbNormalizedAlias) ?? [];
    rows.push(candidate);
    groups.set(candidate.dbNormalizedAlias, rows);
  }

  const insertCandidates: AliasInsertCandidate[] = [];
  const dedupedEquivalents: AliasDedupedEquivalent[] = [];
  const conflicts: Array<{ alias: AliasDto; reason: string }> = [];

  for (const [dbNormalizedAlias, group] of groups) {
    const canonicalIds = new Set(group.map(({ alias }) => alias.canonical_id));
    const canonicalUuids = new Set(group.map(({ canonicalUuid }) => canonicalUuid));
    if (canonicalIds.size > 1 || canonicalUuids.size > 1) {
      for (const candidate of group) {
        conflicts.push({
          alias: candidate.alias,
          reason: `DB-normalized alias "${dbNormalizedAlias}" maps to multiple canonical ids: ${Array.from(canonicalIds).join(', ')}`,
        });
      }
      continue;
    }

    const representative = group[0];
    insertCandidates.push(representative);
    for (const duplicate of group.slice(1)) {
      dedupedEquivalents.push({
        alias: duplicate.alias,
        representative: representative.alias,
        dbNormalizedAlias,
      });
    }
  }

  return { insertCandidates, dedupedEquivalents, conflicts };
};

const boolValue = (value: string): boolean | null => {
  const normalized = normalizeText(value);
  if (['true', 'истина', 'yes', '1'].includes(normalized)) return true;
  if (['false', 'ложь', 'no', '0'].includes(normalized)) return false;
  return null;
};

export const mapFoodToDb = (food: FoodDto, schema: Set<string>, uuid: string): DbRow => {
  const row: DbRow = {};
  const setIf = (column: string, value: unknown) => {
    if (schema.has(column) || ['id', 'stable_food_id', 'name', 'normalized_name', 'calories', 'protein', 'fat', 'carbs', 'source', 'canonical_food_id'].includes(column)) {
      row[column] = value;
    }
  };

  setIf('id', uuid);
  setIf('stable_food_id', food.id);
  setIf('name', food.display_name || food.canonical_name);
  setIf('normalized_name', food.normalized_name);
  setIf('calories', food.calories_100g);
  setIf('protein', food.protein_100g);
  setIf('fat', food.fat_100g);
  setIf('carbs', food.carbs_100g);
  setIf('source', food.source);
  setIf('canonical_food_id', uuid);
  setIf('fiber', food.fiber_100g);
  setIf('category', food.category);
  setIf('product_scope', food.product_scope);
  setIf('data_source', 'food_core_v02');
  setIf('cooking_state', food.cooking_state);
  setIf('brand', food.brand || null);
  setIf('normalized_brand', food.normalized_brand || 'no_brand');
  setIf('needs_review', boolValue(food.needs_review));
  setIf('is_searchable', boolValue(food.is_searchable) ?? true);
  setIf('is_verified', boolValue(food.is_verified || food.verified) ?? true);
  setIf('verified', boolValue(food.verified || food.is_verified) ?? true);

  return Object.fromEntries(Object.entries(row).filter(([, value]) => value !== undefined));
};

const mapAliasToDb = (candidate: AliasInsertCandidate, schema: Set<string>): DbRow | null => {
  const targetColumn = aliasTargetColumn(schema);
  if (!targetColumn) return null;
  const { alias, canonicalUuid } = candidate;
  const row: DbRow = {
    alias: alias.alias,
    normalized_alias: candidate.dbNormalizedAlias,
    [targetColumn]: canonicalUuid,
  };
  if (schema.has('source')) row.source = 'food_core_v02';
  if (schema.has('type')) row.type = alias.type;
  if (schema.has('comment')) row.comment = alias.comment;
  if (schema.has('created_by_user_id')) row.created_by_user_id = null;
  return row;
};

const chunks = <T>(rows: T[], size: number): T[][] => {
  const out: T[][] = [];
  for (let index = 0; index < rows.length; index += size) {
    out.push(rows.slice(index, index + size));
  }
  return out;
};

type AliasPhaseGateInput = {
  mode: ImportMode;
  foodsInserted: number;
  foodsSkipped: number;
  foodInsertFailures: string[];
  expectedFoodRows: number;
  aliasResolutionErrors: number;
  aliasInsertCandidates: number;
};

export const evaluateAliasPhaseGate = (input: AliasPhaseGateInput): { allowed: boolean; reason: string } => {
  if (input.mode !== 'apply') {
    return { allowed: false, reason: 'mode_not_apply' };
  }
  if (input.foodInsertFailures.length > 0) {
    return { allowed: false, reason: 'food_insert_failure' };
  }
  if (input.foodsInserted + input.foodsSkipped !== input.expectedFoodRows) {
    return { allowed: false, reason: 'food_row_count_mismatch' };
  }
  if (input.aliasResolutionErrors > 0) {
    return { allowed: false, reason: 'alias_resolution_error' };
  }
  if (input.aliasInsertCandidates < 0) {
    return { allowed: false, reason: 'invalid_alias_candidate_count' };
  }
  return { allowed: true, reason: '' };
};

const supabaseErrorText = (error: {
  code?: string;
  message?: string;
  details?: string | null;
  hint?: string | null;
}): string => [
  `code=${error.code ?? 'unknown'}`,
  `message=${error.message ?? 'unknown error'}`,
  error.details ? `details=${error.details}` : '',
  error.hint ? `hint=${error.hint}` : '',
].filter(Boolean).join('; ');

export const applyImport = async (
  supabase: SupabaseClient,
  preflight: Preflight,
  args: Args
): Promise<ApplySummary> => {
  const summary: ApplySummary = {
    foodsInserted: 0,
    foodsSkipped: preflight.foodSkippedExisting.length,
    foodBatchesAttempted: 0,
    foodRowsFailed: 0,
    foodInsertFailures: [],
    aliasesInserted: 0,
    aliasesSkipped: preflight.aliasSkippedExisting.length,
    aliasBatchesAttempted: 0,
    aliasRowsFailed: 0,
    aliasInsertFailures: [],
    aliasPhaseStarted: false,
    aliasPhaseSkippedReason: '',
  };

  const foodRows = preflight.foodInsertCandidates
    .map((food) => {
      const uuid = preflight.generatedFoodIdsByStableId.get(food.id);
      return uuid ? mapFoodToDb(food, preflight.foodSchema, uuid) : null;
    })
    .filter((row): row is DbRow => Boolean(row));
  const foodBatches = chunks(foodRows, BATCH_SIZE);
  for (let batchIndex = 0; batchIndex < foodBatches.length; batchIndex += 1) {
    const batch = foodBatches[batchIndex];
    if (batch.length === 0) continue;
    summary.foodBatchesAttempted += 1;
    const query = args.allowUpsert
      ? supabase.from('foods').upsert(batch, { onConflict: 'id' })
      : supabase.from('foods').insert(batch);
    const { error } = await query;
    if (error) {
      summary.foodRowsFailed += batch.length;
      const startIndex = batchIndex * BATCH_SIZE;
      const endIndex = startIndex + batch.length - 1;
      summary.foodInsertFailures.push(
        `batch=${batchIndex + 1}; startIndex=${startIndex}; endIndex=${endIndex}; attemptedRows=${batch.length}; ${supabaseErrorText(error)}`
      );
      break;
    } else {
      summary.foodsInserted += batch.length;
    }
  }

  if (!preflight.foodAliasTableExists) {
    summary.aliasPhaseSkippedReason = 'food_aliases_table_missing';
    return summary;
  }

  const aliasGate = evaluateAliasPhaseGate({
    mode: args.mode,
    foodsInserted: summary.foodsInserted,
    foodsSkipped: summary.foodsSkipped,
    foodInsertFailures: summary.foodInsertFailures,
    expectedFoodRows: preflight.foodInsertCandidates.length + preflight.foodSkippedExisting.length,
    aliasResolutionErrors: preflight.aliasResolutionErrors.length,
    aliasInsertCandidates: preflight.aliasInsertCandidates.length,
  });
  if (!aliasGate.allowed) {
    summary.aliasPhaseSkippedReason = aliasGate.reason;
    return summary;
  }

  summary.aliasPhaseStarted = true;
  const aliasRows = preflight.aliasInsertCandidates
    .map((candidate) => mapAliasToDb(candidate, preflight.aliasSchema))
    .filter((row): row is DbRow => Boolean(row));

  const aliasBatches = chunks(aliasRows, BATCH_SIZE);
  for (let batchIndex = 0; batchIndex < aliasBatches.length; batchIndex += 1) {
    const batch = aliasBatches[batchIndex];
    if (batch.length === 0) continue;
    summary.aliasBatchesAttempted += 1;
    const { error } = await supabase.from('food_aliases').insert(batch);
    if (error) {
      summary.aliasRowsFailed += batch.length;
      const startIndex = batchIndex * BATCH_SIZE;
      const endIndex = startIndex + batch.length - 1;
      summary.aliasInsertFailures.push(
        `batch=${batchIndex + 1}; startIndex=${startIndex}; endIndex=${endIndex}; attemptedRows=${batch.length}; ${supabaseErrorText(error)}`
      );
      break;
    } else {
      summary.aliasesInserted += batch.length;
    }
  }

  if (args.allowAliasRemap) {
    summary.aliasInsertFailures.push('Alias remap flag was passed, but update/remap is intentionally not implemented in first import script.');
  }

  return summary;
};

const markdownTable = (headers: string[], rows: string[][]): string =>
  [
    `| ${headers.join(' | ')} |`,
    `| ${headers.map(() => '---').join(' | ')} |`,
    ...rows.map((row) => `| ${row.map(escapeMarkdown).join(' | ')} |`),
  ].join('\n');

const writeReport = (params: {
  args: Args;
  filePath: string;
  env: ReturnType<typeof resolveEnv>;
  sheetNames: string[];
  foods: FoodDto[];
  aliases: AliasDto[];
  metadataRowsCount: number;
  findings: Finding[];
  preflight: Preflight | null;
  applySummary: ApplySummary;
  verdict: Verdict;
  productionBlocked: boolean;
}) => {
  const { args, env, preflight, applySummary } = params;
  const errors = params.findings.filter((finding) => finding.severity === 'error');
  const warnings = params.findings.filter((finding) => finding.severity === 'warning');
  const rawExcelAliasRows = params.aliases.length;
  const exactNormalizedExcelAliases = new Set(params.aliases.map((alias) => alias.normalized_alias).filter(Boolean)).size;
  const dbNormalizedDedupedEquivalentAliases = preflight?.aliasDedupedEquivalents.length ?? 0;
  const dbComparableUniqueAliases = rawExcelAliasRows - dbNormalizedDedupedEquivalentAliases;
  const preflightRows = preflight ? [
    ['DB foods rows', String(preflight.dbFoods.length)],
    ['DB alias rows', String(preflight.dbAliases.length)],
    ['Stable food id insert candidates', String(preflight.foodInsertCandidates.length)],
    ['Food skipped existing', String(preflight.foodSkippedExisting.length)],
    ['Stable food id conflicts', String(preflight.foodIdConflicts.length)],
    ['Normalized name legacy conflicts', String(preflight.normalizedNameLegacyConflicts.length)],
    ['Normalized name user/brand warnings', String(preflight.normalizedNameUserBrandWarnings.length)],
    ['Alias insert candidates', String(preflight.aliasInsertCandidates.length)],
    ['Alias skipped existing', String(preflight.aliasSkippedExisting.length)],
    ['Alias deduped/skipped equivalents', String(preflight.aliasDedupedEquivalents.length)],
    ['Alias conflicts', String(preflight.aliasConflicts.length)],
    ['Alias canonical resolution errors', String(preflight.aliasResolutionErrors.length)],
    ['Generated UUIDs for new foods', String(preflight.generatedFoodIdsByStableId.size)],
    ['Schema/data contract issues', String(preflight.schemaDataContractIssues.length)],
    ['Schema/data contract warnings', String(preflight.schemaDataContractWarnings.length)],
  ] : [];

  const report = [
    '# Food Core Import Report',
    '',
    `- Timestamp: ${new Date().toISOString()}`,
    `- Mode: ${args.mode}`,
    `- Target: ${args.target}`,
    `- File: ${params.filePath}`,
    `- Final verdict: **${params.verdict}**`,
    '',
    '## Safety',
    '',
    `- Production apply blocked: ${params.productionBlocked ? 'yes' : 'no'}`,
    '- No DELETE operations are implemented.',
    '- food_diary_entries were not updated.',
    '- recipe_ingredients were not updated.',
    '- recipes were not recalculated.',
    '- legacy foods were not deleted.',
    '- owner approved manual accept list is recorded only.',
    '',
    '## Env',
    '',
    `- Supabase URL present: ${env.url ? 'yes' : 'no'}`,
    `- Supabase key present: ${env.key ? 'yes' : 'no'}`,
    `- Key type: ${env.keyType}`,
    `- Target project ref: ${env.projectRef ?? 'missing'}`,
    `- Current/live project ref: ${env.currentProjectRef ?? 'missing'}`,
    `- SUPABASE_PROJECT_ENV: ${env.projectEnv ?? 'missing'}`,
    '- Secret values were not printed.',
    '',
    '## Owner Decisions Recorded',
    '',
    `- Manual accept/remap allowed later: ${ownerApprovedManualAccept.join(', ')}`,
    `- Keep legacy for history: ${keepLegacyForHistory.join(', ')}`,
    '',
    '## Excel Summary',
    '',
    `- Sheet names: ${params.sheetNames.join(', ')}`,
    `- Foods count: ${params.foods.length}`,
    `- Raw Excel alias rows: ${rawExcelAliasRows}`,
    `- Exact unique normalized_alias values in Excel: ${exactNormalizedExcelAliases}`,
    `- DB-normalized deduped equivalent aliases: ${dbNormalizedDedupedEquivalentAliases}`,
    `- DB-comparable unique aliases represented by Excel: ${dbComparableUniqueAliases}`,
    `- Metadata count: ${params.metadataRowsCount}`,
    '',
    '## Alias Count Contract',
    '',
    '- Raw Excel alias rows are validated against the workbook export contract.',
    '- DB alias rows are compared only after importer DB-normalization/deduplication.',
    '- Some Excel rows intentionally differ only by punctuation/decimal spelling and collapse to one DB alias.',
    '',
    markdownTable(['Metric', 'Count'], [
      ['Raw Excel alias rows', String(rawExcelAliasRows)],
      ['Exact unique normalized_alias values in Excel', String(exactNormalizedExcelAliases)],
      ['DB-normalized deduped equivalent aliases', String(dbNormalizedDedupedEquivalentAliases)],
      ['DB-comparable unique aliases represented by Excel', String(dbComparableUniqueAliases)],
      ['Current DB alias rows', preflight ? String(preflight.dbAliases.length) : 'n/a'],
      ['Alias insert candidates', preflight ? String(preflight.aliasInsertCandidates.length) : 'n/a'],
      ['Expected DB aliases after apply', preflight ? String(preflight.dbAliases.length + preflight.aliasInsertCandidates.length) : 'n/a'],
    ]),
    '',
    '## Identity Mapping',
    '',
    '- `foods.id` remains UUID and is generated by the import script for new Food Core rows.',
    '- Excel `foods_import.id` is mapped to `foods.stable_food_id`.',
    '- `foods.canonical_food_id` is set to the generated UUID row id for core root foods.',
    '- `food_aliases.canonical_food_id` is resolved through `ALIASES.canonical_id` -> `foods.stable_food_id` -> UUID `foods.id`.',
    '- Semantic Food Core ids are never written into UUID FK columns.',
    '',
    '## Validation Summary',
    '',
    `- Errors: ${errors.length}`,
    `- Warnings: ${warnings.length}`,
    '',
    '## DB Preflight Summary',
    '',
    preflight ? markdownTable(['Metric', 'Count'], preflightRows) : 'DB preflight did not run.',
    '',
    '## Apply Summary',
    '',
    markdownTable(['Metric', 'Count'], [
      ['Food batches attempted', String(applySummary.foodBatchesAttempted)],
      ['Foods inserted', String(applySummary.foodsInserted)],
      ['Foods skipped', String(applySummary.foodsSkipped)],
      ['Food rows failed', String(applySummary.foodRowsFailed)],
      ['Food insert failures', String(applySummary.foodInsertFailures.length)],
      ['Alias phase started', applySummary.aliasPhaseStarted ? 'yes' : 'no'],
      ['Alias phase skipped reason', applySummary.aliasPhaseSkippedReason || 'none'],
      ['Alias batches attempted', String(applySummary.aliasBatchesAttempted)],
      ['Aliases inserted', String(applySummary.aliasesInserted)],
      ['Aliases skipped', String(applySummary.aliasesSkipped)],
      ['Alias rows failed', String(applySummary.aliasRowsFailed)],
      ['Alias insert failures', String(applySummary.aliasInsertFailures.length)],
    ]),
    '',
    '## Importer Fail-Fast Contract',
    '',
    '- Any food insert batch failure stops remaining food batches.',
    '- Any food insert failure skips alias phase.',
    '- Alias phase has an explicit gate and only starts after a complete food phase.',
    '- Alias phase requires zero alias canonical resolution errors.',
    '- Any alias insert batch failure stops remaining alias batches.',
    '- No automatic retry is implemented.',
    '- No automatic cleanup/delete is implemented.',
    '- Partial inserted counts are reported when a failure occurs.',
    '- Apply failures set a non-zero process exit code.',
    '',
    '## Schema Warnings',
    '',
    preflight && (preflight.schemaErrors.length || preflight.schemaWarnings.length)
      ? [
          ...preflight.schemaErrors.map((error) => `- ERROR: ${error}`),
          ...preflight.schemaWarnings.map((warning) => `- WARNING: ${warning}`),
        ].join('\n')
      : '- none',
    '',
    '## Schema/Data Contract Issues',
    '',
    preflight && preflight.schemaDataContractIssues.length
      ? markdownTable(
          ['Table', 'Column', 'Excel field', 'DB nullable', 'DB default', 'Excel null count', 'Sample stable_food_id'],
          preflight.schemaDataContractIssues.map((issue) => [
            issue.table,
            issue.column,
            issue.excelField,
            issue.dbNullable ? 'yes' : 'no',
            issue.dbDefault == null ? 'none' : String(issue.dbDefault),
            String(issue.excelNullCount),
            issue.sampleStableFoodIds.join(', '),
          ])
        )
      : '- none',
    '',
    '## Schema/Data Contract Warnings',
    '',
    preflight && preflight.schemaDataContractWarnings.length
      ? markdownTable(
          ['Table', 'Column', 'Excel field', 'DB nullable', 'DB default', 'Excel null count', 'Sample stable_food_id'],
          preflight.schemaDataContractWarnings.map((warning) => [
            warning.table,
            warning.column,
            warning.excelField,
            warning.dbNullable ? 'yes' : 'no',
            warning.dbDefault == null ? 'none' : String(warning.dbDefault),
            String(warning.excelNullCount),
            warning.sampleStableFoodIds.join(', '),
          ])
        )
      : '- none',
    '',
    '## Findings Sample',
    '',
    params.findings.length
      ? params.findings.slice(0, 80).map((finding) => `- ${finding.severity.toUpperCase()} [${finding.area}] ${finding.message}`).join('\n')
      : '- none',
    '',
    '## Failure Samples',
    '',
    applySummary.foodInsertFailures.length || applySummary.aliasInsertFailures.length
      ? [
          ...applySummary.foodInsertFailures.map((failure) => `- Food insert failure: ${failure}`),
          ...applySummary.aliasInsertFailures.map((failure) => `- Alias insert failure: ${failure}`),
        ].join('\n')
      : '- none',
    '',
    '## Alias Resolution Errors',
    '',
    preflight && preflight.aliasResolutionErrors.length
      ? preflight.aliasResolutionErrors.slice(0, 50).map(({ alias, reason }) => `- Row ${alias.rowNumber} ${alias.normalized_alias}: ${reason}`).join('\n')
      : '- none',
    '',
    '## Alias DB-Normalized Dedup',
    '',
    preflight && preflight.aliasDedupedEquivalents.length
      ? [
          `- Deduped/skipped equivalent aliases: ${preflight.aliasDedupedEquivalents.length}`,
          ...preflight.aliasDedupedEquivalents.slice(0, 50).map(({ alias, representative, dbNormalizedAlias }) =>
            `- Row ${alias.rowNumber} ${alias.alias} -> ${dbNormalizedAlias}; representative row ${representative.rowNumber} ${representative.alias}`
          ),
        ].join('\n')
      : '- none',
    '',
    '## Alias Conflicts',
    '',
    preflight && preflight.aliasConflicts.length
      ? preflight.aliasConflicts.slice(0, 50).map(({ alias, reason }) => `- Row ${alias.rowNumber} ${alias.alias}: ${reason}`).join('\n')
      : '- none',
    '',
    '## Explicit Non-Touched Tables',
    '',
    '- food_diary_entries were not touched.',
    '- recipe_ingredients were not touched.',
    '- favorite_products were not touched.',
    '- recipes were not touched.',
    '- user_goals and progress tables were not touched.',
    '',
    '## Post-run Validation Commands',
    '',
    '- Run DB-aware dry-run again.',
    '- Run resolver smoke tests.',
    '- Run `npm run build`.',
    '- Manually check nutrition search and diary add-product flow.',
    '',
  ].join('\n');

  fs.mkdirSync(path.dirname(REPORT_PATH), { recursive: true });
  fs.writeFileSync(REPORT_PATH, report, 'utf8');
};

const main = async () => {
  const args = parseArgs();
  if (!args.file) throw new Error('Missing --file path.');
  const filePath = path.resolve(process.cwd(), args.file);
  if (!fs.existsSync(filePath)) throw new Error(`Excel file not found: ${filePath}`);

  const productionBlocked = args.target === 'production' && (
    args.mode === 'apply' ||
    args.confirmProductionImport !== PRODUCTION_CONFIRMATION
  );
  if (args.target === 'production' && args.mode === 'apply' && args.confirmProductionImport !== PRODUCTION_CONFIRMATION) {
    throw new Error(`Production apply is blocked. Required flag: --confirm-production-import ${PRODUCTION_CONFIRMATION}`);
  }
  if (args.mode === 'apply' && !['staging', 'development'].includes(args.target)) {
    throw new Error('Apply mode is allowed only for staging/development by default.');
  }

  const env = resolveEnv(args);
  const workbookData = parseExcel(filePath);
  const findings = validateBeforeImport(workbookData.foods, workbookData.aliases);
  for (const missing of env.missing) {
    findings.push({ severity: 'error', area: 'env', message: `Missing ${missing}.` });
  }
  for (const warning of env.warnings) {
    findings.push({ severity: 'warning', area: 'env', message: warning });
  }
  if (workbookData.metadataRows.length !== EXPECTED_METADATA_COUNT) {
    findings.push({
      severity: 'warning',
      area: 'Excel',
      message: `Expected ${EXPECTED_METADATA_COUNT} metadata rows, got ${workbookData.metadataRows.length}.`,
    });
  }

  let preflight: Preflight | null = null;
  let applySummary: ApplySummary = {
    foodsInserted: 0,
    foodsSkipped: 0,
    foodBatchesAttempted: 0,
    foodRowsFailed: 0,
    foodInsertFailures: [],
    aliasesInserted: 0,
    aliasesSkipped: 0,
    aliasBatchesAttempted: 0,
    aliasRowsFailed: 0,
    aliasInsertFailures: [],
    aliasPhaseStarted: false,
    aliasPhaseSkippedReason: '',
  };

  if (env.url && env.key && env.missing.length === 0) {
    const supabase = createClient(env.url, env.key, {
      auth: { persistSession: false, autoRefreshToken: false },
    });
    preflight = await dbPreflight(supabase, workbookData.foods, workbookData.aliases, env);
    findings.push(...preflight.schemaErrors.map((message) => ({ severity: 'error' as const, area: 'schema', message })));
    findings.push(...preflight.schemaWarnings.map((warning) => ({ severity: 'warning' as const, area: 'schema', message: warning })));
    findings.push(...preflight.aliasResolutionErrors.map(({ alias, reason }) => ({
      severity: 'error' as const,
      area: 'ALIASES',
      message: `Row ${alias.rowNumber}: ${reason}`,
    })));
    findings.push(...preflight.aliasConflicts.map(({ alias, reason }) => ({
      severity: 'error' as const,
      area: 'ALIASES',
      message: `Row ${alias.rowNumber}: ${reason}`,
    })));
    if (args.mode === 'apply' && findings.every((finding) => finding.severity !== 'error')) {
      applySummary = await applyImport(supabase, preflight, args);
    }
  }

  const hasErrors = findings.some((finding) => finding.severity === 'error');
  const hasApplyFailures = applySummary.foodInsertFailures.length > 0 ||
    applySummary.aliasInsertFailures.length > 0 ||
    (args.mode === 'apply' && Boolean(applySummary.aliasPhaseSkippedReason));
  const hasWarnings = findings.some((finding) => finding.severity === 'warning') ||
    Boolean(preflight && (
      preflight.foodIdConflicts.length ||
      preflight.normalizedNameLegacyConflicts.length ||
      preflight.normalizedNameUserBrandWarnings.length ||
      preflight.aliasConflicts.length
    ));

  let verdict: Verdict;
  if (preflight?.schemaDataContractIssues.length) {
    verdict = 'SCHEMA_DATA_CONTRACT_FAIL';
  } else if (hasErrors || hasApplyFailures) {
    verdict = 'FAIL';
  } else if (args.mode === 'dry-run') {
    verdict = 'DRY_RUN_PASS';
  } else {
    verdict = hasWarnings ? 'STAGING_APPLY_WITH_WARNINGS' : 'STAGING_APPLY_PASS';
  }

  writeReport({
    args,
    filePath,
    env,
    sheetNames: workbookData.sheetNames,
    foods: workbookData.foods,
    aliases: workbookData.aliases,
    metadataRowsCount: workbookData.metadataRows.length,
    findings,
    preflight,
    applySummary,
    verdict,
    productionBlocked,
  });

console.log(`Food Core Import ${args.mode}
Target: ${args.target}
Excel foods: ${workbookData.foods.length}
Excel raw alias rows: ${workbookData.aliases.length}
Excel DB-comparable unique aliases: ${preflight ? workbookData.aliases.length - preflight.aliasDedupedEquivalents.length : 0}
Metadata rows: ${workbookData.metadataRows.length}
DB foods: ${preflight?.dbFoods.length ?? 0}
DB aliases: ${preflight?.dbAliases.length ?? 0}
Food insert candidates: ${preflight?.foodInsertCandidates.length ?? 0}
Food skipped existing: ${preflight?.foodSkippedExisting.length ?? 0}
Stable food id conflicts: ${preflight?.foodIdConflicts.length ?? 0}
Normalized legacy conflicts: ${preflight?.normalizedNameLegacyConflicts.length ?? 0}
Alias insert candidates: ${preflight?.aliasInsertCandidates.length ?? 0}
Alias skipped existing: ${preflight?.aliasSkippedExisting.length ?? 0}
Alias deduped/skipped equivalents: ${preflight?.aliasDedupedEquivalents.length ?? 0}
Alias conflicts: ${preflight?.aliasConflicts.length ?? 0}
Alias resolution errors: ${preflight?.aliasResolutionErrors.length ?? 0}
Food batches attempted: ${applySummary.foodBatchesAttempted}
Foods inserted: ${applySummary.foodsInserted}
Food insert failures: ${applySummary.foodInsertFailures.length}
Alias phase started: ${applySummary.aliasPhaseStarted ? 'yes' : 'no'}
Alias phase skipped reason: ${applySummary.aliasPhaseSkippedReason || 'none'}
Alias batches attempted: ${applySummary.aliasBatchesAttempted}
Aliases inserted: ${applySummary.aliasesInserted}
Alias insert failures: ${applySummary.aliasInsertFailures.length}
Verdict: ${verdict}
Report: ${REPORT_PATH}`);

  if (verdict === 'FAIL' || verdict === 'SCHEMA_DATA_CONTRACT_FAIL') process.exitCode = 1;
};

const isCliEntry = process.argv[1]
  ? fileURLToPath(import.meta.url) === path.resolve(process.argv[1])
  : false;

if (isCliEntry) {
  main().catch((error) => {
    console.error(error instanceof Error ? error.message : error);
    process.exitCode = 1;
  });
}
