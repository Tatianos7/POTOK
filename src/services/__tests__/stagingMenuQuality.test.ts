import {referenceStapleGroups, referenceDayHasDistinctStaples} from '../../dev/referenceStapleVarietyV1';
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


test('culinary groups use literal source ingredients, ignore optional sides and do not confuse Greek yogurt, flour or tomato paste with garnishes',()=>{
  const recipe=(name: string, ingredients: string[]=[])=>({name,ingredients:ingredients.map(name=>({name,optional:false}))});
  assert.deepEqual(referenceStapleGroups(recipe('Гречневая каша')),['buckwheat']);
  assert.deepEqual(referenceStapleGroups(recipe('Йогурт греческий 2%', ['рисовая мука','томатная паста','фасоль стручковая зелёная'])),[]);
  assert.deepEqual(referenceStapleGroups(recipe('Рагу',['рис бурый длиннозёрный','картофель'])),['rice','potato']);
  assert.equal(referenceDayHasDistinctStaples([recipe('Гречка с грибами'),recipe('Курица',['крупа гречневая'])]),false);
  assert.equal(referenceDayHasDistinctStaples([recipe('Каша',['рис белый']),recipe('Плов',['рис бурый'])]),false);
  assert.equal(referenceDayHasDistinctStaples([recipe('Гречка'),recipe('Рис'),recipe('Салат')]),true);
  assert.deepEqual(referenceStapleGroups({name:'Омлет',ingredients:[{name:'картофель',optional:true}]}),[]);
});
test('daily staple constraint survives calorie refinement; impossible input returns empty without relaxing it',()=>{
  const input=authoringSearchInput(decodeAuthoringRecipeCatalog(referenceWeekFixture().catalog));
  const settings={contract:'potok-authoring-week-scenario-v1' as const,enforceDailyStapleVariety:true as const,
    weekStart:'2026-11-09',dailyCalorieTarget:1600,tolerancePercent:10,
    slots:['Завтрак','Обед','Ужин','Перекус'].map(label=>({label,sourceCategories:['LUNCH'],targetSharePercent:25})),
    rankedCandidatePoolSize:28,shortlistPerSlot:4,dayPoolSize:4,maxDayEvaluations:256,maxWeekEvaluations:1024,maxRecipeUses:2};
  input.recipes.forEach((r,i)=>{r.ingredients=[{name:['крупа гречневая','рис белый','картофель','чечевица'][i%4],optional:false}];});
  const before=JSON.stringify(input),report=previewRecipeAuthoringWeekV1(input,settings);
  assert.equal(report.days.length,7);
  const lookup=new Map(input.recipes.map(r=>[r.recipeId,r]));
  assert.ok(report.days.every(d=>referenceDayHasDistinctStaples(d.meals.map(m=>lookup.get(m.recipeId)!))));
  assert.equal(JSON.stringify(input),before);
  const impossible=structuredClone(input);impossible.recipes.forEach(r=>{r.ingredients=[{name:'крупа гречневая',optional:false}];});
  assert.equal(previewRecipeAuthoringWeekV1(impossible,settings).days.length,0);
});
test('client rechecks daily staple diversity and retains the rule through draft restore; old drafts are not silently upgraded',()=>{
  const raw=referenceWeekFixture() as ReturnType<typeof referenceWeekFixture> & {report: {scenario: {enforceDailyStapleVariety?: true}}};
  assert.equal(decodeStagingRealWeek(raw).report.dailyStapleVariety,undefined);
  raw.report.scenario.enforceDailyStapleVariety=true;
  const view=decodeStagingRealWeek(raw);assert.equal(view.report.dailyStapleVariety,true);
  const map=new Map<string,string>(),storage={getItem:(k:string)=>map.get(k)??null,setItem:(k:string,v:string)=>{map.set(k,v);},removeItem:(k:string)=>{map.delete(k);}};
  const account='11111111-1111-4111-8111-111111111111';
  saveStagingWeekDraft(storage,account,JSON.stringify(raw),'Europe/Moscow');assert.equal(loadStagingWeekDraft(storage,account)!.view.report.dailyStapleVariety,true);
  // Source ingredient text is unchanged by numerical report-link checks; the independent rule must still reject it.
  for(const r of raw.catalog.recipes.slice(0,2))r.ingredients[0].ingredient_name_ru='крупа гречневая';
  assert.throws(()=>decodeStagingRealWeek(raw),/REFERENCE_DAILY_STAPLE_REPEAT/);
});
