// Actual Login/MyProgram components; ordinary browser tokens; bounded loopback gateway.
import assert from 'node:assert/strict';
import {createServer as httpServer,request as httpRequest} from 'node:http';
import {createServer as tcpServer} from 'node:net';
import {mkdtemp,rm} from 'node:fs/promises';
import {createServer as viteServer} from 'vite';
import react from '@vitejs/plugin-react';
import {chromium} from 'playwright';
import {createMailCapture} from '../accumulated/private-auth-ab-worker.mjs';

export function createProgramGateway(input){
 assert(['ci','private'].includes(input.mode));if(input.mode==='ci')assert.equal(process.env.GITHUB_ACTIONS,'true');
 const auth=new Map([['otp','POST'],['verify','POST'],['user','GET'],['token','POST'],['logout','POST'],['health','GET'],['settings','GET']]);
 const reads=new Set(['user_profiles','user_goals','user_measurements','measurement_history','food_diary_entries','workout_entries','workout_days','ai_trust_scores','nutrition_programs','training_programs','program_sessions']);
 const rpc=new Set(['has_verified_entitlement_v1','get_entitlements','get_paywall_state','get_active_program','get_program_status','get_program_phases','get_program_days','get_program_day_details','get_program_explainability']);
 const sockets=new Set(),upstreams=new Set();let patches=0;
 const server=httpServer(async(req,res)=>{try{
  const origin=req.headers.origin;if(origin&&origin!=='http://127.0.0.1:13005'){res.writeHead(403);res.end();return;}
  const cors=origin?{'Access-Control-Allow-Origin':origin,Vary:'Origin'}:{},u=new URL(req.url,'http://127.0.0.1');if(/[\\%#]/.test(u.pathname)||req.url.startsWith('//')){res.writeHead(404);res.end();return;}
  const method=req.method==='OPTIONS'?req.headers['access-control-request-method']:req.method;
  const isAuth=u.pathname.startsWith('/auth/v1/'),suffix=u.pathname.slice(isAuth?9:9),table=u.pathname.slice('/rest/v1/'.length);
  const parent=['nutrition_programs','training_programs'].includes(table),id=u.searchParams.get('id')?.replace(/^eq\./,'');
  const fixture=input.manifest.programs.find(p=>p.id===id&&table===p.type+'_programs');
  const allowed=isAuth?auth.get(suffix)===method:u.pathname.startsWith('/rest/v1/')&&((method==='GET'&&reads.has(table))||(method==='POST'&&table.startsWith('rpc/')&&rpc.has(table.slice(4)))||(method==='PATCH'&&!input.authReloadOnly&&parent&&fixture&&u.searchParams.get('user_id')==='eq.'+input.users[fixture.owner].id));
  if(!allowed){res.writeHead(404,cors);res.end();return;}
  if(req.method==='OPTIONS'){const hs=String(req.headers['access-control-request-headers']??'').toLowerCase().split(',').map(s=>s.trim()).filter(Boolean);if(hs.some(h=>!['authorization','content-type','apikey','prefer','x-client-info','accept-profile','content-profile','x-supabase-api-version'].includes(h))){res.writeHead(403);res.end();return;}res.writeHead(204,{...cors,'Access-Control-Allow-Methods':method,'Access-Control-Allow-Headers':hs.join(',')});res.end();return;}
  const chunks=[];let size=0;for await(const b of req){size+=b.length;assert(size<=1024*1024);chunks.push(b);}const body=Buffer.concat(chunks);
  if(method==='PATCH'){const p=JSON.parse(body);assert.deepEqual(Object.keys(p),['status']);assert(['active','paused'].includes(p.status));patches++;}
  const headers=Object.fromEntries(Object.entries(req.headers).filter(([k])=>['authorization','apikey','content-type','accept','prefer','x-client-info','accept-profile','content-profile','x-supabase-api-version'].includes(k)));headers['content-length']=String(body.length);
  const privatePath=isAuth?req.url.slice('/auth/v1'.length):req.url.slice('/rest/v1'.length),port=input.mode==='ci'?54321:isAuth?13002:33001;
  const upstream=httpRequest({hostname:'127.0.0.1',port,path:input.mode==='ci'?req.url:privatePath,method,headers,agent:false,timeout:10000},r=>{if(r.statusCode>=300&&r.statusCode<400){r.resume();res.writeHead(502,cors);res.end();return;}res.writeHead(r.statusCode,{...cors,'Content-Type':r.headers['content-type']??'application/json'});r.pipe(res);});upstreams.add(upstream);upstream.on('close',()=>upstreams.delete(upstream));upstream.on('timeout',()=>upstream.destroy());upstream.on('error',()=>{if(!res.headersSent)res.writeHead(502,cors);res.end();});upstream.end(body);
 }catch{if(!res.headersSent)res.writeHead(400);res.end();}});
 server.on('connection',s=>{sockets.add(s);s.on('close',()=>sockets.delete(s));});
 return {get patches(){return patches;},async start(){await new Promise((r,j)=>{server.once('error',j);server.listen(13004,'127.0.0.1',r);});},async close(){for(const s of upstreams)s.destroy();for(const s of sockets)s.destroy();await new Promise(r=>server.close(r));}};
}

export function programBrowserFailure(error){
 // Never serialize the original message, stack, browser DOM, URL query or headers.
 return {timeout:error?.name==='TimeoutError'||/Timeout \d+ms exceeded/i.test(String(error?.message??'')),assertion:error?.code==='ERR_ASSERTION',
  browserClosed:/Target closed|browser has been closed|context.*closed/i.test(String(error?.message??'')),
  pageCrashed:/page crashed|Target crashed/i.test(String(error?.message??''))};
}

export async function runProgramBrowser(input){
 assert(['ci','private'].includes(input.mode));if(input.mode==='ci')assert.equal(process.env.GITHUB_ACTIONS,'true');else assert.equal(input.root,'/app');
 assert.equal(input.users.length,2);assert.equal(input.manifest.programs.length,4);const claims=JSON.parse(Buffer.from(input.anon.split('.')[1],'base64url'));assert.equal(claims.role,'anon');assert(!claims.sub);
 const temporary=await mkdtemp('/tmp/potok-program-ui-'),gateway=createProgramGateway(input),capture=input.mode==='private'?createMailCapture(input.users.map(u=>u.email)):null;
 process.env.VITE_SUPABASE_URL='http://127.0.0.1:13004';process.env.VITE_SUPABASE_ANON_KEY=input.anon;
 const entry=`import React from 'react';import{createRoot}from'react-dom/client';import{BrowserRouter,Routes,Route}from'react-router-dom';import{ThemeProvider}from'/src/context/ThemeContext.tsx';import{AuthProvider,useAuth}from'/src/context/AuthContext.tsx';import Login from'/src/pages/Login.tsx';import MyProgram from'/src/pages/MyProgram.tsx';import{supabase}from'/src/lib/supabaseClient.ts';import{uiRuntimeAdapter}from'/src/services/uiRuntimeAdapter.ts';window.__programUI={client:supabase};const readProgram=uiRuntimeAdapter.getProgramState.bind(uiRuntimeAdapter);uiRuntimeAdapter.getProgramState=async(...args)=>{const result=await readProgram(...args);window.__programUI.programId=result.program?.programId??null;window.__programUI.runtimeStatus=result.status;return result;};function Probe(){const a=useAuth();window.__programUI.user=a.user?.id;window.__programUI.authStatus=a.authStatus;return null;}const e=React.createElement;createRoot(document.getElementById('root')).render(e(ThemeProvider,null,e(BrowserRouter,null,e(AuthProvider,null,e(Probe),e(Routes,null,e(Route,{path:'/auth',element:e(Login)}),e(Route,{path:'*',element:e(MyProgram)}))))));`;
 const html='<html><div id="root"></div><script type="module" src="/program-ui-entry.jsx"></script></html>';
 const overlay=input.publicFiles??{};assert.deepEqual(Object.keys(overlay).sort(),['src/services/programDeliveryService.ts','src/services/uiRuntimeAdapter.ts']);
 const server=await viteServer({root:input.root,configFile:false,envDir:temporary,cacheDir:temporary+'/cache',plugins:[{name:'reviewed-public-program-overlay',enforce:'pre',load(id){const name=id.split('?')[0].slice(input.root.length+1);if(Object.hasOwn(overlay,name))return overlay[name];}},react(),{name:'program-ui-entry',configureServer(s){s.middlewares.use(async(req,res,next)=>{if(req.url==='/program-ui-entry.jsx'){const r=await s.transformRequest(req.url);res.setHeader('Content-Type','application/javascript');res.end(r.code);return;}if(['/','/program','/auth','/pin/offer'].includes(req.url)){res.setHeader('Content-Type','text/html');res.end(await s.transformIndexHtml(req.url,html));return;}next();});},resolveId(id){if(id==='/program-ui-entry.jsx')return '\0program-ui-entry.jsx';},load(id){if(id==='\0program-ui-entry.jsx')return entry;}}],server:{host:'127.0.0.1',port:13005,strictPort:true,hmr:false},logLevel:'silent'});
 let browser,context,stage='startup';const external=[],failedRoutes=[];let pageErrors=0,requestFailures=0;const failureCodes={};
 const poll=async fn=>{for(let i=0;i<100;i++){if(await fn())return;await new Promise(r=>setTimeout(r,200));}throw Error('Program UI state timed out');};
 const mail=async email=>{const r=await fetch('http://127.0.0.1:54324/api/v1/messages',{signal:AbortSignal.timeout(3000)}).then(r=>r.json());return(r.messages??[]).filter(m=>m.To?.some(v=>v.Address===email));};
 try{await capture?.start();await gateway.start();await server.listen();browser=await chromium.launch({headless:true});context=await browser.newContext();await context.route('**/*',r=>{const u=new URL(r.request().url());if(['http://127.0.0.1:13004','http://127.0.0.1:13005'].includes(u.origin)||u.protocol==='data:')return r.continue();external.push(u.origin);return r.abort();});
  for(const [i,user] of input.users.entries()){stage='login-'+i;const page=await context.newPage();page.on('pageerror',()=>pageErrors++);page.on('requestfailed',r=>{requestFailures++;const c=r.failure()?.errorText?.match(/^net::ERR_[A-Z_]+/)?.[0]??'OTHER';failureCodes[c]=(failureCodes[c]??0)+1;});page.on('response',r=>{const u=new URL(r.url());if(u.origin==='http://127.0.0.1:13004'&&r.status()>=400&&/^[a-z_0-9/-]+$/.test(u.pathname))failedRoutes.push(u.pathname+':'+r.status());});page.setDefaultTimeout(25000);const seen=capture?null:new Set((await mail(user.email)).map(m=>m.ID));await page.goto('http://127.0.0.1:13005/auth');await page.locator('#email').fill(user.email);await page.getByRole('button',{name:'Получить код',exact:true}).click();let code;await poll(async()=>{if(capture){code=capture.codes.get(user.email);return Boolean(code);}const m=(await mail(user.email)).find(m=>!seen.has(m.ID));if(!m)return false;const d=await fetch('http://127.0.0.1:54324/api/v1/message/'+m.ID).then(r=>r.json());code=(d.Text+' '+d.HTML).match(/POTOK_TEST_CODE=(\d{6})/)?.[1];return Boolean(code);});assert.match(code,/^\d{6}$/);capture?.codes.delete(user.email);await page.locator('#otpCodeEmail').fill(code);code=null;await page.getByRole('button',{name:'Войти',exact:true}).click();await page.waitForFunction(id=>window.__programUI?.user===id,user.id);
   if(input.authReloadOnly){
    stage='auth-initial-navigation-'+i;await page.goto('http://127.0.0.1:13005/program');
    stage='auth-initial-session-'+i;await page.waitForFunction(id=>window.__programUI?.user===id&&window.__programUI.authStatus==='authenticated',user.id,{timeout:25000});
    stage='auth-reload-navigation-'+i;await page.reload();
    stage='auth-reload-session-'+i;await page.waitForFunction(id=>window.__programUI?.user===id&&window.__programUI.authStatus==='authenticated',user.id,{timeout:25000});
    stage='auth-reload-runtime-'+i;await page.waitForFunction(()=>['active','empty','error','offline','recovery'].includes(window.__programUI?.runtimeStatus),null,{timeout:25000});
    await page.evaluate(()=>window.__programUI.client.auth.signOut());await page.close();continue;
   }
   stage='screen-'+i;const own=input.manifest.programs.find(p=>p.owner===i&&p.type==='nutrition');await page.goto('http://127.0.0.1:13005/program');await page.waitForFunction(id=>window.__programUI?.programId===id,own.id);await page.getByRole('heading',{name:'Моя программа',exact:true}).waitFor();await page.getByText(input.manifest.day,{exact:true}).waitFor();await page.getByText('Статус: active',{exact:true}).waitFor();assert(await page.getByRole('button',{name:'Перепланировать',exact:true}).isDisabled());
   stage='pause-'+i;await page.getByRole('button',{name:'Пауза',exact:true}).click();await page.getByText('Статус: paused',{exact:true}).waitFor();assert(await page.getByRole('button',{name:'Пауза',exact:true}).isDisabled());
   stage='resume-click-'+i;await page.getByRole('button',{name:'Продолжить',exact:true}).click();stage='resume-status-'+i;await page.getByText('Статус: active',{exact:true}).waitFor();stage='reload-navigation-'+i;await page.reload();stage='reload-program-'+i;await page.waitForFunction(id=>window.__programUI?.programId===id,own.id);stage='reload-status-'+i;await page.getByText('Статус: active',{exact:true}).waitFor();stage='reload-day-'+i;await page.getByText(input.manifest.day,{exact:true}).waitFor();
   stage='foreign-'+i;const foreign=input.manifest.programs.find(p=>p.owner===1-i&&p.type==='nutrition');assert.deepEqual(await page.evaluate(async id=>{const r=await window.__programUI.client.from('nutrition_programs').select('id').eq('id',id);if(r.error)throw Error('Foreign probe failed');return r.data;},foreign.id),[]);
   await page.evaluate(()=>window.__programUI.client.auth.signOut());await page.close();
  }
  assert.equal(gateway.patches,input.authReloadOnly?0:4);assert.equal(external.length,0);if(capture){assert.equal(capture.rejected,0);assert(input.users.every(u=>capture.counts.get(u.email)===1));}
  if(input.authReloadOnly)return {protocol:'potok-program-auth-reload-v1',users:2,authReload:true,dataApiWrites:0,fixtureProgramsCreated:0,hostedChanges:false,releaseReady:false};
  return {protocol:'potok-program-ui-v1',users:2,nutritionScreens:2,pauseResumeActions:4,ownProgramRendered:true,foreignReadDenied:true,generatorDisabled:true,actualUI:true,trainingUI:false,hostedChanges:false,releaseReady:false};
 }catch(error){let status='unknown',authStatus='unknown',probeReady=false;try{const p=await context?.pages().at(-1)?.evaluate(()=>({ready:Boolean(window.__programUI),auth:window.__programUI?.authStatus}));probeReady=p?.ready===true;if(['booting','authenticated','unauthenticated'].includes(p?.auth))authStatus=p.auth;const v=await context?.pages().at(-1)?.evaluate(()=>window.__programUI?.runtimeStatus);if(['loading','active','error','empty','offline','recovery'].includes(v))status=v;}catch{}console.error('PROGRAM_UI_DIAGNOSTIC: '+JSON.stringify({stage,runtime:status,authStatus,probeReady,pageErrors,requestFailures,failureCodes,patches:gateway.patches,...programBrowserFailure(error)}));throw Error('PROGRAM_UI_BROWSER_STOPPED: '+stage+'; runtime='+status+'; routes='+[...new Set(failedRoutes)].slice(-12).join(','));}finally{capture?.codes.clear();await context?.close();await browser?.close();await server.close();await gateway.close();await capture?.close();await rm(temporary,{recursive:true,force:true});}
}
