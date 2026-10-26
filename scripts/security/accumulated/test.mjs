import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {pathToFileURL} from 'node:url';
import {legacySchema,verifiedReaders,A,B,FOOD,REVIEW,DRAFT} from '../catalog-authority/fixture.mjs';
import {loadInputs,combined,body,order} from './inputs.mjs';

const embedded=process.env.SQL_TEST_PGLITE_MODULE;let db;
if(embedded){const {PGlite}=await import(pathToFileURL(embedded));const {pg_trgm}=await import(pathToFileURL(process.env.SQL_TEST_TRGM_MODULE));db=new PGlite({extensions:{pg_trgm}});}
else{const url=new URL(process.env.TEST_DATABASE_URL??'');assert.equal(url.hostname,'127.0.0.1');assert.equal(url.pathname,'/potok_accumulated_test');const {default:pg}=await import(pathToFileURL(process.env.SQL_TEST_PG_MODULE));db=new pg.Client({connectionString:url.href});await db.connect();}
const exec=sql=>embedded?db.exec(sql):db.query(sql),rows=async sql=>(await db.query(sql)).rows;
const sources=await loadInputs();
const profile=`CREATE TABLE public.user_profiles(id_user uuid PRIMARY KEY,first_name text,last_name text,middle_name text,birth_date date,age integer,height numeric(5,2),goal text,email text,phone text,avatar_url text,has_premium boolean NOT NULL DEFAULT false,is_admin boolean NOT NULL DEFAULT false,created_at timestamptz NOT NULL DEFAULT now(),updated_at timestamptz NOT NULL DEFAULT now(),coach_settings jsonb NOT NULL DEFAULT '{}',voice_settings jsonb NOT NULL DEFAULT '{}');
 INSERT INTO public.user_profiles(id_user,is_admin) VALUES('${A}',true),('${B}',false);
 ALTER TABLE public.user_profiles ENABLE ROW LEVEL SECURITY;
 CREATE POLICY owner_read ON public.user_profiles FOR SELECT TO authenticated USING(auth.uid()=id_user);
 CREATE POLICY owner_insert ON public.user_profiles FOR INSERT TO authenticated WITH CHECK(auth.uid()=id_user);
 CREATE POLICY owner_update ON public.user_profiles FOR UPDATE TO authenticated USING(auth.uid()=id_user) WITH CHECK(auth.uid()=id_user);`;
async function fixture({verified=true}={}){
 await exec(`ROLLBACK;RESET ROLE;DROP EXTENSION IF EXISTS pg_trgm CASCADE;DROP SCHEMA IF EXISTS public CASCADE;DROP SCHEMA IF EXISTS extensions CASCADE;DROP SCHEMA IF EXISTS auth CASCADE;DROP SCHEMA IF EXISTS storage CASCADE;DROP SCHEMA IF EXISTS potok_control CASCADE;
 CREATE SCHEMA public AUTHORIZATION postgres;CREATE SCHEMA extensions AUTHORIZATION postgres;CREATE SCHEMA auth;CREATE SCHEMA storage AUTHORIZATION postgres;CREATE SCHEMA potok_control AUTHORIZATION postgres;
 REVOKE CREATE ON SCHEMA public,extensions FROM PUBLIC;GRANT USAGE ON SCHEMA public,extensions,auth TO postgres,anon,authenticated,service_role;
 CREATE FUNCTION auth.jwt() RETURNS jsonb LANGUAGE sql STABLE AS $$ SELECT coalesce(nullif(current_setting('request.jwt.claims',true),''),'{}')::jsonb $$;
 CREATE FUNCTION auth.uid() RETURNS uuid LANGUAGE sql STABLE AS $$ SELECT (auth.jwt()->>'sub')::uuid $$;
 CREATE TABLE auth.users(id uuid PRIMARY KEY);INSERT INTO auth.users VALUES('${A}'),('${B}');GRANT REFERENCES ON auth.users TO postgres;
 CREATE TABLE storage.buckets(id text PRIMARY KEY,name text,public boolean);ALTER TABLE storage.buckets OWNER TO postgres;
 CREATE TABLE storage.objects(id uuid PRIMARY KEY,bucket_id text,name text);ALTER TABLE storage.objects OWNER TO postgres;
 ALTER DEFAULT PRIVILEGES FOR ROLE postgres IN SCHEMA public REVOKE ALL ON TABLES FROM PUBLIC,anon,authenticated,service_role;`);
 // Bootstrap-only extension ownership setup. Candidate/application actor is NOSUPERUSER.
 for(const sql of ['ALTER ROLE postgres SUPERUSER','SET ROLE postgres','CREATE EXTENSION pg_trgm WITH SCHEMA public','RESET ROLE','ALTER ROLE postgres NOSUPERUSER','SET ROLE postgres'])await exec(sql);
 let catalog=await legacySchema();
 const start=catalog.indexOf('CREATE TABLE public.user_profiles('),end=catalog.indexOf('CREATE TABLE public.foods(');assert(start>=0&&end>start);
 catalog=catalog.slice(0,start)+profile+'\n '+catalog.slice(end);
 await exec(catalog);
 await exec(await readFile('supabase/phase7_3_2_monetization.sql','utf8'));
 await exec(`CREATE FUNCTION public.rls_auto_enable() RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog AS $$ BEGIN NULL; END $$;
 GRANT ALL ON ALL TABLES IN SCHEMA public TO PUBLIC,anon,authenticated,service_role;
 GRANT EXECUTE ON ALL FUNCTIONS IN SCHEMA public TO authenticated,service_role;
 ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT TRUNCATE ON TABLES TO anon,authenticated;
 CREATE INDEX fixture_food_trgm ON public.foods USING gin(name public.gin_trgm_ops);
 INSERT INTO public.entitlements(user_id,tier,flags) VALUES('${A}','free','{"can_adapt":false}'),('${B}','pro','{"can_adapt":true}');
 INSERT INTO public.subscriptions(user_id,plan,status) VALUES('${A}','free','active'),('${B}','pro','active');
 INSERT INTO public.billing_events(user_id,provider,event_type,idempotency_key) VALUES('${A}','play_store','fixture','seed-a');`);
 // Photo tables are created after the deliberately broad historical fixture grants.
 for(const name of ['20260224_measurements_photo_assets.sql','20260225_measurement_photo_deletions.sql']){
  const sql=await readFile('supabase/migrations/'+name,'utf8');await exec(embedded?sql.replace(/^create extension if not exists pgcrypto;\s*/i,''):sql);
 }
 if(verified)await exec(await verifiedReaders());
 await exec('RESET ROLE;ALTER DEFAULT PRIVILEGES FOR ROLE supabase_admin IN SCHEMA public GRANT TRUNCATE ON TABLES TO anon,authenticated;');
}
async function as(role,sub,sql){await exec(`BEGIN;SET LOCAL ROLE ${role};SELECT set_config('request.jwt.claims','${JSON.stringify({role,sub})}',true);`);try{const r=await rows(sql);await exec('COMMIT;');return r;}catch(e){await exec('ROLLBACK;');throw e;}}
const denied=fn=>assert.rejects(fn,e=>e.code==='42501');
async function apply(text=combined(sources),commit=true){await exec('BEGIN;SET LOCAL ROLE postgres;');try{await exec(text);await finalPermissions();await exec(commit?'COMMIT;':'ROLLBACK;');}catch(e){await exec('ROLLBACK;');throw e;}}
async function finalPermissions(){
 const r=(await rows(`SELECT
 NOT EXISTS(SELECT FROM pg_class c WHERE c.relnamespace='public'::regnamespace AND c.relkind IN('r','p') AND (has_table_privilege('anon',c.oid,'TRUNCATE') OR has_table_privilege('authenticated',c.oid,'TRUNCATE'))) AS trunc,
 NOT EXISTS(SELECT FROM unnest(ARRAY['anon','authenticated']) r(role),unnest(ARRAY['is_admin','has_premium','created_at','updated_at']) c(col)
 WHERE has_column_privilege(r.role,'public.user_profiles',c.col,'INSERT') OR has_column_privilege(r.role,'public.user_profiles',c.col,'UPDATE')) AS profile,
 has_column_privilege('authenticated','public.user_profiles','first_name','UPDATE') AS ordinary_profile,
 NOT EXISTS(SELECT FROM unnest(ARRAY['public.apply_admin_approved_food_alias(uuid,text,text)','public.apply_owner_approved_missing_food_draft(uuid)','public.get_entitlements(uuid)','public.get_paywall_state(text,uuid)','public.recompute_food_entries_for_food_ids(uuid[])','public.restore_purchase(uuid,text,text,text)','public.rls_auto_enable()','public.start_purchase(uuid,text,text,text)']) s(signature)
 WHERE has_function_privilege('anon',s.signature,'EXECUTE')) AS anon_rpc,
 has_function_privilege('authenticated','public.get_entitlements(uuid)','EXECUTE') AS own_read,
 NOT has_function_privilege('service_role','public.get_entitlements(uuid)','EXECUTE') AS service_read_denied,
 NOT has_function_privilege('authenticated','public.start_purchase(uuid,text,text,text)','EXECUTE') AS client_purchase_denied,
 has_function_privilege('service_role','public.start_purchase(uuid,text,text,text)','EXECUTE') AS server_event_retained,
 NOT EXISTS(SELECT FROM unnest(ARRAY['anon','authenticated']) r(role),unnest(ARRAY['public.entitlements','public.subscriptions','public.billing_events']) t(name)
 WHERE has_table_privilege(r.role,t.name,'INSERT,UPDATE,DELETE,TRUNCATE,REFERENCES,TRIGGER,MAINTAIN')) AS finance,
 NOT has_function_privilege('service_role','public.apply_admin_approved_food_alias(uuid,text,text)','EXECUTE') AS server_admin_denied,
 NOT has_function_privilege('authenticated','public.recompute_food_entries_for_food_ids(uuid[])','EXECUTE') AS history,
 has_table_privilege('authenticated','public.measurement_photo_assets','INSERT') AS photo,
 has_column_privilege('authenticated','public.measurement_photo_deletions','deleted_at','UPDATE') AS photo_upsert,
 (SELECT extnamespace='extensions'::regnamespace FROM pg_extension WHERE extname='pg_trgm') AS trgm`))[0];
 assert(Object.values(r).every(x=>x===true),'Accumulated effective permissions failed: '+JSON.stringify(r));
}
async function snapshot(){
 const metadata=await rows(`SELECT jsonb_build_object(
 'relations',(SELECT jsonb_agg(to_jsonb(c) ORDER BY c.oid) FROM pg_class c JOIN pg_namespace n ON n.oid=c.relnamespace WHERE n.nspname IN('public','extensions','potok_control')),
 'columns',(SELECT jsonb_agg(to_jsonb(a) ORDER BY a.attrelid,a.attnum) FROM pg_attribute a JOIN pg_class c ON c.oid=a.attrelid JOIN pg_namespace n ON n.oid=c.relnamespace WHERE n.nspname IN('public','extensions','potok_control')),
 'routines',(SELECT jsonb_agg(to_jsonb(p) ORDER BY p.oid) FROM pg_proc p JOIN pg_namespace n ON n.oid=p.pronamespace WHERE n.nspname IN('public','extensions','potok_control')),
 'policies',(SELECT jsonb_agg(to_jsonb(p) ORDER BY p.oid) FROM pg_policy p),
 'defaults',(SELECT jsonb_agg(to_jsonb(d) ORDER BY d.oid) FROM pg_default_acl d),
 'constraints',(SELECT jsonb_agg(to_jsonb(c) ORDER BY c.oid) FROM pg_constraint c WHERE c.connamespace='public'::regnamespace),
 'extension',(SELECT to_jsonb(e) FROM pg_extension e WHERE extname='pg_trgm'),
 'roles',(SELECT jsonb_agg(to_jsonb(r) ORDER BY oid) FROM pg_roles r)) AS metadata`);
 const tables=await rows("SELECT n.nspname AS schema,c.relname AS name FROM pg_class c JOIN pg_namespace n ON n.oid=c.relnamespace WHERE n.nspname IN('public','potok_control','storage') AND c.relkind IN('r','p') ORDER BY 1,2");
 const data=[];for(const t of tables){const quote=s=>'"'+s.replace(/"/g,'""')+'"';data.push({table:t.schema+'.'+t.name,rows:await rows('SELECT to_jsonb(t) AS row FROM '+quote(t.schema)+'.'+quote(t.name)+' t ORDER BY to_jsonb(t)::text')});}
 return {metadata,data};
}
let passed=0;async function test(name,fn,options){await fixture(options);await fn();passed++;console.log('PASS '+name);}
try{
 if(embedded)await exec('CREATE ROLE test_admin SUPERUSER;SET SESSION AUTHORIZATION test_admin;ALTER ROLE postgres RENAME TO embedded_bootstrap;CREATE ROLE postgres NOSUPERUSER;');
 else await exec('CREATE ROLE postgres NOSUPERUSER;ALTER DATABASE potok_accumulated_test OWNER TO postgres;');
 await exec('CREATE ROLE anon;CREATE ROLE authenticated;CREATE ROLE service_role BYPASSRLS;CREATE ROLE supabase_admin;');
 await test('all seven exact candidates coexist; review rollback restores metadata and every synthetic row',async()=>{
  const before=await snapshot();await apply(undefined,false);assert.deepEqual(await snapshot(),before);
 });
 await test('committed combination preserves data and final rights beyond the transaction',async()=>{
  const before=(await snapshot()).data;await apply();await finalPermissions();assert.deepEqual((await snapshot()).data,before);
  assert.equal((await rows("SELECT rolsuper FROM pg_roles WHERE rolname='postgres'"))[0].rolsuper,false);
  const residual=await rows("SELECT a.privilege_type FROM pg_default_acl d CROSS JOIN LATERAL aclexplode(d.defaclacl) a WHERE d.defaclrole='supabase_admin'::regrole AND a.privilege_type='TRUNCATE'");assert.equal(residual.length,2);
 });
 await test('committed profile, finance, verified catalog and photo paths work together',async()=>{
  await apply();const before=await rows('SELECT to_jsonb(d) AS row FROM public.food_diary_entries d ORDER BY user_id');
  await as('authenticated',A,"UPDATE public.user_profiles SET first_name='Updated' WHERE id_user=auth.uid()");
  await denied(()=>as('authenticated',A,'UPDATE public.user_profiles SET is_admin=true WHERE id_user=auth.uid()'));
  assert.equal((await as('authenticated',A,'SELECT public.get_entitlements() AS e'))[0].e.tier,'free');
  await denied(()=>as('authenticated',A,`SELECT public.get_entitlements('${B}')`));
  await denied(()=>as('authenticated',A,"UPDATE public.entitlements SET tier='pro' WHERE user_id=auth.uid()"));
  assert.equal((await as('authenticated',A,`SELECT * FROM public.apply_admin_approved_food_alias('${REVIEW}',NULL,NULL)`))[0].result,'permission_denied');
  assert.equal((await as('authenticated',B,`SELECT * FROM public.apply_admin_approved_food_alias('${REVIEW}',NULL,NULL)`))[0].result,'applied');
  assert.equal((await as('authenticated',B,`SELECT * FROM public.apply_owner_approved_missing_food_draft('${DRAFT}')`))[0].result,'applied');
  await denied(()=>as('postgres',A,`SELECT public.recompute_food_entries_for_food_ids(ARRAY['${FOOD}'::uuid])`));
  const photo=`INSERT INTO public.measurement_photo_deletions(user_id,day,deleted_at) VALUES('${A}','2026-10-26','2026-10-26T12:00:00Z') ON CONFLICT(user_id,day) DO UPDATE SET user_id=excluded.user_id,day=excluded.day,deleted_at=excluded.deleted_at`;
  await as('authenticated',A,photo);await as('authenticated',A,photo.replace('12:00','13:00'));
  assert.equal((await as('authenticated',B,'SELECT * FROM public.measurement_photo_deletions')).length,0);
  assert.equal((await as('authenticated',A,"SELECT name FROM public.foods WHERE name ILIKE '%apple%'"))[0].name,'Fixture apple');
  assert.deepEqual(await rows('SELECT to_jsonb(d) AS row FROM public.food_diary_entries d ORDER BY user_id'),before);await finalPermissions();
 });
 await test('missing verified authority keeps administration closed without blocking ordinary profile/photo access',async()=>{
  await apply();assert.equal((await as('authenticated',B,'SELECT public.has_catalog_admin_access_v1() AS allowed'))[0].allowed,false);
  assert.equal((await as('authenticated',A,`SELECT * FROM public.apply_owner_approved_missing_food_draft('${DRAFT}')`))[0].result,'permission_denied');
  await as('authenticated',A,"UPDATE public.user_profiles SET first_name='Ordinary' WHERE id_user=auth.uid()");
  await as('authenticated',A,`INSERT INTO public.measurement_photo_assets(user_id,day,slot,storage_path) VALUES('${A}','2026-10-26','main_1','synthetic')`);
 },{verified:false});
 await test('last candidate failure atomically restores all earlier changes',async()=>{
  await exec('GRANT CREATE ON SCHEMA extensions TO authenticated;');const before=await snapshot();
  await assert.rejects(apply(),/Client CREATE on target schema/);assert.deepEqual(await snapshot(),before);
 });
 await test('anonymous containment must precede retiring the SECURITY DEFINER history endpoint',async()=>{
  const before=await snapshot();const wrong=['truncate','profile','photos','finance','catalog','anonymous','trgm'];
  await assert.rejects(()=>apply(combined(sources,wrong)),/SECURITY DEFINER drift/);assert.deepEqual(await snapshot(),before);
 });
 await test('a late grant regression is rejected by the accumulated final verifier',async()=>{
  const before=await snapshot();await assert.rejects(()=>apply(combined(sources)+'\nGRANT EXECUTE ON FUNCTION public.get_entitlements(uuid) TO service_role;'),/Accumulated effective permissions failed/);assert.deepEqual(await snapshot(),before);
 });
 await test('single-use source guards reject reapplication without changing the secured state',async()=>{
  await apply();const before=await snapshot();await assert.rejects(apply);assert.deepEqual(await snapshot(),before);
 });
 assert.throws(()=>body('BEGIN;\nROLLBACK;\nCOMMIT;','COMMIT'));assert.throws(()=>combined(sources,['profile','profile']));
 assert.deepEqual(order,['truncate','profile','anonymous','photos','finance','catalog','trgm']);
 console.log(`ACCUMULATED_SECURITY_OK: ${passed} cases / seven pinned candidates; synthetic data only; no hosted access`);
}catch(e){console.error('ACCUMULATED_SECURITY_FAILED: '+e.message+' '+(e.code??''));process.exitCode=1;}
finally{await exec('ROLLBACK;RESET ROLE;').catch(()=>{});await(embedded?db.close():db.end());}
