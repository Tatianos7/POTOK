// Disposable loopback PG17 only. No hosted endpoint or production credentials.
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {pathToFileURL} from 'node:url';
const url=new URL(process.env.TEST_DATABASE_URL??'');
assert.equal(url.hostname,'127.0.0.1');assert.equal(url.pathname,'/potok_release_review_test');
const {default:pg}=await import(pathToFileURL(process.env.SQL_TEST_PG_MODULE));
const db=new pg.Client({connectionString:url.href});await db.connect();
const snapshot=async()=>JSON.stringify((await db.query(`SELECT jsonb_build_object(
'relations',(SELECT jsonb_agg(to_jsonb(c) ORDER BY c.oid) FROM pg_class c WHERE c.relnamespace='public'::regnamespace),
'defaults',(SELECT jsonb_agg(to_jsonb(d) ORDER BY d.oid) FROM pg_default_acl d),
'roles',(SELECT jsonb_agg(to_jsonb(r) ORDER BY r.oid) FROM pg_roles r)) AS evidence`)).rows[0].evidence);
try {
 await db.query('CREATE ROLE anon; CREATE ROLE authenticated; CREATE ROLE service_role;');
 const before=await snapshot(),sql=await readFile(new URL('restore-rights-review.sql',import.meta.url),'utf8');
 const results=await db.query(sql),all=Array.isArray(results)?results:[results];
 const evidence=all.find(r=>r.rows?.[0]?.evidence)?.rows[0].evidence;assert(evidence);
 assert.equal(evidence.protocol,'potok-restored-rights-review-v1');
 // An arbitrary synthetic database must never match the dated real target reference.
 assert.equal(evidence.reviewedTableRightsMatch,false);assert.equal(evidence.reviewedDefaultsMatch,false);
 assert.equal(evidence.releaseReady,false);assert.equal(evidence.mayApply,false);
 assert.equal(await snapshot(),before);
 console.log('RESTORE_RIGHTS_NATIVE_OK: dated target reference rejects synthetic permissions; catalog/roles/defaults unchanged; no release approval');
} finally {await db.query('ROLLBACK');await db.end();}
