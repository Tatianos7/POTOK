import {decodeOptimizationPolicyV1,decodeBalancePolicyV1,validateWeekSnapshotRawV2,weekValidatorInputContractV2,
  type ValidatorResultV1} from '../utils/adaptiveNutritionMealBalanceV1';
import {decodeTrustedGenerationInputRawV1,trustedGenerationInputDigestV1} from '../utils/adaptiveNutritionGraphV2';
import {decodeAdaptiveNutritionCandidateManifestV2} from '../utils/adaptiveNutritionAuthoritiesV1';
import {adaptiveNutritionSha256HexV1,assertRawJsonWithoutDuplicateKeysV1,canonicalJsonV1} from '../utils/adaptiveNutritionWireV1';
import {generationWeekSearchContractV1,type GenerationWeekSearchResultV1} from './generationWeekSearchV1';

export const generationWeekMetricsContractV1='potok-generation-week-metrics-v1';
export const generationWeekOptimizationResultContractV1='potok-generation-week-optimization-result-v1';
export interface GenerationWeekMetricsPortV1 {
  /** Independently sourced metrics for this exact week/input/policy. Null means unknown.
   * No proposed authority, fabricated convenience score or default assessment revision.
   */
  assessWeekRaw(requestOperationId:string,weekRaw:string,generationInputDigest:string,optimizationPolicyRaw:string):Promise<string|null>;
}
export interface GenerationWeekOptimizationConfigV1 {
  readonly policyRaw:string;readonly metrics:GenerationWeekMetricsPortV1;
}
type Feasible=Extract<GenerationWeekSearchResultV1,{status:'FEASIBLE_PROPOSAL'}>;
export type GenerationWeekOptimizationResultV1=(Feasible&{
  scope:'BEST_IN_VALIDATED_POOL'|'BEST_EVALUATED_PREFIX';score:string;
  optimizationReceiptRaw:string;optimizationResultDigest:string;
})|Exclude<GenerationWeekSearchResultV1,Feasible>|Readonly<{
  status:'BLOCKED_OPTIMIZATION_METRICS';evaluated:number;totalCombinations:number;
}>;
const metricKeys=['targetFit','diversity','convenience','shoppingReuse'] as const;
const uuid=/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/;
function parse(raw:string):unknown{
  if(typeof raw!=='string'||raw.length>8_000_000)throw Error('INVALID_WEEK_OPTIMIZATION_RAW');
  assertRawJsonWithoutDuplicateKeysV1(raw);return JSON.parse(raw);
}
function record(value:unknown,keys:readonly string[]):Record<string,unknown>{
  if(!value||typeof value!=='object'||Array.isArray(value)||Object.getPrototypeOf(value)!==Object.prototype
    ||Object.keys(value).length!==keys.length||!keys.every(k=>Object.prototype.hasOwnProperty.call(value,k)))
    throw Error('INVALID_WEEK_OPTIMIZATION_FIELDS');
  return value as Record<string,unknown>;
}
function freeze<T>(value:T):T{
  if(value&&typeof value==='object'){Object.values(value).forEach(freeze);Object.freeze(value);}return value;
}
const rawHash=(raw:string)=>{
  const bytes=new TextEncoder().encode(raw);
  if(new TextDecoder('utf-8',{fatal:true}).decode(bytes)!==raw)throw Error('INVALID_WEEK_OPTIMIZATION_UNICODE');
  return adaptiveNutritionSha256HexV1(bytes);
};
const contentHash=(value:unknown)=>rawHash(canonicalJsonV1(value,'SAFE_INTEGER'));
function minor(value:unknown):bigint{
  if(typeof value!=='string'||!/^(?:0\.[0-9]{3}|1\.000)$/.test(value))throw Error('INVALID_WEEK_OPTIMIZATION_METRIC');
  return BigInt(value.replace('.',''));
}
const decimal=(value:bigint)=>`${value/1000n}.${String(value%1000n).padStart(3,'0')}`;
interface Evaluation {weekRawSha256:string;validationStatus:string;validationResultDigest:string;
  score:string|null;metricAssessmentRawSha256:string|null;assessmentRevision:string|null;}

/** Bounded, deterministic weighted comparison of actual validated weeks. Raw input and
 * manifest use the existing search contract; optimization policy and metrics are explicit.
 * This never returns database acceptance or independently admits its metric source.
 */
export async function optimizeGenerationWeekRawV1(searchRaw:string,pinnedManifestRaw:string,
  policyRaw:string,trustedInputRaw:string,metricsPort:GenerationWeekMetricsPortV1):Promise<GenerationWeekOptimizationResultV1>{
  const search=record(parse(searchRaw),['contract','weekHeader','dayOptions','maxEvaluations']);
  const manifestOwned=parse(pinnedManifestRaw);const policy=decodeOptimizationPolicyV1(parse(policyRaw));
  const input=decodeTrustedGenerationInputRawV1(trustedInputRaw);
  if(search.contract!==generationWeekSearchContractV1)throw Error('UNSUPPORTED_WEEK_OPTIMIZATION_SEARCH');
  const header=record(search.weekHeader,['contract','weekAnchor','timezone','goalRevision','targetPolicyRevision',
    'planRevision','compositionPolicyRevision','balancePolicy','ordinaryFallbackProof']);
  const balance=decodeBalancePolicyV1(header.balancePolicy);
  if(header.contract!==weekValidatorInputContractV2||header.weekAnchor!==input.weekStartLocal||header.timezone!==input.timezone
    ||header.goalRevision!==input.goalNutritionTarget.goalRevision||header.targetPolicyRevision!==input.goalNutritionTarget.targetPolicyRevision
    ||header.planRevision!==input.selection.proposedPlanRevision||header.compositionPolicyRevision!==input.compositionPolicyRevision
    ||policy.policyRevision!==input.optimizationPolicyRevision||balance.policyRevision!==input.validationPolicyRevision)
    throw Error('WEEK_OPTIMIZATION_INPUT_MISMATCH');
  if(!Number.isSafeInteger(search.maxEvaluations)||(search.maxEvaluations as number)<1||(search.maxEvaluations as number)>1024)
    throw Error('INVALID_WEEK_OPTIMIZATION_BUDGET');
  if(!Array.isArray(search.dayOptions)||search.dayOptions.length!==7)throw Error('WEEK_OPTIMIZATION_REQUIRES_SEVEN_DAYS');
  const options=search.dayOptions.map(day=>{
    if(!Array.isArray(day)||day.length<1||day.length>16)throw Error('INVALID_WEEK_OPTIMIZATION_DAY_POOL');return day;
  });
  // Own all raw snapshots before await; source adapters receive immutable strings only.
  const manifest=await decodeAdaptiveNutritionCandidateManifestV2(manifestOwned);
  if(manifest.digest!==input.candidateManifestDigest||manifest.manifestRevision!==input.candidateManifestRevision)
    throw Error('WEEK_OPTIMIZATION_MANIFEST_MISMATCH');
  const generationInputDigest=await trustedGenerationInputDigestV1(input);
  const totalCombinations=options.reduce((n,pool)=>n*pool.length,1),limit=Math.min(search.maxEvaluations as number,totalCombinations);
  const indexes=Array<number>(7).fill(0),evaluations:Evaluation[]=[],assessments=new Map<string,string>();
  let best:{weekRaw:string;sha:string;validation:ValidatorResultV1;indexes:number[];score:bigint}|null=null;
  for(let evaluated=1;evaluated<=limit;evaluated++){
    const weekRaw=JSON.stringify({...header,days:options.map((pool,i)=>pool[indexes[i]])});
    const sha=await rawHash(weekRaw),validation=await validateWeekSnapshotRawV2(weekRaw,pinnedManifestRaw);
    // An unknown visited candidate cannot be declared inferior to a fully evaluated one.
    if(validation.status==='BLOCKED_MISSING_EVIDENCE')return freeze({status:'BLOCKED_MISSING_EVIDENCE',evaluated,totalCombinations});
    const entry:Evaluation={weekRawSha256:sha,validationStatus:validation.status,validationResultDigest:validation.subjectDigest,
      score:null,metricAssessmentRawSha256:null,assessmentRevision:null};
    if(validation.status==='VALID'||validation.status==='VALID_WITH_WARNINGS'){
      const raw=await metricsPort.assessWeekRaw(input.operation.requestId,weekRaw,generationInputDigest,policyRaw);
      if(raw===null)return freeze({status:'BLOCKED_OPTIMIZATION_METRICS',evaluated,totalCombinations});
      const facts=record(parse(raw),['contract','requestOperationId','generationInputDigest','weekRawSha256',
        'optimizationPolicyRevision','assessmentRevision','metrics']);
      if(facts.contract!==generationWeekMetricsContractV1||facts.requestOperationId!==input.operation.requestId
        ||facts.generationInputDigest!==generationInputDigest||facts.weekRawSha256!==sha||facts.optimizationPolicyRevision!==policy.policyRevision
        ||typeof facts.assessmentRevision!=='string'||!uuid.test(facts.assessmentRevision))throw Error('WEEK_OPTIMIZATION_METRICS_BINDING_MISMATCH');
      const metrics=record(facts.metrics,metricKeys);
      for(const key of metricKeys)if(metrics[key]!==null)minor(metrics[key]);
      if(metricKeys.some(k=>metrics[k]===null))return freeze({status:'BLOCKED_OPTIMIZATION_METRICS',evaluated,totalCombinations});
      const assessment=canonicalJsonV1(facts,'SAFE_INTEGER');
      if(assessments.has(sha)&&assessments.get(sha)!==assessment)throw Error('WEEK_OPTIMIZATION_METRICS_DRIFT');
      assessments.set(sha,assessment);
      // Same fixed-point weighting and rounding as the existing V1 meal optimizer.
      const score=(metricKeys.reduce((sum,key)=>sum+minor(metrics[key])*minor(policy.weights[key]),0n)+500n)/1000n;
      entry.score=decimal(score);entry.metricAssessmentRawSha256=await rawHash(raw);entry.assessmentRevision=facts.assessmentRevision;
      const rank=validation.status==='VALID'?0:1,bestRank=best?.validation.status==='VALID'?0:1;
      if(!best||rank<bestRank||(rank===bestRank&&(score>best.score||(score===best.score&&sha<best.sha))))
        best={weekRaw,sha,validation,indexes:[...indexes],score};
    }
    evaluations.push(entry);
    for(let i=6;i>=0;i--){indexes[i]++;if(indexes[i]<options[i].length)break;indexes[i]=0;}
  }
  if(!best)return freeze({status:limit<totalCombinations?'SEARCH_LIMIT_REACHED':'NO_FEASIBLE_WEEK_IN_POOL',evaluated:limit,totalCombinations});
  const scope=limit===totalCombinations?'BEST_IN_VALIDATED_POOL':'BEST_EVALUATED_PREFIX';
  const content={contract:generationWeekOptimizationResultContractV1,requestOperationId:input.operation.requestId,generationInputDigest,
    optimizationPolicyRevision:policy.policyRevision,optimizationPolicy:policy,candidateManifestDigest:manifest.digest,
    searchInputRawSha256:await rawHash(searchRaw),scope,evaluated:limit,totalCombinations,maxEvaluations:search.maxEvaluations,
    evaluations,selectedWeekRawSha256:best.sha,selectedOptionIndexes:best.indexes,selectedScore:decimal(best.score)};
  const digest=await contentHash({contract:generationWeekOptimizationResultContractV1,
    encoding:'potok-generation-week-optimization-result-canonical-json-v1',result:content});
  const optimizationReceiptRaw=canonicalJsonV1({...content,digest},'SAFE_INTEGER');
  if(optimizationReceiptRaw.length>8_000_000)throw Error('WEEK_OPTIMIZATION_RECEIPT_TOO_LARGE');
  return freeze({status:'FEASIBLE_PROPOSAL',evaluated:limit,totalCombinations,optionIndexes:best.indexes,weekRaw:best.weekRaw,
    validation:best.validation,scope,score:decimal(best.score),optimizationReceiptRaw,optimizationResultDigest:digest});
}
