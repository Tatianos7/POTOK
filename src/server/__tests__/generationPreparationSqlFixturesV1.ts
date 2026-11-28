// Synthetic metadata allocation for tests only. No runtime source/reviewer publication.
import {generationStoredAuthorityFixtureV1,fixtureHashV1} from './generationAdmittedWorkerFixturesV1';
import {generationPreparationContextSourceContractV1} from '../generationValidationAuthorityLoaderV1';
import {generationPreparationMetadataContractV1} from '../generationPreparationSourceV1';
import type {FullFixture} from '../../utils/__tests__/trustedGeneratedWeekFixturesV1';
export async function generationPreparationContextFixtureV1(f:FullFixture):Promise<string>{
  const source=JSON.parse(await generationStoredAuthorityFixtureV1(f,fixtureHashV1(f.planRaw)));
  delete source.evaluatedPlanRawSha256;delete source.warningEvidenceRaw;
  source.contract=generationPreparationContextSourceContractV1;return JSON.stringify(source);
}
export function generationPreparationMetadataFixtureV1(f:FullFixture):string{
  return JSON.stringify({contract:generationPreparationMetadataContractV1,requestOperationId:f.context.input.operation.requestId,
    generationInputDigest:f.evidence.generationInputDigest,goalProfile:'MAINTENANCE',
    slotRevisions:f.plan.graph.days.flatMap(day=>day.slots.map(slot=>({slotId:slot.slotId,mealSnapshotRevision:slot.mealSnapshotRevision})))});
}
