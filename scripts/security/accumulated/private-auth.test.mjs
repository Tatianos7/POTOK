import assert from 'node:assert/strict';
import {createServer} from 'node:http';
import {spawn} from 'node:child_process';
import {authEnvironment,authArgs,validateAuth,authName,authPort,authProbe} from './private-auth.mjs';
let passed=0;const test=async(name,fn)=>{await fn();passed++;console.log('PASS '+name);};
await test('Auth shares only the supplied local JWT key and connects as the nonsuperuser service role',()=>{
 const env=authEnvironment('synthetic:@ /%','a'.repeat(128)),uri=new URL(env.GOTRUE_DB_DATABASE_URL);assert.equal(uri.username,'supabase_auth_admin');assert.equal(uri.hostname,'127.0.0.1');assert.equal(uri.pathname,'/postgres');assert.equal(decodeURIComponent(uri.password),'synthetic:@ /%');assert.equal(env.GOTRUE_JWT_SECRET,'a'.repeat(128));assert.equal(env.GOTRUE_API_HOST,'127.0.0.1');assert.equal(env.GOTRUE_SMTP_HOST,'127.0.0.1');assert.equal(env.GOTRUE_MAILER_AUTOCONFIRM,'false');assert.equal(env.GOTRUE_EXTERNAL_PHONE_ENABLED,'false');assert.equal(env.GOTRUE_SMTP_LOGGING_ENABLED,'false');assert.throws(()=>authEnvironment('bad\npassword','a'.repeat(128)));assert.throws(()=>authEnvironment('synthetic','short'));
});
await test('background cleanup, index creation, template refresh and external telemetry are explicitly disabled',()=>{
 const e=authEnvironment('synthetic','a'.repeat(128));for(const k of ['GOTRUE_DB_CLEANUP_ENABLED','GOTRUE_INDEX_WORKER_ENSURE_USER_SEARCH_INDEXES_EXIST','GOTRUE_MAILER_TEMPLATE_RELOADING_ENABLED','GOTRUE_METRICS_ENABLED','GOTRUE_TRACING_ENABLED','GOTRUE_PROFILER_ENABLED','GOTRUE_PASSWORD_HIBP_ENABLED'])assert.equal(e[k],'false');assert.equal(e.GOTRUE_INDEX_WORKER_MAX_USERS_THRESHOLD,'0');
});
await test('explicit serve cannot accidentally become the default root or migrate command',()=>{
 const args=authArgs({name:authName,dbId:'a'.repeat(64),imageId:'sha256:'+'b'.repeat(64),binary:'/usr/local/bin/auth',envFile:'/private/auth.env'});assert.equal(args.at(-1),'serve');assert(!args.includes('migrate'));assert.equal(args[args.indexOf('--network')+1],'container:'+'a'.repeat(64));assert(!args.includes('--publish'));assert(!args.includes('--mount'));assert(args.includes('--read-only'));
});
await test('running-container checks reject a root command, network or port substitution',()=>{
 const id='a'.repeat(64),db='b'.repeat(64),image='sha256:'+'c'.repeat(64),c={Id:id,Name:'/'+authName,Image:image,State:{Running:true},Config:{Cmd:['serve']},HostConfig:{NetworkMode:'container:'+db,PortBindings:{},Privileged:false,ReadonlyRootfs:true},Mounts:[],NetworkSettings:{Ports:{}}};validateAuth(c,id,image,db);
 for(const change of [x=>x.Config.Cmd=[],x=>x.Config.Cmd=['migrate'],x=>x.HostConfig.NetworkMode='bridge',x=>x.Mounts=[{Type:'bind'}],x=>x.HostConfig.PortBindings={'33002/tcp':[{HostPort:'33002'}]}]){const bad=structuredClone(c);change(bad);assert.throws(()=>validateAuth(bad,id,image,db));}
});
let version='v2.197.0';const server=createServer((req,res)=>{res.setHeader('Content-Type','application/json');res.end(JSON.stringify({version,private_value:'not_for_output'}));});await new Promise((resolve,reject)=>{server.once('error',reject);server.listen(authPort,'127.0.0.1',resolve);});
async function probe(script){const c=spawn(process.execPath,['--input-type=module'],{stdio:['pipe','pipe','pipe']});let out='',err='';c.stdout.on('data',b=>out+=b);c.stderr.on('data',b=>err+=b);c.stdin.end(script);const status=await new Promise(r=>c.on('close',r));return {status,out,err};}
try{
 await test('health probe validates exact version and prints only a technical marker',async()=>{const r=await probe(authProbe());assert.equal(r.status,0);assert.equal(r.out.trim(),'PRIVATE_AUTH_HTTP_READY_OK');assert.equal(r.err,'');assert(!r.out.includes('not_for_output'));});
 await test('wrong Auth version cannot pass readiness',async()=>{version='v0.0.0';const r=await probe(authProbe().replace('i<30','i<1').replace('sleep(1000)','sleep(1)'));assert.equal(r.status,1);assert.equal(r.out,'');assert.equal(r.err.trim(),'PRIVATE_AUTH_HTTP_CHECK_FAILED');});
}finally{await new Promise(r=>server.close(r));}
console.log('PRIVATE_AUTH_UNIT_OK: '+passed+' cases; no private database contacted');
