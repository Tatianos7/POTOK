import assert from 'node:assert/strict';
import test from 'node:test';
import {readFileSync} from 'node:fs';
import {createHash} from 'node:crypto';
import {buildGenerationStagingPackageV1} from './build.mjs';
const manifest=JSON.parse(readFileSync(new URL('manifest.json',import.meta.url),'utf8'));
const root=new URL('../../../',import.meta.url);
test('review is deterministic, pins four original byte streams and always ends in rollback',()=>{
  const a=buildGenerationStagingPackageV1();assert.deepEqual(a,buildGenerationStagingPackageV1());
  assert.equal(a.mayApply,false);assert.equal(a.mayActivate,false);assert.equal(a.sourceCount,4);
  assert.match(a.rollbackSql,/\nROLLBACK;\n$/);assert.doesNotMatch(a.rollbackSql,/^COMMIT;/m);
  for(const e of manifest.sources){
    const source=readFileSync(new URL(e.path,root),'utf8');
    const inner=/^((?:--[^\n]*\n|\s)*?)BEGIN;\s*([\s\S]*?)\s*COMMIT;\s*$/.exec(source)[2];
    assert.ok(a.rollbackSql.includes(inner));
  }
});
test('target, source revision, path traversal and dependency reordering fail before SQL output',()=>{
  for(const mutate of [m=>m.targetProjectId='dtsdnhbcwpbfrhcazqkb',m=>m.sourceCommit='a'.repeat(40),
    m=>m.sources.reverse(),m=>m.sources[0].path='../../outside.sql',m=>m.sources.pop()]){
    const m=structuredClone(manifest);mutate(m);assert.throws(()=>buildGenerationStagingPackageV1({manifest:m}));
  }
});
test('same-length source changes cannot be assembled and a rehashed invalid transaction envelope is rejected',()=>{
  assert.throws(()=>buildGenerationStagingPackageV1({read:path=>Buffer.from(readFileSync(new URL(path,root),'utf8').replace('BEGIN;','begin;'))}),/SOURCE_DRIFT/);
  const m=structuredClone(manifest),bytes=Buffer.from('-- missing outer transaction\nSELECT 1;');m.sources[0].sha256=createHash('sha256').update(bytes).digest('hex');
  assert.throws(()=>buildGenerationStagingPackageV1({manifest:m,read:()=>bytes}),/TRANSACTION_SHAPE/);
});
