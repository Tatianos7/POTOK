/** Derived exact metrics, never source/recipe approval. Unmounted and no database connection. */
import {canonicalJsonV1,adaptiveNutritionSha256HexV1} from '../utils/adaptiveNutritionWireV1';
import {decodeTrustedGenerationInputRawV1,trustedGenerationInputDigestV1} from '../utils/adaptiveNutritionGraphV2';
import {decodeOptimizationPolicyV1,type NutritionTargetAxisV1} from '../utils/adaptiveNutritionMealBalanceV1';
import {decodeExactScalarV2,exactScalarFromDecimalV2,addExactScalarsV2,subtractExactScalarsV2,
 divideExactScalarsV2,compareExactScalarsV2,type ExactScalarV2} from '../utils/exactNutritionValuesV2';
import {createExactWeekGraphPreparationV3} from './exactWeekGraphPreparationV3';
import {parseExactValidationJsonRawV3 as parse} from './exactWeekNutritionValidationV3';
import {exactWeekOptimizationPoolContractV3,exactWeekMetricsContractV3,type ExactWeekMetricsPortV3,
 type ExactWeekOptimizationPoolPortV3,type ExactWeekMetricAssessmentV3} from './exactWeekOptimizationV3';
import type {ExactTypedRecipeAuthorityV3} from './exactTypedRecipePreparationV3';
import type {GenerationValidationAuthorityPortV1} from './generationValidationAdapterV1';
export const exactWeekMetricPolicyContractV3='potok-exact-week-metric-policy-v3' as const;
export const exactWeekConvenienceContractV3='potok-exact-week-convenience-v3' as const;
export interface ExactWeekConveniencePortV3 {
 loadConvenienceRaw(operation:string,graphRawSha256:string,generationInputDigest:string,metricPolicyRevision:string):Promise<string|null>;
}
const uuid=/^[a-f0-9]{8}-[a-f0-9]{4}-[1-8][a-f0-9]{3}-[89ab][a-f0-9]{3}-[a-f0-9]{12}$/,hex=/^[a-f0-9]{64}$/;
const zero:ExactScalarV2=Object.freeze({numerator:'0',denominator:'1'}),one:ExactScalarV2=Object.freeze({numerator:'1',denominator:'1'});
const canonical=(v:unknown)=>canonicalJsonV1(v,'SAFE_INTEGER');
const sha=(raw:string)=>adaptiveNutritionSha256HexV1(new TextEncoder().encode(raw));
function fields(v:unknown,keys:readonly string[]):Record<string,unknown>{
 if(!v||typeof v!=='object'||Array.isArray(v)||Object.keys(v).length!==keys.length||keys.some(k=>!Object.prototype.hasOwnProperty.call(v,k)))throw Error();return v as Record<string,unknown>;
}
function text(v:unknown):string{if(typeof v!=='string')throw Error();return v;}
function id(v:unknown):string{const s=text(v);if(!uuid.test(s))throw Error();return s;}
function freeze<T>(v:T):T{if(v&&typeof v==='object'){Object.values(v).forEach(freeze);Object.freeze(v);}return v;}
const count=(n:number):ExactScalarV2=>({numerator:String(n),denominator:'1'});
const ratio=(n:number,d:number)=>divideExactScalarsV2(count(n),count(d));
/** Existing V1 calorie-fit definition, versioned exact arithmetic with no per-day rounding. */
export function calculateExactCalorieTargetFitV3(axis:NutritionTargetAxisV1,actual:ExactScalarV2):ExactScalarV2 {
 const value=decodeExactScalarV2(actual),min=exactScalarFromDecimalV2(axis.min),max=exactScalarFromDecimalV2(axis.max),target=exactScalarFromDecimalV2(axis.target);
 if(compareExactScalarsV2(min,target)>0||compareExactScalarsV2(target,max)>0||compareExactScalarsV2(value,min)<0||compareExactScalarsV2(value,max)>0)throw Error('EXACT_TARGET_FIT_OUTSIDE_BOUNDS');
 if(compareExactScalarsV2(value,target)===0)return one;
 const lower=subtractExactScalarsV2(target,min),upper=subtractExactScalarsV2(max,target),span=compareExactScalarsV2(lower,upper)>0?lower:upper;
 const distance=compareExactScalarsV2(value,target)<0?subtractExactScalarsV2(target,value):subtractExactScalarsV2(value,target);
 return subtractExactScalarsV2(one,divideExactScalarsV2(distance,span));
}
function metricPolicy(raw:string){
 const p=fields(parse(raw,65536,8),['contract','metricPolicyRevision','optimizationPolicyRevision','targetFit','diversity','shoppingReuse','convenience']);
 if(p.contract!==exactWeekMetricPolicyContractV3||p.targetFit!=='MEAN_DAILY_EXACT_CALORIE_FIT_V3'
  ||p.diversity!=='UNIQUE_RECIPE_MEAL_SHARE_V1'||p.shoppingReuse!=='CANONICAL_FOOD_MEAL_REUSE_SHARE_V1'||p.convenience!=='INDEPENDENT_EXACT_WEEK_CONVENIENCE_V3')throw Error('UNSUPPORTED_EXACT_METRIC_POLICY');
 return {metricPolicyRevision:id(p.metricPolicyRevision),optimizationPolicyRevision:id(p.optimizationPolicyRevision)};
}
function calculationRevision(digest:string):string{
 const h=digest.slice(0,12)+'8'+digest.slice(13,16)+((parseInt(digest[16],16)&3)|8).toString(16)+digest.slice(17,32);
 return `${h.slice(0,8)}-${h.slice(8,12)}-${h.slice(12,16)}-${h.slice(16,20)}-${h.slice(20)}`;
}
/** Trusted backend composition only. Pool, graph/event and convenience readers must share the
 * admission transaction and held currentness locks. No caller-provided metric values or caches.
 * Metric policy definitions are a candidate until separately admitted by the real installation.
 */
export function createExactWeekMetricProducerV3(poolPort:ExactWeekOptimizationPoolPortV3,graphPort:GenerationValidationAuthorityPortV1,
 eventAuthority:ExactTypedRecipeAuthorityV3,metricPolicyRaw:string,conveniencePort:ExactWeekConveniencePortV3|null){
 const policy=metricPolicy(metricPolicyRaw);
 async function calculateGraphRaw(operation:string,graphRaw:string,inputDigest:string,optimizationPolicyRaw:string){
  try{
   id(operation);if(!hex.test(inputDigest))throw Error();
   const proposed=parse(graphRaw,1_048_576,24) as Record<string,unknown>,optimization=decodeOptimizationPolicyV1(parse(optimizationPolicyRaw,65536,8));
   if(typeof proposed.evaluatedSnapshotRawSha256!=='string'||!hex.test(proposed.evaluatedSnapshotRawSha256))throw Error();
   // Reload actual subject bytes from the independent pool, never trust a caller's graph digest.
   const poolRaw=await poolPort.loadForOperationRaw(operation);if(poolRaw===null)return null;
   const pool=fields(parse(poolRaw,16_777_216,24),['contract','requestOperationId','trustedGenerationInputRaw','optimizationPolicyRaw','mode','maxEvaluations','candidates']);
   if(pool.contract!==exactWeekOptimizationPoolContractV3||pool.requestOperationId!==operation||pool.optimizationPolicyRaw!==optimizationPolicyRaw
    ||!['STRICT','ROBUST_CONVENIENCE_BOUNDS'].includes(text(pool.mode))||!Number.isSafeInteger(pool.maxEvaluations)||(pool.maxEvaluations as number)<1||(pool.maxEvaluations as number)>64
    ||!Array.isArray(pool.candidates)||!pool.candidates.length||pool.candidates.length>64)throw Error();
   const inputRaw=text(pool.trustedGenerationInputRaw);parse(inputRaw,262144,12);const input=decodeTrustedGenerationInputRawV1(inputRaw);
   if(input.operation.requestId!==operation||await trustedGenerationInputDigestV1(input)!==inputDigest||optimization.policyRevision!==input.optimizationPolicyRevision||policy.optimizationPolicyRevision!==input.optimizationPolicyRevision)throw Error();
   const candidates=pool.candidates.map(v=>fields(v,['snapshotRaw','snapshotRawSha256']));
   const pins=new Set<string>();let snapshotRaw:string|null=null;
   for(const c of candidates){
    const pin=text(c.snapshotRawSha256),raw=text(c.snapshotRaw);parse(raw,262144,12);
    if(!hex.test(pin)||pins.has(pin)||await sha(raw)!==pin)throw Error();pins.add(pin);
    if(pin===proposed.evaluatedSnapshotRawSha256)snapshotRaw=raw;
   }
   if(snapshotRaw===null)return null;
   const checked=await createExactWeekGraphPreparationV3(graphPort,eventAuthority).readback(operation,snapshotRaw,graphRaw);
   if(checked.status!=='EXACT_GRAPH_PREPARED_PENDING_OPTIMIZATION')return null;
   const graph=checked.graph;if(graph.generationInputDigest!==inputDigest||canonical(graph.input)!==canonical(input))throw Error();
   const recipeIds=new Set<string>(),foodIds=new Set<string>();let recipeAppearances=0,foodAppearances=0,nonFoodAppearances=0;
   const dailyFits=graph.days.map(day=>({date:day.date,calories:day.nutrition.values.calories,score:calculateExactCalorieTargetFitV3(input.goalNutritionTarget.calories,day.nutrition.values.calories)}));
   for(const day of graph.days)for(const slot of day.slots){
    const recipes=new Set<string>(),foods=new Set<string>(),nonFoods=new Set<string>();
    for(const binding of slot.publicationBindings){
     recipes.add(binding.recipeId);
     for(const ingredient of binding.componentBindings){
      if(ingredient.identity.kind==='canonical_food')foods.add(ingredient.identity.canonicalFoodId);
      else nonFoods.add(ingredient.identity.componentDefinitionId);
     }
    }
    recipes.forEach(v=>recipeIds.add(v));foods.forEach(v=>foodIds.add(v));recipeAppearances+=recipes.size;foodAppearances+=foods.size;nonFoodAppearances+=nonFoods.size;
   }
   const graphRawSha256=await sha(graphRaw);let convenience:ExactScalarV2|null=null,convenienceSourceRawSha256:string|null=null,convenienceSourceRevision:string|null=null;
   const convenienceRaw=conveniencePort?await conveniencePort.loadConvenienceRaw(operation,graphRawSha256,inputDigest,policy.metricPolicyRevision):null;
   if(convenienceRaw!==null){
    const c=fields(parse(convenienceRaw,65536,8),['contract','requestOperationId','graphRawSha256','generationInputDigest','metricPolicyRevision','sourceRevision','score']);
    if(c.contract!==exactWeekConvenienceContractV3||c.requestOperationId!==operation||c.graphRawSha256!==graphRawSha256||c.generationInputDigest!==inputDigest||c.metricPolicyRevision!==policy.metricPolicyRevision)throw Error();
    convenienceSourceRevision=id(c.sourceRevision);convenience=c.score===null?null:decodeExactScalarV2(c.score);if(convenience!==null&&compareExactScalarsV2(convenience,one)>0)throw Error();
    convenienceSourceRawSha256=await sha(convenienceRaw);
   }
   const metrics={targetFit:divideExactScalarsV2(dailyFits.reduce((s,d)=>addExactScalarsV2(s,d.score),zero),count(dailyFits.length)),
    diversity:ratio(recipeIds.size,recipeAppearances),convenience,shoppingReuse:ratio(foodAppearances-foodIds.size,foodAppearances)};
   const content={contract:'potok-exact-week-metric-calculation-v3',authority:'NONE',requestOperationId:operation,generationInputDigest:inputDigest,
    graphDigest:graph.digest,graphRawSha256,evaluatedSnapshotRawSha256:graph.evaluatedSnapshotRawSha256,optimizationPolicyRevision:optimization.policyRevision,
    optimizationPolicyRawSha256:await sha(optimizationPolicyRaw),metricPolicyRevision:policy.metricPolicyRevision,metricPolicyRawSha256:await sha(metricPolicyRaw),
    poolSourceRawSha256:await sha(poolRaw),dailyFits,recipeAppearances,distinctRecipeIds:[...recipeIds].sort(),canonicalFoodMealAppearances:foodAppearances,
    distinctCanonicalFoodIds:[...foodIds].sort(),excludedNonFoodMealAppearances:nonFoodAppearances,convenienceSourceRawSha256,convenienceSourceRevision,metrics};
   const digest=await sha(canonical({domain:'potok-exact-week-metric-calculation-sha256-v3',payload:content})),assessmentRevision=calculationRevision(digest);
   const assessment:ExactWeekMetricAssessmentV3={contract:exactWeekMetricsContractV3,requestOperationId:operation,generationInputDigest:inputDigest,graphDigest:graph.digest,
    graphRawSha256,evaluatedSnapshotRawSha256:graph.evaluatedSnapshotRawSha256,optimizationPolicyRevision:optimization.policyRevision,
    optimizationPolicyRawSha256:content.optimizationPolicyRawSha256,assessmentRevision,metrics};
   return freeze({status:convenience===null?'PARTIAL' as const:'ASSESSED' as const,metricsRaw:canonical(assessment),calculationReceiptRaw:canonical({...content,digest,assessmentRevision})});
  }catch{return null;}
 }
 const port:ExactWeekMetricsPortV3={async assessGraphRaw(operation,graphRaw,inputDigest,optimizationPolicyRaw){return (await calculateGraphRaw(operation,graphRaw,inputDigest,optimizationPolicyRaw))?.metricsRaw??null;}};
 return Object.freeze({...port,calculateGraphRaw});
}
