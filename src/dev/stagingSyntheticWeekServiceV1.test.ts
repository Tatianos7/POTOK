import test from 'node:test';
import assert from 'node:assert/strict';
import {buildSyntheticStagingWeekV1} from './stagingSyntheticWeekServiceV1';

test('seven-day server-side demo uses existing search but no real food or DB state',()=>{
 const result=buildSyntheticStagingWeekV1();
 assert.equal(result.contract,'potok-staging-synthetic-week-v1');
 assert.equal(result.mode,'SYNTHETIC_TEST_ONLY');
 assert.equal(result.engine,'existing-authoring-week-search-v1');
 assert.equal(result.noDatabaseWrites,true);
 assert.equal(result.mayActivate,false);
 assert.equal(result.realRecipes,false);
 assert.equal(result.verifiedNutrition,false);
 assert.equal(result.notPersonalized,true);
 assert.equal(result.days.length,7);
 const repeats=new Map<string,number>();
 for(const d of result.days){
  assert.equal(d.meals.length,4);
  assert.equal(d.referenceCalories,2000);
  assert.equal(new Set(d.meals.map(m=>m.syntheticId)).size,4);
  for(const m of d.meals){
   assert.match(m.syntheticId,/^SYNTH_/);
   assert.match(m.label,/НЕ РЕЦЕПТ/);
   repeats.set(m.syntheticId,(repeats.get(m.syntheticId)??0)+1);
  }
 }
 assert([...repeats.values()].every(n=>n<=2));
 assert.deepEqual(buildSyntheticStagingWeekV1(),result);
});
