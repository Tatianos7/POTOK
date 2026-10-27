import assert from 'node:assert/strict';
import {createServer} from 'node:http';
import {spawn} from 'node:child_process';
import {readFile} from 'node:fs/promises';
import {makeEnvironment,createAPIArgs,probeScript,validateAPI,apiName,port} from './private-api.mjs';
let passed=0;
const test=async(name,fn)=>{await fn();passed++;console.log('PASS '+name);};
await test('credentials are URI-encoded and HTTP/API exposure is explicitly bounded',()=>{
 const env=makeEnvironment('synthetic:@ /%password','a'.repeat(128));const uri=new URL(env.PGRST_DB_URI);
 assert.equal(decodeURIComponent(uri.password),'synthetic:@ /%password');assert.equal(uri.username,'authenticator');assert.equal(uri.hostname,'127.0.0.1');assert.equal(env.PGRST_DB_CONFIG,'false');assert.equal(env.PGRST_DB_SCHEMAS,'public');assert.equal(env.PGRST_DB_PRE_REQUEST,'');assert.equal(env.PGRST_SERVER_HOST,'127.0.0.1');
 assert.throws(()=>makeEnvironment('bad\nsecret','a'.repeat(128)));assert.throws(()=>makeEnvironment('synthetic','short'));
});
await test('create command shares the captured namespace without host ports or mounts and uses the actual executable',()=>{
 const args=createAPIArgs({name:apiName,dbId:'a'.repeat(64),imageId:'sha256:'+'b'.repeat(64),binary:'/bin/postgrest',envFile:'/private/api.env'});
 assert.equal(args[args.indexOf('--network')+1],'container:'+'a'.repeat(64));assert.equal(args[args.indexOf('--entrypoint')+1],'/bin/postgrest');assert(args.includes('--read-only'));assert(!args.some(v=>['-p','--publish','--mount','--volume','--net=host'].includes(v)));assert(!args.join(' ').includes('synthetic:@'));
 assert.throws(()=>createAPIArgs({name:apiName,dbId:'remote',imageId:'sha256:'+'b'.repeat(64),binary:'/bin/postgrest',envFile:'/private/api.env'}));
 assert.throws(()=>createAPIArgs({name:apiName,dbId:'a'.repeat(64),imageId:'sha256:'+'b'.repeat(64),binary:'--version',envFile:'/private/api.env'}));
});
await test('post-start guard rejects namespace substitution, published ports, mounts and writable root',()=>{
 const id='a'.repeat(64),image='sha256:'+'b'.repeat(64),db='c'.repeat(64),c={Id:id,Name:'/'+apiName,Image:image,State:{Running:true},HostConfig:{NetworkMode:'container:'+db,PortBindings:{},Privileged:false,ReadonlyRootfs:true},NetworkSettings:{Ports:{}},Mounts:[]};
 validateAPI(c,id,image,db);
 for(const change of [x=>x.HostConfig.NetworkMode='bridge',x=>x.HostConfig.PortBindings={'33001/tcp':[{HostPort:'33001'}]},x=>x.Mounts=[{Type:'bind'}],x=>x.HostConfig.ReadonlyRootfs=false]){const bad=structuredClone(c);change(bad);assert.throws(()=>validateAPI(bad,id,image,db));}
});
async function probe(code){const p=spawn(process.execPath,['--input-type=module'],{stdio:['pipe','pipe','pipe']});let out='',err='';p.stdout.on('data',b=>out+=b);p.stderr.on('data',b=>err+=b);p.stdin.end(code);const status=await new Promise(r=>p.on('close',r));return {out,err,status};}
let expose=false,wrongCode=false;
const server=createServer((req,res)=>{const schema=req.headers['accept-profile'];res.setHeader('Content-Type','application/json');if(schema&&!expose){res.statusCode=406;res.end(JSON.stringify({code:wrongCode?'wrong':'PGRST106'}));}else{res.statusCode=200;res.end('{"swagger":"2.0","private_metadata":"must_not_print"}');}});
await new Promise((resolve,reject)=>{server.once('error',reject);server.listen(port,'127.0.0.1',resolve);});
try{
 await test('HTTP probe emits status markers only, without schema metadata',async()=>{const r=await probe(probeScript());assert.equal(r.status,0);assert.equal(r.err,'');assert.equal(r.out.trim(),'PRIVATE_API_HTTP_READY_OK\nPRIVATE_API_SCHEMAS_CLOSED_OK');assert(!r.out.includes('must_not_print'));});
 await test('exposed private schema cannot yield success',async()=>{expose=true;const r=await probe(probeScript());assert.equal(r.status,1);assert.equal(r.out,'');assert.equal(r.err.trim(),'PRIVATE_API_HTTP_CHECK_FAILED');expose=false;});
 await test('unrelated 406 error is not accepted as the schema boundary',async()=>{wrongCode=true;assert.equal((await probe(probeScript())).status,1);wrongCode=false;});
}finally{await new Promise(resolve=>server.close(resolve));}
await test('credential and inspect operations are redacted before any log write',async()=>{const code=await readFile(new URL('private-api.mjs',import.meta.url),'utf8');assert.match(code,/privateOutput\?'Private operation output intentionally omitted/);assert.match(code,/run\(args,\{privateOutput:true\}\)/);assert.match(code,/printf %s[^\n]+privateOutput:true/);});
console.log('PRIVATE_API_UNIT_OK: '+passed+' cases; no private database contacted');
