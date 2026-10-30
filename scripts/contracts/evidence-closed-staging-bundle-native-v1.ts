/** Native acceptance only, using the caller's own disposable PostgreSQL cluster. */
import assert from 'node:assert/strict';
import type {TestContext} from 'node:test';
import {readFile} from 'node:fs/promises';
import {id} from '../../src/server/__tests__/foodEvidenceFixturesV1';
interface DB {sql(statement:string):Promise<string>}
const q=(s:string)=>`'${s.replace(/'/g,"''")}'`;
export async function runClosedEvidenceBundleV1(t:TestContext,{sql}:DB) {
 const bundle=await readFile('supabase/migration_drafts/evidence_closed_staging_bundle_v1.sql','utf8');
 // Synthetic Auth transport and legacy identities, never real Supabase accounts.
 await sql(`ALTER TABLE auth.users ADD COLUMN created_at timestamptz DEFAULT clock_timestamp();
  CREATE ROLE fixture_auth_server NOLOGIN;
  GRANT USAGE ON SCHEMA auth TO fixture_auth_server;GRANT INSERT ON auth.users TO fixture_auth_server;
  CREATE TABLE public.synthetic_bundle_signup_audit(account_id uuid PRIMARY KEY);
  CREATE FUNCTION public.synthetic_bundle_signup() RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog AS $$
   BEGIN INSERT INTO public.synthetic_bundle_signup_audit VALUES(NEW.id);RETURN NEW;END $$;
  CREATE TRIGGER synthetic_existing_signup AFTER INSERT ON auth.users FOR EACH ROW EXECUTE FUNCTION public.synthetic_bundle_signup();`);
 for(const n of [910001,910002,910003])await sql(`INSERT INTO auth.users(id) VALUES(${q(id(n))});INSERT INTO public.user_profiles(user_id) VALUES(${q(id(n))});`);
 const inventorySql=`SELECT encode(extensions.digest(convert_to(coalesce(string_agg(pg_get_triggerdef(t.oid)||':'||t.tgenabled::text||':'||pg_get_userbyid(p.proowner)::text||':'||p.prosecdef::text||':'||coalesce(array_to_string(p.proconfig,','),'')||':'||encode(extensions.digest(convert_to(p.prosrc,'UTF8'),'sha256'),'hex'),E'\n' ORDER BY t.tgname),''),'UTF8'),'sha256'),'hex') FROM pg_trigger t JOIN pg_proc p ON p.oid=t.tgfoid WHERE t.tgrelid='auth.users'::regclass AND NOT t.tgisinternal`;
 const observed=await sql(inventorySql); // Explicitly reviewed SYNTHETIC trigger fixture only.
 const target="SET potok_evidence.bundle_target='staging:ozidryfvhkcbtpnulakq';";
 const prefix=target+`SET potok_closure.reviewed_auth_triggers_sha256=${q(observed)};`;
 const content=()=>sql(`SELECT jsonb_build_object(
  'foods',(SELECT jsonb_agg(to_jsonb(f)-'is_searchable'-'needs_review' ORDER BY id) FROM public.foods f),
  'diary',(SELECT jsonb_agg(to_jsonb(d) ORDER BY id) FROM public.food_diary_entries d),
  'profiles',(SELECT jsonb_agg(to_jsonb(p) ORDER BY user_id) FROM public.user_profiles p),
  'auth',(SELECT jsonb_agg(to_jsonb(u) ORDER BY id) FROM auth.users u),
  'aliases',(SELECT jsonb_agg(to_jsonb(a) ORDER BY id) FROM public.food_aliases a))`);
 const metadata=()=>sql(`SELECT jsonb_build_object(
  'food_columns',(SELECT jsonb_agg(jsonb_build_array(attname,atttypid,attnotnull,atthasdef) ORDER BY attnum) FROM pg_attribute WHERE attrelid='public.foods'::regclass AND attnum>0 AND NOT attisdropped),
  'namespaces',jsonb_build_array(to_regnamespace('potok_food_evidence'),to_regnamespace('potok_nonfood'),to_regnamespace('potok_closure')),
  'auth_triggers',(SELECT jsonb_agg(pg_get_triggerdef(oid) ORDER BY tgname) FROM pg_trigger WHERE tgrelid='auth.users'::regclass AND NOT tgisinternal))`);
 const before=await content(),metaBefore=await metadata();
 const unchanged=async()=>{assert.equal(await content(),before);assert.equal(await metadata(),metaBefore);};
 await t.test('closed bundle: missing/wrong target and unreviewed Auth inventory fail without changes',async()=>{
  await assert.rejects(sql(bundle),/EVIDENCE_BUNDLE_STAGING_TARGET_REQUIRED/);
  await assert.rejects(sql("SET potok_evidence.bundle_target='production';"+bundle),/EVIDENCE_BUNDLE_STAGING_TARGET_REQUIRED/);
  await assert.rejects(sql(target+bundle),/EVIDENCE_BUNDLE_REVIEWED_AUTH_INVENTORY_REQUIRED/);
  await unchanged();
 });
 await t.test('closed bundle: a client role cannot install the package with copied markers',async()=>{
  await assert.rejects(sql('SET ROLE authenticated;'+prefix+bundle),/EVIDENCE_BUNDLE_SQL_OWNER_REQUIRED/);
  await unchanged();
 });
 await t.test('closed bundle: late Auth inventory mismatch rolls back all earlier schema/components',async()=>{
  await assert.rejects(sql(target+"SET potok_closure.reviewed_auth_triggers_sha256='"+'0'.repeat(64)+"';"+bundle),/REVIEWED_AUTH_TRIGGER_INVENTORY_REQUIRED/);
  await unchanged();
 });
 await t.test('closed bundle: forced final failure also rolls back registration hook and admission fields',async()=>{
  const failing=bundle.replace(/COMMIT;\n$/,"DO $$ BEGIN RAISE EXCEPTION 'SYNTHETIC_BUNDLE_FINAL_FAILURE'; END $$;\nCOMMIT;\n");
  await assert.rejects(sql(prefix+failing),/SYNTHETIC_BUNDLE_FINAL_FAILURE/);
  await unchanged();
 });
 await t.test('closed bundle: whole package commits together, with no intermediate RPC visible to another session',async()=>{
  const held=bundle.replace(/^BEGIN;\n/m,"BEGIN;\nSET LOCAL application_name='synthetic_bundle_install';\n").replace(/COMMIT;\n$/,'SELECT pg_sleep(2);\nCOMMIT;\n');
  const holder=sql(prefix+held);
  const settled=holder.then(value=>({value}),error=>({error}));
  try {
   let observedWait=false;
   const deadline=Date.now()+4000;
   while(Date.now()<deadline){
    if(await sql("SELECT EXISTS(SELECT 1 FROM pg_stat_activity WHERE application_name='synthetic_bundle_install' AND wait_event='PgSleep')")==='t'){observedWait=true;break;}
    await new Promise(r=>setTimeout(r,20));
   }
   assert.ok(observedWait,'must observe actual open install transaction');
   assert.equal(await metadata(),metaBefore,'uncommitted schema/hook must remain invisible');
   assert.equal(await sql("SELECT to_regprocedure('public.food_evidence_review_v1(text)') IS NULL AND to_regprocedure('public.nonfood_evidence_review_v1(text)') IS NULL AND to_regprocedure('public.account_closure_begin_v1(text)') IS NULL"),'t');
  } finally {const result=await settled;if('error'in result)throw result.error;}
  assert.equal(await content(),before);
  assert.equal(await sql("SELECT count(*) FROM pg_namespace WHERE nspname IN('potok_food_evidence','potok_nonfood','potok_closure')"),'3');
  assert.equal(await sql('SELECT count(*) FROM potok_closure.accounts_v1'),'0');
  assert.equal(await sql('SELECT count(*) FROM potok_closure.registration_records_v1'),'0');
  assert.equal(await sql('SELECT bool_and(is_searchable IS NULL AND needs_review IS NULL) FROM public.foods'),'t');
  for(const name of ['food_evidence_review_v1','nonfood_evidence_review_v1'])
   assert.equal(await sql(`SELECT strpos(prosrc,'potok_closure.assert_active_v1()')>0 FROM pg_proc WHERE oid=${q('public.'+name+'(text)')}::regprocedure`),'t');
 });
 assert.equal(await sql("SELECT to_regclass('potok_closure.registration_records_v1') IS NOT NULL"),'t','bundle must install before dependent acceptance');
 const calls=["public.food_evidence_review_v1('{}')","public.food_evidence_receipt_v1(null::uuid)","public.food_evidence_current_v1(null::uuid,'raw')","public.nonfood_evidence_review_v1('{}')","public.nonfood_evidence_receipt_v1(null::uuid)","public.nonfood_evidence_current_v1(null::uuid)","public.account_closure_begin_v1('{}')"];
 await t.test('closed bundle: all seven application RPCs deny every client role after commit',async()=>{
  for(const role of ['anon','authenticated','service_role'])for(const call of calls)
   await assert.rejects(sql(`SET ROLE ${role};SELECT ${call}`),/permission denied/);
 });
 await t.test('closed bundle: actual new Auth INSERT coexists with old hook, with no privilege or legacy-state grant',async()=>{
  const who=id(910004);
  await sql(`SET ROLE fixture_auth_server;INSERT INTO auth.users(id,is_anonymous,created_at) VALUES(${q(who)},false,clock_timestamp())`);
  assert.equal(await sql(`SELECT state FROM potok_closure.accounts_v1 WHERE account_id=${q(who)}`),'ACTIVE');
  assert.equal(await sql(`SELECT origin FROM potok_closure.registration_records_v1 WHERE account_id=${q(who)}`),'NEW_AUTH_INSERT');
  assert.equal(await sql('SELECT count(*) FROM potok_closure.accounts_v1'),'1');
  assert.equal(await sql('SELECT count(*) FROM public.synthetic_bundle_signup_audit'),'4');
  assert.equal(await sql('SELECT count(*) FROM potok_control.access_attestations'),'0');
  assert.equal(await sql(`SELECT count(*) FROM public.user_profiles WHERE user_id=${q(who)}`),'0');
  const bad=id(910005);
  await assert.rejects(sql(`SET ROLE fixture_auth_server;INSERT INTO auth.users(id,is_anonymous,created_at) VALUES(${q(bad)},false,NULL)`),/AUTH_CREATION_BINDING_REQUIRED/);
  assert.equal(await sql(`SELECT count(*) FROM auth.users WHERE id=${q(bad)}`),'0');
  assert.equal(await sql(`SELECT count(*) FROM public.synthetic_bundle_signup_audit WHERE account_id=${q(bad)}`),'0');
 });
 await t.test('closed bundle: replay refuses existing installation and never reopens RPCs',async()=>{
  const after=await content(),metaAfter=await metadata();
  await assert.rejects(sql(prefix+bundle),/FOOD_ADMISSION_EXISTING_COLUMNS_REQUIRE_REVIEW/);
  assert.equal(await content(),after);assert.equal(await metadata(),metaAfter);
  for(const call of calls)await assert.rejects(sql('SET ROLE authenticated;SELECT '+call),/permission denied/);
 });
 await t.test('closed bundle: guarded recovery preserves records and other signup hooks while keeping RPCs closed',async()=>{
  const recovery=await readFile('supabase/migration_drafts/evidence_closed_staging_bundle_v1.recovery.sql','utf8');
  await assert.rejects(sql(recovery),/EVIDENCE_BUNDLE_RECOVERY_TARGET_OWNER_REQUIRED/);
  const records=()=>sql('SELECT jsonb_build_array((SELECT jsonb_agg(to_jsonb(a)) FROM potok_closure.accounts_v1 a),(SELECT jsonb_agg(to_jsonb(r)) FROM potok_closure.registration_records_v1 r))');
  const beforeRecovery=await records();
  await sql("SET potok_evidence.recovery_target='staging:ozidryfvhkcbtpnulakq';"+recovery);
  assert.equal(await records(),beforeRecovery);
  assert.equal(await sql("SELECT tgenabled FROM pg_trigger WHERE tgrelid='auth.users'::regclass AND tgname='potok_closure_register_new_auth_v1'"),'D');
  assert.equal(await sql("SELECT tgenabled FROM pg_trigger WHERE tgrelid='auth.users'::regclass AND tgname='synthetic_existing_signup'"),'O');
  const afterRecovery=id(910006);
  await sql(`SET ROLE fixture_auth_server;INSERT INTO auth.users(id,is_anonymous,created_at) VALUES(${q(afterRecovery)},false,clock_timestamp())`);
  assert.equal(await sql(`SELECT count(*) FROM public.synthetic_bundle_signup_audit WHERE account_id=${q(afterRecovery)}`),'1');
  assert.equal(await sql(`SELECT count(*) FROM potok_closure.accounts_v1 WHERE account_id=${q(afterRecovery)}`),'0');
  assert.equal(await records(),beforeRecovery);
  for(const call of calls)await assert.rejects(sql('SET ROLE authenticated;SELECT '+call),/permission denied/);
 });
}
