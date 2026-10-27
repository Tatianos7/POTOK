// Disposable native PG17 only. The generated evidence queries are READ ONLY; fixture writes stay local.
import assert from 'node:assert/strict';
import {pathToFileURL} from 'node:url';
import {contentSQL,compareContent} from './core.mjs';
const url=new URL(process.env.TEST_DATABASE_URL??'');assert.equal(url.hostname,'127.0.0.1');assert.equal(url.pathname,'/potok_release_review_test');
const {default:pg}=await import(pathToFileURL(process.env.SQL_TEST_PG_MODULE));const db=new pg.Client({connectionString:url.href});await db.connect();
const tables=[{schema:'public',name:'backup_fixture',columns:['id','note'],rows:'3'},{schema:'auth',name:'backup_fixture',columns:['id','payload'],rows:'1'},{schema:'public',name:'empty_fixture',columns:['note'],rows:'0'}];
const binding='c'.repeat(64);
async function capture(){const r=await db.query(contentSQL(tables,binding));const all=Array.isArray(r)?r:[r];const found=all.find(q=>q.rows?.[0]?.evidence);assert(found);return found.rows[0].evidence;}
try {
 await db.query('CREATE SCHEMA auth;CREATE TABLE public.backup_fixture(id integer,note text);CREATE TABLE auth.backup_fixture(id integer,payload jsonb);CREATE TABLE public.empty_fixture(note text);');
 const note='Пример\nс табом\tи \\ точкой \\.';
 for(const [id,text] of [[1,'same'],[1,'same'],[2,note]])await db.query('INSERT INTO public.backup_fixture VALUES($1,$2)',[id,text]);
 await db.query('INSERT INTO auth.backup_fixture VALUES($1,$2)',[1,JSON.stringify({synthetic:true,nullable:null,note})]);
 const original=await capture();
 await db.query('DELETE FROM public.backup_fixture');
 for(const [id,text] of [[2,note],[1,'same'],[1,'same']])await db.query('INSERT INTO public.backup_fixture VALUES($1,$2)',[id,text]);
 const reordered=await capture();assert.equal(compareContent(tables,original,reordered,binding).status,'LOGICAL_SCOPE_CONTENT_MATCH_AT_OBSERVATIONS');
 assert(!JSON.stringify(original).includes(note));assert(!JSON.stringify(original).includes('same'));
 await db.query('UPDATE public.backup_fixture SET note=$1 WHERE id=2',['same count, changed content']);
 assert.equal(compareContent(tables,original,await capture(),binding).status,'CONTENT_MISMATCH_STOP');
 await db.query('UPDATE public.backup_fixture SET note=$1 WHERE id=2',[note]);
 await db.query('ALTER TABLE public.empty_fixture ALTER COLUMN note TYPE varchar');
 assert.equal(compareContent(tables,original,await capture(),binding).status,'CONTENT_MISMATCH_STOP');
 await db.query('ALTER TABLE public.empty_fixture ALTER COLUMN note TYPE text;CREATE TABLE public.unreviewed_fixture(id integer)');
 // Capture sees new tables in the same read snapshot, even though projected row counts still match.
 const extra=await capture();assert.throws(()=>compareContent(tables,original,extra,binding));
 console.log('BACKUP_COMPARISON_NATIVE_OK: typed JSON/Unicode/nulls/duplicates; order-independent match; same-count tamper, empty-table type drift and extra-table scope stop; no source records returned');
} finally {await db.query('ROLLBACK');await db.end();}
