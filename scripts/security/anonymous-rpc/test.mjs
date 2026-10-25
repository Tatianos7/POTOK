import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { pathToFileURL } from 'node:url';
const embedded=process.env.SQL_TEST_PGLITE_MODULE;
let db;
if (embedded) {
  const {PGlite}=await import(pathToFileURL(embedded)); db=new PGlite();
  await db.exec('CREATE ROLE test_admin SUPERUSER; SET SESSION AUTHORIZATION test_admin; ALTER ROLE postgres RENAME TO fixture_bootstrap; CREATE ROLE postgres NOSUPERUSER;');
} else {
  const url=new URL(process.env.TEST_DATABASE_URL ?? '');
  assert(['localhost','127.0.0.1','[::1]'].includes(url.hostname),'Local disposable cluster only');
  assert.equal(url.pathname,'/potok_rpc_test','Refusing a non-test database');
  const {default:pg}=await import(pathToFileURL(process.env.SQL_TEST_PG_MODULE));
  db=new pg.Client({connectionString:url.href}); await db.connect();
}
const exec=sql=>embedded ? db.exec(sql) : db.query(sql);
const rows=async sql=>(await db.query(sql)).rows;
const sql=await readFile(new URL('../../../supabase/migration_drafts/anonymous_rpc_execute_containment_v1.sql',import.meta.url),'utf8');
const rehearsal=await readFile(new URL('./rehearsal.sql',import.meta.url),'utf8');
const signatures=[
 'apply_admin_approved_food_alias(uuid,text,text)', 'apply_owner_approved_missing_food_draft(uuid)',
 'get_entitlements(uuid)', 'get_paywall_state(text,uuid)', 'recompute_food_entries_for_food_ids(uuid[])',
 'restore_purchase(uuid,text,text,text)', 'rls_auto_enable()', 'start_purchase(uuid,text,text,text)',
];
async function fixture() {
  await exec('ROLLBACK; RESET ROLE; REVOKE fixture_inherited FROM anon; DROP SCHEMA public CASCADE; CREATE SCHEMA public AUTHORIZATION postgres; REVOKE CREATE ON SCHEMA public FROM PUBLIC; GRANT USAGE ON SCHEMA public TO anon,authenticated,service_role; SET ROLE postgres;');
  for (const signature of [...signatures,'unrelated()']) {
    await exec(`CREATE FUNCTION public.${signature} RETURNS text LANGUAGE sql SECURITY DEFINER SET search_path=pg_catalog AS 'SELECT current_user::text'; GRANT EXECUTE ON FUNCTION public.${signature} TO anon,authenticated,service_role;`);
  }
  await exec('RESET ROLE;');
}
async function apply() { await exec('SET ROLE postgres;'); await exec(sql); }
async function assertBaseline() {
  await exec('ROLLBACK; RESET ROLE;');
  assert.equal((await rows("SELECT has_function_privilege('anon','public.get_entitlements(uuid)','EXECUTE') AS allowed"))[0].allowed,true);
}
async function reject(message) { await assert.rejects(apply(),e=>e.message.includes(message)); await assertBaseline(); }
let passed=0;
async function test(name,fn) { await fixture(); await fn(); passed++; console.log(`PASS ${name}`); }
try {
  const v=(await rows("SELECT version(),current_setting('server_version_num')::integer AS num"))[0];
  assert(v.num>=170000 && v.num<180000,'PostgreSQL 17 required'); console.log(v.version);
  await exec("DO $$ BEGIN IF NOT EXISTS(SELECT FROM pg_roles WHERE rolname='postgres') THEN CREATE ROLE postgres NOSUPERUSER; END IF; END $$; CREATE ROLE anon; CREATE ROLE authenticated; CREATE ROLE service_role; CREATE ROLE fixture_inherited;");
  assert.equal((await rows("SELECT rolsuper FROM pg_roles WHERE rolname='postgres'"))[0].rolsuper,false);
  await test('baseline anonymous owner-privileged call is reproducible',async()=>{
    await exec('SET ROLE anon;'); assert.equal((await rows('SELECT public.get_entitlements(NULL) AS actor'))[0].actor,'postgres'); await exec('RESET ROLE;');
  });
  await test('all eight anonymous calls denied while required access and unrelated RPC remain',async()=>{
    await apply();
    for(const signature of signatures) {
      assert.equal((await rows(`SELECT has_function_privilege('anon','public.${signature}','EXECUTE') AS allowed`))[0].allowed,false);
      for(const role of ['authenticated','service_role']) assert.equal((await rows(`SELECT has_function_privilege('${role}','public.${signature}','EXECUTE') AS allowed`))[0].allowed,true);
      const [name,args]=signature.split('('); const parameters=args.slice(0,-1).split(',').filter(Boolean).map(t=>`NULL::${t}`).join(',');
      await exec('SET ROLE anon;'); await assert.rejects(rows(`SELECT public.${name}(${parameters})`),e=>e.code==='42501'); await exec('RESET ROLE;');
    }
    await exec('SET ROLE authenticated;'); assert.equal((await rows('SELECT public.get_entitlements(NULL) AS actor'))[0].actor,'postgres');
    await exec('SET ROLE service_role;'); assert.equal((await rows('SELECT public.get_entitlements(NULL) AS actor'))[0].actor,'postgres');
    await exec('SET ROLE anon;'); assert.equal((await rows('SELECT public.unrelated() AS actor'))[0].actor,'postgres'); await exec('RESET ROLE;');
  });
  await test('restored-database rehearsal rolls back every target ACL and temporary evidence',async()=>{
    const before=await rows("SELECT p.oid,p.proacl::text AS acl,md5(pg_get_functiondef(p.oid)) AS definition FROM pg_proc p WHERE p.pronamespace='public'::regnamespace ORDER BY p.oid");
    await exec('SET ROLE postgres;'); await exec(rehearsal); await exec('RESET ROLE;');
    const after=await rows("SELECT p.oid,p.proacl::text AS acl,md5(pg_get_functiondef(p.oid)) AS definition FROM pg_proc p WHERE p.pronamespace='public'::regnamespace ORDER BY p.oid");
    assert.deepEqual(after,before);
    assert.equal((await rows("SELECT to_regclass('pg_temp.potok_rpc_targets') IS NULL AS gone"))[0].gone,true);
    for(const signature of signatures) assert.equal((await rows(`SELECT has_function_privilege('anon','public.${signature}','EXECUTE') AS allowed`))[0].allowed,true);
  });
  await test('replay is idempotent',async()=>{await apply(); await apply();});
  await test('inherited anonymous EXECUTE aborts and restores all revokes',async()=>{
    await exec('GRANT fixture_inherited TO anon; GRANT EXECUTE ON FUNCTION public.get_entitlements(uuid) TO fixture_inherited;'); await reject('Effective anonymous EXECUTE remains');
  });
  await test('missing target aborts',async()=>{await exec('DROP FUNCTION public.start_purchase(uuid,text,text,text);');await reject('RPC inventory');});
  await test('owner drift aborts',async()=>{await exec('ALTER FUNCTION public.start_purchase(uuid,text,text,text) OWNER TO test_admin;');await reject('RPC inventory');});
  await test('definer drift aborts',async()=>{await exec('ALTER FUNCTION public.start_purchase(uuid,text,text,text) SECURITY INVOKER;');await reject('RPC inventory');});
  await test('PUBLIC-only authenticated access is not silently lost',async()=>{await exec('REVOKE EXECUTE ON FUNCTION public.get_entitlements(uuid) FROM authenticated;');await reject('Required role access');});
  await test('PUBLIC-only service access is not silently lost',async()=>{await exec('REVOKE EXECUTE ON FUNCTION public.get_entitlements(uuid) FROM service_role;');await reject('Required role access');});
  await test('unexpected actor aborts',async()=>{await assert.rejects(exec(sql),e=>e.message.includes('Expected effective role postgres'));await assertBaseline();});
  console.log(`${passed} anonymous RPC regression scenarios passed`);
} finally {await exec('ROLLBACK; RESET ROLE;').catch(()=>{}); await(embedded?db.close():db.end());}
