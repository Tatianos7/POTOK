// Real Storage GET verification, on the fixed private copy only. No application/A-B write claim.
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import path from 'node:path';
import {createHash,createHmac,randomBytes} from 'node:crypto';
import {spawnSync} from 'node:child_process';
import {pathToFileURL} from 'node:url';
import {storageSQL,verifyStorageFiles} from './storage-preflight.mjs';
const sha=b=>createHash('sha256').update(b).digest('hex');
export const storageImage='sha256:3ccd8e3474b374021b7e7262f7d3ae6b1d9697286dddf854c11e61ca253ee738';
const dbName='potok_security_candidate_2026-10-26',dbId='8ea4ab28ee60efd0c157ec0f6a9d1fa24f02ffd0c58b7a36c30a47a570785989',dbImage='sha256:40868dfbce8c3a901448991069b7bcabbe14e8f8105ef609af22afce79b2dc44';
const nodeImage='sha256:679e291fa23095eedbb71dfdb84ce79a4cb958afa2cda05738d596566ca36e75';
export function readonlyURL(password){
 assert.equal(typeof password,'string');assert(password.length>0&&!/[\r\n\0]/.test(password));const u=new URL('postgresql://supabase_storage_admin@127.0.0.1:5432/postgres');u.password=password;
 u.searchParams.set('options','-c default_transaction_read_only=on -c search_path=storage,public,extensions');return u.href;
}
export function storageEnvironment({password,secret,serviceKey,anonKey,migration}){
 assert.equal(typeof secret,'string');assert(secret.length>=32&&!/[\r\n\0]/.test(secret));assert.match(migration,/^[a-zA-Z0-9_-]+$/);for(const key of [serviceKey,anonKey])assert.match(key,/^[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+$/);
 const url=readonlyURL(password);
 return {SERVER_HOST:'127.0.0.1',SERVER_PORT:'13006',IS_MULTITENANT:'false',TENANT_ID:'stub',REGION:'us-east-1',GLOBAL_S3_BUCKET:'stub',STORAGE_S3_BUCKET:'stub',STORAGE_BACKEND:'file',FILE_STORAGE_BACKEND_PATH:'/work/backend',FILE_STORAGE_ETAG_ALGORITHM:'md5',TUS_USE_FILE_VERSION_SEPARATOR:'true',AUTH_JWT_SECRET:secret,ANON_KEY:anonKey,SERVICE_KEY:serviceKey,DATABASE_URL:url,DATABASE_POOL_URL:url,DATABASE_SEARCH_PATH:'storage,public,extensions',DATABASE_MAX_CONNECTIONS:'4',DB_ALLOW_MIGRATION_REFRESH:'false',DB_MIGRATIONS_FREEZE_AT:migration,DB_INSTALL_ROLES:'false',PGOPTIONS:'-c default_transaction_read_only=on',PG_QUEUE_ENABLE:'false',PG_QUEUE_WORKERS_ENABLE:'false',ENABLE_QUEUE_EVENTS:'false',VECTOR_ENABLED:'false',VECTOR_STORE_MIGRATIONS_ENABLED:'false',VECTOR_DATABASE_CREATE:'false',S3_PROTOCOL_ENABLED:'false',ENABLE_IMAGE_TRANSFORMATION:'false',LOG_LEVEL:'error'};
}
// Write new container-owned inodes; never import macOS UID/GID or mode bits.
export async function stageInput(root,relative,bytes,expected){
 const assert=(await import('node:assert/strict')).default,fs=await import('node:fs/promises'),path=await import('node:path'),{createHash}=await import('node:crypto');
 assert.equal(typeof relative,'string');assert(relative&&!relative.startsWith('/')&&!relative.includes('\\')&&!relative.includes('\0')&&relative.split('/').every(p=>p&&p!=='.'&&p!=='..'));
 assert.equal(String(bytes.length),expected.bytes);assert.equal(createHash('sha256').update(bytes).digest('hex'),expected.sha256);
 const dest=path.join(root,relative);await fs.mkdir(path.dirname(dest),{recursive:true,mode:0o700});
 await fs.writeFile(dest,bytes,{mode:0o600,flag:'wx'});const stat=await fs.lstat(dest);assert(stat.isFile()&&!stat.isSymbolicLink());assert.equal(stat.mode&0o777,0o600);assert.equal(stat.uid,process.getuid());
 assert.equal(createHash('sha256').update(await fs.readFile(dest)).digest('hex'),expected.sha256);
 return {staged:true};
}
export async function seedBackend(root,records,{setAttribute}={}){
 const assert=(await import('node:assert/strict')).default,fs=await import('node:fs/promises'),path=await import('node:path'),{createHash}=await import('node:crypto'),{createRequire}=await import('node:module');
 const writeAttribute=setAttribute??createRequire('/app/package.json')('fs-xattr').set;assert.equal(records.length,63);const names=new Set();
 const safe=s=>{assert.equal(typeof s,'string');assert(s&&!s.startsWith('/')&&!s.includes('\\')&&!s.includes('\0')&&s.split('/').every(p=>p&&p!=='.'&&p!=='..'));};
 const backend=path.join(root,'backend');await fs.mkdir(backend,{recursive:false});
 for(const r of records){safe(r.bucket);assert(!r.bucket.includes('/'));safe(r.name);if(r.version!==null){safe(r.version);assert(!r.version.includes('/'));}
  const source=path.join(root,'incoming',r.bucket,r.bucket,r.name),dest=path.join(backend,'stub','stub',r.bucket,r.name+(r.version?'-'+'$v-'+r.version:''));assert(!names.has(dest));names.add(dest);const stat=await fs.lstat(source);assert(stat.isFile()&&!stat.isSymbolicLink());const bytes=await fs.readFile(source);assert.equal(String(bytes.length),r.bytes);assert.equal(createHash('sha256').update(bytes).digest('hex'),r.sha256);
  const parents=[];for(let p=path.dirname(dest);p!==backend;p=path.dirname(p)){assert(p.startsWith(backend+path.sep));parents.push(p);}for(const p of parents.reverse()){await fs.mkdir(p,{recursive:true});await fs.chmod(p,0o755);}
  await fs.copyFile(source,dest,fs.constants.COPYFILE_EXCL);const mime=r.mimetype??'application/octet-stream';assert.equal(typeof mime,'string');assert(!/[\r\n\0]/.test(mime));await writeAttribute(dest,'user.supabase.content-type',Buffer.from(mime));await writeAttribute(dest,'user.supabase.cache-control',Buffer.from('no-cache'));await fs.chmod(dest,0o444);
  assert.equal(createHash('sha256').update(await fs.readFile(dest)).digest('hex'),r.sha256);
 }
 await fs.chmod(backend,0o755);return {files:names.size,layout:'stub/stub/bucket/name[-$v-version]',originalFilesMounted:false};
}
export async function readBinaryObjects(input,{request=fetch}={}){
 const assert=(await import('node:assert/strict')).default,{createHash}=await import('node:crypto');assert.equal(input.records.length,63);assert.equal(new Set(input.records.map(r=>JSON.stringify([r.bucket,r.name]))).size,63);assert.equal(typeof input.token,'string');let checked=0;
 try{
  for(let i=0;i<60;i++){try{const r=await request('http://127.0.0.1:13006/status',{redirect:'error',signal:AbortSignal.timeout(2000)});if(r.status===200)break;}catch{}if(i===59)throw Error();await new Promise(r=>setTimeout(r,500));}
  for(const record of input.records){
   assert.match(record.bucket,/^[a-zA-Z0-9_-]+$/);assert.match(record.sha256,/^[a-f0-9]{64}$/);assert(/^\d+$/.test(record.bytes));assert.equal(typeof record.name,'string');assert(!record.name.includes('\\')&&!record.name.startsWith('/')&&record.name.split('/').every(s=>s&&s!=='.'&&s!=='..'));
   const route=encodeURIComponent(record.bucket)+'/'+record.name.split('/').map(encodeURIComponent).join('/');const r=await request('http://127.0.0.1:13006/object/authenticated/'+route,{method:'GET',headers:{Authorization:'Bearer '+input.token},redirect:'error',signal:AbortSignal.timeout(30000)});assert.equal(r.status,200);
   assert.equal(r.headers.get('content-encoding'),null);const h=createHash('sha256');let size=0n;assert(r.body);for await(const b of r.body){size+=BigInt(b.length);assert(size<=BigInt(record.bytes));h.update(b);}assert.equal(size,BigInt(record.bytes));assert.equal(h.digest('hex'),record.sha256);checked++;
  }
  return {protocol:'potok-storage-readonly-http-v1',files:checked,serviceRoleReadVerification:true,abAcceptance:false,writeAcceptance:false,uiAcceptance:false,releaseReady:false};
 }catch{throw Error('STORAGE_BINARY_READ_STOPPED: checked='+checked);}
}
async function regular(file){const s=await fs.lstat(file);assert(s.isFile()&&!s.isSymbolicLink());return fs.readFile(file,'utf8');}
let phase='admission';
export async function main(args){
 assert.deepEqual(args.slice(0,1),['--run-readonly-storage']);assert.equal(args.length,3);const base=await fs.realpath(args[1]),preflight=await fs.realpath(args[2]);assert.equal(path.basename(base),'POTOK_BACKUP_2026-10-24');assert(preflight.startsWith(base+path.sep));assert.match(path.basename(preflight),/^storage-preflight-[A-Za-z0-9]+$/);
 assert.equal(sha(await regular(new URL('storage-preflight.mjs',import.meta.url))),'5b1bc22e7c3f4a2c14ed73e3f6d8280087864186baf9354dc6b7a68ad9587e09');const receipt=JSON.parse(await regular(path.join(preflight,'result.json')));assert.equal(receipt.protocol,'potok-storage-preflight-result-v1');assert.equal(receipt.dbId,dbId);assert.equal(receipt.imageId,storageImage);assert.equal(receipt.roleConnects,true);assert.equal(receipt.sourceFilesFound,5);assert.equal(receipt.storageSchemaPreserved,true);assert.equal(receipt.serviceStarted,false);
 const endpointResult=spawnSync('docker',['context','inspect','desktop-linux','--format','{{.Endpoints.docker.Host}}'],{encoding:'utf8',timeout:15000});assert.equal(endpointResult.status,0);const endpoint=endpointResult.stdout.trim();assert(endpoint.startsWith('unix:///'));
 const docker=(args,{input,allowFailure=false,timeout=60000}={})=>{const r=spawnSync('docker',['--host',endpoint,...args],{encoding:'utf8',input,timeout,maxBuffer:24*1024*1024});if(!allowFailure)assert.equal(r.status,0,'Private operation stopped');return r;};
 const inspect=name=>JSON.parse(docker(['inspect',name]).stdout)[0],env=c=>Object.fromEntries(c.Config.Env.map(s=>{const at=s.indexOf('=');return [s.slice(0,at),s.slice(at+1)];}));
 const db=inspect(dbName);assert.equal(db.Id,dbId);assert.equal(db.Image,dbImage);assert.equal(db.State.Running,true);assert.equal(db.HostConfig.NetworkMode,'none');assert.deepEqual(db.HostConfig.PortBindings??{},{});assert.equal(db.HostConfig.Privileged,false);assert(db.Mounts.some(m=>m.Type==='volume'&&m.Name===dbName&&m.Destination==='/var/lib/postgresql/data'));
 const api=inspect('potok_private_rest_2026-10-27');assert.equal(api.State.Running,true);assert.equal(api.HostConfig.NetworkMode,'container:'+dbId);assert.deepEqual(api.HostConfig.PortBindings??{},{});const secret=env(api).PGRST_JWT_SECRET,password=env(db).POSTGRES_PASSWORD;
 const image=JSON.parse(docker(['image','inspect',storageImage]).stdout)[0];assert.equal(image.Id,storageImage);assert.equal(image.Os,'linux');assert.equal(image.Architecture,'arm64');assert.deepEqual(image.Config.Cmd,['node','dist/start/server.js']);
 const directory=await fs.mkdtemp(path.join(base,'storage-readonly-'));await fs.chmod(directory,0o700);console.log('Private binary read evidence: '+directory);const save=(name,data)=>fs.writeFile(path.join(directory,name),typeof data==='string'?data:JSON.stringify(data,null,2),{mode:0o600,flag:'wx'});
 const query=()=>JSON.parse(docker(['exec','-i',dbId,'sh','-c','PGPASSWORD="$POSTGRES_PASSWORD" exec psql -X -w -qAt -h /tmp -U postgres -d postgres --set ON_ERROR_STOP=1'],{input:storageSQL}).stdout.trim());
 phase='before';const before=query();assert.deepEqual(before,JSON.parse(await regular(path.join(preflight,'after.json'))));assert.equal(before.readOnly,'on');assert.equal(before.cron,'off');assert.equal(before.listen,'127.0.0.1');assert.equal(before.roles.find(r=>r[0]==='supabase_storage_admin')?.[1],false);await save('before.json',before);const files=await verifyStorageFiles(base,before);await save('file-plan.json',files);
 const migrations=before.migrations.filter(m=>Number.isInteger(m.id)&&m.id>0).sort((a,b)=>a.id-b.id);assert(migrations.length>0);const migration=migrations.at(-1).name;
 const jwt=role=>{const now=Math.floor(Date.now()/1000),prefix=Buffer.from(JSON.stringify({alg:'HS256',typ:'JWT'})).toString('base64url')+'.'+Buffer.from(JSON.stringify({role,iat:now,exp:now+3600})).toString('base64url');return prefix+'.'+createHmac('sha256',secret).update(prefix).digest('base64url');};
 const token=jwt('service_role'),configuration=storageEnvironment({password,secret,serviceKey:token,anonKey:jwt('anon'),migration}),envFile=path.join(directory,'storage.env');await save('storage.env',Object.entries(configuration).map(([k,v])=>k+'='+v).join('\n')+'\n');
 const suffix=randomBytes(6).toString('hex'),volume='potok_storage_ro_'+suffix,helper='potok_storage_seed_'+suffix,server='potok_storage_read_'+suffix;
 phase='volume';docker(['volume','create','--label','potok.purpose=storage-readonly-copy',volume]);const helperId=docker(['create','--name',helper,'--pull','never','--network','none','--read-only','--cap-drop','ALL','--security-opt','no-new-privileges','--user','root','--mount','type=volume,source='+volume+',target=/work','--entrypoint','node',storageImage,'--eval','setInterval(()=>{},1000)']).stdout.trim();
 await save('state.json',{dbId,imageId:storageImage,volume,helperId,server,apiId:api.Id});docker(['start',helperId]);
 phase='stage-files';let seed;try{
  const stageScript="const fs=await import('node:fs/promises');const chunks=[];for await(const b of process.stdin)chunks.push(b);const bytes=Buffer.concat(chunks);console.log(JSON.stringify(await ("+stageInput.toString()+")('/work',process.argv[1],bytes,JSON.parse(process.argv[2]))));";
  const stage=(relative,bytes)=>{const r=docker(['exec','-i',helperId,'node','--input-type=module','--eval',stageScript,relative,JSON.stringify({bytes:String(bytes.length),sha256:sha(bytes)})],{input:bytes,allowFailure:true,timeout:180000});assert.equal(r.status,0,'Private staging operation stopped');assert.equal(JSON.parse(r.stdout.trim()).staged,true);};
  stage('manifest.json',Buffer.from(JSON.stringify(files)));
  for(const r of files.records){const relative=path.posix.join('incoming',r.bucket,r.bucket,r.name),bytes=await fs.readFile(path.join(base,'storage-files',r.bucket,r.bucket,r.name));assert.equal(String(bytes.length),r.bytes);assert.equal(sha(bytes),r.sha256);stage(relative,bytes);}
  await save('stage-status.json',{files:63,manifest:true,containerOwned:true,sourcePermissionsChanged:false});
  seed=docker(['exec',helperId,'node','--input-type=module','--eval',"const fs=await import('node:fs/promises');const plan=JSON.parse(await fs.readFile('/work/manifest.json','utf8'));console.log(JSON.stringify(await ("+seedBackend.toString()+")('/work',plan.records)));"],{allowFailure:true,timeout:180000});await save('seed-status.log',seed.stdout+'\n'+seed.stderr);
 }finally{docker(['stop','--time','5',helperId],{allowFailure:true});}assert.equal(seed?.status,0);assert.equal(JSON.parse(seed.stdout.trim()).files,63);
 phase='driver-readonly';const proof="const {createRequire}=await import('node:module');const {Client}=createRequire('/app/package.json')('pg');const c=new Client({connectionString:process.env.DATABASE_URL,options:'-c search_path=storage,public,extensions'});await c.connect();try{const {rows}=await c.query(\"SELECT current_user AS actor,current_setting('transaction_read_only') AS readonly\");if(rows[0].actor!=='supabase_storage_admin'||rows[0].readonly!=='on')throw Error('Readonly not effective');console.log('STORAGE_DRIVER_READONLY_OK');}finally{await c.end();}";
 const probe=docker(['run','--rm','--pull','never','--network','container:'+dbId,'--read-only','--cap-drop','ALL','--security-opt','no-new-privileges','--user','node','--env-file',envFile,'--entrypoint','node',storageImage,'--input-type=module','--eval',proof],{allowFailure:true});await save('driver-proof.log',probe.stdout+'\n'+probe.stderr);assert.equal(probe.status,0);assert(probe.stdout.includes('STORAGE_DRIVER_READONLY_OK'));
 phase='server-create';const serverId=docker(['create','--name',server,'--pull','never','--network','container:'+dbId,'--restart','no','--read-only','--cap-drop','ALL','--security-opt','no-new-privileges','--user','node','--mount','type=volume,source='+volume+',target=/work,readonly','--tmpfs','/tmp:rw,noexec,nosuid,nodev,size=64m','--env-file',envFile,'--entrypoint','node',storageImage,'dist/start/server.js']).stdout.trim();
 await save('server-state.json',{dbId,serverId,volume,readOnlyDatabase:true,readOnlyVolume:true,port:13006,migration});const serverConfig=inspect(serverId);assert.equal(serverConfig.HostConfig.NetworkMode,'container:'+dbId);assert.deepEqual(serverConfig.HostConfig.PortBindings??{},{});assert(serverConfig.Mounts.some(m=>m.Name===volume&&m.Destination==='/work'&&m.RW===false));
 const worker='potok_storage_get_'+suffix,bundle="import {readFileSync} from 'node:fs';const input=JSON.parse(readFileSync(0,'utf8'));try{console.log(JSON.stringify(await ("+readBinaryObjects.toString()+")(input)));}catch(e){console.error(e.message);process.exitCode=1;}";
 const workerId=docker(['create','--name',worker,'--pull','never','--interactive','--network','container:'+dbId,'--restart','no','--read-only','--cap-drop','ALL','--security-opt','no-new-privileges','--user','node','--entrypoint','node',nodeImage,'--input-type=module','--eval',bundle]).stdout.trim();await save('worker-state.json',{workerId,workerSha256:sha(bundle)});
 let run,interrupted=false;phase='http';try{docker(['start',serverId]);run=docker(['start','--attach','--interactive',workerId],{input:JSON.stringify({records:files.records,token}),allowFailure:true,timeout:300000});}catch{interrupted=true;}finally{
  try{if(inspect(workerId).State.Running)docker(['stop','--time','5',workerId],{allowFailure:true});}catch{interrupted=true;}
  docker(['stop','--time','10',serverId],{allowFailure:true});
 }
 await save('worker-status.log',(run?.stdout??'')+'\n'+(run?.stderr??''));const logs=docker(['logs',serverId],{allowFailure:true});await save('server-status.log',logs.stdout+'\n'+logs.stderr);
 phase='after';const after=query();await save('after.json',after);assert.deepEqual(after,before);assert.deepEqual(await verifyStorageFiles(base,after),files);
 phase='result';assert.equal(interrupted,false);assert.equal(run?.status,0);const result=JSON.parse(run.stdout.trim());assert.equal(result.protocol,'potok-storage-readonly-http-v1');assert.equal(result.files,63);await save('result.json',{...result,storageMetadataPreserved:true,originalFilesPreserved:true,dbId,serverId,volume});
 console.log('PRIVATE_STORAGE_READONLY_OK: 63 original objects served by actual Storage HTTP and SHA256 verified; original files/Storage catalog preserved. Read-only service stopped and retained. A/B upload/write/UI acceptance remains separate.');
}
if(process.argv[1]&&import.meta.url===pathToFileURL(path.resolve(process.argv[1])).href)main(process.argv.slice(2)).catch(()=>{console.error('PRIVATE_STORAGE_READONLY_STOPPED: phase='+phase+'; preserve private logs/volume; do not replay automatically.');process.exitCode=1;});
