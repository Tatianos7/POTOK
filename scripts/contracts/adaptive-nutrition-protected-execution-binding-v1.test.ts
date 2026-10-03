import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';
import {
  GenerationEdgeErrorV2,
  continueGenerationV2,
  decodeGenerationRequestV2,
  decodeGenerationStatusInputV2,
  generationRequestProtocolV2,
  requestGenerationV2,
  type GenerationRpcClientV2,
} from '../../supabase/functions/adaptive-nutrition-generate-v2/contracts.ts';

const root = new URL('../../', import.meta.url);
const migrationPath = new URL(
  'docs/premium/drafts/20260930_adaptive_nutrition_protected_execution_binding_v1.sql', root,
);
const preflightPath = new URL(
  'docs/premium/drafts/20260930_adaptive_nutrition_protected_execution_binding_v1.preflight.sql', root,
);
const acceptancePath = new URL(
  'docs/premium/drafts/20260930_adaptive_nutrition_protected_execution_binding_v1.behavioral-acceptance.sql', root,
);
const postcheckPath = new URL(
  'docs/premium/drafts/20260930_adaptive_nutrition_protected_execution_binding_v1.postcheck.sql', root,
);
const authRepairPath = new URL(
  'docs/premium/drafts/20261002_adaptive_nutrition_protected_execution_auth_contract_v1.repair.sql', root,
);
const schemaUsageRepairPath = new URL(
  'docs/premium/drafts/20261002_adaptive_nutrition_protected_execution_schema_usage_v1.repair.sql', root,
);
const persistenceMigrationPath = new URL(
  'docs/premium/drafts/20260921_adaptive_nutrition_persistence_v1.sql', root,
);
const edgeIndexPath = new URL(
  'supabase/functions/adaptive-nutrition-generate-v2/index.ts', root,
);
const graphV2MigrationPath = new URL(
  'docs/premium/drafts/20260927_adaptive_nutrition_graph_v2_authorities_activation_v1.sql', root,
);

const migration = readFileSync(migrationPath, 'utf8');
const preflight = readFileSync(preflightPath, 'utf8');
const acceptance = readFileSync(acceptancePath, 'utf8');
const postcheck = readFileSync(postcheckPath, 'utf8');
const authRepair = readFileSync(authRepairPath, 'utf8');
const schemaUsageRepair = readFileSync(schemaUsageRepairPath, 'utf8');
const persistenceMigration = readFileSync(persistenceMigrationPath, 'utf8');
const edgeIndex = readFileSync(edgeIndexPath, 'utf8');
const graphV2Migration = readFileSync(graphV2MigrationPath, 'utf8');

function withoutComments(value: string): string {
  return value.replace(/--[^\n]*/g, '').replace(/\/\*[\s\S]*?\*\//g, '');
}

function withoutStrings(value: string): string {
  return withoutComments(value)
    .replace(/'(?:''|[^'])*'/g, "''")
    .replace(/\$([a-zA-Z_][a-zA-Z0-9_]*)?\$[\s\S]*?\$\1\$/g, '$$');
}

function statementCount(value: string, keyword: string): number {
  return (withoutComments(value).match(new RegExp(`^\\s*${keyword}\\s*;`, 'gim')) ?? []).length;
}

function finalStatement(value: string): string {
  const statements = withoutComments(value).split(';').map((item) => item.trim()).filter(Boolean);
  return statements[statements.length - 1] ?? '';
}

function assertBalanced(value: string): void {
  const tags = value.match(/\$[a-zA-Z_][a-zA-Z0-9_]*\$|\$\$/g) ?? [];
  const counts = new Map<string, number>();
  tags.forEach((tag) => counts.set(tag, (counts.get(tag) ?? 0) + 1));
  for (const [tag, count] of counts) assert.equal(count % 2, 0, `unbalanced ${tag}`);
}

test('migration is one transaction and acceptance is mandatory rollback-only', () => {
  assert.equal(statementCount(migration, 'BEGIN'), 1);
  assert.equal(statementCount(migration, 'COMMIT'), 1);
  assert.equal(statementCount(migration, 'ROLLBACK'), 0);
  assert.match(finalStatement(migration), /^COMMIT$/i);
  assert.equal(statementCount(acceptance, 'BEGIN'), 1);
  assert.equal(statementCount(acceptance, 'COMMIT'), 0);
  assert.equal(statementCount(acceptance, 'ROLLBACK'), 1);
  assert.match(finalStatement(acceptance), /^ROLLBACK$/i);
  [migration, preflight, acceptance, postcheck, authRepair, schemaUsageRepair].forEach(assertBalanced);
});

test('auth repair changes only the request authentication/validation ordering', () => {
  const signature = 'FUNCTION public.adaptive_nutrition_request_generation_v2(';
  const sourceStart = migration.indexOf(`CREATE ${signature}`);
  const repairStart = authRepair.indexOf(`CREATE OR REPLACE ${signature}`);
  assert.ok(sourceStart >= 0 && repairStart >= 0);
  const sourceEnd = migration.indexOf('$function$;', sourceStart) + '$function$;'.length;
  const repairEnd = authRepair.indexOf('$function$;', repairStart) + '$function$;'.length;
  const sourceFunction = migration.slice(sourceStart, sourceEnd);
  const repairFunction = authRepair.slice(repairStart, repairEnd);
  const oldGuard = `  IF v_actor IS NULL OR p_idempotency_key IS NULL OR p_protocol_version IS NULL
     OR p_protocol_version='' OR p_protocol_version<>pg_catalog.btrim(p_protocol_version) THEN
    RAISE EXCEPTION 'INVALID_REQUEST' USING ERRCODE='22023';
  END IF;`;
  const newGuard = `  IF v_actor IS NULL THEN
    RAISE EXCEPTION 'AUTH_REQUIRED' USING ERRCODE='42501';
  END IF;
  IF p_idempotency_key IS NULL OR p_protocol_version IS NULL
     OR p_protocol_version='' OR p_protocol_version<>pg_catalog.btrim(p_protocol_version) THEN
    RAISE EXCEPTION 'INVALID_REQUEST' USING ERRCODE='22023';
  END IF;`;
  assert.equal(sourceFunction.split(oldGuard).length, 2);
  assert.equal(
    repairFunction,
    sourceFunction
      .replace('CREATE FUNCTION', 'CREATE OR REPLACE FUNCTION')
      .replace(oldGuard, newGuard),
  );
  assert.equal(statementCount(authRepair, 'BEGIN'), 1);
  assert.equal(statementCount(authRepair, 'COMMIT'), 1);
  assert.equal(statementCount(authRepair, 'ROLLBACK'), 0);
  assert.match(authRepair, /CURRENT_USER <> 'postgres'/);
  assert.match(finalStatement(authRepair), /^COMMIT$/i);
  assert.match(repairFunction, /SECURITY DEFINER SET search_path=pg_catalog/);
});

test('behavioral acceptance keeps exact auth and request-validation error contracts', () => {
  assert.match(acceptance, /WHEN insufficient_privilege[\s\S]*?v_message='AUTH_REQUIRED'/);
  assert.match(acceptance, /NULL::text[\s\S]*?v_message='INVALID_REQUEST'/);
  assert.match(acceptance, /NULL::uuid[\s\S]*?v_message='INVALID_REQUEST'/);
  assert.match(acceptance, /potok-adaptive-generation-request-v3[\s\S]*?v_message='UNSUPPORTED_PROTOCOL'/);
  assert.match(acceptance, /Free request was not denied/);
  assert.match(acceptance, /Premium request\/replay contract failed/);
  assert.match(acceptance, /changed request did not conflict/);
});

test('schema-USAGE repair exposes only the three reviewed service gateways', () => {
  assert.match(persistenceMigration,
    /REVOKE ALL ON SCHEMA potok_nutrition FROM PUBLIC, anon, authenticated, service_role;/);
  assert.doesNotMatch(migration, /GRANT\s+USAGE\s+ON\s+SCHEMA\s+potok_nutrition/i);
  assert.equal((schemaUsageRepair.match(/\bGRANT\b/gi) ?? []).length, 1);
  assert.match(schemaUsageRepair,
    /GRANT USAGE ON SCHEMA potok_nutrition TO service_role;/);
  assert.doesNotMatch(schemaUsageRepair,
    /GRANT\s+(?:CREATE|ALL)|ON\s+(?:TABLE|SEQUENCE)|ALL\s+FUNCTIONS|TO\s+(?:anon|authenticated)/i);
  for (const signature of [
    'load_generation_request_v2(uuid)',
    'record_generated_week_gateway_v2(uuid,bytea)',
    'activate_generated_week_gateway_v2(uuid)',
  ]) assert.match(schemaUsageRepair, new RegExp(signature.replace(/[()]/g, '\\$&')));
  assert.match(schemaUsageRepair, /SERVICE_ROLE_FUNCTION_ALLOWLIST_MISMATCH/);
  assert.equal(statementCount(schemaUsageRepair, 'BEGIN'), 1);
  assert.equal(statementCount(schemaUsageRepair, 'COMMIT'), 1);
  assert.match(finalStatement(schemaUsageRepair), /^COMMIT$/i);
});

test('postcheck verifies schema access and the complete effective service-role allowlist', () => {
  assert.match(postcheck, /service_role_gateway_schema_usage/);
  assert.match(postcheck, /service_role_usage AND NOT service_role_create/);
  assert.match(postcheck,
    /NOT public_usage AND NOT public_create[\s\S]*?NOT anon_usage AND NOT anon_create[\s\S]*?NOT authenticated_usage AND NOT authenticated_create/);
  assert.match(postcheck, /service_role_effective_gateway_allowlist/);
  assert.match(postcheck, /FROM service_role_executable_functions/);
  assert.match(postcheck, /pg_catalog\.count\(\*\)=3 AND pg_catalog\.bool_and\(oid IN/);
  assert.match(postcheck, /all_internal_six_direct_acl_denied/);
});

test('authenticated Graph v2 acceptance uses only public readers, never internal graph storage', () => {
  assert.match(persistenceMigration,
    /REVOKE ALL ON public\.adaptive_nutrition_graph_revisions,[\s\S]*?FROM PUBLIC, anon, authenticated, service_role;/);
  assert.match(graphV2Migration,
    /GRANT EXECUTE ON FUNCTION public\.adaptive_nutrition_read_graph_v2\(uuid,uuid,text\),[\s\S]*?TO authenticated;/i);

  const ownerEvidenceStart = acceptance.indexOf('DO $bind_exact_graph_read_evidence$');
  const ownerEvidenceEnd = acceptance.indexOf('$bind_exact_graph_read_evidence$;', ownerEvidenceStart);
  assert.ok(ownerEvidenceStart >= 0 && ownerEvidenceEnd > ownerEvidenceStart);
  const ownerEvidence = acceptance.slice(ownerEvidenceStart, ownerEvidenceEnd);
  assert.match(ownerEvidence, /CURRENT_USER <> 'postgres'/);
  assert.match(acceptance, /plan_revision uuid UNIQUE NULL/);
  assert.doesNotMatch(acceptance, /'93020000-0000-4000-8000-000000000040'::uuid/);
  assert.match(ownerEvidence, /FROM public\.user_premium_plan_selections s/);
  assert.match(ownerEvidence, /JOIN public\.adaptive_nutrition_graph_revisions g/);
  assert.match(ownerEvidence, /v_expected_plan_revision:=\(v_plan->>'proposedPlanRevision'\)::uuid/);
  assert.match(ownerEvidence, /v_plan_revision IS DISTINCT FROM v_expected_plan_revision/);
  assert.match(ownerEvidence, /v_graph_canonical_bytes IS DISTINCT FROM v_recomputed_graph_canonical_bytes/);
  assert.match(ownerEvidence, /extensions\.digest\(v_graph_canonical_bytes,'sha256'\)/);
  assert.match(ownerEvidence, /v_plan->>'graphDigest' IS DISTINCT FROM v_recomputed_graph_digest/);
  assert.match(ownerEvidence, /SET plan_revision=v_plan_revision,exact_graph_digest=v_graph_digest/);

  const actorReadStart = acceptance.indexOf('DO $exact_status_and_reads$');
  const actorReadEnd = acceptance.indexOf('$exact_status_and_reads$;', actorReadStart);
  assert.ok(actorReadStart >= 0 && actorReadEnd > actorReadStart);
  const actorRead = acceptance.slice(actorReadStart, actorReadEnd);
  assert.match(actorRead, /public\.adaptive_nutrition_generation_status_v2\(/);
  assert.match(actorRead, /public\.adaptive_nutrition_read_graph_v2\(/);
  assert.doesNotMatch(actorRead, /(?:FROM|JOIN)\s+public\.(?:user_premium_plan_selections|adaptive_nutrition_graph_revisions)\b/i);
  assert.match(actorRead, /v_read->>'plan_revision' IS DISTINCT FROM v\.plan_revision::text/);
  assert.match(actorRead, /v_read->>'graph_digest_hex' IS DISTINCT FROM v\.exact_graph_digest/);

  const authenticatedBlocks = acceptance.split('SET LOCAL ROLE authenticated;').slice(1)
    .map((block) => block.slice(0, block.indexOf('RESET ROLE;')));
  assert.ok(authenticatedBlocks.length > 0);
  for (const block of authenticatedBlocks) {
    assert.doesNotMatch(block,
      /(?:FROM|JOIN)\s+public\.(?:user_premium_plan_selections|adaptive_nutrition_graph_revisions)\b/i);
  }
});

test('Graph v2 content_digest and GeneratedWeekPlan graphDigest share one canonical envelope domain', () => {
  assert.match(migration,
    /v_graph_bytes := pg_catalog\.convert_to\(potok_nutrition\.canonical_jsonb_text_v1\([\s\S]*?'encoding','potok-adaptive-nutrition-graph-v2-canonical-json-v1',[\s\S]*?'contract','adaptive_nutrition_graph_v2','graph',v_graph[\s\S]*?v_graph_digest := extensions\.digest\(v_graph_bytes,'sha256'\)/);
  assert.match(migration,
    /pg_catalog\.decode\(v_result ->> 'graphDigest','hex'\) <> v_graph_digest/);
  assert.match(migration,
    /'potok-adaptive-nutrition-graph-v2-canonical-json-v1',v_generation\.result_graph_digest/);
  assert.match(graphV2Migration,
    /'graph_digest_hex',pg_catalog\.encode\(v_graph\.content_digest,'hex'\)/);
});

test('preflight and postcheck remain one SELECT-only metadata/read statement', () => {
  for (const sql of [preflight, postcheck]) {
    const executable = withoutStrings(sql).trim();
    assert.match(executable, /^WITH\b/i);
    assert.equal((executable.match(/;/g) ?? []).length, 1);
    assert.doesNotMatch(executable,
      /\b(?:INSERT|UPDATE|DELETE|MERGE|TRUNCATE|ALTER|CREATE|DROP|GRANT|REVOKE|COMMENT|CALL|DO|COPY|BEGIN|COMMIT|ROLLBACK)\b/i);
    assert.doesNotMatch(executable, /\bSET\s+(?:LOCAL\s+)?ROLE\b/i);
    assert.doesNotMatch(executable, /\b(?:SELECT|PERFORM)\s+(?:public|potok_control|potok_nutrition)\./i);
  }
  assert.match(preflight, /ozidryfvhkcbtpnulakq/);
  assert.match(preflight, /operations_action_is_extensible/);
  assert.match(preflight, /writer_prebinding_sentinel/);
  assert.match(preflight, /adaptive_nutrition_goal_targets_v1/);
  assert.match(postcheck, /protected_execution_binding_postcheck_pass/);
  assert.match(postcheck, /package_mutation_guards/);
  assert.match(postcheck, /NOT application_acl/);
});

test('SQL special forms are never schema-qualified', () => {
  for (const sql of [migration, preflight, acceptance, postcheck]) {
    assert.doesNotMatch(sql, /pg_catalog\.(?:coalesce|nullif|greatest|least)\s*\(/i);
  }
});

test('mutation-guard postcheck is semantic and independent of normalized event order', () => {
  assert.match(postcheck, /t\.tgtype::integer AS tgtype/);
  assert.match(postcheck, /function_name='reject_immutable_change_v2'/);
  assert.match(postcheck, /function_name='protect_generation_request_identity_v2'/);
  assert.match(postcheck, /tgname='potok_goal_target_immutable_v1'[\s\S]*?\(tgtype & 1\)=0[\s\S]*?\(tgtype & 60\)=56/);
  assert.match(postcheck, /tgname='potok_generation_request_update_guard_v2'[\s\S]*?\(tgtype & 1\)=1[\s\S]*?\(tgtype & 60\)=16/);
  assert.match(postcheck, /tgname='potok_generation_request_delete_guard_v2'[\s\S]*?\(tgtype & 1\)=0[\s\S]*?\(tgtype & 60\)=40/);
  assert.doesNotMatch(postcheck, /definition ILIKE '%(?:UPDATE OR DELETE|DELETE OR UPDATE)[^']*%'/i);
});

test('Goal nutrition corridors require an immutable reviewed target authority', () => {
  assert.match(migration, /CREATE TABLE potok_nutrition\.adaptive_nutrition_goal_targets_v1/);
  assert.match(migration, /PRIMARY KEY \(account_id,goal_revision,target_policy_revision\)/);
  assert.match(migration, /potok_goal_target_immutable_v1/);
  assert.match(migration, /SELECT \* INTO STRICT v_goal_target/);
  assert.doesNotMatch(migration,
    /jsonb_build_object\(\s*'target',v_goal\.calories,\s*'min',v_goal\.calories,\s*'max',v_goal\.calories/i);
  assert.match(acceptance, /INSERT INTO potok_nutrition\.adaptive_nutrition_goal_targets_v1/);
  assert.match(acceptance, /'target','2000\.000','min','1500\.000','max','2500\.000'/);
  assert.match(postcheck, /no synthetic policy or Goal-target authority/);
});

test('writer repair is invoker-only and keeps a second direct-call barrier', () => {
  for (const name of ['record_generated_week_v2', 'activate_generated_week_v2']) {
    const start = migration.indexOf(`CREATE OR REPLACE FUNCTION potok_nutrition.${name}`);
    assert.ok(start >= 0, `${name} replacement missing`);
    const body = migration.slice(start, migration.indexOf('$function$;', start) + 11);
    assert.match(body, /SECURITY INVOKER SET search_path = pg_catalog/i);
    assert.match(body, /IF CURRENT_USER <> 'postgres'/i);
    assert.doesNotMatch(body, /SESSION_USER <> 'postgres'/i);
    assert.match(body, /acquire_shared_account_gate_v1/);
  }
  assert.match(postcheck, /internal_graph_writer_invoker_sentinel/);
});

test('writer repair changes only CREATE mode, security mode and caller sentinel', () => {
  const extract = (sql: string, prefix: string, name: string): string => {
    const start = sql.indexOf(`${prefix}${name}`);
    assert.ok(start >= 0, `${name} definition missing`);
    const end = sql.indexOf('$function$;', start);
    assert.ok(end >= 0, `${name} terminator missing`);
    return sql.slice(start, end + '$function$;'.length);
  };
  for (const name of ['record_generated_week_v2', 'activate_generated_week_v2']) {
    const accepted = extract(graphV2Migration, 'CREATE FUNCTION potok_nutrition.', name);
    const repaired = extract(migration, 'CREATE OR REPLACE FUNCTION potok_nutrition.', name)
      .replace('CREATE OR REPLACE FUNCTION', 'CREATE FUNCTION')
      .replace('SECURITY INVOKER', 'SECURITY DEFINER')
      .replace("IF CURRENT_USER <> 'postgres' THEN",
        "IF SESSION_USER <> 'postgres' OR CURRENT_USER <> 'postgres' THEN");
    assert.equal(repaired, accepted, `${name} business body changed beyond reviewed sentinel repair`);
  }
});

test('only the three narrow gateways receive service_role execute', () => {
  const grant = migration.match(/GRANT EXECUTE ON FUNCTION potok_nutrition\.load_generation_request_v2[\s\S]*?TO service_role;/i)?.[0] ?? '';
  for (const signature of [
    'load_generation_request_v2(uuid)',
    'record_generated_week_gateway_v2(uuid,bytea)',
    'activate_generated_week_gateway_v2(uuid)',
  ]) assert.match(grant, new RegExp(signature.replace(/[()]/g, '\\$&')));
  for (const internal of [
    'initialize_nutrition_authorities_v1', 'create_preference_successor_v1',
    'create_safety_successor_v1', 'publish_candidate_manifest_v2',
    'record_generated_week_v2', 'activate_generated_week_v2',
  ]) {
    assert.doesNotMatch(migration,
      new RegExp(`GRANT EXECUTE ON FUNCTION potok_nutrition\\.${internal}[\\s\\S]{0,220}TO service_role`, 'i'));
  }
  assert.match(postcheck, /all_internal_six_direct_acl_denied/);
});

test('request/status are authenticated and gateways derive account from durable request', () => {
  assert.match(migration, /v_actor uuid:=auth\.uid\(\)/);
  assert.match(migration, /GRANT EXECUTE ON FUNCTION public\.adaptive_nutrition_request_generation_v2[\s\S]*?TO authenticated;/i);
  assert.doesNotMatch(migration, /adaptive_nutrition_request_generation_v2\([^)]*account/i);
  for (const name of [
    'load_generation_request_v2', 'record_generated_week_gateway_v2',
    'activate_generated_week_gateway_v2',
  ]) {
    assert.match(migration, new RegExp(`${name}\\(\\s*p_request_operation_id uuid`));
  }
  assert.match(migration, /GENERATION_REQUESTED_V2/);
  assert.match(migration, /GENERATION_ATTEMPTED_V2/);
  assert.match(migration, /IDEMPOTENCY_PAYLOAD_MISMATCH/);
});

test('Edge source keeps secrets in environment and real generator disabled', () => {
  assert.match(edgeIndex, /Deno\.env\.get/);
  assert.doesNotMatch(edgeIndex, /SUPABASE_SERVICE_ROLE_KEY|continueGenerationV2|gatewayClient/);
  assert.match(edgeIndex, /const generator: GenerationProposalProviderV2 \| null = null/);
  assert.match(edgeIndex, /const validator: TrustedGenerationValidatorV2 \| null = null/);
  assert.match(edgeIndex, /Deno\.serve\(createRequestStatusHandlerV2\(/);
  assert.doesNotMatch(edgeIndex, /generatorActivated/);
  assert.doesNotMatch(edgeIndex, /(?:eyJ[a-zA-Z0-9_-]{20,}\.|sb_secret_[a-zA-Z0-9_-]{8,}|service_role\s*[:=]\s*['"][^'"]+)/);
});

test('acceptance names the complete 30-case fail-closed matrix', () => {
  for (const marker of [
    'unauthenticated request', 'Free user', 'Premium request', 'identity comes only from auth.uid',
    'exact replay', 'changed protocol', 'service_role direct internal writer',
    'authenticated direct gateway', 'narrow service gateway', 'stale Goal', 'stale preference',
    'stale safety', 'stale manifest', 'manifest digest mismatch', 'malformed output',
    'invalid candidate', 'Graph digest mismatch', 'record success', 'record replay',
    'crash-after-record', 'activation success', 'activation replay', 'CAS loss',
    'entitlement expiry', 'crash-after-activation', 'two-worker', 'account isolation',
    'mandatory rollback', 'Graph v1', 'Graph v2',
  ]) assert.match(acceptance, new RegExp(marker, 'i'), marker);
  assert.doesNotMatch(acceptance,
    /INSERT\s+INTO\s+public\.(?:adaptive_nutrition_events|food_diary_entries|user_premium_meal_selections)/i);
  assert.doesNotMatch(migration,
    /INSERT\s+INTO\s+public\.(?:adaptive_nutrition_events|food_diary_entries|user_premium_meal_selections)/i);
});

test('strict request DTO rejects duplicate, extra and authoritative fields', () => {
  const key = '93020000-0000-4000-8000-000000000050';
  assert.deepEqual(decodeGenerationRequestV2(JSON.stringify({
    protocolVersion: generationRequestProtocolV2,
    idempotencyKey: key,
  })), { protocolVersion: generationRequestProtocolV2, idempotencyKey: key });
  for (const raw of [
    `{"protocolVersion":"${generationRequestProtocolV2}","idempotencyKey":"${key}","idempotencyKey":"${key}"}`,
    JSON.stringify({ protocolVersion: generationRequestProtocolV2, idempotencyKey: key, accountId: key }),
    JSON.stringify({ protocolVersion: generationRequestProtocolV2 }),
  ]) assert.throws(() => decodeGenerationRequestV2(raw), GenerationEdgeErrorV2);
  assert.deepEqual(decodeGenerationStatusInputV2(key), { requestOperationId: key });
});

test('request and orchestration preserve original request identity through record and activation', async () => {
  const requestId = '93020000-0000-4000-8000-000000000060';
  const calls: Array<{ name: string; args: Record<string, unknown> }> = [];
  const client: GenerationRpcClientV2 = {
    async rpc<T>(name: string, args: Record<string, unknown>) {
      calls.push({ name, args });
      const base = {
        contract: 'potok-adaptive-generation-request-status-v2', requestOperationId: requestId,
        retryable: true, reasonCode: null,
      };
      if (name === 'adaptive_nutrition_request_generation_v2') return { data: { ...base, status: 'REQUESTED' } as T, error: null };
      if (name === 'load_generation_request_v2') return { data: {
        ...base, status: 'GENERATING', generationInputCanonicalHex: '7b7d',
        candidateManifestCanonicalHex: '7b7d', attemptOperationId: '93020000-0000-4000-8000-000000000061',
      } as T, error: null };
      if (name === 'record_generated_week_gateway_v2') return { data: { ...base, status: 'GENERATED' } as T, error: null };
      return { data: { ...base, status: 'ACTIVE', retryable: false } as T, error: null };
    },
  };
  const requested = await requestGenerationV2(client, {
    protocolVersion: generationRequestProtocolV2,
    idempotencyKey: '93020000-0000-4000-8000-000000000050',
  });
  const active = await continueGenerationV2({
    requestOperationId: requested.requestOperationId,
    gatewayClient: client,
    generator: { async generate() { return { generatedWeekPlanCanonicalHex: '7b7d' }; } },
    validator: { async validate(value) { return { generatedWeekPlanCanonicalHex: value.generatedWeekPlanCanonicalHex }; } },
  });
  assert.equal(active.status, 'ACTIVE');
  assert.deepEqual(calls.slice(1).map((call) => call.name), [
    'load_generation_request_v2',
    'record_generated_week_gateway_v2',
    'activate_generated_week_gateway_v2',
  ]);
  assert.ok(calls.slice(1).every((call) => call.args.p_request_operation_id === requestId));
  assert.ok(calls.every((call) => !Object.prototype.hasOwnProperty.call(call.args, 'account_id')));
});

test('generated recovery activates without regenerating and terminal conflict stays terminal', async () => {
  const requestId = '93020000-0000-4000-8000-000000000070';
  const calls: string[] = [];
  const makeClient = (status: 'GENERATED' | 'CONFLICT'): GenerationRpcClientV2 => ({
    async rpc<T>(name: string) {
      calls.push(name);
      const base = {
        contract: 'potok-adaptive-generation-request-status-v2', requestOperationId: requestId,
        status, retryable: status === 'GENERATED', reasonCode: status === 'CONFLICT' ? 'STALE' : null,
      };
      if (name === 'load_generation_request_v2') return { data: {
        ...base, generationInputCanonicalHex: null, candidateManifestCanonicalHex: null,
        attemptOperationId: '93020000-0000-4000-8000-000000000071',
      } as T, error: null };
      return { data: { ...base, status: 'ACTIVE', retryable: false } as T, error: null };
    },
  });
  let generated = 0;
  const generator = { async generate() { generated += 1; return { generatedWeekPlanCanonicalHex: '7b7d' }; } };
  const validator = { async validate() { return { generatedWeekPlanCanonicalHex: '7b7d' }; } };
  assert.equal((await continueGenerationV2({ requestOperationId: requestId,
    gatewayClient: makeClient('GENERATED'), generator, validator })).status, 'ACTIVE');
  assert.equal(generated, 0);
  calls.length = 0;
  assert.equal((await continueGenerationV2({ requestOperationId: requestId,
    gatewayClient: makeClient('CONFLICT'), generator, validator })).status, 'CONFLICT');
  assert.deepEqual(calls, ['load_generation_request_v2']);
});
