/** Native synthetic acceptance only. No remote URL, real Auth call or real review permit. */
import assert from 'node:assert/strict';
import type { TestContext } from 'node:test';
import { readFile } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import { id } from '../../src/server/__tests__/foodEvidenceFixturesV1';
interface DB { sql(statement: string): Promise<string>; asUser(statement: string, actor?: string): Promise<string> }
const q = (s: string) => `'${s.replace(/'/g, "''")}'`;
export async function runAccountStateRegistrationV1(t: TestContext, { sql, asUser }: DB) {
  const sourceHash = createHash('sha256').update('SYNTHETIC ONLY: independent lifecycle review fixture, not a real approval').digest('hex');
  const register = (permit: number) => `SELECT potok_closure.register_reviewed_existing_v1(${q(id(permit))})`;
  const permit = (account: number, n: number, expires = "clock_timestamp()+interval '60 seconds'", expected = 'created_at') =>
    sql(`INSERT INTO potok_closure.registration_permits_v1 SELECT ${q(id(n))},id,${expected},${q(sourceHash)},${expires} FROM auth.users WHERE id=${q(id(account))}`);
  const state = (account: number) => sql(`SELECT coalesce((SELECT state FROM potok_closure.accounts_v1 WHERE account_id=${q(id(account))}),'ABSENT')`);
  const close = (account: number) => asUser(`SELECT public.account_closure_begin_v1(${q(JSON.stringify({contract:'potok-account-closure-request-v1',closureKey:id(800000+account)}))})`,id(account));
  // The minimal native fixture is explicitly extended, not passed off as real Supabase Auth.
  await sql(`ALTER TABLE auth.users ADD COLUMN created_at timestamptz DEFAULT clock_timestamp();
    CREATE ROLE fixture_auth_server NOLOGIN;
    GRANT USAGE ON SCHEMA auth TO fixture_auth_server; GRANT INSERT ON auth.users TO fixture_auth_server;
    CREATE TABLE public.synthetic_signup_audit(account_id uuid PRIMARY KEY);
    CREATE FUNCTION public.synthetic_signup_trigger() RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog AS $$
      BEGIN INSERT INTO public.synthetic_signup_audit VALUES(NEW.id); RETURN NEW; END $$;
    CREATE TRIGGER synthetic_existing_signup AFTER INSERT ON auth.users FOR EACH ROW EXECUTE FUNCTION public.synthetic_signup_trigger();`);
  for (const n of [60,61,62,66,67,70]) await sql(`INSERT INTO auth.users(id,is_anonymous) VALUES(${q(id(n))},${n===62});
    INSERT INTO auth.sessions VALUES(${q(id(n+100))},${q(id(n))},NULL);
    INSERT INTO public.user_profiles(user_id) VALUES(${q(id(n))})`);
  const inventorySql = `SELECT encode(extensions.digest(convert_to(coalesce(string_agg(pg_get_triggerdef(t.oid)||':'||t.tgenabled||':'||pg_get_userbyid(p.proowner)||':'||p.prosecdef::text||':'||coalesce(array_to_string(p.proconfig,','),'')||':'||
    encode(extensions.digest(convert_to(p.prosrc,'UTF8'),'sha256'),'hex'),E'\n' ORDER BY t.tgname),''),'UTF8'),'sha256'),'hex')
    FROM pg_trigger t JOIN pg_proc p ON p.oid=t.tgfoid WHERE t.tgrelid='auth.users'::regclass AND NOT t.tgisinternal`;
  const draft = await readFile('supabase/migration_drafts/account_state_registration_v1.sql','utf8');
  await t.test('registration draft: exact trigger inventory, guarded atomic install and zero legacy backfill',async()=>{
    const before = await sql('SELECT count(*) FROM potok_closure.accounts_v1');
    await assert.rejects(sql(draft),/EXPLICIT_REGISTRATION_STAGING_TARGET_REQUIRED/);
    const prefix = "SET potok_closure.registration_rollout_target='staging:ozidryfvhkcbtpnulakq';";
    await assert.rejects(sql(prefix+"SET potok_closure.reviewed_auth_triggers_sha256='unreviewed';"+draft),/REVIEWED_AUTH_TRIGGER_INVENTORY_REQUIRED/);
    assert.equal(await sql("SELECT to_regclass('potok_closure.registration_records_v1') IS NULL"),'t');
    const observed = await sql(inventorySql); // synthetic fixture's explicitly accepted inventory
    await sql('ALTER TABLE auth.users DISABLE TRIGGER synthetic_existing_signup');
    try {
      await assert.rejects(sql(prefix+`SET potok_closure.reviewed_auth_triggers_sha256=${q(observed)};`+draft),/REVIEWED_AUTH_TRIGGER_INVENTORY_REQUIRED/);
    } finally { await sql('ALTER TABLE auth.users ENABLE TRIGGER synthetic_existing_signup'); }
    await sql(prefix+`SET potok_closure.reviewed_auth_triggers_sha256=${q(observed)};`+draft);
    assert.equal(await sql('SELECT count(*) FROM potok_closure.accounts_v1'),before);
    assert.equal(await sql('SELECT count(*) FROM potok_closure.registration_records_v1'),'0');
    assert.equal(await state(60),'ABSENT');
    await sql(await readFile('supabase/migration_drafts/account_state_registration_v1.preflight.sql','utf8'));
  });
  await t.test('registration draft: real Auth INSERT event creates state and provenance atomically, with no admin/Premium grant',async()=>{
    await sql(`SET ROLE fixture_auth_server; INSERT INTO auth.users(id,is_anonymous,created_at) VALUES(${q(id(63))},false,clock_timestamp())`);
    await sql(`INSERT INTO auth.sessions VALUES(${q(id(163))},${q(id(63))},NULL); INSERT INTO public.user_profiles(user_id) VALUES(${q(id(63))})`);
    assert.equal(await state(63),'ACTIVE');
    assert.equal(await sql(`SELECT origin FROM potok_closure.registration_records_v1 WHERE account_id=${q(id(63))}`),'NEW_AUTH_INSERT');
    assert.equal(await sql(`SELECT count(*) FROM public.synthetic_signup_audit WHERE account_id=${q(id(63))}`),'1');
    assert.equal(await sql(`SELECT potok_control.is_effective_entitlement_v2(${q(id(63))},'admin',clock_timestamp())`),'f');
    assert.equal(await sql(`SELECT has_premium FROM public.user_profiles WHERE user_id=${q(id(63))}`),'f');
    await assert.rejects(asUser("SELECT public.food_evidence_review_v1('{}')",id(63)),/VERIFIED_ADMIN_REQUIRED/);
  });
  await t.test('registration draft: anonymous INSERT/conversion never becomes an implicit ACTIVE registration',async()=>{
    await sql(`SET ROLE fixture_auth_server; INSERT INTO auth.users(id,is_anonymous,created_at) VALUES(${q(id(64))},true,clock_timestamp())`);
    assert.equal(await state(64),'ABSENT');
    await sql(`UPDATE auth.users SET is_anonymous=false WHERE id=${q(id(64))}`);
    assert.equal(await state(64),'ABSENT');
  });
  await t.test('registration draft: clients cannot insert Auth/state, forge permits or call registration helpers',async()=>{
    for(const role of ['anon','authenticated','service_role']) {
      for(const command of [register(810000),`SELECT potok_closure.register_new_auth_v1()`,
        `INSERT INTO potok_closure.registration_permits_v1 DEFAULT VALUES`,
        `SELECT * FROM potok_closure.registration_records_v1`,
        `INSERT INTO auth.users(id,is_anonymous) VALUES(${q(id(65))},false)`]) {
        await assert.rejects(sql(`SET ROLE ${role}; ${command}`),/permission denied/);
      }
    }
  });
  await t.test('registration draft: reviewed legacy permit is exact, concurrent replay has one registration',async()=>{
    await permit(60,810060);
    const values=await Promise.all([sql(register(810060)),sql(register(810060))]);
    assert.deepEqual(JSON.parse(values[0]),JSON.parse(values[1]));
    assert.equal(await state(60),'ACTIVE');
    assert.equal(await sql(`SELECT count(*) FROM potok_closure.registration_records_v1 WHERE account_id=${q(id(60))}`),'1');
    await close(60);
    await assert.rejects(sql(register(810060)),/ACCOUNT_NOT_ACTIVE/);
    assert.equal(await state(60),'CLOSING');
  });
  await t.test('registration draft: absent, expired, anonymous and mismatched creation permits fail closed',async()=>{
    await assert.rejects(sql(register(819999)),/REVIEWED_REGISTRATION_PERMIT_REQUIRED/);
    await permit(61,810061,"clock_timestamp()-interval '1 second'");
    await assert.rejects(sql(register(810061)),/REGISTRATION_PERMIT_EXPIRED/);
    await assert.rejects(permit(61,810261,"'infinity'::timestamptz"),/check constraint/);
    await permit(61,810161,undefined,"created_at+interval '1 second'");
    await assert.rejects(sql(register(810161)),/REGISTRATION_AUTH_BINDING_MISMATCH/);
    await permit(62,810062);
    await assert.rejects(sql(register(810062)),/REGISTRATION_AUTH_BINDING_MISMATCH/);
    assert.equal(await state(61),'ABSENT'); assert.equal(await state(62),'ABSENT');
  });
  await t.test('registration draft: a different reviewed permit cannot overwrite the winning registration',async()=>{
    await permit(66,810066); await permit(66,810166);
    const values=await Promise.allSettled([sql(register(810066)),sql(register(810166))]);
    assert.equal(values.filter(v=>v.status==='fulfilled').length,1);
    assert.ok(values.some(v=>v.status==='rejected'&&/REGISTRATION_CONFLICT/.test(String(v.reason))));
    assert.equal(await sql(`SELECT count(*) FROM potok_closure.registration_records_v1 WHERE account_id=${q(id(66))}`),'1');
  });
  await t.test('registration draft: COMMIT-time permit expiry rolls back both ACTIVE state and provenance',async()=>{
    await permit(67,810067,"clock_timestamp()+interval '2 seconds'");
    await assert.rejects(sql(`BEGIN; ${register(810067)}; SELECT pg_sleep(3); COMMIT;`),/REGISTRATION_PERMIT_EXPIRED_OR_CHANGED/);
    assert.equal(await state(67),'ABSENT');
    assert.equal(await sql(`SELECT count(*) FROM potok_closure.registration_records_v1 WHERE account_id=${q(id(67))}`),'0');
  });
  await t.test('registration draft: signup error and explicit rollback leave no Auth/state/provenance/audit residue',async()=>{
    await assert.rejects(sql(`SET ROLE fixture_auth_server; INSERT INTO auth.users(id,is_anonymous,created_at) VALUES(${q(id(68))},false,NULL)`),/AUTH_CREATION_BINDING_REQUIRED/);
    await assert.rejects(sql(`BEGIN; SET LOCAL ROLE fixture_auth_server; INSERT INTO auth.users(id,is_anonymous,created_at) VALUES(${q(id(69))},false,clock_timestamp()); DO $$ BEGIN RAISE EXCEPTION 'REGISTRATION_FORCED_ROLLBACK'; END $$; COMMIT;`),/REGISTRATION_FORCED_ROLLBACK/);
    for(const n of [68,69]) {
      assert.equal(await state(n),'ABSENT');
      for(const table of ['auth.users','potok_closure.registration_records_v1','public.synthetic_signup_audit'])
        assert.equal(await sql(`SELECT count(*) FROM ${table} WHERE ${table==='auth.users'?'id':'account_id'}=${q(id(n))}`),'0');
    }
  });
  await t.test('registration draft: permits/provenance are immutable and no CLOSING account can be reopened',async()=>{
    for(const table of ['registration_permits_v1','registration_records_v1'])
      await assert.rejects(sql(`DELETE FROM potok_closure.${table}`),/IMMUTABLE_ACCOUNT_REGISTRATION/);
    await permit(45,810045);
    await assert.rejects(sql(register(810045)),/ACCOUNT_NOT_ACTIVE/);
    assert.equal(await state(45),'CLOSING');
    await close(63); assert.equal(await state(63),'CLOSING');
  });
  await t.test('registration draft: real registration-versus-owner-closure race commits registration before CLOSING, never reopens',async()=>{
    await permit(70,810070);
    const observed=async(app:string,condition:string)=>{
      const end=Date.now()+2500;
      while(Date.now()<end) {
        if(await sql(`SELECT EXISTS(SELECT 1 FROM pg_stat_activity WHERE application_name=${q(app)} AND ${condition})`)==='t')return;
        await new Promise(resolve=>setTimeout(resolve,20));
      }
      assert.fail('Expected actual PostgreSQL wait for '+app);
    };
    const holder=sql(`BEGIN; SET LOCAL application_name='registration_holder'; ${register(810070)}; SELECT pg_sleep(4); COMMIT;`);
    const settled=holder.then(value=>({value}),error=>({error}));
    let closing:Promise<string>|undefined;
    try {
      await observed('registration_holder',"wait_event='PgSleep'");
      closing=asUser(`SET LOCAL application_name='registration_closer'; SELECT public.account_closure_begin_v1(${q(JSON.stringify({contract:'potok-account-closure-request-v1',closureKey:id(800070)}))})`,id(70));
      await observed('registration_closer',"wait_event_type='Lock'");
    } finally {
      const result=await settled;if('error'in result)throw result.error;
      if(closing)await closing;
    }
    assert.equal(await state(70),'CLOSING');
    await assert.rejects(sql(register(810070)),/ACCOUNT_NOT_ACTIVE/);
  });
}
