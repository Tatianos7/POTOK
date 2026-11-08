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
