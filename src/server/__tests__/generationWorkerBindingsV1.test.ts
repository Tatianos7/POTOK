import assert from 'node:assert/strict';
import test from 'node:test';
import {canonicalJsonV1} from '../../utils/adaptiveNutritionWireV1';
import {decodeMealSnapshotV1} from '../../utils/adaptiveNutritionMealCompositionV1';
import {fullFixture,id} from '../../utils/__tests__/trustedGeneratedWeekFixturesV1';
import {generationWorkerFixtureV1 as fixture} from './generationWorkerBindingsFixturesV1';
const encode=(raw:string)=>Buffer.from(raw,'utf8').toString('hex');
const decode=(hex:string)=>Buffer.from(hex,'hex').toString('utf8');
const load='load_generation_request_v2',record='record_generated_week_gateway_v2',activate='activate_generated_week_gateway_v2';
test('canonical object-key order preserves decoded meal identity and digest',async()=>{
  const f=await fullFixture();const meal=f.plan.graph.days[0].slots[0].mealSnapshot;
  assert.deepEqual(await decodeMealSnapshotV1(JSON.parse(canonicalJsonV1(meal,'SAFE_INTEGER'))),meal);
});
test('key-order tolerance does not permit changed ingredient quantity or extra fields',async()=>{
  const f=await fullFixture();
  for(const mode of ['quantity','extra']){
    const meal=JSON.parse(canonicalJsonV1(f.plan.graph.days[0].slots[0].mealSnapshot,'SAFE_INTEGER'));
    if(mode==='quantity')meal.components[0].ingredients[0].quantity.amount='999.000';else meal.components[0].ingredients[0].extra=true;
    await assert.rejects(decodeMealSnapshotV1(meal),/meal_component_ingredients_mismatch/);
  }
});
test('actual proposal pipeline reaches existing record/activation worker with the exact independently validated canonical bytes',async()=>{
  const h=await fixture();assert.equal((await h.run()).status,'ACTIVE');assert.deepEqual(h.calls.map(c=>c.name),[load,record,activate]);
  assert.equal(h.counts.source,1);assert.equal(h.counts.authority,2);assert.equal(h.counts.records,1);
  assert.equal(decode(h.stored()!),canonicalJsonV1(JSON.parse(h.expected),'SAFE_INTEGER'));
  assert.deepEqual(JSON.parse(decode(h.stored()!)).facts,[]);
});
test('unknown cooked yield stays null in the recorded proposal',async()=>{
  const h=await fixture({unknownYield:true});await h.run();
  for(const day of JSON.parse(decode(h.stored()!)).graph.days)for(const slot of day.slots)for(const c of slot.mealSnapshot.components){
    assert.equal(c.recipe.baseYield.totalYieldGrams,null);assert.equal(c.assignedPortion.assignedGrams,null);
  }
});
test('independent acceptance is refreshed before record and never cached from generation',async()=>{
  const h=await fixture({revokeBeforeRecord:true});await assert.rejects(h.run(),/GENERATION_VALIDATION_BLOCKED/);
  assert.equal(h.counts.authority,2);assert.equal(h.counts.records,0);assert.equal(h.counts.activations,0);assert.equal(h.stored(),null);
});
test('changed authority snapshot after generation cannot be recorded against the loaded request',async()=>{
  const h=await fixture({driftBeforeRecord:true});await assert.rejects(h.run(),/WORKER_INPUT_SNAPSHOT_MISMATCH/);assert.equal(h.counts.records,0);
});
test('missing preparation source never reaches record',async()=>{
  const h=await fixture({sourceMissing:true});await assert.rejects(h.run(),/GENERATION_PROPOSAL_PREPARATION_STOPPED/);assert.equal(h.counts.records,0);
});
test('loaded input and manifest must match the independent preparation snapshot byte for byte',async()=>{
  for(const field of ['generationInputCanonicalHex','candidateManifestCanonicalHex'] as const){
    const h=await fixture();const value=JSON.parse(decode(h.input[field]));
    if(field==='generationInputCanonicalHex')value.accountId=id(999);else value.publishedAt='2026-09-29T00:00:00Z';
    await assert.rejects(h.bindings.generator.generate({...h.input,[field]:encode(canonicalJsonV1(value,'SAFE_INTEGER'))}),/WORKER_(INPUT|MANIFEST)_SNAPSHOT_MISMATCH/);
    assert.equal(h.counts.authority,0);assert.equal(h.counts.records,0);
  }
});
test('malformed hex, UTF8 and noncanonical loaded JSON stop before source access',async()=>{
  const h=await fixture();
  for(const raw of ['f','ff','7B7D',encode(decode(h.input.generationInputCanonicalHex)+' '),encode('{"a":1,"a":1}')]){
    await assert.rejects(h.bindings.generator.generate({...h.input,generationInputCanonicalHex:raw}));
  }
  assert.equal(h.counts.source,0);assert.equal(h.counts.authority,0);
});
test('request substitution in loaded input fails before source access',async()=>{
  const h=await fixture();await assert.rejects(h.bindings.generator.generate({...h.input,requestOperationId:id(999)}),/WORKER_REQUEST_INPUT_MISMATCH/);assert.equal(h.counts.source,0);
});
test('final validator rejects rewritten serialization rather than canonicalizing after acceptance',async()=>{
  const h=await fixture();await assert.rejects(h.bindings.validator.validate({...h.input,generatedWeekPlanCanonicalHex:encode(JSON.stringify(JSON.parse(h.expected),null,2))}),/NONCANONICAL_WORKER_BYTES/);
  assert.equal(h.counts.authority,0);
});
test('lost record reply resumes the same committed request without regenerating or duplicating record',async()=>{
  const h=await fixture({recordLostReply:true});await assert.rejects(h.run(),/RPC_FAILED/);assert.equal(h.counts.records,1);
  assert.equal((await h.run()).status,'ACTIVE');assert.equal(h.counts.records,1);assert.equal(h.counts.source,1);assert.equal(h.counts.activations,1);
  assert.deepEqual(h.calls.map(c=>c.name),[load,record,load,activate]);
});
test('lost activation reply resumes ACTIVE without a second activation',async()=>{
  const h=await fixture({activationLostReply:true});await assert.rejects(h.run(),/RPC_FAILED/);
  assert.equal((await h.run()).status,'ACTIVE');assert.equal(h.counts.records,1);assert.equal(h.counts.activations,1);assert.equal(h.counts.source,1);
});
test('record-time conflict stops activation',async()=>{
  const h=await fixture({recordConflict:true});assert.equal((await h.run()).status,'CONFLICT');assert.equal(h.counts.activations,0);
});
test('existing GENERATED and ACTIVE requests recover without invoking proposal sources',async()=>{
  for(const status of ['GENERATED','ACTIVE']){const h=await fixture({initialStatus:status});assert.equal((await h.run()).status,'ACTIVE');assert.equal(h.counts.source,0);assert.equal(h.counts.authority,0);assert.equal(h.counts.records,0);}
});
