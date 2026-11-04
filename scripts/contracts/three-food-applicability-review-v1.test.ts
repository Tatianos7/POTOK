import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import test from 'node:test';
import {buildThreeFoodApplicabilityReviewV1,readDeclaredApplicabilityReviewRawV1,reproduceThreeFoodReferenceTextV1} from './three-food-applicability-review-v1';
import {readPrimaryRecheckRawV1} from './three-food-source-candidates-v1';
import {readPinnedProposalSourcesV1} from './authoring-reference-proposals-v1';
import {decodeReviewedRuntimeRecipePublicationEvidenceRawV1} from '../../src/utils/reviewedRuntimeRecipePublicationEvidenceV1';
const hash=(s:string)=>createHash('sha256').update(s).digest('hex');
const canonical=(v:unknown):string=>v!==null&&typeof v==='object'?(Array.isArray(v)?'['+v.map(canonical).join(',')+']':'{'+Object.keys(v).sort().map(k=>JSON.stringify(k)+':'+canonical((v as Record<string,unknown>)[k])).join(',')+'}'):JSON.stringify(v);
function fixture(unit='G',mass:number|null=75){
  const captureRaw=readPinnedProposalSourcesV1().captureRaw,primary=readPrimaryRecheckRawV1();
  const definitions=[['FROZEN_STRAWBERRY','09318',50],['WALNUT','12155',30],['BLUEBERRY','09050',mass]] as const;
  const notes=['per 100 g: 32 kcal; P 0.67 g; F 0.3 g; C 7.68 g; fiber 2 g.','на 100 г: 654 ккал; Б 15.2 г; Ж 65.2 г; У 13.7 г; клетчатка 6.7 г.','на 100 г: 57 ккал; Б 0.7 г; Ж 0.3 г; У 14.5 г; клетчатка 2.4 г.'];
  const rows=definitions.map(([caseId,ndb,weight_g],i)=>({caseId,ndb,raw:{ingredient_row_id:'synthetic_row_'+i,recipe_id:'synthetic_recipe_'+i,
    unit:i===2?unit:'G',weight_g,notes:'PRIVATE_NOTE '+notes[i]}}));
  const recipes=rows.map(r=>({recipeId:r.raw.recipe_id,ingredients:[r.raw],sourceRecipe:{recipe_id:r.raw.recipe_id},steps:[{instruction_ru:'PRIVATE_SYNTHETIC_STEP'}]}));
  const catalogRaw=JSON.stringify({recipes});
  const ledger={contract:'potok-pilot-120-row-stage-review-v1',privatePilotPacketSha256:'a'.repeat(64),counts:{rows:3},
    rows:rows.map(r=>({ingredientRowId:r.raw.ingredient_row_id,recipeId:r.raw.recipe_id,sourceAuthoringRowSha256:hash(canonical(r.raw)),reviewOrigin:'THIS_STAGE_REVIEW'})),runtimePublishable:false,mayActivate:false};
  const audit={contract:'potok-pilot-remaining-42-review-v1',privatePilotPacketSha256:ledger.privatePilotPacketSha256,asciiCaptureSha256:hash(captureRaw),reviewedRows:3,
    cases:rows.map(r=>({caseId:r.caseId,rowIds:[r.raw.ingredient_row_id],sourceRecordIds:[r.ndb],status:'BLOCKED',requiredEvidence:'Source/class review required'})),runtimePublishable:false,mayActivate:false};
  const sources={ledgerRaw:JSON.stringify(ledger),auditRaw:JSON.stringify(audit),captureRaw};
  const input={contract:'potok-authoring-reference-proposal-input-v1',privatePilotPacketSha256:ledger.privatePilotPacketSha256,ledgerSha256:hash(sources.ledgerRaw),auditSha256:hash(sources.auditRaw),captureSha256:hash(captureRaw),
    rows:rows.map(r=>({rawAuthoringRow:r.raw,reference:reproduceThreeFoodReferenceTextV1(r.raw.notes),referenceStatus:'MANUAL_UNVERIFIED_TRANSCRIPTION'}))};
  const review={contract:'potok-three-food-declared-applicability-review-v1',reviewKind:'PINNED_OFFLINE_DECLARED_DATA_REVIEW_NOT_AUTHORITY_EVENT',privateCatalogSha256:hash(catalogRaw),privatePilotPacketSha256:ledger.privatePilotPacketSha256,primaryRecheckSha256:hash(primary.manifestRaw),
    records:rows.map((r,i)=>({caseId:r.caseId,ingredientRowId:r.raw.ingredient_row_id,recipeId:r.raw.recipe_id,sourceAuthoringRowSha256:hash(canonical(r.raw)),recipeContextSha256:hash(canonical({sourceRecipe:recipes[i].sourceRecipe,steps:recipes[i].steps})),
      declaredAlignment:r.caseId==='WALNUT'?'UNKNOWN_PROCESSING_AND_EDIBLE_FORM':'DECLARED_ORIGIN_AND_INPUT_STATE_ALIGN',openConditions:['Synthetic review only; no source admission.']})),sourceApproved:false,runtimePublishable:false,canApply:false,mayActivate:false};
  return {input,catalogRaw,sources,primary,review};
}
const build=(f:ReturnType<typeof fixture>)=>buildThreeFoodApplicabilityReviewV1(JSON.stringify(f.input),f.catalogRaw,f.sources,f.primary,JSON.stringify(f.review));

test('retained manual review covers exactly the three pinned rows, source context and two alignments',()=>{
  const review=JSON.parse(readDeclaredApplicabilityReviewRawV1()),ledger=JSON.parse(readPinnedProposalSourcesV1().ledgerRaw);
  assert.equal(review.records.length,3);assert.equal(review.sourceApproved,false);assert.equal(review.canApply,false);
  assert.equal(review.records.filter((r:{declaredAlignment:string})=>r.declaredAlignment==='DECLARED_ORIGIN_AND_INPUT_STATE_ALIGN').length,2);
  for(const r of review.records){assert.equal(r.sourceAuthoringRowSha256,ledger.rows.find((l:{ingredientRowId:string})=>l.ingredientRowId===r.ingredientRowId).sourceAuthoringRowSha256);assert.equal(r.recipeContextSha256.length,64);}
  assert.equal(review.privateCatalogSha256,'517386c0ec6d5bc3a4ff28a33b702f046b1862a16c342f52255789f3a3fb90b0');
});
test('narrow RU/EN transcription reproduces five decimal fields and rejects duplicates, missing data and invalid numeric spelling',()=>{
  const en='per 100 g: 32 kcal; P 0.67 g; F 0.3 g; C 7.68 g; fiber 2 g.';
  assert.deepEqual(reproduceThreeFoodReferenceTextV1(en),{calories:'32',protein:'0.67',fat:'0.3',totalCarbohydrate:'7.68',fiber:'2'});
  for(const bad of [en+en,en.replace('32 kcal','1e2 kcal'),en.replace('32 kcal','-1 kcal'),en.replace('fiber 2','fiber null'),en.replace('0.67','0.6701')])assert.throws(()=>reproduceThreeFoodReferenceTextV1(bad));
});
test('two aligned berry inputs have exact conditional contributions; unknown walnut processing stays blocked',()=>{
  const p=build(fixture());assert.equal(p.summary.transcriptionFieldsReproduced,15);assert.equal(p.summary.declaredAlignments,2);assert.equal(p.summary.openProcessingRows,1);assert.equal(p.summary.conditionalInputContributions,2);
  assert.deepEqual(p.results[0].inputContribution.values,{calories:'17.50000000',protein:'0.21500000',fat:'0.05500000',carbs:'3.51500000',fiber:'1.05000000'});
  assert.deepEqual(p.results[2].inputContribution.values,{calories:'42.75000000',protein:'0.55500000',fat:'0.24750000',carbs:'9.06750000',fiber:'1.80000000'});
  assert.equal(p.results[1].inputContribution.values,null);assert.equal(p.results[1].inputContribution.status,'BLOCKED_UNSPECIFIED_PROCESSING_EDIBLE_FORM');
  for(const r of p.results){assert.equal(r.inputContribution.measuredMass,false);assert.equal(r.inputContribution.cookingRetentionAssumed,false);assert.equal(r.ownerDecision,null);assert.equal(r.sourceApproved,false);assert.equal(r.carbohydrateDelta,null);}
});
test('ML, discrete units and unknown/zero grams do not become eligible mass by declared class alignment',()=>{
  for(const [unit,mass] of [['ML',75],['PCS',75],['PIECE',75],['G',null],['G',0]] as const){
    const r=build(fixture(unit,mass)).results[2];assert.equal(r.inputContribution.values,null);assert.equal(r.inputContribution.status,'BLOCKED_INPUT_MASS_BASIS');
  }
});
test('original row, recipe context, catalog and manually transcribed nutrient values all remain bound',()=>{
  const badMass=fixture();badMass.input.rows[0].rawAuthoringRow.weight_g=51;assert.throws(()=>build(badMass));
  const badReference=fixture();badReference.input.rows[0].reference.protein='99';assert.throws(()=>build(badReference),/INVALID_THREE_FOOD_APPLICABILITY_REVIEW/);
  const badSteps=fixture(),catalog=JSON.parse(badSteps.catalogRaw);catalog.recipes[0].steps[0].instruction_ru='CHANGED';badSteps.catalogRaw=JSON.stringify(catalog);
  assert.throws(()=>build(badSteps));badSteps.review.privateCatalogSha256=hash(badSteps.catalogRaw);assert.throws(()=>build(badSteps));
});
test('missing/duplicate manual rows, fabricated walnut alignment and approval-shaped input fail closed',()=>{
  for(const change of [(f:ReturnType<typeof fixture>)=>{f.review.records.pop();},(f:ReturnType<typeof fixture>)=>{f.review.records[0]=f.review.records[1];},
    (f:ReturnType<typeof fixture>)=>{f.review.records[1].declaredAlignment='DECLARED_ORIGIN_AND_INPUT_STATE_ALIGN';},
    (f:ReturnType<typeof fixture>)=>{f.review.sourceApproved=true;},(f:ReturnType<typeof fixture>)=>{Object.assign(f.input,{canApply:true});}]){
    const f=fixture();change(f);assert.throws(()=>build(f));
  }
});
test('review is deterministic, preserves input/unknowns/totals and exports no raw recipe text',()=>{
  const f=fixture(),before=JSON.stringify(f),p=build(f);assert.deepEqual(build(f),p);assert.equal(JSON.stringify(f),before);
  assert.equal(p.recipeTotalsRecomputed,false);assert.equal(p.originalDataModified,false);assert.equal(p.physicalCookingBlocksDevelopment,false);assert.equal(p.summary.sourceApprovals,0);assert.equal(p.summary.appliedChanges,0);
  assert.ok(!JSON.stringify(p).includes('PRIVATE_NOTE'));assert.ok(!JSON.stringify(p).includes('PRIVATE_SYNTHETIC_STEP'));assert.ok(!JSON.stringify(p).includes('rawAuthoringRow'));
});
test('normal and forged-approval applicability exports stay outside the actual runtime publication boundary',async()=>{
  const p=build(fixture());for(const c of [p,{...p,sourceApproved:true,canApply:true,runtimePublishable:true,mayActivate:true}]){
    const raw=JSON.stringify(c);await assert.rejects(decodeReviewedRuntimeRecipePublicationEvidenceRawV1(raw,raw),/REVIEWED_PUBLICATION_FIELDS_INVALID/);
  }
});
