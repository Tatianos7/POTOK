import {decodeGenerationPreparationContextRawV1} from './generationValidationAuthorityLoaderV1';
import {generationPreparationReadSqlV1} from './generationPreparationSourceV1';
import type {GenerationValidationSourceSqlClientV1} from './generationValidationSourceSqlV1';
import {generationWeekMetricsContractV1,type GenerationWeekMetricsPortV1} from './generationWeekOptimizationV1';
import {calculateGoalTargetFitV1,goalTargetFitInputContractV1,decodeOptimizationPolicyV1,
  validateWeekSnapshotRawV2,type WeekValidationInputV1} from '../utils/adaptiveNutritionMealBalanceV1';
import {validateCandidateAuthoritiesV1,type AdaptiveNutritionCandidateManifestV2,
  type NutritionPreferenceSnapshotV1,type NutritionSafetySnapshotV1} from '../utils/adaptiveNutritionAuthoritiesV1';
import type {TrustedValidationEvidenceV1} from '../utils/trustedValidationEvidenceV1';
import type {TrustedValidationPoliciesV1} from '../utils/trustedValidationPoliciesV1';
import type {GraphNutritionV1} from '../utils/adaptiveNutritionGraphV1';
import {adaptiveNutritionSha256HexV1,assertRawJsonWithoutDuplicateKeysV1,canonicalJsonV1} from '../utils/adaptiveNutritionWireV1';

export const generationWeekMetricPolicyContractV1='potok-generation-week-metric-policy-v1';
export const generationWeekConvenienceContractV1='potok-generation-week-convenience-v1';
export interface GenerationWeekMetricContextPortV1 {loadContextRaw(requestOperationId:string):Promise<string|null>}
export interface GenerationWeekConveniencePortV1 {
  loadConvenienceRaw(requestOperationId:string,weekRawSha256:string,generationInputDigest:string,metricPolicyRevision:string):Promise<string|null>;
}
const uuid=/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/;
const axes=['calories','protein','fat','carbs','fiber'] as const;
function parse(raw:string):unknown{
  if(typeof raw!=='string'||raw.length>8_000_000)throw Error('INVALID_WEEK_METRIC_RAW');
  assertRawJsonWithoutDuplicateKeysV1(raw);return JSON.parse(raw);
}
function record(value:unknown,keys:readonly string[]):Record<string,unknown>{
  if(!value||typeof value!=='object'||Array.isArray(value)||Object.getPrototypeOf(value)!==Object.prototype
    ||Object.keys(value).length!==keys.length||!keys.every(k=>Object.prototype.hasOwnProperty.call(value,k)))throw Error('INVALID_WEEK_METRIC_FIELDS');
  return value as Record<string,unknown>;
}
const canonical=(value:unknown)=>canonicalJsonV1(value,'SAFE_INTEGER');
async function hash(raw:string):Promise<string>{
  const bytes=new TextEncoder().encode(raw);
  if(new TextDecoder('utf-8',{fatal:true}).decode(bytes)!==raw)throw Error('INVALID_WEEK_METRIC_UNICODE');
  return adaptiveNutritionSha256HexV1(bytes);
}
function same(actual:unknown,expected:unknown){if(canonical(actual)!==canonical(expected))throw Error('WEEK_METRIC_CONTEXT_MISMATCH');}
const decimal=(minor:bigint)=>`${minor/1000n}.${String(minor%1000n).padStart(3,'0')}`;
const ratio=(n:number,d:number)=>d===0?null:decimal((BigInt(n)*1000n+BigInt(d)/2n)/BigInt(d));
function outputRevision(digest:string):string{
  const h=digest.slice(0,12)+'8'+digest.slice(13,16)+((parseInt(digest[16],16)&3)|8).toString(16)+digest.slice(17,32);
  return `${h.slice(0,8)}-${h.slice(8,12)}-${h.slice(12,16)}-${h.slice(16,20)}-${h.slice(20)}`;
}
function metricPolicy(raw:string){
  const p=record(parse(raw),['contract','metricPolicyRevision','optimizationPolicyRevision','targetFit','diversity','shoppingReuse','convenience']);
  if(p.contract!==generationWeekMetricPolicyContractV1||typeof p.metricPolicyRevision!=='string'||!uuid.test(p.metricPolicyRevision)
    ||typeof p.optimizationPolicyRevision!=='string'||!uuid.test(p.optimizationPolicyRevision)
    ||p.targetFit!=='MEAN_DAILY_CALORIE_FIT_V1'||p.diversity!=='UNIQUE_RECIPE_MEAL_SHARE_V1'
    ||p.shoppingReuse!=='CANONICAL_FOOD_MEAL_REUSE_SHARE_V1'||p.convenience!=='INDEPENDENT_WEEK_CONVENIENCE_V1')
    throw Error('UNSUPPORTED_WEEK_METRIC_POLICY');
  return {metricPolicyRevision:p.metricPolicyRevision,optimizationPolicyRevision:p.optimizationPolicyRevision};
}

/** Candidate metric definitions are explicit and separately revisioned, not live policy admission.
 * Three metrics derive from independently pinned context and actual validated meal snapshots.
 * Convenience remains unknown without its independent source. No review/food UUID is minted.
 */
export function createGenerationWeekMetricProducerV1(contextPort:GenerationWeekMetricContextPortV1,
  metricPolicyRaw:string,conveniencePort:GenerationWeekConveniencePortV1|null){
  const policy=metricPolicy(metricPolicyRaw); // Own the primitive policy before any await.
  async function calculateWeekRaw(request:string,weekRaw:string,inputDigest:string,optimizationPolicyRaw:string){
    if(typeof request!=='string'||!uuid.test(request))throw Error('INVALID_WEEK_METRIC_REQUEST');
    const weekOwned=parse(weekRaw),optimization=decodeOptimizationPolicyV1(parse(optimizationPolicyRaw));
    const sourceRaw=await contextPort.loadContextRaw(request);if(sourceRaw===null)return null;
    const context=await decodeGenerationPreparationContextRawV1(sourceRaw,request);if(context===null)return null;
    const input=context.input;
    if(inputDigest!==context.generationInputDigest||policy.optimizationPolicyRevision!==input.optimizationPolicyRevision
      ||optimization.policyRevision!==input.optimizationPolicyRevision)throw Error('WEEK_METRIC_INPUT_MISMATCH');
    // These are parser-owned normalized snapshots, already independently decoded by the loader.
    const rawContext=JSON.parse(context.trustedContextRaw) as {candidateManifestRaw:string;preferenceSnapshotRaw:string;
      safetySnapshotRaw:string;trustedValidationEvidenceRaw:string};
    const manifest=JSON.parse(rawContext.candidateManifestRaw) as AdaptiveNutritionCandidateManifestV2;
    const preference=JSON.parse(rawContext.preferenceSnapshotRaw) as NutritionPreferenceSnapshotV1;
    const safety=JSON.parse(rawContext.safetySnapshotRaw) as NutritionSafetySnapshotV1;
    const evidence=JSON.parse(rawContext.trustedValidationEvidenceRaw) as TrustedValidationEvidenceV1;
    const policies=JSON.parse(context.policiesRaw) as TrustedValidationPoliciesV1;
    const validation=await validateWeekSnapshotRawV2(weekRaw,rawContext.candidateManifestRaw);
    if(validation.status!=='VALID'&&validation.status!=='VALID_WITH_WARNINGS')throw Error('WEEK_METRIC_REQUIRES_VALID_WEEK');
    const week=weekOwned as WeekValidationInputV1; // Admitted by the real raw V2 validator above.
    if(week.weekAnchor!==input.weekStartLocal||week.timezone!==input.timezone||week.goalRevision!==input.goalNutritionTarget.goalRevision
      ||week.targetPolicyRevision!==input.goalNutritionTarget.targetPolicyRevision||week.planRevision!==input.selection.proposedPlanRevision
      ||week.compositionPolicyRevision!==input.compositionPolicyRevision)throw Error('WEEK_METRIC_CONTEXT_MISMATCH');
    same(week.balancePolicy,policies.balance.policy);
    same(week.ordinaryFallbackProof,{candidatePoolDigest:evidence.ordinaryFallback.candidatePoolDigest,
      status:evidence.ordinaryFallback.status,ordinaryWeekDigest:evidence.ordinaryFallback.ordinaryWeekDigest});
    const recipeIds=new Set<string>(),foodIds=new Set<string>();let recipeAppearances=0,foodAppearances=0,nonFoodAppearances=0;
    const dailyFits:{date:string;nutrition:GraphNutritionV1;score:string;resultDigest:string}[]=[];
    const expectedConstraints={revisionId:preference.revisionId,excludedAllergens:safety.declaredAllergenCodes,
      excludedIngredientFamilies:[],requiredDietaryTags:preference.hard.dietaryPattern==='UNSPECIFIED'?[]:[preference.hard.dietaryPattern.toLowerCase()],
      forbiddenDietaryTags:safety.dietaryHardExclusionCodes};
    for(const [dayIndex,day] of week.days.entries()){
      const required=evidence.distributionPolicy.days[dayIndex];
      if(day.date!==required.date||day.meals.length!==required.requiredSlots.length)throw Error('WEEK_METRIC_CONTEXT_MISMATCH');
      same(day.requiredSlots,required.requiredSlots);same(day.distributionBounds,required.distributionBounds);
      same(day.goalTarget,input.goalNutritionTarget);same(day.balancePolicy,policies.balance.policy);
      for(const [slotIndex,slot] of day.meals.entries()){
        const expectedSlot=required.requiredSlots[slotIndex];
        same({slotId:slot.slotId,mealType:slot.mealType,sortOrder:slot.sortOrder},expectedSlot);
        const v=slot.validationInput;
        same(v.balancePolicy,policies.balance.policy);same(v.userConstraints,expectedConstraints);
        same(v.compositionPolicy,{...policies.composition.policy,maxComponents:policies.balance.policy.maxComponents,
          patterns:policies.composition.policy.patterns.filter(p=>p.roles.length<=policies.balance.policy.maxComponents)});
        same(v.nutritionBounds,required.nutritionBounds[slotIndex].bounds);
        same(v.requirements,{proteinSourceRequired:required.requirements[slotIndex].proteinSourceRequired,produceRequired:required.requirements[slotIndex].produceRequired});
        const mealRecipes=new Set<string>(),mealFoods=new Set<string>(),mealNonFood=new Set<string>();
        for(const component of v.meal.components){
          const proof=evidence.components.find(e=>e.slotId===slot.slotId&&e.mealComponentId===component.mealComponentId);
          const entry=proof&&manifest.entries.find(e=>e.recipeId===proof.recipeId&&e.recipeRevisionId===proof.recipeRevisionId
            &&e.portionRevisionId===proof.portionRevisionId&&e.eligibilityRevisionId===proof.eligibilityRevisionId);
          if(!proof||!entry||component.recipe.recipeId!==entry.recipeId||component.recipeRevision!==entry.recipeRevisionId
            ||component.portionRevision!==entry.portionRevisionId||component.eligibility.eligibilityRevisionId!==entry.eligibilityRevisionId
            ||validateCandidateAuthoritiesV1({accountId:input.accountId,candidate:{...entry,mealType:slot.mealType},preference,safety,manifest}).status==='BLOCKED')
            throw Error('WEEK_METRIC_COMPONENT_SOURCE_MISMATCH');
          const presented=v.componentEvidence.find(e=>e.mealComponentId===component.mealComponentId);
          if(!presented||presented.proteinSource!==proof.proteinSource||presented.produceSource!==proof.produceSource
            ||presented.publicationRevision!==proof.publicationRevision||presented.canonicalEvidenceRevision!==proof.canonicalEvidenceRevision
            ||presented.nutritionEvidenceRevision!==proof.nutritionEvidenceRevision||presented.allergenEvidenceRevision!==proof.allergenEvidenceRevision
            ||presented.dietaryEvidenceRevision!==proof.dietaryEvidenceRevision||presented.portionPolicyRevision!==proof.portionPolicyRevision)
            throw Error('WEEK_METRIC_COMPONENT_SOURCE_MISMATCH');
          same(presented.ingredientFamilies,proof.ingredientFamilies);
          mealRecipes.add(entry.recipeId);
          for(const ingredient of component.ingredients){
            if(ingredient.identity.kind==='canonical_food')mealFoods.add(ingredient.identity.canonicalFoodId);
            else mealNonFood.add(ingredient.identity.componentDefinitionId);
          }
        }
        mealRecipes.forEach(id=>recipeIds.add(id));mealFoods.forEach(id=>foodIds.add(id));
        recipeAppearances+=mealRecipes.size;foodAppearances+=mealFoods.size;nonFoodAppearances+=mealNonFood.size;
      }
      const nutrition=Object.fromEntries(axes.map(axis=>[axis,decimal(day.meals.reduce((sum,m)=>sum+BigInt(m.validationInput.meal.nutrition[axis].replace('.','')),0n))])) as unknown as GraphNutritionV1;
      const fit=await calculateGoalTargetFitV1({contract:goalTargetFitInputContractV1,goalTarget:input.goalNutritionTarget,
        expected:{goalRevision:input.goalNutritionTarget.goalRevision,targetPolicyRevision:input.goalNutritionTarget.targetPolicyRevision},actualNutrition:nutrition});
      dailyFits.push({date:day.date,nutrition,score:fit.score,resultDigest:fit.digest});
    }
    const weekSha=await hash(weekRaw);
    let convenience:string|null=null,convenienceSourceRawSha256:string|null=null,convenienceSourceRevision:string|null=null;
    const raw=conveniencePort?await conveniencePort.loadConvenienceRaw(request,weekSha,inputDigest,policy.metricPolicyRevision):null;
    if(raw!==null){
      const value=record(parse(raw),['contract','requestOperationId','weekRawSha256','generationInputDigest','metricPolicyRevision','sourceRevision','score']);
      if(value.contract!==generationWeekConvenienceContractV1||value.requestOperationId!==request||value.weekRawSha256!==weekSha
        ||value.generationInputDigest!==inputDigest||value.metricPolicyRevision!==policy.metricPolicyRevision
        ||typeof value.sourceRevision!=='string'||!uuid.test(value.sourceRevision)
        ||(value.score!==null&&(typeof value.score!=='string'||!/^(?:0\.[0-9]{3}|1\.000)$/.test(value.score))))throw Error('INVALID_WEEK_CONVENIENCE_SOURCE');
      convenience=value.score as string|null;convenienceSourceRevision=value.sourceRevision;
      convenienceSourceRawSha256=await hash(raw);
    }
    const fitSum=dailyFits.reduce((sum,d)=>sum+BigInt(d.score.replace('.','')),0n);
    const metrics={targetFit:decimal((fitSum+BigInt(dailyFits.length)/2n)/BigInt(dailyFits.length)),
      diversity:ratio(recipeIds.size,recipeAppearances),convenience,shoppingReuse:ratio(foodAppearances-foodIds.size,foodAppearances)};
    const content={contract:'potok-generation-week-metric-calculation-v1',requestOperationId:request,generationInputDigest:inputDigest,
      weekRawSha256:weekSha,optimizationPolicyRevision:optimization.policyRevision,metricPolicyRevision:policy.metricPolicyRevision,
      metricPolicyRawSha256:await hash(metricPolicyRaw),validationEvidenceDigest:evidence.digest,validationPoliciesDigest:policies.digest,
      validationResultDigest:validation.subjectDigest,dailyFits,recipeAppearances,distinctRecipeIds:[...recipeIds].sort(),
      canonicalFoodMealAppearances:foodAppearances,distinctCanonicalFoodIds:[...foodIds].sort(),excludedNonFoodMealAppearances:nonFoodAppearances,
      convenienceSourceRawSha256,convenienceSourceRevision,metrics};
    const digest=await hash(canonical({contract:content.contract,encoding:'potok-generation-week-metric-calculation-canonical-json-v1',calculation:content}));
    // A content-derived calculation output ID, not reviewer/food/policy/source admission.
    const assessmentRevision=outputRevision(digest);
    const metricsRaw=canonical({contract:generationWeekMetricsContractV1,requestOperationId:request,generationInputDigest:inputDigest,
      weekRawSha256:weekSha,optimizationPolicyRevision:optimization.policyRevision,assessmentRevision,metrics});
    return Object.freeze({status:Object.values(metrics).some(v=>v===null)?'PARTIAL' as const:'ASSESSED' as const,
      metricsRaw,calculationReceiptRaw:canonical({...content,digest,assessmentRevision})});
  }
  const producer:GenerationWeekMetricsPortV1={async assessWeekRaw(request,weekRaw,digest,optimizationPolicyRaw){
    return (await calculateWeekRaw(request,weekRaw,digest,optimizationPolicyRaw))?.metricsRaw??null;
  }};
  return Object.freeze({...producer,calculateWeekRaw});
}

/** Reuse the admitted request-only reader. No new SQL, grants, connection or runtime flag. */
export function createSqlGenerationWeekMetricProducerV1(sql:GenerationValidationSourceSqlClientV1,metricPolicyRaw:string,
  convenience:GenerationWeekConveniencePortV1|null){
  return createGenerationWeekMetricProducerV1({async loadContextRaw(request){
    const r=await sql.query(generationPreparationReadSqlV1,[request]);
    if(!r||!Array.isArray(r.rows)||r.rows.length!==1||!r.rows[0]||Object.keys(r.rows[0]).length!==1
      ||!Object.prototype.hasOwnProperty.call(r.rows[0],'source_raw')
      ||(r.rows[0].source_raw!==null&&typeof r.rows[0].source_raw!=='string'))throw Error('INVALID_WEEK_METRIC_SQL_RESULT');
    return r.rows[0].source_raw;
  }},metricPolicyRaw,convenience);
}
