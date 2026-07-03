import fs from 'node:fs';
import path from 'node:path';
import process from 'node:process';
import xlsx from 'xlsx';

type Severity = 'error' | 'warning';
type Verdict = 'PASS' | 'PASS_WITH_WARNINGS' | 'FAIL';
type ResolverStatus = 'resolved' | 'ambiguous' | 'unresolved';
type ResolverMatchSource = 'alias' | 'normalized_name' | 'canonical_name fallback' | '';

interface Finding {
  severity: Severity;
  phase: string;
  sheet: string;
  rowNumber: number | null;
  field: string;
  code: string;
  message: string;
}

type Row = Record<string, unknown>;

interface SheetRow {
  row: Row;
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
  verified?: string;
  confidence_score?: number | null;
  needs_review?: string;
  data_source?: string;
  nutrition_version?: string;
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
  matchSource: ResolverMatchSource;
}

const REPORT_PATH = path.resolve(process.cwd(), 'reports/food-core-dry-run-report.md');

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

const cellText = (row: Row, field: string): string => String(row[field] ?? '').trim();

const toNumber = (value: unknown): number | null => {
  if (typeof value === 'number') {
    return Number.isFinite(value) ? value : null;
  }

  const text = String(value ?? '').trim().replace(',', '.');
  if (!text) return null;
  const parsed = Number(text);
  return Number.isFinite(parsed) ? parsed : null;
};

const addFinding = (
  findings: Finding[],
  severity: Severity,
  phase: string,
  sheet: string,
  rowNumber: number | null,
  field: string,
  code: string,
  message: string
) => {
  findings.push({ severity, phase, sheet, rowNumber, field, code, message });
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
    if (requiredColumns.every((column) => headerSet.has(column))) {
      return index;
    }
  }

  return rawRows.length > 0 ? 0 : null;
};

const readSheetData = (workbook: xlsx.WorkBook, sheetName: string, requiredColumns: string[]): SheetData => {
  const rawRows = getRawSheetRows(workbook, sheetName);
  const headerRowIndex = findHeaderRowIndex(rawRows, requiredColumns);
  if (headerRowIndex === null) {
    return { headers: [], rows: [], headerRowNumber: null };
  }

  const headers = rowToHeaders(rawRows[headerRowIndex] ?? []);
  const rows: SheetRow[] = [];

  for (let index = headerRowIndex + 1; index < rawRows.length; index += 1) {
    const rawRow = rawRows[index] ?? [];
    const isEmpty = rawRow.every((value) => String(value ?? '').trim().length === 0);
    if (isEmpty) continue;

    const row: Row = {};
    headers.forEach((header, columnIndex) => {
      row[header] = rawRow[columnIndex] ?? '';
    });
    rows.push({ row, rowNumber: index + 1 });
  }

  return {
    headers,
    rows,
    headerRowNumber: headerRowIndex + 1,
  };
};

const validateRequiredColumns = (
  findings: Finding[],
  phase: string,
  sheet: string,
  headers: string[],
  requiredColumns: string[]
) => {
  const headerSet = new Set(headers);
  for (const column of requiredColumns) {
    if (!headerSet.has(column)) {
      addFinding(
        findings,
        'error',
        phase,
        sheet,
        null,
        column,
        'missing_required_column',
        `Missing required column "${column}". Found columns: ${headers.join(', ') || '(none)'}.`
      );
    }
  }
};

const findSheetName = (workbook: xlsx.WorkBook, candidates: string[]): string | null => {
  const normalizedCandidates = candidates.map((candidate) => candidate.toLowerCase());
  return workbook.SheetNames.find((sheetName) => normalizedCandidates.includes(sheetName.toLowerCase())) ?? null;
};

const countBy = <T>(items: T[], getValue: (item: T) => string | null | undefined): Map<string, number> => {
  const counts = new Map<string, number>();
  for (const item of items) {
    const value = String(getValue(item) ?? '').trim() || '(empty)';
    counts.set(value, (counts.get(value) ?? 0) + 1);
  }
  return counts;
};

const escapeMarkdown = (value: unknown): string =>
  String(value ?? '')
    .replace(/\|/g, '\\|')
    .replace(/\n/g, ' ');

const formatCountTable = (title: string, counts: Map<string, number>): string => {
  const rows = Array.from(counts.entries()).sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]));
  if (rows.length === 0) {
    return `## ${title}\n\n_No data._\n`;
  }

  return [
    `## ${title}`,
    '',
    '| Value | Count |',
    '|---|---:|',
    ...rows.map(([value, count]) => `| ${escapeMarkdown(value)} | ${count} |`),
    '',
  ].join('\n');
};

const findingsTable = (title: string, findings: Finding[]): string => {
  if (findings.length === 0) {
    return `## ${title}\n\n_None._\n`;
  }

  return [
    `## ${title}`,
    '',
    '| Phase | Sheet | Row | Field | Code | Message |',
    '|---|---|---:|---|---|---|',
    ...findings.map((finding) =>
      `| ${escapeMarkdown(finding.phase)} | ${escapeMarkdown(finding.sheet)} | ${finding.rowNumber ?? ''} | ${escapeMarkdown(finding.field)} | ${escapeMarkdown(finding.code)} | ${escapeMarkdown(finding.message)} |`
    ),
    '',
  ].join('\n');
};

const buildFoodDtos = (
  workbook: xlsx.WorkBook,
  findings: Finding[]
): { foods: FoodCoreImportDto[]; sheetData: SheetData | null } => {
  if (!workbook.Sheets.foods_import) {
    addFinding(
      findings,
      'error',
      'Phase 1 - Parse Excel',
      'foods_import',
      null,
      'sheet',
      'missing_foods_import',
      'Required sheet foods_import is missing.'
    );
    return { foods: [], sheetData: null };
  }

  const sheetData = readSheetData(workbook, 'foods_import', REQUIRED_FOOD_COLUMNS);
  validateRequiredColumns(findings, 'Phase 1 - Parse Excel', 'foods_import', sheetData.headers, REQUIRED_FOOD_COLUMNS);
  if (sheetData.headerRowNumber && sheetData.headerRowNumber !== 1) {
    addFinding(
      findings,
      'warning',
      'Phase 1 - Parse Excel',
      'foods_import',
      sheetData.headerRowNumber,
      'header',
      'header_not_first_row',
      `Header row was detected at row ${sheetData.headerRowNumber}.`
    );
  }

  const hasColumn = (column: string) => sheetData.headers.includes(column);
  const foods = sheetData.rows.map(({ row, rowNumber }) => {
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
    if (hasColumn('verified')) dto.verified = cellText(row, 'verified');
    if (hasColumn('confidence_score')) dto.confidence_score = toNumber(row.confidence_score);
    if (hasColumn('needs_review')) dto.needs_review = cellText(row, 'needs_review');
    if (hasColumn('data_source')) dto.data_source = cellText(row, 'data_source');
    if (hasColumn('nutrition_version')) dto.nutrition_version = cellText(row, 'nutrition_version');

    return dto;
  });

  return { foods, sheetData };
};

const buildAliasDtos = (
  workbook: xlsx.WorkBook,
  findings: Finding[]
): { aliases: AliasImportDto[]; sheetData: SheetData | null; present: boolean } => {
  if (!workbook.Sheets.ALIASES) {
    addFinding(
      findings,
      'warning',
      'Phase 1 - Parse Excel',
      'ALIASES',
      null,
      'sheet',
      'missing_aliases_sheet',
      'Optional sheet ALIASES is missing. Dry-run continues without aliases.'
    );
    return { aliases: [], sheetData: null, present: false };
  }

  const sheetData = readSheetData(workbook, 'ALIASES', REQUIRED_ALIAS_COLUMNS);
  validateRequiredColumns(findings, 'Phase 1 - Parse Excel', 'ALIASES', sheetData.headers, REQUIRED_ALIAS_COLUMNS);
  if (sheetData.headerRowNumber && sheetData.headerRowNumber !== 1) {
    addFinding(
      findings,
      'warning',
      'Phase 1 - Parse Excel',
      'ALIASES',
      sheetData.headerRowNumber,
      'header',
      'header_not_first_row',
      `Header row was detected at row ${sheetData.headerRowNumber}.`
    );
  }

  const aliases = sheetData.rows.map(({ row, rowNumber }) => ({
    rowNumber,
    alias: cellText(row, 'alias'),
    normalized_alias: cellText(row, 'normalized_alias'),
    canonical_id: cellText(row, 'canonical_id'),
    canonical_name: cellText(row, 'canonical_name'),
    type: cellText(row, 'type'),
    comment: cellText(row, 'comment'),
  }));

  return { aliases, sheetData, present: true };
};

const runRelationshipChecks = (
  foods: FoodCoreImportDto[],
  aliases: AliasImportDto[],
  findings: Finding[]
) => {
  const foodIds = new Map<string, FoodCoreImportDto[]>();
  for (const food of foods) {
    const list = foodIds.get(food.id) ?? [];
    list.push(food);
    foodIds.set(food.id, list);
  }

  for (const [id, rows] of foodIds) {
    if (!id || rows.length <= 1) continue;
    for (const food of rows) {
      addFinding(
        findings,
        'error',
        'Phase 3 - Relationship Checks',
        'foods_import',
        food.rowNumber,
        'id',
        'duplicate_id',
        `Duplicate id "${id}" also appears on rows ${rows.map((row) => row.rowNumber).join(', ')}.`
      );
    }
  }

  const foodIdSet = new Set(Array.from(foodIds.keys()).filter(Boolean));
  for (const food of foods) {
    if (!food.canonical_food_id || !foodIdSet.has(food.canonical_food_id)) {
      addFinding(
        findings,
        'error',
        'Phase 3 - Relationship Checks',
        'foods_import',
        food.rowNumber,
        'canonical_food_id',
        'broken_canonical_link',
        `canonical_food_id "${food.canonical_food_id}" does not exist among foods_import.id.`
      );
    }

    if (food.product_scope.toLowerCase() === 'core' && food.canonical_food_id !== food.id) {
      addFinding(
        findings,
        'error',
        'Phase 3 - Relationship Checks',
        'foods_import',
        food.rowNumber,
        'canonical_food_id',
        'core_canonical_id_mismatch',
        `For core rows canonical_food_id must match id. Got id="${food.id}", canonical_food_id="${food.canonical_food_id}".`
      );
    }

    if (food.source.toLowerCase() !== 'core') {
      addFinding(
        findings,
        'error',
        'Phase 3 - Relationship Checks',
        'foods_import',
        food.rowNumber,
        'source',
        'not_core_source',
        `source must be core. Got "${food.source}".`
      );
    }

    if (food.product_scope.toLowerCase() !== 'core') {
      addFinding(
        findings,
        'error',
        'Phase 3 - Relationship Checks',
        'foods_import',
        food.rowNumber,
        'product_scope',
        'not_core_scope',
        `product_scope must be core. Got "${food.product_scope}".`
      );
    }
  }

  const normalizedAliasMap = new Map<string, AliasImportDto[]>();
  for (const alias of aliases) {
    if (alias.canonical_id && !foodIdSet.has(alias.canonical_id)) {
      addFinding(
        findings,
        'error',
        'Phase 3 - Relationship Checks',
        'ALIASES',
        alias.rowNumber,
        'canonical_id',
        'unknown_canonical_id',
        `canonical_id "${alias.canonical_id}" does not exist in foods_import.id.`
      );
    }

    const key = alias.normalized_alias;
    if (!key) continue;
    const list = normalizedAliasMap.get(key) ?? [];
    list.push(alias);
    normalizedAliasMap.set(key, list);
  }

  for (const [normalizedAlias, rows] of normalizedAliasMap) {
    if (rows.length <= 1) continue;
    const canonicalIds = new Set(rows.map((row) => row.canonical_id).filter(Boolean));
    const code =
      canonicalIds.size > 1 ? 'alias_maps_to_multiple_canonical_ids' : 'duplicate_normalized_alias';
    const message =
      canonicalIds.size > 1
        ? `normalized_alias "${normalizedAlias}" maps to multiple canonical_id values: ${Array.from(canonicalIds).join(', ')}.`
        : `normalized_alias "${normalizedAlias}" is duplicated on rows ${rows.map((row) => row.rowNumber).join(', ')}.`;

    for (const alias of rows) {
      addFinding(
        findings,
        'error',
        'Phase 3 - Relationship Checks',
        'ALIASES',
        alias.rowNumber,
        'normalized_alias',
        code,
        message
      );
    }
  }
};

const uniqueCandidates = (foods: FoodCoreImportDto[]): FoodCoreImportDto[] => {
  const byId = new Map<string, FoodCoreImportDto>();
  for (const food of foods) {
    if (food.id && !byId.has(food.id)) byId.set(food.id, food);
  }
  return Array.from(byId.values());
};

const runResolverSimulation = (
  foods: FoodCoreImportDto[],
  aliases: AliasImportDto[]
): ResolverResult[] => {
  const foodsById = new Map(foods.map((food) => [food.id, food]));
  const aliasIndex = new Map<string, FoodCoreImportDto[]>();
  const normalizedNameIndex = new Map<string, FoodCoreImportDto[]>();
  const canonicalNameIndex = new Map<string, FoodCoreImportDto[]>();

  for (const alias of aliases) {
    const food = foodsById.get(alias.canonical_id);
    if (!food) continue;
    const key = normalizeText(alias.normalized_alias || alias.alias);
    if (!key) continue;
    const list = aliasIndex.get(key) ?? [];
    list.push(food);
    aliasIndex.set(key, uniqueCandidates(list));
  }

  for (const food of foods) {
    const normalizedName = normalizeText(food.normalized_name);
    if (normalizedName) {
      const list = normalizedNameIndex.get(normalizedName) ?? [];
      list.push(food);
      normalizedNameIndex.set(normalizedName, uniqueCandidates(list));
    }

    const canonicalName = normalizeText(food.canonical_name);
    if (canonicalName) {
      const list = canonicalNameIndex.get(canonicalName) ?? [];
      list.push(food);
      canonicalNameIndex.set(canonicalName, uniqueCandidates(list));
    }
  }

  const resolveFromIndex = (
    query: string,
    index: Map<string, FoodCoreImportDto[]>,
    matchSource: ResolverMatchSource
  ): ResolverResult | null => {
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
        matchSource,
      };
    }

    const food = candidates[0];
    return {
      query,
      normalizedQuery,
      status: 'resolved',
      matchedCanonicalId: food.id,
      matchedCanonicalName: food.canonical_name,
      matchSource,
    };
  };

  return RESOLVER_SMOKE_QUERIES.map((query) => {
    const aliasResult = resolveFromIndex(query, aliasIndex, 'alias');
    if (aliasResult) return aliasResult;

    const normalizedNameResult = resolveFromIndex(query, normalizedNameIndex, 'normalized_name');
    if (normalizedNameResult) return normalizedNameResult;

    const canonicalNameResult = resolveFromIndex(query, canonicalNameIndex, 'canonical_name fallback');
    if (canonicalNameResult) return canonicalNameResult;

    return {
      query,
      normalizedQuery: normalizeText(query),
      status: 'unresolved',
      matchedCanonicalId: '',
      matchedCanonicalName: '',
      matchSource: '',
    };
  });
};

const runIdempotencySimulation = (
  foods: FoodCoreImportDto[],
  aliases: AliasImportDto[]
): { status: 'PASS' | 'FAIL'; notes: string[] } => {
  const notes: string[] = [];
  const ids = new Map<string, number>();
  const normalizedAliases = new Map<string, number>();

  for (const food of foods) {
    if (!food.id) continue;
    ids.set(food.id, (ids.get(food.id) ?? 0) + 1);
  }

  for (const alias of aliases) {
    if (!alias.normalized_alias) continue;
    normalizedAliases.set(alias.normalized_alias, (normalizedAliases.get(alias.normalized_alias) ?? 0) + 1);
  }

  const duplicateIds = Array.from(ids.entries()).filter(([, count]) => count > 1);
  const duplicateAliases = Array.from(normalizedAliases.entries()).filter(([, count]) => count > 1);

  if (duplicateIds.length > 0) {
    notes.push(`Duplicate food ids: ${duplicateIds.map(([id]) => id).join(', ')}.`);
  }
  if (duplicateAliases.length > 0) {
    notes.push(`Duplicate normalized aliases: ${duplicateAliases.map(([alias]) => alias).join(', ')}.`);
  }
  if (notes.length === 0) {
    notes.push('Repeated offline import would produce the same food ids and alias keys.');
  }

  return {
    status: notes.length === 1 && notes[0].startsWith('Repeated offline import') ? 'PASS' : 'FAIL',
    notes,
  };
};

const resolverTable = (results: ResolverResult[]): string => [
  '## Resolver Simulation',
  '',
  '| Query | Normalized query | Status | Canonical ID | Canonical name | Match source |',
  '|---|---|---|---|---|---|',
  ...results.map((result) =>
    `| ${escapeMarkdown(result.query)} | ${escapeMarkdown(result.normalizedQuery)} | ${result.status} | ${escapeMarkdown(result.matchedCanonicalId)} | ${escapeMarkdown(result.matchedCanonicalName)} | ${escapeMarkdown(result.matchSource)} |`
  ),
  '',
].join('\n');

const metadataSection = (params: {
  metadataSheetName: string | null;
  metadataRowsCount: number;
  metadataPreview: string[];
}): string => [
  '## Metadata Summary',
  '',
  `- Metadata sheet: ${params.metadataSheetName ?? 'not found'}`,
  `- Metadata rows: ${params.metadataRowsCount}`,
  ...(params.metadataPreview.length > 0 ? ['- Preview:', ...params.metadataPreview.map((line) => `  - ${line}`)] : []),
  '',
].join('\n');

const buildReport = (params: {
  filePath: string;
  sheetNames: string[];
  metadataSheetName: string | null;
  metadataRowsCount: number;
  metadataPreview: string[];
  foods: FoodCoreImportDto[];
  aliases: AliasImportDto[];
  aliasSheetPresent: boolean;
  categoryCounts: Map<string, number>;
  sourceCounts: Map<string, number>;
  productScopeCounts: Map<string, number>;
  cookingStateCounts: Map<string, number>;
  aliasTypeCounts: Map<string, number>;
  resolverResults: ResolverResult[];
  idempotency: ReturnType<typeof runIdempotencySimulation>;
  findings: Finding[];
  verdict: Verdict;
}) => {
  const errors = params.findings.filter((finding) => finding.severity === 'error');
  const warnings = params.findings.filter((finding) => finding.severity === 'warning');
  const resolverUnresolved = params.resolverResults.filter((result) => result.status === 'unresolved');
  const resolverAmbiguous = params.resolverResults.filter((result) => result.status === 'ambiguous');

  return [
    '# Food Core Offline Dry Run Report',
    '',
    `- File name: ${path.basename(params.filePath)}`,
    `- File path: ${params.filePath}`,
    `- Sheet names: ${params.sheetNames.join(', ')}`,
    `- Final verdict: **${params.verdict}**`,
    '',
    '## Safety Notes',
    '',
    '- No database writes were performed.',
    '- Supabase was not contacted.',
    '- This is offline dry-run v1.',
    '- Offline v1: database conflict check was not performed.',
    '',
    metadataSection({
      metadataSheetName: params.metadataSheetName,
      metadataRowsCount: params.metadataRowsCount,
      metadataPreview: params.metadataPreview,
    }),
    '## Parse Summary',
    '',
    `- foods_import rows parsed: ${params.foods.length}`,
    `- ALIASES present: ${params.aliasSheetPresent ? 'yes' : 'no'}`,
    `- ALIASES rows parsed: ${params.aliases.length}`,
    '',
    '## Import DTO Summary',
    '',
    `- foods to insert: ${params.foods.length}`,
    `- aliases to insert: ${params.aliases.length}`,
    `- errors: ${errors.length}`,
    `- warnings: ${warnings.length}`,
    '',
    formatCountTable('Source Breakdown', params.sourceCounts),
    formatCountTable('Product Scope Breakdown', params.productScopeCounts),
    formatCountTable('Category Summary', params.categoryCounts),
    formatCountTable('Cooking State Summary', params.cookingStateCounts),
    formatCountTable('Alias Type Summary', params.aliasTypeCounts),
    '## Relationship Checks',
    '',
    `- Relationship errors: ${errors.filter((finding) => finding.phase === 'Phase 3 - Relationship Checks').length}`,
    `- Relationship warnings: ${warnings.filter((finding) => finding.phase === 'Phase 3 - Relationship Checks').length}`,
    '',
    resolverTable(params.resolverResults),
    '## Resolver Smoke Summary',
    '',
    `- Resolved: ${params.resolverResults.filter((result) => result.status === 'resolved').length}`,
    `- Ambiguous: ${resolverAmbiguous.length}`,
    `- Unresolved: ${resolverUnresolved.length}`,
    '',
    '## Idempotency Simulation',
    '',
    `- idempotency: **${params.idempotency.status}**`,
    ...params.idempotency.notes.map((note) => `- ${escapeMarkdown(note)}`),
    '',
    findingsTable('Errors', errors),
    findingsTable('Warnings', warnings),
  ].join('\n');
};

const main = () => {
  const fileArg = process.argv[2];
  if (!fileArg) {
    console.error('Usage: npm run dry-run:food-import -- ./path/to/Food_Core_v02.xlsx');
    process.exit(1);
  }

  const filePath = path.resolve(process.cwd(), fileArg);
  if (!fs.existsSync(filePath)) {
    console.error(`File not found: ${filePath}`);
    process.exit(1);
  }

  const workbook = xlsx.readFile(filePath, { cellDates: false });
  const findings: Finding[] = [];
  const metadataSheetName = findSheetName(workbook, ['Metadata', 'METADATA', 'metadata']);
  const metadataRows = metadataSheetName
    ? getRawSheetRows(workbook, metadataSheetName).filter((row) =>
        row.some((value) => String(value ?? '').trim().length > 0)
      )
    : [];
  const metadataPreview = metadataRows.slice(0, 5).map((row) =>
    row
      .map((value) => String(value ?? '').trim())
      .filter(Boolean)
      .join(': ')
  ).filter(Boolean);

  const { foods } = buildFoodDtos(workbook, findings);
  const { aliases, present: aliasSheetPresent } = buildAliasDtos(workbook, findings);
  runRelationshipChecks(foods, aliases, findings);

  const resolverResults = runResolverSimulation(foods, aliases);
  for (const result of resolverResults) {
    if (result.status === 'unresolved') {
      addFinding(
        findings,
        'warning',
        'Phase 5 - Resolver Simulation',
        'resolver_smoke_tests',
        null,
        result.query,
        'resolver_smoke_unresolved',
        `Smoke query "${result.query}" is unresolved without fuzzy matching.`
      );
    }
    if (result.status === 'ambiguous') {
      addFinding(
        findings,
        'warning',
        'Phase 5 - Resolver Simulation',
        'resolver_smoke_tests',
        null,
        result.query,
        'resolver_smoke_ambiguous',
        `Smoke query "${result.query}" is ambiguous without fuzzy matching.`
      );
    }
  }

  const idempotency = runIdempotencySimulation(foods, aliases);
  if (idempotency.status === 'FAIL') {
    addFinding(
      findings,
      'error',
      'Phase 6 - Idempotency Simulation',
      'offline_import',
      null,
      'idempotency',
      'idempotency_failed',
      'Repeated import would not be internally idempotent because duplicate ids or aliases exist.'
    );
  }

  const errors = findings.filter((finding) => finding.severity === 'error');
  const warnings = findings.filter((finding) => finding.severity === 'warning');
  const verdict: Verdict = errors.length > 0 ? 'FAIL' : warnings.length > 0 ? 'PASS_WITH_WARNINGS' : 'PASS';

  const report = buildReport({
    filePath,
    sheetNames: workbook.SheetNames,
    metadataSheetName,
    metadataRowsCount: metadataRows.length,
    metadataPreview,
    foods,
    aliases,
    aliasSheetPresent,
    categoryCounts: countBy(foods, (food) => food.category),
    sourceCounts: countBy(foods, (food) => food.source),
    productScopeCounts: countBy(foods, (food) => food.product_scope),
    cookingStateCounts: countBy(foods, (food) => food.cooking_state),
    aliasTypeCounts: countBy(aliases, (alias) => alias.type),
    resolverResults,
    idempotency,
    findings,
    verdict,
  });

  fs.mkdirSync(path.dirname(REPORT_PATH), { recursive: true });
  fs.writeFileSync(REPORT_PATH, report, 'utf8');

  console.log(report);
  console.log(`\nMarkdown report saved to: ${REPORT_PATH}`);
  process.exit(verdict === 'FAIL' ? 1 : 0);
};

main();
