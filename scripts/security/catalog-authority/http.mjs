import assert from 'node:assert/strict';
import {spawnSync} from 'node:child_process';
import {fileURLToPath} from 'node:url';
import {localFetch,login,status} from '../data-api-explicit-grants/local-auth.mjs';
import {FOOD,REVIEW,DRAFT} from './fixture.mjs';
function prepare(mode,a,b){const r=spawnSync(process.execPath,[fileURLToPath(new URL('./local-prepare.mjs',import.meta.url)),mode,a,b],{encoding:'utf8',timeout:120000});if(r.status!==0)console.error(r.stderr);assert.equal(r.status,0,'Catalog preparation '+mode);}
async function request(route,user,method='GET',body){const r=await localFetch(status.API_URL+'/rest/v1/'+route,{method,headers:{apikey:status.ANON_KEY,Authorization:'Bearer '+(user?.token??status.ANON_KEY),'Content-Type':'application/json',Prefer:'return=representation'},...(body===undefined?{}:{body:JSON.stringify(body)})});const text=await r.text();return{status:r.status,body:text?JSON.parse(text):null};}
const rpc=(name,user,body={})=>request('rpc/'+name,user,'POST',body);
async function ok(promise,expected=200){const r=await promise;assert.equal(r.status,expected,'Catalog REST status='+r.status+' code='+(r.body?.code??'none'));return r.body;}
async function denied(promise){const r=await promise;assert([401,403].includes(r.status),'Catalog denial status='+r.status);assert.equal(r.body?.code,'42501');}
async function waitForRpc(name,user,body){
 for(let n=0;n<40;n++){
  const r=await rpc(name,user,body);if(r.status===200)return;
  assert.equal(r.body?.code,'PGRST202','Unexpected response during schema refresh');
  await new Promise(resolve=>setTimeout(resolve,250));
 }
 throw Error('PostgREST function schema refresh timeout');
}
let stage='OTP';
try{
 const a=await login('catalog-a@example.test'),b=await login('catalog-b@example.test');prepare('fixture',a.id,b.id);
 await waitForRpc('apply_owner_approved_missing_food_draft',a,{p_draft_id:'00000000-0000-4000-8000-000000000000'});
 stage='legacy';assert.equal((await ok(rpc('apply_admin_approved_food_alias',a,{p_review_id:REVIEW})))[0].result,'applied');
 await ok(request('foods',a,'POST',{name:'forged-core',source:'core',created_by_user_id:a.id}),201);
 await ok(rpc('recompute_food_entries_for_food_ids',a,{food_ids:[FOOD]}),204);
 console.log('PASS real API reproduces legacy admin flag, direct catalog publication and history rewrite');
 stage='candidate';prepare('candidate',a.id,b.id);
 await waitForRpc('has_catalog_admin_access_v1',a,{});
 const beforeA=await ok(request('food_diary_entries',a)),beforeB=await ok(request('food_diary_entries',b));
 assert.equal(await ok(rpc('has_catalog_admin_access_v1',a)),false);assert.equal(await ok(rpc('has_catalog_admin_access_v1',b)),true);
 assert.equal((await ok(rpc('apply_owner_approved_missing_food_draft',a,{p_draft_id:DRAFT})))[0].result,'permission_denied');
 assert.equal((await ok(rpc('apply_admin_approved_food_alias',a,{p_review_id:REVIEW})))[0].result,'permission_denied');
 assert.deepEqual(await ok(request('food_missing_food_drafts',a)),[]);
 await denied(request('foods',a,'POST',{name:'forged-core',source:'core',created_by_user_id:a.id}));
 console.log('PASS legacy true flag cannot authorize catalog/RPC/review access after the candidate');
 stage='verified admin';assert.equal((await ok(rpc('apply_admin_approved_food_alias',b,{p_review_id:REVIEW})))[0].result,'applied');
 assert.equal((await ok(rpc('apply_owner_approved_missing_food_draft',b,{p_draft_id:DRAFT})))[0].result,'applied');
 assert.equal((await ok(rpc('apply_owner_approved_missing_food_draft',b,{p_draft_id:DRAFT})))[0].result,'already_applied');
 await denied(request('food_alias_apply_audit',b,'POST',{alias:'forged',normalized_alias:'forged',result:'permission_denied'}));
 console.log('PASS verified admin with false legacy flag applies the actual public alias/food RPC bodies');
 stage='personal boundaries';await ok(request('foods',a,'POST',{name:'Personal API',source:'user',created_by_user_id:a.id}),201);
 const personal=await ok(request('foods?name=eq.Personal%20API',a));assert.equal(personal.length,1);assert.deepEqual(await ok(request('foods?name=eq.Personal%20API',b)),[]);
 await denied(request('foods?id=eq.'+personal[0].id,a,'PATCH',{source:'core'}));
 await ok(request('food_aliases',a,'POST',{canonical_food_id:FOOD,alias:'Personal API alias',source:'user',created_by_user_id:a.id}),201);
 assert.equal((await ok(request('food_aliases?alias=eq.Personal%20API%20alias',a))).length,1);assert.deepEqual(await ok(request('food_aliases?alias=eq.Personal%20API%20alias',b)),[]);
 console.log('PASS own personal products/aliases remain usable without shared-catalog promotion or foreign visibility');
 stage='history';for(const user of [a,b,null])await denied(rpc('recompute_food_entries_for_food_ids',user,{food_ids:[FOOD]}));
 assert.deepEqual(await ok(request('food_diary_entries',a)),beforeA);assert.deepEqual(await ok(request('food_diary_entries',b)),beforeB);
 stage='revocation';prepare('revoke',a.id,b.id);assert.equal(await ok(rpc('has_catalog_admin_access_v1',b)),false);
 assert.equal((await ok(rpc('apply_owner_approved_missing_food_draft',b,{p_draft_id:DRAFT})))[0].result,'permission_denied');
 prepare('verify',a.id,b.id);
 console.log('PASS same-token revocation, retired history API denial and unchanged full diary rows for both users');
 console.log('CATALOG_AUTHORITY_HTTP_OK: real Auth/PostgREST; public RPC/policy and verified-reader sources');
}catch(error){console.error('CATALOG_AUTHORITY_HTTP_FAILED stage='+stage+' type='+error.name+' reason='+error.message);process.exitCode=1;}
