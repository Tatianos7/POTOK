import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {pathToFileURL} from 'node:url';
import {legacySchema,A,B} from '../catalog-authority/fixture.mjs';
import {captureSQL,buildRehearsal as buildRightsRehearsal} from '../backup-readiness/rights-rehearsal.mjs';
import {combineStrictTwelve} from '../backup-readiness/strict-twelve.mjs';
import {candidateCaptureSQL,buildCandidatePlans} from '../backup-readiness/candidate-rights.mjs';
import {loadInputs,body} from './inputs.mjs';
import {buildTwelve,loadFollowups} from './restored-twelve.mjs';
import {buildInstall,finalSQL,fingerprintSQL,boundaryQuery,settingsSQL,validateTarget,candidateName,originalName} from './private-candidate.mjs';
import {seedSQL as seedPrograms} from '../program-reads/fixture.mjs';
import {seedSQL as seedHistory} from '../program-history/fixture.mjs';

const embedded=process.env.SQL_TEST_PGLITE_MODULE;let db;
if(embedded){const {PGlite}=await import(pathToFileURL(embedded));const {pg_trgm}=await import(pathToFileURL(process.env.SQL_TEST_TRGM_MODULE));db=new PGlite({extensions:{pg_trgm}});}
else{const url=new URL(process.env.TEST_DATABASE_URL??'');assert.equal(url.hostname,'127.0.0.1');assert.equal(url.pathname,'/potok_restored_twelve_test');const {default:pg}=await import(pathToFileURL(process.env.SQL_TEST_PG_MODULE));db=new pg.Client({connectionString:url.href});await db.connect();}
const exec=sql=>embedded?db.exec(sql):db.query(sql),rows=async sql=>(await db.query(sql)).rows;
const sources=await loadInputs();const followups=await loadFollowups();
const profile=`CREATE TABLE public.user_profiles(id_user uuid PRIMARY KEY,first_name text,last_name text,middle_name text,birth_date date,age integer,height numeric(5,2),goal text,email text,phone text,avatar_url text,has_premium boolean NOT NULL DEFAULT false,is_admin boolean NOT NULL DEFAULT false,created_at timestamptz NOT NULL DEFAULT now(),updated_at timestamptz NOT NULL DEFAULT now(),coach_settings jsonb NOT NULL DEFAULT '{}',voice_settings jsonb NOT NULL DEFAULT '{}');
 INSERT INTO public.user_profiles(id_user,is_admin) VALUES('${A}',true),('${B}',false);
 ALTER TABLE public.user_profiles ENABLE ROW LEVEL SECURITY;
 CREATE POLICY owner_read ON public.user_profiles FOR SELECT TO authenticated USING(auth.uid()=id_user);
 CREATE POLICY owner_insert ON public.user_profiles FOR INSERT TO authenticated WITH CHECK(auth.uid()=id_user);
 CREATE POLICY owner_update ON public.user_profiles FOR UPDATE TO authenticated USING(auth.uid()=id_user) WITH CHECK(auth.uid()=id_user);`;
async function fixture(){
 await exec(`ROLLBACK;RESET ROLE;RESET search_path;DROP EXTENSION IF EXISTS pg_trgm CASCADE;DROP SCHEMA IF EXISTS public CASCADE;DROP SCHEMA IF EXISTS extensions CASCADE;DROP SCHEMA IF EXISTS auth CASCADE;DROP SCHEMA IF EXISTS storage CASCADE;DROP SCHEMA IF EXISTS potok_control CASCADE;DROP SCHEMA IF EXISTS potok_nutrition CASCADE;DROP SCHEMA IF EXISTS potok_delivery CASCADE;
 CREATE SCHEMA public AUTHORIZATION postgres;CREATE SCHEMA extensions AUTHORIZATION postgres;CREATE SCHEMA auth;CREATE SCHEMA storage AUTHORIZATION postgres;
 REVOKE CREATE ON SCHEMA public,extensions FROM PUBLIC;GRANT USAGE ON SCHEMA public,extensions,auth TO postgres,anon,authenticated,service_role;
 CREATE FUNCTION auth.jwt() RETURNS jsonb LANGUAGE sql STABLE AS $$ SELECT coalesce(nullif(current_setting('request.jwt.claims',true),''),'{}')::jsonb $$;
 CREATE FUNCTION auth.uid() RETURNS uuid LANGUAGE sql STABLE AS $$ SELECT (auth.jwt()->>'sub')::uuid $$;
 CREATE TABLE auth.users(id uuid PRIMARY KEY);INSERT INTO auth.users VALUES('${A}'),('${B}');GRANT SELECT,REFERENCES ON auth.users TO postgres;
 CREATE TABLE storage.buckets(id text PRIMARY KEY,name text,public boolean);ALTER TABLE storage.buckets OWNER TO postgres;
 CREATE TABLE storage.objects(id uuid PRIMARY KEY,bucket_id text,name text);ALTER TABLE storage.objects OWNER TO postgres;
 ALTER DEFAULT PRIVILEGES FOR ROLE postgres IN SCHEMA public REVOKE ALL ON TABLES FROM PUBLIC,anon,authenticated,service_role;`);
 // Bootstrap-only extension ownership setup. Candidate/application actor is NOSUPERUSER.
 for(const sql of ['ALTER ROLE postgres SUPERUSER','SET ROLE postgres','CREATE EXTENSION pg_trgm WITH SCHEMA public','RESET ROLE','ALTER ROLE postgres NOSUPERUSER','SET ROLE postgres'])await exec(sql);
 let catalog=await legacySchema();
 const start=catalog.indexOf('CREATE TABLE public.user_profiles('),end=catalog.indexOf('CREATE TABLE public.foods(');assert(start>=0&&end>start);
 catalog=catalog.slice(0,start)+profile+'\n '+catalog.slice(end);
 await exec(catalog);
 await exec(await readFile('supabase/phase7_3_2_monetization.sql','utf8'));
 await exec(`CREATE FUNCTION public.rls_auto_enable() RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog AS $$ BEGIN NULL; END $$;
 GRANT ALL ON ALL TABLES IN SCHEMA public TO PUBLIC,anon,authenticated,service_role;
 GRANT EXECUTE ON ALL FUNCTIONS IN SCHEMA public TO authenticated,service_role;
 ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT TRUNCATE ON TABLES TO anon,authenticated;
 CREATE INDEX fixture_food_trgm ON public.foods USING gin(name public.gin_trgm_ops);
 INSERT INTO public.entitlements(user_id,tier,flags) VALUES('${A}','free','{"can_adapt":false}'),('${B}','pro','{"can_adapt":true}');
 INSERT INTO public.subscriptions(user_id,plan,status) VALUES('${A}','free','active'),('${B}','pro','active');
 INSERT INTO public.billing_events(user_id,provider,event_type,idempotency_key) VALUES('${A}','play_store','fixture','seed-a');`);
 // Fixture-only: explicitly place the trusted crypto dependency outside public before
 // the old photo SQL's IF NOT EXISTS check; do not change any pinned candidate.
 if(!embedded)await exec('CREATE EXTENSION IF NOT EXISTS pgcrypto WITH SCHEMA extensions;');
 // Photo tables are created after the deliberately broad historical fixture grants.
 for(const name of ['20260224_measurements_photo_assets.sql','20260225_measurement_photo_deletions.sql']){
  const sql=await readFile('supabase/migrations/'+name,'utf8');await exec(embedded?sql.replace(/^create extension if not exists pgcrypto;\s*/i,''):sql);
 }
 await exec('RESET ROLE;ALTER DEFAULT PRIVILEGES FOR ROLE supabase_admin IN SCHEMA public GRANT TRUNCATE ON TABLES TO anon,authenticated;');
}
async function snapshot(){
 const metadata=await rows(`SELECT jsonb_build_object(
 'relations',(SELECT jsonb_agg(to_jsonb(c) ORDER BY c.oid) FROM pg_class c JOIN pg_namespace n ON n.oid=c.relnamespace WHERE n.nspname IN('public','extensions','potok_control','potok_nutrition','potok_delivery')),
 'columns',(SELECT jsonb_agg(to_jsonb(a) ORDER BY a.attrelid,a.attnum) FROM pg_attribute a JOIN pg_class c ON c.oid=a.attrelid JOIN pg_namespace n ON n.oid=c.relnamespace WHERE n.nspname IN('public','extensions','potok_control','potok_nutrition','potok_delivery')),
 'routines',(SELECT jsonb_agg(to_jsonb(p) ORDER BY p.oid) FROM pg_proc p JOIN pg_namespace n ON n.oid=p.pronamespace WHERE n.nspname IN('public','extensions','potok_control','potok_nutrition','potok_delivery')),
 'policies',(SELECT jsonb_agg(to_jsonb(p) ORDER BY p.oid) FROM pg_policy p),
 'defaults',(SELECT jsonb_agg(to_jsonb(d) ORDER BY d.oid) FROM pg_default_acl d),
 'constraints',(SELECT jsonb_agg(to_jsonb(c) ORDER BY c.oid) FROM pg_constraint c WHERE c.connamespace='public'::regnamespace),
 'extension',(SELECT to_jsonb(e) FROM pg_extension e WHERE extname='pg_trgm'),
 'schemas',(SELECT jsonb_agg(to_jsonb(n) ORDER BY oid) FROM pg_namespace n WHERE nspname IN('public','extensions','potok_control','potok_nutrition','potok_delivery')),
 'roles',(SELECT jsonb_agg(to_jsonb(r) ORDER BY oid) FROM pg_roles r)) AS metadata`);
 const tables=await rows("SELECT n.nspname AS schema,c.relname AS name FROM pg_class c JOIN pg_namespace n ON n.oid=c.relnamespace WHERE n.nspname IN('public','potok_control','storage') AND c.relkind IN('r','p') ORDER BY 1,2");
 const data=[];for(const t of tables){const quote=s=>'"'+s.replace(/"/g,'""')+'"';data.push({table:t.schema+'.'+t.name,rows:await rows('SELECT to_jsonb(t) AS row FROM '+quote(t.schema)+'.'+quote(t.name)+' t ORDER BY to_jsonb(t)::text')});}
 return {metadata,data};
}
let passed=0;
async function setup(){
 await fixture();await exec('SET ROLE postgres;SET search_path=public,pg_temp;');await exec(await seedPrograms(A,B));await exec(seedHistory());
 await exec(`UPDATE public.program_sessions SET plan_payload='{"preserved":"synthetic"}';RESET ROLE;`);
}
async function script(){
 const tables=await rows("SELECT n.nspname AS schema,c.relname AS name FROM pg_class c JOIN pg_namespace n ON n.oid=c.relnamespace WHERE n.nspname IN('auth','public','storage') AND c.relkind='r' ORDER BY 1,2");
 for(const t of tables)t.rows=Number((await rows('SELECT count(*) AS n FROM "'+t.schema+'"."'+t.name+'"'))[0].n);
 return buildTwelve(sources,followups,tables);
}
async function protocol(sql,{error}={}){
 const [prefix,rest]=sql.split(/^BEGIN;\n/m),[transaction,suffix]=rest.split(/^ROLLBACK;\n/m);assert(prefix&&transaction&&suffix);
 await exec('SET SESSION AUTHORIZATION postgres;');try{
  await exec(prefix);
  if(error){await assert.rejects(()=>exec('BEGIN;\n'+transaction+'ROLLBACK;'),error);await exec('ROLLBACK;DROP TABLE potok_eight_data,potok_eight_state;');}
  else{await exec('BEGIN;\n'+transaction+'ROLLBACK;');await exec(suffix);}
 }finally{await exec('ROLLBACK;SET SESSION AUTHORIZATION test_admin;');}
}
async function test(name,fn){await setup();await fn();passed++;console.log('PASS '+name);}
try{
 if(embedded)await exec('CREATE ROLE test_admin SUPERUSER;SET SESSION AUTHORIZATION test_admin;ALTER ROLE postgres RENAME TO embedded_bootstrap;CREATE ROLE postgres NOSUPERUSER BYPASSRLS;');
 else await exec('CREATE ROLE postgres NOSUPERUSER BYPASSRLS;ALTER DATABASE potok_restored_twelve_test OWNER TO postgres;');
 await exec('CREATE ROLE anon;CREATE ROLE authenticated;CREATE ROLE service_role BYPASSRLS;CREATE ROLE supabase_admin;');
 const database=(await rows('SELECT current_database() AS name'))[0].name;assert(/^[a-z_][a-z0-9_]*$/.test(database));await exec('ALTER DATABASE '+database+' OWNER TO postgres;');
 await test('all twelve pinned candidates stream one transaction and fully restore metadata/content',async()=>{
  const before=await snapshot();await protocol(await script());assert.deepEqual(await snapshot(),before);
 });
 if(!embedded)await test('strict permission rehearsal composes with all twelve real candidates and restores all fixture state',async()=>{
  await exec('SET ROLE postgres;');
  const initial=await rows("SELECT c.relname FROM pg_class c WHERE c.relnamespace='public'::regnamespace AND c.relkind='r' ORDER BY c.relname");
  for(let i=initial.length;i<81;i++)await exec('CREATE TABLE public.parity_pad_'+i+'(id integer);');
  const publicTables=await rows("SELECT c.relname FROM pg_class c WHERE c.relnamespace='public'::regnamespace AND c.relkind='r' ORDER BY c.relname");
  assert.equal(publicTables.length,81);
  for(const t of publicTables)await exec('ALTER TABLE public."'+t.relname+'" ENABLE ROW LEVEL SECURITY;');
  await exec('REVOKE ALL ON ALL TABLES IN SCHEMA public FROM PUBLIC;GRANT ALL ON ALL TABLES IN SCHEMA public TO anon,authenticated,service_role;REVOKE TRUNCATE ON ALL TABLES IN SCHEMA public FROM anon,authenticated;');
  async function capture(){const results=await exec(captureSQL);return results.find(r=>r.rows?.[0]?.evidence).rows[0].evidence;}
  const first=await capture(),changes=first.rights.filter(r=>r.table_name.startsWith('parity_pad_')&&r.role!=='service_role'&&r.privilege!=='TRUNCATE').slice(0,213);assert.equal(changes.length,213);
  for(const r of changes)await exec('REVOKE '+r.privilege+' ON public."'+r.table_name+'" FROM "'+r.role+'"');
  const target=await capture();
  for(const r of changes)await exec('GRANT '+r.privilege+' ON public."'+r.table_name+'" TO "'+r.role+'"');
  const local=await capture(),parity=buildRightsRehearsal(local,target,publicTables.map(t=>t.relname));
  await exec('RESET ROLE;');const before=await snapshot();
  const sql=combineStrictTwelve(parity.sql,await script());await protocol(sql);assert.deepEqual(await snapshot(),before);
  console.log('STRICT_TWELVE_NATIVE_OK: temporary exact parity precedes all twelve pinned candidates; fixture metadata/content/ACL restored; not owner or application acceptance');
 });
 if(!embedded&&process.env.CANDIDATE_ACL_NATIVE==='1')await test('candidate ACL repair preserves real twelve contracts/content and verifies committed rights independently',async()=>{
  await exec('SET ROLE postgres;');
  const initial=await rows("SELECT relname FROM pg_class WHERE relnamespace='public'::regnamespace AND relkind='r' ORDER BY relname");
  for(let i=initial.length;i<81;i++)await exec('CREATE TABLE public.parity_pad_'+i+'(id integer);');
  const publicTables=await rows("SELECT relname FROM pg_class WHERE relnamespace='public'::regnamespace AND relkind='r' ORDER BY relname");assert.equal(publicTables.length,81);
  for(const t of publicTables)await exec('ALTER TABLE public."'+t.relname+'" ENABLE ROW LEVEL SECURITY;');
  await exec('REVOKE ALL ON ALL TABLES IN SCHEMA public FROM PUBLIC;GRANT ALL ON ALL TABLES IN SCHEMA public TO anon,authenticated,service_role;');
  await exec('RESET ROLE;');
  const current=await rows("SELECT n.nspname AS schema,c.relname AS name FROM pg_class c JOIN pg_namespace n ON n.oid=c.relnamespace WHERE n.nspname IN('auth','public','storage') AND c.relkind='r'");
  for(let i=current.length;i<112;i++)await exec('CREATE TABLE auth.parity_auth_'+i+'(id integer);GRANT SELECT ON auth.parity_auth_'+i+' TO postgres;');
  const tables=await rows("SELECT n.nspname AS schema,c.relname AS name FROM pg_class c JOIN pg_namespace n ON n.oid=c.relnamespace WHERE n.nspname IN('auth','public','storage') AND c.relkind='r' ORDER BY 1,2");assert.equal(tables.length,112);
  await exec('SET SESSION AUTHORIZATION postgres;');
  for(const t of tables)t.rows=Number((await rows('SELECT count(*) AS n FROM "'+t.schema+'"."'+t.name+'"'))[0].n);
  const [f]=await rows(fingerprintSQL(tables));const boundary=boundaryQuery(await readFile('scripts/security/platform-defaults/check.sql','utf8')).trim().replace(/;$/,'');
  await exec(buildInstall(sources,followups,tables,f.fingerprint,boundary));
  const capture=async client=>{const result=await client.query(candidateCaptureSQL(tables));return result.find(r=>r.rows?.[0]?.evidence).rows[0].evidence;};
  let captured=await capture(db);
  const selected=captured.rights.filter(r=>r.table_name.startsWith('parity_pad_')&&r.role==='anon'&&r.privilege!=='TRUNCATE').slice(0,211);assert.equal(selected.length,211);
  const remaining=selected.map(r=>({table:r.table_name,role:r.role,privilege:r.privilege,direction:'extra_on_restored',directOwnerGrant:true}));
  const original=[...remaining,...['INSERT','UPDATE'].map(privilege=>({table:'user_profiles',role:'anon',privilege,direction:'extra_on_restored'}))];
  // An explicit grant on the affected column for another role must survive table revocation.
  await exec('GRANT UPDATE(id) ON public."'+remaining[0].table+'" TO authenticated;');
  captured=await capture(db);
  const plans=buildCandidatePlans(captured,original,remaining,{names:publicTables.map(t=>t.relname),tables});
  const runPlan=async sql=>{const at=sql.indexOf('\nBEGIN;\n');assert(at>0);await exec(sql.slice(0,at));return exec(sql.slice(at+1));};
  const before=await snapshot();await runPlan(plans.rollback);assert.deepEqual(await snapshot(),before);
  // Simulate a late failure before COMMIT: all REVOKEs must roll back.
  const at=plans.commit.indexOf('COMMIT;');assert(at>0);
  await assert.rejects(()=>runPlan(plans.commit.slice(0,at)+'SELECT 1/0;'+plans.commit.slice(at)),e=>e.code==='22012');await exec('ROLLBACK;');assert.deepEqual(await snapshot(),before);
  await runPlan(plans.commit);
  const {default:pg}=await import(pathToFileURL(process.env.SQL_TEST_PG_MODULE));const independent=new pg.Client({connectionString:process.env.TEST_DATABASE_URL});await independent.connect();
  try{await independent.query('SET SESSION AUTHORIZATION postgres');const checked=await independent.query(plans.verify);assert(checked.some(r=>r.rows?.[0]?.result==='CANDIDATE_ACL_COMMITTED_VERIFIED_OK'));}finally{await independent.end();}
  const after=await capture(db);assert.equal(after.columnAclSha256,captured.columnAclSha256);assert.equal(after.shapeSha256,captured.shapeSha256);assert.deepEqual(after.content,captured.content);
  for(const item of remaining)assert.equal(after.rights.find(r=>r.table_name===item.table&&r.role===item.role&&r.privilege===item.privilege).allowed,false);
  console.log('CANDIDATE_ACL_NATIVE_OK: 211 exact revokes; real twelve contracts/content/column grants preserved; late error rollback; independent committed verification. Synthetic only, no owner/API acceptance.');
  await exec('SET SESSION AUTHORIZATION test_admin;');
 });
 await test('twelve candidates meet the narrow application SQL boundary with platform defaults retained',async()=>{
  const before=await snapshot();const sql=await script();const [prefix,rest]=sql.split(/^BEGIN;\n/m),[transaction,suffix]=rest.split(/^ROLLBACK;\n/m);
  const check=(await readFile('scripts/security/platform-defaults/check.sql','utf8')).replace(/^BEGIN READ ONLY;$/m,'').replace(/^ROLLBACK;$/m,'');
  await exec('SET SESSION AUTHORIZATION postgres;');try{
   await exec(prefix);await exec('BEGIN;\n'+transaction);const [r]=await rows(check);assert.equal(r.verdict,'SQL_BOUNDARY_VERIFIED');assert.equal(r.platform_public_truncate_defaults,2);await exec('ROLLBACK;');await exec(suffix);
  }finally{await exec('ROLLBACK;SET SESSION AUTHORIZATION test_admin;');}
  assert.deepEqual(await snapshot(),before);
 });
 await test('exact trailing day_date date values survive all twelve candidates and rollback',async()=>{
  await exec("SET ROLE postgres;ALTER TABLE public.program_sessions ADD COLUMN day_date date;UPDATE public.program_sessions SET day_date='2026-10-25';RESET ROLE;");
  const before=await snapshot();await protocol(await script());assert.deepEqual(await snapshot(),before);
 });
 await test('generated trailing day_date date also remains unchanged through the twelve-candidate rollback',async()=>{
  await exec('SET ROLE postgres;ALTER TABLE public.program_sessions ADD COLUMN day_date date GENERATED ALWAYS AS (date) STORED;RESET ROLE;');
  const before=await snapshot();await protocol(await script());assert.deepEqual(await snapshot(),before);
 });
 await test('day_date remains inside original-column content hashes and tampering is detected',async()=>{
  await exec("SET ROLE postgres;ALTER TABLE public.program_sessions ADD COLUMN day_date date;UPDATE public.program_sessions SET day_date='2026-10-25';RESET ROLE;");
  const before=await snapshot();const sql=(await script()).replace('DO $annotation$',"UPDATE public.program_sessions SET day_date='2026-10-24';\nDO $annotation$");
  await protocol(sql,{error:/Restored content mismatch/});assert.deepEqual(await snapshot(),before);
 });
 await test('same-count legacy session payload tamper is detected despite the nullable annotation addition',async()=>{
  const before=await snapshot();const sql=(await script()).replace('DO $annotation$',`UPDATE public.program_sessions SET plan_payload='{"tampered":true}';\nDO $annotation$`);
  await protocol(sql,{error:/Restored content mismatch/});assert.deepEqual(await snapshot(),before);
 });
 await test('new annotation data cannot be hidden by the old-column hash projection',async()=>{
  const before=await snapshot();const sql=(await script()).replace('DO $annotation$',"UPDATE public.program_sessions SET execution_reason='fatigue';\nDO $annotation$");
  await protocol(sql,{error:/Unexpected annotation data/});assert.deepEqual(await snapshot(),before);
 });
 await test('late client plan write grant fails the final verifier and restores the whole baseline',async()=>{
  const before=await snapshot();const sql=(await script()).replace('DO $annotation$',"GRANT UPDATE(plan_payload) ON public.program_sessions TO authenticated;\nDO $annotation$");
  await protocol(sql,{error:/quarantine final permissions mismatch/});assert.deepEqual(await snapshot(),before);
 });
 await test('projection function drift fails final source checks even when data and ACL stay unchanged',async()=>{
  const before=await snapshot();const sql=(await script()).replace('DO $annotation$',"CREATE OR REPLACE FUNCTION potok_delivery.program_scope_v1(p_program_id uuid) RETURNS text LANGUAGE sql STABLE SECURITY DEFINER SET search_path='' AS 'SELECT NULL::text';\nDO $annotation$");
  await protocol(sql,{error:/Program read final source contract mismatch/});assert.deepEqual(await snapshot(),before);
 });
 await test('late quarantine preflight failure rolls back all earlier eleven candidates',async()=>{
  await exec('SET ROLE postgres;ALTER TABLE public.program_sessions ADD COLUMN unexpected_shape text;RESET ROLE;');
  const before=await snapshot();await protocol(await script(),{error:/session shape/});assert.deepEqual(await snapshot(),before);
 });
 await test('missing follow-up and malformed transaction wrappers are rejected before SQL',async()=>{
  const bad={...followups};delete bad.history;assert.throws(()=>buildTwelve(sources,bad,[{schema:'public',name:'user_profiles',rows:2}]));
  assert.throws(()=>body('BEGIN;\nROLLBACK;\nCOMMIT;','ROLLBACK'));
 });
 const boundary=boundaryQuery(await readFile('scripts/security/platform-defaults/check.sql','utf8')).trim().replace(/;$/,'');
 async function installInput(){
  const tables=await rows("SELECT n.nspname AS schema,c.relname AS name FROM pg_class c JOIN pg_namespace n ON n.oid=c.relnamespace WHERE n.nspname IN('auth','public','storage') AND c.relkind='r' ORDER BY 1,2");
  for(const t of tables)t.rows=Number((await rows('SELECT count(*) AS n FROM "'+t.schema+'"."'+t.name+'"'))[0].n);
  const fingerprint=(await rows(fingerprintSQL(tables)))[0].fingerprint;
  return {tables,fingerprint,sql:buildInstall(sources,followups,tables,fingerprint,boundary)};
 }
 await test('private clone installer commits twelve candidates and verifies persisted content and final rights',async()=>{
  await exec("SET ROLE postgres;ALTER TABLE public.program_sessions ADD COLUMN day_date date;UPDATE public.program_sessions SET day_date='2026-10-25';RESET ROLE;");
  const {tables,fingerprint,sql}=await installInput();
  await exec('SET SESSION AUTHORIZATION postgres;');await exec(sql);
  const verify=`${settingsSQL}BEGIN READ ONLY;${finalSQL(tables,fingerprint,boundary)}ROLLBACK;`;
  if(embedded)await exec(verify);
  else{
   const {default:pg}=await import(pathToFileURL(process.env.SQL_TEST_PG_MODULE));const committed=new pg.Client({connectionString:process.env.TEST_DATABASE_URL});await committed.connect();
   try{await committed.query('SET SESSION AUTHORIZATION postgres;');await committed.query(verify);}finally{await committed.end();}
  }
  assert.equal((await rows("SELECT count(*)::int AS n FROM public.program_sessions WHERE day_date='2026-10-25'"))[0].n,2);
  await exec('SET SESSION AUTHORIZATION test_admin;');const committed=await snapshot();
  await exec('SET SESSION AUTHORIZATION postgres;');await assert.rejects(()=>exec(sql),/not fresh/);await exec('ROLLBACK;SET SESSION AUTHORIZATION test_admin;');assert.deepEqual(await snapshot(),committed);
 });
 await test('private installation atomically rolls back on late content tamper',async()=>{
  const before=await snapshot(),{tables,fingerprint}=await installInput();
  const bad={...followups,quarantine:followups.quarantine+"\nUPDATE public.program_sessions SET plan_payload='{\"changed\":true}';"};
  await exec('SET SESSION AUTHORIZATION postgres;');await assert.rejects(()=>exec(buildInstall(sources,bad,tables,fingerprint,boundary)),/content changed/);
  await exec('ROLLBACK;SET SESSION AUTHORIZATION test_admin;');assert.deepEqual(await snapshot(),before);
 });
 await test('private installation rolls back when the final client privilege check fails',async()=>{
  const before=await snapshot(),{tables,fingerprint}=await installInput();
  const bad={...followups,quarantine:followups.quarantine+'\nGRANT UPDATE(plan_payload) ON public.program_sessions TO authenticated;'};
  await exec('SET SESSION AUTHORIZATION postgres;');await assert.rejects(()=>exec(buildInstall(sources,bad,tables,fingerprint,boundary)),/quarantine final permissions mismatch/);
  await exec('ROLLBACK;SET SESSION AUTHORIZATION test_admin;');assert.deepEqual(await snapshot(),before);
 });
 await test('private installation blocks a changed baseline before any candidate is committed',async()=>{
  const {sql}=await installInput();await exec("SET ROLE postgres;UPDATE public.program_sessions SET plan_payload='{\"changed_before_install\":true}';RESET ROLE;");const before=await snapshot();
  await exec('SET SESSION AUTHORIZATION postgres;');await assert.rejects(()=>exec(sql),/content changed/);
  await exec('ROLLBACK;SET SESSION AUTHORIZATION test_admin;');assert.deepEqual(await snapshot(),before);
 });
 await test('private target guards reject baseline, network, volume, image and privilege substitution',async()=>{
  const clone={Id:'a'.repeat(64),Name:'/'+candidateName,Image:'sha256:'+'c'.repeat(64),State:{Running:true,Health:{Status:'healthy'}},Config:{Image:'public.ecr.aws/supabase/postgres:17.6.1.063',User:'postgres',Entrypoint:['postgres']},HostConfig:{NetworkMode:'none',PortBindings:{},Privileged:false,PidMode:'',IpcMode:'private'},NetworkSettings:{Ports:{}},Mounts:[{Type:'volume',Name:candidateName,Destination:'/var/lib/postgresql/data',RW:true}]};
  const original=structuredClone(clone);original.Id='b'.repeat(64);original.Name='/'+originalName;original.Mounts[0].Name=originalName;
  const volume={Name:candidateName,Driver:'local',Options:null,Labels:{'potok.purpose':'security-test-copy'}};
  assert.equal(validateTarget(clone,original,volume),clone.Id);
  const byId=structuredClone(clone);byId.Config.Image=original.Image;assert.equal(validateTarget(byId,original,volume),clone.Id);
  for(const change of [c=>c.Name=original.Name,c=>c.Id=original.Id,c=>c.HostConfig.NetworkMode='bridge',c=>c.HostConfig.PortBindings={'5432/tcp':[{HostPort:'5432'}]},c=>c.Mounts[0].Name=originalName,c=>c.Mounts.push({Type:'bind'}),c=>c.Image='sha256:'+'d'.repeat(64),c=>c.Config.Image='sha256:'+'d'.repeat(64),c=>c.Config.Image='unreviewed:latest',c=>c.Config.User='root',c=>c.HostConfig.Privileged=true,c=>c.State.Health.Status='starting']){const c=structuredClone(byId);change(c);assert.throws(()=>validateTarget(c,original,volume));}
  const badOriginal=structuredClone(original);badOriginal.Config.Image=original.Image;assert.throws(()=>validateTarget(byId,badOriginal,volume));
  assert.throws(()=>validateTarget(clone,original,{...volume,Options:{device:'/private'}}));
  assert.throws(()=>boundaryQuery('SELECT true;'));
 });
 console.log('TWELVE_RUNNER_ACCEPTANCE_OK: '+passed+' cases; synthetic fixture only, not owner backup acceptance');
}catch(e){console.error('TWELVE_RUNNER_ACCEPTANCE_FAILED: '+e.message+' '+(e.code??'')+' '+(e.where??''));process.exitCode=1;}
finally{await exec('ROLLBACK;RESET ROLE;').catch(()=>{});await(embedded?db.close():db.end());}
