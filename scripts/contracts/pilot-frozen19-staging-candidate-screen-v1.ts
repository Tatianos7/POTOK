/** Read-only Staging candidate review: a diagnostic, NEVER an identity resolver or issuer. */
import { buildFrozen19SourcePrecheckQueueV1 } from './pilot-frozen19-source-precheck-v1';
type Observed={id:string;name:string;source:string;canonical_food_id:string|null;is_searchable:boolean|null;
  needs_review:boolean|null;verified:boolean|null;cooking_state:string|null;
  calories:string|null;protein:string|null;fat:string|null;carbs:string|null;fiber:string|null};
const uuid=/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
export function screenFrozen19StagingCandidateV1(sourceRecord:string,food:Observed){
 const allowed=new Set(buildFrozen19SourcePrecheckQueueV1().groups.map(x=>x.sourceRecord));
 if(!allowed.has(sourceRecord)||!food||typeof food!=='object'||!uuid.test(food.id)||typeof food.name!=='string'||
    !['core','brand'].includes(food.source))throw Error('INVALID_FROZEN19_STAGING_OBSERVATION');
 const missing:string[]=[];
 if(food.canonical_food_id!==food.id)missing.push('CANONICAL_ROOT_NOT_CONFIRMED');
 if(food.is_searchable!==true||food.needs_review!==false||food.verified!==true)missing.push('REVIEW_FLAGS_NOT_COMPLETE');
 if(food.cooking_state===null||food.cooking_state==='unknown')missing.push('PREPARATION_STATE_UNKNOWN');
 for(const key of ['calories','protein','fat','carbs','fiber'] as const){
  if(typeof food[key]!=='string'||!/^\\d+(?:\\.\\d+)?$/.test(food[key]!))missing.push('MISSING_NUMERIC_'+key.toUpperCase());
 }
 // A spelt label is directly incompatible with the common-wheat recipe intent.
 if(sourceRecord==='SR28:20124'&&/полб|spelt/i.test(food.name))missing.push('SPELT_NOT_COMMON_WHEAT');
 // Even complete display fields cannot prove source applicability or real user RLS.
 missing.push('SOURCE_APPLICABILITY_INDEPENDENT_REVIEW_REQUIRED','VISIBLE_TO_REAL_CALLER_NOT_CONFIRMED');
 return {sourceRecord,observedFoodId:food.id,missing:[...new Set(missing)],
  disposition:'UNRESOLVED_PRECHECK' as const,
  identityApproved:false as const,sourceApproved:false as const,
  canApply:false as const,readyForServerSubmission:false as const};
}
