import {build} from 'esbuild';
import {mkdir, readFile, writeFile} from 'node:fs/promises';
import {resolve} from 'node:path';
import {builtinModules} from 'node:module';

// CI-only, synthetic services. Never put these under supabase/functions.
const [outputArg, caPath, wrongCaPath] = process.argv.slice(2);
if (!outputArg || !caPath || !wrongCaPath) throw Error('Expected output and two public CA paths');
const output = resolve(outputArg);
const ca = await readFile(caPath, 'utf8'), wrongCa = await readFile(wrongCaPath, 'utf8');
const builtins = new Set(builtinModules.map(n => n.replace(/^node:/, '')));
await mkdir(output, {recursive: true});
const shim = resolve(output, 'buffer-shim.mjs');
await writeFile(shim, "export {Buffer} from 'node:buffer';export {default as process} from 'node:process';export {setImmediate,clearImmediate} from 'node:timers';\n");
async function bundle(name: string, contents: string) {
  await mkdir(resolve(output, name), {recursive: true});
  await build({stdin: {contents, resolveDir: process.cwd(), loader: 'ts'}, bundle: true,
    platform: 'node', format: 'esm', target: 'es2022', supported: {'node-colon-prefix-import': true},
    inject: [shim], define: {global: 'globalThis'},
    banner: {js: "import {createRequire as diagnosticCreateRequire} from 'node:module';const require=diagnosticCreateRequire(import.meta.url);"},
    outfile: resolve(output, name, 'index.ts'), plugins: [{name: 'explicit-node-builtins', setup(b) {
      b.onResolve({filter: /^[a-z][a-z_/]*$/}, ({path}) => builtins.has(path) ? {path: `node:${path}`, external: true} : undefined);
    }}]});
}
for (const name of ['small', 'robust', 'strict']) {
  await bundle(name, `import {profileGenerationWorkerV1} from './scripts/security/generation-profile/profile';
    Deno.serve(async()=>Response.json(await profileGenerationWorkerV1(1,{caseName:'${name}',probes:false})));`);
}
await bundle('pg', `import assert from 'node:assert/strict';import {Pool} from 'pg';
  import {adaptGenerationNodePgPoolV1} from './src/server/generationNodePgPoolV1';
  import {assertGenerationRootCaV1} from './src/server/generationRootCaV1';
  const ca=${JSON.stringify(ca)},wrongCa=${JSON.stringify(wrongCa)};
  Deno.serve(async()=>{
    await assertGenerationRootCaV1(ca);await assertGenerationRootCaV1(wrongCa);
    const results=[];
    for(const user of ['potok_generation_reader_v1','potok_generation_gateway_v1']){
      for(const mode of ['valid','wrong-ca','wrong-name','wrong-password']){
        const pool=new Pool({host:'potok-profile-db',port:5432,database:'postgres',user,
          password:mode==='wrong-password'?'incorrect-fixture-only':'fixture-only-password',
          ssl:{ca:mode==='wrong-ca'?wrongCa:ca,rejectUnauthorized:true,
            servername:mode==='wrong-name'?'invalid.fixture.test':'potok-profile-db',minVersion:'TLSv1.2'},
          enableChannelBinding:true,max:2,connectionTimeoutMillis:5000,query_timeout:5000,
          options:'-c search_path=pg_catalog',replication:'false',sslnegotiation:'postgres'});
        const adapter=adaptGenerationNodePgPoolV1(pool,()=>true);let accepted=false;
        try{const lease=await adapter.acquire();try{
          const r=await lease.query('SELECT current_user AS role, session_user AS session_role, ssl FROM pg_catalog.pg_stat_ssl WHERE pid=pg_catalog.pg_backend_pid()',[]);
          assert.equal(r.rows.length,1);assert.equal(r.rows[0].role,user);
          assert.equal(r.rows[0].session_role,user);assert.equal(r.rows[0].ssl,true);accepted=true;
        }finally{await lease.release(true);}}catch{accepted=false;}finally{await adapter.close();}
        results.push({user,mode,pass:accepted===(mode==='valid')});
      }
    }
    return Response.json({contract:'potok-local-edge-pg-canary-v1',hostedAcceptance:false,
      realLocalPostgres:true,stagingConnectionTested:false,results});
  });`);
await bundle('cpu', `Deno.serve(()=>{const start=performance.now();let x=1;
  while(performance.now()-start<8000){for(let i=0;i<100000;i++)x=Math.imul(x,1664525)+1013904223|0;}
  return Response.json({unexpectedCpuCompletion:true,x});});`);
await mkdir(resolve(output, 'main'), {recursive: true});
await writeFile(resolve(output, 'main/index.ts'), `// Local diagnostic router, no credentials and no request-derived service path.
Deno.serve(async req=>{
  const name=new URL(req.url).pathname.slice(1);
  if(name==='health')return Response.json({ok:true});
  if(!['small','robust','strict','pg','cpu'].includes(name))return new Response(null,{status:404});
  try{
    const worker=await EdgeRuntime.userWorkers.create({servicePath:'/service/'+name,
      memoryLimitMb:256,workerTimeoutMs:150000,cpuTimeSoftLimitMs:2000,cpuTimeHardLimitMs:2000,
      noModuleCache:false,forceCreate:true,envVars:[]});
    return await worker.fetch(req);
  }catch{return Response.json({contract:'potok-local-edge-worker-cancelled-v1',caseName:name},{status:503});}
});\n`);
await writeFile(resolve(output, 'README.txt'), 'CI-only services; synthetic input and ephemeral local PostgreSQL. Not a hosted deployment artifact.\n');
console.log('Built local full-worker, driver and CPU diagnostic services.');
