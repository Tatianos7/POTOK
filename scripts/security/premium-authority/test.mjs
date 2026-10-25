import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {pathToFileURL} from 'node:url';
const embedded=process.env.SQL_TEST_PGLITE_MODULE;
let db;
if(embedded){const {PGlite}=await import(pathToFileURL(embedded));db=new PGlite();}
else{const u=new URL(process.env.TEST_DATABASE_URL??'');assert.equal(u.hostname,'127.0.0.1');assert.equal(u.pathname,'/potok_premium_test');const {default:pg}=await import(pathToFileURL(process.env.SQL_TEST_PG_MODULE));db=new pg.Client({connectionString:u.href});await db.connect();}
const exec=s=>embedded?db.exec(s):db.query(s);
const rows=async s=>(await db.query(s)).rows;
const legacy=await readFile('supabase/phase7_3_2_monetization.sql','utf8');
const draft=await readFile('supabase/migration_drafts/premium_finance_authority_review_v1.sql','utf8');
assert.equal((draft.match(/^BEGIN;$/gm)??[]).length,1);assert.equal((draft.match(/^ROLLBACK;$/gm)??[]).length,1);assert.doesNotMatch(draft,/^COMMIT;$/m);
const a='11111111-1111-4111-8111-111111111111',b='22222222-2222-4222-8222-222222222222';
const tables=['entitlements','subscriptions','billing_events'];
const signatures=['get_entitlements(uuid)','get_paywall_state(text,uuid)','start_purchase(uuid,text,text,text)','restore_purchase(uuid,text,text,text)'];
async function fixture(){
 await exec(`ROLLBACK;RESET ROLE;DROP SCHEMA IF EXISTS public CASCADE;DROP SCHEMA IF EXISTS auth CASCADE;
 CREATE SCHEMA public AUTHORIZATION postgres;CREATE SCHEMA auth;
 REVOKE CREATE ON SCHEMA public FROM PUBLIC;GRANT USAGE ON SCHEMA public,auth TO postgres,anon,authenticated,service_role;
 CREATE FUNCTION auth.jwt() RETURNS jsonb LANGUAGE sql STABLE AS $$ SELECT coalesce(nullif(current_setting('request.jwt.claims',true),''),'{}')::jsonb $$;
 CREATE FUNCTION auth.uid() RETURNS uuid LANGUAGE sql STABLE AS $$ SELECT (auth.jwt()->>'sub')::uuid $$;
 CREATE TABLE auth.users(id uuid PRIMARY KEY);INSERT INTO auth.users VALUES('${a}'),('${b}');GRANT REFERENCES ON auth.users TO postgres;
 SET ROLE postgres;`);
 await exec(legacy);
 for(const signature of signatures)await exec(`GRANT EXECUTE ON FUNCTION public.${signature} TO anon,authenticated,service_role;`);
 await exec(`GRANT ALL ON public.entitlements,public.subscriptions,public.billing_events TO PUBLIC,anon,authenticated,service_role;
 GRANT UPDATE(tier),INSERT(tier) ON public.entitlements TO PUBLIC,anon,authenticated;
 INSERT INTO public.entitlements(user_id,tier,flags) VALUES('${a}','free','{"can_adapt":false}'),('${b}','pro','{"can_adapt":true}');
 INSERT INTO public.subscriptions(user_id,plan,status) VALUES('${a}','free','active'),('${b}','pro','active');
 INSERT INTO public.billing_events(user_id,provider,event_type,idempotency_key) VALUES('${a}','play_store','fixture','seed-a'),('${b}','play_store','fixture','seed-b');
 RESET ROLE;`);
}
async function as(role,sub,sql,claims={}){await exec(`BEGIN;SET LOCAL ROLE ${role};SELECT set_config('request.jwt.claims','${JSON.stringify({role,sub,...claims}).replace(/'/g,"''")}',true);`);try{const result=await rows(sql);await exec('COMMIT;');return result;}catch(error){await exec('ROLLBACK;');throw error;}}
async function apply(){await exec('SET ROLE postgres;');try{await exec(draft.replace(/^ROLLBACK;$/m,'COMMIT;'));}catch(error){await exec('ROLLBACK;');throw error;}finally{await exec('RESET ROLE;');}}
const denied=fn=>assert.rejects(fn,e=>e.code==='42501');
async function snapshot(){return {
 data:await rows(`SELECT 'entitlements' AS t,jsonb_agg(to_jsonb(x) ORDER BY id) AS data FROM public.entitlements x UNION ALL SELECT 'subscriptions',jsonb_agg(to_jsonb(x) ORDER BY id) FROM public.subscriptions x UNION ALL SELECT 'billing_events',jsonb_agg(to_jsonb(x) ORDER BY id) FROM public.billing_events x ORDER BY t`),
 policies:await rows("SELECT schemaname,tablename,policyname,roles,cmd,qual,with_check FROM pg_policies WHERE schemaname='public' ORDER BY tablename,policyname"),
 bodies:await rows("SELECT proname,md5(prosrc) AS hash FROM pg_proc WHERE pronamespace='public'::regnamespace AND proname<>'get_entitlements' ORDER BY proname")
};}
let passed=0;async function test(name,fn){await fixture();await fn();passed++;console.log('PASS '+name);}
try{
 if(embedded)await exec('CREATE ROLE test_admin SUPERUSER;SET SESSION AUTHORIZATION test_admin;ALTER ROLE postgres RENAME TO embedded_bootstrap;CREATE ROLE postgres NOSUPERUSER;');
 else await exec('CREATE ROLE postgres NOSUPERUSER;ALTER DATABASE potok_premium_test OWNER TO postgres;');
 await exec('CREATE ROLE anon;CREATE ROLE authenticated;CREATE ROLE service_role BYPASSRLS;CREATE ROLE leaked_writer;GRANT leaked_writer TO authenticated;');
 await test('public legacy source reproduces own upgrade, foreign entitlement read and purchase for another account',async()=>{
  await as('authenticated',a,"UPDATE public.entitlements SET tier='pro',flags='{\"can_adapt\":true}' WHERE user_id='"+a+"'");
  assert.equal((await as('authenticated',a,`SELECT public.get_entitlements('${b}') AS e`))[0].e.tier,'pro');
  await as('anon','',`SELECT public.start_purchase('${b}','play_store','pro','forged')`);
  assert.equal((await rows("SELECT count(*)::int AS n FROM public.billing_events WHERE idempotency_key='forged'"))[0].n,1);
 });
 await test('candidate preserves data, policies, other RPC bodies, own read and service DML',async()=>{
  const before=await snapshot();await apply();assert.deepEqual(await snapshot(),before);
  for(const t of tables){assert.equal((await as('authenticated',a,'SELECT * FROM public.'+t)).length,1);assert.equal((await as('service_role',b,'SELECT * FROM public.'+t)).length,2);}
  await as('service_role',a,`UPDATE public.entitlements SET tier='pro' WHERE user_id='${a}'`);
 });
 await test('client finance mutations including explicit column grants are removed',async()=>{
  await apply();for(const role of ['anon','authenticated'])for(const t of tables){
   await denied(()=>as(role,a,'DELETE FROM public.'+t));
   await denied(()=>as(role,a,'TRUNCATE public.'+t));
  }
  await denied(()=>as('authenticated',a,`UPDATE public.entitlements SET tier='pro' WHERE user_id='${a}'`));
  await denied(()=>as('authenticated',a,`INSERT INTO public.entitlements(user_id,tier) VALUES('${a}','pro')`));
  await denied(()=>as('authenticated',a,`INSERT INTO public.subscriptions(user_id,plan,status) VALUES('${a}','pro','active')`));
  await denied(()=>as('authenticated',a,`INSERT INTO public.billing_events(user_id,provider,event_type,idempotency_key) VALUES('${a}','play_store','forge','forge')`));
 });
 await test('own free/paid/default reads and paywall DTO remain, foreign account is denied',async()=>{
  await apply();assert.equal((await as('authenticated',a,'SELECT public.get_entitlements() AS e'))[0].e.tier,'free');
  assert.equal((await as('authenticated',b,`SELECT public.get_entitlements('${b}') AS e`))[0].e.tier,'pro');
  assert.equal((await as('authenticated',a,"SELECT public.get_paywall_state('adaptation') AS p"))[0].p.locked,true);
  assert.equal((await as('authenticated',b,"SELECT public.get_paywall_state('adaptation') AS p"))[0].p.locked,false);
  await denied(()=>as('authenticated',a,`SELECT public.get_entitlements('${b}')`));
  await denied(()=>as('authenticated',a,`SELECT public.get_paywall_state('adaptation','${b}')`));
  await exec(`DELETE FROM public.entitlements WHERE user_id='${a}'`);
  const fallback=(await as('authenticated',a,'SELECT public.get_entitlements(NULL) AS e'))[0].e;
  assert.deepEqual(fallback,{tier:'free',flags:{can_view_plan:true,can_adapt:false,can_explain:false,can_voice:false,can_spatial:false}});
 });
 await test('null identity, missing signed role and user-editable metadata cannot authorize access',async()=>{
  await apply();await denied(()=>as('authenticated',null,'SELECT public.get_entitlements()'));
  await denied(()=>as('authenticated',a,'SELECT public.get_entitlements()',{role:null,user_metadata:{role:'authenticated',is_admin:true}}));
  assert.equal((await as('authenticated',a,'SELECT public.get_entitlements() AS e',{user_metadata:{has_premium:true,is_admin:true}}))[0].e.tier,'free');
 });
 await test('anon/service entitlement endpoints and client purchase RPCs denied; existing server purchase behavior preserved',async()=>{
  await apply();for(const role of ['anon','service_role'])for(const fn of [`get_entitlements('${a}')`,`get_paywall_state('adaptation','${a}')`])await denied(()=>as(role,a,'SELECT public.'+fn));
  for(const role of ['anon','authenticated'])for(const fn of [`start_purchase('${a}','play_store','pro','purchase')`,`restore_purchase('${a}','play_store','synthetic','restore')`])await denied(()=>as(role,a,'SELECT public.'+fn));
  assert.equal((await as('service_role',a,`SELECT public.start_purchase('${a}','play_store','pro','trusted') AS p`))[0].p.status,'started');
 });
 await test('unknown function body aborts before any grant changes',async()=>{
  await exec("SET ROLE postgres;CREATE OR REPLACE FUNCTION public.get_entitlements(p_user_id uuid DEFAULT NULL) RETURNS jsonb LANGUAGE sql SECURITY DEFINER AS $$ SELECT '{}'::jsonb $$;RESET ROLE;");
  await assert.rejects(apply(),/baseline drift/);
  assert.equal((await rows("SELECT has_table_privilege('authenticated','public.entitlements','UPDATE') AS allowed"))[0].allowed,true);
 });
 await test('inherited writer grants abort and roll back earlier changes',async()=>{
  await exec('GRANT UPDATE(tier) ON public.entitlements TO leaked_writer;');
  await assert.rejects(apply(),/Effective finance writer remains/);
  assert.equal((await rows("SELECT has_function_privilege('anon','public.get_entitlements(uuid)','EXECUTE') AS allowed"))[0].allowed,true);
  await exec('REVOKE UPDATE(tier) ON public.entitlements FROM leaked_writer;');
 });
 await test('review wrapper rolls back data, policies, bodies and grants',async()=>{
  const before=await snapshot();await exec('SET ROLE postgres;');await exec(draft);await exec('RESET ROLE;');assert.deepEqual(await snapshot(),before);
  assert.equal((await rows("SELECT has_table_privilege('authenticated','public.entitlements','UPDATE') AS allowed"))[0].allowed,true);
  assert.equal((await as('authenticated',a,`SELECT public.get_entitlements('${b}') AS e`))[0].e.tier,'pro');
 });
 await test('server capability inherited only from PUBLIC is not silently removed',async()=>{
  await exec('REVOKE EXECUTE ON FUNCTION public.start_purchase(uuid,text,text,text) FROM service_role;');
  await assert.rejects(apply(),/server purchase capability changed/);
  assert.equal((await rows("SELECT has_table_privilege('authenticated','public.entitlements','UPDATE') AS allowed"))[0].allowed,true);
 });
 await test('a broad extra SELECT policy rejects the baseline before changes',async()=>{
  await exec('SET ROLE postgres;CREATE POLICY broad_read ON public.entitlements FOR SELECT USING(true);RESET ROLE;');
  await assert.rejects(apply(),/Finance owner policy drift/);
  assert.equal((await rows("SELECT has_table_privilege('authenticated','public.entitlements','UPDATE') AS allowed"))[0].allowed,true);
 });
 await test('missing unique entitlement owner index rejects the baseline before changes',async()=>{
  await exec('DROP INDEX public.entitlements_user_idx;');
  await assert.rejects(apply(),/Expected unique entitlement user index/);
  assert.equal((await rows("SELECT has_table_privilege('authenticated','public.entitlements','UPDATE') AS allowed"))[0].allowed,true);
 });
 console.log(`PREMIUM_AUTHORITY_SQL_OK: ${passed} cases; public source fixture only`);
}finally{embedded?await db.close():await db.end();}
