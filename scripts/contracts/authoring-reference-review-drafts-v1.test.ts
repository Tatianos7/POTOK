import assert from 'node:assert/strict';
import test from 'node:test';
import {createHash} from 'node:crypto';
import {buildAuthoringReferenceReviewDraftsV1, referenceReviewRulesV1} from './authoring-reference-review-drafts-v1';
import {readPinnedProposalSourcesV1} from './authoring-reference-proposals-v1';
import {decodeReviewedRuntimeRecipePublicationEvidenceRawV1} from '../../src/utils/reviewedRuntimeRecipePublicationEvidenceV1';

const hash=(raw:string)=>createHash('sha256').update(raw).digest('hex');
const vector=(protein='0.7',carb='14.5')=>({calories:'57',protein,fat:'0.3',totalCarbohydrate:carb,fiber:'2.4'});
function fixture(caseId='BLUEBERRY',unit='G',ids=['09050']){
  const raw={ingredient_row_id:'synthetic_row',recipe_id:'synthetic_recipe',unit,weight_g:75,notes:'PRIVATE_NOTE_MUST_NOT_LEAK'};
  const ledger={contract:'potok-pilot-120-row-stage-review-v1',privatePilotPacketSha256:'a'.repeat(64),counts:{rows:1},rows:[{
    ingredientRowId:raw.ingredient_row_id,recipeId:raw.recipe_id,sourceAuthoringRowSha256:hash(JSON.stringify(raw,Object.keys(raw).sort())),reviewOrigin:'THIS_STAGE_REVIEW'}],runtimePublishable:false,mayActivate:false};
  const capture={contract:'potok-sr28-ascii-source-capture-v1',records:ids.map(ndb=>({ndb,description:'Synthetic source',factsPer100GEdible:{...vector('0.74','14.49'),fat:'0.33'}})),runtimePublishable:false,mayActivate:false};
  const captureRaw=JSON.stringify(capture);
  const audit={contract:'potok-pilot-remaining-42-review-v1',privatePilotPacketSha256:ledger.privatePilotPacketSha256,asciiCaptureSha256:hash(captureRaw),reviewedRows:1,
    cases:[{caseId,rowIds:[raw.ingredient_row_id],sourceRecordIds:ids,status:'BLOCKED',requiredEvidence:'Exact primary class and source required'}],runtimePublishable:false,mayActivate:false};
  const sources={ledgerRaw:JSON.stringify(ledger),auditRaw:JSON.stringify(audit),captureRaw};
  const input={contract:'potok-authoring-reference-proposal-input-v1',privatePilotPacketSha256:ledger.privatePilotPacketSha256,
    ledgerSha256:hash(sources.ledgerRaw),auditSha256:hash(sources.auditRaw),captureSha256:hash(captureRaw),
    rows:[{rawAuthoringRow:raw,reference:vector(),referenceStatus:'MANUAL_UNVERIFIED_TRANSCRIPTION'}]};
  return {input,sources};
}
const build=(f:ReturnType<typeof fixture>)=>buildAuthoringReferenceReviewDraftsV1(JSON.stringify(f.input),f.sources);

test('rules cover every pinned case exactly and candidates belong to the retained source set',()=>{
  const s=readPinnedProposalSourcesV1(),audit=JSON.parse(s.auditRaw),capture=JSON.parse(s.captureRaw);
  assert.deepEqual(Object.keys(referenceReviewRulesV1).sort(),audit.cases.map((c:{caseId:string})=>c.caseId).sort());
  assert.equal(audit.cases.length,25);
  assert.deepEqual(Object.entries(referenceReviewRulesV1).filter(([,r])=>r.candidate).map(([k])=>k).sort(),['BLUEBERRY','CINNAMON','FROZEN_STRAWBERRY','WALNUT']);
  for(const c of audit.cases){
    const r=referenceReviewRulesV1[c.caseId];assert.ok(r.reason.length>10&&r.evidence.length>0);
    assert.ok(Object.isFrozen(r)&&Object.isFrozen(r.evidence));
    if(r.candidate){assert.ok(c.sourceRecordIds.includes(r.candidate));assert.ok(capture.records.some((n:{ndb:string})=>n.ndb===r.candidate));}
  }
});
test('candidate draft lists exact non-carbohydrate field differences, retains source hashes and never selects/applies',()=>{
  const f=fixture(),before=JSON.stringify(f),p=build(f),r=p.recommendations[0];
  assert.deepEqual(r.proposedReferenceFields,{protein:{before:'0.7',proposed:'0.74'},fat:{before:'0.3',proposed:'0.33'}});
  assert.equal(r.recommendedOptionId,'COMPARE_SR28_09050');assert.equal(r.draftStatus,'NUMERIC_REFERENCE_DRAFT_REQUIRES_REVIEW');
  assert.equal(r.carbohydrateStatus,'DIFFERENCE_WITHHELD_SEMANTICS_UNREVIEWED');assert.equal(r.carbohydrateDelta,null);
  assert.equal(r.selectedOption,null);assert.equal(r.ownerDecision,null);assert.equal(r.sourceApproved,false);
  assert.equal(r.canApply,false);assert.equal(p.summary.numericDraftRows,1);assert.equal(p.summary.proposedFieldDifferences,2);
  assert.equal(p.summary.selectedChanges,0);assert.equal(p.summary.appliedChanges,0);assert.equal(p.summary.sourceApprovals,0);
  assert.equal(r.sourceAuthoringRowSha256.length,64);assert.equal(p.provenance.sourceProposalSha256.length,64);
  assert.equal(p.canApply,false);assert.equal(p.recipeTotalsRecomputed,false);assert.equal(p.originalDataModified,false);
  assert.equal(p.physicalCookingBlocksDevelopment,false);assert.equal(p.recipeImpacts[0].referenceRecipeTotalsRetained,true);
  assert.equal(JSON.stringify(f),before);assert.deepEqual(build(f),p);
  assert.ok(!JSON.stringify(p).includes('PRIVATE_NOTE_MUST_NOT_LEAK'));assert.ok(!JSON.stringify(p).includes('rawAuthoringRow'));
});
test('cinnamon carbohydrate-only difference and decimal spelling do not create fake editable changes',()=>{
  const f=fixture('CINNAMON','G',['02010']);f.input.rows[0].reference={...vector('0.740','14.5'),fat:'0.330'};
  const p=build(f),r=p.recommendations[0];assert.deepEqual(r.proposedReferenceFields,{});
  assert.equal(r.draftStatus,'NO_EDITABLE_NUMERIC_CHANGE');assert.equal(r.carbohydrateStatus,'DIFFERENCE_WITHHELD_SEMANTICS_UNREVIEWED');
  assert.equal(p.summary.numericDraftRows,0);
});
test('ML, pieces and missing source fiber cannot acquire numeric drafts even when a candidate exists',()=>{
  for(const unit of ['ML','PCS','PIECE']){
    const r=build(fixture('BLUEBERRY',unit)).recommendations[0];assert.deepEqual(r.proposedReferenceFields,{});
    assert.equal(r.draftStatus,'CANDIDATE_QUANTITY_OR_NUTRIENT_BLOCKED');assert.equal(r.quantity.quantityChanged,false);
    assert.equal(r.quantity.recordedGramsReference,75);
  }
  const f=fixture(),capture=JSON.parse(f.sources.captureRaw);capture.records[0].factsPer100GEdible.fiber=null;
  f.sources.captureRaw=JSON.stringify(capture);f.input.captureSha256=hash(f.sources.captureRaw);
  const audit=JSON.parse(f.sources.auditRaw);audit.asciiCaptureSha256=f.input.captureSha256;
  f.sources.auditRaw=JSON.stringify(audit);f.input.auditSha256=hash(f.sources.auditRaw);
  const r=build(f).recommendations[0];assert.equal(r.candidateReference?.fiber,null);assert.deepEqual(r.proposedReferenceFields,{});
  assert.equal(r.draftStatus,'CANDIDATE_QUANTITY_OR_NUTRIENT_BLOCKED');
});
test('milk, source version, processing, discrete mass and generic tvorog decisions remain retained and blocked',()=>{
  for(const id of ['DAIRY_MILK','DAIRY_NATURAL_YOGURT','DAIRY_GREEK_YOGURT','DAIRY_TVOROG','OATS','FRESH_STRAWBERRY','POLLOCK','EGG','BUTTER','COCOA','HUMMUS']){
    const r=build(fixture(id,id==='DAIRY_MILK'?'ML':'G',[])).recommendations[0];
    assert.equal(r.recommendation,'RETAIN_REFERENCE_PENDING_EVIDENCE');assert.equal(r.candidateReference,null);
    assert.deepEqual(r.proposedReferenceFields,{});assert.equal(r.existingBlockStatus,'BLOCKED');assert.equal(r.runtimePublishable,false);
  }
  assert.match(referenceReviewRulesV1.DAIRY_TVOROG.reason,/NO-GO/);
});
test('unknown cases, missing candidate, stale digests, modified grams and approval-shaped inputs fail closed',()=>{
  assert.throws(()=>build(fixture('UNKNOWN')),/UNKNOWN_REFERENCE_REVIEW_CASE/);
  assert.throws(()=>build(fixture('FROZEN_STRAWBERRY','G',['09316'])),/REFERENCE_REVIEW_CANDIDATE_INVALID/);
  for(const change of [(f:ReturnType<typeof fixture>)=>{f.input.rows[0].rawAuthoringRow.weight_g=999;},
    (f:ReturnType<typeof fixture>)=>{f.input.auditSha256='b'.repeat(64);},
    (f:ReturnType<typeof fixture>)=>{Object.assign(f.input,{selectedOption:'COMPARE_SR28_09050'});}]){
    const f=fixture();change(f);assert.throws(()=>build(f),/INVALID_AUTHORING_REFERENCE_PROPOSAL_INPUT/);
  }
  const f=fixture();assert.throws(()=>buildAuthoringReferenceReviewDraftsV1('{"contract":1,"contract":2}',f.sources));
});
test('normal and forged approval draft exports remain outside the real trusted publication boundary',async()=>{
  const p=build(fixture());for(const c of [p,{...p,canApply:true,sourceApproved:true,runtimePublishable:true,mayActivate:true}]){
    const raw=JSON.stringify(c);await assert.rejects(decodeReviewedRuntimeRecipePublicationEvidenceRawV1(raw,raw),/REVIEWED_PUBLICATION_FIELDS_INVALID/);
  }
});
