// Inspect the successful private Storage copy only. Never starts a service or writes SQL.
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import path from 'node:path';
import {createHash} from 'node:crypto';
import {spawnSync} from 'node:child_process';
import {pathToFileURL} from 'node:url';
import {storageSQL,verifyStorageFiles} from './storage-preflight.mjs';
const dbId='8ea4ab28ee60efd0c157ec0f6a9d1fa24f02ffd0c58b7a36c30a47a570785989';
const storageImage='sha256:3ccd8e3474b374021b7e7262f7d3ae6b1d9697286dddf854c11e61ca253ee738';
export const policySQL=`BEGIN ISOLATION LEVEL REPEATABLE READ READ ONLY;
SET LOCAL search_path=pg_catalog,pg_temp;SET LOCAL statement_timeout='30s';
SELECT jsonb_build_object('protocol','potok-storage-write-policy-v1','readOnly',current_setting('transaction_read_only'),
'rls',(SELECT relrowsecurity FROM pg_class WHERE oid='storage.objects'::regclass),
'forceRls',(SELECT relforcerowsecurity FROM pg_class WHERE oid='storage.objects'::regclass),
'policies',(SELECT coalesce(jsonb_agg(jsonb_build_object('name',p.polname,'command',p.polcmd,'permissive',p.polpermissive,'roles',(SELECT jsonb_agg(CASE WHEN r=0 THEN 'PUBLIC' ELSE pg_get_userbyid(r) END ORDER BY r) FROM unnest(p.polroles) r),'using',pg_get_expr(p.polqual,p.polrelid),'check',pg_get_expr(p.polwithcheck,p.polrelid)) ORDER BY p.polname),'[]'::jsonb) FROM pg_policy p WHERE p.polrelid='storage.objects'::regclass),
'rights',(SELECT jsonb_agg(jsonb_build_object('role',r,'privilege',v,'allowed',has_table_privilege(r,'storage.objects',v)) ORDER BY r,v) FROM unnest(ARRAY['anon','authenticated']) r CROSS JOIN unnest(ARRAY['SELECT','INSERT','UPDATE','DELETE']) v)) AS evidence;
ROLLBACK;`;
export function summarizePolicy(snapshot,policy){
 assert.equal(snapshot.protocol,'potok-storage-preflight-v1');assert.equal(snapshot.readOnly,'on');assert.equal(snapshot.objects.length,63);assert.equal(snapshot.buckets.length,3);
 assert.equal(policy.protocol,'potok-storage-write-policy-v1');assert.equal(policy.readOnly,'on');assert.equal(policy.rls,true);assert(Array.isArray(policy.policies));assert.equal(policy.rights.length,8);
 return {protocol:'potok-storage-write-admission-v1',files:63,buckets:snapshot.buckets.map(b=>({id:b.id,public:b.public,fileSizeLimit:b.file_size_limit,allowedMimeTypes:b.allowed_mime_types})),objectRls:policy.rls,policies:policy.policies.map(p=>({name:p.name,command:p.command,roles:p.roles,permissive:p.permissive,hasUsing:p.using!==null,hasCheck:p.check!==null,definitionSha256:createHash('sha256').update(JSON.stringify([p.using,p.check])).digest('hex')})),rights:policy.rights,serviceStarted:false,databaseWrites:false,writeAcceptance:false,releaseReady:false};
}
export function validateReceipt(r){
 assert.equal(r.protocol,'potok-storage-readonly-http-v1');assert.equal(r.files,63);assert.equal(r.dbId,dbId);for(const k of ['serviceRoleReadVerification','storageMetadataPreserved','originalFilesPreserved'])assert.equal(r[k],true);for(const k of ['abAcceptance','writeAcceptance','uiAcceptance','releaseReady'])assert.equal(r[k],false);assert.match(r.serverId,/^[a-f0-9]{64}$/);assert.match(r.volume,/^potok_storage_ro_[a-f0-9]{12}$/);
}
async function regular(file){const s=await fs.lstat(file);assert(s.isFile()&&!s.isSymbolicLink());return fs.readFile(file,'utf8');}
export async function main(args){
 assert.equal(args.length,3);assert.equal(args[0],'--inspect-storage-write-scope');const base=await fs.realpath(args[1]),prior=await fs.realpath(args[2]);assert.equal(path.basename(base),'POTOK_BACKUP_2026-10-24');assert(prior.startsWith(base+path.sep));assert.match(path.basename(prior),/^storage-readonly-[A-Za-z0-9]+$/);
 assert.equal(createHash('sha256').update(await regular(new URL('storage-preflight.mjs',import.meta.url))).digest('hex'),'5b1bc22e7c3f4a2c14ed73e3f6d8280087864186baf9354dc6b7a68ad9587e09');
 const receipt=JSON.parse(await regular(path.join(prior,'result.json')));validateReceipt(receipt);
 const endpoint=spawnSync('docker',['context','inspect','desktop-linux','--format','{{.Endpoints.docker.Host}}'],{encoding:'utf8',timeout:15000});assert.equal(endpoint.status,0);assert(endpoint.stdout.trim().startsWith('unix:///'));
 const docker=args=>{const r=spawnSync('docker',['--host',endpoint.stdout.trim(),...args],{encoding:'utf8',timeout:120000,maxBuffer:24*1024*1024});assert.equal(r.status,0,'Private inspection stopped');return r.stdout;};
 const inspect=id=>JSON.parse(docker(['inspect',id]))[0];const db=inspect(dbId);assert.equal(db.Id,dbId);assert.equal(db.Image,'sha256:40868dfbce8c3a901448991069b7bcabbe14e8f8105ef609af22afce79b2dc44');assert.equal(db.State.Running,true);assert.equal(db.HostConfig.NetworkMode,'none');assert.equal(db.HostConfig.Privileged,false);assert.deepEqual(db.HostConfig.PortBindings??{},{});assert(db.Mounts.some(m=>m.Type==='volume'&&m.Name==='potok_security_candidate_2026-10-26'&&m.Destination==='/var/lib/postgresql/data'));
 const server=inspect(receipt.serverId);assert.equal(server.State.Running,false);assert.equal(server.Image,storageImage);assert.equal(server.HostConfig.NetworkMode,'container:'+dbId);assert.deepEqual(server.HostConfig.PortBindings??{},{});assert(server.Mounts.some(m=>m.Name===receipt.volume&&m.Destination==='/work'&&!m.RW));
 const sql=text=>{const r=spawnSync('docker',['--host',endpoint.stdout.trim(),'exec','-i',dbId,'sh','-c','PGPASSWORD="$POSTGRES_PASSWORD" exec psql -X -w -qAt -h /tmp -U postgres -d postgres --set ON_ERROR_STOP=1'],{encoding:'utf8',input:text,timeout:120000,maxBuffer:24*1024*1024});assert.equal(r.status,0,'Private readonly query stopped');return JSON.parse(r.stdout.trim());};
 const before=sql(storageSQL);assert.deepEqual(before,JSON.parse(await regular(path.join(prior,'after.json'))));assert.equal(before.cron,'off');assert.equal(before.listen,'127.0.0.1');const files=await verifyStorageFiles(base,before);
 const directory=await fs.mkdtemp(path.join(base,'storage-write-admission-'));await fs.chmod(directory,0o700);console.log('Private Storage write-scope evidence: '+directory);const save=(name,value)=>fs.writeFile(path.join(directory,name),JSON.stringify(value,null,2),{mode:0o600,flag:'wx'});
 await save('before.json',before);const policy=sql(policySQL);await save('policies.json',policy);const summary=summarizePolicy(before,policy);const after=sql(storageSQL);await save('after.json',after);assert.deepEqual(after,before);assert.deepEqual(await verifyStorageFiles(base,after),files);assert.equal(inspect(receipt.serverId).State.Running,false);await save('result.json',{...summary,dbId,readEvidence:path.basename(prior)});
 console.log('STORAGE_WRITE_SCOPE_CAPTURED: unchanged 63 files/catalog; policy inspection only; no service or writes.');console.log(JSON.stringify(summary,null,2));
}
if(process.argv[1]&&import.meta.url===pathToFileURL(path.resolve(process.argv[1])).href)main(process.argv.slice(2)).catch(()=>{console.error('STORAGE_WRITE_SCOPE_STOPPED: preserve private evidence; no service startup or database writes requested.');process.exitCode=1;});
