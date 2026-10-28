// Ordinary Data API identities only. No Storage binary or program acceptance claim.
import assert from 'node:assert/strict';
import {createMailCapture} from '../accumulated/private-auth-ab-worker.mjs';
export function validateWriteManifest(input){
 assert.equal(input.users.length,2);assert.equal(new Set(input.users.map(u=>u.id)).size,2);
 for(const [i,u] of input.users.entries()){
  assert.match(u.id,/^[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}$/);
 }
 assert.equal(input.manifest.protocol,'potok-scoped-write-manifest-v1');
 assert.match(input.manifest.tag,/^[a-f0-9]{24}$/);
 assert.match(input.manifest.day,/^2[1-9][0-9]{2}-01-15$/);
 assert.equal(input.manifest.diaryIds.length,3);assert.equal(new Set(input.manifest.diaryIds).size,3);
 for(const id of input.manifest.diaryIds){assert.match(id,/^[a-f0-9]{8}-[a-f0-9]{4}-4[a-f0-9]{3}-[89ab][a-f0-9]{3}-[a-f0-9]{12}$/);assert(!input.users.some(u=>u.id===id));}
}
export function validateWriteInput(input){
 validateWriteManifest(input);
 for(const [i,u] of input.users.entries())assert.match(u.email,new RegExp('^potok-ab-[a-f0-9]{24}-'+['a','b'][i]+'@example\\.test$'));
 assert.equal(input.users[0].email.slice(0,33),input.users[1].email.slice(0,33));
}
export async function runScopedWrites(input,api){
 validateWriteManifest(input);const {users,manifest:m}=input;let stage='preflight';
 const ok=(r,status=200)=>{assert.equal(r.status,status);assert(Array.isArray(r.body));return r.body;};
 const denied=r=>{assert([401,403].includes(r.status));assert.equal(r.body?.code,'42501');};
 const empty=r=>assert.deepEqual(ok(r),[]);
 const diary=id=>'food_diary_entries?id=eq.'+id;
 const photo=(table,u)=>table+'?user_id=eq.'+u.id+'&day=eq.'+m.day+(table==='measurement_photo_assets'?'&slot=eq.main_1':'');
 const rows=(u,i)=>({id:m.diaryIds[i],user_id:u.id,date:m.day,meal_type:'breakfast',product_name:'POTOK synthetic '+m.tag,weight:100,calories:17,protein:1,fat:1,carbs:1});
 try{
  // All absence checks finish before the first mutation. SQL independently checks global scope.
  for(const u of users){for(const id of m.diaryIds)empty(await api(diary(id),u));for(const t of ['measurement_photo_assets','measurement_photo_deletions'])empty(await api(photo(t,u),u));}
  for(const [i,u] of users.entries()){
   const other=users[1-i],payload=rows(u,i),route=diary(payload.id);stage='diary-create-'+i;
   const inserted=ok(await api('food_diary_entries',u,'POST',payload),201);assert.equal(inserted.length,1);assert.equal(inserted[0].id,payload.id);assert.equal(inserted[0].user_id,u.id);
   stage='diary-update-'+i;const changed=ok(await api(route,u,'PATCH',{weight:125,calories:21}));assert.equal(changed.length,1);assert.equal(Number(changed[0].weight),125);assert.equal(Number(changed[0].calories),21);
   stage='diary-foreign-'+i;empty(await api(route,other));empty(await api(route,other,'PATCH',{calories:999}));empty(await api(route,other,'DELETE'));
   denied(await api(route,u,'PATCH',{user_id:other.id}));denied(await api('food_diary_entries',other,'POST',{...payload,id:m.diaryIds[2]}));
   const retained=ok(await api(route,u));assert.equal(retained.length,1);assert.equal(retained[0].user_id,u.id);assert.equal(Number(retained[0].calories),21);
   for(const table of ['measurement_photo_assets','measurement_photo_deletions']){
    stage=table+'-'+i;
    const asset=table==='measurement_photo_assets',path='potok-security-test/'+m.tag+'/'+i+'.png';
    const row={user_id:u.id,day:m.day,...(asset?{slot:'main_1',storage_path:path}:{deleted_at:m.day+'T10:00:00Z'})};
    const conflict=asset?'user_id,day,slot':'user_id,day',change=asset?{storage_path:path+'.updated'}:{deleted_at:m.day+'T11:00:00Z'};
    const upsert=table+'?on_conflict='+conflict;
    for(const body of [row,{...row,...change}]){const r=await api(upsert,u,'POST',body,{Prefer:'return=representation,resolution=merge-duplicates'});assert([200,201].includes(r.status));assert.equal(r.body.length,1);assert.equal(r.body[0].user_id,u.id);}
    const own=ok(await api(photo(table,u),u));assert.equal(own.length,1);
    if(asset)assert.equal(own[0].storage_path,change.storage_path);else assert.equal(Date.parse(own[0].deleted_at),Date.parse(change.deleted_at));
    empty(await api(photo(table,u),other));empty(await api(photo(table,u),other,'PATCH',change));empty(await api(photo(table,u),other,'DELETE'));
    denied(await api(photo(table,u),u,'PATCH',{user_id:other.id}));denied(await api(upsert,other,'POST',row,{Prefer:'return=representation,resolution=merge-duplicates'}));
    assert.deepEqual(ok(await api(photo(table,u),u)),own);
   }
  }
  // Cleanup is bounded to manifest identifiers and owners. Never delete an account or whole day.
  stage='cleanup';
  for(const [i,u] of users.entries()){
   for(const route of [diary(m.diaryIds[i])+'&user_id=eq.'+u.id,photo('measurement_photo_assets',u),photo('measurement_photo_deletions',u)]){
    const deleted=ok(await api(route,u,'DELETE'));assert.equal(deleted.length,1);empty(await api(route,u));
   }
  }
  return {protocol:'potok-scoped-writes-v1',diaryOwners:2,photoMetadataOwners:2,foreignAccessDenied:true,cleanup:true,storageBinaries:false,programAcceptance:false,uiAcceptance:false,releaseReady:false};
 }catch{throw Error('SCOPED_WRITES_STOPPED: '+stage);}
}
export async function runScopedWriteWorker(input,{captureFactory=createMailCapture,request=fetch}={}){
 validateWriteInput(input);const capture=captureFactory(input.users.map(u=>u.email)),users=[];let stage='capture';
 const call=async(base,route,method='GET',body,token,extra={})=>{
  const r=await request(base+route,{method,headers:{'Content-Type':'application/json',...(base.endsWith('33001/')?{'Accept-Profile':'public','Content-Profile':'public',Prefer:'return=representation'}:{}),...(token?{Authorization:'Bearer '+token}:{}),...extra},...(body===undefined?{}:{body:JSON.stringify(body)}),redirect:'error',signal:AbortSignal.timeout(10000)});
  const text=await r.text();return {status:r.status,body:text?JSON.parse(text):null};
 };
 try{
  await capture.start();
  for(const [i,u] of input.users.entries()){
   stage='otp-'+i;assert.equal((await call('http://127.0.0.1:13002/','otp','POST',{email:u.email,create_user:false})).status,200);
   for(let n=0;!capture.codes.has(u.email)&&n<100;n++)await new Promise(r=>setTimeout(r,100));let code=capture.codes.get(u.email);assert.match(code??'',/^\d{6}$/);capture.codes.delete(u.email);
   const v=await call('http://127.0.0.1:13002/','verify','POST',{email:u.email,token:code,type:'email'});code=null;
   assert.equal(v.status,200);assert.equal(v.body.user?.id,u.id);assert.equal(v.body.user.email,u.email);assert.equal(typeof v.body.access_token,'string');
   const claims=JSON.parse(Buffer.from(v.body.access_token.split('.')[1],'base64url'));assert.equal(claims.sub,u.id);assert.equal(claims.role,'authenticated');users.push({...u,token:v.body.access_token});
  }
  stage='writes';const result=await runScopedWrites({...input,users},(route,u,method,body,extra)=>call('http://127.0.0.1:33001/',route,method,body,u.token,extra));
  stage='mail-scope';assert.equal(capture.rejected,0);assert(input.users.every(u=>capture.counts.get(u.email)===1));return result;
 }catch(e){throw Error(stage==='writes'&&/^SCOPED_WRITES_STOPPED: [a-z0-9_-]+$/.test(e.message)?e.message:'SCOPED_WRITE_WORKER_STOPPED: '+stage);}
 finally{users.forEach(u=>u.token=null);capture.codes.clear();await capture.close();}
}
