// Real HTTP/JWT regression against synthetic PostgREST, not GoTrue or browser acceptance.
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {createHmac} from 'node:crypto';
import {pathToFileURL} from 'node:url';
const mode=process.argv[2];
assert(['setup','check'].includes(mode));
const database=new URL(process.env.TEST_DATABASE_URL??'');
assert.equal(database.hostname,'127.0.0.1');
assert.equal(database.pathname,'/potok_profile_api_test');
assert.equal(database.search,'');
const secret=process.env.POTOK_TEST_JWT_SECRET;
assert(secret?.length>=32,'Disposable JWT secret required');
const {default:pg}=await import(pathToFileURL(process.env.SQL_TEST_PG_MODULE));
const db=new pg.Client({connectionString:database.href});
await db.connect();
try {
 assert.equal((await db.query('SHOW server_version_num')).rows[0].server_version_num.slice(0,2),'17');
 if(mode==='setup'){
  await db.query(await readFile(new URL('./fixture.sql',import.meta.url),'utf8'));
  await db.query('SET ROLE postgres');
  await db.query(await readFile(new URL('../../../../supabase/migration_drafts/profile_column_write_containment_v1.sql',import.meta.url),'utf8'));
  await db.query('RESET ROLE');
  console.log('Disposable API fixture prepared; candidate committed locally');
 }else{
  assert.equal((await db.query("SELECT has_column_privilege('authenticated','public.user_profiles','is_admin','UPDATE') AS allowed")).rows[0].allowed,false);
  const base='http://127.0.0.1:55439';
  const a='11111111-1111-4111-8111-111111111111',b='22222222-2222-4222-8222-222222222222',c='33333333-3333-4333-8333-333333333333';
  const token=(sub,key=secret,exp=Math.floor(Date.now()/1000)+300)=>{
   const encode=o=>Buffer.from(JSON.stringify(o)).toString('base64url');
   const data=encode({alg:'HS256',typ:'JWT'})+'.'+encode({role:'authenticated',sub,exp});
   return data+'.'+createHmac('sha256',key).update(data).digest('base64url');
  };
  async function request(method,path,body,jwt){
   const headers={'Content-Type':'application/json',Prefer:'return=representation'};
   if(jwt)headers.Authorization=`Bearer ${jwt}`;
   const response=await fetch(base+path,{method,headers,body:body===undefined?undefined:JSON.stringify(body),signal:AbortSignal.timeout(5000),redirect:'error'});
   const raw=await response.text();
   return {status:response.status,body:raw?JSON.parse(raw):null};
  }
  const read=id=>request('GET','/user_profiles?order=id_user',undefined,token(id));
  const own=id=>'/user_profiles?id_user=eq.'+id;
  const ok=(r,status)=>assert.equal(r.status,status,`Unexpected HTTP status ${r.status}, code ${r.body?.code??'none'}`);
  async function denied(method,path,body,jwt){const r=await request(method,path,body,jwt);ok(r,jwt?403:401);assert.equal(r.body.code,'42501');}
  let ready=false;
  for(let n=0;n<30;n++){
   try{const r=await read(a);if(r.status===200){ready=true;break;}}catch{}
   await new Promise(resolve=>setTimeout(resolve,500));
  }
  assert(ready,'Disposable PostgREST did not become ready');
  for(const id of [a,b]){const r=await request('POST','/user_profiles',{id_user:id,first_name:id===a?'A':'B'},token(id));ok(r,201);assert.equal(r.body[0].is_admin,false);assert.equal(r.body[0].has_premium,false);}
  console.log('PASS HTTP profile creation and false authority defaults');
  // Same request shape used by profileService upsert; Prefer replaces return preference here.
  const upsert=await fetch(base+'/user_profiles?on_conflict=id_user',{method:'POST',headers:{'Content-Type':'application/json',Authorization:`Bearer ${token(a)}`,Prefer:'resolution=merge-duplicates,return=representation'},body:JSON.stringify({id_user:a,first_name:'A saved'}),signal:AbortSignal.timeout(5000),redirect:'error'});
  assert([200,201].includes(upsert.status));assert.equal((await upsert.json())[0].first_name,'A saved');
  ok(await request('PATCH',own(a),{avatar_url:'synthetic-avatar',coach_settings:{mode:'support'},voice_settings:{enabled:true}},token(a)),200);
  const saved=(await read(a)).body[0];assert.equal(saved.avatar_url,'synthetic-avatar');assert.deepEqual(saved.coach_settings,{mode:'support'});assert.deepEqual(saved.voice_settings,{enabled:true});
  console.log('PASS HTTP same-account upsert, avatar URL and preference writes');
  for(const field of ['is_admin','has_premium','created_at','updated_at']){
   const value=field.endsWith('_at')?'2000-01-01T00:00:00Z':true;
   await denied('PATCH',own(a),{[field]:value},token(a));
   await denied('POST','/user_profiles',{id_user:c,[field]:value},token(c));
  }
  await denied('PATCH',own(a),{is_admin:false},token(a));
  await denied('POST','/user_profiles',{id_user:c,has_premium:false},token(c));
  console.log('PASS HTTP protected INSERT/UPDATE denial including explicit false');
  assert.deepEqual((await read(a)).body.map(p=>p.id_user),[a]);
  assert.deepEqual((await read(b)).body.map(p=>p.id_user),[b]);
  const foreign=await request('PATCH',own(b),{first_name:'wrong'},token(a));ok(foreign,200);assert.deepEqual(foreign.body,[]);
  await denied('PATCH',own(a),{id_user:c},token(a));
  await denied('POST','/user_profiles',{id_user:c,first_name:'foreign'},token(a));
  assert.equal((await read(b)).body[0].first_name,'B');assert.equal((await read(a)).body[0].first_name,'A saved');
  console.log('PASS HTTP A/B isolation, foreign writes and ownership reassignment');
  await denied('POST','/user_profiles',{id_user:c},undefined);
  ok(await request('GET','/user_profiles',undefined,token(a,'wrong-disposable-signing-secret-value')),401);
  ok(await request('GET','/user_profiles',undefined,token(a,secret,1)),401);
  const all=(await db.query('SELECT id_user,is_admin,has_premium FROM public.user_profiles ORDER BY id_user')).rows;
  assert.deepEqual(all,[{id_user:a,is_admin:false,has_premium:false},{id_user:b,is_admin:false,has_premium:false}]);
  console.log('PASS anonymous denial, invalid/expired JWT rejection and unchanged authority flags');
  console.log('PROFILE_HTTP_REGRESSIONS_OK (synthetic PostgREST only)');
 }
} finally {await db.end();}
