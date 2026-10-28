// Real mounted Login/MyProgram against disposable Auth/PostgREST, never hosted.
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import {spawnSync} from 'node:child_process';
import {status} from '../data-api-explicit-grants/local-auth.mjs';
import {makeProgramManifest} from './program-fixture-sql.mjs';
import {seedProgramSQL,fixtureObservationSQL,validateFixtureObservation} from './program-client-sql.mjs';
import {programUICleanupSQL} from './program-ui-sql.mjs';
import {programUIBundle} from './program-ui.mjs';
assert.equal(process.env.GITHUB_ACTIONS,'true');assert.equal(status.API_URL,'http://127.0.0.1:54321');
const run=sql=>{const r=spawnSync('docker',['exec','-i','supabase_db_potok-photo-http-acceptance','sh','-c','PGPASSWORD="$POSTGRES_PASSWORD" exec psql -X -w -qAt -h /run/postgresql -U supabase_admin -d postgres --set ON_ERROR_STOP=1'],{input:sql,encoding:'utf8',timeout:120000,maxBuffer:32*1024*1024});if(r.status!==0)throw Error('Synthetic SQL failed: '+r.stderr);return r.stdout.trim();};
const observe=sql=>JSON.parse(run("BEGIN READ ONLY;SET LOCAL search_path=pg_catalog,pg_temp;SET LOCAL timezone='UTC';"+sql+';ROLLBACK;'));
const names=observe("SELECT jsonb_agg(relname::text ORDER BY relname) FROM pg_class WHERE relnamespace='public'::regnamespace AND relkind='r'");for(const n of names)assert.match(n,/^[a-z_][a-z0-9_]*$/);
const snapshot=()=>observe("SELECT jsonb_build_object('policies',(SELECT jsonb_agg(to_jsonb(p) ORDER BY oid) FROM pg_policy p),'data',jsonb_build_object("+names.map(n=>"'"+n+"',(SELECT md5(coalesce(string_agg(to_jsonb(t)::text,'' ORDER BY to_jsonb(t)::text),'')) FROM public.\""+n+'\" t)').join(',')+'))');
let phase='identities';try{
 const users=observe("SELECT jsonb_agg(jsonb_build_object('id',id,'email',email) ORDER BY email) FROM auth.users WHERE email IN('combined-a@example.test','combined-b@example.test')");assert.equal(users.length,2);const manifest=makeProgramManifest(users.map(u=>u.id)),before=snapshot();
 phase='seed';run(seedProgramSQL(manifest));const seeded=observe(fixtureObservationSQL(manifest));validateFixtureObservation(manifest,seeded);const cleanup=programUICleanupSQL(manifest,seeded);
 try{phase='browser';const publicFiles={};for(const name of ['src/services/programDeliveryService.ts','src/services/uiRuntimeAdapter.ts'])publicFiles[name]=await fs.readFile(name,'utf8');const browser=spawnSync(process.execPath,['--input-type=module','--eval',await programUIBundle()],{input:JSON.stringify({mode:'ci',root:process.cwd(),anon:status.ANON_KEY,users,manifest,publicFiles}),encoding:'utf8',timeout:300000,maxBuffer:4*1024*1024});if(browser.status!==0){console.error(browser.stderr.split('\n').filter(s=>/PROGRAM_UI_BROWSER_STOPPED|Error:/.test(s)).slice(-3).join('\n'));}assert.equal(browser.status,0);const result=JSON.parse(browser.stdout.trim());assert.equal(result.pauseResumeActions,4);}
 finally{const current=phase;phase='cleanup';run(cleanup);phase=current;}
 phase='preservation';assert.deepEqual(snapshot(),before);for(const rows of Object.values(observe(fixtureObservationSQL(manifest))))assert.equal(rows.length,0);
 console.log('PROGRAM_UI_NATIVE_BROWSER_OK: actual Login/MyProgram; two ordinary users, real own program rendering and four pause/resume button actions, reload, foreign denial, generator disabled, exact cleanup and original data/policy preservation. Training/day-action UI not claimed.');
}catch(e){console.error('PROGRAM_UI_CI_STOPPED: '+phase);console.error('PROGRAM_UI_DIAGNOSTIC: '+String(e.message).slice(0,250));process.exitCode=1;}
