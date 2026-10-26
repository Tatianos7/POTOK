import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {readFile,mkdtemp,writeFile} from 'node:fs/promises';
import {spawnSync} from 'node:child_process';
import path from 'node:path';
import {pathToFileURL} from 'node:url';
import {inputs,loadInputs,combined} from './inputs.mjs';
import {permissionQuery} from './checks.mjs';
import {parseCopyCounts} from './restored.mjs';
import {followupInputs,loadFollowups,followupFinalSQL} from './restored-twelve.mjs';

// This is a separate, one-shot PRIVATE CLONE installer. The portable rollback
// runners are unchanged. There is intentionally no arbitrary target/URL flag.
export const candidateName='potok_security_candidate_2026-10-26';
export const originalName='supabase_db_POTOK_BACKUP_2026-10-24';
const imageName='public.ecr.aws/supabase/postgres:17.6.1.063';
const sha=b=>createHash('sha256').update(b).digest('hex');
const lit=s=>"'"+s.replace(/'/g,"''")+"'";
const ident=s=>'"'+s.replace(/"/g,'""')+'"';
const dependencyHashes={
 'restored.mjs':'8b7936a4fbaed205fbdae20184e22ffa7c22a168ec25ff187524ee04cd752f42',
 'inputs.mjs':'16c171d0f2d94ca6d85307ca3a446e4a0c4db708f66fb3d76c05958ad396c2e2',
 'checks.mjs':'19680d53a99060839188854cc49ec5b72003a71bd1e71b06a0919aaba44bc4ee',
 'restored-twelve.mjs':'8d73465bb8f4d0a6e73e6c8f1dbc3f2bca2ee7e821b0504e34cdce4a5cf9c3a9',
};
const boundaryHash='352d9b400e65c4632e939188bc195564e4200a00050880b870430123eb82fd5f';
export const settingsSQL=`SET search_path=pg_catalog,pg_temp;SET timezone='UTC';SET datestyle='ISO,YMD';SET statement_timeout='120s';SET lock_timeout='3s';`;
export const actorSQL=`DO $actor$ BEGIN
 IF current_user<>'postgres' OR session_user<>'postgres'
 OR NOT EXISTS(SELECT FROM pg_roles WHERE rolname=current_user AND NOT rolsuper AND rolbypassrls)
 OR current_setting('server_version_num')::int NOT BETWEEN 170000 AND 179999
 OR current_setting('session_replication_role')<>'origin'
 THEN RAISE EXCEPTION 'Expected PG17 nonsuperuser postgres/BYPASSRLS and normal triggers';END IF;
 END $actor$;`;
function validateTables(tables){
 assert(tables.length>0&&tables.length<=1000);
 for(const t of tables){assert(['auth','public','storage'].includes(t.schema));assert(typeof t.name==='string'&&t.name.length>0);assert(Number.isSafeInteger(t.rows)&&t.rows>=0);}
 assert.equal(new Set(tables.map(t=>JSON.stringify([t.schema,t.name]))).size,tables.length);
}
export function fingerprintSQL(tables){
 validateTables(tables);
 return `SELECT jsonb_agg(to_jsonb(q) ORDER BY schema,name) AS fingerprint FROM (${tables.map(t=>{
  const row=t.schema==='public'&&t.name==='program_sessions'?"(to_jsonb(t)-'execution_reason')":'to_jsonb(t)';
  const h=`encode(sha256(convert_to(${row}::text,'UTF8')),'hex')`;
  return `SELECT ${lit(t.schema)}::text AS schema,${lit(t.name)}::text AS name,count(*)::bigint AS rows,encode(sha256(convert_to(coalesce(string_agg(${h},'' ORDER BY ${h}),''),'UTF8')),'hex') AS hash FROM ${ident(t.schema)}.${ident(t.name)} t`;
 }).join('\nUNION ALL\n')}) q`;
}
function fingerprintCheck(tables,fingerprint){
 assert.equal(fingerprint.length,tables.length);
 for(const t of tables){const f=fingerprint.find(f=>f.schema===t.schema&&f.name===t.name);assert(f&&Number(f.rows)===t.rows&&/^[a-f0-9]{64}$/.test(f.hash),'Invalid baseline fingerprint');}
 return `DO $content$ DECLARE actual jsonb;BEGIN
 SELECT fingerprint INTO actual FROM (${fingerprintSQL(tables)}) q;
 IF actual IS DISTINCT FROM ${lit(JSON.stringify(fingerprint))}::jsonb THEN RAISE EXCEPTION 'Private candidate content changed';END IF;
 END $content$;`;
}
export function boundaryQuery(sql){
 assert.equal(sha(sql),boundaryHash,'Boundary checker changed');
 return sql.replace(/^BEGIN READ ONLY;$/m,'').replace(/^ROLLBACK;$/m,'');
}
export function finalSQL(tables,fingerprint,boundary){return `${actorSQL}
DO $final_permissions$ DECLARE checks jsonb;BEGIN
 SELECT to_jsonb(q) INTO checks FROM (${permissionQuery()}) q;
 IF EXISTS(SELECT FROM jsonb_each(checks) e WHERE e.value IS DISTINCT FROM 'true'::jsonb)
 THEN RAISE EXCEPTION 'Private candidate permissions failed';END IF;
 IF EXISTS(SELECT FROM potok_control.access_attestations) THEN RAISE EXCEPTION 'Authority must stay empty';END IF;
 IF EXISTS(SELECT FROM public.program_sessions WHERE execution_reason IS NOT NULL)
 OR (SELECT md5(prosrc)<>'31b744a14d51ce1c5016ea442aa9edd9' OR prosecdef OR proconfig IS DISTINCT FROM ARRAY['search_path=""'] FROM pg_proc WHERE oid='public.get_paywall_state(text,uuid)'::regprocedure)
 THEN RAISE EXCEPTION 'Unexpected annotation or paywall source';END IF;
 END $final_permissions$;
${followupFinalSQL}
DO $boundary$ DECLARE verdict text;BEGIN
 SELECT q.verdict INTO verdict FROM (${boundary}) q;
 IF verdict IS DISTINCT FROM 'SQL_BOUNDARY_VERIFIED' THEN RAISE EXCEPTION 'Private candidate SQL boundary needs review';END IF;
 END $boundary$;
${fingerprintCheck(tables,fingerprint)}`;}
export function buildInstall(sources,followups,tables,fingerprint,boundary){
 validateTables(tables);assert.deepEqual(Object.keys(sources),inputs.map(i=>i.key));assert.deepEqual(Object.keys(followups),followupInputs.map(i=>i.key));
 const locks=tables.map(t=>`LOCK TABLE ${ident(t.schema)}.${ident(t.name)} IN ${t.schema==='public'?'SHARE ROW EXCLUSIVE':'ACCESS SHARE'} MODE;`).join('\n');
 const sql=`${settingsSQL}\nBEGIN;\n${actorSQL}\n${locks}
 DO $fresh$ BEGIN IF to_regnamespace('potok_control') IS NOT NULL OR to_regnamespace('potok_nutrition') IS NOT NULL OR to_regnamespace('potok_delivery') IS NOT NULL
 OR EXISTS(SELECT FROM pg_attribute WHERE attrelid='public.program_sessions'::regclass AND attname='execution_reason' AND NOT attisdropped)
 THEN RAISE EXCEPTION 'Private candidate is not fresh; do not repeat installation';END IF;END $fresh$;
 ${fingerprintCheck(tables,fingerprint)}
 ${combined(sources)}
 ${followupInputs.map(i=>followups[i.key]).join('\n')}
 ${finalSQL(tables,fingerprint,boundary)}
 COMMIT;
 `;
 assert.equal((sql.match(/^BEGIN;$/gm)??[]).length,1);assert.equal((sql.match(/^\s*COMMIT;$/gm)??[]).length,1);assert(!/^\s*ROLLBACK;$/m.test(sql));assert(!/^\s*\\/m.test(sql));return sql;
}
export function validateTarget(target,original,volume){
 assert.equal(target.Name,'/'+candidateName);assert.equal(original.Name,'/'+originalName);
 for(const c of [target,original]){assert.match(c.Id,/^[a-f0-9]{64}$/);assert(c.State.Running&&c.State.Health?.Status==='healthy');assert.equal(c.Config.Image,imageName);}
 assert.notEqual(target.Id,original.Id);assert.match(target.Image,/^sha256:[a-f0-9]{64}$/);assert.equal(target.Image,original.Image);
 assert.equal(target.HostConfig.NetworkMode,'none');assert.deepEqual(target.HostConfig.PortBindings??{},{});assert(Object.values(target.NetworkSettings.Ports??{}).every(bindings=>bindings===null),'Published ports are prohibited');
 assert.equal(target.HostConfig.Privileged,false);assert.equal(target.HostConfig.PidMode,'');assert.equal(target.HostConfig.IpcMode,'private');
 assert.equal(target.Config.User,'postgres');assert.equal(target.Config.Entrypoint?.[0],'postgres');
 assert.deepEqual(target.Mounts.map(m=>[m.Type,m.Name,m.Destination,m.RW]),[['volume',candidateName,'/var/lib/postgresql/data',true]]);
 assert(original.Mounts.some(m=>m.Type==='volume'&&m.Name===originalName&&m.Destination==='/var/lib/postgresql/data'));
 assert.equal(volume.Name,candidateName);assert.equal(volume.Driver,'local');assert.deepEqual(volume.Options??{},{});assert.equal(volume.Labels?.['potok.purpose'],'security-test-copy');
 return target.Id;
}
const localEndpoint=s=>typeof s==='string'&&(s.startsWith('unix:///')||/^npipe:\/{2,}\.\/pipe\//.test(s));
function docker(args,input){const r=spawnSync('docker',args,{input,encoding:'utf8',timeout:300000,maxBuffer:16*1024*1024});assert.equal(r.status,0,'Local Docker/SQL operation failed; inspect the private log, do not retry installation');return r.stdout;}
function jsonDocker(args){return JSON.parse(docker(args));}
async function backup(){
 const manifest=await readFile('SHA256SUMS.txt','utf8'),seen=new Set();
 for(const line of manifest.trim().split(/\r?\n/)){const m=line.match(/^([a-f0-9]{64})\s+\*?(roles\.sql|schema\.sql|data\.sql)$/);assert(m&&!seen.has(m[2]),'Unexpected backup manifest');seen.add(m[2]);assert.equal(sha(await readFile(m[2])),m[1],'Backup checksum mismatch');}
 assert.equal(seen.size,3);return manifest;
}
export async function main(){
 assert.deepEqual(process.argv.slice(2),['--install-private-candidate'],'Explicit PRIVATE candidate install flag required');
 assert.equal(path.basename(process.cwd()),'POTOK_BACKUP_2026-10-24');
 assert(!process.env.DOCKER_HOST||localEndpoint(process.env.DOCKER_HOST),'Remote Docker is prohibited');
 assert(localEndpoint(jsonDocker(['context','inspect','--format','{{json .Endpoints.docker.Host}}'])),'Use a local Docker engine');
 for(const [file,hash] of Object.entries(dependencyHashes))assert.equal(sha(await readFile(new URL(file,import.meta.url))),hash,'Runner dependency changed: '+file);
 const boundaryBytes=await readFile(new URL('platform-boundary.sql',import.meta.url));const boundary=boundaryQuery(boundaryBytes.toString('utf8')).trim().replace(/;$/,'');
 const manifest=await backup(),tables=parseCopyCounts(await readFile('data.sql','utf8'));
 assert.equal(tables.length,112);assert.equal(tables.reduce((n,t)=>n+t.rows,0),14888);assert.deepEqual(tables.reduce((a,t)=>(a[t.schema]=(a[t.schema]??0)+1,a),{}),{auth:26,public:81,storage:5});
 const inspect=()=>{const target=jsonDocker(['inspect','--type','container',candidateName])[0],original=jsonDocker(['inspect','--type','container',originalName])[0],volume=jsonDocker(['volume','inspect',candidateName])[0];return validateTarget(target,original,volume);};
 const id=inspect();
 const attached=docker(['ps','-aq','--no-trunc','--filter','volume='+candidateName]).trim().split(/\r?\n/);assert.deepEqual(attached,[id],'Copied volume is attached elsewhere');
 const directory=await mkdtemp(path.join(process.cwd(),'private-candidate-install-'));console.log('Private local evidence folder: '+directory);
 let operation=0;
 async function sql(query,{json=false}={}){
  const r=spawnSync('docker',['exec','-i',id,'sh','-c','PGPASSWORD="$POSTGRES_PASSWORD" exec psql -X -w -h /tmp -p 5432 -U postgres -d postgres --set ON_ERROR_STOP=1 --quiet --tuples-only --no-align'],{input:query,encoding:'utf8',timeout:300000,maxBuffer:16*1024*1024});
  await writeFile(path.join(directory,'sql-'+(++operation)+'.log'),(r.stdout??'')+'\n'+(r.stderr??''),{mode:0o600});assert.equal(r.status,0,'SQL stopped; details kept locally. Do not repeat installation.');
  return json?JSON.parse(r.stdout.trim()):r.stdout;
 }
 // These are runtime facts, not assumptions inferred from docker create flags.
 await sql(`${settingsSQL}BEGIN READ ONLY;${actorSQL}DO $isolation$ BEGIN IF current_setting('cron.launch_active_jobs')<>'off' OR current_setting('listen_addresses')<>'127.0.0.1' OR current_setting('data_directory')<>'/var/lib/postgresql/data' THEN RAISE EXCEPTION 'Runtime isolation changed';END IF;END $isolation$;ROLLBACK;`);
 const fingerprint=await sql(`${settingsSQL}BEGIN READ ONLY;${fingerprintSQL(tables)};ROLLBACK;`,{json:true});
 const sources=await loadInputs({remoteAll:true}),followups=await loadFollowups({remote:true});
 const install=buildInstall(sources,followups,tables,fingerprint,boundary);
 const verify=`${settingsSQL}BEGIN READ ONLY;${finalSQL(tables,fingerprint,boundary)}\nSELECT 'PRIVATE_CANDIDATE_COMMITTED_OK';ROLLBACK;`;
 await writeFile(path.join(directory,'baseline-fingerprints.json'),JSON.stringify(fingerprint,null,2),{mode:0o600});
 await writeFile(path.join(directory,'install.sql'),install,{mode:0o600});await writeFile(path.join(directory,'verify-committed.sql'),verify,{mode:0o600});
 await writeFile(path.join(directory,'public-inputs.json'),JSON.stringify([...inputs,...followupInputs],null,2),{mode:0o600});
 assert.equal(inspect(),id);assert.equal(await backup(),manifest);
 console.log('Pinned inputs verified. Installing only into the isolated private candidate.');
 await sql(install);
 // A new docker exec/psql connection proves committed visibility; no success
 // marker from the installation transaction itself is trusted.
 assert.equal(inspect(),id);assert.equal((await sql(verify)).trim(),'PRIVATE_CANDIDATE_COMMITTED_OK');assert.equal(await backup(),manifest);
 console.log('PRIVATE_CANDIDATE_COMMITTED_OK: 12 candidates; 112 tables / 14888 original rows preserved; empty authority. Application acceptance remains pending.');
}
if(process.argv[1]&&import.meta.url===pathToFileURL(path.resolve(process.argv[1])).href)main().catch(()=>{console.error('PRIVATE_CANDIDATE_STOPPED: no success claim. Do not repeat installation; share only the status, keep local logs private.');process.exitCode=1;});
