import assert from 'node:assert/strict';
import test from 'node:test';
import {GenerationRequestFlowV2} from '../generationRequestFlowV2';
import {id} from '../../utils/__tests__/trustedGeneratedWeekFixturesV1';
import type {GenerationPlanReadClientV2} from '../generationPlanReadbackV2';
const account=id(1),request=id(2),key=id(3),today='2026-10-26',zone='Europe/Moscow';
function harness(){
  const calls:{name:string;args:Record<string,unknown>}[]=[];let keys=0,user:string|null=account;
  let response:unknown={contract:'potok-adaptive-generation-request-status-v2',requestOperationId:request,status:'REQUESTED',retryable:true,reasonCode:null};
  let failure=false;let hook:(()=>Promise<void>)|null=null;
  const client:GenerationPlanReadClientV2={auth:{async getUser(){return {data:{user:user?{id:user}:null},error:null};}},async rpc(name,args){
    calls.push({name,args:structuredClone(args)});if(hook)await hook();return {data:response,error:failure?'network':null};
  }};
  const flow=new GenerationRequestFlowV2(client,()=>true,()=>{keys++;return key;});
  flow.attach(account,today,zone);
  return {client,flow,calls,keys:()=>keys,setResponse:(v:unknown)=>{response=v;},setFailure:(v:boolean)=>{failure=v;},
    setUser:(v:string|null)=>{user=v;},setHook:(v:()=>Promise<void>)=>{hook=v;}};
}
test('attachment never creates a plan; disabled and invalid-scope flows make no RPC',async()=>{
  const h=harness();assert.equal(h.calls.length,0);assert.equal(h.flow.snapshot().phase,'idle');
  const disabled=new GenerationRequestFlowV2(h.client);disabled.attach(account,today,zone);await disabled.start();assert.equal(h.calls.length,0);
  h.flow.attach(account,'2026-02-30',zone);await h.flow.start();assert.equal(h.calls.length,0);assert.equal(h.flow.snapshot().phase,'unavailable');
});
test('refresh without an attempt cannot create a generation request',async()=>{
  const h=harness();await h.flow.refresh();assert.equal(h.calls.length,0);assert.equal(h.keys(),0);
});
test('double click while request is pending creates one key and one RPC',async()=>{
  const h=harness();let release!:()=>void,entered!:()=>void;
  const wait=new Promise<void>(r=>{release=r;}),started=new Promise<void>(r=>{entered=r;});
  h.setHook(async()=>{entered();await wait;});
  const first=h.flow.start();await started;await h.flow.start();await h.flow.refresh();release();await first;
  assert.equal(h.calls.length,1);assert.equal(h.keys(),1);assert.equal(h.flow.snapshot().phase,'pending');
});
test('known request uses only bound status lookup on repeated start or refresh',async()=>{
  const h=harness();await h.flow.start();await h.flow.start();await h.flow.refresh();
  assert.deepEqual(h.calls.map(c=>c.name),['adaptive_nutrition_request_generation_v2','adaptive_nutrition_generation_status_v2','adaptive_nutrition_generation_status_v2']);
  assert.equal(h.keys(),1);
});
test('substituted request id cannot replace the saved recovery identity',async()=>{
  const h=harness();await h.flow.start();h.setResponse({contract:'potok-adaptive-generation-request-status-v2',requestOperationId:id(99),status:'ACTIVE',retryable:false,reasonCode:null});
  await h.flow.refresh();assert.equal(h.flow.snapshot().phase,'unknown');assert.equal(h.flow.recovery()?.requestOperationId,request);
  assert.equal(h.calls.length,2);assert.equal(h.keys(),1);
});
test('malformed initial reply preserves original key for explicit recovery',async()=>{
  for(const response of [null,{status:'ACTIVE'},{contract:'potok-adaptive-generation-request-status-v2',requestOperationId:request,status:'ACTIVE',retryable:true,reasonCode:null}]){
    const h=harness();h.setResponse(response);await h.flow.start();assert.equal(h.flow.snapshot().phase,'unknown');
    assert.equal(h.flow.recovery()?.idempotencyKey,key);assert.equal(h.flow.recovery()?.requestOperationId,null);
  }
});
test('initial transport failure is uncertain; replay is explicit and retains original key',async()=>{
  const h=harness();h.setFailure(true);await h.flow.start();assert.equal(h.flow.snapshot().phase,'unknown');assert.equal(h.calls.length,1);
  h.setFailure(false);await h.flow.refresh();assert.equal(h.flow.snapshot().phase,'pending');
  assert.equal(h.keys(),1);assert.equal(h.calls[0].args.p_idempotency_key,h.calls[1].args.p_idempotency_key);
});
test('unresolved attempt cannot be replaced when local date/timezone changes',async()=>{
  const h=harness();h.setFailure(true);await h.flow.start();const saved=h.flow.recovery()!;
  h.flow.attach(account,'2026-10-27',zone);await h.flow.start();assert.equal(h.calls.length,1);assert.equal(h.keys(),1);
  assert.equal(h.flow.snapshot().phase,'unavailable');h.flow.restore(saved);h.setFailure(false);await h.flow.refresh();
  assert.equal(h.flow.snapshot().phase,'pending');assert.equal(h.keys(),1);
});
test('restore owns fields, validates identity and refuses replacing an existing attempt',async()=>{
  const h=harness();await h.flow.start();const saved={...h.flow.recovery()!};h.flow.restore(saved);saved.idempotencyKey=id(99);
  assert.equal(h.flow.recovery()?.idempotencyKey,key);
  assert.throws(()=>h.flow.restore({...saved,accountId:'bad'}),/INVALID_GENERATION_RECOVERY/);
  assert.throws(()=>h.flow.restore(saved),/GENERATION_RECOVERY_CONFLICT/);
});
test('wrong authenticated account or missing Auth cannot request a plan',async()=>{
  for(const user of [null,id(99)]){
    const h=harness();h.setUser(user);await h.flow.start();assert.equal(h.flow.snapshot().phase,'denied');assert.equal(h.calls.length,0);assert.equal(h.keys(),0);
  }
});
test('account switching preserves separate recovery identities and clears old menu state',async()=>{
  const h=harness();await h.flow.start();const saved=h.flow.recovery()!;
  h.flow.attach(id(99),today,zone);assert.equal(h.flow.snapshot().entry.model,null);h.flow.restore(saved);await h.flow.refresh();
  assert.equal(h.keys(),1);assert.equal(h.flow.snapshot().requestOperationId,request);
});
test('no privileged worker RPC or V1 fallback is reachable through the flow service',async()=>{
  const h=harness();await h.flow.start();await h.flow.refresh();
  assert.ok(h.calls.every(c=>['adaptive_nutrition_request_generation_v2','adaptive_nutrition_generation_status_v2','adaptive_nutrition_read_generation_plan_v2'].includes(c.name)));
});

test('a confirmed terminal request does not block a new local-day scope forever',async()=>{
  const h=harness();h.setResponse({contract:'potok-adaptive-generation-request-status-v2',requestOperationId:request,status:'REJECTED',retryable:false,reasonCode:null});
  await h.flow.start();assert.equal(h.flow.snapshot().phase,'rejected');
  h.flow.attach(account,'2026-11-02',zone);assert.equal(h.flow.snapshot().phase,'idle');
  await h.flow.start();assert.equal(h.keys(),2);assert.equal(h.calls.length,2);
});
