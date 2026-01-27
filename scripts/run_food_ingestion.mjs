import fs from 'node:fs/promises';
import path from 'node:path';
import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
const ADMIN_USER_ID = process.env.ADMIN_USER_ID;
const CSV_PATH = process.env.CSV_PATH || process.argv.find((arg) => arg.startsWith('--csv='))?.split('=')[1];

if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY || !ADMIN_USER_ID) {
  console.error('Missing env: SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, ADMIN_USER_ID');
  process.exit(1);
}

if (!CSV_PATH) {
  console.error('Missing CSV path. Use CSV_PATH or --csv=/path/to/file.csv');
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

const parseCsvLine = (line) => {
  const result = [];
  let current = '';
  let inQuotes = false;
  for (let i = 0; i < line.length; i += 1) {
    const ch = line[i];
    if (ch === '"') {
      inQuotes = !inQuotes;
      continue;
    }
    if (ch === ',' && !inQuotes) {
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
  const parsed = Number(String(value).replace(',', '.'));
  return Number.isFinite(parsed) ? parsed : 0;
};

const parseList = (value) => {
  if (!value) return [];
  return String(value)
    .split(/[;,]/g)
    .map((item) => item.trim())
    .filter(Boolean);
};

const parseCsv = (csv) => {
  const lines = csv.split(/\r?\n/).filter((l) => l.trim().length > 0);
  if (lines.length === 0) return [];
  const headers = parseCsvLine(lines[0]).map((h) => normalizeFoodText(h));
  return lines.slice(1).map((line) => {
    const values = parseCsvLine(line);
    const row = {};
    headers.forEach((header, idx) => {
      row[header] = values[idx] ?? '';
    });
    return row;
  });
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
      const aliases = [displayName, foodId, barcode]
        .filter((val) => val && val !== canonicalName);
      return {
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
        raw_data: row,
      };
    });
  }
  return rawRows.map((row) => ({
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
    raw_data: row,
  }));
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

const run = async () => {
  console.log('Reading CSV:', CSV_PATH);
  const csv = await fs.readFile(path.resolve(CSV_PATH), 'utf-8');
  const rawRows = parseCsv(csv);
  const rows = buildRows(rawRows).filter((row) => row.name);

  if (rows.length === 0) {
    console.log('No rows to ingest.');
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

  console.log(`Staging rows: ${rows.length}`);
  for (const batchRows of chunk(rows, 200)) {
    const payload = batchRows.map((row) => {
      const nutrition = {
        calories: Number(row.calories) || 0,
        protein: Number(row.protein) || 0,
        fat: Number(row.fat) || 0,
        carbs: Number(row.carbs) || 0,
        fiber: Number(row.fiber) || 0,
      };
      const { suspicious } = validateNutrition(nutrition);
      const confidence = row.confidenceScore ?? (row.verified ? 0.95 : 0.7);
      return {
        batch_id: batchId,
        user_id: ADMIN_USER_ID,
        name: row.name,
        brand: row.brand ?? null,
        calories: nutrition.calories,
        protein: nutrition.protein,
        fat: nutrition.fat,
        carbs: nutrition.carbs,
        fiber: nutrition.fiber,
        unit: row.unit || 'g',
        aliases: row.aliases ?? [],
        allergens: row.allergens ?? [],
        intolerances: row.intolerances ?? [],
        source: row.source ?? 'core',
        source_version: row.sourceVersion ?? null,
        normalized_name: buildNormalizedName(row.name),
        normalized_brand: buildNormalizedBrand(row.brand ?? null),
        confidence_score: confidence,
        verified: row.verified ?? false,
        suspicious,
        status: 'pending',
        raw_data: row.raw_data ?? row,
      };
    });
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

  if (stagingUpdates.length > 0) {
    for (const updateRow of stagingUpdates) {
      const { error } = await supabase
        .from('food_import_staging')
        .update({ status: updateRow.status, conflict_reason: updateRow.conflict_reason ?? null })
        .eq('id', updateRow.id);
      if (error) throw error;
    }
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
    console.log('No accepted rows to commit.');
    await supabase.from('food_import_batches').update({ status: 'committed' }).eq('id', batchId);
    return;
  }

  const acceptedKeys = Array.from(new Set(acceptedRows.map((row) => row.normalized_name).filter(Boolean)));
  const existingForCommit = [];
  for (const keyChunk of chunk(acceptedKeys, 50)) {
    const { data, error } = await supabase
      .from('foods')
      .select('id,normalized_name,normalized_brand,nutrition_version')
      .in('normalized_name', keyChunk);
    if (error) throw error;
    existingForCommit.push(...(data || []));
  }

  const existingMap = new Map();
  existingForCommit.forEach((food) => {
    const key = `${food.normalized_name || ''}__${food.normalized_brand || ''}`;
    existingMap.set(key, food);
  });

  const insertPayload = [];
  const updatePayload = [];
  acceptedRows.forEach((row) => {
    const key = `${row.normalized_name || ''}__${row.normalized_brand || ''}`;
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
    if (existing?.id) {
      updatePayload.push({ id: existing.id, ...payload });
    } else {
      insertPayload.push(payload);
    }
  });

  const upserted = [];
  if (insertPayload.length > 0) {
    for (const batchRows of chunk(insertPayload, 200)) {
      const { data, error } = await supabase
        .from('foods')
        .insert(batchRows)
        .select('id,name,name_original,aliases');
      if (error) throw error;
      upserted.push(...(data || []));
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
    if (data) upserted.push(data);
  }

  const aliasMap = new Map();
  (upserted || []).forEach((row) => {
    const aliasSet = new Set();
    [row.name, row.name_original, ...(row.aliases || [])].forEach((value) => {
      if (value && String(value).trim()) {
        aliasSet.add(String(value).trim());
      }
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
      const { error } = await supabase
        .from('food_diary_entries')
        .update(updated)
        .eq('id', entry.id);
      if (error) throw error;
      diaryUpdated += 1;
    }

    const uniqueDates = new Set();
    (diaryEntries || []).forEach((entry) => {
      if (entry.user_id && entry.date) {
        uniqueDates.add(`${entry.user_id}__${entry.date}`);
      }
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

  console.log(JSON.stringify({
    batchId,
    staged: stagedCount,
    conflicts: conflictRows.length,
    resolvedConflicts,
    committed: upserted?.length ?? 0,
    diaryUpdated,
    recommendationsMarked,
  }, null, 2));
};

run().catch((error) => {
  console.error('Ingestion failed:', error?.message || error);
  process.exit(1);
});
