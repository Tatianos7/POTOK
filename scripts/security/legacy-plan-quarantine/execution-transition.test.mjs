import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import test from 'node:test';
import vm from 'node:vm';
import ts from 'typescript';
const ID = '11111111-1111-4111-8111-111111111111';
function fixture({probeError=null, probeErrors=[], targetError=null, rows=[{id:ID,session_type:'meal_plan'}], saved=[{id:ID}], writeError=null, actors=['A','A']}={}) {
  const calls=[];let authCalls=0, probes=0;
  const client={auth:{getUser:async()=>({data:{user:actors[Math.min(authCalls++,actors.length-1)]?{id:actors[Math.min(authCalls-1,actors.length-1)]}:null},error:null})},from(table){
    const call={table,filters:[]};calls.push(call);
    const q={select(columns){call.columns=columns;return q;},update(value){call.value=value;return q;},eq(column,value){call.filters.push([column,value]);return q;},limit(n){call.limit=n;return q;},then(resolve,reject){
      const result=call.value?{data:saved,error:writeError}:call.limit===0?{data:[],error:probeErrors.length?probeErrors[probes++]:probeError}:{data:rows,error:targetError};
      return Promise.resolve(result).then(resolve,reject);
    }};return q;
  }};
  const exports={};vm.runInNewContext(ts.transpileModule(readFileSync('src/services/programExecutionService.ts','utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022}}).outputText,{exports,require(id){assert.equal(id,'../lib/supabaseClient');return{supabase:client};}});
  return {service:exports.programExecutionService,calls,authCalls:()=>authCalls};
}
const input={programId:'p',date:'2026-10-26',status:'skipped',programType:'nutrition',reason:'fatigue'};
const code=value=>error=>error.code===value;
const mutations=f=>f.calls.filter(c=>c.value);
test('old schema, stale GET cache, permission failure and offline probe cause no mutations',async()=>{
  for(const failure of ['42703','PGRST204','42501','FETCH_ERROR']) {
    const f=fixture({probeError:{code:failure}});await assert.rejects(()=>f.service.annotate(input),code('PROGRAM_EXECUTION_UNAVAILABLE'));
    assert.equal(mutations(f).length,0);assert.equal(f.calls.length,1);assert.equal(f.calls[0].limit,0);
  }
});
test('missing authentication causes no REST access',async()=>{const f=fixture({actors:[null]});await assert.rejects(()=>f.service.annotate(input),/не авторизован/);assert.equal(f.calls.length,0);});
test('foreign, missing, duplicate or malformed session never reaches PATCH',async()=>{
  for(const rows of [[],[{id:ID,session_type:'meal_plan'},{id:ID,session_type:'workout_plan'}],[{id:'forged',session_type:'meal_plan'}],[{id:ID,session_type:'forged'}],[{id:ID,session_type:'workout_plan'}]]) {
    const f=fixture({rows});await assert.rejects(()=>f.service.annotate(input),code('PROGRAM_SESSION_NOT_AVAILABLE'));assert.equal(mutations(f).length,0);
  }
});
test('account switch or logout before write prevents PATCH',async()=>{
  for(const actor of ['B',null]) {const f=fixture({actors:['A',actor]});await assert.rejects(()=>f.service.annotate(input),code('PROGRAM_EXECUTION_ACCOUNT_CHANGED'));assert.equal(mutations(f).length,0);}
});
test('failed target lookup is not converted into missing data or a retry',async()=>{const f=fixture({targetError:{code:'FETCH_ERROR'}});await assert.rejects(()=>f.service.annotate(input),code('FETCH_ERROR'));assert.equal(mutations(f).length,0);});
test('PATCH cache lag or revoked rights never fall back to legacy payload or retry',async()=>{
  for(const error of ['PGRST204','42703','42501']) {const f=fixture({writeError:{code:error}});await assert.rejects(()=>f.service.annotate(input),code('PROGRAM_EXECUTION_UNAVAILABLE'));assert.equal(mutations(f).length,1);assert.deepEqual(Object.keys(mutations(f)[0].value).sort(),['execution_reason','status']);}
});
test('zero rows, wrong receipt and unknown response never report success',async()=>{
  for(const saved of [[],null,[{id:'other'}],[{id:ID},{id:ID}]]) {const f=fixture({saved});await assert.rejects(()=>f.service.annotate(input),code('PROGRAM_EXECUTION_NOT_CONFIRMED'));assert.equal(mutations(f).length,1);}
  const f=fixture({writeError:{code:'FETCH_ERROR'}});await assert.rejects(()=>f.service.annotate(input),code('FETCH_ERROR'));assert.equal(mutations(f).length,1);
});
test('own action has a bounded patch and exact row/program/date/type filters',async()=>{
  for(const status of ['planned','completed','skipped']) {const f=fixture();const result=await f.service.annotate({...input,status});assert.equal(result.userId,'A');assert.equal(result.sessionId,ID);
    const write=mutations(f)[0];assert.equal(write.value.status,status);assert.equal(write.value.execution_reason,status==='skipped'?'fatigue':null);assert.equal(write.columns,'id');
    assert.equal(JSON.stringify(write.filters),JSON.stringify([['id',ID],['program_id','p'],['date','2026-10-26'],['session_type','meal_plan']]));
  }
});
test('readiness is rechecked each time, never cached across a failed transition',async()=>{
  const f=fixture({probeErrors:[null,{code:'42703'}]});await f.service.annotate(input);await assert.rejects(()=>f.service.annotate(input),code('PROGRAM_EXECUTION_UNAVAILABLE'));assert.equal(mutations(f).length,1);assert.equal(f.calls.filter(c=>c.limit===0).length,2);
});
test('runtime-forged status/type/reason rejects before any auth or IO',async()=>{
  for(const patch of [{status:'adapted'},{programType:'forged'},{reason:'forged'}]) {const f=fixture();await assert.rejects(()=>f.service.annotate({...input,...patch}),/Некорректное/);assert.equal(f.calls.length,0);assert.equal(f.authCalls(),0);}
});
