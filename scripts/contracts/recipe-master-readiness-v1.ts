import { readFileSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { basename } from 'node:path';
import { pathToFileURL } from 'node:url';
import XLSX from 'xlsx';

type Row = Record<string, unknown>;
export const recipeMasterSheetsV1 = ['00_Инструкция', '01_Рецепты', '02_Ингредиенты', '03_Шаги',
  '04_Теги', '05_Справочники', '06_Проверка'] as const;
const required = {
  '01_Рецепты': ['recipe_id', 'status', 'name_ru', 'servings', 'total_weight_g', 'ref_fiber_g', 'owner_notes'],
  '02_Ингредиенты': ['ingredient_row_id', 'recipe_id', 'ingredient_name_ru', 'weight_g', 'food_stable_id', 'canonical_status'],
  '03_Шаги': ['step_id', 'recipe_id'], '04_Теги': ['recipe_id', 'tag_value'],
} as const;
const present = (v: unknown) => v !== null && v !== undefined && v !== '';
const positive = (v: unknown) => typeof v === 'number' && Number.isFinite(v) && v > 0;
const text = (v: unknown) => typeof v === 'string' ? v : '';
const counts = (rows: Row[], key: string) => {
  const result: Record<string, number> = Object.create(null);
  for (const row of rows) { const k = text(row[key]) || '(missing)'; result[k] = (result[k] ?? 0) + 1; }
  return result;
};

/** Observations only. This file cannot issue canonical bindings, reviews, nutrition or manifests. */
export function inspectRecipeMasterRowsV1(sheets: Record<string, Row[]>) {
  for (const name of recipeMasterSheetsV1) if (!Array.isArray(sheets[name])) throw new Error(`MISSING_MASTER_SHEET:${name}`);
  const all = sheets['01_Рецепты'].filter(r => present(r.recipe_id));
  if (all.some(r => typeof r.recipe_id !== 'string')) throw new Error('INVALID_MASTER_RECIPE_ID');
  const examples = all.filter(r => text(r.recipe_id).startsWith('example_'));
  const recipes = all.filter(r => !text(r.recipe_id).startsWith('example_'));
  const ids = new Set(recipes.map(r => text(r.recipe_id)));
  if (ids.size !== recipes.length) throw new Error('DUPLICATE_MASTER_RECIPE_ID');
  const ingredients = sheets['02_Ингредиенты'].filter(r => ids.has(text(r.recipe_id)));
  const recipeIds = new Set(all.map(r => text(r.recipe_id)));
  const orphanIngredients = sheets['02_Ингредиенты'].filter(r => present(r.ingredient_row_id) && !recipeIds.has(text(r.recipe_id)));
  const rows = recipes.map(recipe => {
    const id = text(recipe.recipe_id);
    const children = ingredients.filter(r => r.recipe_id === id);
    const missingWeight = children.filter(r => !positive(r.weight_g)).length;
    const unresolved = children.filter(r => r.canonical_status !== 'RESOLVED').length;
    const missingStableId = children.filter(r => !text(r.food_stable_id).trim()).length;
    const issues: string[] = [];
    if (recipe.status !== 'APPROVED') issues.push('OWNER_REVIEW_NOT_APPROVED');
    if (!positive(recipe.servings)) issues.push('SERVINGS_MISSING_OR_INVALID');
    if (!positive(recipe.total_weight_g)) issues.push('MEASURED_YIELD_NOT_RECORDED');
    if (!children.length) issues.push('INGREDIENTS_MISSING');
    if (missingWeight) issues.push('INGREDIENT_WEIGHTS_NEED_REVIEW');
    if (unresolved) issues.push('CANONICAL_BINDINGS_NOT_RESOLVED');
    if (missingStableId) issues.push('STABLE_FOOD_IDS_MISSING');
    if (recipe.ref_fiber_g === null || recipe.ref_fiber_g === undefined || recipe.ref_fiber_g === '') issues.push('REFERENCE_FIBER_MISSING');
    // Reference columns, APPROVED text and workbook membership cannot attest runtime evidence.
    issues.push('INDEPENDENT_RUNTIME_PUBLICATION_EVIDENCE_REQUIRED');
    return { recipeId: id, name: text(recipe.name_ru), status: text(recipe.status),
      declaredServings: recipe.servings ?? null, recordedYieldG: recipe.total_weight_g ?? null,
      ingredientCount: children.length, missingIngredientWeights: missingWeight,
      unresolvedIngredients: unresolved, missingStableIds: missingStableId,
      notes: text(recipe.owner_notes), issues };
  });
  return {
    contract: 'potok-recipe-master-readiness-observation-v1', runtimePublishable: false,
    summary: { recipes: recipes.length, excludedExamples: examples.length, ingredients: ingredients.length,
      statusCounts: counts(recipes, 'status'), canonicalStatusCounts: counts(ingredients, 'canonical_status'),
      missingServings: rows.filter(r => r.issues.includes('SERVINGS_MISSING_OR_INVALID')).length,
      missingRecordedYield: rows.filter(r => r.issues.includes('MEASURED_YIELD_NOT_RECORDED')).length,
      missingReferenceFiber: rows.filter(r => r.issues.includes('REFERENCE_FIBER_MISSING')).length,
      ingredientsMissingWeights: ingredients.filter(r => !positive(r.weight_g)).length,
      ingredientsWithStableIds: ingredients.filter(r => text(r.food_stable_id).trim()).length,
      orphanIngredients: orphanIngredients.length,
      steps: sheets['03_Шаги'].filter(r => ids.has(text(r.recipe_id))).length },
    recipes: rows,
  };
}

export function readRecipeMasterReadinessV1(path: string) {
  const bytes = readFileSync(path);
  const workbook = XLSX.read(bytes, { type: 'buffer' });
  const sheets: Record<string, Row[]> = {};
  for (const name of recipeMasterSheetsV1) {
    const sheet = workbook.Sheets[name]; if (!sheet) throw new Error(`MISSING_MASTER_SHEET:${name}`);
    if (name in required) {
      const headers = XLSX.utils.sheet_to_json<unknown[]>(sheet, { header: 1, defval: null })[0] ?? [];
      for (const field of required[name as keyof typeof required]) if (!headers.includes(field)) throw new Error(`MISSING_MASTER_COLUMN:${name}:${field}`);
    }
    sheets[name] = XLSX.utils.sheet_to_json<Row>(sheet, { defval: null });
  }
  return { ...inspectRecipeMasterRowsV1(sheets), source: { fileName: basename(path),
    sha256: createHash('sha256').update(bytes).digest('hex'), bytes: bytes.length } };
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  if (process.argv.length !== 3) throw new Error('Usage: node --import tsx scripts/contracts/recipe-master-readiness-v1.ts INPUT.xlsx');
  process.stdout.write(JSON.stringify(readRecipeMasterReadinessV1(process.argv[2]), null, 2) + '\n');
}
