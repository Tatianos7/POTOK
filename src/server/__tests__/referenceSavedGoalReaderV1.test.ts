import {authoringSearchInput, decodeAuthoringRecipeCatalog} from '../../dev/authoringRecipeCatalog';
import {previewRecipeAuthoringWeekV1} from '../../dev/authoringWeekSearchV1';
import assert from 'node:assert/strict';
import test from 'node:test';
import {readReferenceSavedGoal} from '../referenceSavedGoalReaderV1';
import {decodeReferenceSavedGoal, referenceSavedGoalScope} from '../../dev/referenceSavedGoalV1';
import {decodeStagingRealWeek, requestStagingRealWeek} from '../../services/stagingRealWeek';
import {loadStagingWeekDraft, saveStagingWeekDraft} from '../../services/stagingWeekDraft';
import {referenceWeekFixture} from '../../services/__tests__/stagingWeekDraft.fixture';
import {createStagingRealWeekHandler} from '../stagingRealWeekApiV1';
const account = '11111111-1111-4111-8111-111111111111', other = '22222222-2222-4222-8222-222222222222';
const goal = () => ({scope: referenceSavedGoalScope, accountId: account, goalRevision: null, updatedAt: '2026-11-10T10:00:00Z', calories:1500, protein:100, fat:50, carbs:160});
const row = () => ({user_id: account, goal_revision:null, updated_at: '2026-11-10T10:00:00Z', calories:1500, protein:'100.25', fat:50, carbs:160});

test('saved goal read is fixed-origin own-account RLS GET with user token, minimal projection and no write or local cache', async()=>{
  const result = await readReferenceSavedGoal(account,'Bearer synthetic','sb_publishable_synthetic',async(url, init)=>{
    const parsed = new URL(String(url));
    assert.equal(parsed.origin,'https://ozidryfvhkcbtpnulakq.supabase.co');assert.equal(parsed.pathname,'/rest/v1/user_goals');
    assert.equal(parsed.searchParams.get('user_id'),'eq.'+account);assert.equal(parsed.searchParams.get('limit'),'2');
    assert.equal(parsed.searchParams.get('select'),'user_id,goal_revision,updated_at,calories,protein,fat,carbs');
    assert.equal(init?.method,'GET');assert.equal(init?.cache,'no-store');assert.equal(init?.redirect,'error');
    assert.deepEqual(init?.headers,{Authorization:'Bearer synthetic',apikey:'sb_publishable_synthetic',Accept:'application/json'});
    return new Response(JSON.stringify([row()]));
  });assert.equal(result.protein,100.25);assert.equal(result.scope,referenceSavedGoalScope);
});
test('missing, foreign, duplicate, malformed, denied and partial goal rows never fall back or coerce missing macros to zero',async()=>{
  for(const rows of [[],[row(),row()],[{...row(),user_id:other}],[{...row(),protein:null}],[{...row(),protein:''}],[{...row(),fat:'NaN'}],[{...row(),calories:1500.2}],[{...row(),updated_at:null}],[{...row(),extra:true}]]){
    await assert.rejects(readReferenceSavedGoal(account,'Bearer synthetic','public',async()=>new Response(JSON.stringify(rows))));
  }
  await assert.rejects(readReferenceSavedGoal(account,'Bearer synthetic','public',async()=>new Response('{}',{status:403})),/SAVED_GOAL_UNAVAILABLE/);
  await assert.rejects(readReferenceSavedGoal(account,'Bearer synthetic','public',async()=>{throw Error('offline');}));
  for(const invalid of [{...goal(),scope:'ADMITTED'},{...goal(),calories:0},{...goal(),protein:0},{...goal(),goalRevision:'invented'},{...goal(),updatedAt:'yesterday'}])assert.throws(()=>decodeReferenceSavedGoal(invalid));
});
test('client binds the saved target to returned calories and account, preserving arbitrary saved-goal calories through draft restore',async()=>{
  const packet={...referenceWeekFixture(1500),savedGoal:goal()},view=decodeStagingRealWeek(packet);assert.equal(view.savedGoal?.calories,1500);
  assert.throws(()=>decodeStagingRealWeek({...packet,savedGoal:{...goal(),calories:1600}}),/SAVED_GOAL_TARGET_MISMATCH/);
  const map = new Map<string,string>(),store={getItem:(k:string)=>map.get(k)??null,setItem:(k:string,v:string)=>{map.set(k,v);},removeItem:(k:string)=>{map.delete(k);}};
  saveStagingWeekDraft(store,account,view.snapshot,'Europe/Moscow');assert.deepEqual(loadStagingWeekDraft(store,account)?.view.savedGoal,goal());
  assert.throws(()=>saveStagingWeekDraft(store,other,view.snapshot,'Europe/Moscow'),/INVALID_DRAFT_ACCOUNT/);
  assert.throws(()=>saveStagingWeekDraft(store,account,JSON.stringify(referenceWeekFixture(1500)),'Europe/Moscow'),/INVALID_DRAFT/);
  const ports=(response:unknown)=>({async userId(){return account;},async token(){return 'synthetic';},async send(_u:unknown,init?:RequestInit){
    assert.deepEqual(JSON.parse(String(init?.body)),{goalSource:'SAVED_GOAL',weekStart:'2026-11-09'});return new Response(JSON.stringify(response));}});
  const result=await requestStagingRealWeek(account,1600,'2026-11-09',ports(packet),[],'SAVED_GOAL');assert.equal(result.report.target,1500);
  await assert.rejects(requestStagingRealWeek(account,1600,'2026-11-09',ports({...packet,savedGoal:{...goal(),accountId:other}}),[],'SAVED_GOAL'),/SAVED_GOAL_SOURCE_CHANGED/);
  await assert.rejects(requestStagingRealWeek(account,1600,'2026-11-09',ports(referenceWeekFixture()),[],'SAVED_GOAL'),/SAVED_GOAL_SOURCE_CHANGED/);
});
test('saved-goal request rejects supplied actor, target, macros and unknown source before any remote access',async()=>{
  const env={VERCEL_ENV:'preview',VITE_POTOK_STAGING_PREVIEW:'true',VITE_SUPABASE_URL:'https://ozidryfvhkcbtpnulakq.supabase.co',POTOK_STAGING_REFERENCE_TEST_ENABLED:'true',VITE_SUPABASE_ANON_KEY:'sb_publishable_synthetic_test_only'};
  for(const extra of [{target:1500},{accountId:other},{protein:100},{goalSource:'LOCAL_CACHE'}]){
    let calls=0,status=0;const response={status(n:number){status=n;return this;},setHeader(){return this;},json(){}};
    await createStagingRealWeekHandler(env,async()=>{calls++;throw Error('must not call');})({method:'POST',headers:{authorization:'Bearer synthetic'},body:{goalSource:'SAVED_GOAL',weekStart:'2026-11-09',...extra}},response);
    assert.equal(status,400);assert.equal(calls,0);
  }
});


test('bounded source-serving refinement improves P/F without worsening either axis, losing diversity, changing portions or optimizing carbs',()=>{
  const input=authoringSearchInput(decodeAuthoringRecipeCatalog(referenceWeekFixture().catalog));
  input.recipes[27].referenceNutrition.values.protein=40;input.recipes[27].referenceNutrition.values.fat=20;
  const settings={contract:'potok-authoring-week-scenario-v1' as const,enforceDailyStapleVariety:true as const,
    weekStart:'2026-11-09',dailyCalorieTarget:1600,tolerancePercent:10,
    slots:['Завтрак','Обед','Ужин','Перекус'].map(label=>({label,sourceCategories:['LUNCH'],targetSharePercent:25})),
    rankedCandidatePoolSize:28,shortlistPerSlot:4,dayPoolSize:4,maxDayEvaluations:256,maxWeekEvaluations:1024,maxRecipeUses:2};
  const before=JSON.stringify(input),plain=previewRecipeAuthoringWeekV1(input,settings);
  const targets={protein:100,fat:50,carbs:1},r=previewRecipeAuthoringWeekV1(input,settings,targets);
  assert.equal(r.days.length,7);assert.ok('macroRefinement' in r);assert.ok(r.macroRefinement);assert.ok('distinctRecipes' in plain);assert.ok(r.distinctRecipes>=plain.distinctRecipes);
  assert.ok(r.macroRefinement.evaluatedCandidates<=114688);
  assert.equal(r.macroRefinement.carbsAssessed,false);assert.equal(r.macroRefinement.hardMacroBoundsAssessed,false);
  let improved=0;
  for(const day of r.macroRefinement.days){
    for(const axis of ['protein','fat'] as const)assert.ok(Math.abs(day.after[axis]-targets[axis])<=Math.abs(day.before[axis]-targets[axis]));
    if(day.before.protein!==day.after.protein||day.before.fat!==day.after.fat)improved++;
  }
  assert.ok(improved>0);assert.equal(JSON.stringify(input),before);
  assert.ok(r.days.every(d=>Math.abs(Number(d.referenceNutrition.calories)-1600)<=50&&d.meals.every(m=>m.assignedSourceServings===1&&m.measuredGrams===null)));
  assert.deepEqual(r,previewRecipeAuthoringWeekV1(input,settings,{...targets,carbs:999} as typeof targets));
});
test('client independently rejects worsened or mismatched P/F receipts and preserves old comparison-only snapshots',()=>{
  const packet={...referenceWeekFixture(1500),savedGoal:goal()};
  assert.equal(decodeStagingRealWeek(packet).macroFit,null);
  const receipt={scope:'REFERENCE_PROTEIN_FAT_PARETO_ONLY',carbsAssessed:false,hardMacroBoundsAssessed:false,
    targetProtein:100,targetFat:50,limits:{passes:2,poolPerSlot:64,candidatesPerDayPerPass:8192},evaluatedCandidates:0,changes:0,minimumDistinctRecipes:28,
    days:packet.report.days.map(d=>({date:d.date,before:{protein:80,fat:40},after:{protein:80,fat:40}}))};
  const withFit={...packet,report:{...packet.report,macroRefinement:receipt}};
  assert.equal(decodeStagingRealWeek(withFit).macroFit?.improvedDays,0);
  const bad=structuredClone(withFit);bad.report.macroRefinement.days[0].before.protein=95;
  assert.throws(()=>decodeStagingRealWeek(bad),/INVALID_REFERENCE_MACRO_FIT/);
  for(const change of [{carbsAssessed:true},{targetProtein:101},{minimumDistinctRecipes:29},{evaluatedCandidates:114689}])assert.throws(()=>decodeStagingRealWeek({...withFit,report:{...withFit.report,macroRefinement:{...receipt,...change}}}),/INVALID_REFERENCE_MACRO_FIT/);
  const noGoal={...withFit,savedGoal:undefined};assert.throws(()=>decodeStagingRealWeek(noGoal),/INVALID_REFERENCE_MACRO_FIT/);
});
