// Native transaction/row-proof tests in one disposable loopback PG17 service only.
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {pathToFileURL} from 'node:url';
import {beforeRowsSQL,afterRowsSQL} from './row-guard.mjs';
const url=new URL(process.env.TEST_DATABASE_URL??'');assert.equal(url.hostname,'127.0.0.1');assert.equal(url.pathname,'/potok_release_review_test');
const {default:pg}=await import(pathToFileURL(process.env.SQL_TEST_PG_MODULE));const db=new pg.Client({connectionString:url.href});await db.connect();
const name='potok_release_row_fixture_v1',tables=[{schema:'public',name}],before=beforeRowsSQL(tables),after=afterRowsSQL(tables);
try{
 const snapshot=async()=> (await db.query("SELECT coalesce(jsonb_agg(to_jsonb(c) ORDER BY c.oid),'[]'::jsonb) value FROM pg_class c WHERE c.relnamespace='public'::regnamespace")).rows[0].value;
 const untouched=await snapshot();const envelope=await readFile(new URL('target-envelope.review.sql',import.meta.url),'utf8');
 await assert.rejects(()=>db.query(envelope),e=>e.code==='P0001'&&e.message==='TARGET_RELEASE_NOT_APPROVED');await db.query('ROLLBACK');assert.deepEqual(await snapshot(),untouched);
 assert.equal((await db.query('SELECT to_regclass($1) value',['public.'+name])).rows[0].value,null);
 const seed=async()=>db.query(`BEGIN;CREATE TABLE public.${name}(id int,value text);INSERT INTO public.${name} VALUES(1,'a'),(1,'a'),(2,'b');`);
 await seed();await db.query(before);await db.query(`ALTER TABLE public.${name} ADD COLUMN execution_reason text;`);await db.query(after);await db.query('ROLLBACK');
 await seed();await db.query(before);await db.query(`UPDATE public.${name} SET value='same-count-tamper' WHERE id=2;`);await assert.rejects(()=>db.query(after),e=>e.message==='RELEASE_ROW_CONTENT_STOPPED');await db.query('ROLLBACK');
 await seed();await db.query(before);await db.query(`INSERT INTO public.${name} VALUES(3,'extra');`);await assert.rejects(()=>db.query(after),e=>e.message==='RELEASE_ROW_CONTENT_STOPPED');await db.query('ROLLBACK');
 await seed();await db.query(before);await db.query(`DELETE FROM public.${name};INSERT INTO public.${name} VALUES(2,'b'),(1,'a'),(1,'a');`);await db.query(after);await db.query('ROLLBACK');
 await seed();await db.query(before);await db.query('DELETE FROM pg_temp.potok_release_rows_v1');await assert.rejects(()=>db.query(after),e=>e.message==='RELEASE_ROW_SCOPE_STOPPED');await db.query('ROLLBACK');
 assert.equal((await db.query('SELECT to_regclass($1) value',['public.'+name])).rows[0].value,null);assert.deepEqual(await snapshot(),untouched);
 console.log('TARGET_RELEASE_NATIVE_PROOF_OK: unconditional envelope stop; old-column preservation with nullable addition; same-count tamper, count and scope changes refused; row-order/duplicates preserved; all disposable changes rolled back.');
}finally{await db.query('ROLLBACK');await db.end();}
