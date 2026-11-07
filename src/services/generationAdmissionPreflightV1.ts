/** Immutable, fail-closed admission preflight for an actual 7-day generation request.
 * Input MUST be collected by a trusted server/SQL audit from published/current heads,
 * NEVER supplied by the browser or inferred from legacy premium_recipes rows.
 * This does not grant eligibility, write a manifest, or invoke the worker.
 */
export const generationAdmissionPreflightContractV1='potok-generation-admission-preflight-v1' as const;
export const requiredMealSlotsV1=['breakfast','lunch','dinner','snack'] as const;
export type RequiredMealSlotV1=typeof requiredMealSlotsV1[number];

export interface GenerationAdmissionEvidenceV1 {
  manifestHeadPublished:boolean;
  policyHeadPublished:boolean;
  currentGoalTargetPrepared:boolean;
  verifiedPremiumEntitlement:boolean;
  currentAuthorityAttested:boolean;
  currentSourceEvidenceVerified:boolean;
  admissionRevisionsCurrent:boolean;
  eligiblePublishedRecipeIdsBySlot:Record<RequiredMealSlotV1,readonly string[]>;
}
export type GenerationAdmissionBlockerV1=
  'MANIFEST_NOT_PUBLISHED'|'POLICY_NOT_PUBLISHED'|'GOAL_TARGET_NOT_PREPARED'|
  'PREMIUM_NOT_VERIFIED'|'AUTHORITY_NOT_ATTESTED'|'SOURCE_EVIDENCE_NOT_VERIFIED'|
  'ADMISSION_REVISIONS_NOT_CURRENT'|'INSUFFICIENT_ELIGIBLE_RECIPES'|'INVALID_ADMISSION_INPUT';
export interface GenerationAdmissionPreflightResultV1 {
  contract:typeof generationAdmissionPreflightContractV1;
  mayRequestGeneration:boolean;
  mayActivate:boolean;
  missing:readonly GenerationAdmissionBlockerV1[];
  coverage:readonly {slot:RequiredMealSlotV1;eligible:number;required:number;missing:number}[];
}
const uuid=/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const flags=[
 ['manifestHeadPublished','MANIFEST_NOT_PUBLISHED'],['policyHeadPublished','POLICY_NOT_PUBLISHED'],
 ['currentGoalTargetPrepared','GOAL_TARGET_NOT_PREPARED'],['verifiedPremiumEntitlement','PREMIUM_NOT_VERIFIED'],
 ['currentAuthorityAttested','AUTHORITY_NOT_ATTESTED'],['currentSourceEvidenceVerified','SOURCE_EVIDENCE_NOT_VERIFIED'],
 ['admissionRevisionsCurrent','ADMISSION_REVISIONS_NOT_CURRENT']
] as const;
const canonicalSlots=new Set<string>(requiredMealSlotsV1);
function valid(e:unknown):e is GenerationAdmissionEvidenceV1 {
  if(!e||typeof e!=='object'||Array.isArray(e))return false;
  const row=e as Record<string,unknown>;
  if(Object.keys(row).length!==flags.length+1||flags.some(([k])=>typeof row[k]!=='boolean'))return false;
  const pools=row.eligiblePublishedRecipeIdsBySlot;
  if(!pools||typeof pools!=='object'||Array.isArray(pools))return false;
  const bySlot=pools as Record<string,unknown>;
  if(Object.keys(bySlot).length!==requiredMealSlotsV1.length||Object.keys(bySlot).some(s=>!canonicalSlots.has(s)))return false;
  return requiredMealSlotsV1.every(slot=>{
    const ids=bySlot[slot];
    return Array.isArray(ids)&&ids.length<=10000&&ids.every(id=>typeof id==='string'&&uuid.test(id))&&
      new Set(ids).size===ids.length;
  });
}
/** Safe lower bound only. Actual selection may still fail composition, calories, allergens or family caps. */
export function checkGenerationAdmissionPreflightV1(
 evidence:unknown,{days=7,maxRecipeUses=2}:{days?:number;maxRecipeUses?:number}={}
):GenerationAdmissionPreflightResultV1 {
 const empty=requiredMealSlotsV1.map(slot=>({slot,eligible:0,required:4,missing:4}));
 if(!valid(evidence)||!Number.isInteger(days)||days!==7||!Number.isInteger(maxRecipeUses)||
    maxRecipeUses<1||maxRecipeUses>7)return {
  contract:generationAdmissionPreflightContractV1,mayRequestGeneration:false,mayActivate:false,
  missing:['INVALID_ADMISSION_INPUT'],coverage:empty,
 };
 const required=Math.ceil(days/maxRecipeUses);
 const missing:GenerationAdmissionBlockerV1[]=[];
 for(const [field,code] of flags)if(!evidence[field])missing.push(code);
 const coverage=requiredMealSlotsV1.map(slot=>{
   const eligible=evidence.eligiblePublishedRecipeIdsBySlot[slot].length;
   return {slot,eligible,required,missing:Math.max(0,required-eligible)};
 });
 const distinctAcrossAllSlots=new Set(requiredMealSlotsV1.flatMap(slot=>evidence.eligiblePublishedRecipeIdsBySlot[slot]));
 // Overlapping multi-category recipes still share the same seven-day reuse limit.
 if(coverage.some(x=>x.missing>0)||distinctAcrossAllSlots.size*maxRecipeUses<days*requiredMealSlotsV1.length)
   missing.push('INSUFFICIENT_ELIGIBLE_RECIPES');
 return {contract:generationAdmissionPreflightContractV1,
   mayRequestGeneration:missing.length===0,mayActivate:false,missing,coverage};
}
