import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {pathToFileURL} from 'node:url';

// Only a disposable embedded engine or the named loopback CI database is allowed.
const embedded = process.env.SQL_TEST_PGLITE_MODULE;
let db;
if (embedded) {
  const {PGlite} = await import(pathToFileURL(embedded));
  db = new PGlite();
} else {
  const url = new URL(process.env.TEST_DATABASE_URL ?? '');
  assert.equal(url.hostname, '127.0.0.1');
  assert.equal(url.pathname, '/potok_data_api_test');
  const {default: pg} = await import(pathToFileURL(process.env.SQL_TEST_PG_MODULE));
  db = new pg.Client({connectionString: url.href});
  await db.connect();
}
const exec = sql => embedded ? db.exec(sql) : db.query(sql);
const rows = async sql => (await db.query(sql)).rows;
const original = await Promise.all([
  '20260224_measurements_photo_assets.sql', '20260225_measurement_photo_deletions.sql'
].map(name => readFile('supabase/migrations/' + name, 'utf8')));
const draft = await readFile('supabase/migration_drafts/measurement_photo_explicit_grants_review_v1.sql','utf8');
assert.equal((draft.match(/^BEGIN;$/gm) ?? []).length,1);
assert.equal((draft.match(/^ROLLBACK;$/gm) ?? []).length,1);
assert.doesNotMatch(draft,/^COMMIT;$/m);
const body = draft.replace(/^BEGIN;$/m,'').replace(/^ROLLBACK;$/m,'');
const a = '11111111-1111-4111-8111-111111111111';
const b = '22222222-2222-4222-8222-222222222222';
let passed=0;
async function fixture() {
  await exec(`ROLLBACK; RESET ROLE;
    DROP SCHEMA IF EXISTS public CASCADE; DROP SCHEMA IF EXISTS storage CASCADE;
    DROP SCHEMA IF EXISTS auth CASCADE;
    CREATE SCHEMA public AUTHORIZATION postgres; CREATE SCHEMA auth; CREATE SCHEMA storage;
    REVOKE CREATE ON SCHEMA public FROM PUBLIC;
    GRANT USAGE ON SCHEMA public,auth TO authenticated,anon,service_role;
    CREATE FUNCTION auth.uid() RETURNS uuid LANGUAGE sql STABLE AS
      $$ SELECT nullif(current_setting('test.uid',true),'')::uuid $$;
    CREATE TABLE auth.users(id uuid PRIMARY KEY);
    INSERT INTO auth.users VALUES('${a}'),('${b}');
    CREATE TABLE storage.buckets(id text PRIMARY KEY,name text,public boolean);
    CREATE TABLE storage.objects(id uuid PRIMARY KEY,bucket_id text,name text);
    GRANT USAGE ON SCHEMA auth,storage TO postgres;
    GRANT REFERENCES ON auth.users TO postgres;
    GRANT ALL ON storage.buckets,storage.objects TO postgres;
    ALTER TABLE storage.objects OWNER TO postgres;
    SET ROLE postgres;
    ALTER DEFAULT PRIVILEGES IN SCHEMA public REVOKE ALL ON TABLES FROM PUBLIC,anon,authenticated,service_role;
    ALTER DEFAULT PRIVILEGES IN SCHEMA public REVOKE ALL ON SEQUENCES FROM PUBLIC,anon,authenticated,service_role;`);
  for(const sql of original) {
    // Embedded PG lacks pgcrypto packaging. gen_random_uuid is core PG17.
    // Native CI executes the entire exact historical source including extension DDL.
    await exec(embedded ? sql.replace(/^create extension if not exists pgcrypto;\s*/i,'') : sql);
  }
  await exec('RESET ROLE;');
}
async function as(role,user,sql) {
  await exec(`BEGIN; SET LOCAL ROLE ${role}; SELECT set_config('test.uid','${user}',true);`);
  try { const result=await rows(sql); await exec('COMMIT;'); return result; }
  catch(error) {await exec('ROLLBACK;');throw error;}
}
const asset = (user,path='first') => `INSERT INTO public.measurement_photo_assets(user_id,day,slot,storage_path)
  VALUES('${user}','2026-10-25','main_1','${path}') ON CONFLICT(user_id,day,slot)
  DO UPDATE SET user_id=excluded.user_id,day=excluded.day,slot=excluded.slot,storage_path=excluded.storage_path`;
const deletion = (user,stamp) => `INSERT INTO public.measurement_photo_deletions(user_id,day,deleted_at)
  VALUES('${user}','2026-10-25','${stamp}') ON CONFLICT(user_id,day)
  DO UPDATE SET user_id=excluded.user_id,day=excluded.day,deleted_at=excluded.deleted_at`;
const denied = fn => assert.rejects(fn,error=>error.code==='42501');
async function apply() {await exec('BEGIN; SET LOCAL ROLE postgres;'+body+'COMMIT;');}
async function test(name,fn) {await fixture();await fn();passed++;console.log('PASS '+name);}
try {
  if(embedded) await exec('CREATE ROLE test_admin SUPERUSER; SET SESSION AUTHORIZATION test_admin; ALTER ROLE postgres RENAME TO embedded_bootstrap; CREATE ROLE postgres NOSUPERUSER;');
  else await exec('CREATE ROLE test_admin SUPERUSER; SET SESSION AUTHORIZATION test_admin; ALTER ROLE postgres NOSUPERUSER;');
  await exec('CREATE ROLE authenticated; CREATE ROLE anon; CREATE ROLE service_role BYPASSRLS;');
  assert.equal((await rows("SELECT rolsuper FROM pg_roles WHERE rolname='postgres'"))[0].rolsuper,false);
  await test('exact historical table creation fails without implicit Data API grants',async()=>{
    await denied(()=>as('authenticated',a,'SELECT * FROM public.measurement_photo_assets'));
    await denied(()=>as('authenticated',a,deletion(a,'2026-10-25T10:00:00Z')));
  });
  await test('grants alone do not enable repeated deletion-marker upsert',async()=>{
    await exec('SET ROLE postgres; GRANT SELECT,INSERT,UPDATE,DELETE ON public.measurement_photo_deletions TO authenticated; RESET ROLE;');
    await as('authenticated',a,deletion(a,'2026-10-25T10:00:00Z'));
    await denied(()=>as('authenticated',a,deletion(a,'2026-10-25T11:00:00Z')));
  });
  await test('candidate supports owner photo upsert/select/delete and denies foreign ownership',async()=>{
    await apply();await as('authenticated',a,asset(a));await as('authenticated',a,asset(a,'second'));
    assert.equal((await as('authenticated',a,'SELECT storage_path FROM public.measurement_photo_assets'))[0].storage_path,'second');
    assert.equal((await as('authenticated',b,'SELECT * FROM public.measurement_photo_assets')).length,0);
    await denied(()=>as('authenticated',b,asset(a)));
    await denied(()=>as('authenticated',a,`UPDATE public.measurement_photo_assets SET user_id='${b}'`));
    assert.equal((await as('authenticated',b,'DELETE FROM public.measurement_photo_assets RETURNING id')).length,0);
    assert.equal((await as('authenticated',a,'DELETE FROM public.measurement_photo_assets RETURNING id')).length,1);
  });
  await test('repeated deletion upsert persists timestamp while keeping account isolation',async()=>{
    await apply();await as('authenticated',a,deletion(a,'2026-10-25T10:00:00Z'));
    await as('authenticated',a,deletion(a,'2026-10-25T11:00:00Z'));
    assert.equal((await as('authenticated',a,"SELECT extract(hour FROM deleted_at AT TIME ZONE 'UTC')::int AS hour FROM public.measurement_photo_deletions"))[0].hour,11);
    assert.equal((await as('authenticated',b,'SELECT * FROM public.measurement_photo_deletions')).length,0);
    await denied(()=>as('authenticated',b,deletion(a,'2026-10-25T12:00:00Z')));
    await denied(()=>as('authenticated',a,`UPDATE public.measurement_photo_deletions SET user_id='${b}'`));
    await denied(()=>as('authenticated',a,"UPDATE public.measurement_photo_deletions SET id=gen_random_uuid()"));
    assert.equal((await as('authenticated',b,'DELETE FROM public.measurement_photo_deletions RETURNING id')).length,0);
    assert.equal((await as('authenticated',a,'DELETE FROM public.measurement_photo_deletions RETURNING id')).length,1);
  });
  await test('anonymous and service-role callers gain no implicit table access',async()=>{
    await apply();for(const role of ['anon','service_role'])for(const table of ['measurement_photo_assets','measurement_photo_deletions'])
      await denied(()=>as(role,'','SELECT * FROM public.'+table));
    await denied(()=>as('authenticated',a,'TRUNCATE public.measurement_photo_assets'));
  });
  await test('review file rolls back both grants and new policy',async()=>{
    await exec('SET ROLE postgres;');await exec(draft);await exec('RESET ROLE;');
    await denied(()=>as('authenticated',a,'SELECT * FROM public.measurement_photo_assets'));
    assert.equal((await rows("SELECT count(*)::int AS n FROM pg_policy WHERE polname='measurement_photo_deletions_update_own_explicit_v1'"))[0].n,0);
  });
  await test('candidate is repeatable and stops on policy drift before grants',async()=>{
    await apply();await apply();await fixture();
    await exec('SET ROLE postgres; CREATE POLICY unexpected ON public.measurement_photo_assets FOR SELECT USING(true); RESET ROLE;');
    await assert.rejects(apply(),/Policy set drift/);await exec('ROLLBACK;');
    await denied(()=>as('authenticated',a,'SELECT * FROM public.measurement_photo_assets'));
  });
  console.log(`DATA_API_EXPLICIT_GRANTS_OK: ${passed} tests; historical migrations replayed; no hosted database contacted`);
} finally {embedded ? await db.close() : await db.end();}
