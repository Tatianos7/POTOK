import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import test from 'node:test';
import {buildConsolidatedAuthoringCandidateV1,previewConsolidatedAuthoringWeekV1,readConsolidationEvidenceRawV1} from './consolidated-authoring-candidate-week-v1';
import {readPinnedProposalSourcesV1} from './authoring-reference-proposals-v1';
import {readPrimaryRecheckRawV1} from './three-food-source-candidates-v1';
import {readWalnutOwnerInputStateRawV1,reproduceThreeFoodReferenceTextV1} from './three-food-applicability-review-v1';
import {decodeAuthoringRecipeCatalog,authoringSearchInput} from '../../src/dev/authoringRecipeCatalog';
import {previewRecipeAuthoringWeekV1,type AuthoringWeekScenarioV1} from '../../src/dev/authoringWeekSearchV1';
import {decodeReviewedRuntimeRecipePublicationEvidenceRawV1} from '../../src/utils/reviewedRuntimeRecipePublicationEvidenceV1';
const hash=(s:string)=>createHash('sha256').update(s).digest('hex');
const canonical=(v:unknown):string=>v!==null&&typeof v==='object'?(Array.isArray(v)?'['+v.map(canonical).join(',')+']':'{'+Object.keys(v).sort().map(k=>JSON.stringify(k)+':'+canonical((v as Record<string,unknown>)[k])).join(',')+'}'):JSON.stringify(v);
function fixture(){
  const recipes=[];const notes=['per 100 g: 32 kcal; P 0.67 g; F 0.3 g; C 7.68 g; fiber 2 g.','на 100 г: 654 ккал; Б 15.2 г; Ж 65.2 г; У 13.7 г; клетчатка 6.7 г.','на 100 г: 57 ккал; Б 0.7 г; Ж 0.3 г; У 14.5 г; клетчатка 2.4 г.'];
  for(let n=0;n<37;n++){
    const category=n<12?'BREAKFAST':n<24?'LUNCH':'SNACK',id='synthetic_'+n,missing=n===36;
    const row={ingredient_row_id:id+'_row',recipe_id:id,sort_order:1,ingredient_name_ru:'Synthetic food',unit:'G',amount:50,weight_g:50,optional:false,preparation_note:null,
      notes:'PRIVATE_NOTE '+(notes[n]??''),canonical_status:missing?'AMBIGUOUS':'UNRESOLVED',food_stable_id:null};
    recipes.push({recipeId:id,name:id,sourceStatus:'READY_FOR_REVIEW',sourceRecipe:{recipe_id:id,meal_type_primary:category,owner_notes:null},
      declaredServings:2,declaredYieldG:null,measuredYieldG:null,confirmedServings:null,physicalReview:'DEFERRED_UNTIL_OWNER_PRELAUNCH_TESTING',
      referenceNutrition:{basis:'SOURCE_DECLARED_PER_SERVING',verified:false,carbohydrateSemantics:'UNVERIFIED_SOURCE_REFERENCE',values:{calories:category==='BREAKFAST'?500:category==='LUNCH'?600:300,protein:10,fat:5,carbs:30,fiber:missing?null:2}},
      ingredients:[row],steps:[{step_id:id+'_step',recipe_id:id,step_number:1,instruction_ru:'PRIVATE_STEP',duration_min:null,temperature_c:null,notes:null}],
      numericReferenceTestInputAvailable:!missing,sourceTagsAreVerifiedRestrictions:false,runtimePublishable:false,pendingReview:['CANONICAL_BINDINGS_NOT_RESOLVED'],referenceTestIssues:missing?['REFERENCE_FIBER_MISSING_OR_INVALID']:[]});
  }
  const catalog={contract:'potok-recipe-authoring-test-catalog-v1',usage:'OFFLINE_AUTHORING_TEST_INPUT_ONLY',physicalCookingBlocksDevelopment:false,runtimePublishable:false,mayActivate:false,referenceNutritionMustNotBePresentedAsVerified:true,
    source:{fileName:'synthetic.xlsx',sha256:'a'.repeat(64),bytes:1},recipes};
  const catalogRaw=JSON.stringify(catalog),primary=readPrimaryRecheckRawV1(),captureRaw=readPinnedProposalSourcesV1().captureRaw;
  const ids=[['FROZEN_STRAWBERRY','09318'],['WALNUT','12155'],['BLUEBERRY','09050']];
  const materialPath='docs/premium/retained-sources/synthetic/preparation.txt',material='SYNTHETIC_PUBLIC_PREPARATION';
  const ledger={contract:'potok-pilot-120-row-stage-review-v1',privatePilotPacketSha256:'b'.repeat(64),authoringCatalogSha256:hash(catalogRaw),counts:{rows:3},
    rows:ids.map(([caseId],i)=>({ingredientRowId:recipes[i].ingredients[0].ingredient_row_id,recipeId:recipes[i].recipeId,sourceAuthoringRowSha256:hash(canonical(recipes[i].ingredients[0])),reviewOrigin:'THIS_STAGE_REVIEW',
      provenancePath:materialPath,provenanceSha256:hash(material),canonicalStatus:'UNRESOLVED',stableFoodId:null,runtimePublishable:false,preparationBasis:'SYNTHETIC_REVIEW',openFinding:caseId})),runtimePublishable:false,mayActivate:false};
  const audit={contract:'potok-pilot-remaining-42-review-v1',privatePilotPacketSha256:ledger.privatePilotPacketSha256,asciiCaptureSha256:hash(captureRaw),reviewedRows:3,
    cases:ids.map(([caseId,ndb],i)=>({caseId,rowIds:[ledger.rows[i].ingredientRowId],sourceRecordIds:[ndb],status:'BLOCKED',requiredEvidence:'Synthetic source/class review required'})),runtimePublishable:false,mayActivate:false};
  const sources={ledgerRaw:JSON.stringify(ledger),auditRaw:JSON.stringify(audit),captureRaw};
  const privateInput={contract:'potok-authoring-reference-proposal-input-v1',privatePilotPacketSha256:ledger.privatePilotPacketSha256,ledgerSha256:hash(sources.ledgerRaw),auditSha256:hash(sources.auditRaw),captureSha256:hash(captureRaw),
    rows:recipes.slice(0,3).map(r=>({rawAuthoringRow:r.ingredients[0],reference:reproduceThreeFoodReferenceTextV1(r.ingredients[0].notes),referenceStatus:'MANUAL_UNVERIFIED_TRANSCRIPTION'}))};
  const review={contract:'potok-three-food-declared-applicability-review-v1',reviewKind:'PINNED_OFFLINE_DECLARED_DATA_REVIEW_NOT_AUTHORITY_EVENT',privateCatalogSha256:hash(catalogRaw),privatePilotPacketSha256:ledger.privatePilotPacketSha256,primaryRecheckSha256:hash(primary.manifestRaw),
    records:ids.map(([caseId],i)=>({...ledger.rows[i],caseId,recipeContextSha256:hash(canonical({sourceRecipe:recipes[i].sourceRecipe,steps:recipes[i].steps})),declaredAlignment:caseId==='WALNUT'?'UNKNOWN_PROCESSING_AND_EDIBLE_FORM':'DECLARED_ORIGIN_AND_INPUT_STATE_ALIGN',openConditions:['Synthetic declaration only']})),sourceApproved:false,runtimePublishable:false,canApply:false,mayActivate:false};
  const w=review.records[1],owner={...JSON.parse(readWalnutOwnerInputStateRawV1()),privateCatalogSha256:hash(catalogRaw),recipeId:w.recipeId,ingredientRowId:w.ingredientRowId,sourceAuthoringRowSha256:w.sourceAuthoringRowSha256,recipeContextSha256:w.recipeContextSha256};
  const evidence={sources,primary,declaredReviewRaw:JSON.stringify(review),ownerStateRaw:JSON.stringify(owner),materialsRaw:{[materialPath]:material},ingredientOwnerRulesRaw:'Synthetic recipe-specific rules only'};
  const scenario:AuthoringWeekScenarioV1={contract:'potok-authoring-week-scenario-v1',weekStart:'2026-11-02',dailyCalorieTarget:2000,tolerancePercent:10,
    slots:[{label:'Breakfast',sourceCategories:['BREAKFAST'],targetSharePercent:25},{label:'Lunch',sourceCategories:['LUNCH'],targetSharePercent:30},{label:'Dinner test',sourceCategories:['LUNCH'],targetSharePercent:30},{label:'Snack',sourceCategories:['SNACK'],targetSharePercent:15}],
    rankedCandidatePoolSize:12,shortlistPerSlot:4,dayPoolSize:4,maxDayEvaluations:256,maxWeekEvaluations:1024,maxRecipeUses:2};
  return {catalog,catalogRaw,privateInputRaw:JSON.stringify(privateInput),evidence,scenario};
}
const build=(f:ReturnType<typeof fixture>)=>buildConsolidatedAuthoringCandidateV1(f.catalogRaw,f.privateInputRaw,f.evidence);

test('real retained archive binds all 120 reviewed rows without rerunning source research',()=>{
  const e=readConsolidationEvidenceRawV1(),l=JSON.parse(e.sources.ledgerRaw);assert.equal(l.rows.length,120);
  for(const row of l.rows)assert.equal(hash(e.materialsRaw[row.provenancePath]),row.provenanceSha256);
  assert.ok(Object.keys(e.materialsRaw).length>=56);assert.ok(e.ingredientOwnerRulesRaw.includes('recipe-specific'));
});
test('catalog consolidation preserves unknowns and old totals while distinguishing row reviews from conditional source candidates',()=>{
  const f=fixture(),before=JSON.stringify(f),c=build(f);
  assert.equal(c.summary.recipes,37);assert.equal(c.summary.ingredientRows,37);assert.equal(c.summary.pinnedReviewedRows,3);assert.equal(c.summary.rowsOutsidePinnedPilotIndex,34);
  assert.equal(c.summary.referenceSearchEligibleRecipes,36);assert.equal(c.summary.excludedReferenceRecipes,1);assert.equal(c.summary.completeConditionalSourceInputRows,3);
  assert.deepEqual(c.originalAuthoringCatalog,f.catalog);assert.equal(c.recipeReviews[36].originalReferenceNutrition.values.fiber,null);
  assert.equal(c.recipeReviews[36].ingredientReviews[0].originalCanonicalStatus,'AMBIGUOUS');
  assert.equal(c.recipeReviews[1].ingredientReviews[0].conditionalSourceInputReview?.inputContribution.status,'CONDITIONAL_OWNER_SPECIFIED_INPUT_ARITHMETIC');
  assert.ok(c.recipeReviews.every(r=>r.completeAdmittedRecipeNutrition===null));assert.equal(c.summary.admittedRecipes,0);assert.equal(c.recipeTotalsRecomputed,false);
  assert.equal(JSON.stringify(f),before);assert.deepEqual(build(f),c);
});
test('serialized consolidated catalog actually enters existing local search with byte-equivalent reference result and attached blockers',()=>{
  const f=fixture(),c=build(f),r=previewConsolidatedAuthoringWeekV1(JSON.stringify(c),JSON.stringify(f.scenario));
  const baseline=previewRecipeAuthoringWeekV1(authoringSearchInput(decodeAuthoringRecipeCatalog(f.catalog)),f.scenario);
  assert.deepEqual(r.authoringPreview,baseline);assert.equal(r.status,'REFERENCE_WEEK_PREVIEW');assert.equal(r.authoringPreview.days.length,7);
  const uses=new Map<string,number>();for(const d of r.authoringPreview.days){assert.equal(d.meals.length,4);assert.equal(d.referenceNutrition.calories,'2000.000');
    for(const m of d.meals){uses.set(m.recipeId,(uses.get(m.recipeId)??0)+1);assert.equal(m.measuredGrams,null);assert.equal(m.assignedSourceServings,1);}}
  assert.ok([...uses.values()].every(n=>n<=2));assert.equal(r.selectedCoverage.distinctRecipes,r.selectedRecipeReviews.length);
  assert.ok(r.selectedRecipeReviews.every(x=>x.runtimeBlockers.includes('COMPLETE_RECIPE_NUTRITION_NOT_ADMITTED')));
  assert.equal(r.partialIngredientCandidatesAppliedToRecipeTotals,false);assert.equal(r.runtimePublishable,false);
});
test('missing recipe references stay excluded, strict DINNER stays empty and evaluated failure never scales portions',()=>{
  const f=fixture(),c=JSON.stringify(build(f));
  const dinner=structuredClone(f.scenario);dinner.slots[2].sourceCategories=['DINNER'];
  const d=previewConsolidatedAuthoringWeekV1(c,JSON.stringify(dinner));assert.equal(d.status,'INCOMPLETE_CATEGORY_POOL');assert.deepEqual(d.authoringPreview.days,[]);
  const high=previewConsolidatedAuthoringWeekV1(c,JSON.stringify({...f.scenario,dailyCalorieTarget:4000}));assert.equal(high.status,'NO_REFERENCE_DAY_IN_EVALUATED_SHORTLISTS');assert.deepEqual(high.authoringPreview.days,[]);
});
test('stale source material/catalog/input and changed serialized candidate cannot silently enter search',()=>{
  const f=fixture();f.evidence.materialsRaw[Object.keys(f.evidence.materialsRaw)[0]]+=' CHANGED';assert.throws(()=>build(f));
  const g=fixture();assert.throws(()=>buildConsolidatedAuthoringCandidateV1(g.catalogRaw+' ',g.privateInputRaw,g.evidence));
  const h=fixture(),c=build(h);c.originalAuthoringCatalog.usage='FORGED';assert.throws(()=>previewConsolidatedAuthoringWeekV1(JSON.stringify(c),JSON.stringify(h.scenario)));
  const j=fixture();assert.throws(()=>buildConsolidatedAuthoringCandidateV1(j.catalogRaw,'{"contract":1,"contract":2}',j.evidence));
});
test('resealed root or nested approval claims and complete-recipe promotion are rejected by the local adapter',()=>{
  const f=fixture();for(const mutate of [
    (c:ReturnType<typeof build>)=>{c.canApply=true;},(c:ReturnType<typeof build>)=>{c.recipeReviews[0].ingredientReviews[0].sourceApproved=true;},
    (c:ReturnType<typeof build>)=>{Object.assign(c.recipeReviews[0],{completeAdmittedRecipeNutrition:{calories:1}});},
    (c:ReturnType<typeof build>)=>{c.summary.sourceApprovals=1;}]){
    const c=build(f);mutate(c);const {integritySha256:ignored,...content}=c;void ignored;c.integritySha256=hash(canonical(content));
    assert.throws(()=>previewConsolidatedAuthoringWeekV1(JSON.stringify(c),JSON.stringify(f.scenario)));
  }
});
test('consolidated catalog and generated week never pass the real trusted publication decoder, including forged flags',async()=>{
  const f=fixture(),c=build(f),w=previewConsolidatedAuthoringWeekV1(JSON.stringify(c),JSON.stringify(f.scenario));
  for(const value of [c,w,{...c,sourceApproved:true,runtimePublishable:true,mayActivate:true,canApply:true}]){
    const raw=JSON.stringify(value);await assert.rejects(decodeReviewedRuntimeRecipePublicationEvidenceRawV1(raw,raw),/REVIEWED_PUBLICATION_FIELDS_INVALID/);
  }
});
