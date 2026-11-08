import {readFileSync, writeFileSync} from 'node:fs';
import {createHash} from 'node:crypto';
import {brotliCompressSync, constants} from 'node:zlib';

// Local projection only. Private recipe text must never be committed to GitHub.
const [input, output] = process.argv.slice(2);
if (!input || !output) throw Error('Usage: prepare-staging-reference-catalog.mjs AUTHORING.json PRIVATE_OUTPUT.br64');
const c = JSON.parse(readFileSync(input, 'utf8'));
const recipeKeys = ['recipeId','name','sourceStatus','declaredServings','declaredYieldG','measuredYieldG','confirmedServings','physicalReview','numericReferenceTestInputAvailable','sourceTagsAreVerifiedRestrictions','runtimePublishable','referenceNutrition'];
const ingredientKeys = ['ingredient_row_id','recipe_id','sort_order','ingredient_name_ru','amount','unit','weight_g','optional','preparation_note','notes'];
const stepKeys = ['step_id','recipe_id','step_number','instruction_ru','duration_min','temperature_c','notes'];
const pick = (record, keys) => Object.fromEntries(keys.map(k => [k, record[k] ?? null]));
c.recipes = c.recipes.map(r => ({...pick(r, recipeKeys),
  sourceRecipe: {...pick(r.sourceRecipe, ['recipe_id','meal_type_primary','owner_notes']), owner_notes: null},
  ingredients: r.ingredients.map(i => ({...pick(i, ingredientKeys), notes: null})),
  steps: r.steps.map(s => ({...pick(s, stepKeys), notes: null})),
}));
c.hostedProjection = {omittedFields: ['sourceRecipe.owner_notes','ingredients.notes','steps.notes'], purpose: 'RECIPE_INPUTS_AND_COOKING_INSTRUCTIONS_ONLY'};
const raw = Buffer.from(JSON.stringify(c));
const pins = JSON.parse(readFileSync('docs/premium/staging-reference-catalog-20261108.json', 'utf8'));
if (createHash('sha256').update(raw).digest('hex') !== pins.projectedCatalogSha256) throw Error('CATALOG_PROJECTION_DRIFT');
const packed = brotliCompressSync(raw, {params: {[constants.BROTLI_PARAM_QUALITY]: 11}}).toString('base64');
if (packed.length > 60000) throw Error('CATALOG_ENVIRONMENT_BUDGET_EXCEEDED');
writeFileSync(output, packed, {mode: 0o600});
console.log(JSON.stringify({recipes: c.recipes.length, projectedSha256: pins.projectedCatalogSha256, packedBytes: packed.length}));
