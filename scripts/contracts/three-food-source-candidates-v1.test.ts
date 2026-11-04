import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import test from 'node:test';
import {deriveAvailableCarbohydrateCandidateV1,readPrimaryRecheckRawV1,validateThreeFoodPrimaryRecheckV1,buildThreeFoodSourceCandidatesV1} from './three-food-source-candidates-v1';
import {readPinnedProposalSourcesV1} from './authoring-reference-proposals-v1';
import {decodeReviewedRuntimeRecipePublicationEvidenceRawV1} from '../../src/utils/reviewedRuntimeRecipePublicationEvidenceV1';

const hash=(s:string)=>createHash('sha256').update(s).digest('hex');
const mapping=()=>({sourceTotalCarbohydrateG:'9.13' as string|null,sourceDietaryFiberG:'2.1' as string|null,
  sourceDefinition:'TOTAL_CARBOHYDRATE_BY_DIFFERENCE_INCLUDING_FIBER',carbohydrateBinding:'09318:frozen:edible',fiberBinding:'09318:frozen:edible',carbohydrateUnit:'g',fiberUnit:'g',basis:'PER_100_G_EDIBLE'});
const map=(v:ReturnType<typeof mapping>)=>deriveAvailableCarbohydrateCandidateV1(JSON.stringify(v));
function fixture(){
  const captureRaw=readPinnedProposalSourcesV1().captureRaw,capture=JSON.parse(captureRaw);
  const cases=[['FROZEN_STRAWBERRY','09318'],['WALNUT','12155'],['BLUEBERRY','09050']];
  const rows=cases.map(([caseId,ndb],i)=>({caseId,ndb,raw:{ingredient_row_id:'synthetic_row_'+i,recipe_id:'synthetic_recipe_'+i,unit:'G',weight_g:50,notes:'PRIVATE_NOTE_NOT_FOR_EXPORT'}}));
  const ledger={contract:'potok-pilot-120-row-stage-review-v1',privatePilotPacketSha256:'a'.repeat(64),counts:{rows:3},rows:rows.map(r=>({ingredientRowId:r.raw.ingredient_row_id,recipeId:r.raw.recipe_id,sourceAuthoringRowSha256:hash(JSON.stringify(r.raw,Object.keys(r.raw).sort())),reviewOrigin:'THIS_STAGE_REVIEW'})),runtimePublishable:false,mayActivate:false};
  const audit={contract:'potok-pilot-remaining-42-review-v1',privatePilotPacketSha256:ledger.privatePilotPacketSha256,asciiCaptureSha256:hash(captureRaw),reviewedRows:3,
    cases:rows.map(r=>({caseId:r.caseId,rowIds:[r.raw.ingredient_row_id],sourceRecordIds:[r.ndb],status:'BLOCKED',requiredEvidence:'Exact food class and original reference required'})),runtimePublishable:false,mayActivate:false};
  const sources={ledgerRaw:JSON.stringify(ledger),auditRaw:JSON.stringify(audit),captureRaw};
  const input={contract:'potok-authoring-reference-proposal-input-v1',privatePilotPacketSha256:ledger.privatePilotPacketSha256,ledgerSha256:hash(sources.ledgerRaw),auditSha256:hash(sources.auditRaw),captureSha256:hash(captureRaw),
    rows:rows.map(r=>({rawAuthoringRow:r.raw,reference:{...capture.records.find((c:{ndb:string})=>c.ndb===r.ndb).factsPer100GEdible,calories:'999',totalCarbohydrate:'99'},referenceStatus:'MANUAL_UNVERIFIED_TRANSCRIPTION'}))};
  return {input,sources,primary:readPrimaryRecheckRawV1()};
}
const build=(f:ReturnType<typeof fixture>)=>buildThreeFoodSourceCandidatesV1(JSON.stringify(f.input),f.sources,f.primary);

test('primary recheck retains three exact SR28 records, separate FDC corroboration and unapproved status',()=>{
  const r=validateThreeFoodPrimaryRecheckV1(readPrimaryRecheckRawV1(),readPinnedProposalSourcesV1().captureRaw);
  assert.equal(r.records.size,3);assert.equal(r.records.get('WALNUT')?.apiCorroboration,170187);
  assert.equal(r.records.get('BLUEBERRY')?.apiCorroboration,171711);assert.equal(r.records.get('FROZEN_STRAWBERRY')?.apiCorroboration,null);
  assert.equal(r.records.get('FROZEN_STRAWBERRY')?.facts.calories,'35');assert.equal(r.records.get('WALNUT')?.facts.protein,'15.23');
  const raw=readPrimaryRecheckRawV1();assert.ok(!raw.walnutApiRaw.includes('api_key'));assert.ok(!raw.blueberryApiRaw.includes('api_key'));
});
test('available-carbohydrate candidates use exact subtraction, keep fiber separate and never approve mapping',()=>{
  for(const [total,fiber,expected] of [['9.13','2.1','7.030'],['13.71','6.7','7.010'],['14.49','2.4','12.090'],['2.100','2.1','0.000']]){
    const r=map({...mapping(),sourceTotalCarbohydrateG:total,sourceDietaryFiberG:fiber});
    assert.equal(r.availableCarbohydrateG,expected);assert.equal(r.canApply,false);assert.equal(r.sourceApproved,false);
  }
});
test('unknown semantics, unmatched identity/state/basis/units, absent fiber and invalid decimals reject instead of fallback',()=>{
  for(const change of [ {sourceDefinition:'UNKNOWN'}, {fiberBinding:'09318:drained:edible'}, {basis:'PER_100_ML'},
    {fiberUnit:'mg'}, {carbohydrateUnit:'mg'}, {sourceDietaryFiberG:null}, {sourceDietaryFiberG:'10'},
    {sourceTotalCarbohydrateG:'1e2'}, {sourceTotalCarbohydrateG:'-1'}, {sourceDietaryFiberG:'0.0001'}]){
    assert.throws(()=>map({...mapping(),...change}),/INVALID_THREE_FOOD_SOURCE_CANDIDATE/);
  }
  assert.throws(()=>deriveAvailableCarbohydrateCandidateV1(JSON.stringify({...mapping(),sourceApproved:true})));
  assert.throws(()=>deriveAvailableCarbohydrateCandidateV1('{"basis":1,"basis":2}'));
});
test('tampered API or summary bytes, stale capture, missing records and attempted source approval fail closed',()=>{
  const capture=readPinnedProposalSourcesV1().captureRaw;
  for(const change of [
    (p:ReturnType<typeof readPrimaryRecheckRawV1>)=>{p.walnutApiRaw+=' ';},
    (p:ReturnType<typeof readPrimaryRecheckRawV1>)=>{p.summaryRaw+=' ';},
    (p:ReturnType<typeof readPrimaryRecheckRawV1>)=>{const m=JSON.parse(p.manifestRaw);m.records.pop();p.manifestRaw=JSON.stringify(m);},
    (p:ReturnType<typeof readPrimaryRecheckRawV1>)=>{const m=JSON.parse(p.manifestRaw);m.sourceApproved=true;p.manifestRaw=JSON.stringify(m);},
    (p:ReturnType<typeof readPrimaryRecheckRawV1>)=>{const m=JSON.parse(p.manifestRaw);m.semanticsRecheck.sourceDefinition='UNKNOWN';p.manifestRaw=JSON.stringify(m);},
    (p:ReturnType<typeof readPrimaryRecheckRawV1>)=>{const m=JSON.parse(p.manifestRaw);m.records[0].ndb='09316';p.manifestRaw=JSON.stringify(m);},
  ]){const p=readPrimaryRecheckRawV1();change(p);assert.throws(()=>validateThreeFoodPrimaryRecheckV1(p,capture));}
  assert.throws(()=>validateThreeFoodPrimaryRecheckV1(readPrimaryRecheckRawV1(),capture+' '));
});
test('rehashing changed API nutrient, unit or identity cannot forge corroboration against pinned SR28 facts',()=>{
  for(const change of [(d:Record<string,unknown>)=>{d.fdcId=171711;},
    (d:Record<string,unknown>)=>{const a=d.foodNutrients as {nutrient:{number:string;unitName:string};amount:number}[];a.find(n=>n.nutrient.number==='291')!.amount=0;},
    (d:Record<string,unknown>)=>{const a=d.foodNutrients as {nutrient:{number:string;unitName:string};amount:number}[];a.find(n=>n.nutrient.number==='291')!.nutrient.unitName='mg';}]){
    const p=readPrimaryRecheckRawV1(),d=JSON.parse(p.walnutApiRaw);change(d);p.walnutApiRaw=JSON.stringify(d);
    const m=JSON.parse(p.manifestRaw);m.independentApiCaptures.find((a:{fdcId:number})=>a.fdcId===170187).sha256=hash(p.walnutApiRaw);p.manifestRaw=JSON.stringify(m);
    assert.throws(()=>validateThreeFoodPrimaryRecheckV1(p,readPinnedProposalSourcesV1().captureRaw));
  }
});
test('full candidates keep source calories and a coherent mapped vector; before available carbs and recipe totals stay unknown',()=>{
  const f=fixture(),before=JSON.stringify(f),p=build(f);
  assert.equal(p.summary.completeSourceCandidates,3);assert.deepEqual(p.candidates.map(c=>c.completeMappedCandidatePer100GEdible.carbs),['7.030','7.010','12.090']);
  assert.deepEqual(p.candidates.map(c=>c.completeMappedCandidatePer100GEdible.calories),['35','654','57']);
  for(const r of p.candidates){assert.equal(r.beforeReference.calories,'999');assert.equal(r.beforeAvailableCarbohydrateG,null);assert.equal(r.carbohydrateDelta,null);
    assert.equal(r.selectedOption,null);assert.equal(r.ownerDecision,null);assert.equal(r.foodSpecificMappingApproved,false);assert.equal(r.canApply,false);
    assert.equal(r.quantity.quantityChanged,false);assert.equal(r.existingBlockStatus,'BLOCKED');}
  assert.equal(p.recipeTotalsRecomputed,false);assert.equal(p.originalDataModified,false);assert.equal(p.summary.sourceApprovals,0);
  assert.equal(p.physicalCookingBlocksDevelopment,false);assert.equal(JSON.stringify(f),before);assert.deepEqual(build(f),p);
  assert.ok(!JSON.stringify(p).includes('PRIVATE_NOTE_NOT_FOR_EXPORT'));assert.ok(!JSON.stringify(p).includes('rawAuthoringRow'));
});
test('original input grams, coverage, source hashes and approval-shaped fields remain guarded by prior decoders',()=>{
  for(const change of [(f:ReturnType<typeof fixture>)=>{f.input.rows[0].rawAuthoringRow.weight_g=100;},
    (f:ReturnType<typeof fixture>)=>{f.input.rows.pop();},
    (f:ReturnType<typeof fixture>)=>{Object.assign(f.input,{sourceApproved:true});}]){
    const f=fixture();change(f);assert.throws(()=>build(f));
  }
});
test('normal and forged-approval complete source exports cannot pass the real runtime publication decoder',async()=>{
  const p=build(fixture());for(const c of [p,{...p,canApply:true,sourceApproved:true,runtimePublishable:true,mayActivate:true}]){
    const raw=JSON.stringify(c);await assert.rejects(decodeReviewedRuntimeRecipePublicationEvidenceRawV1(raw,raw),/REVIEWED_PUBLICATION_FIELDS_INVALID/);
  }
});
