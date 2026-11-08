import {strict as assert} from 'node:assert';
import test from 'node:test';
import {decodeActiveGenerationReadbackV2,decodeGenerationStatusForReadbackV2} from './stagingGenerationReadbackV2';
const id='12345678-1234-4234-8234-123456789abc';
const other='12345678-1234-4234-8234-123456789abd';
test('status decoder binds operation and rejects unexpected wire shape',()=>{
  const row={contract:'potok-adaptive-generation-request-status-v2',requestOperationId:id,
    status:'REQUESTED',retryable:true,reasonCode:null};
  assert.deepEqual(decodeGenerationStatusForReadbackV2(row,id),{status:'REQUESTED',reasonCode:null});
  assert.equal(decodeGenerationStatusForReadbackV2(row,other),null);
  assert.equal(decodeGenerationStatusForReadbackV2({...row,status:'FINISHED'},id),null);
  assert.equal(decodeGenerationStatusForReadbackV2({...row,unsafe:true},id),null);
});
test('accepted readback requires full server contract, request binding and verified graph digest',()=>{
  const row={kind:'ready',contract:'potok-generation-plan-readback-v2',
    request_operation_id:id,account_id:other,selection_id:other,
    plan_revision:id,generation_operation_id:id,activation_operation_id:other,
    graph_digest_hex:'a'.repeat(64),graph:{contract:'adaptive_nutrition_graph_v2'}};
  assert.deepEqual(decodeActiveGenerationReadbackV2(row,id),{selectionId:other,planRevision:id,graphDigest:'a'.repeat(64)});
  for(const value of [{...row,request_operation_id:other},{...row,graph_digest_hex:'a'}, {...row,kind:'not_ready'},
   {...row,unsafe:true},{...row,graph:null}]){
    assert.equal(decodeActiveGenerationReadbackV2(value,id),null);
  }
});
