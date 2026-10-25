import assert from 'node:assert/strict';
import {readFile,writeFile} from 'node:fs/promises';
import {pathToFileURL} from 'node:url';
import {buildRehearsal,parseCopyCounts,downloadSources,transactionBody} from './run.mjs';
const embedded=process.env.SQL_TEST_PGLITE_MODULE;
let db;
if(embedded){const {PGlite}=await import(pathToFileURL(embedded));const {pg_trgm}=await import(pathToFileURL(process.env.SQL_TEST_TRGM_MODULE));db=new PGlite({extensions:{pg_trgm}});await db.exec('CREATE ROLE test_admin SUPERUSER;SET SESSION AUTHORIZATION test_admin;ALTER ROLE postgres RENAME TO fixture_bootstrap;CREATE ROLE postgres NOSUPERUSER;');}
else{const u=new URL(process.env.TEST_DATABASE_URL??'');assert.equal(u.hostname,'127.0.0.1');assert.equal(u.pathname,'/potok_joint_test');const {default:pg}=await import(pathToFileURL(process.env.SQL_TEST_PG_MODULE));db=new pg.Client({connectionString:u.href});await db.connect();}
const exec=s=>embedded?db.exec(s):db.query(s);
const rows=async s=>(await db.query(s)).rows;
const sources=process.env.JOINT_INPUT_DIR?Object.fromEntries(await Promise.all(['truncate','profile','rpc','trgm'].map(async k=>[k,await readFile(process.env.JOINT_INPUT_DIR+'/'+k+'.sql','utf8')]))):await downloadSources();
const tables=[{schema:'public',table:'user_profiles',rows:1},{schema:'public',table:'food_fixture',rows:2}];
const sql=buildRehearsal(sources,tables);
// psql streams statements; preserve its pre-transaction TEMP evidence semantics.
async function rehearse(text){const [prefix,rest]=text.split(/^BEGIN;\n/m);assert(rest);const [body,suffix]=rest.split(/^ROLLBACK;\n/m);assert(suffix);await exec(prefix);await exec('BEGIN;\n'+body+'ROLLBACK;');await exec(suffix);}
const signatures=['apply_admin_approved_food_alias(uuid,text,text)','apply_owner_approved_missing_food_draft(uuid)','get_entitlements(uuid)','get_paywall_state(text,uuid)','recompute_food_entries_for_food_ids(uuid[])','restore_purchase(uuid,text,text,text)','rls_auto_enable()','start_purchase(uuid,text,text,text)'];
async function fixture(){
 await exec(`ROLLBACK;RESET ROLE;DROP TABLE IF EXISTS pg_temp.potok_joint_state,pg_temp.potok_joint_data;DROP EXTENSION IF EXISTS pg_trgm CASCADE;DROP SCHEMA IF EXISTS public CASCADE;DROP SCHEMA IF EXISTS extensions CASCADE;
 CREATE SCHEMA public AUTHORIZATION postgres;CREATE SCHEMA extensions AUTHORIZATION postgres;
 REVOKE CREATE ON SCHEMA public FROM PUBLIC;GRANT USAGE ON SCHEMA public,extensions TO postgres,anon,authenticated,service_role;`);
 // Native trusted-extension members may otherwise belong to the bootstrap role.
 // Elevation is only for fixture installation; every rehearsal runs non-superuser.
 for(const s of ['ALTER ROLE postgres SUPERUSER','SET ROLE postgres','CREATE EXTENSION pg_trgm WITH SCHEMA public','RESET ROLE','ALTER ROLE postgres NOSUPERUSER','SET ROLE postgres'])await exec(s);
 await exec(`CREATE TABLE public.user_profiles(id_user uuid PRIMARY KEY,first_name text,last_name text,middle_name text,birth_date date,age integer,height numeric(5,2),goal text,email text,phone text,avatar_url text,has_premium boolean NOT NULL DEFAULT false,is_admin boolean NOT NULL DEFAULT false,created_at timestamptz NOT NULL DEFAULT now(),updated_at timestamptz NOT NULL DEFAULT now(),coach_settings jsonb NOT NULL DEFAULT '{}',voice_settings jsonb NOT NULL DEFAULT '{}');
 INSERT INTO public.user_profiles(id_user,first_name) VALUES('11111111-1111-4111-8111-111111111111','A');
 ALTER TABLE public.user_profiles ENABLE ROW LEVEL SECURITY;
 CREATE POLICY owner_read ON public.user_profiles FOR SELECT TO authenticated USING(auth.uid()=id_user);
 CREATE POLICY owner_insert ON public.user_profiles FOR INSERT TO authenticated WITH CHECK(auth.uid()=id_user);
 CREATE POLICY owner_update ON public.user_profiles FOR UPDATE TO authenticated USING(auth.uid()=id_user) WITH CHECK(auth.uid()=id_user);
 GRANT SELECT,INSERT,UPDATE ON public.user_profiles TO authenticated;GRANT INSERT,UPDATE ON public.user_profiles TO PUBLIC;GRANT ALL ON public.user_profiles TO service_role;
 CREATE TABLE public.food_fixture(id integer PRIMARY KEY,name text NOT NULL);INSERT INTO public.food_fixture VALUES(1,'apple'),(2,'oatmeal');
 CREATE INDEX food_name_trgm_idx ON public.food_fixture USING gin(name public.gin_trgm_ops);
 GRANT TRUNCATE ON public.user_profiles,public.food_fixture TO PUBLIC,anon,authenticated;
 ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT TRUNCATE ON TABLES TO anon,authenticated;`);
 for(const signature of signatures)await exec(`CREATE FUNCTION public.${signature} RETURNS text LANGUAGE sql SECURITY DEFINER SET search_path=pg_catalog AS 'SELECT NULL::text';GRANT EXECUTE ON FUNCTION public.${signature} TO authenticated,service_role;`);
 await exec('RESET ROLE;ALTER DEFAULT PRIVILEGES FOR ROLE supabase_admin IN SCHEMA public GRANT TRUNCATE ON TABLES TO anon,authenticated;');
}
async function baseline(){
 await exec('ROLLBACK;RESET ROLE;');
 const r=(await rows(`SELECT has_table_privilege('anon','public.user_profiles','TRUNCATE') AS trunc,has_column_privilege('authenticated','public.user_profiles','is_admin','UPDATE') AS profile,has_function_privilege('anon','public.get_entitlements(uuid)','EXECUTE') AS rpc,(SELECT extnamespace='public'::regnamespace FROM pg_extension WHERE extname='pg_trgm') AS trgm,(SELECT first_name FROM public.user_profiles) AS name`))[0];
 assert.deepEqual(r,{trunc:true,profile:true,rpc:true,trgm:true,name:'A'});
}
let passed=0;
async function test(name,fn){await fixture();await fn();passed++;console.log('PASS '+name);}
try{
 assert(Number((await rows('SHOW server_version_num'))[0].server_version_num)>=170000);assert(Number((await rows('SHOW server_version_num'))[0].server_version_num)<180000);
 await exec(`DO $$ BEGIN IF NOT EXISTS(SELECT FROM pg_roles WHERE rolname='postgres') THEN CREATE ROLE postgres NOSUPERUSER;END IF;END $$;CREATE ROLE anon;CREATE ROLE authenticated;CREATE ROLE service_role BYPASSRLS;CREATE ROLE supabase_admin;
 CREATE SCHEMA auth;CREATE FUNCTION auth.uid() RETURNS uuid LANGUAGE sql STABLE AS $$ SELECT nullif(current_setting('fixture.uid',true),'')::uuid $$;GRANT USAGE ON SCHEMA auth TO postgres,anon,authenticated,service_role;`);
 await test('all four candidates coexist and exact metadata/data roll back',async()=>{await exec('SET ROLE postgres;');await rehearse(sql);await baseline();});
 await test('already contained TRUNCATE baseline is preserved',async()=>{await exec('SET ROLE postgres;');await exec(sources.truncate);await rehearse(sql);assert.equal((await rows("SELECT has_table_privilege('anon','public.user_profiles','TRUNCATE') AS allowed"))[0].allowed,false);await exec('RESET ROLE;');});
 await test('failure at profile preflight rolls back earlier TRUNCATE changes',async()=>{await exec('ALTER TABLE public.user_profiles ALTER COLUMN is_admin SET DEFAULT true;SET ROLE postgres;');await assert.rejects(rehearse(sql),e=>e.message.includes('Privilege defaults'));await baseline();});
 await test('failure at last extension preflight rolls back all earlier candidates',async()=>{await exec('GRANT CREATE ON SCHEMA extensions TO anon;SET ROLE postgres;');await assert.rejects(rehearse(sql),e=>e.message.includes('Client CREATE on target schema'));await baseline();});
 await test('same row count with changed content is detected and rolled back',async()=>{const changed=sql.replace('-- Recheck all permission',"UPDATE public.user_profiles SET first_name='changed';\n-- Recheck all permission");await exec('SET ROLE postgres;');await assert.rejects(rehearse(changed),e=>e.message.includes('Joint content mismatch'));await baseline();});
 await test('COPY parser handles empty blocks, quoted paths and data resembling headers',async()=>{assert.deepEqual(parseCopyCounts('COPY "public"."odd""name" (x) FROM stdin;\nCOPY public.fake (x) FROM stdin;\n\\.\nCOPY public.empty (x) FROM stdin;\n\\.\n'),[{schema:'public',table:'odd"name',rows:1},{schema:'public',table:'empty',rows:0}]);assert.throws(()=>parseCopyCounts('COPY public.t (x) FROM stdin;\nunfinished'));});
 await test('extra transactions, changed pinned bytes and duplicate COPY tables fail closed',async()=>{assert.throws(()=>transactionBody(sources.profile+'COMMIT;\n','COMMIT'));assert.throws(()=>buildRehearsal({...sources,rpc:sources.rpc+'\n'},tables));assert.throws(()=>parseCopyCounts('COPY public.t (x) FROM stdin;\n\\.\nCOPY public.t (x) FROM stdin;\n\\.\n'));});
 if(process.env.JOINT_SQL_OUT)await writeFile(process.env.JOINT_SQL_OUT,sql,{mode:0o600});
 console.log(passed+' joint rehearsal regression scenarios passed');
}catch(error){console.error('Joint fixture failure:',error.message,error.code,error.where||'');process.exitCode=1;}finally{await exec('ROLLBACK;RESET ROLE;').catch(()=>{});await(embedded?db.close():db.end());}
