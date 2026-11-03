import assert from 'node:assert/strict';
import test from 'node:test';
import {boundedCartesianIndexesV1} from '../../src/utils/boundedCartesianIndexesV1';
import {recipeMasterSheetsV1} from './recipe-master-readiness-v1';
import {buildRecipeAuthoringTestCatalogV1} from './recipe-authoring-test-catalog-v1';
import {previewRecipeAuthoringWeekV1,type AuthoringWeekScenarioV1} from './recipe-authoring-week-preview-v1';
function fixture(count=12){
  const sheets:Record<string,Record<string,unknown>[]>=Object.fromEntries(recipeMasterSheetsV1.map(n=>[n,[]]));
  for(const [category,kcal] of [['BREAKFAST',500],['LUNCH',600],['SNACK',300]] as const)for(let n=0;n<count;n++){
    const id=category+'_'+n;sheets['01_Рецепты'].push({recipe_id:id,name_ru:id,status:'READY_FOR_REVIEW',servings:2,total_weight_g:null,
      meal_type_primary:category,ref_kcal_per_serving:kcal,ref_protein_g:10,ref_fat_g:5,ref_carbs_g:30,ref_fiber_g:2});
    sheets['02_Ингредиенты'].push({recipe_id:id,ingredient_row_id:id+'_i',ingredient_name_ru:'Synthetic',weight_g:20,canonical_status:'UNRESOLVED'});
  }
  const catalog={...buildRecipeAuthoringTestCatalogV1(sheets),source:{fileName:'synthetic.xlsx',sha256:'a'.repeat(64),bytes:1}};
  const scenario:AuthoringWeekScenarioV1={contract:'potok-authoring-week-scenario-v1',weekStart:'2026-11-02',dailyCalorieTarget:2000,tolerancePercent:10,
    slots:[{label:'Breakfast',sourceCategories:['BREAKFAST'],targetSharePercent:25},{label:'Lunch',sourceCategories:['LUNCH'],targetSharePercent:30},
      {label:'Dinner test',sourceCategories:['LUNCH'],targetSharePercent:30},{label:'Snack',sourceCategories:['SNACK'],targetSharePercent:15}],
    rankedCandidatePoolSize:12,shortlistPerSlot:4,dayPoolSize:4,maxDayEvaluations:256,maxWeekEvaluations:1024,maxRecipeUses:2};
  return {catalog,scenario};
}
test('shared bounded Cartesian traversal visits exact order and budget without sharing mutable indexes',()=>{
  const counts=[2,2],iterator=boundedCartesianIndexesV1(counts,4);const first=iterator.next().value;
  counts[1]=16;assert.deepEqual(first,[0,0]);assert.ok(Object.isFrozen(first));
  assert.deepEqual([...iterator],[[0,1],[1,0],[1,1]]);
  assert.deepEqual([...boundedCartesianIndexesV1([2,2],3)],[[0,0],[0,1],[1,0]]);
  for(const [counts,budget] of [[[],1],[[0],1],[[17],1],[[1],0],[[1],1025]] as [number[],number][])
    assert.throws(()=>[...boundedCartesianIndexesV1(counts,budget)],/BOUNDS/);
});
test('offline seven-day experiment preserves whole reference portions, arithmetic, repeat caps and unknown grams',()=>{
  const x=fixture(),before=JSON.stringify(x),r=previewRecipeAuthoringWeekV1(x.catalog,x.scenario);
  assert.equal(r.status,'REFERENCE_WEEK_PREVIEW');assert.equal(r.days.length,7);
  const uses=new Map<string,number>();
  for(const day of r.days){
    assert.ok('meals' in day);assert.equal(day.meals.length,4);assert.equal(day.referenceNutrition.calories,'2000.000');
    assert.equal(day.referenceNutrition.protein,'40.000'); // Per-serving references were not divided by declared two servings.
    assert.equal(new Set(day.meals.map(m=>m.recipeId)).size,4);
    for(const meal of day.meals){assert.equal(meal.assignedSourceServings,1);assert.equal(meal.measuredGrams,null);assert.equal(meal.verified,false);uses.set(meal.recipeId,(uses.get(meal.recipeId)??0)+1);}
  }
  assert.ok([...uses.values()].every(n=>n<=2));assert.equal(r.runtimePublishable,false);assert.equal(r.mayActivate,false);
  assert.ok(r.notAssessed.includes('TRUSTED_PLAN_VALIDATION'));assert.equal(JSON.stringify(x),before);
  assert.deepEqual(previewRecipeAuthoringWeekV1({...x.catalog,recipes:[...x.catalog.recipes].reverse()},x.scenario),r);
});
test('strict DINNER mapping returns a category diagnostic and never silently reuses lunch',()=>{
  const x=fixture();x.scenario.slots[2].sourceCategories=['DINNER'];
  const r=previewRecipeAuthoringWeekV1(x.catalog,x.scenario);assert.equal(r.status,'INCOMPLETE_CATEGORY_POOL');assert.deepEqual(r.days,[]);
  assert.equal(r.poolCounts[2].fullReferenceCandidates,0);
});
test('bounded exhaustion differs from search prefix failure without relaxing repeat cap',()=>{
  const x=fixture(3);x.scenario.maxRecipeUses=1;x.scenario.maxWeekEvaluations=1;
  assert.equal(previewRecipeAuthoringWeekV1(x.catalog,x.scenario).status,'WEEK_SEARCH_LIMIT_REACHED');
  x.scenario.dayPoolSize=1;x.scenario.maxWeekEvaluations=1024;
  assert.equal(previewRecipeAuthoringWeekV1(x.catalog,x.scenario).status,'NO_REFERENCE_WEEK_IN_RETAINED_POOL');
});
test('invalid scenarios, duplicate recipe IDs and unknown numeric references are rejected',()=>{
  for(const patch of [{weekStart:'2026-02-30'},{maxWeekEvaluations:Infinity},{rankedCandidatePoolSize:0},{maxRecipeUses:0}]){
    const x=fixture();assert.throws(()=>previewRecipeAuthoringWeekV1(x.catalog,{...x.scenario,...patch}),/SCENARIO/);
  }
  const x=fixture();x.catalog.recipes.push(x.catalog.recipes[0]);assert.throws(()=>previewRecipeAuthoringWeekV1(x.catalog,x.scenario),/DUPLICATE/);
  const y=fixture();y.catalog.recipes[0].referenceNutrition.values.fiber=null;
  assert.throws(()=>previewRecipeAuthoringWeekV1(y.catalog,y.scenario),/REFERENCE_NUMBER/);
});
