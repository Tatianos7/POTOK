import assert from 'node:assert/strict';
import test from 'node:test';
import {readFileSync} from 'node:fs';
import {createHash} from 'node:crypto';
import {buildGenerationPatchPackageV1} from './build.mjs';
const manifest=JSON.parse(readFileSync(new URL('manifest.json',import.meta.url),'utf8'));
const root=new URL('../../../',import.meta.url);
test('two pinned candidates compose as one rollback-only package with pre/post admission and metadata preservation',()=>{
  const a=buildGenerationPatchPackageV1();assert.deepEqual(a,buildGenerationPatchPackageV1());
  assert.equal(a.sourceCount,2);assert.equal(a.mayApply,false);assert.equal(a.mayActivate,false);
  assert.match(a.rollbackSql,/\nROLLBACK;\n$/);assert.doesNotMatch(a.rollbackSql,/^COMMIT;/m);
  assert.match(a.rollbackSql,/GENERATION_PATCH_BASELINE_REQUIRED/);assert.match(a.rollbackSql,/GENERATION_PATCH_POSTCHECK_FAILED/);
  assert.match(a.rollbackSql,/GENERATION_PATCH_UNEXPECTED_FUNCTION_CHANGE/);
  for(const e of manifest.sources){
    const source=readFileSync(new URL(e.path,root),'utf8');
    const body=/^((?:--[^\n]*\n|\s)*?)BEGIN;\s*([\s\S]*?)\s*COMMIT;\s*$/.exec(source)[2];
    assert.ok(a.rollbackSql.includes(body));
  }
  assert.equal(a.rollbackSha256,createHash('sha256').update(a.rollbackSql).digest('hex'));
});
test('wrong target/revision/order/path/digest/PR cannot redirect or reauthorize source bytes',()=>{
  for(const mutate of [m=>m.targetProjectId='other',m=>m.sourceCommit='a'.repeat(40),m=>m.sources.reverse(),
    m=>m.sources[0].path='../../outside.sql',m=>m.sources[0].sha256='0'.repeat(64),m=>m.sources[0].pr=290,m=>m.sources.pop()]){
    const m=structuredClone(manifest);mutate(m);assert.throws(()=>buildGenerationPatchPackageV1({manifest:m}));
  }
});
test('source-byte mutation fails before a package is returned, even at equal length',()=>{
  assert.throws(()=>buildGenerationPatchPackageV1({read:path=>Buffer.from(readFileSync(new URL(path,root),'utf8').replace('BEGIN;','begin;'))}),/GENERATION_PATCH_SOURCE_DRIFT/);
});
