import assert from 'node:assert/strict';
import test from 'node:test';
import {boundedCartesianIndexesV1} from '../../src/utils/boundedCartesianIndexesV1';
import {recipeMasterSheetsV1} from './recipe-master-readiness-v1';
import {buildRecipeAuthoringTestCatalogV1} from './recipe-authoring-test-catalog-v1';
import {evenlySpacedPairIndexesV1} from '../../src/dev/authoringWeekSearchV1';
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
test('bounded macro pair search samples across the full candidate grid without duplicates',()=>{
  const sample=evenlySpacedPairIndexesV1(64,64,1024);
  assert.equal(sample.length,1024);assert.deepEqual(sample,evenlySpacedPairIndexesV1(64,64,1024));
  assert.equal(new Set(sample.map(([a,b])=>`${a}:${b}`)).size,sample.length);
  assert.deepEqual([...new Set(sample.map(([a])=>a))],[...Array(64).keys()]);
  assert.deepEqual([...new Set(sample.map(([,b])=>b))],[...Array(64).keys()]);
  assert.deepEqual(evenlySpacedPairIndexesV1(3,2,99).map(([a,b])=>`${a}:${b}`).sort(),['0:0','0:1','1:0','1:1','2:0','2:1']);
  for(const [a,b,limit] of [[0,1,1],[1,129,1],[1,1,0],[1,1,8193]])
    assert.throws(()=>evenlySpacedPairIndexesV1(a,b,limit),/PAIR_SEARCH_BOUNDS/);
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

test('whole-serving refinement finds closer days outside initial shortlist without losing repeat/diversity limits',()=>{
  const x=fixture(16);x.scenario.dailyCalorieTarget=1800;
  for(const r of x.catalog.recipes){
    const category=r.sourceRecipe.meal_type_primary;
    r.referenceNutrition.values.calories=category==='BREAKFAST'?400:category==='SNACK'?300:500;
    if(category==='LUNCH'&&Number(r.recipeId.split('_')[1])>=12)r.referenceNutrition.values.calories=600;
  }
  const before=JSON.stringify(x),r=previewRecipeAuthoringWeekV1(x.catalog,x.scenario);
  assert.equal(r.status,'REFERENCE_WEEK_PREVIEW');assert.ok('calorieRefinement' in r);
  const refinement=r.calorieRefinement!;assert.ok(refinement.changes>0);assert.equal(refinement.sourcePortionScaling,false);
  assert.equal(r.scope,'CALORIE_REFINED_REFERENCE_WEEK');
  const uses=new Map<string,number>();
  r.days.forEach((d,i)=>{
    assert.ok(Math.abs(Number(d.referenceNutrition.calories)-1800)<=Math.abs(Number(refinement.beforeDailyCalories[i])-1800));
    assert.equal(new Set(d.meals.map(m=>m.recipeId)).size,4);
    for(const m of d.meals){assert.equal(m.assignedSourceServings,1);assert.equal(m.measuredGrams,null);assert.equal(m.verified,false);uses.set(m.recipeId,(uses.get(m.recipeId)??0)+1);}
  });
  assert.ok(r.days.some(d=>Number(d.referenceNutrition.calories)===1800));
  assert.ok([...uses.values()].every(n=>n<=2));assert.ok(uses.size>=refinement.preservesMinimumDistinctRecipes);
  assert.ok(refinement.evaluatedCandidates<=7*refinement.limits.passes*refinement.limits.candidatesPerDayPerPass);
  assert.ok(refinement.balanceEvaluated<=refinement.limits.balanceCandidates);
  assert.equal(JSON.stringify(x),before);
  assert.deepEqual(previewRecipeAuthoringWeekV1({...x.catalog,recipes:[...x.catalog.recipes].reverse()},x.scenario),r);
});

test('refinement never admits blocked or incomplete reference candidates to fill calories',()=>{
  for(const blocked of [true,false]){
    const x=fixture(16);x.scenario.dailyCalorieTarget=1800;
    for(const r of x.catalog.recipes){
      const category=r.sourceRecipe.meal_type_primary;r.referenceNutrition.values.calories=category==='BREAKFAST'?400:category==='SNACK'?300:500;
      if(category==='LUNCH'&&Number(r.recipeId.split('_')[1])>=12){r.referenceNutrition.values.calories=600;if(blocked)r.sourceStatus='BLOCKED';else r.numericReferenceTestInputAvailable=false;}
    }
    const r=previewRecipeAuthoringWeekV1(x.catalog,x.scenario);assert.equal(r.status,'REFERENCE_WEEK_PREVIEW');
    assert.ok(r.days.every(d=>d.referenceNutrition.calories==='1700.000'));
    assert.equal(r.runtimePublishable,false);assert.equal(r.mayActivate,false);
  }
});
