import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';

const migrationPath = new URL('../../docs/premium/drafts/20260921_adaptive_nutrition_persistence_v1.sql', import.meta.url);
const preflightPath = new URL('../../docs/premium/drafts/20260921_adaptive_nutrition_persistence_v1.preflight.sql', import.meta.url);
const acceptancePath = new URL('../../docs/premium/drafts/20260921_adaptive_nutrition_persistence_v1.acceptance.sql', import.meta.url);
const behavioralAcceptancePath = new URL(
  '../../docs/premium/drafts/20260921_adaptive_nutrition_persistence_v1.behavioral-acceptance.sql', import.meta.url,
);
const behavioralPostcheckPath = new URL(
  '../../docs/premium/drafts/20260921_adaptive_nutrition_persistence_v1.behavioral-postcheck.sql', import.meta.url,
);
const migration = readFileSync(migrationPath, 'utf8');
const preflight = readFileSync(preflightPath, 'utf8');
const acceptance = readFileSync(acceptancePath, 'utf8');
const behavioralAcceptance = readFileSync(behavioralAcceptancePath, 'utf8');
const behavioralPostcheck = readFileSync(behavioralPostcheckPath, 'utf8');

function stripComments(sql: string): string {
  return sql.replace(/--.*$/gm, '').replace(/\/\*[\s\S]*?\*\//g, '');
}

test('migration is additive, transactional and has no runtime privilege grant', () => {
  const executable = stripComments(migration);
  assert.equal((executable.match(/\bBEGIN\s*;/gi) ?? []).length, 1);
  assert.equal((executable.match(/\bCOMMIT\s*;/gi) ?? []).length, 1);
  assert.doesNotMatch(executable, /(?:^|;)\s*(?:DROP\s+(?:TABLE|SCHEMA)|DELETE\s+FROM|TRUNCATE\s+(?:TABLE\s+)?)/im);
  assert.doesNotMatch(executable, /GRANT\s+EXECUTE[\s\S]*\b(?:anon|authenticated|service_role)\b/i);
  assert.doesNotMatch(executable, /\b(?:CREATE|ALTER|DROP)\s+ROLE\b|\bSET\s+ROLE\b/i);
  assert.doesNotMatch(executable, /pg_catalog\.(?:coalesce|extract)\b/i);
});


test('migration contains every bounded persistence concept and keeps FACT writes disabled', () => {
  for (const fragment of [
    'ADD COLUMN goal_revision uuid',
    'ADD COLUMN week_anchor date',
    'CREATE TABLE public.adaptive_nutrition_graph_revisions',
    'CREATE TABLE public.adaptive_nutrition_operations',
    'CREATE TABLE public.adaptive_nutrition_events',
    'ADD COLUMN nutrition_event_id uuid',
    'commit_prevalidated_plan_transition_v1',
    'adaptive_nutrition_lookup_v1',
    'adaptive_nutrition_read_v1',
    'REVOKE TRUNCATE, REFERENCES, TRIGGER, MAINTAIN',
    "p_action_type NOT IN ('PLAN_REPLACED', 'ANNOTATION', 'ANNOTATION_RETRACTION')",
    'FACT writes disabled',
  ]) assert.match(migration, new RegExp(fragment.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')));
  assert.match(migration, /REVOKE ALL ON FUNCTION potok_nutrition\.commit_prevalidated_plan_transition_v1/);
  assert.match(migration, /FROM PUBLIC, anon, authenticated, service_role/);
});

test('every migration function fixes search_path and definer endpoints are closed', () => {
  const functionCount = (migration.match(/CREATE FUNCTION\b/g) ?? []).length;
  const fixedPathCount = (migration.match(/SET search_path = pg_catalog/g) ?? []).length;
  assert.equal(fixedPathCount, functionCount);
  for (const endpoint of [
    'public.adaptive_nutrition_lookup_v1(text)',
    'public.adaptive_nutrition_read_v1(uuid, uuid)',
  ]) assert.match(migration, new RegExp(`REVOKE ALL ON FUNCTION ${endpoint.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}`));
});

test('preflight is SELECT-only and acceptance is rollback-only', () => {
  const preflightExecutable = stripComments(preflight).trim();
  for (const statement of preflightExecutable.split(';').map(value => value.trim()).filter(Boolean)) {
    assert.match(statement, /^SELECT\b/i);
  }
  assert.doesNotMatch(preflightExecutable, /\b(?:INSERT|UPDATE|DELETE|CREATE|ALTER|DROP|GRANT|REVOKE|CALL|DO)\b/i);

  const acceptanceExecutable = stripComments(acceptance);
  assert.equal((acceptanceExecutable.match(/\bBEGIN\s*;/gi) ?? []).length, 1);
  assert.equal((acceptanceExecutable.match(/\bROLLBACK\s*;/gi) ?? []).length, 1);
  assert.doesNotMatch(acceptanceExecutable, /\bCOMMIT\s*;/i);
  assert.match(acceptance, /FACT\/diary cases remain intentionally unavailable/);
});

test('behavioral acceptance is one rollback-only transaction with isolated fixtures', () => {
  const executable = stripComments(behavioralAcceptance).trim();
  assert.equal((executable.match(/\bBEGIN\s*;/gi) ?? []).length, 1);
  assert.equal((executable.match(/\bROLLBACK\s*;/gi) ?? []).length, 1);
  assert.doesNotMatch(executable, /\bCOMMIT\s*;/i);
  assert.match(executable, /ROLLBACK;$/i);
  assert.match(executable, /SET CONSTRAINTS ALL IMMEDIATE;/i);
  assert.doesNotMatch(executable, /(?:^|;)\s*(?:GRANT|REVOKE|CREATE\s+(?!TEMP\s+TABLE)|ALTER|DROP)\b/im);
  assert.doesNotMatch(executable, /(?:INSERT\s+INTO|UPDATE|DELETE\s+FROM)\s+public\.food_diary_entries\b/i);
  assert.doesNotMatch(executable, /\b(?:canonical_food|premium_recipes?)\b/i);
  assert.doesNotMatch(executable, /pg_catalog\.(?:coalesce|extract)\b/i);
  assert.match(behavioralAcceptance, /d6eb4e97-90d0-470f-bc4a-2f3e401e1fde/);
  assert.match(behavioralAcceptance, /8f82ff67-39d1-4bb1-9d55-028af99d5cca/);
  assert.doesNotMatch(behavioralAcceptance, /88c26f6b-ebc8-4bff-864d-9194fbd27f8d/);
});

test('behavioral acceptance covers atomicity, replay, isolation, expiry and history guards', () => {
  for (const fragment of [
    'grant_entitlement_v2',
    'commit_prevalidated_plan_transition_v1',
    'same key with different payload unexpectedly succeeded',
    'stale Goal case did not roll back',
    'foreign lookup/read leaked account A state',
    'injected failure left a partial receipt/graph/event/head change',
    'second successor unexpectedly succeeded',
    'new paid effect succeeded after entitlement expiry',
    'expired-account exact replay did not return original receipt',
    'exact read is not bound to original receipt revisions',
    "EXCEPTION WHEN SQLSTATE '55000'",
  ]) assert.match(behavioralAcceptance, new RegExp(fragment.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')));
  assert.match(behavioralAcceptance, /has_function_privilege\([\s\S]*authenticated[\s\S]*EXECUTE/);
  assert.match(behavioralAcceptance, /has_function_privilege\([\s\S]*service_role[\s\S]*EXECUTE/);
});

test('behavioral postcheck is SELECT-only and covers every rollback fixture surface', () => {
  const executable = stripComments(behavioralPostcheck).trim();
  for (const statement of executable.split(';').map(value => value.trim()).filter(Boolean)) {
    assert.match(statement, /^SELECT\b/i);
  }
  assert.doesNotMatch(executable, /\b(?:INSERT|UPDATE|DELETE|CREATE|ALTER|DROP|GRANT|REVOKE|CALL|DO|TRUNCATE)\b/i);
  for (const fragment of [
    'adaptive_nutrition_operations', 'adaptive_nutrition_graph_revisions',
    'adaptive_nutrition_events', 'user_profiles', 'user_goals',
    'user_premium_plan_selections', 'food_diary_entries', 'access_attestations',
  ]) assert.match(behavioralPostcheck, new RegExp(fragment));
});
