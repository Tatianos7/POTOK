import test from 'node:test';
import assert from 'node:assert/strict';
import {createServer} from 'node:http';
import {readFile} from 'node:fs/promises';
import {resolve,extname} from 'node:path';
import {chromium} from 'playwright';
const root=resolve('reports/staging-auth-check-dist');
const server=createServer(async(req,res)=>{
 try{
  const path=resolve(root,'.'+new URL(req.url,'http://localhost').pathname);
  if(path!==root&&!path.startsWith(root+'/'))throw Error('path');
  const file=path===root?resolve(root,'index.html'):path;
  const data=await readFile(file);
  res.setHeader('Content-Type',({'.html':'text/html','.js':'text/javascript','.css':'text/css'})[extname(file)]??'application/octet-stream');
  res.end(data);
 }catch{res.writeHead(404);res.end();}
});
test('phone screen: explicit OTP flow, memory-only session, server validation and seven GET denials',async()=>{
 await new Promise(r=>server.listen(0,'127.0.0.1',r));
 const address=`http://127.0.0.1:${server.address().port}`;
 const browser=await chromium.launch({headless:true});
 try{
  for(const source of [address+'/',new URL('file://'+resolve('reports/POTOK_STAGING_AUTH_CHECK.html')).href])for(const width of [320,390,430]){
   const context=await browser.newContext({viewport:{width,height:844}}),page=await context.newPage();
   const network=[],errors=[];page.on('pageerror',e=>errors.push(e.message));
   await page.route('**/*',async route=>{
    const request=route.request(),url=new URL(request.url());
    if(url.origin===address||url.protocol==='file:'){await route.continue();return;}
    assert.equal(url.origin,'https://ozidryfvhkcbtpnulakq.supabase.co','no foreign request');
    network.push({path:url.pathname,method:request.method()});
    const cors={'access-control-allow-origin':'*','access-control-allow-headers':'apikey,authorization,content-type,x-client-info,x-supabase-api-version','access-control-allow-methods':'GET,POST,OPTIONS'};
    if(request.method()==='OPTIONS'){await route.fulfill({status:204,headers:cors});return;}
    const fulfill=(status,json)=>route.fulfill({status,headers:{...cors,'content-type':'application/json'},body:JSON.stringify(json)});
    const user={id:'00000000-0000-4000-8000-000000000999',is_anonymous:false,app_metadata:{provider:'email'},user_metadata:{},aud:'authenticated'};
    if(url.pathname==='/auth/v1/otp'){
     assert.equal(request.method(),'POST');assert.equal(request.postDataJSON().create_user,false);
     await fulfill(200,{});return;
    }
    if(url.pathname==='/auth/v1/verify'){
     assert.equal(request.postDataJSON().token,'123456');
     const encode=v=>Buffer.from(JSON.stringify(v)).toString('base64url');
     const token=encode({alg:'HS256',typ:'JWT'})+'.'+encode({sub:user.id,exp:Math.floor(Date.now()/1000)+3600,role:'authenticated'})+'.synthetic_signature';
     await fulfill(200,{access_token:token,refresh_token:'synthetic-refresh-only',token_type:'bearer',expires_in:3600,user});return;
    }
    if(url.pathname==='/auth/v1/user'){await fulfill(200,user);return;}
    if(url.pathname==='/auth/v1/logout'){
     assert.equal(url.searchParams.get('scope'),'local');await route.fulfill({status:204,headers:cors});return;
    }
    assert.equal(request.method(),'GET','RPC checks must never POST');
    if(url.pathname==='/rest/v1/rpc/has_verified_entitlement_v2'){await fulfill(200,false);return;}
    assert.ok(url.pathname.startsWith('/rest/v1/rpc/'));
    await fulfill(404,{code:'PGRST202',message:'synthetic closed endpoint'});
   });
   await page.goto(source);
   assert.equal(network.length,0,'opening screen must not send email or other requests');
   await page.locator('#email').fill('screen-test@example.invalid');await page.locator('#consent').check();
   await page.locator('#send').click();await page.locator('#code-step').waitFor({state:'visible'});
   await page.locator('#code').fill('123456');await page.locator('#verify').click();
   const deadline=Date.now()+10000;
   while(Date.now()<deadline && !(await page.locator('#rpc-result').textContent()).includes('7 из 7'))
    await new Promise(r=>setTimeout(r,25));
   assert.ok((await page.locator('#rpc-result').textContent()).includes('7 из 7'),await page.locator('#message').textContent());
   assert.equal(await page.locator('#code').inputValue(),'');
   assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth<=window.innerWidth),true);
   assert.deepEqual(await page.evaluate(()=>{try{return Object.keys(localStorage);}catch{return [];}}),[]);
   assert.deepEqual(await page.evaluate(()=>{try{return Object.keys(sessionStorage);}catch{return [];}}),[]);
   assert.ok(network.some(r=>r.path==='/auth/v1/user'));
   assert.equal(network.filter(r=>r.path.startsWith('/rest/v1/rpc/')&&r.path!=='/rest/v1/rpc/has_verified_entitlement_v2'&&r.method==='GET').length,7);
   assert.equal((await page.locator('body').innerText()).includes('synthetic-refresh'),false);
   await page.locator('#finish').click();await page.locator('#done').waitFor({state:'visible'});
   assert.deepEqual(errors,[]);await context.close();
  }
 }finally{await browser.close();await new Promise(r=>server.close(r));}
});
