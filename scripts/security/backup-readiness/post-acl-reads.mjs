// Existing private candidate only. No installer, signing key or Data API writes.
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import path from 'node:path';
import {createHash,randomBytes} from 'node:crypto';
import {spawnSync} from 'node:child_process';
import {pathToFileURL} from 'node:url';
import {candidateCaptureSQL} from './candidate-rights.mjs';
import {createMailCapture} from '../accumulated/private-auth-ab-worker.mjs';
const sha=x=>createHash('sha256').update(x).digest('hex');
const dbName='potok_security_candidate_2026-10-26',dbId='8ea4ab28ee60efd0c157ec0f6a9d1fa24f02ffd0c58b7a36c30a47a570785989';
const dbImage='sha256:40868dfbce8c3a901448991069b7bcabbe14e8f8105ef609af22afce79b2dc44';
const nodeImage='sha256:679e291fa23095eedbb71dfdb84ce79a4cb958afa2cda05738d596566ca36e75';
const mailHash='9bef14be1bf7aca68b59a6698b39df84c8aee27f79101921c37646335accdfe8';
export function validateReadInput(input){
 assert.equal(input.users.length,2);assert.equal(new Set(input.users.map(u=>u.id)).size,2);
 for(const [i,u] of input.users.entries()){assert.match(u.id,/^[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}$/);assert.match(u.email,new RegExp('^potok-ab-[a-f0-9]{24}-'+['a','b'][i]+'@example\\.test$'));}
 assert.equal(input.users[0].email.slice(0,33),input.users[1].email.slice(0,33));
 assert.equal(input.selects.length,162);const keys=new Set();
 for(const r of input.selects){assert.match(r.table_name,/^[a-z_][a-z0-9_]*$/);assert(['anon','authenticated'].includes(r.role));assert.equal(typeof r.allowed,'boolean');keys.add(JSON.stringify([r.table_name,r.role]));}
 assert.equal(keys.size,162);const names=input.selects.filter(r=>r.role==='anon').map(r=>r.table_name).sort();assert.equal(names.length,81);assert(names.includes('user_profiles'));assert.deepEqual(input.selects.filter(r=>r.role==='authenticated').map(r=>r.table_name).sort(),names);
}
export async function runExistingReadWorker(input,{captureFactory=createMailCapture,request=fetch}={}){
 validateReadInput(input);const capture=captureFactory(input.users.map(u=>u.email));let stage='capture',started=false;const users=[];
 const check=x=>{if(!x)throw Error('Unexpected response');};
 const call=async(base,route,body,token)=>{const r=await request(base+route,{method:body===undefined?'GET':'POST',headers:{'Content-Type':'application/json',...(base.endsWith('33001/')?{'Accept-Profile':'public'}:{}),...(token?{Authorization:'Bearer '+token}:{})},...(body===undefined?{}:{body:JSON.stringify(body)}),redirect:'error',signal:AbortSignal.timeout(10000)});return {status:r.status,body:await r.json()};};
 const auth=(route,body,token)=>call('http://127.0.0.1:13002/',route,body,token);
 const api=(route,token)=>call('http://127.0.0.1:33001/',route,undefined,token);
 try{
  await capture.start();started=true;
  for(const [i,u] of input.users.entries()){
   stage='otp-request-'+i;check((await auth('otp',{email:u.email,create_user:false})).status===200);
   stage='otp-delivery-'+i;for(let n=0;!capture.codes.has(u.email)&&n<100;n++)await new Promise(r=>setTimeout(r,100));let code=capture.codes.get(u.email);check(/^\d{6}$/.test(code??''));capture.codes.delete(u.email);
   stage='otp-verify-'+i;const v=await auth('verify',{email:u.email,token:code,type:'email'});code=null;
   check(v.status===200&&v.body.user?.id===u.id&&v.body.user.email===u.email&&typeof v.body.access_token==='string');
   const token=v.body.access_token,claims=JSON.parse(Buffer.from(token.split('.')[1],'base64url'));check(claims.sub===u.id&&claims.role==='authenticated');
   const current=await auth('user',undefined,token);check(current.status===200&&current.body.id===u.id);users.push({...u,token});
  }
  for(const [i,u] of users.entries()){
   stage='own-profile-'+i;const own=await api('user_profiles?select=id_user,is_admin,has_premium&id_user=eq.'+u.id,u.token);
   check(own.status===200&&Array.isArray(own.body)&&own.body.length===1&&own.body[0].id_user===u.id&&own.body[0].is_admin===false&&own.body[0].has_premium===false);
   stage='foreign-profile-'+i;const foreign=await api('user_profiles?select=id_user&id_user=eq.'+users[1-i].id,u.token);check(foreign.status===200&&Array.isArray(foreign.body)&&foreign.body.length===0);
  }
  let observations=0;
  for(const identity of [null,...users])for(const r of input.selects.filter(r=>r.role===(identity?'authenticated':'anon'))){
   stage='table-read-'+observations;const v=await api(r.table_name+'?select=*&limit=0',identity?.token);
   if(r.allowed)check(v.status===200&&Array.isArray(v.body)&&v.body.length===0);
   else check([401,403].includes(v.status)&&v.body?.code==='42501');observations++;
  }
  stage='mail-scope';check(capture.rejected===0&&input.users.every(u=>capture.counts.get(u.email)===1));
  return {protocol:'potok-post-acl-existing-reads-v1',users:2,tableReadObservations:observations,ownProfiles:2,foreignProfilesDenied:2,dataApiWrites:false,uiAcceptance:false,releaseReady:false};
 }catch{throw Error('POST_ACL_READ_WORKER_STOPPED: '+stage);}
 finally{users.forEach(u=>u.token=null);capture.codes.clear();if(started||capture.smtp)await capture.close();}
}
const literal=s=>"'"+s.replace(/'/g,"''")+"'",quote=s=>'"'+s.replace(/"/g,'""')+'"';
export function protectedSnapshotSQL(tables,users){
 validateReadInput({users,selects:Array.from({length:81},(_,i)=>i===0?'user_profiles':'pad_'+i).flatMap(table_name=>['anon','authenticated'].map(role=>({table_name,role,allowed:true})))});
 assert.equal(tables.length,112);assert.equal(new Set(tables.map(t=>t.schema+'.'+t.name)).size,112);
 const ids=users.map(u=>literal(u.id)).join(',');
 const scoped={users:`id::text IN(${ids})`,identities:`user_id::text IN(${ids})`,sessions:`user_id::text IN(${ids})`,refresh_tokens:`user_id::text IN(${ids})`,one_time_tokens:`user_id::text IN(${ids})`,flow_state:`user_id::text IN(${ids})`,audit_log_entries:`payload->>'actor_id' IN(${ids})`,mfa_amr_claims:`session_id IN(SELECT id FROM auth.sessions WHERE user_id::text IN(${ids}))`};
 const query=t=>{assert(['auth','public','storage'].includes(t.schema));assert.match(t.name,/^[a-z_][a-z0-9_]*$/);return `SELECT ${literal(t.schema)} AS schema,${literal(t.name)} AS name,count(*)::text AS rows,encode(sha256(convert_to(coalesce(string_agg(h,'' ORDER BY h),''),'UTF8')),'hex') AS hash FROM (SELECT encode(sha256(convert_to(to_jsonb(t)::text,'UTF8')),'hex') AS h FROM ${quote(t.schema)}.${quote(t.name)} t ${t.schema==='auth'&&scoped[t.name]?'WHERE NOT coalesce(('+scoped[t.name]+'),false)':''}) s`;};
 return `SELECT jsonb_build_object('protected',(SELECT jsonb_agg(to_jsonb(q) ORDER BY schema,name) FROM (${tables.map(query).join('\nUNION ALL\n')}) q),'userIds',(SELECT encode(sha256(convert_to(coalesce(jsonb_agg(id ORDER BY id),'[]'::jsonb)::text,'UTF8')),'hex') FROM auth.users),'identitiesPresent',(SELECT count(*) FROM auth.users WHERE ${users.map(u=>'(id::text='+literal(u.id)+' AND lower(email)='+literal(u.email)+')').join(' OR ')}),'authMetadata',(SELECT encode(sha256(convert_to(jsonb_build_object('relations',(SELECT jsonb_agg(to_jsonb(c) ORDER BY c.oid) FROM pg_class c WHERE c.relnamespace='auth'::regnamespace),'columns',(SELECT jsonb_agg(to_jsonb(a) ORDER BY a.attrelid,a.attnum) FROM pg_attribute a JOIN pg_class c ON c.oid=a.attrelid WHERE c.relnamespace='auth'::regnamespace),'routines',(SELECT jsonb_agg(to_jsonb(p) ORDER BY p.oid) FROM pg_proc p WHERE p.pronamespace='auth'::regnamespace))::text,'UTF8')),'hex'))) AS evidence`;
}
export function assertReadPreservation(before,after){
 assert.equal(before.protected.identitiesPresent,2);assert.equal(after.protected.identitiesPresent,2);assert.deepEqual(after.protected,before.protected);
 for(const key of ['aclSha256','columnAclSha256','shapeSha256','rights','tables','clientRoles','candidateNamespaces','actor','actorSuper','replicationRole','authorityRows'])assert.deepEqual(after.capture[key],before.capture[key]);
 assert.equal(after.capture.authorityRows,0);assert.equal(after.capture.actorSuper,false);assert.equal(after.capture.candidateNamespaces,3);
}
async function regular(file){const s=await fs.lstat(file);assert(s.isFile()&&!s.isSymbolicLink());return fs.readFile(file,'utf8');}
let phase='admission';
export async function main(args){
 assert.equal(args.length,3);assert.equal(args[0],'--run-existing-private');const base=await fs.realpath(args[1]),commit=await fs.realpath(args[2]);assert.equal(path.basename(base),'POTOK_BACKUP_2026-10-24');assert(commit.startsWith(base+path.sep));assert.match(path.basename(commit),/^commit-check\.[A-Za-z0-9]+$/);
 assert((await regular(path.join(commit,'commit-checks.log'))).includes('CANDIDATE_ACL_COMMIT_RETURNED'));assert(/^CANDIDATE_ACL_COMMITTED_VERIFIED_OK$/m.test(await regular(path.join(commit,'verify-output.log'))));
 const plan=path.dirname(commit),manifest=JSON.parse(await regular(path.join(plan,'manifest.json')));assert.equal(manifest.protocol,'potok-candidate-acl-plans-v1');assert.equal(manifest.candidateName,dbName);assert.equal(manifest.revokes,211);assert.equal(manifest.hostedApplyAllowed,false);
 const verify=await regular(path.join(plan,'verify.sql'));assert.equal(sha(verify),manifest.hashes['verify.sql']);
 const mail=await regular(new URL('../accumulated/private-auth-ab-worker.mjs',import.meta.url));assert.equal(sha(mail),mailHash);
 const inventory=JSON.parse(await regular(new URL('inventory-20261027.json',import.meta.url))),excluded=new Set(inventory.exclusions.map(t=>t.schema+'.'+t.name));const tables=inventory.tables.filter(t=>!excluded.has(t.schema+'.'+t.name)).map(({schema,name})=>({schema,name}));assert.equal(tables.length,112);
 const endpointResult=spawnSync('docker',['context','inspect','desktop-linux','--format','{{.Endpoints.docker.Host}}'],{encoding:'utf8',timeout:15000});assert.equal(endpointResult.status,0);const endpoint=endpointResult.stdout.trim();assert(endpoint.startsWith('unix:///'));
 const docker=(args,{input,allowFailure=false,timeout=180000}={})=>{const r=spawnSync('docker',['--host',endpoint,...args],{encoding:'utf8',input,timeout,maxBuffer:32*1024*1024});if(!allowFailure)assert.equal(r.status,0,'Local operation stopped');return r;};
 const inspect=name=>JSON.parse(docker(['inspect',name]).stdout)[0],env=c=>Object.fromEntries(c.Config.Env.map(x=>{const i=x.indexOf('=');return [x.slice(0,i),x.slice(i+1)];}));
 const checkContainers=()=>{const db=inspect(dbName);assert.equal(db.Id,dbId);assert.equal(db.Image,dbImage);assert.equal(db.State.Running,true);assert.equal(db.HostConfig.NetworkMode,'none');assert.deepEqual(db.HostConfig.PortBindings??{},{});assert.equal(db.HostConfig.Privileged,false);assert(db.Mounts.some(m=>m.Type==='volume'&&m.Name===dbName&&m.Destination==='/var/lib/postgresql/data'));
 const api=inspect('potok_private_rest_2026-10-27'),auth=inspect('potok_private_auth_2026-10-27');for(const c of [api,auth]){assert.equal(c.State.Running,true);assert.equal(c.HostConfig.NetworkMode,'container:'+dbId);assert.deepEqual(c.HostConfig.PortBindings??{},{});}return {api,auth};};
 const containers=checkContainers(),apiEnv=env(containers.api),authEnv=env(containers.auth);assert.equal(apiEnv.PGRST_SERVER_HOST,'127.0.0.1');assert.equal(apiEnv.PGRST_SERVER_PORT,'33001');assert.equal(apiEnv.PGRST_DB_SCHEMAS,'public');assert.equal(apiEnv.PGRST_DB_ANON_ROLE,'anon');assert.equal(apiEnv.PGRST_DB_CONFIG,'false');
 assert.equal(authEnv.GOTRUE_API_HOST,'127.0.0.1');assert.equal(authEnv.GOTRUE_API_PORT,'13002');assert.equal(authEnv.GOTRUE_SMTP_HOST,'127.0.0.1');assert.equal(authEnv.GOTRUE_SMTP_PORT,'11025');assert.equal(authEnv.GOTRUE_MAILER_AUTOCONFIRM,'false');assert.equal(authEnv.GOTRUE_DB_CLEANUP_ENABLED,'false');assert.equal(authEnv.GOTRUE_JWT_SECRET,apiEnv.PGRST_JWT_SECRET);
 for(const [value,user] of [[apiEnv.PGRST_DB_URI,'authenticator'],[authEnv.GOTRUE_DB_DATABASE_URL,'supabase_auth_admin']]){const uri=new URL(value);assert.equal(uri.hostname,'127.0.0.1');assert.equal(uri.username,user);assert.equal(uri.pathname,'/postgres');}
 const matches=[];for(const d of await fs.readdir(base,{withFileTypes:true}))if(d.isDirectory()&&/^private-auth-ab-[A-Za-z0-9]+$/.test(d.name)){const folder=path.join(base,d.name);try{const state=JSON.parse(await regular(path.join(folder,'state.json'))),result=JSON.parse(await regular(path.join(folder,'result.json')));if(state.dbId===dbId&&state.apiId===containers.api.Id&&state.authId===containers.auth.Id)matches.push({state,result});}catch{}}
 assert.equal(matches.length,1);const {state,result}=matches[0];assert.equal(result.originalRows,14888);assert.equal(result.mailCount,2);assert.deepEqual(result.users.map(u=>u.email),state.emails);
 const directory=await fs.mkdtemp(path.join(base,'post-acl-existing-reads-'));await fs.chmod(directory,0o700);console.log('Private read-check evidence: '+directory);
 const save=(name,value)=>fs.writeFile(path.join(directory,name),typeof value==='string'?value:JSON.stringify(value,null,2),{mode:0o600,flag:'wx'});
 const sql=text=>docker(['exec','-i',dbId,'sh','-c','PGPASSWORD="$POSTGRES_PASSWORD" exec psql -X -w -qAt -h /tmp -U postgres -d postgres --set ON_ERROR_STOP=1'],{input:text}).stdout.trim();
 const query=text=>JSON.parse(sql("BEGIN ISOLATION LEVEL REPEATABLE READ READ ONLY;SET LOCAL search_path=pg_catalog,pg_temp;SET LOCAL timezone='UTC';SET LOCAL datestyle='ISO,YMD';SET LOCAL extra_float_digits=3;SET LOCAL statement_timeout='120s';"+text+';ROLLBACK;'));
 const capture=()=>({capture:JSON.parse(sql(candidateCaptureSQL(tables))),protected:query(protectedSnapshotSQL(tables,result.users))});
 phase='precheck';assert(sql(verify).includes('CANDIDATE_ACL_COMMITTED_VERIFIED_OK'));assert.equal(query("SELECT jsonb_build_array(current_user,(SELECT rolsuper FROM pg_roles WHERE rolname=current_user),current_setting('cron.launch_active_jobs'),current_setting('listen_addresses'))").join('|'),'postgres|false|off|127.0.0.1');
 const before=capture(),input={users:result.users,selects:before.capture.rights.filter(r=>r.privilege==='SELECT'&&r.role!=='service_role').map(({table_name,role,allowed})=>({table_name,role,allowed}))};validateReadInput(input);assert.equal(before.protected.identitiesPresent,2);await save('before.json',before);
 const ownSource=await regular(new URL('post-acl-reads.mjs',import.meta.url));const worker=mail.slice(0,mail.indexOf('export async function runABWorker'))+'\n'+validateReadInput.toString()+'\n'+runExistingReadWorker.toString()+"\nconst input=JSON.parse(requireInput());try{const result=await runExistingReadWorker(input);console.log(JSON.stringify(result));}catch(e){console.error(e.message);process.exitCode=1;}";
 assert(ownSource.includes(runExistingReadWorker.toString()));const bundle="import assert from 'node:assert/strict';import {readFileSync} from 'node:fs';const requireInput=()=>readFileSync(0,'utf8');\n"+worker;
 const name='potok_post_acl_reads_'+randomBytes(6).toString('hex');phase='worker-create';const workerId=docker(['create','--name',name,'--pull','never','--interactive','--network','container:'+dbId,'--restart','no','--read-only','--cap-drop','ALL','--security-opt','no-new-privileges','--user','node','--entrypoint','node',nodeImage,'--input-type=module','--eval',bundle]).stdout.trim();assert.match(workerId,/^[a-f0-9]{64}$/);await save('state.json',{dbId,apiId:containers.api.Id,authId:containers.auth.Id,workerId,workerSourceSha256:sha(bundle),dataApiWrites:false});
 let run;phase='http';try{run=docker(['start','--attach','--interactive',workerId],{input:JSON.stringify(input),allowFailure:true,timeout:180000});}finally{if(inspect(workerId).State.Running)docker(['stop','--time','10',workerId]);}
 await save('worker-status.log',(run?.stdout??'')+'\n'+(run?.stderr??''));
 phase='independent-after-proof';const after=capture();await save('after.json',after);assertReadPreservation(before,after);const latest=checkContainers();assert.equal(latest.api.Id,containers.api.Id);assert.equal(latest.auth.Id,containers.auth.Id);
 phase='worker-result';assert.equal(run.status,0);const report=JSON.parse(run.stdout.trim());assert.equal(report.protocol,'potok-post-acl-existing-reads-v1');assert.equal(report.tableReadObservations,243);assert.equal(report.ownProfiles,2);assert.equal(report.foreignProfilesDenied,2);await save('result.json',{...report,preservedSelectedTables:112,authUserIdsPreserved:true,protectedRowsPreserved:true,permissionsPreserved:true});
 console.log('POST_ACL_EXISTING_READS_OK: existing two-user OTP; own/foreign profile checks; 243 table-read permission observations; protected contents/metadata and account IDs preserved. No Data API writes or UI acceptance.');
}
if(process.argv[1]&&import.meta.url===pathToFileURL(path.resolve(process.argv[1])).href)main(process.argv.slice(2)).catch(()=>{console.error('POST_ACL_EXISTING_READS_STOPPED: phase='+phase+'; preserve local evidence; do not recreate accounts or replay automatically.');process.exitCode=1;});
