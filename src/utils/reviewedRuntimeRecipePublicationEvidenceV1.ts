import { decodeAdaptiveNutritionCandidateManifestEntryRawV2,
  type AdaptiveNutritionCandidateManifestEntryV2 } from './adaptiveNutritionAuthoritiesV1';
import { decodeMealCompositionEligibilityV1,
  type MealCompositionEligibilitySnapshotV1 } from './adaptiveNutritionMealCompositionV1';
import { decodePlanEligibilityEvidenceRawV1, type PlanEligibilityEvidenceV1 } from './trustedValidationEvidenceV1';
import type { CuratedRecipeCanonicalPointerV1 } from './curatedRecipePublicationV1';
import { assertRawJsonWithoutDuplicateKeysV1, adaptiveNutritionSha256HexV1 } from './adaptiveNutritionWireV1';

export const reviewedRuntimeRecipePublicationEvidenceContractV1 = 'potok-reviewed-runtime-recipe-publication-evidence-v1' as const;
export const reviewedRuntimeRecipePublicationEvidenceEncodingV1 = 'potok-reviewed-runtime-recipe-publication-evidence-canonical-json-v1' as const;
export interface ReviewedRuntimeRecipeSourceV1 {
  reviewStatus: 'REVIEWED';
  authoringRecipeId: string;
  workbookRevision: string;
  recipeEvidenceRef: string;
  publicationRevision: string;
  nutritionEvidenceRef: string;
  allergenEvidenceRef: string;
  dietaryEvidenceRef: string;
  foodBindings: Array<{ componentId: string; canonicalStatus: 'RESOLVED'; canonical: CuratedRecipeCanonicalPointerV1 }>;
  nonFoodBindings: Array<{ componentId: string; componentDefinitionId: string; approvedNonFoodEvidenceRef: string }>;
}
export interface ReviewedRuntimeRecipePublicationEvidenceV1 {
  contract: typeof reviewedRuntimeRecipePublicationEvidenceContractV1;
  manifestEntry: AdaptiveNutritionCandidateManifestEntryV2;
  compositionEligibility: MealCompositionEligibilitySnapshotV1;
  planEligibility: PlanEligibilityEvidenceV1;
  reviewedSource: ReviewedRuntimeRecipeSourceV1;
  digest: string;
}
const uuidPattern = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/;
const hashPattern = /^[0-9a-f]{64}$/;
function record(value: unknown, keys: readonly string[]): Record<string, unknown> {
  if (!value || typeof value !== 'object' || Array.isArray(value) || Object.getPrototypeOf(value) !== Object.prototype
    || Object.keys(value).length !== keys.length || keys.some(key => !Object.prototype.hasOwnProperty.call(value,key))) {
    throw new Error('REVIEWED_PUBLICATION_FIELDS_INVALID');
  }
  return value as Record<string, unknown>;
}
function text(value: unknown): string {
  if (typeof value !== 'string' || value.trim().length === 0) throw new Error('REVIEWED_PUBLICATION_TEXT_REQUIRED');
  return value;
}
function uuid(value: unknown): string {
  const result=text(value); if(!uuidPattern.test(result)) throw new Error('REVIEWED_PUBLICATION_UUID_INVALID'); return result;
}
function hash(value: unknown): string {
  const result=text(value); if(!hashPattern.test(result)) throw new Error('REVIEWED_PUBLICATION_DIGEST_INVALID'); return result;
}
function parse(raw: string): unknown {
  if(typeof raw!=='string') throw new Error('REVIEWED_PUBLICATION_RAW_STRING_REQUIRED');
  assertRawJsonWithoutDuplicateKeysV1(raw); return JSON.parse(raw) as unknown;
}
function canonical(value: unknown): string {
  if(value===null||typeof value==='string'||typeof value==='boolean') return JSON.stringify(value);
  if(typeof value==='number') {
    if(!Number.isSafeInteger(value)||Object.is(value,-0)) throw new Error('REVIEWED_PUBLICATION_CANONICAL_NUMBER_INVALID');
    return JSON.stringify(value);
  }
  if(Array.isArray(value)) return `[${value.map(canonical).join(',')}]`;
  if(value&&typeof value==='object') {
    const row=value as Record<string,unknown>;
    return `{${Object.keys(row).sort().map(key=>`${JSON.stringify(key)}:${canonical(row[key])}`).join(',')}}`;
  }
  throw new Error('REVIEWED_PUBLICATION_CANONICAL_VALUE_INVALID');
}
function bytes(evidence: Omit<ReviewedRuntimeRecipePublicationEvidenceV1,'digest'>): Uint8Array {
  return new TextEncoder().encode(canonical({contract:reviewedRuntimeRecipePublicationEvidenceContractV1,
    encoding:reviewedRuntimeRecipePublicationEvidenceEncodingV1,evidence}));
}
function frozen<T>(value:T):T {
  if(value&&typeof value==='object') {for(const child of Object.values(value)) frozen(child); Object.freeze(value);}
  return value;
}
function sortedBindings<T extends {componentId:string}>(value:unknown,decode:(value:unknown)=>T):T[] {
  if(!Array.isArray(value)) throw new Error('REVIEWED_PUBLICATION_BINDINGS_REQUIRED');
  const result=value.map(decode);
  if(result.some((entry,index)=>index>0&&result[index-1].componentId>=entry.componentId)) {
    throw new Error('REVIEWED_PUBLICATION_BINDINGS_ORDER_OR_DUPLICATE');
  }
  return result;
}
function sourceOwned(value:unknown,entry:AdaptiveNutritionCandidateManifestEntryV2):ReviewedRuntimeRecipeSourceV1 {
  const row=record(value,['reviewStatus','authoringRecipeId','workbookRevision','recipeEvidenceRef','publicationRevision',
    'nutritionEvidenceRef','allergenEvidenceRef','dietaryEvidenceRef','foodBindings','nonFoodBindings']);
  if(row.reviewStatus!=='REVIEWED') throw new Error('REVIEWED_PUBLICATION_REVIEW_REQUIRED');
  const authoringRecipeId=text(row.authoringRecipeId);
  if(!/^[a-z0-9][a-z0-9_-]{0,127}$/.test(authoringRecipeId)) throw new Error('REVIEWED_PUBLICATION_AUTHORING_ID_INVALID');
  const foodBindings=sortedBindings(row.foodBindings,(value)=>{
    const item=record(value,['componentId','canonicalStatus','canonical']);
    if(item.canonicalStatus!=='RESOLVED') throw new Error('REVIEWED_PUBLICATION_CANONICAL_RESOLUTION_REQUIRED');
    const pointer=record(item.canonical,['foodStableId','canonicalFoodId','source','sharedCatalogAccessible','evidenceRevision','evidenceDigest']);
    const foodStableId=text(pointer.foodStableId);
    if(!/^[a-z0-9][a-z0-9_-]{0,127}$/.test(foodStableId)
      ||(pointer.source!=='core'&&pointer.source!=='brand')||pointer.sharedCatalogAccessible!==true) {
      throw new Error('REVIEWED_PUBLICATION_CANONICAL_POINTER_INACCESSIBLE');
    }
    return {componentId:uuid(item.componentId),canonicalStatus:'RESOLVED' as const,canonical:{foodStableId,canonicalFoodId:uuid(pointer.canonicalFoodId),
      source:pointer.source as 'core' | 'brand',sharedCatalogAccessible:true,evidenceRevision:text(pointer.evidenceRevision),evidenceDigest:hash(pointer.evidenceDigest)}};
  });
  const nonFoodBindings=sortedBindings(row.nonFoodBindings,(value)=>{
    const item=record(value,['componentId','componentDefinitionId','approvedNonFoodEvidenceRef']);
    return {componentId:uuid(item.componentId),componentDefinitionId:uuid(item.componentDefinitionId),
      approvedNonFoodEvidenceRef:text(item.approvedNonFoodEvidenceRef)};
  });
  const food=entry.recipeSnapshot.ingredients.filter(v=>v.identity.kind==='canonical_food');
  const nonFood=entry.recipeSnapshot.ingredients.filter(v=>v.identity.kind==='approved_non_food');
  const expectedFoodIds=[...new Set(food.map(v=>v.identity.kind==='canonical_food'?v.identity.canonicalFoodId:''))].sort();
  if(canonical(expectedFoodIds)!==canonical(entry.ingredientIds)) throw new Error('REVIEWED_PUBLICATION_FOOD_ID_COVERAGE_MISMATCH');
  if(foodBindings.length!==food.length||nonFoodBindings.length!==nonFood.length
    ||food.some(v=>!foodBindings.some(b=>b.componentId===v.componentId&&v.identity.kind==='canonical_food'
      &&b.canonical.canonicalFoodId===v.identity.canonicalFoodId))
    ||nonFood.some(v=>!nonFoodBindings.some(b=>b.componentId===v.componentId&&v.identity.kind==='approved_non_food'
      &&b.componentDefinitionId===v.identity.componentDefinitionId))) throw new Error('REVIEWED_PUBLICATION_TYPED_COVERAGE_MISMATCH');
  const publicationRevision=uuid(row.publicationRevision);
  if(publicationRevision!==entry.publicationRevision) throw new Error('REVIEWED_PUBLICATION_REVISION_MISMATCH');
  return {reviewStatus:'REVIEWED',authoringRecipeId,workbookRevision:text(row.workbookRevision),recipeEvidenceRef:text(row.recipeEvidenceRef),
    publicationRevision,nutritionEvidenceRef:text(row.nutritionEvidenceRef),allergenEvidenceRef:text(row.allergenEvidenceRef),
    dietaryEvidenceRef:text(row.dietaryEvidenceRef),foodBindings,nonFoodBindings};
}
async function decodeOwned(value:unknown):Promise<ReviewedRuntimeRecipePublicationEvidenceV1> {
  const row=record(value,['contract','manifestEntry','compositionEligibility','planEligibility','reviewedSource','digest']);
  if(row.contract!==reviewedRuntimeRecipePublicationEvidenceContractV1) throw new Error('REVIEWED_PUBLICATION_CONTRACT_INVALID');
  // These are parser-owned graphs, never arbitrary-object sanitization bridges.
  const manifestEntry=await decodeAdaptiveNutritionCandidateManifestEntryRawV2(JSON.stringify(row.manifestEntry));
  const compositionEligibility=decodeMealCompositionEligibilityV1(row.compositionEligibility);
  const planEligibility=await decodePlanEligibilityEvidenceRawV1(JSON.stringify(row.planEligibility));
  for(const key of ['recipeId','recipeRevisionId','portionRevisionId','eligibilityRevisionId'] as const) {
    if(planEligibility[key]!==manifestEntry[key]) throw new Error('REVIEWED_PUBLICATION_PLAN_ELIGIBILITY_MISMATCH');
  }
  if(compositionEligibility.recipeRevisionId!==manifestEntry.recipeRevisionId
    ||compositionEligibility.eligibilityRevisionId!==manifestEntry.eligibilityRevisionId) throw new Error('REVIEWED_PUBLICATION_COMPOSITION_REVISION_MISMATCH');
  for(const key of ['allowedMealTypes','role','anchorKind','requiredCompanionRoleSets','pairingTags','incompatiblePairingTags',
    'repeatFamily','energyClass','beverageClass'] as const) {
    if(canonical(compositionEligibility[key])!==canonical(manifestEntry[key])) throw new Error('REVIEWED_PUBLICATION_COMPOSITION_CONTENT_MISMATCH');
  }
  const reviewedSource=sourceOwned(row.reviewedSource,manifestEntry);
  const content={contract:reviewedRuntimeRecipePublicationEvidenceContractV1,manifestEntry,compositionEligibility,planEligibility,reviewedSource};
  const digest=await adaptiveNutritionSha256HexV1(bytes(content));
  if(hash(row.digest)!==digest) throw new Error('REVIEWED_PUBLICATION_PACKAGE_DIGEST_MISMATCH');
  return frozen({...content,digest});
}
/** Independent trusted caller/source supplies pinnedRaw. Neither raw JSON nor a hash proves provenance. */
export async function decodeReviewedRuntimeRecipePublicationEvidenceRawV1(raw:string,pinnedRaw:string):Promise<ReviewedRuntimeRecipePublicationEvidenceV1> {
  if(typeof raw!=='string'||typeof pinnedRaw!=='string') throw new Error('REVIEWED_PUBLICATION_RAW_STRING_REQUIRED');
  const proposed=await decodeOwned(parse(raw));const pinned=await decodeOwned(parse(pinnedRaw));
  if(proposed.digest!==pinned.digest) throw new Error('REVIEWED_PUBLICATION_PINNED_MISMATCH');
  return proposed;
}
export async function reviewedRuntimeRecipePublicationEvidenceCanonicalBytesRawV1(raw:string,pinnedRaw:string):Promise<Uint8Array> {
  const {digest,...content}=await decodeReviewedRuntimeRecipePublicationEvidenceRawV1(raw,pinnedRaw);
  if(!hashPattern.test(digest)) throw new Error('REVIEWED_PUBLICATION_INTERNAL_DIGEST_INVALID');
  return bytes(content);
}
