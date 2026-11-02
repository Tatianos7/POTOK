import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import test from 'node:test';
import {Pool, type PoolClient} from 'pg';
import {installGenerationRuntimeSourceFixtureV1} from './generation-validation-runtime-fixture-v1';
import {ok, denied, literal, binary} from './generation-validation-fixture-v1';
import {generationPreparationMetadataFixtureV1} from '../../src/server/__tests__/generationPreparationSqlFixturesV1';
import {id} from '../../src/utils/__tests__/trustedGeneratedWeekFixturesV1';
import {canonicalJsonV1} from '../../src/utils/adaptiveNutritionWireV1';

const native = process.env.POTOK_GENERATION_STORE_NATIVE === '1';
const read = (name: string) => readFileSync(new URL('../../docs/premium/drafts/' + name, import.meta.url), 'utf8');
const candidate = read('generation_source_commit_fence_v1.sql');
function definition(name: string) {
  const source = read('20260930_adaptive_nutrition_protected_execution_binding_v1.sql');
  const start = source.indexOf('CREATE FUNCTION potok_nutrition.' + name + '(');
  const end = source.indexOf('$function$;', start);
  assert.ok(start >= 0 && end > start); return source.slice(start, end + 12);
}

test('source fence candidate stays a bounded unapplied transaction', () => {
  assert.match(candidate, /VOLATILE SECURITY INVOKER SET search_path=pg_catalog/);
  assert.match(candidate, /transaction_isolation.*read committed/);
  assert.equal((candidate.match(/^BEGIN;$/gm) ?? []).length, 1);
  assert.equal((candidate.match(/^COMMIT;$/gm) ?? []).length, 1);
  assert.doesNotMatch(candidate, /CREATE TABLE|CREATE ROLE|GRANT |INSERT INTO|UPDATE public|DELETE FROM|TRUNCATE /);
});

// Real storage/admission/revocation functions and retained gateway bodies.
// The inner graph writers below are explicit synthetic markers. This is source
// concurrency acceptance, not full Graph persistence, Auth/TLS or menu E2E.
test('native source fence serializes actual gateways against source revocation', {skip: !native}, async t => {
  const {f, input, request, account, inputInsert, warningInsert} = await installGenerationRuntimeSourceFixtureV1();
  ok(read('generation_preparation_source_v1.sql')); ok(read('generation_producer_sources_v1.sql'));
  const generated = literal(id(900)), activated = literal(id(901));
  ok(`ALTER TABLE potok_nutrition.adaptive_nutrition_generation_requests_v2
    ADD COLUMN request_idempotency_key uuid, ADD COLUMN attempt_operation_id uuid, ADD COLUMN attempt_idempotency_key uuid,
    ADD COLUMN record_idempotency_key uuid, ADD COLUMN activation_idempotency_key uuid, ADD COLUMN proposed_plan_revision uuid,
    ADD COLUMN reason_code text, ADD COLUMN generated_operation_id uuid, ADD COLUMN activation_operation_id uuid,
    ADD COLUMN created_at timestamptz, ADD COLUMN updated_at timestamptz;
    UPDATE potok_nutrition.adaptive_nutrition_generation_requests_v2 SET request_idempotency_key=${literal(id(910))},
      attempt_operation_id=${literal(id(911))}, record_idempotency_key=${literal(id(912))},activation_idempotency_key=${literal(id(913))},
      proposed_plan_revision=${literal(f.plan.proposedPlanRevision)};
    CREATE TABLE public.adaptive_nutrition_operations(operation_id uuid PRIMARY KEY,user_id uuid,selection_id uuid,action_type text,outcome text,
      canonical_request bytea,request_digest bytea,result_canonical bytea,result_digest bytea,result_plan_revision uuid,result_graph_digest bytea,result_references jsonb,committed_at timestamptz);
    CREATE TABLE potok_nutrition.fence_activation_fixture(generation_operation_id uuid PRIMARY KEY);
    CREATE FUNCTION potok_nutrition.record_generated_week_v2(a uuid,s uuid,k uuid,i bytea,p bytea) RETURNS jsonb LANGUAGE plpgsql SET search_path=pg_catalog AS $stub$
    BEGIN
      IF current_user<>'postgres' THEN RAISE EXCEPTION 'FIXTURE_INTERNAL_CHANNEL_REQUIRED'; END IF;
      INSERT INTO public.adaptive_nutrition_operations(operation_id,user_id,selection_id,action_type,outcome,canonical_request,result_canonical,result_digest)
        VALUES(${generated},a,s,'PLAN_GENERATED_V2','accepted',i,p,extensions.digest(p,'sha256'));
      RETURN jsonb_build_object('outcome','accepted','operation_id',${generated}::uuid);
    END $stub$;
    CREATE FUNCTION potok_nutrition.activate_generated_week_v2(g uuid,k uuid,e uuid) RETURNS jsonb LANGUAGE plpgsql SET search_path=pg_catalog AS $stub$
    BEGIN
      IF current_user<>'postgres' THEN RAISE EXCEPTION 'FIXTURE_INTERNAL_CHANNEL_REQUIRED'; END IF;
      INSERT INTO potok_nutrition.fence_activation_fixture VALUES(g);
      RETURN jsonb_build_object('outcome','accepted','operation_id',${activated}::uuid);
    END $stub$;
    ${definition('generation_request_status_json_v2')}
    ${definition('settle_generation_request_failure_v2')}
    ${definition('record_generated_week_gateway_v2')}
    ${definition('activate_generated_week_gateway_v2')}
    CREATE ROLE potok_generation_gateway_v1 LOGIN NOINHERIT NOSUPERUSER NOBYPASSRLS PASSWORD 'fence-disposable-only';
    REVOKE ALL ON ALL TABLES IN SCHEMA public,potok_nutrition FROM PUBLIC,anon,authenticated,service_role,potok_generation_reader_v1,potok_generation_gateway_v1;
    REVOKE ALL ON ALL FUNCTIONS IN SCHEMA potok_nutrition FROM PUBLIC,anon,authenticated,service_role,potok_generation_gateway_v1;
    GRANT USAGE ON SCHEMA potok_nutrition TO potok_generation_gateway_v1;
    GRANT EXECUTE ON FUNCTION potok_nutrition.record_generated_week_gateway_v2(uuid,bytea),potok_nutrition.activate_generated_week_gateway_v2(uuid) TO potok_generation_gateway_v1;
    ${inputInsert()}
    ${warningInsert()}
    INSERT INTO potok_nutrition.generation_validation_receipt_bindings_v1(receipt_ref,request_operation_id,account_id,source_kind,source_storage_sha256,policies_storage_sha256)
      SELECT source_receipt_ref,request_operation_id,account_id,'INPUTS',evidence_storage_sha256,policies_storage_sha256 FROM potok_nutrition.generation_validation_inputs_v1;
    INSERT INTO potok_nutrition.generation_validation_receipt_bindings_v1(receipt_ref,request_operation_id,account_id,source_kind,proposal_raw_sha256,source_storage_sha256)
      SELECT source_receipt_ref,request_operation_id,${account},'WARNINGS',proposal_raw_sha256,warning_storage_sha256 FROM potok_nutrition.generation_validation_warnings_v1;`);
  const evidence = f.evidence.digest, policies = JSON.parse(f.policiesRaw).digest;
  const source = (ref: string, kind: string, raw: string) => {
    const body = JSON.parse(raw);
    return `INSERT INTO potok_nutrition.generation_preparation_sources_v1(source_ref,request_operation_id,account_id,source_kind,generation_input_digest,validation_evidence_digest,validation_policies_digest,slot_id,meal_snapshot_digest,payload_raw)
      VALUES(${literal(ref)},${request},${account},${literal(kind)},${binary(f.evidence.generationInputDigest)},${binary(evidence)},${binary(policies)},
      ${kind === 'METADATA' ? 'NULL' : literal(body.slotId)},${kind === 'METADATA' ? 'NULL' : binary(body.mealSnapshotDigest)},${literal(raw)});`;
  };
  ok(source('synthetic-only:metadata', 'METADATA', generationPreparationMetadataFixtureV1(f)));
  const entries = JSON.parse(f.warningRaw).entries;
  entries.forEach((entry: unknown, i: number) => ok(source('synthetic-only:meal-' + i, 'MEAL_WARNING', JSON.stringify(entry))));
  ok("UPDATE potok_nutrition.adaptive_nutrition_generation_requests_v2 SET status='GENERATING';");
  const oldBodies = () => ok("SELECT string_agg(md5(prosrc),',' ORDER BY proname) FROM pg_proc WHERE oid IN('potok_nutrition.record_generated_week_gateway_v2(uuid,bytea)'::regprocedure,'potok_nutrition.activate_generated_week_gateway_v2(uuid)'::regprocedure);");
  const before = oldBodies();
  await t.test('prerequisite/trigger drift and late installer failure roll back the whole package', () => {
    denied("BEGIN;ALTER FUNCTION potok_nutrition.acquire_shared_account_gate_v1(uuid) SET search_path=public;" + candidate, /GENERATION_FENCE_PREREQUISITE_DRIFT/);
    denied('BEGIN;ALTER TABLE potok_nutrition.generation_validation_receipt_revocations_v1 DISABLE TRIGGER receipt_revocation_insert;' + candidate, /GENERATION_FENCE_REVOCATION_GUARD_DRIFT/);
    denied(candidate.replace(/COMMIT;\s*$/, "DO $$ BEGIN RAISE EXCEPTION 'FIXTURE_LATE_FAILURE'; END $$;COMMIT;"), /FIXTURE_LATE_FAILURE/);
    assert.equal(oldBodies(), before);
    assert.equal(ok("SELECT to_regprocedure('potok_nutrition.assert_generation_source_current_v1(uuid,bytea)') IS NULL;"), 't');
  });
  ok(candidate);
  const call = `SELECT potok_nutrition.record_generated_week_gateway_v2(${request},${binary(Buffer.from(f.planRaw).toString('hex'))});`;
  const activate = `SELECT potok_nutrition.activate_generated_week_gateway_v2(${request});`;
  const actor = 'SET LOCAL ROLE potok_generation_gateway_v1;';
  const receiptRevoke = (ref: string) => `INSERT INTO potok_nutrition.generation_validation_receipt_revocations_v1(receipt_ref,reason_ref) VALUES(${literal(ref)},'synthetic-only:withdrawal');`;
  const producerRevoke = (ref: string) => `INSERT INTO potok_nutrition.generation_preparation_source_revocations_v1(source_ref,reason_ref) VALUES(${literal(ref)},'synthetic-only:withdrawal');`;
  await t.test('private invoker helper adds no app/worker grants; replay installer fails', () => {
    for (const role of ['anon', 'authenticated', 'service_role', 'potok_generation_reader_v1', 'potok_generation_gateway_v1'])
      denied(`SET ROLE ${role};SELECT potok_nutrition.assert_generation_source_current_v1(${request},decode('7b7d','hex'));`, /permission denied/);
    denied(candidate, /GENERATION_FENCE_ALREADY_INSTALLED/);
  });
  await t.test('accepted sources reach retained record gateway; replay returns the same stored outcome', () => {
    const lines = ok('BEGIN;' + actor + call + call + 'RESET ROLE;SELECT count(*) FROM public.adaptive_nutrition_operations;ROLLBACK;').split('\n');
    assert.equal(JSON.parse(lines[0]).status, 'GENERATED'); assert.deepEqual(JSON.parse(lines[1]), JSON.parse(lines[0])); assert.equal(lines[2], '1');
  });
  for (const revoke of [receiptRevoke('synthetic-only:inputs'), receiptRevoke('synthetic-only:warnings'), producerRevoke('synthetic-only:metadata'), producerRevoke('synthetic-only:meal-0')]) {
    await t.test('revoked required source blocks recording without invoking inner writer: ' + revoke.slice(40, 90), () => {
      const lines = ok('BEGIN;' + revoke + actor + call + 'RESET ROLE;SELECT count(*) FROM public.adaptive_nutrition_operations;ROLLBACK;').split('\n');
      assert.equal(JSON.parse(lines[0]).status, 'REJECTED'); assert.equal(lines[1], '0');
    });
  }
  await t.test('repeatable-read/serializable snapshots fail closed before any inner write', () => {
    for (const level of ['REPEATABLE READ', 'SERIALIZABLE']) {
      const lines = ok('BEGIN ISOLATION LEVEL ' + level + ';' + actor + call + 'RESET ROLE;SELECT count(*) FROM public.adaptive_nutrition_operations;ROLLBACK;').split('\n');
      assert.equal(JSON.parse(lines[0]).status, 'REJECTED'); assert.equal(lines[1], '0');
    }
  });
  await t.test('missing selection lineage fails closed and an unbound canonical proposal cannot use old warnings', () => {
    const missing = ok("BEGIN;UPDATE public.user_premium_plan_selections SET origin_lineage='{}';" + actor + call + 'RESET ROLE;SELECT count(*) FROM public.adaptive_nutrition_operations;ROLLBACK;').split('\n');
    assert.equal(JSON.parse(missing[0]).status, 'REJECTED'); assert.equal(missing[1], '0');
    const changed = canonicalJsonV1({...f.plan, generatedAt: '2026-09-28T01:00:00.000Z'}, 'SAFE_INTEGER');
    assert.notEqual(changed, f.planRaw);
    const wrong = `SELECT potok_nutrition.record_generated_week_gateway_v2(${request},${binary(Buffer.from(changed).toString('hex'))});`;
    const lines = ok('BEGIN;' + actor + wrong + 'RESET ROLE;SELECT count(*) FROM public.adaptive_nutrition_operations;ROLLBACK;').split('\n');
    assert.equal(JSON.parse(lines[0]).status, 'REJECTED'); assert.equal(lines[1], '0');
  });

  const base = {host: '127.0.0.1', port: 5432, database: 'potok_generation_store_disposable', ssl: false as const, connectionTimeoutMillis: 3000, statement_timeout: 5000};
  const owner = new Pool({...base, user: 'postgres', password: 'disposable-generation-only'});
  const gateway = new Pool({...base, user: 'potok_generation_gateway_v1', password: 'fence-disposable-only'});
  async function waiting(observer: PoolClient, pid: number) {
    for (let i = 0; i < 100; i++) {
      if ((await observer.query("SELECT wait_event_type FROM pg_stat_activity WHERE pid=$1", [pid])).rows[0]?.wait_event_type === 'Lock') return;
      await new Promise(resolve => setTimeout(resolve, 10));
    }
    throw Error('FIXTURE_EXPECTED_LOCK_WAIT');
  }
  const recordSql = 'SELECT potok_nutrition.record_generated_week_gateway_v2($1::uuid,$2::bytea) AS result';
  const parameters = [input.operation.requestId, Buffer.from(f.planRaw)];
  try {
    await t.test('record keeps the common gate through commit; concurrent revocation cannot commit first', async () => {
      const recorder = await gateway.connect(), revoker = await owner.connect(), observer = await owner.connect();
      try {
        await recorder.query('BEGIN'); const recorded = await recorder.query(recordSql, parameters);
        assert.equal(recorded.rows[0].result.status, 'GENERATED');
        await revoker.query('BEGIN'); const pid = (await revoker.query('SELECT pg_backend_pid() AS pid')).rows[0].pid;
        const pending = revoker.query(producerRevoke('synthetic-only:meal-0'));
        await waiting(observer, pid); await recorder.query('COMMIT'); await pending;
        await revoker.query('ROLLBACK');
      } finally {await Promise.allSettled([recorder.query('ROLLBACK'), revoker.query('ROLLBACK')]); recorder.release(); revoker.release(); observer.release();}
    });
    await t.test('activation rechecks all required sources while preserving already recorded history', () => {
      for (const revoke of [receiptRevoke('synthetic-only:warnings'), producerRevoke('synthetic-only:metadata'), producerRevoke('synthetic-only:meal-0')]) {
        const lines = ok('BEGIN;' + revoke + actor + activate + 'RESET ROLE;SELECT count(*) FROM potok_nutrition.fence_activation_fixture;SELECT count(*) FROM public.adaptive_nutrition_operations;ROLLBACK;').split('\n');
        assert.equal(JSON.parse(lines[0]).status, 'REJECTED'); assert.equal(lines[1], '0'); assert.equal(lines[2], '1');
      }
      const lines = ok('BEGIN;' + actor + activate + activate + 'RESET ROLE;SELECT count(*) FROM potok_nutrition.fence_activation_fixture;ROLLBACK;').split('\n');
      assert.equal(JSON.parse(lines[0]).status, 'ACTIVE'); assert.deepEqual(JSON.parse(lines[0]), JSON.parse(lines[1])); assert.equal(lines[2], '1');
    });
    await t.test('revocation committed while record waits is observed from a fresh snapshot; no inner write', async () => {
      // Reset only synthetic writer markers/lifecycle for this final scenario;
      // the immutable admission/source rows and their real guards stay intact.
      ok("UPDATE potok_nutrition.adaptive_nutrition_generation_requests_v2 SET status='GENERATING',generated_operation_id=NULL,reason_code=NULL;DELETE FROM public.adaptive_nutrition_operations;");
      const recorder = await gateway.connect(), revoker = await owner.connect(), observer = await owner.connect();
      try {
        await revoker.query('BEGIN'); await revoker.query(producerRevoke('synthetic-only:meal-0'));
        await recorder.query('BEGIN'); const pid = (await recorder.query('SELECT pg_backend_pid() AS pid')).rows[0].pid;
        const pending = recorder.query(recordSql, parameters);
        await waiting(observer, pid); await revoker.query('COMMIT');
        assert.equal((await pending).rows[0].result.status, 'REJECTED'); await recorder.query('COMMIT');
        assert.equal((await observer.query('SELECT count(*)::int AS n FROM public.adaptive_nutrition_operations')).rows[0].n, 0);
      } finally {await Promise.allSettled([recorder.query('ROLLBACK'), revoker.query('ROLLBACK')]); recorder.release(); revoker.release(); observer.release();}
    });
  } finally {await gateway.end(); await owner.end();}
});
