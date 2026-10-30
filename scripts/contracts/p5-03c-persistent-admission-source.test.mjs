// Source guards only; native acceptance is mandatory and separately executed.
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createHash } from 'node:crypto';
const draft = readFileSync('supabase/migration_drafts/account_closure_admission_v1.sql', 'utf8');
test('persistent patch pins the exact original issuer bodies rather than guessing a replacement', () => {
  for (const [file, name] of [['food_reviewed_evidence_v1_phase2b.sql', 'food'], ['nonfood_reviewed_evidence_v1.sql', 'nonfood']]) {
    const source = readFileSync('supabase/migration_drafts/' + file, 'utf8');
    const start = source.indexOf(`CREATE FUNCTION public.${name}_evidence_review_v1(`);
    const begin = source.indexOf('AS $$', start) + 5, end = source.indexOf('$$;', begin);
    assert.ok(start >= 0 && end > begin);
    const hash = createHash('sha256').update(source.slice(begin, end)).digest('hex');
    assert.ok(draft.includes(hash), `${name} source hash is explicitly pinned`);
  }
  assert.match(draft, /REVIEWED_ISSUER_DEFINITION_REQUIRED/);
  assert.match(draft, /p\.proconfig IS DISTINCT FROM ARRAY\['search_path=pg_catalog'\]/);
});
test('new state has no implicit ACTIVE population, CLOSED/erasure path or client table privileges', () => {
  assert.doesNotMatch(draft, /INSERT\s+INTO\s+potok_closure\.accounts_v1/i);
  assert.match(draft, /state IN \('ACTIVE','CLOSING'\)/);
  assert.match(draft, /FORCE ROW LEVEL SECURITY/);
  assert.match(draft, /REVOKE ALL ON potok_closure\.accounts_v1 FROM PUBLIC,anon,authenticated,service_role/);
  assert.match(draft, /EXPLICIT_CLOSURE_STAGING_TARGET_REQUIRED/);
});
test('owner derives from live Auth, with the shared gate before state locks and a deferred fresh-auth guard', () => {
  const owner = draft.slice(draft.indexOf('CREATE FUNCTION potok_closure.owner_v1()'), draft.indexOf('CREATE FUNCTION potok_closure.assert_active_v1()'));
  assert.match(owner, /actor uuid:=auth\.uid\(\)/);
  assert.match(owner, /auth\.sessions/);
  assert.match(owner, /potok-entitlement-v2:/);
  assert.doesNotMatch(owner, /is_effective_entitlement|potok_food_evidence\.authority_v1\(/);
  assert.match(draft, /DEFERRABLE INITIALLY DEFERRED/);
  assert.match(draft, /CLOSURE_TRANSITION_INVALID/);
  assert.match(draft, /GRANT EXECUTE ON FUNCTION public\.account_closure_begin_v1\(text\) TO authenticated/);
  assert.doesNotMatch(draft, /GRANT[^;]*TO (anon|service_role)/);
});
