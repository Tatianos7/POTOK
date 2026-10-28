// Read-only admission for the existing private copy. Never starts the Storage API.
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import {createReadStream} from 'node:fs';
import path from 'node:path';
import {createHash} from 'node:crypto';
import {spawnSync} from 'node:child_process';
import {pathToFileURL} from 'node:url';
const sha=bytes=>createHash('sha256').update(bytes).digest('hex');
const dbName='potok_security_candidate_2026-10-26',dbId='8ea4ab28ee60efd0c157ec0f6a9d1fa24f02ffd0c58b7a36c30a47a570785989';
const dbImage='sha256:40868dfbce8c3a901448991069b7bcabbe14e8f8105ef609af22afce79b2dc44';
export const storageSQL=`BEGIN ISOLATION LEVEL REPEATABLE READ READ ONLY;
SET LOCAL search_path=pg_catalog,pg_temp;
SET LOCAL statement_timeout='30s';SET LOCAL timezone='UTC';
SELECT jsonb_build_object('protocol','potok-storage-preflight-v1','actor',current_user,
 'readOnly',current_setting('transaction_read_only'),'replicationRole',current_setting('session_replication_role'),
 'cron',current_setting('cron.launch_active_jobs',true),'listen',current_setting('listen_addresses'),
 'roles',(SELECT jsonb_agg(jsonb_build_array(rolname,rolsuper,rolbypassrls,rolcanlogin) ORDER BY rolname) FROM pg_roles WHERE rolname IN('postgres','supabase_storage_admin','anon','authenticated')),
 'buckets',(SELECT coalesce(jsonb_agg(to_jsonb(b) ORDER BY id),'[]'::jsonb) FROM storage.buckets b),
 'objects',(SELECT coalesce(jsonb_agg(to_jsonb(o) ORDER BY bucket_id,name),'[]'::jsonb) FROM storage.objects o),
 'migrations',(SELECT coalesce(jsonb_agg(to_jsonb(m) ORDER BY id),'[]'::jsonb) FROM storage.migrations m),
 'catalog',jsonb_build_object(
 'relations',(SELECT jsonb_agg(to_jsonb(c) ORDER BY c.oid) FROM pg_class c WHERE c.relnamespace='storage'::regnamespace),
 'columns',(SELECT jsonb_agg(to_jsonb(a) ORDER BY a.attrelid,a.attnum) FROM pg_attribute a JOIN pg_class c ON c.oid=a.attrelid WHERE c.relnamespace='storage'::regnamespace),
 'routines',(SELECT jsonb_agg(to_jsonb(p) ORDER BY p.oid) FROM pg_proc p WHERE p.pronamespace='storage'::regnamespace),
 'policies',(SELECT jsonb_agg(to_jsonb(p) ORDER BY p.oid) FROM pg_policy p JOIN pg_class c ON c.oid=p.polrelid WHERE c.relnamespace='storage'::regnamespace),
 'triggers',(SELECT jsonb_agg(to_jsonb(t) ORDER BY t.oid) FROM pg_trigger t JOIN pg_class c ON c.oid=t.tgrelid WHERE c.relnamespace='storage'::regnamespace))) AS evidence;
ROLLBACK;`;
export async function imageReadProbe(root='/app'){
 const fs=await import('node:fs/promises'),path=await import('node:path'),{createHash}=await import('node:crypto');
 const pkg=JSON.parse(await fs.readFile(path.join(root,'package.json'),'utf8'));
 const files=[];
 for(const name of ['dist/start/server.js','dist/config.js','dist/storage/backend/file.js','dist/storage/backend/adapter.js','dist/internal/database/migrations/migrate.js']){
  try{const bytes=await fs.readFile(path.join(root,name));files.push({name,bytes:bytes.length,sha256:createHash('sha256').update(bytes).digest('hex'),migrationRunnerMention:bytes.includes(Buffer.from('runMigrationsOnTenant')),versionSeparatorMention:bytes.includes(Buffer.from('-$v-')),xattrMention:bytes.includes(Buffer.from('xattr'))});}
  catch(e){if(e.code!=='ENOENT')throw e;files.push({name,missing:true});}
 }
 const migrations=[];
 for(const name of ['migrations/tenant','migrations','dist/migrations/tenant']){
  try{const entries=await fs.readdir(path.join(root,name),{withFileTypes:true});migrations.push({directory:name,sqlFiles:entries.filter(e=>e.isFile()&&e.name.endsWith('.sql')).map(e=>e.name).sort()});}
  catch(e){if(e.code!=='ENOENT')throw e;}
 }
 return {packageName:pkg.name,packageVersion:pkg.version,files,migrations,applicationImported:false,serverStarted:false};
}
const key=o=>JSON.stringify([o.bucket??o.bucket_id,o.name]);
function safeName(name){assert.equal(typeof name,'string');assert(name.length>0&&!name.startsWith('/')&&!name.includes('\\')&&!name.includes('\0'));assert(name.split('/').every(s=>s!==''&&s!=='.'&&s!=='..'));}
export async function verifyStorageFiles(base,snapshot){
 assert.equal(snapshot.protocol,'potok-storage-preflight-v1');assert.equal(snapshot.readOnly,'on');
 assert.equal(snapshot.buckets.length,3);assert.equal(snapshot.objects.length,63);
 const manifest=JSON.parse(await regular(path.join(base,'storage-manifest.json'))),hashes=JSON.parse(await regular(path.join(base,'storage-sha256.json')));
 assert.equal(manifest.length,63);assert.equal(hashes.length,63);
 const maps=[manifest,hashes,snapshot.objects].map(rows=>new Map(rows.map(o=>[key(o),o])));assert(maps.every(m=>m.size===63));assert.deepEqual([...maps[0].keys()].sort(),[...maps[1].keys()].sort());assert.deepEqual([...maps[0].keys()].sort(),[...maps[2].keys()].sort());
 const buckets=new Set(snapshot.buckets.map(b=>b.id));assert.equal(buckets.size,3);
 const root=path.join(base,'storage-files');assert((await fs.lstat(root)).isDirectory()&&!(await fs.lstat(root)).isSymbolicLink());
 const actual=[];const walk=async(dir,relative='')=>{for(const entry of await fs.readdir(dir,{withFileTypes:true})){assert(!entry.isSymbolicLink());const rel=relative?relative+'/'+entry.name:entry.name;if(entry.isDirectory())await walk(path.join(dir,entry.name),rel);else{assert(entry.isFile());actual.push(rel);}}};await walk(root);
 const expected=[],records=[];
 for(const [k,obj] of maps[0]){
  assert(buckets.has(obj.bucket));safeName(obj.bucket);assert(!obj.bucket.includes('/'));safeName(obj.name);
  const file=path.join(root,obj.bucket,obj.bucket,obj.name),relative=path.relative(root,file);assert(!relative.startsWith('..'+path.sep));expected.push(relative);
  const stat=await fs.lstat(file);assert(stat.isFile()&&!stat.isSymbolicLink());const h=maps[1].get(k),remote=maps[2].get(k);
  assert(/^\d+$/.test(String(obj.size)));assert(/^\d+$/.test(h.bytes));assert.equal(BigInt(stat.size),BigInt(obj.size));assert.equal(BigInt(stat.size),BigInt(h.bytes));assert.match(h.sha256,/^[a-f0-9]{64}$/);
  const digest=createHash('sha256');for await(const bytes of createReadStream(file))digest.update(bytes);assert.equal(digest.digest('hex'),h.sha256);
  assert(/^\d+$/.test(String(remote.metadata?.size)));assert.equal(BigInt(stat.size),BigInt(remote.metadata.size));
  assert(remote.version===null||typeof remote.version==='string');if(remote.version!==null){safeName(remote.version);assert(!remote.version.includes('/'));}
  records.push({bucket:obj.bucket,name:obj.name,version:remote.version,bytes:h.bytes,sha256:h.sha256,mimetype:remote.metadata?.mimetype??null});
 }
 assert.deepEqual(actual.sort(),expected.sort());return {records,files:63,buckets:3,backendLayoutSelected:false,serviceStarted:false,binaryHttpAcceptance:false,releaseReady:false};
}
async function regular(file){const s=await fs.lstat(file);assert(s.isFile()&&!s.isSymbolicLink());return fs.readFile(file,'utf8');}
let phase='admission';
export async function main(args){
 assert.equal(args.length,3);assert.equal(args[0],'--inspect-local-storage');const base=await fs.realpath(args[1]),receiptDir=await fs.realpath(args[2]);assert.equal(path.basename(base),'POTOK_BACKUP_2026-10-24');assert(receiptDir.startsWith(base+path.sep));assert.match(path.basename(receiptDir),/^scoped-diary-photo-[A-Za-z0-9]+$/);
 const receipt=JSON.parse(await regular(path.join(receiptDir,'result.json'))),state=JSON.parse(await regular(path.join(receiptDir,'state.json')));assert.equal(receipt.protocol,'potok-scoped-writes-v1');assert.equal(receipt.cleanup,true);assert.equal(receipt.originalRows,14888);assert.equal(receipt.preservedSelectedTables,112);assert.equal(receipt.permissionsPreserved,true);assert.equal(state.dbId,dbId);
 const endpointResult=spawnSync('docker',['context','inspect','desktop-linux','--format','{{.Endpoints.docker.Host}}'],{encoding:'utf8',timeout:15000});assert.equal(endpointResult.status,0);const endpoint=endpointResult.stdout.trim();assert(endpoint.startsWith('unix:///'));
 const docker=(args,{input,allowFailure=false}={})=>{const r=spawnSync('docker',['--host',endpoint,...args],{input,encoding:'utf8',timeout:60000,maxBuffer:24*1024*1024});if(!allowFailure)assert.equal(r.status,0,'Local inspection stopped');return r;};
 const inspect=name=>JSON.parse(docker(['inspect',name]).stdout)[0];
 const db=inspect(dbName);assert.equal(db.Id,dbId);assert.equal(db.Image,dbImage);assert.equal(db.State.Running,true);assert.equal(db.HostConfig.NetworkMode,'none');assert.deepEqual(db.HostConfig.PortBindings??{},{});assert.equal(db.HostConfig.Privileged,false);assert(db.Mounts.some(m=>m.Type==='volume'&&m.Name===dbName&&m.Destination==='/var/lib/postgresql/data'));
 for(const [name,id] of [['potok_private_rest_2026-10-27',state.apiId],['potok_private_auth_2026-10-27',state.authId]]){const c=inspect(name);assert.equal(c.Id,id);assert.equal(c.State.Running,true);assert.equal(c.HostConfig.NetworkMode,'container:'+dbId);assert.deepEqual(c.HostConfig.PortBindings??{},{});}
 const image=JSON.parse(docker(['image','inspect','public.ecr.aws/supabase/storage-api:v1.80.2']).stdout)[0];assert.match(image.Id,/^sha256:[a-f0-9]{64}$/);assert.equal(image.Os,'linux');assert.equal(image.Architecture,'arm64');
 const directory=await fs.mkdtemp(path.join(base,'storage-preflight-'));await fs.chmod(directory,0o700);console.log('Private Storage inspection: '+directory);
 const save=(name,value)=>fs.writeFile(path.join(directory,name),typeof value==='string'?value:JSON.stringify(value,null,2),{mode:0o600,flag:'wx'});
 const query=()=>JSON.parse(docker(['exec','-i',dbId,'sh','-c','PGPASSWORD="$POSTGRES_PASSWORD" exec psql -X -w -qAt -h /tmp -U postgres -d postgres --set ON_ERROR_STOP=1'],{input:storageSQL}).stdout.trim());
 phase='before';const before=query();assert.equal(before.actor,'postgres');assert.equal(before.replicationRole,'origin');assert.equal(before.cron,'off');assert.equal(before.listen,'127.0.0.1');await save('before.json',before);
 phase='files';const files=await verifyStorageFiles(base,before);await save('file-observation.json',files);
 phase='image-files';const probe=docker(['run','--rm','--pull','never','--network','none','--read-only','--cap-drop','ALL','--security-opt','no-new-privileges','--user','node','--entrypoint','node',image.Id,'--input-type=module','--eval','console.log(JSON.stringify(await ('+imageReadProbe.toString()+')()));'],{allowFailure:true});await save('image-probe.log',probe.stdout+'\n'+probe.stderr);
 phase='role-connect';const role=docker(['exec',dbId,'sh','-c','PGPASSWORD="$POSTGRES_PASSWORD" PGCONNECT_TIMEOUT=5 exec psql -X -w -qAt -h 127.0.0.1 -U supabase_storage_admin -d postgres --set ON_ERROR_STOP=1 --command "BEGIN READ ONLY; SELECT jsonb_build_object(\'actor\',current_user,\'readOnly\',current_setting(\'transaction_read_only\')); ROLLBACK;"'],{allowFailure:true});await save('role-probe.log',role.stdout+'\n'+role.stderr);
 phase='after';const after=query();await save('after.json',after);assert.deepEqual(after,before);assert.equal(inspect(dbName).Id,dbId);
 phase='result';assert.equal(probe.status,0);const observation=JSON.parse(probe.stdout.trim());assert.equal(observation.applicationImported,false);assert.equal(observation.serverStarted,false);
 let roleConnects=false;try{const r=JSON.parse(role.stdout.trim());roleConnects=role.status===0&&r.actor==='supabase_storage_admin'&&r.readOnly==='on';}catch{}
 await save('image-observation.json',{imageId:image.Id,architecture:image.Architecture,reference:'public.ecr.aws/supabase/storage-api:v1.80.2',observation});
 const result={protocol:'potok-storage-preflight-result-v1',dbId,imageId:image.Id,files:63,buckets:3,roleConnects,sourceFilesFound:observation.files.filter(f=>!f.missing).length,storageSchemaPreserved:true,serviceStarted:false,backendLayoutSelected:false,binaryHttpAcceptance:false,releaseReady:false};await save('result.json',result);
 console.log('STORAGE_PREFLIGHT_CAPTURED: files=63; buckets=3; Storage metadata/catalog unchanged; service not started.');console.log(JSON.stringify({imageId:result.imageId,roleConnects,sourceFilesFound:result.sourceFilesFound,packageVersion:observation.packageVersion}));
}
if(process.argv[1]&&import.meta.url===pathToFileURL(path.resolve(process.argv[1])).href)main(process.argv.slice(2)).catch(()=>{console.error('STORAGE_PREFLIGHT_STOPPED: phase='+phase+'; retain private evidence; no Storage service was started.');process.exitCode=1;});
