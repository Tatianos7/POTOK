import assert from 'node:assert/strict';
import test from 'node:test';
import {createGoalDerivedGenerationPreparationSourceV1,generationGoalPreparationReadSqlV1,
  generationGoalPreparationSourceContractV1} from '../generationGoalPreparationSourceV1';
import {createGenerationMenuCandidatePreparerV1} from '../generationMenuCandidatesV1';
import {decodeGenerationPreparationContextRawV1} from '../generationValidationAuthorityLoaderV1';
import {fullFixture,id} from '../../utils/__tests__/trustedGeneratedWeekFixturesV1';
import {generationPreparationContextFixtureV1} from './generationPreparationSqlFixturesV1';
async function fixture(){
  const f=await fullFixture();const contextRaw=await generationPreparationContextFixtureV1(f);
  let raw:string|null=JSON.stringify({contract:generationGoalPreparationSourceContractV1,contextRaw,goalType:'Поддержка формы'});
  const calls:{statement:string;parameters:readonly string[]}[]=[];
  const source=createGoalDerivedGenerationPreparationSourceV1({async query(statement,parameters){
    calls.push({statement,parameters:[...parameters]});return {rows:[{source_raw:raw}]};
  }});
  return {f,contextRaw,source,calls,request:f.context.input.operation.requestId,
    set:(value:string|null)=>{raw=value;},goal:(goalType:unknown)=>{raw=JSON.stringify({contract:generationGoalPreparationSourceContractV1,contextRaw,goalType});}};
}
test('real metadata producer uses saved goal and exact admitted slots without supplied output revisions',async()=>{
  const x=await fixture();const raw=await x.source.loadPreparationRaw(x.request);assert.ok(raw);
  const row=JSON.parse(raw);assert.equal(row.goalProfile,'MAINTENANCE');
  assert.equal(row.contextRaw,(await decodeGenerationPreparationContextRawV1(x.contextRaw,x.request))!.trustedContextRaw);
  assert.equal(row.policiesRaw,x.f.policiesRaw);
  assert.deepEqual(row.slotRevisions.map((s:{slotId:string})=>s.slotId),x.f.evidence.distributionPolicy.days.flatMap(d=>d.requiredSlots.map(s=>s.slotId)));
  assert.equal(new Set(row.slotRevisions.map((s:{mealSnapshotRevision:string})=>s.mealSnapshotRevision)).size,7);
  for(const s of row.slotRevisions)assert.match(s.mealSnapshotRevision,/^[0-9a-f]{8}-[0-9a-f]{4}-8[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/);
  assert.equal(await x.source.loadPreparationRaw(x.request),raw);
  assert.deepEqual(x.calls[0],{statement:generationGoalPreparationReadSqlV1,parameters:[x.request]});
  const prepared=await createGenerationMenuCandidatePreparerV1(x.source).prepare(x.request);
  assert.equal(prepared.status,'PREPARED');
  if(prepared.status==='PREPARED')for(const slot of prepared.slots)for(const option of slot.meals){
    assert.equal(option.meal.mealSnapshotRevision,row.slotRevisions.find((s:{slotId:string})=>s.slotId===slot.slotId).mealSnapshotRevision);
  }
});
test('only exact supported persisted labels map to profiles; unknown is never maintenance',async()=>{
  const x=await fixture();
  for(const [goal,profile] of [['Похудение','WEIGHT_LOSS'],['weight-loss','WEIGHT_LOSS'],['WEIGHT_LOSS','WEIGHT_LOSS'],
    ['Поддержка формы','MAINTENANCE'],['maintain','MAINTENANCE'],['MAINTENANCE','MAINTENANCE'],
    ['Набор массы','MASS_GAIN'],['gain','MASS_GAIN'],['MASS_GAIN','MASS_GAIN'],['CUT','CUT']]){
    x.goal(goal);assert.equal(JSON.parse((await x.source.loadPreparationRaw(x.request))!).goalProfile,profile);
  }
  for(const goal of [null,'','unknown',' Maintain ','поддержка формы']){x.goal(goal);assert.equal(await x.source.loadPreparationRaw(x.request),null);}
});
test('source reads are fresh and missing/revoked data never reuse earlier metadata',async()=>{
  const x=await fixture();assert.ok(await x.source.loadPreparationRaw(x.request));x.set(null);
  assert.equal(await x.source.loadPreparationRaw(x.request),null);assert.equal(x.calls.length,2);
});
test('a new immutable request gets different output revisions for the same required slots',async()=>{
  const x=await fixture();const first=JSON.parse((await x.source.loadPreparationRaw(x.request))!);
  const f=await fullFixture(state=>{state.context.input.operation.requestId=id(998);});
  const contextRaw=await generationPreparationContextFixtureV1(f);
  const source=createGoalDerivedGenerationPreparationSourceV1({async query(){return {rows:[{source_raw:JSON.stringify({
    contract:generationGoalPreparationSourceContractV1,contextRaw,goalType:'maintain'})}]};}});
  const second=JSON.parse((await source.loadPreparationRaw(f.context.input.operation.requestId))!);
  assert.deepEqual(first.slotRevisions.map((s:{slotId:string})=>s.slotId),second.slotRevisions.map((s:{slotId:string})=>s.slotId));
  assert.ok(first.slotRevisions.every((s:{mealSnapshotRevision:string},i:number)=>s.mealSnapshotRevision!==second.slotRevisions[i].mealSnapshotRevision));
});
test('another request, changed nested bytes, duplicate keys and extra metadata are rejected',async()=>{
  const x=await fixture();await assert.rejects(()=>x.source.loadPreparationRaw(id(999)),/MISMATCH/);
  x.set('{"contract":"duplicate",'+JSON.stringify({contract:generationGoalPreparationSourceContractV1,contextRaw:x.contextRaw,goalType:'maintain'}).slice(1));
  await assert.rejects(()=>x.source.loadPreparationRaw(x.request));
  x.set(JSON.stringify({contract:generationGoalPreparationSourceContractV1,contextRaw:x.contextRaw,goalType:'maintain',slotRevisions:[]}));
  await assert.rejects(()=>x.source.loadPreparationRaw(x.request));
  const context=JSON.parse(x.contextRaw);context.input.canonicalHex='00';
  x.set(JSON.stringify({contract:generationGoalPreparationSourceContractV1,contextRaw:JSON.stringify(context),goalType:'maintain'}));
  await assert.rejects(()=>x.source.loadPreparationRaw(x.request));
});
test('invalid lookup and malformed/failed SQL do not fall back to stored/default metadata',async()=>{
  const x=await fixture();await assert.rejects(()=>x.source.loadPreparationRaw('bad'));assert.equal(x.calls.length,0);
  for(const rows of [[],[{source_raw:null},{source_raw:null}],[{source_raw:null,extra:true}],[{source_raw:{}}]]){
    // Deliberately violate the driver's typed contract to exercise the runtime boundary.
    const source=createGoalDerivedGenerationPreparationSourceV1({async query(){return {rows:rows as unknown as {source_raw:string|null}[]};}});
    await assert.rejects(()=>source.loadPreparationRaw(x.request));
  }
  const source=createGoalDerivedGenerationPreparationSourceV1({async query(){throw Error('connection failed');}});
  await assert.rejects(()=>source.loadPreparationRaw(x.request),/connection failed/);
});
