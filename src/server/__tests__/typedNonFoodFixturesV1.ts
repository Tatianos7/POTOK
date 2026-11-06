/** Synthetic only. No real water/salt source, review, role or approval is issued. */
import {exactFoodFixtureV2,id,raw,sha} from './exactFoodNutritionFixturesV2';
import {nonFoodContractV1,nonFoodDigestV1,nonFoodRequestDigestV1,type NonFoodRequestV1,type NonFoodProposalV1,type HeadV1} from '../nonFoodEvidenceV1';
import type {NonFoodReviewedSnapshotV1,NonFoodRecipeBindingV1,NonFoodReviewEventV1,NonFoodReceiptOperationV1} from '../nonFoodReviewedSnapshotV1';
import type {RetainedFoodSourceSnapshotV1} from '../../utils/foodReviewedEvidenceV1';
type Approval=NonFoodRequestV1&{kind:'REVIEW_APPROVED'};
interface Revision{contract:string;definitionId:string;revisionId:string;supersedesRevisionId:string|null;reviewEventId:string;proposal:NonFoodProposalV1;retainedSource:RetainedFoodSourceSnapshotV1;digest:string}
interface Receipt{contract:string;actorId:string;idempotencyReference:string;requestDigest:string;rawRequestSha256:string;
  event:NonFoodReviewEventV1;revision:Revision;definitionRevision:Revision|null;heads:{definition:HeadV1;nutrition:HeadV1};replayed:boolean}
export async function typedNonFoodFixtureV1(kind:'POTABLE_WATER'|'SALT'='POTABLE_WATER',offset=1000,rowId='water'){
  const f=await exactFoodFixtureV2(),actorId=id(offset+10),app={kind:'EXACT_FOOD_STATE' as const,foodState:'as-sold' as const};
  const source=(nutrition:boolean):RetainedFoodSourceSnapshotV1=>({...f.source,sourceArtifactId:id(offset+6),
    mappings:(nutrition?['calories','protein','fat','carbs','fiber'] as const:['identitySnapshot'] as const).map(field=>({field,sourceField:'synthetic.'+field,applicability:app}))});
  const definitionId=id(offset+1),stableKey=kind==='SALT'?'synthetic_table_salt':'synthetic_plain_water';
  const definitionRequest:Approval={contract:nonFoodContractV1,kind:'REVIEW_APPROVED',idempotencyReference:id(offset+11),expectedHead:null,reason:null,
    retainedSource:source(false),proposal:{kind:'DEFINITION',definitionId,stableKey,displayName:'Synthetic only',applicability:app,exclusions:['additives','sugar']}};
  async function approval(request:Approval,revisionId:string,eventId:string,definitionRevision:Revision|null):Promise<Receipt>{
    const proposal=request.proposal;if(proposal.definitionId===null)throw Error('fixture definition ID required');
    const revisionPayload={contract:proposal.kind==='DEFINITION'?'potok-nonfood-definition-revision-v1':'potok-nonfood-nutrition-revision-v1',
      definitionId:proposal.definitionId,revisionId,supersedesRevisionId:null,reviewEventId:eventId,proposal,retainedSource:request.retainedSource};
    const revision={...revisionPayload,digest:await nonFoodDigestV1('potok-nonfood-revision-sha256-v1',revisionPayload)};
    const requestRaw=raw(request),requestDigest=await nonFoodRequestDigestV1(requestRaw);
    const eventPayload={contract:'potok-nonfood-review-event-v1' as const,eventId,actorId,authorityReference:'potok-control-admin-attestation-v2:'+id(offset+12),
      occurredAt:'2026-11-06T00:00:00.000Z',kind:'REVIEW_APPROVED' as const,requestDigest,
      target:{kind:proposal.kind,definitionId,revisionId,digest:revision.digest},retainedSource:request.retainedSource,reason:null,severity:null};
    const event={...eventPayload,digest:await nonFoodDigestV1('potok-nonfood-event-sha256-v1',eventPayload)};
    return {contract:'potok-nonfood-receipt-v1',actorId,idempotencyReference:request.idempotencyReference,requestDigest,rawRequestSha256:sha(requestRaw),event,
      revision,definitionRevision,heads:{definition:definitionRevision?{revisionId:definitionRevision.revisionId,digest:definitionRevision.digest}:{revisionId,digest:revision.digest},
        nutrition:definitionRevision?{revisionId,digest:revision.digest}:null},replayed:false};
  }
  const definition=await approval(definitionRequest,id(offset+2),id(offset+3),null);
  const zero={calories:'0.000',protein:'0.000',fat:'0.000',carbs:'0.000',fiber:'0.000'};
  const nutritionRequest:Approval={contract:nonFoodContractV1,kind:'REVIEW_APPROVED',idempotencyReference:id(offset+13),expectedHead:null,reason:null,
    retainedSource:source(true),proposal:{kind:'NUTRITION',definitionId,definitionRevisionId:definition.revision.revisionId,definitionRevisionDigest:definition.revision.digest,
      applicability:app,basis:'PER_100_G_EDIBLE',units:{calories:'kcal',protein:'g',fat:'g',carbs:'g',fiber:'g'},sourceValues:zero,nutrition:{...zero},
      carbohydrateSemantics:'AVAILABLE_EXCLUDING_FIBER',mappingPolicyVersion:'potok-source-available-direct-v1'}};
  const nutrition=await approval(nutritionRequest,id(offset+4),id(offset+5),definition.revision);
  const op=(request:NonFoodRequestV1,receipt:Receipt):NonFoodReceiptOperationV1=>({actorId,requestRaw:raw(request),receiptRaw:raw(receipt)});
  const d=op(definitionRequest,definition),n=op(nutritionRequest,nutrition);
  const snapshot:NonFoodReviewedSnapshotV1={definitionApproval:d,nutritionApproval:n,activeDefinition:{revisionId:definition.revision.revisionId,digest:definition.revision.digest},
    activeNutrition:{revisionId:nutrition.revision.revisionId,digest:nutrition.revision.digest},currentFoodState:'as-sold',relevantOperations:[d,n]};
  const binding:NonFoodRecipeBindingV1={rowId,definitionId,stableKey,definitionRevisionId:definition.revision.revisionId,definitionDigest:definition.revision.digest,
    nutritionRevisionId:nutrition.revision.revisionId,nutritionDigest:nutrition.revision.digest,foodState:'as-sold'};
  async function invalidate(which:'DEFINITION'|'NUTRITION'='NUTRITION',severity:'CORRECTION'|'SAFETY_CRITICAL'='SAFETY_CRITICAL'){
    const selected=which==='DEFINITION'?definition:nutrition,target={kind:which,definitionId,revisionId:selected.revision.revisionId,digest:selected.revision.digest};
    const request:NonFoodRequestV1={contract:nonFoodContractV1,kind:'INVALIDATION',idempotencyReference:id(offset+21),target,severity,reason:'Synthetic invalidation',retainedSource:source(which==='NUTRITION')};
    const requestDigest=await nonFoodRequestDigestV1(raw(request));
    const {digest:oldDigest,...old}=selected.event;void oldDigest;
    const payload={...old,eventId:id(offset+20),occurredAt:'2026-11-05T00:00:00.000Z',kind:'INVALIDATION' as const,requestDigest,target,reason:request.reason,severity,retainedSource:request.retainedSource};
    const receipt={...selected,idempotencyReference:request.idempotencyReference,requestDigest,rawRequestSha256:sha(raw(request)),
      event:{...payload,digest:await nonFoodDigestV1('potok-nonfood-event-sha256-v1',payload)}};
    return op(request,receipt);
  }
  return {kind,binding,snapshot,definition,nutrition,definitionRequest,nutritionRequest,invalidate};
}
