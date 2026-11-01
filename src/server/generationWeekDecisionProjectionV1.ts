import {generationDecisionTraceContractV1,type GenerationSelectionDecisionPortV1} from './generationPlanProposalV1';
import {generationSelectionReceiptContractV2,generationSelectionReceiptContractV3} from './generationDayOptionsV1';
import {generationWeekOptimizationResultContractV1,generationWeekOptimizationResultContractV2} from './generationWeekOptimizationV1';
import {decodeTrustedGenerationInputV1,type GraphV2GeneratorDecisionEvidence} from '../utils/adaptiveNutritionGraphV2';
import {decodeTrustedValidationEvidenceV1} from '../utils/trustedValidationEvidenceV1';
import {trustedValidationPoliciesRawBoundaryContractV2} from '../utils/trustedValidationPoliciesV1';
import {decodeOptimizationPolicyV1,validateWeekSnapshotRawV2,type WeekValidationInputV1} from '../utils/adaptiveNutritionMealBalanceV1';
import {assertRawJsonWithoutDuplicateKeysV1,canonicalJsonV1,adaptiveNutritionSha256HexV1} from '../utils/adaptiveNutritionWireV1';
const uuid=/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/;
const hex=/^[0-9a-f]{64}$/;
const contextKeys=['contract','trustedGenerationInputRaw','candidateManifestRaw','preferenceSnapshotRaw','safetySnapshotRaw','trustedValidationEvidenceRaw'];
const selectionKeys=['contract','requestOperationId','generationInputDigest','candidateManifestDigest','generationPolicyRevision',
  'validationEvidenceDigest','validationPoliciesDigest','scope','warningCoverage','budget','searchInputRawSha256','weekRawSha256',
  'evaluated','totalCombinations','optionIndexes','weekValidationResultDigest','pools','selectedSlots','weekOptimizationResultDigest','weekOptimizationReceiptRaw','digest'];
const optimizationKeys=['contract','requestOperationId','generationInputDigest','optimizationPolicyRevision','optimizationPolicy','candidateManifestDigest',
  'searchInputRawSha256','scope','evaluated','totalCombinations','maxEvaluations','evaluations','selectedWeekRawSha256','selectedOptionIndexes','selectedScore','digest'];
function parse(raw:string):unknown{
  if(typeof raw!=='string'||raw.length>8_000_000)throw Error('INVALID_WEEK_DECISION_RAW');
  assertRawJsonWithoutDuplicateKeysV1(raw);return JSON.parse(raw);
}
function record(value:unknown,keys:readonly string[]):Record<string,unknown>{
  if(!value||typeof value!=='object'||Array.isArray(value)||Object.getPrototypeOf(value)!==Object.prototype
    ||Object.keys(value).length!==keys.length||!keys.every(k=>Object.prototype.hasOwnProperty.call(value,k)))throw Error('INVALID_WEEK_DECISION_FIELDS');
  return value as Record<string,unknown>;
}
const canonical=(value:unknown)=>canonicalJsonV1(value,'SAFE_INTEGER');
async function hash(raw:string):Promise<string>{
  const bytes=new TextEncoder().encode(raw);
  if(new TextDecoder('utf-8',{fatal:true}).decode(bytes)!==raw)throw Error('INVALID_WEEK_DECISION_UNICODE');
  return adaptiveNutritionSha256HexV1(bytes);
}
const contentHash=(value:unknown)=>hash(canonical(value));
const same=(a:unknown,b:unknown)=>{if(canonical(a)!==canonical(b))throw Error('WEEK_DECISION_BINDING_MISMATCH');};
async function checkDigest(row:Record<string,unknown>,value:unknown){
  if(typeof row.digest!=='string'||!hex.test(row.digest)||row.digest!==await contentHash(value))throw Error('WEEK_DECISION_RECEIPT_DIGEST_MISMATCH');
}

/** Mechanical generator decision metadata from the actual owned weighted-search receipt.
 * The caller must obtain that receipt from the internal selector, never client/proposed
 * authority data. Hash checks bind content, not origin, approval or independent replay.
 * A slot receipt projects a globally chosen week; it does NOT claim local optimality.
 */
export async function projectGenerationWeekDecisionsRawV1(request:string,weekRaw:string,selectionRaw:string,contextRaw:string){
  if(typeof request!=='string'||!uuid.test(request))throw Error('INVALID_WEEK_DECISION_REQUEST');
  const weekOwned=parse(weekRaw),candidate=parse(selectionRaw) as Record<string,unknown>;
  const bounded=candidate?.contract===generationSelectionReceiptContractV3;
  const selection=record(candidate,[...selectionKeys,...(bounded?['comparison','selectedScore','selectedScoreBounds','unknownMetrics']:[])]);
  if(selection.contract!==(bounded?generationSelectionReceiptContractV3:generationSelectionReceiptContractV2))throw Error('WEEK_DECISION_WEIGHTED_RECEIPT_REQUIRED');
  const {digest:selectionDigest,...selectionContent}=selection;
  await checkDigest(selection,{contract:selection.contract,
    encoding:bounded?'potok-generation-selection-receipt-canonical-json-v3':'potok-generation-selection-receipt-canonical-json-v2',receipt:selectionContent});
  const context=record(parse(contextRaw),contextKeys);
  if(context.contract!==trustedValidationPoliciesRawBoundaryContractV2||contextKeys.some(k=>typeof context[k]!=='string'))throw Error('INVALID_WEEK_DECISION_CONTEXT');
  const owned={input:parse(context.trustedGenerationInputRaw as string),manifest:parse(context.candidateManifestRaw as string),
    preference:parse(context.preferenceSnapshotRaw as string),safety:parse(context.safetySnapshotRaw as string)};
  const input=decodeTrustedGenerationInputV1(owned.input);
  const evidence=await decodeTrustedValidationEvidenceV1(parse(context.trustedValidationEvidenceRaw as string),owned);
  const weekSha=await hash(weekRaw);
  if(input.operation.requestId!==request||selection.requestOperationId!==request||selection.weekRawSha256!==weekSha
    ||selection.generationInputDigest!==evidence.generationInputDigest||selection.candidateManifestDigest!==input.candidateManifestDigest
    ||selection.generationPolicyRevision!==input.generationPolicyRevision||selection.validationEvidenceDigest!==evidence.digest
    ||typeof selection.validationPoliciesDigest!=='string'||!hex.test(selection.validationPoliciesDigest))throw Error('WEEK_DECISION_BINDING_MISMATCH');
  const result=record(parse(selection.weekOptimizationReceiptRaw as string),[...optimizationKeys,
    ...(bounded?['comparison','selectedScoreBounds','unknownMetrics']:[])]);
  const contract=bounded?generationWeekOptimizationResultContractV2:generationWeekOptimizationResultContractV1;
  if(result.contract!==contract)throw Error('WEEK_DECISION_WEIGHTED_RECEIPT_REQUIRED');
  const {digest:optimizationDigest,...resultContent}=result;
  await checkDigest(result,{contract,encoding:bounded?'potok-generation-week-optimization-result-canonical-json-v2'
    :'potok-generation-week-optimization-result-canonical-json-v1',result:resultContent});
  const policy=decodeOptimizationPolicyV1(result.optimizationPolicy);
  if(result.requestOperationId!==request||result.generationInputDigest!==evidence.generationInputDigest
    ||result.optimizationPolicyRevision!==input.optimizationPolicyRevision||policy.policyRevision!==input.optimizationPolicyRevision
    ||result.candidateManifestDigest!==input.candidateManifestDigest||result.selectedWeekRawSha256!==weekSha
    ||optimizationDigest!==selection.weekOptimizationResultDigest)throw Error('WEEK_DECISION_BINDING_MISMATCH');
  for(const key of ['scope','evaluated','totalCombinations','searchInputRawSha256'])same(result[key],selection[key]);
  same(result.selectedOptionIndexes,selection.optionIndexes);
  const budget=record(selection.budget,['maxDayEvaluations','maxWeekEvaluations']);same(result.maxEvaluations,budget.maxWeekEvaluations);
  if(bounded){same(result.comparison,'ROBUST_CONVENIENCE_BOUNDS');same(selection.comparison,result.comparison);
    same(selection.selectedScore,result.selectedScore);same(selection.selectedScoreBounds,result.selectedScoreBounds);same(selection.unknownMetrics,result.unknownMetrics);}
  const validation=await validateWeekSnapshotRawV2(weekRaw,context.candidateManifestRaw as string);
  if((validation.status!=='VALID'&&validation.status!=='VALID_WITH_WARNINGS')||selection.weekValidationResultDigest!==validation.subjectDigest)
    throw Error('WEEK_DECISION_REQUIRES_VALID_WEEK');
  if(!Array.isArray(result.evaluations)||!Number.isSafeInteger(result.evaluated)||(result.evaluated as number)<1
    ||result.evaluations.length!==result.evaluated)throw Error('WEEK_DECISION_RESULT_LEDGER_MISMATCH');
  const evaluated=result.evaluations.filter(v=>v&&typeof v==='object'&&!Array.isArray(v)
    &&(v as Record<string,unknown>).weekRawSha256===weekSha) as Record<string,unknown>[];
  if(!evaluated.length||evaluated.some(v=>v.validationStatus!==validation.status||v.validationResultDigest!==validation.subjectDigest))
    throw Error('WEEK_DECISION_RESULT_LEDGER_MISMATCH');
  for(const v of evaluated){same(v.score,result.selectedScore);if(bounded){same(v.scoreBounds,result.selectedScoreBounds);same(v.unknownMetrics,result.unknownMetrics);}}
  const week=weekOwned as WeekValidationInputV1;
  if(week.weekAnchor!==input.weekStartLocal||week.timezone!==input.timezone||week.goalRevision!==input.goalNutritionTarget.goalRevision
    ||week.targetPolicyRevision!==input.goalNutritionTarget.targetPolicyRevision||week.planRevision!==input.selection.proposedPlanRevision
    ||week.compositionPolicyRevision!==input.compositionPolicyRevision)throw Error('WEEK_DECISION_BINDING_MISMATCH');
  if(!Array.isArray(selection.pools)||!Array.isArray(selection.selectedSlots))throw Error('INVALID_WEEK_DECISION_FIELDS');
  const pools=new Map<string,Record<string,unknown>>();
  for(const value of selection.pools){
    const pool=record(value,['contract','requestOperationId','generationInputDigest','slotId','candidates','admittedWarnings','candidateSetDigest']);
    if(pool.contract!=='potok-generation-slot-candidate-set-v1'||pool.requestOperationId!==request||pool.generationInputDigest!==evidence.generationInputDigest
      ||typeof pool.slotId!=='string'||!uuid.test(pool.slotId)||pools.has(pool.slotId)||!Array.isArray(pool.candidates)||!Array.isArray(pool.admittedWarnings))
      throw Error('WEEK_DECISION_POOL_MISMATCH');
    const {candidateSetDigest,...content}=pool;if(candidateSetDigest!==await contentHash(content))throw Error('WEEK_DECISION_POOL_MISMATCH');
    pools.set(pool.slotId,pool);
  }
  const chosen=new Map<string,Record<string,unknown>>();
  for(const value of selection.selectedSlots){
    const slot=record(value,['slotId','sourceKind','selectedCandidateDigest','candidateSetDigest']);
    if(typeof slot.slotId!=='string'||chosen.has(slot.slotId))throw Error('WEEK_DECISION_SLOT_MISMATCH');chosen.set(slot.slotId,slot);
  }
  const expected=evidence.distributionPolicy.days.flatMap(d=>d.requiredSlots);
  if(chosen.size!==expected.length||pools.size!==expected.length||expected.some(s=>!chosen.has(s.slotId)||!pools.has(s.slotId)))throw Error('WEEK_DECISION_SLOT_MISMATCH');
  const slots:{slotId:string;generatorDecisionEvidence:GraphV2GeneratorDecisionEvidence}[]=[],slotDecisionReceiptsRaw:string[]=[];
  const seen=new Set<string>();
  for(const meal of week.days.flatMap(d=>d.meals)){
    const selected=chosen.get(meal.slotId),pool=pools.get(meal.slotId);
    if(!selected||!pool||seen.has(meal.slotId)||selected.sourceKind!==meal.validationInput.sourceKind
      ||selected.selectedCandidateDigest!==meal.validationInput.meal.digest||selected.candidateSetDigest!==pool.candidateSetDigest)
      throw Error('WEEK_DECISION_SLOT_MISMATCH');
    const member=(pool.candidates as unknown[]).map(v=>record(v,['mealSnapshotDigest','sourceKind','isolatedCompositionScore']))
      .some(v=>v.mealSnapshotDigest===meal.validationInput.meal.digest&&v.sourceKind===meal.validationInput.sourceKind);
    const admitted=(pool.admittedWarnings as unknown[]).map(v=>record(v,['mealSnapshotDigest','warningEvidenceDigest']))
      .some(v=>v.mealSnapshotDigest===meal.validationInput.meal.digest&&typeof v.warningEvidenceDigest==='string'&&hex.test(v.warningEvidenceDigest));
    if(!member||!admitted)throw Error('WEEK_DECISION_POOL_MEMBERSHIP_REQUIRED');seen.add(meal.slotId);
    const content={contract:'potok-generation-slot-week-decision-v1',scope:'PROJECTED_FROM_WEEK_COMPARISON',requestOperationId:request,
      generationInputDigest:evidence.generationInputDigest,generationPolicyRevision:input.generationPolicyRevision,
      optimizationPolicyRevision:input.optimizationPolicyRevision,candidateManifestDigest:input.candidateManifestDigest,slotId:meal.slotId,
      decisionPath:meal.validationInput.sourceKind,candidateSetDigest:pool.candidateSetDigest,selectedCandidateDigest:meal.validationInput.meal.digest,
      weekRawSha256:weekSha,weekOptimizationResultDigest:optimizationDigest,selectionReceiptDigest:selectionDigest};
    const digest=await contentHash({contract:content.contract,encoding:'potok-generation-slot-week-decision-canonical-json-v1',decision:content});
    slotDecisionReceiptsRaw.push(canonical({...content,digest}));
    slots.push({slotId:meal.slotId,generatorDecisionEvidence:{decisionPath:meal.validationInput.sourceKind,generationPolicyRevision:input.generationPolicyRevision,
      candidateManifestDigest:input.candidateManifestDigest,candidateSetDigest:pool.candidateSetDigest as string,
      selectedCandidateDigest:meal.validationInput.meal.digest,optimizationResultDigest:optimizationDigest as string}});
  }
  if(seen.size!==expected.length)throw Error('WEEK_DECISION_SLOT_MISMATCH');
  return Object.freeze({traceRaw:canonical({contract:generationDecisionTraceContractV1,requestOperationId:request,
    weekRawSha256:weekSha,slots,weekOptimizationResultDigest:optimizationDigest}),slotDecisionReceiptsRaw:Object.freeze(slotDecisionReceiptsRaw)});
}

/** Actual generator metadata producer; no source admission, SQL, writer or activation. */
export function createWeekDecisionProjectionPortV1():GenerationSelectionDecisionPortV1{
  return Object.freeze({async produceDecisionTraceRaw(request:string,weekRaw:string,selectionRaw:string,contextRaw:string){
    return (await projectGenerationWeekDecisionsRawV1(request,weekRaw,selectionRaw,contextRaw)).traceRaw;
  }});
}
