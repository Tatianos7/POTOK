import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {createHash} from 'node:crypto';
import {pathToFileURL} from 'node:url';
import {build,target} from './build.mjs';
import {catalogFixture,A,B} from './fixture.mjs';
import {DRAFT,REVIEW} from '../catalog-authority/fixture.mjs';
const embedded=process.env.SQL_TEST_PGLITE_MODULE;let db;
if(embedded){const {PGlite}=await import(pathToFileURL(embedded));db=new PGlite();await db.exec('CREATE ROLE test_admin SUPERUSER;SET SESSION AUTHORIZATION test_admin;ALTER ROLE postgres RENAME TO embedded_bootstrap;');}
else{const u=new URL(process.env.TEST_DATABASE_URL??'');assert.equal(u.hostname,'127.0.0.1');assert.equal(u.pathname,'/potok_authority_profile_test');const {default:pg}=await import(pathToFileURL(process.env.SQL_TEST_PG_MODULE));db=new pg.Client({connectionString:u.href});await db.connect();}
const exec=s=>embedded?db.exec(s):db.query(s),rows=async s=>(await db.query(s)).rows;
const sql=await readFile(target,'utf8');assert.equal(sql,await build(),'Generated review file must match selected public sources');
const body=sql.replace(/^BEGIN;$/m,'').replace(/^ROLLBACK;$/m,'');assert.equal((sql.match(/^BEGIN;$/gm)??[]).length,1);assert.equal((sql.match(/^ROLLBACK;$/gm)??[]).length,1);assert.doesNotMatch(sql,/^COMMIT;$/m);
let profileContainment;
if(process.env.AUTHORITY_PROFILE_INPUT)profileContainment=await readFile(process.env.AUTHORITY_PROFILE_INPUT,'utf8');
else{const r=await fetch('https://raw.githubusercontent.com/Tatianos7/POTOK/7f4f7e24fec497a22dea29dd14f4546115439129/supabase/migration_drafts/profile_column_write_containment_v1.sql',{redirect:'error',signal:AbortSignal.timeout(30000)});assert(r.ok);profileContainment=await r.text();}
assert.equal(createHash('sha256').update(profileContainment).digest('hex'),'b781e7754732d12359cfff990ca855f75115695c283b08f9f221f785f5d529ea');
const catalog=await readFile('supabase/migration_drafts/catalog_authority_history_review_v1.sql','utf8');
const grant=(user,cap='admin',expiry="now()+interval '1 day'")=>`SELECT potok_control.grant_entitlement_v2('${user}','${cap}',${expiry},'synthetic-evidence','synthetic-test') AS id`;
const revoke=(user,cap='admin')=>`SELECT potok_control.revoke_entitlement_v2('${user}','${cap}','synthetic-revocation','synthetic-test') AS id`;
const denied=fn=>assert.rejects(fn,e=>e.code==='42501');
async function client(role,user,q,metadata={}){await exec('SAVEPOINT client_call;SET LOCAL ROLE '+role+`;SELECT set_config('request.jwt.claims','${JSON.stringify({role,sub:user,...metadata})}',true);`);try{const result=await rows(q);await exec('SET LOCAL ROLE postgres;RELEASE client_call;');return result;}catch(e){await exec('ROLLBACK TO client_call;RELEASE client_call;');throw e;}}
const profiles=()=>rows('SELECT to_jsonb(p) AS row FROM public.user_profiles p ORDER BY id_user');
let passed=0;async function test(name,fn){await exec('BEGIN;');try{await fn();await exec('ROLLBACK;');passed++;console.log('PASS '+name);}catch(e){await exec('ROLLBACK;');throw e;}}
try{
 await exec('CREATE ROLE postgres NOSUPERUSER BYPASSRLS;CREATE ROLE anon;CREATE ROLE authenticated;CREATE ROLE service_role BYPASSRLS;GRANT anon,authenticated,service_role TO postgres;');
 const name=(await rows('SELECT current_database() AS name'))[0].name;assert(/^[a-z_][a-z0-9_]*$/.test(name));
 await exec(`ALTER DATABASE ${name} OWNER TO postgres;DROP SCHEMA public CASCADE;CREATE SCHEMA public AUTHORIZATION postgres;REVOKE CREATE ON SCHEMA public FROM PUBLIC;CREATE SCHEMA auth;GRANT USAGE ON SCHEMA public,auth TO postgres,anon,authenticated,service_role;
 CREATE FUNCTION auth.jwt() RETURNS jsonb LANGUAGE sql STABLE AS $$ SELECT coalesce(nullif(current_setting('request.jwt.claims',true),''),'{}')::jsonb $$;
 CREATE FUNCTION auth.uid() RETURNS uuid LANGUAGE sql STABLE AS $$ SELECT (auth.jwt()->>'sub')::uuid $$;
 CREATE TABLE auth.users(id uuid PRIMARY KEY);INSERT INTO auth.users VALUES('${A}'),('${B}');GRANT REFERENCES,DELETE ON auth.users TO postgres;SET SESSION AUTHORIZATION postgres;`);
 await exec(await catalogFixture());
 await assert.rejects(()=>exec(sql),/profile column containment/);await exec('ROLLBACK;');
 await exec(profileContainment);
 const baseline=await profiles();
 const baselineShape=await rows("SELECT a.attname,a.atttypid,a.attacl::text FROM pg_attribute a WHERE attrelid='public.user_profiles'::regclass AND attnum>0 ORDER BY attnum");
 await exec(sql);assert.equal((await rows("SELECT to_regnamespace('potok_control') AS n"))[0].n,null);assert.deepEqual(await profiles(),baseline);console.log('PASS review wrapper rolls back complete authority installation');passed++;
 await exec(sql.replace(/^ROLLBACK;$/m,'COMMIT;'));
 assert.deepEqual(await profiles(),baseline);assert.deepEqual(await rows("SELECT a.attname,a.atttypid,a.attacl::text FROM pg_attribute a WHERE attrelid='public.user_profiles'::regclass AND attnum>0 ORDER BY attnum"),baselineShape);
 assert.equal((await rows('SELECT count(*)::int AS n FROM potok_control.access_attestations'))[0].n,0);console.log('PASS committed installer preserves all 17 profile columns, rows and profile grants and issues no authority');passed++;
 await test('legacy true flags and user metadata grant no verified access',async()=>{for(const cap of ['premium','admin'])assert.equal((await client('authenticated',A,`SELECT public.has_verified_entitlement_v1('${cap}') AS allowed`,{user_metadata:{is_admin:true,has_premium:true}}))[0].allowed,false);});
 await test('owner grant and revoke work with id_user and never modify legacy profile fields',async()=>{
  await rows(grant(B));assert.equal((await client('authenticated',B,"SELECT public.has_verified_entitlement_v1('admin') AS allowed"))[0].allowed,true);
  assert.equal((await client('authenticated',A,"SELECT public.has_verified_entitlement_v1('admin') AS allowed"))[0].allowed,false);
  await rows(revoke(B));assert.equal((await client('authenticated',B,"SELECT public.has_verified_entitlement_v1('admin') AS allowed"))[0].allowed,false);assert.deepEqual(await profiles(),baseline);
  const lineage=await rows("SELECT effect,lineage_sequence,operator_db_role FROM potok_control.access_attestations ORDER BY lineage_sequence");assert.deepEqual(lineage.map(x=>x.effect),['GRANT','REVOKE']);assert(lineage.every(x=>x.operator_db_role==='postgres'));
 });
 await test('Premium is independent of admin, and expiry is checked without client refresh',async()=>{
  await rows(grant(B,'premium'));assert.equal((await client('authenticated',B,"SELECT public.has_verified_entitlement_v1('premium') AS allowed"))[0].allowed,true);
  assert.equal((await client('authenticated',B,"SELECT public.has_verified_entitlement_v1('admin') AS allowed"))[0].allowed,false);
  assert.equal((await rows(`SELECT potok_control.is_effective_entitlement_v2('${B}','premium',now()+interval '2 days') AS allowed`))[0].allowed,false);
 });
 await test('API roles cannot read or provision private authority, including service_role',async()=>{
  for(const role of ['anon','authenticated','service_role'])for(const q of ['SELECT * FROM potok_control.access_attestations',grant(B),revoke(B)])await denied(()=>client(role,B,q));
  for(const role of ['anon','service_role'])await denied(()=>client(role,B,"SELECT public.has_verified_entitlement_v1('admin')"));
 });
 await test('ordinary profile/settings upsert works; forged protected values remain denied',async()=>{
  await client('authenticated',A,`INSERT INTO public.user_profiles(id_user,first_name,coach_settings,voice_settings) VALUES('${A}','Changed','{"mode":"off"}','{}') ON CONFLICT(id_user) DO UPDATE SET id_user=excluded.id_user,first_name=excluded.first_name,coach_settings=excluded.coach_settings,voice_settings=excluded.voice_settings RETURNING first_name`);
  await denied(()=>client('authenticated',A,"UPDATE public.user_profiles SET is_admin=false WHERE id_user=auth.uid()"));
  assert.equal((await client('authenticated',B,`SELECT * FROM public.user_profiles WHERE id_user='${A}'`)).length,0);
 });
 await test('unknown account/profile, invalid scope, evidence, expiry and empty revoke fail without receipts',async()=>{
  for(const q of [grant('99999999-9999-4999-8999-999999999999'),grant(B,'unknown'),grant(B,'admin',"now()-interval '1 day'"),revoke(B),grant(B).replace("'synthetic-evidence'","''"),grant(B).replace("'admin'","NULL")]){
   await exec('SAVEPOINT invalid_call;');await assert.rejects(()=>rows(q));await exec('ROLLBACK TO invalid_call;RELEASE invalid_call;');
  }
  assert.equal((await rows('SELECT count(*)::int AS n FROM potok_control.access_attestations'))[0].n,0);
 });
 await test('append-only triggers, predecessor/sequence validation and auth erasure restriction work',async()=>{
  await rows(grant(B));for(const q of ['UPDATE potok_control.access_attestations SET reason=\'changed\'','DELETE FROM potok_control.access_attestations','TRUNCATE potok_control.access_attestations',`DELETE FROM auth.users WHERE id='${B}'`]){await exec('SAVEPOINT mutation;');await assert.rejects(()=>exec(q));await exec('ROLLBACK TO mutation;RELEASE mutation;');}
  await exec('SAVEPOINT bad_lineage;');await assert.rejects(()=>exec(`INSERT INTO potok_control.access_attestations SELECT gen_random_uuid(),account_id,capability,effect,NULL,9,issued_at,valid_until,operator_db_role,evidence_ref,reason FROM potok_control.access_attestations`),e=>e.code==='23514');await exec('ROLLBACK TO bad_lineage;RELEASE bad_lineage;');
 });
 await exec(catalog.replace(/^ROLLBACK;$/m,'COMMIT;'));
 await test('actual catalog RPC accepts issued admin, denies old flag and preserves consumption history',async()=>{
  const history=await rows('SELECT to_jsonb(d) AS row FROM public.food_diary_entries d ORDER BY user_id');
  assert.equal((await client('authenticated',A,`SELECT * FROM public.apply_owner_approved_missing_food_draft('${DRAFT}')`))[0].result,'permission_denied');await rows(grant(B));
  assert.equal((await client('authenticated',B,`SELECT * FROM public.apply_owner_approved_missing_food_draft('${DRAFT}')`))[0].result,'applied');
  assert.equal((await client('authenticated',B,`SELECT * FROM public.apply_admin_approved_food_alias('${REVIEW}',NULL,NULL)`))[0].result,'applied');
  await rows(revoke(B));assert.equal((await client('authenticated',B,'SELECT public.has_catalog_admin_access_v1() AS allowed'))[0].allowed,false);
  assert.deepEqual(await profiles(),baseline);assert.deepEqual(await rows('SELECT to_jsonb(d) AS row FROM public.food_diary_entries d ORDER BY user_id'),history);
 });
 await assert.rejects(()=>exec(sql),/Fresh authority install/);await exec('ROLLBACK;');assert.deepEqual(await profiles(),baseline);
 console.log(`AUTHORITY_PROFILE_OK: ${passed} cases; reused trusted v2 ledger, id_user adapter and real catalog RPC; no hosted access`);
}catch(e){console.error('AUTHORITY_PROFILE_FAILED: '+e.message+' '+(e.code??''));process.exitCode=1;}finally{await exec('ROLLBACK;').catch(()=>{});await(embedded?db.close():db.end());}
