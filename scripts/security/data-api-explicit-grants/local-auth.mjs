// Real local Auth email OTP + PostgREST. Tokens and message bodies stay in memory.
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import path from 'node:path';
assert.equal(process.env.GITHUB_ACTIONS,'true');
const root=process.env.POTOK_PHOTO_AUTH_DIR;
assert(root && path.isAbsolute(root) && path.basename(root)==='potok-photo-http-acceptance');
export const status=JSON.parse(await readFile(path.join(root,'status.json'),'utf8'));
assert.equal(status.API_URL,'http://127.0.0.1:54321');
assert.equal(status.INBUCKET_URL,'http://127.0.0.1:54324');
assert(status.ANON_KEY && !status.ANON_KEY.startsWith('sb_secret_'));
const allowed=new Set([status.API_URL,status.INBUCKET_URL]);
export async function localFetch(url,options={}) {
  assert(allowed.has(new URL(url).origin),'Non-local request refused');
  return fetch(url,{...options,redirect:'error',signal:AbortSignal.timeout(10000)});
}
async function auth(endpoint,body) {
  const r=await localFetch(status.API_URL+'/auth/v1/'+endpoint,{method:'POST',headers:{apikey:status.ANON_KEY,'Content-Type':'application/json'},body:JSON.stringify(body)});
  assert.equal(r.status,200,'Local Auth '+endpoint+' status');
  return r.json();
}
export async function login(email) {
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
