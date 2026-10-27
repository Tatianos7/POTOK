import assert from 'node:assert/strict';
import {spawnSync} from 'node:child_process';
import {createHash,randomBytes} from 'node:crypto';
import {readFile,writeFile,readdir,mkdtemp} from 'node:fs/promises';
import path from 'node:path';
import {pathToFileURL} from 'node:url';
import {validateTarget,candidateName,originalName,settingsSQL,finalSQL,boundaryQuery} from './private-candidate.mjs';
import {parseCopyCounts} from './restored.mjs';
import {inputs} from './inputs.mjs';
import {followupInputs} from './restored-twelve.mjs';

export const apiName='potok_private_rest_2026-10-27';
export const restTag='postgrest/postgrest:v16.5';
export const nodeTag='node:24.22.1-alpine3.23';
export const port=33001;
const hash=b=>createHash('sha256').update(b).digest('hex');
const dependencies={
 'inputs.mjs':'16c171d0f2d94ca6d85307ca3a446e4a0c4db708f66fb3d76c05958ad396c2e2',
 'checks.mjs':'19680d53a99060839188854cc49ec5b72003a71bd1e71b06a0919aaba44bc4ee',
 'restored.mjs':'8b7936a4fbaed205fbdae20184e22ffa7c22a168ec25ff187524ee04cd752f42',
 'restored-twelve.mjs':'8d73465bb8f4d0a6e73e6c8f1dbc3f2bca2ee7e821b0504e34cdce4a5cf9c3a9',
 'private-candidate.mjs':'d86ff841ddf51215748c25125651e330de42cfbe06748956fc555d826ed7c8d7',
};
export function makeEnvironment(password,secret){
 assert(typeof password==='string'&&password.length>0&&!/[\r\n\0]/.test(password));
 assert.match(secret,/^[a-f0-9]{128}$/);
 return {
  PGRST_DB_URI:'postgresql://authenticator:'+encodeURIComponent(password)+'@127.0.0.1:5432/postgres?sslmode=disable',
  PGRST_DB_CONFIG:'false',PGRST_DB_SCHEMAS:'public',PGRST_DB_ANON_ROLE:'anon',
  PGRST_DB_PRE_REQUEST:'',PGRST_DB_EXTRA_SEARCH_PATH:'public',
  PGRST_DB_CHANNEL_ENABLED:'false',PGRST_DB_POOL:'3',PGRST_DB_MAX_ROWS:'1000',
  PGRST_JWT_SECRET:secret,PGRST_SERVER_HOST:'127.0.0.1',PGRST_SERVER_PORT:String(port),
  PGRST_OPENAPI_MODE:'follow-privileges',PGRST_LOG_LEVEL:'error',GHCRTS:'-N2',
 };
}
export function createAPIArgs({name,dbId,imageId,binary,envFile}){
 assert.match(name,/^[a-z][a-z0-9_-]+$/);assert.match(dbId,/^[a-f0-9]{64}$/);assert.match(imageId,/^sha256:[a-f0-9]{64}$/);
 assert(/(?:^|\/)postgrest$/.test(binary));assert(path.isAbsolute(envFile));
 return ['create','--pull','never','--name',name,'--network','container:'+dbId,
 '--restart','no','--read-only','--cap-drop','ALL','--security-opt','no-new-privileges',
 '--env-file',envFile,'--entrypoint',binary,imageId];
}
export function probeScript(){return `
const sleep=ms=>new Promise(r=>setTimeout(r,ms));
const base='http://127.0.0.1:${port}';
async function request(headers={}){return fetch(base+'/',{headers,redirect:'error',signal:AbortSignal.timeout(3000)});}
try{
 let ready=false;
 for(let i=0;i<30;i++){try{const r=await request();if(r.status===200){await r.body?.cancel();ready=true;break;}await r.body?.cancel();}catch{}await sleep(1000);}
 if(!ready)throw Error('NOT_READY');
 for(const schema of ['extensions','potok_delivery']){
  const r=await request({'Accept-Profile':schema});
  if(r.status!==406)throw Error('SCHEMA_EXPOSED');
  const body=await r.json();if(body.code!=='PGRST106')throw Error('WRONG_SCHEMA_ERROR');
 }
 console.log('PRIVATE_API_HTTP_READY_OK');
 console.log('PRIVATE_API_SCHEMAS_CLOSED_OK');
}catch{console.error('PRIVATE_API_HTTP_CHECK_FAILED');process.exitCode=1;}
`;}
export function validateAPI(c,id,imageId,dbId){
 assert.equal(c.Id,id);assert.equal(c.Name,'/'+apiName);assert.equal(c.Image,imageId);assert(c.State.Running);
 assert.equal(c.HostConfig.NetworkMode,'container:'+dbId);
 assert.deepEqual(c.HostConfig.PortBindings??{},{});assert(Object.values(c.NetworkSettings.Ports??{}).every(v=>v===null));
 assert.deepEqual(c.Mounts,[]);assert.equal(c.HostConfig.Privileged,false);assert.equal(c.HostConfig.ReadonlyRootfs,true);
}
const local=s=>typeof s==='string'&&(s.startsWith('unix:///')||/^npipe:\/{2,}\.\/pipe\//.test(s));
let phase='preflight',directory,operation=0;
async function run(args,{input,allowFailure=false,privateOutput=false}={}){
 const r=spawnSync('docker',args,{input,encoding:'utf8',timeout:180000,maxBuffer:16*1024*1024});
 if(directory)await writeFile(path.join(directory,'operation-'+(++operation)+'.log'),privateOutput?'Private operation output intentionally omitted.\n':(r.stdout??'')+'\n'+(r.stderr??''),{mode:0o600});
 if(!allowFailure)assert.equal(r.status,0,'Local operation failed');return r;
}
// Inspect payloads may contain Env/credentials. Parse in memory; never log them.
const json=async args=>JSON.parse((await run(args,{privateOutput:true})).stdout);
async function backup(){
 const manifest=await readFile('SHA256SUMS.txt','utf8'),seen=new Set();
 for(const l of manifest.trim().split(/\r?\n/)){const m=l.match(/^([a-f0-9]{64})\s+\*?(roles\.sql|schema\.sql|data\.sql)$/);assert(m&&!seen.has(m[2]));seen.add(m[2]);assert.equal(hash(await readFile(m[2])),m[1]);}
 assert.equal(seen.size,3);return manifest;
}
export async function main(){
 assert.deepEqual(process.argv.slice(2),['--start-private-api']);assert.equal(path.basename(process.cwd()),'POTOK_BACKUP_2026-10-24');
 assert(!process.env.DOCKER_HOST||local(process.env.DOCKER_HOST));assert(local(await json(['context','inspect','--format','{{json .Endpoints.docker.Host}}'])));
 for(const [file,digest] of Object.entries(dependencies))assert.equal(hash(await readFile(new URL(file,import.meta.url))),digest);
 const boundary=boundaryQuery(await readFile(new URL('platform-boundary.sql',import.meta.url),'utf8')).trim().replace(/;$/,'');
 const manifest=await backup(),tables=parseCopyCounts(await readFile('data.sql','utf8'));assert.equal(tables.length,112);assert.equal(tables.reduce((n,t)=>n+t.rows,0),14888);
 const inspectDB=async()=>{
  const target=(await json(['inspect','--type','container',candidateName]))[0],original=(await json(['inspect','--type','container',originalName]))[0],volume=(await json(['volume','inspect',candidateName]))[0];
  const id=validateTarget(target,original,volume);assert.deepEqual((await run(['ps','-aq','--no-trunc','--filter','volume='+candidateName])).stdout.trim().split(/\r?\n/),[id]);return id;
 };
 const dbId=await inspectDB();assert.notEqual((await run(['container','inspect',apiName],{allowFailure:true})).status,0,'API already exists; do not restart blindly');
 const receipts=[];
 for(const name of await readdir('.'))if(/^private-candidate-install-[A-Za-z0-9]+$/.test(name)){
  try{if((await readFile(path.join(name,'sql-4.log'),'utf8')).includes('PRIVATE_CANDIDATE_COMMITTED_OK'))receipts.push(name);}catch{}
 }
 assert.equal(receipts.length,1,'Expected one successful private installation receipt');
 assert.deepEqual(JSON.parse(await readFile(path.join(receipts[0],'public-inputs.json'),'utf8')),[...inputs,...followupInputs]);
 const fingerprint=JSON.parse(await readFile(path.join(receipts[0],'baseline-fingerprints.json'),'utf8'));
 const verify=`${settingsSQL}BEGIN READ ONLY;${finalSQL(tables,fingerprint,boundary)}
 DO $runtime$ BEGIN IF current_setting('cron.launch_active_jobs')<>'off' OR current_setting('listen_addresses')<>'127.0.0.1' OR current_setting('data_directory')<>'/var/lib/postgresql/data' THEN RAISE EXCEPTION 'Isolation changed';END IF;END $runtime$;ROLLBACK;`;
 directory=await mkdtemp(path.join(process.cwd(),'private-api-'));console.log('Private API evidence folder: '+directory);
 const verifyDB=()=>run(['exec','-i',dbId,'sh','-c','PGPASSWORD="$POSTGRES_PASSWORD" exec psql -X -w -h /tmp -U postgres -d postgres --set ON_ERROR_STOP=1 --quiet'],{input:verify});
 phase='committed-state-check';await verifyDB();
 phase='images';const rest=(await json(['image','inspect',restTag]))[0],node=(await json(['image','inspect',nodeTag]))[0];
 for(const image of [rest,node]){assert.match(image.Id,/^sha256:[a-f0-9]{64}$/);assert.equal(image.Architecture,'arm64');}
 const binary=rest.Config.Entrypoint?.[0]??rest.Config.Cmd?.[0];assert(/(?:^|\/)postgrest$/.test(binary));
 assert.equal((await run(['run','--rm','--network','none','--entrypoint',binary,rest.Id,'--version'])).stdout.trim(),'PostgREST 16.5');
 assert.equal((await run(['run','--rm','--network','none','--entrypoint','node',node.Id,'--version'])).stdout.trim(),'v24.22.1');
 phase='private-configuration';
 const password=(await run(['exec',dbId,'sh','-c','printf %s "$POSTGRES_PASSWORD"'],{privateOutput:true})).stdout;
 const environment=makeEnvironment(password,randomBytes(64).toString('hex'));
 const envFile=path.join(directory,'api.env');await writeFile(envFile,Object.entries(environment).map(([k,v])=>k+'='+v).join('\n')+'\n',{mode:0o600});
 assert.equal(await inspectDB(),dbId);assert.equal(await backup(),manifest);
 phase='api-create';const apiId=(await run(createAPIArgs({name:apiName,dbId,imageId:rest.Id,binary,envFile}))).stdout.trim();assert.match(apiId,/^[a-f0-9]{64}$/);
 await writeFile(path.join(directory,'state.json'),JSON.stringify({dbId,apiId,restImage:rest.Id,nodeImage:node.Id,port,receipt:receipts[0]},null,2),{mode:0o600});
 await run(['start',apiId]);
 const checkAPI=async()=>{const c=(await json(['inspect','--type','container',apiId]))[0];validateAPI(c,apiId,rest.Id,dbId);};
 await checkAPI();phase='http-check';
 const probe=await run(['run','--rm','-i','--pull','never','--network','container:'+dbId,'--read-only','--cap-drop','ALL','--security-opt','no-new-privileges','--entrypoint','node',node.Id,'--input-type=module'],{input:probeScript()});
 assert.equal(probe.stdout.trim(),'PRIVATE_API_HTTP_READY_OK\nPRIVATE_API_SCHEMAS_CLOSED_OK');
 phase='post-check';await checkAPI();assert.equal(await inspectDB(),dbId);await verifyDB();assert.equal(await backup(),manifest);
 console.log('PRIVATE_API_READY_OK: HTTP works; extensions/private projection schemas closed; 112 original tables preserved. Auth/A-B/application acceptance is not yet run.');
}
if(process.argv[1]&&import.meta.url===pathToFileURL(path.resolve(process.argv[1])).href)main().catch(()=>{
 console.error('PRIVATE_API_STOPPED: phase='+phase+'. Do not repeat startup; keep evidence and credentials private.');process.exitCode=1;
});
