// One-shot exact policy repair on the fixed private candidate only. Never hosted.
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import path from 'node:path';
import {spawnSync} from 'node:child_process';
import {createHash} from 'node:crypto';
import {pathToFileURL} from 'node:url';
import {storageSQL,verifyStorageFiles} from './storage-preflight.mjs';
import {referencePolicies,policyRowsSQL,rollbackSQL} from './storage-policy-rehearsal.mjs';
const dbId='8ea4ab28ee60efd0c157ec0f6a9d1fa24f02ffd0c58b7a36c30a47a570785989';
export function commitSQL(){const sql=rollbackSQL();assert(sql.endsWith('ROLLBACK;'));assert.equal((sql.match(/ROLLBACK;/g)||[]).length,1);assert(!sql.includes('COMMIT;'));return sql.slice(0,-'ROLLBACK;'.length).replace('LOCAL_STORAGE_POLICIES_TEMPORARY_OK: 11 exact rules; rollback follows','LOCAL_STORAGE_POLICIES_INSTALLED: 11 exact rules')+'COMMIT;';}
export function assertPolicyOnlyChange(before,after,definitions){
 assert.deepEqual(definitions,referencePolicies());assert.equal((before.catalog.policies??[]).length,0);assert.equal(after.catalog.policies.length,11);
 const strip=v=>{const copy=structuredClone(v);delete copy.catalog.policies;return copy;};assert.deepEqual(strip(after),strip(before));
}
async function regular(file){const s=await fs.lstat(file);assert(s.isFile()&&!s.isSymbolicLink());return fs.readFile(file,'utf8');}
let phase='admission';
export async function main(args){
 assert.equal(args.length,3);assert.equal(args[0],'--install-exact-local-policies');const base=await fs.realpath(args[1]),prior=await fs.realpath(args[2]);assert.equal(path.basename(base),'POTOK_BACKUP_2026-10-24');assert(prior.startsWith(base+path.sep));assert.match(path.basename(prior),/^storage-policy-rehearsal-[A-Za-z0-9]+$/);
 for(const [name,hash] of [['storage-preflight.mjs','5b1bc22e7c3f4a2c14ed73e3f6d8280087864186baf9354dc6b7a68ad9587e09'],['storage-policy-rehearsal.mjs','24922260f07a3fb8602d30c3d7465dff69835ffcd27513befedd10e9ae91bc74']])assert.equal(createHash('sha256').update(await regular(new URL(name,import.meta.url))).digest('hex'),hash);
 const receipt=JSON.parse(await regular(path.join(prior,'result.json')));assert.equal(receipt.protocol,'potok-storage-policy-rehearsal-v1');assert.equal(receipt.dbId,dbId);assert.equal(receipt.policiesTested,11);for(const k of ['rollbackVerified','originalFilesPreserved','storageCatalogPreserved'])assert.equal(receipt[k],true);for(const k of ['committed','abAcceptance','releaseReady'])assert.equal(receipt[k],false);
 const endpointResult=spawnSync('docker',['context','inspect','desktop-linux','--format','{{.Endpoints.docker.Host}}'],{encoding:'utf8',timeout:15000});assert.equal(endpointResult.status,0);const endpoint=endpointResult.stdout.trim();assert(endpoint.startsWith('unix:///'));
 const docker=(args,options={})=>spawnSync('docker',['--host',endpoint,...args],{encoding:'utf8',timeout:120000,maxBuffer:24*1024*1024,...options});
 const inspected=docker(['inspect',dbId]);assert.equal(inspected.status,0);const db=JSON.parse(inspected.stdout)[0];assert.equal(db.Id,dbId);assert.equal(db.Image,'sha256:40868dfbce8c3a901448991069b7bcabbe14e8f8105ef609af22afce79b2dc44');assert.equal(db.State.Running,true);assert.equal(db.HostConfig.NetworkMode,'none');assert.equal(db.HostConfig.Privileged,false);assert.deepEqual(db.HostConfig.PortBindings??{},{});assert(db.Mounts.some(m=>m.Type==='volume'&&m.Name==='potok_security_candidate_2026-10-26'&&m.Destination==='/var/lib/postgresql/data'));
 const run=(input,user)=>docker(['exec','-i',dbId,'sh','-c','PGPASSWORD="$POSTGRES_PASSWORD" exec psql -X -w -qAt -h /tmp -U '+user+' -d postgres --set ON_ERROR_STOP=1'],{input});
 const observe=()=>{const r=run(storageSQL,'postgres');assert.equal(r.status,0);return JSON.parse(r.stdout.trim());};
 phase='precheck';const before=observe();assert.deepEqual(before,JSON.parse(await regular(path.join(prior,'after.json'))));assert.equal((before.catalog.policies??[]).length,0);assert.equal(before.cron,'off');assert.equal(before.listen,'127.0.0.1');const files=await verifyStorageFiles(base,before);
 const directory=await fs.mkdtemp(path.join(base,'storage-policy-install-'));await fs.chmod(directory,0o700);console.log('Private policy install evidence: '+directory);const save=(name,data)=>fs.writeFile(path.join(directory,name),typeof data==='string'?data:JSON.stringify(data,null,2),{mode:0o600,flag:'wx'});
 await save('before.json',before);const sql=commitSQL();await save('local-only-install.sql',sql);await save('intent.json',{protocol:'potok-exact-storage-policy-install-v1',dbId,policies:11,sqlSha256:createHash('sha256').update(sql).digest('hex'),sourceRehearsal:path.basename(prior)});
 phase='commit';const result=run(sql,'supabase_admin');await save('status.log',result.stdout+'\n'+result.stderr);
 phase='independent-verification';const after=observe();await save('after.json',after);const checked=run('BEGIN READ ONLY;SET LOCAL search_path=pg_catalog,pg_temp;SET LOCAL statement_timeout=\'30s\';'+policyRowsSQL+';ROLLBACK;','postgres');assert.equal(checked.status,0);const definitions=JSON.parse(checked.stdout.trim());await save('definitions.json',definitions);assertPolicyOnlyChange(before,after,definitions);assert.deepEqual(await verifyStorageFiles(base,after),files);
 // A lost commit response remains uncertain even if catalog verification sees installed rules. Never replay.
 assert.equal(result.status,0);assert(result.stderr.includes('LOCAL_STORAGE_POLICIES_INSTALLED'));await save('result.json',{protocol:'potok-storage-policy-install-v1',dbId,policies:11,committed:true,independentlyVerified:true,originalFilesPreserved:true,storageContentsPreserved:true,otherStorageCatalogPreserved:true,abAcceptance:false,releaseReady:false});
 console.log('LOCAL_STORAGE_POLICY_COMMITTED_OK: 11 exact rules persisted and independently verified; original Storage contents/files and other catalog preserved. No HTTP writes or hosted changes.');
}
if(process.argv[1]&&import.meta.url===pathToFileURL(path.resolve(process.argv[1])).href)main(process.argv.slice(2)).catch(()=>{console.error('LOCAL_STORAGE_POLICY_INSTALL_STOPPED: phase='+phase+'; outcome may be committed; retain evidence; do not replay.');process.exitCode=1;});
