import assert from 'node:assert/strict';
import test from 'node:test';
import {readFileSync} from 'node:fs';
import {createHash} from 'node:crypto';
import {decodeReviewedRuntimeRecipePublicationEvidenceRawV1} from '../../src/utils/reviewedRuntimeRecipePublicationEvidenceV1';
const root=new URL('../../',import.meta.url),base=new URL('docs/premium/retained-sources/grain-review-20261104/',root);
const raw=readFileSync(new URL('source-candidates-v1.json',base),'utf8'),p=JSON.parse(raw);
const triageRaw=readFileSync(new URL('remaining-row-review-v1.json',base),'utf8'),t=JSON.parse(triageRaw);
const digest=(b:Buffer)=>createHash('sha256').update(b).digest('hex');
const milli=(s:string)=>{assert.match(s,/^\d+(?:\.\d{1,3})?$/);const [n,f='']=s.split('.');return BigInt(n)*1000n+BigInt(f.padEnd(3,'0'));};
type Row={ingredientRowId:string;recipeId:string;recordedAmount:number;unit:string;recordedWeightG:number;canonicalStatus:string;stableFoodId:null;route:string;runtimePublishable:boolean;reviewReceipt:null;existingCapturePath?:string;existingCaptureSha256?:string;pendingChecks:string[]};
test('grain facts, comparison record and inherited carbohydrate semantics retain pinned source bytes',()=>{
  assert.deepEqual(p.groups.map((g:{source:{record:string;pdfPageOneBased:number}})=>[g.source.record,g.source.pdfPageOneBased]),
    [['NDB20005',21],['NDB20011',27],['NDB20012',39],['NDB20124',253],['NDB20044',328],['NDB20052',355],['NDB20120',198]]);
  for(const s of [...p.groups.map((g:{source:unknown})=>g.source),p.comparisonOnly.source]){
    const b=readFileSync(new URL(s.capturePath,base));assert.equal(digest(b),s.captureSha256);
    assert.ok(b.toString().includes('NDB '+s.record.slice(3)));assert.ok(b.toString().includes('PDF page '+s.pdfPageOneBased));
    assert.equal(s.upstreamSha256,'3b71f757854a58af57256864f144e4215a2f56da52fdc90bbd57360bfc234b05');
  }
  for(const [path,hash] of [[p.mapping.parentPackagePath,p.mapping.parentPackageSha256],[p.mapping.semanticsCapturePath,p.mapping.semanticsCaptureSha256]])
    assert.equal(digest(readFileSync(new URL(path,root))),hash);
});
test('short-grain unenriched fiber remains absent despite otherwise equal enriched source numbers',()=>{
  for(const g of p.groups){const f=g.source.factsPer100GEdible;
    assert.equal(milli(g.candidateAvailableCarbsPer100G),milli(f.totalCarbohydrate)-milli(f.fiber));}
  const enriched=p.groups.find((g:{source:{record:string}})=>g.source.record==='NDB20052');
  assert.equal(enriched.source.factsPer100GEdible.fiber,'2.8');
  const f=p.comparisonOnly.source.factsPer100GEdible;
  for(const key of ['calories','protein','fat','totalCarbohydrate'])assert.equal(f[key],enriched.source.factsPer100GEdible[key]);
  assert.equal(f.fiber,null);assert.equal(p.comparisonOnly.candidateAvailableCarbsPer100G,null);
  assert.equal(p.comparisonOnly.usedForBinding,false);assert.equal(p.comparisonOnly.fiberBorrowedFromEnriched,false);
  assert.equal(enriched.rows[0].sourceApplicabilityStatus,'BLOCKED_ENRICHMENT_CLASS_AND_FIBER_SOURCE_UNSPECIFIED');
});
test('all 56 remaining rows reconcile once; new facts and reused locators do not count as approved identities',()=>{
  const rows:Row[]=t.rows;assert.equal(rows.length,56);assert.equal(new Set(rows.map(r=>r.ingredientRowId)).size,56);
  for(const [route,n] of Object.entries(t.routeCounts))assert.equal(rows.filter(r=>r.route===route).length,n);
  assert.deepEqual(t.routeCounts,{NEW_GRAIN_SOURCE_CANDIDATE:7,EXISTING_SOURCE_LOCATOR_REVIEW_REQUIRED:7,SOURCE_PREPARATION_OUTSTANDING:42});
  assert.equal(t.baselinePriorPreparationReach+56,120);assert.equal(t.preparationReachIncludingNewAndReusedLocators,78);
  assert.equal(t.reachIsNotApprovalOrIdentity,true);assert.equal(t.allOriginalCanonicalBindingsStillUnresolved,120);
  assert.deepEqual(rows.filter(r=>r.route==='NEW_GRAIN_SOURCE_CANDIDATE').map(r=>r.ingredientRowId).sort(),
    p.groups.flatMap((g:{rows:Row[]})=>g.rows.map(r=>r.ingredientRowId)).sort());
  for(const r of rows){assert.equal(r.canonicalStatus,'UNRESOLVED');assert.equal(r.stableFoodId,null);assert.equal(r.runtimePublishable,false);assert.equal(r.reviewReceipt,null);
    if(r.existingCapturePath)assert.equal(digest(readFileSync(new URL(r.existingCapturePath,root))),r.existingCaptureSha256);}
  assert.equal(rows.filter(r=>r.pendingChecks.includes('DAIRY_CLASS_OR_PRODUCT_NUTRITION_MAPPING_REQUIRED')).length,15);
  assert.equal(rows.filter(r=>r.pendingChecks.includes('REVIEWED_LIQUID_VOLUME_TO_MASS_BASIS_REQUIRED')).length,4);
  for(const g of p.groups){assert.equal(g.runtimePublishable,false);assert.equal(g.reviewReceipt,null);assert.equal(g.canonicalFoodId,null);assert.equal(g.workbookFdcIdIndependentlyVerified,false);
    for(const r of g.rows){assert.equal(r.unit,'G');assert.equal(r.recordedAmount,r.recordedWeightG);}}
});
test('source preparation and triage cannot enter the actual reviewed publication boundary',async()=>{
  for(const input of [raw,triageRaw])await assert.rejects(decodeReviewedRuntimeRecipePublicationEvidenceRawV1(input,input),/REVIEWED_PUBLICATION_FIELDS_INVALID/);
  assert.equal(p.mapping.foodSpecificApproval,false);assert.equal(p.mapping.energy,'KEEP_SOURCE_ENERGY');
  for(const k of ['runtimePublishable','mayActivate','databaseModified','sourceWorkbookModified','quantityConversionsPerformed','recipeNutritionRecomputed'])assert.equal(p[k],false);
  assert.equal(p.physicalCookingBlocksDevelopment,false);assert.equal(t.physicalCookingBlocksDevelopment,false);
});
