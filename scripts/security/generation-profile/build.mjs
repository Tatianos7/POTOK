import {build} from 'esbuild';
import process from 'node:process';
import {mkdir, writeFile} from 'node:fs/promises';
import {resolve, dirname} from 'node:path';
import {fileURLToPath} from 'node:url';
import {builtinModules} from 'node:module';

// An offline diagnostic bundle, not an Edge endpoint or a deploy artifact.
const root = resolve(dirname(fileURLToPath(import.meta.url)), '../../..');
const output = resolve(process.argv[2] || '/tmp/potok-generation-profile');
await mkdir(output, {recursive: true});
const inject = resolve(output, 'buffer-shim.mjs');
const builtins = new Set(builtinModules.map(name => name.replace(/^node:/, '')));
await writeFile(inject, "export {Buffer} from 'node:buffer';\n");
const result = await build({absWorkingDir: root, entryPoints: ['scripts/security/generation-profile/run.ts'],
  bundle: true, platform: 'node', format: 'esm', target: 'es2022', supported: {'node-colon-prefix-import': true}, inject: [inject], metafile: true,
  outfile: resolve(output, 'worker-profile.mjs'), plugins: [{name: 'pinned-deno-pg', setup(b) {
    b.onResolve({filter: /^pg$/}, () => ({path: 'npm:pg@8.23.1', external: true}));
    b.onResolve({filter: /^[a-z][a-z_/]*$/}, ({path}) => builtins.has(path) ? {path: `node:${path}`, external: true} : undefined);
  }}]});
await writeFile(resolve(output, 'bundle-metadata.json'), JSON.stringify({contract: 'potok-generation-profile-bundle-v1',
  deployable: false, packages: {pg: '8.23.1'}, inputs: Object.keys(result.metafile.inputs).sort(),
  outputBytes: Object.values(result.metafile.outputs).reduce((sum, item) => sum + item.bytes, 0)}, null, 2));
console.log('Created local diagnostic bundle; no deployment or database operation.');
