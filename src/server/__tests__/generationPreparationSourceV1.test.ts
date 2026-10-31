import assert from 'node:assert/strict';
import test from 'node:test';
import {createAdmittedGenerationPreparationSourceV1,generationPreparationReadSqlV1} from '../generationPreparationSourceV1';
import {decodeGenerationPreparationContextRawV1,createGenerationValidationAuthorityLoaderV1} from '../generationValidationAuthorityLoaderV1';
import {createSqlPreparedGenerationWorkerV1} from '../generationSqlPreparedWorkerV1';
import {createGenerationMenuCandidatePreparerV1} from '../generationMenuCandidatesV1';
import {admittedGenerationValidationSourceReadSqlV1} from '../generationValidationSourceSqlV1';
import {fullFixture,id} from '../../utils/__tests__/trustedGeneratedWeekFixturesV1';
import {generationPreparationContextFixtureV1,generationPreparationMetadataFixtureV1} from './generationPreparationSqlFixturesV1';
import {generationWorkerFixtureV1} from './generationWorkerBindingsFixturesV1';
import {generationPreparationPortsFixtureV1,generationStoredAuthorityFixtureV1,fixtureHashV1} from './generationAdmittedWorkerFixturesV1';
async function fixture(){
  const f=await fullFixture();let raw:string|null=await generationPreparationContextFixtureV1(f),metadata:string|null=generationPreparationMetadataFixtureV1(f);
  const calls:{statement:string;parameters:readonly string[]}[]=[];let metadataCalls=0;
  const source=createAdmittedGenerationPreparationSourceV1({async query(statement,parameters){calls.push({statement,parameters:[...parameters]});return {rows:[{source_raw:raw}]};}},
    {async loadMetadataRaw(request,digest){metadataCalls++;assert.equal(request,f.context.input.operation.requestId);assert.equal(digest,f.evidence.generationInputDigest);return metadata;}});
  return {f,source,calls,metadataCalls:()=>metadataCalls,setRaw:(v:string|null)=>{raw=v;},setMetadata:(v:string|null)=>{metadata=v;}};
}
test('request-only stored context becomes actual candidate preparation without a proposal SHA or final warning',async()=>{
  const x=await fixture(),request=x.f.context.input.operation.requestId;
  const raw=await x.source.loadPreparationRaw(request);assert.ok(raw);const value=JSON.parse(raw);
  assert.equal('evaluatedPlanRawSha256' in value,false);assert.equal('warningEvidenceRaw' in value,false);
  const result=await createGenerationMenuCandidatePreparerV1({async loadPreparationRaw(){return raw;}}).prepare(request);
  assert.equal(result.status,'PREPARED');assert.equal(x.metadataCalls(),1);
  assert.deepEqual(x.calls,[{statement:generationPreparationReadSqlV1,parameters:[request]}]);
});
test('preparation context cannot masquerade as proposal validation authority',async()=>{
  const x=await fixture(),raw=await generationPreparationContextFixtureV1(x.f);
  await assert.rejects(createGenerationValidationAuthorityLoaderV1({async readSnapshotRaw(){return raw;}}).loadForProposalRaw(x.f.context.input.operation.requestId,fixtureHashV1(x.f.planRaw)));
});
test('missing source or producer metadata stops without defaults or fake revisions',async()=>{
  const x=await fixture();x.setRaw(null);assert.equal(await x.source.loadPreparationRaw(x.f.context.input.operation.requestId),null);assert.equal(x.metadataCalls(),0);
  x.setRaw(await generationPreparationContextFixtureV1(x.f));x.setMetadata(null);
  assert.equal(await x.source.loadPreparationRaw(x.f.context.input.operation.requestId),null);assert.equal(x.metadataCalls(),1);
});
test('storage/request identity and digest corruption fail before metadata access',async()=>{
  for(const mode of ['account','request','input','manifest']){
    const x=await fixture(),value=JSON.parse(await generationPreparationContextFixtureV1(x.f));
    if(mode==='account')value.accountId=id(999);if(mode==='request')value.requestOperationId=id(999);
    if(mode==='input')value.input.generationInputDigest='f'.repeat(64);if(mode==='manifest')value.manifest.storageSha256='f'.repeat(64);
    x.setRaw(JSON.stringify(value));await assert.rejects(x.source.loadPreparationRaw(x.f.context.input.operation.requestId));assert.equal(x.metadataCalls(),0);
  }
});
test('producer metadata must bind this request/input and cover exact unique slots with valid revisions',async()=>{
  for(const mode of ['request','input','profile','missing','duplicate','revision','foreign']){
    const x=await fixture(),m=JSON.parse(generationPreparationMetadataFixtureV1(x.f));
    if(mode==='request')m.requestOperationId=id(999);if(mode==='input')m.generationInputDigest='f'.repeat(64);
    if(mode==='profile')m.goalProfile='DEFAULT';if(mode==='missing')m.slotRevisions.pop();
    if(mode==='duplicate')m.slotRevisions[1]=m.slotRevisions[0];if(mode==='revision')m.slotRevisions[1].mealSnapshotRevision='invalid';
    if(mode==='foreign')m.slotRevisions[0].slotId=id(999);
    x.setMetadata(JSON.stringify(m));await assert.rejects(x.source.loadPreparationRaw(x.f.context.input.operation.requestId));
  }
});
test('duplicate metadata keys and unexpected fields are not silently discarded',async()=>{
  const x=await fixture();x.setMetadata(generationPreparationMetadataFixtureV1(x.f).replace('{','{"contract":"duplicate",'));
  await assert.rejects(x.source.loadPreparationRaw(x.f.context.input.operation.requestId));
  x.setMetadata(JSON.stringify({...JSON.parse(generationPreparationMetadataFixtureV1(x.f)),approved:true}));
  await assert.rejects(x.source.loadPreparationRaw(x.f.context.input.operation.requestId));
});
test('malformed provided context still rejects when another field is missing',async()=>{
  const f=await fullFixture(),raw=JSON.parse(await generationPreparationContextFixtureV1(f));raw.input=null;raw.manifest.canonicalHex='invalid';
  await assert.rejects(decodeGenerationPreparationContextRawV1(JSON.stringify(raw),f.context.input.operation.requestId));
});
test('invalid request, malformed SQL rows and SQL admission errors have no fallback/retry',async()=>{
  const x=await fixture();await assert.rejects(x.source.loadPreparationRaw('invalid'));assert.equal(x.calls.length,0);
  for(const rows of [[],[{}],[{source_raw:1}],[{source_raw:null,extra:true}],[{source_raw:null},{source_raw:null}]]){
    const source=createAdmittedGenerationPreparationSourceV1({async query(){return {rows} as never;}},{async loadMetadataRaw(){throw Error('UNREACHABLE');}});
    await assert.rejects(source.loadPreparationRaw(x.f.context.input.operation.requestId),/INVALID_PREPARATION_SQL_RESULT/);
  }
  let calls=0;const failed=createAdmittedGenerationPreparationSourceV1({async query(){calls++;throw new Error('GENERATION_READER_IDENTITY_REQUIRED');}},{async loadMetadataRaw(){return null;}});
  await assert.rejects(failed.loadPreparationRaw(x.f.context.input.operation.requestId),/GENERATION_READER_IDENTITY_REQUIRED/);assert.equal(calls,1);
});
test('new calls re-read sources instead of caching accepted preparation',async()=>{
  const x=await fixture();assert.ok(await x.source.loadPreparationRaw(x.f.context.input.operation.requestId));x.setRaw(null);
  assert.equal(await x.source.loadPreparationRaw(x.f.context.input.operation.requestId),null);assert.equal(x.calls.length,2);assert.equal(x.metadataCalls(),1);
});
test('SQL-prepared worker uses request-only context and separately reloads proposal authority twice',async()=>{
  const h=await generationWorkerFixtureV1({unknownYield:true}),ports=await generationPreparationPortsFixtureV1(h.f);
  const prep=await generationPreparationContextFixtureV1(h.f),authority=await generationStoredAuthorityFixtureV1(h.f,fixtureHashV1(h.expected));
  const statements:string[]=[];
  const sql={async query(statement:string,parameters:readonly string[]){statements.push(statement);assert.equal(parameters[0],h.input.requestOperationId);
    if(statement===generationPreparationReadSqlV1){assert.equal(parameters.length,1);return {rows:[{source_raw:prep}]};}
    assert.equal(statement,admittedGenerationValidationSourceReadSqlV1);assert.equal(parameters[1],fixtureHashV1(h.expected));return {rows:[{source_raw:authority}]};
  }};
  const worker=createSqlPreparedGenerationWorkerV1({preparationSql:sql,authoritySql:sql,
    metadata:{async loadMetadataRaw(){return generationPreparationMetadataFixtureV1(h.f);}},warnings:ports.warnings,decisions:ports.decisions,gateway:h.client,enabled:()=>true});
  assert.equal((await worker.continue(h.input.requestOperationId)).status,'ACTIVE');
  assert.deepEqual(statements,[generationPreparationReadSqlV1,admittedGenerationValidationSourceReadSqlV1,admittedGenerationValidationSourceReadSqlV1]);
  assert.equal(ports.counts.source,0);assert.equal(h.counts.records,1);
  const plan=JSON.parse(Buffer.from(h.stored()!,'hex').toString('utf8'));
  for(const day of plan.graph.days)for(const slot of day.slots)for(const component of slot.mealSnapshot.components)assert.equal(component.assignedPortion.assignedGrams,null);
});
test('SQL-prepared worker defaults off before either database boundary',async()=>{
  const h=await generationWorkerFixtureV1(),ports=await generationPreparationPortsFixtureV1(h.f);let queries=0;
  const sql={async query(){queries++;throw new Error('UNREACHABLE');}};
  await assert.rejects(createSqlPreparedGenerationWorkerV1({preparationSql:sql,authoritySql:sql,metadata:{async loadMetadataRaw(){return null;}},warnings:ports.warnings,decisions:ports.decisions,gateway:h.client}).continue(h.input.requestOperationId),/GENERATION_RUNTIME_DISABLED/);
  assert.equal(queries,0);assert.equal(h.calls.length,0);
});
