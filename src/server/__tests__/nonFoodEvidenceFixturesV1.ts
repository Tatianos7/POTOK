/** SYNTHETIC ONLY. No real water source bytes or real approvals. */
import { source as foodSource, id, actor } from './foodEvidenceFixturesV1';
import { canonicalNonFoodV1, nonFoodContractV1, nonFoodDigestV1, nonFoodRequestDigestV1,
  type NonFoodRequestV1 } from '../nonFoodEvidenceV1';
import { adaptiveNutritionSha256HexV1 } from '../../utils/adaptiveNutritionWireV1';
export { id, actor };
export function nonFoodSource(n: number, nutrition = false) {
  const s = foodSource(n, undefined, false, nutrition);
  return { ...s, mappings: s.mappings.map(m => ({ ...m, applicability: { kind: 'EXACT_FOOD_STATE' as const, foodState: 'as-sold' as const } })) };
}
export function definitionRequest(key = 2000): NonFoodRequestV1 & { kind: 'REVIEW_APPROVED' } {
  return { contract: nonFoodContractV1, kind: 'REVIEW_APPROVED', idempotencyReference: id(key), expectedHead: null, reason: null,
    retainedSource: nonFoodSource(key + 100), proposal: { kind: 'DEFINITION', definitionId: null,
      stableKey: 'synthetic_plain_liquid', displayName: 'Synthetic liquid, not real water evidence',
      applicability: { kind: 'EXACT_FOOD_STATE', foodState: 'as-sold' }, exclusions: ['flavor','mineral','sugar'] } };
}
export function nutritionRequest(definitionId: string, revisionId: string, digest: string, key = 3000): NonFoodRequestV1 & { kind: 'REVIEW_APPROVED' } {
  const values = { calories:'0.000',protein:'0.000',fat:'0.000',carbs:'0.000',fiber:'0.000' };
  return { contract: nonFoodContractV1, kind:'REVIEW_APPROVED',idempotencyReference:id(key),expectedHead:null,reason:null,
    retainedSource: nonFoodSource(key + 100, true), proposal: { kind:'NUTRITION', definitionId, definitionRevisionId:revisionId,
      definitionRevisionDigest:digest,applicability:{kind:'EXACT_FOOD_STATE',foodState:'as-sold'},basis:'PER_100_G_EDIBLE',
      units:{calories:'kcal',protein:'g',fat:'g',carbs:'g',fiber:'g'},sourceValues:values,nutrition:{...values},
      carbohydrateSemantics:'AVAILABLE_EXCLUDING_FIBER',mappingPolicyVersion:'potok-source-available-direct-v1' } };
}
export async function syntheticReceipt(raw: string, actorId = actor) {
  const request = JSON.parse(raw) as NonFoodRequestV1;
  if (request.kind !== 'REVIEW_APPROVED') throw new Error('fixture approval only');
  const proposal = { ...request.proposal, definitionId: request.proposal.definitionId ?? id(8000) };
  const content = { contract: proposal.kind === 'DEFINITION' ? 'potok-nonfood-definition-revision-v1' : 'potok-nonfood-nutrition-revision-v1',
    definitionId: proposal.definitionId, revisionId:id(8001),supersedesRevisionId:request.expectedHead?.revisionId ?? null,
    reviewEventId:id(8002),proposal,retainedSource:request.retainedSource };
  const revision = { ...content,digest:await nonFoodDigestV1('potok-nonfood-revision-sha256-v1',content) };
  const requestDigest = await nonFoodRequestDigestV1(raw);
  const target = {kind:proposal.kind,definitionId:proposal.definitionId,revisionId:revision.revisionId,digest:revision.digest};
  const eventContent = {contract:'potok-nonfood-review-event-v1',eventId:id(8002),actorId,
    authorityReference:`potok-control-admin-attestation-v2:${id(9000)}`,occurredAt:'2026-10-13T12:00:00.000Z',
    kind:request.kind,requestDigest,target,retainedSource:request.retainedSource,reason:null,severity:null};
  return { contract:'potok-nonfood-receipt-v1',actorId,idempotencyReference:request.idempotencyReference,requestDigest,
    rawRequestSha256:await adaptiveNutritionSha256HexV1(new TextEncoder().encode(raw)),event:{...eventContent,digest:await nonFoodDigestV1('potok-nonfood-event-sha256-v1',eventContent)},
    revision,definitionRevision:null,heads:{definition:{revisionId:revision.revisionId,digest:revision.digest},nutrition:null},replayed:false };
}
export const fixtureCanonical = canonicalNonFoodV1;
