import assert from 'node:assert/strict';
import test from 'node:test';
import {fullFixture,id} from '../../utils/__tests__/trustedGeneratedWeekFixturesV1';
import {GenerationPlanReadbackServiceV2,decodeGenerationPlanReadbackV2,generationPlanReadbackContractV2,type GenerationPlanReadClientV2} from '../generationPlanReadbackV2';
import {GenerationPlanEntryControllerV2} from '../generationPlanEntryV2';

async function fixture(unknownYield = false) {
  const f = await fullFixture(s => {if (unknownYield) for (const e of s.context.manifest.entries) e.recipeSnapshot.baseYield.totalYieldGrams = null;});
  const account = f.context.input.accountId, request = f.context.input.operation.requestId;
  const ready = {kind:'ready',contract:generationPlanReadbackContractV2,request_operation_id:request,account_id:account,
    selection_id:f.plan.selectionId,plan_revision:f.plan.proposedPlanRevision,generation_operation_id:id(900),activation_operation_id:id(901),
    graph_digest_hex:f.plan.graphDigest,graph:f.plan.graph};
  let user: string | null = account, enabled = true;
  const calls: unknown[] = [];
  let response: unknown = ready, error: unknown = null;
  let onRpc: (() => Promise<void>) | undefined;
  const client: GenerationPlanReadClientV2 = {auth:{async getUser(){return {data:{user:user ? {id:user} : null},error:null};}},
    async rpc(name,args){calls.push([name,args]); if (onRpc) await onRpc(); return {data:response,error};}};
  const service = new GenerationPlanReadbackServiceV2(client,() => enabled);
  return {f,account,request,ready,calls,service,client,setUser:(v:string|null) => {user=v;},setGate:(v:boolean) => {enabled=v;},
    setResponse:(v:unknown) => {response=v;},setError:(v:unknown) => {error=v;},setRpc:(v:()=>Promise<void>) => {onRpc=v;}};
}
test('request-bound ready response passes real Graph V2 decoder and digest verification',async()=>{
  const h=await fixture();const r=await h.service.read(h.service.beginSession(h.account),h.request);
  assert.equal(r.kind,'ready'); if(r.kind!=='ready')return;
  assert.equal(r.graphDigest,h.f.plan.graphDigest); assert.deepEqual(r.graph,h.f.plan.graph);assert.ok(Object.isFrozen(r.graph.days));
  assert.deepEqual(h.calls,[['adaptive_nutrition_read_generation_plan_v2',{p_request_operation_id:h.request}]]);
});
test('ready requires exact request/account/revision/digest and complete V2 shape',async()=>{
  const h=await fixture();
  for(const [key,value] of [['request_operation_id',id(999)],['account_id',id(999)],['selection_id',id(999)],['plan_revision',id(999)],
    ['graph_digest_hex','a'.repeat(64)],['graph_contract_version',1],['activation_operation_id',null]] as const){
    await assert.rejects(decodeGenerationPlanReadbackV2({...h.ready,[key]:value},h.account,h.request));
  }
  const graph=structuredClone(h.ready.graph);graph.days[0].nutritionTotal.calories='0.000';
  await assert.rejects(decodeGenerationPlanReadbackV2({...h.ready,graph},h.account,h.request));
});
test('ACTIVE status alone and partial/error payloads never become a menu',async()=>{
  const h=await fixture();const session=h.service.beginSession(h.account);
  for(const response of [{status:'ACTIVE'},{kind:'ready'},null,[],{kind:'not_ready',graph:h.ready.graph}]){
    h.setResponse(response);assert.equal((await h.service.read(session,h.request)).kind,'invalid-server-response');
  }
});
test('terminal read outcomes carry no menu and transport failures have no fallback/retry',async()=>{
  const h=await fixture();const session=h.service.beginSession(h.account);
  for(const kind of ['denied','not_ready','not_found','unavailable'] as const){h.setResponse({kind});assert.deepEqual(await h.service.read(session,h.request),{kind});}
  h.setError(new Error('network'));assert.deepEqual(await h.service.read(session,h.request),{kind:'unavailable'});assert.equal(h.calls.length,5);
});
test('disabled default gate, invalid request and forged session perform no RPC',async()=>{
  const h=await fixture();const session=h.service.beginSession(h.account);
  assert.deepEqual(await new GenerationPlanReadbackServiceV2(h.client).read(session,h.request),{kind:'unavailable'});
  assert.deepEqual(await h.service.read(session,'invalid'),{kind:'invalid-request'});
  assert.deepEqual(await h.service.read({...session},h.request),{kind:'session-stale'});assert.equal(h.calls.length,0);
});
test('signout, account switch and gate removal during RPC discard late menu',async()=>{
  for(const mode of ['logout','account','gate','stop']){
    const h=await fixture();const session=h.service.beginSession(h.account);
    h.setRpc(async()=>{if(mode==='logout')h.setUser(null);if(mode==='account')h.service.beginSession(id(999));if(mode==='gate')h.setGate(false);if(mode==='stop')h.service.endSession();});
    assert.deepEqual(await h.service.read(session,h.request),{kind:'session-stale'});
  }
});
test('opening verified menu selects requested local day and keeps unknown grams null',async()=>{
  const h=await fixture(true);const c=new GenerationPlanEntryControllerV2(h.service);const day=h.f.plan.graph.days[2];
  await c.open(h.account,h.request,day.date,h.f.plan.timezone);assert.equal(c.snapshot().phase,'ready');
  assert.deepEqual(c.snapshot().slots,day.slots);
  for(const slot of c.snapshot().slots)for(const component of slot.mealSnapshot.components){
    assert.equal(component.assignedPortion.assignedGrams,null);assert.equal(component.recipe.baseYield.totalYieldGrams,null);
  }
  c.stop();assert.deepEqual(c.snapshot(),{phase:'idle',model:null,slots:[]});
});
test('wrong local day/timezone and pending state clear previous menu',async()=>{
  const h=await fixture();const c=new GenerationPlanEntryControllerV2(h.service);
  for(const [day,zone] of [['2026-02-30',h.f.plan.timezone],['2020-01-01',h.f.plan.timezone],[h.f.plan.weekStartLocal,'Europe/Moscow']]){
    await c.open(h.account,h.request,day,zone);assert.equal(c.snapshot().phase,'unavailable');assert.equal(c.snapshot().model,null);
  }
  h.setResponse({kind:'not_ready'});await c.open(h.account,h.request,h.f.plan.weekStartLocal,h.f.plan.timezone);
  assert.deepEqual(c.snapshot(),{phase:'pending',model:null,slots:[]});
});
test('stopped opening cannot publish a late menu',async()=>{
  const h=await fixture();let release!:()=>void;let entered!:()=>void;
  const started=new Promise<void>(r=>{entered=r;});const wait=new Promise<void>(r=>{release=r;});
  h.setRpc(async()=>{entered();await wait;});const c=new GenerationPlanEntryControllerV2(h.service);
  const pending=c.open(h.account,h.request,h.f.plan.weekStartLocal,h.f.plan.timezone);await started;c.stop();release();await pending;
  assert.deepEqual(c.snapshot(),{phase:'idle',model:null,slots:[]});
});
test('a newer failed opening cannot be replaced by an older successful response',async()=>{
  const h=await fixture();let release!:()=>void;let entered!:()=>void;
  const started=new Promise<void>(r=>{entered=r;});const wait=new Promise<void>(r=>{release=r;});
  h.setRpc(async()=>{entered();await wait;});const c=new GenerationPlanEntryControllerV2(h.service);
  const pending=c.open(h.account,h.request,h.f.plan.weekStartLocal,h.f.plan.timezone);await started;
  await c.open(h.account,h.request,'invalid',h.f.plan.timezone);release();await pending;
  assert.deepEqual(c.snapshot(),{phase:'unavailable',model:null,slots:[]});
});
