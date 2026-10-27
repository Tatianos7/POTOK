// Public-source-only runtime preparation. Never reads a backup, Docker Env or DB.
import assert from 'node:assert/strict';
import {spawn} from 'node:child_process';
import {createHash} from 'node:crypto';
import {readFile, writeFile, mkdir, mkdtemp, lstat, copyFile, chmod, statfs} from 'node:fs/promises';
import {createWriteStream} from 'node:fs';
import path from 'node:path';
import {fileURLToPath, pathToFileURL} from 'node:url';
const sha = bytes => createHash('sha256').update(bytes).digest('hex');
export const dockerfile = `FROM node:24.22.1-bookworm-slim
WORKDIR /app
ENV PLAYWRIGHT_BROWSERS_PATH=/ms-playwright HOME=/tmp
COPY package.json package-lock.json ./
RUN npm ci && npx --no-install playwright install --with-deps chromium && npm cache clean --force
COPY --chown=node:node . .
USER node
ENTRYPOINT ["node", "/app/scripts/security/accumulated/private-browser-worker.mjs"]
`;
// Replaced only when reviewed runtime inputs change; runtime/controller are not image inputs.
export const manifestHash = '42905c3493a09729229f51aa89e1eccca47c0ca15c993af4462f882256d4de9e';
export async function runtimeInputs(root) {
  const text = await readFile(path.join(root, 'scripts/security/accumulated/private-browser-runtime-inputs.json'), 'utf8');
  assert.equal(sha(text), manifestHash, 'Runtime manifest changed');
  const entries = JSON.parse(text); assert(entries.length > 100 && entries.length < 5000);
  assert.equal(new Set(entries.map(e => e.path)).size, entries.length);
  for (const entry of entries) {
    assert.match(entry.sha256, /^[a-f0-9]{64}$/);
    assert(!entry.path.includes('..') && !entry.path.startsWith('/') && !entry.path.split('/').some(p => p.startsWith('.')));
    const file = path.join(root, entry.path); const stat = await lstat(file);
    assert(stat.isFile() && !stat.isSymbolicLink()); assert.equal(sha(await readFile(file)), entry.sha256, 'Public runtime input changed');
  }
  return {entries, digest: sha(text + dockerfile)};
}
export async function docker(args, {input, log, timeout = 180000} = {}) {
  return new Promise((resolve, reject) => {
    const child = spawn('docker', args, {stdio: ['pipe', 'pipe', 'pipe']});
    const chunks = [], sink = log ? createWriteStream(log, {mode: 0o600}) : null;
    sink?.on('error', error => {child.kill('SIGTERM'); reject(error);});
    let bytes = 0;
    const timer = setTimeout(() => child.kill('SIGTERM'), timeout);
    child.on('error', error => {clearTimeout(timer); sink?.end(); reject(error);});
    for (const stream of [child.stdout, child.stderr]) stream.on('data', data => {
      if (sink) sink.write(data);
      else {bytes += data.length; if (bytes > 32 * 1024 * 1024) child.kill('SIGTERM'); else if (stream === child.stdout) chunks.push(data);}
    });
    child.stdin.on('error', () => {}); child.stdin.end(input);
    child.on('close', code => {clearTimeout(timer); const done = () => {if (code !== 0) reject(Error('Local Docker operation stopped')); else resolve(Buffer.concat(chunks).toString('utf8').trim());}; if (sink) sink.end(done); else done();});
  });
}
export const sandboxArgs = ['--read-only', '--cap-drop', 'ALL', '--security-opt', 'no-new-privileges', '--user', 'node',
  '--tmpfs', '/tmp:rw,nosuid,nodev,size=536870912,mode=1777', '--shm-size', '256m'];
export async function buildRuntime(root, parent) {
  const local = value => typeof value === 'string' && (value.startsWith('unix:///') || /^npipe:\/{2,}\.\/pipe\//.test(value));
  assert(!process.env.DOCKER_HOST || local(process.env.DOCKER_HOST));
  assert(local(JSON.parse(await docker(['context', 'inspect', '--format', '{{json .Endpoints.docker.Host}}']))));
  const space = await statfs(parent, {bigint: true}); assert(space.bavail * space.bsize >= 8n * 1024n ** 3n, 'At least 8 GiB free is required before building');
  const {entries, digest} = await runtimeInputs(root);
  const directory = await mkdtemp(path.join(parent, 'private-browser-build-'));
  const context = path.join(directory, 'context'); await mkdir(context, {mode: 0o700});
  for (const entry of entries) {
    const destination = path.join(context, entry.path); await mkdir(path.dirname(destination), {recursive: true, mode: 0o700});
    await copyFile(path.join(root, entry.path), destination); await chmod(destination, 0o600);
    assert.equal(sha(await readFile(destination)), entry.sha256);
  }
  await writeFile(path.join(context, 'Dockerfile'), dockerfile, {mode: 0o600});
  console.log('Building the public browser runtime; no private database is connected. Build logs stay local.');
  const iidFile = path.join(directory, 'image-id.txt');
  try {await docker(['build', '--pull', '--label', 'potok.browser-source=' + digest, '--iidfile', iidFile, context], {log: path.join(directory, 'build.log'), timeout: 1200000});}
  catch {const error = Error('Public runtime build stopped'); error.buildDirectory = directory; throw error;}
  const imageId = (await readFile(iidFile, 'utf8')).trim(); assert.match(imageId, /^sha256:[a-f0-9]{64}$/);
  const image = JSON.parse(await docker(['image', 'inspect', imageId]))[0];
  assert.equal(image.Os, 'linux'); assert(['arm64', 'amd64'].includes(image.Architecture));
  assert.equal(image.Config.User, 'node'); assert.equal(image.Config.Labels['potok.browser-source'], digest);
  const result = await docker(['run', '--rm', '--pull', 'never', '--network', 'none', ...sandboxArgs, imageId, '--self-check'], {timeout: 180000});
  await writeFile(path.join(directory, 'self-check.log'), result, {mode: 0o600}); assert(result.includes('PRIVATE_BROWSER_RUNTIME_OK'));
  const receipt = {imageId, digest, architecture: image.Architecture, node: '24.22.1', playwright: '1.40.0', selfCheck: true};
  await writeFile(path.join(directory, 'receipt.json'), JSON.stringify(receipt, null, 2), {mode: 0o600});
  console.log('PRIVATE_BROWSER_RUNTIME_PREPARED_OK: public source image and isolated browser self-check passed. No database contacted.');
  return {directory, receipt};
}
if (process.argv[1] && import.meta.url === pathToFileURL(path.resolve(process.argv[1])).href) {
  assert.deepEqual(process.argv.slice(2), ['--prepare-runtime']);
  const root = fileURLToPath(new URL('../../../', import.meta.url));
  buildRuntime(root, process.cwd()).catch(() => {console.error('PRIVATE_BROWSER_RUNTIME_STOPPED: preserve local build logs; no database was contacted.'); process.exitCode = 1;});
}
