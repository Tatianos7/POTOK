// SQL fragments tested on disposable PG only. Never reads POTOK or private dumps.
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {pathToFileURL} from 'node:url';
import {sequenceSQL,scopeSQL,metadataSQL,canonicalCTE} from './target-rehearsal.mjs';
const url=new URL(process.env.TEST_DATABASE_URL??'');assert.equal(url.hostname,'127.0.0.1');assert.equal(url.pathname,'/potok_release_review_test');
const {default:pg}=await import(pathToFileURL(process.env.SQL_TEST_PG_MODULE));const db=new pg.Client({connectionString:url.href});await db.connect();
const cte=canonicalCTE(await readFile(new URL('preflight.sql',import.meta.url),'utf8'));
const setup=async()=>{
  assert.equal((await db.query("SELECT to_regclass('public.program_sessions') r")).rows[0].r,null);
  await db.query(`BEGIN;SET LOCAL search_path=pg_catalog,pg_temp;SET LOCAL timezone='UTC';
    CREATE TABLE public.program_sessions(id int,value text);INSERT INTO public.program_sessions VALUES(1,'original');
    CREATE SEQUENCE public.potok_sequence_guard_fixture_v1 START 11;`);
  const tables=(await db.query(`SELECT n.nspname AS schema,c.relname AS name,c.relkind AS kind,c.relispartition AS partition,
    (SELECT jsonb_agg(jsonb_build_object('name',a.attname,'type',format_type(a.atttypid,a.atttypmod),'generated',a.attgenerated) ORDER BY a.attnum)
    FROM pg_attribute a WHERE a.attrelid=c.oid AND a.attnum>0 AND NOT a.attisdropped) AS columns
    FROM pg_class c JOIN pg_namespace n ON n.oid=c.relnamespace WHERE n.nspname IN('auth','public','storage') AND c.relkind IN('r','p') ORDER BY 1,2`)).rows;
  const digest=(await db.query(cte+" SELECT encode(sha256(convert_to(document::text,'UTF8')),'hex') value FROM canonical_metadata")).rows[0].value;
  return {tables,digest};
};
try{
  let fixture=await setup();await db.query(scopeSQL(fixture.tables));await db.query(metadataSQL(cte,fixture.digest));
  await db.query(sequenceSQL());await db.query('ALTER TABLE public.program_sessions ADD COLUMN execution_reason text');
  await db.query(scopeSQL(fixture.tables,{after:true}));await db.query(sequenceSQL(true));await db.query('ROLLBACK');
  fixture=await setup();await db.query(sequenceSQL());await db.query("SELECT nextval('public.potok_sequence_guard_fixture_v1')");
  await assert.rejects(()=>db.query(sequenceSQL(true)),e=>e.message==='TARGET_REHEARSAL_SEQUENCE_VALUE_STOPPED');await db.query('ROLLBACK');
  fixture=await setup();await db.query(sequenceSQL());await db.query('ALTER SEQUENCE public.potok_sequence_guard_fixture_v1 INCREMENT BY 2');
  await assert.rejects(()=>db.query(sequenceSQL(true)),e=>e.message==='TARGET_REHEARSAL_SEQUENCE_CATALOG_STOPPED');await db.query('ROLLBACK');
  fixture=await setup();await db.query('ALTER TABLE public.program_sessions ALTER COLUMN value TYPE varchar(20)');
  await assert.rejects(()=>db.query(scopeSQL(fixture.tables)),e=>e.message==='TARGET_REHEARSAL_SCOPE_STOPPED');await db.query('ROLLBACK');
  fixture=await setup();await db.query('ALTER TABLE public.program_sessions ADD COLUMN unexpected int');
  await assert.rejects(()=>db.query(metadataSQL(cte,fixture.digest)),e=>e.message==='TARGET_REHEARSAL_METADATA_STOPPED');await db.query('ROLLBACK');
  const sql=await readFile(new URL('target-twelve-rehearsal.pending-approval.sql',import.meta.url),'utf8');
  await assert.rejects(()=>db.query(sql),e=>e.message==='TARGET_REHEARSAL_CONTEXT_STOPPED');await db.query('ROLLBACK');
  assert.equal((await db.query("SELECT to_regclass('public.program_sessions') r")).rows[0].r,null);
  assert.equal((await db.query("SELECT to_regclass('public.potok_sequence_guard_fixture_v1') r")).rows[0].r,null);
  console.log('TARGET_REHEARSAL_NATIVE_OK: actual context stops before locks; schema/metadata drift rejected; nullable addition preserved; sequence values/catalog guarded without resets; disposable rollback complete. Not a hosted rehearsal.');
}finally{await db.query('ROLLBACK');await db.end();}
