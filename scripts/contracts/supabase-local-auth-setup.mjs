import assert from 'node:assert/strict';
import {execFileSync} from 'node:child_process';
const status=JSON.parse(execFileSync('supabase',['status','-o','json'],{encoding:'utf8'}));
const url=status.API_URL;
const anon=status.ANON_KEY;
const service=status.SERVICE_ROLE_KEY;
assert(url && anon && service,'Local Supabase status missing API credentials');
assert(new URL(url).hostname === '127.0.0.1' || new URL(url).hostname === 'localhost',
 'Only localhost Supabase is allowed');
async function post(path, key, data) {
 const r=await fetch(new URL(path,url),{
  method:'POST',headers:{apikey:key,Authorization:`Bearer ${key}`,'Content-Type':'application/json',
   Prefer:'return=representation'},body:JSON.stringify(data)});
 const raw=await r.text();
 if(!r.ok) throw new Error(`Local fixture setup HTTP ${r.status}: ${raw}`);
 return JSON.parse(raw);
}
const users=[];
for(const suffix of ['a','b','c']){
 const email=`potok-ci-${suffix}@example.invalid`;
 const password='Potok-ci-Only-2026!';
 const created=await post('/auth/v1/admin/users',service,{email,password,email_confirm:true});
 assert(created.id,'Auth user ID absent');
 if(suffix !== 'c') await post('/rest/v1/user_profiles',service,{id_user:created.id,first_name:suffix});
 const token=await post('/auth/v1/token?grant_type=password',anon,{email,password});
 assert(token.access_token,'Auth access token absent');
 users.push({id:created.id,jwt:token.access_token});
}
// Disposable evidence fixtures: A is Free, B has a seeded Premium entitlement.
const programA=crypto.randomUUID();
const programB=crypto.randomUUID();
await post('/rest/v1/nutrition_programs',service,{id:programA,user_id:users[0].id});
await post('/rest/v1/nutrition_programs',service,{id:programB,user_id:users[1].id});
await post('/rest/v1/program_explainability',service,{program_id:programA,program_type:'nutrition',decision_ref:'fixture-free'});
await post('/rest/v1/program_explainability',service,{program_id:programB,program_type:'nutrition',decision_ref:'fixture-premium'});
await post('/rest/v1/entitlements',service,{user_id:users[1].id,tier:'pro',flags:{can_explain:true}});
Object.assign(process.env,{
 POTOK_TEST_SUPABASE_URL:url,POTOK_TEST_ANON_KEY:anon,
 POTOK_TEST_SERVICE_ROLE_KEY:service,
 POTOK_TEST_USER_A_ID:users[0].id,POTOK_TEST_USER_B_ID:users[1].id,
 POTOK_TEST_USER_A_JWT:users[0].jwt,POTOK_TEST_USER_B_JWT:users[1].jwt,
 POTOK_TEST_USER_C_ID:users[2].id,POTOK_TEST_USER_C_JWT:users[2].jwt,
 POTOK_TEST_PROGRAM_A_ID:programA,POTOK_TEST_PROGRAM_B_ID:programB,
});
await import('./supabase-auth-postgrest-acceptance.mjs');
