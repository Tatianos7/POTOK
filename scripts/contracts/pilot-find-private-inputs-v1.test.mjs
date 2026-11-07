import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

test('standalone private input finder retains exactly the reviewed hash pins and has no outbound network',()=>{
  const manifest=JSON.parse(readFileSync('docs/premium/retained-sources/pilot-staging-review-20261106/family-review-aggregate-v2.json','utf8'));
  const script=readFileSync('scripts/contracts/pilot-find-private-inputs-v1.mjs','utf8');
  for(const pin of [manifest.inputBindings.candidateSha256,manifest.inputBindings.snapshotSha256,manifest.inputBindings.familySnapshotSha256])
    assert.ok(script.includes(pin),'reviewed snapshot pin drift');
  assert.doesNotMatch(script,/fetch\s*\(|https?:\/\/|child_process|execSync|spawn\s*\(|writeFile|unlink\s*\(|rmSync|GitHub API|process\.env/);
  assert.match(script,/entry\.isSymbolicLink\(\)/);
  assert.match(script,/meta\.size>15_000_000/);
});
