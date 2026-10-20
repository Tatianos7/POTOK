import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import test from 'node:test';

const sql = readFileSync(resolve(process.cwd(), 'scripts/contracts/p5-03c-closure-fence-disposable-prototype.sql'), 'utf8');

test('closure SQL prototype cannot run without explicit disposable marker', () => {
  assert.match(sql, /current_setting\('potok_closure\.test_target', true\)/);
  assert.match(sql, /disposable-postgresql-only/);
  assert.match(sql, /POTOK_CLOSURE_DISPOSABLE_ONLY/);
  assert.doesNotMatch(sql, /CREATE\s+OR\s+REPLACE\s+FUNCTION\s+public\./i);
  assert.doesNotMatch(sql, /\bGRANT\s+EXECUTE\b/i);
});

test('both closure and admission acquire same account gate before FOR UPDATE', () => {
  for (const name of ['assert_active', 'begin_closure']) {
    const start = sql.indexOf('CREATE FUNCTION potok_closure_disposable.' + name);
    assert.ok(start >= 0, name);
    const next = sql.indexOf('CREATE FUNCTION', start + 15);
    const fn = sql.slice(start, next < 0 ? undefined : next);
    const lock = fn.indexOf("pg_advisory_xact_lock");
    const row = fn.indexOf('FOR UPDATE');
    assert.ok(lock >= 0 && row > lock, name);
    assert.match(fn, /'potok-closure-v1:'\|\|p_account::text/);
  }
});

test('unknown accounts and conflicting closure keys are denied, no CLOSED claim', () => {
  assert.match(sql, /ACCOUNT_UNVERIFIED/);
  assert.match(sql, /ACCOUNT_NOT_ACTIVE/);
  assert.match(sql, /CLOSURE_CONFLICT/);
  assert.match(sql, /v\.state='CLOSING' AND v\.closure_key=p_key/);
  assert.doesNotMatch(sql, /SET state='CLOSED'/);
  assert.doesNotMatch(sql, /DELETE\s+FROM\s+auth\.users/i);
});
