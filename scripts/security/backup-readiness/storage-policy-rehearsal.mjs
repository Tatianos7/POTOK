// Exact local-only Storage policy parity rehearsal. No commit mode or hosted target.
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import path from 'node:path';
import {spawnSync} from 'node:child_process';
import {createHash} from 'node:crypto';
import {pathToFileURL} from 'node:url';
import {storageSQL,verifyStorageFiles} from './storage-preflight.mjs';
const dbId='8ea4ab28ee60efd0c157ec0f6a9d1fa24f02ffd0c58b7a36c30a47a570785989';
export function referencePolicies(){
 const rows=[];for(const [bucket,prefix,roles,commands] of [['measurements-photos','measurements_photos',['PUBLIC'],'darw'],['recipe-photos','recipe_photos',['authenticated'],'darw'],['user-exercise-media','user_exercise_media_storage',['PUBLIC'],'dar']]){
  const media=bucket==='user-exercise-media',predicate="((bucket_id = '"+bucket+"'::text) AND "+(media?"(split_part(name, '/'::text, 1) = (auth.uid())::text))":"(split_part(name, '/'::text, 1) = 'user'::text) AND (split_part(name, '/'::text, 2) = (auth.uid())::text))");
  for(const command of commands){const verb={d:'delete',a:'insert',r:'select',w:'update'}[command];rows.push({name:prefix+'_'+verb+'_own'+(bucket==='recipe-photos'?'':'_v1'),command,permissive:true,roles,using:command==='a'?null:predicate,check:['a','w'].includes(command)?predicate:null});}
 }return rows.sort((a,b)=>a.name.localeCompare(b.name,'en'));
}
export const policyRowsSQL=`SELECT coalesce(jsonb_agg(jsonb_build_object('name',p.polname,'command',p.polcmd,'permissive',p.polpermissive,'roles',(SELECT jsonb_agg(CASE WHEN r=0 THEN 'PUBLIC' ELSE pg_get_userbyid(r) END ORDER BY r) FROM unnest(p.polroles) r),'using',pg_get_expr(p.polqual,p.polrelid),'check',pg_get_expr(p.polwithcheck,p.polrelid)) ORDER BY p.polname),'[]'::jsonb) FROM pg_policy p WHERE p.polrelid='storage.objects'::regclass`;
export function rollbackSQL(){
 const rows=referencePolicies(),q=s=>'"'+s.replaceAll('"','""')+'"';
 const ddl=rows.map(p=>'CREATE POLICY '+q(p.name)+' ON storage.objects AS PERMISSIVE FOR '+{a:'INSERT',r:'SELECT',w:'UPDATE',d:'DELETE'}[p.command]+' TO '+p.roles.map(r=>r==='PUBLIC'?'PUBLIC':q(r)).join(',')+(p.using?' USING ('+p.using+')':'')+(p.check?' WITH CHECK ('+p.check+')':'')+';').join('\n');
 return `BEGIN;
SET LOCAL search_path=pg_catalog,pg_temp;SET LOCAL lock_timeout='5s';SET LOCAL statement_timeout='30s';
LOCK TABLE storage.objects IN SHARE ROW EXCLUSIVE MODE;
DO $guard$ BEGIN
 IF NOT (SELECT rolsuper FROM pg_roles WHERE rolname=current_user) OR inet_server_addr() IS NOT NULL THEN RAISE EXCEPTION 'Local superuser socket required'; END IF;
 IF NOT (SELECT relrowsecurity FROM pg_class WHERE oid='storage.objects'::regclass) OR EXISTS(SELECT FROM pg_policy WHERE polrelid='storage.objects'::regclass) OR (SELECT count(*) FROM storage.objects)<>63 THEN RAISE EXCEPTION 'Unexpected baseline'; END IF;
END $guard$;
${ddl}
DO $verify$ DECLARE actual jsonb; BEGIN
 SELECT (${policyRowsSQL}) INTO actual;
 IF actual <> $expected$${JSON.stringify(rows)}$expected$::jsonb THEN RAISE EXCEPTION 'Exact policy parity failed'; END IF;
 RAISE NOTICE 'LOCAL_STORAGE_POLICIES_TEMPORARY_OK: 11 exact rules; rollback follows';
END $verify$;
ROLLBACK;`;
}
async function regular(file){const s=await fs.lstat(file);assert(s.isFile()&&!s.isSymbolicLink());return fs.readFile(file,'utf8');}
export async function main(args){
 assert.equal(args.length,3);assert.equal(args[0],'--rehearse-local-policy-parity');const base=await fs.realpath(args[1]),prior=await fs.realpath(args[2]);assert.equal(path.basename(base),'POTOK_BACKUP_2026-10-24');assert(prior.startsWith(base+path.sep));assert.match(path.basename(prior),/^storage-write-admission-[A-Za-z0-9]+$/);
 assert.equal(createHash('sha256').update(await regular(new URL('storage-preflight.mjs',import.meta.url))).digest('hex'),'5b1bc22e7c3f4a2c14ed73e3f6d8280087864186baf9354dc6b7a68ad9587e09');
 const receipt=JSON.parse(await regular(path.join(prior,'result.json')));assert.equal(receipt.protocol,'potok-storage-write-admission-v1');assert.equal(receipt.dbId,dbId);assert.equal(receipt.files,63);assert.deepEqual(receipt.policies,[]);assert.equal(receipt.objectRls,true);assert.equal(receipt.databaseWrites,false);assert.equal(receipt.releaseReady,false);
 const endpointResult=spawnSync('docker',['context','inspect','desktop-linux','--format','{{.Endpoints.docker.Host}}'],{encoding:'utf8',timeout:15000});assert.equal(endpointResult.status,0);const endpoint=endpointResult.stdout.trim();assert(endpoint.startsWith('unix:///'));
 const docker=(args,options={})=>spawnSync('docker',['--host',endpoint,...args],{encoding:'utf8',timeout:120000,maxBuffer:24*1024*1024,...options});
 const inspected=docker(['inspect',dbId]);assert.equal(inspected.status,0);const db=JSON.parse(inspected.stdout)[0];assert.equal(db.Id,dbId);assert.equal(db.Image,'sha256:40868dfbce8c3a901448991069b7bcabbe14e8f8105ef609af22afce79b2dc44');assert.equal(db.State.Running,true);assert.equal(db.HostConfig.NetworkMode,'none');assert.equal(db.HostConfig.Privileged,false);assert.deepEqual(db.HostConfig.PortBindings??{},{});assert(db.Mounts.some(m=>m.Type==='volume'&&m.Name==='potok_security_candidate_2026-10-26'&&m.Destination==='/var/lib/postgresql/data'));
 const run=(input,user)=>docker(['exec','-i',dbId,'sh','-c','PGPASSWORD="$POSTGRES_PASSWORD" exec psql -X -w -qAt -h /tmp -U '+user+' -d postgres --set ON_ERROR_STOP=1'],{input});
 const observe=()=>{const r=run(storageSQL,'postgres');assert.equal(r.status,0);return JSON.parse(r.stdout.trim());};
 const before=observe();assert.deepEqual(before,JSON.parse(await regular(path.join(prior,'after.json'))));assert.equal((before.catalog.policies??[]).length,0);assert.equal(before.cron,'off');assert.equal(before.listen,'127.0.0.1');const files=await verifyStorageFiles(base,before);
 const directory=await fs.mkdtemp(path.join(base,'storage-policy-rehearsal-'));await fs.chmod(directory,0o700);console.log('Private policy rehearsal evidence: '+directory);const save=(name,data)=>fs.writeFile(path.join(directory,name),typeof data==='string'?data:JSON.stringify(data,null,2),{mode:0o600,flag:'wx'});
 await save('before.json',before);const sql=rollbackSQL();await save('local-only-rollback.sql',sql);let result;try{result=run(sql,'supabase_admin');}finally{const after=observe();await save('after.json',after);assert.deepEqual(after,before);assert.deepEqual(await verifyStorageFiles(base,after),files);}
 await save('status.log',(result?.stdout??'')+'\n'+(result?.stderr??''));assert.equal(result?.status,0);assert(result.stderr.includes('LOCAL_STORAGE_POLICIES_TEMPORARY_OK'));await save('result.json',{protocol:'potok-storage-policy-rehearsal-v1',dbId,policiesTested:11,rollbackVerified:true,originalFilesPreserved:true,storageCatalogPreserved:true,committed:false,abAcceptance:false,releaseReady:false});console.log('LOCAL_STORAGE_POLICY_ROLLBACK_OK: 11 exact rules verified temporarily; original Storage content/catalog/files restored; no commit or HTTP writes.');
}
if(process.argv[1]&&import.meta.url===pathToFileURL(path.resolve(process.argv[1])).href)main(process.argv.slice(2)).catch(()=>{console.error('LOCAL_STORAGE_POLICY_REHEARSAL_STOPPED: preserve private evidence; no commit mode; do not replay automatically.');process.exitCode=1;});
