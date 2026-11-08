/** Apply owner's explicit exclusions to the next *offline* draft.
 * Frozen19 evidence remains untouched. No recipe bodies are fabricated here.
 * This is a useful intake list, never a recipe catalogue or admission receipt.
 */
import {buildPilotParallelDraftV2} from './pilot-parallel-catalog-draft-v2';
import {buildPilotOwnerSubstitutions20261108V1} from './pilot-owner-substitutions-20261108-v1';

export function buildPilotOwnerEffectiveCandidateDraftV1() {
 const source=buildPilotParallelDraftV2();
 const owner=buildPilotOwnerSubstitutions20261108V1();
 if(source.recipeCount!==19||source.recipes.length!==19||
   owner.originalFrozen19Immutable!==true||owner.exclusion.length!==1||
   owner.exclusion[0]!=='lemon_shelled_edamame'||owner.canApply!==false||
   source.runtimePublishable!==false) throw Error('INVALID_OWNER_EFFECTIVE_DRAFT');
 const excluded=new Set(owner.exclusion);
 if(!source.recipes.some(r=>excluded.has(r.recipeId)))throw Error('OWNER_EXCLUDED_RECIPE_NOT_FOUND');
 const lentils=new Set(owner.recipesRequiringNewDefinitionReview);
 const explicitlyNamedBuckwheat=new Set(['buckwheat_porridge_mushrooms','chicken_meatballs_buckwheat']);
 for(const id of [...lentils,...explicitlyNamedBuckwheat])
  if(!source.recipes.some(r=>r.recipeId===id))throw Error('OWNER_TARGET_RECIPE_NOT_FOUND');
 const candidates=source.recipes.filter(r=>!excluded.has(r.recipeId)).map(r=>{
   const reasons=['FULL_ORIGINAL_INGREDIENTS_NOT_RECOVERED',
     'REVIEWED_SOURCE_NUTRITION_NOT_PUBLISHED',
     'RECIPE_SERVINGS_AND_YIELD_NOT_VERIFIED'];
   if(lentils.has(r.recipeId))reasons.push('OWNER_GREEN_LENTILS_REQUIRE_NEW_RECIPE_REVISION');
   if(explicitlyNamedBuckwheat.has(r.recipeId))reasons.push('OWNER_UNROASTED_GREEN_BUCKWHEAT_REQUIRES_SOURCE_RECHECK');
   if(r.knownBlockedIngredients.length)reasons.push('KNOWN_BLOCKED_INGREDIENT_SOURCES');
   return {recipeId:r.recipeId,priorRecipeSha256:r.priorRecipeSha256,
     expectedComponentRows:r.expectedComponentRows,
     knownBlockedIngredientCount:r.knownBlockedIngredients.length,
     reviewReasons:reasons,sourceApproved:false as const,eligible:false as const};
 });
 if(candidates.length!==18||candidates.some(r=>r.eligible||r.sourceApproved))
  throw Error('INVALID_OWNER_EFFECTIVE_DRAFT');
 return {contract:'potok-pilot-owner-effective-candidates-v1',
  sourceFreezeSha256:source.parentFreezeSha256,
  immutableFrozenRecipeCount:source.recipeCount,
  excludedRecipeIds:[...excluded],candidateCount:candidates.length,
  candidates,
  noAutomaticCanonicalBinding:true as const,
  noAutomaticNutritionValues:true as const,
  missingRowsRequireReview:true as const,
  noDatabaseWrites:true as const,runtimePublishable:false as const,
  readyForServerSubmission:false as const,mayActivate:false as const};
}
