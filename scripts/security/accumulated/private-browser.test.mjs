import assert from 'node:assert/strict';
import test from 'node:test';
import {readFile,rm} from 'node:fs/promises';
import os from 'node:os';
import {materializeHistoricalRuntime} from './historical-runtime.mjs';
import {createHash} from 'node:crypto';
import {validateIdentities, browserArgs, verifyIdentityScope} from './private-browser-policy.mjs';
import {runtimeInputs, manifestHash, dockerfile} from './private-browser-runtime.mjs';
import {fileURLToPath} from 'node:url';
const users = ['a', 'b'].map((suffix, i) => ({id: `${i + 1}1111111-1111-4111-8111-111111111111`, email: `potok-ab-${'a'.repeat(24)}-${suffix}@example.test`}));
test('only the exact two distinct synthetic account identities are admitted', () => {
  validateIdentities(users);
  assert.throws(() => validateIdentities([users[0], users[0]]));
  assert.throws(() => validateIdentities([users[0], {...users[1], email: 'real@example.com'}]));
  assert.throws(() => validateIdentities([users[0], {...users[1], email: `potok-ab-${'b'.repeat(24)}-b@example.test`}]));
  assert.throws(() => validateIdentities([users[0], {...users[1], id: "';SELECT 1"}]));
});
test('owner browser has captured namespace/image, read-only non-root runtime and no host/mount escape', () => {
  const args = browserArgs({name: 'potok_private_browser_2026-10-27', dbId: 'a'.repeat(64), imageId: 'sha256:' + 'b'.repeat(64), envFile: '/private/browser.env'});
  assert(args.includes('container:' + 'a'.repeat(64))); assert(args.includes('--read-only')); assert(args.includes('node'));
  for (const flag of ['--privileged', '--publish', '-p', '--volume', '-v', '--mount']) assert(!args.includes(flag));
  assert.equal(args.at(-1), '--private');
  assert.throws(() => browserArgs({name: 'original', dbId: 'a'.repeat(64), imageId: 'sha256:' + 'b'.repeat(64), envFile: '/x'}));
});
test('lifecycle allowance is exact and tied to only two users/profiles', () => {
  const names = ['auth.users','auth.identities','auth.sessions','auth.refresh_tokens','auth.audit_log_entries','auth.one_time_tokens','auth.flow_state','auth.mfa_amr_claims','public.user_profiles'];
  const original = names.map(n => {const [schema, name] = n.split('.'); return {schema, name, hashes: ['old']};});
  const scoped = original.map(t => ({schema: t.schema, name: t.name, rows: 2}));
  const after = original.map(t => ({...t, hashes: ['old', 'synthetic-a', 'synthetic-b']}));
  verifyIdentityScope(original, after, scoped);
  assert.throws(() => verifyIdentityScope(original, after, scoped.map(t => t.name === 'sessions' ? {...t, rows: 1} : t)));
  assert.throws(() => verifyIdentityScope(original, after, [...scoped.slice(1), scoped[1]]));
  assert.throws(() => verifyIdentityScope(original, after, scoped.map(t => t.name === 'users' ? {...t, rows: 3} : t)));
});
test('runtime packages only reviewed public source and immutable lock inputs, never private backup/env', async () => {
  const root = fileURLToPath(new URL('../../../', import.meta.url));
  const manifest = await readFile(new URL('./private-browser-runtime-inputs.json', import.meta.url));
  const materialized=await materializeHistoricalRuntime(root,os.tmpdir());let result;
  try{result=await runtimeInputs(materialized.directory);if(materialized.changed)await assert.rejects(()=>runtimeInputs(root),/Public runtime input changed/);else assert.deepEqual(await runtimeInputs(root),result);}
  finally{await rm(materialized.directory,{recursive:true,force:true});}
  assert.equal(createHash('sha256').update(manifest).digest('hex'), manifestHash);
  assert(result.entries.every(e => e.path.startsWith('src/') || ['package.json', 'package-lock.json'].includes(e.path) || e.path.startsWith('scripts/security/')));
  assert(result.entries.every(e => !/\.env|roles\.sql|data\.sql|schema\.sql|backup/i.test(e.path)));
  assert(dockerfile.includes('node:24.22.1-bookworm-slim')); assert(dockerfile.includes('npm ci')); assert(dockerfile.includes('USER node'));
});
