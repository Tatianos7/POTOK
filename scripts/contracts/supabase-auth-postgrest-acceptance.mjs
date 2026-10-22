// POTOK real PostgREST/Auth acceptance gate.
// Run ONLY against an explicitly approved disposable Supabase instance
// containing disposable test users and records. Never point at production.
// Requires: POTOK_TEST_SUPABASE_URL, POTOK_TEST_ANON_KEY,
// POTOK_TEST_USER_A_JWT, POTOK_TEST_USER_B_JWT,
// POTOK_TEST_USER_A_ID, POTOK_TEST_USER_B_ID.
// Does not provision users or change any database grants.
import assert from 'node:assert/strict';

const names = [
  'POTOK_TEST_SUPABASE_URL', 'POTOK_TEST_ANON_KEY',
  'POTOK_TEST_USER_A_JWT', 'POTOK_TEST_USER_B_JWT',
  'POTOK_TEST_USER_A_ID', 'POTOK_TEST_USER_B_ID',
  'POTOK_TEST_USER_C_ID', 'POTOK_TEST_USER_C_JWT',
];
for (const key of names) {
  if (!process.env[key]) throw new Error(`Missing ${key}; real Supabase acceptance NOT run`);
}
const env = Object.fromEntries(names.map(k => [k, process.env[k]]));
const base = new URL(env.POTOK_TEST_SUPABASE_URL);
assert.match(base.protocol, /^https?:$/);
assert(!['dtsdnhbcwpbfrhcazqkb.supabase.co','ozidryfvhkcbtpnulakq.supabase.co'].includes(base.hostname),
  'Refusing to run against POTOK production or staging');
const ids = [env.POTOK_TEST_USER_A_ID, env.POTOK_TEST_USER_B_ID];
assert(ids.every(x => /^[0-9a-f]{8}-[0-9a-f-]{27,}$/i.test(x)) && ids[0] !== ids[1],
  'Distinct disposable user UUIDs required');
const api = new URL('/rest/v1/', base);
async function request(jwt, table, method, {query = '', body} = {}) {
  const url = new URL(table + query, api);
  const res = await fetch(url, {
    method,
    headers: {
      apikey: env.POTOK_TEST_ANON_KEY,
      Authorization: `Bearer ${jwt}`,
      'Content-Type': 'application/json',
      Prefer: 'return=representation',
    },
    ...(body === undefined ? {} : {body: JSON.stringify(body)}),
  });
  const raw = await res.text();
  let data;
  try { data = raw ? JSON.parse(raw) : null; } catch { data = raw; }
  return {status: res.status, ok: res.ok, data};
}
function denied(r, name) {
  assert(!r.ok, `${name}: unexpectedly allowed (HTTP ${r.status})`);
}
function readableOwnOnly(r, ownId, otherId, name) {
  assert(r.ok && Array.isArray(r.data), `${name}: cannot read profile`);
  assert(r.data.every(x => x.id_user !== otherId), `${name}: cross-user data leak`);
  assert(r.data.some(x => x.id_user === ownId), `${name}: own seeded profile missing`);
}
const [a,b] = ids;
const jwtA = env.POTOK_TEST_USER_A_JWT;
const jwtB = env.POTOK_TEST_USER_B_JWT;
const q = '?select=id_user,first_name,has_premium,is_admin';
readableOwnOnly(await request(jwtA,'user_profiles','GET',{query:q}),a,b,'user A SELECT');
readableOwnOnly(await request(jwtB,'user_profiles','GET',{query:q}),b,a,'user B SELECT');
// These must fail by SQL privilege even for the caller's own row.
for (const [field,value] of [['has_premium',true],['is_admin',true]]) {
  denied(await request(jwtA,'user_profiles','PATCH',{
    query:`?id_user=eq.${a}`,body:{[field]:value}
  }), `user A PATCH ${field}`);
}
// Profile ownership: a foreign row must not be modified.
const cross = await request(jwtA,'user_profiles','PATCH',{
  query:`?id_user=eq.${b}`,body:{first_name:'unauthorized-edit'}
});
assert(cross.ok && Array.isArray(cross.data) && cross.data.length === 0,
  'Cross-user profile update should affect zero rows under RLS');
// Client-side payment authority must be denied regardless of row ownership.
for (const [table,body] of [
  ['subscriptions',{user_id:a}],['entitlements',{user_id:a}],
  ['billing_events',{user_id:a}]
]) {
  denied(await request(jwtA,table,'POST',{body}), `user A INSERT ${table}`);
}
// Ordinary profile writes should remain usable after privilege hardening.
for (const [field,value] of [
  ['coach_settings',{mode:'off'}],['voice_settings',{enabled:false}]
]) {
  const response=await request(jwtA,'user_profiles','PATCH',{
    query:`?id_user=eq.${a}`,body:{[field]:value}
  });
  assert(response.ok && response.data?.length===1,
    `Own profile ${field} update failed (HTTP ${response.status}): ${JSON.stringify(response.data)}`);
}
// Profile service now uses a scoped SELECT then PATCH for existing profiles.
const ordinaryUpdate=await request(jwtA,'user_profiles','PATCH',{
  query:`?id_user=eq.${a}`,body:{first_name:'scoped-update-test'}
});
assert(ordinaryUpdate.ok && ordinaryUpdate.data?.length===1 &&
  ordinaryUpdate.data[0].first_name==='scoped-update-test',
  `Ordinary profile PATCH failed (HTTP ${ordinaryUpdate.status}): ${JSON.stringify(ordinaryUpdate.data)}`);
// Exercise a truly new profile: delete only the disposable user's own seeded row,
// then create it using the least-privilege INSERT used by the profile service.
const deleteOwnSeed=await request(jwtB,'user_profiles','DELETE',{
  query:`?id_user=eq.${b}`
});
// DELETE is intentionally not granted. A disposable fixture may only be reset by
// the privileged setup script, so use a separate unseeded disposable Auth user instead.
assert(!deleteOwnSeed.ok,'Authenticated profile DELETE unexpectedly allowed');
// Third disposable Auth user has no profile. Exercise the first-write path and
// simultaneous INSERT race: exactly one create succeeds; the other conflicts.
const newId=env.POTOK_TEST_USER_C_ID;
const newJwt=env.POTOK_TEST_USER_C_JWT;
const beforeCreate=await request(newJwt,'user_profiles','GET',{
  query:`?id_user=eq.${newId}&select=id_user`
});
assert(beforeCreate.ok && Array.isArray(beforeCreate.data) && beforeCreate.data.length===0,
  'Third Auth user must start without a profile');
const creation=await Promise.all([
  request(newJwt,'user_profiles','POST',{body:{id_user:newId,first_name:'first'}}),
  request(newJwt,'user_profiles','POST',{body:{id_user:newId,first_name:'second'}}),
]);
assert(creation.filter(x=>x.ok).length===1,
  `Concurrent profile INSERTs must have one winner: ${JSON.stringify(creation)}`);
assert(creation.filter(x=>x.data?.code==='23505').length===1,
  `Concurrent profile INSERT loser must receive unique conflict: ${JSON.stringify(creation)}`);
// The profile service handles 23505 by PATCHing ordinary fields only.
const retry=await request(newJwt,'user_profiles','PATCH',{
  query:`?id_user=eq.${newId}`,body:{first_name:'conflict-recovered'}
});
assert(retry.ok && retry.data?.length===1 &&
  retry.data[0].first_name==='conflict-recovered',
  `Conflict recovery PATCH failed: ${JSON.stringify(retry)}`);
const created=await request(newJwt,'user_profiles','GET',{
  query:`?id_user=eq.${newId}&select=id_user,first_name,has_premium,is_admin`
});
assert(created.ok && created.data?.length===1 &&
  created.data[0].id_user===newId && created.data[0].first_name==='conflict-recovered' &&
  created.data[0].has_premium===false && created.data[0].is_admin===false,
  `New profile not persisted safely: ${JSON.stringify(created)}`);
// A broad ON CONFLICT UPSERT must NOT be enabled merely to support profile writes.
const unsafeUpsert=await fetch(new URL('user_profiles?on_conflict=id_user',api),{
  method:'POST',
  headers:{
    apikey:env.POTOK_TEST_ANON_KEY,
    Authorization:`Bearer ${jwtA}`,
    'Content-Type':'application/json',
    Prefer:'resolution=merge-duplicates,return=representation',
  },
  body:JSON.stringify({id_user:a,first_name:'unsafe-upsert'}),
});
assert(!unsafeUpsert.ok,'Unsafe broad UPSERT unexpectedly allowed');
// Attempt privilege escalation during INSERT, not just UPDATE.
for (const [field,value] of [['has_premium',true],['is_admin',true]]) {
  denied(await request(jwtA,'user_profiles','POST',{
    body:{id_user:a,[field]:value}
  }), `user A INSERT ${field}`);
}
// Anonymous callers must not see user profiles or modify financial records.
const anonymous=await request(env.POTOK_TEST_ANON_KEY,'user_profiles','GET',{query:q});
assert(
  (anonymous.status === 401 || anonymous.status === 403) ||
  (anonymous.ok && Array.isArray(anonymous.data) && anonymous.data.length === 0),
  `Anonymous profile access unexpectedly exposed data or returned an unrecognized response (HTTP ${anonymous.status}): ${JSON.stringify(anonymous.data)}`
);
for(const table of ['subscriptions','entitlements','billing_events']) {
  denied(await request(jwtA,table,'PATCH',{
    query:`?user_id=eq.${a}`,body:table==='subscriptions'?{status:'premium'}:
      table==='entitlements'?{tier:'premium'}:{description:'forged'}
  }), `user A UPDATE ${table}`);
  denied(await request(jwtA,table,'DELETE',{
    query:`?user_id=eq.${a}`
  }), `user A DELETE ${table}`);
}
console.log('PASS: real PostgREST RLS, profile settings, protected INSERT/UPDATE and financial write denials');

async function rpc(jwt,name,body) {
 return request(jwt,'rpc/'+name,'POST',{body});
}
// Regression: a Free user must not self-issue Premium capability flags.
for (const [method,body,query] of [
  ['POST',{user_id:a,tier:'premium',flags:{can_adapt:true,can_explain:true}},''],
  ['PATCH',{flags:{can_adapt:true,can_explain:true}},`?user_id=eq.${a}`],
]) {
  denied(await request(jwtA,'entitlements',method,{query,body}),
    `Free self-service entitlement ${method} with can_adapt/can_explain`);
}
const freeAfterForgery=await rpc(jwtA,'get_entitlements',{p_user_id:a});
assert(freeAfterForgery.ok && freeAfterForgery.data?.tier==='free' &&
  freeAfterForgery.data?.flags?.can_adapt!==true &&
  freeAfterForgery.data?.flags?.can_explain!==true,
  'Free capabilities must remain disabled after rejected entitlement forgery');
console.log('PASS: Free user cannot self-grant can_adapt/can_explain via PostgREST');
const entOwn=await rpc(jwtA,'get_entitlements',{p_user_id:a});
assert(entOwn.ok && entOwn.data?.tier==='free',
  'Own entitlement read must work for authenticated caller');
const entDefault=await rpc(jwtA,'get_entitlements',{});
assert(entDefault.ok && entDefault.data?.tier==='free',
  'Default entitlement read must resolve auth.uid()');
denied(await rpc(jwtA,'get_entitlements',{p_user_id:b}),
  'Cross-account entitlement read');
denied(await rpc(jwtA,'get_paywall_state',{p_feature:'adaptation',p_user_id:b}),
  'Cross-account paywall read');
const paywall=await rpc(jwtA,'get_paywall_state',{p_feature:'adaptation',p_user_id:a});
assert(paywall.ok && paywall.data?.locked===true && paywall.data?.reason==='adaptation_locked',
  'Own Free adaptation paywall must stay locked');
for (const [feature,reason,tier] of [
 ['explainability','explainability_locked','pro'],
 ['spatial','spatial_locked','vision_pro']
]) {
 const result=await rpc(jwtA,'get_paywall_state',{p_feature:feature,p_user_id:a});
 assert(result.ok && result.data?.locked===true && result.data?.reason===reason && result.data?.required_tier===tier,
  `Production-compatible Free paywall branch ${feature} failed: ${JSON.stringify(result)}`);
}
for (const name of ['get_entitlements','get_paywall_state']) {
 denied(await rpc(env.POTOK_TEST_ANON_KEY,name,
   name==='get_entitlements'?{p_user_id:a}:{p_feature:'adaptation',p_user_id:a}),
   'Anonymous '+name);
}
for(const name of ['start_purchase','restore_purchase']) {
 for(const [jwt,label] of [[jwtA,'authenticated'],[env.POTOK_TEST_ANON_KEY,'anonymous']]) {
  denied(await rpc(jwt,name,{
   p_user_id:b,p_provider:'fixture',p_idempotency_key:'test-'+name,
   ...(name==='start_purchase'?{p_plan:'pro'}:{p_receipt:'fake'})
  }),label+' '+name+' forged cross-account event');
 }
}
console.log('PASS: Premium RPC own reads, cross-account denial, anonymous denial, purchase RPC client denial');

assert(process.env.POTOK_TEST_SERVICE_ROLE_KEY,'Local service role credential required');
const serviceKey=process.env.POTOK_TEST_SERVICE_ROLE_KEY;
const purchaseId='trusted-purchase-'+a;
const restoreId='trusted-restore-'+a;
const trustedPurchase=await rpc(serviceKey,'start_purchase',{
 p_user_id:a,p_provider:'play_store',p_plan:'pro',p_idempotency_key:purchaseId
});
assert(trustedPurchase.ok && trustedPurchase.data?.status==='started',
 'Trusted purchase RPC must be callable by service_role');
const trustedRestore=await rpc(serviceKey,'restore_purchase',{
 p_user_id:a,p_provider:'play_store',p_receipt:'fixture-only',p_idempotency_key:restoreId
});
assert(trustedRestore.ok && trustedRestore.data?.status==='restored',
 'Trusted restore RPC must be callable by service_role');
const events=await request(serviceKey,'billing_events','GET',{
 query:'?user_id=eq.'+a+'&select=user_id,event_type,idempotency_key,payload'
});
assert(events.ok && Array.isArray(events.data) && events.data.length===2,
 'Trusted purchase/restore must persist two disposable billing events');
assert(events.data.some(x=>x.event_type==='purchase_started'&&x.idempotency_key===purchaseId),
 'Missing trusted purchase event');
assert(events.data.some(x=>x.event_type==='restore'&&x.idempotency_key===restoreId),
 'Missing trusted restore event');
const duplicate=await rpc(serviceKey,'start_purchase',{
 p_user_id:a,p_provider:'play_store',p_plan:'pro',p_idempotency_key:purchaseId
});
assert(duplicate.ok,'Idempotent trusted purchase retry must succeed');
const afterRetry=await request(serviceKey,'billing_events','GET',{
 query:'?user_id=eq.'+a+'&select=idempotency_key'
});
assert(afterRetry.ok&&afterRetry.data?.length===2,
 'Idempotent retry must not duplicate events');
console.log('PASS: trusted service_role purchase and restore persist events and retry idempotently');

 // Explainability must be gated by server authority, not just UI filtering.
const programA=process.env.POTOK_TEST_PROGRAM_A_ID;
const programB=process.env.POTOK_TEST_PROGRAM_B_ID;
assert(programA && programB && programA!==programB,'Distinct disposable program IDs required');
// Adaptation authority must enforce authenticated ownership and server-issued capability.
const adaptArgs=(programId,programType='nutrition')=>({
 p_program_id:programId,p_program_type:programType
});
denied(await rpc(jwtA,'assert_program_adaptation_authority',adaptArgs(programA)),
 'Free A cannot adapt own program');
denied(await rpc(jwtB,'assert_program_adaptation_authority',adaptArgs(programA)),
 'Premium B cannot adapt another user program');
denied(await rpc(env.POTOK_TEST_ANON_KEY,'assert_program_adaptation_authority',adaptArgs(programB)),
 'Anonymous cannot request adaptation authority');
denied(await rpc(jwtB,'assert_program_adaptation_authority',adaptArgs(programB,'invalid')),
 'Invalid program type rejected');
const premiumAdapt=await rpc(jwtB,'assert_program_adaptation_authority',adaptArgs(programB));
assert(premiumAdapt.ok && premiumAdapt.data===true,
 'Premium B must pass server-side own-program adaptation authority: '+JSON.stringify(premiumAdapt));
console.log('PASS: server adaptation authority Free/Premium/foreign/anonymous/type boundaries');
for(const [jwt,label] of [
 [jwtA,'Free A'],[jwtB,'Premium B'],[env.POTOK_TEST_ANON_KEY,'anonymous']
]) {
 denied(await request(jwt,'program_explainability','GET',{query:'?select=id,decision_ref'}),
   label+' direct explainability table SELECT');
}
denied(await rpc(jwtA,'get_program_explainability',{p_program_id:programA}),
 'Free A own explainability RPC');
denied(await rpc(env.POTOK_TEST_ANON_KEY,'get_program_explainability',{p_program_id:programB}),
 'Anonymous explainability RPC');
const premiumOwn=await rpc(jwtB,'get_program_explainability',{p_program_id:programB});
assert(premiumOwn.ok && Array.isArray(premiumOwn.data) &&
 premiumOwn.data.length===1 && premiumOwn.data[0].decision_ref==='fixture-premium',
 'Premium B must read own program evidence through guarded RPC: '+JSON.stringify(premiumOwn));
const premiumOther=await rpc(jwtB,'get_program_explainability',{p_program_id:programA});
assert(premiumOther.ok && Array.isArray(premiumOther.data) && premiumOther.data.length===0,
 'Premium B must not read Free A program evidence');
console.log('PASS: explainability Free denial, Premium own access, cross-owner isolation, anonymous and direct-table denial');

const pauseBody={p_program_id:programA,p_program_type:'nutrition',p_reason:'user requested pause'};
denied(await rpc(jwtB,'pause_program_atomic',pauseBody),'Cross-user atomic pause');
denied(await rpc(env.POTOK_TEST_ANON_KEY,'pause_program_atomic',pauseBody),'Anonymous atomic pause');
const firstPause=await rpc(jwtA,'pause_program_atomic',pauseBody);
assert(firstPause.ok && firstPause.data?.status==='paused' && firstPause.data?.changed===true,
 'Own atomic pause failed: '+JSON.stringify(firstPause));
const repeatedPause=await rpc(jwtA,'pause_program_atomic',pauseBody);
assert(repeatedPause.ok && repeatedPause.data?.changed===false,'Repeat pause must be idempotent');
const paused=await request(serviceKey,'nutrition_programs','GET',{query:'?id=eq.'+programA+'&select=status'});
assert(paused.data?.length===1 && paused.data[0].status==='paused','Pause status not persisted');
const pauseEvents=await request(serviceKey,'program_guard_events','GET',{query:'?program_id=eq.'+programA+'&select=id'});
assert(pauseEvents.data?.length===1,'Pause must persist exactly one guard event');
const pauseEvidence=await request(serviceKey,'program_explainability','GET',{query:'?program_id=eq.'+programA+'&select=decision_ref'});
assert(pauseEvidence.data?.length===2 && pauseEvidence.data.some(x=>x.decision_ref==='why_paused'),
 'Pause must persist exactly one additional explanation');
console.log('PASS: atomic pause ownership, anonymous denial, retry, status and evidence');

const concurrentId=process.env.POTOK_TEST_PROGRAM_CONCURRENT_ID;
const concurrentBody={p_program_id:concurrentId,p_program_type:'nutrition',p_reason:'concurrent pause'};
const simultaneous=await Promise.all(Array.from({length:4},()=>rpc(jwtA,'pause_program_atomic',concurrentBody)));
assert(simultaneous.every(x=>x.ok), 'Concurrent pause calls must all succeed: '+JSON.stringify(simultaneous));
assert(simultaneous.filter(x=>x.data?.changed===true).length===1,
 'Exactly one concurrent pause should transition the state');
const concurrentEvents=await request(serviceKey,'program_guard_events','GET',{query:'?program_id=eq.'+concurrentId+'&select=id'});
const concurrentEvidence=await request(serviceKey,'program_explainability','GET',{query:'?program_id=eq.'+concurrentId+'&select=id'});
assert(concurrentEvents.ok && concurrentEvents.data.length===1 && concurrentEvidence.ok && concurrentEvidence.data.length===1,
 'Concurrent pause must persist one guard event and one evidence record');
const rollbackId=process.env.POTOK_TEST_TRAINING_ROLLBACK_ID;
const failedPause=await rpc(jwtA,'pause_program_atomic',{p_program_id:rollbackId,p_program_type:'training',p_reason:'rollback probe'});
denied(failedPause,'Disposable forced guard-event failure');
const afterFailure=await request(serviceKey,'training_programs','GET',{query:'?id=eq.'+rollbackId+'&select=status'});
assert(afterFailure.ok && afterFailure.data.length===1 && afterFailure.data[0].status==='active',
 'Failed pause must roll back status update');
const failedEvents=await request(serviceKey,'program_guard_events','GET',{query:'?program_id=eq.'+rollbackId+'&select=id'});
const failedEvidence=await request(serviceKey,'program_explainability','GET',{query:'?program_id=eq.'+rollbackId+'&select=id'});
assert(failedEvents.ok && failedEvents.data.length===0 && failedEvidence.ok && failedEvidence.data.length===0,
 'Failed pause must roll back guard and explainability records');
console.log('PASS: concurrent pause serialization and forced failure atomic rollback');


// Day RPCs must preserve Free plan content while redacting Premium evidence.
const freeDays=await rpc(jwtA,'get_program_days',{p_program_id:programA});
assert(freeDays.ok && Array.isArray(freeDays.data) && freeDays.data.length===1,
 'Free user must retain normal day plan: '+JSON.stringify(freeDays));
assert(freeDays.data[0].targets?.calories===1800 && freeDays.data[0].explainability_summary===null,
 'Free day plan must keep targets and redact Premium summary');
const premiumDays=await rpc(jwtB,'get_program_days',{p_program_id:programB});
assert(premiumDays.ok && premiumDays.data?.length===1 &&
 premiumDays.data[0].explainability_summary?.decision_ref==='fixture-premium',
 'Premium owner must retain explainability summary: '+JSON.stringify(premiumDays));
const freeDetails=await rpc(jwtA,'get_program_day_details',{p_program_id:programA,p_date:'2026-10-22'});
assert(freeDetails.ok && freeDetails.data?.day?.targets?.calories===1800 &&
 freeDetails.data?.explainability===null,'Free day details must redact full evidence');
const premiumDetails=await rpc(jwtB,'get_program_day_details',{p_program_id:programB,p_date:'2026-10-22'});
assert(premiumDetails.ok && premiumDetails.data?.explainability?.length===1 &&
 premiumDetails.data.explainability[0].decision_ref==='fixture-premium',
 'Premium day details must include own evidence: '+JSON.stringify(premiumDetails));
for(const fn of ['get_program_days','get_program_day_details']){
 const ownArgs=fn==='get_program_days'?{p_program_id:programA}:{p_program_id:programA,p_date:'2026-10-22'};
 denied(await rpc(jwtB,fn,ownArgs),'Cross-account '+fn);
 denied(await rpc(env.POTOK_TEST_ANON_KEY,fn,ownArgs),'Anonymous '+fn);
}
console.log('PASS: Free plan preserved, Premium evidence redacted, owner and anonymous boundaries enforced for both day RPCs');


// Regression: multiple evidence rows for one program version must not duplicate day cards.
const extraEvidence=await request(serviceKey,'program_explainability','POST',{
 body:{program_id:programB,program_type:'nutrition',version:1,decision_ref:'fixture-premium-extra'}
});
assert(extraEvidence.ok,'Failed to seed second Premium evidence row: '+JSON.stringify(extraEvidence));
const noDuplicateDays=await rpc(jwtB,'get_program_days',{p_program_id:programB});
assert(noDuplicateDays.ok && noDuplicateDays.data?.length===1,
 'Multiple evidence rows must not multiply day cards: '+JSON.stringify(noDuplicateDays));
console.log('PASS: multiple explanation records do not duplicate program day cards');

// Atomic adaptation transition: permission, replay, version CAS, concurrency, rollback.
const advance=(id,version,key,type='nutrition')=>rpc(jwtB,'advance_program_adaptation_atomic',{
 p_program_id:id,p_program_type:type,p_expected_version:version,p_idempotency_key:key
});
const idempotencyKey=crypto.randomUUID();
denied(await rpc(jwtA,'advance_program_adaptation_atomic',{
 p_program_id:programA,p_program_type:'nutrition',p_expected_version:1,p_idempotency_key:crypto.randomUUID()
}), 'Free adaptation transition');
denied(await advance(programA,1,crypto.randomUUID()),'Cross-user adaptation transition');
denied(await rpc(env.POTOK_TEST_ANON_KEY,'advance_program_adaptation_atomic',{
 p_program_id:programB,p_program_type:'nutrition',p_expected_version:1,p_idempotency_key:crypto.randomUUID()
}), 'Anonymous adaptation transition');
const parallelAdapt=await Promise.all(Array.from({length:4},()=>advance(programB,1,idempotencyKey)));
assert(parallelAdapt.every(x=>x.ok) &&
 parallelAdapt.filter(x=>x.data?.status==='pending_server_generation').length===1 &&
 parallelAdapt.filter(x=>x.data?.status==='already_applied').length===3,
 'Same-key concurrent adaptation must commit once: '+JSON.stringify(parallelAdapt));
const afterAdapt=await request(serviceKey,'nutrition_programs','GET',{query:'?id=eq.'+programB+'&select=program_version'});
assert(afterAdapt.ok && afterAdapt.data?.[0]?.program_version===2,'Atomic version transition missing');
const versionRows=await request(serviceKey,'program_versions','GET',{query:'?program_id=eq.'+programB+'&select=version,snapshot'});
const adaptedEvidence=await request(serviceKey,'program_explainability','GET',{query:'?program_id=eq.'+programB+'&version=eq.2&select=id'});
assert(versionRows.ok && versionRows.data?.length===1 && adaptedEvidence.ok && adaptedEvidence.data?.length===1,
 'Atomic transition must persist exactly one version and evidence');
denied(await advance(programB,1,crypto.randomUUID()),'Stale adaptation expected version');
denied(await advance(programB,2,idempotencyKey),'Reused key with changed expected version');
const failureId=process.env.POTOK_TEST_ADAPT_ROLLBACK_ID;
assert(failureId,'Disposable Premium training rollback program missing');
denied(await advance(failureId,1,crypto.randomUUID(),'training'),'Forced adaptation version insert failure');
const rollbackProgram=await request(serviceKey,'training_programs','GET',{query:'?id=eq.'+failureId+'&select=program_version'});
const rollbackVersions=await request(serviceKey,'program_versions','GET',{query:'?program_id=eq.'+failureId+'&select=id'});
const rollbackEvidence=await request(serviceKey,'program_explainability','GET',{query:'?program_id=eq.'+failureId+'&select=id'});
assert(rollbackProgram.ok && rollbackProgram.data?.[0]?.program_version===1 &&
 rollbackVersions.ok && rollbackVersions.data?.length===0 &&
 rollbackEvidence.ok && rollbackEvidence.data?.length===0,
 'Failed adaptation must leave program version and evidence unchanged');
console.log('PASS: atomic adaptation permissions, concurrent idempotency, stale CAS and forced rollback');

const futureDate='2026-11-01';
assert.match(process.env.POTOK_TEST_PREMIUM_BLOCK_ID ?? '',/^[0-9a-f-]{36}$/i,
 'Disposable Premium block UUID required for nutrition replan test');
const futureDay=await request(serviceKey,'program_days','POST',{body:{
 block_id:process.env.POTOK_TEST_PREMIUM_BLOCK_ID,date:futureDate,targets:{calories:2100}
}});
assert(futureDay.ok,'Could not seed future nutrition plan day: '+JSON.stringify(futureDay));
const replanKey=crypto.randomUUID();
const replanBody={p_program_id:programB,p_expected_version:2,p_request_id:replanKey,p_mode:'deload'};
denied(await rpc(jwtA,'adapt_nutrition_program_atomic_v1',replanBody),'Free cross-user nutrition replan');
denied(await rpc(jwtB,'adapt_nutrition_program_atomic_v1',{...replanBody,p_program_id:programA}),
 'Premium cannot replan another user program');
denied(await rpc(jwtB,'adapt_nutrition_program_atomic_v1',{...replanBody,p_mode:'unbounded'}),
 'Unrecognized nutrition adaptation mode');
denied(await rpc(env.POTOK_TEST_ANON_KEY,'adapt_nutrition_program_atomic_v1',replanBody),
 'Anonymous nutrition replan');
const replanParallel=await Promise.all(Array.from({length:3},
 ()=>rpc(jwtB,'adapt_nutrition_program_atomic_v1',replanBody)));
assert(replanParallel.every(x=>x.ok) &&
 replanParallel.filter(x=>x.data?.status==='applied').length===1 &&
 replanParallel.filter(x=>x.data?.status==='already_applied').length===2,
 'Nutrition replan must be atomic/idempotent: '+JSON.stringify(replanParallel));
const changedFuture=await request(serviceKey,'program_days','GET',{
 query:'?block_id=eq.'+process.env.POTOK_TEST_PREMIUM_BLOCK_ID+'&date=eq.'+futureDate+'&select=targets'});
assert(changedFuture.ok && changedFuture.data?.[0]?.targets?.calories===1600,
 'Future nutrition targets must derive from authoritative user goals');
const unchangedPast=await request(serviceKey,'program_days','GET',{
 query:'?block_id=eq.'+process.env.POTOK_TEST_PREMIUM_BLOCK_ID+'&date=eq.2026-10-22&select=targets'});
assert(unchangedPast.ok && unchangedPast.data?.[0]?.targets?.calories===2100,
 'Past nutrition targets must remain unchanged');
denied(await rpc(jwtB,'adapt_nutrition_program_atomic_v1',{...replanBody,p_mode:'maintain'}),
 'Idempotency key reused with different mode');
denied(await rpc(jwtB,'adapt_nutrition_program_atomic_v1',{
 ...replanBody,p_request_id:crypto.randomUUID()
}),'Stale nutrition version');
console.log('PASS: server-owned future nutrition recalculation, past-day preservation and concurrent idempotency');
const postReplanVersion=await request(serviceKey,'nutrition_programs','GET',{
 query:'?id=eq.'+programB+'&select=program_version'});
const postReplanVersions=await request(serviceKey,'program_versions','GET',{
 query:'?program_id=eq.'+programB+'&program_type=eq.nutrition&version=eq.3&select=version,snapshot'});
const postReplanEvidence=await request(serviceKey,'program_explainability','GET',{
 query:'?program_id=eq.'+programB+'&program_type=eq.nutrition&version=eq.3&select=id'});
assert(postReplanVersion.ok && postReplanVersion.data?.[0]?.program_version===3 &&
 postReplanVersions.ok && postReplanVersions.data?.length===1 &&
 postReplanVersions.data[0].snapshot?.adaptation_request_id===replanKey &&
 postReplanEvidence.ok && postReplanEvidence.data?.length===1,
 'Nutrition replan must atomically persist version, receipt and explainability evidence');
const replayAfterCommit=await rpc(jwtB,'adapt_nutrition_program_atomic_v1',replanBody);
assert(replayAfterCommit.ok && replayAfterCommit.data?.status==='already_applied',
 'Retry after commit must return the original receipt');
console.log('PASS: nutrition version/evidence persistence and durable retry receipt');

const beforeFailedReplan=await request(serviceKey,'program_days','GET',{
 query:'?block_id=eq.'+process.env.POTOK_TEST_PREMIUM_BLOCK_ID+'&date=eq.'+futureDate+'&select=targets'});
const failedReplanKey=crypto.randomUUID();
const failedReplan=await rpc(jwtB,'adapt_nutrition_program_atomic_v1',{
 p_program_id:programB,p_expected_version:3,p_request_id:failedReplanKey,p_mode:'maintain'
});
denied(failedReplan,'Forced nutrition replan receipt failure');
assert(failedReplan.data?.code==='23514',
 'Forced failure must reach disposable receipt constraint: '+JSON.stringify(failedReplan));
const afterFailedReplan=await request(serviceKey,'program_days','GET',{
 query:'?block_id=eq.'+process.env.POTOK_TEST_PREMIUM_BLOCK_ID+'&date=eq.'+futureDate+'&select=targets'});
const afterFailedProgram=await request(serviceKey,'nutrition_programs','GET',{
 query:'?id=eq.'+programB+'&select=program_version'});
const failedVersion=await request(serviceKey,'program_versions','GET',{
 query:'?program_id=eq.'+programB+'&program_type=eq.nutrition&version=eq.4&select=id'});
const failedEvidence=await request(serviceKey,'program_explainability','GET',{
 query:'?program_id=eq.'+programB+'&program_type=eq.nutrition&version=eq.4&select=id'});
assert(beforeFailedReplan.ok && afterFailedReplan.ok &&
 JSON.stringify(beforeFailedReplan.data)===JSON.stringify(afterFailedReplan.data) &&
 afterFailedProgram.ok && afterFailedProgram.data?.[0]?.program_version===3 &&
 failedVersion.ok && failedVersion.data?.length===0 &&
 failedEvidence.ok && failedEvidence.data?.length===0,
 'Failed nutrition replan must rollback future targets, program version and explainability');
console.log('PASS: forced nutrition replan failure rolls back all writes');


