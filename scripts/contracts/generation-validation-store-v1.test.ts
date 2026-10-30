import assert from 'node:assert/strict';
import { spawnSync, spawn } from 'node:child_process';
import { readFileSync } from 'node:fs';
import { createHash } from 'node:crypto';
import test from 'node:test';
import { createSqlGenerationValidationSourceStoreV1, generationValidationSourceReadSqlV1 } from '../../src/server/generationValidationSourceSqlV1';
import { createGenerationValidationAuthorityLoaderV1 } from '../../src/server/generationValidationAuthorityLoaderV1';
import { createGenerationValidationAdapterV1 } from '../../src/server/generationValidationAdapterV1';
import { fullFixture, id } from '../../src/utils/__tests__/trustedGeneratedWeekFixturesV1';
import { canonicalJsonV1 } from '../../src/utils/adaptiveNutritionWireV1';
import { adaptiveNutritionCandidateManifestCanonicalBytesV2, nutritionPreferenceSnapshotCanonicalBytesV1,
  nutritionSafetySnapshotCanonicalBytesV1 } from '../../src/utils/adaptiveNutritionAuthoritiesV1';

const sqlDraft = readFileSync(new URL('./generation-validation-store-v1.sql', import.meta.url), 'utf8');
const native = process.env.POTOK_GENERATION_STORE_NATIVE === '1';
const args = ['-X', '-w', '-qAt', '-v', 'ON_ERROR_STOP=1', '-h', '127.0.0.1', '-p', '5432', '-U', 'postgres', '-d', 'potok_generation_store_disposable'];
function sql(input: string, database = 'potok_generation_store_disposable') {
  const a = [...args]; a[a.length - 1] = database;
  return spawnSync('psql', a, { input, encoding: 'utf8', maxBuffer: 16 * 1024 * 1024,
    env: { ...process.env, PGCONNECT_TIMEOUT: '5', PGSSLMODE: 'disable' } });
}
function ok(input: string, database?: string): string {
  const result = sql(input, database); assert.equal(result.status, 0, result.stderr.slice(0, 900)); return result.stdout.trim();
}
function denied(input: string, pattern: RegExp) {
  const result = sql(input); assert.notEqual(result.status, 0); assert.match(result.stderr, pattern);
}
const literal = (s: string) => `'${s.replaceAll("'", "''")}'`;
const hex = (s: string | Uint8Array) => Buffer.from(s).toString('hex');
const binary = (s: string) => `decode(${literal(s)},'hex')`;
const hash = (s: string | Uint8Array) => createHash('sha256').update(s).digest('hex');

test('SQL client uses fixed parameterized query and rejects unexpected row shapes without retry', async () => {
  const calls: unknown[] = []; let raw: string | null = '{}';
  const store = createSqlGenerationValidationSourceStoreV1({ async query(statement, values) {
    calls.push([statement, values]); return { rows: [{ source_raw: raw }] };
  } });
  assert.equal(await store.readSnapshotRaw(id(44), 'a'.repeat(64)), '{}');
  assert.deepEqual(calls, [[generationValidationSourceReadSqlV1, [id(44), 'a'.repeat(64)]]]);
  raw = null; assert.equal(await store.readSnapshotRaw(id(44), 'a'.repeat(64)), null);
  await assert.rejects(store.readSnapshotRaw("x');SELECT 1;--", 'a'.repeat(64)), /INVALID_GENERATION_SOURCE_LOOKUP/);
  for (const rows of [[], [{ source_raw: null }, { source_raw: null }], [{}], [{ source_raw: 1 }], [{ source_raw: '{}', extra: true }]]) {
    const bad = createSqlGenerationValidationSourceStoreV1({ async query() { return { rows } as never; } });
    await assert.rejects(bad.readSnapshotRaw(id(44), 'a'.repeat(64)), /INVALID_GENERATION_SOURCE_SQL_RESULT/);
  }
  const failure = new Error('driver_failure'); let failures = 0;
  const broken = createSqlGenerationValidationSourceStoreV1({ async query() { failures++; throw failure; } });
  await assert.rejects(broken.readSnapshotRaw(id(44), 'a'.repeat(64)), e => e === failure); assert.equal(failures, 1);
});

test('native PostgreSQL storage/reader/real validator acceptance', { skip: !native }, async t => {
  // Fixed loopback-only, disposable DB admission. Never accept an arbitrary URL.
  assert.equal(ok('SELECT current_database();'), 'potok_generation_store_disposable');
  const f = await fullFixture(); const input = f.context.input; const request = literal(input.operation.requestId);
  const account = literal(input.accountId); const proposalSha = hash(f.planRaw);
  const inputBytes = Buffer.from(canonicalJsonV1(input, 'SAFE_INTEGER'));
  const manifest = await adaptiveNutritionCandidateManifestCanonicalBytesV2(f.context.manifest);
  const preference = await nutritionPreferenceSnapshotCanonicalBytesV1(f.context.preference);
  const safety = await nutritionSafetySnapshotCanonicalBytesV1(f.context.safety);
  const setup = `BEGIN;
    CREATE SCHEMA extensions; CREATE EXTENSION pgcrypto WITH SCHEMA extensions;
    CREATE SCHEMA potok_nutrition;
    CREATE ROLE anon NOLOGIN; CREATE ROLE authenticated NOLOGIN; CREATE ROLE service_role NOLOGIN BYPASSRLS;
    GRANT USAGE ON SCHEMA potok_nutrition TO anon,authenticated,service_role;
    CREATE TABLE potok_nutrition.adaptive_nutrition_generation_requests_v2(request_operation_id uuid PRIMARY KEY, account_id uuid NOT NULL,generation_input_canonical bytea NOT NULL,generation_input_digest bytea NOT NULL,status text NOT NULL);
    CREATE TABLE potok_nutrition.adaptive_nutrition_candidate_manifest_head_v2(singleton boolean PRIMARY KEY,current_manifest_revision uuid NOT NULL);
    CREATE TABLE potok_nutrition.adaptive_nutrition_candidate_manifests_v2(manifest_revision uuid PRIMARY KEY,publication_state text NOT NULL,canonical_bytes bytea NOT NULL,canonical_digest bytea NOT NULL);
    CREATE TABLE potok_nutrition.nutrition_authority_heads_v1(account_id uuid PRIMARY KEY,current_preference_revision uuid NOT NULL,current_safety_revision uuid NOT NULL);
    CREATE TABLE potok_nutrition.nutrition_preference_snapshots_v1(account_id uuid,revision_id uuid,canonical_bytes bytea NOT NULL,canonical_digest bytea NOT NULL,PRIMARY KEY(account_id,revision_id));
    CREATE TABLE potok_nutrition.nutrition_safety_snapshots_v1(account_id uuid,revision_id uuid,canonical_bytes bytea NOT NULL,canonical_digest bytea NOT NULL,PRIMARY KEY(account_id,revision_id));
    CREATE TABLE potok_nutrition.adaptive_nutrition_generation_policy_head_v2(singleton boolean PRIMARY KEY,publication_state text NOT NULL,target_policy_revision uuid,composition_policy_revision uuid,validation_policy_revision uuid,optimization_policy_revision uuid,generation_policy_revision uuid);
    SET LOCAL potok.disposable_generation_store='on';
    ${sqlDraft}
    INSERT INTO potok_nutrition.adaptive_nutrition_generation_requests_v2 VALUES (${request},${account},${binary(hex(inputBytes))},${binary(f.evidence.generationInputDigest)},'REQUESTED');
    INSERT INTO potok_nutrition.adaptive_nutrition_candidate_manifests_v2 VALUES (${literal(input.candidateManifestRevision)},'PUBLISHED',${binary(hex(manifest))},${binary(hash(manifest))});
    INSERT INTO potok_nutrition.adaptive_nutrition_candidate_manifest_head_v2 VALUES (true,${literal(input.candidateManifestRevision)});
    INSERT INTO potok_nutrition.nutrition_authority_heads_v1 VALUES (${account},${literal(input.preferenceRevision)},${literal(input.safetyRevision)});
    INSERT INTO potok_nutrition.nutrition_preference_snapshots_v1 VALUES (${account},${literal(input.preferenceRevision)},${binary(hex(preference))},${binary(hash(preference))});
    INSERT INTO potok_nutrition.nutrition_safety_snapshots_v1 VALUES (${account},${literal(input.safetyRevision)},${binary(hex(safety))},${binary(hash(safety))});
    INSERT INTO potok_nutrition.adaptive_nutrition_generation_policy_head_v2 VALUES (true,'PUBLISHED',${literal(input.goalNutritionTarget.targetPolicyRevision)},${literal(input.compositionPolicyRevision)},${literal(input.validationPolicyRevision)},${literal(input.optimizationPolicyRevision)},${literal(input.generationPolicyRevision)});
    COMMIT;`;
  ok(setup);
  const inputInsert = (owner = account, evidence = f.rawContext.trustedValidationEvidenceRaw, policies = f.policiesRaw) =>
    `INSERT INTO potok_nutrition.generation_validation_inputs_v1(request_operation_id,account_id,generation_input_digest,validation_evidence_raw,policies_raw,source_receipt_ref) VALUES (${request},${owner},${binary(f.evidence.generationInputDigest)},${literal(evidence)},${literal(policies)},'synthetic-only:inputs');`;
  const warningInsert = (body = f.warningRaw, sha = proposalSha) =>
    `INSERT INTO potok_nutrition.generation_validation_warnings_v1(request_operation_id,proposal_raw_sha256,warning_evidence_raw,source_receipt_ref) VALUES (${request},${binary(sha)},${literal(body)},'synthetic-only:warnings');`;
  const read = (sha = proposalSha) => `SELECT potok_nutrition.read_generation_validation_source_v1(${request},${binary(sha)});`;

  await t.test('missing inputs/warnings cannot yield a complete source', () => {
    assert.equal(ok(read()), ''); ok(inputInsert()); assert.equal(ok(read()), ''); ok(warningInsert());
  });
  await t.test('stored source -> SQL driver -> source loader -> actual week validator', async () => {
    const client = { async query(statement: string, values: readonly string[]) {
      assert.equal(statement, generationValidationSourceReadSqlV1);
      const result = ok(`SELECT potok_nutrition.read_generation_validation_source_v1(${literal(values[0])}::uuid,${binary(values[1])});`);
      return { rows: [{ source_raw: result || null }] };
    } };
    const adapter = createGenerationValidationAdapterV1(createGenerationValidationAuthorityLoaderV1(createSqlGenerationValidationSourceStoreV1(client)));
    const result = await adapter.validate(input.operation.requestId, f.planRaw);
    assert.equal(result.status, 'ACCEPTED');
    if (result.status !== 'ACCEPTED') throw new Error('native_expected_accept');
    assert.equal(result.validation.generationInputDigest, f.evidence.generationInputDigest);
    assert.equal(result.generatedPlanRaw, f.planRaw);
  });
  await t.test('reader executes in READ ONLY without status/ledger writes', () => {
    const before = ok('SELECT row_to_json(r)::text FROM potok_nutrition.adaptive_nutrition_generation_requests_v2 r;');
    assert.ok(ok('BEGIN READ ONLY;'+read()+'ROLLBACK;'));
    assert.equal(ok('SELECT row_to_json(r)::text FROM potok_nutrition.adaptive_nutrition_generation_requests_v2 r;'), before);
    assert.equal(ok("SELECT prosecdef::text||':'||provolatile::text FROM pg_proc WHERE oid='potok_nutrition.read_generation_validation_source_v1(uuid,bytea)'::regprocedure;"), 'false:s');
  });
  for (const role of ['anon','authenticated','service_role']) {
    await t.test(`${role} cannot read/write stored sources or execute reader`, () => {
      denied(`SET ROLE ${role};SELECT * FROM potok_nutrition.generation_validation_inputs_v1;`, /permission denied/);
      denied(`SET ROLE ${role};${inputInsert()}`, /permission denied/);
      denied(`SET ROLE ${role};${read()}`, /permission denied/);
    });
  }
  for (const table of ['generation_validation_inputs_v1','generation_validation_warnings_v1']) {
    await t.test(`${table} denies owner UPDATE/DELETE/TRUNCATE and has forced RLS`, () => {
      denied(`UPDATE potok_nutrition.${table} SET source_receipt_ref='replaced';`, /VALIDATION_HISTORY_IMMUTABLE/);
      denied(`DELETE FROM potok_nutrition.${table};`, /VALIDATION_HISTORY_IMMUTABLE/);
      // PostgreSQL's FK admission can reject input-only TRUNCATE before triggers.
      denied(`TRUNCATE potok_nutrition.${table};`, /VALIDATION_HISTORY_IMMUTABLE|foreign key constraint/);
      if (table === 'generation_validation_inputs_v1') {
        denied('TRUNCATE potok_nutrition.generation_validation_inputs_v1, potok_nutrition.generation_validation_warnings_v1;', /VALIDATION_HISTORY_IMMUTABLE/);
        denied('TRUNCATE potok_nutrition.generation_validation_inputs_v1 CASCADE;', /VALIDATION_HISTORY_IMMUTABLE/);
      }
      assert.equal(ok(`SELECT relrowsecurity::text||':'||relforcerowsecurity::text FROM pg_class WHERE oid='potok_nutrition.${table}'::regclass;`), 'true:true');
    });
  }
  await t.test('duplicate request/proposal insert conflicts; stored originals unchanged', () => {
    denied(inputInsert(), /duplicate key/); denied(warningInsert(), /duplicate key/);
    assert.equal(ok(`SELECT encode(policies_storage_sha256,'hex') FROM potok_nutrition.generation_validation_inputs_v1;`), hash(f.policiesRaw));
  });
  await t.test('request removal cannot cascade through stored validation history', () => {
    denied(`DELETE FROM potok_nutrition.adaptive_nutrition_generation_requests_v2 WHERE request_operation_id=${request};`, /foreign key constraint/);
  });
  await t.test('foreign request lookup and wrong proposal return unavailable', () => {
    assert.equal(ok(read('f'.repeat(64))), '');
    assert.equal(ok(`SELECT potok_nutrition.read_generation_validation_source_v1(${literal(id(999))},${binary(proposalSha)});`), '');
  });
  await t.test('stale manifest/preference/safety/policy heads and terminal request are unavailable', () => {
    const checks = [
      [`UPDATE potok_nutrition.adaptive_nutrition_candidate_manifest_head_v2 SET current_manifest_revision=${literal(id(999))};`],
      [`UPDATE potok_nutrition.nutrition_authority_heads_v1 SET current_preference_revision=${literal(id(999))};`],
      [`UPDATE potok_nutrition.nutrition_authority_heads_v1 SET current_safety_revision=${literal(id(999))};`],
      [`UPDATE potok_nutrition.adaptive_nutrition_generation_policy_head_v2 SET validation_policy_revision=${literal(id(999))};`],
      ["UPDATE potok_nutrition.adaptive_nutrition_generation_requests_v2 SET status='ACTIVE';"],
    ];
    for (const [change] of checks) assert.equal(ok('BEGIN;'+change+read()+'ROLLBACK;'), '');
    assert.ok(ok(read()));
  });
  await t.test('warning substitution and duplicate JSON are rejected before persistence', () => {
    const wrong = JSON.stringify({ ...f.set, validationPoliciesDigest: 'f'.repeat(64) });
    denied(warningInsert(wrong, 'e'.repeat(64)), /VALIDATION_WARNING_BINDING_MISMATCH/);
    const duplicate = f.warningRaw.replace('{', '{"contract":"duplicate",');
    denied(warningInsert(duplicate, 'e'.repeat(64)), /check constraint/);
  });
  await t.test('forged account binding cannot be stored for another request', () => {
    denied(inputInsert(literal(id(999))), /VALIDATION_REQUEST_BINDING_MISMATCH/);
  });
  await t.test('reader snapshot is consistent while another session changes current heads', async () => {
    await new Promise<void>((resolve, reject) => {
      const child = spawn('psql', args, { env: { ...process.env, PGCONNECT_TIMEOUT: '5', PGSSLMODE: 'disable' } });
      let output = ''; let stderr = ''; let changed = false;
      child.stdout.on('data', chunk => {
        output += String(chunk);
        if (!changed && output.includes('FIRST_READ_DONE')) {
          changed = true;
          try { ok(`UPDATE potok_nutrition.adaptive_nutrition_generation_policy_head_v2 SET validation_policy_revision=${literal(id(999))};`); }
          catch (error) { reject(error); }
        }
      });
      child.stderr.on('data', chunk => { stderr += String(chunk); });
      child.on('error', reject);
      child.on('close', exit => {
        try { assert.equal(exit, 0, stderr); assert.ok(changed); assert.match(output, /SECOND_READ_OK/); resolve(); }
        catch (error) { reject(error); }
      });
      child.stdin.end(`BEGIN ISOLATION LEVEL REPEATABLE READ READ ONLY;
        SELECT CASE WHEN potok_nutrition.read_generation_validation_source_v1(${request},${binary(proposalSha)}) IS NOT NULL THEN 'FIRST_READ_DONE' ELSE 'BAD_FIRST' END;
        SELECT pg_sleep(1);
        SELECT CASE WHEN potok_nutrition.read_generation_validation_source_v1(${request},${binary(proposalSha)}) IS NOT NULL THEN 'SECOND_READ_OK' ELSE 'BAD_SECOND' END;
        ROLLBACK;`);
    });
    assert.equal(ok(read()), '');
    ok(`UPDATE potok_nutrition.adaptive_nutrition_generation_policy_head_v2 SET validation_policy_revision=${literal(input.validationPolicyRevision)};`);
  });
  await t.test('actual SQL draft refuses another database before DDL', () => {
    const result = sql('BEGIN;SET LOCAL potok.disposable_generation_store=\'on\';'+sqlDraft+'ROLLBACK;', 'postgres');
    assert.notEqual(result.status, 0); assert.match(result.stderr, /DISPOSABLE_GENERATION_STORE_REQUIRED/);
    assert.equal(ok("SELECT count(*) FROM pg_namespace WHERE nspname='potok_nutrition';", 'postgres'), '0');
  });
  await t.test('actual SQL draft refuses absent disposable session admission', () => {
    denied('BEGIN;'+sqlDraft+'ROLLBACK;', /DISPOSABLE_GENERATION_STORE_REQUIRED/);
  });
});
