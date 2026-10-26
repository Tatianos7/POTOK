import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {pathToFileURL} from 'node:url';
import {legacySchema,verifiedReaders,A,B,FOOD,REVIEW,DRAFT,EVENT,GRANT} from './fixture.mjs';
const embedded=process.env.SQL_TEST_PGLITE_MODULE;let db;
if(embedded){const {PGlite}=await import(pathToFileURL(embedded));db=new PGlite();}
else{const u=new URL(process.env.TEST_DATABASE_URL??'');assert.equal(u.hostname,'127.0.0.1');assert.equal(u.pathname,'/potok_catalog_test');const {default:pg}=await import(pathToFileURL(process.env.SQL_TEST_PG_MODULE));db=new pg.Client({connectionString:u.href});await db.connect();}
const exec=s=>embedded?db.exec(s):db.query(s),rows=async s=>(await db.query(s)).rows;
const legacy=await legacySchema(),verified=await verifiedReaders(),draft=await readFile('supabase/migration_drafts/catalog_authority_history_review_v1.sql','utf8');
assert.equal((draft.match(/^BEGIN;$/gm)??[]).length,1);assert.equal((draft.match(/^ROLLBACK;$/gm)??[]).length,1);assert.doesNotMatch(draft,/^COMMIT;$/m);
let phase='bootstrap';
async function fixture(){phase='base schema';await exec(`ROLLBACK;RESET ROLE;DROP SCHEMA IF EXISTS public CASCADE;DROP SCHEMA IF EXISTS auth CASCADE;DROP SCHEMA IF EXISTS potok_control CASCADE;
 CREATE SCHEMA public AUTHORIZATION postgres;CREATE SCHEMA auth;CREATE SCHEMA potok_control AUTHORIZATION postgres;
 REVOKE CREATE ON SCHEMA public FROM PUBLIC;GRANT USAGE ON SCHEMA public,auth TO postgres,anon,authenticated,service_role;
 CREATE FUNCTION auth.jwt() RETURNS jsonb LANGUAGE sql STABLE AS $$ SELECT coalesce(nullif(current_setting('request.jwt.claims',true),''),'{}')::jsonb $$;
 CREATE FUNCTION auth.uid() RETURNS uuid LANGUAGE sql STABLE AS $$ SELECT (auth.jwt()->>'sub')::uuid $$;
 CREATE TABLE auth.users(id uuid PRIMARY KEY);INSERT INTO auth.users VALUES('${A}'),('${B}');GRANT REFERENCES ON auth.users TO postgres;SET ROLE postgres;`);
 phase='legacy';await exec(legacy);phase='verified readers';await exec(verified);phase='fixture reset';await exec('RESET ROLE;');}
async function as(role,sub,sql,claims={}){await exec(`BEGIN;SET LOCAL ROLE ${role};SELECT set_config('request.jwt.claims','${JSON.stringify({role,sub,...claims}).replace(/'/g,"''")}',true);`);try{const r=await rows(sql);await exec('COMMIT;');return r;}catch(e){await exec('ROLLBACK;');throw e;}}
async function apply(){await exec('SET ROLE postgres;');try{await exec(draft.replace(/^ROLLBACK;$/m,'COMMIT;'));}catch(e){await exec('ROLLBACK;');throw e;}finally{await exec('RESET ROLE;');}}
const denied=f=>assert.rejects(f,e=>e.code==='42501');
const diary=()=>rows('SELECT to_jsonb(d) AS row FROM public.food_diary_entries d ORDER BY user_id');
const alias=(role,id)=>as(role,id,`SELECT * FROM public.apply_admin_approved_food_alias('${REVIEW}',NULL,NULL)`);
const food=(role,id)=>as(role,id,`SELECT * FROM public.apply_owner_approved_missing_food_draft('${DRAFT}')`);
let passed=0;async function test(name,fn){await fixture();phase=name;await fn();passed++;console.log('PASS '+name);}
try{
 if(embedded)await exec('CREATE ROLE test_admin SUPERUSER;SET SESSION AUTHORIZATION test_admin;ALTER ROLE postgres RENAME TO embedded_bootstrap;CREATE ROLE postgres NOSUPERUSER;');
 else await exec('CREATE ROLE postgres NOSUPERUSER;ALTER DATABASE potok_catalog_test OWNER TO postgres;');
 await exec('CREATE ROLE anon;CREATE ROLE authenticated;CREATE ROLE service_role BYPASSRLS;');
 await test('public legacy source trusts profile flag and can rewrite both users history',async()=>{
  assert.equal((await alias('authenticated',A))[0].result,'applied');assert.equal((await food('authenticated',A))[0].result,'applied');
  const before=await diary();await as('authenticated',A,`SELECT public.recompute_food_entries_for_food_ids(ARRAY['${FOOD}'::uuid])`);assert.notDeepEqual(await diary(),before);
 });
 await test('legacy flag no longer authorizes RPC or admin queue access',async()=>{
  await apply();assert.equal((await alias('authenticated',A))[0].result,'permission_denied');assert.equal((await food('authenticated',A))[0].result,'permission_denied');
  assert.equal((await as('authenticated',A,'SELECT * FROM public.food_search_review_queue')).length,0);
  assert.equal((await as('authenticated',A,'SELECT * FROM public.food_alias_apply_audit')).length,0);
  assert.equal((await rows('SELECT count(*)::int AS n FROM public.foods'))[0].n,1);
  for(const role of ['anon','service_role']){await denied(()=>alias(role,B));await denied(()=>food(role,B));}
 });
 await test('verified admin with false legacy flag applies actual alias and food bodies without history remap',async()=>{
  await apply();const before=await diary();
  assert.equal((await alias('authenticated',B))[0].result,'applied');assert.equal((await food('authenticated',B))[0].result,'applied');
  assert.equal((await alias('authenticated',B))[0].result,'already_applied');assert.equal((await food('authenticated',B))[0].result,'already_applied');
  assert.deepEqual(await diary(),before);assert.equal((await rows('SELECT canonical_food_id FROM public.favorite_products'))[0].canonical_food_id,FOOD);
  assert.equal((await rows('SELECT food_id FROM public.recipe_ingredients'))[0].food_id,FOOD);
  assert.equal((await rows("SELECT fiber FROM public.foods WHERE name='New fixture food'"))[0].fiber,null);
 });
 await test('revocation takes effect with the same JWT; edited user metadata does not grant admin',async()=>{
  await apply();assert.equal((await as('authenticated',B,'SELECT public.has_catalog_admin_access_v1() AS allowed'))[0].allowed,true);
  await exec(`SET ROLE postgres;INSERT INTO potok_control.access_attestations VALUES(gen_random_uuid(),'${B}','admin','REVOKE','${GRANT}',2,now(),NULL);RESET ROLE;`);
  assert.equal((await as('authenticated',B,'SELECT public.has_catalog_admin_access_v1() AS allowed'))[0].allowed,false);
  assert.equal((await as('authenticated',A,'SELECT public.has_catalog_admin_access_v1() AS allowed',{user_metadata:{is_admin:true}}))[0].allowed,false);
 });
 await test('missing or failed verified infrastructure denies without a legacy fallback',async()=>{
  await exec('DROP FUNCTION public.has_verified_entitlement_v1(text);');await apply();assert.equal((await food('authenticated',A))[0].result,'permission_denied');
  await exec("SET ROLE postgres;CREATE FUNCTION public.has_verified_entitlement_v1(text) RETURNS boolean LANGUAGE plpgsql AS $$ BEGIN RAISE EXCEPTION 'unavailable'; END $$;GRANT EXECUTE ON FUNCTION public.has_verified_entitlement_v1(text) TO authenticated;RESET ROLE;");
  assert.equal((await food('authenticated',A))[0].result,'permission_denied');
 });
 await test('personal products remain writable but cannot be promoted into the shared catalog',async()=>{
  await apply();const insert=source=>`INSERT INTO public.foods(name,normalized_name,source,created_by_user_id) VALUES('Personal','personal','${source}','${A}')`;
  await denied(()=>as('authenticated',A,insert('core')));await denied(()=>as('authenticated',A,insert('brand')));
  await as('authenticated',A,insert('user'));
  await denied(()=>as('authenticated',A,"UPDATE public.foods SET source='core' WHERE normalized_name='personal'"));
  await as('authenticated',A,"UPDATE public.foods SET calories=42 WHERE normalized_name='personal'");
  assert.equal((await as('authenticated',B,"SELECT * FROM public.foods WHERE normalized_name='personal'")).length,0);
 });
 await test('personal alias to a catalog food stays private and cannot become a shared alias',async()=>{
  await apply();const insert=source=>`INSERT INTO public.food_aliases(canonical_food_id,alias,source,created_by_user_id) VALUES('${FOOD}','Personal alias','${source}','${A}')`;
  await denied(()=>as('authenticated',A,insert('core')));await as('authenticated',A,insert('user'));
  assert.equal((await as('authenticated',A,'SELECT * FROM public.food_aliases')).length,1);
  assert.equal((await as('authenticated',B,'SELECT * FROM public.food_aliases')).length,0);
  await denied(()=>as('authenticated',A,"UPDATE public.food_aliases SET source='core'"));
 });
 await test('ordinary own analytics remains available; direct audit forgery denied even to verified admin',async()=>{
  await apply();await as('authenticated',A,`INSERT INTO public.food_search_events(user_id,query,normalized_query,context,event_type) VALUES('${A}','Own query','own query','diary','query')`);
  assert.equal((await as('authenticated',A,'SELECT * FROM public.food_search_events')).length,1);
  assert.equal((await as('authenticated',B,'SELECT * FROM public.food_search_events')).length,2);
  await denied(()=>as('authenticated',B,"INSERT INTO public.food_alias_apply_audit(alias,normalized_alias,result) VALUES('forged','forged','permission_denied')"));
 });
 await test('retired history RPC rejects clients, service, owner and an owner-definer chain',async()=>{
  await apply();const before=await diary();await exec('UPDATE public.foods SET calories=999,fiber=88;');
  for(const role of ['anon','authenticated','service_role','postgres'])await denied(()=>as(role,A,`SELECT public.recompute_food_entries_for_food_ids(ARRAY['${FOOD}'::uuid])`));
  await exec(`SET ROLE postgres;CREATE FUNCTION public.history_delegate() RETURNS void LANGUAGE plpgsql SECURITY DEFINER AS $$ BEGIN PERFORM public.recompute_food_entries_for_food_ids(ARRAY['${FOOD}'::uuid]); END $$;GRANT EXECUTE ON FUNCTION public.history_delegate() TO authenticated;RESET ROLE;`);
  await denied(()=>as('authenticated',A,'SELECT public.history_delegate()'));assert.deepEqual(await diary(),before);
 });
 await test('unknown RPC or extra legacy admin policy aborts atomically',async()=>{
  await exec("SET ROLE postgres;CREATE OR REPLACE FUNCTION public.recompute_food_entries_for_food_ids(food_ids uuid[]) RETURNS void LANGUAGE plpgsql SECURITY DEFINER AS $$ BEGIN NULL; END $$;RESET ROLE;");
  await assert.rejects(apply(),/Public source function drift/);assert.equal((await rows("SELECT to_regprocedure('public.has_catalog_admin_access_v1()') AS f"))[0].f,null);
  await fixture();await exec('SET ROLE postgres;CREATE POLICY extra_admin ON public.food_missing_review_queue FOR SELECT USING(EXISTS(SELECT FROM public.user_profiles WHERE is_admin));RESET ROLE;');
  await assert.rejects(apply(),/Unreviewed legacy admin policy remains/);assert.equal((await rows("SELECT to_regprocedure('public.has_catalog_admin_access_v1()') AS f"))[0].f,null);
 });
 await test('review wrapper restores original function bodies, policies, grants and history',async()=>{
  const before=await diary();const metadata=()=>rows("SELECT proname,md5(prosrc) AS body,proacl::text AS acl FROM pg_proc WHERE pronamespace='public'::regnamespace ORDER BY proname");const original=await metadata();
  await exec('SET ROLE postgres;');await exec(draft);await exec('RESET ROLE;');assert.deepEqual(await metadata(),original);assert.deepEqual(await diary(),before);
  assert.equal((await alias('authenticated',A))[0].result,'applied');
 });
 await test('an id_user-only profile schema is not silently repaired to enable historical recomputation',async()=>{
  await exec('ALTER TABLE public.user_profiles DROP COLUMN user_id;');
  await assert.rejects(()=>as('authenticated',A,`SELECT public.recompute_food_entries_for_food_ids(ARRAY['${FOOD}'::uuid])`),e=>e.code==='42703');
  const before=await diary();await apply();await denied(()=>as('postgres',A,`SELECT public.recompute_food_entries_for_food_ids(ARRAY['${FOOD}'::uuid])`));assert.deepEqual(await diary(),before);
 });
 await test('anonymous broad legacy SELECT cannot disclose personal foods or aliases',async()=>{
  await exec(`SET ROLE postgres;CREATE POLICY broad_anon_food_read ON public.foods FOR SELECT TO anon USING(true);
   CREATE POLICY broad_anon_alias_read ON public.food_aliases FOR SELECT TO anon USING(true);
   INSERT INTO public.foods(name,source,created_by_user_id) VALUES('Private anonymous boundary','user','${A}');
   INSERT INTO public.food_aliases(canonical_food_id,alias,source,created_by_user_id) VALUES('${FOOD}','Private anonymous alias','user','${A}');RESET ROLE;`);
  assert.equal((await as('anon',null,'SELECT * FROM public.food_aliases')).length,1);
  await apply();assert.equal((await as('anon',null,'SELECT * FROM public.food_aliases')).length,0);
  const visible=await as('anon',null,'SELECT name FROM public.foods');assert.deepEqual(visible,[{name:'Fixture apple'}]);
 });
 console.log(`CATALOG_AUTHORITY_SQL_OK: ${passed} cases; actual public RPC/policy sources and v2 reader functions`);
}catch(error){console.error('CATALOG_AUTHORITY_SQL_FAILED phase='+phase+': '+error.message+' code='+(error.code??'none'));process.exitCode=1;}
finally{embedded?await db.close():await db.end();}
