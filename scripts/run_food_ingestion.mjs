import fs from 'node:fs/promises';
import fsSync from 'node:fs';
import path from 'node:path';
import { createClient } from '@supabase/supabase-js';

const args = process.argv.slice(2);
const getArgValue = (name) => {
  const prefixed = args.find((arg) => arg.startsWith(`${name}=`));
  if (prefixed) return prefixed.split('=').slice(1).join('=');
  const idx = args.findIndex((arg) => arg === name);
  if (idx >= 0 && args[idx + 1] && !args[idx + 1].startsWith('--')) return args[idx + 1];
  return undefined;
};

const DRY_RUN = args.includes('--dry-run');
const COMMIT_MODE = getArgValue('--commit-mode') || 'safe_upsert';
const CSV_PATH = process.env.CSV_PATH || getArgValue('--csv');
const UPSERT_CONFLICT_TARGET = 'normalized_name,normalized_brand';

const loadEnvFile = (filePath) => {
  if (!fsSync.existsSync(filePath)) return;
  const content = fsSync.readFileSync(filePath, 'utf8');
  for (const line of content.split(/\r?\n/)) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#')) continue;
    const eq = trimmed.indexOf('=');
    if (eq < 0) continue;
    const key = trimmed.slice(0, eq).trim();
    let value = trimmed.slice(eq + 1).trim();
    if ((value.startsWith('"') && value.endsWith('"')) || (value.startsWith("'") && value.endsWith("'"))) {
      value = value.slice(1, -1);
    }
    if (!(key in process.env)) process.env[key] = value;
  }
};

loadEnvFile(path.resolve('.env.local'));
loadEnvFile(path.resolve('.env'));

const SUPABASE_URL = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL;
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SERVICE_ROLE_KEY;
const ADMIN_USER_ID = process.env.ADMIN_USER_ID;

if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY || !ADMIN_USER_ID) {
  console.error('Missing env: SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, ADMIN_USER_ID');
  process.exit(1);
}

if (!CSV_PATH) {
  console.error('Missing CSV path. Use CSV_PATH or --csv=/path/to/file.csv');
  process.exit(1);
}

if (!['safe_upsert', 'insert_only'].includes(COMMIT_MODE)) {
  console.error('Invalid --commit-mode. Use: safe_upsert | insert_only');
  process.exit(1);
}

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, {
  auth: { persistSession: false, autoRefreshToken: false },
});

const MACRO_DIFF_THRESHOLD = 0.2;
const CONFIDENCE_POLICY_THRESHOLD = 0.9;

const normalizeFoodText = (value) => {
  if (!value) return '';
  return String(value)
    .toLowerCase()
    .replace(/[^a-z0-9а-яё]+/gi, ' ')
    .replace(/\s+/g, ' ')
    .trim();
};

const buildNormalizedName = (name) => normalizeFoodText(name);
const buildNormalizedBrand = (brand) => normalizeFoodText(brand ?? '');

const validateNutrition = (input) => {
  const MAX_CALORIES_PER_100G = 900;
  const MAX_MACRO_PER_100G = 100;
  const MAX_FIBER_PER_100G = 100;
  const values = [input.calories, input.protein, input.fat, input.carbs];
  const invalid = values.some((value) => !Number.isFinite(value) || value < 0);
  if (invalid) {
    throw new Error('[foodNormalizer] Invalid nutrition values');
  }
  const fiber = Number.isFinite(input.fiber) ? Number(input.fiber) : 0;
  const sumMacros = input.protein + input.fat + input.carbs + fiber;
  const suspicious =
    input.calories > MAX_CALORIES_PER_100G ||
    input.protein > MAX_MACRO_PER_100G ||
    input.fat > MAX_MACRO_PER_100G ||
    input.carbs > MAX_MACRO_PER_100G ||
    fiber > MAX_FIBER_PER_100G ||
    sumMacros > MAX_MACRO_PER_100G + 10;
  return { suspicious };
};

const isMissingRawValue = (value) => value === null || value === undefined || String(value).trim() === '';

const getInvalidMacroReason = (nutrition, rawMacros = {}) => {
  for (const field of ['calories', 'protein', 'fat', 'carbs']) {
    if (Object.prototype.hasOwnProperty.call(rawMacros, field) && isMissingRawValue(rawMacros[field])) {
      return `${field}_missing`;
    }
    const value = nutrition[field];
    if (!Number.isFinite(value)) {
      return `${field}_invalid`;
    }
    if (value < 0) {
      return `${field}_negative`;
    }
  }

  if (
    nutrition.calories === 0 &&
    nutrition.protein === 0 &&
    nutrition.fat === 0 &&
    nutrition.carbs === 0
  ) {
    return 'all_zero_macros';
  }

  return null;
};

const getInvalidMacroMessage = (reason) => {
  switch (reason) {
    case 'calories_missing':
      return 'missing_calories';
    case 'protein_missing':
      return 'missing_protein';
    case 'fat_missing':
      return 'missing_fat';
    case 'carbs_missing':
      return 'missing_carbs';
    case 'calories_invalid':
    case 'protein_invalid':
    case 'fat_invalid':
    case 'carbs_invalid':
      return 'invalid_numeric_macro';
    case 'calories_negative':
    case 'protein_negative':
    case 'fat_negative':
    case 'carbs_negative':
      return 'negative_macro';
    case 'all_zero_macros':
      return 'all_zero_macros';
    default:
      return 'invalid_macros';
  }
};

const detectDelimiter = (headerLine) => {
  const semicolons = (headerLine.match(/;/g) || []).length;
  const commas = (headerLine.match(/,/g) || []).length;
  return semicolons > commas ? ';' : ',';
};

const parseCsvLine = (line, delimiter) => {
  const result = [];
  let current = '';
  let inQuotes = false;
  for (let i = 0; i < line.length; i += 1) {
    const ch = line[i];
    const next = line[i + 1];
    if (ch === '"') {
      if (inQuotes && next === '"') {
        current += '"';
        i += 1;
      } else {
        inQuotes = !inQuotes;
      }
      continue;
    }
    if (ch === delimiter && !inQuotes) {
      result.push(current.trim());
      current = '';
      continue;
    }
    current += ch;
  }
  result.push(current.trim());
  return result;
};

const toNumber = (value) => {
  if (value === null || value === undefined || value === '') return 0;
  const normalized = String(value)
    .trim()
    .replace(/\u00A0/g, ' ')
    .replace(/\s+/g, '')
    .replace(',', '.');
  const parsed = Number(normalized);
  return Number.isFinite(parsed) ? parsed : 0;
};

const parseList = (value) => {
  if (!value) return [];
  return String(value)
    .split(/[;,]/g)
    .map((item) => item.trim())
    .filter(Boolean);
};

const parseCsv = (csvRaw) => {
  const csv = csvRaw.replace(/^\uFEFF/, '');
  const lines = csv.split(/\r?\n/).filter((l) => l.trim().length > 0);
  if (lines.length === 0) return { rows: [], delimiter: ',' };

  const delimiter = detectDelimiter(lines[0]);
  const headers = parseCsvLine(lines[0], delimiter).map((h) => normalizeFoodText(h));

  const rows = lines.slice(1).map((line, index) => {
    const values = parseCsvLine(line, delimiter);
    const row = { _line: index + 2 };
    headers.forEach((header, idx) => {
      row[header] = values[idx] ?? '';
    });
    return row;
  });

  return { rows, delimiter };
};

const buildRows = (rawRows) => {
  if (rawRows.length === 0) return [];
  const hasCanonical =
    Object.prototype.hasOwnProperty.call(rawRows[0], 'canonical_name') ||
    Object.prototype.hasOwnProperty.call(rawRows[0], 'canonical name');

  if (hasCanonical) {
    return rawRows.map((row) => {
      const canonicalName = (row.canonical_name || row['canonical name'] || row.name || '').trim();
      const displayName = (row.name || '').trim();
      const foodId = (row.food_id || row['food id'] || '').trim();
      const barcode = (row.barcode || '').trim();
      const aliases = [displayName, foodId, barcode].filter((val) => val && val !== canonicalName);
      return {
        _line: row._line,
        name: canonicalName,
        name_original: displayName || null,
        barcode: barcode || null,
        category: (row.category || '').trim() || null,
        brand: null,
        calories: toNumber(row.calories_100g || row['calories 100g'] || row.calories),
        protein: toNumber(row.protein_100g || row['protein 100g'] || row.protein),
        fat: toNumber(row.fat_100g || row['fat 100g'] || row.fat),
        carbs: toNumber(row.carbs_100g || row['carbs 100g'] || row.carbs),
        fiber: toNumber(row.fiber_100g || row['fiber 100g'] || row.fiber),
        unit: 'g',
        source: 'core',
        aliases,
        verified: String(row.verified || '').trim() === '1',
        confidenceScore: row.confidence_score ? toNumber(row.confidence_score) : toNumber(row['confidence score']),
        sourceVersion: (row.source || row['nutrition version'] || row.nutrition_version || null),
        allergens: parseList(row.allergens),
        intolerances: [],
        raw_macros: {
          calories: row.calories_100g || row['calories 100g'] || row.calories,
          protein: row.protein_100g || row['protein 100g'] || row.protein,
          fat: row.fat_100g || row['fat 100g'] || row.fat,
          carbs: row.carbs_100g || row['carbs 100g'] || row.carbs,
        },
        raw_data: row,
      };
    });
  }

  return rawRows.map((row) => ({
    _line: row._line,
    name: (row.name || row['name_ru'] || row['название'] || '').trim(),
    name_original: (row.name_original || row['name_en'] || '').trim() || null,
    barcode: row.barcode ? String(row.barcode).trim() : null,
    category: row.category ? String(row.category).trim() : null,
    brand: row.brand ? String(row.brand).trim() : null,
    calories: toNumber(row.calories),
    protein: toNumber(row.protein),
    fat: toNumber(row.fat),
    carbs: toNumber(row.carbs),
    fiber: toNumber(row.fiber),
    unit: row.unit || 'g',
    source: row.source || 'core',
    aliases: parseList(row.aliases),
    verified: String(row.verified || '').trim().toLowerCase() === 'true' || String(row.verified || '').trim() === '1',
    confidenceScore: row.confidence ? toNumber(row.confidence) : undefined,
    sourceVersion: row.source_version || null,
    allergens: parseList(row.allergens),
    intolerances: parseList(row.intolerances),
    raw_macros: {
      calories: row.calories,
      protein: row.protein,
      fat: row.fat,
      carbs: row.carbs,
    },
    raw_data: row,
  }));
};

const validateRowsForIngestion = (rows) => {
  const accepted = [];
  const skipped = [];
  const rejectedInvalidMacros = [];

  rows.forEach((row) => {
    if (!row.name || !row.name.trim()) {
      skipped.push({ line: row._line ?? -1, name: row.name ?? '', reason: 'missing_name' });
      return;
    }

    const nutrition = {
      calories: Number(row.calories) || 0,
      protein: Number(row.protein) || 0,
      fat: Number(row.fat) || 0,
      carbs: Number(row.carbs) || 0,
      fiber: Number(row.fiber) || 0,
    };
    const invalidMacroReason = getInvalidMacroReason(nutrition, row.raw_macros);
    if (invalidMacroReason) {
      rejectedInvalidMacros.push({
        ...row,
        line: row._line ?? -1,
        reason: getInvalidMacroMessage(invalidMacroReason),
      });
      return;
    }

    try {
      const { suspicious } = validateNutrition(nutrition);
      const confidence = row.confidenceScore ?? (row.verified ? 0.95 : 0.7);
      accepted.push({
        ...row,
        ...nutrition,
        suspicious,
        confidence_score: confidence,
      });
    } catch (error) {
      skipped.push({
        line: row._line ?? -1,
        name: row.name ?? '',
        reason: error instanceof Error ? error.message : 'invalid_row',
      });
    }
  });

  return { accepted, skipped, rejectedInvalidMacros };
};

const chunk = (array, size) => {
  const result = [];
  for (let i = 0; i < array.length; i += size) {
    result.push(array.slice(i, i + size));
  }
  return result;
};

const macrosDiff = (a, b) => {
  const keys = ['calories', 'protein', 'fat', 'carbs'];
  const diffs = keys.map((key) => {
    const av = a[key] ?? 0;
    const bv = b[key] ?? 0;
    if (av === 0 && bv === 0) return 0;
    return Math.abs(av - bv) / Math.max(av, bv, 1);
  });
  return Math.max(...diffs);
};

const normalizedFoodKey = (normalizedName, normalizedBrand) =>
  `${String(normalizedName || '').trim()}__${String(normalizedBrand || '').trim()}`;

const dedupeByNormalizedKey = (rows) => {
  const byKey = new Map();
  for (const row of rows) {
    const key = normalizedFoodKey(row.normalized_name, row.normalized_brand);
    const existing = byKey.get(key);
    if (!existing) {
      byKey.set(key, row);
      continue;
    }
    const existingConfidence = Number(existing.confidence_score ?? 0);
    const candidateConfidence = Number(row.confidence_score ?? 0);
    if (candidateConfidence >= existingConfidence) {
      byKey.set(key, row);
    }
  }
  return Array.from(byKey.values());
};

const writeCsv = async ({ headers, rows, csvPath }) => {
  const escape = (v) => `"${String(v).replace(/"/g, '""')}"`;
  const lines = [
    headers.join(','),
    ...rows.map((row) => row.map(escape).join(',')),
  ];

  await fs.mkdir(path.dirname(csvPath), { recursive: true });
  await fs.writeFile(csvPath, lines.join('\n'), 'utf8');
};

const writeReports = async ({
  totalRead,
  acceptedCount,
  skipped,
  rejectedInvalidMacros,
  summary,
  csvPath,
  rejectedCsvPath,
}) => {
  await writeCsv({
    headers: ['line', 'name', 'reason'],
    rows: skipped.map((row) => [row.line, row.name, row.reason]),
    csvPath,
  });

  await writeCsv({
    headers: ['line', 'name', 'reason'],
    rows: rejectedInvalidMacros.map((row) => [row.line, row.name, row.reason]),
    csvPath: rejectedCsvPath,
  });

  console.log('--- Ingestion summary ---');
  console.log(`Dry-run: ${DRY_RUN ? 'yes' : 'no'}`);
  console.log(`Rows read: ${totalRead}`);
  console.log(`Rows valid: ${acceptedCount}`);
  console.log(`Rows rejected invalid macros: ${rejectedInvalidMacros.length}`);
  console.log(`Rows skipped: ${skipped.length}`);
  console.log(`Staged: ${summary.staged}`);
  console.log(`Conflicts: ${summary.conflicts}`);
  console.log(`Resolved conflicts: ${summary.resolvedConflicts}`);
  console.log(`Committed: ${summary.committed}`);
  if (summary.inserted !== undefined) console.log(`Inserted: ${summary.inserted}`);
  if (summary.updated !== undefined) console.log(`Updated: ${summary.updated}`);
  if (summary.skippedCatalog !== undefined) console.log(`Skipped catalog/protected: ${summary.skippedCatalog}`);
  if (summary.conflictsWritten !== undefined) console.log(`Conflicts written: ${summary.conflictsWritten}`);
  console.log(`Diary updated: ${summary.diaryUpdated}`);
  console.log(`Recommendations marked: ${summary.recommendationsMarked}`);
  console.log(`Rows committed: ${summary.committed}`);
  console.log(`Skip report: ${csvPath}`);
  console.log(`Rejected invalid macros report: ${rejectedCsvPath}`);
};

const run = async () => {
  console.log('Reading CSV:', CSV_PATH);
  console.log(`Commit mode: ${COMMIT_MODE}`);
  const csv = await fs.readFile(path.resolve(CSV_PATH), 'utf-8');
  const parsed = parseCsv(csv);
  const rawRows = parsed.rows;
  console.log(`Detected delimiter: ${parsed.delimiter}`);

  const builtRows = buildRows(rawRows);
  const { accepted: rows, skipped, rejectedInvalidMacros } = validateRowsForIngestion(builtRows);

  const reportPath = path.resolve(`evidence/food_ingestion_report_${new Date().toISOString().replace(/[:.]/g, '-')}.csv`);
  const rejectedReportPath = path.resolve(`evidence/food_ingestion_rejected_invalid_macros_${new Date().toISOString().replace(/[:.]/g, '-')}.csv`);

  if (DRY_RUN) {
    const names = Array.from(new Set(rows.map((row) => buildNormalizedName(row.name)).filter(Boolean)));
    const existingFoods = [];
    for (const nameChunk of chunk(names, 50)) {
      const { data, error } = await supabase
        .from('foods')
        .select('id,name,brand,normalized_name,normalized_brand,calories,protein,fat,carbs')
        .in('normalized_name', nameChunk)
        .limit(5000);
      if (error) throw error;
      existingFoods.push(...(data || []));
    }

    let conflicts = 0;
    rows.forEach((row) => {
      const normalizedName = buildNormalizedName(row.name);
      const normalizedBrand = buildNormalizedBrand(row.brand ?? null);
      const candidates = existingFoods.filter((food) =>
        food.normalized_name === normalizedName &&
        String(food.normalized_brand || '') === String(normalizedBrand || '')
      );
      if (candidates.length === 0) return;
      const best = candidates[0];
      const diff = macrosDiff(
        { calories: row.calories, protein: row.protein, fat: row.fat, carbs: row.carbs },
        { calories: best.calories, protein: best.protein, fat: best.fat, carbs: best.carbs }
      );
      if (diff >= MACRO_DIFF_THRESHOLD) conflicts += 1;
    });

    await writeReports({
      totalRead: rawRows.length,
      acceptedCount: rows.length,
      skipped,
      rejectedInvalidMacros,
      summary: {
        staged: rows.length + rejectedInvalidMacros.length,
        conflicts,
        resolvedConflicts: rows.filter((r) => (r.confidence_score ?? 0) >= CONFIDENCE_POLICY_THRESHOLD).length,
        committed: rows.length - conflicts,
        inserted: rows.length - conflicts,
        updated: 0,
        skippedCatalog: conflicts,
        conflictsWritten: conflicts,
        diaryUpdated: 0,
        recommendationsMarked: 0,
      },
      csvPath: reportPath,
      rejectedCsvPath: rejectedReportPath,
    });
    return;
  }

  if (rows.length === 0 && rejectedInvalidMacros.length === 0) {
    console.log('No valid rows to ingest.');
    await writeReports({
      totalRead: rawRows.length,
      acceptedCount: 0,
      skipped,
      rejectedInvalidMacros,
      summary: {
        staged: 0,
        conflicts: 0,
        resolvedConflicts: 0,
        committed: 0,
        inserted: 0,
        updated: 0,
        skippedCatalog: 0,
        conflictsWritten: 0,
        diaryUpdated: 0,
        recommendationsMarked: 0,
      },
      csvPath: reportPath,
      rejectedCsvPath: rejectedReportPath,
    });
    return;
  }

  console.log('Creating batch...');
  const { data: batch, error: batchError } = await supabase
    .from('food_import_batches')
    .insert({
      user_id: ADMIN_USER_ID,
      source: 'excel',
      filename: path.basename(CSV_PATH),
      source_version: 'v1',
      status: 'pending',
    })
    .select('id')
    .single();

  if (batchError || !batch) throw batchError || new Error('Failed to create batch');

  const batchId = batch.id;
  let stagedCount = 0;

  console.log(`Staging rows: ${rows.length + rejectedInvalidMacros.length}`);
  const stagingRowsToInsert = [
    ...rows.map((row) => ({ row, status: 'pending', conflictReason: null })),
    ...rejectedInvalidMacros.map((row) => ({ row, status: 'rejected_invalid_macros', conflictReason: row.reason })),
  ];
  for (const batchRows of chunk(stagingRowsToInsert, 200)) {
    const payload = batchRows.map((row) => ({
      batch_id: batchId,
      user_id: ADMIN_USER_ID,
      name: row.row.name,
      brand: row.row.brand ?? null,
      calories: row.row.calories,
      protein: row.row.protein,
      fat: row.row.fat,
      carbs: row.row.carbs,
      fiber: row.row.fiber,
      unit: row.row.unit || 'g',
      aliases: row.row.aliases ?? [],
      allergens: row.row.allergens ?? [],
      intolerances: row.row.intolerances ?? [],
      source: row.row.source ?? 'core',
      source_version: row.row.sourceVersion ?? null,
      normalized_name: buildNormalizedName(row.row.name),
      normalized_brand: buildNormalizedBrand(row.row.brand ?? null),
      confidence_score: row.row.confidence_score ?? 0,
      verified: row.row.verified ?? false,
      suspicious: row.row.suspicious ?? false,
      status: row.status,
      conflict_reason: row.conflictReason,
      raw_data: row.row.raw_data ?? row.row,
    }));
    const { error } = await supabase.from('food_import_staging').insert(payload);
    if (error) throw error;
    stagedCount += payload.length;
  }

  console.log('Detecting conflicts...');
  const { data: stagingRows, error: stagingError } = await supabase
    .from('food_import_staging')
    .select('*')
    .eq('batch_id', batchId)
    .eq('status', 'pending');
  if (stagingError) throw stagingError;

  const names = Array.from(new Set((stagingRows || []).map((row) => row.normalized_name).filter(Boolean)));
  const existingFoods = [];
  for (const nameChunk of chunk(names, 50)) {
    const { data, error } = await supabase
      .from('foods')
      .select('id,name,brand,normalized_name,normalized_brand,calories,protein,fat,carbs,source,confidence_score,nutrition_version')
      .in('normalized_name', nameChunk)
      .limit(5000);
    if (error) throw error;
    existingFoods.push(...(data || []));
  }

  const conflictRows = [];
  const stagingUpdates = [];
  (stagingRows || []).forEach((row) => {
    const candidates = existingFoods.filter((food) =>
      food.normalized_name === row.normalized_name &&
      String(food.normalized_brand || '') === String(row.normalized_brand || '')
    );
    if (candidates.length === 0) {
      stagingUpdates.push({ id: row.id, status: 'accepted' });
      return;
    }
    const best = candidates[0];
    const diff = macrosDiff(
      { calories: row.calories, protein: row.protein, fat: row.fat, carbs: row.carbs },
      { calories: best.calories, protein: best.protein, fat: best.fat, carbs: best.carbs }
    );
    if (diff >= MACRO_DIFF_THRESHOLD) {
      conflictRows.push({
        batch_id: batchId,
        staging_id: row.id,
        conflict_type: 'macro_conflict',
        details: {
          existing_food_id: best.id,
          existing: { calories: best.calories, protein: best.protein, fat: best.fat, carbs: best.carbs },
          incoming: { calories: row.calories, protein: row.protein, fat: row.fat, carbs: row.carbs },
          diff,
        },
      });
      stagingUpdates.push({ id: row.id, status: 'conflict', conflict_reason: 'macro_conflict' });
    } else {
      stagingUpdates.push({ id: row.id, status: 'accepted' });
    }
  });

  for (const updateRow of stagingUpdates) {
    const { error } = await supabase
      .from('food_import_staging')
      .update({ status: updateRow.status, conflict_reason: updateRow.conflict_reason ?? null })
      .eq('id', updateRow.id);
    if (error) throw error;
  }

  if (conflictRows.length > 0) {
    const { error } = await supabase.from('food_import_conflicts').insert(conflictRows);
    if (error) throw error;
  }

  const { data: conflicts } = await supabase
    .from('food_import_conflicts')
    .select('id,staging_id')
    .eq('batch_id', batchId)
    .eq('status', 'pending');

  const stagingById = new Map((stagingRows || []).map((row) => [row.id, row]));
  let resolvedConflicts = 0;
  for (const conflict of conflicts || []) {
    const staging = stagingById.get(conflict.staging_id);
    if (!staging) continue;
    const confidence = Number(staging.confidence_score ?? 0);
    const resolution = confidence >= CONFIDENCE_POLICY_THRESHOLD ? 'accept_new' : 'use_existing';
    const stagingStatus = resolution === 'accept_new' ? 'accepted' : 'rejected';
    const { error: stagingError2 } = await supabase
      .from('food_import_staging')
      .update({ status: stagingStatus })
      .eq('id', conflict.staging_id);
    if (stagingError2) throw stagingError2;
    const { error: conflictError } = await supabase
      .from('food_import_conflicts')
      .update({ status: resolution })
      .eq('id', conflict.id);
    if (conflictError) throw conflictError;
    resolvedConflicts += 1;
  }

  console.log('Resolving conflicts and committing...');
  const { data: acceptedRows, error: acceptedError } = await supabase
    .from('food_import_staging')
    .select('*')
    .eq('batch_id', batchId)
    .eq('status', 'accepted');
  if (acceptedError) throw acceptedError;

  if (!acceptedRows || acceptedRows.length === 0) {
    await supabase.from('food_import_batches').update({ status: 'committed' }).eq('id', batchId);
    await writeReports({
      totalRead: rawRows.length,
      acceptedCount: rows.length,
      skipped,
      rejectedInvalidMacros,
      summary: {
        staged: stagedCount,
        conflicts: conflictRows.length,
        resolvedConflicts,
        committed: 0,
        inserted: 0,
        updated: 0,
        skippedCatalog: 0,
        conflictsWritten: conflictRows.length,
        diaryUpdated: 0,
        recommendationsMarked: 0,
      },
      csvPath: reportPath,
      rejectedCsvPath: rejectedReportPath,
    });
    return;
  }

  const dedupAcceptedRows = dedupeByNormalizedKey(acceptedRows);
  console.log(`Accepted rows before dedupe: ${acceptedRows.length}; after dedupe: ${dedupAcceptedRows.length}`);
  console.log(`Upsert conflict target: ${UPSERT_CONFLICT_TARGET}`);

  const acceptedKeys = Array.from(new Set(dedupAcceptedRows.map((row) => row.normalized_name).filter(Boolean)));
  const existingForCommit = [];
  for (const keyChunk of chunk(acceptedKeys, 50)) {
    const { data, error } = await supabase
      .from('foods')
      .select('id,normalized_name,normalized_brand,nutrition_version,source,created_by_user_id')
      .in('normalized_name', keyChunk);
    if (error) throw error;
    existingForCommit.push(...(data || []));
  }

  const existingMap = new Map();
  existingForCommit.forEach((food) => existingMap.set(normalizedFoodKey(food.normalized_name, food.normalized_brand), food));

  const insertPayload = [];
  const updatePayload = [];
  let skippedCatalog = 0;
  dedupAcceptedRows.forEach((row) => {
    const key = normalizedFoodKey(row.normalized_name, row.normalized_brand);
    const existing = existingMap.get(key);
    const nextVersion = existing ? (Number(existing.nutrition_version || 1) + 1) : 1;
    const raw = row.raw_data || {};
    const barcode = raw?.barcode ? String(raw.barcode).trim() : null;
    const category = raw?.category ? String(raw.category).trim() : null;
    const nameOriginal = raw?.name ? String(raw.name).trim() : null;
    const payload = {
      name: row.name,
      name_original: nameOriginal,
      barcode,
      category,
      brand: row.brand,
      calories: row.calories,
      protein: row.protein,
      fat: row.fat,
      carbs: row.carbs,
      fiber: row.fiber,
      unit: row.unit,
      source: row.source,
      normalized_name: row.normalized_name,
      normalized_brand: row.normalized_brand,
      nutrition_version: nextVersion,
      verified: row.verified,
      suspicious: row.suspicious,
      confidence_score: row.confidence_score,
      source_version: row.source_version,
      allergens: row.allergens ?? [],
      intolerances: row.intolerances ?? [],
      aliases: row.aliases || [],
      created_by_user_id: ADMIN_USER_ID,
    };
    if (!existing?.id) {
      insertPayload.push(payload);
      return;
    }

    const source = String(existing.source || '');
    const isCatalog = source === 'core' || source === 'brand';
    const sameOwner = String(existing.created_by_user_id || '') === String(ADMIN_USER_ID);

    if (isCatalog || !sameOwner) {
      skippedCatalog += 1;
      return;
    }

    updatePayload.push({ id: existing.id, ...payload });
  });

  const upserted = [];
  let insertedCount = 0;
  let updatedCount = 0;
  if (COMMIT_MODE === 'insert_only') {
    if (insertPayload.length > 0) {
      for (const batchRows of chunk(insertPayload, 200)) {
        const { data, error } = await supabase
          .from('foods')
          .insert(batchRows)
          .select('id,name,name_original,aliases');
        if (error) throw error;
        insertedCount += data?.length || 0;
        upserted.push(...(data || []));
      }
    }
  } else {
    if (insertPayload.length > 0) {
      for (const batchRows of chunk(insertPayload, 200)) {
        const { data, error } = await supabase
          .from('foods')
          .upsert(batchRows, { onConflict: UPSERT_CONFLICT_TARGET, ignoreDuplicates: true })
          .select('id,name,name_original,aliases');
        if (error) throw error;
        insertedCount += data?.length || 0;
        upserted.push(...(data || []));
      }
    }
  }

  for (const row of updatePayload) {
    const { data, error } = await supabase
      .from('foods')
      .update(row)
      .eq('id', row.id)
      .select('id,name,name_original,aliases')
      .single();
    if (error) throw error;
    if (data) {
      updatedCount += 1;
      upserted.push(data);
    }
  }

  const aliasMap = new Map();
  (upserted || []).forEach((row) => {
    const aliasSet = new Set();
    [row.name, row.name_original, ...(row.aliases || [])].forEach((value) => {
      if (value && String(value).trim()) aliasSet.add(String(value).trim());
    });
    aliasSet.forEach((alias) => {
      const normalized = normalizeFoodText(alias);
      if (!normalized) return;
      if (!aliasMap.has(normalized)) {
        aliasMap.set(normalized, {
          canonical_food_id: row.id,
          alias,
          source: 'core',
          verified: true,
          created_by_user_id: ADMIN_USER_ID,
        });
      }
    });
  });

  const aliasRows = Array.from(aliasMap.values());
  if (aliasRows.length > 0) {
    const { error: aliasError } = await supabase
      .from('food_aliases')
      .upsert(aliasRows, { onConflict: 'normalized_alias' });
    if (aliasError) throw aliasError;
  }

  const foodIds = (upserted || []).map((row) => row.id);
  let diaryUpdated = 0;
  let recommendationsMarked = 0;

  if (foodIds.length > 0) {
    const { data: foodsForRecompute } = await supabase
      .from('foods')
      .select('id,calories,protein,fat,carbs,fiber')
      .in('id', foodIds);
    const foodMap = new Map((foodsForRecompute || []).map((food) => [food.id, food]));

    const { data: diaryEntries } = await supabase
      .from('food_diary_entries')
      .select('id,weight,canonical_food_id,user_id,date')
      .in('canonical_food_id', foodIds)
      .limit(5000);

    for (const entry of diaryEntries || []) {
      const food = foodMap.get(entry.canonical_food_id);
      if (!food) continue;
      const weight = Number(entry.weight || 0);
      const updated = {
        calories: Math.round((Number(food.calories || 0) * weight / 100) * 100) / 100,
        protein: Math.round((Number(food.protein || 0) * weight / 100) * 100) / 100,
        fat: Math.round((Number(food.fat || 0) * weight / 100) * 100) / 100,
        carbs: Math.round((Number(food.carbs || 0) * weight / 100) * 100) / 100,
        fiber: Math.round((Number(food.fiber || 0) * weight / 100) * 100) / 100,
      };
      const { error } = await supabase.from('food_diary_entries').update(updated).eq('id', entry.id);
      if (error) throw error;
      diaryUpdated += 1;
    }

    const uniqueDates = new Set();
    (diaryEntries || []).forEach((entry) => {
      if (entry.user_id && entry.date) uniqueDates.add(`${entry.user_id}__${entry.date}`);
    });

    for (const key of uniqueDates) {
      const [userId, date] = String(key).split('__');
      const { error } = await supabase
        .from('ai_recommendations')
        .update({ status: 'outdated', updated_at: new Date().toISOString() })
        .eq('user_id', userId)
        .eq('request_type', 'recommendation')
        .eq('input_context->>date', date)
        .in('status', ['queued', 'running', 'completed']);
      if (!error) recommendationsMarked += 1;
    }
  }

  await supabase.from('food_import_batches').update({ status: 'committed' }).eq('id', batchId);

  const summary = {
    staged: stagedCount,
    conflicts: conflictRows.length,
    resolvedConflicts,
    committed: insertedCount + updatedCount,
    inserted: insertedCount,
    updated: updatedCount,
    skippedCatalog,
    conflictsWritten: conflictRows.length,
    diaryUpdated,
    recommendationsMarked,
  };

  await writeReports({
    totalRead: rawRows.length,
    acceptedCount: rows.length,
    skipped,
    rejectedInvalidMacros,
    summary,
    csvPath: reportPath,
    rejectedCsvPath: rejectedReportPath,
  });

  console.log(JSON.stringify({ batchId, ...summary }, null, 2));
};

run().catch((error) => {
  console.error('Ingestion failed:', error?.message || error);
  process.exit(1);
});
