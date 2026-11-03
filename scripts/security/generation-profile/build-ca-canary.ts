import 'reflect-metadata';
import {build} from 'esbuild';
import {mkdir, writeFile} from 'node:fs/promises';
import {resolve} from 'node:path';
import {KeyUsageFlags} from '@peculiar/x509';
import {generationRootCertificateFixtureV1 as certificate} from '../../../src/server/__tests__/generationRootCaFixturesV1';

const output = process.argv[2];
if (!output) throw Error('Expected an explicit local output directory');
await mkdir(output, {recursive: true});
const valid = await certificate(), ca = valid.toString('pem');
const broken = new Uint8Array(valid.rawData); broken[broken.length - 1] ^= 1;
const cases = [
  {name: 'valid', ca, accepted: true},
  {name: 'signature', ca: `-----BEGIN CERTIFICATE-----\n${Buffer.from(broken).toString('base64')}\n-----END CERTIFICATE-----`, accepted: false},
  {name: 'non-ca', ca: (await certificate({ca: false})).toString('pem'), accepted: false},
  {name: 'expired', ca: (await certificate({before: Date.now() - 172800000, after: Date.now() - 86400000})).toString('pem'), accepted: false},
  {name: 'future', ca: (await certificate({before: Date.now() + 86400000, after: Date.now() + 172800000})).toString('pem'), accepted: false},
  {name: 'key-usage', ca: (await certificate({usage: KeyUsageFlags.digitalSignature})).toString('pem'), accepted: false},
  {name: 'authority-key-id', ca: (await certificate({aki: '010203'})).toString('pem'), accepted: false},
  {name: 'duplicate-extension', ca: (await certificate({duplicate: true})).toString('pem'), accepted: false},
  {name: 'bundle', ca: ca + ca, accepted: false},
];
// The generated module is an isolated public-certificate diagnostic. It has no
// pg, credentials, user data, request dispatch or generator activation path.
await build({stdin: {contents: `import {assertGenerationRootCaV1} from './src/server/generationRootCaV1';
const cases = ${JSON.stringify(cases)};
Deno.serve(async () => {
 const results=[];
 for(const item of cases){let accepted=false;try{await assertGenerationRootCaV1(item.ca);accepted=true;}catch{}
 results.push({name:item.name,pass:accepted===item.accepted});}
 return Response.json({contract:'potok-local-edge-ca-canary-v1',runtime:Deno.version.deno,
 hostedAcceptance:false,workerExecutionTested:false,cpuLimitsEnforced:false,results});
});`, resolveDir: process.cwd(), loader: 'ts'}, bundle: true, platform: 'browser', format: 'esm', target: 'es2022',
  outfile: resolve(output, 'index.ts')});
await writeFile(resolve(output, 'README.txt'), 'CI-only synthetic certificate probe. Not a generation deployment artifact.\n');
console.log('Built isolated CA canary with nine public-certificate cases.');
