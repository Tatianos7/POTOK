import test from 'node:test';
import assert from 'node:assert/strict';
import {decodeReferenceExcludedIds, excludeReferenceRecipes, referenceExclusionScope} from '../../dev/referenceRecipeExclusionsV1';
import {decodeStagingRealWeek, requestStagingRealWeek} from '../stagingRealWeek';
import {referenceWeekFixture} from './stagingWeekDraft.fixture';
import {previewRecipeAuthoringWeekV1} from '../../dev/authoringWeekSearchV1';
import {authoringSearchInput, decodeAuthoringRecipeCatalog} from '../../dev/authoringRecipeCatalog';
import {constrainReferenceWeekToCorridorV1} from '../../dev/referenceCalorieCorridorV1';
import {decodeAuthoringWeekReport} from '../../dev/authoringWeekReport';
import {loadStagingWeekDraft, saveStagingWeekDraft} from '../stagingWeekDraft';

test('exclusions are exact recipe identities, bounded and canonical; no ingredient or allergy inference',()=>{
  const input={recipes:[{recipeId:'synthetic-1'},{recipeId:'synthetic-10'},{recipeId:'other'}]},before=JSON.stringify(input);
  assert.deepEqual(decodeReferenceExcludedIds(['synthetic-10','synthetic-1']),['synthetic-1','synthetic-10']);
  assert.deepEqual(excludeReferenceRecipes(input,['synthetic-1']).recipes.map(r=>r.recipeId),['synthetic-10','other']);
  assert.equal(JSON.stringify(input),before);assert.throws(()=>excludeReferenceRecipes(input,['missing']),/UNKNOWN_REFERENCE_RECIPE/);
  for(const bad of [null,'milk',['same','same'],[''],['bad name'],Array.from({length:29},(_,i)=>`id-${i}`)])assert.throws(()=>decodeReferenceExcludedIds(bad));
});
test('excluded choices enter the actual bounded search; hard constraints and source portions never relax',()=>{
  const input=authoringSearchInput(decodeAuthoringRecipeCatalog(referenceWeekFixture().catalog));
  const settings={contract:'potok-authoring-week-scenario-v1' as const,weekStart:'2026-11-09',dailyCalorieTarget:1600,tolerancePercent:10,
    slots:['Завтрак','Обед','Ужин','Перекус'].map(label=>({label,sourceCategories:['LUNCH'],targetSharePercent:25})),
    rankedCandidatePoolSize:28,shortlistPerSlot:4,dayPoolSize:4,maxDayEvaluations:256,maxWeekEvaluations:1024,maxRecipeUses:2};
  const filtered=excludeReferenceRecipes(input,['synthetic-0']);
  const raw=constrainReferenceWeekToCorridorV1(previewRecipeAuthoringWeekV1(filtered,settings));
  const report=decodeAuthoringWeekReport(raw);assert.equal(report.days.length,7);
  assert.ok(!report.days.some(d=>d.meals.some(m=>m.recipeId==='synthetic-0')));
  assert.ok(report.days.every(d=>d.meals.every(m=>m.assignedSourceServings===1&&m.measuredGrams===null&&m.verified===false)));
  const limited={...filtered,recipes:filtered.recipes.slice(0,3)};
  const none=constrainReferenceWeekToCorridorV1(previewRecipeAuthoringWeekV1(limited,settings));assert.equal(none.days.length,0);
  assert.deepEqual(previewRecipeAuthoringWeekV1(filtered,settings),previewRecipeAuthoringWeekV1(filtered,settings));
});
test('client rejects ignored exclusions, duplicate metadata, unsafe scope and a returned excluded recipe',async()=>{
  const account='11111111-1111-4111-8111-111111111111',packet=referenceWeekFixture();
  const exclusions={scope:referenceExclusionScope,recipes:[{id:'unselected',name:'Исключённое блюдо'}]};
  const accepted={...packet,exclusions};assert.equal(decodeStagingRealWeek(accepted).excludedRecipes.length,1);
  for(const invalid of [{...exclusions,scope:'ALLERGEN_SAFE'}, {...exclusions,recipes:[...exclusions.recipes,...exclusions.recipes]},
    {...exclusions,recipes:[{id:'synthetic-0',name:'Тестовое блюдо 0'}]}])assert.throws(()=>decodeStagingRealWeek({...packet,exclusions:invalid}));
  const repeated=referenceWeekFixture();repeated.report.scenario.maxRecipeUses=3;
  for(const d of [1,2]) repeated.report.days[d].meals[0]={...repeated.report.days[0].meals[0]};
  repeated.catalog.recipes=repeated.catalog.recipes.filter(r=>!['synthetic-4','synthetic-8'].includes(r.recipeId));
  assert.throws(()=>decodeStagingRealWeek(repeated),/REFERENCE_REPEAT_LIMIT_EXCEEDED/);
  const ports=(response:unknown)=>({async userId(){return account;},async token(){return 'synthetic';},async send(_url:unknown,init?:RequestInit){
    assert.deepEqual(JSON.parse(String(init?.body)).excludedRecipeIds,['unselected']);return new Response(JSON.stringify(response));}});
  assert.equal((await requestStagingRealWeek(account,1600,'2026-11-09',ports(accepted),['unselected'])).excludedRecipes[0].id,'unselected');
  await assert.rejects(requestStagingRealWeek(account,1600,'2026-11-09',ports(packet),['unselected']),/EXCLUSION_SCOPE_CHANGED/);
});
test('exclusion scope survives draft roundtrip and old snapshots without it remain readable',()=>{
  const map=new Map<string,string>(),store={getItem:(k:string)=>map.get(k)??null,setItem:(k:string,v:string)=>{map.set(k,v);},removeItem:(k:string)=>{map.delete(k);}};
  const account='11111111-1111-4111-8111-111111111111',packet=referenceWeekFixture();
  saveStagingWeekDraft(store,account,JSON.stringify(packet),'Europe/Moscow');assert.deepEqual(loadStagingWeekDraft(store,account)!.view.excludedRecipes,[]);
  const next={...packet,exclusions:{scope:referenceExclusionScope,recipes:[{id:'unselected',name:'Исключённое блюдо'}]}};
  saveStagingWeekDraft(store,account,JSON.stringify(next),'Europe/Moscow');assert.deepEqual(loadStagingWeekDraft(store,account)!.view.excludedRecipes,next.exclusions.recipes);
});
