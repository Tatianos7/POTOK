import assert from 'node:assert/strict';
import test from 'node:test';
import {generationRootCertificateFixtureV1} from './generationRootCaFixturesV1';
import {prepareAaaaStagingGenerationNodePgPoolsV1} from '../generationNodePgPoolV1';
import {createAaaaStagingGenerationRuntimeV1} from '../generationRuntimeV1';
import {generationWeekMetricPolicyContractV1} from '../generationWeekMetricProducerV1';
import {optimizationPolicyContractV1} from '../../utils/adaptiveNutritionMealBalanceV1';
const request='00000000-0000-4000-8000-000000000001',revision='00000000-0000-4000-8000-000000000002';
async function config(){return{comparison:'ROBUST_CONVENIENCE_BOUNDS' as const,convenience:null,
  secrets:{ca:(await generationRootCertificateFixtureV1()).toString('pem'),readerPassword:'synthetic-reader',gatewayPassword:'synthetic-gateway'},
  optimizationPolicyRaw:JSON.stringify({contract:optimizationPolicyContractV1,policyRevision:revision,
    weights:{targetFit:'0.400',diversity:'0.250',convenience:'0.200',shoppingReuse:'0.150'}}),
  metricPolicyRaw:JSON.stringify({contract:generationWeekMetricPolicyContractV1,metricPolicyRevision:revision,optimizationPolicyRevision:revision,
    targetFit:'MEAN_DAILY_CALORIE_FIT_V1',diversity:'UNIQUE_RECIPE_MEAL_SHARE_V1',shoppingReuse:'CANONICAL_FOOD_MEAL_REUSE_SHARE_V1',convenience:'INDEPENDENT_WEEK_CONVENIENCE_V1'})};}
test('AAAA pool preparation owns secrets before DNS and keeps default pools inactive without sockets',async()=>{
  const c=await config(),controller=new AbortController();let answer!:(a:string)=>void,calls=0;
  const pending=prepareAaaaStagingGenerationNodePgPoolsV1(c.secrets,controller.signal,async signal=>{
    assert.equal(signal,controller.signal);calls++;return new Promise(r=>{answer=r;});});
  c.secrets.ca='mutated after invocation';c.secrets.readerPassword='mutated-reader';answer('::1');
  const open=await pending,pools=open();assert.equal(calls,1);
  await assert.rejects(pools.sourcesPool.acquire(),/GENERATION_PG_DISABLED/);
  await assert.rejects(pools.gatewayPool.acquire(),/GENERATION_PG_DISABLED/);await pools.close();
});
test('invalid CA is rejected before DNS and abort/invalid address cannot return a pool factory',async()=>{
  const c=await config();let calls=0;
  await assert.rejects(prepareAaaaStagingGenerationNodePgPoolsV1({...c.secrets,ca:'invalid'},new AbortController().signal,async()=>{calls++;return '::1';}),/GENERATION_PG_CONFIGURATION_INVALID/);
  assert.equal(calls,0);
  const controller=new AbortController();
  await assert.rejects(prepareAaaaStagingGenerationNodePgPoolsV1(c.secrets,controller.signal,async()=>{controller.abort();return '::1';}),/GENERATION_PG_DISABLED/);
  await assert.rejects(prepareAaaaStagingGenerationNodePgPoolsV1(c.secrets,new AbortController().signal,async()=> 'foreign.host'),/GENERATION_DNS_CONFIGURATION_INVALID/);
});
test('deferred AAAA pool factory rechecks CA expiry and cancellation before allocating pools',async()=>{
  const cert=await generationRootCertificateFixtureV1(),secrets={ca:cert.toString('pem'),readerPassword:'synthetic-reader',gatewayPassword:'synthetic-gateway'};
  const controller=new AbortController(),open=await prepareAaaaStagingGenerationNodePgPoolsV1(secrets,controller.signal,async()=> '::1');
  const now=Date.now;
  try{Date.now=()=>cert.notAfter.getTime()+1;assert.throws(()=>open(),/GENERATION_PG_CONFIGURATION_INVALID/);}
  finally{Date.now=now;}
  controller.abort();assert.throws(()=>open(),/GENERATION_PG_DISABLED/);
});
test('AAAA runtime composes the real worker inactive and retains cancellation/no-fallback error behavior',async()=>{
  const c=await config(),controller=new AbortController();let calls=0;
  const runtime=await createAaaaStagingGenerationRuntimeV1(c,controller.signal,async()=>{calls++;return '::1';});
  await assert.rejects(runtime.continue(request),/GENERATION_RUNTIME_DISABLED/);assert.equal(calls,1);await runtime.close();
  await assert.rejects(createAaaaStagingGenerationRuntimeV1(c,new AbortController().signal,async()=>{throw Error('sensitive DNS detail');}),/^Error: GENERATION_RUNTIME_CONFIGURATION_INVALID$/);
  const activeController=new AbortController();
  const stopped=await createAaaaStagingGenerationRuntimeV1({...c,enabled:()=>true},activeController.signal,async()=> '::1');
  activeController.abort();await assert.rejects(stopped.continue(request),/GENERATION_RUNTIME_DISABLED/);await stopped.close();
});
