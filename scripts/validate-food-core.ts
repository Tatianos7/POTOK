import fs from 'node:fs';
import path from 'node:path';
import process from 'node:process';
import xlsx from 'xlsx';

type Severity = 'error' | 'warning';

interface Finding {
  severity: Severity;
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

const REPORT_PATH = path.resolve(process.cwd(), 'reports/food-core-validation-report.md');

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

const BOOLEAN_FIELDS = ['verified', 'needs_review', 'is_searchable', 'is_vegan', 'is_vegetarian'];
const BOOLEAN_VALUES = new Set(['TRUE', 'FALSE', 'true', 'false', 'ИСТИНА', 'ЛОЖЬ']);

const COOKING_STATES = new Set([
  'raw',
  'cooked',
  'boiled',
  'fried',
  'baked',
  'steamed',
  'grilled',
  'dried',
  'canned',
  'frozen',
  'smoked',
  'pickled',
  'roasted',
  'none',
]);

const ALIAS_TYPES = new Set(['common', 'synonym', 'plural', 'misspelling', 'slang', 'short', 'old_name']);

const BRAND_WORDS = [
  'простоквашино',
  'вкусвилл',
  'danone',
  'активиа',
  'чудо',
  'савушкин',
  'мираторг',
  'добрый',
  'coca-cola',
  'pepsi',
];

const ALL_ZERO_ALLOWLIST = new Set([
  'вода',
  'вода минеральная',
  'вода газированная',
  'вода содовая',
  'лед',
  'лёд',
  'чай зеленый',
  'чай зелёный',
  'чай черный',
  'чай чёрный',
  'кофе черный',
  'кофе чёрный',
  'краситель пищевой',
  'лимонная кислота',
  'мятная эссенция',
  'розовая эссенция',
  'кола лайт',
  'лёд колотый',
  'лед колотый',
]);

const normalizeText = (value: unknown): string =>
  String(value ?? '')
    .toLowerCase()
    .replace(/ё/g, 'е')
    .replace(/[^a-z0-9а-я]+/gi, ' ')
    .replace(/\s+/g, ' ')
    .trim();

const cellText = (row: Row, field: string): string => String(row[field] ?? '').trim();

const rawCellText = (row: Row, field: string): string => String(row[field] ?? '');

const isBlank = (value: unknown): boolean => String(value ?? '').trim().length === 0;

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
  sheet: string,
  rowNumber: number | null,
  field: string,
  code: string,
  message: string
) => {
  findings.push({ severity, sheet, rowNumber, field, code, message });
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

const hasColumn = (headers: string[], column: string): boolean => headers.includes(column);

const validateColumns = (
  findings: Finding[],
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
        sheet,
        null,
        column,
        'missing_required_column',
        `Missing required column "${column}". Found columns: ${headers.join(', ') || '(none)'}`
      );
    }
  }
};

const validateBooleanFields = (
  findings: Finding[],
  sheet: string,
  row: Row,
  rowNumber: number,
  headers: string[]
) => {
  for (const field of BOOLEAN_FIELDS) {
    if (!hasColumn(headers, field) || isBlank(row[field])) continue;
    const value = String(row[field]).trim();
    if (!BOOLEAN_VALUES.has(value)) {
      addFinding(
        findings,
        'warning',
        sheet,
        rowNumber,
        field,
        'non_standard_boolean',
        `Value "${value}" is not one of TRUE/FALSE, true/false, ИСТИНА/ЛОЖЬ.`
      );
    }
  }
};

const validateFoods = (workbook: xlsx.WorkBook, findings: Finding[]) => {
  const sheet = 'foods_import';
  const sheetData = readSheetData(workbook, sheet, REQUIRED_FOOD_COLUMNS);
  const { headers, rows } = sheetData;
  const categoryCounts = new Map<string, number>();
  const ids = new Map<string, number[]>();
  const normalizedNames = new Map<string, number[]>();
  const rowErrorNumbers = new Set<number>();

  validateColumns(findings, sheet, headers, REQUIRED_FOOD_COLUMNS);
  if (sheetData.headerRowNumber && sheetData.headerRowNumber !== 1) {
    addFinding(
      findings,
      'warning',
      sheet,
      sheetData.headerRowNumber,
      'header',
      'header_not_first_row',
      `Header row was detected at row ${sheetData.headerRowNumber}.`
    );
  }

  const addFoodFinding = (
    severity: Severity,
    rowNumber: number,
    field: string,
    code: string,
    message: string
  ) => {
    addFinding(findings, severity, sheet, rowNumber, field, code, message);
    if (severity === 'error') rowErrorNumbers.add(rowNumber);
  };

  rows.forEach(({ row, rowNumber }) => {
    const idRaw = rawCellText(row, 'id');
    const id = cellText(row, 'id');
    const canonicalId = cellText(row, 'canonical_food_id');
    const canonicalName = cellText(row, 'canonical_name');
    const normalizedName = cellText(row, 'normalized_name');
    const displayName = cellText(row, 'display_name');
    const category = cellText(row, 'category');

    if (!id) addFoodFinding('error', rowNumber, 'id', 'empty_id', 'id is empty.');
    if (idRaw !== id) addFoodFinding('error', rowNumber, 'id', 'id_outer_spaces', 'id has leading or trailing spaces.');
    if (/\s/.test(id)) addFoodFinding('error', rowNumber, 'id', 'id_contains_spaces', 'id contains spaces.');
    if (id) {
      const list = ids.get(id) ?? [];
      list.push(rowNumber);
      ids.set(id, list);
    }

    if (id && canonicalId && id !== canonicalId) {
      addFoodFinding(
        'error',
        rowNumber,
        'canonical_food_id',
        'core_id_mismatch',
        `For core rows canonical_food_id must match id. Got id="${id}", canonical_food_id="${canonicalId}".`
      );
    }
    if (!canonicalId) {
      addFoodFinding('error', rowNumber, 'canonical_food_id', 'empty_canonical_food_id', 'canonical_food_id is empty.');
    }

    if (cellText(row, 'product_scope').toLowerCase() !== 'core') {
      addFoodFinding('error', rowNumber, 'product_scope', 'not_core_scope', 'product_scope must be core.');
    }
    if (cellText(row, 'source').toLowerCase() !== 'core') {
      addFoodFinding('error', rowNumber, 'source', 'not_core_source', 'source must be core.');
    }
    if (hasColumn(headers, 'brand') && !isBlank(row.brand)) {
      addFoodFinding('error', rowNumber, 'brand', 'brand_not_empty', 'brand must be empty for core foods.');
    }
    if (hasColumn(headers, 'barcode') && !isBlank(row.barcode)) {
      addFoodFinding('error', rowNumber, 'barcode', 'barcode_not_empty', 'barcode must be empty for core foods.');
    }
    if (hasColumn(headers, 'normalized_brand')) {
      const normalizedBrand = cellText(row, 'normalized_brand').toLowerCase();
      if (normalizedBrand && normalizedBrand !== 'no_brand') {
        addFoodFinding(
          'error',
          rowNumber,
          'normalized_brand',
          'normalized_brand_not_empty',
          'normalized_brand must be empty or no_brand for core foods.'
        );
      }
    }

    for (const field of ['canonical_name', 'normalized_name', 'display_name']) {
      const value = cellText(row, field);
      const rawValue = rawCellText(row, field);
      if (!value) addFoodFinding('error', rowNumber, field, 'empty_name_field', `${field} is empty.`);
      if (rawValue !== value) addFoodFinding('warning', rowNumber, field, 'outer_spaces', `${field} has leading or trailing spaces.`);
      if (/\s{2,}/.test(rawValue)) addFoodFinding('warning', rowNumber, field, 'double_spaces', `${field} contains double spaces.`);
    }

    if (normalizedName) {
      const list = normalizedNames.get(normalizedName) ?? [];
      list.push(rowNumber);
      normalizedNames.set(normalizedName, list);
    }

    if (!category) {
      addFoodFinding('error', rowNumber, 'category', 'empty_category', 'category is empty.');
    } else {
      categoryCounts.set(category, (categoryCounts.get(category) ?? 0) + 1);
      if (category.length > 60 || /[0-9]/.test(category) || /[^\p{L}\p{N}_\-\s/]/u.test(category)) {
        addFoodFinding('warning', rowNumber, 'category', 'strange_category_name', `Category "${category}" looks unusual.`);
      }
    }

    const macroFields = ['calories_100g', 'protein_100g', 'fat_100g', 'carbs_100g'];
    const macros = new Map<string, number>();
    for (const field of macroFields) {
      const value = toNumber(row[field]);
      if (value === null) {
        addFoodFinding('error', rowNumber, field, 'macro_not_number', `${field} must be a number.`);
        continue;
      }
      macros.set(field, value);
      if (value < 0) addFoodFinding('error', rowNumber, field, 'macro_negative', `${field} cannot be negative.`);
      if (value > 1000) {
        addFoodFinding(
          'warning',
          rowNumber,
          field,
          'excel_date_like_value',
          `${field} is > 1000 and may be an Excel-date-like value.`
        );
      }
      if (field === 'calories_100g' && value > 950) {
        addFoodFinding('error', rowNumber, field, 'calories_too_high', 'calories_100g must not be > 950.');
      }
      if (field !== 'calories_100g' && value > 100) {
        addFoodFinding('error', rowNumber, field, 'macro_too_high', `${field} must not be > 100.`);
      }
    }

    const allZero =
      macroFields.every((field) => macros.get(field) === 0);
    if (allZero && !ALL_ZERO_ALLOWLIST.has(normalizeText(canonicalName || displayName || normalizedName))) {
      addFoodFinding(
        'error',
        rowNumber,
        'calories_100g',
        'all_zero_macros',
        'All-zero calories/protein/fat/carbs are forbidden except the explicit allowlist.'
      );
    }

    if (hasColumn(headers, 'cooking_state') && !isBlank(row.cooking_state)) {
      const state = cellText(row, 'cooking_state').toLowerCase();
      if (!COOKING_STATES.has(state)) {
        addFoodFinding('warning', rowNumber, 'cooking_state', 'unknown_cooking_state', `Unknown cooking_state "${state}".`);
      }
    }

    validateBooleanFields(findings, sheet, row, rowNumber, headers);
  });

  for (const [id, rowNumbers] of ids) {
    if (rowNumbers.length > 1) {
      for (const rowNumber of rowNumbers) {
        addFoodFinding('error', rowNumber, 'id', 'duplicate_id', `Duplicate id "${id}" also appears on rows ${rowNumbers.join(', ')}.`);
      }
    }
  }

  for (const [normalizedName, rowNumbers] of normalizedNames) {
    if (rowNumbers.length > 1) {
      for (const rowNumber of rowNumbers) {
        addFoodFinding(
          'error',
          rowNumber,
          'normalized_name',
          'duplicate_normalized_name',
          `Duplicate normalized_name "${normalizedName}" also appears on rows ${rowNumbers.join(', ')}.`
        );
      }
    }
  }

  for (const [category, count] of categoryCounts) {
    if (count <= 2) {
      addFinding(
        findings,
        'warning',
        sheet,
        null,
        'category',
        'small_category',
        `Category "${category}" has only ${count} product(s).`
      );
    }
  }

  return {
    totalRows: rows.length,
    validRows: Math.max(0, rows.length - rowErrorNumbers.size),
    categoryCounts,
    ids: new Set(ids.keys()),
  };
};

const validateAliases = (workbook: xlsx.WorkBook, foodIds: Set<string>, findings: Finding[]) => {
  const sheet = 'ALIASES';
  if (!workbook.Sheets[sheet]) {
    return {
      present: false,
      totalRows: 0,
      aliasTypeCounts: new Map<string, number>(),
    };
  }

  const sheetData = readSheetData(workbook, sheet, REQUIRED_ALIAS_COLUMNS);
  const { headers, rows } = sheetData;
  const normalizedAliasMap = new Map<string, { canonicalIds: Set<string>; rowNumbers: number[] }>();
  const aliasTypeCounts = new Map<string, number>();

  validateColumns(findings, sheet, headers, REQUIRED_ALIAS_COLUMNS);
  if (sheetData.headerRowNumber && sheetData.headerRowNumber !== 1) {
    addFinding(
      findings,
      'warning',
      sheet,
      sheetData.headerRowNumber,
      'header',
      'header_not_first_row',
      `Header row was detected at row ${sheetData.headerRowNumber}.`
    );
  }

  rows.forEach(({ row, rowNumber }) => {
    const alias = cellText(row, 'alias');
    const canonicalId = cellText(row, 'canonical_id');
    const normalizedAlias = cellText(row, 'normalized_alias');
    const type = cellText(row, 'type');

    if (!alias) addFinding(findings, 'error', sheet, rowNumber, 'alias', 'empty_alias', 'alias is empty.');
    if (!canonicalId) {
      addFinding(findings, 'error', sheet, rowNumber, 'canonical_id', 'empty_canonical_id', 'canonical_id is empty.');
    } else if (!foodIds.has(canonicalId)) {
      addFinding(
        findings,
        'error',
        sheet,
        rowNumber,
        'canonical_id',
        'unknown_canonical_id',
        `canonical_id "${canonicalId}" does not exist in foods_import.id.`
      );
    }

    if (!normalizedAlias) {
      addFinding(findings, 'error', sheet, rowNumber, 'normalized_alias', 'empty_normalized_alias', 'normalized_alias is empty.');
    } else {
      const entry = normalizedAliasMap.get(normalizedAlias) ?? { canonicalIds: new Set<string>(), rowNumbers: [] };
      if (canonicalId) entry.canonicalIds.add(canonicalId);
      entry.rowNumbers.push(rowNumber);
      normalizedAliasMap.set(normalizedAlias, entry);
    }

    if (type) {
      aliasTypeCounts.set(type, (aliasTypeCounts.get(type) ?? 0) + 1);
      if (!ALIAS_TYPES.has(type)) {
        addFinding(findings, 'warning', sheet, rowNumber, 'type', 'unknown_alias_type', `Unknown alias type "${type}".`);
      }
    } else {
      addFinding(findings, 'warning', sheet, rowNumber, 'type', 'empty_alias_type', 'type is empty.');
    }

    const normalizedAliasForBrandCheck = normalizeText(alias);
    for (const brand of BRAND_WORDS) {
      if (normalizedAliasForBrandCheck.includes(normalizeText(brand))) {
        addFinding(
          findings,
          'warning',
          sheet,
          rowNumber,
          'alias',
          'brand_word_in_alias',
          `Alias contains possible brand word "${brand}".`
        );
      }
    }

    if (alias.length > 80) {
      addFinding(findings, 'warning', sheet, rowNumber, 'alias', 'alias_too_long', 'Alias is longer than 80 characters.');
    }
    if (/\d{8,14}/.test(alias)) {
      addFinding(findings, 'warning', sheet, rowNumber, 'alias', 'barcode_like_alias', 'Alias contains an 8-14 digit barcode-like value.');
    }
  });

  for (const [normalizedAlias, entry] of normalizedAliasMap) {
    if (entry.rowNumbers.length > 1) {
      const severity: Severity = entry.canonicalIds.size > 1 ? 'error' : 'warning';
      const code = entry.canonicalIds.size > 1 ? 'alias_maps_to_multiple_canonical_ids' : 'duplicate_normalized_alias';
      const message =
        entry.canonicalIds.size > 1
          ? `normalized_alias "${normalizedAlias}" maps to multiple canonical_id values: ${Array.from(entry.canonicalIds).join(', ')}.`
          : `Duplicate normalized_alias "${normalizedAlias}" on rows ${entry.rowNumbers.join(', ')}.`;
      for (const rowNumber of entry.rowNumbers) {
        addFinding(findings, severity, sheet, rowNumber, 'normalized_alias', code, message);
      }
    }
  }

  return {
    present: true,
    totalRows: rows.length,
    aliasTypeCounts,
  };
};

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

const escapeMarkdown = (value: unknown): string =>
  String(value ?? '')
    .replace(/\|/g, '\\|')
    .replace(/\n/g, ' ');

const findingsTable = (title: string, findings: Finding[]): string => {
  if (findings.length === 0) {
    return `## ${title}\n\n_None._\n`;
  }
  return [
    `## ${title}`,
    '',
    '| Sheet | Row | Field | Code | Message |',
    '|---|---:|---|---|---|',
    ...findings.map((finding) =>
      `| ${escapeMarkdown(finding.sheet)} | ${finding.rowNumber ?? ''} | ${escapeMarkdown(finding.field)} | ${escapeMarkdown(finding.code)} | ${escapeMarkdown(finding.message)} |`
    ),
    '',
  ].join('\n');
};

const buildReport = (params: {
  filePath: string;
  sheetNames: string[];
  foodSummary: ReturnType<typeof validateFoods>;
  aliasSummary: ReturnType<typeof validateAliases>;
  findings: Finding[];
}) => {
  const errors = params.findings.filter((finding) => finding.severity === 'error');
  const warnings = params.findings.filter((finding) => finding.severity === 'warning');
  const foodErrors = errors.filter((finding) => finding.sheet === 'foods_import');
  const foodWarnings = warnings.filter((finding) => finding.sheet === 'foods_import');
  const aliasErrors = errors.filter((finding) => finding.sheet === 'ALIASES');
  const aliasWarnings = warnings.filter((finding) => finding.sheet === 'ALIASES');
  const verdict = errors.length > 0 ? 'FAIL' : warnings.length > 0 ? 'PASS_WITH_WARNINGS' : 'PASS';

  return [
    '# Food Core Validation Report',
    '',
    `- File name: ${path.basename(params.filePath)}`,
    `- File path: ${params.filePath}`,
    `- Sheet names: ${params.sheetNames.join(', ')}`,
    `- Final verdict: **${verdict}**`,
    '',
    '## foods_import',
    '',
    `- Total rows: ${params.foodSummary.totalRows}`,
    `- Valid rows: ${params.foodSummary.validRows}`,
    `- Errors count: ${foodErrors.length}`,
    `- Warnings count: ${foodWarnings.length}`,
    '',
    '## ALIASES',
    '',
    `- Present: ${params.aliasSummary.present ? 'yes' : 'no'}`,
    `- Total aliases: ${params.aliasSummary.totalRows}`,
    `- Errors count: ${aliasErrors.length}`,
    `- Warnings count: ${aliasWarnings.length}`,
    '',
    formatCountTable('Category Summary', params.foodSummary.categoryCounts),
    formatCountTable('Alias Type Summary', params.aliasSummary.aliasTypeCounts),
    findingsTable('Errors', errors),
    findingsTable('Warnings', warnings),
  ].join('\n');
};

const main = () => {
  const fileArg = process.argv[2];
  if (!fileArg) {
    console.error('Usage: npm run validate:food-core -- ./path/to/Food_Core_v02.xlsx');
    process.exit(1);
  }

  const filePath = path.resolve(process.cwd(), fileArg);
  if (!fs.existsSync(filePath)) {
    console.error(`File not found: ${filePath}`);
    process.exit(1);
  }

  const workbook = xlsx.readFile(filePath, { cellDates: false });
  const findings: Finding[] = [];

  if (!workbook.Sheets.foods_import) {
    addFinding(findings, 'error', 'foods_import', null, 'sheet', 'missing_sheet', 'Required sheet foods_import is missing.');
  }

  const foodSummary = workbook.Sheets.foods_import
    ? validateFoods(workbook, findings)
    : { totalRows: 0, validRows: 0, categoryCounts: new Map<string, number>(), ids: new Set<string>() };

  const aliasSummary = validateAliases(workbook, foodSummary.ids, findings);
  const report = buildReport({
    filePath,
    sheetNames: workbook.SheetNames,
    foodSummary,
    aliasSummary,
    findings,
  });

  fs.mkdirSync(path.dirname(REPORT_PATH), { recursive: true });
  fs.writeFileSync(REPORT_PATH, report, 'utf8');

  console.log(report);
  console.log(`\nMarkdown report saved to: ${REPORT_PATH}`);

  const errors = findings.filter((finding) => finding.severity === 'error');
  process.exit(errors.length > 0 ? 1 : 0);
};

main();
