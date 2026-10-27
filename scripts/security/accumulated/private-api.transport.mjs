// CI-only transport fixture. Never accepts an owner container or database URL.
import assert from 'node:assert/strict';
import {spawnSync} from 'node:child_process';
import {mkdtemp,writeFile,rm} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import path from 'node:path';
import {makeEnvironment,createAPIArgs,probeScript,restTag,nodeTag} from './private-api.mjs';
assert.equal(process.env.GITHUB_ACTIONS,'true');
const prefix='potok-private-api-ci-'+process.env.GITHUB_RUN_ID;assert.match(prefix,/^potok-private-api-ci-[0-9]+$/);
const dbName=prefix+'-db',apiName=prefix+'-rest',directory=await mkdtemp(path.join(tmpdir(),'potok-private-api-ci-'));
const docker=(args,input)=>{const r=spawnSync('docker',args,{input,encoding:'utf8',timeout:180000,maxBuffer:4*1024*1024});assert.equal(r.status,0,'Disposable transport operation failed');return r.stdout.trim();};
let dbId,apiId;
try{
 for(const image of ['postgres:17',restTag,nodeTag])docker(['pull',image]);
 dbId=docker(['create','--name',dbName,'--network','none','--env','POSTGRES_USER=test_admin','--env','POSTGRES_PASSWORD=disposable-test-only','--env','POSTGRES_DB=postgres','postgres:17']);
 docker(['start',dbId]);
 for(let i=0;i<40;i++){const r=spawnSync('docker',['exec',dbId,'pg_isready','-U','test_admin','-d','postgres'],{stdio:'ignore'});if(r.status===0)break;await new Promise(r=>setTimeout(r,500));}
 docker(['exec','-i',dbId,'psql','-X','-U','test_admin','-d','postgres','--set','ON_ERROR_STOP=1'],`CREATE ROLE anon;CREATE ROLE authenticator LOGIN NOINHERIT PASSWORD 'synthetic-api-only';GRANT anon TO authenticator;CREATE SCHEMA extensions;CREATE SCHEMA potok_delivery;GRANT USAGE ON SCHEMA public TO anon;`);
 const environment=makeEnvironment('synthetic-api-only','a'.repeat(128)),envFile=path.join(directory,'api.env');await writeFile(envFile,Object.entries(environment).map(([k,v])=>k+'='+v).join('\n')+'\n',{mode:0o600});
 const rest=JSON.parse(docker(['image','inspect',restTag]))[0],node=JSON.parse(docker(['image','inspect',nodeTag]))[0];
 const binary=rest.Config.Entrypoint?.[0]??rest.Config.Cmd?.[0];
 apiId=docker(createAPIArgs({name:apiName,dbId,imageId:rest.Id,binary,envFile}));docker(['start',apiId]);
 const result=docker(['run','--rm','-i','--network','container:'+dbId,'--read-only','--cap-drop','ALL','--security-opt','no-new-privileges','--entrypoint','node',node.Id,'--input-type=module'],probeScript());assert.equal(result,'PRIVATE_API_HTTP_READY_OK\nPRIVATE_API_SCHEMAS_CLOSED_OK');
 const db=JSON.parse(docker(['inspect',dbId]))[0],api=JSON.parse(docker(['inspect',apiId]))[0];assert.equal(db.HostConfig.NetworkMode,'none');assert.equal(api.HostConfig.NetworkMode,'container:'+dbId);assert.deepEqual(api.HostConfig.PortBindings??{},{});
 console.log('PRIVATE_API_TRANSPORT_OK: real PostgREST 16.5/PG17/Node HTTP, shared isolated namespace, private schemas closed; synthetic fixture only');
}catch(e){
 console.error('PRIVATE_API_TRANSPORT_FAILED');
 if(apiId){const logs=spawnSync('docker',['logs',apiId],{encoding:'utf8'});process.stderr.write(((logs.stdout??'')+(logs.stderr??'')).replaceAll('synthetic-api-only','[synthetic]'));}
 throw e;
}finally{
 for(const id of [apiId,dbId])if(id)spawnSync('docker',['rm','-f','-v',id],{stdio:'ignore'});
 await rm(directory,{recursive:true,force:true});
}
