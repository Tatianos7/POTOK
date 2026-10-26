import assert from 'node:assert/strict';
import {spawnSync} from 'node:child_process';
import {readFile} from 'node:fs/promises';
import {fileURLToPath} from 'node:url';
import ts from 'typescript';
import {login,localFetch,status} from '../data-api-explicit-grants/local-auth.mjs';
import {DRAFT,REVIEW} from '../catalog-authority/fixture.mjs';
function prepare(mode,a,b){const r=spawnSync(process.execPath,[fileURLToPath(new URL('./local-prepare.mjs',import.meta.url)),mode,a,b],{encoding:'utf8',timeout:120000});if(r.status!==0)console.error(r.stderr);assert.equal(r.status,0,'Authority/profile '+mode);}
async function request(route,user,method='GET',body){const r=await localFetch(status.API_URL+'/rest/v1/'+route,{method,headers:{apikey:status.ANON_KEY,Authorization:'Bearer '+(user?.token??status.ANON_KEY),'Content-Type':'application/json',Prefer:'return=representation,resolution=merge-duplicates'},...(body===undefined?{}:{body:JSON.stringify(body)})});const s=await r.text();return{status:r.status,body:s?JSON.parse(s):null};}
const rpc=(name,user,body={})=>request('rpc/'+name,user,'POST',body);
async function ok(p,expected=200){const r=await p;assert.equal(r.status,expected,'Authority/profile HTTP status='+r.status+' code='+(r.body?.code??'none'));return r.body;}
async function denied(p){const r=await p;assert([401,403].includes(r.status));assert.equal(r.body?.code,'42501');}
const source=await readFile('src/services/adminAccessService.ts','utf8');
const javascript=ts.transpileModule(source,{compilerOptions:{target:ts.ScriptTarget.ES2022,module:ts.ModuleKind.CommonJS}}).outputText;
const module={exports:{}};new Function('require','exports',javascript)(id=>{assert.equal(id,'../lib/supabaseClient');return{supabase:null};},module.exports);
function service(user){return new module.exports.AdminAccessService({auth:{getUser:async()=>{const r=await localFetch(status.API_URL+'/auth/v1/user',{headers:{apikey:status.ANON_KEY,Authorization:'Bearer '+user.token}});assert.equal(r.status,200);return{data:{user:await r.json()},error:null};}},rpc:async(name,args)=>{const r=await rpc(name,user,args);return{data:r.body,error:r.status===200?null:{message:'local RPC failed'}};}});}
let stage='OTP';
try{
 const a=await login('authority-profile-a@example.test'),b=await login('authority-profile-b@example.test');prepare('fixture',a.id,b.id);
 for(let n=0;;n++){const r=await rpc('has_verified_entitlement_v1',a,{p_capability:'admin'});if(r.status===200)break;assert.equal(r.body?.code,'PGRST202');assert(n<39);await new Promise(resolve=>setTimeout(resolve,250));}
 stage='empty authority';const sa=service(a),sb=service(b);assert.equal((await sa.getVerifiedCurrentUserCapabilities(a.id)).admin,false);assert.equal((await sb.getVerifiedCurrentUserCapabilities(b.id)).admin,false);
 const beforeA=await ok(request('food_diary_entries',a)),beforeB=await ok(request('food_diary_entries',b));
 stage='profile';const upsert=await request('user_profiles?on_conflict=id_user',a,'POST',{id_user:a.id,first_name:'Saved API',coach_settings:{mode:'off'},voice_settings:{enabled:false}});assert([200,201].includes(upsert.status));assert.equal(upsert.body[0].first_name,'Saved API');assert.equal(upsert.body[0].coach_settings.mode,'off');
 assert.deepEqual(await ok(request('user_profiles?id_user=eq.'+a.id,b)),[]);
 await denied(request('user_profiles?id_user=eq.'+a.id,a,'PATCH',{is_admin:false}));
 stage='grant';prepare('grant',a.id,b.id);assert.equal((await sb.getVerifiedCurrentUserCapabilities(b.id)).admin,true);assert.equal((await sb.getVerifiedCurrentUserCapabilities(b.id)).premium,false);assert.equal((await sa.getVerifiedCurrentUserCapabilities(a.id)).admin,false);
 assert.equal((await ok(rpc('apply_owner_approved_missing_food_draft',a,{p_draft_id:DRAFT})))[0].result,'permission_denied');
 assert.equal((await ok(rpc('apply_owner_approved_missing_food_draft',b,{p_draft_id:DRAFT})))[0].result,'applied');
 assert.equal((await ok(rpc('apply_admin_approved_food_alias',b,{p_review_id:REVIEW})))[0].result,'applied');
 stage='server boundaries';await denied(rpc('has_verified_entitlement_v1',null,{p_capability:'admin'}));
 const foreignArgument=await rpc('has_verified_entitlement_v1',a,{p_account_id:b.id,p_capability:'admin'});assert.equal(foreignArgument.status,404);assert.equal(foreignArgument.body?.code,'PGRST202');
 stage='revocation';prepare('revoke',a.id,b.id);assert.equal((await sb.getVerifiedCurrentUserCapabilities(b.id)).admin,false);assert.equal((await ok(rpc('apply_owner_approved_missing_food_draft',b,{p_draft_id:DRAFT})))[0].result,'permission_denied');
 assert.deepEqual(await ok(request('food_diary_entries',a)),beforeA);assert.deepEqual(await ok(request('food_diary_entries',b)),beforeB);assert.equal((await ok(request('user_profiles',b)))[0].is_admin,false);prepare('verify',a.id,b.id);
 console.log('AUTHORITY_PROFILE_HTTP_OK: actual AdminAccessService, real Auth/JWT/PostgREST, owner-issued grant/revoke, profile and actual catalog RPC; no profile projection');
}catch(e){console.error('AUTHORITY_PROFILE_HTTP_FAILED stage='+stage+' reason='+e.message);process.exitCode=1;}
