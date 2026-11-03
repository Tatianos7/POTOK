import assert from 'node:assert/strict';
import process from 'node:process';
import {spawnSync} from 'node:child_process';
import {writeFile} from 'node:fs/promises';

const observations = [];
for (const name of ['pg', 'small', 'robust', 'strict', 'cpu']) {
  const since = new Date().toISOString();
  const response = await fetch(`http://127.0.0.1:9098/${name}`, {signal: AbortSignal.timeout(45000)});
  const body = await response.text();
  const logs = spawnSync('docker', ['logs', '--since', since, 'potok-edge-worker'], {encoding: 'utf8'});
  assert.equal(logs.status, 0);const log = logs.stdout + logs.stderr;
  let result;try {result = JSON.parse(body);} catch {throw Error(`NON_JSON_RESPONSE_${name}`);}
  if (name === 'pg') {
    assert.equal(response.status, 200); assert.equal(result.contract, 'potok-local-edge-pg-canary-v1');
    assert.equal(result.hostedAcceptance, false); assert.equal(result.stagingConnectionTested, false);
    assert.equal(result.results.length, 8); assert.ok(result.results.every(r => r.pass));
    observations.push({name, outcome: 'PASS', result});
  } else if (name !== 'cpu' && response.status === 200) {
    assert.equal(result.contract, 'potok-generation-worker-local-profile-v1');
    assert.equal(result.hostedAcceptance, false); assert.equal(result.factoryProbesRun, false);
    assert.equal(result.measurements.length, 1);
    const m = result.measurements[0];
    assert.equal(m.meals, name === 'small' ? 7 : 28); assert.equal(m.facts, 0);
    assert.equal(m.records, 1); assert.equal(m.activations, 1); assert.equal(m.authorityReads, 2);
    observations.push({name, outcome: 'COMPLETED_WITH_LOCAL_LIMITS', result});
  } else {
    assert.ok([500, 503, 546].includes(response.status), `UNEXPECTED_STATUS_${name}_${response.status}`);
    assert.match(log, /cpu time|CPU time|CPUTime|memory limit|Memory limit/i, `NO_RESOURCE_LIMIT_EVIDENCE_${name}`);
    observations.push({name, outcome: 'RESOURCE_LIMIT_CANCELLED', status: response.status});
  }
}
assert.equal(observations.find(r => r.name === 'cpu').outcome, 'RESOURCE_LIMIT_CANCELLED');
const report = {contract: 'potok-local-edge-worker-canary-v1', hostedAcceptance: false,
  stagingModified: false, syntheticDatabase: true, limits: {cpuSoftMs: 2000, cpuHardMs: 2000, memoryMb: 256, wallMs: 150000},
  limitScope: 'LOCAL_OFFICIAL_EDGE_USER_WORKER_INCLUDES_MODULE_AND_FIXTURE_SETUP',
  notProven: ['HOSTED_CPU_ACCOUNTING_PARITY', 'STAGING_TLS_AND_ROLES', 'REAL_CATALOG_WORST_CASE', 'AUTH_TO_UI', '12000_USERS'],
  observations};
await writeFile(process.argv[2], JSON.stringify(report, null, 2) + '\n');
console.log(JSON.stringify(report));
