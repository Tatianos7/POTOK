import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';
import test from 'node:test';

const root = new URL('../../', import.meta.url);
const read = (path: string) => readFileSync(new URL(path, root), 'utf8');
const preflight = read('docs/premium/drafts/20260922_adaptive_nutrition_retained_staging_smoke_v1.preflight.sql');
const setup = read('docs/premium/drafts/20260922_adaptive_nutrition_retained_staging_smoke_v1.setup.sql');
const postSmoke = read('docs/premium/drafts/20260922_adaptive_nutrition_retained_staging_smoke_v1.post-smoke.sql');
const retirement = read('docs/premium/drafts/20260922_adaptive_nutrition_retained_staging_smoke_v1.retirement.sql');
const postRetirement = read('docs/premium/drafts/20260922_adaptive_nutrition_retained_staging_smoke_v1.post-retirement.sql');
const envExample = read('docs/premium/drafts/adaptive-nutrition-retained-staging-smoke-v1.env.example');
const instructions = read('docs/premium/adaptive-nutrition-retained-staging-smoke-v1.md');
const smokeConfig = read('src/services/adaptiveNutritionSmokePreview.ts');
const today = read('src/pages/Today.tsx');

function withoutComments(sql: string): string {
  return sql.replace(/--.*$/gm, '').replace(/\/\*[\s\S]*?\*\//g, '');
}

function assertSelectOnly(sql: string): void {
  const executable = withoutComments(sql).trim();
  for (const statement of executable.split(';').map((value) => value.trim()).filter(Boolean)) {
    assert.match(statement, /^(?:WITH\b[\s\S]*?\bSELECT\b|SELECT\b)/i);
  }
  assert.doesNotMatch(executable.replace(/'(?:''|[^'])*'/g, "''"),
    /\b(?:INSERT|UPDATE|DELETE|CREATE|ALTER|DROP|GRANT|REVOKE|CALL|DO|BEGIN|COMMIT|ROLLBACK|TRUNCATE)\b/i);
}

function assertLocalDoScopes(sql: string, expectedTags: string[]): void {
  const blocks = [...withoutComments(sql).matchAll(
    /DO \$([a-z][a-z0-9_]*)\$\s*DECLARE([\s\S]*?)\bBEGIN\b([\s\S]*?)\bEND\s*\$\1\$;/gi,
  )].map((match) => ({ tag: match[1], declarations: match[2], body: match[3] }));
  assert.deepEqual(blocks.map(({ tag }) => tag), expectedTags);
  for (const block of blocks) {
    const declared = new Set([...block.declarations.matchAll(/^\s*(v_[a-z0-9_]*)\b/gmi)]
      .map((match) => match[1].toLowerCase()));
    const referenced = new Set([...`${block.declarations}\n${block.body}`.matchAll(/\bv_[a-z0-9_]+\b/gi)]
      .map((match) => match[0].toLowerCase()));
    assert.deepEqual([...referenced].filter((identifier) => !declared.has(identifier)), [],
      `${block.tag} references undeclared locals`);
  }
}

test('preflight and both postchecks are SELECT-only with one clear verdict each', () => {
  for (const sql of [preflight, postSmoke, postRetirement]) assertSelectOnly(sql);
  assert.equal((preflight.match(/ready_for_retained_fixture_setup/g) ?? []).length, 1);
  assert.equal((postSmoke.match(/retained_smoke_acceptance_pass/g) ?? []).length, 1);
  assert.equal((postRetirement.match(/retained_fixture_retirement_pass/g) ?? []).length, 1);
});

test('setup is one fail-closed transaction and every DO local is block-scoped', () => {
  const executable = withoutComments(setup);
  assert.equal((executable.match(/^BEGIN;$/gm) ?? []).length, 1);
  assert.equal((executable.match(/^COMMIT;$/gm) ?? []).length, 1);
  assert.equal((executable.match(/^ROLLBACK;$/gm) ?? []).length, 0);
  assert.ok(executable.indexOf('SET CONSTRAINTS ALL IMMEDIATE;') > executable.lastIndexOf('$setup$;'));
  assert.ok(executable.indexOf('COMMIT;') > executable.lastIndexOf('$verify_setup$;'));
  assert.doesNotMatch(executable, /\bEXCEPTION\s+WHEN\b/i);
  assertLocalDoScopes(setup, ['setup', 'verify_setup']);
});

test('setup has a distinct retained namespace and writes only the bounded fixture graph', () => {
  const executable = withoutComments(setup);
  assert.doesNotMatch(executable, /9a220000-0000-4000-8000-/);
  assert.match(executable, /7e710000-0000-4000-8000-000000000001/);
  assert.match(executable, /'source', 'potok-retained-staging-smoke-v1'/);
  assert.match(executable, /'discoveryPolicy', 'explicit-smoke-selection-only'/);
  assert.match(executable, /'potok-retained-staging-smoke-v1\/bootstrap'/);
  assert.match(executable, /'potok-retained-staging-smoke-v1\/grant'/);
  assert.equal((executable.match(/\([0-6], '7e710000-/g) ?? []).length, 7);
  for (const target of [
    'public.user_goals', 'public.user_premium_plan_selections',
    'public.adaptive_nutrition_operations', 'public.adaptive_nutrition_graph_revisions',
  ]) assert.match(executable, new RegExp(`INSERT INTO ${target.replace('.', '\\.')}`));
  assert.doesNotMatch(executable,
    /(?:INSERT\s+INTO|UPDATE|DELETE\s+FROM)\s+(?:public\.)?(?:foods?|recipes?|premium_recipes?|user_premium_meal_selections|food_diary_entries|adaptive_nutrition_events)\b/i);
  assert.doesNotMatch(executable, /\b(?:FACT|CONSUMED_AS_PLANNED|CONSUMED_MODIFIED|EXTRA_FOOD|PLAN_REPLACED)\b/);
});

test('retirement is idempotent, appends only the exact revoke and archives only the exact selection', () => {
  const executable = withoutComments(retirement);
  assert.equal((executable.match(/^BEGIN;$/gm) ?? []).length, 1);
  assert.equal((executable.match(/^COMMIT;$/gm) ?? []).length, 1);
  assert.doesNotMatch(executable, /\b(?:DELETE|TRUNCATE)\b/i);
  assert.match(executable, /v_head\.effect = 'REVOKE'[\s\S]*v_head\.evidence_ref = 'potok-retained-staging-smoke-v1\/revoke'/);
  assert.match(executable, /potok_control\.revoke_entitlement_v2\(/);
  assert.match(executable, /UPDATE public\.user_premium_plan_selections s[\s\S]*SET status = 'archived'/);
  assert.match(executable, /WHERE s\.user_id = v_account AND s\.id = v_selection[\s\S]*origin_lineage ->> 'source' = 'potok-retained-staging-smoke-v1'/);
  assert.doesNotMatch(executable, /UPDATE\s+(?:public\.)?(?:adaptive_nutrition_|food_diary_entries|user_goals)/i);
  assertLocalDoScopes(retirement, ['retire', 'verify_retirement']);
});

test('postchecks enforce annotation-only history, digest parity, retirement and account isolation', () => {
  for (const evidence of [
    'bootstrap_receipts = 1', 'accepted_skipped_receipts = 1', 'accepted_undo_receipts = 1',
    'annotations = 1', 'annotation_retractions = 1', 'live_annotations = 0',
    'fact_or_plan_replaced_events = 0', 'diary_rows = 0', 'replacement_offers = 0',
    'foreign_fixture_rows = 0', 'digest_mismatches = 0',
  ]) assert.ok(postSmoke.includes(evidence), evidence);
  for (const evidence of [
    "latest_premium_effect = 'REVOKE'", 'premium_effective_false', 'archived_selections = 1',
    'retained_receipts = 3', 'retained_graph_revisions = 1', 'retained_events = 2',
    'historical_read_grants_present', 'current_denied_exact_history_contract_present',
    'foreign_fixture_rows = 0',
  ]) assert.ok(postRetirement.includes(evidence), evidence);
});

test('client smoke input is exact-STAGING/account/selection build config only', () => {
  for (const value of [
    "ADAPTIVE_NUTRITION_SMOKE_PROJECT_REF = 'ozidryfvhkcbtpnulakq'",
    "ADAPTIVE_NUTRITION_SMOKE_ACCOUNT_ID = '88c26f6b-ebc8-4bff-864d-9194fbd27f8d'",
    "ADAPTIVE_NUTRITION_SMOKE_SELECTION_ID = '7e710000-0000-4000-8000-000000000001'",
    'VITE_ADAPTIVE_NUTRITION_STAGING_SMOKE_V1', 'VITE_ADAPTIVE_NUTRITION_RUNTIME_V1',
  ]) assert.ok(smokeConfig.includes(value), value);
  assert.doesNotMatch(smokeConfig, /localStorage|sessionStorage|URLSearchParams|location\.(?:search|hash)/);
  assert.match(smokeConfig, /currentUserId !== configuredAccount/);
  assert.match(envExample, /VITE_SUPABASE_URL=https:\/\/ozidryfvhkcbtpnulakq\.supabase\.co/);
  assert.match(envExample, /VITE_ADAPTIVE_NUTRITION_STAGING_SMOKE_V1=true/);
  assert.doesNotMatch(envExample, /eyJ[A-Za-z0-9_-]+\.|sb_(?:secret|publishable)_/);
  assert.ok(today.indexOf('getAdaptiveNutritionSmokePreview')
    < today.indexOf("new URLSearchParams(location.search).get('weeklyPreview')"));
});

test('applied entitlement/persistence/runtime artifacts remain byte-identical', () => {
  const expected: Array<[string, string]> = [
    ['docs/premium/drafts/20260921_trusted_entitlement_v2.sql', 'ffef9a7de1b1540a4511751614c170a1269bc16dc97c5e663c0475dda0065029'],
    ['docs/premium/drafts/20260921_trusted_entitlement_v2_1_repair.sql', '949a155479c002c37b54a733ac7e16c21b1cb3c10ebc5cdb06afcf460f69f47c'],
    ['docs/premium/drafts/20260921_trusted_entitlement_v2_2_repair.sql', '38781cda4f22e7b6c341fb32e9829b9e04e1eacd1f893bfac9e0a066ec951a77'],
    ['docs/premium/drafts/20260921_adaptive_nutrition_persistence_v1.sql', '2c905977dba43d8679a78582738b6224e38ccd71226932961392c80f2b8fa0d4'],
    ['docs/premium/drafts/20260921_adaptive_nutrition_runtime_activation_v1.sql', '89d747579ce890d031b82e2244f4415e2179bede744db363307f5b07d543305e'],
  ];
  for (const [path, digest] of expected) {
    assert.equal(createHash('sha256').update(read(path)).digest('hex'), digest, path);
  }
});

test('review workflow pins every retained SQL hash and excludes fixture lineage from future discovery', () => {
  const expected: Array<[string, string]> = [
    ['docs/premium/drafts/20260922_adaptive_nutrition_retained_staging_smoke_v1.preflight.sql', 'a776fae4843c46898652e4fb548422eba4582c49c0637e63b362fc6a93162a8f'],
    ['docs/premium/drafts/20260922_adaptive_nutrition_retained_staging_smoke_v1.setup.sql', 'b935cf9ec1aa40a0b0e34bc05bf3d899db98251b9683c4f756ff442bf56314b0'],
    ['docs/premium/drafts/20260922_adaptive_nutrition_retained_staging_smoke_v1.post-smoke.sql', '8a64d64514fc2b54d913c6701311f0e93f96e6b1e3f381c26d671d7737d1f1ff'],
    ['docs/premium/drafts/20260922_adaptive_nutrition_retained_staging_smoke_v1.retirement.sql', '750a8ef69582f39b1573eb3b4268fbb4454829895b306f5e0c496836adf4a3ba'],
    ['docs/premium/drafts/20260922_adaptive_nutrition_retained_staging_smoke_v1.post-retirement.sql', '74a793f8aa21c64803804545bc37a04a653373b4bd9b9df894497fbeb5ab19bf'],
  ];
  for (const [path, digest] of expected) {
    assert.equal(createHash('sha256').update(read(path)).digest('hex'), digest, path);
    assert.ok(instructions.includes(digest), digest);
  }
  assert.match(instructions, /must exclude[\s\S]*origin_lineage\.source='potok-retained-staging-smoke-v1'/);
  assert.match(instructions, /must also exclude `status='archived'`/);
});
