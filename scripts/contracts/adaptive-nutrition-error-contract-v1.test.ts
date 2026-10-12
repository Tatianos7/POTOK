import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

const repairPath = new URL(
  '../../docs/premium/drafts/20261012_adaptive_nutrition_error_contract_v1.repair.sql',
  import.meta.url,
);
const designPath = new URL('../../docs/premium/adaptive-nutrition-error-contract-v1.md', import.meta.url);
const wirePath = new URL(
  '../../docs/premium/drafts/20261012_adaptive_nutrition_error_contract_v1.acceptance.sql',
  import.meta.url,
);
const targetPostcheckPath = new URL(
  '../../docs/premium/drafts/20261012_adaptive_nutrition_error_contract_v1.effective-postcheck.sql',
  import.meta.url,
);
const runnerPath = new URL('../acceptance/run-adaptive-nutrition-error-contract-v1.sh', import.meta.url);
const extractorPath = new URL('../acceptance/extract-adaptive-nutrition-effective-functions-v1.mjs', import.meta.url);
const workflowPath = new URL('../../.github/workflows/p5-02-disposable-acceptance.yml', import.meta.url);

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
  assert.match(design, /PostgreSQL 17\.11 \/ PostgREST 13\.0\.7/);
});

test('acceptance separates target repair, native concurrency and synthetic wire mapping', async () => {
  const [wire, postcheck, runner, extractor, workflow] = await Promise.all([
    readFile(wirePath, 'utf8'), readFile(targetPostcheckPath, 'utf8'),
    readFile(runnerPath, 'utf8'), readFile(extractorPath, 'utf8'), readFile(workflowPath, 'utf8'),
  ]);
  assert.match(wire, /WIRE PROBE ONLY/);
  assert.doesNotMatch(wire, /RAISE SQLSTATE '40001'/);
  assert.match(postcheck, /v_count <> 6/);
  assert.match(postcheck, /v_count <> 4/);
  assert.match(postcheck, /proowner, p\.prosecdef, p\.proconfig, p\.proacl/);
  assert.match(runner, /ISOLATION LEVEL SERIALIZABLE/);
  assert.match(runner, /drift_counts.*6:5/s);
  assert.match(runner, /--connect-timeout 3 --max-time 10/);
  assert.match(runner, /required_command in docker node curl timeout sed grep seq mktemp/);
  assert.match(runner, /grep -F -- '40001'/);
  assert.doesNotMatch(runner, /\brg\b/);
  assert.match(extractor, /20260921_adaptive_nutrition_runtime_activation_v1\.sql/);
  assert.match(extractor, /20260927_adaptive_nutrition_graph_v2_authorities_activation_v1\.sql/);
  assert.match(workflow, /workflow_dispatch/);
  assert.match(workflow, /timeout 8m/);
  assert.doesNotMatch(workflow, /secrets\./);
});
