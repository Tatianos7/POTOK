import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {pathToFileURL} from 'node:url';
const embedded=process.env.SQL_TEST_PGLITE_MODULE;
let db;
if(embedded){const {PGlite}=await import(pathToFileURL(embedded));db=new PGlite();await db.exec('CREATE ROLE test_admin SUPERUSER; SET SESSION AUTHORIZATION test_admin; ALTER ROLE postgres RENAME TO fixture_bootstrap; CREATE ROLE postgres NOSUPERUSER;');}
else{const url=new URL(process.env.TEST_DATABASE_URL??'');assert(['localhost','127.0.0.1','[::1]'].includes(url.hostname),'Local disposable database only');assert.equal(url.pathname,'/potok_profile_test');const {default:pg}=await import(pathToFileURL(process.env.SQL_TEST_PG_MODULE));db=new pg.Client({connectionString:url.href});await db.connect();}
const exec=s=>embedded?db.exec(s):db.query(s);
const rows=async s=>(await db.query(s)).rows;
const patch=await readFile(new URL('../../../supabase/migration_drafts/profile_column_write_containment_v1.sql',import.meta.url),'utf8');
const rehearsal=await readFile(new URL('./rehearsal.sql',import.meta.url),'utf8');
const a='11111111-1111-4111-8111-111111111111',b='22222222-2222-4222-8222-222222222222',c='33333333-3333-4333-8333-333333333333';
async function user(id=a){await exec(`SET ROLE authenticated; SET fixture.uid='${id}';`);}
async function fixture(){await exec(`ROLLBACK; RESET ROLE; REVOKE fixture_inherited FROM authenticated;
DROP SCHEMA public CASCADE; CREATE SCHEMA public AUTHORIZATION postgres;
REVOKE CREATE ON SCHEMA public FROM PUBLIC; GRANT USAGE ON SCHEMA public TO anon,authenticated,service_role;
SET ROLE postgres;
CREATE TABLE public.user_profiles(id_user uuid PRIMARY KEY,first_name text,last_name text,middle_name text,birth_date date,age integer,height numeric(5,2),goal text,email text,phone text,avatar_url text,
has_premium boolean NOT NULL DEFAULT false,is_admin boolean NOT NULL DEFAULT false,created_at timestamptz NOT NULL DEFAULT now(),updated_at timestamptz NOT NULL DEFAULT now(),coach_settings jsonb NOT NULL DEFAULT '{}',voice_settings jsonb NOT NULL DEFAULT '{}');
INSERT INTO public.user_profiles(id_user,first_name) VALUES('${a}','A'),('${b}','B');
ALTER TABLE public.user_profiles ENABLE ROW LEVEL SECURITY;
CREATE POLICY owner_read ON public.user_profiles FOR SELECT TO authenticated USING(auth.uid()=id_user);
CREATE POLICY owner_insert ON public.user_profiles FOR INSERT TO authenticated WITH CHECK(auth.uid()=id_user);
CREATE POLICY owner_update ON public.user_profiles FOR UPDATE TO authenticated USING(auth.uid()=id_user) WITH CHECK(auth.uid()=id_user);
GRANT SELECT,INSERT,UPDATE ON public.user_profiles TO authenticated;
GRANT INSERT,UPDATE ON public.user_profiles TO PUBLIC;
GRANT INSERT(is_admin),UPDATE(has_premium) ON public.user_profiles TO authenticated;
GRANT ALL ON public.user_profiles TO service_role; RESET ROLE;`);}
async function apply(){await exec('SET ROLE postgres;');await exec(patch);}
async function deny(s){await assert.rejects(exec(s),e=>e.code==='42501');}
async function baseline(){await exec('ROLLBACK; RESET ROLE;');assert.equal((await rows("SELECT has_column_privilege('authenticated','public.user_profiles','is_admin','UPDATE') AS allowed"))[0].allowed,true);}
async function reject(message){await assert.rejects(apply(),e=>e.message.includes(message));await baseline();}
let passed=0;async function test(name,fn){await fixture();await fn();passed++;console.log(`PASS ${name}`);}
try{
const v=(await rows("SELECT version(),current_setting('server_version_num')::integer AS num"))[0];assert(v.num>=170000&&v.num<180000);console.log(v.version);
await exec(`DO $$ BEGIN IF NOT EXISTS(SELECT FROM pg_roles WHERE rolname='postgres') THEN CREATE ROLE postgres NOSUPERUSER; END IF; END $$;CREATE ROLE anon;CREATE ROLE authenticated;CREATE ROLE service_role BYPASSRLS;CREATE ROLE fixture_inherited;
CREATE SCHEMA auth; CREATE FUNCTION auth.uid() RETURNS uuid LANGUAGE sql STABLE SET search_path=pg_catalog AS $$SELECT nullif(current_setting('fixture.uid',true),'')::uuid$$; GRANT USAGE ON SCHEMA auth TO postgres,anon,authenticated,service_role;GRANT EXECUTE ON FUNCTION auth.uid() TO postgres,anon,authenticated,service_role;`);
assert.equal((await rows("SELECT rolsuper FROM pg_roles WHERE rolname='postgres'"))[0].rolsuper,false);
await test('baseline own-row RLS permits self-promotion before containment',async()=>{await user();await exec(`UPDATE public.user_profiles SET is_admin=true,has_premium=true WHERE id_user='${a}'`);assert.equal((await rows('SELECT is_admin AND has_premium AS elevated FROM public.user_profiles'))[0].elevated,true);});
await test('direct protected writes denied while ordinary insert and upsert work',async()=>{
await apply();await user();
for(const flag of ['is_admin','has_premium'])await deny(`UPDATE public.user_profiles SET ${flag}=true WHERE id_user='${a}'`);
await deny(`UPDATE public.user_profiles SET updated_at='2000-01-01' WHERE id_user='${a}'`);
await exec(`UPDATE public.user_profiles SET avatar_url='fixture',coach_settings='{"mode":"support"}',voice_settings='{}' WHERE id_user='${a}'`);
await exec(`INSERT INTO public.user_profiles(id_user,first_name) VALUES('${a}','updated') ON CONFLICT(id_user) DO UPDATE SET id_user=EXCLUDED.id_user,first_name=EXCLUDED.first_name`);
assert.equal((await rows('SELECT first_name FROM public.user_profiles'))[0].first_name,'updated');
await user(c);await deny(`INSERT INTO public.user_profiles(id_user,is_admin) VALUES('${c}',false)`);
await deny(`INSERT INTO public.user_profiles(id_user,has_premium) VALUES('${c}',true)`);
await exec(`INSERT INTO public.user_profiles(id_user,first_name) VALUES('${c}','C')`);
assert.deepEqual((await rows('SELECT is_admin,has_premium FROM public.user_profiles'))[0],{is_admin:false,has_premium:false});
});
await test('RLS still prevents foreign profiles and ownership reassignment',async()=>{await apply();await user();assert.equal((await rows('SELECT count(*)::integer AS n FROM public.user_profiles'))[0].n,1);await deny(`UPDATE public.user_profiles SET id_user='${c}' WHERE id_user='${a}'`);await deny(`INSERT INTO public.user_profiles(id_user,first_name) VALUES('${c}','foreign')`);await exec(`UPDATE public.user_profiles SET first_name='wrong' WHERE id_user='${b}'`);await exec('RESET ROLE;');assert.equal((await rows(`SELECT first_name FROM public.user_profiles WHERE id_user='${b}'`))[0].first_name,'B');});
await test('service authority and existing rows remain unchanged',async()=>{const before=await rows('SELECT * FROM public.user_profiles ORDER BY id_user');await apply();await exec('RESET ROLE;');assert.deepEqual(await rows('SELECT * FROM public.user_profiles ORDER BY id_user'),before);await exec('SET ROLE service_role;');await exec(`UPDATE public.user_profiles SET is_admin=true WHERE id_user='${a}'`);await exec('RESET ROLE;');assert.equal((await rows(`SELECT is_admin FROM public.user_profiles WHERE id_user='${a}'`))[0].is_admin,true);});
await test('anonymous writes denied and replay preserves column allowlist',async()=>{await apply();await apply();await exec('SET ROLE anon;');await deny(`INSERT INTO public.user_profiles(id_user) VALUES('${c}')`);});
await test('rehearsal restores exact table and column ACLs, policies and rows',async()=>{
const snapshot=async()=>({
 table:await rows("SELECT relacl::text AS acl FROM pg_class WHERE oid='public.user_profiles'::regclass"),
 columns:await rows("SELECT attname,attacl::text AS acl FROM pg_attribute WHERE attrelid='public.user_profiles'::regclass AND attnum>0 ORDER BY attnum"),
 policies:await rows("SELECT to_jsonb(p)::text AS policy FROM pg_policy p WHERE polrelid='public.user_profiles'::regclass ORDER BY oid"),
 profiles:await rows('SELECT * FROM public.user_profiles ORDER BY id_user')});
const before=await snapshot();await exec('SET ROLE postgres;');await exec(rehearsal);await exec('RESET ROLE;');assert.deepEqual(await snapshot(),before);
assert.equal((await rows("SELECT to_regclass('pg_temp.potok_profile_allowed') IS NULL AS gone"))[0].gone,true);
});
await test('inherited protected grants abort with full rollback',async()=>{await exec('GRANT fixture_inherited TO authenticated;GRANT UPDATE(is_admin) ON public.user_profiles TO fixture_inherited;');await reject('Effective protected column write');});
await test('unsafe privilege default aborts',async()=>{await exec('ALTER TABLE public.user_profiles ALTER COLUMN is_admin SET DEFAULT true;');await reject('Privilege defaults');});
await test('new column requires explicit review',async()=>{await exec('ALTER TABLE public.user_profiles ADD COLUMN future_authority boolean;');await reject('Profile columns changed');});
await test('weaker ownership policy aborts',async()=>{await exec('ALTER POLICY owner_update ON public.user_profiles WITH CHECK(true);');await reject('Profile ownership policy');});
await test('disabled RLS aborts',async()=>{await exec('ALTER TABLE public.user_profiles DISABLE ROW LEVEL SECURITY;');await reject('ownership or RLS');});
await test('PUBLIC-only service writes are not silently lost',async()=>{await exec('REVOKE INSERT,UPDATE ON public.user_profiles FROM service_role;');await reject('Required profile access');});
await test('unexpected actor aborts',async()=>{await assert.rejects(exec(patch),e=>e.message.includes('Expected effective role postgres'));await baseline();});
console.log(`${passed} profile privilege regression scenarios passed`);
}finally{await exec('ROLLBACK;RESET ROLE;').catch(()=>{});await(embedded?db.close():db.end());}
