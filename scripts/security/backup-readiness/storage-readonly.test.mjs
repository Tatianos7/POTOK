import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import path from 'node:path';
import os from 'node:os';
import {createHash} from 'node:crypto';
import {spawnSync} from 'node:child_process';
import {pathToFileURL} from 'node:url';
import {readonlyURL,storageEnvironment,seedBackend,readBinaryObjects} from './storage-readonly.mjs';
const hash=b=>createHash('sha256').update(b).digest('hex');
const records=()=>Array.from({length:63},(_,i)=>({bucket:['measurements-photos','recipe-photos','user-exercise-media'][i%3],name:'synthetic/'+i+'.png',version:i%2===0?null:'11111111-1111-4111-8111-111111111111',bytes:String(Buffer.byteLength('file '+i)),sha256:hash('file '+i),mimetype:'image/png'}));
const configuration=()=>({password:'synthetic:@p?word',secret:'a'.repeat(64),serviceKey:'abc.def.ghi',anonKey:'abc.def.xyz',migration:'test-migration'});
test('all database URLs require readonly; freeze/checksum/no-role-install, local file/loopback and background flags are explicit',()=>{
 const v=configuration(),e=storageEnvironment(v),url=new URL(e.DATABASE_URL);assert.equal(decodeURIComponent(url.password),v.password);assert.equal(url.hostname,'127.0.0.1');assert.equal(url.username,'supabase_storage_admin');assert.equal(url.pathname,'/postgres');assert.match(url.searchParams.get('options'),/default_transaction_read_only=on/);assert.equal(e.DATABASE_POOL_URL,e.DATABASE_URL);assert.equal(e.DB_MIGRATIONS_FREEZE_AT,v.migration);assert.equal(e.DB_ALLOW_MIGRATION_REFRESH,'false');assert.equal(e.DB_INSTALL_ROLES,'false');assert.equal(e.PG_QUEUE_ENABLE,'false');assert.equal(e.VECTOR_STORE_MIGRATIONS_ENABLED,'false');assert.equal(e.SERVER_HOST,'127.0.0.1');assert.equal(e.FILE_STORAGE_BACKEND_PATH,'/work/backend');assert.equal(e.TUS_USE_FILE_VERSION_SEPARATOR,'true');assert.equal(e.S3_PROTOCOL_ENABLED,'false');
 assert.throws(()=>readonlyURL('pw\nHOST=evil'));assert.throws(()=>storageEnvironment({...v,migration:'x; DROP'}));assert.throws(()=>storageEnvironment({...v,secret:'x\nEVIL=x'}));
});
test('seeding binds versioned backend layout, rejects traversal/collision/tamper and does not alter staged source bytes',async()=>{
 const root=await fs.mkdtemp(path.join(os.tmpdir(),'potok-storage-seed-test-')),r=records(),attributes=[];try{
  for(let i=0;i<r.length;i++){const file=path.join(root,'incoming',r[i].bucket,r[i].bucket,r[i].name);await fs.mkdir(path.dirname(file),{recursive:true});await fs.writeFile(file,'file '+i);}
  const result=await seedBackend(root,r,{setAttribute:async(...args)=>attributes.push(args)});assert.equal(result.files,63);assert.equal(attributes.length,126);
  for(let i=0;i<r.length;i++){const item=r[i],file=path.join(root,'backend/stub/stub',item.bucket,item.name+(item.version?'-$v-'+item.version:''));assert.equal(hash(await fs.readFile(file)),item.sha256);assert.equal((await fs.stat(file)).mode&0o777,0o444);assert.equal(hash(await fs.readFile(path.join(root,'incoming',item.bucket,item.bucket,item.name))),item.sha256);}
  await assert.rejects(seedBackend(root,r,{setAttribute:async()=>{}}));
 }finally{await fs.rm(root,{recursive:true,force:true});}
 for(const mutate of [r=>r[0].name='../escape',r=>r[0].version='../../escape',r=>r[0].sha256='0'.repeat(64),r=>r[1]=r[0]]){
  const root=await fs.mkdtemp(path.join(os.tmpdir(),'potok-storage-seed-bad-')),r=records();try{for(let i=0;i<63;i++){const file=path.join(root,'incoming',r[i].bucket,r[i].bucket,r[i].name);await fs.mkdir(path.dirname(file),{recursive:true});await fs.writeFile(file,'file '+i);}mutate(r);await assert.rejects(seedBackend(root,r,{setAttribute:async()=>{}}));assert.equal(await fs.access(path.join(root,'escape')).then(()=>true,()=>false),false);}finally{await fs.rm(root,{recursive:true,force:true});}
 }
});
test('HTTP verifies every binary hash/size through authenticated Storage GET and does not claim A/B writes/UI',async()=>{
 const r=records(),calls=[];const request=async(url,o)=>{calls.push({url,o});assert.equal(new URL(url).origin,'http://127.0.0.1:13006');assert.equal(o.redirect,'error');assert(o.signal);if(url.endsWith('/status'))return new Response(null,{status:200});assert.equal(o.method,'GET');assert.equal(o.headers.Authorization,'Bearer private-test-token');const i=Number(url.match(/\/(\d+)\.png$/)[1]);return new Response('file '+i,{status:200});};
 const result=await readBinaryObjects({records:r,token:'private-test-token'},{request});assert.equal(result.files,63);assert.equal(result.abAcceptance,false);assert.equal(result.writeAcceptance,false);assert.equal(result.uiAcceptance,false);assert.equal(result.serviceRoleReadVerification,true);assert.equal(result.releaseReady,false);assert(!JSON.stringify(result).includes('private-test-token'));assert.equal(calls.length,64);
 for(const response of [()=>new Response('bad bytes',{status:200}),()=>new Response('denied',{status:403}),()=>new Response('wrong',{status:200,headers:{'Content-Encoding':'gzip'}})]){
  await assert.rejects(readBinaryObjects({records:r,token:'private-test-token'},{request:async url=>url.endsWith('/status')?new Response(null,{status:200}):response()}),/^Error: STORAGE_BINARY_READ_STOPPED: checked=0$/);
 }
});
test('CLI requires fixed mode/receipt before Docker; helpers cannot mount backup paths and service volume is readonly',async()=>{
 const file=new URL('storage-readonly.mjs',import.meta.url),source=await fs.readFile(file,'utf8');
 for(const args of [['--apply'],['--run-readonly-storage','https://example.invalid']]){const r=spawnSync(process.execPath,[file.pathname,...args],{encoding:'utf8'});assert.equal(r.status,1);assert.match(r.stderr,/phase=admission/);assert(!r.stderr.includes('example.invalid'));}
 assert(!source.includes('type=bind'));assert(!source.includes("'--publish'"));assert(source.includes("target=/work,readonly"));assert(source.includes("'--network','none'"));assert(source.includes("'--user','node'"));assert(source.indexOf("phase='after'")<source.indexOf("phase='result'"));
 for(const fn of [seedBackend,readBinaryObjects]){const r=spawnSync(process.execPath,['--input-type=module','--check'],{input:'const run='+fn.toString()+';',encoding:'utf8'});assert.equal(r.status,0,r.stderr);}
});
test('native pg URL options override migrator search-path config and reject DDL before any Storage startup',{skip:!process.env.TEST_DATABASE_URL},async()=>{
 const u=new URL(process.env.TEST_DATABASE_URL);assert.equal(u.hostname,'127.0.0.1');assert.equal(u.pathname,'/potok_storage_preflight_test');u.searchParams.set('options','-c default_transaction_read_only=on -c search_path=storage,public');const {default:pg}=await import(pathToFileURL(process.env.SQL_TEST_PG_MODULE));const c=new pg.Client({connectionString:u.href,options:'-c search_path=public'});await c.connect();try{
  assert.equal((await c.query('SHOW transaction_read_only')).rows[0].transaction_read_only,'on');await assert.rejects(c.query('CREATE TABLE public.must_not_be_created_by_storage_probe(id int)'),e=>e.code==='25006');assert.equal((await c.query("SELECT to_regclass('public.must_not_be_created_by_storage_probe') AS object")).rows[0].object,null);
 }finally{await c.end();}
});
