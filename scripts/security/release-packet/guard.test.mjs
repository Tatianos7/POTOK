// Only a disposable loopback PostgreSQL service; no hosted or arbitrary target support.
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {pathToFileURL} from 'node:url';
const url=new URL(process.env.TEST_DATABASE_URL??'');
assert.equal(url.hostname,'127.0.0.1');assert.equal(url.pathname,'/potok_release_review_test');
const {default:pg}=await import(pathToFileURL(process.env.SQL_TEST_PG_MODULE));
const db=new pg.Client({connectionString:url.href});await db.connect();
const snapshot=async()=> (await db.query(`SELECT jsonb_build_object(
 'relations',(SELECT jsonb_agg(to_jsonb(c) ORDER BY c.oid) FROM pg_class c WHERE c.relnamespace='public'::regnamespace),
 'functions',(SELECT jsonb_agg(to_jsonb(p) ORDER BY p.oid) FROM pg_proc p WHERE p.pronamespace='public'::regnamespace),
 'schemas',(SELECT jsonb_agg(to_jsonb(n) ORDER BY n.oid) FROM pg_namespace n),
 'defaults',(SELECT jsonb_agg(to_jsonb(d) ORDER BY d.oid) FROM pg_default_acl d),
 'roles',(SELECT jsonb_agg(to_jsonb(r) ORDER BY r.oid) FROM pg_roles r)) AS value`)).rows[0].value;
try {
  const before=await snapshot();
  const sql=await readFile(new URL('forward.review.sql',import.meta.url),'utf8');
  await assert.rejects(()=>db.query(sql),error=>error.code==='P0001'&&error.message==='REVIEW_ONLY_NO_TARGET_APPROVAL');
  await db.query('ROLLBACK');
  assert.deepEqual(await snapshot(),before);
  console.log('RELEASE_REVIEW_NATIVE_GUARD_OK: exact review packet stopped before candidate SQL; public objects, schemas, roles and defaults unchanged');
} finally {await db.query('ROLLBACK');await db.end();}
