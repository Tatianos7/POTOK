import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';
import test from 'node:test';

const root = new URL('../../', import.meta.url);
const sql = readFileSync(new URL(
  'docs/premium/drafts/20260922_adaptive_nutrition_read_only_entry_v1.sql', root,
), 'utf8');
const preflight = readFileSync(new URL(
  'docs/premium/drafts/20260922_adaptive_nutrition_read_only_entry_v1.preflight.sql', root,
), 'utf8');
const acceptance = readFileSync(new URL(
  'docs/premium/drafts/20260922_adaptive_nutrition_read_only_entry_v1.behavioral-acceptance.sql', root,
), 'utf8');
const postcheck = readFileSync(new URL(
  'docs/premium/drafts/20260922_adaptive_nutrition_read_only_entry_v1.postcheck.sql', root,
), 'utf8');

function withoutComments(value: string): string {
  return value.replace(/--.*$/gm, '').replace(/\/\*[\s\S]*?\*\//g, '');
}

function plpgsqlDoBlocks(value: string): Array<{ tag: string; declarations: string; body: string }> {
  return [...withoutComments(value).matchAll(
    /DO \$([a-z][a-z0-9_]*)\$\s*DECLARE([\s\S]*?)\bBEGIN\b([\s\S]*?)\bEND\s*\$\1\$;/gi,
  )].map((match) => ({ tag: match[1], declarations: match[2], body: match[3] }));
}

test('reviewed discovery apply artifact retains its exact approved hash', () => {
  assert.equal(createHash('sha256').update(sql).digest('hex'),
    '9ae90f023875bde8dd86fc99cff1c63c8b9860a48fb1d07b8ef75f3b411ed580');
});

test('discovery draft is one additive transaction with no data mutation', () => {
  const executable = withoutComments(sql);
  assert.equal((executable.match(/^BEGIN;$/gm) ?? []).length, 1);
  assert.equal((executable.match(/^COMMIT;$/gm) ?? []).length, 1);
  assert.match(executable, /CREATE FUNCTION public\.adaptive_nutrition_discover_current_v1\(p_timezone text\)/);
  assert.doesNotMatch(executable, /\b(?:INSERT|UPDATE|DELETE|TRUNCATE|CALL)\b/i);
  assert.doesNotMatch(executable, /CREATE\s+(?:TABLE|SCHEMA|ROLE)|ALTER\s+(?:TABLE|ROLE)|DROP\b/i);
});

test('server derives account and current Monday week while requiring verified Premium', () => {
  const executable = withoutComments(sql);
  assert.match(executable, /v_actor uuid := auth\.uid\(\)/);
  assert.doesNotMatch(executable, /p_(?:account|user)(?:_id)?\b/i);
  assert.match(executable, /pg_catalog\.pg_timezone_names/);
  assert.match(executable, /date_trunc\('week', v_now AT TIME ZONE p_timezone\)::date/);
  assert.match(executable, /EXTRACT\(isodow FROM v_week_anchor\) <> 1/i);
  assert.match(executable, /potok_control\.is_effective_entitlement_v2\(v_actor, 'premium', v_now\)/);
});

test('selection discovery accepts exactly one active v1 own row and excludes retained smoke', () => {
  const executable = withoutComments(sql);
  for (const evidence of [
    's.user_id = v_actor', 's.contract_version = 1', "s.status = 'active'",
    's.week_anchor = v_week_anchor', 's.timezone = p_timezone',
    "s.origin_lineage ->> 'source' IS DISTINCT FROM 'potok-retained-staging-smoke-v1'",
    "v_match_count = 0", "'kind', 'no_active_plan'",
    'v_match_count > 1', "'kind', 'ambiguous'",
  ]) assert.ok(executable.includes(evidence), evidence);
  assert.doesNotMatch(executable, /status\s*(?:<>|!=)\s*'archived'/i);
  assert.doesNotMatch(executable, /LIMIT\s+1/i);
});

test('only authenticated receives discovery execute and runtime body remains read-only', () => {
  const executable = withoutComments(sql);
  assert.match(executable, /SECURITY DEFINER[\s\S]*SET search_path = pg_catalog/);
  assert.match(executable,
    /REVOKE ALL ON FUNCTION public\.adaptive_nutrition_discover_current_v1\(text\)[\s\S]*FROM PUBLIC, anon, authenticated, service_role/);
  assert.match(executable,
    /GRANT EXECUTE ON FUNCTION public\.adaptive_nutrition_discover_current_v1\(text\)[\s\S]*TO authenticated/);
  assert.doesNotMatch(executable, /GRANT EXECUTE[\s\S]*TO (?:anon|service_role)/);
  const body = executable.match(/AS \$function\$([\s\S]*?)\$function\$;/)?.[1] ?? '';
  assert.ok(body);
  assert.doesNotMatch(body, /\b(?:INSERT|UPDATE|DELETE|TRUNCATE|CALL|PERFORM)\b/i);
});

test('preflight and postcheck are SELECT-only and pin the STAGING boundary', () => {
  for (const artifact of [preflight, postcheck]) {
    const executable = withoutComments(artifact);
    assert.doesNotMatch(executable,
      /\b(?:BEGIN|COMMIT|ROLLBACK|DO|INSERT|UPDATE|DELETE|TRUNCATE|CREATE|ALTER|DROP|GRANT|REVOKE|CALL|PERFORM)\b/i);
    assert.match(executable, /ozidryfvhkcbtpnulakq/);
    assert.match(executable, /owner_must_verify_dashboard_project_ref/);
  }
  assert.match(preflight, /discovery_absent_before_apply/);
  assert.match(preflight, /user_premium_plan_selections_week_candidate_v1_idx/);
  assert.match(preflight, /ready_for_read_only_discovery_apply/);
  assert.match(postcheck, /read_entry_acceptance_rollback_clean/);
});

test('behavioral acceptance is one rollback-only transaction using only verified fixture accounts', () => {
  const executable = withoutComments(acceptance).trim();
  assert.equal((executable.match(/^BEGIN;$/gm) ?? []).length, 1);
  assert.equal((executable.match(/^ROLLBACK;$/gm) ?? []).length, 1);
  assert.equal((executable.match(/^COMMIT;$/gm) ?? []).length, 0);
  assert.ok(executable.endsWith('ROLLBACK;'));
  assert.match(executable, /d6eb4e97-90d0-470f-bc4a-2f3e401e1fde/);
  assert.match(executable, /8f82ff67-39d1-4bb1-9d55-028af99d5cca/);
  assert.doesNotMatch(executable, /88c26f6b-ebc8-4bff-864d-9194fbd27f8d/);
  assert.doesNotMatch(executable,
    /potok_control\.(?:grant|revoke)_entitlement_v2\s*\(/i);
});

test('authenticated segments only invoke discovery and inspect its returned value', () => {
  const executable = withoutComments(acceptance);
  assert.doesNotMatch(executable, /^GRANT\b/gmi);
  const authenticatedSegments = executable.split('SET LOCAL ROLE authenticated;').slice(1)
    .map((segment) => segment.split('RESET ROLE;', 1)[0]);
  assert.equal(authenticatedSegments.length, 9);
  for (const segment of authenticatedSegments) {
    assert.match(segment, /public\.adaptive_nutrition_discover_current_v1\(/);
    assert.doesNotMatch(segment, /\bFROM\s+(?:public|potok_control|potok_nutrition|pg_temp)\./i);
    assert.doesNotMatch(segment, /potok_read_entry_acceptance_config|potok_read_entry_effect_baseline/i);
    assert.doesNotMatch(segment, /\b(?:INSERT|UPDATE|DELETE|TRUNCATE|GRANT|REVOKE|CALL|PERFORM)\b/i);
  }
  assert.match(executable,
    /RESET ROLE;[\s\S]*DO \$premium_zero_selection_owner_check\$/);
  assert.match(executable,
    /RESET ROLE;[\s\S]*DO \$one_ready_owner_state_check\$/);
});

test('each acceptance DO block keeps local identifiers within its own scope', () => {
  const blocks = plpgsqlDoBlocks(acceptance);
  assert.ok(blocks.length >= 10);
  for (const block of blocks) {
    const declared = new Set([...block.declarations.matchAll(/^\s*(v(?:_[a-z0-9_]+)?)\b/gmi)]
      .map((match) => match[1].toLowerCase()));
    const scopeText = `${block.declarations}\n${block.body}`.replace(/'(?:''|[^'])*'/g, "''");
    const referenced = new Set([...scopeText.matchAll(/\bv(?:_[a-z0-9_]+)?\b/gi)]
      .map((match) => match[0].toLowerCase()));
    const undeclared = [...referenced].filter((identifier) => !declared.has(identifier));
    assert.deepEqual(undeclared, [], `${block.tag} references undeclared locals`);
  }
});

test('behavioral calls cover auth, Premium, calendar, ownership and filter outcomes', () => {
  const executable = withoutComments(acceptance);
  for (const evidence of [
    '$unauthenticated_denied$', '$free_denied$', '$invalid_timezone_denied$',
    '$premium_zero_selection$',
    '$zero_archived_foreign_ignored$', '$retained_smoke_ignored$',
    '$wrong_week_ignored$', '$wrong_timezone_ignored$', '$one_ready_owned$',
    '$two_eligible_schema_invariant$', "'kind' <> 'ready'",
    "'{\"kind\":\"no_active_plan\"}'::jsonb", 'unique_violation',
  ]) assert.ok(executable.includes(evidence), evidence);
  assert.ok((executable.match(/adaptive_nutrition_discover_current_v1\(/g) ?? []).length >= 8);
  assert.match(executable, /s\.user_id = v\.account_premium/);
  assert.match(executable, /v_result[\s\S]*v\.selection_foreign/);
});

test('acceptance never invokes mutation surfaces or writes prohibited product data', () => {
  const executable = withoutComments(acceptance);
  assert.doesNotMatch(executable,
    /(?::=|PERFORM|SELECT)\s+public\.adaptive_nutrition_(?:mutate|lookup|read)_v1\s*\(/i);
  assert.doesNotMatch(executable,
    /(?:INSERT\s+INTO|UPDATE|DELETE\s+FROM|TRUNCATE)\s+(?:public\.adaptive_nutrition_events|public\.food_diary_entries|public\.user_premium_meal_selections|potok_nutrition\.validated_plan_replacement_offers_v1)/i);
  assert.doesNotMatch(executable, /\b(?:FACT|SKIPPED|UNDO_ANNOTATION|REPLACE)\b/);
  assert.match(executable, /potok_read_entry_effect_baseline/);
  assert.match(executable, /discovery calls changed fixture\/runtime\/diary\/offer counts/);
});

test('two-result defense is preserved without dropping the deployed uniqueness invariant', () => {
  const executable = withoutComments(acceptance);
  assert.match(executable, /user_premium_plan_selections_week_candidate_v1_idx/);
  assert.match(executable, /v_definition NOT LIKE '%v_match_count > 1%'/);
  assert.match(executable, /v_definition NOT LIKE '%''kind'', ''ambiguous''%'/);
  assert.match(executable, /EXCEPTION WHEN unique_violation/);
  assert.doesNotMatch(executable, /DROP\s+INDEX|ALTER\s+(?:TABLE|INDEX)|UPDATE\s+pg_catalog\./i);
});

test('client read gate and read-only entry remain isolated from mutation and legacy fallback', () => {
  const persistence = readFileSync(new URL(
    'src/services/adaptiveNutritionPersistenceService.ts', root,
  ), 'utf8');
  const readOnly = readFileSync(new URL(
    'src/services/adaptiveNutritionReadOnlyService.ts', root,
  ), 'utf8');
  const entry = readFileSync(new URL(
    'src/services/adaptiveNutritionReadOnlyEntry.ts', root,
  ), 'utf8');
  const today = readFileSync(new URL('src/pages/Today.tsx', root), 'utf8');
  assert.match(persistence,
    /runtimeGate:[\s\S]*= false,[\s\S]*readGate:[\s\S]*= false/);
  assert.match(persistence,
    /new AdaptiveNutritionPersistenceService\([\s\S]*isAdaptiveNutritionRuntimeEnabled,[\s\S]*isAdaptiveNutritionReadEnabled/);
  assert.doesNotMatch(readOnly,
    /adaptive_nutrition_mutate_v1|\.mutate\(|localStorage|VITE_ADAPTIVE_NUTRITION_SMOKE/);
  assert.doesNotMatch(entry, /\.mutate\(|\.skip\(|\.undoAnnotation\(|\.replace\(/);
  assert.match(today,
    /if \(props\.verifiedPremium === true\) \{[\s\S]*shouldUseAdaptiveNutritionReadOnlyEntry\(true\)[\s\S]*<AdaptiveNutritionReadOnlyEntry/);
  assert.doesNotMatch(today, /return <Today \{\.\.\.props\} \/>|<LegacyFixed14DayToday/);
  assert.match(today, /verifiedPremium\?: boolean/);
});
