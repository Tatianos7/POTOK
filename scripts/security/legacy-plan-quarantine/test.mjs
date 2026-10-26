import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {createHash} from 'node:crypto';
import {pathToFileURL} from 'node:url';
import {seedSQL as seedPrograms,finalSQL as readFinalSQL,PA,PB} from '../program-reads/fixture.mjs';
import {seedSQL as seedHistory,finalSQL as historyFinalSQL} from '../program-history/fixture.mjs';
import {tables,finalSQL} from './fixture.mjs';
import {catalogFixture,A,B} from '../authority-profile/fixture.mjs';

const embedded=process.env.SQL_TEST_PGLITE_MODULE;let db;
if(embedded){const {PGlite}=await import(pathToFileURL(embedded));db=new PGlite();await db.exec('CREATE ROLE test_admin SUPERUSER;SET SESSION AUTHORIZATION test_admin;ALTER ROLE postgres RENAME TO embedded_bootstrap;');}
else{const u=new URL(process.env.TEST_DATABASE_URL??'');assert.equal(u.hostname,'127.0.0.1');assert.equal(u.pathname,'/potok_legacy_plan_quarantine_test');const {default:pg}=await import(pathToFileURL(process.env.SQL_TEST_PG_MODULE));db=new pg.Client({connectionString:u.href});await db.connect();}
const exec=s=>embedded?db.exec(s):db.query(s),rows=async s=>(await db.query(s)).rows;
const review=await readFile('scripts/security/legacy-plan-quarantine/review.sql','utf8');
assert.equal((review.match(/^BEGIN;$/gm)??[]).length,1);assert.equal((review.match(/^ROLLBACK;$/gm)??[]).length,1);assert.doesNotMatch(review,/^COMMIT;$/m);
const body=review.replace(/^BEGIN;$/m,'').replace(/^ROLLBACK;$/m,'');
let profile;
if(process.env.AUTHORITY_PROFILE_INPUT)profile=await readFile(process.env.AUTHORITY_PROFILE_INPUT,'utf8');
else{const r=await fetch('https://raw.githubusercontent.com/Tatianos7/POTOK/7f4f7e24fec497a22dea29dd14f4546115439129/supabase/migration_drafts/profile_column_write_containment_v1.sql',{redirect:'error',signal:AbortSignal.timeout(30000)});assert(r.ok);profile=await r.text();}
assert.equal(createHash('sha256').update(profile).digest('hex'),'b781e7754732d12359cfff990ca855f75115695c283b08f9f221f785f5d529ea');
async function client(role,user,q,extra={}){
 await exec(`SAVEPOINT client_call;SET LOCAL ROLE ${role};SELECT set_config('request.jwt.claims','${JSON.stringify({role,sub:user,...extra})}',true);`);
 try{const r=await rows(q);await exec('SET LOCAL ROLE postgres;RELEASE client_call;');return r;}
 catch(e){await exec('ROLLBACK TO client_call;RELEASE client_call;');throw e;}
}
const denied=fn=>assert.rejects(fn,e=>e.code==='42501');
const snapshot=async()=>({
 data:await rows(`SELECT * FROM (${tables.map(t=>`SELECT '${t}' AS t,to_jsonb(x)-'execution_reason' AS row FROM public.${t} x`).join(' UNION ALL ')}) q ORDER BY t,row::text`),
 metadata:await rows(`SELECT c.relname,c.relacl::text,c.relrowsecurity,a.attname,a.atttypid,a.attacl::text FROM pg_class c JOIN pg_attribute a ON a.attrelid=c.oid WHERE c.relnamespace='public'::regnamespace AND a.attnum>0 AND NOT a.attisdropped ORDER BY c.relname,a.attnum`),
 policies:await rows(`SELECT * FROM pg_policies WHERE schemaname='public' ORDER BY tablename,policyname`),
});
let passed=0;async function test(name,fn){await exec('BEGIN;');try{await fn();await exec('ROLLBACK;');passed++;console.log('PASS '+name);}catch(e){await exec('ROLLBACK;');throw e;}}
try{
 await exec('CREATE ROLE leaked_reader;CREATE ROLE postgres NOSUPERUSER BYPASSRLS;CREATE ROLE anon;CREATE ROLE authenticated;CREATE ROLE service_role BYPASSRLS;GRANT anon,authenticated,service_role TO postgres;GRANT leaked_reader TO authenticated;');
 const name=(await rows('SELECT current_database() AS name'))[0].name;assert(/^[a-z_][a-z0-9_]*$/.test(name));
 await exec(`ALTER DATABASE ${name} OWNER TO postgres;DROP SCHEMA public CASCADE;CREATE SCHEMA public AUTHORIZATION postgres;REVOKE CREATE ON SCHEMA public FROM PUBLIC;CREATE SCHEMA auth;GRANT USAGE ON SCHEMA public,auth TO postgres,anon,authenticated,service_role;
 CREATE FUNCTION auth.jwt() RETURNS jsonb LANGUAGE sql STABLE AS $$ SELECT coalesce(nullif(current_setting('request.jwt.claims',true),''),'{}')::jsonb $$;
 CREATE FUNCTION auth.uid() RETURNS uuid LANGUAGE sql STABLE AS $$ SELECT (auth.jwt()->>'sub')::uuid $$;
 CREATE TABLE auth.users(id uuid PRIMARY KEY);INSERT INTO auth.users VALUES('${A}'),('${B}');GRANT REFERENCES ON auth.users TO postgres;SET SESSION AUTHORIZATION postgres;`);
 await exec(await catalogFixture());await exec(profile);
 await exec((await readFile('supabase/migration_drafts/trusted_authority_id_user_review_v1.sql','utf8')).replace(/^ROLLBACK;$/m,'COMMIT;'));
 await exec(await readFile('supabase/phase7_3_2_monetization.sql','utf8'));
 await exec('GRANT ALL ON public.entitlements,public.subscriptions,public.billing_events TO PUBLIC,anon,authenticated,service_role;GRANT EXECUTE ON ALL FUNCTIONS IN SCHEMA public TO authenticated,service_role;');
 // The legacy blanket function fixture grant above must not expose the authority reader.
 await exec('REVOKE ALL ON FUNCTION public.has_verified_entitlement_v1(text),public.has_verified_entitlement_v2(text) FROM PUBLIC,anon,service_role;');
 await exec((await readFile('supabase/migration_drafts/premium_finance_authority_review_v1.sql','utf8')).replace(/^ROLLBACK;$/m,'COMMIT;'));
 await exec(`INSERT INTO public.entitlements(user_id,tier,flags) VALUES('${A}','free','{}'),('${B}','pro','{"can_explain":true}');`);
 await exec((await readFile('scripts/security/server-premium/paywall-review.sql','utf8')).replace(/^ROLLBACK;$/m,'COMMIT;'));
 await exec(await seedPrograms(A,B));
 await exec((await readFile('scripts/security/program-reads/review.sql','utf8')).replace(/^ROLLBACK;$/m,'COMMIT;'));
 await exec(seedHistory());
 await exec((await readFile('scripts/security/program-history/review.sql','utf8')).replace(/^ROLLBACK;$/m,'COMMIT;'));
 await exec(`UPDATE public.program_sessions SET plan_payload='{"preserved":"synthetic plan"}';`);
 await runCases();
 console.log('LEGACY_PLAN_QUARANTINE_OK: '+passed+' cases; legacy generation retired, existing reads and execution annotations preserved');
}catch(e){console.error('LEGACY_PLAN_QUARANTINE_FAILED:',e.message,e.detail??'');process.exitCode=1;}
finally{await db.close?.();await db.end?.();}

async function runCases(){
 const insert=t=>t==='program_versions'?`INSERT INTO public.${t}(program_id,program_type,version,snapshot) VALUES('${PA}','nutrition',3,'{}')`:
 `INSERT INTO public.${t}(program_id,program_type,from_version,to_version,trigger) VALUES('${PA}','nutrition',2,3,'synthetic')`;
 await test('baseline reproduces direct plan/version rewrite and fake adaptation insert',async()=>{
  await client('authenticated',A,`UPDATE public.nutrition_programs SET program_version=42 WHERE id='${PA}'`);
  await client('authenticated',A,`UPDATE public.program_sessions SET plan_payload='{}' WHERE id='${PA}'`);
  await client('authenticated',A,insert('program_adaptations'));
 });
 const before=await snapshot();await exec(review);assert.deepEqual(await snapshot(),before);passed++;console.log('PASS review rollback restores content, columns, ACL and policies');
 await test('missing prior history containment rejects before any schema or permission change',async()=>{
  await exec('GRANT UPDATE(version) ON public.program_versions TO authenticated;');const state=await snapshot();
  await exec('SAVEPOINT prior;');await assert.rejects(()=>exec(body),/history containment from #208 required/);await exec('ROLLBACK TO prior;RELEASE prior;');assert.deepEqual(await snapshot(),state);
 });
 await test('inherited table/column privileges reject atomically without changing memberships',async()=>{
  for(const [table,privilege] of [['program_days','DELETE'],['program_days','UPDATE(targets)'],['program_versions','INSERT(version)']]){
   await exec(`SAVEPOINT leak;GRANT ${privilege} ON public.${table} TO leaked_reader;`);const state=await snapshot();
   await exec('SAVEPOINT candidate;');await assert.rejects(()=>exec(body),/verification failed/);await exec('ROLLBACK TO candidate;RELEASE candidate;');assert.deepEqual(await snapshot(),state);await exec('ROLLBACK TO leak;RELEASE leak;');
  }
 });
 await test('service-only PUBLIC capability loss rejects instead of adding broad grants',async()=>{
  await exec('GRANT DELETE ON public.program_days TO PUBLIC;REVOKE DELETE ON public.program_days FROM service_role;');const state=await snapshot();
  await exec('SAVEPOINT candidate;');await assert.rejects(()=>exec(body),/verification failed/);await exec('ROLLBACK TO candidate;RELEASE candidate;');assert.deepEqual(await snapshot(),state);
 });
 await exec(review.replace(/^ROLLBACK;$/m,'COMMIT;'));await exec(finalSQL());await exec(historyFinalSQL());await exec(await readFinalSQL());
 assert.deepEqual((await snapshot()).data,before.data);assert.deepEqual(await rows('SELECT DISTINCT execution_reason FROM public.program_sessions'),[{execution_reason:null}]);passed++;console.log('PASS committed quarantine preserves existing plan, history and payload content');
 await test('clients cannot insert or mutate plan content, topology, head or job state',async()=>{
  const patch={nutrition_programs:'program_version=99',training_programs:'program_version=99',program_phases:"name='forged'",program_blocks:"block_type='forged'",program_days:"targets='{}'",program_sessions:"plan_payload='{}'",program_generation_jobs:"status='completed'"};
  for(const role of ['anon','authenticated'])for(const [t,set] of Object.entries(patch)){
   await denied(()=>client(role,A,`UPDATE public.${t} SET ${set}`));await denied(()=>client(role,A,`DELETE FROM public.${t}`));await denied(()=>client(role,A,`TRUNCATE public.${t}`));
  }
  for(const t of ['nutrition_programs','training_programs'])await denied(()=>client('authenticated',A,`INSERT INTO public.${t}(user_id) VALUES('${A}')`));
  for(const t of ['program_versions','program_adaptations'])await denied(()=>client('authenticated',A,insert(t),{is_admin:true,has_premium:true}));
  await denied(()=>client('authenticated',A,`INSERT INTO public.program_versions(id,program_id,program_type,version,snapshot) VALUES('${PA}','${PA}','nutrition',99,'{}') ON CONFLICT(id) DO UPDATE SET version=excluded.version`));
 });
 await test('own pause/resume and skip/start/complete annotate without replacing the plan',async()=>{
  for(const status of ['paused','active'])assert.equal((await client('authenticated',A,`UPDATE public.nutrition_programs SET status='${status}' WHERE id='${PA}' RETURNING id`)).length,1);
  for(const [status,reason] of [['skipped',"'fatigue'"],['planned','NULL'],['completed','NULL']]){
   const [row]=await client('authenticated',A,`UPDATE public.program_sessions SET status='${status}',execution_reason=${reason} WHERE id='${PA}' RETURNING status,plan_payload`);
   assert.equal(row.status,status);assert.deepEqual(row.plan_payload,{preserved:'synthetic plan'});
  }
  for(const assignment of ["date='2026-10-27'",`program_id='${PB}'`,"session_type='workout_plan'",`id='${PB}'`])await denied(()=>client('authenticated',A,`UPDATE public.program_sessions SET ${assignment} WHERE id='${PA}'`));
  await assert.rejects(()=>client('authenticated',A,`UPDATE public.program_sessions SET execution_reason='forged' WHERE id='${PA}'`),e=>e.code==='23514');
 });
 await test('foreign, ambiguous and mismatched-type sessions cannot be read or annotated',async()=>{
  assert.deepEqual(await client('authenticated',B,`UPDATE public.program_sessions SET status='skipped' WHERE id='${PA}' RETURNING id`),[]);
  await exec(`INSERT INTO public.training_programs(id,user_id,status) VALUES('${PA}','${A}','active');`);
  assert.deepEqual(await client('authenticated',A,`SELECT id FROM public.program_sessions WHERE id='${PA}'`),[]);
  assert.deepEqual(await client('authenticated',A,`UPDATE public.program_sessions SET status='skipped' WHERE id='${PA}' RETURNING id`),[]);
  await exec(`DELETE FROM public.training_programs WHERE id='${PA}';UPDATE public.program_sessions SET session_type='workout_plan' WHERE id='${PA}';`);
  assert.deepEqual(await client('authenticated',A,`UPDATE public.program_sessions SET status='skipped' WHERE id='${PA}' RETURNING id`),[]);
 });
 await test('existing program reads and untrusted manual annotations remain; no FACT writes',async()=>{
  const r=await client('authenticated',A,`SELECT * FROM public.get_program_days('${PA}')`);assert.equal(r.length,1);assert.deepEqual(r[0].targets,{calories:123});
  await client('authenticated',A,`INSERT INTO public.program_feedback(program_id,program_type,energy) VALUES('${PA}','nutrition',3)`);
  await client('authenticated',A,`INSERT INTO public.program_guard_events(program_id,program_type,risk_level) VALUES('${PA}','nutrition','caution')`);
  const diary=await rows('SELECT to_jsonb(x) AS row FROM public.food_diary_entries x ORDER BY id');
  await client('authenticated',A,`UPDATE public.program_sessions SET status='completed' WHERE id='${PA}'`);
  assert.deepEqual(await rows('SELECT to_jsonb(x) AS row FROM public.food_diary_entries x ORDER BY id'),diary);
  await exec(historyFinalSQL());await exec(await readFinalSQL());
 });
 await test('trusted service capabilities preserved but not newly expanded',async()=>{
  await client('service_role',B,`UPDATE public.nutrition_programs SET program_version=7 WHERE id='${PA}'`);
  assert.equal((await rows(`SELECT program_version AS v FROM public.nutrition_programs WHERE id='${PA}'`))[0].v,7);
 });
 await test('reapplication fails before mutation on the changed session shape',async()=>{
  const state=await snapshot();await exec('SAVEPOINT replay;');await assert.rejects(()=>exec(body),/original session shape/);await exec('ROLLBACK TO replay;RELEASE replay;');assert.deepEqual(await snapshot(),state);
 });
}
