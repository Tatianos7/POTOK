import assert from 'node:assert/strict';
import test from 'node:test';
import {createHash} from 'node:crypto';
import {buildAuthoringReferenceProposalsV1} from './authoring-reference-proposals-v1';
import {decodeReviewedRuntimeRecipePublicationEvidenceRawV1} from '../../src/utils/reviewedRuntimeRecipePublicationEvidenceV1';
const hash=(s:string)=>createHash('sha256').update(s).digest('hex');
const vec=(calories='35',fiber:string|null='2.1')=>({calories,protein:'0.43',fat:'0.11',totalCarbohydrate:'9.13',fiber});
function fixture(unit='G',caseId='FROZEN_STRAWBERRY',ids=['09318']){
  const rawRow={ingredient_row_id:'synthetic_row',recipe_id:'synthetic_recipe',unit,weight_g:50,notes:'PRIVATE_MARKER'};
  const rowSha=hash(JSON.stringify(rawRow,Object.keys(rawRow).sort()));
  const ledger={contract:'potok-pilot-120-row-stage-review-v1',privatePilotPacketSha256:'a'.repeat(64),counts:{rows:1},rows:[{ingredientRowId:'synthetic_row',recipeId:'synthetic_recipe',sourceAuthoringRowSha256:rowSha,reviewOrigin:'THIS_STAGE_REVIEW'}],runtimePublishable:false,mayActivate:false};
  const capture={contract:'potok-sr28-ascii-source-capture-v1',records:ids.map(ndb=>({ndb,description:'Synthetic source',factsPer100GEdible:vec()})),runtimePublishable:false,mayActivate:false};
  const captureRaw=JSON.stringify(capture);
  const audit={contract:'potok-pilot-remaining-42-review-v1',privatePilotPacketSha256:ledger.privatePilotPacketSha256,asciiCaptureSha256:hash(captureRaw),reviewedRows:1,cases:[{caseId,rowIds:['synthetic_row'],sourceRecordIds:ids,requiredEvidence:'Independent source and class review required',status:'BLOCKED'}],runtimePublishable:false,mayActivate:false};
  const sources={ledgerRaw:JSON.stringify(ledger),auditRaw:JSON.stringify(audit),captureRaw};
  const input={contract:'potok-authoring-reference-proposal-input-v1',privatePilotPacketSha256:ledger.privatePilotPacketSha256,
    ledgerSha256:hash(sources.ledgerRaw),auditSha256:hash(sources.auditRaw),captureSha256:hash(captureRaw),
    rows:[{rawAuthoringRow:rawRow,reference:{calories:'32',protein:'0.67',fat:'0.3',totalCarbohydrate:'7.68',fiber:'2'},referenceStatus:'MANUAL_UNVERIFIED_TRANSCRIPTION'}]};
  return {input,sources};
}
const build=(f:ReturnType<typeof fixture>)=>buildAuthoringReferenceProposalsV1(JSON.stringify(f.input),f.sources);
test('conditional proposals show exact signed reference differences, never select/apply or recalculate meals',()=>{
  const f=fixture(),before=JSON.stringify(f),p=build(f),one=p.proposals[0],impact=one.options[0].impact;
  assert.equal(JSON.stringify(f),before);assert.deepEqual(build(f),p);
  assert.equal(impact.status,'CONDITIONAL_LITERAL_REFERENCE_DIFFERENCE');
  assert.deepEqual(impact.delta,{calories:'1.50000000',protein:'-0.12000000',fat:'-0.09500000',fiber:'0.05000000'});
  assert.equal(impact.carbohydrateDelta,null);assert.equal(impact.carbohydrateReason,'REFERENCE_CARBOHYDRATE_SEMANTICS_NOT_ADMITTED');
  assert.equal(one.selectedOption,null);assert.equal(one.canApply,false);assert.equal(p.summary.selectedChanges,0);
  assert.equal(p.recipeTotalsRecomputed,false);assert.equal(p.originalDataModified,false);assert.equal(p.physicalCookingBlocksDevelopment,false);
  assert.equal(p.recipeImpacts[0].status,'NO_VERIFIED_RECIPE_TOTAL_OR_WEEK_TARGET_CHANGE_COMPUTED');
  assert.ok(!JSON.stringify(p).includes('PRIVATE_MARKER'));assert.ok(!JSON.stringify(p).includes('rawAuthoringRow'));
});
test('ML gram references and discrete units never become measured mass or implicit volume conversion',()=>{
  for(const unit of ['ML','PCS','PIECE']){
    const p=build(fixture(unit));assert.equal(p.proposals[0].options[0].impact.delta,null);
    assert.equal(p.proposals[0].options[0].impact.status,unit==='ML'?'BLOCKED_UNREVIEWED_VOLUME_TO_MASS':'BLOCKED_DISCRETE_OR_OTHER_MASS_BASIS');
    assert.equal(p.proposals[0].recordedGramsReference,50);
  }
});
test('raw berry and non-previously-frozen pollock comparisons are excluded for the pinned recipe states',()=>{
  for(const [caseId,ndb] of [['FROZEN_STRAWBERRY','09316'],['FROZEN_CURRANT','09083'],['POLLOCK','15266']]){
    const p=build(fixture('G',caseId,[ndb])),o=p.proposals[0].options[0];
    assert.equal(o.status,'EXCLUDED_FOR_RECORDED_STATE');assert.equal(o.impact.status,'EXCLUDED_SOURCE_STATE');assert.equal(o.impact.delta,null);
  }
});
test('unknown source or reference nutrients stay unknown rather than becoming zero',()=>{
  const f=fixture();const capture=JSON.parse(f.sources.captureRaw);capture.records[0].factsPer100GEdible.fiber=null;
  f.sources.captureRaw=JSON.stringify(capture);const audit=JSON.parse(f.sources.auditRaw);audit.asciiCaptureSha256=hash(f.sources.captureRaw);f.sources.auditRaw=JSON.stringify(audit);
  f.input.captureSha256=hash(f.sources.captureRaw);f.input.auditSha256=hash(f.sources.auditRaw);
  const p=build(f);assert.equal(p.proposals[0].options[0].afterReference.fiber,null);assert.equal(p.proposals[0].options[0].impact.status,'BLOCKED_REFERENCE_NUTRIENT_MISSING');
  const none=build(fixture('G','DAIRY_TVOROG',[]));assert.equal(none.proposals[0].options.length,0);assert.equal(none.proposals[0].decisionNeeded,'ORIGINAL_SOURCE_CLASS_OR_FORMULATION_REQUIRED');
});
test('stale source digests, modified original rows, missing/duplicate coverage and approval-shaped input fail closed',()=>{
  for(const change of [(f:ReturnType<typeof fixture>)=>{f.input.captureSha256='b'.repeat(64);},
    (f:ReturnType<typeof fixture>)=>{f.input.rows[0].rawAuthoringRow.weight_g=100;},
    (f:ReturnType<typeof fixture>)=>{f.input.rows=[];},
    (f:ReturnType<typeof fixture>)=>{f.input.rows.push(f.input.rows[0]);},
    (f:ReturnType<typeof fixture>)=>{Object.assign(f.input,{canApply:true});},
    (f:ReturnType<typeof fixture>)=>{f.input.rows[0].reference.calories='1e3';}]){
    const f=fixture();change(f);assert.throws(()=>build(f),/INVALID_AUTHORING_REFERENCE_PROPOSAL_INPUT/);
  }
  const f=fixture();assert.throws(()=>buildAuthoringReferenceProposalsV1('{"contract":1,"contract":2}',f.sources));
});
test('both ordinary and forged-approval proposal packets are rejected by the real publication decoder',async()=>{
  const p=build(fixture());for(const candidate of [p,{...p,canApply:true,runtimePublishable:true,mayActivate:true}]){
    const raw=JSON.stringify(candidate);await assert.rejects(decodeReviewedRuntimeRecipePublicationEvidenceRawV1(raw,raw),/REVIEWED_PUBLICATION_FIELDS_INVALID/);
  }
});
