import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {createHash} from 'node:crypto';
import {pathToFileURL} from 'node:url';
import {seedSQL,finalSQL,PA,PB} from './fixture.mjs';
import {catalogFixture,A,B} from '../authority-profile/fixture.mjs';

const embedded=process.env.SQL_TEST_PGLITE_MODULE;let db;
if(embedded){const {PGlite}=await import(pathToFileURL(embedded));db=new PGlite();await db.exec('CREATE ROLE test_admin SUPERUSER;SET SESSION AUTHORIZATION test_admin;ALTER ROLE postgres RENAME TO embedded_bootstrap;');}
else{const u=new URL(process.env.TEST_DATABASE_URL??'');assert.equal(u.hostname,'127.0.0.1');assert.equal(u.pathname,'/potok_program_reads_test');const {default:pg}=await import(pathToFileURL(process.env.SQL_TEST_PG_MODULE));db=new pg.Client({connectionString:u.href});await db.connect();}
const exec=s=>embedded?db.exec(s):db.query(s),rows=async s=>(await db.query(s)).rows;
const review=await readFile('scripts/security/program-reads/review.sql','utf8');
assert.equal((review.match(/^BEGIN;$/gm)??[]).length,1);assert.equal((review.match(/^ROLLBACK;$/gm)??[]).length,1);assert.doesNotMatch(review,/^COMMIT;$/m);
const body=review.replace(/^BEGIN;$/m,'').replace(/^ROLLBACK;$/m,'');
let profile;
if(process.env.AUTHORITY_PROFILE_INPUT)profile=await readFile(process.env.AUTHORITY_PROFILE_INPUT,'utf8');
else{const r=await fetch('https://raw.githubusercontent.com/Tatianos7/POTOK/7f4f7e24fec497a22dea29dd14f4546115439129/supabase/migration_drafts/profile_column_write_containment_v1.sql',{redirect:'error',signal:AbortSignal.timeout(30000)});assert(r.ok);profile=await r.text();}
assert.equal(createHash('sha256').update(profile).digest('hex'),'b781e7754732d12359cfff990ca855f75115695c283b08f9f221f785f5d529ea');
const grant=cap=>`SELECT potok_control.grant_entitlement_v2('${B}','${cap}',now()+interval '1 day','synthetic-server-evidence','synthetic-server-test')`;
const revoke=()=>`SELECT potok_control.revoke_entitlement_v2('${B}','premium','synthetic-server-revoke','synthetic-server-test')`;
const pay=(feature,user='NULL')=>`SELECT public.get_paywall_state(${feature},${user}) AS result`;
async function client(role,user,q,extra={}){
 await exec(`SAVEPOINT client_call;SET LOCAL ROLE ${role};SELECT set_config('request.jwt.claims','${JSON.stringify({role,sub:user,...extra})}',true);`);
 try{const r=await rows(q);await exec('SET LOCAL ROLE postgres;RELEASE client_call;');return r;}
 catch(e){await exec('ROLLBACK TO client_call;RELEASE client_call;');throw e;}
}
const denied=fn=>assert.rejects(fn,e=>e.code==='42501');
const locked=async(feature,user=B)=>(await client('authenticated',user,pay("'"+feature+"'")))[0].result.locked;
const snapshot=async()=>rows(`SELECT jsonb_build_object(
 'rows',(SELECT jsonb_agg(to_jsonb(e) ORDER BY id) FROM public.program_explainability e),
 'profile',(SELECT jsonb_agg(to_jsonb(e) ORDER BY id_user) FROM public.user_profiles e),
 'functions',(SELECT jsonb_agg(to_jsonb(p) ORDER BY p.oid) FROM pg_proc p WHERE p.pronamespace='public'::regnamespace),
 'acl',(SELECT relacl::text FROM pg_class WHERE oid='public.program_explainability'::regclass),
 'columns',(SELECT jsonb_agg(to_jsonb(a) ORDER BY attnum) FROM pg_attribute a WHERE attrelid='public.program_explainability'::regclass),
 'policies',(SELECT jsonb_agg(to_jsonb(p) ORDER BY oid) FROM pg_policy p WHERE polrelid='public.program_explainability'::regclass),
 'namespace',to_regnamespace('potok_delivery') IS NOT NULL) AS state`);
let passed=0;async function test(name,fn){await exec('BEGIN;');try{await fn();await exec('ROLLBACK;');passed++;console.log('PASS '+name);}catch(e){await exec('ROLLBACK;');throw e;}}
const program='aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';
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
 await exec(await seedSQL(A,B));
 await runCases();
 console.log('PROGRAM_READ_REVIEW_OK: '+passed+' cases; plan mutations remain OPEN');
}catch(e){console.error('PROGRAM_READ_REVIEW_FAILED:',e.message,e.detail??'');process.exitCode=1;}
finally{await db.close?.();await db.end?.();}

async function runCases(){
 const explain=(id=PA)=>`SELECT * FROM public.get_program_explainability('${id}',NULL)`;
 const details=(id=PA)=>`SELECT public.get_program_day_details('${id}','2026-10-26') AS d`;
 const days=(id=PA)=>`SELECT * FROM public.get_program_days('${id}')`;
 function masked(row){assert.equal(row.knowledge_refs,null);assert.equal(row.confidence,null);assert.deepEqual(row.guard_notes,{reason_code:'synthetic_reason'});}
 await test('legacy direct and nested RPCs return full own explanations without verified Premium',async()=>{
  assert.equal((await client('authenticated',A,explain()))[0].guard_notes.details,'synthetic full a');
  assert.equal((await client('authenticated',A,details()))[0].d.explainability[0].guard_notes.details,'synthetic full a');
 });
 const before=await snapshot();await exec(review);assert.deepEqual(await snapshot(),before);console.log('PASS complete review ROLLBACK restores metadata, grants, data and namespace');passed++;
 await test('source/path and inherited protected-column grants fail with no partial installation',async()=>{
  for(const drift of ["ALTER FUNCTION public.get_program_days(uuid) SET search_path=public;",'GRANT SELECT(guard_notes) ON public.program_explainability TO leaked_reader;']){
   await exec('SAVEPOINT drift;'+drift);await assert.rejects(()=>exec(body),/source contract|privilege boundary/);await exec('ROLLBACK TO drift;RELEASE drift;');
   assert.equal((await rows("SELECT to_regnamespace('potok_delivery') IS NULL AS absent"))[0].absent,true);
  }
 });
 await exec(review.replace(/^ROLLBACK;$/m,'COMMIT;'));await exec(await finalSQL());
 assert.deepEqual((await snapshot())[0].state.rows,before[0].state.rows);assert.deepEqual((await snapshot())[0].state.profile,before[0].state.profile);
 assert.equal((await rows('SELECT count(*)::int AS n FROM potok_control.access_attestations'))[0].n,0);
 console.log('PASS committed projection preserves original data and installs no authority');passed++;
 await test('Free gets server-redacted RPC/day data and safe reason summary while direct protected columns deny',async()=>{
  masked((await client('authenticated',A,explain()))[0]);
  const d=(await client('authenticated',A,details()))[0].d;masked(d.explainability[0]);assert.equal(d.day.targets.calories,123);assert.equal(d.session.status,'planned');
  const day=(await client('authenticated',A,days()))[0];assert.deepEqual(day.explainability_summary,{decision_ref:'synthetic:decision:a',reason_code:'synthetic_reason'});
  assert.equal((await client('authenticated',A,'SELECT decision_ref FROM public.program_explainability')).length,1);
  for(const col of ['*','knowledge_refs','confidence','guard_notes'])await denied(()=>client('authenticated',A,'SELECT '+col+' FROM public.program_explainability'));
 });
 await test('verified exact explainability flag unlocks only own full data; same-claims revoke redacts again',async()=>{
  await rows(grant('premium'));
  assert.equal((await client('authenticated',B,explain(PB)))[0].guard_notes.details,'synthetic full b');
  assert.equal((await client('authenticated',B,details(PB)))[0].d.explainability[0].knowledge_refs.evidence,'synthetic full b');
  assert.equal((await client('authenticated',B,explain(PA))).length,0);
  await denied(()=>client('authenticated',B,'SELECT knowledge_refs FROM public.program_explainability'));
  await rows(revoke());masked((await client('authenticated',B,explain(PB)))[0]);
 });
 await test('foreign IDs stay empty even with broad permissive policies; explicit owner projection does not depend on owner RLS',async()=>{
  await exec('CREATE POLICY synthetic_broad_read ON public.program_explainability FOR SELECT TO authenticated USING(true);CREATE POLICY synthetic_parent_read ON public.nutrition_programs FOR SELECT TO authenticated USING(true);');
  assert.equal((await client('authenticated',B,explain(PA))).length,0);assert.equal((await client('authenticated',B,days(PA))).length,0);
  const d=(await client('authenticated',B,details(PA)))[0].d;assert.equal(d.day,null);assert.equal(d.session,null);assert.equal(d.explainability,null);
  assert.equal((await client('authenticated',B,`SELECT decision_ref FROM public.program_explainability WHERE program_id='${PA}'`)).length,0);
 });
 await test('ambiguous program UUID across types and mismatched polymorphic rows never mix accounts or types',async()=>{
  await exec(`INSERT INTO public.program_explainability(program_id,program_type,version,decision_ref,guard_notes) VALUES('${PA}','training',1,'synthetic:wrong-type','{"details":"must not appear"}');`);
  assert.equal((await client('authenticated',A,explain(PA))).length,1);
  assert.equal((await client('authenticated',A,`SELECT decision_ref FROM public.program_explainability WHERE program_id='${PA}'`)).length,1);
  await exec(`INSERT INTO public.training_programs(id,user_id) VALUES('${PA}','${B}');`);
  for(const user of [A,B]){
   assert.equal((await client('authenticated',user,explain(PA))).length,0);assert.equal((await client('authenticated',user,days(PA))).length,0);
   const d=(await client('authenticated',user,details(PA)))[0].d;assert.equal(d.day,null);assert.equal(d.session,null);assert.equal(d.explainability,null);
  }
 });
 await test('anon/service endpoints and missing identity deny; user metadata and admin do not grant full explanations',async()=>{
  for(const role of ['anon','service_role'])for(const q of [explain(),days(),details(),`SELECT * FROM potok_delivery.read_program_explainability_v1('${PA}',NULL)`])await denied(()=>client(role,A,q));
  await denied(()=>client('authenticated',null,explain()));
  await denied(()=>client('authenticated',A,explain(),{role:null}));
  masked((await client('authenticated',A,explain(),{user_metadata:{has_premium:true,is_admin:true}}))[0]);
  await rows(grant('admin'));masked((await client('authenticated',B,explain(PB)))[0]);
 });
 await test('string flag and malformed reason object cannot reveal full or nested explanation content',async()=>{
  await rows(grant('premium'));await exec(`UPDATE public.entitlements SET flags='{"can_explain":"true"}' WHERE user_id='${B}';UPDATE public.program_explainability SET guard_notes='{"reason_code":{"nested":"synthetic secret"},"details":"synthetic secret"}' WHERE id='${PB}';`);
  const e=(await client('authenticated',B,explain(PB)))[0];assert.equal(e.guard_notes,null);assert.equal(e.knowledge_refs,null);assert.equal(e.confidence,null);
 });
 await test('existing Free artifact inserts without protected RETURNING still work; plan mutations remain OPEN',async()=>{
  await client('authenticated',A,`INSERT INTO public.program_explainability(program_id,program_type,version,decision_ref,knowledge_refs) VALUES('${PA}','nutrition',2,'synthetic:new','{"not_visible_in_free":true}')`);
  await client('authenticated',A,`UPDATE public.nutrition_programs SET program_version=2 WHERE id='${PA}'`);
  await client('authenticated',A,`INSERT INTO public.program_adaptations(program_id,program_type,from_version,to_version,trigger) VALUES('${PA}','nutrition',1,2,'synthetic-direct-write')`);
  assert.equal((await client('authenticated',A,details()))[0].d.explainability[0].knowledge_refs,null);
 });
 await test('one-time replay fails without changing the committed projection',async()=>{
  const state=await snapshot();await exec('SAVEPOINT repeat;');await assert.rejects(()=>exec(body),/fresh delivery namespace/);await exec('ROLLBACK TO repeat;RELEASE repeat;');assert.deepEqual(await snapshot(),state);
 });
}
