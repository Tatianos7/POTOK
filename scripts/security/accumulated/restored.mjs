import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {readFile,mkdtemp,writeFile} from 'node:fs/promises';
import {spawnSync} from 'node:child_process';
import path from 'node:path';
import {pathToFileURL} from 'node:url';
import {inputs,loadInputs,combined} from './inputs.mjs';
import {permissionQuery} from './checks.mjs';
const hash=b=>createHash('sha256').update(b).digest('hex');
const literal=s=>"'"+String(s).replace(/'/g,"''")+"'";
export function parseCopyCounts(sql){
 const id='("(?:[^"]|"")*"|[A-Za-z_][A-Za-z0-9_$]*)',header=new RegExp('^COPY\\s+'+id+'\\.'+id+'\\s+\\(');
 const decode=s=>s.startsWith('"')?s.slice(1,-1).replace(/""/g,'"'):s;
 const tables=[];let current;
 for(const line of sql.split(/\r?\n/)){if(current){if(line==='\\.'){tables.push(current);current=null;}else current.rows++;}else{const m=line.match(header);if(m)current={schema:decode(m[1]),name:decode(m[2]),rows:0};}}
 assert(!current,'Incomplete COPY block');assert(tables.length>0&&tables.length<=1000);
 assert.equal(new Set(tables.map(t=>JSON.stringify([t.schema,t.name]))).size,tables.length,'Duplicate COPY table');return tables;
}
const metadata=`jsonb_build_object(
 'schemas',(SELECT jsonb_agg(to_jsonb(n) ORDER BY oid) FROM pg_namespace n WHERE nspname IN('auth','storage','public','extensions','potok_control','potok_nutrition')),
 'relations',(SELECT jsonb_agg(to_jsonb(c) ORDER BY c.oid) FROM pg_class c JOIN pg_namespace n ON n.oid=c.relnamespace WHERE n.nspname IN('auth','storage','public','extensions','potok_control','potok_nutrition')),
 'columns',(SELECT jsonb_agg(to_jsonb(a) ORDER BY a.attrelid,a.attnum) FROM pg_attribute a JOIN pg_class c ON c.oid=a.attrelid JOIN pg_namespace n ON n.oid=c.relnamespace WHERE n.nspname IN('auth','storage','public','extensions','potok_control','potok_nutrition')),
 'functions',(SELECT jsonb_agg(to_jsonb(p) ORDER BY p.oid) FROM pg_proc p JOIN pg_namespace n ON n.oid=p.pronamespace WHERE n.nspname IN('auth','storage','public','extensions','potok_control','potok_nutrition')),
 'defaults',(SELECT jsonb_agg(to_jsonb(d) ORDER BY oid) FROM pg_default_acl d),
 'policies',(SELECT jsonb_agg(to_jsonb(p) ORDER BY oid) FROM pg_policy p),
 'constraints',(SELECT jsonb_agg(to_jsonb(c) ORDER BY oid) FROM pg_constraint c WHERE connamespace IN(SELECT oid FROM pg_namespace WHERE nspname IN('auth','storage','public','potok_control','potok_nutrition'))),
 'triggers',(SELECT jsonb_agg(to_jsonb(t) ORDER BY t.oid) FROM pg_trigger t JOIN pg_class c ON c.oid=t.tgrelid JOIN pg_namespace n ON n.oid=c.relnamespace WHERE n.nspname IN('auth','storage','public','potok_control','potok_nutrition')),
 'event_triggers',(SELECT jsonb_agg(to_jsonb(t) ORDER BY oid) FROM pg_event_trigger t),
 'roles',(SELECT jsonb_agg(to_jsonb(r) ORDER BY oid) FROM pg_roles r),
 'memberships',(SELECT jsonb_agg(to_jsonb(m) ORDER BY roleid,member,grantor) FROM pg_auth_members m),
 'extension',(SELECT to_jsonb(e) FROM pg_extension e WHERE extname='pg_trgm'),
 'indexes',(SELECT jsonb_agg(jsonb_build_array(to_jsonb(i),pg_relation_filenode(i.indexrelid)) ORDER BY i.indexrelid) FROM pg_index i JOIN pg_class c ON c.oid=i.indrelid WHERE c.relnamespace='public'::regnamespace),
 'types',(SELECT jsonb_agg(to_jsonb(t) ORDER BY t.oid) FROM pg_type t JOIN pg_namespace n ON n.oid=t.typnamespace WHERE n.nspname IN('auth','storage','public','extensions','potok_control','potok_nutrition')))`;
const rowHash="encode(sha256(convert_to(to_jsonb(t)::text,'UTF8')),'hex')";
const digestQuery=`SELECT count(*),encode(sha256(convert_to(coalesce(string_agg(${rowHash},'' ORDER BY ${rowHash}),''),'UTF8')),'hex') FROM %I.%I t`;
function contentCheck(initial){return `DO $content$
DECLARE r record;n bigint;digest text;
BEGIN
 FOR r IN SELECT * FROM potok_eight_data ORDER BY schema_name,table_name LOOP
  EXECUTE format(${literal(digestQuery)},r.schema_name,r.table_name) INTO n,digest;
  IF n<>r.expected_rows THEN RAISE EXCEPTION 'Restored count mismatch: %.%',r.schema_name,r.table_name;END IF;
  ${initial?'UPDATE potok_eight_data SET content_hash=digest WHERE schema_name=r.schema_name AND table_name=r.table_name;':"IF digest IS DISTINCT FROM r.content_hash THEN RAISE EXCEPTION 'Restored content mismatch: %.%',r.schema_name,r.table_name;END IF;"}
 END LOOP;
END $content$;`;}

export function buildRehearsal(sources,tables){
 assert(tables.length>0&&tables.length<=1000);for(const t of tables){assert(['auth','public','storage'].includes(t.schema));assert(typeof t.name==='string'&&t.name.length>0);assert(Number.isSafeInteger(t.rows)&&t.rows>=0);}
 assert.equal(new Set(tables.map(t=>JSON.stringify([t.schema,t.name]))).size,tables.length);
 const sql=`-- Private restored Docker copy only. Candidate installation ALWAYS ROLLBACKs.
SET search_path=pg_catalog,pg_temp;
SET statement_timeout='120s';SET lock_timeout='3s';SET timezone='UTC';SET datestyle='ISO,YMD';
DO $actor$ BEGIN IF current_user<>'postgres' OR session_user<>'postgres'
 OR NOT EXISTS(SELECT FROM pg_roles WHERE rolname=current_user AND NOT rolsuper AND rolbypassrls)
 OR current_setting('server_version_num')::int NOT BETWEEN 170000 AND 179999
 OR current_setting('session_replication_role')<>'origin' THEN RAISE EXCEPTION 'Expected nonsuperuser PG17 postgres/BYPASSRLS owner channel and normal triggers';END IF;END $actor$;
CREATE TEMP TABLE potok_eight_data(schema_name text,table_name text,expected_rows bigint,content_hash text,PRIMARY KEY(schema_name,table_name));
INSERT INTO potok_eight_data(schema_name,table_name,expected_rows) VALUES ${tables.map(t=>`(${literal(t.schema)},${literal(t.name)},${t.rows})`).join(',')};
${contentCheck(true)}
CREATE TEMP TABLE potok_eight_state AS SELECT ${metadata} AS state;
BEGIN;
${combined(sources)}
DO $permissions$ DECLARE checks jsonb;BEGIN
 SELECT to_jsonb(q) INTO checks FROM (${permissionQuery()}) q;
 IF EXISTS(SELECT FROM jsonb_each(checks) e WHERE e.value IS DISTINCT FROM 'true'::jsonb) THEN RAISE EXCEPTION 'Combined final permissions failed';END IF;
 IF EXISTS(SELECT FROM potok_control.access_attestations) THEN RAISE EXCEPTION 'Rehearsal must not issue authority';END IF;
END $permissions$;
${contentCheck(false)}
DO $ok$ BEGIN RAISE NOTICE 'EIGHT_CHECKS_OK: empty authority and final rights verified; ROLLBACK follows';END $ok$;
ROLLBACK;
DO $restore$ BEGIN IF (${metadata}) IS DISTINCT FROM (SELECT state FROM potok_eight_state) OR current_setting('session_replication_role')<>'origin' THEN RAISE EXCEPTION 'Combined rollback metadata mismatch';END IF;END $restore$;
${contentCheck(false)}
DO $done$ BEGIN RAISE NOTICE 'EIGHT_ROLLBACK_OK: baseline content and metadata restored';END $done$;
DROP TABLE potok_eight_data,potok_eight_state;
`;
 assert.equal((sql.match(/^BEGIN;$/gm)??[]).length,1);assert.equal((sql.match(/^ROLLBACK;$/gm)??[]).length,1);assert(!/^COMMIT;$/m.test(sql));return sql;
}
async function backup(){
 const manifest=await readFile('SHA256SUMS.txt','utf8'),seen=new Set();
 for(const line of manifest.trim().split(/\r?\n/)){const m=line.match(/^([a-f0-9]{64})\s+\*?(roles\.sql|schema\.sql|data\.sql)$/);assert(m&&!seen.has(m[2]),'Unexpected backup manifest');seen.add(m[2]);assert.equal(hash(await readFile(m[2])),m[1],'Backup checksum mismatch');}
 assert.equal(seen.size,3);return manifest;
}
export async function main(){
 assert.deepEqual(process.argv.slice(2),['--run-restored-local'],'Explicit local rehearsal flag required');
 assert.equal(path.basename(process.cwd()),'POTOK_BACKUP_2026-10-24','Use the original restored backup folder');
 const localEndpoint=s=>typeof s==='string'&&(s.startsWith('unix:///')||/^npipe:\/{2,}\.\/pipe\//.test(s));
 assert(!process.env.DOCKER_HOST||localEndpoint(process.env.DOCKER_HOST),'Remote Docker endpoints are prohibited');
 const context=spawnSync('docker',['context','inspect','--format','{{json .Endpoints.docker.Host}}'],{encoding:'utf8',timeout:10000});assert.equal(context.status,0);assert(localEndpoint(JSON.parse(context.stdout)),'Use a local Docker engine');
 const manifest=await backup(),tables=parseCopyCounts(await readFile('data.sql','utf8'));
 assert.equal(tables.length,112);assert.equal(tables.reduce((n,t)=>n+t.rows,0),14888);const distribution=tables.reduce((a,t)=>(a[t.schema]=(a[t.schema]??0)+1,a),{});assert.deepEqual(distribution,{auth:26,public:81,storage:5});
 const name='supabase_db_POTOK_BACKUP_2026-10-24';
 const inspect=spawnSync('docker',['inspect','--type','container','--format','{"id":{{json .Id}},"name":{{json .Name}},"running":{{json .State.Running}},"health":{{json .State.Health.Status}},"image":{{json .Config.Image}}}',name],{encoding:'utf8',timeout:10000});assert.equal(inspect.status,0,'Restored container unavailable');
 const target=JSON.parse(inspect.stdout);assert.equal(target.name,'/'+name);assert(target.running&&target.health==='healthy');assert.match(target.id,/^[a-f0-9]{64}$/);assert.match(target.image,/(?:^|\/)supabase\/postgres:17\./);
 const sources=await loadInputs({remoteAll:true}),sql=buildRehearsal(sources,tables);
 const directory=await mkdtemp(path.join(process.cwd(),'eight-rehearsal-'));await writeFile(path.join(directory,'rehearsal.sql'),sql,{mode:0o600});
 await writeFile(path.join(directory,'public-inputs.json'),JSON.stringify(inputs,null,2),{mode:0o600});
 console.log('Backup hashes and pinned public inputs verified; local rollback rehearsal starting.');
 const result=spawnSync('docker',['exec','-i',target.id,'sh','-c','PGPASSWORD="$POSTGRES_PASSWORD" exec psql -X -w -h /run/postgresql -U postgres -d postgres --set ON_ERROR_STOP=1'],{input:sql,encoding:'utf8',timeout:300000,maxBuffer:8*1024*1024});
 if(result.stdout)process.stdout.write(result.stdout);if(result.stderr)process.stderr.write(result.stderr);
 assert.equal(result.status,0,'Rehearsal failed; no success claim');assert(result.stderr.includes('EIGHT_CHECKS_OK')&&result.stderr.includes('EIGHT_ROLLBACK_OK'),'Missing rollback proof');
 assert.equal(await backup(),manifest,'Backup manifest changed');console.log('EIGHT_RESTORED_REHEARSAL_OK: 112 tables / 14888 rows; database rollback verified. No release approval or full application acceptance.');
}
if(process.argv[1]&&import.meta.url===pathToFileURL(path.resolve(process.argv[1])).href)main().catch(e=>{console.error('Local rehearsal stopped: '+e.message);process.exitCode=1;});
