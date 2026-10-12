import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

const repairPath = new URL(
  '../../docs/premium/drafts/20261012_adaptive_nutrition_error_contract_v1.repair.sql',
  import.meta.url,
);
const designPath = new URL('../../docs/premium/adaptive-nutrition-error-contract-v1.md', import.meta.url);

const publicMessages = [
  'idempotency key payload mismatch',
  'expected graph revision unavailable',
  'dated slot snapshot is not in expected graph',
  'meal slot already has a live annotation',
  'live owned annotation required',
  'live validated replacement offer required',
];
const commitMessages = [
  'idempotency key payload mismatch',
  'operation result is unresolved',
  'stale adaptive plan revision',
  'annotation retraction must supersede its live owned annotation',
  'goal revision is no longer authoritative',
];

test('disposable repair is drift-guarded to the 11 reviewed application errors', async () => {
  const sql = await readFile(repairPath, 'utf8');
  assert.match(sql, /DRAFT \/ DISPOSABLE P5-02 REPAIR ONLY/);
  assert.match(sql, /v_count <> 6/);
  assert.match(sql, /v_count <> 5/);
  for (const message of [...publicMessages, ...commitMessages]) assert.ok(sql.includes(message), message);
  assert.match(sql, /POTOK_ADAPTIVE_NUTRITION_CONFLICT_V1/);
  assert.match(sql, /POTOK_ADAPTIVE_NUTRITION_INVARIANT_FAILURE_V1/);
  assert.doesNotMatch(sql, /\b(?:GRANT|REVOKE|ALTER\s+POLICY|CREATE\s+POLICY)\b/i);
});

test('design records all 11 classifications and effective-source discrepancy', async () => {
  const design = await readFile(designPath, 'utf8');
  const rows = design.split('\n').filter((line) => /^\| (?:`2026|same)/.test(line));
  assert.equal(rows.length, 11);
  assert.match(design, /2026-09-21 persistence draft also contains an older definition/);
  assert.match(design, /PostgreSQL 17\.11 and PostgREST 13\.0\.7/);
});
