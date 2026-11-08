import test from 'node:test';
import assert from 'node:assert/strict';
import {buildFrozen19SourcePrecheckQueueV1} from './pilot-frozen19-source-precheck-v1';
import {reviewFrozen19StagingSnapshotV1} from './pilot-frozen19-staging-batch-review-v1';
import {decodeReviewedRuntimeRecipePublicationEvidenceRawV1} from '../../src/utils/reviewedRuntimeRecipePublicationEvidenceV1';
import {decodeGenerationPreparationContextRawV1} from '../../src/server/generationValidationAuthorityLoaderV1';

const id='aaaaaaaa-aaaa-4aaa-aaaa-aaaaaaaaaaaa';
const sample=()=>({projectId:'ozidryfvhkcbtpnulakq',capturedAt:'2026-11-07T12:00:00.000Z',
 candidates:[{sourceRecord:'SR28:20124',food:{id,name:'Паста из цельной пшеницы',source:'core',
  canonical_food_id:id,is_searchable:true,needs_review:false,verified:true,cooking_state:'dry',
  calories:'300',protein:'12.5',fat:'2.2',carbs:'60',fiber:'7'}}]});
test('source precheck queue and read-only Staging report cannot pass runtime issuer decoders, even if approval flags are forged',async()=>{
 const q=buildFrozen19SourcePrecheckQueueV1();
 const report=reviewFrozen19StagingSnapshotV1(sample(),'2026-11-07T12:01:00.000Z');
 for(const packet of [q,report,{...q,sourceApproved:true,runtimePublishable:true,canApply:true},
   {...report,sourceApproved:true,readyForServerSubmission:true,canApply:true}]){
  const raw=JSON.stringify(packet);
  await assert.rejects(decodeReviewedRuntimeRecipePublicationEvidenceRawV1(raw,raw));
  await assert.rejects(decodeGenerationPreparationContextRawV1(raw,id));
 }
});
