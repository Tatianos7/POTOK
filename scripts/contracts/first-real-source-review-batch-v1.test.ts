import assert from 'node:assert/strict';
import test from 'node:test';
import fs from 'node:fs';
import {createHash} from 'node:crypto';
const root=new URL('../../',import.meta.url);
const c=JSON.parse(fs.readFileSync(new URL('docs/premium/retained-sources/first-batch-review-20261031/source-review-batch-v1.json',root),'utf8'));
const read=(path:string)=>fs.readFileSync(new URL(path,root));
test('selected batch reuses exact existing source packages and owner pilot identity',()=>{
  for(const ref of c.sourcePackages)assert.equal(createHash('sha256').update(read(ref.path)).digest('hex'),ref.sha256);
  const oat=JSON.parse(read(c.sourcePackages[0].path).toString());
  const pear=JSON.parse(read(c.sourcePackages[1].path).toString());
  assert.equal(c.selected[0].recipeId,oat.recipe.id);
  assert.equal(c.selected[1].recipeId,pear.sourceWorkbook.recipeId);
  assert.notEqual(c.selected[0].recipeId,c.selected[0].notEquivalentWorkbookRecipeId);
  assert.deepEqual(c.selected.map((r:{recipeId:string})=>r.recipeId),['oatmeal_with_apple','pear_almonds']);
});
test('input grams agree with parent sources but cannot be promoted to measured yield or servings',()=>{
  const oat=JSON.parse(read(c.sourcePackages[0].path).toString());
  const pear=JSON.parse(read(c.sourcePackages[1].path).toString());
  assert.deepEqual(c.selected[0].inputComponents.map((r:{grams:string})=>Number(r.grams)),oat.recipe.ingredients.map((r:{amount_g:number})=>r.amount_g));
  assert.deepEqual(c.selected[1].inputComponents.map((r:{grams:string})=>Number(r.grams)),pear.ingredients.map((r:{inputEdibleGrams:string})=>Number(r.inputEdibleGrams)));
  for(const row of c.selected){
    assert.equal(row.inputComponents.reduce((n:number,r:{grams:string})=>n+Number(r.grams),0),Number(row.inputMassSumG));
    assert.equal(row.measuredFinishedYieldG,null);assert.equal(row.measuredServedMassG,null);assert.equal(row.confirmedServings,null);
    assert.equal(row.sourceDeclaredServings,1);assert.equal(row.runtimePublishable,false);
    assert.ok(row.remainingReview.includes('CONFIRMED_PORTION_POLICY'));
  }
});
test('raw/cooked egg conflict retains official record distinction without assigning cooked mass or replacing source',()=>{
  const source=c.eggConflictSource;const bytes=read(source.capturePath);
  assert.equal(createHash('sha256').update(bytes).digest('hex'),source.captureSha256);
  assert.match(bytes.toString(),/NDB 01123, Egg, whole, raw, fresh/);
  assert.match(bytes.toString(),/NDB 01129, Egg, whole, cooked, hard-boiled/);
  assert.match(bytes.toString(),/Energy kcal: 143/);assert.match(bytes.toString(),/Energy kcal: 155/);
  assert.equal(source.rawPdfPageOneBased,402);assert.equal(source.cookedPdfPageOneBased,384);
  for(const held of c.heldCandidates){
    assert.equal(held.status,'HOLD_RAW_COOKED_REFERENCE_CONFLICT');assert.equal(held.automaticSourceReplacement,false);
    assert.equal(held.measuredCookedEggMassG,null);assert.equal(held.sourceReferenceEggMassG,'100');
    assert.equal(held.requiredState,'HARD_BOILED_EDIBLE');assert.equal(held.workbookEggReferencePer100G.calories,'143');
    assert.ok(!c.selected.some((r:{recipeId:string})=>r.recipeId===held.recipeId));
  }
});
test('a two-recipe review batch never claims weekly coverage, approval, publication or activation',()=>{
  assert.equal(c.status,'PREPARATION_NOT_APPROVED');assert.equal(c.weeklyCatalogReady,false);
  assert.equal(c.generatorActivated,false);assert.equal(c.sourceWorkbookModified,false);assert.equal(c.databaseModified,false);
  for(const row of c.selected){
    assert.ok(row.remainingReview.includes('INDEPENDENT_FOOD_NONFOOD_EVIDENCE'));
    assert.ok(row.remainingReview.includes('RECIPE_PUBLICATION_AND_MANIFEST'));
    assert.ok(row.remainingReview.includes('ALLERGEN_DIETARY_COMPOSITION_REVIEW'));
  }
});
