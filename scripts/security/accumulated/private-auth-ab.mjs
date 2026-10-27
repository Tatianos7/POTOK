import assert from 'node:assert/strict';
import {spawnSync} from 'node:child_process';
import {randomBytes,createHash} from 'node:crypto';
import {readFile,writeFile,readdir,mkdtemp} from 'node:fs/promises';
import path from 'node:path';
import {pathToFileURL} from 'node:url';
import {validateTarget,candidateName,originalName,settingsSQL,finalSQL,fingerprintSQL,boundaryQuery} from './private-candidate.mjs';
import {parseCopyCounts} from './restored.mjs';
import {inputs} from './inputs.mjs';
import {followupInputs} from './restored-twelve.mjs';
import {apiName,validateAPI,probeScript,nodeTag} from './private-api.mjs';
import {authName,validateAuth,authArgs,authMetadataSQL,authEnvironment} from './private-auth.mjs';
export const workerName='potok_private_ab_worker_2026-10-27';
export const workerHash='9bef14be1bf7aca68b59a6698b39df84c8aee27f79101921c37646335accdfe8';
const sha=b=>createHash('sha256').update(b).digest('hex');
const quote=s=>'"'+s.replace(/"/g,'""')+'"';const literal=s=>"'"+s.replace(/'/g,"''")+"'";
const dependencies={
 'inputs.mjs':'16c171d0f2d94ca6d85307ca3a446e4a0c4db708f66fb3d76c05958ad396c2e2',
 'checks.mjs':'19680d53a99060839188854cc49ec5b72003a71bd1e71b06a0919aaba44bc4ee',
 'restored.mjs':'8b7936a4fbaed205fbdae20184e22ffa7c22a168ec25ff187524ee04cd752f42',
 'restored-twelve.mjs':'8d73465bb8f4d0a6e73e6c8f1dbc3f2bca2ee7e821b0504e34cdce4a5cf9c3a9',
 'private-candidate.mjs':'d86ff841ddf51215748c25125651e330de42cfbe06748956fc555d826ed7c8d7',
 'private-api.mjs':'d0f22949d3d589adacbb2c287d27796a02f02ff44ae0f68548f269301aa705c9',
 'private-auth.mjs':'7b0cac6cfe051bbd6641588b6f1da4f50d7fd2576427fd5272b36fe2577f78c8',
 'private-auth-ab-worker.mjs':workerHash,
};
export function rowSnapshotSQL(tables){
 assert(tables.length>0&&tables.length<=1000);assert.equal(new Set(tables.map(t=>t.schema+'.'+t.name)).size,tables.length);
 return `SELECT jsonb_agg(to_jsonb(q) ORDER BY schema,name) FROM (${tables.map(t=>{
  assert(['auth','public','storage'].includes(t.schema));assert(typeof t.name==='string'&&t.name.length>0);
  return `SELECT ${literal(t.schema)}::text AS schema,${literal(t.name)}::text AS name,coalesce(jsonb_agg(h ORDER BY h),'[]'::jsonb) AS hashes FROM (SELECT encode(sha256(convert_to(to_jsonb(t)::text,'UTF8')),'hex') AS h FROM ${quote(t.schema)}.${quote(t.name)} t) s`;
 }).join('\nUNION ALL\n')}) q`;
}
export function assertOriginalRows(before,after){
 assert.equal(before.length,after.length);assert.equal(new Set(after.map(t=>t.schema+'.'+t.name)).size,after.length);
 const allowed=new Set(['auth.users','auth.identities','auth.sessions','auth.refresh_tokens','auth.audit_log_entries','auth.one_time_tokens','auth.flow_state','public.user_profiles']);
 let originalRows=0,addedRows=0;
 for(const old of before){const now=after.find(t=>t.schema===old.schema&&t.name===old.name);assert(now);const counts=new Map();for(const h of now.hashes){assert.match(h,/^[a-f0-9]{64}$/);counts.set(h,(counts.get(h)??0)+1);}for(const h of old.hashes){assert((counts.get(h)??0)>0,'An original row changed or disappeared');counts.set(h,counts.get(h)-1);}const extra=now.hashes.length-old.hashes.length;assert(extra>=0);if(extra&&!allowed.has(old.schema+'.'+old.name))throw Error('Unexpected rows outside the synthetic Auth/profile scope');originalRows+=old.hashes.length;addedRows+=extra;}
 return {originalRows,addedRows};
}
export function templateEnvironment(base){
 assert.equal(base.GOTRUE_API_HOST,'127.0.0.1');assert.equal(base.GOTRUE_SMTP_HOST,'127.0.0.1');assert.equal(base.GOTRUE_SMTP_PORT,'11025');assert.equal(base.GOTRUE_MAILER_AUTOCONFIRM,'false');assert.equal(base.GOTRUE_DB_CLEANUP_ENABLED,'false');assert.equal(base.GOTRUE_INDEX_WORKER_ENSURE_USER_SEARCH_INDEXES_EXIST,'false');assert.equal(base.GOTRUE_INDEX_WORKER_MAX_USERS_THRESHOLD,'0');
 // Keep listeners outside the default Linux ephemeral TCP range (32768+).
 return {...base,PORT:'13002',GOTRUE_API_PORT:'13002',API_EXTERNAL_URL:'http://127.0.0.1:13002',GOTRUE_SITE_URL:'http://127.0.0.1:13003',GOTRUE_MAILER_TEMPLATES_CONFIRMATION:'http://127.0.0.1:13003/template',GOTRUE_MAILER_TEMPLATES_MAGIC_LINK:'http://127.0.0.1:13003/template'};
}
export function workerArgs({name,dbId,imageId,envFile,source}){
 assert.match(name,/^[a-z][a-z0-9_-]+$/);assert.match(dbId,/^[a-f0-9]{64}$/);assert.match(imageId,/^sha256:[a-f0-9]{64}$/);assert(path.isAbsolute(envFile));assert.equal(sha(source),workerHash);
 return ['create','--name',name,'--pull','never','--network','container:'+dbId,'--restart','no','--read-only','--cap-drop','ALL','--security-opt','no-new-privileges','--env-file',envFile,'--entrypoint','node',imageId,'--input-type=module','--eval',source+'\nawait runABWorker();'];
}
const local=s=>typeof s==='string'&&(s.startsWith('unix:///')||/^npipe:\/{2,}\.\/pipe\//.test(s));
const envFrom=values=>Object.fromEntries(values.map(s=>{const i=s.indexOf('=');assert(i>0);return[s.slice(0,i),s.slice(i+1)];}));
let phase='preflight',directory,op=0;
async function run(args,{input,privateOutput=false,allowFailure=false}={}){const r=spawnSync('docker',args,{input,encoding:'utf8',timeout:180000,maxBuffer:32*1024*1024});if(directory)await writeFile(path.join(directory,'operation-'+(++op)+'.log'),privateOutput?'Private output omitted.\n':(r.stdout??'')+'\n'+(r.stderr??''),{mode:0o600});if(!allowFailure)assert.equal(r.status,0,'Local operation failed');return r;}
const json=async args=>JSON.parse((await run(args,{privateOutput:true})).stdout);
async function backup(){const text=await readFile('SHA256SUMS.txt','utf8'),seen=new Set();for(const line of text.trim().split(/\r?\n/)){const m=line.match(/^([a-f0-9]{64})\s+\*?(roles\.sql|schema\.sql|data\.sql)$/);assert(m&&!seen.has(m[2]));seen.add(m[2]);assert.equal(sha(await readFile(m[2])),m[1]);}assert.equal(seen.size,3);return text;}
export async function main(){
 assert.deepEqual(process.argv.slice(2),['--run-private-auth-ab']);assert.equal(path.basename(process.cwd()),'POTOK_BACKUP_2026-10-24');assert(!process.env.DOCKER_HOST||local(process.env.DOCKER_HOST));assert(local(await json(['context','inspect','--format','{{json .Endpoints.docker.Host}}'])));
 for(const [file,digest] of Object.entries(dependencies))assert.equal(sha(await readFile(new URL(file,import.meta.url))),digest);const source=await readFile(new URL('private-auth-ab-worker.mjs',import.meta.url),'utf8');const boundary=boundaryQuery(await readFile(new URL('platform-boundary.sql',import.meta.url),'utf8')).trim().replace(/;$/,'');
 const manifest=await backup(),tables=parseCopyCounts(await readFile('data.sql','utf8'));assert.equal(tables.length,112);assert.equal(tables.reduce((n,t)=>n+t.rows,0),14888);
 const inspectDB=async()=>{const c=(await json(['inspect',candidateName]))[0],o=(await json(['inspect',originalName]))[0],v=(await json(['volume','inspect',candidateName]))[0];const id=validateTarget(c,o,v);assert.deepEqual((await run(['ps','-aq','--no-trunc','--filter','volume='+candidateName])).stdout.trim().split(/\r?\n/),[id]);return id;};
 const dbId=await inspectDB(),auth=(await json(['inspect',authName]))[0],api=(await json(['inspect',apiName]))[0];validateAuth(auth,auth.Id,auth.Image,dbId);
 assert.notEqual((await run(['container','inspect',workerName],{allowFailure:true})).status,0,'AB worker already exists');
 const states=[];for(const name of await readdir('.'))if(/^private-auth-[A-Za-z0-9]+$/.test(name)){try{const state=JSON.parse(await readFile(path.join(name,'state.json'),'utf8'));if(state.dbId===dbId&&state.authId===auth.Id)states.push({name,state});}catch{}}assert.equal(states.length,1);const {name:authDirectory,state:authState}=states[0];assert.equal(auth.Image,authState.imageId);assert(/^private-api-[A-Za-z0-9]+$/.test(authState.apiDirectory));
 const apiState=JSON.parse(await readFile(path.join(authState.apiDirectory,'state.json'),'utf8'));validateAPI(api,apiState.apiId,apiState.restImage,dbId);assert(/^private-candidate-install-[A-Za-z0-9]+$/.test(apiState.receipt));
 assert.deepEqual(JSON.parse(await readFile(path.join(apiState.receipt,'public-inputs.json'),'utf8')),[...inputs,...followupInputs]);const baseline=JSON.parse(await readFile(path.join(apiState.receipt,'baseline-fingerprints.json'),'utf8'));
 const baseEnv=envFrom((await readFile(path.join(authDirectory,'auth.env'),'utf8')).trim().split('\n')),liveEnv=envFrom(auth.Config.Env);for(const [k,v] of Object.entries(baseEnv))assert.equal(liveEnv[k],v);
 const apiEnv=envFrom(api.Config.Env);assert.equal(baseEnv.GOTRUE_JWT_SECRET,apiEnv.PGRST_JWT_SECRET);const uri=new URL(baseEnv.GOTRUE_DB_DATABASE_URL);assert.equal(uri.username,'supabase_auth_admin');assert.equal(uri.hostname,'127.0.0.1');assert.deepEqual(baseEnv,authEnvironment(decodeURIComponent(uri.password),apiEnv.PGRST_JWT_SECRET));
 const environment=templateEnvironment(baseEnv);const node=(await json(['image','inspect',nodeTag]))[0];assert.equal(node.Id,apiState.nodeImage);const authImage=(await json(['image','inspect',auth.Image]))[0];const binary=authImage.Config.Entrypoint?.[0]??authImage.Config.Cmd?.[0];assert(/(?:^|\/)(auth|gotrue)$/.test(binary));
 directory=await mkdtemp(path.join(process.cwd(),'private-auth-ab-'));console.log('Private A/B evidence folder: '+directory);
 const sql=async(text,parse=false)=>{const r=await run(['exec','-i',dbId,'sh','-c','PGPASSWORD="$POSTGRES_PASSWORD" exec psql -X -w -h /tmp -U postgres -d postgres --set ON_ERROR_STOP=1 --quiet --tuples-only --no-align'],{input:text,privateOutput:parse});return parse?JSON.parse(r.stdout.trim()):r.stdout;};
 const query=statement=>sql(`${settingsSQL}BEGIN READ ONLY;${statement};ROLLBACK;`,true);
 const runtime=`DO $runtime$ BEGIN IF current_setting('cron.launch_active_jobs')<>'off' OR current_setting('listen_addresses')<>'127.0.0.1' OR current_setting('data_directory')<>'/var/lib/postgresql/data' THEN RAISE EXCEPTION 'Isolation changed';END IF;END $runtime$;`;
 phase='before-check';await sql(`${settingsSQL}BEGIN READ ONLY;${runtime}${finalSQL(tables,baseline,boundary)}ROLLBACK;`);const before=await query(rowSnapshotSQL(tables)),metadata=await query(authMetadataSQL);assert.equal(before.reduce((n,t)=>n+t.hashes.length,0),14888);
 await writeFile(path.join(directory,'original-row-hashes.json'),JSON.stringify(before),{mode:0o600});const tag=randomBytes(12).toString('hex'),emails=['potok-ab-'+tag+'-a@example.test','potok-ab-'+tag+'-b@example.test'];
 await writeFile(path.join(directory,'test-identities.json'),JSON.stringify({emails}),{mode:0o600});const workerEnv=path.join(directory,'worker.env');await writeFile(workerEnv,'TEST_EMAIL_A='+emails[0]+'\nTEST_EMAIL_B='+emails[1]+'\n',{mode:0o600});const authEnv=path.join(directory,'auth.env');await writeFile(authEnv,Object.entries(environment).map(([k,v])=>k+'='+v).join('\n')+'\n',{mode:0o600});
 const ephemeral=(await run(['exec',dbId,'cat','/proc/sys/net/ipv4/ip_local_port_range'])).stdout.trim().split(/\s+/).map(Number);assert.equal(ephemeral.length,2);assert(ephemeral.every(Number.isInteger));for(const p of [11025,13002,13003])assert(p<ephemeral[0]||p>ephemeral[1],'Listener overlaps ephemeral TCP range');
 const oldName=authName+'_before_ab_'+auth.Id.slice(0,12);assert.equal(await inspectDB(),dbId);const state={dbId,apiId:api.Id,oldAuthId:auth.Id,oldName,authId:null,workerId:null,authPort:13002,templatePort:13003,authDirectory,apiDirectory:authState.apiDirectory,emails};const checkpoint=()=>writeFile(path.join(directory,'state.json'),JSON.stringify(state,null,2),{mode:0o600});await checkpoint();phase='auth-reconfigure';await run(['stop','--time','30',auth.Id]);await run(['rename',auth.Id,oldName]);
 const workerId=(await run(workerArgs({name:workerName,dbId,imageId:node.Id,envFile:workerEnv,source}))).stdout.trim();assert.match(workerId,/^[a-f0-9]{64}$/);state.workerId=workerId;await checkpoint();await run(['start',workerId]);
 const newAuthId=(await run(authArgs({name:authName,dbId,imageId:auth.Image,binary,envFile:authEnv}))).stdout.trim();assert.match(newAuthId,/^[a-f0-9]{64}$/);state.authId=newAuthId;await checkpoint();await run(['start',newAuthId]);
 phase='worker-wait';const exit=(await run(['wait',workerId])).stdout.trim();const logs=await run(['logs',workerId],{privateOutput:true});const output=(logs.stdout??'')+'\n'+(logs.stderr??'');await writeFile(path.join(directory,'worker-status.log'),output,{mode:0o600});
 phase='original-data-check';const after=await query(rowSnapshotSQL(tables));const preserved=assertOriginalRows(before,after);assert.equal(preserved.originalRows,14888);assert.deepEqual(await query(authMetadataSQL),metadata);console.log('PRIVATE_AB_ORIGINAL_ROWS_OK: 14888 original rows preserved.');
 const currentTables=tables.map(t=>({...t,rows:after.find(s=>s.schema===t.schema&&s.name===t.name).hashes.length}));const currentFingerprint=await query(fingerprintSQL(currentTables));await sql(`${settingsSQL}BEGIN READ ONLY;${runtime}${finalSQL(currentTables,currentFingerprint,boundary)}ROLLBACK;`);
 validateAuth((await json(['inspect',authName]))[0],newAuthId,auth.Image,dbId);validateAPI((await json(['inspect',apiName]))[0],api.Id,apiState.restImage,dbId);assert.equal(await inspectDB(),dbId);assert.equal(await backup(),manifest);
 phase='worker-result';if(exit!=='0'){const failure=output.match(/^PRIVATE_AUTH_AB_HTTP_FAILED: stage=([a-zA-Z0-9_-]{1,80})$/m);if(failure)phase+='-'+failure[1];}assert.equal(exit,'0');assert(output.includes('PRIVATE_AUTH_AB_HTTP_OK'));const line=output.split(/\r?\n/).find(l=>l.startsWith('{"users":'));assert(line);const result=JSON.parse(line);assert.deepEqual(result.users.map(u=>u.email),emails);assert.equal(result.users.length,2);assert.equal(result.mailCount,2);for(const [schema,name] of [['auth','users'],['public','user_profiles']])assert.equal(after.find(t=>t.schema===schema&&t.name===name).hashes.length-before.find(t=>t.schema===schema&&t.name===name).hashes.length,2);await writeFile(path.join(directory,'result.json'),JSON.stringify({...result,...preserved},null,2),{mode:0o600});
 console.log('PRIVATE_AUTH_AB_OK: real OTP for two synthetic users; own profile works, foreign access and protected writes denied; original rows/schema preserved. Synthetic accounts remain local for later tests. UI acceptance is pending.');
}
if(process.argv[1]&&import.meta.url===pathToFileURL(path.resolve(process.argv[1])).href)main().catch(()=>{console.error('PRIVATE_AUTH_AB_STOPPED: phase='+phase+'. Do not repeat; preserve local identities/evidence and stopped Auth backup.');process.exitCode=1;});
