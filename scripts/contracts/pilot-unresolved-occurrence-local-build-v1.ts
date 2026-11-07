/**
 * Local-only privacy boundary: never commit or print recipe-row queue.
 * Inputs are owner-retained private files. Validates captured SHA-256 pins
 * against the aggregate checked into the reviewed pilot branch.
 */
import { readFileSync, writeFileSync, realpathSync } from 'node:fs';
import { resolve, dirname, sep } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { runNonfishLentilAlternativesV1 } from './nonfish-lentil-alternatives-v1';
import { preparePilotFamilyIdentityReviewV2 } from './pilot-family-identity-review-v2';
import { buildPilotUnresolvedOccurrenceQueueV1 } from './pilot-unresolved-occurrence-queue-v1';
import { pilotDigestV1 } from './pilot-admission-readiness-v1';

const aggregatePath='docs/premium/retained-sources/pilot-staging-review-20261106/family-review-aggregate-v2.json';
function invalid(): never { throw Error('PILOT_PRIVATE_INPUT_PIN_OR_SNAPSHOT_MISMATCH'); }
export async function assemblePrivatePilotUnresolvedQueueV1(
  inputs: {candidateRaw:string; scenarioRaw:string; exactSnapshotRaw:string; familySnapshotRaw:string},
  aggregateRaw: string
) {
  const manifest=JSON.parse(aggregateRaw) as {
    contract:string;inputBindings:{candidateSha256:string;freezeSha256:string;snapshotSha256:string;familySnapshotSha256:string};
    summary:{recipes:number;foodRows:number;foodRowsWithoutFamilyCandidates:number};canApply:boolean
  };
  if (manifest.contract!=='potok-pilot-family-review-aggregate-v2'||manifest.canApply!==false
    || manifest.summary?.recipes!==19 || manifest.summary?.foodRows!==69
    || manifest.summary?.foodRowsWithoutFamilyCandidates!==10
    || pilotDigestV1(inputs.candidateRaw)!==manifest.inputBindings.candidateSha256
    || pilotDigestV1(inputs.exactSnapshotRaw)!==manifest.inputBindings.snapshotSha256
    || pilotDigestV1(inputs.familySnapshotRaw)!==manifest.inputBindings.familySnapshotSha256) invalid();
  const models=runNonfishLentilAlternativesV1(inputs.candidateRaw,inputs.scenarioRaw).expandedInputModels;
  const packet=await preparePilotFamilyIdentityReviewV2(
    inputs.candidateRaw,models,inputs.exactSnapshotRaw,inputs.familySnapshotRaw
  );
  if (packet.inputBindings.candidateSha256!==manifest.inputBindings.candidateSha256
    || packet.inputBindings.snapshotSha256!==manifest.inputBindings.snapshotSha256
    || packet.inputBindings.familySnapshotSha256!==manifest.inputBindings.familySnapshotSha256
    || packet.inputBindings.freezeSha256!==manifest.inputBindings.freezeSha256) invalid();
  return buildPilotUnresolvedOccurrenceQueueV1(JSON.stringify(packet));
}
/** Keep the private extracted data out of any accidental Git commit. */
export function assertPrivateQueueOutputOutsideCheckoutV1(outputPath:string):void {
  const checkout=realpathSync(fileURLToPath(new URL('../../',import.meta.url)));
  const parent=realpathSync(dirname(resolve(outputPath)));
  const target=resolve(parent,outputPath.split(/[\\/]/).at(-1)!);
  if (parent===checkout||parent.startsWith(checkout+sep)||target===checkout) {
    throw Error('PRIVATE_QUEUE_OUTPUT_MUST_BE_OUTSIDE_CHECKOUT');
  }
}
if (process.argv[1] && import.meta.url===pathToFileURL(process.argv[1]).href) {
  if(process.argv.length!==7) throw Error(
    'Usage: node --import tsx scripts/contracts/pilot-unresolved-occurrence-local-build-v1.ts '+
    'PRIVATE_CANDIDATE.json PRIVATE_SCENARIO.json PRIVATE_EXACT_SNAPSHOT.json PRIVATE_FAMILY_SNAPSHOT.json OUTPUT.json'
  );
  const [candidatePath,scenarioPath,exactPath,familyPath,outputPath]=process.argv.slice(2);
  const result=await assemblePrivatePilotUnresolvedQueueV1({
    candidateRaw:readFileSync(candidatePath,'utf8'),
    scenarioRaw:readFileSync(scenarioPath,'utf8'),
    exactSnapshotRaw:readFileSync(exactPath,'utf8'),
    familySnapshotRaw:readFileSync(familyPath,'utf8')
  },readFileSync(aggregatePath,'utf8'));
  assertPrivateQueueOutputOutsideCheckoutV1(outputPath);
  writeFileSync(outputPath,JSON.stringify(result,null,2)+'\n',{encoding:'utf8',flag:'wx',mode:0o600});
  process.stdout.write('PRIVATE_REVIEW_QUEUE_CREATED: 10 rows / 5 source groups; no contents printed\n');
}
