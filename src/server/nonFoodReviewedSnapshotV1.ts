/** Read-only reuse of PR165 receipts. No gateway, issuer, SQL or current-store implementation. */
import { verifyNonFoodReceiptV1, decodeNonFoodRequestV1, type TargetV1, type NutritionProposalV1 } from './nonFoodEvidenceV1';
import { canonicalJsonV1 } from '../utils/adaptiveNutritionWireV1';
import { parseFoodNutritionSourceBindingJsonRawV2 as parse } from '../utils/foodNutritionSourceBindingV2';
import type { ReviewedEvidenceAuthorityV1 } from './nutritionIntegrityReviewedEvidenceAdapterV1';
export interface NonFoodReviewEventV1 {
  readonly contract:'potok-nonfood-review-event-v1';readonly eventId:string;readonly actorId:string;
  readonly authorityReference:string;readonly occurredAt:string;readonly kind:'REVIEW_APPROVED'|'REVIEW_REJECTED'|'INVALIDATION';
  readonly requestDigest:string;readonly target:unknown;readonly retainedSource:unknown;
  readonly reason:string|null;readonly severity:'CORRECTION'|'SAFETY_CRITICAL'|null;readonly digest:string;
}
export interface NonFoodReceiptOperationV1 {readonly actorId:string;readonly requestRaw:string;readonly receiptRaw:string}
export interface NonFoodReviewedSnapshotV1 {
  readonly definitionApproval:NonFoodReceiptOperationV1;readonly nutritionApproval:NonFoodReceiptOperationV1;
  /** Atomic current heads/state and COMPLETE history for either selected revision, from trusted storage. */
  readonly activeDefinition:{readonly revisionId:string;readonly digest:string};
  readonly activeNutrition:{readonly revisionId:string;readonly digest:string};
  readonly currentFoodState:'raw'|'dry'|'frozen'|'cooked'|'as-sold';
  readonly relevantOperations:readonly NonFoodReceiptOperationV1[];
}
export interface NonFoodRecipeBindingV1 {
  readonly rowId:string;readonly definitionId:string;readonly stableKey:string;
  readonly definitionRevisionId:string;readonly definitionDigest:string;
  readonly nutritionRevisionId:string;readonly nutritionDigest:string;
  readonly foodState:'raw'|'dry'|'frozen'|'cooked'|'as-sold';
}
interface Revision {contract:string;definitionId:string;revisionId:string;reviewEventId:string;digest:string;proposal:Record<string,unknown>;retainedSource:unknown}
interface VerifiedReceipt {event:NonFoodReviewEventV1;revision:Revision|null;definitionRevision:Revision|null;requestKind:string}
function freeze<T>(value:T):T{if(value&&typeof value==='object'){for(const child of Object.values(value))freeze(child);Object.freeze(value);}return value;}
function ownOperation(value:NonFoodReceiptOperationV1):NonFoodReceiptOperationV1{
  if(typeof value.actorId!=='string'||typeof value.requestRaw!=='string'||typeof value.receiptRaw!=='string')throw Error('NONFOOD_SNAPSHOT_OPERATION');
  return {actorId:value.actorId,requestRaw:value.requestRaw,receiptRaw:value.receiptRaw};
}
export function ownNonFoodReviewedSnapshotV1(value:NonFoodReviewedSnapshotV1):NonFoodReviewedSnapshotV1{
  if(!Array.isArray(value.relevantOperations)||value.relevantOperations.length<2||value.relevantOperations.length>128)throw Error('NONFOOD_HISTORY_BUDGET');
  const operations:NonFoodReceiptOperationV1[]=[];
  for(let i=0;i<value.relevantOperations.length;i++){
    const d=Object.getOwnPropertyDescriptor(value.relevantOperations,String(i));if(!d||!('value'in d))throw Error('NONFOOD_HISTORY_DENSE');operations.push(ownOperation(d.value));
  }
  return freeze({definitionApproval:ownOperation(value.definitionApproval),nutritionApproval:ownOperation(value.nutritionApproval),
    activeDefinition:{...value.activeDefinition},activeNutrition:{...value.activeNutrition},currentFoodState:value.currentFoodState,relevantOperations:operations});
}
async function verified(operation:NonFoodReceiptOperationV1):Promise<VerifiedReceipt>{
  // Validate bounded duplicate-aware raw data before JSON serialization can normalize -0.
  parse(operation.requestRaw);const receipt=parse(operation.receiptRaw);
  await verifyNonFoodReceiptV1(operation.requestRaw,operation.actorId,receipt);
  const request=await decodeNonFoodRequestV1(operation.requestRaw);
  const result=receipt as {event:NonFoodReviewEventV1;revision:Revision|null;definitionRevision:Revision|null};
  return freeze({...result,requestKind:request.kind});
}
const canonical=(value:unknown)=>canonicalJsonV1(value,'SAFE_INTEGER');
export type NonFoodReviewedReadResultV1={readonly kind:'UNRESOLVED'}|{
  readonly kind:'REVIEWED_NONFOOD_V1';readonly binding:NonFoodRecipeBindingV1;
  readonly nutrition:NutritionProposalV1['nutrition'];readonly basis:'PER_100_G_EDIBLE';
  readonly definitionApprovalDigest:string;readonly nutritionApprovalDigest:string;
};
/** Selection binds existing reviewed definition IDs/stable key/state; never classify names or infer a kind.
 * Kind selection belongs to the independently pinned trusted recipe mapping, not a browser claim. */
export async function resolveNonFoodReviewedSnapshotV1(snapshot:NonFoodReviewedSnapshotV1,selection:NonFoodRecipeBindingV1,
  authority:ReviewedEvidenceAuthorityV1<NonFoodReviewEventV1>):Promise<NonFoodReviewedReadResultV1>{
  const unresolved=():NonFoodReviewedReadResultV1=>Object.freeze({kind:'UNRESOLVED'});
  try{
    const owned=ownNonFoodReviewedSnapshotV1(snapshot),expected={...selection};
    const d=await verified(owned.definitionApproval),n=await verified(owned.nutritionApproval);
    if(d.event.kind!=='REVIEW_APPROVED'||n.event.kind!=='REVIEW_APPROVED'||!d.revision||!n.revision)return unresolved();
    const definition=d.revision,nutrition=n.revision,dp=definition.proposal,np=nutrition.proposal as unknown as NutritionProposalV1;
    if(definition.contract!=='potok-nonfood-definition-revision-v1'||nutrition.contract!=='potok-nonfood-nutrition-revision-v1'
      ||dp.kind!=='DEFINITION'||np.kind!=='NUTRITION'||definition.definitionId!==expected.definitionId||nutrition.definitionId!==expected.definitionId
      ||definition.revisionId!==expected.definitionRevisionId||definition.digest!==expected.definitionDigest
      ||nutrition.revisionId!==expected.nutritionRevisionId||nutrition.digest!==expected.nutritionDigest||dp.stableKey!==expected.stableKey
      ||canonical(dp.applicability)!==canonical({kind:'EXACT_FOOD_STATE',foodState:expected.foodState})||np.applicability.foodState!==expected.foodState
      ||owned.currentFoodState!==expected.foodState||canonical(n.definitionRevision)!==canonical(definition)
      ||canonical(owned.activeDefinition)!==canonical({revisionId:definition.revisionId,digest:definition.digest})
      ||canonical(owned.activeNutrition)!==canonical({revisionId:nutrition.revisionId,digest:nutrition.digest})
      ||d.event.eventId===n.event.eventId)return unresolved();
    if(await authority.isAuthorizedEvent(d.event)!==true||await authority.isAuthorizedEvent(n.event)!==true)return unresolved();
    const approvals=new Map([[d.event.eventId,d.event.digest],[n.event.eventId,n.event.digest]]),seen=new Set<string>();
    for(const operation of owned.relevantOperations){
      const item=await verified(operation),event=item.event;
      if(seen.has(event.eventId)||await authority.isAuthorizedEvent(event)!==true)return unresolved();seen.add(event.eventId);
      const target=event.target as TargetV1|null;
      const selected=target?.kind==='DEFINITION'?definition:target?.kind==='NUTRITION'?nutrition:null;
      if(!selected||target?.definitionId!==expected.definitionId||target?.revisionId!==selected.revisionId||target?.digest!==selected.digest)return unresolved();
      if(event.kind!=='REVIEW_APPROVED'||approvals.get(event.eventId)!==event.digest)return unresolved();
    }
    if(seen.size!==2||![...approvals.keys()].every(id=>seen.has(id)))return unresolved();
    // PR165 already verifies source mapping and five explicitly zero nutrient values; no positive bypass.
    return freeze({kind:'REVIEWED_NONFOOD_V1',binding:expected,nutrition:{...np.nutrition},basis:np.basis,
      definitionApprovalDigest:d.event.digest,nutritionApprovalDigest:n.event.digest});
  }catch{return unresolved();}
}
