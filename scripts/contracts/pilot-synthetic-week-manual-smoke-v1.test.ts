import test from 'node:test';
import assert from 'node:assert/strict';
import {runSyntheticWeekManualSmokeV1} from './pilot-synthetic-week-manual-smoke-v1';
test('manual offline smoke returns a deterministic 7-day meal preview from entirely synthetic inputs',()=>{
 const r=runSyntheticWeekManualSmokeV1();
 assert.equal(r.status,'REFERENCE_WEEK_PREVIEW');
 assert.equal(r.days.length,7);
 const uses=new Map<string,number>();
 for(const day of r.days){
  assert.equal(day.meals.length,4);
  assert.equal(day.referenceNutrition.calories,'2000.000');
  assert.ok(new Set(day.meals.map(m=>m.recipeId)).size===4);
  for(const meal of day.meals){
   assert.match(meal.recipeId,/^DEMO_/);
   assert.equal(meal.measuredGrams,null);
   assert.equal(meal.verified,false);
   assert.equal(meal.assignedSourceServings,1);
   uses.set(meal.recipeId,(uses.get(meal.recipeId)??0)+1);
  }
 }
 assert.ok([...uses.values()].every(n=>n<=2));
 assert.equal(r.realFoodDataUsed,false);
 assert.equal(r.databaseWrites,0);
 assert.equal(r.stagingConnection,false);
 assert.equal(r.workerEnabled,false);
 assert.equal(r.runtimePublishable,false);
 assert.equal(r.mayActivate,false);
 assert.deepEqual(runSyntheticWeekManualSmokeV1(),r);
});
