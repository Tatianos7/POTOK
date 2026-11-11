import test from 'node:test';
import assert from 'node:assert/strict';
import {assessReferenceDailyTargetFitV1} from '../referenceDailyTargetFitV1';
import {referenceWeekFixture} from '../../services/__tests__/stagingWeekDraft.fixture';
import {decodeStagingRealWeek} from '../../services/stagingRealWeek';
import {referenceSavedGoalScope} from '../referenceSavedGoalV1';

const goal = {calories: 1703, protein: 145, fat: 65, carbs: 134} as const;

function reportWith(actual: Partial<{calories:number;protein:number;fat:number;carbs:number}>) {
  const packet = {...referenceWeekFixture(goal.calories), savedGoal:{scope:referenceSavedGoalScope,accountId:'11111111-1111-4111-8111-111111111111',
    goalRevision:null,updatedAt:'2026-11-10T10:00:00.000Z',...goal}};
  const view=decodeStagingRealWeek(packet);
  for (const day of view.report.days) {
    for (const axis of Object.keys(actual) as (keyof typeof actual)[]) {
      day.referenceNutrition[axis] = actual[axis]!;
    }
  }
  return view;
}

test('approved tolerance bounds are inclusive on all four daily axes',()=>{
  const view=reportWith({calories:1653,protein:130.5,fat:58.5,carbs:113.9});
  const fit=assessReferenceDailyTargetFitV1(view.report,view.savedGoal!);
  assert.equal(fit.length,7);
  assert.ok(fit.every(day=>day.passed));
  assert.deepEqual(fit[0].axes.protein,{target:145,actual:130.5,minimum:130.5,maximum:159.5,passed:true});
  assert.deepEqual(fit[0].axes.carbs,{target:134,actual:113.9,minimum:113.9,maximum:154.1,passed:true});
});

test('joint result fails if any one approved daily window is missed',()=>{
  const view=reportWith({calories:1753,protein:130.499,fat:71.5,carbs:154.1});
  const fit=assessReferenceDailyTargetFitV1(view.report,view.savedGoal!);
  assert.ok(fit.every(day=>!day.passed));
  assert.equal(fit[0].axes.calories.passed,true);
  assert.equal(fit[0].axes.protein.passed,false);
  assert.equal(fit[0].axes.fat.passed,true);
  assert.equal(fit[0].axes.carbs.passed,true);
});

test('owner manual-test values distinguish calorie fit from the full macro windows',()=>{
  const view=reportWith({calories:1702.7,protein:120.5,fat:64.6,carbs:162.8});
  const [day]=assessReferenceDailyTargetFitV1(view.report,view.savedGoal!);
  assert.equal(day.axes.calories.passed,true);
  assert.equal(day.axes.protein.minimum,130.5);
  assert.equal(day.axes.protein.passed,false);
  assert.equal(day.axes.fat.passed,true);
  assert.equal(day.axes.carbs.maximum,154.1);
  assert.equal(day.axes.carbs.passed,false);
  assert.equal(day.passed,false);
});

test('all four bounds are checked per day and zero carb target only accepts zero',()=>{
  const within=reportWith({calories:1703,protein:145,fat:65,carbs:134});
  assert.ok(assessReferenceDailyTargetFitV1(within.report,within.savedGoal!).every(day=>day.passed));
  const noCarbs=structuredClone(within);
  const zeroGoal={...within.savedGoal!,carbs:0};
  noCarbs.report.days.forEach(day=>{day.referenceNutrition.carbs=0;});
  assert.ok(assessReferenceDailyTargetFitV1(noCarbs.report,zeroGoal).every(day=>day.passed));
  noCarbs.report.days[3].referenceNutrition.carbs=0.001;
  const partial=assessReferenceDailyTargetFitV1(noCarbs.report,zeroGoal);
  assert.equal(partial.filter(day=>day.passed).length,6);
  assert.equal(partial[3].axes.carbs.passed,false);
  assert.equal(partial[3].passed,false);
});

test('rejects incomplete weeks and goal-target mismatches',()=>{
  const view=reportWith({calories:1703,protein:145,fat:65,carbs:134});
  assert.throws(()=>assessReferenceDailyTargetFitV1({...view.report,days:view.report.days.slice(0,6)},view.savedGoal!));
  assert.throws(()=>assessReferenceDailyTargetFitV1(view.report,{...view.savedGoal!,calories:1800}));
});
