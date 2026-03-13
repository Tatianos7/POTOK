import fs from 'node:fs';
import path from 'node:path';
import process from 'node:process';
import { createClient } from '@supabase/supabase-js';

type RawRow = Record<string, unknown>;

type ValidRow = {
  line: number;
  recipeId?: string;
  recipeName?: string;
  ingredientName?: string;
  ingredientBrand?: string;
  ingredientBarcode?: string;
  foodId?: string;
  amountG: number;
  servings?: number;
  yieldG?: number;
};

type ReportRow = {
  line: number;
  recipe_ref: string;
  ingredient_name: string;
  food_id: string;
  amount_g: string;
  status: 'ok' | 'skipped' | 'error';
  reason: string;
};

type UnresolvedRow = {
  line: number;
  recipe_ref: string;
  ingredient_name: string;
  brand: string;
  barcode: string;
  recommendation_sql: string;
};

type RecipeBucket = {
  key: string;
  recipeId?: string;
  recipeName?: string;
  servings?: number;
  yieldG?: number;
  rows: ValidRow[];
};

const SHEET_NAME = 'recipe_ingredients_import';
const DEFAULT_FILE = 'evidence/food_kb_for_diary_and_recipes_template_with_recipe_ingredients_v2.xlsx';
const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

function parseCsvLine(line: string, delimiter: ';' | ','): string[] {
  const result: string[] = [];
  let current = '';
  let inQuotes = false;
  for (let i = 0; i < line.length; i += 1) {
    const ch = line[i];
    if (ch === '"') {
      inQuotes = !inQuotes;
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
}

function parseCsvToRows(csv: string): RawRow[] {
  const lines = csv.split(/\r?\n/).filter((l) => l.trim().length > 0);
  if (lines.length === 0) return [];
  const delimiter: ';' | ',' = lines[0].includes(';') ? ';' : ',';
  const headers = parseCsvLine(lines[0], delimiter).map((h) => normalizeHeader(h));
  return lines.slice(1).map((line) => {
    const values = parseCsvLine(line, delimiter);
    const row: RawRow = {};
    headers.forEach((h, idx) => {
      row[h] = values[idx] ?? null;
    });
    return row;
  });
}

function loadEnvFile(filePath: string): void {
  if (!fs.existsSync(filePath)) return;
  const content = fs.readFileSync(filePath, 'utf8');
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
}

function parseArgs(argv: string[]) {
  const args = new Map<string, string | boolean>();
  for (let i = 0; i < argv.length; i += 1) {
    const a = argv[i];
    if (a === '--dry-run') {
      args.set('dry-run', true);
      continue;
    }
    if (a.startsWith('--')) {
      const key = a.slice(2);
      const next = argv[i + 1];
      if (!next || next.startsWith('--')) {
        args.set(key, true);
      } else {
        args.set(key, next);
        i += 1;
      }
    }
  }
  return {
    userId: String(args.get('user') || ''),
    file: String(args.get('file') || DEFAULT_FILE),
    sheet: String(args.get('sheet') || SHEET_NAME),
    dryRun: Boolean(args.get('dry-run')),
  };
}

function normalizeHeader(value: string): string {
  return value.trim().toLowerCase().replace(/\s+/g, '_');
}

function numOrUndefined(v: unknown): number | undefined {
  if (v === null || v === undefined || v === '') return undefined;
  const n = Number(v);
  return Number.isFinite(n) ? n : undefined;
}

function textOrUndefined(v: unknown): string | undefined {
  if (v === null || v === undefined) return undefined;
  const s = String(v).trim();
  return s.length > 0 ? s : undefined;
}

function normalizeFoodText(value: string): string {
  return value
    .toLowerCase()
    .replace(/[^a-z0-9а-яё]+/gi, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function buildReportCsv(rows: ReportRow[]): string {
  const esc = (v: string) => `"${v.replace(/"/g, '""')}"`;
  const header = ['line', 'recipe_ref', 'ingredient_name', 'food_id', 'amount_g', 'status', 'reason'];
  const body = rows.map((r) => [
    String(r.line),
    r.recipe_ref,
    r.ingredient_name,
    r.food_id,
    r.amount_g,
    r.status,
    r.reason,
  ].map(esc).join(','));
  return [header.join(','), ...body].join('\n');
}

function buildUnresolvedCsv(rows: UnresolvedRow[]): string {
  const esc = (v: string) => `"${v.replace(/"/g, '""')}"`;
  const header = ['line', 'recipe_ref', 'ingredient_name', 'brand', 'barcode', 'recommendation_sql'];
  const body = rows.map((r) => [
    String(r.line),
    r.recipe_ref,
    r.ingredient_name,
    r.brand,
    r.barcode,
    r.recommendation_sql,
  ].map(esc).join(','));
  return [header.join(','), ...body].join('\n');
}

async function main() {
  let XLSX: any;
  try {
    const mod: any = await import('xlsx');
    XLSX = mod?.default && typeof mod.default.readFile === 'function' ? mod.default : mod;
  } catch {
    throw new Error('Missing dependency: xlsx. Install with `pnpm add -D xlsx tsx` (or `npm i -D xlsx tsx`).');
  }
  if (!XLSX || typeof XLSX.readFile !== 'function' || !XLSX.utils?.sheet_to_json) {
    throw new Error('Invalid xlsx module shape: readFile/sheet_to_json not available');
  }

  loadEnvFile(path.resolve('.env.local'));
  loadEnvFile(path.resolve('.env'));

  const { userId, file, sheet, dryRun } = parseArgs(process.argv.slice(2));

  if (!UUID_RE.test(userId)) {
    throw new Error('Invalid --user UUID');
  }

  const supabaseUrl = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL;
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SERVICE_ROLE_KEY;

  if (!supabaseUrl || !serviceKey) {
    throw new Error('Missing env: SUPABASE_URL(or VITE_SUPABASE_URL) and SUPABASE_SERVICE_ROLE_KEY(or SERVICE_ROLE_KEY)');
  }

  const absFile = path.resolve(file);
  if (!fs.existsSync(absFile)) {
    throw new Error(`File not found: ${absFile}`);
  }

  let raw: RawRow[] = [];
  if (absFile.toLowerCase().endsWith('.csv')) {
    const csv = fs.readFileSync(absFile, 'utf8');
    raw = parseCsvToRows(csv);
  } else {
    const wb = XLSX.readFile(absFile, { cellDates: false });
    const ws = wb.Sheets[sheet];
    if (!ws) {
      throw new Error(`Sheet not found: ${sheet}`);
    }
    raw = XLSX.utils.sheet_to_json<RawRow>(ws, { defval: null });
  }
  const report: ReportRow[] = [];
  const validRows: ValidRow[] = [];

  raw.forEach((row, idx) => {
    const line = idx + 2;
    const normalized: Record<string, unknown> = {};
    Object.entries(row).forEach(([k, v]) => {
      normalized[normalizeHeader(k)] = v;
    });

    const recipeId = textOrUndefined(normalized.recipe_id);
    const recipeName = textOrUndefined(normalized.recipe_name);
    const ingredientName = textOrUndefined(normalized.ingredient_name);
    const ingredientBrand = textOrUndefined(normalized.brand || normalized.ingredient_brand);
    const ingredientBarcode = textOrUndefined(normalized.barcode || normalized.ingredient_barcode);
    const foodId = textOrUndefined(normalized.food_id);
    const amountG = numOrUndefined(normalized.amount_g);
    const servings = numOrUndefined(normalized.servings);
    const yieldG = numOrUndefined(normalized.yield_g);

    const recipeRef = recipeId || recipeName || '';

    const recipeNameLower = (recipeName || '').toLowerCase();
    const recipeIdLower = (recipeId || '').toLowerCase();
    const ingredientNameLower = (ingredientName || '').toLowerCase();
    const looksLikeTemplateRow =
      recipeNameLower.includes('название рецепта') ||
      recipeIdLower.includes('uuid рецепта') ||
      ingredientNameLower.includes('название ингредиента');
    if (looksLikeTemplateRow) {
      report.push({ line, recipe_ref: recipeRef, ingredient_name: ingredientName || '', food_id: foodId || '', amount_g: String(amountG ?? ''), status: 'skipped', reason: 'template_instruction_row' });
      return;
    }

    if (!recipeId && !recipeName) {
      report.push({ line, recipe_ref: recipeRef, ingredient_name: ingredientName || '', food_id: foodId || '', amount_g: String(amountG ?? ''), status: 'skipped', reason: 'missing_recipe_id_and_recipe_name' });
      return;
    }

    if (recipeId && !UUID_RE.test(recipeId)) {
      report.push({ line, recipe_ref: recipeRef, ingredient_name: ingredientName || '', food_id: foodId || '', amount_g: String(amountG ?? ''), status: 'skipped', reason: 'invalid_recipe_id_uuid' });
      return;
    }

    if (foodId && !UUID_RE.test(foodId)) {
      report.push({ line, recipe_ref: recipeRef, ingredient_name: ingredientName || '', food_id: foodId, amount_g: String(amountG ?? ''), status: 'skipped', reason: 'invalid_food_id_uuid' });
      return;
    }

    if (!foodId && !ingredientName) {
      report.push({ line, recipe_ref: recipeRef, ingredient_name: '', food_id: '', amount_g: String(amountG ?? ''), status: 'skipped', reason: 'missing_food_id_and_ingredient_name' });
      return;
    }

    if (!amountG || amountG <= 0) {
      report.push({ line, recipe_ref: recipeRef, ingredient_name: ingredientName || '', food_id: foodId, amount_g: String(amountG ?? ''), status: 'skipped', reason: 'amount_g_must_be_gt_0' });
      return;
    }

    validRows.push({
      line,
      recipeId,
      recipeName,
      ingredientName,
      ingredientBrand,
      ingredientBarcode,
      foodId,
      amountG,
      servings,
      yieldG,
    });
  });

  const buckets = new Map<string, RecipeBucket>();
  for (const r of validRows) {
    const key = r.recipeId ? `id:${r.recipeId}` : `name:${(r.recipeName || '').toLowerCase()}`;
    if (!buckets.has(key)) {
      buckets.set(key, {
        key,
        recipeId: r.recipeId,
        recipeName: r.recipeName,
        servings: r.servings,
        yieldG: r.yieldG,
        rows: [],
      });
    }
    const bucket = buckets.get(key)!;
    if (bucket.servings === undefined && r.servings !== undefined) bucket.servings = r.servings;
    if (bucket.yieldG === undefined && r.yieldG !== undefined) bucket.yieldG = r.yieldG;
    bucket.rows.push(r);
  }

  const supabase = createClient(supabaseUrl, serviceKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });

  const resolveFoodId = async (params: {
    ingredientName?: string;
    ingredientBrand?: string;
    ingredientBarcode?: string;
  }): Promise<string | null> => {
    const barcode = (params.ingredientBarcode || '').trim();
    if (barcode) {
      const { data: barcodeFoods } = await supabase
        .from('foods')
        .select('id,created_at')
        .eq('barcode', barcode)
        .or(`source.in.(core,brand),and(source.eq.user,created_by_user_id.eq.${userId})`)
        .order('created_at', { ascending: false })
        .limit(1);
      if (barcodeFoods && barcodeFoods.length > 0 && barcodeFoods[0]?.id) {
        return String(barcodeFoods[0].id);
      }
    }

    const ingredientName = params.ingredientName;
    const name = (ingredientName || '').trim();
    if (!name) return null;
    const normalized = normalizeFoodText(name);
    if (!normalized) return null;
    const normalizedBrand = normalizeFoodText(params.ingredientBrand || '');

    if (normalizedBrand) {
      const { data: exactBrandedFoods } = await supabase
        .from('foods')
        .select('id,created_at')
        .eq('normalized_name', normalized)
        .eq('normalized_brand', normalizedBrand)
        .or(`source.in.(core,brand),and(source.eq.user,created_by_user_id.eq.${userId})`)
        .order('created_at', { ascending: false })
        .limit(1);
      if (exactBrandedFoods && exactBrandedFoods.length > 0 && exactBrandedFoods[0]?.id) {
        return String(exactBrandedFoods[0].id);
      }
    }

    const { data: exactFoods } = await supabase
      .from('foods')
      .select('id,created_at')
      .eq('normalized_name', normalized)
      .or(`source.in.(core,brand),and(source.eq.user,created_by_user_id.eq.${userId})`)
      .order('created_at', { ascending: false })
      .limit(1);
    if (exactFoods && exactFoods.length > 0 && exactFoods[0]?.id) {
      return String(exactFoods[0].id);
    }

    const { data: aliases } = await supabase
      .from('food_aliases')
      .select('canonical_food_id')
      .eq('normalized_alias', normalized)
      .limit(10);
    const aliasIds = (aliases || []).map((a: any) => a.canonical_food_id).filter(Boolean);
    if (aliasIds.length === 0) return null;

    const { data: aliasFoods } = await supabase
      .from('foods')
      .select('id,created_at')
      .in('id', aliasIds)
      .or(`source.in.(core,brand),and(source.eq.user,created_by_user_id.eq.${userId})`)
      .order('created_at', { ascending: false })
      .limit(1);
    if (aliasFoods && aliasFoods.length > 0 && aliasFoods[0]?.id) {
      return String(aliasFoods[0].id);
    }

    return null;
  };

  let recipesProcessed = 0;
  let ingredientsInserted = 0;
  const unresolvedRows: UnresolvedRow[] = [];

  for (const bucket of buckets.values()) {
    try {
      let recipeId = bucket.recipeId;

      if (recipeId) {
        const { data: recipe, error } = await supabase
          .from('recipes')
          .select('id,user_id')
          .eq('id', recipeId)
          .eq('user_id', userId)
          .single();
        if (error || !recipe) {
          for (const row of bucket.rows) {
            report.push({
              line: row.line,
              recipe_ref: recipeId,
              ingredient_name: row.ingredientName || '',
              food_id: row.foodId || '',
              amount_g: String(row.amountG),
              status: 'error',
              reason: 'recipe_id_not_found_for_user',
            });
          }
          continue;
        }
      } else {
        const name = (bucket.recipeName || '').trim();
        const { data: existing, error: findError } = await supabase
          .from('recipes')
          .select('id')
          .eq('user_id', userId)
          .eq('name', name)
          .order('created_at', { ascending: false })
          .limit(1)
          .maybeSingle();

        if (findError) throw findError;

        if (existing?.id) {
          recipeId = existing.id;
        } else {
          if (dryRun) {
            recipeId = `dry-run:${name}`;
          } else {
            const payload: Record<string, unknown> = {
              user_id: userId,
              name,
              ingredients: [],
              total_calories: 0,
              protein: 0,
              fat: 0,
              carbs: 0,
            };
            if (bucket.servings !== undefined) payload.servings = bucket.servings;
            if (bucket.yieldG !== undefined) payload.yield_g = bucket.yieldG;

            const { data: created, error: createError } = await supabase
              .from('recipes')
              .insert(payload)
              .select('id')
              .single();
            if (createError || !created?.id) {
              throw createError || new Error('create_recipe_failed');
            }
            recipeId = created.id;
          }
        }
      }

      if (!recipeId) throw new Error('recipe_resolution_failed');

      const rowsPayload: Array<{ line: number; ingredient_name: string; food_id: string; amount_g: number }> = [];
      for (const r of bucket.rows) {
        let resolvedFoodId = r.foodId || null;
        if (!resolvedFoodId) {
          resolvedFoodId = await resolveFoodId({
            ingredientName: r.ingredientName,
            ingredientBrand: r.ingredientBrand,
            ingredientBarcode: r.ingredientBarcode,
          });
        }
        if (!resolvedFoodId || !UUID_RE.test(resolvedFoodId)) {
          const safeName = (r.ingredientName || '').replace(/'/g, "''");
          const safeBrand = (r.ingredientBrand || '').replace(/'/g, "''");
          const safeBarcode = (r.ingredientBarcode || '').replace(/'/g, "''");
          report.push({
            line: r.line,
            recipe_ref: recipeId,
            ingredient_name: r.ingredientName || '',
            food_id: r.foodId || '',
            amount_g: String(r.amountG),
            status: 'skipped',
            reason: 'food_id_not_resolved',
          });
          unresolvedRows.push({
            line: r.line,
            recipe_ref: recipeId,
            ingredient_name: r.ingredientName || '',
            brand: r.ingredientBrand || '',
            barcode: r.ingredientBarcode || '',
            recommendation_sql: safeBarcode
              ? `select id,name,brand,barcode from public.foods where barcode = '${safeBarcode}' limit 20;`
              : `select id,name,brand,barcode from public.foods where normalized_name = '${normalizeFoodText(safeName)}'${safeBrand ? ` and normalized_brand = '${normalizeFoodText(safeBrand)}'` : ''} order by created_at desc limit 20;`,
          });
          continue;
        }
        rowsPayload.push({
          line: r.line,
          ingredient_name: r.ingredientName || '',
          food_id: resolvedFoodId,
          amount_g: r.amountG,
        });
      }

      if (rowsPayload.length === 0) {
        continue;
      }

      if (dryRun) {
        for (const row of rowsPayload) {
          report.push({
            line: row.line,
            recipe_ref: recipeId,
            ingredient_name: row.ingredient_name || '',
            food_id: row.food_id,
            amount_g: String(row.amount_g),
            status: 'ok',
            reason: 'dry_run_validated',
          });
        }
        recipesProcessed += 1;
        ingredientsInserted += rowsPayload.length;
        continue;
      }

      const { data: replaced, error: replaceError } = await supabase.rpc('replace_recipe_ingredients_atomic', {
        p_recipe_id: recipeId,
        p_user_id: userId,
        p_rows: rowsPayload.map((r) => ({ food_id: r.food_id, amount_g: r.amount_g })),
        p_servings: bucket.servings ?? null,
        p_yield_g: bucket.yieldG ?? null,
      });
      if (replaceError) throw replaceError;

      const { error: recomputeError } = await supabase.rpc('recompute_recipe_totals', {
        recipe_id: recipeId,
      });
      if (recomputeError) throw recomputeError;

      for (const row of rowsPayload) {
        report.push({
          line: row.line,
          recipe_ref: recipeId,
          ingredient_name: row.ingredient_name || '',
          food_id: row.food_id,
          amount_g: String(row.amount_g),
          status: 'ok',
          reason: 'imported',
        });
      }

      recipesProcessed += 1;
      ingredientsInserted += Number(replaced ?? rowsPayload.length);
    } catch (error) {
      const reason = error instanceof Error ? error.message : 'unknown_error';
      for (const row of bucket.rows) {
        report.push({
          line: row.line,
          recipe_ref: bucket.recipeId || bucket.recipeName || '',
          ingredient_name: row.ingredientName || '',
          food_id: row.foodId || '',
          amount_g: String(row.amountG),
          status: 'error',
          reason,
        });
      }
    }
  }

  const skippedCount = report.filter((r) => r.status === 'skipped').length;
  const errorCount = report.filter((r) => r.status === 'error').length;

  const now = new Date();
  const stamp = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}_${String(now.getHours()).padStart(2, '0')}${String(now.getMinutes()).padStart(2, '0')}${String(now.getSeconds()).padStart(2, '0')}`;
  const reportPath = path.resolve(`evidence/recipe_import_report_${stamp}.csv`);
  fs.mkdirSync(path.dirname(reportPath), { recursive: true });
  fs.writeFileSync(reportPath, buildReportCsv(report), 'utf8');

  let unresolvedPath: string | null = null;
  if (unresolvedRows.length > 0) {
    unresolvedPath = path.resolve(`evidence/recipe_import_unresolved_${stamp}.csv`);
    fs.writeFileSync(unresolvedPath, buildUnresolvedCsv(unresolvedRows), 'utf8');
  }

  console.log('Recipe import completed');
  console.log(`Dry-run: ${dryRun ? 'yes' : 'no'}`);
  console.log(`Recipes processed: ${recipesProcessed}`);
  console.log(`Ingredients inserted: ${ingredientsInserted}`);
  console.log(`Skipped rows: ${skippedCount}`);
  console.log(`Error rows: ${errorCount}`);
  console.log(`Report: ${reportPath}`);
  if (unresolvedPath) {
    console.log(`Unresolved report: ${unresolvedPath}`);
  }
}

main().catch((err) => {
  const msg = err instanceof Error ? err.message : String(err);
  console.error(`Import failed: ${msg}`);
  process.exit(1);
});
