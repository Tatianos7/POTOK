import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import { readFileSync } from 'node:fs';
import test from 'node:test';
import { createAdmittedSqlGenerationValidationSourceStoreV1, admittedGenerationValidationSourceReadSqlV1 } from '../../src/server/generationValidationSourceSqlV1';
import { createGenerationValidationAuthorityLoaderV1 } from '../../src/server/generationValidationAuthorityLoaderV1';
import { createGenerationValidationAdapterV1 } from '../../src/server/generationValidationAdapterV1';
import { id } from '../../src/utils/__tests__/trustedGeneratedWeekFixturesV1';
import { args, sql, ok, denied, literal, binary, installGenerationStoreFixtureV1 } from './generation-validation-fixture-v1';

const admission = readFileSync(new URL('./generation-validation-admission-v1.sql', import.meta.url), 'utf8');
const prerequisites = readFileSync(new URL('./generation-admission-prerequisites-v1.sql', import.meta.url), 'utf8');
const native = process.env.POTOK_GENERATION_STORE_NATIVE === '1';
const worker = 'SET SESSION AUTHORIZATION potok_generation_reader_v1;';

test('admitted driver uses the admitted endpoint exclusively and never falls back on denial', async () => {
  const failure = new Error('denied'); const calls: unknown[] = [];
  const store = createAdmittedSqlGenerationValidationSourceStoreV1({ async query(statement, parameters) {
    calls.push([statement, parameters]); throw failure;
  } });
  await assert.rejects(store.readSnapshotRaw(id(44), 'a'.repeat(64)), error => error === failure);
  assert.deepEqual(calls, [[admittedGenerationValidationSourceReadSqlV1, [id(44), 'a'.repeat(64)]]]);
});

test('native service identity, actual Premium gate and immutable source receipt admission', { skip: !native }, async t => {
  const { f, input, request, account, proposalSha, inputInsert, warningInsert } = await installGenerationStoreFixtureV1();
  ok(inputInsert()+warningInsert());
  ok(`BEGIN;
    SET LOCAL potok.disposable_generation_store='on';
    CREATE SCHEMA potok_control;
    REVOKE ALL ON SCHEMA potok_control FROM PUBLIC,anon,authenticated,service_role;
    CREATE TABLE potok_control.access_attestations(attestation_id uuid PRIMARY KEY,account_id uuid NOT NULL,capability text NOT NULL,effect text NOT NULL,previous_attestation_id uuid,lineage_sequence bigint NOT NULL,issued_at timestamptz NOT NULL,valid_until timestamptz);
    ALTER TABLE potok_control.access_attestations ENABLE ROW LEVEL SECURITY;
    ALTER TABLE potok_control.access_attestations FORCE ROW LEVEL SECURITY;
    REVOKE ALL ON potok_control.access_attestations FROM PUBLIC,anon,authenticated,service_role;
    ALTER TABLE potok_nutrition.adaptive_nutrition_generation_requests_v2 ADD COLUMN selection_id uuid;
    UPDATE potok_nutrition.adaptive_nutrition_generation_requests_v2 SET selection_id=${literal(input.selection.selectionId)};
    CREATE TABLE public.user_premium_plan_selections(id uuid PRIMARY KEY,user_id uuid NOT NULL,status text NOT NULL,plan_revision uuid,week_anchor date NOT NULL,timezone text NOT NULL,goal_revision uuid NOT NULL,origin_lineage jsonb NOT NULL);
    CREATE TABLE public.user_goals(user_id uuid PRIMARY KEY,goal_revision uuid NOT NULL);
    INSERT INTO public.user_premium_plan_selections VALUES (${literal(input.selection.selectionId)},${account},'pending_generation',NULL,${literal(input.weekStartLocal)},${literal(input.timezone)},${literal(input.goalNutritionTarget.goalRevision)},jsonb_build_object('provisionOperationId',${literal(input.selection.planSelectionRevision)}));
    INSERT INTO public.user_goals VALUES (${account},${literal(input.goalNutritionTarget.goalRevision)});
    ${prerequisites}
    ${admission}
    INSERT INTO potok_control.access_attestations VALUES (${literal(input.entitlementEvidenceRevision)},${account},'premium','GRANT',NULL,1,statement_timestamp()-interval '1 hour',statement_timestamp()+interval '1 day');
    COMMIT;`);
  const read = `SELECT potok_nutrition.read_admitted_generation_validation_source_v1(${request},${binary(proposalSha)});`;
  const registerInputs = `INSERT INTO potok_nutrition.generation_validation_receipt_bindings_v1(receipt_ref,request_operation_id,account_id,source_kind,source_storage_sha256,policies_storage_sha256)
    SELECT source_receipt_ref,request_operation_id,account_id,'INPUTS',evidence_storage_sha256,policies_storage_sha256 FROM potok_nutrition.generation_validation_inputs_v1;`;
  const registerWarnings = `INSERT INTO potok_nutrition.generation_validation_receipt_bindings_v1(receipt_ref,request_operation_id,account_id,source_kind,proposal_raw_sha256,source_storage_sha256)
    SELECT w.source_receipt_ref,w.request_operation_id,v.account_id,'WARNINGS',w.proposal_raw_sha256,w.warning_storage_sha256
    FROM potok_nutrition.generation_validation_warnings_v1 w JOIN potok_nutrition.generation_validation_inputs_v1 v USING(request_operation_id);`;
  const revoke = (ref: string) => `INSERT INTO potok_nutrition.generation_validation_receipt_revocations_v1(receipt_ref,reason_ref) VALUES (${literal(ref)},'synthetic-only:withdrawal');`;

  await t.test('service role has only a NOLOGIN nonprivileged reader identity', () => {
    assert.equal(ok("SELECT rolsuper::text||':'||rolbypassrls::text||':'||rolcanlogin::text||':'||rolcreaterole::text FROM pg_roles WHERE rolname='potok_generation_reader_v1';"), 'false:false:false:false');
    assert.equal(ok(worker+"SELECT session_user::text||':'||current_user::text;"), 'potok_generation_reader_v1:potok_generation_reader_v1');
  });
  await t.test('application roles and owner session cannot impersonate the reader', () => {
    for (const role of ['anon','authenticated','service_role']) denied(`SET ROLE ${role};`+read, /permission denied/);
    denied(read, /GENERATION_READER_IDENTITY_REQUIRED/);
    denied('SET ROLE potok_generation_reader_v1;'+read, /GENERATION_READER_IDENTITY_REQUIRED/);
  });
  await t.test('reader cannot access private tables, register receipts, or call unadmitted helper', () => {
    denied(worker+'SELECT * FROM potok_nutrition.generation_validation_inputs_v1;', /permission denied/);
    denied(worker+registerInputs, /permission denied/);
    denied(worker+`SELECT potok_nutrition.read_generation_validation_source_v1(${request},${binary(proposalSha)});`, /permission denied/);
    denied('BEGIN;GRANT EXECUTE ON FUNCTION potok_nutrition.read_generation_validation_source_v1(uuid,bytea) TO potok_generation_reader_v1;'+worker+
      `SELECT potok_nutrition.read_generation_validation_source_v1(${request},${binary(proposalSha)});`, /PROTECTED_VALIDATION_READER_NOT_BOUND/);
  });
  await t.test('nonempty receipt labels alone do not authorize source retrieval', () => {
    denied(worker+read, /SOURCE_PROVENANCE_UNAVAILABLE/);
    denied(worker+"SET request.jwt.claims='{\"role\":\"service_role\",\"premium\":true}';"+read, /SOURCE_PROVENANCE_UNAVAILABLE/);
  });
  await t.test('receipt registration rejects wrong account and substituted byte hashes', () => {
    denied(`INSERT INTO potok_nutrition.generation_validation_receipt_bindings_v1(receipt_ref,request_operation_id,account_id,source_kind,source_storage_sha256,policies_storage_sha256)
      VALUES('synthetic-only:inputs',${request},${literal(id(999))},'INPUTS',${binary('a'.repeat(64))},${binary('b'.repeat(64))});`, /SOURCE_RECEIPT_BINDING_MISMATCH/);
    denied(`INSERT INTO potok_nutrition.generation_validation_receipt_bindings_v1(receipt_ref,request_operation_id,account_id,source_kind,source_storage_sha256,policies_storage_sha256)
      VALUES('synthetic-only:inputs',${request},${account},'INPUTS',${binary('a'.repeat(64))},${binary('b'.repeat(64))});`, /SOURCE_RECEIPT_BINDING_MISMATCH/);
    ok(registerInputs); denied(worker+read, /SOURCE_PROVENANCE_UNAVAILABLE/); ok(registerWarnings);
  });
  await t.test('admitted service -> real existing admission functions -> SQL sources -> trusted week validator', async () => {
    const driver = { async query(statement: string, values: readonly string[]) {
      assert.equal(statement, admittedGenerationValidationSourceReadSqlV1);
      const raw = ok(worker+`SELECT potok_nutrition.read_admitted_generation_validation_source_v1(${literal(values[0])},${binary(values[1])});`);
      return { rows: [{ source_raw: raw || null }] };
    } };
    const validate = createGenerationValidationAdapterV1(createGenerationValidationAuthorityLoaderV1(createAdmittedSqlGenerationValidationSourceStoreV1(driver)));
    const result = await validate.validate(input.operation.requestId, f.planRaw);
    assert.equal(result.status, 'ACCEPTED');
    if (result.status !== 'ACCEPTED') throw new Error('expected_admission');
    assert.equal(result.generatedPlanRaw, f.planRaw);
  });
  await t.test('admission uses locks without changing request status; not a READ ONLY transaction API', () => {
    const before = ok('SELECT row_to_json(r)::text FROM potok_nutrition.adaptive_nutrition_generation_requests_v2 r;');
    assert.ok(ok(worker+read));
    assert.equal(ok('SELECT row_to_json(r)::text FROM potok_nutrition.adaptive_nutrition_generation_requests_v2 r;'), before);
    denied(worker+'BEGIN READ ONLY;'+read, /read-only transaction/);
  });
  await t.test('expired Premium and forged claims cannot pass the actual effective-entitlement function', () => {
    denied("BEGIN;UPDATE potok_control.access_attestations SET valid_until=statement_timestamp()-interval '1 second';"+
      worker+"SET request.jwt.claims='{\"premium\":true}';"+read, /VERIFIED_PREMIUM_REQUIRED/);
  });
  const appendAttestation = (effect: string, sequence: number) => `INSERT INTO potok_control.access_attestations VALUES (${literal(id(33))},${account},'premium',${literal(effect)},${literal(input.entitlementEvidenceRevision)},${sequence},statement_timestamp(),NULL);`;
  await t.test('revoked Premium and broken lineage remain denied', () => {
    denied('BEGIN;'+appendAttestation('REVOKE',2)+worker+read, /VERIFIED_PREMIUM_REQUIRED/);
    denied('BEGIN;'+appendAttestation('GRANT',3)+worker+read, /VERIFIED_PREMIUM_REQUIRED/);
  });
  await t.test('a new valid Premium attestation cannot silently rebase the pinned request', () => {
    denied('BEGIN;'+appendAttestation('GRANT',2)+worker+read, /GENERATION_REQUEST_STALE_SELECTION/);
  });
  for (const change of [
    `UPDATE public.user_goals SET goal_revision=${literal(id(999))};`,
    "UPDATE public.user_premium_plan_selections SET timezone='Europe/Moscow';",
    "UPDATE public.user_premium_plan_selections SET status='active';",
    `UPDATE public.user_premium_plan_selections SET origin_lineage=jsonb_build_object('provisionOperationId',${literal(id(999))});`,
    "UPDATE public.user_premium_plan_selections SET origin_lineage='{}';",
  ]) {
    await t.test('actual selection/Goal gate rejects '+change.split(' SET ')[1].slice(0,45), () => {
      denied('BEGIN;'+change+worker+read, /GENERATION_REQUEST_STALE_SELECTION/);
    });
  }
  await t.test('actual authority/manifest/policy gates are reused without defaults', () => {
    denied(`BEGIN;UPDATE potok_nutrition.nutrition_authority_heads_v1 SET current_safety_revision=${literal(id(999))};`+worker+read, /GENERATION_REQUEST_STALE_AUTHORITY/);
    denied("BEGIN;UPDATE potok_nutrition.adaptive_nutrition_candidate_manifests_v2 SET canonical_bytes=canonical_bytes||decode('20','hex');"+worker+read, /GENERATION_REQUEST_STALE_MANIFEST/);
    denied(`BEGIN;UPDATE potok_nutrition.adaptive_nutrition_generation_policy_head_v2 SET validation_policy_revision=${literal(id(999))};`+worker+read, /GENERATION_REQUEST_STALE_POLICY/);
  });
  await t.test('source receipt bindings remain immutable and inaccessible to worker', () => {
    denied("UPDATE potok_nutrition.generation_validation_receipt_bindings_v1 SET source_storage_sha256=decode(repeat('f',64),'hex');", /VALIDATION_HISTORY_IMMUTABLE/);
    denied('DELETE FROM potok_nutrition.generation_validation_receipt_bindings_v1;', /VALIDATION_HISTORY_IMMUTABLE/);
    denied('TRUNCATE potok_nutrition.generation_validation_receipt_bindings_v1,potok_nutrition.generation_validation_receipt_revocations_v1;', /VALIDATION_HISTORY_IMMUTABLE/);
    denied(worker+revoke('synthetic-only:inputs'), /permission denied/);
  });
  await t.test('admitted read holds common account gate against source revocation until transaction end', async () => {
    await new Promise<void>((resolve,reject) => {
      const child = spawn('psql',args,{env:{...process.env,PGCONNECT_TIMEOUT:'5',PGSSLMODE:'disable'}});
      let output='';let stderr='';let attempted=false;
      child.stdout.on('data',chunk=>{ output+=String(chunk);if(!attempted&&output.includes('ADMISSION_LOCKED')) {
        attempted=true;try {denied("BEGIN;SET LOCAL lock_timeout='200ms';"+revoke('synthetic-only:inputs'),/lock timeout/);}catch(error){reject(error);}
      }});
      child.stderr.on('data',chunk=>{stderr+=String(chunk);});child.on('error',reject);
      child.on('close',exit=>{try{assert.equal(exit,0,stderr);assert.ok(attempted);resolve();}catch(error){reject(error);}});
      child.stdin.end(worker+'BEGIN;'+read+"SELECT 'ADMISSION_LOCKED';SELECT pg_sleep(2);COMMIT;");
    });
    assert.equal(ok('SELECT count(*) FROM potok_nutrition.generation_validation_receipt_revocations_v1;'),'0');
  });
  await t.test('revocation committed while admission waits is observed, not read through a stale snapshot', async () => {
    await new Promise<void>((resolve,reject)=>{
      const child=spawn('psql',args,{env:{...process.env,PGCONNECT_TIMEOUT:'5',PGSSLMODE:'disable'}});
      let output='';let stderr='';let attempted=false;
      child.stdout.on('data',chunk=>{output+=String(chunk);if(!attempted&&output.includes('REVOCATION_LOCKED')) {
        attempted=true;try{denied(worker+read,/SOURCE_PROVENANCE_UNAVAILABLE/);}catch(error){reject(error);}
      }});
      child.stderr.on('data',chunk=>{stderr+=String(chunk);});child.on('error',reject);
      child.on('close',exit=>{try{assert.equal(exit,0,stderr);assert.ok(attempted);resolve();}catch(error){reject(error);}});
      child.stdin.end('BEGIN;'+revoke('synthetic-only:warnings')+"SELECT 'REVOCATION_LOCKED';SELECT pg_sleep(1);COMMIT;");
    });
    denied(worker+read,/SOURCE_PROVENANCE_UNAVAILABLE/);
    denied('DELETE FROM potok_nutrition.generation_validation_receipt_revocations_v1;',/VALIDATION_HISTORY_IMMUTABLE/);
  });
  await t.test('function drift and non-disposable targets are rejected before installation', () => {
    denied("BEGIN;SET LOCAL potok.disposable_generation_store='on';ALTER FUNCTION potok_control.is_effective_entitlement_v2(uuid,text,timestamptz) SECURITY INVOKER;"+admission, /GENERATION_ADMISSION_PREREQUISITE_DRIFT/);
    const result=sql("BEGIN;SET LOCAL potok.disposable_generation_store='on';"+admission,'postgres');
    assert.notEqual(result.status,0);assert.match(result.stderr,/DISPOSABLE_GENERATION_ADMISSION_REQUIRED/);
  });
});
