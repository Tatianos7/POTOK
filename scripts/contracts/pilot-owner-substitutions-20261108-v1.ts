/** Owner instructions recorded 2026-11-08. This is a proposed authoring overlay,
 * not a mutation of frozen19 source evidence or a nutrition/source approval.
 */
import {recoverFrozen19RetainedReferencesV1} from './pilot-frozen19-retained-recovery-v1';

export function buildPilotOwnerSubstitutions20261108V1(){
 const prior=recoverFrozen19RetainedReferencesV1();
 const excluded='lemon_shelled_edamame';
 const lentilRecipes=prior.lentilModelPositionRefs.map(x=>x.recipeId);
 if(prior.recipeCount!==19||
   !prior.exactRowReferences.some(x=>x.recipeId===excluded&&x.sourceRecord==='FDC_SR_LEGACY:168411:PREPARED:100G')||
   lentilRecipes.length!==2||new Set(lentilRecipes).size!==2)throw Error('OWNER_SUBSTITUTION_SOURCE_DRIFT');
 return {
  contract:'potok-pilot-owner-substitutions-20261108-v1',
  scope:'NEW_CANDIDATE_REVISION_ONLY' as const,
  originalFrozen19Immutable:true as const,
  productDatabaseWrites:0 as const, recipeDatabaseWrites:0 as const,
  ownerDecisions:{
   milk:{intendedProduct:'PLAIN_DAIRY_MILK_2_PERCENT',applyTo:'UNSPECIFIED_MILK_IN_NEW_RECIPE_REVISION',notVerifiedNutrition:true},
   greekYogurt:{intendedProduct:'PLAIN_UNSWEETENED_GREEK_YOGURT_2_PERCENT',notUniversalRetailEquivalence:true,notVerifiedNutrition:true},
   edamame:{excludedRecipeId:excluded,excludedFromNewGenerationCandidates:true},
   lentils:{intendedProduct:'GREEN_LENTILS',previousBrownSourceNotApplicable:true,
    recipeIds: lentilRecipes, requireNewIngredientAndRecipeRevisions:true,
    ownerReferencePer100g:{state:'DRY_UNCOOKED' as const,caloriesKcal:340,proteinG:26,fatG:2,carbsG:55,
      fiberG:null,carbsExcludeFiber:null,referenceStatus:'OWNER_PROVIDED_NOT_SOURCE_VERIFIED' as const},
    requiresIndependentNutritionSource:true,allowRecipeRecalculation:false},
  },
  exclusion:[excluded],
  recipesRequiringNewDefinitionReview:lentilRecipes,
  sourceIdsToReassess:['SR28:01174','SR28:01287','FDC_SR_LEGACY:172420:DRY_RAW:100G'],
  noAutomaticCanonicalFoodSelection:true as const,
  sourceApproved:false as const,nutritionApproved:false as const,
  canApply:false as const,mayActivate:false as const,runtimePublishable:false as const,
 };
}
