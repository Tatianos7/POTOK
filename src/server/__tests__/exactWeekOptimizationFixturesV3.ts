/** Synthetic candidate pool and independent assessment port. No real store/issuer. */
import {graphFixtureV3,changedPortionFixtureV3,graphSourceFixtureV3} from './exactWeekGraphFixturesV3';
import {raw,id,sha,copy} from './exactFoodNutritionFixturesV2';import {authorized,q} from './exactWeekNutritionFixturesV3';
import {optimizationPolicyContractV1} from '../../utils/adaptiveNutritionMealBalanceV1';
import {createExactWeekOptimizationV3,exactWeekOptimizationPoolContractV3,exactWeekMetricsContractV3,
 type ExactWeekOptimizationPoolV3,type ExactWeekMetricsV3,type ExactWeekMetricAssessmentV3,type ExactWeekOptimizationModeV3} from '../exactWeekOptimizationV3';
export {raw,id,sha,copy,authorized,q,graphSourceFixtureV3};
export const zeroMetricsV3:ExactWeekMetricsV3={targetFit:q('0'),diversity:q('0'),convenience:q('0'),shoppingReuse:q('0')};
export const oneMetricsV3:ExactWeekMetricsV3={targetFit:q('1'),diversity:q('1'),convenience:q('1'),shoppingReuse:q('1')};
export async function optimizationFixtureV3(mode:ExactWeekOptimizationModeV3='STRICT'){
 const f=await graphFixtureV3(),alternative=await changedPortionFixtureV3(f);
 const policyRaw=raw({contract:optimizationPolicyContractV1,policyRevision:f.input.optimizationPolicyRevision,weights:{targetFit:'0.400',diversity:'0.250',convenience:'0.200',shoppingReuse:'0.150'}});
 const pool:ExactWeekOptimizationPoolV3={contract:exactWeekOptimizationPoolContractV3,requestOperationId:f.operation,trustedGenerationInputRaw:f.numeric.trustedGenerationInputRaw,optimizationPolicyRaw:policyRaw,mode,maxEvaluations:64,
  candidates:[f,alternative].map(v=>({snapshotRaw:v.snapshotRaw,snapshotRawSha256:sha(v.snapshotRaw)}))};
 const sources=new Map([[sha(f.snapshotRaw),raw(f.graphSource)],[sha(alternative.snapshotRaw),raw(alternative.graphSource)]]);
 let poolRaw:string|null=raw(pool),values:readonly ExactWeekMetricsV3[]=[zeroMetricsV3,oneMetricsV3],mutate:((v:ExactWeekMetricAssessmentV3,index:number)=>string|null)|null=null;
 let graphReads=0,metricReads=0;const assessments:ExactWeekMetricAssessmentV3[]=[];
 const adapter=createExactWeekOptimizationV3({loadForOperationRaw:async operation=>{if(operation!==f.operation)return null;return poolRaw;}},
  {loadForProposalRaw:async(operation,subject)=>{graphReads++;return operation===f.operation?sources.get(subject)??null:null;}},
  {assessGraphRaw:async(operation,graphRaw,inputDigest,policy)=>{
   metricReads++;const graph=JSON.parse(graphRaw),index=pool.candidates.findIndex(c=>c.snapshotRawSha256===graph.evaluatedSnapshotRawSha256);
   const assessment:ExactWeekMetricAssessmentV3={contract:exactWeekMetricsContractV3,requestOperationId:operation,generationInputDigest:inputDigest,graphDigest:graph.digest,graphRawSha256:sha(graphRaw),evaluatedSnapshotRawSha256:graph.evaluatedSnapshotRawSha256,
    optimizationPolicyRevision:f.input.optimizationPolicyRevision,optimizationPolicyRawSha256:sha(policy),assessmentRevision:id(180000+index),metrics:values[index]};
   assessments.push(assessment);return mutate?mutate(assessment,index):raw(assessment);
  }},authorized);
 return {...f,alternative,policyRaw,pool,sources,adapter,assessments,counts:()=>({graphReads,metricReads}),setPool:(v:string|null)=>{poolRaw=v;},
  setValues:(v:readonly ExactWeekMetricsV3[])=>{values=v;},setAssessment:(v:typeof mutate)=>{mutate=v;}};
}
