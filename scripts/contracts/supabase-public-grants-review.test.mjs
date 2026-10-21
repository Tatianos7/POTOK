import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';

const profile = readFileSync('src/services/profileService.ts', 'utf8');
const candidate = readFileSync('supabase/migration_drafts/public_api_privileges_hardening_review_20261021.sql', 'utf8');

test('profile client ordinary field allowlist excludes privilege fields', () => {
  const match = profile.match(/const ORDINARY_PROFILE_WRITE_FIELDS = \[([\s\S]*?)\] as const;/);
  assert.ok(match, 'profile allowlist must exist');
  const fields = [...match[1].matchAll(/'([^']+)'/g)].map((m) => m[1]);
  assert.deepEqual(fields, ['first_name','last_name','middle_name','birth_date','age','height','goal','email','phone','avatar_url']);
  for (const privileged of ['has_premium','is_admin','premium_provenance_id','admin_provenance_id']) {
    assert.ok(!fields.includes(privileged), privileged + ' must not be client writable');
  }
});

test('profile uses scoped ordinary writes and settings updates without broad upsert', () => {
  assert.match(profile, /private async writeOrdinaryProfile\(/);
  assert.match(profile, /table\.select\(column\)\.eq\(column, userId\)\.maybeSingle\(\)/);
  assert.match(profile, /table\.update\(ordinary\)\.eq\(column, userId\)/);
  assert.match(profile, /table\.insert\(\{ \[column\]: userId, \.\.\.ordinary \}\)/);
  assert.doesNotMatch(profile, /\.upsert\(/);
  for (const field of ['avatar_url','coach_settings','voice_settings']) {
    assert.match(profile, new RegExp('\\.update\\(\\{ ' + field + ':'));
  }
});

test('SQL candidate is non-applying and cannot silently become deployment migration', () => {
  assert.match(candidate, /^BEGIN;/m);
  assert.match(candidate, /^ROLLBACK;/m);
  assert.doesNotMatch(candidate, /^COMMIT;/m);
  assert.match(candidate, /REVOKE UPDATE ON TABLE public\.user_profiles FROM anon, authenticated;/);
  assert.match(candidate, /REVOKE INSERT, UPDATE, DELETE ON TABLE/);
});
