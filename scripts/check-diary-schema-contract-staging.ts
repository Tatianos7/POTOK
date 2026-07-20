import { readFileSync, existsSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const STAGING_REF = 'ozidryfvhkcbtpnulakq';
const PRODUCTION_REF = 'dtsdnhbcwpbfrhcazqkb';

export type ContractStatus =
  | 'MATCH'
  | 'MISSING_COLUMN'
  | 'TYPE_MISMATCH'
  | 'NULLABILITY_MISMATCH'
  | 'DEFAULT_SEMANTIC_MISMATCH'
  | 'UNUSED_DB_COLUMN'
  | 'LEGACY_ONLY'
  | 'CONDITIONAL_FIELD';

export interface DiarySchemaColumn {
  name: string;
  dataType: string;
  nullable: boolean;
  defaultValue: string | null;
  numericPrecision?: number | null;
  numericScale?: number | null;
}

export interface PayloadContractField {
  field: string;
  source: string;
  tsType: string;
  canBeNull: boolean;
  dbColumn: string;
  requiredNow: boolean;
  expectedType: 'uuid' | 'date' | 'text' | 'numeric' | 'meal_type';
  expectedNullable?: boolean;
  defaultRule?: 'any' | 'no_default' | 'no_zero_default';
}

export interface ContractFinding {
  severity: 'blocker' | 'warning';
  status: ContractStatus;
  column: string;
  message: string;
}

export interface ContractEvaluation {
  verdict: 'DIARY_SCHEMA_CONTRACT_PASS' | 'DIARY_SCHEMA_CONTRACT_FAIL';
  payloadFields: PayloadContractField[];
  findings: ContractFinding[];
  blockers: ContractFinding[];
  warnings: ContractFinding[];
}

interface EnvConfig {
  url: string;
  key: string;
  projectRef: string;
}

function loadDotEnvFile(filePath: string): void {
  if (!existsSync(filePath)) return;
  const content = readFileSync(filePath, 'utf8');
  for (const line of content.split(/\r?\n/)) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#')) continue;
    const match = /^([A-Za-z_][A-Za-z0-9_]*)=(.*)$/.exec(trimmed);
    if (!match) continue;
    const [, key, rawValue] = match;
    if (process.env[key] !== undefined) continue;
    process.env[key] = rawValue.replace(/^['"]|['"]$/g, '');
  }
}

function getProjectRef(url: string | undefined | null): string | null {
  if (!url) return null;
  try {
    const hostname = new URL(url).hostname;
    return hostname.split('.')[0] || null;
  } catch {
    return null;
  }
}

function readEnv(): EnvConfig {
  const cwd = process.cwd();
  loadDotEnvFile(path.join(cwd, '.env.staging.local'));
  loadDotEnvFile(path.join(cwd, '.env.local'));

  const url = process.env.STAGING_SUPABASE_URL ?? '';
  const key = process.env.STAGING_SUPABASE_SERVICE_ROLE_KEY ?? process.env.STAGING_SUPABASE_ANON_KEY ?? '';
  const projectRef = getProjectRef(url);

  if (!url) throw new Error('STAGING_SUPABASE_URL is required');
  if (!key) throw new Error('STAGING_SUPABASE_SERVICE_ROLE_KEY or STAGING_SUPABASE_ANON_KEY is required');
  if (projectRef !== STAGING_REF) {
    throw new Error(`DIARY_SCHEMA_TARGET_MISMATCH: expected staging ref ${STAGING_REF}, got ${projectRef ?? 'unknown'}`);
  }
  if (projectRef === PRODUCTION_REF || url.includes(PRODUCTION_REF)) {
    throw new Error('DIARY_SCHEMA_TARGET_MISMATCH: production project ref is forbidden');
  }

  return { url, key, projectRef };
}

export function buildDiaryPayloadContract(): PayloadContractField[] {
  return [
    {
      field: 'user_id',
      source: 'DiaryInsertPayload.user_id',
      tsType: 'string',
      canBeNull: false,
      dbColumn: 'user_id',
      requiredNow: true,
      expectedType: 'uuid',
      expectedNullable: false,
    },
    {
      field: 'date',
      source: 'DiaryInsertPayload.date',
      tsType: 'YYYY-MM-DD string',
      canBeNull: false,
      dbColumn: 'date',
      requiredNow: true,
      expectedType: 'date',
      expectedNullable: false,
    },
    {
      field: 'meal_type',
      source: 'DiaryInsertPayload.meal_type',
      tsType: "'breakfast' | 'lunch' | 'dinner' | 'snack'",
      canBeNull: false,
      dbColumn: 'meal_type',
      requiredNow: true,
      expectedType: 'meal_type',
      expectedNullable: false,
    },
    {
      field: 'canonical_food_id',
      source: 'DiaryInsertPayload.canonical_food_id',
      tsType: 'string UUID',
      canBeNull: false,
      dbColumn: 'canonical_food_id',
      requiredNow: true,
      expectedType: 'uuid',
    },
    {
      field: 'product_name',
      source: 'DiaryInsertPayload.product_name',
      tsType: 'string',
      canBeNull: false,
      dbColumn: 'product_name',
      requiredNow: true,
      expectedType: 'text',
      expectedNullable: false,
    },
    {
      field: 'weight',
      source: 'DiaryInsertPayload.weight',
      tsType: 'number',
      canBeNull: false,
      dbColumn: 'weight',
      requiredNow: true,
      expectedType: 'numeric',
      expectedNullable: false,
    },
    {
      field: 'calories',
      source: 'calculateDiarySnapshot.calories',
      tsType: 'number',
      canBeNull: false,
      dbColumn: 'calories',
      requiredNow: true,
      expectedType: 'numeric',
      expectedNullable: false,
    },
    {
      field: 'protein',
      source: 'calculateDiarySnapshot.protein',
      tsType: 'number',
      canBeNull: false,
      dbColumn: 'protein',
      requiredNow: true,
      expectedType: 'numeric',
      expectedNullable: false,
    },
    {
      field: 'fat',
      source: 'calculateDiarySnapshot.fat',
      tsType: 'number',
      canBeNull: false,
      dbColumn: 'fat',
      requiredNow: true,
      expectedType: 'numeric',
      expectedNullable: false,
    },
    {
      field: 'carbs',
      source: 'calculateDiarySnapshot.carbs',
      tsType: 'number',
      canBeNull: false,
      dbColumn: 'carbs',
      requiredNow: true,
      expectedType: 'numeric',
      expectedNullable: false,
    },
    {
      field: 'fiber',
      source: 'calculateDiarySnapshot.fiber',
      tsType: 'number | null',
      canBeNull: true,
      dbColumn: 'fiber',
      requiredNow: true,
      expectedType: 'numeric',
      expectedNullable: true,
      defaultRule: 'no_zero_default',
    },
    {
      field: 'idempotency_key',
      source: 'DiaryInsertPayload.idempotency_key',
      tsType: 'string | null',
      canBeNull: true,
      dbColumn: 'idempotency_key',
      requiredNow: true,
      expectedType: 'text',
    },
    {
      field: 'base_unit',
      source: 'DiaryInsertPayload.base_unit',
      tsType: 'string',
      canBeNull: false,
      dbColumn: 'base_unit',
      requiredNow: true,
      expectedType: 'text',
    },
    {
      field: 'display_unit',
      source: 'DiaryInsertPayload.display_unit',
      tsType: 'string | null',
      canBeNull: true,
      dbColumn: 'display_unit',
      requiredNow: true,
      expectedType: 'text',
    },
    {
      field: 'display_amount',
      source: 'DiaryInsertPayload.display_amount',
      tsType: 'number | null',
      canBeNull: true,
      dbColumn: 'display_amount',
      requiredNow: true,
      expectedType: 'numeric',
    },
  ];
}

function isNumericType(type: string): boolean {
  return /numeric|decimal|double|real|int|number/i.test(type);
}

function isUuidType(type: string): boolean {
  return /uuid/i.test(type);
}

function isTextType(type: string): boolean {
  return /text|character|varchar|string/i.test(type);
}

function isDateType(type: string): boolean {
  return /\bdate\b/i.test(type);
}

function typeMatches(column: DiarySchemaColumn, expected: PayloadContractField['expectedType']): boolean {
  if (expected === 'numeric') return isNumericType(column.dataType);
  if (expected === 'uuid') return isUuidType(column.dataType);
  if (expected === 'text' || expected === 'meal_type') return isTextType(column.dataType);
  if (expected === 'date') return isDateType(column.dataType);
  return false;
}

function isZeroDefault(value: string | null): boolean {
  if (value == null) return false;
  return /^0(\.0+)?(::.+)?$/.test(value.trim()) || value.trim() === "'0'::numeric";
}

export function evaluateDiarySchemaContract(
  columns: DiarySchemaColumn[],
  payloadFields = buildDiaryPayloadContract()
): ContractEvaluation {
  const byName = new Map(columns.map((column) => [column.name, column]));
  const findings: ContractFinding[] = [];

  for (const field of payloadFields) {
    const column = byName.get(field.dbColumn);
    if (!column) {
      findings.push({
        severity: 'blocker',
        status: 'MISSING_COLUMN',
        column: field.dbColumn,
        message: `${field.dbColumn} is required by ${field.source} but is missing from public.food_diary_entries`,
      });
      continue;
    }

    if (!typeMatches(column, field.expectedType)) {
      findings.push({
        severity: 'blocker',
        status: 'TYPE_MISMATCH',
        column: field.dbColumn,
        message: `${field.dbColumn} expected ${field.expectedType}, got ${column.dataType}`,
      });
    }

    if (field.expectedNullable !== undefined && column.nullable !== field.expectedNullable) {
      findings.push({
        severity: 'blocker',
        status: 'NULLABILITY_MISMATCH',
        column: field.dbColumn,
        message: `${field.dbColumn} nullable expected ${field.expectedNullable ? 'YES' : 'NO'}, got ${column.nullable ? 'YES' : 'NO'}`,
      });
    }

    if (field.defaultRule === 'no_zero_default' && isZeroDefault(column.defaultValue)) {
      findings.push({
        severity: 'blocker',
        status: 'DEFAULT_SEMANTIC_MISMATCH',
        column: field.dbColumn,
        message: `${field.dbColumn} must not default unknown nutrition to confirmed zero`,
      });
    }
  }

  const blockers = findings.filter((finding) => finding.severity === 'blocker');
  const warnings = findings.filter((finding) => finding.severity === 'warning');
  return {
    verdict: blockers.length > 0 ? 'DIARY_SCHEMA_CONTRACT_FAIL' : 'DIARY_SCHEMA_CONTRACT_PASS',
    payloadFields,
    findings,
    blockers,
    warnings,
  };
}

function normalizeOpenApiType(property: any): string {
  const format = typeof property?.format === 'string' ? property.format : '';
  const type = typeof property?.type === 'string' ? property.type : '';
  if (format === 'uuid') return 'uuid';
  if (format === 'date') return 'date';
  if (format === 'double' || format === 'float') return 'numeric';
  if (type === 'number' || type === 'integer') return 'numeric';
  return format || type || 'unknown';
}

async function fetchOpenApiColumns(env: EnvConfig): Promise<DiarySchemaColumn[]> {
  const response = await fetch(`${env.url}/rest/v1/`, {
    headers: {
      apikey: env.key,
      Authorization: `Bearer ${env.key}`,
      Accept: 'application/openapi+json',
    },
  });

  if (!response.ok) {
    throw new Error(`OpenAPI schema fetch failed: HTTP ${response.status}`);
  }

  const spec = await response.json();
  const definition = spec?.definitions?.food_diary_entries;
  if (!definition?.properties) {
    throw new Error('OpenAPI schema does not expose public.food_diary_entries');
  }

  const required = new Set<string>(Array.isArray(definition.required) ? definition.required : []);
  return Object.entries<any>(definition.properties).map(([name, property]) => ({
    name,
    dataType: normalizeOpenApiType(property),
    nullable: !required.has(name),
    defaultValue: property.default == null ? null : String(property.default),
  }));
}

async function runReadOnlySelectProbe(env: EnvConfig): Promise<string | null> {
  const columns = [
    'id',
    'user_id',
    'date',
    'meal_type',
    'canonical_food_id',
    'product_name',
    'weight',
    'calories',
    'protein',
    'fat',
    'carbs',
    'fiber',
    'idempotency_key',
    'base_unit',
    'display_unit',
    'display_amount',
    'created_at',
  ].join(',');

  const url = `${env.url}/rest/v1/food_diary_entries?select=${encodeURIComponent(columns)}&limit=1`;
  const response = await fetch(url, {
    headers: {
      apikey: env.key,
      Authorization: `Bearer ${env.key}`,
      Prefer: 'count=exact',
    },
  });

  if (response.ok) return null;
  let body: any = null;
  try {
    body = await response.json();
  } catch {
    // ignore parse failures
  }
  return `${body?.code ?? response.status}: ${body?.message ?? response.statusText}`;
}

export async function checkDiarySchemaContractStaging(): Promise<{
  projectRef: string;
  mode: 'read-only';
  columns: DiarySchemaColumn[];
  evaluation: ContractEvaluation;
  selectProbeError: string | null;
}> {
  const env = readEnv();
  const columns = await fetchOpenApiColumns(env);
  const evaluation = evaluateDiarySchemaContract(columns);
  const selectProbeError = await runReadOnlySelectProbe(env);
  return {
    projectRef: env.projectRef,
    mode: 'read-only',
    columns,
    evaluation,
    selectProbeError,
  };
}

function printSummary(result: Awaited<ReturnType<typeof checkDiarySchemaContractStaging>>): void {
  const output = {
    verdict: result.evaluation.verdict,
    projectRef: result.projectRef,
    mode: result.mode,
    observedColumns: result.columns,
    payloadFields: result.evaluation.payloadFields.length,
    blockers: result.evaluation.blockers,
    warnings: result.evaluation.warnings,
    selectProbeError: result.selectProbeError,
  };
  console.log(JSON.stringify(output, null, 2));
}

const entryPath = process.argv[1] ? path.resolve(process.argv[1]) : '';
const currentPath = fileURLToPath(import.meta.url);

if (entryPath === currentPath) {
  checkDiarySchemaContractStaging()
    .then((result) => {
      printSummary(result);
      if (result.evaluation.verdict !== 'DIARY_SCHEMA_CONTRACT_PASS') {
        process.exitCode = 1;
      }
    })
    .catch((error) => {
      console.error(error instanceof Error ? error.message : String(error));
      process.exitCode = 1;
    });
}
