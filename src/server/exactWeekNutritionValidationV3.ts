/** Request-bound exact NUMERIC precheck, not the complete Graph/menu validator or a record permit. */
import {assertRawJsonWithoutDuplicateKeysV1,canonicalJsonV1,adaptiveNutritionSha256HexV1} from '../utils/adaptiveNutritionWireV1';
import {decodeTrustedGenerationInputRawV1,trustedGenerationInputDigestV1} from '../utils/adaptiveNutritionGraphV2';
import {decodeGoalNutritionTargetV1,type NutritionBoundsV1} from '../utils/adaptiveNutritionMealBalanceV1';
import {decodeBalancePolicySnapshotRawV2} from '../utils/trustedValidationPoliciesV1';
import {decodeMealDistributionPolicyRawV1} from '../utils/trustedValidationEvidenceV1';
import {exactNutritionAxesV2,exactScalarFromDecimalV2,compareExactScalarsV2,multiplyExactScalarsV2,type ExactScalarV2,type ExactNutritionValuesV2} from '../utils/exactNutritionValuesV2';
import {decodeExactWeekNutritionSnapshotRawV3,type ExactWeekRecipeInputV3} from './exactWeekNutritionPreparationV3';
import type {ExactTypedRecipeAuthorityV3} from './exactTypedRecipePreparationV3';
import type {GenerationValidationAuthorityPortV1} from './generationValidationAdapterV1';
export const exactWeekNumericAuthorityContractV3='potok-exact-week-numeric-validation-authority-v3' as const;
export const exactWeekNumericResultContractV3='potok-exact-week-numeric-validation-result-v3' as const;
export const exactWeekNumericRemainingChecksV3=Object.freeze(['EXACT_GRAPH_ADMISSION','RECIPE_PUBLICATION_AND_PORTION',
 'COMPOSITION_REPEAT_ACCESSIBILITY','ALLERGEN_DIETARY_AND_PREFERENCES','WARNING_AND_OPTIMIZATION_EVIDENCE',
 'AUTH_PREMIUM_CURRENTNESS_AND_TRANSACTIONAL_RECORD'] as const);
type Axis=typeof exactNutritionAxesV2[number];
export interface ExactWeekNumericAuthorityV3{
 contract:typeof exactWeekNumericAuthorityContractV3;requestOperationId:string;evaluatedSnapshotRawSha256:string;
 weekRequestDigest:string;snapshotDigest:string;generationInputDigest:string;trustedGenerationInputRaw:string;currentGoalTargetRaw:string;
 balancePolicySnapshotRaw:string;distributionPolicyRaw:string;recipeInputs:readonly ExactWeekRecipeInputV3[];
}
export interface ExactWeekNumericViolationV3{
 readonly scope:'MEAL'|'DAY'|'WEEK';readonly check:'MEAL_NUTRITION'|'MEAL_DISTRIBUTION'|'DAY_GOAL'|'WEEK_GOAL'|'COMPONENT_COUNT';
 readonly code:'BELOW_MINIMUM'|'ABOVE_MAXIMUM';readonly path:string;readonly axis:Axis|null;readonly actual:ExactScalarV2;
 readonly minimum:ExactScalarV2|null;readonly maximum:ExactScalarV2;
}
export type ExactWeekNumericResultV3=
 |{readonly status:'BLOCKED';readonly reason:'INVALID_PROPOSAL'|'AUTHORITY_UNAVAILABLE'|'AUTHORITY_INVALID_OR_MISMATCHED'|'SOURCE_OR_SNAPSHOT_INVALID';readonly accepted:false;readonly canRecord:false;readonly canActivate:false}
 |{readonly contract:typeof exactWeekNumericResultContractV3;readonly status:'NUMERIC_CHECKS_PASSED_PENDING_VALIDATION'|'NUMERIC_LIMITS_REJECTED';
 readonly authority:'NONE';readonly accepted:false;readonly canRecord:false;readonly canActivate:false;
 readonly requestOperationId:string;readonly evaluatedSnapshotRawSha256:string;readonly snapshotDigest:string;readonly weekRequestDigest:string;
 readonly generationInputDigest:string;readonly goalRevision:string;readonly targetPolicyRevision:string;readonly validationPolicyRevision:string;
 readonly balancePolicyDigest:string;readonly distributionPolicyDigest:string;readonly authorityPackageRawSha256:string;
 readonly checkedGoalAxes:readonly Axis[];readonly unspecifiedGoalAxes:readonly Axis[];readonly violations:readonly ExactWeekNumericViolationV3[];
 readonly remainingChecks:typeof exactWeekNumericRemainingChecksV3;readonly digest:string};
const uuid=/^[a-f0-9]{8}-[a-f0-9]{4}-[1-8][a-f0-9]{3}-[89ab][a-f0-9]{3}-[a-f0-9]{12}$/,hash=/^[a-f0-9]{64}$/;
function fail():never{throw Error('EXACT_WEEK_NUMERIC_AUTHORITY_INVALID');}
export function parseExactValidationJsonRawV3(raw:unknown,limit:number,depthLimit:number):unknown{
 if(!Number.isSafeInteger(limit)||limit<1||limit>16_777_216||!Number.isSafeInteger(depthLimit)||depthLimit<1||depthLimit>32)fail();
 if(typeof raw!=='string'||raw.length>limit)fail();const bytes=new TextEncoder().encode(raw);
 if(bytes.length>limit||new TextDecoder('utf-8',{fatal:true}).decode(bytes)!==raw)fail();
 let quoted=false,escaped=false,depth=0;
 for(const c of raw){if(quoted){if(escaped)escaped=false;else if(c==='\\')escaped=true;else if(c==='"')quoted=false;}
 else if(c==='"')quoted=true;else if(c==='{'||c==='['){if(++depth>depthLimit)fail();}else if(c==='}'||c===']'){if(--depth<0)fail();}}
 assertRawJsonWithoutDuplicateKeysV1(raw);const value:unknown=JSON.parse(raw);
 const numbers=(v:unknown):void=>{if(typeof v==='number'&&(!Number.isSafeInteger(v)||Object.is(v,-0)))fail();if(v&&typeof v==='object')for(const c of Object.values(v))numbers(c);};numbers(value);return value;
}
export function decodeExactWeekNumericAuthorityRawV3(raw:string):ExactWeekNumericAuthorityV3{
 const value=parseExactValidationJsonRawV3(raw,8_388_608,24),keys=['contract','requestOperationId','evaluatedSnapshotRawSha256','weekRequestDigest','snapshotDigest','generationInputDigest',
 'trustedGenerationInputRaw','currentGoalTargetRaw','balancePolicySnapshotRaw','distributionPolicyRaw','recipeInputs'];
 if(!value||typeof value!=='object'||Array.isArray(value)||Object.keys(value).length!==keys.length||keys.some(k=>!Object.prototype.hasOwnProperty.call(value,k)))fail();
 const r=value as Record<string,unknown>;
 if(r.contract!==exactWeekNumericAuthorityContractV3||typeof r.requestOperationId!=='string'||!uuid.test(r.requestOperationId)
  ||['evaluatedSnapshotRawSha256','weekRequestDigest','snapshotDigest','generationInputDigest'].some(k=>typeof r[k]!=='string'||!hash.test(r[k] as string))
  ||['trustedGenerationInputRaw','currentGoalTargetRaw','balancePolicySnapshotRaw','distributionPolicyRaw'].some(k=>typeof r[k]!=='string')
  ||!Array.isArray(r.recipeInputs)||!r.recipeInputs.length||r.recipeInputs.length>64)fail();
 return r as unknown as ExactWeekNumericAuthorityV3;
}
function freeze<T>(v:T):T{if(v&&typeof v==='object'){for(const c of Object.values(v))freeze(c);Object.freeze(v);}return v;}
const sha=(raw:string)=>adaptiveNutritionSha256HexV1(new TextEncoder().encode(raw));
/** The existing port must independently load a V3 package from admitted request/store state.
 * A V1 package rejects. Callers supply only operation and proposal text, never policies/source contexts. */
export function createExactWeekNutritionValidationAdapterV3(port:GenerationValidationAuthorityPortV1,eventAuthority:ExactTypedRecipeAuthorityV3){
 return Object.freeze({async validate(requestOperationId:string,snapshotRaw:string):Promise<ExactWeekNumericResultV3>{
  const blocked=(reason:Extract<ExactWeekNumericResultV3,{status:'BLOCKED'}>['reason']):ExactWeekNumericResultV3=>Object.freeze({status:'BLOCKED',reason,accepted:false,canRecord:false,canActivate:false});
  try{if(typeof requestOperationId!=='string'||!uuid.test(requestOperationId))fail();parseExactValidationJsonRawV3(snapshotRaw,262144,12);}catch{return blocked('INVALID_PROPOSAL');}
  const evaluatedSnapshotRawSha256=await sha(snapshotRaw);
  let authorityRaw:string|null;try{authorityRaw=await port.loadForProposalRaw(requestOperationId,evaluatedSnapshotRawSha256);}catch{return blocked('AUTHORITY_UNAVAILABLE');}
  if(authorityRaw===null)return blocked('AUTHORITY_UNAVAILABLE');
  let a:ExactWeekNumericAuthorityV3,input:ReturnType<typeof decodeTrustedGenerationInputRawV1>,goal:ReturnType<typeof decodeGoalNutritionTargetV1>,balance:Awaited<ReturnType<typeof decodeBalancePolicySnapshotRawV2>>,distribution:ReturnType<typeof decodeMealDistributionPolicyRawV1>;
  try{
   a=decodeExactWeekNumericAuthorityRawV3(authorityRaw);if(a.requestOperationId!==requestOperationId||a.evaluatedSnapshotRawSha256!==evaluatedSnapshotRawSha256)fail();
   parseExactValidationJsonRawV3(a.trustedGenerationInputRaw,262144,12);parseExactValidationJsonRawV3(a.currentGoalTargetRaw,65536,8);parseExactValidationJsonRawV3(a.balancePolicySnapshotRaw,65536,8);parseExactValidationJsonRawV3(a.distributionPolicyRaw,262144,12);
   input=decodeTrustedGenerationInputRawV1(a.trustedGenerationInputRaw);
   if(input.operation.requestId!==requestOperationId||await trustedGenerationInputDigestV1(input)!==a.generationInputDigest)fail();
   goal=decodeGoalNutritionTargetV1(JSON.parse(a.currentGoalTargetRaw));if(canonicalJsonV1(goal)!==canonicalJsonV1(input.goalNutritionTarget))fail();
   balance=await decodeBalancePolicySnapshotRawV2(a.balancePolicySnapshotRaw,a.trustedGenerationInputRaw);
   distribution=decodeMealDistributionPolicyRawV1(a.distributionPolicyRaw,a.trustedGenerationInputRaw);
  }catch{return blocked('AUTHORITY_INVALID_OR_MISMATCHED');}
  let snapshot:Awaited<ReturnType<typeof decodeExactWeekNutritionSnapshotRawV3>>;
  try{
   snapshot=await decodeExactWeekNutritionSnapshotRawV3(snapshotRaw,a.weekRequestDigest,a.recipeInputs,eventAuthority);
   if(snapshot.digest!==a.snapshotDigest||snapshot.request.accountId!==input.accountId||snapshot.request.selectionId!==input.selection.selectionId
    ||snapshot.request.weekStartLocal!==input.weekStartLocal||snapshot.request.timezone!==input.timezone)fail();
   for(const [i,day] of snapshot.days.entries()){
    const expected=distribution.days[i];if(day.date!==expected.date||day.meals.length!==expected.requiredSlots.length)fail();
    for(const [j,meal] of day.meals.entries())if(meal.slotId!==expected.requiredSlots[j].slotId||meal.mealType!==expected.requiredSlots[j].mealType)fail();
   }
  }catch{return blocked('SOURCE_OR_SNAPSHOT_INVALID');}
  const violations:ExactWeekNumericViolationV3[]=[];
  const compare=(scope:'MEAL'|'DAY'|'WEEK',check:ExactWeekNumericViolationV3['check'],path:string,axis:Axis|null,actual:ExactScalarV2,minimum:ExactScalarV2|null,maximum:ExactScalarV2)=>{
   const code=minimum!==null&&compareExactScalarsV2(actual,minimum)<0?'BELOW_MINIMUM':compareExactScalarsV2(actual,maximum)>0?'ABOVE_MAXIMUM':null;
   if(code)violations.push(Object.freeze({scope,check,path,axis,actual,minimum,maximum,code}));
  };
  const bounds=(check:'MEAL_NUTRITION'|'MEAL_DISTRIBUTION',path:string,actual:ExactNutritionValuesV2,b: NutritionBoundsV1)=>{
   for(const axis of exactNutritionAxesV2)compare('MEAL',check,path,axis,actual.values[axis],exactScalarFromDecimalV2(b.minimum[axis]),exactScalarFromDecimalV2(b.maximum[axis]));
  };
  const checkedGoalAxes=exactNutritionAxesV2.filter(axis=>goal[axis]!==null),unspecifiedGoalAxes=exactNutritionAxesV2.filter(axis=>goal[axis]===null);
  for(const [i,day] of snapshot.days.entries()){
   const d=distribution.days[i];
   for(const [j,meal] of day.meals.entries()){
    const path=`days[${i}].meals[${j}]`;
    bounds('MEAL_NUTRITION',path,meal.nutrition,d.nutritionBounds[j].bounds);bounds('MEAL_DISTRIBUTION',path,meal.nutrition,d.distributionBounds[j].bounds);
    compare('MEAL','COMPONENT_COUNT',path,null,{numerator:String(meal.components.length),denominator:'1'},null,{numerator:String(balance.policy.maxComponents),denominator:'1'});
   }
   for(const axis of checkedGoalAxes){const limit=goal[axis]!;compare('DAY','DAY_GOAL',`days[${i}]`,axis,day.nutrition.values[axis],exactScalarFromDecimalV2(limit.min),exactScalarFromDecimalV2(limit.max));}
  }
  for(const axis of checkedGoalAxes){const limit=goal[axis]!,scale={numerator:'7',denominator:'1'};compare('WEEK','WEEK_GOAL','week',axis,snapshot.nutrition.values[axis],
   multiplyExactScalarsV2(exactScalarFromDecimalV2(limit.min),scale),multiplyExactScalarsV2(exactScalarFromDecimalV2(limit.max),scale));}
  const distributionPolicyDigest=await sha(canonicalJsonV1(distribution,'SAFE_INTEGER'));
  const payload={contract:exactWeekNumericResultContractV3,status:violations.length?'NUMERIC_LIMITS_REJECTED' as const:'NUMERIC_CHECKS_PASSED_PENDING_VALIDATION' as const,
   authority:'NONE' as const,accepted:false as const,canRecord:false as const,canActivate:false as const,requestOperationId,evaluatedSnapshotRawSha256,
   snapshotDigest:snapshot.digest,weekRequestDigest:snapshot.requestDigest,generationInputDigest:a.generationInputDigest,goalRevision:goal.goalRevision,targetPolicyRevision:goal.targetPolicyRevision,
   validationPolicyRevision:balance.policy.policyRevision,balancePolicyDigest:balance.digest,distributionPolicyDigest,authorityPackageRawSha256:await sha(authorityRaw),
   checkedGoalAxes:Object.freeze(checkedGoalAxes),unspecifiedGoalAxes:Object.freeze(unspecifiedGoalAxes),violations:Object.freeze(violations),remainingChecks:exactWeekNumericRemainingChecksV3};
  return freeze({...payload,digest:await sha(canonicalJsonV1({domain:'potok-exact-week-numeric-validation-result-sha256-v3',payload},'SAFE_INTEGER'))});
 }});
}
