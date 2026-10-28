import test from 'node:test';
import assert from 'node:assert/strict';
import {spawnSync} from 'node:child_process';
import {readFile} from 'node:fs/promises';
import {validateWriteManifest,validateWriteInput,runScopedWrites,runScopedWriteWorker} from './scoped-writes.mjs';
const users=[{id:'11111111-1111-4111-8111-111111111111',email:'potok-ab-0123456789abcdef01234567-a@example.test'},{id:'22222222-2222-4222-8222-222222222222',email:'potok-ab-0123456789abcdef01234567-b@example.test'}];
const input=()=>({users:structuredClone(users),manifest:{protocol:'potok-scoped-write-manifest-v1',tag:'0123456789abcdef01234567',day:'2199-01-15',diaryIds:['33333333-3333-4333-8333-333333333333','44444444-4444-4444-8444-444444444444','55555555-5555-4555-8555-555555555555']}});
function fixture(variant=''){
 const rows=[],calls=[];let counter=0;
 const api=async(route,u,method='GET',body,extra={})=>{
  calls.push({route,user:u.id,method,body,extra});const url=new URL(route,'http://127.0.0.1/'),table=url.pathname.slice(1),query=url.searchParams;
  assert(['food_diary_entries','measurement_photo_assets','measurement_photo_deletions'].includes(table));
  const match=r=>r.table===table&&[...query].filter(([k])=>!['on_conflict'].includes(k)).every(([k,v])=>v.startsWith('eq.')&&String(r[k])===v.slice(3));
  const visible=r=>r.user_id===u.id||variant==='foreign-leak';
  const found=rows.filter(r=>match(r)&&visible(r));const out=rs=>rs.map(({table,...r})=>structuredClone(r));
  const denied=()=>({status:variant==='fake-denial'?404:403,body:{code:variant==='fake-denial'?'PGRST205':'42501'}});
  if(method==='GET')return {status:200,body:out(found)};
  if(method==='POST'){
   if(body.user_id!==u.id)return denied();
   const old=query.has('on_conflict')?rows.find(r=>r.table===table&&query.get('on_conflict').split(',').every(k=>r[k]===body[k])):null;
   if(old){Object.assign(old,body);return {status:200,body:out([old])};}
   const r={table,id:body.id??'generated-'+counter++,...body};rows.push(r);return {status:201,body:out([r])};
  }
  if(method==='PATCH'){
   if(found.length&&body.user_id&&body.user_id!==u.id)return denied();
   if(variant!=='own-noop')for(const r of found)Object.assign(r,body);
   return {status:200,body:out(found)};
  }
  assert.equal(method,'DELETE');assert(query.has('id')||query.has('user_id')&&query.has('day'));
  if(variant==='cleanup-fails'&&found.length)throw Error('transport timeout with unknown delete outcome');
  for(const r of found)rows.splice(rows.indexOf(r),1);return {status:200,body:out(found)};
 };
 return {api,rows,calls};
}
test('bounded diary CRUD/photo upserts test both owners and leave no test records',async()=>{
 const f=fixture(),result=await runScopedWrites(input(),f.api);assert.equal(result.cleanup,true);assert.equal(result.diaryOwners,2);assert.equal(result.photoMetadataOwners,2);assert.equal(result.storageBinaries,false);assert.equal(result.uiAcceptance,false);assert.equal(result.releaseReady,false);assert.deepEqual(f.rows,[]);
 const mutations=f.calls.filter(c=>c.method!=='GET');assert(mutations.length>30);assert(mutations.every(c=>users.some(u=>u.id===c.user)));
 assert.equal(f.calls.filter(c=>c.method==='POST'&&c.route.startsWith('measurement_photo_assets')&&c.body.user_id===c.user).length,4);
});
test('foreign leaks, own no-op, missing route pretending denial and interrupted cleanup all fail closed',async()=>{
 for(const variant of ['foreign-leak','own-noop','fake-denial','cleanup-fails']){const f=fixture(variant);await assert.rejects(runScopedWrites(input(),f.api),/^Error: SCOPED_WRITES_STOPPED: [a-z0-9_-]+$/);assert(f.rows.length>0);}
});
test('collision discovered before mutations; arbitrary owner/mail/identifier/day rejected',async()=>{
 const f=fixture();f.rows.push({table:'food_diary_entries',id:input().manifest.diaryIds[0],user_id:users[0].id});await assert.rejects(runScopedWrites(input(),f.api));assert(f.calls.every(c=>c.method==='GET'));
 for(const change of [c=>c.users[0].email='real@example.com',c=>c.users[1].id=c.users[0].id,c=>c.manifest.diaryIds[0]='x&user_id=neq.x',c=>c.manifest.diaryIds[1]=c.manifest.diaryIds[0],c=>c.manifest.day='today',c=>c.manifest.tag='../real-file']){const v=input();change(v);assert.throws(()=>validateWriteInput(v));}
});
test('worker uses existing OTP identities, loopback/redirect limits and memory-only tokens',async()=>{
 const f=fixture(),calls=[],capture={codes:new Map(),counts:new Map(),rejected:0,async start(){},async close(){this.closed=true;}};
 const request=async(raw,o)=>{
  const url=new URL(raw);calls.push({url,o});assert.equal(url.hostname,'127.0.0.1');assert.equal(o.redirect,'error');assert(o.signal);const body=o.body?JSON.parse(o.body):undefined;
  const response=v=>new Response(JSON.stringify(v.body),{status:v.status});
  if(url.port==='13002'){
   if(url.pathname==='/otp'){assert.equal(body.create_user,false);capture.codes.set(body.email,'123456');capture.counts.set(body.email,1);return response({status:200,body:{}});}
   assert.equal(url.pathname,'/verify');const u=users.find(u=>u.email===body.email);assert.equal(body.token,'123456');return response({status:200,body:{user:u,access_token:'header.'+Buffer.from(JSON.stringify({sub:u.id,role:'authenticated'})).toString('base64url')+'.signature'}});
  }
  assert.equal(url.port,'33001');const token=o.headers.Authorization.split(' ')[1],id=JSON.parse(Buffer.from(token.split('.')[1],'base64url')).sub;
  assert.equal(o.headers['Content-Profile'],'public');return response(await f.api(url.pathname.slice(1)+url.search,users.find(u=>u.id===id),o.method,body,o.headers));
 };
 const result=await runScopedWriteWorker(input(),{captureFactory:()=>capture,request});assert.equal(result.cleanup,true);assert.equal(capture.closed,true);assert.equal(capture.codes.size,0);assert.equal(calls.filter(c=>c.url.port==='13002').length,4);assert(!JSON.stringify(result).includes(users[0].email));
});
test('controller rejects hosted/arbitrary modes before Docker and preserves failed-worker evidence',async()=>{
 const file=new URL('scoped-diary-photo.mjs',import.meta.url),source=await readFile(file,'utf8');
 for(const args of [['--apply'],['--run-scoped-local','https://example.invalid']]){const r=spawnSync(process.execPath,[file.pathname,...args],{encoding:'utf8'});assert.equal(r.status,1);assert.match(r.stderr,/phase=admission/);assert(!r.stderr.includes('example.invalid'));}
 assert(source.includes("'--network','container:'+dbId"));assert(source.includes("'--read-only','--cap-drop','ALL'"));assert(source.includes("'--user','node'"));assert(!source.includes("'--env-file'"));assert(!source.includes("'--publish'"));
 assert(source.indexOf("phase='independent-after-proof'")<source.indexOf("phase='worker-result'"));assert(!source.includes('sql(verify)'));
 // Parse the actual dynamically packaged worker, including SMTP imports, without contacting anything.
 const mail=await readFile(new URL('../accumulated/private-auth-ab-worker.mjs',import.meta.url),'utf8');
 const bundle="import assert from 'node:assert/strict';\n"+mail.slice(0,mail.indexOf('export async function runABWorker'))+'\n'+validateWriteManifest.toString()+'\n'+validateWriteInput.toString()+'\n'+runScopedWrites.toString()+'\n'+runScopedWriteWorker.toString();
 const r=spawnSync(process.execPath,['--input-type=module','--check'],{input:bundle,encoding:'utf8'});assert.equal(r.status,0,r.stderr);
});
