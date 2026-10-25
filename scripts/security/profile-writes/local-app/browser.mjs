// Actual Login/Profile components and profileService against disposable Supabase Auth/PostgREST.
import assert from 'node:assert/strict';
import {readFile,mkdtemp,rm} from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import {createServer} from 'vite';
import react from '@vitejs/plugin-react';
import {chromium} from 'playwright';
const root=process.env.POTOK_LOCAL_AUTH_DIR;
assert(root && path.basename(root)==='potok-profile-acceptance');
const status=JSON.parse(await readFile(path.join(root,'status.json'),'utf8'));
assert.equal(status.API_URL,'http://127.0.0.1:54321');
assert.equal(status.INBUCKET_URL,'http://127.0.0.1:54324');
assert(status.ANON_KEY && !status.ANON_KEY.startsWith('sb_secret_'));
// Do not load repo env files, hosted endpoints or service-role material into Vite.
process.env.VITE_SUPABASE_URL=status.API_URL;
process.env.VITE_SUPABASE_ANON_KEY=status.ANON_KEY;
const envDir=await mkdtemp(path.join(os.tmpdir(),'potok-empty-env-'));
const html=`<html><div id="root"></div><script type="module" src="/acceptance-entry.jsx"></script></html>`;
const entry=`import React from 'react';import {createRoot} from 'react-dom/client';
import {BrowserRouter,Routes,Route} from 'react-router-dom';
import {ThemeProvider} from '/src/context/ThemeContext.tsx';
import {AuthProvider,useAuth} from '/src/context/AuthContext.tsx';
import Login from '/src/pages/Login.tsx';import Profile from '/src/pages/Profile.tsx';
import {supabase} from '/src/lib/supabaseClient.ts';import {profileService} from '/src/services/profileService.ts';
window.__potokAcceptance={client:supabase,profiles:profileService};
function Probe(){const auth=useAuth();window.__potokAcceptance.state={id:auth.user?.id,status:auth.authStatus,premium:auth.user?.hasPremium,admin:auth.user?.isAdmin};return null;}
const e=React.createElement;createRoot(document.getElementById('root')).render(e(ThemeProvider,null,e(BrowserRouter,null,e(AuthProvider,null,e(Probe),e(Routes,null,e(Route,{path:'/auth',element:e(Login)}),e(Route,{path:'*',element:e(Profile)}))))));`;
const server=await createServer({configFile:false,envDir,plugins:[react(),{name:'potok-isolated-harness',configureServer(s){s.middlewares.use(async(req,res,next)=>{
 if(req.url==='/acceptance-entry.jsx'){const result=await s.transformRequest('/acceptance-entry.jsx');res.setHeader('Content-Type','application/javascript');res.end(result.code);return;}
 if(req.url==='/auth'||req.url==='/'||req.url==='/pin/offer'||req.url==='/profile'){res.setHeader('Content-Type','text/html');res.end(await s.transformIndexHtml(req.url,html));return;}next();});},resolveId(id){if(id==='/acceptance-entry.jsx')return '\0potok-acceptance.jsx';},load(id){if(id==='\0potok-acceptance.jsx')return entry;}}],server:{host:'127.0.0.1',port:55440,strictPort:true},logLevel:'silent'});
let browser,context;
let stage="initialization";
const forbidden=[];
const diagnostics={otpHttpStatus:null,mailMessages:0,matchingMessages:0,templateMarker:false,otpRequests:0,failedRequests:0,ui:null};
async function poll(fn,message){for(let n=0;n<80;n++){if(await fn())return;await new Promise(r=>setTimeout(r,250));}throw Error(message);}
async function mailCode(email){let code;await poll(async()=>{
 const list=await fetch('http://127.0.0.1:54324/api/v1/messages',{signal:AbortSignal.timeout(3000)}).then(r=>r.json());
 diagnostics.mailMessages=list.messages?.length??0;
 const matching=list.messages?.filter(m=>m.To?.some(to=>to.Address===email))??[];diagnostics.matchingMessages=matching.length;
 const message=matching[0];
 if(!message)return false;
 const detail=await fetch('http://127.0.0.1:54324/api/v1/message/'+message.ID,{signal:AbortSignal.timeout(3000)}).then(r=>r.json());
 diagnostics.templateMarker=(detail.Text+' '+detail.HTML).includes('POTOK_TEST_CODE=');
 code=(detail.Text+' '+detail.HTML).match(/POTOK_TEST_CODE=(\d{6})/)?.[1];return Boolean(code);
 },'Local captured email/OTP not received');return code;}
async function login(page,email){page.on('request',r=>{if(r.url().startsWith('http://127.0.0.1:54321/auth/v1/otp'))diagnostics.otpRequests++;});page.on('requestfailed',r=>{if(r.url().startsWith('http://127.0.0.1:54321/'))diagnostics.failedRequests++;});page.on('response',r=>{if(r.url().startsWith('http://127.0.0.1:54321/auth/v1/otp'))diagnostics.otpHttpStatus=r.status();});await page.goto('http://127.0.0.1:55440/auth');await page.waitForFunction(()=>Boolean(window.__potokAcceptance?.client));await page.locator('#email').fill(email);await page.getByRole('button',{name:'Получить код',exact:true}).click();diagnostics.ui=await page.evaluate(()=>({configured:Boolean(window.__potokAcceptance?.client),emailValid:document.querySelector('#email')?.value.includes('@'),codeVisible:Boolean(document.querySelector('#otpCodeEmail')),unavailable:document.body.textContent.includes('Сервис авторизации временно недоступен.'),networkError:document.body.textContent.includes('Не удалось отправить код.')}));const code=await mailCode(email);await page.locator('#otpCodeEmail').fill(code);await page.getByRole('button',{name:'Войти',exact:true}).click();await page.waitForFunction(()=>window.__potokAcceptance?.state?.status==='authenticated');const id=await page.evaluate(()=>window.__potokAcceptance.state.id);assert.match(id,/^[0-9a-f-]{36}$/);return id;}
async function remote(page,id){return page.evaluate(async id=>{const {data,error}=await window.__potokAcceptance.client.from('user_profiles').select('*').eq('id_user',id).single();if(error)throw Error('Remote profile lookup failed');return data;},id);}
try{
 const health=await fetch('http://127.0.0.1:54321/auth/v1/health',{headers:{apikey:status.ANON_KEY},signal:AbortSignal.timeout(5000)});assert.equal(health.status,200,'Local Auth health failed');
 await server.listen();browser=await chromium.launch({headless:true});context=await browser.newContext();
 await context.route('**/*',route=>{const u=new URL(route.request().url());if((u.protocol==='http:'&&['http://127.0.0.1:55440','http://127.0.0.1:54321'].includes(u.origin))||u.protocol==='data:')return route.continue();forbidden.push(u.origin);return route.abort();});
 let page=await context.newPage();page.setDefaultTimeout(20000);
 stage='A email OTP login';const a=await login(page,'potok-a@example.test');
 assert.deepEqual(await page.evaluate(()=>({premium:window.__potokAcceptance.state.premium,admin:window.__potokAcceptance.state.admin})),{premium:false,admin:false});
 await poll(async()=>Boolean(await remote(page,a).catch(()=>null)),'Profile auto-creation failed');
 assert.equal((await remote(page,a)).is_admin,false);assert.equal((await remote(page,a)).has_premium,false);
 console.log('PASS actual Login email OTP and automatic profile creation');
 stage='profile and avatar persistence';await page.evaluate(async id=>{await window.__potokAcceptance.profiles.saveProfile(id,{firstName:'Acceptance A',height:172});},a);
 assert.equal((await remote(page,a)).first_name,'Acceptance A');
 const avatar=Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+/p9sAAAAASUVORK5CYII=','base64');
 await page.locator('input[type=file]').setInputFiles({name:'synthetic.png',mimeType:'image/png',buffer:avatar});
 await poll(async()=>String((await remote(page,a)).avatar_url).startsWith('data:image/png;base64,'),'Actual Profile avatar did not persist');
 await page.reload();await page.waitForFunction(()=>window.__potokAcceptance?.state?.status==='authenticated');
 await page.locator('img[alt=Avatar]').waitFor();assert((await page.locator('img[alt=Avatar]').getAttribute('src')).startsWith('data:image/png;base64,'));
 const refreshed=await page.evaluate(async()=>{const {data,error}=await window.__potokAcceptance.client.auth.refreshSession();return !error&&Boolean(data.session);});assert.equal(refreshed,true);
 console.log('PASS actual profile save, avatar file selection/reload and Auth session refresh');
 stage='offline synchronization';await context.setOffline(true);
 await page.evaluate(async id=>{await window.__potokAcceptance.profiles.saveProfile(id,{firstName:'Acceptance A offline'});},a);
 assert(await page.evaluate(id=>Boolean(localStorage.getItem('profile_pending_v1_'+id)),a));
 await context.setOffline(false);
 await page.evaluate(async id=>{await window.__potokAcceptance.profiles.getProfile(id);},a);
 assert.equal((await remote(page,a)).first_name,'Acceptance A offline');
 assert.equal(await page.evaluate(id=>localStorage.getItem('profile_pending_v1_'+id),a),null);
 console.log('PASS actual offline pending profile save and reconnect synchronization');
 // Leave an A-owned pending edit, then authenticate B in the same browser storage.
 await context.setOffline(true);await page.evaluate(async id=>{await window.__potokAcceptance.profiles.saveProfile(id,{firstName:'A queued during B'});},a);await context.setOffline(false);
 await page.evaluate(()=>window.__potokAcceptance.client.auth.signOut());await page.close();page=await context.newPage();page.setDefaultTimeout(20000);
 stage='B email OTP and account isolation';const b=await login(page,'potok-b@example.test');assert.notEqual(a,b);
 await poll(async()=>Boolean(await remote(page,b).catch(()=>null)),'B profile auto-creation failed');
 await page.evaluate(async id=>{await window.__potokAcceptance.profiles.saveProfile(id,{firstName:'Acceptance B'});await window.__potokAcceptance.profiles.getProfile(id);},b);
 assert.equal((await remote(page,b)).first_name,'Acceptance B');
 assert(await page.evaluate(id=>Boolean(localStorage.getItem('profile_pending_v1_'+id)),a));
 const rejected=await page.evaluate(async id=>{try{await window.__potokAcceptance.profiles.saveProfile(id,{firstName:'wrong-account'});return false;}catch(error){return error.name==='ProfileUserScopeError';}},a);assert.equal(rejected,true);
 const foreign=await page.evaluate(async id=>{const r=await window.__potokAcceptance.client.from('user_profiles').select('id_user').eq('id_user',id);return {data:r.data,error:Boolean(r.error)};},a);assert.deepEqual(foreign,{data:[],error:false});
 assert.equal((await remote(page,b)).is_admin,false);assert.equal((await remote(page,b)).has_premium,false);
 console.log('PASS actual A-to-B session change preserves A queue and denies foreign profile writes/reads');
 assert.equal(forbidden.length,0,'Browser attempted non-local network access');
 console.log('LOCAL_AUTH_PROFILE_ACCEPTANCE_OK (isolated fixtures; not hosted acceptance)');
}catch(error){console.error('LOCAL_AUTH_PROFILE_ACCEPTANCE_FAILED stage='+stage+' type='+error.name+' blockedOrigins='+forbidden.length+' diagnostics='+JSON.stringify(diagnostics));process.exitCode=1;}finally{await context?.close();await browser?.close();await server.close();await rm(envDir,{recursive:true,force:true});}
