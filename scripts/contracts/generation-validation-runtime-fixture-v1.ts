// Synthetic loopback-only fixture for the installable package, not a live seed or publisher.
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {fullFixture} from '../../src/utils/__tests__/trustedGeneratedWeekFixturesV1';
import {canonicalJsonV1} from '../../src/utils/adaptiveNutritionWireV1';
import {adaptiveNutritionCandidateManifestCanonicalBytesV2,nutritionPreferenceSnapshotCanonicalBytesV1,nutritionSafetySnapshotCanonicalBytesV1} from '../../src/utils/adaptiveNutritionAuthoritiesV1';
import {ok,denied,literal,hex,binary,hash} from './generation-validation-fixture-v1';
const runtimeStorage=readFileSync(new URL('../../docs/premium/drafts/generation_validation_source_storage_v1.sql',import.meta.url),'utf8');
const prerequisites=readFileSync(new URL('./generation-admission-prerequisites-v1.sql',import.meta.url),'utf8');
export async function installGenerationRuntimeSourceFixtureV1() {
  // Fixed loopback-only, disposable DB admission. Never accept an arbitrary URL.
  assert.equal(ok('SELECT current_database();'), 'potok_generation_store_disposable');
  const f = await fullFixture(); const input = f.context.input; const request = literal(input.operation.requestId);
  const account = literal(input.accountId); const proposalSha = hash(f.planRaw);
  const inputBytes = Buffer.from(canonicalJsonV1(input, 'SAFE_INTEGER'));
  const manifest = await adaptiveNutritionCandidateManifestCanonicalBytesV2(f.context.manifest);
  const preference = await nutritionPreferenceSnapshotCanonicalBytesV1(f.context.preference);
  const safety = await nutritionSafetySnapshotCanonicalBytesV1(f.context.safety);
  const foundation = `BEGIN;
    CREATE SCHEMA extensions; CREATE EXTENSION pgcrypto WITH SCHEMA extensions;
    CREATE SCHEMA potok_nutrition;
    CREATE ROLE anon NOLOGIN; CREATE ROLE authenticated NOLOGIN; CREATE ROLE service_role NOLOGIN BYPASSRLS;
    GRANT USAGE ON SCHEMA potok_nutrition TO anon,authenticated,service_role;
    CREATE TABLE potok_nutrition.adaptive_nutrition_generation_requests_v2(request_operation_id uuid PRIMARY KEY, account_id uuid NOT NULL,generation_input_canonical bytea NOT NULL,generation_input_digest bytea NOT NULL,status text NOT NULL,selection_id uuid NOT NULL);
    CREATE TABLE potok_nutrition.adaptive_nutrition_candidate_manifest_head_v2(singleton boolean PRIMARY KEY,current_manifest_revision uuid NOT NULL);
    CREATE TABLE potok_nutrition.adaptive_nutrition_candidate_manifests_v2(manifest_revision uuid PRIMARY KEY,publication_state text NOT NULL,canonical_bytes bytea NOT NULL,canonical_digest bytea NOT NULL);
    CREATE TABLE potok_nutrition.nutrition_authority_heads_v1(account_id uuid PRIMARY KEY,current_preference_revision uuid NOT NULL,current_safety_revision uuid NOT NULL);
    CREATE TABLE potok_nutrition.nutrition_preference_snapshots_v1(account_id uuid,revision_id uuid,canonical_bytes bytea NOT NULL,canonical_digest bytea NOT NULL,PRIMARY KEY(account_id,revision_id));
    CREATE TABLE potok_nutrition.nutrition_safety_snapshots_v1(account_id uuid,revision_id uuid,canonical_bytes bytea NOT NULL,canonical_digest bytea NOT NULL,PRIMARY KEY(account_id,revision_id));
    CREATE TABLE potok_nutrition.adaptive_nutrition_generation_policy_head_v2(singleton boolean PRIMARY KEY,publication_state text NOT NULL,target_policy_revision uuid,composition_policy_revision uuid,validation_policy_revision uuid,optimization_policy_revision uuid,generation_policy_revision uuid);
    SET LOCAL potok.disposable_generation_store='on';

    CREATE SCHEMA potok_control;
    REVOKE ALL ON SCHEMA potok_control FROM PUBLIC,anon,authenticated,service_role;
    CREATE TABLE potok_control.access_attestations(attestation_id uuid PRIMARY KEY,account_id uuid NOT NULL,capability text NOT NULL,effect text NOT NULL,previous_attestation_id uuid,lineage_sequence bigint NOT NULL,issued_at timestamptz NOT NULL,valid_until timestamptz);
    CREATE TABLE public.user_premium_plan_selections(id uuid PRIMARY KEY,user_id uuid NOT NULL,status text NOT NULL,plan_revision uuid,week_anchor date NOT NULL,timezone text NOT NULL,goal_revision uuid NOT NULL,origin_lineage jsonb NOT NULL);
    CREATE TABLE public.user_goals(user_id uuid PRIMARY KEY,goal_revision uuid NOT NULL);
    ${prerequisites}
    COMMIT;`;
  ok(foundation);
  // Prove that a drifted prerequisite aborts the install before any source object is created.
  ok('ALTER FUNCTION potok_nutrition.require_canonical_json_v2(bytea) SET search_path=public;');
  denied(runtimeStorage,/GENERATION_ADMISSION_PREREQUISITE_DRIFT/);
  assert.equal(ok("SELECT to_regclass('potok_nutrition.generation_validation_inputs_v1') IS NULL AND to_regrole('potok_generation_reader_v1') IS NULL;"),'t');
  ok('ALTER FUNCTION potok_nutrition.require_canonical_json_v2(bytea) SET search_path=pg_catalog;');
  const preflight=readFileSync(new URL('../../docs/premium/drafts/generation_validation_source_storage_v1.preflight.sql',import.meta.url),'utf8');
  assert.equal(JSON.parse(ok(preflight)).ready_for_install,true);
  ok(runtimeStorage);
  const setup = `BEGIN;
    INSERT INTO potok_nutrition.adaptive_nutrition_generation_requests_v2 VALUES (${request},${account},${binary(hex(inputBytes))},${binary(f.evidence.generationInputDigest)},'REQUESTED',${literal(input.selection.selectionId)});
    INSERT INTO potok_nutrition.adaptive_nutrition_candidate_manifests_v2 VALUES (${literal(input.candidateManifestRevision)},'PUBLISHED',${binary(hex(manifest))},${binary(hash(manifest))});
    INSERT INTO potok_nutrition.adaptive_nutrition_candidate_manifest_head_v2 VALUES (true,${literal(input.candidateManifestRevision)});
    INSERT INTO potok_nutrition.nutrition_authority_heads_v1 VALUES (${account},${literal(input.preferenceRevision)},${literal(input.safetyRevision)});
    INSERT INTO potok_nutrition.nutrition_preference_snapshots_v1 VALUES (${account},${literal(input.preferenceRevision)},${binary(hex(preference))},${binary(hash(preference))});
    INSERT INTO potok_nutrition.nutrition_safety_snapshots_v1 VALUES (${account},${literal(input.safetyRevision)},${binary(hex(safety))},${binary(hash(safety))});
    INSERT INTO potok_nutrition.adaptive_nutrition_generation_policy_head_v2 VALUES (true,'PUBLISHED',${literal(input.goalNutritionTarget.targetPolicyRevision)},${literal(input.compositionPolicyRevision)},${literal(input.validationPolicyRevision)},${literal(input.optimizationPolicyRevision)},${literal(input.generationPolicyRevision)});
    INSERT INTO public.user_premium_plan_selections VALUES (${literal(input.selection.selectionId)},${account},'pending_generation',NULL,${literal(input.weekStartLocal)},${literal(input.timezone)},${literal(input.goalNutritionTarget.goalRevision)},jsonb_build_object('provisionOperationId',${literal(input.selection.planSelectionRevision)}));
    INSERT INTO public.user_goals VALUES (${account},${literal(input.goalNutritionTarget.goalRevision)});
    INSERT INTO potok_control.access_attestations VALUES (${literal(input.entitlementEvidenceRevision)},${account},'premium','GRANT',NULL,1,statement_timestamp()-interval '1 hour',statement_timestamp()+interval '1 day');
    COMMIT;`;
  ok(setup);
  const inputInsert = (owner = account, evidence = f.rawContext.trustedValidationEvidenceRaw, policies = f.policiesRaw) =>
    `INSERT INTO potok_nutrition.generation_validation_inputs_v1(request_operation_id,account_id,generation_input_digest,validation_evidence_raw,policies_raw,source_receipt_ref) VALUES (${request},${owner},${binary(f.evidence.generationInputDigest)},${literal(evidence)},${literal(policies)},'synthetic-only:inputs');`;
  const warningInsert = (body = f.warningRaw, sha = proposalSha) =>
    `INSERT INTO potok_nutrition.generation_validation_warnings_v1(request_operation_id,proposal_raw_sha256,warning_evidence_raw,source_receipt_ref) VALUES (${request},${binary(sha)},${literal(body)},'synthetic-only:warnings');`;
  const read = (sha = proposalSha) => `SELECT potok_nutrition.read_generation_validation_source_v1(${request},${binary(sha)});`;

  return { f, input, request, account, proposalSha, inputInsert, warningInsert, read };
}
