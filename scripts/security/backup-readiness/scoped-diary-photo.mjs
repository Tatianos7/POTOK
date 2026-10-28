// Full isolated candidate only. SQL stays read-only; bounded ordinary-user HTTP writes.
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import path from 'node:path';
import {createHash,randomBytes,randomUUID} from 'node:crypto';
import {spawnSync} from 'node:child_process';
import {pathToFileURL} from 'node:url';
import {candidateCaptureSQL} from './candidate-rights.mjs';
import {protectedSnapshotSQL,assertReadPreservation} from './post-acl-reads.mjs';
import {validateWriteManifest,validateWriteInput,runScopedWrites,runScopedWriteWorker} from './scoped-writes.mjs';
import {rowSnapshotSQL,assertOriginalRows,identityScopeSQL} from '../accumulated/private-auth-ab.mjs';
import {verifyIdentityScope} from '../accumulated/private-browser-policy.mjs';
import {permissionQuery} from '../accumulated/checks.mjs';
import {followupFinalSQL} from '../accumulated/restored-twelve.mjs';
const sha=x=>createHash('sha256').update(x).digest('hex');
const literal=s=>"'"+s.replace(/'/g,"''")+"'";
const dbName='potok_security_candidate_2026-10-26',dbId='8ea4ab28ee60efd0c157ec0f6a9d1fa24f02ffd0c58b7a36c30a47a570785989';
const dbImage='sha256:40868dfbce8c3a901448991069b7bcabbe14e8f8105ef609af22afce79b2dc44';
const nodeImage='sha256:679e291fa23095eedbb71dfdb84ce79a4cb958afa2cda05738d596566ca36e75';
const mailHash='9bef14be1bf7aca68b59a6698b39df84c8aee27f79101921c37646335accdfe8';
async function regular(file){const s=await fs.lstat(file);assert(s.isFile()&&!s.isSymbolicLink());return fs.readFile(file,'utf8');}
let phase='admission';
export async function main(args){
 assert.equal(args.length,3);assert.equal(args[0],'--run-scoped-local');const base=await fs.realpath(args[1]),commit=await fs.realpath(args[2]);assert.equal(path.basename(base),'POTOK_BACKUP_2026-10-24');assert(commit.startsWith(base+path.sep));assert.match(path.basename(commit),/^private-browser-[A-Za-z0-9]+$/);
 const backups=(await regular(path.join(base,'SHA256SUMS.txt'))).trim().split(/\r?\n/),seen=new Set();for(const line of backups){const m=line.match(/^([a-f0-9]{64})\s+\*?(roles\.sql|schema\.sql|data\.sql)$/);assert(m&&!seen.has(m[2]));seen.add(m[2]);assert.equal(sha(await regular(path.join(base,m[2]))),m[1]);}assert.equal(seen.size,3);
 const browser=JSON.parse(await regular(path.join(commit,'result.json')));assert.equal(browser.profileBrowser,true);assert.equal(browser.originalRows,14888);assert.equal(browser.originalTables,112);assert.equal(browser.dbId,dbId);
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
 const matches=[];for(const d of await fs.readdir(base,{withFileTypes:true}))if(d.isDirectory()&&/^private-auth-ab-[A-Za-z0-9]+$/.test(d.name)){const folder=path.join(base,d.name);try{const state=JSON.parse(await regular(path.join(folder,'state.json'))),result=JSON.parse(await regular(path.join(folder,'result.json')));if(state.dbId===dbId&&state.apiId===containers.api.Id&&state.authId===containers.auth.Id)matches.push({folder,state,result});}catch{}}
 assert.equal(matches.length,1);const {state,result}=matches[0];assert.equal(browser.apiId,containers.api.Id);assert.equal(browser.authId,containers.auth.Id);assert.equal(result.originalRows,14888);assert.equal(result.mailCount,2);assert.deepEqual(result.users.map(u=>u.email),state.emails);
 const directory=await fs.mkdtemp(path.join(base,'scoped-diary-photo-'));await fs.chmod(directory,0o700);console.log('Private diary/photo evidence: '+directory);
 const save=(name,value)=>fs.writeFile(path.join(directory,name),typeof value==='string'?value:JSON.stringify(value,null,2),{mode:0o600,flag:'wx'});
 const sql=text=>docker(['exec','-i',dbId,'sh','-c','PGPASSWORD="$POSTGRES_PASSWORD" exec psql -X -w -qAt -h /tmp -U postgres -d postgres --set ON_ERROR_STOP=1'],{input:text}).stdout.trim();
 const query=text=>JSON.parse(sql("BEGIN ISOLATION LEVEL REPEATABLE READ READ ONLY;SET LOCAL search_path=pg_catalog,pg_temp;SET LOCAL timezone='UTC';SET LOCAL datestyle='ISO,YMD';SET LOCAL extra_float_digits=3;SET LOCAL statement_timeout='120s';"+text+';ROLLBACK;'));
 const capture=()=>({capture:JSON.parse(sql(candidateCaptureSQL(tables))),protected:query(protectedSnapshotSQL(tables,result.users))});
 const original=JSON.parse(await regular(path.join(matches[0].folder,'original-row-hashes.json')));assert.equal(original.length,112);assert.equal(original.reduce((n,t)=>n+t.hashes.length,0),14888);
 const checkOriginal=()=>{const current=query(rowSnapshotSQL(tables));assert.equal(assertOriginalRows(original,current).originalRows,14888);verifyIdentityScope(original,current,query(identityScopeSQL(result.users)));};
 const contracts=()=>{const r=query('SELECT to_jsonb(q) FROM ('+permissionQuery()+') q');assert(Object.values(r).every(v=>v===true));sql('BEGIN READ ONLY;'+followupFinalSQL+'ROLLBACK;');};
 phase='precheck';assert.equal(query("SELECT jsonb_build_array(current_user,(SELECT rolsuper FROM pg_roles WHERE rolname=current_user),current_setting('cron.launch_active_jobs'),current_setting('listen_addresses'))").join('|'),'postgres|false|off|127.0.0.1');checkOriginal();contracts();
 const before=capture();assert.equal(before.capture.authorityRows,0);assert.equal(before.protected.identitiesPresent,2);
 const remaining=JSON.parse(await regular(path.join(base,'candidate-rights-audit.WJJdws','remaining-original-extras.json')));assert.equal(remaining.length,211);assert.equal(new Set(remaining.map(r=>JSON.stringify([r.table,r.role,r.privilege]))).size,211);
 for(const r of remaining){assert.equal(r.direction,'extra_on_restored');assert.equal(before.capture.rights.find(v=>v.table_name===r.table&&v.role===r.role&&v.privilege===r.privilege)?.allowed,false);}
 const input={users:result.users,manifest:{protocol:'potok-scoped-write-manifest-v1',tag:randomBytes(12).toString('hex'),day:(2100+randomBytes(2).readUInt16BE()%900)+'-01-15',diaryIds:Array.from({length:3},()=>randomUUID())}};validateWriteInput(input);
 const ids=input.manifest.diaryIds.map(literal).join(','),owners=input.users.map(u=>literal(u.id)).join(','),day=literal(input.manifest.day);
 const absent=query("SELECT jsonb_build_array((SELECT count(*) FROM public.food_diary_entries WHERE id::text IN("+ids+")),(SELECT count(*) FROM public.measurement_photo_assets WHERE user_id::text IN("+owners+") AND day="+day+"::date),(SELECT count(*) FROM public.measurement_photo_deletions WHERE user_id::text IN("+owners+") AND day="+day+"::date))");assert.deepEqual(absent,[0,0,0]);
 await save('before.json',before);await save('write-manifest.json',input);
 const bundle="import assert from 'node:assert/strict';import {readFileSync} from 'node:fs';\n"+mail.slice(0,mail.indexOf('export async function runABWorker'))+'\n'+validateWriteManifest.toString()+'\n'+validateWriteInput.toString()+'\n'+runScopedWrites.toString()+'\n'+runScopedWriteWorker.toString()+"\ntry{const input=JSON.parse(readFileSync(0,'utf8'));console.log(JSON.stringify(await runScopedWriteWorker(input)));}catch(e){console.error(e.message);process.exitCode=1;}";
 const name='potok_scoped_writes_'+randomBytes(6).toString('hex');phase='worker-create';const workerId=docker(['create','--name',name,'--pull','never','--interactive','--network','container:'+dbId,'--restart','no','--read-only','--cap-drop','ALL','--security-opt','no-new-privileges','--user','node','--entrypoint','node',nodeImage,'--input-type=module','--eval',bundle]).stdout.trim();assert.match(workerId,/^[a-f0-9]{64}$/);await save('state.json',{dbId,apiId:containers.api.Id,authId:containers.auth.Id,workerId,workerSourceSha256:sha(bundle),dataApiWrites:true});
 let run;phase='http';try{run=docker(['start','--attach','--interactive',workerId],{input:JSON.stringify(input),allowFailure:true,timeout:180000});}finally{if(inspect(workerId).State.Running)docker(['stop','--time','10',workerId]);}
 await save('worker-status.log',(run?.stdout??'')+'\n'+(run?.stderr??''));
 phase='independent-after-proof';const after=capture();await save('after.json',after);assertReadPreservation(before,after);checkOriginal();contracts();const latest=checkContainers();assert.equal(latest.api.Id,containers.api.Id);assert.equal(latest.auth.Id,containers.auth.Id);
 phase='worker-result';assert.equal(run.status,0);const report=JSON.parse(run.stdout.trim());assert.equal(report.protocol,'potok-scoped-writes-v1');assert.equal(report.cleanup,true);assert.equal(report.diaryOwners,2);assert.equal(report.photoMetadataOwners,2);await save('result.json',{...report,originalRows:14888,preservedSelectedTables:112,permissionsPreserved:true});
 console.log('SCOPED_DIARY_PHOTO_OK: two existing OTP users; diary CRUD and photo metadata upserts/cleanup, foreign access denied; original rows, current protected contents and security preserved. No Storage binary, program or UI acceptance.');
}
if(process.argv[1]&&import.meta.url===pathToFileURL(path.resolve(process.argv[1])).href)main(process.argv.slice(2)).catch(()=>{console.error('SCOPED_DIARY_PHOTO_STOPPED: phase='+phase+'; preserve local evidence; do not recreate accounts or replay automatically.');process.exitCode=1;});
