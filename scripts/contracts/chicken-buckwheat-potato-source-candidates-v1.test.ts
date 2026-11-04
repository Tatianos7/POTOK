import assert from 'node:assert/strict';
import test from 'node:test';
import {readFileSync} from 'node:fs';
import {createHash} from 'node:crypto';
const root=new URL('../../',import.meta.url);
const base=new URL('docs/premium/retained-sources/chicken-buckwheat-potato-review-20261104/',root);
const p=JSON.parse(readFileSync(new URL('source-candidates-v1.json',base),'utf8'));
const digest=(b:Buffer)=>createHash('sha256').update(b).digest('hex');
const milli=(v:string)=>{assert.match(v,/^\d+(?:\.\d{1,3})?$/);const [n,f='']=v.split('.');return BigInt(n)*1000n+BigInt(f.padEnd(3,'0'));};
type Row={ingredientRowId:string;recipeId:string;recordedAmount:number;unit:string;recordedWeightG:number;canonicalStatus:string;stableFoodId:null;sourceApplicabilityStatus:string};
test('primary source captures and parent carbohydrate mapping retain pinned bytes and exact records',()=>{
  const sources=[...p.groups.map((g:{source:unknown})=>g.source),p.stateComparisonOnly.source];
  for(const s of sources){
    const capture=readFileSync(new URL(s.capturePath,base));assert.equal(digest(capture),s.captureSha256);
    assert.ok(capture.toString().includes('NDB '+s.record.slice(3)));assert.ok(capture.toString().includes('PDF page '+s.pdfPageOneBased));
    assert.ok(capture.toString().includes(s.upstreamSha256));assert.match(s.url,/^https:\/\/www\.ars\.usda\.gov\//);
  }
  assert.equal(digest(readFileSync(new URL(p.mapping.parentPackagePath,root))),p.mapping.parentPackageSha256);
  assert.equal(digest(readFileSync(new URL(p.mapping.semanticsCapturePath,root))),p.mapping.semanticsCaptureSha256);
  assert.deepEqual(p.groups.map((g:{source:{record:string;pdfPageOneBased:number}})=>[g.source.record,g.source.pdfPageOneBased]),[['NDB05062',22],['NDB20008',24],['NDB11352',1473]]);
});
test('selected row coverage preserves raw grams and state ambiguity without issuing canonical bindings',()=>{
  const rows:Row[]=p.groups.flatMap((g:{rows:Row[]})=>g.rows);
  assert.equal(rows.length,p.ingredientRows);assert.equal(rows.length,9);assert.equal(new Set(rows.map(r=>r.ingredientRowId)).size,9);
  assert.equal(new Set(rows.map(r=>r.recipeId)).size,p.affectedRecipeUnion);assert.equal(p.affectedRecipeUnion,8);
  for(const g of p.groups){
    assert.equal(g.rows.length,g.ingredientRows);assert.equal(new Set(g.rows.map((r:Row)=>r.recipeId)).size,g.affectedRecipes);
    assert.equal(g.quantityConversionsPerformed,false);assert.equal(g.recipeNutritionRecomputed,false);
    assert.equal(g.canonicalFoodId,null);assert.equal(g.reviewReceipt,null);assert.equal(g.runtimePublishable,false);
    assert.equal(g.workbookFdcIdIndependentlyVerified,false);
    for(const r of g.rows){assert.equal(r.unit,'G');assert.equal(r.recordedAmount,r.recordedWeightG);assert.ok(r.recordedWeightG>0);
      assert.equal(r.canonicalStatus,'UNRESOLVED');assert.equal(r.stableFoodId,null);}
  }
  assert.ok(p.groups[0].rows.every((r:Row)=>r.sourceApplicabilityStatus==='TEXTUAL_RAW_BONELESS_SKINLESS_MATCH_REVIEW_REQUIRED'));
  assert.ok(p.groups[1].rows.every((r:Row)=>r.sourceApplicabilityStatus==='BLOCKED_BUCKWHEAT_FORM_AND_ROASTING_STATE_UNSPECIFIED'));
  assert.ok(p.groups[2].rows.every((r:Row)=>r.sourceApplicabilityStatus==='BLOCKED_POTATO_SKIN_STATUS_UNSPECIFIED'));
});
test('carbohydrate candidates subtract fiber once and never replace recipes or switch buckwheat state',()=>{
  const facts=[...p.groups,p.stateComparisonOnly];
  for(const g of facts){const f=g.source.factsPer100GEdible;
    assert.equal(milli(g.candidateAvailableCarbsPer100G),milli(f.totalCarbohydrate)-milli(f.fiber));}
  assert.equal(p.groups[0].source.factsPer100GEdible.calories,'120');
  assert.equal(p.groups[1].source.factsPer100GEdible.calories,'343');
  assert.equal(p.stateComparisonOnly.source.record,'NDB20009');assert.equal(p.stateComparisonOnly.source.factsPer100GEdible.calories,'346');
  assert.equal(p.stateComparisonOnly.usedForBindings,false);assert.equal(p.stateComparisonOnly.usedForRecipeRecalculation,false);
  assert.equal(p.mapping.foodSpecificApproval,false);assert.equal(p.mapping.energy,'KEEP_SOURCE_ENERGY');
  assert.equal(p.physicalCookingBlocksDevelopment,false);assert.equal(p.measuredFinishedYieldG,null);
  for(const key of ['sourceWorkbookModified','databaseModified','runtimePublishable','generatorActivated'])assert.equal(p[key],false);
});
