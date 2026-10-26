import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {pathToFileURL} from 'node:url';
import {legacySchema,A,B,FOOD,REVIEW,DRAFT} from '../catalog-authority/fixture.mjs';
import {loadInputs,combined,body,order} from './inputs.mjs';
import {permissionQuery,assertPermissions} from './checks.mjs';
import {buildRehearsal,parseCopyCounts} from './restored.mjs';

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
async function fixture(){
 await exec(`ROLLBACK;RESET ROLE;RESET search_path;DROP EXTENSION IF EXISTS pg_trgm CASCADE;DROP SCHEMA IF EXISTS public CASCADE;DROP SCHEMA IF EXISTS extensions CASCADE;DROP SCHEMA IF EXISTS auth CASCADE;DROP SCHEMA IF EXISTS storage CASCADE;DROP SCHEMA IF EXISTS potok_control CASCADE;DROP SCHEMA IF EXISTS potok_nutrition CASCADE;
 CREATE SCHEMA public AUTHORIZATION postgres;CREATE SCHEMA extensions AUTHORIZATION postgres;CREATE SCHEMA auth;CREATE SCHEMA storage AUTHORIZATION postgres;
 REVOKE CREATE ON SCHEMA public,extensions FROM PUBLIC;GRANT USAGE ON SCHEMA public,extensions,auth TO postgres,anon,authenticated,service_role;
 CREATE FUNCTION auth.jwt() RETURNS jsonb LANGUAGE sql STABLE AS $$ SELECT coalesce(nullif(current_setting('request.jwt.claims',true),''),'{}')::jsonb $$;
 CREATE FUNCTION auth.uid() RETURNS uuid LANGUAGE sql STABLE AS $$ SELECT (auth.jwt()->>'sub')::uuid $$;
 CREATE TABLE auth.users(id uuid PRIMARY KEY);INSERT INTO auth.users VALUES('${A}'),('${B}');GRANT SELECT,REFERENCES ON auth.users TO postgres;
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
 await exec('RESET ROLE;ALTER DEFAULT PRIVILEGES FOR ROLE supabase_admin IN SCHEMA public GRANT TRUNCATE ON TABLES TO anon,authenticated;');
}
async function as(role,sub,sql){await exec(`BEGIN;SET LOCAL ROLE ${role};SELECT set_config('request.jwt.claims','${JSON.stringify({role,sub})}',true);`);try{const r=await rows(sql);await exec('COMMIT;');return r;}catch(e){await exec('ROLLBACK;');throw e;}}
const denied=fn=>assert.rejects(fn,e=>e.code==='42501');
async function apply(text=combined(sources),commit=true,authority=true){await exec('SET SESSION AUTHORIZATION postgres;BEGIN;');try{await exec(text);await finalPermissions(authority);await exec(commit?'COMMIT;':'ROLLBACK;');}catch(e){await exec('ROLLBACK;');throw e;}finally{await exec('SET SESSION AUTHORIZATION test_admin;RESET ROLE;');}}
async function issue(action='grant'){await exec('SET SESSION AUTHORIZATION postgres;');try{return await rows(action==='grant'?`SELECT potok_control.grant_entitlement_v2('${B}','admin',now()+interval '1 day','synthetic-combination','synthetic-test')`:`SELECT potok_control.revoke_entitlement_v2('${B}','admin','synthetic-combination-revoke','synthetic-test')`);}finally{await exec('SET SESSION AUTHORIZATION test_admin;');}}
async function finalPermissions(authority=true){assertPermissions((await rows(permissionQuery(authority)))[0]);}

async function snapshot(){
 const metadata=await rows(`SELECT jsonb_build_object(
 'relations',(SELECT jsonb_agg(to_jsonb(c) ORDER BY c.oid) FROM pg_class c JOIN pg_namespace n ON n.oid=c.relnamespace WHERE n.nspname IN('public','extensions','potok_control','potok_nutrition')),
 'columns',(SELECT jsonb_agg(to_jsonb(a) ORDER BY a.attrelid,a.attnum) FROM pg_attribute a JOIN pg_class c ON c.oid=a.attrelid JOIN pg_namespace n ON n.oid=c.relnamespace WHERE n.nspname IN('public','extensions','potok_control','potok_nutrition')),
 'routines',(SELECT jsonb_agg(to_jsonb(p) ORDER BY p.oid) FROM pg_proc p JOIN pg_namespace n ON n.oid=p.pronamespace WHERE n.nspname IN('public','extensions','potok_control','potok_nutrition')),
 'policies',(SELECT jsonb_agg(to_jsonb(p) ORDER BY p.oid) FROM pg_policy p),
 'defaults',(SELECT jsonb_agg(to_jsonb(d) ORDER BY d.oid) FROM pg_default_acl d),
 'constraints',(SELECT jsonb_agg(to_jsonb(c) ORDER BY c.oid) FROM pg_constraint c WHERE c.connamespace='public'::regnamespace),
 'extension',(SELECT to_jsonb(e) FROM pg_extension e WHERE extname='pg_trgm'),
 'schemas',(SELECT jsonb_agg(to_jsonb(n) ORDER BY oid) FROM pg_namespace n WHERE nspname IN('public','extensions','potok_control','potok_nutrition')),
 'roles',(SELECT jsonb_agg(to_jsonb(r) ORDER BY oid) FROM pg_roles r)) AS metadata`);
 const tables=await rows("SELECT n.nspname AS schema,c.relname AS name FROM pg_class c JOIN pg_namespace n ON n.oid=c.relnamespace WHERE n.nspname IN('public','potok_control','storage') AND c.relkind IN('r','p') ORDER BY 1,2");
 const data=[];for(const t of tables){const quote=s=>'"'+s.replace(/"/g,'""')+'"';data.push({table:t.schema+'.'+t.name,rows:await rows('SELECT to_jsonb(t) AS row FROM '+quote(t.schema)+'.'+quote(t.name)+' t ORDER BY to_jsonb(t)::text')});}
 return {metadata,data};
}
let passed=0;async function test(name,fn,options){await fixture(options);await fn();passed++;console.log('PASS '+name);}
try{
 if(embedded)await exec('CREATE ROLE test_admin SUPERUSER;SET SESSION AUTHORIZATION test_admin;ALTER ROLE postgres RENAME TO embedded_bootstrap;CREATE ROLE postgres NOSUPERUSER BYPASSRLS;');
 else await exec('CREATE ROLE postgres NOSUPERUSER BYPASSRLS;ALTER DATABASE potok_accumulated_test OWNER TO postgres;');
 await exec('CREATE ROLE anon;CREATE ROLE authenticated;CREATE ROLE service_role BYPASSRLS;CREATE ROLE supabase_admin;');
 const database=(await rows('SELECT current_database() AS name'))[0].name;assert(/^[a-z_][a-z0-9_]*$/.test(database));await exec('ALTER DATABASE '+database+' OWNER TO postgres;');
 await test('all eight exact candidates coexist; review rollback restores metadata and every synthetic row',async()=>{
  const before=await snapshot();await apply(undefined,false);assert.deepEqual(await snapshot(),before);
 });
 await test('committed combination preserves data and final rights beyond the transaction',async()=>{
  const before=(await snapshot()).data;await apply();await finalPermissions();const after=(await snapshot()).data;assert.deepEqual(after.filter(t=>before.some(b=>b.table===t.table)),before);assert.deepEqual(after.filter(t=>!before.some(b=>b.table===t.table)),[{table:'potok_control.access_attestations',rows:[]}]);
  assert.equal((await rows("SELECT rolsuper FROM pg_roles WHERE rolname='postgres'"))[0].rolsuper,false);
  const residual=await rows("SELECT a.privilege_type FROM pg_default_acl d CROSS JOIN LATERAL aclexplode(d.defaclacl) a WHERE d.defaclrole='supabase_admin'::regrole AND a.privilege_type='TRUNCATE'");assert.equal(residual.length,2);
 });
 await test('committed profile, finance, verified catalog and photo paths work together',async()=>{
  await apply();await issue();const before=await rows('SELECT to_jsonb(d) AS row FROM public.food_diary_entries d ORDER BY user_id');
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
 await test('combined installation starts empty; real issuance and same-claims revocation preserve profile and history',async()=>{
  await apply();const before=await rows('SELECT to_jsonb(p) AS row FROM public.user_profiles p ORDER BY id_user');
  assert.equal((await as('authenticated',A,"SELECT public.has_verified_entitlement_v1('admin') AS allowed"))[0].allowed,false);
  assert.equal((await as('authenticated',B,"SELECT public.has_verified_entitlement_v1('admin') AS allowed"))[0].allowed,false);
  await issue();assert.equal((await as('authenticated',B,'SELECT public.has_catalog_admin_access_v1() AS allowed'))[0].allowed,true);
  await issue('revoke');assert.equal((await as('authenticated',B,'SELECT public.has_catalog_admin_access_v1() AS allowed'))[0].allowed,false);
  assert.deepEqual(await rows('SELECT to_jsonb(p) AS row FROM public.user_profiles p ORDER BY id_user'),before);await finalPermissions();
 });
 await test('authority before profile containment fails and restores the whole baseline',async()=>{
  const before=await snapshot();await assert.rejects(()=>apply(combined(sources,['truncate','authority','profile','anonymous','photos','finance','catalog','trgm'])),/profile column containment/);assert.deepEqual(await snapshot(),before);
 });
 await test('missing verified authority keeps administration closed without blocking ordinary profile/photo access',async()=>{
  await apply(combined(sources,order.filter(k=>k!=='authority')),true,false);assert.equal((await as('authenticated',B,'SELECT public.has_catalog_admin_access_v1() AS allowed'))[0].allowed,false);
  assert.equal((await as('authenticated',A,`SELECT * FROM public.apply_owner_approved_missing_food_draft('${DRAFT}')`))[0].result,'permission_denied');
  await as('authenticated',A,"UPDATE public.user_profiles SET first_name='Ordinary' WHERE id_user=auth.uid()");
  await as('authenticated',A,`INSERT INTO public.measurement_photo_assets(user_id,day,slot,storage_path) VALUES('${A}','2026-10-26','main_1','synthetic')`);
 });
 await test('last candidate failure atomically restores all earlier changes',async()=>{
  await exec('GRANT CREATE ON SCHEMA extensions TO authenticated;');const before=await snapshot();
  await assert.rejects(apply(),/Client CREATE on target schema/);assert.deepEqual(await snapshot(),before);
 });
 await test('anonymous containment must precede retiring the SECURITY DEFINER history endpoint',async()=>{
  const before=await snapshot();const wrong=['truncate','profile','photos','finance','authority','catalog','anonymous','trgm'];
  await assert.rejects(()=>apply(combined(sources,wrong)),/SECURITY DEFINER drift/);assert.deepEqual(await snapshot(),before);
 });
 await test('a late grant regression is rejected by the accumulated final verifier',async()=>{
  const before=await snapshot();await assert.rejects(()=>apply(combined(sources)+'\nGRANT EXECUTE ON FUNCTION public.get_entitlements(uuid) TO service_role;'),/Accumulated effective permissions failed/);assert.deepEqual(await snapshot(),before);
 });
 await test('late verified-reader replacement is rejected even when grants remain correct',async()=>{
  const before=await snapshot();await assert.rejects(()=>apply(combined(sources)+"\nCREATE OR REPLACE FUNCTION public.has_verified_entitlement_v1(p_capability text) RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path=pg_catalog AS 'SELECT true';"),/Accumulated effective permissions failed/);assert.deepEqual(await snapshot(),before);
 });
 await test('owner restored rehearsal streams prefix, rollback transaction and postchecks with content proof',async()=>{
  const before=await snapshot();const tables=await rows("SELECT n.nspname AS schema,c.relname AS name FROM pg_class c JOIN pg_namespace n ON n.oid=c.relnamespace WHERE n.nspname IN('auth','public','storage') AND c.relkind='r' ORDER BY 1,2");
  for(const t of tables)t.rows=Number((await rows('SELECT count(*) AS n FROM "'+t.schema+'"."'+t.name+'"'))[0].n);
  const script=buildRehearsal(sources,tables),[prefix,rest]=script.split(/^BEGIN;\n/m),[transaction,suffix]=rest.split(/^ROLLBACK;\n/m);assert(prefix&&transaction&&suffix);
  await exec('SET SESSION AUTHORIZATION postgres;');try{await exec(prefix);await exec('BEGIN;\n'+transaction+'ROLLBACK;');await exec(suffix);}finally{await exec('ROLLBACK;SET SESSION AUTHORIZATION test_admin;');}
  assert.deepEqual(await snapshot(),before);
  assert.throws(()=>parseCopyCounts('COPY public.t (x) FROM stdin;\nunfinished'));
  assert.deepEqual(parseCopyCounts('COPY public.empty (x) FROM stdin;\n\\.\n'),[{schema:'public',name:'empty',rows:0}]);
 });
 await test('single-use source guards reject reapplication without changing the secured state',async()=>{
  await apply();const before=await snapshot();await assert.rejects(apply);assert.deepEqual(await snapshot(),before);
 });
 await test('restored rehearsal detects changed content even when row counts stay identical',async()=>{
  const before=await snapshot();const tables=[{schema:'public',name:'user_profiles',rows:2}];
  const script=buildRehearsal(sources,tables).replace('DO $permissions$',"UPDATE public.user_profiles SET first_name='tampered';\nDO $permissions$");
  const [prefix,rest]=script.split(/^BEGIN;\n/m),[transaction]=rest.split(/^ROLLBACK;\n/m);
  await exec('SET SESSION AUTHORIZATION postgres;');try{
   await exec(prefix);await assert.rejects(()=>exec('BEGIN;\n'+transaction+'ROLLBACK;'),/Restored content mismatch/);await exec('ROLLBACK;DROP TABLE potok_eight_data,potok_eight_state;');
  }finally{await exec('ROLLBACK;SET SESSION AUTHORIZATION test_admin;');}
  assert.deepEqual(await snapshot(),before);
 });
 assert.throws(()=>body('BEGIN;\nROLLBACK;\nCOMMIT;','COMMIT'));assert.throws(()=>combined(sources,['profile','profile']));
 assert.deepEqual(order,['truncate','profile','anonymous','photos','finance','authority','catalog','trgm']);
 console.log(`ACCUMULATED_SECURITY_OK: ${passed} cases / eight pinned candidates; synthetic data only; no hosted access`);
}catch(e){console.error('ACCUMULATED_SECURITY_FAILED: '+e.message+' '+(e.code??''));process.exitCode=1;}
finally{await exec('ROLLBACK;RESET ROLE;').catch(()=>{});await(embedded?db.close():db.end());}
