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
