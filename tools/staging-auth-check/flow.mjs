export const STAGING_ORIGIN='https://ozidryfvhkcbtpnulakq.supabase.co';
const ZERO='00000000-0000-4000-8000-000000000000';
export const CLOSED_CALLS=[
 ['food_evidence_review_v1',{p_request_text:null}],
 ['food_evidence_receipt_v1',{p_idempotency_reference:ZERO}],
 ['food_evidence_current_v1',{p_canonical_food_id:ZERO,p_food_state:'raw'}],
 ['nonfood_evidence_review_v1',{p_request_text:null}],
 ['nonfood_evidence_receipt_v1',{p_key:ZERO}],
 ['nonfood_evidence_current_v1',{p_definition_id:ZERO}],
 ['account_closure_begin_v1',{p_request_text:null}],
];
export function validPublicKey(key){
 if(typeof key!=='string')return false;
 if(/^sb_publishable_[A-Za-z0-9_-]{12,}$/.test(key))return true;
 try{
  const parts=key.split('.');if(parts.length!==3||!parts.every(p=>/^[A-Za-z0-9_-]+$/.test(p)))return false;
  const claims=JSON.parse(atob(parts[1].replace(/-/g,'+').replace(/_/g,'/')));
  return claims.role==='anon'&&claims.ref==='ozidryfvhkcbtpnulakq';
 }catch{return false;}
}
const fail=code=>{throw new Error(code);};
export function createAcceptanceFlow({client,now=()=>Date.now(),intent='existing'}){
 if(!['existing','signup'].includes(intent))fail('STATE_INVALID');
 let phase='email',email='',busy=false,nextSend=0,report=null;
 let verified=false;
 const summary=()=>({phase,busy,resendIn:Math.max(0,Math.ceil((nextSend-now())/1000)),report});
 async function operation(fn){if(busy)fail('BUSY');busy=true;try{return await fn();}finally{busy=false;}}
 async function send(address,consent){return operation(async()=>{
  if(verified||!['email','code'].includes(phase))fail('STATE_INVALID');
  if(now()<nextSend)fail('COOLDOWN');
  if(!consent||typeof address!=='string'||!/^\S+@\S+\.\S+$/.test(address.trim())||address.length>254)fail('EMAIL_REQUIRED');
  email=address.trim();nextSend=now()+60000;
  let result;try{result=await client.auth.signInWithOtp({email,options:{shouldCreateUser:intent==='signup'}});}catch{fail('DELIVERY_UNAVAILABLE');}
  if(result.error)fail(result.error.status===429?'RATE_LIMIT':'DELIVERY_UNAVAILABLE');
  phase='code';return summary();
 });}
 async function verify(code){return operation(async()=>{
  if(phase!=='code'||verified)fail('STATE_INVALID');
  if(typeof code!=='string'||!/^\d{6,10}$/.test(code.trim()))fail('CODE_INVALID');
  let response;try{response=await client.auth.verifyOtp({email,token:code.trim(),type:'email'});}catch{fail('CODE_REJECTED');}
  if(response.error||!response.data?.session)fail('CODE_REJECTED');
  phase='checks'; // allow local sign-out even if subsequent server validation fails
  // getUser asks the Auth server to verify the actual signed session. Decoding a
  // JWT or trusting user_metadata would not be proof of an authenticated actor.
  let userResponse;try{userResponse=await client.auth.getUser();}catch{fail('SESSION_UNVERIFIED');}
  const user=userResponse.data?.user;
  if(userResponse.error||!user?.id||user.is_anonymous!==false)fail('SESSION_UNVERIFIED');
  verified=true;phase='checks';
  report={contract:'potok-staging-auth-transport-check-v1',intent,sessionVerified:true,
   accountState:'NOT_CHECKED',emailDelivery:'CODE_RECEIVED',normalRights:false,rightsVerified:false,existingRights:{},closedRpcCount:0,
   completed:false,serverRegistration:intent==='signup'?'PENDING_INDEPENDENT_SERVER_CHECK':'NOT_TESTED_EXISTING_LOGIN'};
  for(const capability of ['admin','premium']){
   let r;try{r=await client.rpc('has_verified_entitlement_v2',{p_capability:capability},{get:true});}catch{fail('RIGHTS_UNVERIFIED');}
   if(r.error||typeof r.data!=='boolean'||(intent==='signup'&&r.data!==false))fail('RIGHTS_UNVERIFIED');
   report.existingRights[capability]=r.data;
  }
  report.rightsVerified=true;
  report.normalRights=!report.existingRights.admin&&!report.existingRights.premium;
  for(const [name,args] of CLOSED_CALLS){
   // GET only: this must never submit an evidence proposal or closure mutation.
   let r;try{r=await client.rpc(name,args,{get:true});}catch{fail('RPC_UNVERIFIED');}
   const denied=(r.status===403&&r.error?.code==='42501') || (r.status===404&&r.error?.code==='PGRST202');
   if(!denied)fail('RPC_UNVERIFIED');
   report.closedRpcCount++;
  }
  report.completed=true;phase='done';email='';return summary();
 });}
 async function finish(){return operation(async()=>{
  let ok=false;try{const r=await client.auth.signOut({scope:'local'});ok=!r.error;}catch{}
  email='';verified=false;phase='closed';
  if(!ok)fail('SIGNOUT_UNCONFIRMED');return summary();
 });}
 return {summary,send,verify,finish};
}
