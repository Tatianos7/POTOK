/** Real PostgreSQL acceptance, never a Supabase test or an in-memory database model.
 * Creates and destroys its OWN Unix-socket-only cluster. No database URL option.
 * Auth fixtures simulate verified PostgREST claims: signature verification remains NOT VERIFIED here.
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import { spawnSync, execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { mkdtemp, mkdir, readFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { approved, rejected, proposal, source, actor, foodId, id } from '../../src/server/__tests__/foodEvidenceFixturesV1';
import { foodReviewProposalDigestV1, foodEvidenceRequestDigestRawV1, type FoodEvidenceReviewRequestV1,
  type NutritionFoodReviewProposalV1 } from '../../src/server/foodEvidenceReviewRequestV1';
import { verifyFoodEvidenceReceiptV1 } from '../../src/server/foodEvidenceReviewGatewayV1';

const run = promisify(execFile);
const env = { PATH: process.env.PATH ?? '', LC_ALL: 'C.UTF-8' }; // Ignore ALL PG*/credential/connection environment variables.
const required = ['initdb','pg_ctl','psql'];
const missing = required.filter(command => spawnSync(command,['--version'],{ env, stdio:'ignore' }).status !== 0);
const skip = missing.length ? `NOT VERIFIED: local PostgreSQL binaries unavailable: ${missing.join(', ')}`
  : process.getuid?.() === 0 ? 'NOT VERIFIED: initdb must run under a non-root disposable test user' : false;
// CI/owner acceptance must fail rather than silently succeed when DB execution is required.
const requireDatabase = process.env.POTOK_FOOD_EVIDENCE_REQUIRE_DB === '1';
const quote = (value: string): string => `'${value.replace(/'/g,"''")}'`;
const raw = JSON.stringify;
const migrationPath = 'supabase/migration_drafts/food_reviewed_evidence_v1_phase2b.sql';

test('disposable PostgreSQL: authorization, FORCE RLS, atomicity, immutability and REAL multi-session concurrency', { skip:requireDatabase ? false : skip, timeout:180_000 }, async t => {
  if (skip) assert.fail(skip);
  const root = await mkdtemp(join(tmpdir(),'potok-food-evidence-pg-'));
  const data = join(root,'data'), socket = join(root,'socket'), port = '54329';
  await mkdir(socket,{ mode:0o700 });
  let started = false;
  const sql = async (statement: string): Promise<string> => {
    const result = await run('psql',['-X','-q','-A','-t','-v','ON_ERROR_STOP=1','-h',socket,'-p',port,'-U','postgres','-d','postgres','-c',statement],
      { env, timeout:30_000, maxBuffer:4_194_304 });
    return result.stdout.trim();
  };
  const claims = (user: string, overrides: Record<string,unknown> = {}): string => raw({ role:'authenticated', sub:user,
    session_id:id(Number(user.slice(-12))+100), exp:Math.floor(Date.now()/1000)+3600, ...overrides });
  const asUser = async (statement: string, user = actor, overrides: Record<string,unknown> = {}): Promise<string> => sql(
    `BEGIN; SET LOCAL ROLE authenticated; DO $claims$ BEGIN PERFORM set_config('request.jwt.claims',${quote(claims(user,overrides))},true); END $claims$;
     ${statement}; COMMIT;`);
  const review = async (input: FoodEvidenceReviewRequestV1, user = actor) => {
    const value: unknown = JSON.parse(await asUser(`SELECT public.food_evidence_review_v1(${quote(raw(input))})`,user));
    await verifyFoodEvidenceReceiptV1(input,user,value);
    return value as { event: { eventId:string; target: { revisionId:string; digest:string; canonicalFoodId:string }; requestDigest:string };
      revision: { revisionId:string; digest:string; canonicalFoodId:string }; replayed:boolean };
  };
  const projection = async () => JSON.parse(await asUser(`SELECT public.food_evidence_current_v1(${quote(foodId)},'raw')`)) as {
    canonicalRevision:{ revisionId:string }; canonicalUsable:boolean; nutritionUsable:boolean; canonicalInvalidation:string|null };
  try {
    await run('initdb',['-D',data,'-U','postgres','--auth-local=trust','--auth-host=reject','--encoding=UTF8','--no-locale'],{ env, timeout:30_000 });
    await run('pg_ctl',['-D',data,'-l',join(root,'server.log'),'-o',`-k ${socket} -p ${port} -c listen_addresses='' -c unix_socket_permissions=0700`,'-w','start'],{ env, timeout:30_000 });
    started = true;
    // MAINTAIN appears in the existing reviewed trusted-entitlement prerequisite package.
    assert.ok(Number(await sql('SHOW server_version_num'))>=170000,'Existing trusted-entitlement package requires PostgreSQL 17+; do not modify it for testing');
    await sql(`CREATE ROLE anon NOLOGIN; CREATE ROLE authenticated NOLOGIN; CREATE ROLE service_role NOLOGIN BYPASSRLS;
      CREATE SCHEMA auth; CREATE SCHEMA extensions; CREATE EXTENSION pgcrypto WITH SCHEMA extensions;
      CREATE TABLE auth.users(id uuid PRIMARY KEY,is_anonymous boolean NOT NULL DEFAULT false);
      CREATE TABLE auth.sessions(id uuid PRIMARY KEY,user_id uuid NOT NULL REFERENCES auth.users(id),not_after timestamptz);
      CREATE FUNCTION auth.jwt() RETURNS jsonb LANGUAGE sql STABLE AS $$ SELECT coalesce(nullif(current_setting('request.jwt.claims',true),''),'{}')::jsonb $$;
      CREATE FUNCTION auth.uid() RETURNS uuid LANGUAGE sql STABLE AS $$ SELECT (auth.jwt()->>'sub')::uuid $$;
      GRANT USAGE ON SCHEMA auth TO anon,authenticated,service_role;
      CREATE TABLE public.user_profiles(id_user uuid PRIMARY KEY,is_admin boolean NOT NULL DEFAULT false);
      CREATE TABLE public.foods(id uuid PRIMARY KEY,canonical_food_id uuid,stable_food_id text,source text,created_by_user_id uuid,
        is_searchable boolean,needs_review boolean,name text,name_original text,normalized_name text,brand text,normalized_brand text,barcode text,aliases text[]);
      CREATE TABLE public.food_aliases(id uuid PRIMARY KEY,canonical_food_id uuid,alias text);
      CREATE TABLE public.food_diary_entries(id uuid PRIMARY KEY,calories numeric,protein numeric,fat numeric,carbs numeric);
      INSERT INTO public.foods VALUES (${quote(foodId)},${quote(foodId)},'synthetic_root','core',NULL,true,false,'Synthetic food',NULL,'synthetic food',NULL,NULL,NULL,'{}');
      INSERT INTO public.food_diary_entries VALUES (${quote(id(70))},123.45,1.23,2.34,3.45);`);
    const migration = await readFile(migrationPath,'utf8');
    const before = await sql(`SELECT jsonb_build_object('foods',(SELECT jsonb_agg(to_jsonb(f)) FROM public.foods f),
      'aliases',(SELECT jsonb_agg(to_jsonb(f)) FROM public.food_aliases f),'diary',(SELECT jsonb_agg(to_jsonb(f)) FROM public.food_diary_entries f))`);
    await t.test('Main preflight rejects legacy schema and leaves no partial objects',async () => {
      await assert.rejects(sql(migration),/STAGING_TRUSTED_INFRASTRUCTURE_REQUIRED_NO_MAIN_FALLBACK/);
      assert.equal(await sql("SELECT to_regnamespace('potok_food_evidence') IS NULL"),'t');
    });
    await sql(`DROP TABLE public.user_profiles;
      CREATE TABLE public.user_profiles(user_id uuid PRIMARY KEY REFERENCES auth.users(id),is_admin boolean NOT NULL DEFAULT false,has_premium boolean NOT NULL DEFAULT false,
        first_name text,last_name text,middle_name text,birth_date date,age integer,height numeric,goal text,email text,phone text,avatar_url text);`);
    for (const table of ['premium_plans','premium_plan_days','premium_meal_slots','premium_recipes','premium_recipe_ingredients','premium_recipe_steps','premium_recipe_hints','premium_meal_recipe_options']) {
      await sql(`CREATE TABLE public.${table}(id uuid PRIMARY KEY); ALTER TABLE public.${table} ENABLE ROW LEVEL SECURITY;`);
    }
    // Use actual reviewed trust code, not a predicate returning true or a simulated entitlement store.
    for (const file of ['20260921_trusted_entitlement_v2.sql','20260921_trusted_entitlement_v2_1_repair.sql','20260921_trusted_entitlement_v2_2_repair.sql']) {
      await sql(await readFile(`docs/premium/drafts/${file}`,'utf8'));
    }
    await sql('CREATE SCHEMA potok_nutrition');
    const adaptive = await readFile('docs/premium/drafts/20260921_adaptive_nutrition_runtime_activation_v1.sql','utf8');
    for (const name of ['json_has_duplicate_keys_v1','canonical_jsonb_text_v1']) {
      const start = adaptive.indexOf(`CREATE FUNCTION potok_nutrition.${name}(`), end = adaptive.indexOf('$function$;',start);
      assert.ok(start>=0 && end>start); await sql(adaptive.slice(start,end+'$function$;'.length));
    }
    await t.test('Staging predicate does not authorize a Main-shaped profile',async () => {
      await sql('ALTER TABLE public.user_profiles RENAME COLUMN user_id TO id_user');
      await assert.rejects(sql(migration),/STAGING_PROFILE_CONTRACT_REQUIRED_NO_MAIN_FALLBACK/);
      assert.equal(await sql("SELECT to_regnamespace('potok_food_evidence') IS NULL"),'t');
      await sql('ALTER TABLE public.user_profiles RENAME COLUMN id_user TO user_id');
    });
    await t.test('matching schema alone is not rollout authorization: explicit owner target acknowledgement required',async () => {
      await assert.rejects(sql(migration),/EXPLICIT_STAGING_ROLLOUT_TARGET_REQUIRED/);
      assert.equal(await sql("SELECT to_regnamespace('potok_food_evidence') IS NULL"),'t');
    });
    await sql("SET potok_food_evidence.rollout_target='staging:ozidryfvhkcbtpnulakq';\n"+migration);
    for (const n of [1,2,3,4]) {
      await sql(`INSERT INTO auth.users VALUES(${quote(id(n))},${n===4});
        INSERT INTO auth.sessions VALUES(${quote(id(n+100))},${quote(id(n))},NULL);
        INSERT INTO public.user_profiles(user_id) VALUES(${quote(id(n))});`);
    }
    for (const n of [1,2]) await sql(`SELECT potok_control.grant_entitlement_v2(${quote(id(n))},'admin',NULL,'synthetic-local-test','synthetic authorization fixture')`);
    await sql(`UPDATE public.user_profiles SET is_admin=true WHERE user_id=${quote(id(3))}`);
    await t.test('JWT/session/anonymous/admin and client authority forgery fail closed',async () => {
      const input = await approved(1000);
      await assert.rejects(sql(`BEGIN ISOLATION LEVEL REPEATABLE READ; SET LOCAL ROLE authenticated;
        SELECT set_config('request.jwt.claims',${quote(claims(actor))},true);
        SELECT public.food_evidence_review_v1(${quote(raw(input))}); COMMIT;`),/READ_COMMITTED_TRANSACTION_REQUIRED/);
      await assert.rejects(asUser(`SELECT public.food_evidence_review_v1(${quote(raw(input))})`,id(3)),/VERIFIED_ADMIN_REQUIRED/);
      await assert.rejects(asUser(`SELECT public.food_evidence_review_v1(${quote(raw(input))})`,id(4)),/LIVE_AUTH_SESSION_REQUIRED/);
      await assert.rejects(asUser(`SELECT public.food_evidence_review_v1(${quote(raw(input))})`,actor,{ exp:0 }),/JWT_EXPIRED/);
      await assert.rejects(asUser(`SELECT public.food_evidence_review_v1(${quote(raw(input))})`,actor,{ session_id:id(999) }),/LIVE_AUTH_SESSION_REQUIRED/);
      await assert.rejects(asUser(`SELECT public.food_evidence_review_v1(${quote(raw(input))})`,actor,{ role:'service_role' }),/AUTH_REQUIRED/);
      await assert.rejects(asUser(`SELECT public.food_evidence_review_v1(${quote(raw({ ...input, actorId:id(2) }))})`),/EXACT_FIELDS_REQUIRED/);
    });
    await t.test('direct writes/private helpers/anon/service-role EXECUTE prohibited under actual privileges',async () => {
      for (const role of ['anon','authenticated','service_role']) {
        await assert.rejects(sql(`SET ROLE ${role}; INSERT INTO potok_food_evidence.current_heads_v1 DEFAULT VALUES`),/permission denied/);
        await assert.rejects(sql(`SET ROLE ${role}; SELECT potok_food_evidence.authority_v1()`),/permission denied/);
        if (role!=='authenticated') await assert.rejects(sql(`SET ROLE ${role}; SELECT public.food_evidence_review_v1('{}')`),/permission denied/);
      }
      assert.equal(await sql("SELECT count(*) FROM pg_class c JOIN pg_namespace n ON n.oid=c.relnamespace WHERE n.nspname='potok_food_evidence' AND c.relkind='r' AND c.relrowsecurity AND c.relforcerowsecurity"),'6');
    });
    let current = await review(await approved(1001));
    const historical = current;
    await t.test('SQL canonical bytes/event/revision digests agree with Phase 1; exact retry and raw retention',async () => {
      const input = await approved(1001), again = await review(input);
      assert.equal(again.replayed,true); assert.equal(again.event.eventId,current.event.eventId);
      assert.equal(current.event.requestDigest,await foodEvidenceRequestDigestRawV1(raw(input)));
      const lengthSpelling = raw(input).replace(`"byteLength":${input.retainedSource.byteLength}`,`"byteLength":${input.retainedSource.byteLength}.0`);
      const numericReplay = JSON.parse(await asUser(`SELECT public.food_evidence_review_v1(${quote(lengthSpelling)})`));
      assert.equal(numericReplay.event.eventId,current.event.eventId);
      assert.equal(await sql(`SELECT original_proposal_bytes=convert_to(${quote(raw(input.proposal))},'UTF8') FROM potok_food_evidence.review_requests_v1 WHERE idempotency_reference=${quote(input.idempotencyReference)}`),'t');
    });
    await t.test('rejection retains proposal/reason but creates NO revision; cross-actor receipts inaccessible',async () => {
      const count = await sql('SELECT count(*) FROM potok_food_evidence.canonical_revisions_v1');
      const input = await rejected(1002), decision = await review(input);
      assert.equal(decision.revision,null); assert.ok(!('revisionId' in decision.event.target));
      assert.equal(await sql('SELECT count(*) FROM potok_food_evidence.canonical_revisions_v1'),count);
      const recovered = JSON.parse(await asUser(`SELECT public.food_evidence_receipt_v1(${quote(input.idempotencyReference)})`));
      assert.equal(recovered.replayed,true);
      assert.deepEqual(recovered,{ ...decision,replayed:true });
      await verifyFoodEvidenceReceiptV1(input,actor,recovered);
      await assert.rejects(asUser(`SELECT public.food_evidence_receipt_v1(${quote(input.idempotencyReference)})`,id(2)),/REQUEST_NOT_FOUND/);
      const malformed = { ...input, idempotencyReference:id(1020),proposal:{ ...input.proposal,source:null } };
      await assert.rejects(asUser(`SELECT public.food_evidence_review_v1(${quote(raw(malformed))})`),/CANONICAL_ROOT_REQUIRED/);
    });
    await t.test('overlapping SAME actor/key requests: one event, one exact replay; conflicting content rejected',async () => {
      const input = await rejected(1003);
      const results = await Promise.all([review(input),review(input)]);
      assert.equal(results[0].event.eventId,results[1].event.eventId);
      assert.deepEqual(results.map(result => result.replayed).sort(),[false,true]);
      await assert.rejects(review({ ...input, reason:'different exact payload' }),/IDEMPOTENCY_PAYLOAD_CONFLICT/);
      assert.equal(await sql(`SELECT count(*) FROM potok_food_evidence.review_requests_v1 WHERE actor_id=${quote(actor)} AND idempotency_reference=${quote(input.idempotencyReference)}`),'1');
    });
    await t.test('concurrent SAME actor/key with different payloads: one winner and a content conflict',async () => {
      const input = await rejected(1021);
      const results = await Promise.allSettled([review(input),review({ ...input,reason:'conflicting concurrent proposal decision' })]);
      assert.equal(results.filter(result => result.status==='fulfilled').length,1);
      const loser = results.find(result => result.status==='rejected'); assert.ok(loser && loser.status==='rejected');
      assert.match(String(loser.reason),/IDEMPOTENCY_PAYLOAD_CONFLICT/);
      assert.equal(await sql(`SELECT count(*) FROM potok_food_evidence.review_events_v1 WHERE actor_id=${quote(actor)} AND idempotency_reference=${quote(input.idempotencyReference)}`),'1');
    });
    await t.test('overlapping DIFFERENT reviewers of shared food: exactly one expected-head CAS winner',async () => {
      const one = { ...await approved(1004), expectedHead:{ revisionId:current.revision.revisionId,digest:current.revision.digest } };
      const two = { ...await approved(1005), expectedHead:one.expectedHead };
      const results = await Promise.allSettled([review(one),review(two,id(2))]);
      assert.equal(results.filter(result => result.status==='fulfilled').length,1);
      const loser = results.find(result => result.status==='rejected'); assert.ok(loser && loser.status==='rejected');
      assert.match(String(loser.reason),/CURRENT_HEAD_CONFLICT/);
      const winner = results.find(result => result.status==='fulfilled'); assert.ok(winner && winner.status==='fulfilled'); current = winner.value;
      assert.equal((await projection()).canonicalRevision.revisionId,current.revision.revisionId);
    });
    const n: NutritionFoodReviewProposalV1 = { contract:'potok-nutrition-review-proposal-v1',canonicalFoodId:foodId,
      canonicalRevisionId:current.revision.revisionId,canonicalRevisionDigest:current.revision.digest, foodState:'raw', applicability:proposal().applicability,
      basis:'PER_100_G_EDIBLE',units:{ calories:'kcal',protein:'g',fat:'g',carbs:'g',fiber:'g' },nutrition:{ calories:'17.200',protein:'1.230',fat:'0.000',carbs:'2.000',fiber:'0.100' } };
    await t.test('nutrition binds exact live canonical revision and all five exact decimals',async () => {
      const input = { ...await approved(1006), proposal:n,proposalDigest:await foodReviewProposalDigestV1(n),retainedSource:source(1106,'synthetic nutrition',false,true) };
      const nutritionReceipt = await review(input); assert.equal((await projection()).nutritionUsable,true);
      const wrong = { ...n, canonicalRevisionDigest:'a'.repeat(64) };
      await assert.rejects(review({ ...input,idempotencyReference:id(1007),proposal:wrong,proposalDigest:await foodReviewProposalDigestV1(wrong),
        expectedHead:{ revisionId:nutritionReceipt.revision.revisionId,digest:nutritionReceipt.revision.digest } }),/EXACT_TARGET_REQUIRED/);
    });
    await t.test('historical invalidation does not replace the current head or invalidate newer nutrition',async () => {
      const input: FoodEvidenceReviewRequestV1 = { contract:'potok-food-evidence-review-request-v1',kind:'INVALIDATION',idempotencyReference:id(1022),
        target:{ kind:'CANONICAL_REVIEWED_REVISION',revisionId:historical.revision.revisionId,digest:historical.revision.digest,canonicalFoodId:foodId },
        retainedSource:source(1122),severity:'SAFETY_CRITICAL',reason:'synthetic historical invalidation' };
      await review(input);
      const state = await projection();
      assert.equal(state.canonicalRevision.revisionId,current.revision.revisionId);
      assert.equal(state.canonicalInvalidation,null); assert.equal(state.canonicalUsable,true); assert.equal(state.nutritionUsable,true);
    });
    await t.test('FK impact inventory: sixteen RESTRICT/NO ACTION links; referenced roots cannot be physically deleted',async () => {
      const edges = JSON.parse(await sql(`SELECT jsonb_agg(jsonb_build_object('child',c.conrelid::regclass::text,
        'parent',c.confrelid::regclass::text,'deleteAction',c.confdeltype,'updateAction',c.confupdtype,
        'deferrable',c.condeferrable,'initiallyDeferred',c.condeferred))
        FROM pg_constraint c JOIN pg_class r ON r.oid=c.conrelid JOIN pg_namespace n ON n.oid=r.relnamespace
        WHERE c.contype='f' AND n.nspname='potok_food_evidence'`)) as Array<{
          child:string;parent:string;deleteAction:string;updateAction:string;deferrable:boolean;initiallyDeferred:boolean }>;
      assert.equal(edges.length,16); assert.ok(edges.every(edge => edge.deleteAction==='r' && edge.updateAction==='a'));
      assert.equal(edges.filter(edge => edge.parent==='foods' || edge.parent==='public.foods').length,4);
      assert.equal(edges.filter(edge => edge.parent==='auth.users').length,2);
      assert.equal(edges.filter(edge => edge.deferrable && edge.initiallyDeferred).length,3);
      await assert.rejects(sql(`DELETE FROM public.foods WHERE id=${quote(foodId)}`),/violates foreign key constraint/);
      assert.equal(await sql(`SELECT count(*) FROM public.foods WHERE id=${quote(foodId)}`),'1');
    });
    await t.test('existing hidden-root guard preserves evidence but denies issuance/read; not an implemented archive workflow',async () => {
      const history = await sql('SELECT jsonb_agg(snapshot ORDER BY event_id) FROM potok_food_evidence.review_events_v1');
      // Synthetic cluster fixture only. No production food mutation or proposed archive RPC is executed.
      await sql(`UPDATE public.foods SET is_searchable=false WHERE id=${quote(foodId)}`);
      try {
        await assert.rejects(review(await rejected(1030)),/SHARED_CANONICAL_ROOT_REQUIRED/);
        await assert.rejects(projection(),/SHARED_CANONICAL_ROOT_REQUIRED/);
        assert.equal(await sql('SELECT jsonb_agg(snapshot ORDER BY event_id) FROM potok_food_evidence.review_events_v1'),history);
      } finally { await sql(`UPDATE public.foods SET is_searchable=true WHERE id=${quote(foodId)}`); }
    });
    await t.test('bad source and catalog proposal roll back ALL artifacts, receipts and projection',async () => {
      const count = await sql('SELECT count(*) FROM potok_food_evidence.review_events_v1');
      const input = { ...await approved(1008),expectedHead:{ revisionId:current.revision.revisionId,digest:current.revision.digest } };
      await assert.rejects(asUser(`SELECT public.food_evidence_review_v1(${quote(raw({ ...input,retainedSource:{ ...input.retainedSource,sourceBytesSha256:'0'.repeat(64) } }))})`),/SOURCE_SHA256_MISMATCH/);
      const wrong = proposal(); wrong.identitySnapshot.name='foreign identity';
      await assert.rejects(review({ ...input,proposal:wrong,proposalDigest:await foodReviewProposalDigestV1(wrong) }),/CATALOG_SNAPSHOT_CONFLICT/);
      assert.equal(await sql('SELECT count(*) FROM potok_food_evidence.review_events_v1'),count);
      assert.equal((await projection()).canonicalRevision.revisionId,current.revision.revisionId);
      const empty = { ...input,retainedSource:source(1108,'') };
      await assert.rejects(asUser(`SELECT public.food_evidence_review_v1(${quote(raw(empty).replace('"byteLength":0','"byteLength":-0'))})`),/NEGATIVE_ZERO_FORBIDDEN/);
      const alteredSource = source(1101,'different retained bytes');
      await assert.rejects(review({ ...input,idempotencyReference:id(1023),retainedSource:alteredSource }),/SOURCE_ARTIFACT_ID_CONFLICT/);
      assert.equal(await sql('SELECT count(*) FROM potok_food_evidence.review_events_v1'),count);
      const wrongTarget: FoodEvidenceReviewRequestV1 = { contract:'potok-food-evidence-review-request-v1',kind:'INVALIDATION',idempotencyReference:id(1024),
        target:{ kind:'CANONICAL_REVIEWED_REVISION',revisionId:current.revision.revisionId,digest:current.revision.digest,canonicalFoodId:id(999) },
        retainedSource:source(1124),severity:'CORRECTION',reason:'synthetic wrong-root request' };
      await assert.rejects(review(wrongTarget),/EXACT_TARGET_REQUIRED/);
    });
    await t.test('SAFETY_CRITICAL invalidation disables dependent nutrition and never downgrades or rolls back a head',async () => {
      const input: FoodEvidenceReviewRequestV1 = { contract:'potok-food-evidence-review-request-v1',kind:'INVALIDATION',idempotencyReference:id(1009),
        target:{ kind:'CANONICAL_REVIEWED_REVISION',revisionId:current.revision.revisionId,digest:current.revision.digest,canonicalFoodId:foodId },
        retainedSource:source(1109),severity:'SAFETY_CRITICAL',reason:'synthetic safety invalidation' };
      await review(input); const state = await projection();
      assert.equal(state.canonicalUsable,false); assert.equal(state.nutritionUsable,false); assert.equal(state.canonicalInvalidation,'SAFETY_CRITICAL');
      await review({ ...input,idempotencyReference:id(1010),severity:'CORRECTION',reason:'synthetic subsequent correction' });
      assert.equal((await projection()).canonicalInvalidation,'SAFETY_CRITICAL');
      assert.equal((await projection()).canonicalRevision.revisionId,current.revision.revisionId);
      await assert.rejects(review({ ...input,idempotencyReference:id(1011),target:{ ...input.target,digest:'a'.repeat(64) } }),/EXACT_TARGET_REQUIRED/);
    });
    await t.test('immutable tables resist UPDATE/DELETE/TRUNCATE even from the SQL owner',async () => {
      for (const table of ['retained_sources_v1','canonical_revisions_v1','nutrition_revisions_v1','review_events_v1','review_requests_v1']) {
        await assert.rejects(sql(`DELETE FROM potok_food_evidence.${table}`),/IMMUTABLE_FOOD_EVIDENCE/);
        await assert.rejects(sql(`TRUNCATE potok_food_evidence.${table} CASCADE`),/IMMUTABLE_FOOD_EVIDENCE/);
      }
      await assert.rejects(sql("UPDATE potok_food_evidence.review_events_v1 SET digest=repeat('0',64)"),/IMMUTABLE_FOOD_EVIDENCE/);
    });
    await t.test('revocation blocks exact receipt replay; is_admin/metadata cannot restore authority',async () => {
      const input = await rejected(1012); await review(input,id(2));
      await sql(`SELECT potok_control.revoke_entitlement_v2(${quote(id(2))},'admin','synthetic revoke','synthetic local test')`);
      await sql(`UPDATE public.user_profiles SET is_admin=true WHERE user_id=${quote(id(2))}`);
      await assert.rejects(review(input,id(2)),/VERIFIED_ADMIN_REQUIRED/);
    });
    await t.test('existing trusted-entitlement FK still blocks physical Auth deletion after synthetic session/profile cleanup',async () => {
      const account = quote(id(2));
      const attestations = await sql(`SELECT count(*) FROM potok_control.access_attestations WHERE account_id=${account}`);
      // This is deliberately a failing local-fixture transaction, NOT an Auth deletion implementation.
      await assert.rejects(sql(`BEGIN; DELETE FROM auth.sessions WHERE user_id=${account};
        DELETE FROM public.user_profiles WHERE user_id=${account}; DELETE FROM auth.users WHERE id=${account}; COMMIT;`),
      /access_attestations_account_fk/);
      assert.equal(await sql(`SELECT count(*) FROM potok_control.access_attestations WHERE account_id=${account}`),attestations);
      assert.equal(await sql(`SELECT count(*) FROM auth.users WHERE id=${account}`),'1');
      assert.equal(await sql(`SELECT count(*) FROM auth.sessions WHERE user_id=${account}`),'1');
      assert.equal(await sql(`SELECT count(*) FROM public.user_profiles WHERE user_id=${account}`),'1');
    });
    await t.test('existing foods/aliases/diary snapshots and historical nutrition are unchanged',async () => {
      const after = await sql(`SELECT jsonb_build_object('foods',(SELECT jsonb_agg(to_jsonb(f)) FROM public.foods f),
        'aliases',(SELECT jsonb_agg(to_jsonb(f)) FROM public.food_aliases f),'diary',(SELECT jsonb_agg(to_jsonb(f)) FROM public.food_diary_entries f))`);
      assert.equal(after,before);
    });
    await t.test('current-state read rechecks JWT expiry after a real competing food-lock wait',async () => {
      const lock = `hashtextextended('potok-food-evidence-v1:'||${quote(foodId)},0)`;
      const competing = sql(`BEGIN; SELECT pg_advisory_xact_lock(${lock}); SELECT pg_sleep(3); COMMIT;`);
      try {
        const deadline = Date.now()+2000;
        let held = false;
        while (Date.now()<deadline) {
          if (await sql(`SELECT pg_try_advisory_xact_lock(${lock})`)==='f') { held = true; break; }
          await new Promise(resolve => setTimeout(resolve,25));
        }
        assert.equal(held,true,'competing PostgreSQL session must actually hold the food lock');
        await assert.rejects(asUser(`SELECT public.food_evidence_current_v1(${quote(foodId)},'raw')`,actor,
          { exp:Math.floor(Date.now()/1000)+1 }),/JWT_EXPIRED/);
      } finally { await competing; }
    });
  } finally {
    if (started) await run('pg_ctl',['-D',data,'-m','immediate','-w','stop'],{ env, timeout:30_000 });
    await rm(root,{ recursive:true,force:true });
  }
});
