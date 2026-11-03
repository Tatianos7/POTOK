import assert from 'node:assert/strict';
import test from 'node:test';
import {recipeMasterSheetsV1} from './recipe-master-readiness-v1';
import {buildRecipeAuthoringTestCatalogV1} from './recipe-authoring-test-catalog-v1';
function fixture(){
  const s:Record<string,Record<string,unknown>[]>=Object.fromEntries(recipeMasterSheetsV1.map(n=>[n,[]]));
  s['01_Рецепты']=[{recipe_id:'draft_recipe',name_ru:'Synthetic draft',status:'READY_FOR_REVIEW',servings:2,total_weight_g:null,
    ref_kcal_per_serving:123,ref_protein_g:4,ref_fat_g:5,ref_carbs_g:6,ref_fiber_g:0,meal_type_primary:'LUNCH'},
    {recipe_id:'example_one',status:'DRAFT'}];
  s['02_Ингредиенты']=[{ingredient_row_id:'i1',recipe_id:'draft_recipe',weight_g:70,canonical_status:'UNRESOLVED',food_stable_id:null,optional:true},
    {ingredient_row_id:'ex_i',recipe_id:'example_one'}];
  s['03_Шаги']=[{step_id:'s1',recipe_id:'draft_recipe',instruction:'Synthetic step'}];
  s['04_Теги']=[{recipe_id:'draft_recipe',tag_value:'UNVERIFIED_TAG'}];return s;
}
test('unknown cooking outcomes do not block reference inputs or become measured outcomes',()=>{
  const s=fixture(),before=JSON.stringify(s),r=buildRecipeAuthoringTestCatalogV1(s),one=r.recipes[0];
  assert.equal(r.summary.recipes,1);assert.equal(r.summary.excludedExamples,1);assert.equal(r.summary.numericReferenceTestInputs,1);
  assert.equal(one.numericReferenceTestInputAvailable,true);assert.equal(one.declaredServings,2);
  assert.equal(one.measuredYieldG,null);assert.equal(one.confirmedServings,null);assert.equal(one.declaredYieldG,null);
  assert.equal(one.referenceNutrition.values.calories,123); // Already per serving; never divide by two.
  assert.equal(one.referenceNutrition.values.fiber,0);assert.equal(one.referenceNutrition.verified,false);
  assert.equal(one.sourceTagsAreVerifiedRestrictions,false);assert.equal(one.runtimePublishable,false);
  assert.equal(r.physicalCookingBlocksDevelopment,false);assert.equal(r.mayActivate,false);assert.equal(JSON.stringify(s),before);
  assert.deepEqual(one.ingredients,[s['02_Ингредиенты'][0]]);assert.deepEqual(one.steps,s['03_Шаги']);
  one.ingredients[0].weight_g=99;assert.equal(s['02_Ингредиенты'][0].weight_g,70);
});
test('declared yield and APPROVED text cannot create physical or publication evidence',()=>{
  const s=fixture();Object.assign(s['01_Рецепты'][0],{total_weight_g:999,status:'APPROVED'});
  const r=buildRecipeAuthoringTestCatalogV1(s);assert.equal(r.recipes[0].declaredYieldG,999);
  assert.equal(r.recipes[0].measuredYieldG,null);assert.equal(r.runtimePublishable,false);
});
test('missing nutrients and servings remain unknown rather than zero or guessed portions',()=>{
  for(const missing of [null,undefined,'',-1,NaN,Infinity]){
    const s=fixture();s['01_Рецепты'][0].ref_fiber_g=missing;s['01_Рецепты'][0].servings=missing;
    const r=buildRecipeAuthoringTestCatalogV1(s);assert.equal(r.summary.numericReferenceTestInputs,0);
    assert.ok(r.recipes[0].referenceTestIssues.includes('REFERENCE_FIBER_MISSING_OR_INVALID'));
    assert.ok(r.recipes[0].referenceTestIssues.includes('DECLARED_SERVINGS_MISSING_OR_INVALID'));
    assert.equal(r.recipes[0].confirmedServings,null);
  }
});
test('explicit BLOCKED stays excluded and orphan or duplicate children fail instead of disappearing',()=>{
  const s=fixture();s['01_Рецепты'][0].status='BLOCKED';assert.equal(buildRecipeAuthoringTestCatalogV1(s).summary.numericReferenceTestInputs,0);
  for(const change of [(s:ReturnType<typeof fixture>)=>{s['03_Шаги'][0].recipe_id='missing';},
    (s:ReturnType<typeof fixture>)=>{s['03_Шаги'].push({...s['03_Шаги'][0]});},
    (s:ReturnType<typeof fixture>)=>{s['04_Теги'][0].recipe_id='missing';}]){
    const x=fixture();change(x);assert.throws(()=>buildRecipeAuthoringTestCatalogV1(x),/TEST_CATALOG_/);
  }
});
