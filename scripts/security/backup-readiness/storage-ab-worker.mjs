// Ordinary existing-user OTP and bounded binary HTTP only. No service/signing key.
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {deflateSync} from 'node:zlib';
import {createMailCapture} from '../accumulated/private-auth-ab-worker.mjs';
export function validateStorageInput(input){
 assert.equal(input.protocol,'potok-storage-ab-manifest-v1');assert.match(input.tag,/^[a-f0-9]{24}$/);assert.equal(input.users.length,2);assert.equal(new Set(input.users.map(u=>u.id)).size,2);
 for(const [i,u] of input.users.entries()){assert.match(u.id,/^[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}$/);assert.match(u.email,new RegExp('^potok-ab-[a-f0-9]{24}-'+['a','b'][i]+'@example\\.test$'));}assert.equal(input.users[0].email.slice(0,33),input.users[1].email.slice(0,33));
 assert.equal(input.entries.length,6);const keys=new Set();for(const e of input.entries){assert([0,1].includes(e.owner));assert(['measurements-photos','recipe-photos','user-exercise-media'].includes(e.bucket));const prefix=(e.bucket==='user-exercise-media'?'':'user/')+input.users[e.owner].id+'/potok-storage-test/';assert.equal(e.name,prefix+input.tag+'.png');assert.equal(e.forgedName,prefix+input.tag+'-forged.png');assert.equal(e.replaceAllowed,e.bucket!=='user-exercise-media');keys.add(e.bucket+':'+e.owner);}assert.equal(keys.size,6);
}
export function syntheticPNG(tag,version){
 const crc=bytes=>{let c=0xffffffff;for(const b of bytes){c^=b;for(let n=0;n<8;n++)c=(c>>>1)^((c&1)?0xedb88320:0);}return (c^0xffffffff)>>>0;};
 const chunk=(type,data)=>{const b=Buffer.concat([Buffer.from(type),data]),h=Buffer.alloc(4),t=Buffer.alloc(4);h.writeUInt32BE(data.length);t.writeUInt32BE(crc(b));return Buffer.concat([h,b,t]);};
 const header=Buffer.alloc(13);header.writeUInt32BE(1,0);header.writeUInt32BE(1,4);header[8]=8;header[9]=2;
 const pixels=Buffer.from([0,parseInt(tag.slice(0,2),16),parseInt(tag.slice(2,4),16),version]);return Buffer.concat([Buffer.from([137,80,78,71,13,10,26,10]),chunk('IHDR',header),chunk('IDAT',deflateSync(pixels)),chunk('IEND',Buffer.alloc(0))]);
}
export async function runStorageWrites(input,users,{request=fetch}={}){
 validateStorageInput(input);assert.equal(users.length,2);for(const [i,u] of users.entries()){assert.equal(u.id,input.users[i].id);assert.equal(typeof u.token,'string');}
 let stage='absence',mutations=false,cleanup=false,failed=false;const versions=[syntheticPNG(input.tag,1),syntheticPNG(input.tag,2)];
 const route=(e,name=e.name)=>encodeURIComponent(e.bucket)+'/'+name.split('/').map(encodeURIComponent).join('/');
 const call=async(e,u,method='GET',body,upsert=false,name=e.name)=>{
  const url='http://127.0.0.1:13007/'+(method==='DELETE'?'object/'+encodeURIComponent(e.bucket):'object/'+(method==='GET'?'authenticated/':'')+route(e,name));
  const r=await request(url,{method,headers:{Authorization:'Bearer '+u.token,...(method==='POST'?{'Content-Type':'image/png','x-upsert':String(upsert)}:{}),...(method==='DELETE'?{'Content-Type':'application/json'}:{})},...(body===undefined?{}:{body:method==='DELETE'?JSON.stringify(body):body}),redirect:'error',signal:AbortSignal.timeout(15000)});
  const bytes=Buffer.from(await r.arrayBuffer());let json;try{json=JSON.parse(bytes.toString());}catch{}return {status:r.status,bytes,json,encoding:r.headers.get('content-encoding')};
 };
 const absent=r=>{assert([400,401,403,404].includes(r.status));assert([403,404].includes(Number(r.json?.statusCode??r.status)));};
 const denied=r=>{assert([400,401,403,404].includes(r.status));assert([401,403,404].includes(Number(r.json?.statusCode??r.status)));};
 const bytesEqual=(r,b)=>{assert.equal(r.status,200);assert.equal(r.encoding,null);assert.equal(r.bytes.length,b.length);assert.equal(createHash('sha256').update(r.bytes).digest('hex'),createHash('sha256').update(b).digest('hex'));};
 const remove=async(e,u,name)=>{const r=await call(e,u,'DELETE',{prefixes:[name]});assert.equal(r.status,200);assert(Array.isArray(r.json));assert(r.json.length<=1);if(r.json.length)assert.equal(r.json[0].name,name);return r;};
 try{
  // SQL independently checks global absence before the worker. Finish all HTTP absence checks too.
  for(const e of input.entries)for(const name of [e.name,e.forgedName])absent(await call(e,users[e.owner],'GET',undefined,false,name));
  for(const [i,e] of input.entries.entries()){
   const own=users[e.owner],other=users[1-e.owner];stage='upload-'+i;mutations=true;const uploaded=await call(e,own,'POST',versions[0]);assert([200,201].includes(uploaded.status));assert.equal(uploaded.json?.Key,e.bucket+'/'+e.name);
   stage='own-read-'+i;bytesEqual(await call(e,own),versions[0]);
   stage='foreign-'+i;denied(await call(e,other));denied(await call(e,other,'POST',versions[1],true));const deleted=await remove(e,other,e.name);assert.deepEqual(deleted.json,[]);bytesEqual(await call(e,own),versions[0]);
   denied(await call(e,other,'POST',versions[0],false,e.forgedName));absent(await call(e,own,'GET',undefined,false,e.forgedName));
   stage='replace-'+i;const replaced=await call(e,own,'POST',versions[1],true);if(e.replaceAllowed){assert([200,201].includes(replaced.status));assert.equal(replaced.json?.Key,e.bucket+'/'+e.name);bytesEqual(await call(e,own),versions[1]);}else{denied(replaced);bytesEqual(await call(e,own),versions[0]);}
  }
 }catch{failed=true;}
 finally{
  if(mutations){try{for(const e of input.entries){for(const name of [e.name,e.forgedName]){await remove(e,users[e.owner],name);absent(await call(e,users[e.owner],'GET',undefined,false,name));}}cleanup=true;}catch{cleanup=false;}}
 }
 if(failed||!cleanup)throw Error('STORAGE_AB_WRITES_STOPPED: stage='+stage+'; cleanup='+cleanup);
 return {protocol:'potok-storage-ab-http-v1',users:2,buckets:3,objects:6,ownReplacementVerified:4,mediaReplacementDenied:2,foreignReadWriteDeleteDenied:true,cleanup:true,ordinaryUserTokensOnly:true,uiAcceptance:false,releaseReady:false};
}
export async function runStorageWorker(input,{captureFactory=createMailCapture,request=fetch}={}){
 validateStorageInput(input);const capture=captureFactory(input.users.map(u=>u.email)),users=[];let stage='capture',started=false;
 const auth=async(route,body)=>{const r=await request('http://127.0.0.1:13002/'+route,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(body),redirect:'error',signal:AbortSignal.timeout(10000)});return {status:r.status,body:await r.json()};};
 try{
  await capture.start();started=true;for(const [i,u] of input.users.entries()){stage='otp-'+i;assert.equal((await auth('otp',{email:u.email,create_user:false})).status,200);for(let n=0;!capture.codes.has(u.email)&&n<100;n++)await new Promise(r=>setTimeout(r,100));let code=capture.codes.get(u.email);assert.match(code??'',/^\d{6}$/);capture.codes.delete(u.email);const v=await auth('verify',{email:u.email,token:code,type:'email'});code=null;assert.equal(v.status,200);assert.equal(v.body.user?.id,u.id);assert.equal(v.body.user?.email,u.email);assert.equal(typeof v.body.access_token,'string');const claims=JSON.parse(Buffer.from(v.body.access_token.split('.')[1],'base64url'));assert.equal(claims.sub,u.id);assert.equal(claims.role,'authenticated');users.push({...u,token:v.body.access_token});}
  stage='binary';const result=await runStorageWrites(input,users,{request});stage='mail';assert.equal(capture.rejected,0);assert(input.users.every(u=>capture.counts.get(u.email)===1));return result;
 }catch(e){throw Error(stage==='binary'&&/^STORAGE_AB_WRITES_STOPPED: stage=[a-z0-9-]+; cleanup=(true|false)$/.test(e.message)?e.message:'STORAGE_AB_WORKER_STOPPED: '+stage);}
 finally{users.forEach(u=>u.token=null);capture.codes.clear();if(started)await capture.close();}
}
