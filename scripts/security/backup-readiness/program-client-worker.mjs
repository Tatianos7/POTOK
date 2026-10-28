// Ordinary user tokens only; production ProgramExecutionService + locked SDK/Auth/REST.
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {createMailCapture} from '../accumulated/private-auth-ab-worker.mjs';
export const executionSourceHash='1d4567d603e82ac857ac83fc2e29dae89374d700984c66bfc34ea84d92c680b5';
export async function checkProgramClient({manifest,users,request,createClient,ts,source,apiURL,authUser}){
 assert.equal(createHash('sha256').update(source).digest('hex'),executionSourceHash);assert.equal(users.length,2);users=users.map((u,index)=>({...u,index}));assert.deepEqual(users.map(u=>u.id),manifest.users);
 const exports={};new Function('require','exports',ts.transpileModule(source,{compilerOptions:{target:ts.ScriptTarget.ES2022,module:ts.ModuleKind.CommonJS}}).outputText)(name=>{assert.equal(name,'../lib/supabaseClient');return {supabase:null};},exports);
 const service=(user,swap=false)=>{let patches=0,authCalls=0;const sdk=createClient(apiURL,user.token,{auth:{persistSession:false,autoRefreshToken:false,detectSessionInUrl:false},global:{headers:{Authorization:'Bearer '+user.token},fetch:async(url,options={})=>{
  const u=new URL(url);assert.equal(u.origin,apiURL);assert.equal(u.pathname,'/rest/v1/program_sessions');const method=options.method??'GET';assert(['GET','PATCH'].includes(method));
  if(method==='PATCH'){patches++;const body=JSON.parse(options.body);assert.deepEqual(Object.keys(body).sort(),['execution_reason','status']);for(const k of ['id','program_id','date','session_type'])assert(u.searchParams.get(k)?.startsWith('eq.'));}
  return request(url,options);
 }}});return {execution:new exports.ProgramExecutionService({from:sdk.from.bind(sdk),auth:{getUser:async()=>({data:{user:await authUser(swap&&authCalls++>0?users[1-user.index]:user)},error:null})}}),patches:()=>patches};};
 const call=async(route,user,method='GET',body)=>{const r=await request(apiURL+'/rest/v1/'+route,{method,headers:{Authorization:'Bearer '+user.token,'Content-Type':'application/json',Prefer:'return=representation'},...(body===undefined?{}:{body:JSON.stringify(body)})});const text=await r.text();return {status:r.status,body:text?JSON.parse(text):null};};
 const ok=async p=>{const r=await p;assert.equal(r.status,200);return r.body;},rpc=(name,user,body)=>call('rpc/'+name,user,'POST',body);
 const masked=r=>{assert.equal(r.knowledge_refs,null);assert.equal(r.confidence,null);assert.deepEqual(r.guard_notes,{reason_code:'synthetic'});};
 const diary=await Promise.all(users.map(u=>ok(call('food_diary_entries?order=id',u))));let actions=0;
 for(const p of manifest.programs){const own=users[p.owner],foreign=users[1-p.owner],route='program_sessions?id=eq.'+p.id;
  const parent=await ok(call(p.type+'_programs?id=eq.'+p.id,own));assert.equal(parent.length,1);assert.equal(parent[0].user_id,own.id);
  const initial=await ok(call(route,own));assert.equal(initial.length,1);assert.equal(initial[0].status,'planned');assert.deepEqual(initial[0].plan_payload,{synthetic_tag:manifest.tag,program_type:p.type});
  const days=await ok(rpc('get_program_days',own,{p_program_id:p.id}));assert.equal(days.length,1);assert.equal(days[0].date,manifest.day);assert.equal(days[0].block_id,p.id);
  const details=await ok(rpc('get_program_day_details',own,{p_program_id:p.id,p_date:manifest.day}));assert.equal(details.day.id,p.id);
  const explanations=await ok(rpc('get_program_explainability',own,{p_program_id:p.id,p_version:null}));assert.equal(explanations.length,1);masked(explanations[0]);for(const e of details.explainability)masked(e);
  assert.deepEqual(await ok(call(p.type+'_programs?id=eq.'+p.id,foreign)),[]);assert.deepEqual(await ok(call(route,foreign)),[]);assert.deepEqual(await ok(rpc('get_program_days',foreign,{p_program_id:p.id})),[]);assert.deepEqual(await ok(rpc('get_program_explainability',foreign,{p_program_id:p.id,p_version:null})),[]);assert.equal((await ok(rpc('get_program_day_details',foreign,{p_program_id:p.id,p_date:manifest.day}))).day,null);
  const input={programId:p.id,date:manifest.day,programType:p.type,reason:'fatigue'},f=service(own);
  for(const status of ['planned','completed','skipped']){const receipt=await f.execution.annotate({...input,status});assert.equal(receipt.userId,own.id);assert.equal(receipt.sessionId,p.id);const saved=(await ok(call(route,own)))[0];assert.equal(saved.status,status);assert.equal(saved.execution_reason,status==='skipped'?'fatigue':null);assert.deepEqual(saved.plan_payload,initial[0].plan_payload);assert.equal(saved.day_date,initial[0].day_date);actions++;}
  assert.equal(f.patches(),3);const other=service(foreign);await assert.rejects(()=>other.execution.annotate({...input,status:'completed'}),e=>e.code==='PROGRAM_SESSION_NOT_AVAILABLE');assert.equal(other.patches(),0);
  const changed=service(own,true);await assert.rejects(()=>changed.execution.annotate({...input,status:'completed'}),e=>e.code==='PROGRAM_EXECUTION_ACCOUNT_CHANGED');assert.equal(changed.patches(),0);
  for(const body of [{plan_payload:{forged:true}},{day_date:'2199-02-01'}]){const denied=await call(route,own,'PATCH',body);assert.equal(denied.status,403);assert.equal(denied.body.code,'42501');}
  const forbidden=await call(p.type+'_programs?id=eq.'+p.id,own,'PATCH',{program_version:99});assert.equal(forbidden.status,403);assert.equal(forbidden.body.code,'42501');
 }
 assert.deepEqual(await Promise.all(users.map(u=>ok(call('food_diary_entries?order=id',u)))),diary);
 return {protocol:'potok-program-client-http-v1',users:2,programs:4,clientActions:actions,foreignAccessDenied:true,accountSwitchDenied:true,protectedPlanWritesDenied:true,planFactPreserved:true,actualClient:true,actualHttp:true,uiAcceptance:false,releaseReady:false};
}
export async function runPrivateProgramClient(input,{createClient,ts,source}){
 const capture=createMailCapture(input.users.map(u=>u.email)),users=[];let started=false,phase='capture';
 const auth=async(route,body,user)=>{assert(['otp','verify','user'].includes(route));const r=await fetch('http://127.0.0.1:13002/'+route,{method:body?'POST':'GET',headers:{'Content-Type':'application/json',...(user?{Authorization:'Bearer '+user.token}:{})},...(body?{body:JSON.stringify(body)}:{}),redirect:'error',signal:AbortSignal.timeout(10000)});assert.equal(r.status,200);return r.json();};
 try{await capture.start();started=true;for(const u of input.users){phase='otp';await auth('otp',{email:u.email,create_user:false});for(let n=0;!capture.codes.has(u.email)&&n<100;n++)await new Promise(r=>setTimeout(r,100));let code=capture.codes.get(u.email);assert.match(code??'',/^\d{6}$/);capture.codes.delete(u.email);const v=await auth('verify',{email:u.email,token:code,type:'email'});code=null;assert.equal(v.user.id,u.id);assert.equal(v.user.email,u.email);const claims=JSON.parse(Buffer.from(v.access_token.split('.')[1],'base64url'));assert.equal(claims.sub,u.id);assert.equal(claims.role,'authenticated');users.push({...u,token:v.access_token});}
  phase='client';const result=await checkProgramClient({manifest:input.manifest,users,createClient,ts,source,apiURL:'http://127.0.0.1:33001',authUser:u=>auth('user',undefined,u),request:(url,o)=>{const u=new URL(url);assert.equal(u.origin,'http://127.0.0.1:33001');assert(u.pathname.startsWith('/rest/v1/'));u.pathname=u.pathname.slice('/rest/v1'.length);return fetch(u,{...o,redirect:'error',signal:AbortSignal.timeout(10000)});}});
  assert.equal(capture.rejected,0);assert(input.users.every(u=>capture.counts.get(u.email)===1));return result;
 }catch{throw Error('PROGRAM_CLIENT_WORKER_STOPPED: '+phase);}finally{users.forEach(u=>u.token=null);capture.codes.clear();if(started)await capture.close();}
}
