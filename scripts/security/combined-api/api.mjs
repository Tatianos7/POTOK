import assert from 'node:assert/strict';
import {spawnSync} from 'node:child_process';
import {readFile} from 'node:fs/promises';
import {fileURLToPath} from 'node:url';
import ts from 'typescript';
import {login,localFetch,status} from '../data-api-explicit-grants/local-auth.mjs';
import {DRAFT,REVIEW} from '../catalog-authority/fixture.mjs';
import {PA,PB} from '../program-reads/fixture.mjs';
import {tables as historyTables,insertPayload as historyInsert} from '../program-history/fixture.mjs';
function prepare(mode,...ids){const r=spawnSync(process.execPath,[fileURLToPath(new URL('./local-prepare.mjs',import.meta.url)),mode,...ids],{encoding:'utf8',timeout:120000});if(r.status!==0)console.error(r.stderr);assert.equal(r.status,0,'Eight-candidate '+mode);}
async function request(route,user,method='GET',body,extraHeaders={}){const r=await localFetch(status.API_URL+'/rest/v1/'+route,{method,headers:{apikey:status.ANON_KEY,Authorization:'Bearer '+(user?.token??status.ANON_KEY),'Content-Type':'application/json',Prefer:'return=representation,resolution=merge-duplicates',...extraHeaders},...(body===undefined?{}:{body:JSON.stringify(body)})});const s=await r.text();return{status:r.status,body:s?JSON.parse(s):null};}
const rpc=(name,user,body={})=>request('rpc/'+name,user,'POST',body);
const explanation=(user,id)=>rpc('get_program_explainability',user,{p_program_id:id,p_version:null});
function maskedExplanation(e){assert.equal(e.knowledge_refs,null);assert.equal(e.confidence,null);assert.deepEqual(e.guard_notes,{reason_code:'synthetic_reason'});}
async function maskedProgramReads(user,id){
 maskedExplanation((await ok(explanation(user,id)))[0]);
 const d=await ok(rpc('get_program_day_details',user,{p_program_id:id,p_date:'2026-10-26'}));maskedExplanation(d.explainability[0]);assert.equal(d.day.targets.calories,123);
 const days=await ok(rpc('get_program_days',user,{p_program_id:id}));assert.equal(days[0].explainability_summary.reason_code,'synthetic_reason');
}
async function ok(p,expected=200){const r=await p;assert.equal(r.status,expected,'Authority/profile HTTP status='+r.status+' code='+(r.body?.code??'none'));return r.body;}
async function denied(p){const r=await p;assert([401,403].includes(r.status));assert.equal(r.body?.code,'42501');}
async function loadService(file,name){
 const source=await readFile('src/services/'+file,'utf8');
 const javascript=ts.transpileModule(source,{compilerOptions:{target:ts.ScriptTarget.ES2022,module:ts.ModuleKind.CommonJS}}).outputText;
 const module={exports:{}};new Function('require','exports',javascript)(id=>{assert.equal(id,'../lib/supabaseClient');return{supabase:null};},module.exports);
 return module.exports[name];
}
const AdminAccessService=await loadService('adminAccessService.ts','AdminAccessService');
const EntitlementService=await loadService('entitlementService.ts','EntitlementService');
function serviceClient(user){return{auth:{getUser:async()=>{const r=await localFetch(status.API_URL+'/auth/v1/user',{headers:{apikey:status.ANON_KEY,Authorization:'Bearer '+user.token}});assert.equal(r.status,200);return{data:{user:await r.json()},error:null};}},rpc:async(name,args)=>{const r=await rpc(name,user,args);return{data:r.body,error:r.status===200?null:{message:'local RPC failed'}};}};}
function service(user){return new AdminAccessService(serviceClient(user));}
let stage='OTP';
try{
 const a=await login('combined-a@example.test'),b=await login('combined-b@example.test');prepare('fixture',a.id,b.id);
 for(let n=0;;n++){const r=await rpc('has_verified_entitlement_v1',a,{p_capability:'admin'});if(r.status===200)break;assert.equal(r.body?.code,'PGRST202');assert(n<39);await new Promise(resolve=>setTimeout(resolve,250));}
 stage='empty authority';const sa=service(a),sb=service(b),ea=new EntitlementService(serviceClient(a)),eb=new EntitlementService(serviceClient(b));assert.equal((await sa.getVerifiedCurrentUserCapabilities(a.id)).admin,false);assert.equal((await sb.getVerifiedCurrentUserCapabilities(b.id)).admin,false);
 const beforeA=await ok(request('food_diary_entries',a)),beforeB=await ok(request('food_diary_entries',b));
 stage='profile';const upsert=await request('user_profiles?on_conflict=id_user',a,'POST',{id_user:a.id,first_name:'Saved API',coach_settings:{mode:'off'},voice_settings:{enabled:false}});assert([200,201].includes(upsert.status));assert.equal(upsert.body[0].first_name,'Saved API');assert.equal(upsert.body[0].coach_settings.mode,'off');
 assert.deepEqual(await ok(request('user_profiles?id_user=eq.'+a.id,b)),[]);
 await denied(request('user_profiles?id_user=eq.'+a.id,a,'PATCH',{is_admin:false}));
 stage='finance';const serviceRole={token:status.SERVICE_ROLE_KEY};assert(serviceRole.token);
 assert.equal((await ok(rpc('get_entitlements',a))).tier,'free');assert.equal((await ok(rpc('get_entitlements',b))).tier,'pro');
 await denied(rpc('get_entitlements',a,{p_user_id:b.id}));await denied(rpc('get_paywall_state',a,{p_feature:'adaptation',p_user_id:b.id}));
 assert.equal((await ok(rpc('get_paywall_state',a,{p_feature:'adaptation'}))).locked,true);
 for(const user of [null,serviceRole])await denied(rpc('get_entitlements',user,{p_user_id:a.id}));
 for(const user of [null,a])for(const name of ['start_purchase','restore_purchase'])await denied(rpc(name,user,{p_user_id:a.id,p_provider:'play_store',...(name==='start_purchase'?{p_plan:'pro'}:{p_receipt:'synthetic'}),p_idempotency_key:'forged-combined'}));
 for(const table of ['entitlements','subscriptions','billing_events']){
  assert.deepEqual(await ok(request(table+'?user_id=eq.'+b.id,a)),[]);
  await denied(request(table+'?user_id=eq.'+a.id,a,'DELETE'));
 }
 await denied(request('entitlements?user_id=eq.'+a.id,a,'PATCH',{tier:'pro'}));await denied(request('billing_events',a,'POST',{user_id:a.id,provider:'play_store',event_type:'forged',idempotency_key:'forged-table'}));
 assert.equal((await ok(rpc('start_purchase',serviceRole,{p_user_id:a.id,p_provider:'play_store',p_plan:'pro',p_idempotency_key:'synthetic-server-event'}))).status,'started');assert.equal((await ok(rpc('get_entitlements',a))).tier,'free');
 console.log('PASS combined own finance/paywall, foreign/write/purchase denial and event-only server behavior');
 stage='legacy Premium containment';assert.equal(await ea.canGenerateProgram(a.id),true);assert.equal(await eb.canAdaptProgram(b.id),false);assert.equal(await eb.canExplain(b.id),false);assert.equal((await eb.canRealtimePose(b.id)).allowed,false);
 stage='photos';const asset={user_id:a.id,day:'2026-10-26',slot:'main_1',storage_path:'synthetic/first.png'};
 const marker={user_id:a.id,day:'2026-10-26',deleted_at:'2026-10-26T10:00:00Z'};
 for(const [table,row,conflict,change] of [['measurement_photo_assets',asset,'user_id,day,slot',{storage_path:'synthetic/second.png'}],['measurement_photo_deletions',marker,'user_id,day',{deleted_at:'2026-10-26T11:00:00Z'}]]){
  assert([200,201].includes((await request(table+'?on_conflict='+conflict,a,'POST',row)).status));assert([200,201].includes((await request(table+'?on_conflict='+conflict,a,'POST',{...row,...change})).status));
  assert.equal((await ok(request(table,a))).length,1);assert.deepEqual(await ok(request(table,b)),[]);
  await denied(request(table+'?user_id=eq.'+a.id,a,'PATCH',{user_id:b.id}));await denied(request(table,b,'POST',row));await denied(request(table,null));
 }
 await denied(request('measurement_photo_deletions?user_id=eq.'+a.id,a,'PATCH',{id:a.id}));
 assert.equal((await ok(request('measurement_photo_assets',a)))[0].storage_path,'synthetic/second.png');assert.equal(Date.parse((await ok(request('measurement_photo_deletions',a)))[0].deleted_at),Date.parse('2026-10-26T11:00:00Z'));
 console.log('PASS combined real photo and deletion upsert with column protection and account isolation');
 stage='grant';prepare('grant',b.id);assert.equal((await sb.getVerifiedCurrentUserCapabilities(b.id)).admin,true);assert.equal((await sb.getVerifiedCurrentUserCapabilities(b.id)).premium,false);assert.equal((await sa.getVerifiedCurrentUserCapabilities(a.id)).admin,false);
 assert.equal((await ok(rpc('apply_owner_approved_missing_food_draft',a,{p_draft_id:DRAFT})))[0].result,'permission_denied');
 assert.equal((await ok(rpc('apply_owner_approved_missing_food_draft',b,{p_draft_id:DRAFT})))[0].result,'applied');
 assert.equal((await ok(rpc('apply_admin_approved_food_alias',b,{p_review_id:REVIEW})))[0].result,'applied');
 stage='personal catalog';await denied(request('foods',a,'POST',{name:'forged-core',source:'core',created_by_user_id:a.id}));
 await ok(request('foods',a,'POST',{name:'Combined personal food',source:'user',created_by_user_id:a.id}),201);assert.deepEqual(await ok(request('foods?name=eq.Combined%20personal%20food',b)),[]);
 await ok(request('food_aliases',a,'POST',{canonical_food_id:'33333333-3333-4333-8333-333333333333',alias:'Combined personal alias',source:'user',created_by_user_id:a.id}),201);
 assert.deepEqual(await ok(request('food_aliases?alias=eq.Combined%20personal%20alias',b)),[]);await denied(request('food_aliases?alias=eq.Combined%20personal%20alias',a,'PATCH',{source:'core'}));
 for(const user of [a,b,null,serviceRole])await denied(rpc('recompute_food_entries_for_food_ids',user,{food_ids:['33333333-3333-4333-8333-333333333333']}));
 await denied(rpc('apply_owner_approved_missing_food_draft',serviceRole,{p_draft_id:DRAFT}));
 console.log('PASS combined catalog publication/privacy and protected historical recompute boundaries');
 stage='server boundaries';await denied(rpc('has_verified_entitlement_v1',null,{p_capability:'admin'}));
 const foreignArgument=await rpc('has_verified_entitlement_v1',a,{p_account_id:b.id,p_capability:'admin'});assert.equal(foreignArgument.status,404);assert.equal(foreignArgument.body?.code,'PGRST202');
 stage='revocation';prepare('revoke',b.id);assert.equal((await sb.getVerifiedCurrentUserCapabilities(b.id)).admin,false);assert.equal((await ok(rpc('apply_owner_approved_missing_food_draft',b,{p_draft_id:DRAFT})))[0].result,'permission_denied');
 assert.deepEqual(await ok(request('food_diary_entries',a)),beforeA);assert.deepEqual(await ok(request('food_diary_entries',b)),beforeB);assert.equal((await ok(request('user_profiles',b)))[0].is_admin,false);
 stage='server paywall follow-up';assert.equal((await ok(rpc('get_paywall_state',b,{p_feature:'adaptation'}))).locked,false);
 prepare('paywall-review');
 for(const p_feature of ['adaptation','explainability','spatial'])assert.equal((await ok(rpc('get_paywall_state',b,{p_feature}))).locked,true);
 await denied(rpc('get_paywall_state',a,{p_feature:'adaptation',p_user_id:b.id}));
 for(const user of [null,serviceRole])await denied(rpc('get_paywall_state',user,{p_feature:'adaptation'}));
 stage='program read follow-up';prepare('program-read-fixture',a.id,b.id);
 for(let n=0;;n++){const r=await explanation(b,PB);if(r.status===200){assert.equal(r.body[0].guard_notes.details,'synthetic full b');break;}assert.equal(r.body?.code,'PGRST202');assert(n<39);await new Promise(resolve=>setTimeout(resolve,250));}
 prepare('program-read-review');
 await maskedProgramReads(a,PA);await maskedProgramReads(b,PB);
 for(const col of ['*','knowledge_refs','confidence','guard_notes'])await denied(request('program_explainability?select='+col,b));
 assert.equal((await ok(request('program_explainability?select=decision_ref',b))).length,1);
 assert.deepEqual(await ok(explanation(b,PA)),[]);
 const foreignDay=await ok(rpc('get_program_day_details',b,{p_program_id:PA,p_date:'2026-10-26'}));assert.equal(foreignDay.day,null);assert.equal(foreignDay.explainability,null);
 for(const user of [null,serviceRole])await denied(explanation(user,PB));
 const privateRpc=await rpc('read_program_explainability_v1',b,{p_program_id:PB,p_version:null});assert.equal(privateRpc.status,404);
 const privateSchema=await request('rpc/read_program_explainability_v1',b,'POST',{p_program_id:PB,p_version:null},{'Content-Profile':'potok_delivery'});assert.equal(privateSchema.status,406);assert.equal(privateSchema.body?.code,'PGRST106');
 stage='history containment';prepare('history-review');
 const historyPatch={program_versions:{version:99},program_adaptations:{summary:{forged:true}},program_explainability:{decision_ref:'synthetic:forged'},program_guard_events:{risk_level:'safe'}};
 for(const table of historyTables)for(const user of [a,b]){
  await denied(request(table+'?id=eq.'+PA,user,'PATCH',historyPatch[table],{'Prefer':'return=minimal'}));
  await denied(request(table+'?id=eq.'+PA,user,'DELETE',undefined,{'Prefer':'return=minimal'}));
 }
 stage='verified Premium';const unchangedToken=b.token;prepare('premium-grant',b.id);
 assert.equal((await sb.getVerifiedCurrentUserCapabilities(b.id)).premium,true);assert.equal((await sb.getVerifiedCurrentUserCapabilities(b.id)).admin,false);
 assert.equal(await eb.canAdaptProgram(b.id),true);assert.equal(await eb.canExplain(b.id),true);assert.equal((await eb.canRealtimePose(b.id)).allowed,true);
 for(const p_feature of ['adaptation','explainability','spatial'])assert.equal((await ok(rpc('get_paywall_state',b,{p_feature}))).locked,false);
 assert.equal((await ok(explanation(b,PB)))[0].guard_notes.details,'synthetic full b');
 assert.equal((await ok(rpc('get_program_day_details',b,{p_program_id:PB,p_date:'2026-10-26'}))).explainability[0].knowledge_refs.evidence,'synthetic full b');
 await denied(request('program_explainability?select=guard_notes',b));
 prepare('premium-revoke',b.id);assert(b.token===unchangedToken,'Synthetic JWT unexpectedly changed');
 assert.equal(await eb.canAdaptProgram(b.id),false);assert.equal(await eb.canExplain(b.id),false);assert.equal((await eb.canRealtimePose(b.id)).allowed,false);
 for(const p_feature of ['adaptation','explainability','spatial'])assert.equal((await ok(rpc('get_paywall_state',b,{p_feature}))).locked,true);
 assert.equal((await ok(rpc('get_paywall_state',b,{p_feature:'unknown'}))).locked,true);
 await maskedProgramReads(b,PB);
 console.log('PROGRAM_READ_HTTP_OK: separate read projection; Free summary, owned verified full response and same-JWT redaction after revoke; direct protected column and foreign access denied');
 console.log('SERVER_PAYWALL_HTTP_OK: separate follow-up candidate; signed own-account, exact flags and live verified Premium; same-JWT revoke; program data paths remain separate');
 assert.equal((await eb.getEntitlements(b.id)).tier,'pro');assert.equal((await ok(request('user_profiles',b)))[0].has_premium,false);
 for(const table of historyTables){
  await ok(request(table,a,'POST',historyInsert(table,PA),{'Prefer':'return=minimal'}),201);
  await denied(request(table,b,'POST',historyInsert(table,PA),{'Prefer':'return=minimal'}));
 }
 console.log('PROGRAM_HISTORY_HTTP_OK: own/foreign past-row PATCH and DELETE denied; own no-returning inserts preserved, foreign inserts denied; trusted atomic plan mutation remains separate');
 console.log('PREMIUM_CLIENT_HTTP_OK: actual EntitlementService, verified grant/revoke on same JWT; legacy-paid denial and Free preservation; no provider integration');
 prepare('verify-api');
 console.log('EIGHT_COMBINED_API_OK: eight committed candidates; actual AdminAccessService and real Auth/PostgREST; profile, finance, photo, catalog, history and revocation');
}catch(e){console.error('EIGHT_COMBINED_API_FAILED stage='+stage+' reason='+e.message);process.exitCode=1;}
