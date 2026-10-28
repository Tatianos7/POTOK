import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import path from 'node:path';
import os from 'node:os';
import {createHash} from 'node:crypto';
import {spawnSync} from 'node:child_process';
import {pathToFileURL} from 'node:url';
import {verifyStorageFiles,imageReadProbe,storageSQL} from './storage-preflight.mjs';
async function fixture(){
 const base=await fs.mkdtemp(path.join(os.tmpdir(),'potok-storage-preflight-test-')),buckets=['measurements-photos','recipe-photos','user-exercise-media'],manifest=[],hashes=[],objects=[];
 for(const [i,bucket] of buckets.entries())for(let n=0;n<[22,3,38][i];n++){
  const name='synthetic-owner/'+n+'.png',file=path.join(base,'storage-files',bucket,bucket,name),data=Buffer.from('synthetic '+i+' '+n);await fs.mkdir(path.dirname(file),{recursive:true});await fs.writeFile(file,data);
  manifest.push({bucket,name,size:data.length});hashes.push({bucket,name,bytes:String(data.length),sha256:createHash('sha256').update(data).digest('hex')});objects.push({bucket_id:bucket,name,version:n%2===0?null:'11111111-1111-4111-8111-111111111111',metadata:{size:data.length,mimetype:'image/png'}});
 }
 await fs.writeFile(path.join(base,'storage-manifest.json'),JSON.stringify(manifest));await fs.writeFile(path.join(base,'storage-sha256.json'),JSON.stringify(hashes));
 return {base,manifest,hashes,snapshot:{protocol:'potok-storage-preflight-v1',readOnly:'on',buckets:buckets.map(id=>({id})),objects}};
}
test('all 63 files/three buckets bind exact DB names, byte counts, hashes and opaque versions without selecting a layout',async()=>{
 const f=await fixture();try{const r=await verifyStorageFiles(f.base,f.snapshot);assert.equal(r.files,63);assert.equal(r.records.length,63);assert.equal(r.records[0].sha256,f.hashes[0].sha256);assert.equal(r.backendLayoutSelected,false);assert.equal(r.serviceStarted,false);assert.equal(r.binaryHttpAcceptance,false);assert.equal(r.releaseReady,false);}finally{await fs.rm(f.base,{recursive:true,force:true});}
});
test('same-size tampering, extra files, symlink, scope drift and unsafe versions/names stop',async()=>{
 for(const change of [async f=>{const m=f.manifest[0];await fs.writeFile(path.join(f.base,'storage-files',m.bucket,m.bucket,m.name),Buffer.alloc(m.size,88));},async f=>fs.writeFile(path.join(f.base,'storage-files','unexpected'),'extra'),async f=>fs.symlink('/tmp',path.join(f.base,'storage-files','escape')),async f=>{f.snapshot.objects[1]=f.snapshot.objects[0];},async f=>{f.snapshot.objects[0].metadata.size++;},async f=>{f.snapshot.objects[0].version='../escape';},async f=>{f.snapshot.objects[0].version=undefined;},async f=>{f.snapshot.readOnly='off';}]){
  const f=await fixture();try{await change(f);await assert.rejects(verifyStorageFiles(f.base,f.snapshot));}finally{await fs.rm(f.base,{recursive:true,force:true});}
 }
});
test('image inspection reads public bytes only; never imports application or starts migrations',async()=>{
 const root=await fs.mkdtemp(path.join(os.tmpdir(),'potok-storage-image-test-'));try{
  await fs.writeFile(path.join(root,'package.json'),JSON.stringify({name:'@supabase/storage',version:'1.11.2'}));await fs.mkdir(path.join(root,'dist/start'),{recursive:true});await fs.writeFile(path.join(root,'dist/start/server.js'),"throw Error('must never import');runMigrationsOnTenant();");await fs.mkdir(path.join(root,'migrations/tenant'),{recursive:true});await fs.writeFile(path.join(root,'migrations/tenant/0001.sql'),'SELECT 1;');
  const r=await imageReadProbe(root);assert.equal(r.packageVersion,'1.11.2');assert.equal(r.applicationImported,false);assert.equal(r.serverStarted,false);assert.equal(r.files[0].migrationRunnerMention,true);assert.equal(r.files[1].missing,true);assert.deepEqual(r.migrations[0].sqlFiles,['0001.sql']);
  const syntax=spawnSync(process.execPath,['--input-type=module','--check'],{input:'console.log(JSON.stringify(await ('+imageReadProbe.toString()+')()));',encoding:'utf8'});assert.equal(syntax.status,0,syntax.stderr);
 }finally{await fs.rm(root,{recursive:true,force:true});}
});
test('SQL is bounded read-only; CLI rejects arbitrary target/apply modes; no migration/server command is executed',async()=>{
 assert(storageSQL.startsWith('BEGIN ISOLATION LEVEL REPEATABLE READ READ ONLY;'));assert(storageSQL.endsWith('ROLLBACK;'));assert(!/\b(INSERT|UPDATE|DELETE|ALTER|GRANT|REVOKE|CREATE|DROP|COPY|COMMIT)\b/.test(storageSQL));
 const file=new URL('storage-preflight.mjs',import.meta.url),source=await fs.readFile(file,'utf8');
 for(const args of [['--apply'],['--inspect-local-storage','https://example.invalid']]){const r=spawnSync(process.execPath,[file.pathname,...args],{encoding:'utf8'});assert.equal(r.status,1);assert.match(r.stderr,/phase=admission/);assert(!r.stderr.includes('example.invalid'));}
 assert(source.includes("'--network','none','--read-only','--cap-drop','ALL'"));assert(source.includes("'--user','node','--entrypoint','node'"));assert(!source.includes("'--env-file'"));assert(!source.includes("'--mount'"));assert(!source.includes("'--publish'"));assert(!source.includes("['volume','create'"));
});
test('native PostgreSQL executes the exact read-only catalog observation without schema/content changes',{skip:!process.env.TEST_DATABASE_URL},async()=>{
 const url=new URL(process.env.TEST_DATABASE_URL);assert.equal(url.hostname,'127.0.0.1');assert.equal(url.pathname,'/potok_storage_preflight_test');const {default:pg}=await import(pathToFileURL(process.env.SQL_TEST_PG_MODULE));const c=new pg.Client({connectionString:url.href});await c.connect();try{
  await c.query("CREATE SCHEMA storage; CREATE TABLE storage.buckets(id text PRIMARY KEY,public boolean); CREATE TABLE storage.objects(id int PRIMARY KEY,bucket_id text,name text,version text,metadata jsonb); CREATE TABLE storage.migrations(id int PRIMARY KEY,name text); INSERT INTO storage.buckets VALUES('test',false); INSERT INTO storage.objects VALUES(1,'test','object.png',null,'{\"size\":1}'); INSERT INTO storage.migrations VALUES(1,'synthetic');");
  const observe=async()=>{const results=await c.query(storageSQL);return results.find(r=>r.rows[0]?.evidence).rows[0].evidence;};const a=await observe(),b=await observe();assert.equal(a.readOnly,'on');assert.equal(a.protocol,'potok-storage-preflight-v1');assert.equal(a.objects.length,1);assert.equal(a.migrations.length,1);assert.deepEqual(b,a);
 }finally{await c.end();}
});
