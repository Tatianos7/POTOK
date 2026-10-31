// Synthetic fixture envelopes only; never owner review/publication or runtime warning assessment.
import {generationProducerSourceContractV1} from '../generationProducerSourcesV1';
import {fixtureHashV1} from './generationAdmittedWorkerFixturesV1';
import type {FullFixture} from '../../utils/__tests__/trustedGeneratedWeekFixturesV1';
export function generationProducerEnvelopeFixtureV1(f:FullFixture,kind:'METADATA'|'MEAL_WARNING',payloadRaw:string):string{
  const value=JSON.parse(payloadRaw);
  return JSON.stringify({contract:generationProducerSourceContractV1,requestOperationId:f.context.input.operation.requestId,sourceKind:kind,
    generationInputDigest:f.evidence.generationInputDigest,validationEvidenceDigest:f.evidence.digest,
    validationPoliciesDigest:JSON.parse(f.policiesRaw).digest,slotId:kind==='METADATA'?null:value.slotId,
    mealSnapshotDigest:kind==='METADATA'?null:value.mealSnapshotDigest,payloadRaw,storageSha256:fixtureHashV1(payloadRaw),sourceRef:'synthetic-only:'+kind});
}
