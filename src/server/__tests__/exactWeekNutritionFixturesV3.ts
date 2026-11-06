/** Entirely synthetic complete-chain fixtures. No real food IDs, sources or approvals. */
import {exactFoodFixtureV2,id,raw} from './exactFoodNutritionFixturesV2';
import {typedNonFoodFixtureV1} from './typedNonFoodFixturesV1';
import {exactNutritionInputDigestV2} from '../../utils/exactNutritionValuesV2';
import {exactRecipeNutritionRequestContractV2,exactRecipeNutritionEncodingV2} from '../../utils/exactRecipeNutritionV2';
import {exactTypedRecipeRequestContractV3,exactTypedRecipeEncodingV3,prepareExactTypedRecipeRawV3,exactTypedRecipeRequestDigestRawV3,
 type ExactTypedRecipeRequestV3,type ExactTypedRecipeContextV3,type ExactTypedRecipeAuthorityV3} from '../exactTypedRecipePreparationV3';
import {exactWeekNutritionRequestContractV3,exactWeekNutritionEncodingV3,exactWeekNutritionRequestDigestRawV3,
 type ExactWeekNutritionRequestV3,type ExactWeekRecipeInputV3} from '../exactWeekNutritionPreparationV3';
export const q=(numerator:string,denominator='1')=>({numerator,denominator});
export const authorized:ExactTypedRecipeAuthorityV3={isAuthorizedEvent:async()=>true};
export async function exactWeekFixtureV3(options:{declaredServingsNull?:boolean;twoRecipes?:boolean;weekStart?:string;timezone?:string;fraction?:boolean}={}){
 const food=await exactFoodFixtureV2(),water=await typedNonFoodFixtureV1(),salt=await typedNonFoodFixtureV1('SALT',2000,'salt');
 const foodRow={rowId:'food',inputKind:'FOOD' as const,foodId:food.canonical.foodId,foodState:food.canonical.foodState,basis:food.input.reference.basis,weightG:q('100'),
  nutritionRevisionId:food.revision.revisionId,nutritionDigest:food.revision.digest,sourceProposalDigest:food.proposal.digest,numericInputDigest:await exactNutritionInputDigestV2(food.input)};
 const recipeRequest:ExactTypedRecipeRequestV3={contract:exactTypedRecipeRequestContractV3,encoding:exactTypedRecipeEncodingV3,
  authoring:{contract:exactRecipeNutritionRequestContractV2,encoding:exactRecipeNutritionEncodingV2,authoringRecipeId:'synthetic-a',authoringRevision:'v1',declaredServings:options.declaredServingsNull?null:q('3'),
   components:[foodRow,{rowId:'water',inputKind:'POTABLE_WATER',amount:q('100'),unit:'ml'},{rowId:'salt',inputKind:'SALT',amount:q('2'),unit:'g'}]},nonFoodBindings:[water.binding,salt.binding]};
 const contexts:ExactTypedRecipeContextV3[]=[{rowId:'food',kind:'FOOD',snapshot:food.snapshot},{rowId:'water',kind:'NONFOOD_V1',snapshot:water.snapshot},{rowId:'salt',kind:'NONFOOD_V1',snapshot:salt.snapshot}];
 const recipeInputs:ExactWeekRecipeInputV3[]=[],references:ExactWeekNutritionRequestV3['recipes'][number][]=[],sourceSnapshots=[];
 for(const key of options.twoRecipes?['a','b']:['a']){
  const request={...recipeRequest,authoring:{...recipeRequest.authoring,authoringRecipeId:'synthetic-'+key,components:recipeRequest.authoring.components.map(c=>key==='b'&&c.inputKind==='FOOD'?{...c,weightG:q('200')}:c)}};
  const requestRaw=raw(request),requestDigest=await exactTypedRecipeRequestDigestRawV3(requestRaw),prepared=await prepareExactTypedRecipeRawV3(requestRaw,requestDigest,contexts,authorized);
  if(prepared.kind!=='PREPARED_EXACT_TYPED_INPUTS_V3')throw Error('synthetic recipe failed');sourceSnapshots.push(prepared.snapshot);
  recipeInputs.push({recipeKey:key,requestRaw,contexts});references.push({recipeKey:key,requestDigest,snapshotDigest:prepared.snapshot.digest});
 }
 const weekStart=options.weekStart??'2026-11-02';let index=0;
 const request:ExactWeekNutritionRequestV3={contract:exactWeekNutritionRequestContractV3,encoding:exactWeekNutritionEncodingV3,accountId:id(50000),selectionId:id(50001),weekStartLocal:weekStart,timezone:options.timezone??'Europe/Moscow',recipes:references,
  days:Array.from({length:7},(_,day)=>{const d=new Date(weekStart+'T00:00:00.000Z');d.setUTCDate(d.getUTCDate()+day);return {date:d.toISOString().slice(0,10),meals:(['breakfast','lunch','dinner','snack'] as const).map(mealType=>{
   const i=index++;return {slotId:id(60000+i),mealType,components:[{componentKey:'main',recipeKey:options.twoRecipes&&i%2===1?'b':'a',portion:{kind:options.fraction?'FRACTION_OF_WHOLE':'DECLARED_SERVINGS',amount:options.fraction?q('1','3'):q('1')}}]};})};})};
 return {food,water,salt,recipeRequest,recipeInputs,sourceSnapshots,request,requestPin:await exactWeekNutritionRequestDigestRawV3(raw(request))};
}
