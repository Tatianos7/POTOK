import test from 'node:test';import assert from 'node:assert/strict';
import {optimizationFixtureV3 as fixture,raw,id,sha,copy,q,graphSourceFixtureV3,zeroMetricsV3 as zero,oneMetricsV3 as one} from './exactWeekOptimizationFixturesV3';
import {changedPortionFixtureV3} from './exactWeekGraphFixturesV3';import {sealBalanceFixtureV3} from './exactWeekNutritionValidationFixturesV3';
import {evaluateExactWeekScoreRawV3,createExactWeekOptimizationV3,type ExactWeekOptimizationResultV3} from '../exactWeekOptimizationV3';
import {canonicalJsonV1} from '../../utils/adaptiveNutritionWireV1';
const selected=(r:ExactWeekOptimizationResultV3)=>{if(r.status!=='EXACT_WEEK_SELECTED_PENDING_STORAGE_ADMISSION')assert.fail(JSON.stringify(r));return r.proposal;};
test('a later higher-scoring exact validated week wins with source-bound receipt and all write flags false',async()=>{
 const f=await fixture(),p=selected(await f.adapter.optimize(f.operation)),receipt=JSON.parse(p.optimizationReceiptRaw);
 assert.equal(receipt.selectedCandidateIndex,1);assert.equal(receipt.scope,'BEST_IN_VALIDATED_POOL');assert.equal(receipt.evaluated,2);assert.equal(receipt.totalCandidates,2);
 assert.deepEqual(receipt.selectedScoreBounds.score,q('1'));assert.equal(p.selectedSnapshotRaw,f.alternative.snapshotRaw);assert.equal(p.graph.exactSnapshotDigest,f.alternative.snapshot.digest);
 assert.deepEqual(f.counts(),{graphReads:2,metricReads:2});assert.deepEqual(p.facts,[]);assert.equal(p.authority,'NONE');assert.equal(p.accepted,false);assert.equal(p.canRecord,false);assert.equal(p.canActivate,false);
 assert.equal(p.decisionEvidence.optimizationResultDigest,p.optimizationResultDigest);assert.equal(p.decisionEvidence.slots.length,7);assert.ok(Object.isFrozen(p.graph.days));
 assert.equal(p.graph.days[0].slots[0].exactMeal.components[0].ingredients[0].amount.denominator,'3');
});
test('metric weights and close scores are compared as exact fractions without three-place ties',async()=>{
 const f=await fixture();f.setValues([{...zero,targetFit:q('1','2')},{...zero,targetFit:q('5000001','10000000')}]);
 const p=selected(await f.adapter.optimize(f.operation)),receipt=JSON.parse(p.optimizationReceiptRaw);assert.equal(receipt.selectedCandidateIndex,1);assert.deepEqual(receipt.selectedScoreBounds.score,q('5000001','25000000'));
 assert.deepEqual(evaluateExactWeekScoreRawV3(f.policyRaw,raw({...zero,targetFit:q('1','3')}),'STRICT').score,q('2','15'));
});
test('pure score decoder rejects unknown, unsafe or noncanonical metrics instead of manufacturing values',async()=>{
 const f=await fixture();for(const metrics of [{...zero,targetFit:null},{...zero,diversity:q('1001','1000')},{...zero,convenience:null},{...zero,targetFit:q('2','4')},{...zero,targetFit:0.5},{...zero,shoppingReuse:undefined},{...zero,extra:q('1')},{...zero,targetFit:{numerator:'-1',denominator:'1'}}]){
  assert.throws(()=>evaluateExactWeekScoreRawV3(f.policyRaw,raw(metrics),'STRICT'));
 }
 assert.throws(()=>evaluateExactWeekScoreRawV3(f.policyRaw,raw(zero).replace('{','{"targetFit":null,'),'STRICT'));
 const r=evaluateExactWeekScoreRawV3(f.policyRaw,raw({...zero,convenience:null}),'ROBUST_CONVENIENCE_BOUNDS');assert.deepEqual(r.minimum,q('0'));assert.deepEqual(r.maximum,q('1','5'));assert.equal(r.score,null);
});
test('existing warning-free priority wins before a higher metric score with warnings',async()=>{
 const f=await fixture(),source=JSON.parse(f.sources.get(sha(f.snapshotRaw))!),warning=JSON.parse(source.warningEvidenceRaw);warning.entries[0].signals.longPreparationBurden=true;source.warningEvidenceRaw=raw(warning);
 f.sources.set(sha(f.snapshotRaw),raw(source));f.setValues([one,zero]);const p=selected(await f.adapter.optimize(f.operation));assert.equal(JSON.parse(p.optimizationReceiptRaw).selectedCandidateIndex,1);
});
test('equal exact scores use deterministic snapshot SHA and stable readback',async()=>{
 const f=await fixture();f.setValues([zero,zero]);const p=selected(await f.adapter.optimize(f.operation)),expected=f.pool.candidates.map(c=>c.snapshotRawSha256).sort()[0];
 assert.equal(p.decisionEvidence.selectedSnapshotRawSha256,expected);assert.deepEqual(selected(await f.adapter.readback(f.operation,raw(p))),p);
});
test('evaluation budget reports best evaluated prefix, never an exhaustive global optimum',async()=>{
 const f=await fixture();f.setPool(raw({...f.pool,maxEvaluations:1}));const p=selected(await f.adapter.optimize(f.operation)),receipt=JSON.parse(p.optimizationReceiptRaw);
 assert.equal(receipt.scope,'BEST_EVALUATED_PREFIX');assert.equal(receipt.evaluated,1);assert.equal(receipt.totalCandidates,2);assert.equal(receipt.selectedCandidateIndex,0);assert.deepEqual(f.counts(),{graphReads:1,metricReads:1});
});
test('unknown convenience blocks strict comparison; robust intervals select only a provable winner',async()=>{
 const strict=await fixture();strict.setValues([{...one,convenience:null},zero]);assert.equal((await strict.adapter.optimize(strict.operation)).status,'BLOCKED');
 const f=await fixture('ROBUST_CONVENIENCE_BOUNDS');f.setValues([{...one,convenience:null},zero]);const p=selected(await f.adapter.optimize(f.operation)),bounds=JSON.parse(p.optimizationReceiptRaw).selectedScoreBounds;
 assert.equal(JSON.parse(p.optimizationReceiptRaw).selectedCandidateIndex,0);assert.equal(bounds.score,null);assert.deepEqual(bounds.minimum,q('4','5'));assert.deepEqual(bounds.maximum,q('1'));assert.deepEqual(bounds.unknownMetrics,['convenience']);
 f.setValues([{...zero,convenience:null},{...zero,convenience:null}]);const blocked=await f.adapter.optimize(f.operation);assert.equal(blocked.status,'BLOCKED');if(blocked.status==='BLOCKED')assert.equal(blocked.reason,'OPTIMIZATION_UNCERTAINTY');
});
test('missing metrics or source evidence in a later candidate cannot silently promote an earlier candidate',async()=>{
 const f=await fixture();f.setAssessment((v,index)=>index===1?null:raw(v));const a=await f.adapter.optimize(f.operation);assert.equal(a.status,'BLOCKED');if(a.status==='BLOCKED')assert.equal(a.reason,'METRICS_UNAVAILABLE');
 f.setAssessment(null);f.sources.delete(sha(f.alternative.snapshotRaw));const b=await f.adapter.optimize(f.operation);assert.equal(b.status,'BLOCKED');if(b.status==='BLOCKED')assert.equal(b.reason,'CANDIDATE_EVIDENCE_UNAVAILABLE_OR_CHANGED');
});
test('assessment binds operation, input, actual graph bytes/digest, proposal and optimization policy',async()=>{
 const f=await fixture();for(const key of ['requestOperationId','generationInputDigest','graphDigest','graphRawSha256','evaluatedSnapshotRawSha256','optimizationPolicyRevision','optimizationPolicyRawSha256','assessmentRevision','contract'] as const){
  f.setAssessment(v=>raw({...v,[key]:key==='requestOperationId'||key==='optimizationPolicyRevision'?id(99):'invalid'}));assert.equal((await f.adapter.optimize(f.operation)).status,'BLOCKED');
 }
 f.setAssessment(v=>raw(v).replace('{','{"contract":"duplicate",'));assert.equal((await f.adapter.optimize(f.operation)).status,'BLOCKED');
});
test('pool operation/account/input and fixed optimization policy cannot be substituted',async()=>{
 const f=await fixture();for(const pool of [{...f.pool,requestOperationId:id(99)},{...f.pool,trustedGenerationInputRaw:raw({...f.input,accountId:id(99)})},
  {...f.pool,optimizationPolicyRaw:raw({...JSON.parse(f.policyRaw),policyRevision:id(99)})},{...f.pool,optimizationPolicyRaw:raw({...JSON.parse(f.policyRaw),weights:{targetFit:'1.000',diversity:'0.000',convenience:'0.000',shoppingReuse:'0.000'}})}]){
  f.setPool(raw(pool));assert.equal((await f.adapter.optimize(f.operation)).status,'BLOCKED');
 }
});
test('pool budgets, duplicate candidates, semantic duplicates and changed bytes are rejected',async()=>{
 const f=await fixture();for(const pool of [{...f.pool,maxEvaluations:0},{...f.pool,maxEvaluations:65},{...f.pool,candidates:[]},{...f.pool,candidates:Array(65).fill(f.pool.candidates[0])},
  {...f.pool,candidates:[f.pool.candidates[0],f.pool.candidates[0]]},{...f.pool,candidates:[{...f.pool.candidates[0],snapshotRawSha256:'0'.repeat(64)}]},
  {...f.pool,candidates:[f.pool.candidates[0],{snapshotRaw:f.snapshotRaw+' ',snapshotRawSha256:sha(f.snapshotRaw+' ')}]}]){
  f.setPool(raw(pool));assert.equal((await f.adapter.optimize(f.operation)).status,'BLOCKED');
 }
});
test('all invalid visited candidates distinguish complete provided pool from an unfinished search',async()=>{
 const f=await fixture(),bad=await changedPortionFixtureV3(f,q('3'));f.sources.set(sha(bad.snapshotRaw),raw(bad.graphSource));
 const candidate={snapshotRaw:bad.snapshotRaw,snapshotRawSha256:sha(bad.snapshotRaw)};f.setPool(raw({...f.pool,candidates:[candidate]}));
 const complete=await f.adapter.optimize(f.operation);assert.equal(complete.status,'NO_FEASIBLE_WEEK_IN_PROVIDED_POOL');assert.ok(!('proposal'in complete));assert.equal(f.counts().metricReads,0);
 f.setPool(raw({...f.pool,maxEvaluations:1,candidates:[candidate,f.pool.candidates[1]]}));assert.equal((await f.adapter.optimize(f.operation)).status,'SEARCH_LIMIT_REACHED');
});
test('a rejected candidate is recorded and cannot beat a later validated week',async()=>{
 const f=await fixture(),bad=await changedPortionFixtureV3(f,q('3'));f.sources.set(sha(bad.snapshotRaw),raw(bad.graphSource));
 f.setPool(raw({...f.pool,candidates:[{snapshotRaw:bad.snapshotRaw,snapshotRawSha256:sha(bad.snapshotRaw)},f.pool.candidates[1]]}));const p=selected(await f.adapter.optimize(f.operation)),receipt=JSON.parse(p.optimizationReceiptRaw);
 assert.equal(receipt.selectedCandidateIndex,1);assert.equal(receipt.evaluations[0].validationStatus,'REJECTED');assert.equal(receipt.evaluations[0].bounds,null);assert.equal(f.counts().metricReads,1);
});
test('same-revision current context drift between otherwise valid candidates blocks comparison',async()=>{
 const f=await fixture(),balance={...f.balance,allowedWarningCodes:[]},numeric={...f.alternative.source,numericAuthorityRaw:raw({...JSON.parse(f.alternative.source.numericAuthorityRaw),balancePolicySnapshotRaw:raw(sealBalanceFixtureV3(balance))})};
 const ordinary={...f.source,numericAuthorityRaw:raw({...f.numeric,balancePolicySnapshotRaw:raw(sealBalanceFixtureV3(balance))})};
 const altered=await graphSourceFixtureV3(f.operation,f.alternative.snapshotRaw,numeric,{snapshotRaw:f.snapshotRaw,sourceRaw:raw(ordinary)});f.sources.set(sha(f.alternative.snapshotRaw),raw(altered.graphSource));
 const r=await f.adapter.optimize(f.operation);assert.equal(r.status,'BLOCKED');if(r.status==='BLOCKED')assert.equal(r.reason,'CANDIDATE_CONTEXT_DRIFT');
});
test('shared immutable recipe publication metadata cannot drift across the candidate pool',async()=>{
 const f=await fixture(),bindings=copy(f.bindings);bindings[0].intoleranceCodes=['lactose'];
 const source={...f.alternative.source,bindingsRaw:raw(bindings)},ordinary={...f.source,bindingsRaw:raw(bindings)};
 const altered=await graphSourceFixtureV3(f.operation,f.alternative.snapshotRaw,source,{snapshotRaw:f.snapshotRaw,sourceRaw:raw(ordinary)});f.sources.set(sha(f.alternative.snapshotRaw),raw(altered.graphSource));
 const r=await f.adapter.optimize(f.operation);assert.equal(r.status,'BLOCKED');if(r.status==='BLOCKED')assert.equal(r.reason,'CANDIDATE_PUBLICATION_DRIFT');
});
test('receipt and proposal digests cover evaluations, exact score bounds and slot decisions',async()=>{
 const f=await fixture(),p=selected(await f.adapter.optimize(f.operation)),receipt=JSON.parse(p.optimizationReceiptRaw),{digest:receiptDigest,...content}=receipt;
 assert.equal(receiptDigest,sha(canonicalJsonV1({domain:'potok-exact-week-optimization-receipt-sha256-v3',payload:content},'SAFE_INTEGER')));assert.equal(p.optimizationResultDigest,receiptDigest);
 const {digest,...payload}=p;assert.equal(digest,sha(canonicalJsonV1({domain:'potok-exact-generated-week-proposal-sha256-v3',payload},'SAFE_INTEGER')));
 for(const [i,decision] of p.decisionEvidence.slots.entries()){assert.equal(decision.selectedSlotSubjectDigest,p.graph.days[i].slots[0].subjectDigest);assert.equal(decision.decisionPath,'COMPLETE_RECIPE');}
});
test('readback reloads metrics and graph sources and rejects modified receipts or write flags',async()=>{
 const f=await fixture(),p=selected(await f.adapter.optimize(f.operation));for(const patch of [{canRecord:true},{facts:[{consumed:true}]},{optimizationResultDigest:'0'.repeat(64)}])assert.equal((await f.adapter.readback(f.operation,raw({...p,...patch}))).status,'BLOCKED');
 f.setValues([one,zero]);assert.equal((await f.adapter.readback(f.operation,raw(p))).status,'BLOCKED');
 f.setValues([zero,one]);f.sources.delete(sha(f.snapshotRaw));assert.equal((await f.adapter.readback(f.operation,raw(p))).status,'BLOCKED');
});
test('missing source, duplicate raw keys, malformed policies and revoked event authority fail closed',async()=>{
 const f=await fixture();for(const value of [null,raw(f.pool).replace('{','{"contract":"duplicate",'),raw({...f.pool,extra:true}),raw({...f.pool,maxEvaluations:-0}).replace('"maxEvaluations":0','"maxEvaluations":-0')]){
  f.setPool(value);assert.equal((await f.adapter.optimize(f.operation)).status,'BLOCKED');
 }
 const revoked=createExactWeekOptimizationV3({loadForOperationRaw:async()=>raw(f.pool)},{loadForProposalRaw:async(_,h)=>f.sources.get(h)??null},{assessGraphRaw:async()=>null},{isAuthorizedEvent:async()=>false});
 assert.equal((await revoked.optimize(f.operation)).status,'BLOCKED');assert.equal((await f.adapter.optimize('not-a-uuid')).status,'BLOCKED');
});
