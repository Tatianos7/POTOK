import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { pathToFileURL } from 'node:url';

// This suite destroys its public schema. Hosted URLs are deliberately refused.
const embedded = process.env.SQL_TEST_PGLITE_MODULE;
let db;
if (embedded) {
  const { PGlite } = await import(pathToFileURL(embedded));
  db = new PGlite();
  await db.exec('CREATE ROLE test_admin SUPERUSER; SET SESSION AUTHORIZATION test_admin; ALTER ROLE postgres RENAME TO fixture_bootstrap; CREATE ROLE postgres NOSUPERUSER;');
} else {
  const url = new URL(process.env.TEST_DATABASE_URL ?? '');
  assert(['localhost', '127.0.0.1', '[::1]'].includes(url.hostname), 'Disposable local database only');
  assert.equal(url.pathname, '/potok_privilege_test', 'Refusing a non-test database');
  const { default: pg } = process.env.SQL_TEST_PG_MODULE
    ? await import(pathToFileURL(process.env.SQL_TEST_PG_MODULE))
    : await import('pg');
  db = new pg.Client({ connectionString: url.href });
  await db.connect();
}
const exec = sql => embedded ? db.exec(sql) : db.query(sql);
const rows = async sql => (embedded ? (await db.query(sql)).rows : (await db.query(sql)).rows);
const fixture = await readFile(new URL('./fixture.sql', import.meta.url), 'utf8');
const patch = await readFile(new URL('../../../supabase/migration_drafts/client_truncate_containment_v1.sql', import.meta.url), 'utf8');
const assertions = await readFile(new URL('./assertions.sql', import.meta.url), 'utf8');
let passed = 0;
async function test(name, fn) {
  await exec('ROLLBACK; RESET ROLE;');
  await exec(fixture);
  await fn();
  passed++;
  console.log(`PASS ${name}`);
}
async function apply() { await exec('SET ROLE postgres;'); await exec(patch); }
async function rejectsApply(message) {
  await assert.rejects(apply(), e => e.message.includes(message));
  await exec('ROLLBACK; RESET ROLE;');
  assert.equal((await rows("SELECT has_table_privilege('authenticated', 'public.fixture', 'TRUNCATE') AS allowed"))[0].allowed, true, 'Failed patch must roll back existing ACL changes');
  assert.equal((await rows('SELECT count(*)::integer AS n FROM public.fixture'))[0].n, 2);
}
try {
  const version = (await rows('SELECT version(), current_setting(\'server_version_num\')::integer AS num'))[0];
  assert(version.num >= 170000 && version.num < 180000, 'PostgreSQL 17 required');
  assert.equal((await rows("SELECT rolsuper FROM pg_roles WHERE rolname = current_user"))[0].rolsuper, true, 'Disposable fixture administrator must be superuser');
  console.log(version.version);
  await exec(`DO $$ BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'postgres') THEN CREATE ROLE postgres NOSUPERUSER; END IF;
  END $$;
  CREATE ROLE anon; CREATE ROLE authenticated; CREATE ROLE service_role;
  CREATE ROLE supabase_admin SUPERUSER; CREATE ROLE fixture_inherited;
  GRANT postgres, anon, authenticated, service_role, supabase_admin TO test_admin;`);
  assert.equal((await rows("SELECT rolsuper FROM pg_roles WHERE rolname = 'postgres'"))[0].rolsuper, false);
  await test('baseline reproduces actual RLS-bypassing client TRUNCATE', async () => {
    await exec('BEGIN; SET LOCAL ROLE authenticated; TRUNCATE public.fixture; RESET ROLE;');
    assert.equal((await rows('SELECT count(*)::integer AS n FROM public.fixture'))[0].n, 0);
    await exec('ROLLBACK;');
  });
  await test('containment preserves rows, DML, RLS, service access and postgres defaults', async () => {
    await apply(); await exec(assertions);
  });
  await test('replay is idempotent', async () => {
    await apply(); await apply(); await exec(assertions);
  });
  await test('inherited table privilege aborts and rolls back direct revokes', async () => {
    await exec('GRANT fixture_inherited TO authenticated; GRANT TRUNCATE ON public.fixture TO fixture_inherited;');
    await rejectsApply('Effective client TRUNCATE remains');
  });
  await test('inherited schema default aborts and rolls back direct revokes', async () => {
    await exec('GRANT fixture_inherited TO anon; ALTER DEFAULT PRIVILEGES FOR ROLE postgres IN SCHEMA public GRANT TRUNCATE ON TABLES TO fixture_inherited;');
    await rejectsApply('Effective postgres default TRUNCATE remains');
  });
  await test('global default cannot be hidden by schema REVOKE', async () => {
    await exec('ALTER DEFAULT PRIVILEGES FOR ROLE postgres GRANT TRUNCATE ON TABLES TO PUBLIC;');
    await rejectsApply('Unsafe global default TRUNCATE');
  });
  await test('unexpected table owner aborts', async () => {
    await exec('ALTER TABLE public.fixture OWNER TO supabase_admin;');
    await rejectsApply('Unexpected public table owner');
  });
  await test('client schema CREATE aborts', async () => {
    await exec('GRANT CREATE ON SCHEMA public TO authenticated;');
    await rejectsApply('Client schema CREATE');
  });
  await test('wrong effective role aborts', async () => {
    await assert.rejects(exec(patch), e => e.message.includes('Expected effective role postgres'));
    await exec('ROLLBACK;');
  });
  await test('postgres cannot repair supabase_admin defaults', async () => {
    await exec('SET ROLE postgres;');
    await assert.rejects(exec('ALTER DEFAULT PRIVILEGES FOR ROLE supabase_admin IN SCHEMA public REVOKE TRUNCATE ON TABLES FROM authenticated'), e => e.code === '42501');
    await exec('RESET ROLE;');
  });
  console.log(`${passed} privilege regression scenarios passed`);
} finally {
  await exec('ROLLBACK; RESET ROLE;').catch(() => {});
  await (embedded ? db.close() : db.end());
}
