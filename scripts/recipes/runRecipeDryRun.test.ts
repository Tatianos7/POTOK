import assert from 'node:assert/strict';
import test from 'node:test';
import { mkdtempSync, readFileSync, writeFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { spawnSync } from 'node:child_process';

const script = new URL('./runRecipeDryRun.ts', import.meta.url);
const sample = new URL('../../data/recipes/recipe-candidates-v1.json', import.meta.url);

test('CLI emits a review report, never overwrites files and has no apply mode', () => {
  const dir = mkdtempSync(join(tmpdir(), 'potok-recipe-preflight-'));
  const foods = join(dir, 'foods.json');
  const output = join(dir, 'report.json');
  writeFileSync(foods, JSON.stringify({ exported_at: '2026-09-18T00:00:00Z', source_project_ref: 'empty-test-fixture', foods: [] }));
  const args = ['--import', 'tsx', script.pathname, '--recipes', sample.pathname, '--foods', foods, '--output', output];
  try {
    const run = spawnSync(process.execPath, args, { encoding: 'utf8', timeout: 10000 });
    assert.equal(run.status, 1, run.stderr);
    const saved = readFileSync(output, 'utf8');
    const report = JSON.parse(saved);
    assert.equal(report.mode, 'offline_dry_run');
    assert.equal(report.publishable, false);
    assert.equal(report.summary.valid, 0);
    assert.equal(report.summary.rejected, 4);
    assert.match(report.input_sha256.foods, /^[0-9a-f]{64}$/);

    const repeat = spawnSync(process.execPath, args, { encoding: 'utf8', timeout: 10000 });
    assert.notEqual(repeat.status, 0);
    assert.equal(readFileSync(output, 'utf8'), saved);

    const apply = spawnSync(process.execPath, [...args, '--apply'], { encoding: 'utf8', timeout: 10000 });
    assert.notEqual(apply.status, 0);
    assert.match(apply.stderr, /Usage:/);
    assert.equal(readFileSync(output, 'utf8'), saved);
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});
