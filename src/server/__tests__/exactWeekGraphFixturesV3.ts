/** Synthetic reviewed metadata, source events and warning assessments only. */
import {contentFixtureV4} from './exactMenuContentValidationFixturesV4';
import {raw,sha,id,copy} from './exactFoodNutritionFixturesV2';
import {sealBalanceFixtureV3} from './exactWeekNutritionValidationFixturesV3';
import {authorized,q} from './exactWeekNutritionFixturesV3';
import {createExactMenuContentValidationAdapterV4,type ExactMenuContentSourceV4} from '../exactMenuContentValidationV4';
import {exactGraphSlotSubjectsRawV3,exactWeekGraphSourceContractV3,type ExactWeekGraphSourceV3,type ExactGraphWarningsV3,type ExactOrdinaryWeekWitnessV3} from '../exactWeekGraphPreparationV3';
import {prepareExactWeekNutritionRawV3,exactWeekNutritionRequestDigestRawV3,type ExactWeekNutritionRequestV3} from '../exactWeekNutritionPreparationV3';
export const noSignals={softTargetFitDeviation:false,longPreparationBurden:false,shoppingListBurden:false,lowerConvenienceScore:false,repetitionApproachingLimit:false};
export async function graphSourceFixtureV3(operation:string,snapshotRaw:string,source:ExactMenuContentSourceV4,
 ordinary={snapshotRaw,sourceRaw:raw(source)}){
 const checked=await createExactMenuContentValidationAdapterV4({loadForProposalRaw:async()=>raw(source)},authorized).validate(operation,snapshotRaw);
 const numeric=JSON.parse(source.numericAuthorityRaw),input=JSON.parse(numeric.trustedGenerationInputRaw);
 const warnings:ExactGraphWarningsV3={contract:'potok-exact-graph-warning-evidence-v3',generationInputDigest:numeric.generationInputDigest,contentValidationDigest:checked.digest,
  validationPolicyRevision:input.validationPolicyRevision,entries:(await exactGraphSlotSubjectsRawV3(snapshotRaw,raw(source))).map((s,i)=>({slotId:s.slotId,slotSubjectDigest:s.subjectDigest,evidenceRevision:id(160000+i),signals:{...noSignals}}))};
 const witness:ExactOrdinaryWeekWitnessV3={contract:'potok-exact-ordinary-week-witness-v3',generationInputDigest:numeric.generationInputDigest,candidateManifestDigest:input.candidateManifestDigest,
  selectedSnapshotRawSha256:sha(snapshotRaw),ordinarySnapshotRaw:ordinary.snapshotRaw,ordinaryContentSourceRaw:ordinary.sourceRaw};
 const graphSource:ExactWeekGraphSourceV3={contract:exactWeekGraphSourceContractV3,requestOperationId:operation,evaluatedSnapshotRawSha256:sha(snapshotRaw),contentSourceRaw:raw(source),ordinaryFallbackRaw:raw(witness),warningEvidenceRaw:raw(warnings)};
 return {graphSource,warnings,witness};
}
export function warningPolicyFixtureV3(f:Awaited<ReturnType<typeof contentFixtureV4>>){
 const balance={...f.balance,allowedWarningCodes:['LONG_PREPARATION_BURDEN','LOWER_CONVENIENCE_SCORE','OPTIONAL_EXPENSIVE_USED','OPTIONAL_SPECIALTY_USED','REPETITION_LIMIT_APPROACHING','SHOPPING_LIST_BURDEN','SOFT_TARGET_FIT_DEVIATION'] as typeof f.balance.allowedWarningCodes};
 const numeric={...f.numeric,balancePolicySnapshotRaw:raw(sealBalanceFixtureV3(balance))},source={...f.source,numericAuthorityRaw:raw(numeric)};
 return {...f,balance,numeric,source};
}
export async function graphFixtureV3(){const f=warningPolicyFixtureV3(await contentFixtureV4());return {...f,...await graphSourceFixtureV3(f.operation,f.snapshotRaw,f.source)};}
export async function changedPortionFixtureV3(f:Awaited<ReturnType<typeof graphFixtureV3>>,amount=q('1','2'),secondChange=false){
 const request=copy(f.request) as ExactWeekNutritionRequestV3;
 const days=request.days.map((d,i)=>({...d,meals:d.meals.map((m,j)=>({...m,components:m.components.map((c,k)=>i===0&&j===0&&k===0||secondChange&&i===1&&j===0&&k===0?{...c,portion:{...c.portion,amount}}:c)}))}));
 const requestRaw=raw({...request,days}),requestDigest=await exactWeekNutritionRequestDigestRawV3(requestRaw);
 const prepared=await prepareExactWeekNutritionRawV3(requestRaw,requestDigest,f.numeric.recipeInputs,authorized);
 if(prepared.kind!=='PREPARED_EXACT_WEEK_INPUTS_V3')throw Error('fixture preparation failed');
 const snapshotRaw=raw(prepared.snapshot),source={...f.source,evaluatedSnapshotRawSha256:sha(snapshotRaw),numericAuthorityRaw:raw({...f.numeric,evaluatedSnapshotRawSha256:sha(snapshotRaw),weekRequestDigest:requestDigest,snapshotDigest:prepared.snapshot.digest})};
 return {snapshot:prepared.snapshot,snapshotRaw,source,...await graphSourceFixtureV3(f.operation,snapshotRaw,source,{snapshotRaw:f.snapshotRaw,sourceRaw:raw(f.source)})};
}
export async function repeatedFamilyReplacementFixtureV3(f:Awaited<ReturnType<typeof graphFixtureV3>>){
 const request={...f.request,recipes:f.request.recipes.slice(0,-1),days:f.request.days.map((d,i)=>i===6?{...d,meals:d.meals.map(m=>({...m,components:m.components.map(c=>({...c,recipeKey:'r0'}))}))}:d)};
 const requestRaw=raw(request),requestDigest=await exactWeekNutritionRequestDigestRawV3(requestRaw),inputs=f.numeric.recipeInputs.slice(0,-1);
 const prepared=await prepareExactWeekNutritionRawV3(requestRaw,requestDigest,inputs,authorized);if(prepared.kind!=='PREPARED_EXACT_WEEK_INPUTS_V3')throw Error();
 const snapshotRaw=raw(prepared.snapshot),bindings=f.bindings.map((b,i)=>{
  if(i!==6)return b;const review=JSON.parse(f.bindings[0].reviewMetadataRaw);review.mealComponentId=JSON.parse(b.reviewMetadataRaw).mealComponentId;
  return {...f.bindings[0],slotId:b.slotId,componentKey:b.componentKey,reviewMetadataRaw:raw(review)};
 });
 const source={...f.source,evaluatedSnapshotRawSha256:sha(snapshotRaw),bindingsRaw:raw(bindings),numericAuthorityRaw:raw({...f.numeric,recipeInputs:inputs,evaluatedSnapshotRawSha256:sha(snapshotRaw),weekRequestDigest:requestDigest,snapshotDigest:prepared.snapshot.digest})};
 return {snapshotRaw,source,...await graphSourceFixtureV3(f.operation,snapshotRaw,source,{snapshotRaw:f.snapshotRaw,sourceRaw:raw(f.source)})};
}
