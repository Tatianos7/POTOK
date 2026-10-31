import assert from 'node:assert/strict';
import test from 'node:test';
import {createAdmittedGenerationWorkerV1} from '../generationAdmittedWorkerV1';
import {admittedGenerationValidationSourceReadSqlV1} from '../generationValidationSourceSqlV1';
import {generationWorkerFixtureV1} from './generationWorkerBindingsFixturesV1';
import {generationPreparationPortsFixtureV1,generationStoredAuthorityFixtureV1,fixtureHashV1} from './generationAdmittedWorkerFixturesV1';
import {id} from '../../utils/__tests__/trustedGeneratedWeekFixturesV1';
async function fixture() {
  const h=await generationWorkerFixtureV1(),ports=await generationPreparationPortsFixtureV1(h.f);
  const source=await generationStoredAuthorityFixtureV1(h.f,fixtureHashV1(h.expected));let queries=0,enabled=true;
  let read:(n:number)=>Promise<{rows:Array<{source_raw:string|null}>}>=async()=>({rows:[{source_raw:source}]});
  const deps={...ports,gateway:h.client,authoritySql:{async query(statement:string,parameters:readonly string[]){
    queries++;assert.equal(statement,admittedGenerationValidationSourceReadSqlV1);
    assert.deepEqual(parameters,[h.input.requestOperationId,fixtureHashV1(h.expected)]);return read(queries);
  }},enabled:()=>enabled};
  return {h,ports,deps,queries:()=>queries,setGate:(v:boolean)=>{enabled=v;},setRead:(v:typeof read)=>{read=v;}};
}
test('admitted SQL loader is used for both independent checks through the existing worker',async()=>{
  const x=await fixture();const worker=createAdmittedGenerationWorkerV1(x.deps);assert.ok(Object.isFrozen(worker));
  assert.equal((await worker.continue(x.h.input.requestOperationId)).status,'ACTIVE');
  assert.equal(x.queries(),2);assert.equal(x.ports.counts.source,1);assert.equal(x.h.counts.records,1);assert.equal(x.h.counts.activations,1);
  assert.equal(Buffer.from(x.h.stored()!,'hex').toString('utf8'),x.h.expected);
});
test('default and closed runtime gates perform no gateway or SQL work',async()=>{
  const x=await fixture();const {enabled:unused,...deps}=x.deps;void unused;
  await assert.rejects(createAdmittedGenerationWorkerV1(deps).continue(x.h.input.requestOperationId),/GENERATION_RUNTIME_DISABLED/);
  x.setGate(false);await assert.rejects(createAdmittedGenerationWorkerV1(x.deps).continue(x.h.input.requestOperationId),/GENERATION_RUNTIME_DISABLED/);
  assert.equal(x.queries(),0);assert.equal(x.h.calls.length,0);
});
test('admission denial propagates without owner-reader fallback, record or activation',async()=>{
  const x=await fixture();x.setRead(async()=>{throw new Error('GENERATION_READER_IDENTITY_REQUIRED');});
  await assert.rejects(createAdmittedGenerationWorkerV1(x.deps).continue(x.h.input.requestOperationId),/GENERATION_READER_IDENTITY_REQUIRED/);
  assert.equal(x.queries(),1);assert.equal(x.h.counts.records,0);assert.equal(x.h.counts.activations,0);
});
test('lost SQL source on final validation stops before persistence',async()=>{
  const x=await fixture();const raw=await generationStoredAuthorityFixtureV1(x.h.f,fixtureHashV1(x.h.expected));
  x.setRead(async n=>({rows:[{source_raw:n===1?raw:null}]}));
  await assert.rejects(createAdmittedGenerationWorkerV1(x.deps).continue(x.h.input.requestOperationId),/GENERATION_VALIDATION_BLOCKED/);
  assert.equal(x.queries(),2);assert.equal(x.h.counts.records,0);
});
test('gate closed during authority read stops before record',async()=>{
  const x=await fixture();const raw=await generationStoredAuthorityFixtureV1(x.h.f,fixtureHashV1(x.h.expected));
  x.setRead(async()=>{x.setGate(false);return {rows:[{source_raw:raw}]};});
  await assert.rejects(createAdmittedGenerationWorkerV1(x.deps).continue(x.h.input.requestOperationId),/GENERATION_RUNTIME_DISABLED/);
  assert.equal(x.h.counts.records,0);assert.equal(x.h.counts.activations,0);
});
test('malformed SQL row cannot be accepted as a stored authority',async()=>{
  const x=await fixture();x.setRead(async()=>({rows:[{source_raw:'{}'},{source_raw:'{}'}]}));
  await assert.rejects(createAdmittedGenerationWorkerV1(x.deps).continue(x.h.input.requestOperationId),/INVALID_GENERATION_SOURCE_SQL_RESULT/);
  assert.equal(x.h.counts.records,0);
});
test('request substitution fails before SQL authority access',async()=>{
  const x=await fixture();await assert.rejects(createAdmittedGenerationWorkerV1(x.deps).continue(id(999)));
  assert.equal(x.queries(),0);assert.equal(x.h.counts.records,0);
});
test('dependency replacements after assembly cannot redirect the gateway',async()=>{
  const x=await fixture();const worker=createAdmittedGenerationWorkerV1(x.deps);
  x.deps.gateway={async rpc(){throw new Error('REPLACED_GATEWAY');}};
  assert.equal((await worker.continue(x.h.input.requestOperationId)).status,'ACTIVE');assert.equal(x.h.counts.records,1);
});
