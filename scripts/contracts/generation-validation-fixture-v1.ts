import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { fullFixture } from '../../src/utils/__tests__/trustedGeneratedWeekFixturesV1';
import { canonicalJsonV1 } from '../../src/utils/adaptiveNutritionWireV1';
import { adaptiveNutritionCandidateManifestCanonicalBytesV2, nutritionPreferenceSnapshotCanonicalBytesV1,
  nutritionSafetySnapshotCanonicalBytesV1 } from '../../src/utils/adaptiveNutritionAuthoritiesV1';

const sqlDraft = readFileSync(new URL('./generation-validation-store-v1.sql', import.meta.url), 'utf8');
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

export async function installGenerationStoreFixtureV1() {
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

  return { f, input, request, account, proposalSha, inputInsert, warningInsert, read };
}

export { sqlDraft, args, sql, ok, denied, literal, hex, binary, hash };
