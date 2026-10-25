// Real local Auth email OTP + PostgREST. Tokens and message bodies stay in memory.
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import path from 'node:path';
import {spawnSync} from 'node:child_process';
import {fileURLToPath} from 'node:url';
assert.equal(process.env.GITHUB_ACTIONS,'true');
const root=process.env.POTOK_PHOTO_AUTH_DIR;
assert(root && path.isAbsolute(root) && path.basename(root)==='potok-photo-http-acceptance');
const status=JSON.parse(await readFile(path.join(root,'status.json'),'utf8'));
assert.equal(status.API_URL,'http://127.0.0.1:54321');
assert.equal(status.INBUCKET_URL,'http://127.0.0.1:54324');
assert(status.ANON_KEY && !status.ANON_KEY.startsWith('sb_secret_'));
const allowed=new Set([status.API_URL,status.INBUCKET_URL]);
async function localFetch(url,options={}) {
  assert(allowed.has(new URL(url).origin),'Non-local request refused');
  return fetch(url,{...options,redirect:'error',signal:AbortSignal.timeout(10000)});
}
async function auth(endpoint,body) {
  const r=await localFetch(status.API_URL+'/auth/v1/'+endpoint,{method:'POST',headers:{apikey:status.ANON_KEY,'Content-Type':'application/json'},body:JSON.stringify(body)});
  assert.equal(r.status,200,'Local Auth '+endpoint+' status');
  return r.json();
}
async function login(email) {
  await auth('otp',{email,create_user:true});
  let code;
  for(let n=0;n<80&&!code;n++) {
    const r=await localFetch(status.INBUCKET_URL+'/api/v1/messages');assert.equal(r.status,200);
    const messages=await r.json();
    const message=messages.messages?.find(m=>m.To?.some(to=>to.Address===email));
    if(message) {
      const detail=await localFetch(status.INBUCKET_URL+'/api/v1/message/'+encodeURIComponent(message.ID)).then(r=>r.json());
      code=(detail.Text+' '+detail.HTML).match(/POTOK_TEST_CODE=(\d{6})/)?.[1];
    }
    if(!code) await new Promise(resolve=>setTimeout(resolve,250));
  }
  assert(code,'Local email OTP missing');
  const session=await auth('verify',{email,token:code,type:'email'});
  assert(session.access_token && session.user?.id,'Local session missing');
  return {token:session.access_token,id:session.user.id};
}
async function rest(table,user,method='GET',body,query='',prefer='return=representation') {
  assert(['measurement_photo_assets','measurement_photo_deletions'].includes(table));
  const r=await localFetch(status.API_URL+'/rest/v1/'+table+query,{
    method,headers:{apikey:status.ANON_KEY,Authorization:'Bearer '+(user?.token??status.ANON_KEY),'Content-Type':'application/json',Prefer:prefer},
    ...(body===undefined?{}:{body:JSON.stringify(body)})
  });
  const text=await r.text();return {status:r.status,body:text?JSON.parse(text):null};
}
async function ok(promise,expectedStatus) {const r=await promise;assert.equal(r.status,expectedStatus,'REST success status');return r.body;}
async function denied(promise) {const r=await promise;assert([401,403].includes(r.status),'REST denied status');assert.equal(r.body?.code,'42501','Postgres privilege/RLS denial code');}
function prepare(mode) {
  const r=spawnSync(process.execPath,[fileURLToPath(new URL('./local-prepare.mjs',import.meta.url)),mode],{encoding:'utf8',timeout:120000});
  if(r.status!==0)console.error('Disposable preparation failed in '+mode+': '+r.stderr);
  assert.equal(r.status,0,'Disposable preparation '+mode);
}
async function waitForCandidate(user) {
  for(let n=0;n<40;n++) {
    const r=await rest('measurement_photo_assets',user);
    if(r.status===200)return;
    assert(['42501','PGRST205'].includes(r.body?.code),'Unexpected schema reload response');
    await new Promise(resolve=>setTimeout(resolve,250));
  }
  throw Error('PostgREST candidate schema reload timeout');
}
let stage='OTP';
try {
  const a=await login('photo-a@example.test');const b=await login('photo-b@example.test');
  assert.notEqual(a.id,b.id);
  console.log('PASS real local Auth email OTP for two independent sessions');
  stage='missing grants';
  for(const table of ['measurement_photo_assets','measurement_photo_deletions']) await denied(rest(table,a));
  console.log('PASS historical tables deny HTTP access without implicit grants');
  stage='missing UPDATE policy';prepare('grants-only');
  const deletion={user_id:a.id,day:'2026-10-25',deleted_at:'2026-10-25T10:00:00Z'};
  const upsert=(table,user,row,conflict)=>rest(table,user,'POST',row,'?on_conflict='+conflict,'resolution=merge-duplicates,return=representation');
  // Grant changes are catalog-visible; wait for the first SELECT to become usable.
  for(let n=0;n<40;n++) {const r=await rest('measurement_photo_deletions',a);if(r.status===200)break;assert.equal(r.body?.code,'42501');await new Promise(resolve=>setTimeout(resolve,250));}
  await ok(upsert('measurement_photo_deletions',a,deletion,'user_id,day'),201);
  await denied(upsert('measurement_photo_deletions',a,{...deletion,deleted_at:'2026-10-25T11:00:00Z'},'user_id,day'));
  console.log('PASS real PostgREST repeated upsert reproduces missing UPDATE policy');
  stage='candidate';prepare('candidate');await waitForCandidate(a);
  const asset={user_id:a.id,day:'2026-10-25',slot:'main_1',storage_path:'synthetic/first.png'};
  await ok(upsert('measurement_photo_assets',a,asset,'user_id,day,slot'),201);
  await ok(upsert('measurement_photo_assets',a,{...asset,storage_path:'synthetic/second.png'},'user_id,day,slot'),201);
  let saved=await ok(rest('measurement_photo_assets',a),200);assert.equal(saved.length,1);assert.equal(saved[0].storage_path,'synthetic/second.png');
  const assetId=saved[0].id;
  deletion.deleted_at='2026-10-25T12:00:00Z';await ok(upsert('measurement_photo_deletions',a,deletion,'user_id,day'),201);
  saved=await ok(rest('measurement_photo_deletions',a),200);assert.equal(saved.length,1);assert.equal(Date.parse(saved[0].deleted_at),Date.parse(deletion.deleted_at));
  console.log('PASS committed candidate enables real HTTP photo and deletion-marker upsert');
  stage='foreign account isolation';
  for(const table of ['measurement_photo_assets','measurement_photo_deletions']) {
    assert.deepEqual(await ok(rest(table,b),200),[]);
    assert.deepEqual(await ok(rest(table,b,'DELETE',undefined,'?user_id=eq.'+a.id),200),[]);
    assert.deepEqual(await ok(rest(table,b,'PATCH',{user_id:b.id},'?user_id=eq.'+a.id),200),[]);
    await denied(rest(table,a,'PATCH',{user_id:b.id},'?user_id=eq.'+a.id));
  }
  await denied(upsert('measurement_photo_assets',b,asset,'user_id,day,slot'));
  await denied(upsert('measurement_photo_deletions',b,deletion,'user_id,day'));
  await denied(rest('measurement_photo_deletions',a,'PATCH',{id:assetId},'?user_id=eq.'+a.id));
  for(const table of ['measurement_photo_assets','measurement_photo_deletions']) await denied(rest(table,null));
  console.log('PASS cross-account HTTP read/write/delete/reassignment and anonymous denial');
  stage='owner deletion and session validation';
  const refreshed=await localFetch(status.API_URL+'/auth/v1/user',{headers:{apikey:status.ANON_KEY,Authorization:'Bearer '+a.token}});
  assert.equal(refreshed.status,200);
  for(const table of ['measurement_photo_assets','measurement_photo_deletions']) {
    assert.equal((await ok(rest(table,a),200)).length,1);
    assert.equal((await ok(rest(table,a,'DELETE',undefined,'?user_id=eq.'+a.id),200)).length,1);
    assert.deepEqual(await ok(rest(table,a),200),[]);
  }
  prepare('verify');
  console.log('PASS owner HTTP deletion and separate-connection final state verification');
  console.log('PHOTO_AUTH_POSTGREST_OK: real OTP sessions; explicit grants; repeated upserts; account isolation');
} catch(error) {
  // Auth response bodies, tokens and OTPs are deliberately never logged.
  console.error('PHOTO_AUTH_POSTGREST_FAILED stage='+stage+' type='+error.name+' reason='+error.message);
  process.exitCode=1;
}
