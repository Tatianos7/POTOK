import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { transformIssuer, buildDisposableIssuers } from './p5-03c-build-disposable-issuers';

const specs = [
  ['food_reviewed_evidence_v1_phase2b.sql', 'public.food_evidence_review_v1(', '  attestation:=potok_food_evidence.authority_v1();'],
  ['nonfood_reviewed_evidence_v1.sql', 'public.nonfood_evidence_review_v1(', ' att:=potok_food_evidence.authority_v1();'],
] as const;

test('disposable SQL generation inserts account admission after verified authority', () => {
  const root = mkdtempSync(join(tmpdir(), 'potok-issuer-candidate-'));
  try {
    const files = buildDisposableIssuers(root);
    assert.equal(files.length, 2);
    for (const [index, [name, functionName, anchor]] of specs.entries()) {
      const original = readFileSync('supabase/migration_drafts/' + name, 'utf8');
      const candidate = readFileSync(files[index], 'utf8');
      const start = candidate.indexOf('CREATE FUNCTION ' + functionName);
      const end = candidate.indexOf('$$;', start);
      const issuer = candidate.slice(start, end);
      const authorityAt = issuer.indexOf(anchor);
      const admissionAt = issuer.indexOf('potok_closure_candidate.assert_active_v1(actor)');
      const catalogAt = issuer.indexOf(index === 0 ? "'potok-food-evidence-v1:'" : "'potok-nonfood-v1:catalog'");
      assert.ok(authorityAt >= 0 && admissionAt > authorityAt && catalogAt > admissionAt);
      assert.equal(candidate.split('potok_closure_candidate.assert_active_v1(actor)').length, 2);
      assert.equal(candidate.replace(/\n  -- DISPOSABLE-ONLY candidate; held until transaction end\.\n  PERFORM potok_closure_candidate\.assert_active_v1\(actor\);/, ''), original);
      assert.throws(() => transformIssuer(candidate, functionName, anchor), /already contains/);
    }
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});

test('fail closed when authority anchor is missing or actor binding changes', () => {
  const [name, functionName, anchor] = specs[0];
  const original = readFileSync('supabase/migration_drafts/' + name, 'utf8');
  assert.throws(() => transformIssuer(original.replace(anchor, 'PERFORM 1;'), functionName, anchor), /anchor missing/);
  assert.throws(() => transformIssuer(original.replace('DECLARE actor uuid:=auth.uid();', 'DECLARE actor uuid;'), functionName, anchor), /actor binding changed/);
});
