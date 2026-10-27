// CI-only transport fixture. Never accepts an owner container or database URL.
import assert from 'node:assert/strict';
import {spawnSync} from 'node:child_process';
import {mkdtemp,writeFile,rm} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import path from 'node:path';
import {makeEnvironment,createAPIArgs,probeScript,restTag,nodeTag} from './private-api.mjs';
import {authEnvironment,authArgs,authProbe,authMetadataSQL,authTag} from './private-auth.mjs';
import {templateEnvironment,workerArgs,rowSnapshotSQL,assertOriginalRows} from './private-auth-ab.mjs';
import {readFile} from 'node:fs/promises';
assert.equal(process.env.GITHUB_ACTIONS,'true');
const prefix='potok-private-api-ci-'+process.env.GITHUB_RUN_ID;assert.match(prefix,/^potok-private-api-ci-[0-9]+$/);
const dbName=prefix+'-db',apiName=prefix+'-rest',directory=await mkdtemp(path.join(tmpdir(),'potok-private-api-ci-'));
const docker=(args,input)=>{const r=spawnSync('docker',args,{input,encoding:'utf8',timeout:180000,maxBuffer:4*1024*1024});if(r.status!==0)console.error('Fixture docker '+args[0]+': '+(r.stderr??'').replaceAll('synthetic-api-only','[synthetic]').replaceAll('disposable-test-only','[synthetic]'));assert.equal(r.status,0,'Disposable transport operation failed');return r.stdout.trim();};
let dbId,apiId,authId,workerId;
try{
 for(const image of ['postgres:17',restTag,nodeTag,authTag])docker(['pull',image]);
 dbId=docker(['create','--name',dbName,'--network','none','--env','POSTGRES_USER=test_admin','--env','POSTGRES_PASSWORD=disposable-test-only','--env','POSTGRES_DB=postgres','postgres:17']);
 docker(['start',dbId]);
 // The image's temporary init server accepts Unix sockets before it restarts.
 // Wait for the final TCP listener, then use that listener for fixture setup.
 let ready=false;for(let i=0;i<60;i++){const r=spawnSync('docker',['exec',dbId,'pg_isready','-h','127.0.0.1','-U','test_admin','-d','postgres'],{stdio:'ignore'});if(r.status===0){ready=true;break;}await new Promise(r=>setTimeout(r,500));}assert(ready,'Final TCP PostgreSQL listener did not become ready');
 docker(['exec','-i','--env','PGPASSWORD=disposable-test-only',dbId,'psql','-X','-h','127.0.0.1','-U','test_admin','-d','postgres','--set','ON_ERROR_STOP=1'],`CREATE ROLE anon;CREATE ROLE authenticator LOGIN NOINHERIT PASSWORD 'synthetic-api-only';GRANT anon TO authenticator;CREATE SCHEMA extensions;CREATE SCHEMA potok_delivery;GRANT USAGE ON SCHEMA public TO anon;`);
 const environment=makeEnvironment('synthetic-api-only','a'.repeat(128)),envFile=path.join(directory,'api.env');await writeFile(envFile,Object.entries(environment).map(([k,v])=>k+'='+v).join('\n')+'\n',{mode:0o600});
 const rest=JSON.parse(docker(['image','inspect',restTag]))[0],node=JSON.parse(docker(['image','inspect',nodeTag]))[0];
 const binary=rest.Config.Entrypoint?.[0]??rest.Config.Cmd?.[0];
 apiId=docker(createAPIArgs({name:apiName,dbId,imageId:rest.Id,binary,envFile}));docker(['start',apiId]);
 const result=docker(['run','--rm','-i','--network','container:'+dbId,'--read-only','--cap-drop','ALL','--security-opt','no-new-privileges','--entrypoint','node',node.Id,'--input-type=module'],probeScript());assert.equal(result,'PRIVATE_API_HTTP_READY_OK\nPRIVATE_API_SCHEMAS_CLOSED_OK');
 const db=JSON.parse(docker(['inspect',dbId]))[0],api=JSON.parse(docker(['inspect',apiId]))[0];assert.equal(db.HostConfig.NetworkMode,'none');assert.equal(api.HostConfig.NetworkMode,'container:'+dbId);assert.deepEqual(api.HostConfig.PortBindings??{},{});
 console.log('PRIVATE_API_TRANSPORT_OK: real PostgREST 16.5/PG17/Node HTTP, shared isolated namespace, private schemas closed; synthetic fixture only');
 const adminSQL=sql=>docker(['exec','-i','--env','PGPASSWORD=disposable-test-only',dbId,'psql','-X','-qAt','-h','127.0.0.1','-U','test_admin','-d','postgres','--set','ON_ERROR_STOP=1'],sql);
 adminSQL("CREATE ROLE supabase_auth_admin LOGIN PASSWORD 'synthetic-auth-only';CREATE SCHEMA auth AUTHORIZATION supabase_auth_admin;SET ROLE supabase_auth_admin;CREATE TABLE auth.schema_migrations(version text PRIMARY KEY);INSERT INTO auth.schema_migrations VALUES('sentinel-no-automatic-migrate');RESET ROLE;");
 const before=JSON.parse(adminSQL(authMetadataSQL+';'));
 const authEnv=authEnvironment('synthetic-auth-only','a'.repeat(128)),authEnvFile=path.join(directory,'auth.env');await writeFile(authEnvFile,Object.entries(authEnv).map(([k,v])=>k+'='+v).join('\n')+'\n',{mode:0o600});
 const authImage=JSON.parse(docker(['image','inspect',authTag]))[0],authBinary=authImage.Config.Entrypoint?.[0]??authImage.Config.Cmd?.[0];
 authId=docker(authArgs({name:prefix+'-auth',dbId,imageId:authImage.Id,binary:authBinary,envFile:authEnvFile}));docker(['start',authId]);
 assert.equal(docker(['run','--rm','-i','--network','container:'+dbId,'--read-only','--cap-drop','ALL','--security-opt','no-new-privileges','--entrypoint','node',node.Id,'--input-type=module'],authProbe()),'PRIVATE_AUTH_HTTP_READY_OK');
 await new Promise(r=>setTimeout(r,1000));assert.deepEqual(JSON.parse(adminSQL(authMetadataSQL+';')),before);assert.equal(adminSQL('SELECT version FROM auth.schema_migrations;'),'sentinel-no-automatic-migrate');
 const auth=JSON.parse(docker(['inspect',authId]))[0];assert.deepEqual(auth.Config.Cmd,['serve']);assert.equal(auth.HostConfig.NetworkMode,'container:'+dbId);
 console.log('PRIVATE_AUTH_SERVE_TRANSPORT_OK: real Auth v2.197.0 serve/health; sentinel schema unchanged and no migration path executed; synthetic fixture only');
 // Full Auth schema is migrated ONLY in this disposable CI database, never by
 // either owner bootstrap. Restart the serve process with local OTP templates.
 docker(['stop',authId]);docker(['rm',authId]);authId=undefined;
 adminSQL("DROP SCHEMA auth CASCADE;CREATE ROLE authenticated;CREATE ROLE service_role;CREATE ROLE supabase_admin;CREATE ROLE postgres;CREATE SCHEMA auth AUTHORIZATION supabase_auth_admin;ALTER ROLE supabase_auth_admin SET search_path=auth,public,extensions;CREATE EXTENSION IF NOT EXISTS pgcrypto WITH SCHEMA extensions;CREATE EXTENSION IF NOT EXISTS \"uuid-ossp\" WITH SCHEMA extensions;GRANT USAGE ON SCHEMA extensions TO supabase_auth_admin;GRANT CREATE ON DATABASE postgres TO supabase_auth_admin;");
 docker(['run','--rm','--network','container:'+dbId,'--env-file',authEnvFile,'--entrypoint',authBinary,authImage.Id,'migrate']);
 adminSQL(`CREATE OR REPLACE FUNCTION auth.uid() RETURNS uuid LANGUAGE sql STABLE AS $$ SELECT (nullif(current_setting('request.jwt.claims',true),'')::jsonb->>'sub')::uuid $$;
 GRANT anon,authenticated TO authenticator;GRANT USAGE ON SCHEMA auth,public TO authenticated;
 CREATE TABLE public.user_profiles(id_user uuid PRIMARY KEY REFERENCES auth.users(id),first_name text,is_admin boolean NOT NULL DEFAULT false,has_premium boolean NOT NULL DEFAULT false,created_at timestamptz NOT NULL DEFAULT now(),updated_at timestamptz NOT NULL DEFAULT now());
 ALTER TABLE public.user_profiles ENABLE ROW LEVEL SECURITY;GRANT SELECT ON public.user_profiles TO authenticated;GRANT INSERT(id_user),UPDATE(first_name) ON public.user_profiles TO authenticated;
 CREATE POLICY own_select ON public.user_profiles FOR SELECT TO authenticated USING(auth.uid()=id_user);CREATE POLICY own_insert ON public.user_profiles FOR INSERT TO authenticated WITH CHECK(auth.uid()=id_user);CREATE POLICY own_update ON public.user_profiles FOR UPDATE TO authenticated USING(auth.uid()=id_user) WITH CHECK(auth.uid()=id_user);
 CREATE FUNCTION public.has_verified_entitlement_v1(p_capability text) RETURNS boolean LANGUAGE sql STABLE AS 'SELECT false';REVOKE EXECUTE ON FUNCTION public.has_verified_entitlement_v1(text) FROM PUBLIC;GRANT EXECUTE ON FUNCTION public.has_verified_entitlement_v1(text) TO authenticated;`);
 docker(['restart',apiId]);
 const tableList=JSON.parse(adminSQL("SELECT jsonb_agg(jsonb_build_object('schema',n.nspname,'name',c.relname) ORDER BY 1) FROM pg_class c JOIN pg_namespace n ON n.oid=c.relnamespace WHERE n.nspname IN('auth','public') AND c.relkind='r';")),original=JSON.parse(adminSQL(rowSnapshotSQL(tableList)+';')),authBefore=JSON.parse(adminSQL(authMetadataSQL+';'));
 const abEnv=templateEnvironment(authEnv);await writeFile(authEnvFile,Object.entries(abEnv).map(([k,v])=>k+'='+v).join('\n')+'\n',{mode:0o600});const workerEnvFile=path.join(directory,'worker.env');await writeFile(workerEnvFile,'TEST_EMAIL_A=potok-ab-cafe-a@example.test\nTEST_EMAIL_B=potok-ab-cafe-b@example.test\n',{mode:0o600});
 workerId=docker(workerArgs({name:prefix+'-worker',dbId,imageId:node.Id,envFile:workerEnvFile,source:await readFile(new URL('private-auth-ab-worker.mjs',import.meta.url),'utf8')}));docker(['start',workerId]);authId=docker(authArgs({name:prefix+'-auth',dbId,imageId:authImage.Id,binary:authBinary,envFile:authEnvFile}));docker(['start',authId]);
 const workerExit=docker(['wait',workerId]),workerLog=docker(['logs',workerId]);assert.equal(workerExit,'0','Synthetic OTP worker failed');assert(workerLog.includes('PRIVATE_AUTH_AB_HTTP_OK'));const preserved=assertOriginalRows(original,JSON.parse(adminSQL(rowSnapshotSQL(tableList)+';')));assert.deepEqual(JSON.parse(adminSQL(authMetadataSQL+';')),authBefore);assert(preserved.addedRows>0);
 console.log('PRIVATE_AUTH_AB_TRANSPORT_OK: real local OTP for A/B, actual JWT validation, own profile creation, foreign access and protected writes denied; original rows/schema preserved; minimal synthetic profile/false-capability fixture only');
}catch(e){
 console.error('PRIVATE_API_TRANSPORT_FAILED');
 for(const id of [apiId,authId,workerId])if(id){const logs=spawnSync('docker',['logs',id],{encoding:'utf8'});process.stderr.write(((logs.stdout??'')+(logs.stderr??'')).replaceAll('synthetic-api-only','[synthetic]').replaceAll('synthetic-auth-only','[synthetic]'));}
 throw e;
}finally{
 for(const id of [workerId,authId,apiId,dbId])if(id)spawnSync('docker',['rm','-f','-v',id],{stdio:'ignore'});
 await rm(directory,{recursive:true,force:true});
}
