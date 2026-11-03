import assert from 'node:assert/strict';
import test from 'node:test';
import {rootCertificates} from 'node:tls';
import {X509Certificate} from 'node:crypto';
import {createManagedGenerationRuntimeV1, createStagingGenerationRuntimeV1, type GenerationRuntimePoolsV1} from '../generationRuntimeV1';
import {restrictedGenerationLoadSqlV1} from '../generationSqlGatewayV1';
import {generationWeekMetricPolicyContractV1} from '../generationWeekMetricProducerV1';
import {optimizationPolicyContractV1} from '../../utils/adaptiveNutritionMealBalanceV1';

const request = '00000000-0000-4000-8000-000000000001';
const revision = '00000000-0000-4000-8000-000000000002';
function policies() {
  return {comparison: 'STRICT' as const, convenience: null,
    optimizationPolicyRaw: JSON.stringify({contract: optimizationPolicyContractV1, policyRevision: revision,
      weights: {targetFit: '0.400', diversity: '0.250', convenience: '0.200', shoppingReuse: '0.150'}}),
    metricPolicyRaw: JSON.stringify({contract: generationWeekMetricPolicyContractV1, metricPolicyRevision: revision,
      optimizationPolicyRevision: revision, targetFit: 'MEAN_DAILY_CALORIE_FIT_V1', diversity: 'UNIQUE_RECIPE_MEAL_SHARE_V1',
      shoppingReuse: 'CANONICAL_FOOD_MEAL_REUSE_SHARE_V1', convenience: 'INDEPENDENT_WEEK_CONVENIENCE_V1'})};
}
function fixture() {
  const state = {enabled: true, opens: 0, closes: 0, sources: 0, acquisitions: 0, failClose: false};
  const calls: {sql: string; parameters: readonly string[]}[] = [], releases: boolean[] = [];
  const response = {contract: 'potok-adaptive-generation-request-status-v2', requestOperationId: request,
    status: 'ACTIVE', retryable: false, reasonCode: null, generationInputCanonicalHex: null,
    candidateManifestCanonicalHex: null, attemptOperationId: null};
  let query = async (sql: string, parameters: readonly string[]) => {void parameters; return {rows: sql === restrictedGenerationLoadSqlV1 ? [{result_raw: response}] : []};};
  const pools: GenerationRuntimePoolsV1 = {
    sourcesPool: {async acquire() {state.sources++; throw Error('sources should not be used on ACTIVE recovery');}},
    gatewayPool: {async acquire() {
      state.acquisitions++;
      return {async query(sql, parameters) {calls.push({sql, parameters: [...parameters]}); return query(sql, parameters);},
        async release(discard) {releases.push(discard);}};
    }},
    async close() {state.closes++; if (state.failClose) throw Error('sensitive driver detail');},
  };
  return {state, pools, calls, releases, response, replaceQuery: (next: typeof query) => {query = next;},
    dependencies: {...policies(), enabled: () => state.enabled, openPools: () => {state.opens++; return pools;}}};
}
test('runtime defaults to inactive and never acquires or queries a connection', async () => {
  const x = fixture(), {enabled: _enabled, ...deps} = x.dependencies;
  void _enabled;
  const runtime = await createManagedGenerationRuntimeV1(deps);
  await assert.rejects(runtime.continue(request), /GENERATION_RUNTIME_DISABLED/);
  assert.equal(x.state.acquisitions, 0); assert.equal(x.state.sources, 0); assert.equal(x.state.opens, 1);
  await runtime.close(); assert.equal(x.state.closes, 1);
});
test('actual restricted worker and transaction assembly recover ACTIVE without regenerating', async () => {
  const x = fixture(), runtime = await createManagedGenerationRuntimeV1(x.dependencies);
  assert.equal((await runtime.continue(request)).status, 'ACTIVE');
  assert.deepEqual(x.calls, [{sql: 'BEGIN', parameters: []}, {sql: restrictedGenerationLoadSqlV1, parameters: [request]}, {sql: 'COMMIT', parameters: []}]);
  assert.equal(x.state.sources, 0); assert.deepEqual(x.releases, [false]);
  const close = runtime.close(); assert.equal(runtime.close(), close); await close;
  await assert.rejects(runtime.continue(request), /GENERATION_RUNTIME_DISABLED/);
  assert.equal(x.state.closes, 1); assert.equal(x.state.acquisitions, 1);
});
test('shared shutdown gate stops pending work and rejects overlap instead of queuing it', async () => {
  const x = fixture();
  let entered!: () => void, finish!: () => void;
  const started = new Promise<void>(r => {entered = r;}), pending = new Promise<void>(r => {finish = r;});
  x.replaceQuery(async sql => {
    if (sql === restrictedGenerationLoadSqlV1) {entered(); await pending; return {rows: [{result_raw: x.response}]};}
    return {rows: []};
  });
  const runtime = await createManagedGenerationRuntimeV1(x.dependencies), work = runtime.continue(request);
  await started;
  await assert.rejects(runtime.continue(request), /GENERATION_RUNTIME_BUSY/);
  await runtime.close(); finish(); await assert.rejects(work);
  await assert.rejects(runtime.continue(request), /GENERATION_RUNTIME_DISABLED/);
  assert.equal(x.state.acquisitions, 1); assert.equal(x.state.sources, 0); assert.equal(x.state.closes, 1);
  assert.deepEqual(x.calls.map(c => c.sql), ['BEGIN', restrictedGenerationLoadSqlV1, 'ROLLBACK']);
  assert.deepEqual(x.releases, [true]);
});
test('changing the external gate prevents the next attempt with no fallback pool', async () => {
  const x = fixture(), runtime = await createManagedGenerationRuntimeV1(x.dependencies);
  await runtime.continue(request); x.state.enabled = false;
  await assert.rejects(runtime.continue(request), /GENERATION_RUNTIME_DISABLED/);
  assert.equal(x.state.acquisitions, 1); assert.equal(x.state.sources, 0); await runtime.close();
});
test('configuration failure closes partial pools and returns only a fixed error', async () => {
  const x = fixture();
  await assert.rejects(createManagedGenerationRuntimeV1({...x.dependencies, metricPolicyRaw: 'private invalid value'}), /^Error: GENERATION_RUNTIME_CONFIGURATION_INVALID$/);
  assert.equal(x.state.closes, 1); assert.equal(x.state.acquisitions, 0);
  const y = fixture(); y.state.failClose = true;
  await assert.rejects(createManagedGenerationRuntimeV1({...y.dependencies, metricPolicyRaw: 'invalid'}), /^Error: GENERATION_RUNTIME_CONFIGURATION_CLEANUP_FAILED$/);
  assert.equal(y.state.closes, 1);
  const z = fixture();
  await assert.rejects(createManagedGenerationRuntimeV1({...z.dependencies, openPools: () => ({...z.pools,
    gatewayPool: z.pools.sourcesPool as unknown as GenerationRuntimePoolsV1['gatewayPool']})}), /^Error: GENERATION_RUNTIME_CONFIGURATION_INVALID$/);
  assert.equal(z.state.closes, 1); assert.equal(z.state.acquisitions, 0);
});
test('failed close is idempotent, sanitizes the error and leaves the runtime closed', async () => {
  const x = fixture(), runtime = await createManagedGenerationRuntimeV1(x.dependencies); x.state.failClose = true;
  const closing = runtime.close(); assert.equal(runtime.close(), closing);
  await assert.rejects(closing, /^Error: GENERATION_RUNTIME_CLOSE_FAILED$/);
  await assert.rejects(runtime.continue(request), /GENERATION_RUNTIME_DISABLED/); assert.equal(x.state.closes, 1);
});
test('fixed Staging factory composes real lazy pg pools but stays inactive without sockets', async () => {
  const ca = rootCertificates.find(pem => {const r = new X509Certificate(pem);
    return r.ca && r.checkIssued(r) && r.verify(r.publicKey) && Date.now() >= Date.parse(r.validFrom) && Date.now() < Date.parse(r.validTo);});
  assert.ok(ca);
  const config = {...policies(), secrets: {ca, readerPassword: 'synthetic-reader', gatewayPassword: 'synthetic-gateway'}};
  const runtime = await createStagingGenerationRuntimeV1(config);
  await assert.rejects(runtime.continue(request), /GENERATION_RUNTIME_DISABLED/); await runtime.close();
  await assert.rejects(createStagingGenerationRuntimeV1({...config, secrets: {...config.secrets, ca: 'invalid'}}), /^Error: GENERATION_RUNTIME_CONFIGURATION_INVALID$/);
});
