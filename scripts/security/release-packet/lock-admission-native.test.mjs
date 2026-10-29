// Real PG17 privilege/lock semantics on a disposable loopback test database only.
import assert from 'node:assert/strict';
import {pathToFileURL} from 'node:url';
const url=new URL(process.env.TEST_DATABASE_URL??'');
assert.equal(url.hostname,'127.0.0.1');assert.equal(url.pathname,'/potok_release_review_test');
const {default:pg}=await import(pathToFileURL(process.env.SQL_TEST_PG_MODULE));
const db=new pg.Client({connectionString:url.href}),writer=new pg.Client({connectionString:url.href});
await db.connect();await writer.connect();
const role='potok_lock_admission_actor_v1',managed='potok_lock_managed_fixture_v1',app='potok_lock_app_fixture_v1';
let seeded=false;
try{
  assert.equal((await db.query('SELECT count(*)::int n FROM pg_roles WHERE rolname=$1',[role])).rows[0].n,0);
  for(const name of [managed,app])assert.equal((await db.query('SELECT to_regclass($1) r',['public.'+name])).rows[0].r,null);
  await db.query(`BEGIN;
    CREATE ROLE ${role} NOLOGIN NOSUPERUSER NOBYPASSRLS NOINHERIT;
    CREATE TABLE public.${managed}(id int PRIMARY KEY,value int);
    CREATE TABLE public.${app}(id int PRIMARY KEY,value int);
    INSERT INTO public.${managed} VALUES(1,1); INSERT INTO public.${app} VALUES(1,1);
    GRANT USAGE ON SCHEMA public TO ${role};
    GRANT SELECT ON public.${managed} TO ${role};
    GRANT SELECT,UPDATE ON public.${app} TO ${role};
    COMMIT;`);
  seeded=true;
  const acl=async()=> (await db.query('SELECT relname,relacl::text acl FROM pg_class WHERE relname=ANY($1) ORDER BY relname',[[managed,app]])).rows;
  const baseline=await acl();
  await db.query(`BEGIN;SET LOCAL ROLE ${role};`);
  await assert.rejects(()=>db.query(`LOCK TABLE public.${managed} IN SHARE ROW EXCLUSIVE MODE`),e=>e.code==='42501');
  await db.query('ROLLBACK');
  await db.query(`BEGIN;SET LOCAL ROLE ${role};LOCK TABLE public.${managed} IN ACCESS SHARE MODE;`);
  // Demonstrate the limitation, rather than treating ACCESS SHARE as a write freeze.
  await writer.query(`UPDATE public.${managed} SET value=2 WHERE id=1`);
  await db.query('ROLLBACK');
  await db.query(`BEGIN;SET LOCAL ROLE ${role};LOCK TABLE public.${app} IN SHARE ROW EXCLUSIVE MODE;`);
  await assert.rejects(()=>writer.query(`SET lock_timeout='100ms';UPDATE public.${app} SET value=2 WHERE id=1`),e=>e.code==='55P03');
  await db.query('ROLLBACK');
  await writer.query(`UPDATE public.${app} SET value=2 WHERE id=1`);
  assert.deepEqual(await acl(),baseline);
  console.log('MANAGED_LOCK_NATIVE_OK: SELECT-only strong lock denied; ACCESS SHARE permits concurrent write; approved stronger mode blocks writer; ACL unchanged. Disposable evidence only.');
}finally{
  await writer.query('ROLLBACK');await db.query('ROLLBACK');
  if(seeded)await db.query(`DROP TABLE public.${managed},public.${app};REVOKE USAGE ON SCHEMA public FROM ${role};DROP ROLE ${role};`);
  await writer.end();await db.end();
}
