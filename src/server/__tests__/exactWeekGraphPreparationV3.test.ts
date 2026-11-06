import test from 'node:test';import assert from 'node:assert/strict';
import {raw,id,copy,sha} from './exactFoodNutritionFixturesV2';import {authorized,q} from './exactWeekNutritionFixturesV3';
import {contentFixtureV4} from './exactMenuContentValidationFixturesV4';
import {graphFixtureV3 as fixture,graphSourceFixtureV3,changedPortionFixtureV3,warningPolicyFixtureV3,repeatedFamilyReplacementFixtureV3} from './exactWeekGraphFixturesV3';
import {createExactWeekGraphPreparationV3 as create,exactGraphSlotSubjectsRawV3,type ExactWeekGraphSourceV3,type ExactWeekGraphResultV3} from '../exactWeekGraphPreparationV3';
import {decodeAdaptiveNutritionGraphV2} from '../../utils/adaptiveNutritionGraphV2';
import {decodeGraphRecipeSnapshotV1} from '../../utils/adaptiveNutritionGraphV1';
import {canonicalJsonV1} from '../../utils/adaptiveNutritionWireV1';
const adapter=(s:ExactWeekGraphSourceV3)=>create({loadForProposalRaw:async()=>raw(s)},authorized);
function graph(r:ExactWeekGraphResultV3){if(r.status!=='EXACT_GRAPH_PREPARED_PENDING_OPTIMIZATION')assert.fail(JSON.stringify(r));return r.graph;}
test('exact V3 graph binds input/selection/revisions, seven days and exact component/meal/day/week values without final admission',async()=>{
 const f=await fixture();let reads=0;const g=graph(await create({loadForProposalRaw:async(op,h)=>{reads++;assert.equal(op,f.operation);assert.equal(h,sha(f.snapshotRaw));return raw(f.graphSource);}},authorized).prepare(f.operation,f.snapshotRaw));
 assert.equal(reads,1);assert.equal(g.contract,'adaptive_nutrition_graph_v3');assert.equal(g.contractVersion,3);assert.deepEqual(g.input,f.input);assert.equal(g.days.length,7);
 assert.deepEqual(g.nutrition,f.snapshot.nutrition);assert.deepEqual(g.inputMass,f.snapshot.inputMass);assert.deepEqual(g.days[0].slots[0].exactMeal,f.snapshot.days[0].meals[0]);
 assert.equal(g.days[0].slots[0].exactMeal.components[0].ingredients[0].amount.denominator,'3');assert.equal(g.inputMass.totalGrams,null);
 assert.equal(g.accepted,false);assert.equal(g.canRecord,false);assert.equal(g.canActivate,false);assert.equal(g.authority,'NONE');assert.deepEqual(g.facts,[]);assert.ok(Object.isFrozen(g.days[0].slots));
 assert.equal(g.ordinaryWitness.ordinarySnapshotDigest,f.snapshot.digest);assert.ok(!('generatedAt'in g));assert.ok(!('optimizationResultDigest'in g));
});
test('slot, day and graph digests independently bind exact contents and warning provenance',async()=>{
 const f=await fixture(),g=graph(await adapter(f.graphSource).prepare(f.operation,f.snapshotRaw));
 for(const day of g.days){for(const slot of day.slots){const {digest,...payload}=slot;assert.equal(digest,sha(canonicalJsonV1({domain:'potok-exact-graph-slot-sha256-v3',payload},'SAFE_INTEGER')));}
 const {digest,...payload}=day;assert.equal(digest,sha(canonicalJsonV1({domain:'potok-exact-graph-day-sha256-v3',payload},'SAFE_INTEGER')));}
 const {digest,...payload}=g;assert.equal(digest,sha(canonicalJsonV1({domain:'potok-exact-week-graph-sha256-v3',payload},'SAFE_INTEGER')));
});
test('readback reruns complete authorities and rejects changed totals, slots, portions, facts and forged write flags',async()=>{
 const f=await fixture(),a=adapter(f.graphSource),g=graph(await a.prepare(f.operation,f.snapshotRaw));assert.equal((await a.readback(f.operation,f.snapshotRaw,raw(g))).status,'EXACT_GRAPH_PREPARED_PENDING_OPTIMIZATION');
 for(const mode of ['nutrition','slot','portion','facts','authority'] as const){const tampered=JSON.parse(raw(g));
  if(mode==='nutrition')tampered.nutrition.values.calories={numerator:'1',denominator:'1'};
  if(mode==='slot')tampered.days[0].slots[0].slotId=id(99);if(mode==='portion')tampered.days[0].slots[0].exactMeal.components[0].wholeRecipeMultiplier=q('1');
  if(mode==='facts')tampered.facts=[{consumed:true}];if(mode==='authority')tampered.canRecord=true;
  assert.equal((await a.readback(f.operation,f.snapshotRaw,raw(tampered))).status,'BLOCKED');
 }
});
test('warning evidence requires complete ordered slot coverage, exact subject and all explicit boolean signals',async()=>{
 const f=await fixture();for(const mode of ['empty','duplicate','order','subject','signal','revision','input','content','policy'] as const){const warnings=JSON.parse(raw(f.warnings));
  if(mode==='empty')warnings.entries=[];if(mode==='duplicate')warnings.entries[1]=warnings.entries[0];if(mode==='order')warnings.entries.reverse();if(mode==='subject')warnings.entries[0].slotSubjectDigest='0'.repeat(64);
  if(mode==='signal')delete warnings.entries[0].signals.softTargetFitDeviation;if(mode==='revision')warnings.entries[0].evidenceRevision='none';if(mode==='input')warnings.generationInputDigest='0'.repeat(64);
  if(mode==='content')warnings.contentValidationDigest='0'.repeat(64);if(mode==='policy')warnings.validationPolicyRevision=id(99);
  assert.equal((await adapter({...f.graphSource,warningEvidenceRaw:raw(warnings)}).prepare(f.operation,f.snapshotRaw)).status,'BLOCKED');
 }
});
test('existing warning signals produce warnings and never force a valid graph into activation',async()=>{
 const f=await fixture(),warnings=copy(f.warnings);warnings.entries=warnings.entries.map((e,i)=>i?e:{...e,signals:{softTargetFitDeviation:true,longPreparationBurden:true,shoppingListBurden:true,lowerConvenienceScore:true,repetitionApproachingLimit:true}});
 const g=graph(await adapter({...f.graphSource,warningEvidenceRaw:raw(warnings)}).prepare(f.operation,f.snapshotRaw));
 const codes=g.days[0].slots[0].warnings.map(w=>w.code);for(const c of ['SOFT_TARGET_FIT_DEVIATION','LONG_PREPARATION_BURDEN','SHOPPING_LIST_BURDEN','LOWER_CONVENIENCE_SCORE','REPETITION_LIMIT_APPROACHING'])assert.ok(codes.includes(c as typeof codes[number]));
 assert.ok(g.days[0].slots[0].warnings.every(w=>w.warningEvidenceRevision===warnings.entries[0].evidenceRevision));assert.equal(g.accepted,false);
});
test('ordinary fallback needs a revalidated exact week, never a caller VALID or no-plan assertion',async()=>{
 const f=await fixture();for(const ordinaryFallbackRaw of [raw({status:'VALID'}),raw({status:'NO_VALID_PLAN'}),raw({...f.witness,generationInputDigest:'0'.repeat(64)}),raw({...f.witness,selectedSnapshotRawSha256:'0'.repeat(64)}),raw({...f.witness,ordinarySnapshotRaw:'{}'})]){
  assert.equal((await adapter({...f.graphSource,ordinaryFallbackRaw}).prepare(f.operation,f.snapshotRaw)).status,'BLOCKED');
 }
});
test('specialty and expense may both warn when a separately validated ordinary week exists',async()=>{
 const f=await fixture(),bindings=copy(f.bindings);bindings[0].specialty=true;bindings[0].expensive=true;
 const ordinary=warningPolicyFixtureV3(await contentFixtureV4({recipeNamespace:'synthetic-ordinary',identityOffset:10000}));
 const source={...f.source,bindingsRaw:raw(bindings)},s=await graphSourceFixtureV3(f.operation,f.snapshotRaw,source,{snapshotRaw:ordinary.snapshotRaw,sourceRaw:raw(ordinary.source)});
 const g=graph(await adapter(s.graphSource).prepare(f.operation,f.snapshotRaw)),codes=g.days[0].slots[0].warnings.map(w=>w.code);
 assert.ok(codes.includes('OPTIONAL_SPECIALTY_USED'));assert.ok(codes.includes('OPTIONAL_EXPENSIVE_USED'));
 const bad=await graphSourceFixtureV3(f.operation,f.snapshotRaw,source);const r=await adapter(bad.graphSource).prepare(f.operation,f.snapshotRaw);assert.equal(r.status,'BLOCKED');
 const relabelled=await graphSourceFixtureV3(f.operation,f.snapshotRaw,source,{snapshotRaw:f.snapshotRaw,sourceRaw:raw(f.source)});assert.equal((await adapter(relabelled.graphSource).prepare(f.operation,f.snapshotRaw)).status,'BLOCKED');
});
test('ordinary witness cannot substitute preferences, policy context or manifest from another attempt',async()=>{
 const f=await fixture(),source=JSON.parse(f.witness.ordinaryContentSourceRaw),numeric=JSON.parse(source.numericAuthorityRaw);
 numeric.trustedGenerationInputRaw=raw({...f.input,optimizationPolicyRevision:id(99)});source.numericAuthorityRaw=raw(numeric);
 const r=await adapter({...f.graphSource,ordinaryFallbackRaw:raw({...f.witness,ordinaryContentSourceRaw:raw(source)})}).prepare(f.operation,f.snapshotRaw);assert.equal(r.status,'BLOCKED');
});
test('missing store or source substitutions fail closed before graph creation',async()=>{
 const f=await fixture();assert.equal((await create({loadForProposalRaw:async()=>null},authorized).prepare(f.operation,f.snapshotRaw)).status,'BLOCKED');
 assert.equal((await create({loadForProposalRaw:async()=>{throw Error();}},authorized).prepare(f.operation,f.snapshotRaw)).status,'BLOCKED');
 for(const patch of [{requestOperationId:id(99)},{evaluatedSnapshotRawSha256:'0'.repeat(64)},{contract:'legacy'}])assert.equal((await adapter({...f.graphSource,...patch} as ExactWeekGraphSourceV3).prepare(f.operation,f.snapshotRaw)).status,'BLOCKED');
});
test('readback does not trust cached receipts after event-time authority is revoked',async()=>{
 const f=await fixture(),g=graph(await adapter(f.graphSource).prepare(f.operation,f.snapshotRaw));const denied=create({loadForProposalRaw:async()=>raw(f.graphSource)},{isAuthorizedEvent:async()=>false});
 assert.equal((await denied.readback(f.operation,f.snapshotRaw,raw(g))).status,'BLOCKED');
});
test('replacement revalidates the full proposed week with exact portions and leaves prior graph unchanged',async()=>{
 const f=await fixture(),next=await changedPortionFixtureV3(f),sources=new Map([[sha(f.snapshotRaw),raw(f.graphSource)],[sha(next.snapshotRaw),raw(next.graphSource)]]);
 const a=create({loadForProposalRaw:async(_,h)=>sources.get(h)??null},authorized),prior=graph(await a.prepare(f.operation,f.snapshotRaw)),before=raw(prior);
 const g=graph(await a.replace(f.operation,f.snapshotRaw,raw(prior),next.snapshotRaw,raw({expectedGraphDigest:prior.digest,slotId:f.request.days[0].meals[0].slotId,componentKey:'main'})));
 assert.notEqual(g.digest,prior.digest);assert.deepEqual(g.days[0].slots[0].exactMeal.components[0].wholeRecipeMultiplier,q('1','6'));assert.equal(raw(prior),before);assert.equal(g.canRecord,false);
});
test('replacement rejects stale graph pins, extra changed slots, missing target and no-op requests',async()=>{
 const f=await fixture(),next=await changedPortionFixtureV3(f),extra=await changedPortionFixtureV3(f,q('1','2'),true),sources=new Map([[sha(f.snapshotRaw),raw(f.graphSource)],[sha(next.snapshotRaw),raw(next.graphSource)],[sha(extra.snapshotRaw),raw(extra.graphSource)]]);
 const a=create({loadForProposalRaw:async(_,h)=>sources.get(h)??null},authorized),prior=graph(await a.prepare(f.operation,f.snapshotRaw)),change={expectedGraphDigest:prior.digest,slotId:f.request.days[0].meals[0].slotId,componentKey:'main'};
 for(const [snapshotRaw,c] of [[next.snapshotRaw,{...change,expectedGraphDigest:'0'.repeat(64)}],[extra.snapshotRaw,change],[next.snapshotRaw,{...change,componentKey:'missing'}],[f.snapshotRaw,change]] as const){
  assert.equal((await a.replace(f.operation,f.snapshotRaw,raw(prior),snapshotRaw,raw(c))).status,'BLOCKED');
 }
});
test('replacement refuses a whole-week violation rather than keeping a partial updated graph',async()=>{
 const f=await fixture(),next=await changedPortionFixtureV3(f,q('3')),sources=new Map([[sha(f.snapshotRaw),raw(f.graphSource)],[sha(next.snapshotRaw),raw(next.graphSource)]]);
 const a=create({loadForProposalRaw:async(_,h)=>sources.get(h)??null},authorized),prior=graph(await a.prepare(f.operation,f.snapshotRaw));
 const result=await a.replace(f.operation,f.snapshotRaw,raw(prior),next.snapshotRaw,raw({expectedGraphDigest:prior.digest,slotId:f.request.days[0].meals[0].slotId,componentKey:'main'}));
 assert.equal(result.status,'REJECTED');assert.ok(!('graph'in result));
});
test('old graph decoders reject exact V3 rather than silently coercing nutrition to three places',async()=>{
 const f=await fixture(),g=graph(await adapter(f.graphSource).prepare(f.operation,f.snapshotRaw));await assert.rejects(decodeAdaptiveNutritionGraphV2(g));assert.throws(()=>decodeGraphRecipeSnapshotV1(g));
});
test('raw duplicate keys, negative zero, depth/byte budgets and wrong proposal bytes block',async()=>{
 const f=await fixture();for(const value of [f.snapshotRaw.replace('{','{"contract":"duplicate",'),'{"x":-0}', '['.repeat(33)+'0'+']'.repeat(33),' '.repeat(262145)])assert.equal((await adapter(f.graphSource).prepare(f.operation,value)).status,'BLOCKED');
 assert.equal((await adapter(f.graphSource).prepare(f.operation,f.snapshotRaw+' ')).status,'BLOCKED');
 const subjects=await exactGraphSlotSubjectsRawV3(f.snapshotRaw,raw(f.source));assert.equal(subjects.length,7);
});

test('replacement cannot smuggle new source recipe references into untouched placements',async()=>{
 const f=await fixture(),changed=warningPolicyFixtureV3(await contentFixtureV4({recipeNamespace:'synthetic-new-source',identityOffset:20000}));
 const next={...changed,...await graphSourceFixtureV3(changed.operation,changed.snapshotRaw,changed.source)},sources=new Map([[sha(f.snapshotRaw),raw(f.graphSource)],[sha(next.snapshotRaw),raw(next.graphSource)]]);
 const a=create({loadForProposalRaw:async(_,h)=>sources.get(h)??null},authorized),prior=graph(await a.prepare(f.operation,f.snapshotRaw));
 const result=await a.replace(f.operation,f.snapshotRaw,raw(prior),next.snapshotRaw,raw({expectedGraphDigest:prior.digest,slotId:f.request.days[0].meals[0].slotId,componentKey:'main'}));
 assert.equal(result.status,'BLOCKED');if(result.status==='BLOCKED')assert.equal(result.reason,'REPLACEMENT_SCOPE_CHANGED');
});
test('a locally valid replacement is rejected when it exceeds the weekly family repeat cap',async()=>{
 const f=await fixture(),next=await repeatedFamilyReplacementFixtureV3(f),sources=new Map([[sha(f.snapshotRaw),raw(f.graphSource)],[sha(next.snapshotRaw),raw(next.graphSource)]]);
 const a=create({loadForProposalRaw:async(_,h)=>sources.get(h)??null},authorized),prior=graph(await a.prepare(f.operation,f.snapshotRaw));
 const result=await a.replace(f.operation,f.snapshotRaw,raw(prior),next.snapshotRaw,raw({expectedGraphDigest:prior.digest,slotId:f.request.days[6].meals[0].slotId,componentKey:'main'}));
 assert.equal(result.status,'REJECTED');if(result.status==='REJECTED')assert.equal(result.reason,'EXACT_CONTENT_REJECTED');assert.ok(!('graph'in result));
});
test('replacement cannot change a non-target meal mode through a new source package',async()=>{
 const f=await fixture(),changed=await changedPortionFixtureV3(f),source={...changed.source,mealModes:changed.source.mealModes.map((m,i)=>i===1?{...m,sourceKind:'COMPOSED_MEAL' as const}:m)};
 const next=await graphSourceFixtureV3(f.operation,changed.snapshotRaw,source,{snapshotRaw:f.snapshotRaw,sourceRaw:raw(f.source)}),sources=new Map([[sha(f.snapshotRaw),raw(f.graphSource)],[sha(changed.snapshotRaw),raw(next.graphSource)]]);
 const a=create({loadForProposalRaw:async(_,h)=>sources.get(h)??null},authorized),prior=graph(await a.prepare(f.operation,f.snapshotRaw));
 const result=await a.replace(f.operation,f.snapshotRaw,raw(prior),changed.snapshotRaw,raw({expectedGraphDigest:prior.digest,slotId:f.request.days[0].meals[0].slotId,componentKey:'main'}));
 assert.equal(result.status,'BLOCKED');if(result.status==='BLOCKED')assert.equal(result.reason,'REPLACEMENT_SCOPE_CHANGED');
});
