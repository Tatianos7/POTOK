import assert from 'node:assert/strict';
import test from 'node:test';
import {mkdtemp, readFile, rm} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {execFileSync} from 'node:child_process';
import {profileGenerationWorkerV1} from './run';

test('profile exercises both slot sizes and comparison paths with explicit synthetic boundaries', async () => {
  const r = await profileGenerationWorkerV1(1);
  assert.equal(r.hostedAcceptance, false); assert.equal(r.cloudLimitsEnforced, false);
  assert.equal(r.cpuIncludesSyntheticAdapters, true); assert.equal(r.disabledPgFactoryProbe, 'PASS');
  assert.equal(r.portablePgFactoryProbe, 'PASS');
  assert.equal(r.x509CheckIssued, 'PASS'); assert.equal(r.measurements.length, 3);
  assert.deepEqual(r.measurements.map(x => [x.slotsPerDay, x.comparison]), [[1, 'ROBUST_CONVENIENCE_BOUNDS'], [4, 'ROBUST_CONVENIENCE_BOUNDS'], [4, 'STRICT']]);
  for (const m of r.measurements) {
    assert.ok(m.wallMs > 0); assert.ok(m.cpuMs !== null && m.cpuMs > 0);
    assert.equal(m.meals, 7 * m.slotsPerDay); assert.equal(m.facts, 0);
    assert.equal(m.records, 1); assert.equal(m.activations, 1); assert.equal(m.authorityReads, 2);
    assert.equal(m.sourceReads, 7 * m.slotsPerDay + 4);
  }
});
test('invalid sample counts reject before any fixture or runtime work', async () => {
  for (const count of [0, 6, 1.1, NaN]) await assert.rejects(profileGenerationWorkerV1(count), /PROFILE_SAMPLES_OUT_OF_BOUNDS/);
});
test('diagnostic bundling pins pg, retains node imports and creates no serving entrypoint', async () => {
  const output = await mkdtemp(join(tmpdir(), 'potok-profile-test-'));
  try {
    execFileSync(process.execPath, ['scripts/security/generation-profile/build.mjs', output]);
    const bundle = await readFile(join(output, 'worker-profile.mjs'), 'utf8');
    const metadata = JSON.parse(await readFile(join(output, 'bundle-metadata.json'), 'utf8'));
    assert.equal(metadata.deployable, false); assert.equal(metadata.packages.pg, '8.23.1');
    assert.match(bundle, /npm:pg@8\.23\.1/); assert.match(bundle, /node:crypto/);
    assert.doesNotMatch(bundle, /Deno\.serve\(|http\.createServer\(/);
    assert.ok(metadata.inputs.some((p: string) => p.endsWith('generationRuntimeV1.ts')));
  } finally {await rm(output, {recursive: true, force: true});}
});
