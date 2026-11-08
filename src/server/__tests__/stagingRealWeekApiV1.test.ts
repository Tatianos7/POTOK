import test from 'node:test';
import assert from 'node:assert/strict';
import {createStagingRealWeekHandler, readStagingReferenceCatalog} from '../stagingRealWeekApiV1';
import {decodeStagingRealWeek, requestStagingRealWeek} from '../../services/stagingRealWeek';

const env = {VERCEL_ENV: 'preview', VITE_POTOK_STAGING_PREVIEW: 'true', VITE_SUPABASE_URL: 'https://ozidryfvhkcbtpnulakq.supabase.co',
  POTOK_STAGING_REFERENCE_TEST_ENABLED: 'true', VITE_SUPABASE_ANON_KEY: 'sb_publishable_synthetic_test_only'};
const account = '11111111-1111-4111-8111-111111111111';
const req = () => ({method: 'POST', headers: {authorization: 'Bearer synthetic-test-token'}, body: {target: 1600, weekStart: '2026-11-09'}});
async function invoke(config = env, request = req(), remote: typeof fetch = async () => new Response(JSON.stringify({id: account}))) {
  let status = 0, body: unknown, calls = 0; const headers: Record<string,string> = {};
  const response = {status(n: number) {status = n; return this;}, setHeader(k: string,v: string) {headers[k] = v; return this;}, json(v: unknown) {body = v;}};
  await createStagingRealWeekHandler(config, async (...args) => {calls++; return remote(...args);})(request, response);
  return {status, body, headers, calls};
}
test('disabled, production and wrong project reject before Auth or private input', async () => {
  for (const override of [{VERCEL_ENV:'production'}, {VITE_SUPABASE_URL:'https://example.test'}, {POTOK_STAGING_REFERENCE_TEST_ENABLED:'false'}]) {
    const r = await invoke({...env,...override}); assert.equal(r.status,503); assert.equal(r.calls,0);
  }
});
test('wrong method, unauthenticated callers and actor/input injection cannot generate', async () => {
  const a = req();a.method='GET';assert.equal((await invoke(env,a)).status,405);
  const b = req();b.headers.authorization='';assert.equal((await invoke(env,b)).status,401);
  for (const body of [{...req().body,accountId:account},{...req().body,target:1700},{...req().body,weekStart:'2026-02-30'},null,[]]) {
    const r = await invoke(env,{...req(),body} as ReturnType<typeof req>);assert.equal(r.status,400);assert.equal(r.calls,0);
  }
});
test('only fixed Staging Auth GET is allowed; denied/failed/malformed Auth leaks no catalog', async () => {
  for (const remote of [new Response('{}',{status:401}),new Response('{}',{status:503}),new Response('{"id":"invalid"}')]) {
    const r = await invoke(env,req(),async (url,options) => {
      assert.equal(url,env.VITE_SUPABASE_URL+'/auth/v1/user'); assert.equal(options?.method,'GET'); return remote;
    });assert.ok([401,503].includes(r.status)); assert.equal(r.calls,1);assert.ok(!JSON.stringify(r.body).includes('recipes'));
    assert.equal(r.headers['Cache-Control'],'private, no-store');assert.equal(r.headers.Vary,'Authorization');
  }
});
test('privileged key and absent private input never turn into a fallback', async () => {
  const r=await invoke({...env,VITE_SUPABASE_ANON_KEY:'sb_secret_synthetic_test_only'});assert.equal(r.status,503);assert.equal(r.calls,0);
  const missing=await invoke();assert.equal(missing.status,503);assert.equal(missing.calls,1);
  for(const packed of [undefined,'', 'not base64', 'a'.repeat(60001)])assert.throws(()=>readStagingReferenceCatalog(packed));
});
test('client refuses active-plan flags, invalid packets and missing/changed account before request', async () => {
  for(const packet of [{},{contract:'potok-staging-real-reference-week-v1',mayActivate:true},null])assert.throws(()=>decodeStagingRealWeek(packet));
  let sends=0;
  await assert.rejects(requestStagingRealWeek(account,1600,'2026-11-09',{async userId(){return null;},async token(){return 'synthetic';},async send(){sends++;return new Response('{}');}}),/SESSION_CHANGED/);
  assert.equal(sends,0);
  await assert.rejects(requestStagingRealWeek(account,1600,'2026-11-09',{async userId(){return account;},async token(){return null;},async send(){sends++;return new Response('{}');}}),/AUTH_REQUIRED/);
  assert.equal(sends,0);
});
