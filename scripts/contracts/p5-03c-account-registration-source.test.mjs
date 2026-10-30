import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createHash } from 'node:crypto';
const registration = readFileSync('supabase/migration_drafts/account_state_registration_v1.sql','utf8');
test('registration installer binds the reviewed account-admission code and exact Auth trigger inventory',()=>{
  const prior=readFileSync('supabase/migration_drafts/account_closure_admission_v1.sql','utf8');
  for(const signature of ['potok_closure.assert_active_v1()','public.account_closure_begin_v1(']) {
    const start=prior.indexOf('CREATE FUNCTION '+signature),begin=prior.indexOf('AS $$',start)+5,end=prior.indexOf('$$;',begin);
    assert.ok(registration.includes(createHash('sha256').update(prior.slice(begin,end)).digest('hex')));
  }
  assert.match(registration,/REVIEWED_AUTH_TRIGGER_INVENTORY_REQUIRED/);
  assert.match(registration,/EXPLICIT_REGISTRATION_STAGING_TARGET_REQUIRED/);
});
test('new Auth registration is INSERT-only and separate from owner-reviewed existing accounts',()=>{
  assert.match(registration,/AFTER INSERT ON auth\.users/);
  assert.match(registration,/NEW\.is_anonymous IS DISTINCT FROM false/);
  assert.match(registration,/CREATE FUNCTION potok_closure\.register_reviewed_existing_v1\(p_permit uuid\)/);
  assert.doesNotMatch(registration,/CREATE (OR REPLACE )?FUNCTION public\./i);
  assert.doesNotMatch(registration,/INSERT INTO potok_closure\.accounts_v1[^;]*SELECT/i);
  assert.doesNotMatch(registration,/ON CONFLICT[^;]*DO UPDATE/i);
});
test('registration does not issue privileges, overwrite CLOSING, or invent default permit validity',()=>{
  assert.doesNotMatch(registration.replace(/--.*$/gm,''),/grant_entitlement|user_metadata|has_premium|is_admin/);
  assert.match(registration,/state_row\.state<>'ACTIVE'/);
  assert.match(registration,/expires_at timestamptz NOT NULL/);
  assert.doesNotMatch(registration,/expires_at[^\n]*DEFAULT/);
  assert.match(registration,/DEFERRABLE INITIALLY DEFERRED/);
  assert.match(registration,/FROM PUBLIC,anon,authenticated,service_role/);
});
