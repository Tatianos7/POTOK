import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';
import test from 'node:test';

const root = new URL('../../', import.meta.url);
const read = (path: string) => readFileSync(new URL(path, root), 'utf8');
const preflight = read('docs/premium/drafts/20260922_adaptive_nutrition_disposable_smoke_v1.preflight.sql');
const fixture = read('docs/premium/drafts/20260922_adaptive_nutrition_disposable_smoke_v1.fixture.sql');
const postcheck = read('docs/premium/drafts/20260922_adaptive_nutrition_disposable_smoke_v1.postcheck.sql');
const instructions = read('docs/premium/adaptive-nutrition-disposable-branch-smoke-v1.md');

function withoutComments(sql: string): string {
  return sql.replace(/--.*$/gm, '').replace(/\/\*[\s\S]*?\*\//g, '');
}

function assertSelectOnly(sql: string): void {
  const executable = withoutComments(sql).trim();
  for (const statement of executable.split(';').map((value) => value.trim()).filter(Boolean)) {
    assert.match(statement, /^(?:WITH\b[\s\S]*?\bSELECT\b|SELECT\b)/i);
  }
  const executableWithoutStrings = executable.replace(/'(?:''|[^'])*'/g, "''");
  assert.doesNotMatch(executableWithoutStrings,
    /\b(?:INSERT|UPDATE|DELETE|CREATE|ALTER|DROP|GRANT|REVOKE|CALL|DO|BEGIN|COMMIT|ROLLBACK|TRUNCATE)\b/i);
}

function plpgsqlDoBlocks(sql: string): Array<{ tag: string; declarations: string; body: string }> {
  return [...withoutComments(sql).matchAll(
    /DO \$([a-z][a-z0-9_]*)\$\s*DECLARE([\s\S]*?)\bBEGIN\b([\s\S]*?)\bEND\s*\$\1\$;/gi,
  )].map((match) => ({ tag: match[1], declarations: match[2], body: match[3] }));
}

test('preflight and post-smoke evidence are SELECT-only and do not execute business routines', () => {
  assertSelectOnly(preflight);
  assertSelectOnly(postcheck);
  for (const marker of ['required_objects', 'repair_and_runtime_markers', 'runtime_grants', 'runtime_security',
    'immutable_guards', 'isolated_account', 'empty_fixture_surfaces', 'final_readiness']) {
    assert.ok(preflight.includes(`'${marker}'`), marker);
  }
});

test('fixture is one committed owner transaction that fails closed on non-empty branch state', () => {
  const executable = withoutComments(fixture);
  assert.equal((executable.match(/^BEGIN;$/gm) ?? []).length, 1);
  assert.equal((executable.match(/^COMMIT;$/gm) ?? []).length, 1);
  assert.equal((executable.match(/^ROLLBACK;$/gm) ?? []).length, 0);
  assert.match(executable, /SESSION_USER <> 'postgres' OR CURRENT_USER <> 'postgres'/);
  assert.match(executable, /v_account_count <> 1/);
  for (const emptySurface of [
    'public.user_goals', 'public.user_premium_plan_selections',
    'public.user_premium_meal_selections', 'public.food_diary_entries',
    'potok_control.access_attestations', 'public.adaptive_nutrition_operations',
    'public.adaptive_nutrition_graph_revisions', 'public.adaptive_nutrition_events',
    'potok_nutrition.validated_plan_replacement_offers_v1',
  ]) assert.ok(executable.includes(`EXISTS (SELECT 1 FROM ${emptySurface}`), emptySurface);
  assert.ok(executable.indexOf('SET CONSTRAINTS ALL IMMEDIATE;') > executable.lastIndexOf('$fixture$;'));
  assert.ok(executable.indexOf('$verify_fixture$') > executable.indexOf('SET CONSTRAINTS ALL IMMEDIATE;'));
  assert.ok(executable.indexOf('COMMIT;') > executable.lastIndexOf('$verify_fixture$;'));
  assert.doesNotMatch(executable, /\bEXCEPTION\s+WHEN\b/i);
});

test('each PL/pgSQL DO block declares every referenced local v_ identifier in its own scope', () => {
  const blocks = plpgsqlDoBlocks(fixture);
  assert.deepEqual(blocks.map(({ tag }) => tag), ['fixture', 'verify_fixture']);
  for (const block of blocks) {
    const declared = new Set([...block.declarations.matchAll(/^\s*(v_[a-z0-9_]*)\b/gmi)]
      .map((match) => match[1].toLowerCase()));
    const referenced = new Set([...`${block.declarations}\n${block.body}`.matchAll(/\bv_[a-z0-9_]+\b/gi)]
      .map((match) => match[0].toLowerCase()));
    const undeclared = [...referenced].filter((identifier) => !declared.has(identifier));
    assert.deepEqual(undeclared, [], `${block.tag} references undeclared locals`);
  }
});

test('fixture creates only synthetic plan foundation with no canonical or FACT projection writes', () => {
  const executable = withoutComments(fixture);
  for (const target of [
    'public.user_profiles', 'public.user_goals', 'public.user_premium_plan_selections',
    'public.adaptive_nutrition_operations', 'public.adaptive_nutrition_graph_revisions',
  ]) assert.match(executable, new RegExp(`INSERT INTO ${target.replace('.', '\\.')}`));
  assert.match(executable, /potok_control\.grant_entitlement_v2\(/);
  assert.match(executable, /'contract_version'|contract_version, week_anchor/);
  assert.match(executable, /'generated'/);
  assert.match(executable, /'recipeRevision', NULL/);
  assert.equal((executable.match(/\([0-6], '9a220000-/g) ?? []).length, 7);
  assert.doesNotMatch(executable,
    /(?:INSERT\s+INTO|UPDATE|DELETE\s+FROM)\s+(?:public\.)?(?:food_diary_entries|user_premium_meal_selections|premium_recipes?|foods?)\b/i);
  assert.doesNotMatch(executable, /\b(?:FACT|CONSUMED_AS_PLANNED|CONSUMED_MODIFIED|EXTRA_FOOD)\b/);
});

test('postcheck covers receipt history isolation and absence of diary projections', () => {
  for (const marker of ['fixture_identity', 'receipts', 'annotation_history',
    'isolation_and_fact_absence', 'entitlement_lineage']) assert.ok(postcheck.includes(`'${marker}'`), marker);
  assert.match(postcheck, /total_operations=3/);
  assert.match(postcheck, /total_events=2/);
  assert.match(postcheck, /diary_rows=0/);
  assert.match(postcheck, /replacement_offers=0/);
});

test('fallback migration order is pinned to the already reviewed artifacts', () => {
  const expected: Array<[string, string]> = [
    ['docs/premium/drafts/20260921_trusted_entitlement_v2.sql', 'ffef9a7de1b1540a4511751614c170a1269bc16dc97c5e663c0475dda0065029'],
    ['docs/premium/drafts/20260921_trusted_entitlement_v2_1_repair.sql', '949a155479c002c37b54a733ac7e16c21b1cb3c10ebc5cdb06afcf460f69f47c'],
    ['docs/premium/drafts/20260921_trusted_entitlement_v2_2_repair.sql', '38781cda4f22e7b6c341fb32e9829b9e04e1eacd1f893bfac9e0a066ec951a77'],
    ['docs/premium/drafts/20260921_adaptive_nutrition_persistence_v1.sql', '2c905977dba43d8679a78582738b6224e38ccd71226932961392c80f2b8fa0d4'],
    ['docs/premium/drafts/20260921_adaptive_nutrition_runtime_activation_v1.sql', '89d747579ce890d031b82e2244f4415e2179bede744db363307f5b07d543305e'],
  ];
  for (const [path, digest] of expected) {
    assert.equal(createHash('sha256').update(read(path)).digest('hex'), digest, path);
    assert.ok(instructions.indexOf(path.split('/').at(-1)!) >= 0, path);
  }
  const positions = expected.map(([path]) => instructions.indexOf(path.split('/').at(-1)!));
  assert.deepEqual([...positions].sort((a, b) => a - b), positions);
});

test('teardown is whole-branch deletion and retained cleanup is forbidden', () => {
  assert.match(instructions, /delete\s+the\s+entire\s+disposable\s+branch/i);
  assert.match(instructions, /Do not merge/i);
  assert.match(instructions, /do not attempt row cleanup/i);
  assert.match(instructions, /Include data OFF/);
});
