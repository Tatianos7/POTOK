/** P5-03C real-issuer closure integration gate (intentionally RED until wired).
 * This is a source-level prerequisite, NOT a PostgreSQL concurrency acceptance.
 * Run explicitly: npx tsx --test scripts/contracts/p5-03c-real-issuer-closure-gate.test.ts
 * Do not add to required CI until a real disposable-DB harness is implemented.
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const read = (path: string) => readFileSync(path, 'utf8');
const food = read('supabase/migration_drafts/food_reviewed_evidence_v1_phase2b.sql');
const nonfood = read('supabase/migration_drafts/nonfood_reviewed_evidence_v1.sql');
const closure = read('scripts/contracts/p5-03c-closure-fence-disposable-prototype.sql');

function body(sql: string, signature: string): string {
  const start = sql.indexOf('CREATE FUNCTION ' + signature);
  assert.ok(start >= 0, 'function exists: ' + signature);
  const begin = sql.indexOf('AS $$', start);
  assert.ok(begin >= 0, 'function body starts: ' + signature);
  const end = sql.indexOf('$$;', begin + 5);
  assert.ok(end > begin, 'function body ends: ' + signature);
  return sql.slice(begin + 5, end);
}

for (const [label, sql, signature, authority, catalog] of [
  ['Food', food, 'public.food_evidence_review_v1(', 'attestation:=potok_food_evidence.authority_v1()', "'potok-food-evidence-v1:'"],
  ['Nonfood', nonfood, 'public.nonfood_evidence_review_v1(', 'att:=potok_food_evidence.authority_v1()', "'potok-nonfood-v1:catalog'"],
] as const) {
  test(label + ': verified Auth precedes same-transaction closure admission and catalog lock', () => {
    const fn = body(sql, signature);
    const authAt = fn.indexOf(authority);
    const catalogAt = fn.indexOf(catalog);
    const closureAt = fn.indexOf('potok_closure.assert_active_v1(');
    assert.ok(authAt >= 0, 'existing trusted authority required');
    assert.ok(catalogAt > authAt, 'existing catalog lock follows authority');
    assert.ok(closureAt > authAt, 'MISSING: real account closure admission after authority');
    assert.ok(closureAt < catalogAt, 'closure admission must precede catalog lock');
    assert.doesNotMatch(fn, /potok_closure_disposable/, 'disposable prototype must never be mounted');
  });
}

test('prototype is never a production closure adapter', () => {
  assert.match(closure, /POTOK_CLOSURE_DISPOSABLE_ONLY/);
  assert.match(closure, /CLOSED transition and actual data erasure are deliberately NOT implemented/);
  assert.doesNotMatch(food + nonfood, /potok_closure_disposable\./);
});
