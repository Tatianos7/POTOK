import assert from 'node:assert/strict';
import test from 'node:test';
import {createHash} from 'node:crypto';
import {buildGreekSnackDeclaredModelV1,readGreekSnackModelEvidenceV1,diagnoseAuthoringCategoryCapacityV1,runGreekSnackInputModelV1} from './greek-snack-input-model-v1';
import {previewRecipeAuthoringWeekV1,type AuthoringWeekScenarioV1,type AuthoringSearchCatalogV1} from '../../src/dev/authoringWeekSearchV1';
import {decodeReviewedRuntimeRecipePublicationEvidenceRawV1} from '../../src/utils/reviewedRuntimeRecipePublicationEvidenceV1';
const hash=(s:string)=>createHash('sha256').update(s).digest('hex');
const canonical=(v:unknown):string=>v!==null&&typeof v==='object'?(Array.isArray(v)?'['+v.map(canonical).join(',')+']':'{'+Object.keys(v).sort().map(k=>JSON.stringify(k)+':'+canonical((v as Record<string,unknown>)[k])).join(',')+'}'):JSON.stringify(v);
function fixture(){
  const recipes=['greek_yogurt_apple','greek_yogurt_banana'].map(id=>({recipeId:id,name:'Synthetic '+id,sourceStatus:'READY_FOR_REVIEW',
    sourceRecipe:{recipe_id:id,meal_type_primary:'SNACK',owner_notes:'SYNTHETIC_PRIVATE_NOTE'},declaredServings:1,
    declaredYieldG:null,measuredYieldG:null,confirmedServings:null,physicalReview:'DEFERRED_UNTIL_OWNER_PRELAUNCH_TESTING',
    referenceNutrition:{basis:'SOURCE_DECLARED_PER_SERVING',verified:false,carbohydrateSemantics:'UNVERIFIED_SOURCE_REFERENCE',
      values:{calories:999,protein:999,fat:999,carbs:999,fiber:999}},
    ingredients:[1,2].map(i=>({ingredient_row_id:id+'_ing_0'+i,recipe_id:id,sort_order:i,ingredient_name_ru:'Synthetic ingredient',
      amount:100,unit:'G',weight_g:100,optional:false,preparation_note:'SYNTHETIC_PREPARATION',notes:'SYNTHETIC_PRIVATE_NOTE',food_stable_id:null,canonical_status:'UNRESOLVED'})),
    steps:[{step_id:id+'_step',recipe_id:id,step_number:1,instruction_ru:'SYNTHETIC_PRIVATE_STEP',duration_min:null,temperature_c:null,notes:null}],
    numericReferenceTestInputAvailable:true,sourceTagsAreVerifiedRestrictions:false,runtimePublishable:false}));
  const catalog={contract:'potok-recipe-authoring-test-catalog-v1',usage:'OFFLINE_AUTHORING_TEST_INPUT_ONLY',runtimePublishable:false,mayActivate:false,
    referenceNutritionMustNotBePresentedAsVerified:true,physicalCookingBlocksDevelopment:false,
    source:{fileName:'synthetic.xlsx',sha256:'a'.repeat(64),bytes:1},recipes};
  const evidence=readGreekSnackModelEvidenceV1();
  function bind(){const review=JSON.parse(evidence.reviewRaw);for(const recipe of recipes)for(const row of recipe.ingredients){
    const a=review.rows.find((a:{ingredientRowId:string})=>a.ingredientRowId===row.ingredient_row_id);
    a.sourceAuthoringRowSha256=hash(canonical(row));a.recipeContextSha256=hash(canonical({sourceRecipe:recipe.sourceRecipe,steps:recipe.steps}));
  }evidence.reviewRaw=JSON.stringify(review);}
  bind();return {catalog,evidence,bind};
}
const build=(f:ReturnType<typeof fixture>)=>buildGreekSnackDeclaredModelV1(JSON.stringify(f.catalog),f.evidence);

test('all four bound rows have source models, fruit review completes but original dairy choice stays blocked',()=>{
  const f=fixture(),before=JSON.stringify(f.catalog),result=build(f);
  assert.equal(result.declaredFruitRowsReviewed,2);assert.equal(result.conditionalCompleteInputModels,2);assert.equal(result.originalCompleteRecipeVectors,0);
  assert.equal(result.selectedOption,null);assert.equal(result.ownerDecision,null);
  for(const r of result.recipes){assert.equal(r.rows.length,2);assert.equal(r.originalDeclaredRecipe.wholeInput,null);
    assert.deepEqual(r.originalDeclaredRecipe.blockedRowIds,[r.recipeId+'_ing_01']);assert.equal(r.conditionalClassScenario.selectionStatus,'UNSELECTED_CLASS_MODEL_ONLY');
    assert.equal(r.measuredYieldG,null);assert.equal(r.confirmedServings,null);assert.equal(r.sourceApproved,false);assert.equal(r.runtimePublishable,false);}
  assert.equal(JSON.stringify(f.catalog),before);assert.deepEqual(build(f),result);
});
test('complete arithmetic reuses primary calories, subtracts same-source fiber once, never reapplies fruit refuse',()=>{
  const result=build(fixture()),apple=result.recipes[0],banana=result.recipes[1];
  assert.deepEqual(apple.conditionalClassScenario.calculation.wholeInput,{calories:'125.00000000',protein:'10.21000000',fat:'2.09000000',carbs:'15.35000000',fiber:'2.40000000'});
  assert.deepEqual(banana.conditionalClassScenario.calculation.wholeInput,{calories:'162.00000000',protein:'11.04000000',fat:'2.25000000',carbs:'24.18000000',fiber:'2.60000000'});
  assert.equal(apple.originalReferenceNutrition.calories,999);assert.equal(apple.beforeAvailableCarbohydrateG,null);assert.equal(apple.carbohydrateDelta,null);
  assert.equal(apple.rows[1].input.grams,'100');assert.equal(banana.rows[1].input.grams,'100');
});
test('row/context drift, wrong recipe, missing/duplicate review rows and source/class substitutions fail',()=>{
  for(const mutate of [
    (f:ReturnType<typeof fixture>)=>{f.catalog.recipes[0].ingredients[1].preparation_note+=' changed';},
    (f:ReturnType<typeof fixture>)=>{f.catalog.recipes[0].steps[0].instruction_ru+=' peeled instead';},
    (f:ReturnType<typeof fixture>)=>{const r=JSON.parse(f.evidence.reviewRaw);r.rows[0].recipeId='other';f.evidence.reviewRaw=JSON.stringify(r);},
    (f:ReturnType<typeof fixture>)=>{const r=JSON.parse(f.evidence.reviewRaw);r.rows.pop();f.evidence.reviewRaw=JSON.stringify(r);},
    (f:ReturnType<typeof fixture>)=>{const r=JSON.parse(f.evidence.reviewRaw);r.rows[1]=r.rows[0];f.evidence.reviewRaw=JSON.stringify(r);},
    (f:ReturnType<typeof fixture>)=>{const r=JSON.parse(f.evidence.reviewRaw);r.classOptions[1].sourceRecord='PLAIN_ORDINARY_YOGURT';f.evidence.reviewRaw=JSON.stringify(r);}
  ]){const f=fixture();mutate(f);assert.throws(()=>build(f));}
});
test('missing mass/ML/pieces and mismatched gram amount cannot produce a complete input model',()=>{
  for(const mutation of ['ML','PIECE','MASS']){
    const f=fixture();if(mutation==='MASS')f.catalog.recipes[0].ingredients[0].weight_g=99;else f.catalog.recipes[0].ingredients[0].unit=mutation;
    f.bind();const r=build(f);assert.equal(r.recipes[0].conditionalClassScenario.calculation.wholeInput,null);assert.equal(r.conditionalCompleteInputModels,1);
  }
});
test('unknown declared servings never become one serving or a per-serving calculation',()=>{
  const f=fixture();Object.assign(f.catalog.recipes[0],{declaredServings:null});f.bind();const r=build(f);
  assert.equal(r.recipes[0].declaredServings,null);assert.equal(r.recipes[0].conditionalClassScenario.calculation.perDeclaredServing,null);
  assert.equal(r.conditionalCompleteInputModels,1);assert.equal(r.recipes[0].confirmedServings,null);
});
test('primary byte drift, absent fiber and rehashed changed nutrients cannot create source sufficiency',()=>{
  const capture='docs/premium/retained-sources/pilot-source-stage-20261104/sr28-ascii-capture-v1.json';
  const stale=fixture();stale.evidence.materials[capture]+=' ';assert.throws(()=>build(stale));
  for(const replacement of [null,'1']){
    const f=fixture(),c=JSON.parse(f.evidence.materials[capture]);c.records.find((r:{ndb:string})=>r.ndb==='01287').factsPer100GEdible.fiber=replacement;
    f.evidence.materials[capture]=JSON.stringify(c);const review=JSON.parse(f.evidence.reviewRaw);
    review.sourceMaterials.find((m:{path:string})=>m.path===capture).sha256=hash(f.evidence.materials[capture]);f.evidence.reviewRaw=JSON.stringify(review);
    assert.throws(()=>build(f));
  }
});
test('approval, owner-choice, widened row mapping and duplicate JSON fields are rejected',()=>{
  for(const mutate of [
    (r:Record<string,unknown>)=>{r.selectedOption='MODEL_USDA_SR28_01287_PLAIN_LOWFAT';},
    (r:Record<string,unknown>)=>{r.ownerDecision='APPROVED';},
    (r:Record<string,unknown>)=>{r.sourceApproved=true;},
    (r:Record<string,unknown>)=>{delete r.runtimePublishable;},
    (r:Record<string,unknown>)=>{(r.rows as Record<string,unknown>[])[0].foodSpecificMappingApproved=true;}
  ]){const f=fixture(),r=JSON.parse(f.evidence.reviewRaw);mutate(r);f.evidence.reviewRaw=JSON.stringify(r);assert.throws(()=>build(f));}
  const f=fixture();f.evidence.reviewRaw='{"contract":1,"contract":2}';assert.throws(()=>build(f));
  assert.throws(()=>runGreekSnackInputModelV1('{}','{}'));
});
const scenario:AuthoringWeekScenarioV1={contract:'potok-authoring-week-scenario-v1',weekStart:'2026-11-02',dailyCalorieTarget:1600,tolerancePercent:10,
  slots:[{label:'Breakfast',sourceCategories:['BREAKFAST'],targetSharePercent:25},{label:'Lunch',sourceCategories:['LUNCH'],targetSharePercent:30},
    {label:'Dinner test',sourceCategories:['LUNCH'],targetSharePercent:30},{label:'Snack',sourceCategories:['SNACK'],targetSharePercent:15}],
  rankedCandidatePoolSize:12,shortlistPerSlot:4,dayPoolSize:4,maxDayEvaluations:256,maxWeekEvaluations:1024,maxRecipeUses:2};
const pool=():AuthoringSearchCatalogV1=>({contract:'potok-recipe-authoring-test-catalog-v1',runtimePublishable:false,source:{fileName:'synthetic',sha256:'a'.repeat(64),bytes:1},
  recipes:['one','two'].map(recipeId=>({recipeId,name:recipeId,sourceStatus:'READY_FOR_REVIEW',declaredServings:1,numericReferenceTestInputAvailable:true,
    sourceRecipe:{meal_type_primary:'SNACK'},referenceNutrition:{values:{calories:240,protein:10,fat:2,carbs:30,fiber:2}}}))});
test('actual two-snack search cannot fabricate breakfast/main meals or bypass the weekly repeat limit',()=>{
  const r=previewRecipeAuthoringWeekV1(pool(),scenario);assert.equal(r.status,'INCOMPLETE_CATEGORY_POOL');assert.deepEqual(r.days,[]);
  const snackOnly={...scenario,dailyCalorieTarget:240,slots:[{label:'Snack',sourceCategories:['SNACK'],targetSharePercent:100}]};
  const short=previewRecipeAuthoringWeekV1(pool(),snackOnly);assert.equal(short.status,'NO_REFERENCE_WEEK_IN_RETAINED_POOL');assert.deepEqual(short.days,[]);
});
test('category capacity groups both main-meal slots and keeps recipe count separate from portions',()=>{
  const c=diagnoseAuthoringCategoryCapacityV1(pool(),scenario);
  assert.deepEqual(c.map(g=>[g.sourceCategories[0],g.requiredMealSlots,g.availableDistinctRecipes,g.minimumRecipes,g.additionalRecipesLowerBound]),
    [['BREAKFAST',7,0,4,4],['LUNCH',14,0,7,7],['SNACK',7,2,4,2]]);
  const p=pool();p.recipes[1].sourceStatus='BLOCKED';assert.equal(diagnoseAuthoringCategoryCapacityV1(p,scenario)[2].availableDistinctRecipes,1);
  assert.throws(()=>diagnoseAuthoringCategoryCapacityV1(p,{...scenario,maxRecipeUses:0}));
});
test('conditional model and forged flags never pass the real runtime publication decoder; no private bodies in output',async()=>{
  const r=build(fixture());for(const value of [r,{...r,sourceApproved:true,runtimePublishable:true,mayActivate:true}]){
    const raw=JSON.stringify(value);assert.ok(!raw.includes('SYNTHETIC_PRIVATE_'));assert.ok(!raw.includes('SYNTHETIC_PREPARATION'));
    await assert.rejects(decodeReviewedRuntimeRecipePublicationEvidenceRawV1(raw,raw),/REVIEWED_PUBLICATION_FIELDS_INVALID/);
  }
});
