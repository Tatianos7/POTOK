import assert from 'node:assert/strict';
import test from 'node:test';
import {readFileSync} from 'node:fs';
import {createHash} from 'node:crypto';
import {decodeReviewedRuntimeRecipePublicationEvidenceRawV1} from '../../src/utils/reviewedRuntimeRecipePublicationEvidenceV1';
const root=new URL('../../',import.meta.url),base=new URL('docs/premium/retained-sources/produce-review-20261104/',root);
const raw=readFileSync(new URL('source-candidates-v1.json',base),'utf8'),p=JSON.parse(raw);
const digest=(b:Buffer)=>createHash('sha256').update(b).digest('hex');
const milli=(s:string)=>{assert.match(s,/^\d+(?:\.\d{1,3})?$/);const [n,f='']=s.split('.');return BigInt(n)*1000n+BigInt(f.padEnd(3,'0'));};
type Row={ingredientRowId:string;recipeId:string;recordedAmount:number;unit:string;recordedWeightG:number;canonicalStatus:string;stableFoodId:null;sourceApplicabilityStatus:string};
test('source capture bytes, locators and parent nutrient mapping remain pinned',()=>{
  assert.deepEqual(p.groups.map((g:{source:{record:string;pdfPageOneBased:number}})=>[g.source.record,g.source.pdfPageOneBased]),
    [['NDB09040',147],['NDB11260',1046],['NDB11477',1876],['NDB11205',713],['NDB11529',2142],['NDB11080',226],['NDB02045',6]]);
  for(const g of p.groups){const s=g.source,capture=readFileSync(new URL(s.capturePath,base));
    assert.equal(digest(capture),s.captureSha256);assert.ok(capture.toString().includes('NDB '+s.record.slice(3)));
    assert.ok(capture.toString().includes('PDF page '+s.pdfPageOneBased));assert.ok(capture.toString().includes(s.upstreamSha256));
    assert.match(s.url,/^https:\/\/www\.ars\.usda\.gov\//);}
  for(const [path,hash] of [[p.mapping.parentPackagePath,p.mapping.parentPackageSha256],[p.mapping.semanticsCapturePath,p.mapping.semanticsCaptureSha256]])
    assert.equal(digest(readFileSync(new URL(path,root))),hash);
});
test('edible quantities and skin ambiguity survive grouping without food resolution or refuse deduction',()=>{
  const rows:Row[]=p.groups.flatMap((g:{rows:Row[]})=>g.rows);
  assert.equal(rows.length,11);assert.equal(p.ingredientRows,11);assert.equal(new Set(rows.map(r=>r.ingredientRowId)).size,11);
  assert.equal(new Set(rows.map(r=>r.recipeId)).size,10);assert.equal(p.affectedRecipeUnion,10);
  for(const g of p.groups){assert.equal(g.rows.length,g.ingredientRows);assert.equal(new Set(g.rows.map((r:Row)=>r.recipeId)).size,g.affectedRecipes);
    assert.equal(g.quantityConversionsPerformed,false);assert.equal(g.recipeNutritionRecomputed,false);
    assert.equal(g.canonicalFoodId,null);assert.equal(g.reviewReceipt,null);assert.equal(g.runtimePublishable,false);
    assert.equal(g.workbookFdcIdsIndependentlyVerified,false);
    for(const r of g.rows){assert.equal(r.unit,'G');assert.equal(r.recordedAmount,r.recordedWeightG);assert.ok(r.recordedWeightG>0);
      assert.equal(r.canonicalStatus,'UNRESOLVED');assert.equal(r.stableFoodId,null);}}
  const held=rows.filter(r=>r.sourceApplicabilityStatus.startsWith('BLOCKED_'));
  assert.deepEqual(held.map(r=>r.ingredientRowId),['wholegrain_toast_hummus_cucumber_ing_03']);
  const specified=rows.find(r=>r.ingredientRowId==='tvorog_cucumber_dill_ing_02')!;
  assert.equal(specified.sourceApplicabilityStatus,'TEXTUAL_REFERENCE_MATCH_REVIEW_REQUIRED');
});
test('fiber is subtracted once, adjusted protein stays separate and preparation cannot enter publication decoder',async()=>{
  for(const g of p.groups){const f=g.source.factsPer100GEdible;
    assert.equal(milli(g.candidateAvailableCarbsPer100G),milli(f.totalCarbohydrate)-milli(f.fiber));}
  const mushrooms=p.groups.find((g:{source:{record:string}})=>g.source.record==='NDB11260').source;
  assert.equal(mushrooms.factsPer100GEdible.protein,'3.09');assert.equal(mushrooms.additionalSourceAdjustedProteinG,'2.18');
  assert.equal(mushrooms.proteinColumnUsed,'PROTEIN_N_X_6_25');assert.equal(mushrooms.adjustedProteinSubstituted,false);
  assert.equal(p.mapping.foodSpecificApproval,false);assert.equal(p.mapping.energy,'KEEP_SOURCE_ENERGY');
  assert.equal(p.physicalCookingBlocksDevelopment,false);assert.equal(p.measuredFinishedYieldG,null);
  for(const k of ['sourceWorkbookModified','databaseModified','runtimePublishable','generatorActivated'])assert.equal(p[k],false);
  await assert.rejects(decodeReviewedRuntimeRecipePublicationEvidenceRawV1(raw,raw),/REVIEWED_PUBLICATION_FIELDS_INVALID/);
});
