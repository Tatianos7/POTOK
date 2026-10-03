import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';

const path = new URL(
  '../../docs/premium/drafts/20260927_adaptive_nutrition_graph_v2_persistence_metadata_preflight_v1.sql',
  import.meta.url,
);
const sql = readFileSync(path, 'utf8');
const withoutComments = sql.replace(/--[^\n]*(?:\n|$)/g, '\n');
const executableShape = withoutComments.replace(/'(?:''|[^'])*'/g, "''");

test('Graph v2 metadata preflight is one SELECT-only statement', () => {
  assert.equal((executableShape.match(/;/g) ?? []).length, 1);
  assert.match(executableShape.trim(), /^WITH\b/i);
  assert.match(executableShape.trim(), /ORDER BY[\s\S]+;$/i);
  assert.doesNotMatch(executableShape,
    /\b(?:INSERT|UPDATE|DELETE|MERGE|TRUNCATE|ALTER|CREATE|DROP|GRANT|REVOKE|COMMENT|CALL|DO|COPY|BEGIN|COMMIT|ROLLBACK)\b/i);
  assert.doesNotMatch(executableShape, /\bSET\s+(?:LOCAL\s+)?ROLE\b/i);
});

test('preflight never queries application relations or invokes application RPCs', () => {
  assert.doesNotMatch(executableShape,
    /\b(?:FROM|JOIN)\s+(?:public|potok_control|potok_nutrition)\s*\./i);
  assert.doesNotMatch(executableShape,
    /\b(?:public|potok_control|potok_nutrition)\s*\.\s*[a-z0-9_]+\s*\(/i);
  assert.match(sql, /Application functions are not invoked\./);
});

test('preflight pins the owner-visible staging label and deterministic output shape', () => {
  assert.match(sql, /ozidryfvhkcbtpnulakq/);
  assert.match(sql,
    /SELECT section_id, section_name, object_name, record_kind, payload_json/);
  assert.match(sql, /ORDER BY section_id, object_name, record_kind, payload_json::text/);
  assert.match(sql, /NOT_FOUND_IN_SCOPED_METADATA/);
});

test('all eighteen numbered evidence sections are represented exactly once', () => {
  const sectionCatalog = sql.slice(sql.indexOf('section_catalog('), sql.indexOf('final_rows AS'));
  const ids = [...sectionCatalog.matchAll(/^\s*\((\d+),\s*'[^']+'\),?$/gm)]
    .map((match) => Number(match[1]));
  assert.deepEqual(ids, Array.from({ length: 18 }, (_, index) => index));
});

test('static delimiter check is balanced without claiming PostgreSQL parser validation', () => {
  let depth = 0;
  for (const character of executableShape) {
    if (character === '(') depth += 1;
    if (character === ')') depth -= 1;
    assert.ok(depth >= 0, 'closing parenthesis appears before its opener');
  }
  assert.equal(depth, 0);
  assert.equal((executableShape.match(/\bWITH\b/gi) ?? []).length >= 1, true);
});
