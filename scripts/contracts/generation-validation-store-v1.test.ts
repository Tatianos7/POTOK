import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import test from 'node:test';
import { createSqlGenerationValidationSourceStoreV1, generationValidationSourceReadSqlV1 } from '../../src/server/generationValidationSourceSqlV1';
import { createGenerationValidationAuthorityLoaderV1 } from '../../src/server/generationValidationAuthorityLoaderV1';
import { createGenerationValidationAdapterV1 } from '../../src/server/generationValidationAdapterV1';
import { id } from '../../src/utils/__tests__/trustedGeneratedWeekFixturesV1';
import { sqlDraft, args, sql, ok, denied, literal, binary, hash, installGenerationStoreFixtureV1 } from './generation-validation-fixture-v1';
const native = process.env.POTOK_GENERATION_STORE_NATIVE === '1';

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
  const { f, input, request, account, proposalSha, inputInsert, warningInsert, read } = await installGenerationStoreFixtureV1();

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
  await t.test('new warning insertion is denied after terminal status', () => {
    denied("BEGIN;UPDATE potok_nutrition.adaptive_nutrition_generation_requests_v2 SET status='ACTIVE';"+
      warningInsert(f.warningRaw, 'e'.repeat(64))+'ROLLBACK;', /VALIDATION_REQUEST_BINDING_MISMATCH/);
    assert.ok(ok(read()));
  });
  await t.test('actual insert waits for concurrent terminal transition then rejects without a new row', async () => {
    await new Promise<void>((resolve, reject) => {
      const child = spawn('psql', args, { env: { ...process.env, PGCONNECT_TIMEOUT: '5', PGSSLMODE: 'disable' } });
      let output = ''; let stderr = ''; let attempted = false;
      child.stdout.on('data', chunk => {
        output += String(chunk);
        if (!attempted && output.includes('STATUS_LOCKED')) {
          attempted = true;
          try { denied(warningInsert(f.warningRaw, 'e'.repeat(64)), /VALIDATION_REQUEST_BINDING_MISMATCH/); }
          catch (error) { reject(error); }
        }
      });
      child.stderr.on('data', chunk => { stderr += String(chunk); });
      child.on('error', reject);
      child.on('close', exit => {
        try { assert.equal(exit, 0, stderr); assert.ok(attempted); resolve(); } catch (error) { reject(error); }
      });
      child.stdin.end("BEGIN;UPDATE potok_nutrition.adaptive_nutrition_generation_requests_v2 SET status='ACTIVE';"+
        "SELECT 'STATUS_LOCKED';SELECT pg_sleep(1);COMMIT;");
    });
    assert.equal(ok('SELECT count(*) FROM potok_nutrition.generation_validation_warnings_v1;'), '1');
    ok("UPDATE potok_nutrition.adaptive_nutrition_generation_requests_v2 SET status='REQUESTED';");
  });
  await t.test('terminal transition cannot pass an already admitted uncommitted source insert', async () => {
    await new Promise<void>((resolve, reject) => {
      const child = spawn('psql', args, { env: { ...process.env, PGCONNECT_TIMEOUT: '5', PGSSLMODE: 'disable' } });
      let output = ''; let stderr = ''; let attempted = false;
      child.stdout.on('data', chunk => {
        output += String(chunk);
        if (!attempted && output.includes('INSERT_LOCKED')) {
          attempted = true;
          try {
            denied("BEGIN;SET LOCAL lock_timeout='200ms';UPDATE potok_nutrition.adaptive_nutrition_generation_requests_v2 SET status='ACTIVE';ROLLBACK;", /lock timeout/);
          } catch (error) { reject(error); }
        }
      });
      child.stderr.on('data', chunk => { stderr += String(chunk); });
      child.on('error', reject);
      child.on('close', exit => {
        try { assert.equal(exit, 0, stderr); assert.ok(attempted); resolve(); } catch (error) { reject(error); }
      });
      child.stdin.end('BEGIN;'+warningInsert(f.warningRaw, 'e'.repeat(64))+"SELECT 'INSERT_LOCKED';SELECT pg_sleep(2);COMMIT;");
    });
    assert.equal(ok('SELECT count(*) FROM potok_nutrition.generation_validation_warnings_v1;'), '2');
    ok("UPDATE potok_nutrition.adaptive_nutrition_generation_requests_v2 SET status='ACTIVE';");
    assert.equal(ok(read()), '');
    ok("UPDATE potok_nutrition.adaptive_nutrition_generation_requests_v2 SET status='REQUESTED';");
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
