import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';

const root = new URL('../../', import.meta.url);
const migrationPath = new URL(
  'docs/premium/drafts/20260927_adaptive_nutrition_graph_v2_authorities_activation_v1.sql', root,
);
const preflightPath = new URL(
  'docs/premium/drafts/20260927_adaptive_nutrition_graph_v2_authorities_activation_v1.preflight.sql', root,
);
const acceptancePath = new URL(
  'docs/premium/drafts/20260927_adaptive_nutrition_graph_v2_authorities_activation_v1.behavioral-acceptance.sql', root,
);
const postcheckPath = new URL(
  'docs/premium/drafts/20260927_adaptive_nutrition_graph_v2_authorities_activation_v1.postcheck.sql', root,
);
const graphV1ReaderDiscoveryPath = new URL(
  'docs/premium/drafts/20260929_adaptive_nutrition_graph_v1_reader_signature_discovery.sql', root,
);

const migration = readFileSync(migrationPath, 'utf8');
const preflight = readFileSync(preflightPath, 'utf8');
const acceptance = readFileSync(acceptancePath, 'utf8');
const postcheck = readFileSync(postcheckPath, 'utf8');
const graphV1ReaderDiscovery = readFileSync(graphV1ReaderDiscoveryPath, 'utf8');

function withoutComments(value: string): string {
  return value.replace(/--[^\n]*/g, '').replace(/\/\*[\s\S]*?\*\//g, '');
}

function withoutSqlStrings(value: string): string {
  return withoutComments(value)
    .replace(/'(?:''|[^'])*'/g, "''")
    .replace(/\$([a-zA-Z_][a-zA-Z0-9_]*)?\$[\s\S]*?\$\1\$/g, '$$');
}

function statementCount(value: string, keyword: string): number {
  return (withoutComments(value).match(new RegExp(`^\\s*${keyword}\\s*;`, 'gim')) ?? []).length;
}

function finalStatement(value: string): string {
  const statements = withoutComments(value).split(';').map((item) => item.trim()).filter(Boolean);
  return statements.at(-1) ?? '';
}

function assertBalancedDollarQuotes(value: string): void {
  const tags = value.match(/\$[a-zA-Z_][a-zA-Z0-9_]*\$|\$\$/g) ?? [];
  const counts = new Map<string, number>();
  tags.forEach((tag) => counts.set(tag, (counts.get(tag) ?? 0) + 1));
  for (const [tag, count] of counts) assert.equal(count % 2, 0, `unbalanced ${tag}`);
}

test('migration is one transaction and acceptance is rollback-only', () => {
  assert.equal(statementCount(migration, 'BEGIN'), 1);
  assert.equal(statementCount(migration, 'COMMIT'), 1);
  assert.equal(statementCount(migration, 'ROLLBACK'), 0);
  assert.match(finalStatement(migration), /^COMMIT$/i);
  assert.equal(statementCount(acceptance, 'BEGIN'), 1);
  assert.equal(statementCount(acceptance, 'COMMIT'), 0);
  assert.equal(statementCount(acceptance, 'ROLLBACK'), 1);
  assert.match(finalStatement(acceptance), /^ROLLBACK$/i);
});

test('all SQL artifacts have balanced dollar quotes', () => {
  [migration, preflight, acceptance, postcheck, graphV1ReaderDiscovery]
    .forEach(assertBalancedDollarQuotes);
});

test('every security definer function uses fixed pg_catalog search_path', () => {
  const headers = migration.match(/CREATE(?: OR REPLACE)? FUNCTION[\s\S]*?AS \$[a-zA-Z_][a-zA-Z0-9_]*\$/g) ?? [];
  assert.ok(headers.length >= 15);
  for (const header of headers) {
    if (/SECURITY DEFINER/i.test(header)) {
      assert.match(header, /SET search_path = pg_catalog/i);
    }
  }
});

test('protected writers have no client execute grants or service-role shortcut', () => {
  const protectedWriters = [
    'initialize_nutrition_authorities_v1', 'create_preference_successor_v1',
    'create_safety_successor_v1', 'publish_candidate_manifest_v2',
    'record_generated_week_v2', 'activate_generated_week_v2',
  ];
  for (const name of protectedWriters) {
    assert.doesNotMatch(migration,
      new RegExp(`GRANT\\s+EXECUTE[\\s\\S]{0,300}${name}[\\s\\S]{0,180}(authenticated|anon|service_role)`, 'i'));
  }
  assert.doesNotMatch(migration, /GRANT\s+EXECUTE[\s\S]{0,300}service_role/i);
  assert.match(migration, /PROTECTED_EXECUTION_CHANNEL_NOT_YET_BOUND/);
});

test('only authenticated exact reads are granted', () => {
  const grantBlock = migration.match(/GRANT EXECUTE ON FUNCTION public\.adaptive_nutrition_read_graph_v2[\s\S]*?TO authenticated;/i)?.[0] ?? '';
  for (const read of [
    'adaptive_nutrition_read_graph_v2', 'adaptive_nutrition_list_graph_history_v2',
    'adaptive_nutrition_lookup_operation_v2', 'adaptive_nutrition_current_preference_v1',
    'adaptive_nutrition_current_safety_v1',
  ]) {
    assert.match(grantBlock, new RegExp(`public\\.${read}`, 'i'));
  }
  assert.doesNotMatch(migration, /GRANT EXECUTE ON FUNCTION potok_nutrition\.current_candidate_manifest_v2/i);
});

test('postcheck encodes exact per-function security modes without weakening privileges', () => {
  const metadata = postcheck.match(
    /required_functions\([\s\S]*?\), function_checks AS \(/i,
  )?.[0] ?? '';
  assert.ok(metadata.length > 0, 'required function metadata missing');
  assert.match(metadata,
    /'shared account gate','potok_nutrition\.acquire_shared_account_gate_v1\(uuid\)',\s*'SECURITY_INVOKER',false,'potok-shared-account-gate-v1:'/i);
  for (const name of [
    'initialize authorities', 'preference successor', 'safety successor',
    'manifest publication', 'generation receipt', 'Graph v2 activation',
    'Graph v2 exact read', 'Graph v2 history', 'Graph v2 operation lookup',
    'current preference', 'current safety', 'protected manifest read',
  ]) {
    assert.match(metadata,
      new RegExp(`'${name}'[\\s\\S]*?'SECURITY_DEFINER'`, 'i'));
  }
  assert.equal((metadata.match(/'SECURITY_INVOKER'/g) ?? []).length, 1);
  assert.equal((metadata.match(/'SECURITY_DEFINER'/g) ?? []).length, 12);
  assert.match(postcheck,
    /p\.prosecdef\s*=\s*\(f\.expected_security_mode='SECURITY_DEFINER'\)/i);
  assert.match(postcheck, /pg_catalog\.pg_get_userbyid\(p\.proowner\)='postgres'/i);
  assert.match(postcheck, /search_path=pg_catalog/i);
  assert.match(postcheck, /public_execute/i);
  assert.match(postcheck, /anon_execute/i);
  assert.match(postcheck, /authenticated_execute/i);
  assert.match(postcheck, /service_role_execute/i);
  assert.match(migration,
    /CREATE FUNCTION potok_nutrition\.acquire_shared_account_gate_v1[\s\S]*?SECURITY INVOKER[\s\S]*?SET search_path = pg_catalog/i);
});

test('preflight, postcheck, and Graph v1 discovery are one SELECT-only statement each', () => {
  for (const sql of [preflight, postcheck, graphV1ReaderDiscovery]) {
    const executable = withoutSqlStrings(sql).trim();
    assert.match(executable, /^WITH\b/i);
    assert.equal((executable.match(/;/g) ?? []).length, 1);
    assert.doesNotMatch(executable,
      /\b(?:INSERT|UPDATE|DELETE|MERGE|CREATE|ALTER|DROP|TRUNCATE|GRANT|REVOKE|CALL|DO|BEGIN|COMMIT|ROLLBACK)\b/i);
  }
});

test('shared account gate is first in all mutable writer bodies', () => {
  assert.match(migration, /potok-shared-account-gate-v1:/);
  for (const signature of [
    'grant_entitlement_v2', 'revoke_entitlement_v2',
    'adaptive_nutrition_provision_current_week_v1', 'commit_prevalidated_plan_transition_v1',
    'record_generated_week_v2', 'activate_generated_week_v2',
  ]) {
    const start = migration.indexOf(`FUNCTION ${signature}`) >= 0
      ? migration.indexOf(`FUNCTION ${signature}`)
      : migration.indexOf(`FUNCTION potok_control.${signature}`) >= 0
        ? migration.indexOf(`FUNCTION potok_control.${signature}`)
        : migration.indexOf(`FUNCTION public.${signature}`) >= 0
          ? migration.indexOf(`FUNCTION public.${signature}`)
          : migration.indexOf(`FUNCTION potok_nutrition.${signature}`);
    assert.ok(start >= 0, `${signature} missing`);
    const body = migration.slice(start, migration.indexOf('$function$;', start) + 11);
    assert.match(body, /acquire_shared_account_gate_v1/);
    const gateAt = body.indexOf('acquire_shared_account_gate_v1');
    const firstWrite = body.search(/\b(?:INSERT INTO|UPDATE\s+[a-zA-Z_]|DELETE FROM)\b/i);
    if (firstWrite >= 0) assert.ok(gateAt < firstWrite, `${signature} writes before shared gate`);
    const capabilityLock = body.indexOf('potok-entitlement-v2:');
    if (capabilityLock >= 0) assert.ok(gateAt < capabilityLock, `${signature} capability lock precedes account gate`);
  }
});

test('Graph v1 read/mutate functions are not replaced', () => {
  assert.doesNotMatch(migration, /CREATE OR REPLACE FUNCTION public\.adaptive_nutrition_read_v1/i);
  assert.doesNotMatch(migration, /CREATE OR REPLACE FUNCTION public\.adaptive_nutrition_mutate_v1/i);
  assert.match(postcheck, /Graph v1 read still present/);
});

test('Graph v1 reader discovery is signature-safe and postcheck fails closed on ambiguity', () => {
  for (const sql of [graphV1ReaderDiscovery, postcheck]) {
    assert.match(sql, /pg_catalog\.pg_proc/);
    assert.match(sql, /pg_catalog\.pg_namespace/);
    assert.match(sql, /PRIMARY_GRAPH_V1_READER/);
    assert.match(sql, /RELATED_READER/);
    assert.match(sql, /AMBIGUOUS/);
    assert.match(sql, /GRAPH_V1_READER_SIGNATURE_AMBIGUOUS/);
    assert.match(sql, /adaptive_nutrition_graph_revisions/);
    assert.match(sql, /user_premium_plan_selections/);
    assert.doesNotMatch(sql,
      /['"]public\.adaptive_nutrition_read_v1\([^)]*\)['"]\s*::\s*(?:pg_catalog\.)?regprocedure/i);
  }
  assert.match(graphV1ReaderDiscovery, /function_definition_sha256/);
  assert.match(graphV1ReaderDiscovery, /identity_arguments/);
  assert.match(graphV1ReaderDiscovery, /full_arguments/);
  assert.match(graphV1ReaderDiscovery, /SECURITY DEFINER/);
  assert.match(postcheck, /primary_candidate_count\s*=\s*1/);
  assert.doesNotMatch(postcheck,
    /adaptive_nutrition_read_v1\(uuid,uuid,text\)/i);
});

test('Graph v1 discovery and repaired postcheck do not invoke application functions', () => {
  for (const sql of [graphV1ReaderDiscovery, postcheck]) {
    const executable = withoutSqlStrings(sql);
    assert.doesNotMatch(executable,
      /\b(?:public|potok_nutrition)\.adaptive_nutrition_[a-zA-Z0-9_]*\s*\(/i);
  }
});

test('acceptance covers all 25 reviewed scenarios without FACT writers', () => {
  for (const marker of [
    'shared account gate', 'fixture accounts unexpectedly collide', 'explicit empty authority',
    'preference successor', 'safety successor', 'duplicate manifest', 'unpublished manifest',
    'published manifest membership', 'stale manifest CAS', 'generation exact replay',
    'activation/replay contract', 'same generation key', 'stale Goal', 'stale preference',
    'stale safety', 'revoked Premium', 'Graph digest mismatch', 'missing manifest component',
    'first valid activation', 'predecessor relation', 'Graph v1 compatibility',
    'FACT/event/diary', 'failed activation left', 'zero residue',
  ]) assert.match(acceptance, new RegExp(marker, 'i'));
  assert.doesNotMatch(acceptance,
    /INSERT\s+INTO\s+public\.(?:adaptive_nutrition_events|food_diary_entries|user_premium_meal_selections)/i);
  assert.doesNotMatch(acceptance, /\b(?:FACT|CONSUMED_AS_PLANNED|CONSUMED_MODIFIED|EXTRA_FOOD|REPLACE)\b\s*\(/i);
});

test('acceptance uses only synthetic recipe evidence and exact residue namespace', () => {
  assert.match(acceptance, /synthetic-graph-v2-only/);
  assert.match(acceptance, /92720000-0000-4000-8000-/);
  assert.match(postcheck, /92720000-0000-4000-8000-/);
  assert.doesNotMatch(migration, /92720000-0000-4000-8000-/);
});

test('canonical digest boundaries match the approved TypeScript contracts', () => {
  assert.match(migration, /potok-adaptive-nutrition-graph-v2-canonical-json-v1/);
  assert.match(migration,
    /jsonb_build_object\(\s*'encoding','potok-adaptive-nutrition-graph-v2-canonical-json-v1',\s*'contract','adaptive_nutrition_graph_v2','graph',v_graph/);
  assert.match(migration,
    /jsonb_build_object\(\s*'contract','potok-adaptive-trusted-generation-input-v1','input',v_input/);
  assert.match(migration, /v_plan - 'deterministicContentDigest'/);
});
