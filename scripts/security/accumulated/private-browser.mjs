// One-shot full-copy browser controller. Every SQL operation here is read-only.
import assert from 'node:assert/strict';
import {createHash, createHmac} from 'node:crypto';
import {readFile, writeFile, readdir, mkdtemp} from 'node:fs/promises';
import path from 'node:path';
import {fileURLToPath, pathToFileURL} from 'node:url';
import {runtimeInputs, docker} from './private-browser-runtime.mjs';
import {validateIdentities, browserArgs, verifyIdentityScope} from './private-browser-policy.mjs';
import {rowSnapshotSQL, assertOriginalRows, identityScopeSQL, templateEnvironment} from './private-auth-ab.mjs';
import {validateTarget, candidateName, originalName, settingsSQL, finalSQL, fingerprintSQL, boundaryQuery} from './private-candidate.mjs';
import {parseCopyCounts} from './restored.mjs';
import {inputs} from './inputs.mjs';
import {followupInputs} from './restored-twelve.mjs';
import {apiName, validateAPI} from './private-api.mjs';
import {authName, validateAuth, authMetadataSQL, authEnvironment} from './private-auth.mjs';
const sha = data => createHash('sha256').update(data).digest('hex');
const envMap = values => Object.fromEntries(values.map(s => {const i = s.indexOf('='); assert(i > 0); return [s.slice(0, i), s.slice(i + 1)];}));
const browserName = 'potok_private_browser_2026-10-27';
let phase = 'admission', directory;
const json = async args => JSON.parse(await docker(args));
const sourceRoot = fileURLToPath(new URL('../../../', import.meta.url));
const pinned = {
  'inputs.mjs': '16c171d0f2d94ca6d85307ca3a446e4a0c4db708f66fb3d76c05958ad396c2e2',
  'checks.mjs': '19680d53a99060839188854cc49ec5b72003a71bd1e71b06a0919aaba44bc4ee',
  'restored.mjs': '8b7936a4fbaed205fbdae20184e22ffa7c22a168ec25ff187524ee04cd752f42',
  'restored-twelve.mjs': '8d73465bb8f4d0a6e73e6c8f1dbc3f2bca2ee7e821b0504e34cdce4a5cf9c3a9',
  'private-candidate.mjs': 'd86ff841ddf51215748c25125651e330de42cfbe06748956fc555d826ed7c8d7',
  'private-api.mjs': 'd0f22949d3d589adacbb2c287d27796a02f02ff44ae0f68548f269301aa705c9',
  'private-auth.mjs': '7b0cac6cfe051bbd6641588b6f1da4f50d7fd2576427fd5272b36fe2577f78c8',
  'private-auth-ab.mjs': 'da282b6e00101667fa96bd3ffb03a2adb2b38797df7d8853cd1e6aa69b0fc5f4',
};
async function backups() {
  const text = await readFile('SHA256SUMS.txt', 'utf8'), seen = new Set();
  for (const line of text.trim().split(/\r?\n/)) {
    const m = line.match(/^([a-f0-9]{64})\s+\*?(roles\.sql|schema\.sql|data\.sql)$/);
    assert(m && !seen.has(m[2])); seen.add(m[2]); assert.equal(sha(await readFile(m[2])), m[1]);
  }
  assert.equal(seen.size, 3); return text;
}
export async function main() {
  assert.deepEqual(process.argv.slice(2), ['--run-private-browser']);
  assert.equal(path.basename(process.cwd()), 'POTOK_BACKUP_2026-10-24');
  const local = value => typeof value === 'string' && (value.startsWith('unix:///') || /^npipe:\/{2,}\.\/pipe\//.test(value));
  assert(!process.env.DOCKER_HOST || local(process.env.DOCKER_HOST));
  assert(local(JSON.parse(await docker(['context', 'inspect', '--format', '{{json .Endpoints.docker.Host}}']))));
  for (const [name, digest] of Object.entries(pinned)) assert.equal(sha(await readFile(new URL(name, import.meta.url))), digest);
  assert.equal(sha(await readFile(path.join(sourceRoot, 'scripts/security/platform-defaults/check.sql'))), '352d9b400e65c4632e939188bc195564e4200a00050880b870430123eb82fd5f');
  const {digest} = await runtimeInputs(sourceRoot), manifest = await backups();
  const tables = parseCopyCounts(await readFile('data.sql', 'utf8')); assert.equal(tables.length, 112); assert.equal(tables.reduce((n, t) => n + t.rows, 0), 14888);
  const inspectDB = async () => {
    const c = (await json(['inspect', candidateName]))[0], o = (await json(['inspect', originalName]))[0], v = (await json(['volume', 'inspect', candidateName]))[0];
    const id = validateTarget(c, o, v); assert.deepEqual((await docker(['ps', '-aq', '--no-trunc', '--filter', 'volume=' + candidateName])).split(/\r?\n/), [id]); return id;
  };
  const dbId = await inspectDB(), api = (await json(['inspect', apiName]))[0], auth = (await json(['inspect', authName]))[0];
  const matches = [];
  for (const name of await readdir('.')) if (/^private-auth-ab-[A-Za-z0-9]+$/.test(name)) {
    try {const state = JSON.parse(await readFile(path.join(name, 'state.json'), 'utf8')); const result = JSON.parse(await readFile(path.join(name, 'result.json'), 'utf8'));
      if (state.dbId === dbId && state.apiId === api.Id && state.authId === auth.Id) matches.push({name, state, result});
    } catch {}
  }
  assert.equal(matches.length, 1); const ab = matches[0]; validateIdentities(ab.result.users);
  assert.equal(ab.result.originalRows, 14888); assert.equal(ab.result.mailCount, 2); assert.deepEqual(ab.result.users.map(u => u.email), ab.state.emails);
  assert(/^private-api-[A-Za-z0-9]+$/.test(ab.state.apiDirectory)); assert(/^private-auth-[A-Za-z0-9]+$/.test(ab.state.authDirectory));
  const apiState = JSON.parse(await readFile(path.join(ab.state.apiDirectory, 'state.json'), 'utf8'));
  validateAPI(api, apiState.apiId, apiState.restImage, dbId); validateAuth(auth, ab.state.authId, auth.Image, dbId);
  assert(/^private-candidate-install-[A-Za-z0-9]+$/.test(apiState.receipt));
  assert.deepEqual(JSON.parse(await readFile(path.join(apiState.receipt, 'public-inputs.json'), 'utf8')), [...inputs, ...followupInputs]);
  const apiEnv = envMap(api.Config.Env), authEnv = envMap(auth.Config.Env), uri = new URL(authEnv.GOTRUE_DB_DATABASE_URL);
  assert.equal(uri.username, 'supabase_auth_admin'); assert.equal(uri.hostname, '127.0.0.1');
  const expectedAuth = templateEnvironment(authEnvironment(decodeURIComponent(uri.password), apiEnv.PGRST_JWT_SECRET));
  for (const [key, value] of Object.entries(expectedAuth)) assert.equal(authEnv[key], value);
  const original = JSON.parse(await readFile(path.join(ab.name, 'original-row-hashes.json'), 'utf8'));
  assert.equal(original.length, 112); assert.equal(original.reduce((n, t) => n + t.hashes.length, 0), 14888);
  const baselineAuth = JSON.parse(await readFile(path.join(ab.state.authDirectory, 'auth-metadata-before.json'), 'utf8'));
  const boundary = boundaryQuery(await readFile(path.join(sourceRoot, 'scripts/security/platform-defaults/check.sql'), 'utf8')).trim().replace(/;$/, '');
  const receipts = [];
  for (const name of await readdir('.')) if (/^private-browser-build-[A-Za-z0-9]+$/.test(name)) {
    try {const receipt = JSON.parse(await readFile(path.join(name, 'receipt.json'), 'utf8')); if (receipt.digest === digest && receipt.selfCheck === true) receipts.push(receipt);} catch {}
  }
  assert(receipts.length > 0); assert.equal(new Set(receipts.map(r => r.imageId)).size, 1); const receipt = receipts[0];
  const image = (await json(['image', 'inspect', receipt.imageId]))[0]; assert.equal(image.Config.Labels['potok.browser-source'], digest); assert.equal(image.Config.User, 'node'); assert.equal(image.Os, 'linux');
  // Never reuse a stopped/partial browser attempt; preserve evidence instead.
  const existing = await docker(['ps', '-aq', '--filter', 'name=^/' + browserName + '$']); assert.equal(existing, '');
  const ephemeral = (await docker(['exec', dbId, 'cat', '/proc/sys/net/ipv4/ip_local_port_range'])).split(/\s+/).map(Number);
  assert.equal(ephemeral.length, 2); assert(ephemeral.every(Number.isInteger)); for (const p of [11025, 13003, 13004, 13005]) assert(p < ephemeral[0] || p > ephemeral[1]);
  directory = await mkdtemp(path.join(process.cwd(), 'private-browser-')); console.log('Private browser evidence folder: ' + directory);
  const sql = text => docker(['exec', '-i', dbId, 'sh', '-c', 'PGPASSWORD="$POSTGRES_PASSWORD" exec psql -X -w -h /tmp -U postgres -d postgres --set ON_ERROR_STOP=1 --quiet --tuples-only --no-align'], {input: text});
  const query = async text => JSON.parse(await sql(`${settingsSQL}BEGIN READ ONLY;${text};ROLLBACK;`));
  const verify = async () => {
    const current = await query(rowSnapshotSQL(tables)); assert.equal(assertOriginalRows(original, current).originalRows, 14888);
    verifyIdentityScope(original, current, await query(identityScopeSQL(ab.result.users)));
    assert.deepEqual(await query(authMetadataSQL), baselineAuth);
    const now = tables.map(t => ({...t, rows: current.find(c => c.schema === t.schema && c.name === t.name).hashes.length}));
    const fingerprint = await query(fingerprintSQL(now));
    await sql(`${settingsSQL}BEGIN READ ONLY;DO $$ BEGIN IF current_setting('cron.launch_active_jobs')<>'off' OR current_setting('listen_addresses')<>'127.0.0.1' OR current_setting('data_directory')<>'/var/lib/postgresql/data' THEN RAISE EXCEPTION 'Isolation changed'; END IF; END $$;${finalSQL(now, fingerprint, boundary)}ROLLBACK;`);
    assert.equal(await inspectDB(), dbId); assert.equal(await backups(), manifest);
  };
  phase = 'before-proof'; await verify();
  const payload = {role: 'anon', iss: 'potok-private-browser', aud: 'authenticated', iat: Math.floor(Date.now() / 1000), exp: Math.floor(Date.now() / 1000) + 1800};
  const header = Buffer.from(JSON.stringify({alg: 'HS256', typ: 'JWT'})).toString('base64url'), body = Buffer.from(JSON.stringify(payload)).toString('base64url');
  const anon = header + '.' + body + '.' + createHmac('sha256', apiEnv.PGRST_JWT_SECRET).update(header + '.' + body).digest('base64url');
  const envFile = path.join(directory, 'browser.env');
  await writeFile(envFile, 'POTOK_BROWSER_USERS=' + JSON.stringify(ab.result.users.map(u => ({id: u.id, email: u.email}))) + '\nPOTOK_BROWSER_ANON_KEY=' + anon + '\n', {mode: 0o600});
  const state = {dbId, apiId: api.Id, authId: auth.Id, abDirectory: ab.name, imageId: image.Id, digest, browserId: null};
  const checkpoint = () => writeFile(path.join(directory, 'state.json'), JSON.stringify(state, null, 2), {mode: 0o600});
  await checkpoint(); phase = 'create';
  const browserId = await docker(browserArgs({name: browserName, dbId, imageId: image.Id, envFile})); assert.match(browserId, /^[a-f0-9]{64}$/); state.browserId = browserId; await checkpoint();
  const c = (await json(['inspect', browserId]))[0]; assert.equal(c.Image, image.Id); assert.equal(c.HostConfig.NetworkMode, 'container:' + dbId); assert.equal(c.HostConfig.ReadonlyRootfs, true); assert.equal(c.HostConfig.Privileged, false); assert.equal(c.Config.User, 'node'); assert.deepEqual(c.HostConfig.PortBindings ?? {}, {}); assert(!c.HostConfig.Binds?.length); assert(c.Mounts.every(m => m.Type === 'tmpfs' && m.Destination === '/tmp'));
  const liveEnv = envMap(c.Config.Env); assert.deepEqual(liveEnv, {...envMap(image.Config.Env), POTOK_BROWSER_USERS: JSON.stringify(ab.result.users.map(u => ({id: u.id, email: u.email}))), POTOK_BROWSER_ANON_KEY: anon});
  phase = 'browser'; let exit, interrupted = false;
  try {await docker(['start', browserId]); exit = await docker(['wait', browserId], {timeout: 300000});}
  catch {interrupted = true; await docker(['stop', '--time', '10', browserId]);}
  assert.equal((await json(['inspect', browserId]))[0].State.Running, false);
  // Always attempt the independent data/security proof, even if browser assertions failed.
  phase = 'after-proof'; await verify();
  validateAPI((await json(['inspect', apiName]))[0], api.Id, apiState.restImage, dbId); validateAuth((await json(['inspect', authName]))[0], auth.Id, auth.Image, dbId);
  await docker(['logs', browserId], {log: path.join(directory, 'browser-status.log')});
  phase = 'result'; assert.equal(interrupted, false); assert.equal(exit, '0'); assert((await readFile(path.join(directory, 'browser-status.log'), 'utf8')).includes('PRIVATE_BROWSER_HTTP_OK'));
  await writeFile(path.join(directory, 'result.json'), JSON.stringify({...state, originalRows: 14888, originalTables: 112, profileBrowser: true}), {mode: 0o600});
  console.log('PRIVATE_BROWSER_OK: actual local profile browser acceptance; 112 original tables / 14888 rows, Auth schema and security preserved. Diary/Storage/program acceptance remains separate.');
}
if (process.argv[1] && import.meta.url === pathToFileURL(path.resolve(process.argv[1])).href) main().catch(() => {
  console.error('PRIVATE_BROWSER_STOPPED: phase=' + phase + '. Do not repeat; preserve the local evidence and synthetic accounts.'); process.exitCode = 1;
});
