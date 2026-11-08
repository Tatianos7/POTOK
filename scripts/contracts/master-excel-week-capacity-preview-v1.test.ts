import {strict as assert} from 'node:assert';
import {test} from 'node:test';
import * as XLSX from 'xlsx';
import {readMasterExcelCapacityInputsV1,previewMasterExcelWeekCapacityV1} from './master-excel-week-capacity-preview-v1';

function workbook(rows:Record<string,unknown>[]):Buffer{
 const wb=XLSX.utils.book_new();
 XLSX.utils.book_append_sheet(wb,XLSX.utils.json_to_sheet(rows),'01_Рецепты');
 return XLSX.write(wb,{bookType:'xlsx',type:'buffer'}) as Buffer;
}
const recipe=(recipe_id:string,meal_type_primary:string,ref_kcal_per_serving:number)=>({
 recipe_id,status:'READY_FOR_REVIEW',servings:1,meal_type_primary,ref_kcal_per_serving
});

test('master Excel bridge excludes demos and missing reference calories without inventing them',()=>{
 const parsed=readMasterExcelCapacityInputsV1(workbook([
  recipe('example_demo','BREAKFAST',200),
  recipe('real_breakfast','BREAKFAST',350),
  {...recipe('real_lunch','LUNCH',0)},
  {...recipe('real_snack','SNACK',150),servings:null}
 ]));
 assert.equal(parsed.authoringRecipes,4);
 assert.equal(parsed.usableRecipes,1);
 assert.deepEqual(parsed.recipes.map(r=>r.recipeId),['real_breakfast']);
 assert.deepEqual(parsed.excluded,{DEMONSTRATION:1,NO_REFERENCE_KCAL:1,NO_DECLARED_SERVINGS:1});
 assert.equal(parsed.runtimePublishable,false);
});

test('master Excel bridge rejects duplicate stable IDs',()=>{
 assert.throws(()=>readMasterExcelCapacityInputsV1(workbook([
  recipe('same_id','BREAKFAST',200),recipe('same_id','SNACK',100)
 ])),/duplicate recipe_id/);
});

test('calorie shortfall is reported rather than claiming a valid weekly menu',()=>{
 const rows=[
  ...Array.from({length:8},(_,i)=>recipe('breakfast_'+i,'BREAKFAST',100)),
  ...Array.from({length:16},(_,i)=>recipe('lunch_'+i,'LUNCH',100)),
  ...Array.from({length:8},(_,i)=>recipe('snack_'+i,'SNACK',100))
 ];
 const result=previewMasterExcelWeekCapacityV1(workbook(rows),3000);
 assert.equal(result.capacity.status,'PROVEN_INSUFFICIENT_WEEK_CALORIES');
 assert.equal(result.offlineWeekWitness,null);
 assert.equal(result.canApply,false);
 assert.equal(result.runtimePublishable,false);
});

test('bounded week subset prioritizes higher reference calories, not alphabetical IDs',()=>{
 const rows=[
  ...Array.from({length:9},(_,i)=>recipe('breakfast_'+String(i).padStart(2,'0'),'BREAKFAST',i===8?700:100)),
  ...Array.from({length:17},(_,i)=>recipe('lunch_'+String(i).padStart(2,'0'),'LUNCH',i===16?900:200)),
  ...Array.from({length:9},(_,i)=>recipe('snack_'+String(i).padStart(2,'0'),'SNACK',i===8?500:100))
 ];
 const result=previewMasterExcelWeekCapacityV1(workbook(rows),5000);
 assert.ok(result.witnessInputRecipeIds.includes('breakfast_08'));
 assert.ok(result.witnessInputRecipeIds.includes('lunch_16'));
 assert.ok(result.witnessInputRecipeIds.includes('snack_08'));
 assert.equal(result.witnessInputRecipeIds.length,32);
 assert.equal(result.witnessNegativeResultDoesNotProveFullCatalogInfeasibility,true);
});

test('offline week date is caller-controlled and invalid dates fail closed',()=>{
 const bytes=workbook([recipe('one_breakfast','BREAKFAST',300)]);
 assert.equal(previewMasterExcelWeekCapacityV1(bytes,1800,'2026-12-07').weekStart,'2026-12-07');
 assert.throws(()=>previewMasterExcelWeekCapacityV1(bytes,1800,'2026-02-30'),/weekStart/);
});

test('explicit dinner category is respected when available',()=>{
 const rows=[
  ...Array.from({length:8},(_,i)=>recipe('breakfast_'+i,'BREAKFAST',200)),
  ...Array.from({length:8},(_,i)=>recipe('lunch_'+i,'LUNCH',400)),
  ...Array.from({length:8},(_,i)=>recipe('dinner_'+i,'DINNER',500)),
  ...Array.from({length:8},(_,i)=>recipe('snack_'+i,'SNACK',150))
 ];
 const result=previewMasterExcelWeekCapacityV1(workbook(rows),4000);
 assert.deepEqual(result.scenario.slots[2].sourceCategories,['DINNER']);
 assert.equal(result.dinnerUsesLunchFallback,false);
 assert.equal(result.witnessInputRecipeIds.filter(id=>id.startsWith('dinner_')).length,8);
 assert.equal(result.dinnerFallback,'NONE_EXPLICIT_DINNER_CATEGORY');
});

test('small real dinner category does not disable bounded week witness',()=>{
 const rows=[
  ...Array.from({length:8},(_,i)=>recipe('breakfast_'+i,'BREAKFAST',300)),
  ...Array.from({length:14},(_,i)=>recipe('lunch_'+i,'LUNCH',500)),
  ...Array.from({length:2},(_,i)=>recipe('dinner_'+i,'DINNER',550)),
  ...Array.from({length:8},(_,i)=>recipe('snack_'+i,'SNACK',200))
 ];
 const result=previewMasterExcelWeekCapacityV1(workbook(rows),5000);
 assert.equal(result.witnessDinnerRecipeCount,2);
 assert.equal(result.witnessInputRecipeIds.length,32);
 assert.equal(result.witnessInputRecipeIds.filter(id=>id.startsWith('lunch_')).length,14);
 assert.equal(result.witnessSkippedReason,'WEEK_CALORIE_CAPACITY_ALREADY_FAILED');
});

test('capacity checker 128-input bound preserves scarce snack category and declares incompleteness',()=>{
 const rows=[
  ...Array.from({length:120},(_,i)=>recipe('lunch_'+String(i).padStart(3,'0'),'LUNCH',900)),
  ...Array.from({length:8},(_,i)=>recipe('breakfast_'+i,'BREAKFAST',600)),
  ...Array.from({length:8},(_,i)=>recipe('snack_'+i,'SNACK',100))
 ];
 const result=previewMasterExcelWeekCapacityV1(workbook(rows),6000);
 assert.equal(result.catalog.consideredRecipes,128);
 assert.equal(result.catalog.omittedByExistingCheckerLimit,8);
 assert.equal(result.catalog.capacityBoundIsFullCatalog,false);
 assert.equal(result.capacityNegativeResultDoesNotProveFullCatalogInfeasibility,true);
 assert.equal(result.witnessInputRecipeIds.filter(id=>id.startsWith('snack_')).length,8);
});

test('authoring review statuses are visible without treating them as approved',()=>{
 const parsed=readMasterExcelCapacityInputsV1(workbook([
  recipe('review_one','BREAKFAST',350),
  {...recipe('draft_one','LUNCH',500),status:'DRAFT'},
  {...recipe('approved_one','SNACK',150),status:'APPROVED'}
 ]));
 assert.deepEqual(parsed.statusCounts,{READY_FOR_REVIEW:1,DRAFT:1,APPROVED:1});
 assert.equal(parsed.sourceApproved,false);
 assert.equal(parsed.runtimePublishable,false);
});
