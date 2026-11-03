import assert from 'node:assert/strict';
import test from 'node:test';
import fs from 'node:fs';
import {createHash} from 'node:crypto';
const root=new URL('../../',import.meta.url);
const base=new URL('docs/premium/retained-sources/onion-carrot-review-20261103/',root);
const p=JSON.parse(fs.readFileSync(new URL('source-candidates-v1.json',base),'utf8'));
const digest=(bytes:Buffer)=>createHash('sha256').update(bytes).digest('hex');
type SourceRow={ingredientRowId:string;recipeId:string;recordedAmount:number;unit:string;recordedWeightG:number;explicitRawEdibleWeight:boolean;quantityVerificationRequired:boolean;canonicalStatus:string;stableFoodId:null};
test('source record captures and existing carbohydrate semantics retain exact bytes',()=>{
  for(const group of p.groups){
    const bytes=fs.readFileSync(new URL(group.source.capturePath,base));
    assert.equal(digest(bytes),group.source.captureSha256);
    assert.ok(bytes.toString().includes(group.source.record.replace('NDB','NDB ')));
    assert.ok(bytes.toString().includes('PDF page '+group.source.pdfPageOneBased));
    assert.equal(group.source.upstreamSha256,'ecb7fc1f7c0613225fc381042454fe29e17a702ae96cfc3e51f5b756a7adb161');
  }
  assert.equal(digest(fs.readFileSync(new URL(p.mapping.parentPackagePath,root))),p.mapping.parentPackageSha256);
  assert.equal(digest(fs.readFileSync(new URL(p.mapping.semanticsCapturePath,root))),p.mapping.semanticsCaptureSha256);
});
test('row distributions reconcile and shared recipe overlap is counted once',()=>{
  const rows:SourceRow[]=p.groups.flatMap((g:{rows:SourceRow[]})=>g.rows);
  assert.equal(rows.length,61);assert.equal(new Set(rows.map(r=>r.ingredientRowId)).size,61);
  assert.equal(new Set(rows.map(r=>r.recipeId)).size,45);assert.equal(p.affectedRecipeUnion,45);
  for(const g of p.groups){
    assert.equal(g.rows.length,g.ingredientRows);
    assert.equal(new Set(g.rows.map((r:SourceRow)=>r.recipeId)).size,g.affectedRecipes);
    for(const d of g.recordedWeightDistribution)assert.equal(g.rows.filter((r:SourceRow)=>r.recordedWeightG===d.grams).length,d.rows);
    assert.equal(g.rows.filter((r:SourceRow)=>r.explicitRawEdibleWeight).length,g.explicitRawEdibleWeightRows);
    assert.equal(g.quantityConversionPerformed,false);
    for(const r of g.rows){assert.equal(r.canonicalStatus,'UNRESOLVED');assert.equal(r.stableFoodId,null);if(r.unit==='G')assert.equal(r.recordedAmount,r.recordedWeightG);}
  }
});
test('total carbohydrate is distinguished from available and approximate carrot stays unmeasured',()=>{
  const [onion,carrot]=p.groups;
  assert.equal(onion.source.record,'NDB11282');assert.equal(carrot.source.record,'NDB11124');
  assert.equal(onion.source.factsPer100GEdibleRaw.calories,'40');assert.equal(carrot.source.factsPer100GEdibleRaw.calories,'41');
  for(const g of p.groups){const facts=g.source.factsPer100GEdibleRaw;
    assert.equal(Math.round(Number(g.candidateAvailableCarbsPer100G)*1000),Math.round(Number(facts.totalCarbohydrate)*1000)-Math.round(Number(facts.fiber)*1000));
    assert.notEqual(Number(g.candidateAvailableCarbsPer100G),Number(facts.totalCarbohydrate));
  }
  const exception=carrot.rows.filter((r:SourceRow)=>r.quantityVerificationRequired);
  assert.equal(exception.length,1);assert.equal(exception[0].ingredientRowId,'carrot_ricotta_tart_ing_01');
  assert.equal(exception[0].explicitRawEdibleWeight,false);assert.equal(exception[0].unit,'PCS');
  assert.equal(p.quantityExceptions[0].sourceWeightIsApproximate,true);assert.equal(p.quantityExceptions[0].measuredEdibleWeightG,null);
  assert.equal(p.mapping.foodSpecificApproval,false);assert.equal(p.mapping.energy,'KEEP_SOURCE_ENERGY');
  for(const g of p.groups){assert.equal(g.canonicalFoodId,null);assert.equal(g.reviewReceipt,null);assert.equal(g.runtimePublishable,false);assert.equal(g.workbookFdcIdIndependentlyVerified,false);}
  assert.equal(p.runtimePublishable,false);assert.equal(p.generatorActivated,false);assert.equal(p.databaseModified,false);assert.equal(p.sourceWorkbookModified,false);
});
