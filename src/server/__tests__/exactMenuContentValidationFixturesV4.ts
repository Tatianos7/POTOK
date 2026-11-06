/** SYNTHETIC metadata and exact subject bindings only. Not real publication/reviewer/store evidence. */
import {raw,id,copy,sha} from './exactFoodNutritionFixturesV2';
import {exactWeekValidationFixtureV3} from './exactWeekNutritionValidationFixturesV3';
import {authorized,q} from './exactWeekNutritionFixturesV3';
import {prepareExactTypedRecipeRawV3,exactTypedRecipeRequestDigestRawV3} from '../exactTypedRecipePreparationV3';
import {prepareExactWeekNutritionRawV3,exactWeekNutritionRequestDigestRawV3,type ExactWeekRecipeInputV3,type ExactWeekNutritionRequestV3} from '../exactWeekNutritionPreparationV3';
import {exactMenuContentAuthorityContractV4,type ExactMenuContentSourceV4,type ExactRecipePublicationBindingV4} from '../exactMenuContentValidationV4';
import {adaptiveMealCompositionEligibilityV1_1} from '../../utils/adaptiveNutritionMealCompositionV1';
import {mealCandidateEvidenceContractV1,type MealComponentEvidenceV1} from '../../utils/adaptiveNutritionMealBalanceV1';
import {sealNutritionPreferenceSnapshotV1,sealNutritionSafetySnapshotV1,nutritionPreferenceSnapshotContractV1,nutritionSafetySnapshotContractV1} from '../../utils/adaptiveNutritionAuthoritiesV1';
import {compositionPolicySnapshotContractV1,compositionPolicySnapshotEncodingV1} from '../../utils/trustedValidationPoliciesV1';
import {canonicalJsonV1} from '../../utils/adaptiveNutritionWireV1';
export async function contentFixtureV4(options:{repeated?:boolean;unknownServings?:boolean;duplicateWithinDay?:boolean;recipeNamespace?:string;identityOffset?:number}={}){
 const f=await exactWeekValidationFixtureV3(),input=f.input,refs:ExactWeekNutritionRequestV3['recipes'][number][]=[],inputs:ExactWeekRecipeInputV3[]=[];
 const recipeCount=options.repeated?1:7;
 for(let i=0;i<recipeCount;i++){
  const recipe=JSON.parse(f.recipeInputs[0].requestRaw);recipe.authoring.authoringRecipeId=(options.recipeNamespace??'synthetic-content')+'-'+i;if(options.unknownServings)recipe.authoring.declaredServings=null;
  const requestRaw=raw(recipe),requestDigest=await exactTypedRecipeRequestDigestRawV3(requestRaw),p=await prepareExactTypedRecipeRawV3(requestRaw,requestDigest,f.recipeInputs[0].contexts,authorized);
  if(p.kind!=='PREPARED_EXACT_TYPED_INPUTS_V3')throw Error();refs.push({recipeKey:'r'+i,requestDigest,snapshotDigest:p.snapshot.digest});inputs.push({recipeKey:'r'+i,requestRaw,contexts:f.recipeInputs[0].contexts});
 }
 const request:ExactWeekNutritionRequestV3={...f.request,recipes:refs,days:f.request.days.map((d,i)=>({...d,meals:(options.repeated?d.meals:options.duplicateWithinDay&&i===0?d.meals.slice(0,2):d.meals.slice(0,1)).map(m=>({...m,
  components:[{componentKey:'main',recipeKey:'r'+(options.repeated?0:i),portion:{kind:options.unknownServings?'FRACTION_OF_WHOLE':'DECLARED_SERVINGS',amount:options.unknownServings?q('1','3'):q('1')}}]}))}))};
 const requestPin=await exactWeekNutritionRequestDigestRawV3(raw(request)),p=await prepareExactWeekNutritionRawV3(raw(request),requestPin,inputs,authorized);if(p.kind!=='PREPARED_EXACT_WEEK_INPUTS_V3')throw Error();
 const snapshotRaw=raw(p.snapshot),distribution=copy(f.distribution);
 distribution.days=distribution.days.map((d,i)=>({...d,requiredSlots:d.requiredSlots.slice(0,request.days[i].meals.length),nutritionBounds:d.nutritionBounds.slice(0,request.days[i].meals.length),
  requirements:d.requirements.slice(0,request.days[i].meals.length),distributionBounds:d.distributionBounds.slice(0,request.days[i].meals.length)}));
 const numeric={...f.authority,evaluatedSnapshotRawSha256:sha(snapshotRaw),weekRequestDigest:requestPin,snapshotDigest:p.snapshot.digest,recipeInputs:inputs,distributionPolicyRaw:raw(distribution)};
 const preference=await sealNutritionPreferenceSnapshotV1({contract:nutritionPreferenceSnapshotContractV1,accountId:input.accountId,revisionId:input.preferenceRevision,supersedesRevisionId:null,
  hard:{dietaryPattern:'UNSPECIFIED',excludedMealTypes:[],excludedIngredientIds:[],excludedRecipeIds:[]},soft:{likedIngredientIds:[],dislikedIngredientIds:[],conveniencePreference:null,mealStylePreferences:[]},createdAt:'2026-11-06T00:00:00.000Z'});
 const safety=await sealNutritionSafetySnapshotV1({contract:nutritionSafetySnapshotContractV1,accountId:input.accountId,revisionId:input.safetyRevision,supersedesRevisionId:null,declaredAllergenCodes:[],declaredIntoleranceCodes:[],dietaryHardExclusionCodes:[],createdAt:'2026-11-06T00:00:00.000Z'});
 const compositionContent={contract:compositionPolicySnapshotContractV1,policy:{policyRevision:input.compositionPolicyRevision,maxComponents:5,
  patterns:[{patternId:'synthetic_complete',allowedMealTypes:['breakfast','lunch','dinner','snack'],roles:['MAIN_COMPONENT']}],nutritionWeights:{calories:1,protein:1,fat:1,carbs:1,fiber:1}}};
 const composition={...compositionContent,digest:sha(canonicalJsonV1({contract:compositionPolicySnapshotContractV1,encoding:compositionPolicySnapshotEncodingV1,policy:compositionContent},'SAFE_INTEGER'))};
 const bindings:ExactRecipePublicationBindingV4[]=[];let placement=0;
 for(const day of p.snapshot.days)for(const meal of day.meals)for(const component of meal.components){
  const i=refs.findIndex(r=>r.recipeKey===component.recipeKey),base=120000+(options.identityOffset??0)+i*100,recipe=JSON.parse(inputs[i].requestRaw),family='family_'+Math.floor(i/3),ingredient='ingredient_'+Math.floor(i/4);
  const review:MealComponentEvidenceV1={contract:mealCandidateEvidenceContractV1,mealComponentId:id(110000+placement++),recipeRevision:id(base+1),publicationStatus:'PUBLISHED',publicationRevision:id(base+2),canonicalStatus:'READY',canonicalEvidenceRevision:id(base+3),
   nutritionStatus:'COMPLETE',nutritionEvidenceRevision:id(base+4),allergenStatus:'REVIEWED',allergenEvidenceRevision:id(base+5),dietaryStatus:'REVIEWED',dietaryEvidenceRevision:id(base+6),portionPolicyRevision:id(base+7),
   accessibility:'COMMON_RU_RETAIL',allergens:[],dietaryTags:[],ingredientFamilies:[ingredient],dominantIngredientFamily:ingredient,repeatFamily:family,assignedServingsMinimum:'0.500',assignedServingsMaximum:'2.000',proteinSource:true,produceSource:true};
  const eligibility={contract:adaptiveMealCompositionEligibilityV1_1,eligibilityRevisionId:id(base+8),recipeRevisionId:review.recipeRevision,compositionPolicyRevision:input.compositionPolicyRevision,role:'MAIN_COMPONENT',anchorKind:'COMPLETE',
   allowedMealTypes:['breakfast','lunch','dinner','snack'],requiredCompanionRoleSets:[],pairingTags:[],incompatiblePairingTags:[],repeatFamily:family,energyClass:'BALANCED',beverageClass:'NOT_BEVERAGE'};
  bindings.push({contract:'potok-exact-recipe-publication-binding-v4',manifestRevision:input.candidateManifestRevision,manifestDigest:input.candidateManifestDigest,
   slotId:meal.slotId,componentKey:component.componentKey,recipeKey:component.recipeKey,recipeId:id(base),portionRevisionId:id(base+9),activePublicationRevision:review.publicationRevision!,publicationSubject:{requestDigest:refs[i].requestDigest,snapshotDigest:refs[i].snapshotDigest},
   reviewMetadataRaw:raw(review),eligibilityRaw:raw(eligibility),ingredientIds:[f.food.canonical.foodId],intoleranceCodes:[],specialty:false,expensive:false,
   portionRules:{mode:'HYBRID',assignedServingsIncrement:'0.500',componentIncrements:[]},
   componentBindings:recipe.authoring.components.map((c:{rowId:string;inputKind:string;foodId?:string;weightG?:unknown;amount?:unknown;unit?:string},j:number)=>({rowId:c.rowId,componentId:id(base+20+j),unit:c.inputKind==='FOOD'?'g':c.unit,baseAmount:c.inputKind==='FOOD'?c.weightG:c.amount,
    identity:c.inputKind==='FOOD'?{kind:'canonical_food',canonicalFoodId:c.foodId}:{kind:'approved_non_food',componentDefinitionId:recipe.nonFoodBindings.find((b:{rowId:string})=>b.rowId===c.rowId).definitionId},scaling:{mode:'continuous'}}))});
 }
 const source:ExactMenuContentSourceV4={contract:exactMenuContentAuthorityContractV4,requestOperationId:f.operation,evaluatedSnapshotRawSha256:sha(snapshotRaw),numericAuthorityRaw:raw(numeric),preferenceRaw:raw(preference),safetyRaw:raw(safety),compositionPolicySnapshotRaw:raw(composition),bindingsRaw:raw(bindings),
  mealModes:p.snapshot.days.flatMap(d=>d.meals.map(m=>({slotId:m.slotId,sourceKind:'COMPLETE_RECIPE' as const})))};
 return {...f,input,numeric,request,requestPin,snapshot:p.snapshot,snapshotRaw,source,bindings,preference,safety,composition};
}
