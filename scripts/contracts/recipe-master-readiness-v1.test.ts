import assert from 'node:assert/strict';
import test from 'node:test';
import { inspectRecipeMasterRowsV1, recipeMasterSheetsV1 } from './recipe-master-readiness-v1';
function fixture() {
  const sheets = Object.fromEntries(recipeMasterSheetsV1.map(name => [name, [] as Record<string, unknown>[]]));
  sheets['01_Рецепты'] = [{ recipe_id: 'one', name_ru: 'Synthetic', status: 'READY_FOR_REVIEW', servings: 1,
    total_weight_g: null, ref_fiber_g: 0, owner_notes: 'No assumed yield' }, { recipe_id: 'example_one', status: 'DRAFT' }];
  sheets['02_Ингредиенты'] = [{ ingredient_row_id: 'i1', recipe_id: 'one', weight_g: 10, canonical_status: 'UNRESOLVED', food_stable_id: null },
    { ingredient_row_id: 'example_i', recipe_id: 'example_one' }];
  return sheets;
}
test('counts source rows, excludes explicit examples and preserves statuses without approval', () => {
  const source = fixture(); const before = JSON.stringify(source); const r = inspectRecipeMasterRowsV1(source);
  assert.equal(r.summary.recipes, 1); assert.equal(r.summary.excludedExamples, 1); assert.equal(r.summary.ingredients, 1);
  assert.equal(r.summary.missingRecordedYield, 1); assert.equal(r.summary.missingReferenceFiber, 0);
  assert.equal(r.runtimePublishable, false); assert.equal(JSON.stringify(source), before);
});
test('APPROVED text and complete numeric fields cannot create runtime publication evidence', () => {
  const s = fixture(); Object.assign(s['01_Рецепты'][0], { status: 'APPROVED', total_weight_g: 10 });
  Object.assign(s['02_Ингредиенты'][0], { canonical_status: 'RESOLVED', food_stable_id: 'synthetic' });
  const r = inspectRecipeMasterRowsV1(s); assert.equal(r.runtimePublishable, false);
  assert.ok(r.recipes[0].issues.includes('INDEPENDENT_RUNTIME_PUBLICATION_EVIDENCE_REQUIRED'));
});
test('keeps unknown, zero, text, negative and nonfinite servings/weights distinct from valid quantities', () => {
  for (const value of [null, 0, -1, '1', NaN, Infinity]) {
    const s = fixture(); s['01_Рецепты'][0].servings = value; s['02_Ингредиенты'][0].weight_g = value;
    const r = inspectRecipeMasterRowsV1(s); assert.equal(r.summary.missingServings, 1); assert.equal(r.summary.ingredientsMissingWeights, 1);
  }
});
test('rejects duplicate identities, missing tabs and non-text identities', () => {
  const duplicate = fixture(); duplicate['01_Рецепты'].push(duplicate['01_Рецепты'][0]); assert.throws(() => inspectRecipeMasterRowsV1(duplicate), /DUPLICATE/);
  const missing = fixture(); delete missing['03_Шаги']; assert.throws(() => inspectRecipeMasterRowsV1(missing), /MISSING_MASTER_SHEET/);
  const invalid = fixture(); invalid['01_Рецепты'][0].recipe_id = 42; assert.throws(() => inspectRecipeMasterRowsV1(invalid), /INVALID_MASTER_RECIPE_ID/);
});
test('does not hide orphan ingredients or empty ingredient lists', () => {
  const s = fixture(); s['02_Ингредиенты'][0].recipe_id = 'unknown'; const r = inspectRecipeMasterRowsV1(s);
  assert.equal(r.summary.orphanIngredients, 1); assert.ok(r.recipes[0].issues.includes('INGREDIENTS_MISSING'));
});
