import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import test from 'node:test';

// Source-level deployment guard only. It does NOT prove account erasure,
// live Auth, legal retention policy, or the absence of personal-data copies.
const read = (path: string) => readFileSync(resolve(process.cwd(), path), 'utf8');
const food = read('supabase/migration_drafts/food_reviewed_evidence_v1_phase2b.sql');
const nonfood = read('supabase/migration_drafts/nonfood_reviewed_evidence_v1.sql');
const nonfoodDocs = read('docs/architecture/nonfood-reviewed-evidence-server-v1.md');
const remediation = read('docs/architecture/p5-03c-retention-auth-remediation-gates-2026-10-20.md');

test('retention gate: no silent CASCADE or identity-erasure claim in Food/Nonfood drafts', () => {
  for (const [kind, sql] of [['food', food], ['nonfood', nonfood]] as const) {
    assert.doesNotMatch(sql, /ON\s+DELETE\s+CASCADE/i, kind);
    assert.doesNotMatch(sql, /ON\s+DELETE\s+SET\s+NULL/i, kind);
    assert.match(sql, /REFERENCES\s+auth\.users\s*\(id\)\s+ON\s+DELETE\s+RESTRICT/i, kind);
    assert.match(sql, /\b(receipt|receipts|review_requests)\b/i, kind);
  }
});

test('retention gate: account-linked event and receipt identities are explicitly inventoried', () => {
  assert.match(food, /review_events_v1[\s\S]*?actor_id\s+uuid\s+NOT\s+NULL\s+REFERENCES\s+auth\.users\(id\)\s+ON\s+DELETE\s+RESTRICT/i);
  assert.match(food, /review_requests_v1[\s\S]*?actor_id\s+uuid\s+NOT\s+NULL\s+REFERENCES\s+auth\.users\(id\)\s+ON\s+DELETE\s+RESTRICT/i);
  assert.match(nonfood, /events_v1[\s\S]*?actor_id\s+uuid\s+NOT\s+NULL\s+REFERENCES\s+auth\.users\(id\)\s+ON\s+DELETE\s+RESTRICT/i);
  assert.match(nonfood, /receipts_v1[\s\S]*?actor_id\s+uuid\s+NOT\s+NULL\s+REFERENCES\s+auth\.users\(id\)\s+ON\s+DELETE\s+RESTRICT/i);
});

test('retention gate: proposal bytes and receipts cannot be mistaken for erasable data', () => {
  assert.match(food, /original_proposal_bytes\s+bytea/i);
  assert.match(food, /receipt\s+jsonb\s+NOT\s+NULL/i);
  assert.match(nonfood, /raw_request|request_bytes|original_request/i);
  assert.match(nonfood, /receipt\s+jsonb\s+NOT\s+NULL/i);
});

test('retention gate: no claim that unapproved policy or real Auth testing is completed', () => {
  assert.match(nonfoodDocs, /RETENTION_POLICY_APPROVED=false/);
  assert.match(remediation, /NOT APPROVED \/ NOT DEPLOYED/);
  assert.match(remediation, /Real Supabase JWT\/PostgREST\s*\|\s*NOT VERIFIED/i);
  assert.match(remediation, /Database-level erasure\/closure implementation\s*\|\s*NOT IMPLEMENTED/i);
});
