import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { assemblePrivatePilotUnresolvedQueueV1 as assemble } from './pilot-unresolved-occurrence-local-build-v1';

const aggregate=readFileSync(
  'docs/premium/retained-sources/pilot-staging-review-20261106/family-review-aggregate-v2.json','utf8'
);
const input=()=>({candidateRaw:'{}',scenarioRaw:'{}',exactSnapshotRaw:'{}',familySnapshotRaw:'{}'});

test('local queue refuses unpinned, synthetic or missing private pilot inputs before review',async()=>{
  await assert.rejects(assemble(input(),aggregate),/PILOT_PRIVATE_INPUT_PIN_OR_SNAPSHOT_MISMATCH/);
});
test('local queue refuses cross-project and promoted manifest even with unavailable private inputs',async()=>{
  const copy=JSON.parse(aggregate);
  copy.canApply=true;
  await assert.rejects(assemble(input(),JSON.stringify(copy)),/PILOT_PRIVATE_INPUT_PIN_OR_SNAPSHOT_MISMATCH/);
  copy.canApply=false;
  copy.summary.foodRowsWithoutFamilyCandidates=9;
  await assert.rejects(assemble(input(),JSON.stringify(copy)),/PILOT_PRIVATE_INPUT_PIN_OR_SNAPSHOT_MISMATCH/);
});
