import test from 'node:test';
import assert from 'node:assert/strict';
import {buildWeekTransferHandoffV1,evaluateWeekMealReplacementV1} from './week-transfer-handoff-v1';
import {buildPilotInputFreezeV1,readAdmissionContractSourcesV1,pilotCanonicalV1,pilotDigestV1} from './pilot-admission-readiness-v1';
import {calculatePreciseInputV3} from './foundation-variants-review-v1';
import {findCompleteInputWeekWitnessV1} from './complete-input-week-witness-v1';
import type {ReviewInputModelV1} from './week-quality-preparation-v1';
import {createGenerationValidationAdapterV1,generationValidationAuthorityContractV1} from '../../src/server/generationValidationAdapterV1';
import {decodeGenerationPreparationContextRawV1} from '../../src/server/generationValidationAuthorityLoaderV1';
import {decodeReviewedRuntimeRecipePublicationEvidenceRawV1} from '../../src/utils/reviewedRuntimeRecipePublicationEvidenceV1';
import {fullFixture,type FullFixture} from '../../src/utils/__tests__/trustedGeneratedWeekFixturesV1';

const s={weekStart:'2026-11-02',dailyCalorieTarget:400,tolerancePercent:0,maxRecipeUses:3,slots:Array.from({length:4},(_,i)=>({label:'slot_'+i,sourceCategories:['LUNCH']}))};
function fixture(){
 const models:ReviewInputModelV1[]=Array.from({length:14},(_,i)=>{
  const rows=[{component:{rowId:'synthetic_row_'+i,status:'DECLARED_SOURCE_INPUT_MODEL' as const,componentKind:'FOOD' as const,sourceRecord:'SYNTHETIC_UNAPPROVED',vector:{calories:i===12?'1000':'100',protein:'12',fat:'4',carbs:'8',fiber:'2'},quantityG:'100',quantityDecision:'DECLARED_GRAMS',optional:false}}];
  return {recipeId:'synthetic_recipe_'+i,sourceCategory:i===13?'SNACK':'LUNCH',declaredServings:1,rows,calculation:calculatePreciseInputV3(rows.map(r=>r.component),1),sourceApproved:false,runtimePublishable:false};
 });
 const raw=JSON.stringify({originalAuthoringCatalog:{recipes:models.map(m=>({recipeId:m.recipeId,declaredServings:1,sourceRecipe:{meal_type_primary:m.sourceCategory},ingredients:m.rows.map(r=>({ingredient_row_id:r.component.rowId,canonical_status:'UNRESOLVED',amount:100,unit:'G',weight_g:100}))}))}});
 const freezeRaw=JSON.stringify(buildPilotInputFreezeV1(raw,models,readAdmissionContractSourcesV1())),scenarioRaw=JSON.stringify(s);
 const witness=findCompleteInputWeekWitnessV1(models.map(m=>({recipeId:m.recipeId,sourceCategory:m.sourceCategory,caloriesPerDeclaredServing:m.calculation.perDeclaredServing!.calories})),s);
 assert.equal(witness.status,'CONDITIONAL_INPUT_WEEK_WITNESS');return {raw,models,freezeRaw,scenarioRaw,witness};
}
const handoff=(f:ReturnType<typeof fixture>,excludes:string[]=[])=>buildWeekTransferHandoffV1(f.raw,f.models,f.freezeRaw,f.scenarioRaw,f.witness,excludes);
const replace=(f:ReturnType<typeof fixture>,recipeId:string,excludes:string[]=[])=>evaluateWeekMealReplacementV1(f.raw,f.models,f.freezeRaw,f.scenarioRaw,f.witness,{date:s.weekStart,slotIndex:0,recipeId},excludes);
test('all28meals bind to the frozen transfer and conserve exact day/week nutrition without admission',async()=>{
 const f=fixture(),before=pilotCanonicalV1(f),r=await handoff(f);assert.equal(r.summary.days,7);assert.equal(r.summary.meals,28);
 assert.deepEqual(r.exactWeeklyConditionalInputNutrition.calories,{numerator:'2800',denominator:'1'});assert.equal(r.weeklyV3Preview.calories,'2800.00000000');
 for(const d of r.days){assert.equal(d.meals.length,4);assert.equal(new Set(d.meals.map(m=>m.recipeId)).size,4);assert.deepEqual(d.exactConditionalInputNutrition.calories,{numerator:'400',denominator:'1'});for(const m of d.meals){assert.equal(m.assignedDeclaredServings,1);assert.equal(m.measuredGrams,null);assert.match(m.inputModelSha256,/^[a-f0-9]{64}$/);assert.equal(m.sourceAdmission,'NOT_PERFORMED');}}
 assert.equal(r.status,'BLOCKED_SOURCE_ADMISSION_AND_SERVER_CONTEXT_NOT_BOUND');assert.equal(r.serverRequest,null);assert.equal(r.requestOperationId,null);assert.equal(r.serverValidationAttempted,false);assert.equal(r.serverValidationResult,null);assert.equal(r.summary.admittedRecipes,0);assert.equal(pilotCanonicalV1(f),before);
});
test('forged serving, date, calorie/usage summaries, duplicate or excluded meals cannot reach the handoff',async()=>{
 for(const mode of ['SERVING','DATE','CALORIES','USES','DUPLICATE','EXCLUDED']){const f=fixture();if(mode==='SERVING')f.witness.days[0].meals[0].assignedDeclaredServings=2;if(mode==='DATE')f.witness.days[0].date='2026-11-03';if(mode==='CALORIES')f.witness.days[0].calories='401.000';if(mode==='USES')f.witness.recipeUses[0].uses=0;if(mode==='DUPLICATE')f.witness.days[0].meals[1]={...f.witness.days[0].meals[0]};await assert.rejects(handoff(f,mode==='EXCLUDED'?[f.witness.days[0].meals[0].recipeId]:[]));}
});
test('changed source/model/flag/freeze/scenario and duplicate JSON keys reject',async()=>{
 for(const mode of ['SOURCE','MODEL','FLAG','FREEZE','SCENARIO','JSON']){const f=fixture();if(mode==='SOURCE')f.raw+=' ';if(mode==='MODEL')f.models[0].rows[0].component.vector!.protein='99';if(mode==='FLAG')f.witness.runtimePublishable=true;if(mode==='FREEZE')f.freezeRaw=f.freezeRaw.replace('"canApply":false','"canApply":true');if(mode==='SCENARIO')f.scenarioRaw=JSON.stringify({...s,maxRecipeUses:1});if(mode==='JSON')f.scenarioRaw=f.scenarioRaw.replace('"weekStart":','"weekStart":"duplicate","weekStart":');await assert.rejects(handoff(f));}
});
test('a valid explicit replacement rechecks all28meals, changes only one assignment and keeps the base immutable',async()=>{
 const f=fixture(),dayIds=f.witness.days[0].meals.map(m=>m.recipeId),target=f.models.find(m=>m.sourceCategory==='LUNCH'&&m.recipeId!=='synthetic_recipe_12'&&!dayIds.includes(m.recipeId)&&(f.witness.recipeUses.find(r=>r.recipeId===m.recipeId)?.uses??0)<s.maxRecipeUses)!;
 assert.ok(target);const before=pilotCanonicalV1(f),r=await replace(f,target.recipeId);assert.equal(r.status,'CONDITIONAL_REPLACEMENT_ONLY_NOT_SERVER_ADMISSION');assert.ok(r.proposal&&r.replacementWitness);
 assert.equal(r.proposal.summary.meals,28);assert.equal(r.proposal.days[0].meals[0].recipeId,target.recipeId);assert.equal(r.proposal.serverRequest,null);assert.equal(r.readyForServerSubmission,false);assert.equal(r.fallbackUsed,false);
 const changes=r.replacementWitness.days.flatMap((d,i)=>d.meals.map((m,j)=>m.recipeId!==f.witness.days[i].meals[j].recipeId)).filter(Boolean);assert.equal(changes.length,1);assert.equal(pilotCanonicalV1(f),before);
});
test('excluded, duplicate, overused, wrong-category, calorie-breaking and unchanged replacements fail without fallback',async()=>{
 const f=fixture(),day=f.witness.days[0],overused=f.witness.recipeUses.find(r=>r.uses===s.maxRecipeUses&&!day.meals.some(m=>m.recipeId===r.recipeId))!;assert.ok(overused);
 const cases=[{id:'synthetic_recipe_13',reason:'CATEGORY_NOT_ALLOWED',excluded:[]},{id:'synthetic_recipe_12',reason:'CALORIE_RANGE',excluded:[]},
 {id:day.meals[1].recipeId,reason:'DAILY_DUPLICATE',excluded:[]},{id:overused.recipeId,reason:'REPEAT_LIMIT',excluded:[]},
 {id:day.meals[0].recipeId,reason:'NO_CHANGE',excluded:[]},{id:'synthetic_recipe_12',reason:'EXCLUDED_RECIPE',excluded:['synthetic_recipe_12']}];
 for(const c of cases){const r=await replace(f,c.id,c.excluded);assert.equal(r.status,'BLOCKED');assert.equal(r.reason,c.reason);assert.equal(r.proposal,null);assert.equal(r.replacementWitness,null);assert.equal(r.fallbackUsed,false);}
});
test('replacement refuses a forged base, unknown target/date/slot and invalid exclusion lists',async()=>{
 const f=fixture();f.witness.days[6].calories='0.000';await assert.rejects(replace(f,'synthetic_recipe_12'));
 const valid=fixture();for(const target of [{date:'2026-12-01',slotIndex:0,recipeId:'synthetic_recipe_1'},{date:s.weekStart,slotIndex:4,recipeId:'synthetic_recipe_1'},{date:s.weekStart,slotIndex:0,recipeId:'unknown'}])await assert.rejects(evaluateWeekMealReplacementV1(valid.raw,valid.models,valid.freezeRaw,valid.scenarioRaw,valid.witness,target));
 await assert.rejects(handoff(valid,['unknown']));await assert.rejects(handoff(valid,['synthetic_recipe_12','synthetic_recipe_12']));
});
test('handoff output and forged flags remain rejected by actual server/publication input decoders',async()=>{
 const r=await handoff(fixture());for(const p of [r,{...r,readyForServerSubmission:true,sourceApproved:true,runtimePublishable:true,mayActivate:true}]){const raw=JSON.stringify(p);await assert.rejects(decodeGenerationPreparationContextRawV1(raw,'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa'));await assert.rejects(decodeReviewedRuntimeRecipePublicationEvidenceRawV1(raw,raw));}
});
// Separate, fully synthetic admitted fixture. It is never derived from the real
// pilot or used as its authority; all identities and policy receipts are test-only.
async function serverFixture(){
 const types=['breakfast','lunch','dinner','snack'] as const;
 return fullFixture(state=>{
  state.composition.policy.patterns[0].allowedMealTypes=[...types];
  state.context.manifest.entries.forEach((entry,i)=>entry.allowedMealTypes=[types[i%4]]);
  state.evidence.distributionPolicy.days.forEach(d=>d.requiredSlots.forEach(slot=>slot.mealType=types[slot.sortOrder]));
 },4,'PINNED');
}
function authority(f:FullFixture){return {contract:generationValidationAuthorityContractV1,requestOperationId:f.context.input.operation.requestId,
 accountId:f.context.input.accountId,generationInputDigest:f.evidence.generationInputDigest,evaluatedPlanRawSha256:pilotDigestV1(f.planRaw),
 trustedContextRaw:f.contextRaw,pinnedPoliciesRaw:f.policiesRaw,pinnedWarningEvidenceRaw:f.warningRaw};}
test('actual server adapter validates all28synthetic meals with all four meal types, without commit or activation',async()=>{
 const f=await serverFixture(),a=authority(f),calls:string[][]=[];
 const r=await createGenerationValidationAdapterV1({async loadForProposalRaw(request,sha){calls.push([request,sha]);return JSON.stringify(a);}}).validate(a.requestOperationId,f.planRaw);
 assert.equal(r.status,'ACCEPTED');assert.equal(f.plan.graph.days.length,7);assert.equal(f.plan.graph.days.flatMap(d=>d.slots).length,28);
 for(const d of f.plan.graph.days)assert.deepEqual(d.slots.map(s=>s.mealType),['breakfast','lunch','dinner','snack']);
 assert.deepEqual(calls,[[a.requestOperationId,pilotDigestV1(f.planRaw)]]);assert.ok(!('active' in r));assert.ok(!('receipt' in r));if(r.status==='ACCEPTED')assert.equal(r.generatedPlanRaw,f.planRaw);
});
test('missing authorities and late-slot corruption cannot pass the full28meal server validation',async()=>{
 const f=await serverFixture(),a=authority(f);
 const missing=await createGenerationValidationAdapterV1({async loadForProposalRaw(){return null;}}).validate(a.requestOperationId,f.planRaw);assert.deepEqual(missing,{status:'BLOCKED',reason:'VALIDATION_AUTHORITY_UNAVAILABLE'});
 const changed=JSON.parse(f.planRaw);changed.graph.days[6].slots[3].mealType='breakfast';const raw=JSON.stringify(changed);
 await assert.rejects(createGenerationValidationAdapterV1({async loadForProposalRaw(){return JSON.stringify(a);}}).validate(a.requestOperationId,raw),/PROPOSAL_BINDING_MISMATCH/);
 const rebound={...a,evaluatedPlanRawSha256:pilotDigestV1(raw)},invalid=await createGenerationValidationAdapterV1({async loadForProposalRaw(){return JSON.stringify(rebound);}}).validate(a.requestOperationId,raw);
 assert.notEqual(invalid.status,'ACCEPTED');assert.ok(!('generatedPlanRaw' in invalid));
});
