import assert from 'node:assert/strict';
import test from 'node:test';
import {createHash} from 'node:crypto';
import {applyGreekOwnerInputClassV1,readGreekOwnerInputClassRawV1,buildBalancedPilotReferencePoolV1,runGreekOwnerBalancedPoolV1} from './greek-owner-balanced-pool-v1';
import {buildGreekSnackDeclaredModelV1,readGreekSnackModelEvidenceV1} from './greek-snack-input-model-v1';
import type {AuthoringSearchCatalogV1,AuthoringWeekScenarioV1} from '../../src/dev/authoringWeekSearchV1';
import {decodeReviewedRuntimeRecipePublicationEvidenceRawV1} from '../../src/utils/reviewedRuntimeRecipePublicationEvidenceV1';
const hash=(s:string)=>createHash('sha256').update(s).digest('hex');
const canonical=(v:unknown):string=>v!==null&&typeof v==='object'?(Array.isArray(v)?'['+v.map(canonical).join(',')+']':'{'+Object.keys(v).sort().map(k=>JSON.stringify(k)+':'+canonical((v as Record<string,unknown>)[k])).join(',')+'}'):JSON.stringify(v);
function fixture(){
  const recipes=['greek_yogurt_apple','greek_yogurt_banana'].map(id=>({recipeId:id,name:'Synthetic '+id,sourceStatus:'READY_FOR_REVIEW',
    sourceRecipe:{recipe_id:id,meal_type_primary:'SNACK',owner_notes:'SYNTHETIC_PRIVATE_NOTE'},declaredServings:1,
    declaredYieldG:null,measuredYieldG:null,confirmedServings:null,physicalReview:'DEFERRED_UNTIL_OWNER_PRELAUNCH_TESTING',
    referenceNutrition:{basis:'SOURCE_DECLARED_PER_SERVING',verified:false,carbohydrateSemantics:'UNVERIFIED_SOURCE_REFERENCE',values:{calories:999,protein:999,fat:999,carbs:999,fiber:999}},
    ingredients:[1,2].map(i=>({ingredient_row_id:id+'_ing_0'+i,recipe_id:id,sort_order:i,ingredient_name_ru:'Synthetic',amount:100,unit:'G',weight_g:100,
      optional:false,preparation_note:'SYNTHETIC_PREPARATION',notes:'SYNTHETIC_PRIVATE_NOTE',food_stable_id:null,canonical_status:'UNRESOLVED'})),
    steps:[{step_id:id+'_step',recipe_id:id,step_number:1,instruction_ru:'SYNTHETIC_PRIVATE_STEP',duration_min:null,temperature_c:null,notes:null}],
    numericReferenceTestInputAvailable:true,sourceTagsAreVerifiedRestrictions:false,runtimePublishable:false}));
  const catalog={contract:'potok-recipe-authoring-test-catalog-v1',usage:'OFFLINE_AUTHORING_TEST_INPUT_ONLY',runtimePublishable:false,mayActivate:false,
    referenceNutritionMustNotBePresentedAsVerified:true,physicalCookingBlocksDevelopment:false,source:{fileName:'synthetic',sha256:'a'.repeat(64),bytes:1},recipes};
  const e=readGreekSnackModelEvidenceV1(),review=JSON.parse(e.reviewRaw),owner=JSON.parse(readGreekOwnerInputClassRawV1());
  for(const r of recipes)for(const row of r.ingredients){
    const a=review.rows.find((a:{ingredientRowId:string})=>a.ingredientRowId===row.ingredient_row_id);
    a.sourceAuthoringRowSha256=hash(canonical(row));a.recipeContextSha256=hash(canonical({sourceRecipe:r.sourceRecipe,steps:r.steps}));
    const o=owner.rows.find((o:{ingredientRowId:string})=>o.ingredientRowId===row.ingredient_row_id);if(o){o.sourceAuthoringRowSha256=a.sourceAuthoringRowSha256;o.recipeContextSha256=a.recipeContextSha256;}
  }
  e.reviewRaw=JSON.stringify(review);owner.priorReviewSha256=hash(e.reviewRaw);
  return {prior:buildGreekSnackDeclaredModelV1(JSON.stringify(catalog),e),reviewRaw:e.reviewRaw,owner};
}
const apply=(f:ReturnType<typeof fixture>)=>applyGreekOwnerInputClassV1(f.prior,f.reviewRaw,JSON.stringify(f.owner));
test('owner ingredient intent updates exactly two reviews and preserves original history/calculations',()=>{
  const f=fixture(),before=JSON.stringify(f),r=apply(f);
  assert.equal(r.ownerConfirmedRows,2);assert.equal(r.admittedRecipes,0);assert.equal(r.sourceApprovals,0);
  for(const x of r.recipes){assert.equal(x.intendedClassStatus,'OWNER_CONFIRMED');assert.equal(x.intendedIngredientClass.nominalFatPercent,'2');
    assert.equal(x.intendedIngredientClass.flavor,'PLAIN_UNSWEETENED');assert.equal(x.intendedIngredientClass.mandatoryBrand,null);
    assert.equal(x.numericSourceApplicability,'PENDING_INDEPENDENT_REVIEW');assert.equal(x.completeAdmittedRecipeNutrition,null);
    assert.equal(x.conditionalReferenceModel.sourceMappingApproved,false);assert.equal(x.measuredYieldG,null);}
  assert.deepEqual(r.recipes.map(r=>r.conditionalReferenceModel.calculation),f.prior.recipes.map(r=>r.conditionalClassScenario.calculation));
  assert.equal(JSON.stringify(f),before);assert.deepEqual(apply(f),r);assert.equal(f.prior.selectedOption,null);
});
test('owner choice cannot widen scope, change fat/flavor/brand, substitute a row/context or infer source admission',()=>{
  for(const mutate of [
    (f:ReturnType<typeof fixture>)=>{f.owner.scope='ALL_RECIPES';},
    (f:ReturnType<typeof fixture>)=>{f.owner.ingredientClass.nominalFatPercent='1.92';},
    (f:ReturnType<typeof fixture>)=>{f.owner.ingredientClass.family='ORDINARY_YOGURT';},
    (f:ReturnType<typeof fixture>)=>{f.owner.ingredientClass.flavor='SWEETENED';},
    (f:ReturnType<typeof fixture>)=>{f.owner.ingredientClass.mandatoryBrand='EXAMPLE';},
    (f:ReturnType<typeof fixture>)=>{f.owner.sourceApproved=true;},
    (f:ReturnType<typeof fixture>)=>{f.owner.foodSpecificMappingApproved=true;},
    (f:ReturnType<typeof fixture>)=>{f.owner.universalRetail2PercentEquivalence=true;},
    (f:ReturnType<typeof fixture>)=>{f.owner.rows[0].ingredientRowId='another';},
    (f:ReturnType<typeof fixture>)=>{f.owner.rows[0].recipeContextSha256='a'.repeat(64);},
    (f:ReturnType<typeof fixture>)=>{f.owner.rows[0]=f.owner.rows[1];},
    (f:ReturnType<typeof fixture>)=>{f.owner.rows.pop();},
    (f:ReturnType<typeof fixture>)=>{f.reviewRaw+=' ';},
    (f:ReturnType<typeof fixture>)=>{f.owner.issueReceipt=true;}
  ]){const f=fixture();mutate(f);assert.throws(()=>apply(f));}
  const f=fixture();assert.throws(()=>applyGreekOwnerInputClassV1(f.prior,f.reviewRaw,'{"contract":1,"contract":2}'));
});
const scenario:AuthoringWeekScenarioV1={contract:'potok-authoring-week-scenario-v1',weekStart:'2026-11-02',dailyCalorieTarget:1600,tolerancePercent:10,
  slots:[{label:'Breakfast',sourceCategories:['BREAKFAST'],targetSharePercent:25},{label:'Lunch',sourceCategories:['LUNCH'],targetSharePercent:30},
    {label:'Dinner test',sourceCategories:['LUNCH'],targetSharePercent:30},{label:'Snack',sourceCategories:['SNACK'],targetSharePercent:15}],
  rankedCandidatePoolSize:12,shortlistPerSlot:4,dayPoolSize:4,maxDayEvaluations:256,maxWeekEvaluations:1024,maxRecipeUses:2};
function pool(){
  const catalog:AuthoringSearchCatalogV1={contract:'potok-recipe-authoring-test-catalog-v1',runtimePublishable:false,
    source:{fileName:'synthetic',sha256:'a'.repeat(64),bytes:1},recipes:[]};
  for(const [category,count,kcal] of [['BREAKFAST',6,400],['LUNCH',12,480],['SNACK',6,240]] as const)
    for(let n=0;n<count;n++)catalog.recipes.push({recipeId:category+n,name:'Synthetic '+category+n,sourceStatus:'READY_FOR_REVIEW',declaredServings:1,
      numericReferenceTestInputAvailable:true,sourceRecipe:{meal_type_primary:category},referenceNutrition:{values:{calories:kcal,protein:10,fat:5,carbs:30,fiber:2}}});
  return {catalog,priorities:catalog.recipes.map(r=>({recipeId:r.recipeId,rowsWithoutCompleteConditionalVector:3,conditionalModelAvailable:r.recipeId==='SNACK0'||r.recipeId==='SNACK1'}))};
}
test('balanced reference work pool has all categories, keeps two conditional snacks and never mixes vectors',()=>{
  const f=pool(),before=JSON.stringify(f),r=buildBalancedPilotReferencePoolV1(f.catalog,scenario,f.priorities);
  assert.equal(r.initialNecessaryPoolSize,15);assert.ok(r.selectedPoolSize>=15&&r.selectedPoolSize<=24);
  assert.ok(r.initialRecipeIds.includes('SNACK0'));assert.ok(r.initialRecipeIds.includes('SNACK1'));
  assert.deepEqual(r.selectedPoolCapacity.map(g=>g.minimumRecipes),[4,7,4]);
  assert.ok(r.attempts.length<=10);assert.equal(r.originalReferencesRecomputed,false);assert.equal(r.conditionalVectorsMixedIntoReferenceTotals,false);
  assert.equal(JSON.stringify(f),before);assert.deepEqual(buildBalancedPilotReferencePoolV1(f.catalog,scenario,f.priorities),r);
  assert.equal(r.actualReferenceSearch.status,'REFERENCE_WEEK_PREVIEW');assert.equal(r.actualReferenceSearch.days.length,7);
  const uses=new Map<string,number>();for(const d of r.actualReferenceSearch.days){assert.equal(d.meals.length,4);assert.equal(d.referenceNutrition.calories,'1600.000');
    assert.equal(new Set(d.meals.map(m=>m.recipeId)).size,4);for(const m of d.meals){assert.equal(m.measuredGrams,null);assert.equal(m.assignedSourceServings,1);uses.set(m.recipeId,(uses.get(m.recipeId)??0)+1);}}
  assert.ok([...uses.values()].every(n=>n<=2));
});
test('missing categories/low budgets do not cause fallback, extra portions, invented foods or global infeasibility claims',()=>{
  const f=pool(),small={...scenario,maxWeekEvaluations:1};const limited=buildBalancedPilotReferencePoolV1(f.catalog,small,f.priorities);
  assert.ok(limited.attempts.length<=10);assert.equal(limited.actualReferenceSearch.scenario.maxWeekEvaluations,1);
  assert.equal(limited.actualReferenceSearch.scenario.maxRecipeUses,2);
  const c={...f.catalog,recipes:f.catalog.recipes.filter(r=>r.sourceRecipe.meal_type_primary==='SNACK')};
  const absent=buildBalancedPilotReferencePoolV1(c,scenario,f.priorities.filter(p=>c.recipes.some(r=>r.recipeId===p.recipeId)));
  assert.equal(absent.actualReferenceSearch.status,'INCOMPLETE_CATEGORY_POOL');assert.deepEqual(absent.actualReferenceSearch.days,[]);
});
test('stale priorities, ambiguous category groups, duplicate recipes and wider-than-pilot inputs reject',()=>{
  const f=pool();assert.throws(()=>buildBalancedPilotReferencePoolV1(f.catalog,scenario,f.priorities.slice(1)));
  assert.throws(()=>buildBalancedPilotReferencePoolV1({...f.catalog,recipes:[...f.catalog.recipes,f.catalog.recipes[0]]},scenario,f.priorities));
  assert.throws(()=>buildBalancedPilotReferencePoolV1({...f.catalog,recipes:[f.catalog.recipes[1],...f.catalog.recipes.slice(1)]},scenario,f.priorities));
  assert.throws(()=>buildBalancedPilotReferencePoolV1(f.catalog,{...scenario,slots:scenario.slots.map((slot,i)=>i===2?{...slot,sourceCategories:['LUNCH','SNACK']}:slot)},f.priorities));
  assert.throws(()=>buildBalancedPilotReferencePoolV1(f.catalog,scenario,f.priorities.map(p=>({...p,rowsWithoutCompleteConditionalVector:-1}))));
});
test('owner/class and reference-work-pool outputs remain rejected by actual runtime publication decoder',async()=>{
  const f=pool(),o=apply(fixture()),p=buildBalancedPilotReferencePoolV1(f.catalog,scenario,f.priorities);
  for(const v of [o,p,{...o,sourceApproved:true,runtimePublishable:true,mayActivate:true}]){
    const raw=JSON.stringify(v);await assert.rejects(decodeReviewedRuntimeRecipePublicationEvidenceRawV1(raw,raw));
  }
  assert.throws(()=>runGreekOwnerBalancedPoolV1('{}','{}'));
});
