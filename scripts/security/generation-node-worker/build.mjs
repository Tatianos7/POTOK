import {build} from 'esbuild';
import {mkdir, readFile, writeFile} from 'node:fs/promises';
import {createHash} from 'node:crypto';
import process from 'node:process';
import {resolve, dirname} from 'node:path';
import {fileURLToPath} from 'node:url';

if (!process.argv[2]) throw Error('Explicit output directory required');
const root = resolve(dirname(fileURLToPath(import.meta.url)), '../../..'), output = resolve(process.argv[2]);
const pkg = JSON.parse(await readFile(resolve(root, 'package.json'), 'utf8'));
if (pkg.dependencies.pg !== '8.23.1') throw Error('Reviewed pg pin changed');
await mkdir(output, {recursive: true});
const path = resolve(output, 'potok-generation-worker.cjs');
const built = await build({absWorkingDir: root, entryPoints: {
  'potok-generation-worker':'src/server/generationNodeWorkerCliV1.ts',
  'potok-generation-connection-check':'src/server/generationNodeConnectionCliV1.ts'},
  outdir: output, outExtension:{'.js':'.cjs'}, bundle: true, platform: 'node', target: 'node24', format: 'cjs', metafile: true});
const files={};
for(const name of ['potok-generation-worker.cjs','potok-generation-connection-check.cjs'])
  files[name]=createHash('sha256').update(await readFile(resolve(output,name))).digest('hex');
await writeFile(resolve(output, 'manifest.json'), JSON.stringify({contract: 'potok-node-worker-bundle-v1',
  target: 'STAGING_ONLY', enabledByDefault: false, hostedAcceptance: false, node: (await readFile(resolve(root, '.node-version'), 'utf8')).trim(),
  workerDnsModes:['SYSTEM','DNS_AAAA'],workerDefaultDnsMode:'SYSTEM',
  pg: '8.23.1', sha256: createHash('sha256').update(await readFile(path)).digest('hex'),
  files, inputs: Object.keys(built.metafile.inputs).sort()}, null, 2) + '\n');
console.log('Built disabled-by-default Node worker; no connection or deployment.');
