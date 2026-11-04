import assert from 'node:assert/strict';
import test from 'node:test';
import {recipeMasterSheetsV1} from './recipe-master-readiness-v1';
import {buildRecipeAuthoringTestCatalogV1} from './recipe-authoring-test-catalog-v1';
import {buildRecipePilotReviewPacketV1} from './recipe-pilot-review-packet-v1';
function fixture(){
  const s:Record<string,Record<string,unknown>[]>=Object.fromEntries(recipeMasterSheetsV1.map(n=>[n,[]]));
  s['01_Рецепты']=['one','two'].map(recipe_id=>({recipe_id,name_ru:recipe_id,status:'READY_FOR_REVIEW',servings:1,
    ref_kcal_per_serving:100,ref_protein_g:5,ref_fat_g:3,ref_carbs_g:10,ref_fiber_g:0,meal_type_primary:'LUNCH'}));
  s['02_Ингредиенты']=['one','two'].map(recipe_id=>({recipe_id,ingredient_row_id:recipe_id+'_i',ingredient_name_ru:'Same name',
    weight_g:recipe_id==='one'?null:10,optional:recipe_id==='one',preparation_note:recipe_id==='one'?'dry':'cooked',canonical_status:'UNRESOLVED',food_stable_id:null}));
  const catalog={...buildRecipeAuthoringTestCatalogV1(s),source:{fileName:'synthetic.xlsx',sha256:'a'.repeat(64),bytes:10}};
  const selection={contract:'potok-recipe-pilot-selection-v1',workbookSha256:catalog.source.sha256,origin:'Synthetic offline selection',recipeIds:['two','one']};
  return {catalog,selection};
}
test('review packet preserves full original rows, explicit selection order and unknowns without authority',()=>{
  const {catalog,selection}=fixture(),raw=JSON.stringify(catalog),packet=buildRecipePilotReviewPacketV1(raw,JSON.stringify(selection));
  assert.equal(JSON.stringify(catalog),raw);assert.deepEqual(packet.recipes.map(r=>r.recipeId),['two','one']);
  assert.equal(packet.summary.selectedRecipes,2);assert.equal(packet.summary.missingRecordedIngredientGrams,1);
  assert.equal(packet.summary.numericReferenceInputs,2);assert.deepEqual(packet.summary.sourcePrimaryMealCategories,{LUNCH:2});
  assert.equal(packet.ingredientReviewQueue.entries.length,1); // Name grouping never resolves different states.
  assert.equal(packet.recipes[1].ingredients[0].preparation_note,'dry');assert.equal(packet.recipes[1].ingredients[0].optional,true);
  assert.equal(packet.recipes[1].ingredients[0].weight_g,null);assert.equal(packet.recipes[0].measuredYieldG,null);
  assert.equal(packet.runtimePublishable,false);assert.equal(packet.mayActivate,false);assert.equal(packet.physicalCookingBlocksDevelopment,false);
  packet.recipes[0].ingredients[0].weight_g=99;assert.equal(catalog.recipes[1].ingredients[0].weight_g,10);
});
test('wrong workbook, absent or duplicate selection and duplicate JSON keys cannot silently shrink coverage',()=>{
  for(const change of [(s:ReturnType<typeof fixture>['selection'])=>{s.workbookSha256='b'.repeat(64);},
    (s:ReturnType<typeof fixture>['selection'])=>{s.recipeIds=['unknown'];},(s:ReturnType<typeof fixture>['selection'])=>{s.recipeIds=['one','one'];},
    (s:ReturnType<typeof fixture>['selection'])=>{s.recipeIds=[];}]){
    const {catalog,selection}=fixture();change(selection);assert.throws(()=>buildRecipePilotReviewPacketV1(JSON.stringify(catalog),JSON.stringify(selection)));
  }
  const {catalog}=fixture();assert.throws(()=>buildRecipePilotReviewPacketV1(JSON.stringify(catalog),'{"contract":1,"contract":2}'));
});
test('copied approval, nutrition, identity and readiness flags are rederived from authoring rows',()=>{
  for(const change of [(c:ReturnType<typeof fixture>['catalog'])=>{c.recipes[0].runtimePublishable=true;},
    (c:ReturnType<typeof fixture>['catalog'])=>{c.recipes[0].referenceNutrition.values.calories=500;},
    (c:ReturnType<typeof fixture>['catalog'])=>{c.recipes[0].recipeId='different';},
    (c:ReturnType<typeof fixture>['catalog'])=>{c.recipes[0].numericReferenceTestInputAvailable=false;}]){
    const {catalog,selection}=fixture();change(catalog);assert.throws(()=>buildRecipePilotReviewPacketV1(JSON.stringify(catalog),JSON.stringify(selection)),/SOURCE_OBSERVATION_MISMATCH/);
  }
});
