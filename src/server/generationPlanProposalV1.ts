import {createGenerationDayOptionsV1, type GenerationPreparationWarningPortV1} from './generationDayOptionsV1';
import type {GenerationMenuCandidateSourcePortV1} from './generationMenuCandidatesV1';
import {createGenerationValidationAdapterV1, type GenerationValidationAuthorityPortV1} from './generationValidationAdapterV1';
import {decodeTrustedGenerationInputV1, sealAdaptiveNutritionGraphV2, bindGeneratedWeekPlanV1,
  adaptiveNutritionGraphContractV2, type AdaptiveNutritionGraphDraftV2, type GraphV2GeneratorDecisionEvidence} from '../utils/adaptiveNutritionGraphV2';
import {decodeAdaptiveNutritionCandidateManifestV2,decodeNutritionPreferenceSnapshotV1,decodeNutritionSafetySnapshotV1} from '../utils/adaptiveNutritionAuthoritiesV1';
import {decodeTrustedValidationEvidenceV1} from '../utils/trustedValidationEvidenceV1';
import {trustedValidationPoliciesRawBoundaryContractV2} from '../utils/trustedValidationPoliciesV1';
import {validateWeekSnapshotWithChildResultsRawV2, type WeekValidationInputV1} from '../utils/adaptiveNutritionMealBalanceV1';
import type {GraphNutritionV1} from '../utils/adaptiveNutritionGraphV1';
import {assertRawJsonWithoutDuplicateKeysV1,adaptiveNutritionSha256HexV1} from '../utils/adaptiveNutritionWireV1';

export const generationDecisionTraceContractV1='potok-generation-plan-decision-trace-v1' as const;
/** Existing producer decision metadata, not reviewer/policy/warning authority. Never fill absent digests with placeholders. */
export interface GenerationDecisionTracePortV1 {
  loadDecisionTraceRaw(requestOperationId:string,weekRawSha256:string):Promise<string|null>;
}
const uuid=/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/;
const hex=/^[0-9a-f]{64}$/;
const contextKeys=['contract','trustedGenerationInputRaw','candidateManifestRaw','preferenceSnapshotRaw','safetySnapshotRaw','trustedValidationEvidenceRaw'];
function parse(raw:string):unknown {
  if(typeof raw!=='string'||raw.length>8_000_000)throw Error('INVALID_PROJECTION_RAW');
  assertRawJsonWithoutDuplicateKeysV1(raw);return JSON.parse(raw);
}
function record(value:unknown,keys:readonly string[]):Record<string,unknown>{
  if(!value||typeof value!=='object'||Array.isArray(value)||Object.getPrototypeOf(value)!==Object.prototype
    ||Object.keys(value).length!==keys.length||!keys.every(k=>Object.prototype.hasOwnProperty.call(value,k)))throw Error('INVALID_PROJECTION_FIELDS');
  return value as Record<string,unknown>;
}
export async function generationProposalRawHashV1(raw:string):Promise<string>{
  if(typeof raw!=='string'||raw.length>8_000_000)throw Error('INVALID_PROJECTION_RAW');
  const bytes=new TextEncoder().encode(raw);
  if(new TextDecoder('utf-8',{fatal:true}).decode(bytes)!==raw)throw Error('INVALID_PROJECTION_UNICODE');
  return adaptiveNutritionSha256HexV1(bytes);
}
// Sum already decoded meal snapshots only; Graph V2 independently rechecks this total.
function total(meals:WeekValidationInputV1['days'][number]['meals']):GraphNutritionV1{
  return Object.fromEntries((['calories','protein','fat','carbs','fiber'] as const).map(key=>{
    const minor=meals.reduce((sum,m)=>sum+BigInt(m.validationInput.meal.nutrition[key].replace('.','')),0n);
    return [key,`${minor/1000n}.${String(minor%1000n).padStart(3,'0')}`];
  })) as unknown as GraphNutritionV1;
}

/** Mechanical proposal projection only. Caller source provenance and final independent validation remain mandatory. */
export async function projectGenerationWeekRawV1(requestOperationId:string,weekRaw:string,contextRaw:string,traceRaw:string){
  if(!uuid.test(requestOperationId))throw Error('INVALID_PROJECTION_REQUEST');
  const context=record(parse(contextRaw),contextKeys);
  if(context.contract!==trustedValidationPoliciesRawBoundaryContractV2||contextKeys.some(k=>typeof context[k]!=='string'))throw Error('INVALID_PROJECTION_CONTEXT');
  const owned={input:parse(context.trustedGenerationInputRaw as string),manifest:parse(context.candidateManifestRaw as string),
    preference:parse(context.preferenceSnapshotRaw as string),safety:parse(context.safetySnapshotRaw as string)};
  const evidenceValue=parse(context.trustedValidationEvidenceRaw as string);
  const weekValue=parse(weekRaw);
  const trace=record(parse(traceRaw),['contract','requestOperationId','weekRawSha256','slots','weekOptimizationResultDigest']);
  const input=decodeTrustedGenerationInputV1(owned.input);
  if(input.operation.requestId!==requestOperationId||trace.contract!==generationDecisionTraceContractV1
    ||trace.requestOperationId!==requestOperationId)throw Error('PROJECTION_REQUEST_MISMATCH');
  if(trace.weekRawSha256!==await generationProposalRawHashV1(weekRaw))throw Error('PROJECTION_WEEK_TRACE_MISMATCH');
  const manifest=await decodeAdaptiveNutritionCandidateManifestV2(owned.manifest);
  await decodeNutritionPreferenceSnapshotV1(owned.preference);await decodeNutritionSafetySnapshotV1(owned.safety);
  const evidence=await decodeTrustedValidationEvidenceV1(evidenceValue,owned);
  // Re-run the real validator to obtain actual child receipts; never trust a generator's VALID literal/digests.
  const results=await validateWeekSnapshotWithChildResultsRawV2(weekRaw,context.candidateManifestRaw as string);
  if(results.week.status!=='VALID'&&results.week.status!=='VALID_WITH_WARNINGS'){
    return Object.freeze({status:results.week.status==='BLOCKED_MISSING_EVIDENCE'?'BLOCKED_WEEK':'REJECTED_WEEK'} as const);
  }
  // Only our owned JSON already admitted by the strict V2 week boundary is projected.
  const week=weekValue as WeekValidationInputV1;
  if(week.weekAnchor!==input.weekStartLocal||week.timezone!==input.timezone||week.goalRevision!==input.goalNutritionTarget.goalRevision
    ||week.targetPolicyRevision!==input.goalNutritionTarget.targetPolicyRevision||week.planRevision!==input.selection.proposedPlanRevision
    ||week.compositionPolicyRevision!==input.compositionPolicyRevision||manifest.digest!==input.candidateManifestDigest)throw Error('PROJECTION_INPUT_MISMATCH');
  if(!Array.isArray(trace.slots)||!hex.test(trace.weekOptimizationResultDigest as string))throw Error('INVALID_PROJECTION_TRACE');
  const decisions=new Map<string,GraphV2GeneratorDecisionEvidence>();
  for(const value of trace.slots){
    const row=record(value,['slotId','generatorDecisionEvidence']);
    if(typeof row.slotId!=='string'||!uuid.test(row.slotId)||decisions.has(row.slotId))throw Error('INVALID_PROJECTION_TRACE_SLOT');
    // The existing Graph V2 decoder validates this exact decision DTO and all revision bindings below.
    decisions.set(row.slotId,row.generatorDecisionEvidence as GraphV2GeneratorDecisionEvidence);
  }
  if(decisions.size!==week.days.reduce((n,d)=>n+d.meals.length,0))throw Error('PROJECTION_TRACE_COVERAGE_MISMATCH');
  const days:AdaptiveNutritionGraphDraftV2['days']=week.days.map((day,dayIndex)=>{
    const checked=results.days[dayIndex];
    if(!checked||checked.date!==day.date)throw Error('PROJECTION_DAY_RECEIPT_MISMATCH');
    return {date:day.date,dayIndex,nutritionTotal:total(day.meals),validationResultDigest:checked.validation.subjectDigest,
      slots:day.meals.map(m=>{
        const decision=decisions.get(m.slotId);const receipt=checked.meals.find(r=>r.slotId===m.slotId);
        if(!decision||!receipt)throw Error('PROJECTION_TRACE_COVERAGE_MISMATCH');
        return {slotId:m.slotId,civilDate:day.date,mealType:m.mealType,sortOrder:m.sortOrder,sourceKind:m.validationInput.sourceKind,
          mealSnapshotRevision:m.validationInput.meal.mealSnapshotRevision,mealSnapshot:m.validationInput.meal,
          validationResultDigest:receipt.validation.subjectDigest,generatorDecisionEvidence:decision,
          goalRevision:input.goalNutritionTarget.goalRevision,targetPolicyRevision:input.goalNutritionTarget.targetPolicyRevision,
          compositionPolicyRevision:input.compositionPolicyRevision,validationPolicyRevision:input.validationPolicyRevision,
          optimizationPolicyRevision:input.optimizationPolicyRevision,catalogManifestRevision:input.candidateManifestRevision,
          componentEvidence:m.validationInput.meal.components.map(component=>{
            const e=evidence.components.find(v=>v.slotId===m.slotId&&v.mealComponentId===component.mealComponentId);
            if(!e)throw Error('PROJECTION_COMPONENT_BINDING_MISSING');
            return {mealComponentId:e.mealComponentId,eligibilityRevisionId:e.eligibilityRevisionId,publicationRevision:e.publicationRevision,
              canonicalEvidenceRevision:e.canonicalEvidenceRevision,nutritionEvidenceRevision:e.nutritionEvidenceRevision,
              allergenEvidenceRevision:e.allergenEvidenceRevision,dietaryEvidenceRevision:e.dietaryEvidenceRevision,evidenceDigest:e.digest};
          })};
      })};
  });
  const graph=await sealAdaptiveNutritionGraphV2({contract:adaptiveNutritionGraphContractV2,contractVersion:2,
    selectionId:input.selection.selectionId,planSelectionRevision:input.selection.planSelectionRevision,
    planRevision:input.selection.proposedPlanRevision,weekStartLocal:input.weekStartLocal,timezone:input.timezone,
    goalRevision:input.goalNutritionTarget.goalRevision,targetPolicyRevision:input.goalNutritionTarget.targetPolicyRevision,
    goalNutritionTarget:input.goalNutritionTarget,preferenceRevision:input.preferenceRevision,safetyRevision:input.safetyRevision,
    catalogManifestRevision:input.candidateManifestRevision,candidateManifestDigest:input.candidateManifestDigest,
    compositionPolicyRevision:input.compositionPolicyRevision,validationPolicyRevision:input.validationPolicyRevision,
    optimizationPolicyRevision:input.optimizationPolicyRevision,generationPolicyRevision:input.generationPolicyRevision,
    days,weekValidationResultDigest:results.week.subjectDigest,weekOptimizationResultDigest:trace.weekOptimizationResultDigest as string});
  const plan=await bindGeneratedWeekPlanV1(input,graph);
  const generatedPlanRaw=JSON.stringify(plan);
  if(generatedPlanRaw.length>8_000_000)throw Error('PROJECTION_PLAN_TOO_LARGE');
  return Object.freeze({status:'PROJECTED' as const,generatedPlanRaw});
}

/** Inactive read-only pipeline. No writer/activation port: validation acceptance is never a DB receipt. */
export function createValidatedGenerationProposalV1(sourcePort:GenerationMenuCandidateSourcePortV1,
  warningPort:GenerationPreparationWarningPortV1,decisionPort:GenerationDecisionTracePortV1,
  authorityPort:GenerationValidationAuthorityPortV1){
  return Object.freeze({async generate(requestOperationId:string,limitsRaw?:string){
    let preparationRaw:string|null=null;
    const prepared=await createGenerationDayOptionsV1({async loadPreparationRaw(id){
      preparationRaw=await sourcePort.loadPreparationRaw(id);return preparationRaw;
    }},warningPort).generate(requestOperationId,limitsRaw);
    if(prepared.status!=='FEASIBLE_PROPOSAL')return Object.freeze({status:'PREPARATION_STOPPED' as const,reason:prepared.status,requestOperationId});
    const source=JSON.parse(preparationRaw!) as {contextRaw:string}; // admitted by existing preparation boundary
    const traceRaw=await decisionPort.loadDecisionTraceRaw(requestOperationId,await generationProposalRawHashV1(prepared.week.weekRaw));
    if(traceRaw===null)return Object.freeze({status:'BLOCKED_DECISION_TRACE' as const,requestOperationId});
    const proposal=await projectGenerationWeekRawV1(requestOperationId,prepared.week.weekRaw,source.contextRaw,traceRaw);
    if(proposal.status!=='PROJECTED')return Object.freeze({status:proposal.status,requestOperationId});
    const checked=await createGenerationValidationAdapterV1(authorityPort).validate(requestOperationId,proposal.generatedPlanRaw);
    if(checked.status!=='ACCEPTED')return Object.freeze({status:'VALIDATION_STOPPED' as const,reason:checked.status,requestOperationId});
    return Object.freeze({status:'VALIDATED_PROPOSAL' as const,requestOperationId,generatedPlanRaw:checked.generatedPlanRaw,
      proposalRawSha256:checked.proposalRawSha256,validation:checked.validation});
  }});
}
