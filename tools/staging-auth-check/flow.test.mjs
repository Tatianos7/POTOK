import test from 'node:test';
import assert from 'node:assert/strict';
import {createAcceptanceFlow,validPublicKey,STAGING_ORIGIN,CLOSED_CALLS} from './flow.mjs';
function fixture(overrides={}){
 const calls=[];
 const client={auth:{
  signInWithOtp:async value=>{calls.push(['send',value]);return {error:null};},
  verifyOtp:async value=>{calls.push(['verify',value]);return {data:{session:{access_token:'synthetic-session-only',refresh_token:'synthetic-refresh-only'}},error:null};},
  getUser:async()=>{calls.push(['getUser']);return {data:{user:{id:'synthetic-id',is_anonymous:false}},error:null};},
  signOut:async value=>{calls.push(['signOut',value]);return {error:null};},...overrides.auth},
  rpc:async(name,args,options)=>{calls.push(['rpc',name,args,options]);return name==='has_verified_entitlement_v2'?{data:false,error:null,status:200}:{data:null,error:{code:'PGRST202'},status:404};},...overrides.client};
 return {client,calls};
}
test('only Staging public configuration is accepted; secret/service-role and foreign project keys are rejected',()=>{
 const jwt=claims=>['header',btoa(JSON.stringify(claims)).replace(/=/g,''),'signature'].join('.');
 assert.equal(STAGING_ORIGIN,'https://ozidryfvhkcbtpnulakq.supabase.co');
 assert.ok(validPublicKey('sb_publishable_synthetic_test_only_123'));
 assert.ok(validPublicKey(jwt({role:'anon',ref:'ozidryfvhkcbtpnulakq'})));
 for(const k of ['',undefined,'sb_secret_synthetic',jwt({role:'service_role',ref:'ozidryfvhkcbtpnulakq'}),jwt({role:'anon',ref:'production'})])assert.equal(validPublicKey(k),false);
});
test('sending is explicit, single-flight and cooldown-bound, with no automatic initial request',async()=>{
 let time=1000;const f=fixture(),flow=createAcceptanceFlow({client:f.client,now:()=>time});
 assert.equal(f.calls.length,0);
 await assert.rejects(flow.send('test@example.invalid',false),/EMAIL_REQUIRED/);
 const pending=flow.send(' test@example.invalid ',true);
 await assert.rejects(flow.send('test@example.invalid',true),/BUSY/);await pending;
 assert.deepEqual(f.calls[0],['send',{email:'test@example.invalid',options:{shouldCreateUser:false}}]);
 await assert.rejects(flow.send('test@example.invalid',true),/COOLDOWN/);
 time+=60000;await flow.send('test@example.invalid',true);
 assert.equal(f.calls.filter(c=>c[0]==='send').length,2);
});
test('actual Auth validation precedes read-only RPC probes; summary contains no email, code, identity or tokens',async()=>{
 const f=fixture(),flow=createAcceptanceFlow({client:f.client});
 await flow.send('test@example.invalid',true);await flow.verify('123456');
 assert.equal(flow.summary().phase,'done');assert.equal(flow.summary().report.closedRpcCount,7);
 assert.equal(flow.summary().report.accountState,'NOT_CHECKED');
 assert.equal(flow.summary().report.serverRegistration,'NOT_TESTED_EXISTING_LOGIN');
 assert.ok(f.calls.findIndex(c=>c[0]==='getUser')<f.calls.findIndex(c=>c[0]==='rpc'));
 assert.ok(f.calls.filter(c=>c[0]==='rpc').every(c=>c[3].get===true));
 const safe=JSON.stringify(flow.summary());
 for(const v of ['test@example.invalid','123456','synthetic-id','synthetic-session','synthetic-refresh'])assert.ok(!safe.includes(v));
 await flow.finish();assert.deepEqual(f.calls.at(-1),['signOut',{scope:'local'}]);
 assert.equal(flow.summary().phase,'closed');
});
test('an unverified or anonymous session cannot run probes; finish remains available after a verified-OTP handoff',async()=>{
 for(const response of [{data:{user:{id:'x',is_anonymous:true}}},{data:{user:null},error:{message:'untrusted secret'}}]){
  const f=fixture({auth:{getUser:async()=>response}}),flow=createAcceptanceFlow({client:f.client});
  await flow.send('test@example.invalid',true);await assert.rejects(flow.verify('123456'),/SESSION_UNVERIFIED/);
  assert.equal(flow.summary().phase,'checks');assert.equal(f.calls.filter(c=>c[0]==='rpc').length,0);
  await assert.rejects(flow.send('another@example.invalid',true),/STATE_INVALID/);
  await flow.finish();assert.equal(flow.summary().phase,'closed');
 }
});
test('unexpected privilege, expiry, missing authentication or an opened RPC never passes',async()=>{
 for(const result of [{data:true,status:200,error:null},{data:null,status:401,error:{code:'42501'}},{data:null,status:405,error:{code:'25006'}},{data:{},status:200,error:null}]){
  const f=fixture(),original=f.client.rpc;
  f.client.rpc=async(name,...args)=>name==='has_verified_entitlement_v2'?(result.data===true?result:original(name,...args)):result;
  const flow=createAcceptanceFlow({client:f.client,intent:'signup'});await flow.send('test@example.invalid',true);
  await assert.rejects(flow.verify('123456'),/RIGHTS_UNVERIFIED|RPC_UNVERIFIED/);
  assert.equal(flow.summary().report.completed,false);await flow.finish();
 }
});
test('existing login reads existing privileges without treating them as a new grant or new registration',async()=>{
 const f=fixture();const original=f.client.rpc;
 f.client.rpc=async(name,...args)=>name==='has_verified_entitlement_v2'?{data:true,error:null,status:200}:original(name,...args);
 const flow=createAcceptanceFlow({client:f.client});await flow.send('test@example.invalid',true);await flow.verify('123456');
 assert.equal(flow.summary().report.completed,true);
 assert.deepEqual(flow.summary().report.existingRights,{admin:true,premium:true});
 assert.equal(flow.summary().report.normalRights,false);
 assert.equal(flow.summary().report.serverRegistration,'NOT_TESTED_EXISTING_LOGIN');
 assert.equal(f.calls[0][1].options.shouldCreateUser,false);
});
test('delivery/OTP errors are sanitized; invalid input and transport failures do not start probes',async()=>{
 const f=fixture({auth:{signInWithOtp:async()=>({error:{status:429,message:'private transport body'}})}});
 await assert.rejects(createAcceptanceFlow({client:f.client}).send('test@example.invalid',true),/^Error: RATE_LIMIT$/);
 const g=fixture(),flow=createAcceptanceFlow({client:g.client});await flow.send('test@example.invalid',true);
 await assert.rejects(flow.verify('bad'),/CODE_INVALID/);assert.equal(g.calls.filter(c=>c[0]==='verify').length,0);
});
test('write-shaped endpoints are probed only with GET and inert arguments; no valid close or review proposal exists',()=>{
 assert.equal(CLOSED_CALLS.length,7);
 for(const [name,args] of CLOSED_CALLS.filter(([name])=>name.endsWith('review_v1')||name==='account_closure_begin_v1'))assert.deepEqual(args,{p_request_text:null});
});
