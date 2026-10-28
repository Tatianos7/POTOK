// Same lifecycle and client checks on an unlinked disposable Supabase project.
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import {spawnSync} from 'node:child_process';
import {createClient} from '@supabase/supabase-js';
import ts from 'typescript';
import {login,localFetch,status} from '../data-api-explicit-grants/local-auth.mjs';
import {makeProgramManifest} from './program-fixture-sql.mjs';
import {seedProgramSQL,fixtureObservationSQL,validateFixtureObservation,cleanupProgramSQL} from './program-client-sql.mjs';
import {programWorkerBundle} from './program-client.mjs';
import {checkProgramClient} from './program-client-worker.mjs';
assert.equal(process.env.GITHUB_ACTIONS,'true');assert.equal(status.API_URL,'http://127.0.0.1:54321');
const run=sql=>{const r=spawnSync('docker',['exec','-i','supabase_db_potok-photo-http-acceptance','sh','-c','PGPASSWORD="$POSTGRES_PASSWORD" exec psql -X -w -qAt -h /run/postgresql -U supabase_admin -d postgres --set ON_ERROR_STOP=1'],{input:sql,encoding:'utf8',timeout:120000,maxBuffer:32*1024*1024});if(r.status!==0)throw Error('Synthetic SQL failed: '+r.stderr);return r.stdout.trim();};
const observe=sql=>JSON.parse(run("BEGIN READ ONLY;SET LOCAL search_path=pg_catalog,pg_temp;SET LOCAL timezone='UTC';"+sql+';ROLLBACK;'));
const names=observe("SELECT jsonb_agg(relname::text ORDER BY relname) FROM pg_class WHERE relnamespace='public'::regnamespace AND relkind='r'");for(const n of names)assert.match(n,/^[a-z_][a-z0-9_]*$/);
const snapshot=()=>observe("SELECT jsonb_build_object('policies',(SELECT jsonb_agg(to_jsonb(p) ORDER BY oid) FROM pg_policy p),'data',jsonb_build_object("+names.map(n=>"'"+n+"',(SELECT md5(coalesce(string_agg(to_jsonb(t)::text,'' ORDER BY to_jsonb(t)::text),'')) FROM public.\""+n+'\" t)').join(',')+'))');
let phase='identities',cleanup;try{
 const users=await Promise.all(['combined-a@example.test','combined-b@example.test'].map(login));const manifest=makeProgramManifest(users.map(u=>u.id)),before=snapshot();
 phase='worker-runtime';const probe=spawnSync(process.execPath,['--input-type=module','--eval',programWorkerBundle(process.cwd())],{input:JSON.stringify({selfCheck:true,users:[{email:'potok-ab-123456789012345678901234-a@example.test'},{email:'potok-ab-123456789012345678901234-b@example.test'}]}),encoding:'utf8',timeout:15000});assert.equal(probe.status,0);assert(probe.stdout.includes('PROGRAM_CLIENT_RUNTIME_SELF_CHECK_OK'));
 phase='seed';run(seedProgramSQL(manifest));const seeded=observe(fixtureObservationSQL(manifest));validateFixtureObservation(manifest,seeded);cleanup=cleanupProgramSQL(manifest,seeded);
 try{phase='real-client';const result=await checkProgramClient({manifest,users,createClient,ts,source:await fs.readFile('src/services/programExecutionService.ts','utf8'),apiURL:status.API_URL,request:(url,o)=>localFetch(url,{...o,headers:{...o.headers,apikey:status.ANON_KEY}}),authUser:async u=>{const r=await localFetch(status.API_URL+'/auth/v1/user',{headers:{apikey:status.ANON_KEY,Authorization:'Bearer '+u.token}});assert.equal(r.status,200);return r.json();}});assert.equal(result.clientActions,12);}
 finally{phase='exact-cleanup';run(cleanup);}
 phase='preservation';assert.deepEqual(snapshot(),before);for(const rows of Object.values(observe(fixtureObservationSQL(manifest))))assert.equal(rows.length,0);
 console.log('PROGRAM_CLIENT_NATIVE_HTTP_OK: actual production service/SDK/Auth/REST; four programs, 12 annotations, foreign/account-switch denial, exact cleanup and PLAN != FACT verified. No UI acceptance.');
}catch(e){console.error('PROGRAM_CLIENT_CI_STOPPED: '+phase);if(String(e.message).startsWith('Synthetic SQL failed:'))console.error(e.message);process.exitCode=1;}
