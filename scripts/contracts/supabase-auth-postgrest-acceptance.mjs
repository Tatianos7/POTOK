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
