import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {createHash} from 'node:crypto';
import {pathToFileURL} from 'node:url';
const embedded=process.env.SQL_TEST_PGLITE_MODULE;let db;
if(embedded){const {PGlite}=await import(pathToFileURL(embedded));const {pg_trgm}=await import(pathToFileURL(process.env.SQL_TEST_TRGM_MODULE));db=new PGlite({extensions:{pg_trgm}});await db.exec('CREATE ROLE test_admin SUPERUSER;SET SESSION AUTHORIZATION test_admin;ALTER ROLE postgres RENAME TO embedded_bootstrap;');}
else{const u=new URL(process.env.TEST_DATABASE_URL??'');assert.equal(u.hostname,'127.0.0.1');assert.equal(u.pathname,'/potok_authority_test');const {default:pg}=await import(pathToFileURL(process.env.SQL_TEST_PG_MODULE));db=new pg.Client({connectionString:u.href});await db.connect();}
const exec=s=>embedded?db.exec(s):db.query(s),rows=async s=>(await db.query(s)).rows;
const base='docs/premium/drafts/';
const v2=await readFile(base+'20260921_trusted_entitlement_v2.sql','utf8');
const repair=await readFile(base+'20260921_trusted_entitlement_v2_2_repair.sql','utf8');
const graph=await readFile(base+'20260927_adaptive_nutrition_graph_v2_authorities_activation_v1.sql','utf8');
const diagnostic=await readFile('scripts/security/authority-readiness/read-only.sql','utf8');
function functions(s){return [...s.matchAll(/CREATE(?: OR REPLACE)? FUNCTION ([\w.]+)\([\s\S]*?AS \$function\$([\s\S]*?)\$function\$;/g)];}
// Fingerprints come only from these public files, never from hosted snapshots.
for(const s of [v2,repair,graph])for(const m of functions(s)){
 const names=s===v2?['public.has_verified_entitlement_v1','public.has_verified_entitlement_v2','potok_control.is_effective_entitlement_v2']:['potok_control.grant_entitlement_v2','potok_control.revoke_entitlement_v2'];
 if(names.includes(m[1]))assert(diagnostic.includes(createHash('md5').update(m[2]).digest('hex')),'Untracked public fingerprint: '+m[1]);
}
async function check(){await exec('BEGIN READ ONLY;');try{const result=(await rows(diagnostic))[0].readiness;await exec('ROLLBACK;');return result;}catch(e){await exec('ROLLBACK;');throw e;}}
let passed=0;async function test(name,fn){await fn();passed++;console.log('PASS '+name);}
try{
 await exec('CREATE ROLE postgres NOSUPERUSER BYPASSRLS;CREATE ROLE anon;CREATE ROLE authenticated;CREATE ROLE service_role BYPASSRLS;CREATE ROLE extension_operator;');
 const database=(await rows('SELECT current_database() AS name'))[0].name;assert(/^[a-z_][a-z0-9_]*$/.test(database));
 await exec('ALTER DATABASE '+database+' OWNER TO postgres;DROP SCHEMA public CASCADE;CREATE SCHEMA public AUTHORIZATION postgres;REVOKE CREATE ON SCHEMA public FROM PUBLIC;CREATE SCHEMA auth;CREATE FUNCTION auth.uid() RETURNS uuid LANGUAGE sql STABLE AS $$ SELECT NULL::uuid $$;CREATE TABLE auth.users(id uuid PRIMARY KEY);GRANT USAGE ON SCHEMA auth TO postgres;GRANT REFERENCES ON auth.users TO postgres;ALTER ROLE extension_operator SUPERUSER;SET ROLE extension_operator;CREATE EXTENSION pg_trgm WITH SCHEMA public;RESET ROLE;ALTER ROLE extension_operator NOSUPERUSER;SET SESSION AUTHORIZATION postgres;');
 await exec(`CREATE TABLE public.user_profiles(user_id uuid PRIMARY KEY,first_name text,last_name text,middle_name text,birth_date date,age integer,height numeric,goal text,email text,phone text,avatar_url text,has_premium boolean NOT NULL DEFAULT false,is_admin boolean NOT NULL DEFAULT false,created_at timestamptz DEFAULT now(),updated_at timestamptz DEFAULT now());`);
 await test('absence is reported without function execution or user reads',async()=>{const r=await check();assert.equal(r.authority_store_present,false);assert(r.readers.every(x=>!x.reviewed));assert(r.writers.every(x=>x.version==='absent'));assert.equal(r.profile_key,'user_id');});
 for(const name of ['premium_plans','premium_plan_days','premium_meal_slots','premium_recipes','premium_recipe_ingredients','premium_recipe_steps','premium_recipe_hints','premium_meal_recipe_options'])await exec('CREATE TABLE public.'+name+'(id uuid PRIMARY KEY);');
 await exec(v2);
 await test('complete public v2 installer has private forced-RLS store and reviewed readers',async()=>{const r=await check();assert(r.authority_store_present&&r.authority_store_forced_rls&&r.private_store_denies_api_roles);assert(r.readers.every(x=>x.reviewed));assert(r.writers.every(x=>x.owner_only));assert.equal(r.profile_column_count,19);});
 await exec(repair);
 await test('v2.2 writer clocks do not imply shared account gate integration',async()=>{assert((await check()).writers.every(x=>x.version==='v2.2-statement-clock-without-account-gate'));});
 // Replay only the exact gate helper and both writer bodies, not Graph activation.
 await exec('CREATE SCHEMA potok_nutrition;');
 for(const m of functions(graph))if(['potok_nutrition.acquire_shared_account_gate_v1','potok_control.grant_entitlement_v2','potok_control.revoke_entitlement_v2'].includes(m[1]))await exec(m[0]);
 await exec('REVOKE ALL ON FUNCTION potok_nutrition.acquire_shared_account_gate_v1(uuid) FROM PUBLIC,anon,authenticated,service_role;');
 await test('later public graph writer bodies are distinguished from the older repair',async()=>{const r=await check();assert(r.writers.every(x=>x.version==='graph-v2-account-gate'&&x.owner_only));});
 await exec(repair);
 await test('replaying old repair demonstrably removes the newer gate binding',async()=>{assert((await check()).writers.every(x=>x.version==='v2.2-statement-clock-without-account-gate'));const r=await rows("SELECT prosrc FROM pg_proc WHERE pronamespace='potok_control'::regnamespace AND proname IN('grant_entitlement_v2','revoke_entitlement_v2')");assert(r.every(x=>!x.prosrc.includes('acquire_shared_account_gate_v1')));});
 await test('ordinary PostgreSQL without platform hooks rejects a foreign extension owner',async()=>{assert.equal((await check()).extension_core_owner_authorized,false);await assert.rejects(()=>exec('ALTER EXTENSION pg_trgm SET SCHEMA potok_nutrition'),e=>e.code==='42501');});
 await test('platform GUC hints are observations and do not establish DDL authorization',async()=>{
  await exec("SET supautils.privileged_role='postgres';SET supautils.privileged_extensions='pg_trgm';");
  const r=await check();assert.equal(r.extension_core_owner_authorized,false);assert.equal(r.supautils_privileged_extension_hint,true);assert.match(r.extension_set_schema_evidence,/not executed/);
  await assert.rejects(()=>exec('ALTER EXTENSION pg_trgm SET SCHEMA potok_nutrition'),e=>e.code==='42501');
 });
 await test('diagnostic works in READ ONLY and preserves authority rows and definitions',async()=>{const before=await rows("SELECT oid,md5(prosrc) AS hash FROM pg_proc WHERE pronamespace IN('public'::regnamespace,'potok_control'::regnamespace) ORDER BY oid");await check();assert.deepEqual(await rows("SELECT oid,md5(prosrc) AS hash FROM pg_proc WHERE pronamespace IN('public'::regnamespace,'potok_control'::regnamespace) ORDER BY oid"),before);assert.equal((await rows('SELECT count(*)::int AS n FROM potok_control.access_attestations'))[0].n,0);});
 console.log(`AUTHORITY_READINESS_OK: ${passed} cases; complete public v2 installer and exact later writer source; disposable only`);
}catch(e){console.error('AUTHORITY_READINESS_FAILED: '+e.message+' '+(e.code??''));process.exitCode=1;}finally{await exec('ROLLBACK;RESET SESSION AUTHORIZATION;').catch(()=>{});await(embedded?db.close():db.end());}
