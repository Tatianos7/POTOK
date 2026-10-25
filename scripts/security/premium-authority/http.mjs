import assert from 'node:assert/strict';
import {spawnSync} from 'node:child_process';
import {fileURLToPath} from 'node:url';
import {localFetch,login,status} from '../data-api-explicit-grants/local-auth.mjs';
assert(status.SERVICE_ROLE_KEY,'Disposable server key missing');
const service={token:status.SERVICE_ROLE_KEY};
function prepare(mode,...ids){const r=spawnSync(process.execPath,[fileURLToPath(new URL('./local-prepare.mjs',import.meta.url)),mode,...ids],{encoding:'utf8',timeout:120000});if(r.status!==0)console.error(r.stderr);assert.equal(r.status,0,'Premium preparation '+mode);}
async function request(route,user,method='GET',body){
 const r=await localFetch(status.API_URL+'/rest/v1/'+route,{method,headers:{apikey:status.ANON_KEY,Authorization:'Bearer '+(user?.token??status.ANON_KEY),'Content-Type':'application/json',Prefer:'return=representation'},...(body===undefined?{}:{body:JSON.stringify(body)})});
 const text=await r.text();return {status:r.status,body:text?JSON.parse(text):null};
}
const rpc=(name,user,body={})=>request('rpc/'+name,user,'POST',body);
async function ok(promise,expected=200){const r=await promise;assert.equal(r.status,expected,'Premium REST status='+r.status+' code='+(r.body?.code??'none'));return r.body;}
async function denied(promise){const r=await promise;assert([401,403].includes(r.status),'Premium denial status='+r.status);assert.equal(r.body?.code,'42501');}
const tables=['entitlements','subscriptions','billing_events'];
let stage='fixture';
try{
 prepare('fixture');stage='real OTP';const a=await login('premium-a@example.test'),b=await login('premium-b@example.test');prepare('seed',a.id,b.id);
 stage='legacy reproduction';
 assert.equal((await ok(rpc('get_entitlements',a,{p_user_id:b.id}))).tier,'pro');
 await ok(request('entitlements?user_id=eq.'+a.id,a,'PATCH',{tier:'pro',flags:{can_adapt:true}}));
 assert.equal((await ok(rpc('get_entitlements',a,{p_user_id:a.id}))).tier,'pro');
 await ok(rpc('start_purchase',null,{p_user_id:b.id,p_provider:'play_store',p_plan:'pro',p_idempotency_key:'forged-by-anon'}));
 console.log('PASS real HTTP legacy own-upgrade, foreign entitlement disclosure and anonymous purchase-event forgery reproduced');
 stage='candidate';prepare('candidate',a.id,b.id);
 assert.equal((await ok(rpc('get_entitlements',a,{p_user_id:null}))).tier,'free');
 assert.equal((await ok(rpc('get_entitlements',b,{p_user_id:b.id}))).tier,'pro');
 assert.equal((await ok(rpc('get_paywall_state',a,{p_feature:'adaptation'}))).locked,true);
 assert.equal((await ok(rpc('get_paywall_state',b,{p_feature:'adaptation'}))).locked,false);
 await denied(rpc('get_entitlements',a,{p_user_id:b.id}));
 await denied(rpc('get_paywall_state',a,{p_feature:'adaptation',p_user_id:b.id}));
 console.log('PASS real HTTP guarded own free/paid reads, default user argument, paywall DTO and cross-account denial');
 stage='finance writes';
 const inserts={entitlements:{user_id:a.id,tier:'pro',flags:{can_adapt:true}},subscriptions:{user_id:a.id,plan:'pro',status:'active'},billing_events:{user_id:a.id,provider:'play_store',event_type:'forge',idempotency_key:'client-insert'}};
 const updates={entitlements:{tier:'pro'},subscriptions:{plan:'pro'},billing_events:{event_type:'forge'}};
 for(const t of tables){
   const own=await ok(request(t,a));assert.equal(own.length,1);assert.equal(own[0].user_id,a.id);
   assert.deepEqual(await ok(request(t+'?user_id=eq.'+b.id,a)),[]);
   await denied(request(t,a,'POST',inserts[t]));
   await denied(request(t+'?user_id=eq.'+a.id,a,'PATCH',updates[t]));
   await denied(request(t+'?user_id=eq.'+a.id,a,'DELETE'));
 }
 console.log('PASS real HTTP client finance INSERT/UPDATE/DELETE denied while owner reads and foreign isolation preserved');
 stage='RPC roles';
 for(const user of [null,a]){
   await denied(rpc('start_purchase',user,{p_user_id:a.id,p_provider:'play_store',p_plan:'pro',p_idempotency_key:'forged-after'}));
   await denied(rpc('restore_purchase',user,{p_user_id:a.id,p_provider:'play_store',p_receipt:'synthetic',p_idempotency_key:'forged-after'}));
 }
 for(const user of [null,service]){
   await denied(rpc('get_entitlements',user,{p_user_id:a.id}));
   await denied(rpc('get_paywall_state',user,{p_feature:'adaptation',p_user_id:a.id}));
 }
 console.log('PASS real HTTP anonymous/service entitlement denial and client purchase RPC denial');
 stage='existing server authority';
 assert.equal((await ok(rpc('start_purchase',service,{p_user_id:a.id,p_provider:'play_store',p_plan:'pro',p_idempotency_key:'trusted-after'}))).status,'started');
 assert.equal((await ok(rpc('get_entitlements',a))).tier,'free','Purchase event alone must not upgrade entitlement');
 await ok(request('entitlements?user_id=eq.'+a.id,service,'PATCH',{tier:'pro',flags:{can_adapt:true}}));
 assert.equal((await ok(rpc('get_entitlements',a))).tier,'pro');
 prepare('verify',a.id,b.id);
 console.log('PASS preserved local server DML/event capability; event-only purchase does not grant Premium');
 console.log('PREMIUM_AUTHORITY_HTTP_OK: real OTP/Auth/PostgREST; source fixture only');
}catch(error){console.error('PREMIUM_AUTHORITY_HTTP_FAILED stage='+stage+' type='+error.name+' reason='+error.message);process.exitCode=1;}
