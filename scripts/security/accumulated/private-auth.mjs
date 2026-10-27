import assert from 'node:assert/strict';
import {spawnSync} from 'node:child_process';
import {createHash} from 'node:crypto';
import {readFile,writeFile,readdir,mkdtemp} from 'node:fs/promises';
import path from 'node:path';
import {pathToFileURL} from 'node:url';
import {validateTarget,candidateName,originalName,settingsSQL,finalSQL,boundaryQuery} from './private-candidate.mjs';
import {parseCopyCounts} from './restored.mjs';
import {inputs} from './inputs.mjs';
import {followupInputs} from './restored-twelve.mjs';
import {apiName,validateAPI,probeScript,nodeTag} from './private-api.mjs';
export const authName='potok_private_auth_2026-10-27';
export const authTag='public.ecr.aws/supabase/gotrue:v2.197.0';
export const authPort=33002;
const hash=b=>createHash('sha256').update(b).digest('hex');
const dependencies={
 'inputs.mjs':'16c171d0f2d94ca6d85307ca3a446e4a0c4db708f66fb3d76c05958ad396c2e2',
 'checks.mjs':'19680d53a99060839188854cc49ec5b72003a71bd1e71b06a0919aaba44bc4ee',
 'restored.mjs':'8b7936a4fbaed205fbdae20184e22ffa7c22a168ec25ff187524ee04cd752f42',
 'restored-twelve.mjs':'8d73465bb8f4d0a6e73e6c8f1dbc3f2bca2ee7e821b0504e34cdce4a5cf9c3a9',
 'private-candidate.mjs':'d86ff841ddf51215748c25125651e330de42cfbe06748956fc555d826ed7c8d7',
 'private-api.mjs':'d0f22949d3d589adacbb2c287d27796a02f02ff44ae0f68548f269301aa705c9',
};
export function authEnvironment(password,key){
 assert(typeof password==='string'&&password.length>0&&!/[\r\n\0]/.test(password));assert.match(key,/^[a-f0-9]{128}$/);
 return {
  GOTRUE_API_HOST:'127.0.0.1',PORT:String(authPort),GOTRUE_API_PORT:String(authPort),API_EXTERNAL_URL:'http://127.0.0.1:'+authPort,
  GOTRUE_SITE_URL:'http://127.0.0.1:33003',GOTRUE_DB_DRIVER:'postgres',GOTRUE_DB_NAMESPACE:'auth',
  GOTRUE_DB_DATABASE_URL:'postgresql://supabase_auth_admin:'+encodeURIComponent(password)+'@127.0.0.1:5432/postgres?sslmode=disable',
  GOTRUE_DB_MAX_POOL_SIZE:'3',GOTRUE_DB_CLEANUP_ENABLED:'false',
  GOTRUE_INDEX_WORKER_ENSURE_USER_SEARCH_INDEXES_EXIST:'false',GOTRUE_INDEX_WORKER_MAX_USERS_THRESHOLD:'0',
  GOTRUE_MAILER_TEMPLATE_RELOADING_ENABLED:'false',GOTRUE_MAILER_EMAIL_BACKGROUND_SENDING:'false',
  GOTRUE_JWT_SECRET:key,GOTRUE_JWT_EXP:'3600',GOTRUE_JWT_AUD:'authenticated',
  GOTRUE_JWT_DEFAULT_GROUP_NAME:'authenticated',GOTRUE_JWT_ADMIN_ROLES:'service_role',
  GOTRUE_EXTERNAL_EMAIL_ENABLED:'true',GOTRUE_EXTERNAL_PHONE_ENABLED:'false',GOTRUE_DISABLE_SIGNUP:'false',
  GOTRUE_MAILER_AUTOCONFIRM:'false',GOTRUE_SMS_AUTOCONFIRM:'false',
  GOTRUE_SMTP_HOST:'127.0.0.1',GOTRUE_SMTP_PORT:'11025',GOTRUE_SMTP_ADMIN_EMAIL:'local-probe@potok.invalid',
  GOTRUE_SMTP_SENDER_NAME:'POTOK private acceptance',GOTRUE_SMTP_LOGGING_ENABLED:'false',
  GOTRUE_MAILER_OTP_LENGTH:'6',GOTRUE_MAILER_OTP_EXP:'3600',
  GOTRUE_PASSWORD_HIBP_ENABLED:'false',GOTRUE_SECURITY_CAPTCHA_ENABLED:'false',
  GOTRUE_LOG_LEVEL:'error',GOTRUE_TRACING_ENABLED:'false',GOTRUE_METRICS_ENABLED:'false',GOTRUE_PROFILER_ENABLED:'false',
 };
}
export function authArgs({name,dbId,imageId,binary,envFile}){
 assert.match(name,/^[a-z][a-z0-9_-]+$/);assert.match(dbId,/^[a-f0-9]{64}$/);assert.match(imageId,/^sha256:[a-f0-9]{64}$/);assert(/(?:^|\/)(auth|gotrue)$/.test(binary));assert(path.isAbsolute(envFile));
 return ['create','--pull','never','--name',name,'--network','container:'+dbId,'--restart','no','--read-only','--cap-drop','ALL','--security-opt','no-new-privileges','--env-file',envFile,'--entrypoint',binary,imageId,'serve'];
}
export function validateAuth(c,id,image,db){
 assert.equal(c.Id,id);assert.equal(c.Name,'/'+authName);assert.equal(c.Image,image);assert(c.State.Running);
 assert.equal(c.HostConfig.NetworkMode,'container:'+db);assert.deepEqual(c.Config.Cmd,['serve']);
 assert.deepEqual(c.Mounts,[]);assert.deepEqual(c.HostConfig.PortBindings??{},{});assert(Object.values(c.NetworkSettings.Ports??{}).every(v=>v===null));assert.equal(c.HostConfig.Privileged,false);assert.equal(c.HostConfig.ReadonlyRootfs,true);
}
export const authMetadataSQL=`SELECT jsonb_build_object(
 'relations',(SELECT jsonb_agg(jsonb_build_array(c.oid,c.relname,c.relkind,c.relowner,c.relacl,c.relrowsecurity,c.relforcerowsecurity) ORDER BY c.oid) FROM pg_class c WHERE c.relnamespace='auth'::regnamespace),
 'columns',(SELECT jsonb_agg(jsonb_build_array(a.attrelid,a.attnum,a.attname,a.atttypid,a.atttypmod,a.attnotnull,a.attidentity,a.attgenerated,pg_get_expr(d.adbin,d.adrelid)) ORDER BY a.attrelid,a.attnum) FROM pg_attribute a JOIN pg_class c ON c.oid=a.attrelid LEFT JOIN pg_attrdef d ON d.adrelid=a.attrelid AND d.adnum=a.attnum WHERE c.relnamespace='auth'::regnamespace AND a.attnum>0 AND NOT a.attisdropped),
 'indexes',(SELECT jsonb_agg(jsonb_build_array(i.indexrelid,i.indisvalid,i.indisready,pg_get_indexdef(i.indexrelid)) ORDER BY i.indexrelid) FROM pg_index i JOIN pg_class c ON c.oid=i.indrelid WHERE c.relnamespace='auth'::regnamespace),
 'constraints',(SELECT jsonb_agg(jsonb_build_array(oid,convalidated,pg_get_constraintdef(oid)) ORDER BY oid) FROM pg_constraint WHERE connamespace='auth'::regnamespace),
 'functions',(SELECT jsonb_agg(jsonb_build_array(oid,proowner,proacl,proconfig,md5(prosrc),prosecdef,pg_get_function_arguments(oid),pg_get_function_result(oid)) ORDER BY oid) FROM pg_proc WHERE pronamespace='auth'::regnamespace),
 'triggers',(SELECT jsonb_agg(jsonb_build_array(t.oid,t.tgenabled,pg_get_triggerdef(t.oid)) ORDER BY t.oid) FROM pg_trigger t JOIN pg_class c ON c.oid=t.tgrelid WHERE c.relnamespace='auth'::regnamespace)
 ) AS state`;
export function authProbe(){return `
const sleep=ms=>new Promise(r=>setTimeout(r,ms));
try{
 let ready=false;for(let i=0;i<30;i++){try{const r=await fetch('http://127.0.0.1:${authPort}/health',{redirect:'error',signal:AbortSignal.timeout(3000)});if(r.status===200){const b=await r.json();if(b.version==='v2.197.0'){ready=true;break;}}}catch{}await sleep(1000);}
 if(!ready)throw Error('NOT_READY');console.log('PRIVATE_AUTH_HTTP_READY_OK');
}catch{console.error('PRIVATE_AUTH_HTTP_CHECK_FAILED');process.exitCode=1;}
`;}
const local=s=>typeof s==='string'&&(s.startsWith('unix:///')||/^npipe:\/{2,}\.\/pipe\//.test(s));
let phase='preflight',directory,op=0;
async function run(args,{input,privateOutput=false,allowFailure=false}={}){
 const r=spawnSync('docker',args,{input,encoding:'utf8',timeout:180000,maxBuffer:16*1024*1024});
 if(directory)await writeFile(path.join(directory,'operation-'+(++op)+'.log'),privateOutput?'Private output omitted.\n':(r.stdout??'')+'\n'+(r.stderr??''),{mode:0o600});if(!allowFailure)assert.equal(r.status,0,'Local operation failed');return r;
}
const json=async args=>JSON.parse((await run(args,{privateOutput:true})).stdout);
async function backup(){const text=await readFile('SHA256SUMS.txt','utf8'),seen=new Set();for(const line of text.trim().split(/\r?\n/)){const m=line.match(/^([a-f0-9]{64})\s+\*?(roles\.sql|schema\.sql|data\.sql)$/);assert(m&&!seen.has(m[2]));seen.add(m[2]);assert.equal(hash(await readFile(m[2])),m[1]);}assert.equal(seen.size,3);return text;}
export async function main(){
 assert.deepEqual(process.argv.slice(2),['--start-private-auth']);assert.equal(path.basename(process.cwd()),'POTOK_BACKUP_2026-10-24');assert(!process.env.DOCKER_HOST||local(process.env.DOCKER_HOST));assert(local(await json(['context','inspect','--format','{{json .Endpoints.docker.Host}}'])));
 for(const [file,digest] of Object.entries(dependencies))assert.equal(hash(await readFile(new URL(file,import.meta.url))),digest);
 const boundary=boundaryQuery(await readFile(new URL('platform-boundary.sql',import.meta.url),'utf8')).trim().replace(/;$/,'');const manifest=await backup(),tables=parseCopyCounts(await readFile('data.sql','utf8'));assert.equal(tables.length,112);assert.equal(tables.reduce((n,t)=>n+t.rows,0),14888);
 const inspectDB=async()=>{const c=(await json(['inspect','--type','container',candidateName]))[0],original=(await json(['inspect','--type','container',originalName]))[0],v=(await json(['volume','inspect',candidateName]))[0];const id=validateTarget(c,original,v);assert.deepEqual((await run(['ps','-aq','--no-trunc','--filter','volume='+candidateName])).stdout.trim().split(/\r?\n/),[id]);return id;};
 const dbId=await inspectDB();assert.notEqual((await run(['container','inspect',authName],{allowFailure:true})).status,0);
 const states=[];for(const name of await readdir('.'))if(/^private-api-[A-Za-z0-9]+$/.test(name)){try{const state=JSON.parse(await readFile(path.join(name,'state.json'),'utf8'));if(state.dbId===dbId)states.push({name,state});}catch{}}
 assert.equal(states.length,1);const {name:apiDirectory,state}=states[0];assert(/^private-candidate-install-[A-Za-z0-9]+$/.test(state.receipt));
 assert((await readFile(path.join(state.receipt,'sql-4.log'),'utf8')).includes('PRIVATE_CANDIDATE_COMMITTED_OK'));assert.deepEqual(JSON.parse(await readFile(path.join(state.receipt,'public-inputs.json'),'utf8')),[...inputs,...followupInputs]);
 const fingerprint=JSON.parse(await readFile(path.join(state.receipt,'baseline-fingerprints.json'),'utf8'));
 const api=(await json(['inspect','--type','container',apiName]))[0];validateAPI(api,state.apiId,state.restImage,dbId);
 const savedEnv=Object.fromEntries((await readFile(path.join(apiDirectory,'api.env'),'utf8')).trim().split('\n').map(line=>{const i=line.indexOf('=');assert(i>0);return [line.slice(0,i),line.slice(i+1)];}));
 const actualEnv=Object.fromEntries(api.Config.Env.map(line=>{const i=line.indexOf('=');return [line.slice(0,i),line.slice(i+1)];}));for(const [k,v] of Object.entries(savedEnv))assert.equal(actualEnv[k],v);
 const uri=new URL(savedEnv.PGRST_DB_URI);assert.equal(uri.hostname,'127.0.0.1');assert.equal(uri.port,'5432');assert.equal(uri.username,'authenticator');assert.equal(uri.pathname,'/postgres');
 const environment=authEnvironment(decodeURIComponent(uri.password),savedEnv.PGRST_JWT_SECRET);
 directory=await mkdtemp(path.join(process.cwd(),'private-auth-'));console.log('Private Auth evidence folder: '+directory);
 const sql=async(text,parse=false)=>{const r=await run(['exec','-i',dbId,'sh','-c','PGPASSWORD="$POSTGRES_PASSWORD" exec psql -X -w -h /tmp -U postgres -d postgres --set ON_ERROR_STOP=1 --quiet --tuples-only --no-align'],{input:text,privateOutput:parse});return parse?JSON.parse(r.stdout.trim()):r.stdout;};
 const verify=`${settingsSQL}BEGIN READ ONLY;${finalSQL(tables,fingerprint,boundary)}DO $runtime$ BEGIN IF current_setting('cron.launch_active_jobs')<>'off' OR current_setting('listen_addresses')<>'127.0.0.1' THEN RAISE EXCEPTION 'Isolation changed';END IF;END $runtime$;ROLLBACK;`;
 phase='committed-state-check';await sql(verify);const metadata=await sql(`${settingsSQL}BEGIN READ ONLY;${authMetadataSQL};ROLLBACK;`,true);
 const node=(await json(['image','inspect',nodeTag]))[0],image=(await json(['image','inspect',authTag]))[0];assert.equal(node.Id,state.nodeImage);assert.equal(image.Architecture,'arm64');assert.match(image.Id,/^sha256:[a-f0-9]{64}$/);const binary=image.Config.Entrypoint?.[0]??image.Config.Cmd?.[0];assert(/(?:^|\/)(auth|gotrue)$/.test(binary));
 phase='image-version';assert.equal((await run(['run','--rm','--network','none','--entrypoint',binary,image.Id,'version'])).stdout.trim(),'v2.197.0');
 const worker=code=>run(['run','--rm','-i','--pull','never','--network','container:'+dbId,'--read-only','--cap-drop','ALL','--security-opt','no-new-privileges','--entrypoint','node',node.Id,'--input-type=module'],{input:code});await worker(probeScript());
 await writeFile(path.join(directory,'auth-metadata-before.json'),JSON.stringify(metadata,null,2),{mode:0o600});const envFile=path.join(directory,'auth.env');await writeFile(envFile,Object.entries(environment).map(([k,v])=>k+'='+v).join('\n')+'\n',{mode:0o600});
 assert.equal(await inspectDB(),dbId);assert.equal(await backup(),manifest);
 phase='auth-create';const authId=(await run(authArgs({name:authName,dbId,imageId:image.Id,binary,envFile}))).stdout.trim();assert.match(authId,/^[a-f0-9]{64}$/);await writeFile(path.join(directory,'state.json'),JSON.stringify({dbId,authId,imageId:image.Id,apiDirectory,port:authPort},null,2),{mode:0o600});await run(['start',authId]);
 const check=async()=>{const c=(await json(['inspect','--type','container',authId]))[0];validateAuth(c,authId,image.Id,dbId);const env=Object.fromEntries(c.Config.Env.map(s=>{const i=s.indexOf('=');return [s.slice(0,i),s.slice(i+1)];}));for(const [k,v] of Object.entries(environment))assert.equal(env[k],v);};
 phase='auth-http';await check();assert.equal((await worker(authProbe())).stdout.trim(),'PRIVATE_AUTH_HTTP_READY_OK');
 phase='post-check';await check();await sql(verify);assert.deepEqual(await sql(`${settingsSQL}BEGIN READ ONLY;${authMetadataSQL};ROLLBACK;`,true),metadata);assert.equal(await inspectDB(),dbId);validateAPI((await json(['inspect','--type','container',apiName]))[0],state.apiId,state.restImage,dbId);await worker(probeScript());assert.equal(await backup(),manifest);
 console.log('PRIVATE_AUTH_READY_OK: explicit serve, no migrations, Auth schema/original contents unchanged. No OTP/A-B/UI acceptance yet.');
}
if(process.argv[1]&&import.meta.url===pathToFileURL(path.resolve(process.argv[1])).href)main().catch(()=>{console.error('PRIVATE_AUTH_STOPPED: phase='+phase+'. Do not repeat startup; keep private evidence/env files local.');process.exitCode=1;});
