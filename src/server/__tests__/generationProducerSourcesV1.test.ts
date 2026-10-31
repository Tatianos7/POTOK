import assert from 'node:assert/strict';
import test from 'node:test';
import {createAdmittedGenerationProducerPortsV1,generationMetadataSourceReadSqlV1,generationMealWarningSourceReadSqlV1} from '../generationProducerSourcesV1';
import {createStoredProducerGenerationWorkerV1} from '../generationStoredProducerWorkerV1';
import {generationPreparationReadSqlV1} from '../generationPreparationSourceV1';
import {admittedGenerationValidationSourceReadSqlV1} from '../generationValidationSourceSqlV1';
import {generationPreparationPortsFixtureV1,generationStoredAuthorityFixtureV1,fixtureHashV1} from './generationAdmittedWorkerFixturesV1';
import {generationPreparationContextFixtureV1,generationPreparationMetadataFixtureV1} from './generationPreparationSqlFixturesV1';
import {generationProducerEnvelopeFixtureV1} from './generationProducerSourceFixturesV1';
import {generationWorkerFixtureV1} from './generationWorkerBindingsFixturesV1';
import {fullFixture,id,resignEntry} from '../../utils/__tests__/trustedGeneratedWeekFixturesV1';
async function fixture(){
  const f=await fullFixture(),request=f.context.input.operation.requestId;
  const metadata=generationPreparationMetadataFixtureV1(f),warning=JSON.stringify(resignEntry({...f.set.entries[0],signals:{...f.set.entries[0].signals,longPreparationBurden:true}}));
  let raw:string|null=generationProducerEnvelopeFixtureV1(f,'METADATA',metadata);
  const calls:{statement:string;parameters:readonly string[]}[]=[];
  const ports=createAdmittedGenerationProducerPortsV1({async query(statement,parameters){calls.push({statement,parameters:[...parameters]});return {rows:[{source_raw:raw}]};}});
  return {f,request,metadata,warning,ports,calls,setRaw:(v:string|null)=>{raw=v;},warn:()=>ports.warnings.loadMealWarningRaw(request,JSON.parse(warning).slotId,JSON.parse(warning).mealSnapshotDigest,f.evidence.digest,JSON.parse(f.policiesRaw).digest)};
}
test('metadata uses its fixed admitted query and preserves exact stored raw bytes',async()=>{
  const x=await fixture();assert.equal(await x.ports.metadata.loadMetadataRaw(x.request,x.f.evidence.generationInputDigest),x.metadata);
  assert.deepEqual(x.calls,[{statement:generationMetadataSourceReadSqlV1,parameters:[x.request,x.f.evidence.generationInputDigest]}]);
  assert.ok(Object.isFrozen(x.ports));assert.ok(Object.isFrozen(x.ports.metadata));
});
test('warnings bind all five lookup arguments and preserve explicit true/false signals',async()=>{
  const x=await fixture();x.setRaw(generationProducerEnvelopeFixtureV1(x.f,'MEAL_WARNING',x.warning));
  assert.equal(await x.warn(),x.warning);assert.equal(JSON.parse(x.warning).signals.longPreparationBurden,true);
  assert.deepEqual(x.calls[0],{statement:generationMealWarningSourceReadSqlV1,parameters:[x.request,JSON.parse(x.warning).slotId,JSON.parse(x.warning).mealSnapshotDigest,x.f.evidence.digest,JSON.parse(x.f.policiesRaw).digest]});
});
test('missing records remain missing with no default profile, revisions or false warning flags',async()=>{
  const x=await fixture();x.setRaw(null);assert.equal(await x.ports.metadata.loadMetadataRaw(x.request,x.f.evidence.generationInputDigest),null);assert.equal(await x.warn(),null);
});
test('lookup arguments are validated before database calls',async()=>{
  const x=await fixture();await assert.rejects(x.ports.metadata.loadMetadataRaw('invalid',x.f.evidence.generationInputDigest));
  await assert.rejects(x.ports.metadata.loadMetadataRaw(x.request,'a'));
  await assert.rejects(x.ports.warnings.loadMealWarningRaw(x.request,id(1),'bad','a'.repeat(64),'a'.repeat(64)));assert.equal(x.calls.length,0);
});
test('snapshot identity, kind, context digests and raw storage hashes cannot be substituted',async()=>{
  const x=await fixture(),original=JSON.parse(generationProducerEnvelopeFixtureV1(x.f,'METADATA',x.metadata));
  for(const [field,value]of [['requestOperationId',id(999)],['sourceKind','MEAL_WARNING'],['generationInputDigest','f'.repeat(64)],['slotId',id(999)],['storageSha256','f'.repeat(64)],['approved',true]] as const){
    x.setRaw(JSON.stringify({...original,[field]:value}));await assert.rejects(x.ports.metadata.loadMetadataRaw(x.request,x.f.evidence.generationInputDigest));
  }
  const warning=JSON.parse(generationProducerEnvelopeFixtureV1(x.f,'MEAL_WARNING',x.warning));
  for(const field of ['mealSnapshotDigest','validationEvidenceDigest','validationPoliciesDigest']){
    x.setRaw(JSON.stringify({...warning,[field]:'f'.repeat(64)}));await assert.rejects(x.warn());
  }
});
test('payload binding is checked even if the envelope raw hash matches its substituted payload',async()=>{
  const x=await fixture();const changed=JSON.stringify({...JSON.parse(x.metadata),requestOperationId:id(999)});
  x.setRaw(generationProducerEnvelopeFixtureV1(x.f,'METADATA',changed));await assert.rejects(x.ports.metadata.loadMetadataRaw(x.request,x.f.evidence.generationInputDigest),/GENERATION_PRODUCER_PAYLOAD_MISMATCH/);
});
test('duplicate raw keys are rejected before consumer parsing',async()=>{
  const x=await fixture();const duplicate=x.metadata.replace('{','{"contract":"duplicate",');
  x.setRaw(generationProducerEnvelopeFixtureV1(x.f,'METADATA',duplicate));await assert.rejects(x.ports.metadata.loadMetadataRaw(x.request,x.f.evidence.generationInputDigest));
});
test('malformed driver rows and admission errors do not retry or fall back',async()=>{
  const x=await fixture();
  for(const rows of [[],[{}],[{source_raw:1}],[{source_raw:null,extra:true}],[{source_raw:null},{source_raw:null}]]){
    const p=createAdmittedGenerationProducerPortsV1({async query(){return {rows} as never;}});
    await assert.rejects(p.metadata.loadMetadataRaw(x.request,x.f.evidence.generationInputDigest),/INVALID_GENERATION_PRODUCER_SQL_RESULT/);
  }
  let count=0;const p=createAdmittedGenerationProducerPortsV1({async query(){count++;throw new Error('GENERATION_READER_IDENTITY_REQUIRED');}});
  await assert.rejects(p.metadata.loadMetadataRaw(x.request,x.f.evidence.generationInputDigest),/GENERATION_READER_IDENTITY_REQUIRED/);assert.equal(count,1);
});
test('accepted sources are not cached across calls or revocation/unavailability',async()=>{
  const x=await fixture();assert.ok(await x.ports.metadata.loadMetadataRaw(x.request,x.f.evidence.generationInputDigest));x.setRaw(null);
  assert.equal(await x.ports.metadata.loadMetadataRaw(x.request,x.f.evidence.generationInputDigest),null);assert.equal(x.calls.length,2);
});
test('stored-producer worker uses SQL metadata/warnings and still performs independent final checks',async()=>{
  const h=await generationWorkerFixtureV1(),old=await generationPreparationPortsFixtureV1(h.f),statements:string[]=[];
  const context=await generationPreparationContextFixtureV1(h.f),authority=await generationStoredAuthorityFixtureV1(h.f,fixtureHashV1(h.expected));
  const sql={async query(statement:string,parameters:readonly string[]){statements.push(statement);let raw:string|null;
    if(statement===generationPreparationReadSqlV1)raw=context;
    else if(statement===generationMetadataSourceReadSqlV1)raw=generationProducerEnvelopeFixtureV1(h.f,'METADATA',generationPreparationMetadataFixtureV1(h.f));
    else if(statement===generationMealWarningSourceReadSqlV1){const warning=await old.warnings.loadMealWarningRaw(parameters[0],parameters[1],parameters[2]);raw=generationProducerEnvelopeFixtureV1(h.f,'MEAL_WARNING',warning);}
    else {assert.equal(statement,admittedGenerationValidationSourceReadSqlV1);raw=authority;}
    return {rows:[{source_raw:raw}]};
  }};
  const worker=createStoredProducerGenerationWorkerV1({sourcesSql:sql,decisions:old.decisions,gateway:h.client,enabled:()=>true});
  assert.equal((await worker.continue(h.input.requestOperationId)).status,'ACTIVE');assert.equal(h.counts.records,1);
  assert.equal(statements.filter(s=>s===generationPreparationReadSqlV1).length,1);assert.equal(statements.filter(s=>s===generationMetadataSourceReadSqlV1).length,1);
  assert.ok(statements.filter(s=>s===generationMealWarningSourceReadSqlV1).length>=7);assert.equal(statements.filter(s=>s===admittedGenerationValidationSourceReadSqlV1).length,2);
  assert.equal(Buffer.from(h.stored()!,'hex').toString('utf8'),h.expected);
});
test('stored-producer worker defaults off before database or gateway access',async()=>{
  const h=await generationWorkerFixtureV1(),old=await generationPreparationPortsFixtureV1(h.f);let calls=0;
  await assert.rejects(createStoredProducerGenerationWorkerV1({sourcesSql:{async query(){calls++;throw new Error('UNREACHABLE');}},decisions:old.decisions,gateway:h.client}).continue(h.input.requestOperationId),/GENERATION_RUNTIME_DISABLED/);
  assert.equal(calls,0);assert.equal(h.calls.length,0);
});
