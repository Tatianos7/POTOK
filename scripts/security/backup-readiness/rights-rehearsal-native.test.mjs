// All writes are confined to a new disposable loopback PG17 fixture database.
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {pathToFileURL} from 'node:url';
import {captureSQL,buildRehearsal} from './rights-rehearsal.mjs';
const url=new URL(process.env.TEST_DATABASE_URL??'');assert.equal(url.hostname,'127.0.0.1');assert.equal(url.pathname,'/potok_release_review_test');
const {default:pg}=await import(pathToFileURL(process.env.SQL_TEST_PG_MODULE));
const root=new pg.Client({connectionString:url.href});await root.connect();
const names=JSON.parse(await readFile(new URL('inventory-20261027.json',import.meta.url))).tables.filter(t=>t.schema==='public').map(t=>t.name).sort();
const quote=s=>'"'+s.replace(/"/g,'""')+'"';
let db;
async function capture(client){const result=await client.query(captureSQL);return result.find(r=>r.rows?.[0]?.evidence).rows[0].evidence;}
try {
 for(const name of ['anon','authenticated','service_role'])if(!(await root.query('SELECT 1 FROM pg_roles WHERE rolname=$1',[name])).rowCount)await root.query('CREATE ROLE '+quote(name));
 const role=(await root.query("SELECT rolsuper FROM pg_roles WHERE rolname='postgres'")).rows[0];
 if(role)assert.equal(role.rolsuper,false);else await root.query('CREATE ROLE postgres NOSUPERUSER NOBYPASSRLS');
 await root.query('CREATE DATABASE potok_rights_rehearsal_test');
 const fixtureURL=new URL(url);fixtureURL.pathname='/potok_rights_rehearsal_test';
 db=new pg.Client({connectionString:fixtureURL.href});await db.connect();
 await db.query('ALTER SCHEMA public OWNER TO postgres;SET ROLE postgres;');
 for(const n of names)await db.query('CREATE TABLE public.'+quote(n)+'(id integer);ALTER TABLE public.'+quote(n)+' ENABLE ROW LEVEL SECURITY;');
 await db.query('GRANT ALL ON ALL TABLES IN SCHEMA public TO anon,authenticated,service_role;REVOKE TRUNCATE ON ALL TABLES IN SCHEMA public FROM anon,authenticated;');
 const first=await capture(db),changes=first.rights.filter(r=>r.role!=='service_role'&&r.privilege!=='TRUNCATE').slice(0,213);
 for(const r of changes)await db.query('REVOKE '+r.privilege+' ON public.'+quote(r.table_name)+' FROM '+quote(r.role));
 const target=await capture(db);
 for(const r of changes)await db.query('GRANT '+r.privilege+' ON public.'+quote(r.table_name)+' TO '+quote(r.role));
 const local=await capture(db),plan=buildRehearsal(local,target,names);
 const notices=[];db.on('notice',n=>notices.push(n.message));await db.query(plan.sql);
 assert(notices.some(s=>s.startsWith('LOCAL_RIGHTS_PARITY_TEMPORARY_OK')));assert(notices.some(s=>s.startsWith('LOCAL_RIGHTS_PARITY_ROLLBACK_OK')));
 const after=await capture(db);assert.equal(after.aclSha256,local.aclSha256);assert.deepEqual(after.rights,local.rights);
 // A late error on a separate connection must also roll back on connection close.
 const failure=new pg.Client({connectionString:fixtureURL.href});await failure.connect();await failure.query('SET ROLE postgres');
 const where=plan.sql.indexOf('\nDO $check$',plan.sql.indexOf('\nREVOKE '));assert(where>0);
 await assert.rejects(()=>failure.query(plan.sql.slice(0,where)+'\nSELECT 1/0;\n'+plan.sql.slice(where)),e=>e.code==='22012');
 await failure.end();const recovered=await capture(db);assert.equal(recovered.aclSha256,local.aclSha256);assert.deepEqual(recovered.rights,local.rights);
 // A grant changed after capture is stopped before the first planned revoke.
 const protectedRight=local.rights.find(r=>r.role==='service_role'&&r.privilege==='SELECT');
 await db.query('REVOKE SELECT ON public.'+quote(protectedRight.table_name)+' FROM service_role');
 await assert.rejects(()=>db.query(plan.sql),e=>e.message==='BASELINE_DRIFT_STOP');await db.query('ROLLBACK');
 console.log('RIGHTS_PARITY_NATIVE_OK: 213 temporary revokes; exact selected matrix; successful and late-error rollback restore ACL; drift stops before revokes. Synthetic only, no application acceptance.');
} finally {if(db){await db.query('ROLLBACK');await db.end();}await root.end();}
