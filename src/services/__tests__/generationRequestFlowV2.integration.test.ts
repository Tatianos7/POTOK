import assert from 'node:assert/strict';
import test from 'node:test';
import {renderToStaticMarkup} from 'react-dom/server';
import {GenerationRequestFlowV2} from '../generationRequestFlowV2';
import {GenerationFlowViewV2} from '../../components/GenerationRequestFlowV2';
import {generationWorkerFixtureV1} from '../../server/__tests__/generationWorkerBindingsFixturesV1';
import {id} from '../../utils/__tests__/trustedGeneratedWeekFixturesV1';
import {generationPlanReadbackContractV2,type GenerationPlanReadClientV2} from '../generationPlanReadbackV2';

async function harness(options:Parameters<typeof generationWorkerFixtureV1>[0]={}) {
  const worker=await generationWorkerFixtureV1({initialStatus:'REQUESTED',...options});
  const account=worker.f.context.input.accountId,request=worker.input.requestOperationId,key=id(920);
  let user:string|null=account,gate=true,requestLost=false,readMissing=false,created=false;
  let hook:((name:string)=>Promise<void>)|null=null;
  const calls:{name:string;args:Record<string,unknown>}[]=[];
  const counts={keys:0,created:0};
  const status=()=>({contract:'potok-adaptive-generation-request-status-v2',requestOperationId:request,
    status:worker.status(),retryable:!['ACTIVE','REJECTED','CONFLICT'].includes(worker.status()),reasonCode:null});
  const client:GenerationPlanReadClientV2={auth:{async getUser(){return {data:{user:user?{id:user}:null},error:null};}},
    async rpc(name:string,args:Record<string,unknown>){
      calls.push({name,args:structuredClone(args)});
      if(hook)await hook(name);
      if(name==='adaptive_nutrition_request_generation_v2'){
        assert.equal(args.p_protocol_version,'potok-adaptive-generation-request-v2');assert.equal(args.p_idempotency_key,key);
        if(!created){created=true;counts.created++;}
        if(requestLost){requestLost=false;return {data:null,error:{lost:true}};}
        return {data:status(),error:null};
      }
      assert.equal(args.p_request_operation_id,request);
      if(name==='adaptive_nutrition_generation_status_v2')return {data:status(),error:null};
      assert.equal(name,'adaptive_nutrition_read_generation_plan_v2');
      if(readMissing || worker.status()!=='ACTIVE' || !worker.stored())return {data:{kind:'unavailable'},error:null};
      const plan=JSON.parse(Buffer.from(worker.stored()!,'hex').toString('utf8'));
      return {data:{kind:'ready',contract:generationPlanReadbackContractV2,account_id:account,request_operation_id:request,
        selection_id:plan.selectionId,plan_revision:plan.proposedPlanRevision,generation_operation_id:id(900),activation_operation_id:id(901),
        graph_digest_hex:plan.graphDigest,graph:plan.graph},error:null};
    }};
  const make=()=>new GenerationRequestFlowV2(client,()=>gate,()=>{counts.keys++;return key;});
  const flow=make();flow.attach(account,worker.f.plan.weekStartLocal,worker.f.plan.timezone);
  return {worker,account,request,key,flow,calls,counts,make,
    loseRequest:()=>{requestLost=true;},missRead:()=>{readMissing=true;},setUser:(v:string|null)=>{user=v;},
    setGate:(v:boolean)=>{gate=v;},setHook:(v:(name:string)=>Promise<void>)=>{hook=v;}};
}
test('one request -> real catalog/day/week/projection/independent validation/worker -> exact menu and seven-day view',async()=>{
  const h=await harness({unknownYield:true});await h.flow.start();
  assert.equal(h.flow.snapshot().phase,'pending');assert.equal(h.counts.created,1);
  assert.equal(h.calls.some(c=>c.name.includes('read_generation_plan')),false);
  await h.worker.run();await h.flow.refresh();const s=h.flow.snapshot();
  assert.equal(s.phase,'ready');assert.equal(s.entry.model?.graphDigest,JSON.parse(h.worker.expected).graphDigest);
  assert.deepEqual(s.entry.model?.graph,JSON.parse(h.worker.expected).graph);
  for(const day of s.entry.model!.graph.days)for(const slot of day.slots)for(const c of slot.mealSnapshot.components)assert.equal(c.assignedPortion.assignedGrams,null);
  const html=renderToStaticMarkup(GenerationFlowViewV2({state:s,onStart:()=>undefined,onRefresh:()=>undefined}));
  assert.equal((html.match(/<details/g)||[]).length,7);assert.match(html,/КБЖУ рассчитаны по составу/);
  assert.equal(h.worker.counts.records,1);assert.equal(h.worker.counts.activations,1);assert.equal(h.worker.counts.authority,2);
  assert.deepEqual(h.calls.map(c=>c.name),['adaptive_nutrition_request_generation_v2','adaptive_nutrition_generation_status_v2','adaptive_nutrition_read_generation_plan_v2']);
});
test('lost initial reply restores the same key and resolves the same request without duplicate creation',async()=>{
  const h=await harness();h.loseRequest();await h.flow.start();assert.equal(h.flow.snapshot().phase,'unknown');
  const saved=h.flow.recovery()!;assert.equal(saved.requestOperationId,null);assert.equal(saved.idempotencyKey,h.key);
  h.flow.stop();const resumed=h.make();resumed.restore(saved);await resumed.refresh();
  assert.equal(resumed.snapshot().phase,'pending');assert.equal(resumed.snapshot().requestOperationId,h.request);
  assert.equal(h.counts.created,1);assert.equal(h.counts.keys,1);
  await h.worker.run();await resumed.refresh();assert.equal(resumed.snapshot().phase,'ready');
});
test('lost record reply resumes worker persistence once, then opens only after activation',async()=>{
  const h=await harness({recordLostReply:true});await h.flow.start();await assert.rejects(h.worker.run(),/RPC_FAILED/);
  await h.flow.refresh();assert.equal(h.flow.snapshot().phase,'pending');assert.equal(h.worker.counts.records,1);
  await h.worker.run();await h.flow.refresh();assert.equal(h.flow.snapshot().phase,'ready');
  assert.equal(h.worker.counts.source,1);assert.equal(h.worker.counts.records,1);assert.equal(h.worker.counts.activations,1);
});
test('lost activation reply is recovered by status/read; no second activation or generation',async()=>{
  const h=await harness({activationLostReply:true});await h.flow.start();await assert.rejects(h.worker.run(),/RPC_FAILED/);
  await h.flow.refresh();assert.equal(h.flow.snapshot().phase,'ready');await h.worker.run();
  assert.equal(h.worker.counts.activations,1);assert.equal(h.worker.counts.records,1);assert.equal(h.worker.counts.source,1);
});
test('ACTIVE without confirmed readback does not render a menu or start a replacement request',async()=>{
  const h=await harness();await h.flow.start();await h.worker.run();h.missRead();await h.flow.refresh();
  assert.equal(h.flow.snapshot().phase,'unavailable');assert.equal(h.flow.snapshot().entry.model,null);
  await h.flow.start();assert.equal(h.counts.created,1);assert.equal(h.counts.keys,1);
});
test('conflicted persistence remains terminal and does not attempt menu read',async()=>{
  const h=await harness({recordConflict:true});await h.flow.start();await h.worker.run();await h.flow.refresh();
  assert.equal(h.flow.snapshot().phase,'conflict');assert.equal(h.flow.snapshot().entry.model,null);
  assert.equal(h.calls.some(c=>c.name==='adaptive_nutrition_read_generation_plan_v2'),false);
  assert.equal(h.worker.counts.activations,0);
});
test('rejected request remains terminal and never opens a menu',async()=>{
  const h=await harness({initialStatus:'REJECTED'});await h.flow.start();assert.equal(h.flow.snapshot().phase,'rejected');
  assert.equal(h.calls.length,1);assert.equal(h.flow.snapshot().entry.model,null);
});
test('missing independent acceptance prevents record, activation and ready view',async()=>{
  const h=await harness({revokeBeforeRecord:true});await h.flow.start();await assert.rejects(h.worker.run(),/GENERATION_VALIDATION_BLOCKED/);
  await h.flow.refresh();assert.equal(h.flow.snapshot().phase,'pending');assert.equal(h.flow.snapshot().entry.model,null);
  assert.equal(h.worker.counts.records,0);assert.equal(h.worker.counts.activations,0);
});
test('account or read gate loss during status discards ready response before readback',async()=>{
  for(const mode of ['account','gate']){
    const h=await harness();await h.flow.start();await h.worker.run();
    h.setHook(async name=>{if(name==='adaptive_nutrition_generation_status_v2'){if(mode==='account')h.setUser(id(999));else h.setGate(false);}});
    await h.flow.refresh();assert.equal(h.flow.snapshot().phase,'denied');assert.equal(h.flow.snapshot().entry.model,null);
    assert.equal(h.calls.some(c=>c.name==='adaptive_nutrition_read_generation_plan_v2'),false);
  }
});
test('stop while requesting retains original key but cannot publish late response',async()=>{
  const h=await harness();let release!:()=>void,entered!:()=>void;
  const waiting=new Promise<void>(r=>{release=r;}),started=new Promise<void>(r=>{entered=r;});
  h.setHook(async name=>{if(name==='adaptive_nutrition_request_generation_v2'){entered();await waiting;}});
  const pending=h.flow.start();await started;h.flow.stop();release();await pending;
  assert.equal(h.flow.snapshot().phase,'idle');
  h.flow.attach(h.account,h.worker.f.plan.weekStartLocal,h.worker.f.plan.timezone);await h.flow.refresh();
  assert.equal(h.counts.created,1);assert.equal(h.counts.keys,1);assert.equal(h.flow.snapshot().requestOperationId,h.request);
});

test('uncertain and terminal views never offer a new request or render a menu',()=>{
  for(const phase of ['unknown','pending','rejected','conflict','denied'] as const){
    const html=renderToStaticMarkup(GenerationFlowViewV2({state:{phase,requestOperationId:id(44),entry:{phase:'idle',model:null,slots:[]}},
      onStart:()=>undefined,onRefresh:()=>undefined}));
    assert.doesNotMatch(html,/<details|Составить меню/);
    if(phase==='unknown'||phase==='pending')assert.match(html,/Проверить результат/);
  }
});
