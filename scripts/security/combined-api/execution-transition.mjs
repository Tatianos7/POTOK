// Synthetic loopback CI only: actual client service + locked Supabase SDK + real Auth/REST.
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {createClient} from '@supabase/supabase-js';
import ts from 'typescript';
import {PA,PB} from '../program-reads/fixture.mjs';

export async function checkExecutionTransition({phase,a,b,status,localFetch,request}) {
  assert.equal(process.env.GITHUB_ACTIONS,'true');
  assert.equal(status.API_URL,'http://127.0.0.1:54321');
  assert(['before','after'].includes(phase));
  const exports={};
  const source=await readFile('src/services/programExecutionService.ts','utf8');
  new Function('require','exports',ts.transpileModule(source,{compilerOptions:{target:ts.ScriptTarget.ES2022,module:ts.ModuleKind.CommonJS}}).outputText)(id=>{assert.equal(id,'../lib/supabaseClient');return{supabase:null};},exports);
  function service(user,swap=false) {
    let authCalls=0,patches=0;
    const sdk=createClient(status.API_URL,status.ANON_KEY,{auth:{persistSession:false,autoRefreshToken:false,detectSessionInUrl:false},global:{headers:{Authorization:'Bearer '+user.token},fetch:async(url,options)=>{
      const target=new URL(url);assert.equal(target.origin,status.API_URL);assert.equal(target.pathname,'/rest/v1/program_sessions');
      if(options?.method==='PATCH')patches++;
      return localFetch(url,options);
    }}});
    const client={from:sdk.from.bind(sdk),auth:{getUser:async()=>{
      const actor=swap&&authCalls++>0?b:user;
      const response=await localFetch(status.API_URL+'/auth/v1/user',{headers:{apikey:status.ANON_KEY,Authorization:'Bearer '+actor.token}});
      assert.equal(response.status,200);return{data:{user:await response.json()},error:null};
    }}};
    return {execution:new exports.ProgramExecutionService(client),patches:()=>patches};
  }
  const input={programId:PA,date:'2026-10-26',programType:'nutrition',reason:'fatigue'};
  const before=await request('program_sessions?id=eq.'+PA,a);assert.equal(before.status,200);assert.equal(before.body.length,1);
  if(phase==='before') {
    const f=service(a);
    for(const action of ['planned','completed','skipped'])await assert.rejects(()=>f.execution.annotate({...input,status:action}),error=>error.code==='PROGRAM_EXECUTION_UNAVAILABLE');
    assert.equal(f.patches(),0);
    assert.deepEqual((await request('program_sessions?id=eq.'+PA,a)).body,before.body);
    console.log('PROGRAM_EXECUTION_OLD_SCHEMA_HTTP_OK: new client performs no PATCH against old session schema');
    return;
  }
  const own=service(a);
  for(const action of ['planned','completed','skipped']) {
    const receipt=await own.execution.annotate({...input,status:action});assert.equal(receipt.userId,a.id);assert.equal(receipt.sessionId,PA);
    const saved=await request('program_sessions?id=eq.'+PA,a);assert.equal(saved.status,200);
    assert.equal(saved.body[0].status,action);assert.equal(saved.body[0].execution_reason,action==='skipped'?'fatigue':null);
    assert.deepEqual(saved.body[0].plan_payload,before.body[0].plan_payload);assert.equal(saved.body[0].day_date,before.body[0].day_date);
  }
  assert.equal(own.patches(),3);
  const foreign=service(b);await assert.rejects(()=>foreign.execution.annotate({...input,status:'skipped'}),error=>error.code==='PROGRAM_SESSION_NOT_AVAILABLE');assert.equal(foreign.patches(),0);
  const switched=service(a,true);await assert.rejects(()=>switched.execution.annotate({...input,status:'skipped'}),error=>error.code==='PROGRAM_EXECUTION_ACCOUNT_CHANGED');assert.equal(switched.patches(),0);
  // Both legitimate account scopes work; this does not grant entitlement/issuer authority.
  const ownB=service(b);assert.equal((await ownB.execution.annotate({...input,programId:PB,status:'planned'})).userId,b.id);
  const payload=await request('program_sessions?id=eq.'+PA,a,'PATCH',{plan_payload:{forged:true}});assert.equal(payload.status,403);assert.equal(payload.body.code,'42501');
  console.log('PROGRAM_EXECUTION_TRANSITION_HTTP_OK: real SDK/Auth/REST; own start/complete/skip, foreign/account-switch denial, original payload and day_date preserved');
}
