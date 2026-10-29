// Exercise the packaged non-root/read-only browser image against the existing CI-only stack.
import assert from 'node:assert/strict';
import {readFile, writeFile,rm} from 'node:fs/promises';
import path from 'node:path';
import {buildRuntime, docker, sandboxArgs} from './private-browser-runtime.mjs';
import {materializeHistoricalRuntime} from './historical-runtime.mjs';
import {validateIdentities} from './private-browser-policy.mjs';
assert.equal(process.env.GITHUB_ACTIONS, 'true');
const directory = process.env.POTOK_PHOTO_AUTH_DIR;
assert(directory && path.isAbsolute(directory) && path.basename(directory) === 'potok-photo-http-acceptance');
const status = JSON.parse(await readFile(path.join(directory, 'status.json'), 'utf8'));
assert.equal(status.API_URL, 'http://127.0.0.1:54321'); assert.equal(status.INBUCKET_URL, 'http://127.0.0.1:54324');
const identities = JSON.parse(await docker(['exec', 'supabase_db_potok-photo-http-acceptance', 'psql', '-X', '-h', '/run/postgresql', '-U', 'postgres', '-d', 'postgres', '-At', '--set', 'ON_ERROR_STOP=1', '--command', "SELECT json_agg(q ORDER BY email) FROM (SELECT id,email FROM auth.users WHERE email IN('combined-ui-a@example.test','combined-ui-b@example.test')) q"]));
validateIdentities(identities, true);
let prepared;const historical=await materializeHistoricalRuntime(process.cwd(),directory);
try {prepared = await buildRuntime(historical.directory, directory);}
catch (error) {
  // Build context contains public source/lockfiles only, never CI or owner credentials.
  if (error.buildDirectory) console.error((await readFile(path.join(error.buildDirectory, 'build.log'), 'utf8')).split('\n').slice(-35).join('\n'));
  throw error;
}finally{await rm(historical.directory,{recursive:true,force:true});}
const env = path.join(prepared.directory, 'ci-browser.env');
await writeFile(env, 'GITHUB_ACTIONS=true\nPOTOK_BROWSER_USERS=' + JSON.stringify(identities) + '\nPOTOK_BROWSER_ANON_KEY=' + status.ANON_KEY + '\n', {mode: 0o600});
// Host network is a CI adapter to its loopback published synthetic stack only.
// Owner policy never permits host network; it requires the captured network-none namespace.
let output;
try {output = await docker(['run', '--rm', '--pull', 'never', '--network', 'host', ...sandboxArgs, '--env-file', env, prepared.receipt.imageId, '--ci'], {timeout: 300000, log: path.join(prepared.directory, 'ci-browser.log')});}
catch {
  console.error((await readFile(path.join(prepared.directory, 'ci-browser.log'), 'utf8')).split('\n').filter(line => /^PRIVATE_BROWSER_[A-Z_]+:/.test(line)).join('\n'));
  throw Error('Packaged synthetic browser stopped');
}
assert.equal(output, '');
assert((await readFile(path.join(prepared.directory, 'ci-browser.log'), 'utf8')).includes('PRIVATE_BROWSER_HTTP_OK'));
console.log('PRIVATE_BROWSER_PACKAGE_CI_OK: captured source image, network-none self-check and real packaged OTP/profile browser passed on synthetic CI only; owner full copy not run');
