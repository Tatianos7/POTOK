import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, mkdirSync, writeFileSync, readFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

test('inventory covers generic/optional/bracket calls, wrappers, aliases and exact refs', () => {
  const root = mkdtempSync(join(tmpdir(), 'potok-rpc-inventory-'));
  const script = fileURLToPath(new URL('./rpc-source-inventory.mjs', import.meta.url));
  const git = (...args) => execFileSync('git', args, { cwd: root, encoding: 'utf8' });
  try {
    git('init', '-q');
    mkdirSync(join(root, 'src'));
    writeFileSync(join(root, 'src/calls.ts'), `
      client.rpc<Result>('generic_call', {});
      client?.rpc('optional_call', {});
      client['rpc']('bracket_call', {});
      client!.rpc('non_null_call', {});
      rpc(client, 'wrapped_call', {});
      client.rpc(dynamicName, {});
      const bound = client.rpc;
      // client.rpc('comment_is_not_a_call', {});
      const example = "client.rpc('string_is_not_a_call', {})";
    `);
    git('add', 'src/calls.ts');
    git('-c', 'user.name=Inventory Test', '-c', 'user.email=inventory@example.invalid', 'commit', '-qm', 'fixture');
    // Uncommitted changes must not leak into an exact-ref audit.
    writeFileSync(join(root, 'src/calls.ts'), "client.rpc('dirty_worktree_call', {});");
    const output = join(root, 'result.json');
    execFileSync(process.execPath, [script, 'HEAD', output], { cwd: root, env: process.env });
    const result = JSON.parse(readFileSync(output));
    assert.deepEqual(result.summary.runtimeNames, ['bracket_call', 'generic_call', 'non_null_call', 'optional_call', 'wrapped_call']);
    assert.equal(result.summary.dynamicRuntimeCalls, 1);
    assert.equal(result.calls.length, 6);
    assert.equal(result.references.length, 6, 'includes extracted rpc alias for manual review');
    assert.equal(result.commit, git('rev-parse', 'HEAD').trim());
  } finally { rmSync(root, { recursive: true, force: true }); }
});
