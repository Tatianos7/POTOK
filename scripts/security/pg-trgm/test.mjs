import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { pathToFileURL } from 'node:url';
const embedded = process.env.SQL_TEST_PGLITE_MODULE;
let db;
if (embedded) {
  const { PGlite } = await import(pathToFileURL(embedded));
  const { pg_trgm } = await import(pathToFileURL(process.env.SQL_TEST_TRGM_MODULE));
  db = new PGlite({ extensions: { pg_trgm } });
  await db.exec('CREATE ROLE test_admin SUPERUSER; SET SESSION AUTHORIZATION test_admin; ALTER ROLE postgres RENAME TO fixture_bootstrap; CREATE ROLE postgres NOSUPERUSER;');
} else {
  const url = new URL(process.env.TEST_DATABASE_URL ?? '');
  assert(['localhost', '127.0.0.1', '[::1]'].includes(url.hostname), 'Local disposable cluster only');
  assert.equal(url.pathname, '/potok_trgm_test', 'Refusing a non-test database');
  const { default: pg } = await import(pathToFileURL(process.env.SQL_TEST_PG_MODULE));
  db = new pg.Client({ connectionString: url.href }); await db.connect();
}
const exec = sql => embedded ? db.exec(sql) : db.query(sql);
const rows = async sql => (await db.query(sql)).rows;
const sql = await readFile(new URL('./rehearsal.sql', import.meta.url), 'utf8');
assert.equal((sql.match(/^ROLLBACK;$/gm) ?? []).length, 1);
assert(!/^COMMIT;/m.test(sql));
const commitForFixture = sql.replace(/ROLLBACK;\s*$/, 'COMMIT;\n');
const fixtureDatabase = embedded ? 'template1' : 'potok_trgm_test';
const fixture = `RESET ROLE; DROP EXTENSION IF EXISTS pg_trgm CASCADE;
DROP SCHEMA IF EXISTS public CASCADE; DROP SCHEMA IF EXISTS extensions CASCADE;
CREATE SCHEMA public AUTHORIZATION postgres; CREATE SCHEMA extensions AUTHORIZATION postgres;
REVOKE CREATE ON SCHEMA public FROM PUBLIC;
GRANT USAGE ON SCHEMA public, extensions TO anon, authenticated;
${embedded ? 'ALTER ROLE postgres SUPERUSER' : `GRANT CREATE ON DATABASE ${fixtureDatabase} TO postgres`};
SET ROLE postgres; CREATE EXTENSION pg_trgm WITH SCHEMA public;
${embedded ? 'RESET ROLE; ALTER ROLE postgres NOSUPERUSER; SET ROLE postgres;' : ''}
CREATE TABLE public.food_fixture (id integer PRIMARY KEY, name text NOT NULL);
INSERT INTO public.food_fixture VALUES (1,'apple'),(2,'oatmeal'),(3,'another user item');
CREATE INDEX food_name_trgm_idx ON public.food_fixture USING gin(name public.gin_trgm_ops);
ALTER TABLE public.food_fixture ENABLE ROW LEVEL SECURITY;
CREATE POLICY visible ON public.food_fixture FOR SELECT TO authenticated USING (id < 3);
GRANT SELECT ON public.food_fixture TO authenticated;
RESET ROLE;`;
async function schema() { return (await rows("SELECT n.nspname FROM pg_extension e JOIN pg_namespace n ON n.oid=e.extnamespace WHERE e.extname='pg_trgm'"))[0].nspname; }
async function fixtureReset() { await exec('ROLLBACK; RESET ROLE;'); for (const statement of fixture.split(';').filter(s=>s.trim())) await exec(statement); }
async function apply(s = sql) { await exec('SET ROLE postgres;'); await exec(s); }
async function reject(message) {
  await assert.rejects(apply(), e => e.message.includes(message));
  await exec('ROLLBACK; RESET ROLE;'); assert.equal(await schema(), 'public');
  assert.equal((await rows('SELECT count(*)::integer AS n FROM public.food_fixture'))[0].n, 3);
}
let passed = 0;
async function test(name, fn) { await fixtureReset(); await fn(); passed++; console.log(`PASS ${name}`); }
try {
  const v = (await rows("SELECT version(), current_setting('server_version_num')::integer AS num"))[0];
  assert(v.num >= 170000 && v.num < 180000, 'PostgreSQL 17 required'); console.log(v.version);
  const actual = (await rows('SELECT current_database() AS name'))[0].name;
  if (embedded) assert.equal(actual, 'template1');
  await exec(`DO $$ BEGIN IF NOT EXISTS (SELECT FROM pg_roles WHERE rolname='postgres') THEN CREATE ROLE postgres NOSUPERUSER; END IF; END $$;
    CREATE ROLE anon; CREATE ROLE authenticated;`);
  assert.equal((await rows("SELECT rolsuper FROM pg_roles WHERE rolname='postgres'"))[0].rolsuper, false);
  await test('rehearsal rolls back schema and temporary evidence', async () => {
    await apply(); assert.equal(await schema(), 'public');
    assert.equal((await rows("SELECT to_regclass('pg_temp.potok_trgm_members') IS NULL AS gone"))[0].gone, true);
  });
  await test('fixture commit preserves search, role RLS and index use', async () => {
    await apply(commitForFixture); assert.equal(await schema(), 'extensions');
    await exec('SET ROLE postgres; SET search_path=public,extensions; SET enable_seqscan=off;');
    const plan = await rows("EXPLAIN SELECT name FROM public.food_fixture WHERE name ILIKE '%app%'");
    assert(JSON.stringify(plan).includes('food_name_trgm_idx'));
    await exec('SET ROLE authenticated;');
    assert.deepEqual((await rows("SELECT name FROM public.food_fixture WHERE name ILIKE '%app%' ORDER BY id")).map(r=>r.name), ['apple']);
    assert.equal((await rows('SELECT count(*)::integer AS n FROM public.food_fixture'))[0].n, 2);
    assert.equal((await rows("SELECT similarity('apple','apple') AS n"))[0].n, 1);
    await exec('RESET ROLE; RESET enable_seqscan;');
  });
  await test('already moved schema can be rehearsed again', async () => { await apply(commitForFixture); await apply(); assert.equal(await schema(), 'extensions'); });
  await test('explicit public function reference blocks move', async () => {
    await exec("SET ROLE postgres; CREATE FUNCTION public.fixture_search(text) RETURNS real LANGUAGE sql AS 'SELECT public.similarity($1,$1)'; RESET ROLE;");
    await reject('Explicit public extension reference');
  });
  await test('restricted routine search_path blocks move', async () => {
    await exec("SET ROLE postgres; CREATE FUNCTION public.fixture_search(text) RETURNS real LANGUAGE plpgsql SET search_path=public AS 'BEGIN RETURN similarity($1,$1); END'; RESET ROLE;");
    await reject('Restricted search_path');
  });
  await test('client target CREATE blocks move', async () => { await exec('GRANT CREATE ON SCHEMA extensions TO anon;'); await reject('Client CREATE'); });
  await test('missing target USAGE blocks move', async () => { await exec('REVOKE USAGE ON SCHEMA extensions FROM anon;'); await reject('Target schema USAGE'); });
  await test('wrong actor blocks move', async () => { await assert.rejects(exec(sql), e=>e.message.includes('Expected effective role postgres')); await exec('ROLLBACK;'); });
  await test('non-owner permission failure is preserved, without elevation', async () => {
    await exec('DROP EXTENSION pg_trgm CASCADE; CREATE EXTENSION pg_trgm WITH SCHEMA public;');
    await assert.rejects(apply(), e=>e.code==='42501'); await exec('ROLLBACK; RESET ROLE;'); assert.equal(await schema(), 'public');
  });
  console.log(`${passed} pg_trgm regression scenarios passed`);
} finally { await exec('ROLLBACK; RESET ROLE;').catch(()=>{}); await (embedded ? db.close() : db.end()); }
