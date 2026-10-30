import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {buildClosedEvidenceStagingBundleV1,bundleOutput,rpcSignatures} from './build-evidence-closed-staging-bundle-v1.mjs';
const load=p=>readFileSync(p,'utf8');
test('reviewable SQL is reproducible with exactly one outer transaction and a final closed boundary',()=>{
 const sql=buildClosedEvidenceStagingBundleV1();
 assert.equal(sql,load(bundleOutput));
 assert.equal((sql.match(/^BEGIN;$/gm)??[]).length,1);
 assert.equal((sql.match(/^COMMIT;$/gm)??[]).length,1);
 assert.ok(sql.endsWith('COMMIT;\n'));
 const revoke=sql.lastIndexOf('REVOKE ALL ON FUNCTION');
 for(const signature of rpcSignatures)assert.ok(sql.slice(revoke).includes(signature));
 assert.ok(revoke>sql.lastIndexOf('GRANT EXECUTE'));
});
test('any component drift fails before output; no mutable source is silently re-approved',()=>{
 const manifest=JSON.parse(load('scripts/contracts/evidence-closed-staging-manifest-v1.json'));
 for(const part of manifest.parts)
  assert.throws(()=>buildClosedEvidenceStagingBundleV1(p=>load(p)+(p===part.path?'\n-- drift':'')),/BUNDLE_SOURCE_DRIFT/);
});
