import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import test from 'node:test';
import { decodeAdaptiveNutritionWireEnvelopeV1 } from '../../src/utils/adaptiveNutritionWireV1';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '../..');
const activationPath = resolve(root,
  'docs/premium/drafts/20260921_adaptive_nutrition_runtime_activation_v1.sql');
const appliedFoundationPath = resolve(root,
  'docs/premium/drafts/20260921_adaptive_nutrition_persistence_v1.sql');
const acceptancePath = resolve(root,
  'docs/premium/drafts/20260921_adaptive_nutrition_runtime_activation_v1.behavioral-acceptance.sql');
const postcheckPath = resolve(root,
  'docs/premium/drafts/20260921_adaptive_nutrition_runtime_activation_v1.behavioral-postcheck.sql');
const sql = readFileSync(activationPath, 'utf8');
const acceptance = readFileSync(acceptancePath, 'utf8');
const postcheck = readFileSync(postcheckPath, 'utf8');

test('activation draft is one bounded reviewed transaction and leaves the applied foundation artifact unchanged', () => {
  assert.equal((sql.match(/^BEGIN;$/gm) ?? []).length, 1);
  assert.equal((sql.match(/^COMMIT;$/gm) ?? []).length, 1);
  assert.equal((sql.match(/^ROLLBACK;$/gm) ?? []).length, 0);
  assert.equal(createHash('sha256').update(readFileSync(appliedFoundationPath)).digest('hex'),
    '2c905977dba43d8679a78582738b6224e38ccd71226932961392c80f2b8fa0d4');
});

test('raw duplicate detection occurs on json before the only request jsonb conversion', () => {
  const parseAt = sql.indexOf('v_raw := p_request_text::json;');
  const duplicateAt = sql.indexOf('json_has_duplicate_keys_v1(v_raw)');
  const jsonbAt = sql.indexOf('v_request := v_raw::jsonb;');
  assert.ok(parseAt >= 0 && duplicateAt > parseAt && jsonbAt > duplicateAt);
  assert.match(sql, /json_each\(p_value\)[\s\S]*GROUP BY key HAVING pg_catalog\.count\(\*\) > 1/);
});

test('server canonicalizes and hashes the request without accepting a client digest or account override', () => {
  assert.match(sql, /v_actor uuid := auth\.uid\(\)/);
  assert.match(sql, /v_account_id <> v_actor/);
  assert.match(sql, /v_request_digest := extensions\.digest\(v_canonical_bytes, 'sha256'\)/);
  assert.match(sql, /potok-adaptive-nutrition-canonical-json-v1/);
  assert.doesNotMatch(sql, /p_client_digest|p_account_id uuid/);
});

test('only bounded PLAN/annotation actions reach the internal atomic boundary', () => {
  assert.match(sql, /WHEN 'REPLACE' THEN 'PLAN_REPLACED'/);
  assert.match(sql, /WHEN 'SKIPPED' THEN 'ANNOTATION'/);
  assert.match(sql, /WHEN 'UNDO_ANNOTATION' THEN 'ANNOTATION_RETRACTION'/);
  assert.match(sql, /FACT\/component action is not enabled/);
  assert.match(sql, /commit_prevalidated_plan_transition_v1/);
  assert.match(sql, /component_manifest', '\[\]'::jsonb/);
});

test('replacement graph is sourced only from a private immutable validated offer', () => {
  assert.match(sql, /CREATE TABLE potok_nutrition\.validated_plan_replacement_offers_v1/);
  assert.match(sql, /REVOKE ALL ON potok_nutrition\.validated_plan_replacement_offers_v1[\s\S]*FROM PUBLIC, anon, authenticated, service_role/);
  assert.match(sql, /potok_validated_plan_offers_immutable_v1/);
  assert.match(sql, /v_new_graph := v_offer\.graph_snapshot/);
  assert.doesNotMatch(sql, /GRANT (?:INSERT|UPDATE|DELETE|ALL)[\s\S]*validated_plan_replacement_offers_v1/);
});

test('replay precedes entitlement/CAS boundary and read surfaces receive authenticated-only execute', () => {
  const replayAt = sql.indexOf('SELECT o.* INTO v_existing');
  const boundaryAt = sql.lastIndexOf('commit_prevalidated_plan_transition_v1(');
  assert.ok(replayAt >= 0 && boundaryAt > replayAt);
  for (const signature of [
    'public.adaptive_nutrition_mutate_v1(text)',
    'public.adaptive_nutrition_lookup_v1(text)',
    'public.adaptive_nutrition_read_v1(uuid, uuid)',
  ]) {
    assert.ok(sql.includes(`GRANT EXECUTE ON FUNCTION ${signature} TO authenticated;`));
  }
  assert.doesNotMatch(sql, /GRANT EXECUTE[^;]+(?:PUBLIC|anon|service_role)/);
});

test('helpers and public mutation boundary use fixed search_path and client grants stay minimal', () => {
  const functionCount = (sql.match(/^CREATE FUNCTION /gm) ?? []).length;
  const fixedPathCount = (sql.match(/^SET search_path = pg_catalog$/gm) ?? []).length;
  assert.equal(functionCount, 4);
  assert.equal(fixedPathCount, functionCount);
  assert.equal((sql.match(/^GRANT EXECUTE /gm) ?? []).length, 3);
  assert.doesNotMatch(sql, /pg_catalog\.(?:coalesce|extract|nullif|current_user)\b/i);
  assert.doesNotMatch(sql, /\b(?:INSERT INTO public\.food_diary_entries|UPDATE public\.food_diary_entries|DELETE FROM public\.food_diary_entries)\b/);
});

test('runtime behavioral acceptance is one rollback-only STAGING transaction using authenticated JWT actor semantics', () => {
  assert.equal((acceptance.match(/^BEGIN;$/gm) ?? []).length, 1);
  assert.equal((acceptance.match(/^COMMIT;$/gm) ?? []).length, 0);
  assert.equal((acceptance.match(/^ROLLBACK;$/gm) ?? []).length, 1);
  assert.equal(acceptance.trimEnd().endsWith('ROLLBACK;'), true);
  assert.ok((acceptance.match(/^SET LOCAL ROLE authenticated;$/gm) ?? []).length >= 4);
  assert.doesNotMatch(acceptance, /^SET(?: LOCAL)? ROLE (?:anon|service_role);$/gm);
  assert.match(acceptance, /request\.jwt\.claim\.sub/);
  assert.match(acceptance, /STAGING ozidryfvhkcbtpnulakq only/);
});

test('local TS canonical bytes match the golden digest asserted by server acceptance', () => {
  const request = {
    contract: 'adaptive-nutrition-v1-proposed',
    expected: {
      accountId: 'd6eb4e97-90d0-470f-bc4a-2f3e401e1fde',
      planId: '71000000-0000-4000-8000-000000000001',
      planRevision: '71000000-0000-4000-8000-000000000011',
      goalRevision: '71000000-0000-4000-8000-000000000099',
      historyRevision: '71000000-0000-4000-8000-000000000021',
      diaryRevision: '71000000-0000-4000-8000-000000000022',
      weekAnchor: '2026-09-21',
      timeZone: 'Europe/Moscow',
    },
    idempotencyKey: '72000000-0000-4000-8000-000000000001',
    explicitConfirmation: true,
    action: {
      type: 'SKIPPED',
      slot: {
        slotId: '71000000-0000-4000-8000-000000000031',
        date: '2026-09-21',
        snapshot: {
          snapshotRevision: '71000000-0000-4000-8000-000000000033',
          recipeRevision: null,
          portionRevision: '71000000-0000-4000-8000-000000000034',
        },
      },
    },
  };
  const canonical = decodeAdaptiveNutritionWireEnvelopeV1(JSON.stringify(request)).canonicalBytes;
  const digest = createHash('sha256').update(canonical).digest('hex');
  assert.equal(digest, 'a73879f843886b83d42fadc387533b402adbed6976be84c8e16e607a66eeba38');
  assert.ok(acceptance.includes(digest));
});

test('acceptance covers strict raw validation, account isolation, replay/CAS, annotations, private offers and entitlement loss', () => {
  for (const evidence of [
    'escaped duplicate raw key unexpectedly accepted',
    'unknown client digest field unexpectedly accepted',
    'client account override unexpectedly accepted',
    'foreign lookup/read leaked account B state',
    'same key with changed payload unexpectedly succeeded',
    'stale % revision unexpectedly succeeded',
    'second annotation successor unexpectedly succeeded',
    'invalid replacement offer % unexpectedly accepted',
    'new paid effect unexpectedly succeeded after revoke',
    'new paid effect unexpectedly succeeded after expiry',
    'replay/lookup/exact/current semantics after revoke are incorrect',
  ]) assert.ok(acceptance.includes(evidence), evidence);
  for (const action of ['FACT', 'CONSUMED_AS_PLANNED', 'CONSUMED_MODIFIED', 'EXTRA_FOOD']) {
    assert.ok(acceptance.includes(`'${action}'`), action);
  }
  assert.doesNotMatch(acceptance, /\b(?:INSERT INTO|UPDATE|DELETE FROM) public\.food_diary_entries\b/);
});

test('each stale-vector case starts from the accepted current history revision', () => {
  assert.match(acceptance,
    /v_current_expected := pg_catalog\.jsonb_set\([\s\S]*?v_receipt #>> '\{result,history_revision\}'\)/);
  assert.match(acceptance,
    /FOR v_case IN SELECT \* FROM pg_catalog\.unnest\(ARRAY\['plan','goal','history','diary'\]\)[\s\S]*?pg_catalog\.jsonb_set\(v_request, '\{expected\}', v_current_expected\)/);
});

test('postcheck is SELECT-only and proves every runtime/fixture/marker count after rollback', () => {
  assert.doesNotMatch(postcheck, /^\s*(?:INSERT|UPDATE|DELETE|CREATE|ALTER|DROP|GRANT|REVOKE|CALL|DO|BEGIN|COMMIT|ROLLBACK|TRUNCATE)\b/gmi);
  for (const evidence of [
    'adaptive_nutrition_operations',
    'adaptive_nutrition_graph_revisions',
    'adaptive_nutrition_events',
    'validated_plan_replacement_offers_v1',
    'user_profiles',
    'user_goals',
    'user_premium_plan_selections',
    'user_premium_meal_selections',
    'food_diary_entries',
    'access_attestations',
    'runtime-acceptance/%',
  ]) assert.ok(postcheck.includes(evidence), evidence);
});

test('acceptance and postcheck do not change the applied activation artifact', () => {
  assert.equal(createHash('sha256').update(readFileSync(activationPath)).digest('hex'),
    '89d747579ce890d031b82e2244f4415e2179bede744db363307f5b07d543305e');
  assert.equal((acceptance.match(/\$[a-z0-9_]+\$/gi) ?? []).length % 2, 0);
  assert.equal(acceptance.endsWith('\n'), true);
  assert.equal(postcheck.endsWith('\n'), true);
});
