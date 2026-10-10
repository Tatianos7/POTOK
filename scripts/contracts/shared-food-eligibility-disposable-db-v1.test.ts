/** Real PostgreSQL acceptance, never a Supabase test or an in-memory database model.
 * Creates and destroys its OWN Unix-socket-only cluster. No database URL option.
 * Default Auth fixtures simulate verified claims. Separate REQUIRED transport mode
 * verifies real signatures against own local PostgREST, NOT deployed Supabase/JWKS.
 */
import test from 'node:test';
import { stageCCatalogAcceptance } from './stage-c-catalog-acceptance';
import { retryCatalogTransactionV1, retryableCatalogFailureV1 } from './catalogTransactionRetryV1';
import assert from 'node:assert/strict';
import { spawn, spawnSync, execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { mkdtemp, mkdir, readFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { approved, rejected, proposal, source, actor, foodId, id } from '../../src/server/__tests__/foodEvidenceFixturesV1';
import { foodReviewProposalDigestV1, foodEvidenceRequestDigestRawV1, type FoodEvidenceReviewRequestV1,
  type NutritionFoodReviewProposalV1 } from '../../src/server/foodEvidenceReviewRequestV1';
import { sharedFoodIdentityFingerprintV1, sharedFoodEligibilityRequestDigestRawV1 } from '../../src/server/sharedFoodEligibilityV1';
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

test('Shared Food Eligibility disposable PostgreSQL: authorization, FORCE RLS, atomicity, immutability and REAL multi-session concurrency', { skip:requireDatabase ? false : skip, timeout:180_000 }, async t => {
  if (skip) assert.fail(skip);
  const root = await mkdtemp(join(tmpdir(),'potok-food-evidence-pg-'));
  const data = join(root,'data'), socket = join(root,'socket'), port = '54329';
  await mkdir(socket,{ mode:0o700 });
  let started = false;
  const sql = async (statement: string, timeoutMs=30_000): Promise<string> => {
    const result = await run('psql',['-X','-q','-A','-t','-v','ON_ERROR_STOP=1','-h',socket,'-p',port,'-U','postgres','-d','postgres','-c',statement],
      { env, timeout:timeoutMs, maxBuffer:4_194_304 });
    return result.stdout.trim();
  };
  // Real independent backend sessions with explicit barriers; no sleeps pretending to prove overlap.
  let sessionSequence=0;
  const session=() => {
    const child=spawn('psql',['-X','-q','-A','-t','-v','ON_ERROR_STOP=1','-v','VERBOSITY=verbose',
      '-h',socket,'-p',port,'-U','postgres','-d','postgres'],{env,timeout:30_000});
    let output='',errors='',marker='',pending: {resolve:()=>void;reject:(e:Error)=>void}|null=null;
    child.stdout.setEncoding('utf8');child.stderr.setEncoding('utf8');
    child.stdout.on('data',(data:string)=>{output+=data;if(pending && output.split('\n').includes(marker)) {
      const active=pending;pending=null;output='';active.resolve(); }});
    child.stderr.on('data',(data:string)=>{errors+=data;});
    const closed=new Promise<void>(resolve=>{child.on('close',()=>{pending?.reject(new Error(errors||'session closed'));pending=null;resolve();});});
    child.on('error',e=>{pending?.reject(e);pending=null;});
    return {
      send:(statement:string)=>new Promise<void>((resolve,reject)=>{
        assert.equal(pending,null,'one command per backend at a time');
        marker=`potok_test_marker_${++sessionSequence}`;pending={resolve,reject};
        child.stdin.write(`${statement}; SELECT ${quote(marker)};\n`);
      }),
      close:async()=>{child.stdin.end();await closed;},
    };
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
      CREATE TABLE public.foods(id uuid PRIMARY KEY,canonical_food_id uuid,stable_food_id text,source text NOT NULL,created_by_user_id uuid,
        name text NOT NULL,name_original text,normalized_name text,brand text,normalized_brand text,barcode text,aliases text[]);
      CREATE TABLE public.food_aliases(id uuid PRIMARY KEY,canonical_food_id uuid,alias text);
      CREATE TABLE public.food_diary_entries(id uuid PRIMARY KEY,calories numeric,protein numeric,fat numeric,carbs numeric);
      INSERT INTO public.foods VALUES (${quote(foodId)},${quote(foodId)},'synthetic_root','core',NULL,'Synthetic food',NULL,'synthetic food',NULL,NULL,NULL,'{}');
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

    const registry = await readFile('supabase/migration_drafts/shared_food_eligibility_v1.sql','utf8');
    await sql("SET potok_shared_food_eligibility.test_target='disposable-postgresql-only';"+registry);
    type EligibilityReceipt = { decisionId:string; version:string; catalogIdentityEpoch:string; identityFingerprint:string; replayed:boolean };
    const binding = async (fid=foodId) => JSON.parse(await sql(`SELECT jsonb_build_object('catalogIdentityEpoch',coalesce((SELECT identity_epoch::text FROM potok_shared_food_eligibility.roots_v1 WHERE food_id=${quote(fid)}),'0'),
      'identityFingerprint',potok_shared_food_eligibility.fingerprint_v1(to_jsonb(f))) FROM public.foods f WHERE f.id=${quote(fid)}`)) as { catalogIdentityEpoch:string;identityFingerprint:string };
    const eligibilityInput = async (status:string,key:number,head:EligibilityReceipt|null,fid=foodId) => ({
      contract:'potok-shared-food-eligibility-request-v1',foodId:fid,idempotencyReference:id(key),expectedHead:head ? { decisionId:head.decisionId,version:head.version }:null,
      ...await binding(fid),status,reason:'synthetic disposable decision' });
    const decide = async (input:object,user=actor) => JSON.parse(await asUser(`SELECT public.shared_food_eligibility_decide_v1(${quote(raw(input))})`,user)) as EligibilityReceipt;
    await t.test('Staging-shaped schema without flags; empty registry denies NEW approvals, not legacy data reads',async () => {
      assert.equal(await sql("SELECT count(*) FROM information_schema.columns WHERE table_schema='public' AND table_name='foods' AND column_name IN ('is_searchable','needs_review')"),'0');
      await assert.rejects(review(await approved(2000)),/EXPLICIT_SHARED_FOOD_ELIGIBILITY_REQUIRED/);
      assert.equal((await projection()).canonicalUsable,false);
      assert.equal(await sql(`SELECT jsonb_build_object('foods',(SELECT jsonb_agg(to_jsonb(f)) FROM public.foods f),
        'aliases',(SELECT jsonb_agg(to_jsonb(f)) FROM public.food_aliases f),'diary',(SELECT jsonb_agg(to_jsonb(f)) FROM public.food_diary_entries f))`),before);
    });
    await t.test('SQL and TypeScript fingerprints agree on exact UTF-8 and nullable aliases',async()=>{
      const identity={foodId,canonicalFoodId:foodId,foodStableId:'synthetic_root',source:'core' as const,createdByUserId:null,
        identitySnapshot:{name:'Synthetic food',nameOriginal:null,normalizedName:'synthetic food',brand:null,normalizedBrand:null,barcode:null,aliases:[] as string[]}};
      assert.equal((await binding()).identityFingerprint,await sharedFoodIdentityFingerprintV1(identity));
      const unicode={...identity,identitySnapshot:{...identity.identitySnapshot,name:'Синтетический 😀',aliases:null}};
      const fp=await sql(`SELECT potok_shared_food_eligibility.fingerprint_v1(to_jsonb(f)||jsonb_build_object('name','Синтетический 😀','aliases',NULL)) FROM public.foods f WHERE id=${quote(foodId)}`);
      assert.equal(fp,await sharedFoodIdentityFingerprintV1(unicode));
    });
    await t.test('empty registry still prohibits catalog TRUNCATE: explicit compatibility restriction',async()=>{
      assert.equal(await sql('SELECT count(*) FROM potok_shared_food_eligibility.roots_v1'),'0');
      await assert.rejects(sql('TRUNCATE public.foods CASCADE'),/REGISTERED_IDENTITY_TRUNCATE_FORBIDDEN/);
      assert.equal(await sql(`SELECT count(*) FROM public.foods WHERE id=${quote(foodId)}`),'1');
    });
    let eligibilityHead=await decide(await eligibilityInput('PENDING',2001,null));
    await t.test('exact idempotency replay vs content conflict and strict boundary',async () => {
      const input=await eligibilityInput('PENDING',2001,null);
      assert.equal((await decide(input)).replayed,true);
      const sqlDigest=await sql(`SELECT request_digest FROM potok_shared_food_eligibility.receipts_v1 WHERE idempotency_reference=${quote(id(2001))}`);
      assert.equal(sqlDigest,await sharedFoodEligibilityRequestDigestRawV1(raw(input)));
      const replayResults=await Promise.all([decide(input),decide(input)]);assert.ok(replayResults.every(r=>r.replayed));
      await assert.rejects(decide({ ...input,reason:'different' }),/IDEMPOTENCY_CONTENT_CONFLICT/);
      await assert.rejects(decide({ ...input,actorId:actor }),/EXACT_FIELDS_REQUIRED/);
      await assert.rejects(asUser(`SELECT public.shared_food_eligibility_decide_v1(${quote(raw(input).replace('"status":"PENDING"','"status":"PENDING","status":"ELIGIBLE"'))})`),/DUPLICATE_JSON_KEY/);
      await assert.rejects(decide({ ...input,idempotencyReference:id(2099),status:'ARCHIVED' }),/STATUS_NOT_IMPLEMENTED/);
      await assert.rejects(decide(await eligibilityInput('ELIGIBLE',2098,eligibilityHead),id(3)),/VERIFIED_ADMIN_REQUIRED/);
      for (const role of ['anon','authenticated','service_role']) {
        await assert.rejects(sql(`SET ROLE ${role}; INSERT INTO potok_shared_food_eligibility.heads_v1 DEFAULT VALUES`),/permission denied/);
        await assert.rejects(sql(`SET ROLE ${role}; SELECT potok_shared_food_eligibility.eligible_v1('{}')`),/permission denied/);
        if(role!=='authenticated') await assert.rejects(sql(`SET ROLE ${role}; SELECT public.shared_food_eligibility_decide_v1('{}')`),/permission denied/);
      }
      assert.equal(await sql("SELECT count(*) FROM pg_class c JOIN pg_namespace n ON n.oid=c.relnamespace WHERE n.nspname='potok_shared_food_eligibility' AND c.relkind='r' AND c.relrowsecurity AND c.relforcerowsecurity"),'5');
    });
    eligibilityHead=await decide(await eligibilityInput('ELIGIBLE',2002,eligibilityHead));

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
      await assert.rejects(sql(`DELETE FROM public.foods WHERE id=${quote(foodId)}`),/REGISTERED_IDENTITY_DELETE_FORBIDDEN/);
      assert.equal(await sql(`SELECT count(*) FROM public.foods WHERE id=${quote(foodId)}`),'1');
    });
    await t.test('HIDDEN denies approval/usability but permits rejection and exact historical invalidation',async () => {
      eligibilityHead=await decide(await eligibilityInput('HIDDEN',2010,eligibilityHead));
      await assert.rejects(review(await approved(1031)),/EXPLICIT_SHARED_FOOD_ELIGIBILITY_REQUIRED/);
      assert.equal((await projection()).canonicalUsable,false);
      await review({contract:'potok-food-evidence-review-request-v1',kind:'INVALIDATION',idempotencyReference:id(2013),
        target:{kind:'CANONICAL_REVIEWED_REVISION',revisionId:historical.revision.revisionId,digest:historical.revision.digest,canonicalFoodId:foodId},
        retainedSource:source(2014),severity:'CORRECTION',reason:'synthetic hidden historical invalidation'});
      const receipt=await review(await rejected(1030));
      assert.ok(receipt.event.eventId);
      eligibilityHead=await decide(await eligibilityInput('ELIGIBLE',2011,eligibilityHead));
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
    await t.test('ABA advances trusted epoch twice; restored bytes do not restore eligibility',async () => {
      const old=await binding();
      await sql(`UPDATE public.foods SET name='Changed identity' WHERE id=${quote(foodId)}`);
      await sql(`UPDATE public.foods SET name='Synthetic food' WHERE id=${quote(foodId)}`);
      const restored=await binding();
      assert.equal(restored.identityFingerprint,old.identityFingerprint);
      assert.equal(BigInt(restored.catalogIdentityEpoch),BigInt(old.catalogIdentityEpoch)+2n);
      assert.equal((await projection()).canonicalUsable,false);
      const stale={ ...await eligibilityInput('HIDDEN',2020,eligibilityHead),...old };
      await assert.rejects(decide(stale),/IDENTITY_BINDING_CONFLICT/);
      eligibilityHead=await decide(await eligibilityInput('HIDDEN',2050,eligibilityHead));
      eligibilityHead=await decide(await eligibilityInput('ELIGIBLE',2051,eligibilityHead));
      // Reapproving current identity does not revive old reviewed revisions issued before ABA.
      assert.equal((await projection()).canonicalUsable,false);
      await assert.rejects(sql(`UPDATE public.foods SET stable_food_id='reused_key' WHERE id=${quote(foodId)}`),/REGISTERED_IDENTITY_KEY_IMMUTABLE/);
      await assert.rejects(sql(`TRUNCATE public.foods CASCADE`),/REGISTERED_IDENTITY_TRUNCATE_FORBIDDEN|IMMUTABLE_FOOD_EVIDENCE/);
    });
    await sql(`SELECT potok_control.grant_entitlement_v2(${quote(id(2))},'admin',NULL,'synthetic-local-test','synthetic CAS authorization fixture')`);
    await t.test('two authorized reviewers race the same decision CAS; one winner',async () => {
      const a=await eligibilityInput('HIDDEN',2021,eligibilityHead);
      const b=await eligibilityInput('BLOCKED',2022,eligibilityHead);
      const results=await Promise.allSettled([decide(a,actor),decide(b,id(2))]);
      assert.equal(results.filter(r=>r.status==='fulfilled').length,1);
      const loser=results.find(r=>r.status==='rejected');assert.ok(loser && loser.status==='rejected');
      assert.match(String(loser.reason),/DECISION_HEAD_CONFLICT/);
      const winner=results.find(r=>r.status==='fulfilled');assert.ok(winner && winner.status==='fulfilled');
      eligibilityHead=winner.value;
    });
    await t.test('stable key race across different roots: no duplicate registered identity',async () => {
      await assert.rejects(sql(`BEGIN ISOLATION LEVEL REPEATABLE READ; INSERT INTO public.foods(id,canonical_food_id,stable_food_id,source,name) VALUES(${quote(id(3099))},${quote(id(3099))},'stale_snapshot','core','Denied'); COMMIT;`),/READ_COMMITTED_CATALOG_WRITER_REQUIRED/);
      const first=id(3001),second=id(3002),key='racing_shared_key';
      const insert=(fid:string)=>sql(`INSERT INTO public.foods(id,canonical_food_id,stable_food_id,source,name,aliases)
        VALUES(${quote(fid)},${quote(fid)},${quote(key)},'core','Race root','{}')`);
      await insert(first);
      const input=await eligibilityInput('PENDING',2030,null,first);
      const results=await Promise.allSettled([decide(input),insert(second)]);
      assert.ok(results.some(r=>r.status==='fulfilled'));
      assert.ok(results.some(r=>r.status==='rejected'));
      const claimsCount=Number(await sql(`SELECT count(*) FROM potok_shared_food_eligibility.roots_v1 WHERE stable_key=${quote(key)}`));
      const foodsCount=Number(await sql(`SELECT count(*) FROM public.foods WHERE stable_food_id=${quote(key)}`));
      if(claimsCount===1) assert.equal(foodsCount,1); else { assert.equal(foodsCount,2);
        await assert.rejects(decide(await eligibilityInput('PENDING',2031,null,second)),/DUPLICATE_STABLE_KEY/); }
      await assert.rejects(sql(`INSERT INTO public.foods(id,canonical_food_id,stable_food_id,source,name)
        VALUES(${quote(id(3003))},${quote(id(3003))},'synthetic_root','core','Reuse')`),/STABLE_KEY_ALREADY_CLAIMED/);
    });
    await t.test('cross-package approval/hide and importer/update races share the root lock',async()=>{
      const fid=id(3060);
      await sql(`INSERT INTO public.foods(id,canonical_food_id,stable_food_id,source,name,normalized_name,aliases)
        VALUES(${quote(fid)},${quote(fid)},'cross_package_root','core','Synthetic food','synthetic food','{}')`);
      let head=await decide(await eligibilityInput('PENDING',2060,null,fid));
      head=await decide(await eligibilityInput('ELIGIBLE',2061,head,fid));
      const initial=await approved(2062);
      const p={...initial.proposal,canonicalFoodId:fid,foodStableId:'cross_package_root'};
      const approveInput={...initial,proposal:p,proposalDigest:await foodReviewProposalDigestV1(p)};
      const hidden=await eligibilityInput('HIDDEN',2063,head,fid);
      const races=await Promise.allSettled([review(approveInput,actor),decide(hidden,id(2))]);
      assert.equal(races[1].status,'fulfilled');
      if(races[0].status==='rejected') assert.match(String(races[0].reason),/EXPLICIT_SHARED_FOOD_ELIGIBILITY_REQUIRED/);
      assert.ok(races[1].status==='fulfilled');head=races[1].value;
      assert.equal(JSON.parse(await asUser(`SELECT public.food_evidence_current_v1(${quote(fid)},'raw')`)).canonicalUsable,false);
      head=await decide(await eligibilityInput('ELIGIBLE',2064,head,fid));
      const currentHead=JSON.parse(await asUser(`SELECT public.food_evidence_current_v1(${quote(fid)},'raw')`)).canonicalRevision;
      const next={...approveInput,idempotencyReference:id(2065),expectedHead:currentHead ? {revisionId:currentHead.revisionId,digest:currentHead.digest}:null};
      const mutationRaces=await Promise.allSettled([review(next,actor),sql(`BEGIN; SELECT potok_food_evidence.catalog_gate_v1(); UPDATE public.foods SET name='Importer changed identity' WHERE id=${quote(fid)}; COMMIT`)]);
      assert.equal(mutationRaces[1].status,'fulfilled');
      if(mutationRaces[0].status==='rejected') assert.match(String(mutationRaces[0].reason),/EXPLICIT_SHARED_FOOD_ELIGIBILITY_REQUIRED|CATALOG_SNAPSHOT_CONFLICT/);
      assert.equal((await binding(fid)).catalogIdentityEpoch,'1');
      assert.equal(JSON.parse(await asUser(`SELECT public.food_evidence_current_v1(${quote(fid)},'raw')`)).canonicalUsable,false);
    });
    await t.test('immutable eligibility decisions and receipts, archive/clearance fail closed',async () => {
      for(const table of ['decisions_v1','receipts_v1','evidence_bindings_v1']) {
        await assert.rejects(sql(`DELETE FROM potok_shared_food_eligibility.${table}`),/IMMUTABLE_FOOD_EVIDENCE/);
        await assert.rejects(sql(`TRUNCATE potok_shared_food_eligibility.${table}`),/IMMUTABLE_FOOD_EVIDENCE|foreign key constraint/);
      }
      const row=JSON.parse(await sql(`SELECT jsonb_build_object('status',d.status) FROM potok_shared_food_eligibility.heads_v1 h
        JOIN potok_shared_food_eligibility.decisions_v1 d USING(decision_id) WHERE h.food_id=${quote(foodId)}`));
      if(row.status==='HIDDEN') eligibilityHead=await decide(await eligibilityInput('BLOCKED',2040,eligibilityHead));
      await assert.rejects(decide(await eligibilityInput('ELIGIBLE',2041,eligibilityHead)),/BLOCKED_CLEARANCE_NOT_APPROVED/);
      await assert.rejects(decide(await eligibilityInput('ARCHIVED',2042,eligibilityHead)),/STATUS_NOT_IMPLEMENTED/);
      await assert.rejects(review(await approved(2043)),/EXPLICIT_SHARED_FOOD_ELIGIBILITY_REQUIRED/);
      assert.equal((await projection()).canonicalUsable,false);
      const r=await review(await rejected(2044));assert.ok(r.event.eventId);
      const oldTarget={ kind:'CANONICAL_REVIEWED_REVISION' as const, revisionId:current.revision.revisionId,
        digest:current.revision.digest,canonicalFoodId:foodId };
      await review({ contract:'potok-food-evidence-review-request-v1',kind:'INVALIDATION',idempotencyReference:id(2045),
        target:oldTarget,retainedSource:source(2046,'blocked historical invalidation'),severity:'SAFETY_CRITICAL',reason:'synthetic safety decision' });
    });
    await t.test('fresh concurrent eligibility request creates exactly one immutable decision',async()=>{
      const fid=id(3050);
      await sql(`INSERT INTO public.foods(id,canonical_food_id,stable_food_id,source,name,aliases) VALUES(${quote(fid)},${quote(fid)},'concurrent_new_claim','core','Concurrency fixture','{}')`);
      const input=await eligibilityInput('PENDING',2052,null,fid);
      const results=await Promise.all([decide(input),decide(input)]);
      assert.equal(results.filter(r=>r.replayed).length,1);
      assert.equal(results[0].decisionId,results[1].decisionId);
      assert.equal(await sql(`SELECT count(*) FROM potok_shared_food_eligibility.decisions_v1 WHERE food_id=${quote(fid)}`),'1');
    });
    await t.test('eligibility writer rechecks JWT expiry after real root-lock wait',async()=>{
      const input=await eligibilityInput('HIDDEN',2053,eligibilityHead);
      const competing=sql(`BEGIN; SELECT id FROM public.foods WHERE id=${quote(foodId)} FOR UPDATE; SELECT pg_sleep(3); COMMIT;`);
      try {
        const deadline=Date.now()+2000;let held=false;
        while(Date.now()<deadline) {
          try { await sql(`BEGIN; SELECT id FROM public.foods WHERE id=${quote(foodId)} FOR UPDATE NOWAIT; COMMIT;`); }
          catch(error) { if(/could not obtain lock/.test(String(error))) { held=true;break; } throw error; }
          await new Promise(resolve=>setTimeout(resolve,25));
        }
        assert.equal(held,true);
        await assert.rejects(asUser(`SELECT public.shared_food_eligibility_decide_v1(${quote(raw(input))})`,actor,
          {exp:Math.floor(Date.now()/1000)+1}),/JWT_EXPIRED/);
      } finally { await competing; }
    });
    await t.test('trusted admin attestation expiry during root wait prevents eligibility write',async()=>{
      await sql(`SELECT potok_control.grant_entitlement_v2(${quote(id(2))},'admin',clock_timestamp()+interval '2 seconds','synthetic-local-test','synthetic expiring authority')`);
      const input=await eligibilityInput('HIDDEN',2054,eligibilityHead);
      const competing=sql(`BEGIN; SELECT id FROM public.foods WHERE id=${quote(foodId)} FOR UPDATE; SELECT pg_sleep(4); COMMIT;`);
      try {
        const deadline=Date.now()+2000;let held=false;
        while(Date.now()<deadline) {
          try { await sql(`BEGIN; SELECT id FROM public.foods WHERE id=${quote(foodId)} FOR UPDATE NOWAIT; COMMIT;`); }
          catch(error) { if(/could not obtain lock/.test(String(error))) { held=true;break; } throw error; }
          await new Promise(resolve=>setTimeout(resolve,25));
        }
        assert.equal(held,true);
        await assert.rejects(decide(input,id(2)),/VERIFIED_ADMIN_REQUIRED|ADMIN_PROVENANCE_MISMATCH/);
      } finally { await competing; }
    });
    await t.test('private CRUD under ownership RLS succeeds in RC; non-RC writes fail but reads work',async()=>{
      const fid=id(4010);
      await sql(`ALTER TABLE public.foods ENABLE ROW LEVEL SECURITY; GRANT SELECT,INSERT,UPDATE,DELETE ON public.foods TO authenticated;
        CREATE POLICY compat_private_select ON public.foods FOR SELECT TO authenticated USING(source='user' AND created_by_user_id=auth.uid());
        CREATE POLICY compat_private_insert ON public.foods FOR INSERT TO authenticated WITH CHECK(source='user' AND created_by_user_id=auth.uid());
        CREATE POLICY compat_private_update ON public.foods FOR UPDATE TO authenticated USING(source='user' AND created_by_user_id=auth.uid()) WITH CHECK(source='user' AND created_by_user_id=auth.uid());
        CREATE POLICY compat_private_delete ON public.foods FOR DELETE TO authenticated USING(source='user' AND created_by_user_id=auth.uid());`);
      try {
        await asUser(`INSERT INTO public.foods(id,source,created_by_user_id,name) VALUES(${quote(fid)},'user',${quote(actor)},'Private fixture')`);
        await asUser(`UPDATE public.foods SET canonical_food_id=id,name='Private updated' WHERE id=${quote(fid)}`);
        assert.equal(await asUser(`SELECT count(*) FROM public.foods WHERE id=${quote(fid)}`,id(3)),'0');
        await asUser(`DELETE FROM public.foods WHERE id=${quote(fid)}`,id(3));
        assert.equal(await sql(`SELECT name FROM public.foods WHERE id=${quote(fid)}`),'Private updated');
        for(const level of ['REPEATABLE READ','SERIALIZABLE']) {
          await assert.rejects(sql(`BEGIN ISOLATION LEVEL ${level}; UPDATE public.foods SET name='Denied' WHERE id=${quote(fid)}; COMMIT;`),/READ_COMMITTED_CATALOG_WRITER_REQUIRED/);
          assert.equal(await sql(`BEGIN ISOLATION LEVEL ${level}; SELECT name FROM public.foods WHERE id=${quote(fid)}; COMMIT;`),'Private updated');
        }
        assert.equal(await sql(`SELECT count(*) FROM potok_shared_food_eligibility.roots_v1 WHERE food_id=${quote(fid)}`),'0');
        await asUser(`DELETE FROM public.foods WHERE id=${quote(fid)}`);
        assert.equal(await sql(`SELECT count(*) FROM public.foods WHERE id=${quote(fid)}`),'0');
      } finally {
        await sql(`DROP POLICY compat_private_select ON public.foods; DROP POLICY compat_private_insert ON public.foods;
          DROP POLICY compat_private_update ON public.foods; DROP POLICY compat_private_delete ON public.foods;
          REVOKE SELECT,INSERT,UPDATE,DELETE ON public.foods FROM authenticated; ALTER TABLE public.foods DISABLE ROW LEVEL SECURITY;`);
      }
    });
    await t.test('opposite multi-row writer order deadlocks; victim rollback and whole-transaction retry preserve epoch',async()=>{
      const ids=[id(4020),id(4021)];
      for(const [i,fid] of ids.entries()) {
        await sql(`INSERT INTO public.foods(id,canonical_food_id,stable_food_id,source,name) VALUES(${quote(fid)},${quote(fid)},'multi_root_${i}','core','Before')`);
        await decide(await eligibilityInput('PENDING',4022+i,null,fid));
      }
      const a=session(),b=session();
      try {
        await a.send('BEGIN');await b.send('BEGIN');
        await a.send(`UPDATE public.foods SET name='A' WHERE id=${quote(ids[0])}`);
        await b.send(`UPDATE public.foods SET name='B' WHERE id=${quote(ids[1])}`);
        const results=await Promise.allSettled([a.send(`UPDATE public.foods SET name='A' WHERE id=${quote(ids[1])}`),b.send(`UPDATE public.foods SET name='B' WHERE id=${quote(ids[0])}`)]);
        assert.equal(results.filter(r=>r.status==='rejected').length,1);
        const victim=results.find(r=>r.status==='rejected');assert.ok(victim && victim.status==='rejected');assert.match(String(victim.reason),/40P01/);
        const winner=results[0].status==='fulfilled'?a:b;await winner.send('COMMIT');
        const expected=results[0].status==='fulfilled'?'A':'B';
        for(const fid of ids) { assert.equal(await sql(`SELECT name FROM public.foods WHERE id=${quote(fid)}`),expected);assert.equal((await binding(fid)).catalogIdentityEpoch,'1'); }
        // Native deadlock + database rollback verified above; adapter retry is NOT importer wiring.
        let attempts=0;
        await retryCatalogTransactionV1(async remainingMs=>{
          assert.ok(remainingMs>0 && remainingMs<=15000);
          if(attempts++===0) { const native=String(victim.reason);
            return {ok:false,error:{code:'40P01',routine:native.match(/LOCATION:\s+(\w+),/)?.[1],rollbackConfirmed:true}}; }
          await sql(`BEGIN; SELECT potok_food_evidence.catalog_gate_v1(); SELECT id FROM public.foods WHERE id IN (${ids.map(quote).join(',')}) ORDER BY id FOR UPDATE;
          UPDATE public.foods SET name='Retried' WHERE id IN (${ids.map(quote).join(',')}); COMMIT;`,Math.ceil(remainingMs));
          return {ok:true,value:true}; });
        assert.equal(attempts,2);
        for(const fid of ids) assert.equal((await binding(fid)).catalogIdentityEpoch,'2');
      } finally { await Promise.all([a.close(),b.close()]); }
    });
    await t.test('INSERT ON CONFLICT key-before-row inversion is a confirmed BLOCKER, not compatibility PASS',async()=>{
      const fid=id(4030),key='upsert_lock_inversion';
      await sql(`INSERT INTO public.foods(id,canonical_food_id,stable_food_id,source,name) VALUES(${quote(fid)},${quote(fid)},${quote(key)},'core','Before')`);
      await decide(await eligibilityInput('PENDING',4031,null,fid));
      const a=session(),b=session();
      const keyLock=`hashtextextended('potok-shared-food-key-v1:'||${quote(key)},0)`;
      try {
        await a.send(`BEGIN; SELECT id FROM public.foods WHERE id=${quote(fid)} FOR UPDATE`);
        await b.send('BEGIN');
        const upsert=b.send(`INSERT INTO public.foods(id,canonical_food_id,stable_food_id,source,name) VALUES(${quote(fid)},${quote(fid)},${quote(key)},'core','Upserted') ON CONFLICT(id) DO UPDATE SET name=excluded.name`);
        // Attach rejection handler before starting the other half of the deadlock.
        const observed=Promise.allSettled([upsert]);
        let held=false;const deadline=Date.now()+2000;
        while(Date.now()<deadline) {
          if(await sql(`SELECT pg_try_advisory_xact_lock(${keyLock})`)==='f') { held=true;break; }
          await new Promise(resolve=>setTimeout(resolve,25));
        }
        assert.equal(held,true,'BEFORE INSERT must really hold the key while the conflicting row is locked');
        const results=await Promise.allSettled([a.send(`SELECT pg_advisory_xact_lock(${keyLock})`),upsert]);await observed;
        assert.equal(results.filter(r=>r.status==='rejected').length,1);
        const victim=results.find(r=>r.status==='rejected');assert.ok(victim && victim.status==='rejected');assert.match(String(victim.reason),/40P01/);
        const winner=results[0].status==='fulfilled'?a:b;await winner.send('COMMIT');
        const updated=results[1].status==='fulfilled';assert.equal((await binding(fid)).catalogIdentityEpoch,updated?'1':'0');
        assert.equal(await sql(`SELECT name FROM public.foods WHERE id=${quote(fid)}`),updated?'Upserted':'Before');
        assert.equal(await sql(`SELECT count(*) FROM potok_shared_food_eligibility.roots_v1 WHERE stable_key=${quote(key)}`),'1');
      } finally { await Promise.all([a.close(),b.close()]); }
    });
    await t.test('participating existing-ID upsert and opposite bulk order serialize without deadlock',async()=>{
      const ids=[id(4050),id(4051)];
      for(const [i,fid] of ids.entries()) {
        await sql(`INSERT INTO public.foods(id,canonical_food_id,stable_food_id,source,name) VALUES(${quote(fid)},${quote(fid)},'gate_root_${i}','core','Before')`);
        await decide(await eligibilityInput('PENDING',4052+i,null,fid));
      }
      const a=session(),b=session();
      try {
        await a.send(`BEGIN; SELECT potok_food_evidence.catalog_gate_v1(); SELECT id FROM public.foods WHERE id=${quote(ids[0])} FOR UPDATE`);
        const pending=b.send(`BEGIN; SELECT potok_food_evidence.catalog_gate_v1();
          INSERT INTO public.foods(id,canonical_food_id,stable_food_id,source,name) VALUES(${quote(ids[0])},${quote(ids[0])},'gate_root_0','core','Upserted') ON CONFLICT(id) DO UPDATE SET name=excluded.name;
          UPDATE public.foods SET name='B' WHERE id=${quote(ids[1])}; UPDATE public.foods SET name='B' WHERE id=${quote(ids[0])}; COMMIT`);
        await a.send(`UPDATE public.foods SET name='A' WHERE id=${quote(ids[0])}; UPDATE public.foods SET name='A' WHERE id=${quote(ids[1])}; COMMIT`);
        await pending;
        for(const fid of ids) assert.equal(await sql(`SELECT name FROM public.foods WHERE id=${quote(fid)}`),'B');
        assert.equal((await binding(ids[0])).catalogIdentityEpoch,'3');
        assert.equal((await binding(ids[1])).catalogIdentityEpoch,'2');
      } finally { await Promise.all([a.close(),b.close()]); }
    });
    await t.test('participating normalized-key upserts with different candidate IDs resolve one root',async()=>{
      await sql('CREATE UNIQUE INDEX disposable_food_normalized_key ON public.foods(normalized_name,normalized_brand)');
      const a=session(),b=session();
      try {
        await a.send('BEGIN; SELECT potok_food_evidence.catalog_gate_v1()');
        const pending=b.send(`BEGIN; SELECT potok_food_evidence.catalog_gate_v1(); INSERT INTO public.foods(id,canonical_food_id,stable_food_id,source,name,normalized_name,normalized_brand)
          VALUES(${quote(id(4061))},${quote(id(4061))},NULL,'core','Second','gate_normalized','') ON CONFLICT(normalized_name,normalized_brand) DO UPDATE SET name=excluded.name; COMMIT`);
        await a.send(`INSERT INTO public.foods(id,canonical_food_id,stable_food_id,source,name,normalized_name,normalized_brand)
          VALUES(${quote(id(4060))},${quote(id(4060))},NULL,'core','First','gate_normalized',''); COMMIT`);
        await pending;assert.equal(await sql("SELECT count(*) FROM public.foods WHERE normalized_name='gate_normalized'"),'1');
        assert.equal(await sql("SELECT id::text||':'||name FROM public.foods WHERE normalized_name='gate_normalized'"),id(4060)+':Second');
      } finally { await Promise.all([a.close(),b.close()]);await sql('DROP INDEX public.disposable_food_normalized_key'); }
    });
    await t.test('gate contention measures serialization of disjoint roots and post-wait JWT expiry',async()=>{
      const a=session();
      try {
        await a.send('BEGIN; SELECT potok_food_evidence.catalog_gate_v1()');
        const begin=performance.now();
        const waiting=sql(`BEGIN; SELECT potok_food_evidence.catalog_gate_v1(); UPDATE public.foods SET name=name WHERE id=${quote(id(4051))}; COMMIT`);
        const release=a.send('SELECT pg_sleep(0.2); COMMIT');
        await Promise.all([waiting,release]);
        const elapsed=performance.now()-begin;assert.ok(elapsed>=150);t.diagnostic(`catalog gate disjoint-root contention elapsed_ms=${elapsed.toFixed(1)}; not a throughput benchmark`);
        await a.send('BEGIN; SELECT potok_food_evidence.catalog_gate_v1()');
        const request=await eligibilityInput('HIDDEN',4070,null);
        const expired=assert.rejects(asUser(`SELECT public.shared_food_eligibility_decide_v1(${quote(raw(request))})`,actor,{exp:Math.floor(Date.now()/1000)+1}),/JWT_EXPIRED/);
        await a.send('SELECT pg_sleep(2); COMMIT');await expired;
      } finally { await a.close(); }
    });
    await t.test('retry fails closed on business 40001, auth, unknown COMMIT; four attempts and deadline',async()=>{
      for(const error of [
        {code:'40001',detail:'POTOK_BUSINESS_CONFLICT_V1',routine:'exec_stmt_raise',rollbackConfirmed:true},
        {code:'42501',rollbackConfirmed:true},{code:'40P01',routine:'DeadLockReport',rollbackConfirmed:false},
        {code:'40001',rollbackConfirmed:true},
      ]) { assert.equal(retryableCatalogFailureV1(error),false);let count=0;
        await assert.rejects(retryCatalogTransactionV1(async()=>{count++;return {ok:false,error};}));assert.equal(count,1); }
      assert.equal(retryableCatalogFailureV1({code:'40001',routine:'CheckForSerializableConflictOut',rollbackConfirmed:true}),true);
      let count=0;
      await assert.rejects(retryCatalogTransactionV1(async()=>{count++;return {ok:false,error:{code:'40P01',routine:'DeadLockReport',rollbackConfirmed:true}};},{sleep:async()=>{},random:()=>0}));assert.equal(count,4);
      let clock=0;count=0;
      await assert.rejects(retryCatalogTransactionV1(async()=>{count++;clock=15000;return {ok:false,error:{code:'40P01',routine:'DeadLockReport',rollbackConfirmed:true}};},{now:()=>clock,random:()=>0}),/CATALOG_RETRY_DEADLINE/);assert.equal(count,1);
    });
    await t.test('bulk constraint failure rolls back earlier row and epoch changes',async()=>{
      const beforeBinding=await binding();
      await assert.rejects(sql(`BEGIN; UPDATE public.foods SET name='Rolled back' WHERE id=${quote(foodId)};
        INSERT INTO public.foods(id,canonical_food_id,stable_food_id,source,name) VALUES(${quote(id(4040))},${quote(id(4040))},'synthetic_root','core','Duplicate'); COMMIT;`),/STABLE_KEY_ALREADY_CLAIMED/);
      assert.deepEqual(await binding(),beforeBinding);assert.equal(await sql(`SELECT name FROM public.foods WHERE id=${quote(foodId)}`),'Synthetic food');
    });
    await t.test('current-state read rechecks JWT expiry after a real competing food-lock wait',async () => {
      const competing = sql(`BEGIN; SELECT id FROM public.foods WHERE id=${quote(foodId)} FOR UPDATE; SELECT pg_sleep(3); COMMIT;`);
      try {
        const deadline=Date.now()+2000;let held=false;
        while(Date.now()<deadline) {
          try { await sql(`BEGIN; SELECT id FROM public.foods WHERE id=${quote(foodId)} FOR UPDATE NOWAIT; COMMIT;`); }
          catch(error) { if(/could not obtain lock/.test(String(error))) { held=true;break; } throw error; }
          await new Promise(resolve=>setTimeout(resolve,25));
        }
        assert.equal(held,true,'competing PostgreSQL session must actually hold the root row');
        await assert.rejects(asUser(`SELECT public.food_evidence_current_v1(${quote(foodId)},'raw')`,actor,
          { exp:Math.floor(Date.now()/1000)+1 }),/JWT_EXPIRED/);
      } finally { await competing; }
    });
    await stageCCatalogAcceptance(t,{sql,asUser,session});
    if(process.env.POTOK_STAGE_C_REQUIRE_TRANSPORT==='1') {
      const {stageCPostgrestAcceptance}=await import('./stage-c-postgrest-acceptance');
      await stageCPostgrestAcceptance(t,{root,socket,port,sql,session});
    }
  } finally {
    if (started) await run('pg_ctl',['-D',data,'-m','immediate','-w','stop'],{ env, timeout:30_000 });
    await rm(root,{ recursive:true,force:true });
  }
});
