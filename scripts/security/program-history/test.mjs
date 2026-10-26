import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {createHash} from 'node:crypto';
import {pathToFileURL} from 'node:url';
import {seedSQL as seedPrograms,finalSQL as readFinalSQL,PA,PB} from '../program-reads/fixture.mjs';
import {seedSQL as seedHistory,finalSQL,tables} from './fixture.mjs';
import {catalogFixture,A,B} from '../authority-profile/fixture.mjs';

const embedded=process.env.SQL_TEST_PGLITE_MODULE;let db;
if(embedded){const {PGlite}=await import(pathToFileURL(embedded));db=new PGlite();await db.exec('CREATE ROLE test_admin SUPERUSER;SET SESSION AUTHORIZATION test_admin;ALTER ROLE postgres RENAME TO embedded_bootstrap;');}
else{const u=new URL(process.env.TEST_DATABASE_URL??'');assert.equal(u.hostname,'127.0.0.1');assert.equal(u.pathname,'/potok_program_history_test');const {default:pg}=await import(pathToFileURL(process.env.SQL_TEST_PG_MODULE));db=new pg.Client({connectionString:u.href});await db.connect();}
const exec=s=>embedded?db.exec(s):db.query(s),rows=async s=>(await db.query(s)).rows;
const review=await readFile('scripts/security/program-history/review.sql','utf8');
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
 data:await rows(`SELECT * FROM (SELECT 'program_versions' AS t,to_jsonb(x) AS row FROM public.program_versions x UNION ALL SELECT 'program_adaptations',to_jsonb(x) FROM public.program_adaptations x UNION ALL SELECT 'program_explainability',to_jsonb(x) FROM public.program_explainability x UNION ALL SELECT 'program_guard_events',to_jsonb(x) FROM public.program_guard_events x UNION ALL SELECT 'food_diary_entries',to_jsonb(x) FROM public.food_diary_entries x UNION ALL SELECT 'nutrition_programs',to_jsonb(x) FROM public.nutrition_programs x UNION ALL SELECT 'program_sessions',to_jsonb(x) FROM public.program_sessions x) q ORDER BY t,row::text`),
 acl:await rows(`SELECT c.relname,c.relacl::text,a.attname,a.attacl::text FROM pg_class c JOIN pg_attribute a ON a.attrelid=c.oid WHERE c.oid IN('public.program_versions'::regclass,'public.program_adaptations'::regclass,'public.program_explainability'::regclass,'public.program_guard_events'::regclass) AND a.attnum>0 ORDER BY c.relname,a.attnum`),
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
 await runCases();
 console.log('PROGRAM_HISTORY_REVIEW_OK: '+passed+' cases; new inserts and parent plan mutation authority remain OPEN');
}catch(e){console.error('PROGRAM_HISTORY_REVIEW_FAILED:',e.message,e.detail??'');process.exitCode=1;}
finally{await db.close?.();await db.end?.();}

async function runCases(){
 const update={program_versions:"version=99",program_adaptations:"summary='{}'",program_explainability:"decision_ref='synthetic:changed'",program_guard_events:"risk_level='safe'"};
 const insert=(t,id=PA)=>{
  if(t==='program_versions')return `INSERT INTO public.${t}(program_id,program_type,version,snapshot) VALUES('${id}','nutrition',3,'{}')`;
  if(t==='program_adaptations')return `INSERT INTO public.${t}(program_id,program_type,from_version,to_version,trigger) VALUES('${id}','nutrition',2,3,'synthetic-new')`;
  if(t==='program_guard_events')return `INSERT INTO public.${t}(program_id,program_type,risk_level) VALUES('${id}','nutrition','caution')`;
  return `INSERT INTO public.${t}(program_id,program_type,version,decision_ref) VALUES('${id}','nutrition',3,'synthetic:new')`;
 };
 await test('legacy grants permit own past-row rewrite/deletion and cross-account TRUNCATE',async()=>{
  for(const t of tables){await client('authenticated',A,`UPDATE public.${t} SET ${update[t]} WHERE id='${PA}'`);await client('authenticated',A,`DELETE FROM public.${t} WHERE id='${PA}'`);}
  await client('anon',null,'TRUNCATE public.program_versions');assert.equal((await rows('SELECT count(*)::int AS n FROM public.program_versions'))[0].n,0);
 });
 const before=await snapshot();await exec(review);assert.deepEqual(await snapshot(),before);console.log('PASS review ROLLBACK restores exact row content and ACL');passed++;
 await test('inherited column UPDATE/REFERENCES stop safely without changing memberships',async()=>{
  for(const privilege of ['UPDATE(version)','REFERENCES(id)']){
   await exec('SAVEPOINT inherited;GRANT '+privilege+' ON public.program_versions TO leaked_reader;');
   const state=await snapshot();await exec('SAVEPOINT candidate;');await assert.rejects(()=>exec(body),/role\/owner review/);await exec('ROLLBACK TO candidate;RELEASE candidate;');assert.deepEqual(await snapshot(),state);await exec('ROLLBACK TO inherited;RELEASE inherited;');
  }
 });
 await test('service capability inherited only through PUBLIC causes rollback rather than an unsolicited grant',async()=>{
  await exec('REVOKE DELETE ON public.program_versions FROM service_role;SAVEPOINT candidate;');const state=await snapshot();
  await assert.rejects(()=>exec(body),/compatibility would change/);await exec('ROLLBACK TO candidate;RELEASE candidate;');assert.deepEqual(await snapshot(),state);
 });
 await exec(review.replace(/^ROLLBACK;$/m,'COMMIT;'));await exec(finalSQL());await exec(await readFinalSQL());
 assert.deepEqual((await snapshot()).data,before.data);console.log('PASS committed permission-only change preserves all synthetic history, parent, session and diary content');passed++;
 await test('client UPDATE DELETE TRUNCATE and effective maintenance/trigger/reference grants are removed',async()=>{
  for(const role of ['anon','authenticated'])for(const t of tables){
   await denied(()=>client(role,A,`UPDATE public.${t} SET ${update[t]} WHERE id='${PA}'`));
   await denied(()=>client(role,A,`DELETE FROM public.${t} WHERE id='${PA}'`));
   await denied(()=>client(role,A,`TRUNCATE public.${t}`));
  }
  await exec(finalSQL());
 });
 await test('own new history inserts and safe RETURNING id remain; protected raw SELECT stays denied',async()=>{
  for(const t of tables)assert.equal((await client('authenticated',A,insert(t)+' RETURNING id')).length,1);
  await denied(()=>client('authenticated',A,'SELECT knowledge_refs FROM public.program_explainability'));
 });
 await test('preserving INSERT does not grant a foreign program write',async()=>{for(const t of tables)await denied(()=>client('authenticated',B,insert(t,PA)));});
 await test('preserved INSERT cannot overwrite old history with ON CONFLICT DO UPDATE',async()=>{
  const q=`INSERT INTO public.program_versions(id,program_id,program_type,version,snapshot) VALUES('${PA}','${PA}','nutrition',99,'{}') ON CONFLICT(id) DO UPDATE SET version=excluded.version`;
  await denied(()=>client('authenticated',A,q));
 });
 await test('ordinary own session/status paths and existing trusted service DML remain available',async()=>{
  await client('authenticated',A,`UPDATE public.program_sessions SET status='completed' WHERE program_id='${PA}'`);
  await client('authenticated',A,`UPDATE public.nutrition_programs SET status='paused' WHERE id='${PA}'`);
  await client('service_role',B,`UPDATE public.program_versions SET version=7 WHERE id='${PA}'`);
  assert.equal((await rows(`SELECT version FROM public.program_versions WHERE id='${PA}'`))[0].version,7);
 });
 await test('reapply is idempotent and never restores broad client privileges',async()=>{
  const state=await snapshot();await exec(body);await exec(finalSQL());assert.deepEqual(await snapshot(),state);
 });
 await test('OPEN: new-row forgery and parent version changes are not trusted atomic adaptation',async()=>{
  await client('authenticated',A,`UPDATE public.nutrition_programs SET program_version=42 WHERE id='${PA}'`);
  await client('authenticated',A,insert('program_adaptations'));
 });
}
