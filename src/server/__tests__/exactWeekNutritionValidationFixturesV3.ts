/** Synthetic admitted metadata and source package. Never publication or real reviewer authority. */
import {raw,id,sha} from './exactFoodNutritionFixturesV2';
import {exactWeekFixtureV3,authorized} from './exactWeekNutritionFixturesV3';
import {prepareExactWeekNutritionRawV3,exactWeekNutritionRequestDigestRawV3,type ExactWeekNutritionRequestV3} from '../exactWeekNutritionPreparationV3';
import {exactWeekNumericAuthorityContractV3,type ExactWeekNumericAuthorityV3} from '../exactWeekNutritionValidationV3';
import {trustedGenerationInputContractV1,sharedAccountGateContractV1,trustedGenerationInputDigestV1,type TrustedGenerationInputV1} from '../../utils/adaptiveNutritionGraphV2';
import {goalNutritionTargetContractV1,balancePolicyContractV1,type GoalNutritionTargetV1,type BalancePolicyV1,type NutritionBoundsV1} from '../../utils/adaptiveNutritionMealBalanceV1';
import {balancePolicySnapshotContractV1,balancePolicySnapshotEncodingV1} from '../../utils/trustedValidationPoliciesV1';
import {mealDistributionPolicyContractV1,type MealDistributionPolicySnapshotV1} from '../../utils/trustedValidationEvidenceV1';
import {canonicalJsonV1} from '../../utils/adaptiveNutritionWireV1';
export function sealBalanceFixtureV3(policy:BalancePolicyV1){
 const content={contract:balancePolicySnapshotContractV1,policy};return {...content,digest:sha(canonicalJsonV1({contract:balancePolicySnapshotContractV1,encoding:balancePolicySnapshotEncodingV1,policy:content},'SAFE_INTEGER'))};
}
export async function refreshInputFixtureV3(a:ExactWeekNumericAuthorityV3,input:TrustedGenerationInputV1,copyGoal=true){
 a.trustedGenerationInputRaw=raw(input);a.generationInputDigest=await trustedGenerationInputDigestV1(input);if(copyGoal)a.currentGoalTargetRaw=raw(input.goalNutritionTarget);
}
export async function exactWeekValidationFixtureV3(options:{whole?:boolean;manyComponents?:boolean}={}){
 const f=await exactWeekFixtureV3();let request:ExactWeekNutritionRequestV3=f.request;
 if(options.whole)request={...request,days:request.days.map(d=>({...d,meals:d.meals.map(m=>({...m,components:m.components.map(c=>({...c,portion:{kind:'FRACTION_OF_WHOLE',amount:{numerator:'1',denominator:'1'}}}))}))}))};
 if(options.manyComponents)request={...request,days:request.days.map((d,i)=>i?d:{...d,meals:d.meals.map((m,j)=>j?m:{...m,components:Array.from({length:6},(_,k)=>({...m.components[0],componentKey:'c'+k}))})})};
 const requestPin=await exactWeekNutritionRequestDigestRawV3(raw(request)),week=await prepareExactWeekNutritionRawV3(raw(request),requestPin,f.recipeInputs,authorized);
 if(week.kind!=='PREPARED_EXACT_WEEK_INPUTS_V3')throw Error('synthetic week failed');const snapshotRaw=raw(week.snapshot),operation=id(90000);
 const goal:GoalNutritionTargetV1={contract:goalNutritionTargetContractV1,goalRevision:id(90001),targetPolicyRevision:id(90002),
  calories:{min:'0.000',target:'2000.000',max:'10000.000'},protein:null,fat:null,carbs:null,fiber:null};
 const input:TrustedGenerationInputV1={contract:trustedGenerationInputContractV1,accountGateContract:sharedAccountGateContractV1,accountId:request.accountId,
  selection:{selectionId:request.selectionId,planSelectionRevision:id(90003),expectedStatus:'pending_generation',expectedPlanRevision:null,proposedPlanRevision:id(90004)},
  weekStartLocal:request.weekStartLocal,timezone:request.timezone,goalNutritionTarget:goal,preferenceRevision:id(90005),safetyRevision:id(90006),entitlementEvidenceRevision:id(90007),
  candidateManifestRevision:id(90008),candidateManifestDigest:'a'.repeat(64),compositionPolicyRevision:id(90009),validationPolicyRevision:id(90010),
  optimizationPolicyRevision:id(90011),generationPolicyRevision:id(90012),operation:{requestId:operation,idempotencyKey:id(90013)}};
 const balance:BalancePolicyV1={contract:balancePolicyContractV1,policyRevision:input.validationPolicyRevision,maxComponents:5,exactRecipePerWeek:2,exactRecipePerDay:1,
  repeatFamilyPerWeek:3,dominantIngredientFamilyPerWeek:4,specialtyMealsPerWeek:1,expensiveMealsPerWeek:2,allowedWarningCodes:[]};
 const zero={calories:'0.000',protein:'0.000',fat:'0.000',carbs:'0.000',fiber:'0.000'},high={calories:'99999.000',protein:'99999.000',fat:'99999.000',carbs:'99999.000',fiber:'99999.000'};
 const bounds: NutritionBoundsV1={minimum:zero,target:{...zero},maximum:high};
 const distribution:MealDistributionPolicySnapshotV1={contract:mealDistributionPolicyContractV1,policyRevision:input.validationPolicyRevision,compositionPolicyRevision:input.compositionPolicyRevision,
  days:request.days.map(d=>({date:d.date,requiredSlots:d.meals.map((m,sortOrder)=>({slotId:m.slotId,sortOrder,mealType:m.mealType})),
   nutritionBounds:d.meals.map(m=>({slotId:m.slotId,bounds:JSON.parse(raw(bounds))})),requirements:d.meals.map(m=>({slotId:m.slotId,proteinSourceRequired:true,produceRequired:true})),
   distributionBounds:d.meals.map((m,sortOrder)=>({slotId:m.slotId,sortOrder,bounds:JSON.parse(raw(bounds))}))}))};
 const authority:ExactWeekNumericAuthorityV3={contract:exactWeekNumericAuthorityContractV3,requestOperationId:operation,evaluatedSnapshotRawSha256:sha(snapshotRaw),
  weekRequestDigest:requestPin,snapshotDigest:week.snapshot.digest,generationInputDigest:await trustedGenerationInputDigestV1(input),trustedGenerationInputRaw:raw(input),currentGoalTargetRaw:raw(goal),
  balancePolicySnapshotRaw:raw(sealBalanceFixtureV3(balance)),distributionPolicyRaw:raw(distribution),recipeInputs:f.recipeInputs};
 return {...f,request,requestPin,snapshot:week.snapshot,snapshotRaw,operation,input,goal,balance,distribution,authority};
}
