import assert from 'node:assert/strict';
import test from 'node:test';
import fs from 'node:fs';
import {createHash} from 'node:crypto';
const base=new URL('../../docs/premium/retained-sources/olive-oil-review-20261031/',import.meta.url);
const candidate=JSON.parse(fs.readFileSync(new URL('source-candidate-v1.json',base),'utf8'));
test('retained official source facts match capture bytes and record/page locator',()=>{
  const bytes=fs.readFileSync(new URL(candidate.source.capturePath,base));
  assert.equal(createHash('sha256').update(bytes).digest('hex'),candidate.source.captureSha256);
  assert.match(bytes.toString(),/NDB 04053/);assert.match(bytes.toString(),/PDF page 302/);
  assert.equal(candidate.source.record,'NDB04053');assert.equal(candidate.source.pdfPageOneBased,302);
  assert.deepEqual(candidate.source.facts,{calories:'884',protein:'0.00',fat:'100.00',totalCarbohydrate:'0.00',fiber:'0.0'});
});
test('source quantity distribution reconciles without changing grams or converting units',()=>{
  assert.deepEqual(candidate.sourceQuantities.distribution,[{grams:5,rows:23},{grams:10,rows:45},{grams:15,rows:2},{grams:20,rows:1}]);
  assert.equal(candidate.sourceQuantities.distribution.reduce((n: number,r: {rows:number})=>n+r.rows,0),candidate.ingredientRows);
  assert.equal(candidate.ingredientRows,71);assert.equal(candidate.affectedRecipes,71);
  assert.equal(candidate.sourceQuantities.unit,'G');assert.equal(candidate.sourceQuantities.amountEqualsWeightG,true);
  assert.equal(candidate.sourceQuantities.unitConversionPerformed,false);
});
test('input contributions keep source energy instead of replacing it by 9 kcal per gram fat',()=>{
  for(const row of candidate.candidateInputContributions){
    assert.equal(Math.round(Number(row.calories)*1000),row.grams*8840);
    assert.equal(Number(row.fat),row.grams);
    for(const field of ['protein','carbs','fiber'])assert.equal(Number(row[field]),0);
    assert.notEqual(Number(row.calories),row.grams*9);
  }
});
test('preparation remains non-authoritative and leaves cooking and publication unresolved',()=>{
  assert.equal(candidate.status,'SOURCE_CANDIDATE_NOT_APPROVED');assert.equal(candidate.runtimePublishable,false);
  assert.equal(candidate.canonicalFoodId,null);assert.equal(candidate.reviewReceipt,null);
  assert.equal(candidate.sourceWorkbookModified,false);assert.equal(candidate.databaseModified,false);
  assert.equal(candidate.workbookFdcIdClaim.independentlyVerified,false);
  assert.equal(candidate.stagingExactNameObservation.bindingEstablished,false);
  assert.equal(candidate.stagingExactNameObservation.completeFiveNutrientCandidates,0);
  assert.ok(candidate.limitations.includes('COOKING_OIL_RETENTION_NOT_MEASURED'));
  assert.ok(candidate.limitations.includes('RECIPE_PORTIONS_AND_YIELD_NOT_ESTABLISHED'));
});
