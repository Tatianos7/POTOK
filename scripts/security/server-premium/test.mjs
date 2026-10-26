import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {createHash} from 'node:crypto';
import {pathToFileURL} from 'node:url';
import {catalogFixture,A,B} from '../authority-profile/fixture.mjs';

const embedded=process.env.SQL_TEST_PGLITE_MODULE;let db;
if(embedded){const {PGlite}=await import(pathToFileURL(embedded));db=new PGlite();await db.exec('CREATE ROLE test_admin SUPERUSER;SET SESSION AUTHORIZATION test_admin;ALTER ROLE postgres RENAME TO embedded_bootstrap;');}
else{const u=new URL(process.env.TEST_DATABASE_URL??'');assert.equal(u.hostname,'127.0.0.1');assert.equal(u.pathname,'/potok_server_premium_test');const {default:pg}=await import(pathToFileURL(process.env.SQL_TEST_PG_MODULE));db=new pg.Client({connectionString:u.href});await db.connect();}
const exec=s=>embedded?db.exec(s):db.query(s),rows=async s=>(await db.query(s)).rows;
const review=await readFile('scripts/security/server-premium/paywall-review.sql','utf8');
assert.equal((review.match(/^BEGIN;$/gm)??[]).length,1);assert.equal((review.match(/^ROLLBACK;$/gm)??[]).length,1);assert.doesNotMatch(review,/^COMMIT;$/m);
const body=review.replace(/^BEGIN;$/m,'').replace(/^ROLLBACK;$/m,'');
let profile;
if(process.env.AUTHORITY_PROFILE_INPUT)profile=await readFile(process.env.AUTHORITY_PROFILE_INPUT,'utf8');
else{const r=await fetch('https://raw.githubusercontent.com/Tatianos7/POTOK/7f4f7e24fec497a22dea29dd14f4546115439129/supabase/migration_drafts/profile_column_write_containment_v1.sql',{redirect:'error',signal:AbortSignal.timeout(30000)});assert(r.ok);profile=await r.text();}
assert.equal(createHash('sha256').update(profile).digest('hex'),'b781e7754732d12359cfff990ca855f75115695c283b08f9f221f785f5d529ea');
const grant=cap=>`SELECT potok_control.grant_entitlement_v2('${B}','${cap}',now()+interval '1 day','synthetic-server-evidence','synthetic-server-test')`;
const revoke=()=>`SELECT potok_control.revoke_entitlement_v2('${B}','premium','synthetic-server-revoke','synthetic-server-test')`;
const pay=(feature,user='NULL')=>`SELECT public.get_paywall_state(${feature},${user}) AS result`;
async function client(role,user,q,extra={}){
 await exec(`SAVEPOINT client_call;SET LOCAL ROLE ${role};SELECT set_config('request.jwt.claims','${JSON.stringify({role,sub:user,...extra})}',true);`);
 try{const r=await rows(q);await exec('SET LOCAL ROLE postgres;RELEASE client_call;');return r;}
 catch(e){await exec('ROLLBACK TO client_call;RELEASE client_call;');throw e;}
}
const denied=fn=>assert.rejects(fn,e=>e.code==='42501');
const locked=async(feature,user=B)=>(await client('authenticated',user,pay("'"+feature+"'")))[0].result.locked;
const snapshot=async()=>rows(`SELECT jsonb_build_object(
 'profile',(SELECT jsonb_agg(to_jsonb(p) ORDER BY id_user) FROM public.user_profiles p),
 'entitlement',(SELECT jsonb_agg(to_jsonb(e) ORDER BY user_id) FROM public.entitlements e),
 'program',(SELECT jsonb_agg(to_jsonb(p) ORDER BY id) FROM public.nutrition_programs p),
 'explanation',(SELECT jsonb_agg(to_jsonb(e) ORDER BY id) FROM public.program_explainability e),
 'paywall',(SELECT to_jsonb(p) FROM pg_proc p WHERE oid='public.get_paywall_state(text,uuid)'::regprocedure)) AS state`);
let passed=0;async function test(name,fn){await exec('BEGIN;');try{await fn();await exec('ROLLBACK;');passed++;console.log('PASS '+name);}catch(e){await exec('ROLLBACK;');throw e;}}
const program='aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';
try{
 await exec('CREATE ROLE postgres NOSUPERUSER BYPASSRLS;CREATE ROLE anon;CREATE ROLE authenticated;CREATE ROLE service_role BYPASSRLS;GRANT anon,authenticated,service_role TO postgres;');
 const name=(await rows('SELECT current_database() AS name'))[0].name;assert(/^[a-z_][a-z0-9_]*$/.test(name));
 await exec(`ALTER DATABASE ${name} OWNER TO postgres;DROP SCHEMA public CASCADE;CREATE SCHEMA public AUTHORIZATION postgres;REVOKE CREATE ON SCHEMA public FROM PUBLIC;CREATE SCHEMA auth;GRANT USAGE ON SCHEMA public,auth TO postgres,anon,authenticated,service_role;
 CREATE FUNCTION auth.jwt() RETURNS jsonb LANGUAGE sql STABLE AS $$ SELECT coalesce(nullif(current_setting('request.jwt.claims',true),''),'{}')::jsonb $$;
 CREATE FUNCTION auth.uid() RETURNS uuid LANGUAGE sql STABLE AS $$ SELECT (auth.jwt()->>'sub')::uuid $$;
 CREATE TABLE auth.users(id uuid PRIMARY KEY);INSERT INTO auth.users VALUES('${A}'),('${B}');GRANT REFERENCES ON auth.users TO postgres;SET SESSION AUTHORIZATION postgres;`);
 await exec(await catalogFixture());await exec(profile);
 await exec((await readFile('supabase/migration_drafts/trusted_authority_id_user_review_v1.sql','utf8')).replace(/^ROLLBACK;$/m,'COMMIT;'));
 await exec(await readFile('supabase/phase7_3_2_monetization.sql','utf8'));
 await exec('GRANT ALL ON public.entitlements,public.subscriptions,public.billing_events TO PUBLIC,anon,authenticated,service_role;GRANT EXECUTE ON ALL FUNCTIONS IN SCHEMA public TO authenticated,service_role;');
 // The legacy blanket function fixture grant above must not expose the authority reader.
 await exec('REVOKE ALL ON FUNCTION public.has_verified_entitlement_v1(text),public.has_verified_entitlement_v2(text) FROM PUBLIC,anon,service_role;');
 await exec((await readFile('supabase/migration_drafts/premium_finance_authority_review_v1.sql','utf8')).replace(/^ROLLBACK;$/m,'COMMIT;'));
 await exec(`INSERT INTO public.entitlements(user_id,tier,flags) VALUES('${A}','free','{}'),('${B}','pro','{"can_adapt":true,"can_explain":true,"can_spatial":true}');CREATE TABLE public.user_goals(user_id uuid PRIMARY KEY);`);
 for(const p of ['phase7_2_programs.sql','phase7_2_2_adaptation.sql','phase7_2_3_delivery.sql'])await exec(await readFile('supabase/'+p,'utf8'));
 await exec(`GRANT SELECT,INSERT,UPDATE,DELETE ON public.nutrition_programs,public.training_programs,public.program_phases,public.program_blocks,public.program_days,public.program_versions,public.program_explainability,public.program_guard_events,public.program_generation_jobs,public.program_adaptations,public.program_sessions,public.program_feedback TO authenticated;
 INSERT INTO public.nutrition_programs(id,user_id,status) VALUES('${program}','${A}','active');
 INSERT INTO public.program_explainability(program_id,program_type,version,decision_ref,knowledge_refs,guard_notes) VALUES('${program}','nutrition',1,'synthetic:decision','{"source":"synthetic"}','{"reason_code":"synthetic:reason","details":"synthetic full explanation"}');`);
 await test('legacy server paywall unlocks old paid row despite empty verified ledger',async()=>{assert.equal(await locked('adaptation'),false);assert.equal((await client('authenticated',B,"SELECT public.has_verified_entitlement_v1('premium') AS allowed"))[0].allowed,false);});
 const before=await snapshot();await exec(review);assert.deepEqual(await snapshot(),before);console.log('PASS review wrapper preserves rows and original function metadata through ROLLBACK');passed++;
 await test('changed verified reader body, path drift and inherited PUBLIC execute abort before replacement',async()=>{
  for(const drift of [
   "CREATE OR REPLACE FUNCTION public.has_verified_entitlement_v1(p_capability text) RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path=pg_catalog AS $$ SELECT true $$;",
   "ALTER FUNCTION public.get_entitlements(uuid) SET search_path=public;",
   "GRANT EXECUTE ON FUNCTION public.get_paywall_state(text,uuid) TO PUBLIC;"
  ]){
   const state=await snapshot();await exec('SAVEPOINT drift;'+drift);
   await assert.rejects(()=>exec(body),/source contract|reader boundary/);
   await exec('ROLLBACK TO drift;RELEASE drift;');assert.deepEqual(await snapshot(),state);
  }
 });
 await exec(review.replace(/^ROLLBACK;$/m,'COMMIT;'));
 await test('committed invoker paywall denies unverified and preserves own-account, anon and service boundaries',async()=>{
  assert.equal((await rows("SELECT prosecdef FROM pg_proc WHERE oid='public.get_paywall_state(text,uuid)'::regprocedure"))[0].prosecdef,false);
  for(const f of ['adaptation','explainability','spatial'])assert.equal(await locked(f),true);
  for(const r of ['anon','service_role'])await denied(()=>client(r,B,pay("'adaptation'")));
  await denied(()=>client('authenticated',A,pay("'adaptation'","'"+B+"'")));
 });
 await test('owner grant and same-claims revocation change paywall without changing old tier or profile',async()=>{
  const p=await rows('SELECT to_jsonb(p) AS profile FROM public.user_profiles p ORDER BY id_user');await rows(grant('premium'));
  for(const f of ['adaptation','explainability','spatial'])assert.equal(await locked(f),false);
  await rows(revoke());for(const f of ['adaptation','explainability','spatial'])assert.equal(await locked(f),true);
  assert.equal((await client('authenticated',B,'SELECT public.get_entitlements() AS e'))[0].e.tier,'pro');assert.deepEqual(await rows('SELECT to_jsonb(p) AS profile FROM public.user_profiles p ORDER BY id_user'),p);
 });
 await test('exact feature boolean required; admin, tier, voice, malformed and missing flags cannot substitute',async()=>{
  await rows(grant('admin'));assert.equal(await locked('adaptation'),true);await rows(grant('premium'));
  for(const flags of ['{"can_explain":"true","can_adapt":1,"can_voice":true,"can_spatial":false}','{}','[]','null']){
   await exec(`UPDATE public.entitlements SET flags='${flags}'::jsonb WHERE user_id='${B}'`);
   for(const f of ['adaptation','explainability','spatial'])assert.equal(await locked(f),true);
  }
 });
 await test('unknown feature is closed; missing identity and user metadata cannot authorize',async()=>{
  for(const f of ["'unknown'",'NULL'])assert.equal((await client('authenticated',B,pay(f)))[0].result.locked,true);
  await denied(()=>client('authenticated',null,pay("'adaptation'")));
  await denied(()=>client('authenticated',B,pay("'adaptation'"),{role:null,user_metadata:{role:'authenticated',has_premium:true}}));
 });
 await test('one-time candidate reapply aborts without replacing the committed function',async()=>{
  const state=await snapshot();await assert.rejects(()=>exec('SAVEPOINT drift;'+body),/source contract/);await exec('ROLLBACK TO drift;RELEASE drift;');assert.deepEqual(await snapshot(),state);
 });
 await test('OPEN diagnostic: paywall does not authorize direct program explanation reads or mutations',async()=>{
  assert.equal(await locked('explainability',A),true);
  assert.equal((await client('authenticated',A,`SELECT * FROM public.get_program_explainability('${program}')`))[0].guard_notes.details,'synthetic full explanation');
  assert.equal((await client('authenticated',A,`SELECT public.get_program_day_details('${program}',current_date) AS d`))[0].d.explainability[0].guard_notes.details,'synthetic full explanation');
  assert.equal((await client('authenticated',A,'SELECT * FROM public.program_explainability')).length,1);
  assert.equal((await client('authenticated',B,'SELECT * FROM public.program_explainability')).length,0);
  await client('authenticated',A,`UPDATE public.nutrition_programs SET program_version=2 WHERE id='${program}'`);
  await client('authenticated',A,`INSERT INTO public.program_adaptations(program_id,program_type,from_version,to_version,trigger) VALUES('${program}','nutrition',1,2,'synthetic-direct-write')`);
 });
 console.log('SERVER_PAYWALL_REVIEW_OK: '+passed+' cases; program read/write authority remains OPEN');
}finally{await db.close?.();await db.end?.();}
