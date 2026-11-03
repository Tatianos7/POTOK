import assert from 'node:assert/strict';
import test from 'node:test';
import {mkdtemp, writeFile, chmod, symlink, rm, readFile} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {execFileSync, spawnSync} from 'node:child_process';
import process from 'node:process';
import {runGenerationNodeWorkerOnceV1 as run, generationNodeWorkerConfigContractV1} from '../generationNodeWorkerHostV1';
type Factory = NonNullable<Parameters<typeof run>[1]>;
const request = '00000000-0000-4000-8000-000000000001';
const config = {contract: generationNodeWorkerConfigContractV1,
  secrets: {ca: 'synthetic-ca', readerPassword: 'private-fixture-reader', gatewayPassword: 'private-fixture-gateway'},
  optimizationPolicyRaw: '{}', metricPolicyRaw: '{}', comparison: 'ROBUST_CONVENIENCE_BOUNDS', limitsRaw: null};
const response = {contract: 'potok-adaptive-generation-request-status-v2' as const, requestOperationId: request,
  status: 'ACTIVE' as const, retryable: false, reasonCode: null};
async function fixture(fn: (path: string, dir: string) => Promise<void>) {
  const dir = await mkdtemp(join(tmpdir(), 'potok-node-host-')), path = join(dir, 'private-config.json');
  try {await writeFile(path, JSON.stringify(config), {mode: 0o600});await fn(path, dir);}
  finally {await rm(dir, {recursive: true, force: true});}
}
test('default gate reads no file and creates no runtime, including malformed arguments', async () => {
  const r = await run({configPath: '/missing', requestOperationId: 'invalid', signal: new AbortController().signal},
    async () => {throw Error('MUST_NOT_CONSTRUCT');});
  assert.equal(r.outcome, 'DISABLED');assert.equal(r.status, null);
});
test('one enabled invocation owns config, returns status only and closes the runtime exactly once', async () => fixture(async path => {
  let attempts = 0, closes = 0;
  const factory: Factory = async settings => {
    assert.equal(settings.secrets.readerPassword, config.secrets.readerPassword);
    assert.equal(settings.comparison, 'ROBUST_CONVENIENCE_BOUNDS');assert.equal(settings.convenience, null);
    assert.equal(settings.enabled!(), true);
    return {async continue(id) {attempts++;assert.equal(id, request);return response;}, async close() {closes++;}};
  };
  const r = await run({enabled: true, configPath: path, requestOperationId: request, signal: new AbortController().signal}, factory);
  assert.equal(r.outcome, 'RESPONSE');assert.equal(r.status, 'ACTIVE');assert.equal(attempts, 1);assert.equal(closes, 1);
  assert.equal(Object.isFrozen(r), true);assert.doesNotMatch(JSON.stringify(r), /private-fixture|reasonCode|requestOperationId/);
}));
test('private file admission rejects loose permissions, symlinks, invalid UTF-8, duplicates and oversized content before construction', async () => fixture(async (path, dir) => {
  let factories = 0;
  const factory: Factory = async () => {factories++;throw Error('MUST_NOT_CONSTRUCT');};
  const check = async (configPath = path) => assert.equal((await run({enabled: true, configPath, requestOperationId: request,
    signal: new AbortController().signal}, factory)).outcome, 'FAILED');
  await chmod(path, 0o640);await check();await chmod(path, 0o600);
  const link = join(dir, 'link');await symlink(path, link);await check(link);
  for (const value of [Buffer.from([0xc3,0x28]), '{"contract":1,"contract":2}', 'x'.repeat(2 * 1024 * 1024 + 1),
    JSON.stringify({...config, comparison: 'STRICT'}), JSON.stringify({...config, host: 'elsewhere'}),
    JSON.stringify({...config, optimizationPolicyRaw: {}}), JSON.stringify({...config, secrets: {...config.secrets, serviceRole: 'forbidden'}})]) {
    await writeFile(path, value);await check();
  }
  assert.equal(factories, 0);
}));
test('invalid request and already aborted invocation never construct or read an invalid file', async () => {
  let factories = 0;const factory: Factory = async () => {factories++;throw Error('MUST_NOT_CONSTRUCT');};
  const controller = new AbortController();controller.abort();
  assert.equal((await run({enabled: true, configPath: '/missing', requestOperationId: request, signal: controller.signal},factory)).outcome,'STOPPED');
  assert.equal((await run({enabled: true, configPath: '/missing', requestOperationId: 'invalid', signal: new AbortController().signal},factory)).outcome,'FAILED');
  assert.equal(factories,0);
});
test('abort closes the live gate and pools, suppresses a late success and does not retry', async () => fixture(async path => {
  const controller = new AbortController();let closes = 0, attempts = 0;
  const factory: Factory = async settings => ({async continue() {
    attempts++;controller.abort();assert.equal(settings.enabled!(),false);await Promise.resolve();return response;
  }, async close() {closes++;}});
  const r = await run({enabled: true,configPath: path,requestOperationId: request,signal: controller.signal},factory);
  assert.equal(r.outcome,'STOPPED');assert.equal(r.status,null);assert.equal(closes,1);assert.equal(attempts,1);
}));
test('abort during async construction still closes the returned runtime without dispatch', async () => fixture(async path => {
  const controller = new AbortController();let closes=0,attempts=0;
  const factory: Factory = async () => {controller.abort();return {async continue(){attempts++;return response;},async close(){closes++;}};};
  const r=await run({enabled:true,configPath:path,requestOperationId:request,signal:controller.signal},factory);
  assert.equal(r.outcome,'STOPPED');assert.equal(closes,1);assert.equal(attempts,0);
}));
test('abort while final cleanup awaits cannot emit a late ACTIVE response', async () => fixture(async path => {
  const controller=new AbortController();let closes=0;
  const factory:Factory=async()=>({async continue(){return response;},async close(){closes++;controller.abort();await Promise.resolve();}});
  const r=await run({enabled:true,configPath:path,requestOperationId:request,signal:controller.signal},factory);
  assert.equal(r.outcome,'STOPPED');assert.equal(r.status,null);assert.equal(closes,1);
}));
test('nonterminal and uncertain statuses are preserved without a successful-generation claim or retry', async () => fixture(async path => {
  let attempts=0;
  for (const status of ['GENERATING','UNKNOWN_RETRYABLE','REJECTED'] as const) {
    const factory:Factory=async()=>({async continue(){attempts++;return {...response,status};},async close(){}});
    const r=await run({enabled:true,configPath:path,requestOperationId:request,signal:new AbortController().signal},factory);
    assert.equal(r.outcome,'RESPONSE');assert.equal(r.status,status);
  }
  assert.equal(attempts,3);
}));
test('configuration, uncertain dispatch and cleanup failures expose only fixed outcomes and never retry', async () => fixture(async path => {
  assert.equal((await run({enabled:true,configPath:path,requestOperationId:request,signal:new AbortController().signal})).outcome,'FAILED');
  for (const failAt of ['factory','continue','close','invalid-status']) {
    let attempts=0,closes=0;
    const factory: Factory=async()=>{if(failAt==='factory')throw Error('private-fixture-reader');return {
      async continue(){attempts++;if(failAt==='continue')throw Error('private-fixture-reader');
        return failAt==='invalid-status'?{...response,status:'private-fixture-reader' as 'ACTIVE'}:response;},
      async close(){closes++;if(failAt==='close')throw Error('private-fixture-gateway');}};};
    const r=await run({enabled:true,configPath:path,requestOperationId:request,signal:new AbortController().signal},factory);
    assert.equal(r.outcome,'FAILED');assert.equal(r.status,null);assert.doesNotMatch(JSON.stringify(r),/private-fixture/);
    assert.equal(attempts,failAt==='factory'?0:1);assert.equal(closes,failAt==='factory'?0:1);
  }
}));
test('standalone bundle runs disabled outside the repository with no config or npm dependencies', async () => {
  const output=await mkdtemp(join(tmpdir(),'potok-node-bundle-'));
  try {
    execFileSync(process.execPath,['scripts/security/generation-node-worker/build.mjs',output]);
    const manifest=JSON.parse(await readFile(join(output,'manifest.json'),'utf8'));
    assert.equal(manifest.enabledByDefault,false);assert.equal(manifest.hostedAcceptance,false);
    const r=spawnSync(process.execPath,[join(output,'potok-generation-worker.cjs')],{cwd:tmpdir(),encoding:'utf8',
      env:{...process.env,POTOK_GENERATION_WORKER_ENABLED:''},timeout:10000});
    assert.equal(r.status,0);assert.equal(JSON.parse(r.stdout).outcome,'DISABLED');assert.equal(r.stderr,'');
    const failed=spawnSync(process.execPath,[join(output,'potok-generation-worker.cjs'),'invalid','/missing'],{cwd:tmpdir(),encoding:'utf8',
      env:{...process.env,POTOK_GENERATION_WORKER_ENABLED:'true'},timeout:10000});
    assert.equal(failed.status,1);assert.equal(JSON.parse(failed.stdout).outcome,'FAILED');assert.equal(failed.stderr,'');
    const probe=spawnSync(process.execPath,[join(output,'potok-generation-connection-check.cjs')],{cwd:tmpdir(),encoding:'utf8',
      env:{...process.env,POTOK_GENERATION_CONNECTION_CHECK_ENABLED:'',POTOK_GENERATION_WORKER_ENABLED:'true'},timeout:10000});
    assert.equal(probe.status,0);assert.equal(JSON.parse(probe.stdout).outcome,'DISABLED');assert.equal(probe.stderr,'');
  } finally {await rm(output,{recursive:true,force:true});}
});
