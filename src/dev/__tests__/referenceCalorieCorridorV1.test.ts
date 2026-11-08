import test from 'node:test';
import assert from 'node:assert/strict';
import {referenceCalorieCorridorV1, referenceCaloriesFitCorridorV1, constrainReferenceWeekToCorridorV1} from '../referenceCalorieCorridorV1';

test('owner corridor is target minus/plus 50, inclusive, never the superseded plus-100 rule', () => {
  assert.deepEqual(referenceCalorieCorridorV1(1600), {contract:'potok-reference-calorie-corridor-v1',minimumKcal:1550,maximumKcal:1650});
  assert.equal(referenceCalorieCorridorV1(1800).minimumKcal,1750);assert.equal(referenceCalorieCorridorV1(1800).maximumKcal,1850);
  for(const kcal of [1550,1599.999,1600,1650])assert.equal(referenceCaloriesFitCorridorV1(1600,kcal),true);
  for(const kcal of [1549.999,1650.001,1700,NaN,Infinity])assert.equal(referenceCaloriesFitCorridorV1(1600,kcal),false);
});
test('a single out-of-corridor day rejects the whole candidate without scaling or mutating it', () => {
  const base={status:'REFERENCE_WEEK_PREVIEW',scenario:{dailyCalorieTarget:1600},days:Array.from({length:7},()=>({referenceNutrition:{calories:'1600.000'}})),runtimePublishable:false,mayActivate:false};
  const accepted=constrainReferenceWeekToCorridorV1(base);assert.equal(accepted.days.length,7);
  for(const kcal of ['1549.999','1650.001']){
    const candidate=structuredClone(base);candidate.days[3].referenceNutrition.calories=kcal;const before=JSON.stringify(candidate);
    const result=constrainReferenceWeekToCorridorV1(candidate);assert.equal(result.status,'NO_REFERENCE_WEEK_IN_CALORIE_CORRIDOR');
    assert.deepEqual(result.days,[]);assert.equal(result.runtimePublishable,false);assert.equal(result.mayActivate,false);assert.equal(JSON.stringify(candidate),before);
  }
});
