import assert from 'node:assert/strict';
import test from 'node:test';
import {createHash} from 'node:crypto';
import {continueGenerationV2,type GenerationRpcClientV2} from '../../../supabase/functions/adaptive-nutrition-generate-v2/contracts';
import {createGenerationWorkerBindingsV1} from '../generationWorkerBindingsV1';
import {createGenerationDayOptionsV1} from '../generationDayOptionsV1';
import {generationMenuCandidateSourceContractV1} from '../generationMenuCandidatesV1';
import {generationDecisionTraceContractV1,projectGenerationWeekRawV1} from '../generationPlanProposalV1';
import {generationValidationAuthorityContractV1} from '../generationValidationAdapterV1';
import {adaptiveNutritionCandidateManifestCanonicalBytesV2} from '../../utils/adaptiveNutritionAuthoritiesV1';
import {canonicalJsonV1} from '../../utils/adaptiveNutritionWireV1';
import {decodeMealSnapshotV1} from '../../utils/adaptiveNutritionMealCompositionV1';
import {fullFixture,resignEntry,id,type FullFixture} from '../../utils/__tests__/trustedGeneratedWeekFixturesV1';
const hash=(raw:string)=>createHash('sha256').update(raw,'utf8').digest('hex');
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
async function fixture(options:{revokeBeforeRecord?:boolean;driftBeforeRecord?:boolean;sourceMissing?:boolean;recordLostReply?:boolean;activationLostReply?:boolean;recordConflict?:boolean;initialStatus?:string;unknownYield?:boolean}={}){
  const f:FullFixture=await fullFixture(s=>{if(options.unknownYield)for(const entry of s.context.manifest.entries)entry.recipeSnapshot.baseYield.totalYieldGrams=null;});
  const request=f.context.input.operation.requestId;
  const source=JSON.stringify({contract:generationMenuCandidateSourceContractV1,requestOperationId:request,contextRaw:f.contextRaw,
    policiesRaw:f.policiesRaw,goalProfile:'MAINTENANCE',slotRevisions:f.plan.graph.days.flatMap(d=>d.slots.map(s=>({slotId:s.slotId,mealSnapshotRevision:s.mealSnapshotRevision})))});
  const warnings={async loadMealWarningRaw(_request:string,slot:string,digest:string){return JSON.stringify(resignEntry({...f.set.entries[0],slotId:slot,mealSnapshotDigest:digest}));}};
  const seed=await createGenerationDayOptionsV1({async loadPreparationRaw(){return source;}},warnings).generate(request);
  assert.equal(seed.status,'FEASIBLE_PROPOSAL');if(seed.status!=='FEASIBLE_PROPOSAL')throw Error('fixture');
  const trace=JSON.stringify({contract:generationDecisionTraceContractV1,requestOperationId:request,weekRawSha256:hash(seed.week.weekRaw),
    slots:f.plan.graph.days.flatMap(d=>d.slots.map(s=>({slotId:s.slotId,generatorDecisionEvidence:s.generatorDecisionEvidence}))),
    weekOptimizationResultDigest:f.plan.graph.weekOptimizationResultDigest});
  const expected=await projectGenerationWeekRawV1(request,seed.week.weekRaw,f.contextRaw,trace);
  assert.equal(expected.status,'PROJECTED');if(expected.status!=='PROJECTED')throw Error('fixture');
  const input={requestOperationId:request,generationInputCanonicalHex:encode(canonicalJsonV1(f.context.input,'SAFE_INTEGER')),
    candidateManifestCanonicalHex:Buffer.from(await adaptiveNutritionCandidateManifestCanonicalBytesV2(f.context.manifest)).toString('hex')};
  const calls:{name:string;args:Record<string,unknown>}[]=[];
  const counts={source:0,authority:0,records:0,activations:0};let status=options.initialStatus??'GENERATING';let storedHex:string|null=null;
  const bindings=createGenerationWorkerBindingsV1({async loadPreparationRaw(r){counts.source++;assert.equal(r,request);return options.sourceMissing?null:source;}},warnings,
    {async loadDecisionTraceRaw(r,d){assert.equal(r,request);assert.equal(d,hash(seed.week.weekRaw));return trace;}},
    {async loadForProposalRaw(r,digest){
      counts.authority++;assert.equal(r,request);assert.equal(digest,hash(expected.generatedPlanRaw));
      if(options.revokeBeforeRecord&&counts.authority>1)return null;
      let contextRaw=f.contextRaw;
      if(options.driftBeforeRecord&&counts.authority>1){const c=JSON.parse(contextRaw);const v=JSON.parse(c.trustedGenerationInputRaw);v.accountId=id(999);c.trustedGenerationInputRaw=JSON.stringify(v);contextRaw=JSON.stringify(c);}
      return JSON.stringify({contract:generationValidationAuthorityContractV1,requestOperationId:r,accountId:f.context.input.accountId,
        generationInputDigest:f.evidence.generationInputDigest,evaluatedPlanRawSha256:digest,trustedContextRaw:contextRaw,pinnedPoliciesRaw:f.policiesRaw,pinnedWarningEvidenceRaw:f.warningRaw});
    }});
  const client:GenerationRpcClientV2={async rpc<T>(name:string,args:Record<string,unknown>){
    calls.push({name,args:structuredClone(args)});assert.equal(args.p_request_operation_id,request);
    if(name===record){
      if(options.recordConflict)status='CONFLICT';else{
        counts.records++;storedHex=(args.p_generated_week_plan_canonical as string).slice(2);status='GENERATED';
        assert.equal(decode(storedHex),expected.generatedPlanRaw);
        if(options.recordLostReply)return {data:null,error:{lost:true}};
      }
    }
    if(name===activate){counts.activations++;status='ACTIVE';if(options.activationLostReply&&counts.activations===1)return {data:null,error:{lost:true}};}
    const response={contract:'potok-adaptive-generation-request-status-v2',requestOperationId:request,status,retryable:status!=='ACTIVE',reasonCode:null};
    return {data:(name===load?{...response,generationInputCanonicalHex:input.generationInputCanonicalHex,
      candidateManifestCanonicalHex:input.candidateManifestCanonicalHex,attemptOperationId:id(88)}:response) as T,error:null};
  }};
  return {f,input,bindings,client,calls,counts,expected:expected.generatedPlanRaw,stored:()=>storedHex,
    run:()=>continueGenerationV2({requestOperationId:request,gatewayClient:client,...bindings})};
}
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
