/** Inactive exact content checks over an independently loaded current publication binding.
 * No publication issuer, Graph admission, persistence permit, Auth/Premium or activation. */
import {canonicalJsonV1,adaptiveNutritionSha256HexV1} from '../utils/adaptiveNutritionWireV1';
import {decodeMealComponentReviewMetadataRawV1} from '../utils/adaptiveNutritionMealBalanceV1';
import {decodeMealCompositionEligibilityV1,assessMealEligibilitySetV1} from '../utils/adaptiveNutritionMealCompositionV1';
import {decodeNutritionPreferenceSnapshotV1,decodeNutritionSafetySnapshotV1,assessRecipeRestrictionsV1} from '../utils/adaptiveNutritionAuthoritiesV1';
import {decodeBalancePolicySnapshotRawV2,decodeCompositionPolicySnapshotRawV2} from '../utils/trustedValidationPoliciesV1';
import {decodeMealDistributionPolicyRawV1} from '../utils/trustedValidationEvidenceV1';
import {decodeTrustedGenerationInputRawV1} from '../utils/adaptiveNutritionGraphV2';
import {decodeExactScalarV2,exactScalarFromDecimalV2,multiplyExactScalarsV2,divideExactScalarsV2,compareExactScalarsV2,type ExactScalarV2} from '../utils/exactNutritionValuesV2';
import {assertFoodEvidenceDecimalV1} from '../utils/foodReviewedEvidenceV1';
import {decodeExactTypedRecipeRequestRawV3,type ExactTypedRecipeAuthorityV3} from './exactTypedRecipePreparationV3';
import type {ExactWeekNutritionSnapshotV3} from './exactWeekNutritionPreparationV3';
import {createExactWeekNutritionValidationAdapterV3,parseExactValidationJsonRawV3 as parse,decodeExactWeekNumericAuthorityRawV3} from './exactWeekNutritionValidationV3';
import type {GenerationValidationAuthorityPortV1} from './generationValidationAdapterV1';
export const exactMenuContentAuthorityContractV4='potok-exact-menu-content-authority-v4' as const;
export const exactMenuContentResultContractV4='potok-exact-menu-content-result-v4' as const;
export interface ExactMenuContentSourceV4{
 contract:typeof exactMenuContentAuthorityContractV4;requestOperationId:string;evaluatedSnapshotRawSha256:string;
 numericAuthorityRaw:string;preferenceRaw:string;safetyRaw:string;compositionPolicySnapshotRaw:string;bindingsRaw:string;
 mealModes:readonly {slotId:string;sourceKind:'COMPLETE_RECIPE'|'COMPOSED_MEAL'}[];
}
export interface ExactPublicationIngredientV4{
 rowId:string;componentId:string;unit:'g'|'ml';baseAmount:ExactScalarV2;
 identity:{kind:'canonical_food';canonicalFoodId:string}|{kind:'approved_non_food';componentDefinitionId:string};
 scaling:{mode:'continuous'}|{mode:'discrete';increment:string};
}
export interface ExactRecipePublicationBindingV4{
 contract:'potok-exact-recipe-publication-binding-v4';manifestRevision:string;manifestDigest:string;
 slotId:string;componentKey:string;recipeKey:string;recipeId:string;portionRevisionId:string;activePublicationRevision:string;
 publicationSubject:{requestDigest:string;snapshotDigest:string};reviewMetadataRaw:string;eligibilityRaw:string;
 ingredientIds:readonly string[];intoleranceCodes:readonly string[];specialty:boolean;expensive:boolean;
 portionRules:{mode:'HYBRID';assignedServingsIncrement:string;componentIncrements:readonly {componentId:string;increment:string}[]};
 componentBindings:readonly ExactPublicationIngredientV4[];
}
export const exactMenuContentRemainingChecksV4=Object.freeze(['EXACT_GRAPH_ADMISSION','ORDINARY_FALLBACK_WARNING_AND_OPTIMIZATION',
 'AUTH_PREMIUM_CURRENTNESS_STORE_ISSUANCE_AND_TRANSACTIONAL_RECORD'] as const);
export interface ExactMenuContentResultV4{
 readonly contract:typeof exactMenuContentResultContractV4;readonly status:'BLOCKED'|'CONTENT_RULES_REJECTED'|'CONTENT_RULES_PASSED_PENDING_GRAPH';
 readonly authority:'NONE';readonly accepted:false;readonly canRecord:false;readonly canActivate:false;
 readonly requestOperationId:string|null;readonly evaluatedSnapshotRawSha256:string|null;readonly numericValidationDigest:string|null;
 readonly sourcePackageRawSha256:string|null;readonly contentBindingsDigest:string|null;readonly reasons:readonly {code:string;path:string}[];
 readonly remainingChecks:typeof exactMenuContentRemainingChecksV4;readonly digest:string;
}
const uuidPattern=/^[a-f0-9]{8}-[a-f0-9]{4}-[1-8][a-f0-9]{3}-[89ab][a-f0-9]{3}-[a-f0-9]{12}$/,hashPattern=/^[a-f0-9]{64}$/;
function fail():never{throw Error('EXACT_CONTENT_SOURCE_INVALID');}
function row(v:unknown,keys:readonly string[]):Record<string,unknown>{if(!v||typeof v!=='object'||Array.isArray(v)||Object.keys(v).length!==keys.length||keys.some(k=>!Object.prototype.hasOwnProperty.call(v,k)))fail();return v as Record<string,unknown>;}
function text(v:unknown):string{if(typeof v!=='string')fail();return v;}
function uuid(v:unknown):string{const s=text(v);if(!uuidPattern.test(s))fail();return s;}
function hash(v:unknown):string{const s=text(v);if(!hashPattern.test(s))fail();return s;}
function token(v:unknown):string{const s=text(v);if(!/^[a-zA-Z0-9][a-zA-Z0-9._:-]{0,127}$/.test(s))fail();return s;}
function list(v:unknown,max=128):unknown[]{if(!Array.isArray(v)||v.length>max)fail();return v;}
function sorted(v:unknown,decode:(v:unknown)=>string):string[]{const result=list(v).map(decode);if(result.some((v,i)=>i>0&&result[i-1]>=v))fail();return result;}
function increment(v:unknown):string{const s=assertFoodEvidenceDecimalV1(v);if(exactScalarFromDecimalV2(s).numerator==='0')fail();return s;}
const canonical=(v:unknown)=>canonicalJsonV1(v,'SAFE_INTEGER');
const sha=(s:string)=>adaptiveNutritionSha256HexV1(new TextEncoder().encode(s));
function freeze<T>(v:T):T{if(v&&typeof v==='object'){for(const c of Object.values(v))freeze(c);Object.freeze(v);}return v;}
function bindings(raw:string){
 return list(parse(raw,2_097_152,20)).map(rawValue=>{
  const b=row(rawValue,['contract','manifestRevision','manifestDigest','slotId','componentKey','recipeKey','recipeId','portionRevisionId','activePublicationRevision','publicationSubject','reviewMetadataRaw','eligibilityRaw','ingredientIds','intoleranceCodes','specialty','expensive','portionRules','componentBindings']);
  if(b.contract!=='potok-exact-recipe-publication-binding-v4')fail();
  const subject=row(b.publicationSubject,['requestDigest','snapshotDigest']),p=row(b.portionRules,['mode','assignedServingsIncrement','componentIncrements']);
  if(p.mode!=='HYBRID'||typeof b.specialty!=='boolean'||typeof b.expensive!=='boolean')fail();
  const reviewMetadataRaw=text(b.reviewMetadataRaw),eligibilityRaw=text(b.eligibilityRaw);parse(reviewMetadataRaw,65536,12);
  const review=decodeMealComponentReviewMetadataRawV1(reviewMetadataRaw),eligibility=decodeMealCompositionEligibilityV1(parse(eligibilityRaw,65536,12));
  const components=list(b.componentBindings).map((value:unknown):ExactPublicationIngredientV4=>{
   const c=row(value,['rowId','componentId','unit','baseAmount','identity','scaling']);if(c.unit!=='g'&&c.unit!=='ml')fail();
   const amount=decodeExactScalarV2(c.baseAmount);if(amount.numerator==='0')fail();
   const kind=(c.identity as {kind?:unknown}|null)?.kind;
   const identity=kind==='canonical_food'?row(c.identity,['kind','canonicalFoodId']):row(c.identity,['kind','componentDefinitionId']);
   if(kind!=='canonical_food'&&kind!=='approved_non_food')fail();
   const mode=(c.scaling as {mode?:unknown}|null)?.mode;
   const scaling=mode==='continuous'?row(c.scaling,['mode']):row(c.scaling,['mode','increment']);if(mode!=='continuous'&&mode!=='discrete')fail();
   return {rowId:token(c.rowId),componentId:uuid(c.componentId),unit:c.unit,baseAmount:amount,
    identity:kind==='canonical_food'?{kind,canonicalFoodId:uuid(identity.canonicalFoodId)}:{kind:'approved_non_food',componentDefinitionId:uuid(identity.componentDefinitionId)},
    scaling:mode==='continuous'?{mode}:{mode:'discrete',increment:increment(scaling.increment)}};
  });
  if(new Set(components.map(c=>c.rowId)).size!==components.length||components.some((c,i)=>i>0&&components[i-1].componentId>=c.componentId))fail();
  const increments=list(p.componentIncrements).map(v=>{const c=row(v,['componentId','increment']);return {componentId:uuid(c.componentId),increment:increment(c.increment)};});
  if(increments.some((c,i)=>i>0&&increments[i-1].componentId>=c.componentId))fail();
  const discrete=components.filter(c=>c.scaling.mode==='discrete');
  if(increments.length!==discrete.length||discrete.some(c=>!increments.some(v=>v.componentId===c.componentId&&c.scaling.mode==='discrete'&&v.increment===c.scaling.increment)))fail();
  const value:ExactRecipePublicationBindingV4={contract:'potok-exact-recipe-publication-binding-v4',manifestRevision:uuid(b.manifestRevision),manifestDigest:hash(b.manifestDigest),slotId:uuid(b.slotId),componentKey:token(b.componentKey),recipeKey:token(b.recipeKey),recipeId:uuid(b.recipeId),
   portionRevisionId:uuid(b.portionRevisionId),activePublicationRevision:uuid(b.activePublicationRevision),publicationSubject:{requestDigest:hash(subject.requestDigest),snapshotDigest:hash(subject.snapshotDigest)},
   reviewMetadataRaw,eligibilityRaw,ingredientIds:sorted(b.ingredientIds,uuid),intoleranceCodes:sorted(b.intoleranceCodes,v=>{const t=text(v);if(!/^[a-z0-9][a-z0-9._-]{0,127}$/.test(t))fail();return t;}),
   specialty:b.specialty,expensive:b.expensive,portionRules:{mode:'HYBRID',assignedServingsIncrement:increment(p.assignedServingsIncrement),componentIncrements:increments},componentBindings:components};
  if((review.accessibility==='SPECIALTY_PRODUCT_REQUIRED'&&!value.specialty)||(review.accessibility==='EXPENSIVE_OPTIONAL'&&!value.expensive))fail();
  return freeze({value,review,eligibility});
 });
}
/** Only server dependencies enter the factory. The client supplies operation + proposal text. */
export function createExactMenuContentValidationAdapterV4(port:GenerationValidationAuthorityPortV1,eventAuthority:ExactTypedRecipeAuthorityV3){
 return Object.freeze({async validate(requestOperationId:string,snapshotRaw:string):Promise<ExactMenuContentResultV4>{
  let proposalHash:string|null=null,sourceHash:string|null=null,numericDigest:string|null=null,bindingsDigest:string|null=null;
  const finish=async(status:ExactMenuContentResultV4['status'],reasons:readonly {code:string;path:string}[]):Promise<ExactMenuContentResultV4>=>{
   const ordered=[...new Map(reasons.map(r=>[r.code+'|'+r.path,r])).entries()].sort(([a],[b])=>a<b?-1:a>b?1:0).map(([,v])=>v);
   const payload={contract:exactMenuContentResultContractV4,status,authority:'NONE' as const,accepted:false as const,canRecord:false as const,canActivate:false as const,
    requestOperationId:typeof requestOperationId==='string'&&uuidPattern.test(requestOperationId)?requestOperationId:null,evaluatedSnapshotRawSha256:proposalHash,
    sourcePackageRawSha256:sourceHash,numericValidationDigest:numericDigest,contentBindingsDigest:bindingsDigest,reasons:ordered,remainingChecks:exactMenuContentRemainingChecksV4};
   return freeze({...payload,digest:await sha(canonical({domain:'potok-exact-menu-content-result-sha256-v4',payload}))});
  };
  try{uuid(requestOperationId);parse(snapshotRaw,262144,12);proposalHash=await sha(snapshotRaw);}catch{return finish('BLOCKED',[{code:'INVALID_PROPOSAL',path:'proposal'}]);}
  let source:Record<string,unknown>;
  try{
   const raw=await port.loadForProposalRaw(requestOperationId,proposalHash);if(raw===null)return finish('BLOCKED',[{code:'AUTHORITY_UNAVAILABLE',path:'source'}]);
   source=row(parse(raw,16_777_216,24),['contract','requestOperationId','evaluatedSnapshotRawSha256','numericAuthorityRaw','preferenceRaw','safetyRaw','compositionPolicySnapshotRaw','bindingsRaw','mealModes']);
   if(source.contract!==exactMenuContentAuthorityContractV4||source.requestOperationId!==requestOperationId||source.evaluatedSnapshotRawSha256!==proposalHash)fail();sourceHash=await sha(raw);
   for(const k of ['numericAuthorityRaw','preferenceRaw','safetyRaw','compositionPolicySnapshotRaw','bindingsRaw'])text(source[k]);
  }catch{return finish('BLOCKED',[{code:'AUTHORITY_INVALID_OR_MISMATCHED',path:'source'}]);}
  const numeric=await createExactWeekNutritionValidationAdapterV3({loadForProposalRaw:async()=>source.numericAuthorityRaw as string},eventAuthority).validate(requestOperationId,snapshotRaw);
  if(numeric.status==='BLOCKED')return finish('BLOCKED',[{code:'NUMERIC_VALIDATION_BLOCKED',path:'numeric'}]);numericDigest=numeric.digest;
  if(numeric.status==='NUMERIC_LIMITS_REJECTED')return finish('CONTENT_RULES_REJECTED',[{code:'NUMERIC_LIMITS_REJECTED',path:'numeric'}]);
  const reasons:{code:string;path:string}[]=[],reject=(code:string,path:string)=>reasons.push({code,path});
  try{
   const a=decodeExactWeekNumericAuthorityRawV3(source.numericAuthorityRaw as string),input=decodeTrustedGenerationInputRawV1(a.trustedGenerationInputRaw);
   const snapshot=parse(snapshotRaw,262144,12) as unknown as ExactWeekNutritionSnapshotV3;
   const preference=await decodeNutritionPreferenceSnapshotV1(parse(source.preferenceRaw,262144,12)),safety=await decodeNutritionSafetySnapshotV1(parse(source.safetyRaw,262144,12));
   if(preference.accountId!==input.accountId||safety.accountId!==input.accountId||preference.revisionId!==input.preferenceRevision||safety.revisionId!==input.safetyRevision)fail();
   const composition=await decodeCompositionPolicySnapshotRawV2(source.compositionPolicySnapshotRaw as string,a.trustedGenerationInputRaw);
   const balance=(await decodeBalancePolicySnapshotRawV2(a.balancePolicySnapshotRaw,a.trustedGenerationInputRaw)).policy;
   const distribution=decodeMealDistributionPolicyRawV1(a.distributionPolicyRaw,a.trustedGenerationInputRaw);
   const reviewed=bindings(source.bindingsRaw as string),placements=snapshot.days.flatMap(d=>d.meals.flatMap(m=>m.components.map(c=>({slotId:m.slotId,component:c}))));
   if(reviewed.length!==placements.length||new Set(reviewed.map(b=>b.value.slotId+':'+b.value.componentKey)).size!==reviewed.length)fail();
   if(reviewed.some((b,i)=>b.value.slotId!==placements[i].slotId||b.value.componentKey!==placements[i].component.componentKey||b.value.recipeKey!==placements[i].component.recipeKey))fail();
   const meals=snapshot.days.flatMap(d=>d.meals),modes=list(source.mealModes,56).map(v=>{const m=row(v,['slotId','sourceKind']);if(m.sourceKind!=='COMPLETE_RECIPE'&&m.sourceKind!=='COMPOSED_MEAL')fail();return {slotId:uuid(m.slotId),sourceKind:m.sourceKind};});
   if(modes.length!==meals.length||modes.some((m,i)=>m.slotId!==meals[i].slotId))fail();
   const identityByRecipe=new Map<string,string>(),identityByRevision=new Map<string,string>(),recipeCounts=new Map<string,number>(),familyCounts=new Map<string,number>(),ingredientCounts=new Map<string,number>();
   let at=0,mealIndex=0,specialtyMeals=0,expensiveMeals=0;
   const count=(map:Map<string,number>,key:string)=>map.set(key,(map.get(key)??0)+1);
   for(const [dayIndex,day] of snapshot.days.entries()){
    const dailyRecipes=new Map<string,number>();
    for(const [slotIndex,meal] of day.meals.entries()){
     const path=`days[${dayIndex}].meals[${slotIndex}]`,selected:ReturnType<typeof bindings>=[];let specialty=false,expensive=false;
     for(const component of meal.components){
      const item=reviewed[at++],b=item.value,r=item.review,e=item.eligibility;selected.push(item);const cp=path+'.components.'+component.componentKey;
      const ref=snapshot.request.recipes.find(v=>v.recipeKey===b.recipeKey)!,recipeInput=a.recipeInputs.find(v=>v.recipeKey===b.recipeKey)!;
      const recipe=decodeExactTypedRecipeRequestRawV3(recipeInput.requestRaw);
      if(b.manifestRevision!==input.candidateManifestRevision||b.manifestDigest!==input.candidateManifestDigest||b.publicationSubject.requestDigest!==ref.requestDigest||b.publicationSubject.snapshotDigest!==ref.snapshotDigest||b.activePublicationRevision!==r.publicationRevision
        ||r.publicationStatus!=='PUBLISHED'||r.canonicalStatus!=='READY'||r.nutritionStatus!=='COMPLETE'||r.allergenStatus!=='REVIEWED'||r.dietaryStatus!=='REVIEWED'
        ||!r.canonicalEvidenceRevision||!r.nutritionEvidenceRevision||!r.allergenEvidenceRevision||!r.dietaryEvidenceRevision||!r.portionPolicyRevision)fail();
      if(e.recipeRevisionId!==r.recipeRevision||e.compositionPolicyRevision!==input.compositionPolicyRevision||e.repeatFamily!==r.repeatFamily)fail();
      if(b.componentBindings.length!==recipe.authoring.components.length||b.componentBindings.some(map=>!recipe.authoring.components.some(row=>row.rowId===map.rowId)))fail();
      const actualFoodIds=[...new Set(recipe.authoring.components.filter(c=>c.inputKind==='FOOD').map(c=>c.inputKind==='FOOD'?c.foodId:''))].sort();if(canonical(actualFoodIds)!==canonical(b.ingredientIds))fail();
      for(const map of b.componentBindings){
       const row=recipe.authoring.components.find(c=>c.rowId===map.rowId)!,baseAmount=row.inputKind==='FOOD'?row.weightG:row.amount,unit=row.inputKind==='FOOD'?'g':row.unit;
       if(unit!==map.unit||compareExactScalarsV2(baseAmount,map.baseAmount)!==0)fail();
       if(row.inputKind==='FOOD'){if(map.identity.kind!=='canonical_food'||map.identity.canonicalFoodId!==row.foodId)fail();}
       else{const id=recipe.nonFoodBindings.find(c=>c.rowId===row.rowId)?.definitionId;if(map.identity.kind!=='approved_non_food'||map.identity.componentDefinitionId!==id)fail();}
      }
      // Same recipe/revision must not acquire different canonical identity/classification/portion facts in another slot.
      const {mealComponentId,...reviewWithoutPlacement}=r;void mealComponentId;
      const fingerprint=canonical({...b,slotId:null,componentKey:null,reviewMetadataRaw:null,review:reviewWithoutPlacement});
      if(identityByRecipe.has(b.recipeKey)&&identityByRecipe.get(b.recipeKey)!==fingerprint)fail();identityByRecipe.set(b.recipeKey,fingerprint);
      const revisionFingerprint=canonical({...b,recipeKey:null,slotId:null,componentKey:null,reviewMetadataRaw:null,review:reviewWithoutPlacement});
      if(identityByRevision.has(r.recipeRevision)&&identityByRevision.get(r.recipeRevision)!==revisionFingerprint)fail();identityByRevision.set(r.recipeRevision,revisionFingerprint);
      if(!e.allowedMealTypes.includes(meal.mealType))reject('MEAL_TYPE_NOT_ALLOWED',cp);
      const access=assessRecipeRestrictionsV1({accountId:input.accountId,recipeId:b.recipeId,mealType:meal.mealType,
       metadata:{ingredientIds:b.ingredientIds as string[],allergenCodes:r.allergens,intoleranceCodes:b.intoleranceCodes as string[],dietaryCodes:r.dietaryTags},preference,safety});
      if(access.status==='BLOCKED')reject(access.reason,cp);
      if(r.accessibility==='ACCESSIBILITY_BLOCKED')reject('ACCESSIBILITY_BLOCKED',cp);
      if(recipe.authoring.declaredServings===null){reject('PORTION_EVIDENCE_MISSING',cp);}
      else{
       const servings=multiplyExactScalarsV2(component.wholeRecipeMultiplier,recipe.authoring.declaredServings);
       if(compareExactScalarsV2(servings,exactScalarFromDecimalV2(r.assignedServingsMinimum))<0||compareExactScalarsV2(servings,exactScalarFromDecimalV2(r.assignedServingsMaximum))>0)reject('PORTION_OUTSIDE_REVIEWED_RANGE',cp);
       if(divideExactScalarsV2(servings,exactScalarFromDecimalV2(b.portionRules.assignedServingsIncrement)).denominator!=='1')reject('PORTION_INCREMENT_MISMATCH',cp);
      }
      for(const increment of b.portionRules.componentIncrements){const map=b.componentBindings.find(c=>c.componentId===increment.componentId)!,ingredient=component.ingredients.find(c=>c.rowId===map.rowId)!;
       if(divideExactScalarsV2(ingredient.amount,exactScalarFromDecimalV2(increment.increment)).denominator!=='1')reject('DISCRETE_COMPONENT_INCREMENT_MISMATCH',cp+'.'+map.rowId);}
      count(dailyRecipes,r.recipeRevision);count(recipeCounts,r.recipeRevision);count(familyCounts,r.repeatFamily);count(ingredientCounts,r.dominantIngredientFamily);specialty||=b.specialty;expensive||=b.expensive;
     }
     const roles=selected.map(c=>c.eligibility.role),eligibility=assessMealEligibilitySetV1(selected.map(c=>c.eligibility));
     if(!eligibility.compatible)reject('INCOMPATIBLE_OR_DUPLICATE_RECIPE',path);if(!eligibility.complete)reject('INCOMPLETE_MEAL_COMPOSITION',path);
     if(new Set(roles).size!==roles.length)reject('DUPLICATE_ROLE',path);
     if(meal.components.length>composition.policy.maxComponents||!composition.policy.patterns.some(p=>p.allowedMealTypes.includes(meal.mealType)&&canonical(p.roles)===canonical(roles)))reject('ROLE_PATTERN_NOT_ALLOWED',path);
     if(modes[mealIndex++].sourceKind==='COMPLETE_RECIPE'&&(selected.length!==1||selected[0].eligibility.anchorKind!=='COMPLETE'))reject('ROLE_CONFLICT',path);
     const requirements=distribution.days[dayIndex].requirements[slotIndex];if(requirements.proteinSourceRequired&&!selected.some(c=>c.review.proteinSource))reject('REQUIRED_PROTEIN_SOURCE_MISSING',path);
     if(requirements.produceRequired&&!selected.some(c=>c.review.produceSource))reject('REQUIRED_PRODUCE_MISSING',path);
     if(specialty)specialtyMeals++;if(expensive)expensiveMeals++;
    }
    if([...dailyRecipes.values()].some(n=>n>balance.exactRecipePerDay))reject('DAY_RECIPE_REPEAT_EXCEEDED',`days[${dayIndex}]`);
   }
   if([...recipeCounts.values()].some(n=>n>balance.exactRecipePerWeek))reject('WEEK_RECIPE_REPEAT_EXCEEDED','week');
   if([...familyCounts.values()].some(n=>n>balance.repeatFamilyPerWeek))reject('WEEK_REPEAT_FAMILY_EXCEEDED','week');
   if([...ingredientCounts.values()].some(n=>n>balance.dominantIngredientFamilyPerWeek))reject('WEEK_INGREDIENT_REPEAT_EXCEEDED','week');
   if(specialtyMeals>balance.specialtyMealsPerWeek)reject('SPECIALTY_LIMIT_EXCEEDED','week');if(expensiveMeals>balance.expensiveMealsPerWeek)reject('EXPENSIVE_LIMIT_EXCEEDED','week');
   bindingsDigest=await sha(canonical(reviewed.map(v=>v.value)));
   return finish(reasons.some(r=>r.code==='PORTION_EVIDENCE_MISSING')?'BLOCKED':reasons.length?'CONTENT_RULES_REJECTED':'CONTENT_RULES_PASSED_PENDING_GRAPH',reasons);
  }catch{return finish('BLOCKED',[{code:'RECIPE_REVIEW_OR_CONTEXT_INVALID',path:'content'}]);}
 }});
}
