import { createHash } from 'node:crypto';
import xlsx from 'xlsx';

type Severity = 'ERROR' | 'WARNING' | 'UNKNOWN';
export type CatalogStatus = 'UNKNOWN' | 'PARTIAL';

export interface PreflightFindingV1 {
  severity: Severity;
  code: string;
  sheet: string;
  row: number | null;
  field: string;
  detail: string;
}

export interface CatalogSnapshotV1 {
  version: 1;
  capturedAt: string;
  coverage: { foods: 'complete' | 'partial'; aliases: 'complete' | 'partial' };
  foods: Array<{
    id: string;
    stableFoodId: string | null;
    normalizedName: string;
    normalizedBrand: string | null;
    source: string;
    ownerId: string | null;
  }>;
  aliases: Array<{ normalizedAlias: string; canonicalFoodId: string }>;
  /** An independently supplied digest of the snapshot payload (all fields except this one). */
  expectedSha256: string;
}

export interface PreflightReportV1 {
  version: 1;
  inputSha256: string;
  fileStatus: 'INVALID' | 'VALID_WITH_UNKNOWN_SEMANTICS' | 'VALID';
  catalogStatus: CatalogStatus;
  snapshotSha256: string | null;
  fileFindings: PreflightFindingV1[];
  catalogFindings: PreflightFindingV1[];
  counts: { foods: number; aliases: number };
  /** This report never authorizes an import or a catalog mutation. */
  importAuthorized: false;
}

type Cell = string | number | boolean | null | undefined;
type Row = Record<string, Cell>;
interface SheetRow { row: Row; rowNumber: number }
interface SheetData { headers: string[]; rows: SheetRow[] }

const FOOD_SHEET = 'foods_import';
const ALIAS_SHEET = 'ALIASES';
const REQUIRED_FOOD_COLUMNS = [
  'id', 'canonical_name', 'normalized_name', 'display_name', 'category',
  'product_scope', 'source', 'canonical_food_id', 'calories_100g',
  'protein_100g', 'fat_100g', 'carbs_100g', 'unit',
];
const REQUIRED_ALIAS_COLUMNS = [
  'alias', 'canonical_id', 'canonical_name', 'normalized_alias', 'type', 'comment',
];
const REQUIRED_NUMBERS = ['calories_100g', 'protein_100g', 'fat_100g', 'carbs_100g'] as const;

const sha256 = (bytes: Uint8Array | string): string =>
  createHash('sha256').update(bytes).digest('hex');
const value = (row: Row, field: string): string => String(row[field] ?? '').trim();
const normalize = (text: string): string =>
  text.toLowerCase().replace(/[^a-z0-9а-яё]+/g, ' ').trim();
const locationOrder = (a: PreflightFindingV1, b: PreflightFindingV1): number =>
  a.sheet.localeCompare(b.sheet, 'en') || (a.row ?? 0) - (b.row ?? 0) ||
  a.field.localeCompare(b.field, 'en') || a.code.localeCompare(b.code, 'en') ||
  a.detail.localeCompare(b.detail, 'en');

function finding(
  into: PreflightFindingV1[], severity: Severity, code: string,
  sheet: string, row: number | null, field: string, detail: string,
): void {
  into.push({ severity, code, sheet, row, field, detail });
}

function getSheet(workbook: xlsx.WorkBook, name: string): xlsx.WorkSheet | null {
  const matches = workbook.SheetNames.filter((sheet) => sheet.toLowerCase() === name.toLowerCase());
  return matches.length === 1 ? workbook.Sheets[matches[0]] : null;
}

function sheetData(
  workbook: xlsx.WorkBook, sheetName: string, required: readonly string[],
  findings: PreflightFindingV1[],
): SheetData {
  const sheet = getSheet(workbook, sheetName);
  if (!sheet) {
    finding(findings, 'ERROR', 'SHEET_MISSING_OR_AMBIGUOUS', sheetName, null, '', 'Required sheet is missing or has ambiguous case variants.');
    return { headers: [], rows: [] };
  }
  const start = sheet['!ref'] ? xlsx.utils.decode_range(sheet['!ref']).s : { r: 0, c: 0 };
  const raw = xlsx.utils.sheet_to_json<Cell[]>(sheet, {
    header: 1, raw: true, defval: '', blankrows: true,
  });
  const headerIndex = raw.findIndex((cells, index) => index + start.r < 20 &&
    required.every((field) => cells.some((cell) => String(cell ?? '').trim() === field)));
  const fallbackIndex = headerIndex < 0
    ? raw.findIndex((cells) => cells.some((cell) => String(cell ?? '').trim() !== ''))
    : headerIndex;
  if (fallbackIndex < 0) {
    finding(findings, 'ERROR', 'SHEET_EMPTY', sheetName, null, '', 'Sheet has no header row.');
    return { headers: [], rows: [] };
  }
  const headers = raw[fallbackIndex].map((cell) => String(cell ?? '').trim());
  const seen = new Set<string>();
  for (const header of headers) {
    if (!header) continue;
    if (seen.has(header)) finding(findings, 'ERROR', 'HEADER_DUPLICATE', sheetName, start.r + fallbackIndex + 1, header, 'Header appears more than once.');
    seen.add(header);
  }
  for (const field of required) {
    if (!seen.has(field)) finding(findings, 'ERROR', 'HEADER_REQUIRED', sheetName, start.r + fallbackIndex + 1, field, 'Required column is missing.');
  }
  const rows: SheetRow[] = [];
  for (let index = fallbackIndex + 1; index < raw.length; index += 1) {
    const cells = raw[index];
    if (cells.every((cell) => String(cell ?? '').trim() === '')) continue;
    const row = Object.create(null) as Row;
    headers.forEach((header, column) => { if (header) row[header] = cells[column]; });
    for (let column = 0; column < headers.length; column += 1) {
      const cell = sheet[xlsx.utils.encode_cell({ r: start.r + index, c: start.c + column })];
      if (cell?.f) finding(findings, 'ERROR', 'FORMULA_UNSUPPORTED', sheetName, start.r + index + 1, headers[column] ?? '', 'Formula cells cannot be trusted as fixed input.');
    }
    rows.push({ row, rowNumber: start.r + index + 1 });
  }
  return { headers, rows };
}

function parseNumber(cell: Cell): number | null {
  if (typeof cell !== 'number' && typeof cell !== 'string') return null;
  const trimmed = String(cell).trim();
  if (!/^(?:0|[1-9]\d*)(?:[.,]\d+)?$/.test(trimmed)) return null;
  const parsed = Number(trimmed.replace(',', '.'));
  return Number.isFinite(parsed) ? parsed : null;
}

function validateNumber(
  row: Row, rowNumber: number, field: string, optional: boolean,
  findings: PreflightFindingV1[],
): void {
  const raw = row[field];
  if (String(raw ?? '').trim() === '') {
    if (!optional) finding(findings, 'ERROR', 'NUTRIENT_REQUIRED', FOOD_SHEET, rowNumber, field, 'Value is required.');
    return;
  }
  const parsed = parseNumber(raw);
  if (parsed === null) {
    finding(findings, 'ERROR', 'NUTRIENT_INVALID', FOOD_SHEET, rowNumber, field, 'Expected a finite non-negative decimal without units or exponent.');
    return;
  }
  const decimalText = String(raw).replace(',', '.');
  const fraction = decimalText.split('.')[1] ?? '';
  if (fraction.length > 2) finding(findings, 'ERROR', 'NUTRIENT_PRECISION', FOOD_SHEET, rowNumber, field, 'More than two decimal places; no rounding is performed.');
  if (field !== 'calories_100g' && parsed > 100) {
    finding(findings, 'ERROR', 'NUTRIENT_OVER_100G', FOOD_SHEET, rowNumber, field, 'A gram value per 100 g exceeds 100.');
  }
  if (field === 'calories_100g' && parsed > 950) {
    finding(findings, 'ERROR', 'CALORIES_OVER_950', FOOD_SHEET, rowNumber, field, 'Calories per 100 g exceed the existing Food Core validation bound.');
  }
}

function metadata(workbook: xlsx.WorkBook, findings: PreflightFindingV1[]): Record<string, string> {
  const sheet = getSheet(workbook, 'Metadata');
  if (!sheet) {
    finding(findings, 'UNKNOWN', 'METADATA_MISSING', 'Metadata', null, '', 'Food Core metadata is absent or ambiguous.');
    return {};
  }
  const rows = xlsx.utils.sheet_to_json<Cell[]>(sheet, { header: 1, raw: true, defval: '', blankrows: true });
  const result = Object.create(null) as Record<string, string>;
  if (String(rows[0]?.[0] ?? '').trim().toLowerCase() !== 'поле' ||
      String(rows[0]?.[1] ?? '').trim().toLowerCase() !== 'значение') {
    finding(findings, 'ERROR', 'METADATA_HEADER_INVALID', 'Metadata', 1, '', 'Expected Поле / значение header.');
  }
  rows.slice(1).forEach((cells, index) => {
    const key = String(cells[0] ?? '').trim().toLowerCase();
    if (!key) return;
    if (Object.hasOwn(result, key)) finding(findings, 'ERROR', 'METADATA_DUPLICATE', 'Metadata', index + 2, key, 'Metadata key appears more than once.');
    result[key] = String(cells[1] ?? '').trim();
  });
  return result;
}

function validateSemantics(workbook: xlsx.WorkBook, foodsCount: number, aliasesCount: number, findings: PreflightFindingV1[]): void {
  const meta = metadata(workbook, findings);
  for (const [key, count] of [['products', foodsCount], ['aliases', aliasesCount]] as const) {
    if (meta[key] && (!/^(?:0|[1-9]\d*)$/.test(meta[key]) || Number(meta[key]) !== count)) {
      finding(findings, 'ERROR', 'METADATA_COUNT_MISMATCH', 'Metadata', null, key, `Metadata count does not match parsed ${key} rows.`);
    }
  }
  const readme = getSheet(workbook, 'README');
  const readmeRows = readme ? xlsx.utils.sheet_to_json<Cell[]>(readme, { header: 1, raw: true, defval: '' }) : [];
  const per100gDeclared = readmeRows.some((cells) =>
    cells.some((cell) => /нутриенты указываются на 100 грамм/i.test(String(cell ?? ''))));
  if (!per100gDeclared) {
    finding(findings, 'UNKNOWN', 'UNIT_BASIS_UNKNOWN', 'README', null, '', 'Per-100-g nutrient basis is not documented in the workbook.');
  }
  finding(findings, 'UNKNOWN', 'CARBOHYDRATE_SEMANTICS_UNKNOWN', 'README', null, 'carbs_100g', 'The workbook does not establish whether carbohydrate includes fiber.');
}

function snapshotDigest(snapshot: CatalogSnapshotV1): string {
  return sha256(JSON.stringify({
    version: snapshot.version, capturedAt: snapshot.capturedAt,
    coverage: snapshot.coverage, foods: snapshot.foods, aliases: snapshot.aliases,
  }));
}

const uuidPattern = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/;
const stableIdPattern = /^[a-z0-9][a-z0-9_-]*$/;
const exactKeys = (value: unknown, keys: readonly string[]): boolean =>
  value !== null && typeof value === 'object' && !Array.isArray(value) &&
  Object.keys(value).length === keys.length && keys.every((key) => Object.hasOwn(value, key));
const timestampPattern = /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2}):(\d{2})(?:\.\d{1,3})?(Z|[+-]\d{2}:\d{2})$/;

function validTimestamp(value: unknown): value is string {
  if (typeof value !== 'string') return false;
  const parts = timestampPattern.exec(value);
  if (!parts) return false;
  const [, year, month, day, hour, minute, second, zone] = parts;
  const y = Number(year); const m = Number(month); const d = Number(day);
  const daysInMonth = new Date(Date.UTC(y, m, 0)).getUTCDate();
  if (y < 100 || m < 1 || m > 12 || d < 1 || d > daysInMonth || Number(hour) > 23 ||
      Number(minute) > 59 || Number(second) > 59) return false;
  if (zone !== 'Z') {
    const offsetHours = Number(zone.slice(1, 3));
    const offsetMinutes = Number(zone.slice(4, 6));
    if (offsetHours > 14 || offsetMinutes > 59 || (offsetHours === 14 && offsetMinutes !== 0)) return false;
  }
  const parsed = Date.parse(value);
  return Number.isFinite(parsed) && parsed <= Date.now();
}

function validSnapshotRows(snapshot: CatalogSnapshotV1): boolean {
  const foodIds = new Set<string>();
  const stableIds = new Set<string>();
  const aliases = new Set<string>();
  for (const food of snapshot.foods) {
    if (!exactKeys(food, ['id', 'stableFoodId', 'normalizedName', 'normalizedBrand', 'source', 'ownerId']) ||
        typeof food.id !== 'string' ||
        !uuidPattern.test(food.id) || foodIds.has(food.id) ||
        !(food.stableFoodId === null ||
          (typeof food.stableFoodId === 'string' && stableIdPattern.test(food.stableFoodId))) ||
        (food.stableFoodId !== null && stableIds.has(food.stableFoodId)) ||
        typeof food.normalizedName !== 'string' || !food.normalizedName ||
        food.normalizedName !== normalize(food.normalizedName) ||
        !(food.normalizedBrand === null || food.normalizedBrand === 'no_brand' ||
          (typeof food.normalizedBrand === 'string' && food.normalizedBrand !== '' &&
           food.normalizedBrand === normalize(food.normalizedBrand))) ||
        !['core', 'brand', 'user'].includes(food.source) ||
        !(food.ownerId === null || (typeof food.ownerId === 'string' && uuidPattern.test(food.ownerId))) ||
        (food.source === 'user' && food.ownerId === null) ||
        (food.source !== 'user' && food.ownerId !== null)) return false;
    foodIds.add(food.id);
    if (food.stableFoodId !== null) stableIds.add(food.stableFoodId);
  }
  for (const alias of snapshot.aliases) {
    if (!exactKeys(alias, ['normalizedAlias', 'canonicalFoodId']) ||
        typeof alias.normalizedAlias !== 'string' ||
        !alias.normalizedAlias || alias.normalizedAlias !== normalize(alias.normalizedAlias) ||
        aliases.has(alias.normalizedAlias) || typeof alias.canonicalFoodId !== 'string' ||
        !uuidPattern.test(alias.canonicalFoodId) || !foodIds.has(alias.canonicalFoodId)) return false;
    aliases.add(alias.normalizedAlias);
  }
  return true;
}

function evaluateCatalog(
  snapshot: CatalogSnapshotV1 | undefined,
  foods: SheetRow[], aliases: SheetRow[], findings: PreflightFindingV1[],
): { status: CatalogStatus; digest: string | null } {
  if (!snapshot) {
    finding(findings, 'UNKNOWN', 'CATALOG_SNAPSHOT_MISSING', 'catalog', null, '', 'No offline catalog snapshot; current catalog conflicts are unknown.');
    return { status: 'UNKNOWN', digest: null };
  }
  const validShape = exactKeys(snapshot, ['version', 'capturedAt', 'coverage', 'foods', 'aliases', 'expectedSha256']) &&
    snapshot.version === 1 &&
    validTimestamp(snapshot.capturedAt) &&
    Array.isArray(snapshot.foods) && Array.isArray(snapshot.aliases) &&
    exactKeys(snapshot.coverage, ['foods', 'aliases']) &&
    ['complete', 'partial'].includes(snapshot.coverage.foods) &&
    ['complete', 'partial'].includes(snapshot.coverage.aliases);
  if (!validShape) {
    finding(findings, 'UNKNOWN', 'CATALOG_SNAPSHOT_INVALID', 'catalog', null, '', 'Snapshot structure or capture date is invalid.');
    return { status: 'UNKNOWN', digest: null };
  }
  const digest = snapshotDigest(snapshot);
  if (!/^[a-f0-9]{64}$/.test(snapshot.expectedSha256) || digest !== snapshot.expectedSha256) {
    finding(findings, 'UNKNOWN', 'CATALOG_SNAPSHOT_UNVERIFIED', 'catalog', null, '', 'Snapshot digest does not match the independently supplied SHA-256.');
    return { status: 'UNKNOWN', digest };
  }
  if (!validSnapshotRows(snapshot)) {
    finding(findings, 'UNKNOWN', 'CATALOG_SNAPSHOT_INVALID', 'catalog', null, '', 'Snapshot row structure is invalid.');
    return { status: 'UNKNOWN', digest };
  }
  const status: CatalogStatus = 'PARTIAL';
  finding(findings, 'UNKNOWN', 'CATALOG_COVERAGE_PARTIAL', 'catalog', null, '', 'User-supplied snapshot gives observations only; other catalog conflicts remain unknown.');
  const byStableId = new Map<string, CatalogSnapshotV1['foods']>();
  const byKey = new Map<string, CatalogSnapshotV1['foods']>();
  const byAlias = new Map<string, CatalogSnapshotV1['aliases']>();
  for (const food of snapshot.foods) {
    if (food.stableFoodId) byStableId.set(food.stableFoodId, [...(byStableId.get(food.stableFoodId) ?? []), food]);
    const key = `${food.normalizedName}\0${food.normalizedBrand === 'no_brand' ? '' : food.normalizedBrand ?? ''}`;
    byKey.set(key, [...(byKey.get(key) ?? []), food]);
  }
  for (const alias of snapshot.aliases) {
    byAlias.set(alias.normalizedAlias, [...(byAlias.get(alias.normalizedAlias) ?? []), alias]);
  }
  for (const { row, rowNumber } of foods) {
    const id = value(row, 'id');
    for (const match of byStableId.get(id) ?? []) {
      finding(findings, 'WARNING', 'CATALOG_STABLE_ID_MATCH_REVIEW', FOOD_SHEET, rowNumber, 'id', `Known catalog row ${match.id} has this stable ID; identity and content require manual review.`);
    }
    const key = `${normalize(value(row, 'display_name'))}\0${normalize(value(row, 'brand'))}`;
    for (const match of byKey.get(key) ?? []) {
      finding(findings, 'WARNING', 'CATALOG_NORMALIZED_KEY_COLLISION', FOOD_SHEET, rowNumber, 'normalized_name', `Known catalog row ${match.id} has the same normalized name/brand key; no merge is inferred.`);
    }
  }
  for (const { row, rowNumber } of aliases) {
    const key = normalize(value(row, 'alias'));
    for (const match of byAlias.get(key) ?? []) {
      finding(findings, 'WARNING', 'CATALOG_ALIAS_COLLISION', ALIAS_SHEET, rowNumber, 'alias', `Known alias points to catalog food ${match.canonicalFoodId}; mapping requires manual review.`);
    }
  }
  return { status, digest };
}

export function analyzeFoodCore(input: Uint8Array, snapshot?: CatalogSnapshotV1): PreflightReportV1 {
  const fileFindings: PreflightFindingV1[] = [];
  const catalogFindings: PreflightFindingV1[] = [];
  const inputSha256 = sha256(input);
  let foods: SheetRow[] = [];
  let aliases: SheetRow[] = [];
  try {
    const workbook = xlsx.read(input, { type: 'array', cellDates: false, cellFormula: true });
    const foodSheet = sheetData(workbook, FOOD_SHEET, REQUIRED_FOOD_COLUMNS, fileFindings);
    const aliasSheet = sheetData(workbook, ALIAS_SHEET, REQUIRED_ALIAS_COLUMNS, fileFindings);
    foods = foodSheet.rows;
    aliases = aliasSheet.rows;
    if (foods.length === 0) finding(fileFindings, 'ERROR', 'FOOD_ROWS_EMPTY', FOOD_SHEET, null, '', 'No Food Core rows were supplied.');
    if (aliases.length === 0) finding(fileFindings, 'WARNING', 'ALIAS_ROWS_EMPTY', ALIAS_SHEET, null, '', 'No alias rows were supplied.');
    validateSemantics(workbook, foods.length, aliases.length, fileFindings);
    const ids = new Map<string, number>();
    const foodKeys = new Map<string, number>();
    const foodNameTargets = new Map<string, Set<string>>();
    for (const { row, rowNumber } of foods) {
      const id = value(row, 'id');
      for (const field of ['id', 'canonical_name', 'normalized_name', 'display_name', 'category', 'product_scope', 'source', 'canonical_food_id']) {
        if (!value(row, field)) finding(fileFindings, 'ERROR', 'FIELD_REQUIRED', FOOD_SHEET, rowNumber, field, 'Value is required.');
      }
      if (id) {
        const prior = ids.get(id);
        if (prior) finding(fileFindings, 'ERROR', 'FOOD_ID_DUPLICATE', FOOD_SHEET, rowNumber, 'id', `ID also appears on row ${prior}.`);
        else ids.set(id, rowNumber);
      }
      if (id && value(row, 'canonical_food_id') && id !== value(row, 'canonical_food_id')) {
        finding(fileFindings, 'ERROR', 'CANONICAL_ID_MISMATCH', FOOD_SHEET, rowNumber, 'canonical_food_id', 'Core canonical ID must equal the semantic food ID.');
      }
      if (value(row, 'source') && value(row, 'source') !== 'core') finding(fileFindings, 'ERROR', 'SOURCE_INVALID', FOOD_SHEET, rowNumber, 'source', 'Food Core source must be core.');
      if (value(row, 'product_scope') && !['core', 'generic'].includes(value(row, 'product_scope'))) {
        finding(fileFindings, 'ERROR', 'SCOPE_INVALID', FOOD_SHEET, rowNumber, 'product_scope', 'Expected core or generic.');
      }
      const unit = value(row, 'unit');
      if (!unit || !['g', 'ml', 'ml,g'].includes(unit)) {
        finding(fileFindings, 'ERROR', 'UNIT_INVALID', FOOD_SHEET, rowNumber, 'unit', 'Expected g, ml, or ml,g; no conversion is performed.');
      } else if (unit !== 'g') {
        finding(fileFindings, 'UNKNOWN', 'NUTRIENT_BASIS_UNKNOWN', FOOD_SHEET, rowNumber, 'unit', 'The per-100-g README does not establish the nutrient basis for this unit.');
      }
      const normalized = normalize(value(row, 'display_name'));
      if (normalized && id) {
        const targets = foodNameTargets.get(normalized) ?? new Set<string>();
        targets.add(id);
        foodNameTargets.set(normalized, targets);
      }
      if (value(row, 'normalized_name') && value(row, 'normalized_name') !== normalized) {
        finding(fileFindings, 'WARNING', 'NORMALIZED_NAME_DIFFERS', FOOD_SHEET, rowNumber, 'normalized_name', 'Declared normalized name differs from repository normalization of display name.');
      }
      const key = `${normalized}\0${normalize(value(row, 'brand'))}`;
      if (normalized) {
        const prior = foodKeys.get(key);
        if (prior) finding(fileFindings, 'WARNING', 'FILE_NORMALIZED_KEY_COLLISION', FOOD_SHEET, rowNumber, 'normalized_name', `Potential normalized key collision with row ${prior}.`);
        else foodKeys.set(key, rowNumber);
      }
      for (const field of REQUIRED_NUMBERS) validateNumber(row, rowNumber, field, false, fileFindings);
      if (foodSheet.headers.includes('fiber_100g')) validateNumber(row, rowNumber, 'fiber_100g', true, fileFindings);
    }
    const aliasKeys = new Map<string, { row: number; canonicalId: string }>();
    for (const { row, rowNumber } of aliases) {
      for (const field of ['alias', 'canonical_id', 'canonical_name', 'normalized_alias', 'type']) {
        if (!value(row, field)) finding(fileFindings, 'ERROR', 'FIELD_REQUIRED', ALIAS_SHEET, rowNumber, field, 'Value is required.');
      }
      const canonicalId = value(row, 'canonical_id');
      if (canonicalId && !ids.has(canonicalId)) finding(fileFindings, 'ERROR', 'ALIAS_TARGET_MISSING', ALIAS_SHEET, rowNumber, 'canonical_id', 'Canonical ID does not occur in foods_import.');
      const key = normalize(value(row, 'alias'));
      if (key && [...(foodNameTargets.get(key) ?? [])].some((target) => target !== canonicalId)) {
        finding(fileFindings, 'ERROR', 'ALIAS_FOOD_NAME_AMBIGUOUS', ALIAS_SHEET, rowNumber, 'alias', 'Alias matches a different Food Core name; no identity is inferred.');
      }
      if (key && value(row, 'normalized_alias') !== key) finding(fileFindings, 'WARNING', 'NORMALIZED_ALIAS_DIFFERS', ALIAS_SHEET, rowNumber, 'normalized_alias', 'Declared normalized alias differs from repository normalization.');
      const prior = aliasKeys.get(key);
      if (key && prior) finding(fileFindings, prior.canonicalId === canonicalId ? 'WARNING' : 'ERROR',
        prior.canonicalId === canonicalId ? 'ALIAS_DUPLICATE' : 'ALIAS_AMBIGUOUS',
        ALIAS_SHEET, rowNumber, 'normalized_alias', `Normalized alias also occurs on row ${prior.row}.`);
      else if (key) aliasKeys.set(key, { row: rowNumber, canonicalId });
    }
  } catch (error) {
    finding(fileFindings, 'ERROR', 'WORKBOOK_UNREADABLE', 'workbook', null, '', error instanceof Error ? error.message : 'Workbook cannot be read.');
  }
  const catalog = evaluateCatalog(snapshot, foods, aliases, catalogFindings);
  fileFindings.sort(locationOrder);
  catalogFindings.sort(locationOrder);
  return {
    version: 1, inputSha256,
    fileStatus: fileFindings.some((item) => item.severity === 'ERROR') ? 'INVALID'
      : fileFindings.some((item) => item.severity === 'UNKNOWN') ? 'VALID_WITH_UNKNOWN_SEMANTICS' : 'VALID',
    catalogStatus: catalog.status, snapshotSha256: catalog.digest,
    fileFindings, catalogFindings, counts: { foods: foods.length, aliases: aliases.length },
    importAuthorized: false,
  };
}
