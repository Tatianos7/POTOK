// Synthetic preparation metadata/warnings/decision trace for tests only.
// SQL authority tests supply stored sources separately; this fixture is not a runtime publisher.
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {createGenerationDayOptionsV1} from '../generationDayOptionsV1';
import {generationMenuCandidateSourceContractV1} from '../generationMenuCandidatesV1';
import {generationDecisionTraceContractV1} from '../generationPlanProposalV1';
import {generationValidationSourceContractV1} from '../generationValidationAuthorityLoaderV1';
import {adaptiveNutritionCandidateManifestCanonicalBytesV2,nutritionPreferenceSnapshotCanonicalBytesV1,nutritionSafetySnapshotCanonicalBytesV1} from '../../utils/adaptiveNutritionAuthoritiesV1';
import {canonicalJsonV1} from '../../utils/adaptiveNutritionWireV1';
import {resignEntry,type FullFixture} from '../../utils/__tests__/trustedGeneratedWeekFixturesV1';
export const fixtureHashV1=(raw:string|Uint8Array)=>createHash('sha256').update(raw).digest('hex');
export async function generationPreparationPortsFixtureV1(f:FullFixture) {
  const request=f.context.input.operation.requestId,counts={source:0};
  const sourceRaw=JSON.stringify({contract:generationMenuCandidateSourceContractV1,requestOperationId:request,
    contextRaw:f.contextRaw,policiesRaw:f.policiesRaw,goalProfile:'MAINTENANCE',
    slotRevisions:f.plan.graph.days.flatMap(d=>d.slots.map(s=>({slotId:s.slotId,mealSnapshotRevision:s.mealSnapshotRevision})))});
  const warnings={async loadMealWarningRaw(r:string,slot:string,digest:string){
    assert.equal(r,request);return JSON.stringify(resignEntry({...f.set.entries[0],slotId:slot,mealSnapshotDigest:digest}));
  }};
  const seed=await createGenerationDayOptionsV1({async loadPreparationRaw(){return sourceRaw;}},warnings).generate(request);
  assert.equal(seed.status,'FEASIBLE_PROPOSAL');if(seed.status!=='FEASIBLE_PROPOSAL')throw new Error('INVALID_FIXTURE');
  const weekSha=fixtureHashV1(seed.week.weekRaw);
  const trace=JSON.stringify({contract:generationDecisionTraceContractV1,requestOperationId:request,weekRawSha256:weekSha,
    slots:f.plan.graph.days.flatMap(d=>d.slots.map(s=>({slotId:s.slotId,generatorDecisionEvidence:s.generatorDecisionEvidence}))),
    weekOptimizationResultDigest:f.plan.graph.weekOptimizationResultDigest});
  return {source:{async loadPreparationRaw(r:string){counts.source++;assert.equal(r,request);return sourceRaw;}},warnings,
    decisions:{async loadDecisionTraceRaw(r:string,sha:string){assert.equal(r,request);assert.equal(sha,weekSha);return trace;}},counts};
}
export async function generationStoredAuthorityFixtureV1(f:FullFixture,proposalSha:string) {
  const descriptor=(bytes:Uint8Array)=>({canonicalHex:Buffer.from(bytes).toString('hex'),storageSha256:fixtureHashV1(bytes)});
  return JSON.stringify({contract:generationValidationSourceContractV1,requestOperationId:f.context.input.operation.requestId,
    accountId:f.context.input.accountId,evaluatedPlanRawSha256:proposalSha,
    input:{canonicalHex:Buffer.from(canonicalJsonV1(f.context.input,'SAFE_INTEGER'),'utf8').toString('hex'),generationInputDigest:f.evidence.generationInputDigest},
    manifest:descriptor(await adaptiveNutritionCandidateManifestCanonicalBytesV2(f.context.manifest)),
    preference:descriptor(await nutritionPreferenceSnapshotCanonicalBytesV1(f.context.preference)),
    safety:descriptor(await nutritionSafetySnapshotCanonicalBytesV1(f.context.safety)),
    validationEvidenceRaw:f.rawContext.trustedValidationEvidenceRaw,policiesRaw:f.policiesRaw,warningEvidenceRaw:f.warningRaw});
}
