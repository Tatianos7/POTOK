import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {readFile,writeFile,mkdtemp} from 'node:fs/promises';
import {spawnSync} from 'node:child_process';
import path from 'node:path';
import {pathToFileURL} from 'node:url';
export const SOURCES = [
  {
    "key": "truncate",
    "ref": "c175e74d7a7c1077e4e8d6d4d8f67c960b06d677",
    "path": "supabase/migration_drafts/client_truncate_containment_v1.sql",
    "sha256": "007b8a1545824fbc724ce313b3be7258fc7e26fb3e6894c9b7e95bd578b120ec"
  },
  {
    "key": "profile",
    "ref": "7f4f7e24fec497a22dea29dd14f4546115439129",
    "path": "supabase/migration_drafts/profile_column_write_containment_v1.sql",
    "sha256": "b781e7754732d12359cfff990ca855f75115695c283b08f9f221f785f5d529ea"
  },
  {
    "key": "rpc",
    "ref": "47e2ff8bd4937469576f8cfaceecaaefca33548e",
    "path": "supabase/migration_drafts/anonymous_rpc_execute_containment_v1.sql",
    "sha256": "a86d36788d3df576e6eaeeea45ed824e57a363409f213317a52d0cbccc9d3368"
  },
  {
    "key": "trgm",
    "ref": "a1b91d8bfbfba8135478803605512e1014dbafcc",
    "path": "scripts/security/pg-trgm/rehearsal.sql",
    "sha256": "a22d809784f341030029be46fe3975c3842813b41eb57414ee17ab6d9e1a52d7"
  }
];
export const sha256 = value => createHash('sha256').update(value).digest('hex');
const literal = value => "'"+String(value).replace(/'/g,"''")+"'";
export function parseCopyCounts(sql) {
  const identifier='("(?:[^"]|"")*"|[A-Za-z_][A-Za-z0-9_$]*)';
  const header=new RegExp('^COPY\\s+'+identifier+'\\.'+identifier+'\\s+\\(');
  const decode=s=>s.startsWith('"')?s.slice(1,-1).replace(/""/g,'"'):s;
  const tables=[];let current=null;
  for(const line of sql.split(/\r?\n/)) {
    if(current){if(line==='\\.'){tables.push(current);current=null;}else current.rows++;}
    else {const m=line.match(header);if(m)current={schema:decode(m[1]),table:decode(m[2]),rows:0};}
  }
  assert(!current,'Incomplete COPY block');assert(tables.length>0,'No COPY tables');
  assert.equal(new Set(tables.map(t=>JSON.stringify([t.schema,t.table]))).size,tables.length,'Duplicate table');
  return tables;
}
export async function downloadSources() {
  const out={};
  for(const s of SOURCES){
    const url=`https://raw.githubusercontent.com/Tatianos7/POTOK/${s.ref}/${s.path}`;
    const r=await fetch(url,{redirect:'error',signal:AbortSignal.timeout(30000)});
    assert(r.ok,'Pinned source download failed: '+s.key);
    const b=Buffer.from(await r.arrayBuffer());assert.equal(sha256(b),s.sha256,'Pinned source checksum failed: '+s.key);
    out[s.key]=b.toString('utf8');
  }
  return out;
}
export function transactionBody(sql,end) {
  assert.equal((sql.match(/^BEGIN;$/gm)||[]).length,1,'Expected one outer BEGIN');
  assert.equal((sql.match(/^(?:COMMIT|ROLLBACK);$/gm)||[]).length,1,'Expected one outer terminator');
  assert(new RegExp('^'+end+';\\s*$','m').test(sql),'Unexpected outer terminator');
  assert(!/^\s*\\/m.test(sql),'psql metacommands are not accepted');
  return sql.replace(/^BEGIN;\n/m,'').replace(new RegExp('^'+end+';\\s*$','m'),'');
}
function verifier(sql){const blocks=sql.match(/DO \$verify\$[\s\S]*?\$verify\$;/g);assert.equal(blocks?.length,1);return blocks[0];}
const snapshot=`jsonb_build_object(
 'relations',(SELECT coalesce(jsonb_agg(jsonb_build_array(c.oid,c.relnamespace,c.relname,c.relowner,c.relacl::text,c.relrowsecurity,c.relforcerowsecurity) ORDER BY c.oid),'[]') FROM pg_class c JOIN pg_namespace n ON n.oid=c.relnamespace WHERE n.nspname IN ('public','extensions')),
 'columns',(SELECT coalesce(jsonb_agg(jsonb_build_array(a.attrelid,a.attnum,a.attname,a.atttypid,a.attacl::text) ORDER BY a.attrelid,a.attnum),'[]') FROM pg_attribute a JOIN pg_class c ON c.oid=a.attrelid JOIN pg_namespace n ON n.oid=c.relnamespace WHERE n.nspname IN ('public','extensions') AND a.attnum>0),
 'routines',(SELECT coalesce(jsonb_agg(to_jsonb(p) ORDER BY p.oid),'[]') FROM pg_proc p JOIN pg_namespace n ON n.oid=p.pronamespace WHERE n.nspname IN ('public','extensions')),
 'types',(SELECT coalesce(jsonb_agg(jsonb_build_array(t.oid,t.typnamespace,t.typname,t.typowner,t.typacl::text) ORDER BY t.oid),'[]') FROM pg_type t JOIN pg_namespace n ON n.oid=t.typnamespace WHERE n.nspname IN ('public','extensions')),
 'defaults',(SELECT coalesce(jsonb_agg(to_jsonb(d) ORDER BY d.oid),'[]') FROM pg_default_acl d),
 'constraints',(SELECT coalesce(jsonb_agg(to_jsonb(k) ORDER BY k.oid),'[]') FROM pg_constraint k WHERE k.connamespace='public'::regnamespace),
 'triggers',(SELECT coalesce(jsonb_agg(to_jsonb(t) ORDER BY t.oid),'[]') FROM pg_trigger t JOIN pg_class c ON c.oid=t.tgrelid WHERE c.relnamespace='public'::regnamespace),
 'policies',(SELECT coalesce(jsonb_agg(to_jsonb(p) ORDER BY p.oid),'[]') FROM pg_policy p JOIN pg_class c ON c.oid=p.polrelid WHERE c.relnamespace='public'::regnamespace),
 'schemas',(SELECT coalesce(jsonb_agg(jsonb_build_array(n.oid,n.nspowner,n.nspacl::text) ORDER BY n.oid),'[]') FROM pg_namespace n WHERE n.nspname IN ('public','extensions')),
 'extension',(SELECT to_jsonb(e) FROM pg_extension e WHERE e.extname='pg_trgm'),
 'members',(SELECT coalesce(jsonb_agg(jsonb_build_array(d.classid,d.objid,d.objsubid) ORDER BY d.classid,d.objid,d.objsubid),'[]') FROM pg_depend d WHERE d.deptype='e' AND d.refobjid=(SELECT oid FROM pg_extension WHERE extname='pg_trgm')),
 'indexes',(SELECT coalesce(jsonb_agg(jsonb_build_array(i.indexrelid,i.indrelid,i.indclass::text,i.indisvalid,i.indisready,pg_relation_filenode(i.indexrelid)) ORDER BY i.indexrelid),'[]') FROM pg_index i JOIN pg_class c ON c.oid=i.indrelid WHERE c.relnamespace='public'::regnamespace))`;
const rowHash="encode(sha256(convert_to(to_jsonb(t)::text,'UTF8')),'hex')";
const hashQuery=`SELECT count(*),encode(sha256(convert_to(coalesce(string_agg(${rowHash},'' ORDER BY ${rowHash}),''),'UTF8')),'hex') FROM %I.%I t`;
function dataCheck(initialize){return `DO $joint_data$
DECLARE r record; n bigint; digest text; checked integer:=0; total bigint:=0;
BEGIN
 FOR r IN SELECT * FROM potok_joint_data ORDER BY schema_name,table_name LOOP
  EXECUTE format(${literal(hashQuery)},r.schema_name,r.table_name) INTO n,digest;
  IF n <> r.expected_rows THEN RAISE EXCEPTION 'Joint row count mismatch: %.%',r.schema_name,r.table_name; END IF;
  ${initialize?`UPDATE potok_joint_data SET content_hash=digest WHERE schema_name=r.schema_name AND table_name=r.table_name;`:`IF digest IS DISTINCT FROM r.content_hash THEN RAISE EXCEPTION 'Joint content mismatch: %.%',r.schema_name,r.table_name; END IF;`}
  checked:=checked+1;total:=total+n;
 END LOOP;
 RAISE NOTICE 'JOINT_DATA_OK: tables=%, rows=%',checked,total;
END $joint_data$;`;}
export function buildRehearsal(sources,tables) {
  for(const s of SOURCES)assert.equal(sha256(sources[s.key]),s.sha256,'Source changed: '+s.key);
  assert(tables.length>0 && tables.length<=1000);
  for(const t of tables){assert(['auth','public','storage'].includes(t.schema));assert(Number.isSafeInteger(t.rows)&&t.rows>=0);}
  const bodies=SOURCES.map(s=>transactionBody(sources[s.key],s.key==='trgm'?'ROLLBACK':'COMMIT'));
  const values=tables.map(t=>`(${literal(t.schema)},${literal(t.table)},${t.rows})`).join(',\n');
  const sql=`-- Local restored copy only. All permanent candidate changes are rolled back.
SET search_path=pg_catalog,pg_temp;
SET statement_timeout='60s';
SET lock_timeout='5s';
SET timezone='UTC';
SET datestyle='ISO,YMD';
DO $joint_actor$ BEGIN
 IF current_user<>'postgres' OR (SELECT rolsuper FROM pg_roles WHERE rolname=current_user)
 OR current_setting('server_version_num')::integer NOT BETWEEN 170000 AND 179999
 OR current_setting('session_replication_role')<>'origin' THEN RAISE EXCEPTION 'Expected non-superuser postgres on PostgreSQL 17 with normal triggers'; END IF;
END $joint_actor$;
CREATE TEMP TABLE potok_joint_state AS SELECT ${snapshot} AS state;
CREATE TEMP TABLE potok_joint_data(schema_name text,table_name text,expected_rows bigint,content_hash text,PRIMARY KEY(schema_name,table_name));
INSERT INTO potok_joint_data(schema_name,table_name,expected_rows) VALUES ${values};
${dataCheck(true)}
BEGIN;
${bodies.join('\n')}
-- Recheck all permission postconditions after the last candidate, together.
${['truncate','profile','rpc'].map(k=>verifier(sources[k])).join('\n')}
${dataCheck(false)}
DO $joint_ok$ BEGIN RAISE NOTICE 'JOINT_CHECKS_OK: four candidates coexist; ROLLBACK follows'; END $joint_ok$;
ROLLBACK;
DO $joint_restore$ BEGIN
 IF (${snapshot}) IS DISTINCT FROM (SELECT state FROM potok_joint_state) THEN RAISE EXCEPTION 'Joint rollback metadata mismatch'; END IF;
 IF current_setting('session_replication_role')<>'origin' THEN RAISE EXCEPTION 'Normal trigger state changed'; END IF;
END $joint_restore$;
${dataCheck(false)}
DO $joint_end$ BEGIN RAISE NOTICE 'JOINT_ROLLBACK_OK: baseline metadata and table contents restored'; END $joint_end$;
DROP TABLE potok_joint_state,potok_joint_data;
`;
  assert.equal((sql.match(/^BEGIN;$/gm)||[]).length,1);
  assert.equal((sql.match(/^ROLLBACK;$/gm)||[]).length,1);
  assert(!/^COMMIT;/m.test(sql));return sql;
}
async function checkBackupFiles(){
 const names=['roles.sql','schema.sql','data.sql'];
 const manifest=await readFile('SHA256SUMS.txt','utf8');const seen=new Set();
 for(const line of manifest.trim().split(/\r?\n/)){
  const m=line.match(/^([a-f0-9]{64})\s+\*?(roles\.sql|schema\.sql|data\.sql)$/);
  assert(m && !seen.has(m[2]),'Unexpected backup checksum manifest');seen.add(m[2]);
  assert.equal(sha256(await readFile(m[2])),m[1],'Backup checksum mismatch: '+m[2]);
 }
 assert.equal(seen.size,names.length);return manifest;
}
export async function main(){
 assert.deepEqual(process.argv.slice(2),['--run-restored-local'],'Use explicit local rehearsal flag');
 assert.equal(path.basename(process.cwd()),'POTOK_BACKUP_2026-10-24','Run from the restored backup folder');
 const manifest=await checkBackupFiles();console.log('BACKUP_FILES_OK');
 const tables=parseCopyCounts(await readFile('data.sql','utf8'));
 assert.equal(tables.length,112);assert.equal(tables.reduce((n,t)=>n+t.rows,0),14888);
 const distribution=tables.reduce((a,t)=>(a[t.schema]=(a[t.schema]||0)+1,a),{});
 assert.deepEqual(distribution,{auth:26,public:81,storage:5});
 const name='supabase_db_POTOK_BACKUP_2026-10-24';
 const format='{"id":{{json .Id}},"running":{{json .State.Running}},"health":{{json .State.Health.Status}},"image":{{json .Config.Image}},"name":{{json .Name}}}';
 const inspect=spawnSync('docker',['inspect','--type','container','--format',format,name],{encoding:'utf8',timeout:10000});
 assert.equal(inspect.status,0,'Restored Docker container is unavailable');
 const target=JSON.parse(inspect.stdout);assert.equal(target.name,'/'+name);assert(target.running&&target.health==='healthy');
 assert.match(target.id,/^[a-f0-9]{64}$/);assert.match(target.image,/(?:^|\/)supabase\/postgres:17\./);
 const sources=await downloadSources();const sql=buildRehearsal(sources,tables);
 const directory=await mkdtemp(path.join(process.cwd(),'joint-rehearsal-'));
 for(const s of SOURCES)await writeFile(path.join(directory,s.key+'.sql'),sources[s.key],{mode:0o600});
 await writeFile(path.join(directory,'joint-rehearsal.sql'),sql,{mode:0o600});
 console.log('Pinned inputs verified; testing the restored local container as postgres.');
 const result=spawnSync('docker',['exec','-i',target.id,'sh','-c','PGPASSWORD="$POSTGRES_PASSWORD" exec psql -X -w -h /run/postgresql -U postgres -d postgres --set ON_ERROR_STOP=1'],{input:sql,encoding:'utf8',timeout:240000,maxBuffer:8*1024*1024});
 if(result.stdout)process.stdout.write(result.stdout);if(result.stderr)process.stderr.write(result.stderr);
 assert.equal(result.status,0,'Joint rehearsal stopped; no success claim. Review the reported SQL error.');
 assert((result.stderr||'').includes('JOINT_CHECKS_OK')&&(result.stderr||'').includes('JOINT_ROLLBACK_OK'),'Missing rehearsal proof');
 assert.equal(await checkBackupFiles(),manifest,'Backup manifest changed');
 console.log('JOINT_REHEARSAL_OK: 112 tables / 14888 rows; content and rollback verified.');
 console.log('Production and Staging were not contacted. Restored baseline permissions remain in place.');
}
if(process.argv[1] && pathToFileURL(path.resolve(process.argv[1])).href===import.meta.url){
 main().catch(error=>{console.error('Joint rehearsal stopped:',error.message);process.exitCode=1;});
}
