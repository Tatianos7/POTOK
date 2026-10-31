import assert from 'node:assert/strict';
import test from 'node:test';
import fs from 'node:fs';
import {createHash} from 'node:crypto';
const root=new URL('../../',import.meta.url);
const c=JSON.parse(fs.readFileSync(new URL('docs/premium/retained-sources/salt-water-review-20261031/source-candidates-v1.json',root),'utf8'));
const [salt,water]=c.groups;
const hash=(path: string)=>createHash('sha256').update(fs.readFileSync(new URL(path,root))).digest('hex');
test('source observations retain byte-bound salt and existing water captures',()=>{
  for(const group of c.groups){assert.equal(hash(group.source.retainedPath),group.source.captureSha256);
    assert.deepEqual(group.source.facts,{calories:'0',protein:'0.00',fat:'0.00',totalCarbohydrate:'0.00',fiber:'0.0'});}
  assert.equal(salt.source.record,'NDB02047');assert.equal(salt.source.pdfPageOneBased,22);
  assert.match(fs.readFileSync(new URL(salt.source.retainedPath,root),'utf8'),/Energy kcal: 0/);
  assert.equal(water.source.record,'NDB14411');assert.equal(water.source.pdfPageOneBased,752);
  assert.equal(water.source.captureSha256,'5a3e857547b56df38ffebf1d0ce882a7eea8b8111bdb4d07b7422c8d79922b26');
  assert.equal(hash(water.source.parentPackagePath),water.source.parentPackageSha256);
});
test('salt observations reconcile optional and required unknown quantities without inferring zero mass',()=>{
  assert.equal(salt.ingredientRows,71);assert.equal(salt.affectedRecipes,70);
  assert.equal(salt.recordedPositiveGramRows,45);assert.equal(salt.missingGramRows,26);
  assert.equal(salt.missingGramsOptionalRows,14);assert.equal(salt.missingGramsRequiredRows,12);
  assert.deepEqual(salt.recordedGramDistribution,[{grams:1,rows:1},{grams:2,rows:31},{grams:3,rows:13}]);
  assert.ok(salt.remainingReview.includes('UNKNOWN_SALT_GRAMS_NOT_ZERO'));
  assert.ok(salt.remainingReview.includes('OPTIONAL_DOES_NOT_AUTHORIZE_OMISSION'));
});
test('water volumes and recorded grams remain separate from conversion and finished yield',()=>{
  assert.equal(water.ingredientRows,64);assert.equal(water.affectedRecipes,62);
  assert.equal(water.unitCounts.ML,64);assert.equal(water.recordedPositiveGramRows,51);assert.equal(water.missingGramRows,13);
  assert.equal(water.sourceRecordedGramsEqualMlOnKnownRows,true);assert.equal(water.quantityConversionsPerformed,false);
  assert.equal(water.physicalRetainedYieldG,null);
  assert.ok(water.remainingReview.includes('RECORDED_ML_EQUALS_G_IS_NOT_DENSITY_APPROVAL'));
  assert.ok(water.remainingReview.includes('DRAINED_OR_EVAPORATED_INPUT_IS_NOT_FINISHED_YIELD'));
});
test('no source observation, numeric zero or optional flag creates runtime authority',()=>{
  for(const group of c.groups){
    assert.equal(group.allBindingsUnresolved,true);assert.equal(group.stableIdCount,0);
    assert.equal(group.reviewReceipt,null);assert.equal(group.runtimePublishable,false);
    assert.equal(group.recordedPositiveGramRows+group.missingGramRows,group.ingredientRows);
    assert.equal(group.recordedGramDistribution.reduce((sum: number,row: {rows:number})=>sum+row.rows,0),group.recordedPositiveGramRows);
  }
  assert.equal(c.sourceWorkbookModified,false);assert.equal(c.databaseModified,false);assert.equal(c.generatorActivated,false);
});
