/** Inactive exact week selection. Raw server dependencies establish provenance; hashes alone do not. */
import {canonicalJsonV1,adaptiveNutritionSha256HexV1} from '../utils/adaptiveNutritionWireV1';
import {decodeOptimizationPolicyV1} from '../utils/adaptiveNutritionMealBalanceV1';
import {decodeTrustedGenerationInputRawV1,trustedGenerationInputDigestV1} from '../utils/adaptiveNutritionGraphV2';
import {decodeExactScalarV2,exactScalarFromDecimalV2,addExactScalarsV2,multiplyExactScalarsV2,compareExactScalarsV2,type ExactScalarV2} from '../utils/exactNutritionValuesV2';
import {parseExactValidationJsonRawV3 as parse,decodeExactWeekNumericAuthorityRawV3} from './exactWeekNutritionValidationV3';
import {createExactWeekGraphPreparationV3,type ExactWeekGraphV3} from './exactWeekGraphPreparationV3';
import type {GenerationValidationAuthorityPortV1} from './generationValidationAdapterV1';
import type {ExactTypedRecipeAuthorityV3} from './exactTypedRecipePreparationV3';
export const exactWeekOptimizationPoolContractV3='potok-exact-week-optimization-pool-v3' as const;
export const exactWeekMetricsContractV3='potok-exact-week-metrics-v3' as const;
export const exactWeekOptimizationReceiptContractV3='potok-exact-week-optimization-receipt-v3' as const;
export const exactGeneratedWeekProposalContractV3='potok-exact-generated-week-proposal-v3' as const;
export type ExactWeekOptimizationModeV3='STRICT'|'ROBUST_CONVENIENCE_BOUNDS';
export interface ExactWeekOptimizationPoolV3 {
 contract:typeof exactWeekOptimizationPoolContractV3;requestOperationId:string;trustedGenerationInputRaw:string;
 optimizationPolicyRaw:string;mode:ExactWeekOptimizationModeV3;maxEvaluations:number;
 candidates:readonly {snapshotRaw:string;snapshotRawSha256:string}[];
}
export interface ExactWeekOptimizationPoolPortV3 {loadForOperationRaw(requestOperationId:string):Promise<string|null>}
export interface ExactWeekMetricsPortV3 {
 assessGraphRaw(operation:string,graphRaw:string,generationInputDigest:string,optimizationPolicyRaw:string):Promise<string|null>;
}
export type ExactWeekMetricsV3=Readonly<Record<'targetFit'|'diversity'|'convenience'|'shoppingReuse',ExactScalarV2|null>>;
export interface ExactWeekMetricAssessmentV3 {
 contract:typeof exactWeekMetricsContractV3;requestOperationId:string;generationInputDigest:string;
 graphDigest:string;graphRawSha256:string;evaluatedSnapshotRawSha256:string;optimizationPolicyRevision:string;
 optimizationPolicyRawSha256:string;assessmentRevision:string;metrics:ExactWeekMetricsV3;
}
export interface ExactWeekScoreBoundsV3 {
 readonly score:ExactScalarV2|null;readonly minimum:ExactScalarV2;readonly maximum:ExactScalarV2;readonly unknownMetrics:readonly 'convenience'[];
}
export const exactSelectionRemainingChecksV3=Object.freeze(['AUTH_PREMIUM_CURRENTNESS_SOURCE_ISSUANCE_AND_TRANSACTIONAL_STORAGE_READBACK'] as const);
export interface ExactGeneratedWeekProposalV3 {
 readonly contract:typeof exactGeneratedWeekProposalContractV3;readonly authority:'NONE';readonly accepted:false;readonly canRecord:false;readonly canActivate:false;
 readonly requestOperationId:string;readonly generationInputDigest:string;readonly graph:ExactWeekGraphV3;readonly selectedSnapshotRaw:string;
 readonly optimizationReceiptRaw:string;readonly optimizationResultDigest:string;
 readonly decisionEvidence:{readonly generationPolicyRevision:string;readonly candidateManifestDigest:string;readonly candidatePoolDigest:string;
  readonly selectedSnapshotRawSha256:string;readonly selectedGraphDigest:string;readonly optimizationResultDigest:string;
  readonly slots:readonly {slotId:string;decisionPath:ExactWeekGraphV3['days'][number]['slots'][number]['sourceKind'];selectedSlotSubjectDigest:string}[]};
 readonly facts:readonly [];readonly remainingChecks:typeof exactSelectionRemainingChecksV3;readonly digest:string;
}
export type ExactWeekOptimizationResultV3={readonly status:'EXACT_WEEK_SELECTED_PENDING_STORAGE_ADMISSION';readonly proposal:ExactGeneratedWeekProposalV3}
 |{readonly status:'BLOCKED'|'SEARCH_LIMIT_REACHED'|'NO_FEASIBLE_WEEK_IN_PROVIDED_POOL';readonly reason:string;
  readonly evaluated:number;readonly totalCandidates:number;readonly accepted:false;readonly canRecord:false;readonly canActivate:false};
const metricKeys=['targetFit','diversity','convenience','shoppingReuse'] as const;
const uuid=/^[a-f0-9]{8}-[a-f0-9]{4}-[1-8][a-f0-9]{3}-[89ab][a-f0-9]{3}-[a-f0-9]{12}$/,hex=/^[a-f0-9]{64}$/;
const zero:ExactScalarV2=Object.freeze({numerator:'0',denominator:'1'}),one:ExactScalarV2=Object.freeze({numerator:'1',denominator:'1'});
function fail(reason='SOURCE_INVALID_OR_CHANGED'):never{throw Error(reason);}
function record(value:unknown,keys:readonly string[]):Record<string,unknown>{if(!value||typeof value!=='object'||Array.isArray(value)||Object.keys(value).length!==keys.length||keys.some(k=>!Object.prototype.hasOwnProperty.call(value,k)))fail();return value as Record<string,unknown>;}
function text(v:unknown):string{if(typeof v!=='string')fail();return v;}
function id(v:unknown):string{const s=text(v);if(!uuid.test(s))fail();return s;}
function hash(v:unknown):string{const s=text(v);if(!hex.test(s))fail();return s;}
function mode(v:unknown):ExactWeekOptimizationModeV3{if(v!=='STRICT'&&v!=='ROBUST_CONVENIENCE_BOUNDS')fail();return v;}
function freeze<T>(v:T):T{if(v&&typeof v==='object'){Object.values(v).forEach(freeze);Object.freeze(v);}return v;}
const canonical=(v:unknown)=>canonicalJsonV1(v,'SAFE_INTEGER');
const sha=(s:string)=>adaptiveNutritionSha256HexV1(new TextEncoder().encode(s));
const digest=(domain:string,payload:unknown)=>sha(canonical({domain,payload}));
/** Pure rational weighting only. This function is neither metric assessment nor approval. */
export function evaluateExactWeekScoreRawV3(policyRaw:string,metricsRaw:string,comparison:ExactWeekOptimizationModeV3):ExactWeekScoreBoundsV3 {
 const policy=decodeOptimizationPolicyV1(parse(policyRaw,65536,8)),values=record(parse(metricsRaw,65536,8),metricKeys);mode(comparison);
 let minimum=zero;const unknownMetrics:'convenience'[]=[];
 for(const key of metricKeys){
  if(values[key]===null){if(key!=='convenience'||comparison==='STRICT')fail('METRICS_UNAVAILABLE');unknownMetrics.push('convenience');continue;}
  const value=decodeExactScalarV2(values[key]);if(compareExactScalarsV2(value,one)>0)fail('METRIC_OUTSIDE_UNIT_INTERVAL');
  minimum=addExactScalarsV2(minimum,multiplyExactScalarsV2(value,exactScalarFromDecimalV2(policy.weights[key])));
 }
 const maximum=unknownMetrics.length?addExactScalarsV2(minimum,exactScalarFromDecimalV2(policy.weights.convenience)):minimum;
 return freeze({score:unknownMetrics.length?null:minimum,minimum,maximum,unknownMetrics});
}
interface Evaluation {snapshotRawSha256:string;validationStatus:string;validationResultDigest:string;graphDigest:string|null;
 warningRank:0|1|null;metricAssessmentRawSha256:string|null;assessmentRevision:string|null;bounds:ExactWeekScoreBoundsV3|null}
interface Candidate {index:number;sha:string;graph:ExactWeekGraphV3;rank:0|1;bounds:ExactWeekScoreBoundsV3}
/** Operation-only entry. Pool, graph authorities and metrics are independently loaded server dependencies. */
export function createExactWeekOptimizationV3(poolPort:ExactWeekOptimizationPoolPortV3,graphPort:GenerationValidationAuthorityPortV1,
 metricPort:ExactWeekMetricsPortV3,eventAuthority:ExactTypedRecipeAuthorityV3){
 async function optimize(operation:string):Promise<ExactWeekOptimizationResultV3>{
  let evaluated=0,totalCandidates=0;
  const blocked=(reason:string,status:'BLOCKED'|'SEARCH_LIMIT_REACHED'|'NO_FEASIBLE_WEEK_IN_PROVIDED_POOL'='BLOCKED'):ExactWeekOptimizationResultV3=>freeze({status,reason,evaluated,totalCandidates,accepted:false,canRecord:false,canActivate:false});
  try{
   id(operation);const sourceRaw=await poolPort.loadForOperationRaw(operation);if(sourceRaw===null)return blocked('POOL_UNAVAILABLE');
   const source=record(parse(sourceRaw,16_777_216,24),['contract','requestOperationId','trustedGenerationInputRaw','optimizationPolicyRaw','mode','maxEvaluations','candidates']);
   if(source.contract!==exactWeekOptimizationPoolContractV3||source.requestOperationId!==operation)fail();
   const inputRaw=text(source.trustedGenerationInputRaw),policyRaw=text(source.optimizationPolicyRaw);parse(inputRaw,262144,12);
   const input=decodeTrustedGenerationInputRawV1(inputRaw),policy=decodeOptimizationPolicyV1(parse(policyRaw,65536,8)),comparison=mode(source.mode);
   if(input.operation.requestId!==operation||policy.policyRevision!==input.optimizationPolicyRevision)fail('POOL_INPUT_OR_POLICY_MISMATCH');
   if(!Number.isSafeInteger(source.maxEvaluations)||(source.maxEvaluations as number)<1||(source.maxEvaluations as number)>64)fail('EVALUATION_BUDGET_INVALID');
   if(!Array.isArray(source.candidates)||!source.candidates.length||source.candidates.length>64)fail('POOL_COVERAGE_INVALID');
   const candidates=source.candidates.map(v=>{const c=record(v,['snapshotRaw','snapshotRawSha256']),raw=text(c.snapshotRaw);parse(raw,262144,12);return {snapshotRaw:raw,snapshotRawSha256:hash(c.snapshotRawSha256)};});
   totalCandidates=candidates.length;const semantic=new Set<string>(),rawHashes=new Set<string>();
   for(const c of candidates){if(await sha(c.snapshotRaw)!==c.snapshotRawSha256||rawHashes.has(c.snapshotRawSha256))fail('POOL_CANDIDATE_BYTES_CHANGED_OR_DUPLICATED');rawHashes.add(c.snapshotRawSha256);
    const value=parse(c.snapshotRaw,262144,12) as Record<string,unknown>,key=hash(value.digest);if(semantic.has(key))fail('POOL_CANDIDATE_SEMANTIC_DUPLICATE');semantic.add(key);}
   const inputDigest=await trustedGenerationInputDigestV1(input),policyHash=await sha(policyRaw);
   const poolDigest=await digest('potok-exact-week-candidate-pool-sha256-v3',{generationInputDigest:inputDigest,optimizationPolicyRawSha256:policyHash,comparison,maxEvaluations:source.maxEvaluations,candidateSnapshotRawSha256s:candidates.map(c=>c.snapshotRawSha256)});
   const evaluations:Evaluation[]=[],valid:Candidate[]=[];let commonContext:string|null=null;const publicationDefinitions=new Map<string,string>();const limit=Math.min(source.maxEvaluations as number,totalCandidates);let best:Candidate|null=null;
   for(let index=0;index<limit;index++){
    evaluated=index+1;const c=candidates[index],captured:{raw:string|null}={raw:null};
    const graphs=createExactWeekGraphPreparationV3({loadForProposalRaw:async(op,subject)=>{const raw=await graphPort.loadForProposalRaw(op,subject);captured.raw=raw;return raw;}},eventAuthority);
    const checked=await graphs.prepare(operation,c.snapshotRaw);
    if(checked.status==='BLOCKED')return blocked('CANDIDATE_EVIDENCE_UNAVAILABLE_OR_CHANGED');
    const loaded=record(parse(text(captured.raw),16_777_216,24),['contract','requestOperationId','evaluatedSnapshotRawSha256','contentSourceRaw','ordinaryFallbackRaw','warningEvidenceRaw']);
    const content=record(parse(text(loaded.contentSourceRaw),16_777_216,24),['contract','requestOperationId','evaluatedSnapshotRawSha256','numericAuthorityRaw','preferenceRaw','safetyRaw','compositionPolicySnapshotRaw','bindingsRaw','mealModes']);
    const numeric=decodeExactWeekNumericAuthorityRawV3(text(content.numericAuthorityRaw));
    if(canonical(decodeTrustedGenerationInputRawV1(numeric.trustedGenerationInputRaw))!==canonical(input))fail('CANDIDATE_INPUT_MISMATCH');
    const currentContext=canonical({preferenceRaw:content.preferenceRaw,safetyRaw:content.safetyRaw,compositionPolicySnapshotRaw:content.compositionPolicySnapshotRaw,
     currentGoalTargetRaw:numeric.currentGoalTargetRaw,balancePolicySnapshotRaw:numeric.balancePolicySnapshotRaw,distributionPolicyRaw:numeric.distributionPolicyRaw});
    if(commonContext!==null&&commonContext!==currentContext)fail('CANDIDATE_CONTEXT_DRIFT');commonContext=currentContext;
    const entry:Evaluation={snapshotRawSha256:c.snapshotRawSha256,validationStatus:checked.status,validationResultDigest:await digest('potok-exact-week-candidate-validation-sha256-v3',checked),graphDigest:null,warningRank:null,metricAssessmentRawSha256:null,assessmentRevision:null,bounds:null};
    if(checked.status==='EXACT_GRAPH_PREPARED_PENDING_OPTIMIZATION'){
     const graph=checked.graph;if(graph.generationInputDigest!==inputDigest||canonical(graph.input)!==canonical(input))fail('CANDIDATE_INPUT_MISMATCH');
     for(const binding of graph.days.flatMap(d=>d.slots.flatMap(s=>s.publicationBindings))){
      const {mealComponentId,...review}=JSON.parse(binding.reviewMetadataRaw) as Record<string,unknown>;void mealComponentId;
      const definition=canonical({...binding,slotId:null,componentKey:null,recipeKey:null,reviewMetadataRaw:null,review});
      for(const key of ['recipe:'+binding.recipeId,'revision:'+text(review.recipeRevision)]){
       if(publicationDefinitions.has(key)&&publicationDefinitions.get(key)!==definition)fail('CANDIDATE_PUBLICATION_DRIFT');publicationDefinitions.set(key,definition);
      }
     }
     const graphRaw=canonical(graph),assessmentRaw=await metricPort.assessGraphRaw(operation,graphRaw,inputDigest,policyRaw);
     if(assessmentRaw===null)return blocked('METRICS_UNAVAILABLE');
     const assessment=record(parse(assessmentRaw,65536,10),['contract','requestOperationId','generationInputDigest','graphDigest','graphRawSha256','evaluatedSnapshotRawSha256','optimizationPolicyRevision','optimizationPolicyRawSha256','assessmentRevision','metrics']);
     if(assessment.contract!==exactWeekMetricsContractV3||assessment.requestOperationId!==operation||assessment.generationInputDigest!==inputDigest||assessment.graphDigest!==graph.digest||assessment.graphRawSha256!==await sha(graphRaw)
       ||assessment.evaluatedSnapshotRawSha256!==c.snapshotRawSha256||assessment.optimizationPolicyRevision!==policy.policyRevision||assessment.optimizationPolicyRawSha256!==policyHash)fail('METRICS_BINDING_MISMATCH');
     const bounds=evaluateExactWeekScoreRawV3(policyRaw,canonical(assessment.metrics),comparison),rank:0|1=graph.days.some(d=>d.slots.some(s=>s.warnings.length>0))?1:0;
     entry.graphDigest=graph.digest;entry.warningRank=rank;entry.metricAssessmentRawSha256=await sha(assessmentRaw);entry.assessmentRevision=id(assessment.assessmentRevision);entry.bounds=bounds;
     const value:Candidate={index,sha:c.snapshotRawSha256,graph,rank,bounds};valid.push(value);
     if(!best||rank<best.rank||rank===best.rank&&(compareExactScalarsV2(bounds.minimum,best.bounds.minimum)>0||compareExactScalarsV2(bounds.minimum,best.bounds.minimum)===0&&value.sha<best.sha))best=value;
    }
    evaluations.push(entry);
   }
   if(!best)return blocked(limit<totalCandidates?'UNEVALUATED_CANDIDATES_REMAIN':'ALL_PROVIDED_CANDIDATES_REJECTED',limit<totalCandidates?'SEARCH_LIMIT_REACHED':'NO_FEASIBLE_WEEK_IN_PROVIDED_POOL');
   const winner=best;
   if(!valid.every(c=>c.rank!==winner.rank||c.index===winner.index||compareExactScalarsV2(winner.bounds.minimum,c.bounds.maximum)>0||compareExactScalarsV2(winner.bounds.minimum,c.bounds.maximum)===0&&winner.sha<c.sha))return blocked('OPTIMIZATION_UNCERTAINTY');
   const receiptPayload={contract:exactWeekOptimizationReceiptContractV3,requestOperationId:operation,generationInputDigest:inputDigest,optimizationPolicy:policy,optimizationPolicyRawSha256:policyHash,
    poolSourceRawSha256:await sha(sourceRaw),candidatePoolDigest:poolDigest,comparison,scope:limit===totalCandidates?'BEST_IN_VALIDATED_POOL' as const:'BEST_EVALUATED_PREFIX' as const,
    evaluated,totalCandidates,maxEvaluations:source.maxEvaluations,evaluations,selectedCandidateIndex:winner.index,selectedSnapshotRawSha256:winner.sha,selectedGraphDigest:winner.graph.digest,selectedScoreBounds:winner.bounds};
   const optimizationResultDigest=await digest('potok-exact-week-optimization-receipt-sha256-v3',receiptPayload),optimizationReceiptRaw=canonical({...receiptPayload,digest:optimizationResultDigest});
   const decisionEvidence={generationPolicyRevision:input.generationPolicyRevision,candidateManifestDigest:input.candidateManifestDigest,candidatePoolDigest:poolDigest,selectedSnapshotRawSha256:winner.sha,
    selectedGraphDigest:winner.graph.digest,optimizationResultDigest,slots:winner.graph.days.flatMap(d=>d.slots.map(s=>({slotId:s.slotId,decisionPath:s.sourceKind,selectedSlotSubjectDigest:s.subjectDigest})))};
   const payload={contract:exactGeneratedWeekProposalContractV3,authority:'NONE' as const,accepted:false as const,canRecord:false as const,canActivate:false as const,requestOperationId:operation,generationInputDigest:inputDigest,
    graph:winner.graph,selectedSnapshotRaw:candidates[winner.index].snapshotRaw,optimizationReceiptRaw,optimizationResultDigest,decisionEvidence,facts:[] as [],remainingChecks:exactSelectionRemainingChecksV3};
   const proposal=freeze({...payload,digest:await digest('potok-exact-generated-week-proposal-sha256-v3',payload)});
   if(new TextEncoder().encode(canonical(proposal)).length>2_097_152)fail('PROPOSAL_OUTPUT_BUDGET_EXCEEDED');
   return freeze({status:'EXACT_WEEK_SELECTED_PENDING_STORAGE_ADMISSION',proposal});
  }catch(error){return blocked(error instanceof Error&&/^(POOL_|EVALUATION_|CANDIDATE_|METRIC|SOURCE_|PROPOSAL_)/.test(error.message)?error.message:'OPTIMIZATION_SOURCE_INVALID_OR_UNAVAILABLE');}
 }
 async function readback(operation:string,proposalRaw:string):Promise<ExactWeekOptimizationResultV3>{
  let value:unknown;try{value=parse(proposalRaw,2_097_152,28);}catch{return freeze({status:'BLOCKED',reason:'PROPOSAL_READBACK_INVALID',evaluated:0,totalCandidates:0,accepted:false,canRecord:false,canActivate:false});}
  const result=await optimize(operation);if(result.status!=='EXACT_WEEK_SELECTED_PENDING_STORAGE_ADMISSION')return result;
  if(canonical(value)!==canonical(result.proposal))return freeze({status:'BLOCKED',reason:'PROPOSAL_READBACK_CHANGED',evaluated:0,totalCandidates:0,accepted:false,canRecord:false,canActivate:false});return result;
 }
 return Object.freeze({optimize,readback});
}
