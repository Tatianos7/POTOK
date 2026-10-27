import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import test from 'node:test';
import vm from 'node:vm';
const {default:ts}=await import(process.env.POTOK_AUDIT_TYPESCRIPT_MODULE||'typescript');
function load(name,deps={}){
 const source=readFileSync(new URL('../../../src/services/'+name+'.ts',import.meta.url),'utf8');
 const compiled=ts.transpileModule(source,{compilerOptions:{target:ts.ScriptTarget.ES2022,module:ts.ModuleKind.CommonJS}}).outputText;
 const exports={};vm.runInNewContext(compiled,{exports,console,require(id){assert(id in deps,'Unexpected runtime dependency '+id);return deps[id];}});return exports;
}
function fixture({paid=true,writeError=null}={}){
 const calls=[];const supabase={auth:{getUser:async()=>({data:{user:{id:'A'}},error:null})},from(table){
  const call={table};calls.push(call);const q={update(value){call.op='update';call.value=value;return q;},insert(value){call.op='insert';call.value=value;return q;},upsert(value){call.op='upsert';call.value=value;return q;},select(value){if(!call.op){call.op='select';call.value=value;}return q;},eq(){return q;},limit(value){call.limit=value;return q;},maybeSingle(){return Promise.resolve({data:{trust_score:50},error:null});},then(resolve,reject){return Promise.resolve({data:call.op==='update'?[{id:'11111111-1111-4111-8111-111111111111'}]:call.limit===2?[{id:'11111111-1111-4111-8111-111111111111',session_type:'meal_plan'}]:[],error:call.op!=='select'?writeError:null}).then(resolve,reject);}};return q;
 }};
 const execution=load('programExecutionService',{'../lib/supabaseClient':{supabase}}).programExecutionService;
 const service=load('programDeliveryService',{'./programExecutionService':{programExecutionService:execution},'../lib/supabaseClient':{supabase},'./entitlementService':{entitlementService:{canAdaptProgram:async id=>{assert.equal(id,'A');return paid;}}},'./profileService':{profileService:{getProfile(){assert.fail('Raw profile must not authorize feedback');}}}}).programDeliveryService;
 return {service,calls};
}
test('all three legacy mutation entry points reject before dependency imports or IO',async()=>{
 const {programGenerationService:s,LEGACY_PROGRAM_MUTATIONS_AVAILABLE:available}=load('programGenerationService');assert.equal(available,false);
 for(const run of [()=>s.generateProgram({userId:'A',entitlement:'coach'}),()=>s.replanProgram('p','nutrition',{}),()=>s.adaptProgram({programId:'p',programType:'nutrition'})])await assert.rejects(run,e=>e.code==='PROGRAM_MUTATION_CHANNEL_NOT_BOUND');
});
test('skip records a bounded reason, preserves plan_payload and never adapts',async()=>{
 const f=fixture();assert.equal((await f.service.skipDay('p','2026-10-26','nutrition','fatigue')).adaptationApplied,false);
 const writes=f.calls.filter(c=>c.op!=='select');assert.deepEqual(Object.keys(writes[0].value).sort(),['execution_reason','status']);assert.equal(writes[0].value.execution_reason,'fatigue');
 assert(writes.every(c=>['program_sessions','ai_trust_scores'].includes(c.table)));
});
test('start and complete clear execution reason without replacing plan content',async()=>{
 for(const action of ['startDay','completeDay']){const f=fixture();await f.service[action]('p','2026-10-26','nutrition');const write=f.calls.find(c=>c.table==='program_sessions'&&c.op==='update');assert.equal(write.value.execution_reason,null);assert.equal('plan_payload' in write.value,false);assert(!f.calls.some(c=>['program_days','program_versions','program_adaptations','food_diary_entries'].includes(c.table)));}
});
test('failed session update stops downstream annotation work',async()=>{
 const f=fixture({writeError:new Error('synthetic deny')});await assert.rejects(()=>f.service.skipDay('p','2026-10-26','nutrition'),/synthetic deny/);assert.equal(f.calls.filter(c=>c.op==='update').length,1);assert(f.calls.every(c=>c.table==='program_sessions'));
});
test('feedback requires verified entitlement and saves annotation without promising adaptation',async()=>{
 const denied=fixture({paid:false});await assert.rejects(()=>denied.service.submitFeedback({programId:'p',programType:'nutrition'}),/Недостаточно прав/);assert.equal(denied.calls.length,0);
 const f=fixture();const result=await f.service.submitFeedback({programId:'p',programType:'nutrition',energy:3});assert.equal(result.feedbackSaved,true);assert.equal(result.adaptationApplied,false);assert.deepEqual(f.calls.map(c=>c.table),['program_feedback']);
});
test('feedback write errors propagate without a success receipt',async()=>{
 const f=fixture({writeError:new Error('synthetic feedback deny')});await assert.rejects(()=>f.service.submitFeedback({programId:'p',programType:'nutrition'}),/synthetic feedback deny/);
});
