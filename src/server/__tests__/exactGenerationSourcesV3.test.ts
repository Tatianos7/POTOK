import test from 'node:test';import assert from 'node:assert/strict';
import {createExactGenerationSourcePortsV3,createExactGenerationSqlOptimizerV3,exactGenerationSourceSqlV3,exactGenerationSourceStatementsV3} from '../exactGenerationSourcesV3';
import {exactPlanCurrentSqlV3} from '../exactPlanPostgresV3';
import {admissionFixtureV3,raw,id,sha} from './exactPlanAdmissionFixturesV3';
import {exactWeekMetricPolicyContractV3,exactWeekConvenienceContractV3} from '../exactWeekMetricProducerV3';
import {authorized} from './exactWeekNutritionFixturesV3';
const op=id(1),account=id(2),input='a'.repeat(64),subject='b'.repeat(64),payload=raw({testOnly:true});
const envelope=(kind:string,pin:string|null,body=payload)=>({contract:'potok-exact-generation-source-envelope-v3',purpose:'RETAINED_SOURCE_NOT_REVIEW_APPROVAL',requestOperationId:op,accountId:account,generationInputDigest:input,sourceKind:kind,subjectSha256:pin,payloadRaw:body,storageSha256:sha(body),sourceRef:'test-only'});
function fixture(){
 const calls:{sql:string;parameters:readonly string[]}[]=[];let patch:Record<string,unknown>={},rows:unknown=null;
 const sql={async query(statement:string,parameters:readonly string[]){calls.push({sql:statement,parameters});const kind=Object.entries(exactGenerationSourceSqlV3).find(([,s])=>s===statement)?.[0];if(!kind)throw Error();return {rows:rows??[{result_raw:raw({...envelope(kind,parameters[1]??null),...patch})}]} as {rows:{result_raw:string|null}[]};}};
 const binding={requestOperationId:op,accountId:account,generationInputDigest:input};
 return {ports:createExactGenerationSourcePortsV3(sql,binding),calls,binding,setPatch:(p:typeof patch)=>{patch=p;},setRows:(r:unknown)=>{rows=r;}};
}
test('five fixed source reads bind one operation, preserve payload bytes and expose no SQL selector',async()=>{
 const f=fixture();f.binding.accountId=id(99); // Capture binding before any await.
 assert.equal(await f.ports.pool.loadForOperationRaw(op),payload);assert.equal(await f.ports.graph.loadForProposalRaw(op,subject),payload);
 assert.equal(await f.ports.loadMetricPolicyRaw(op),payload);assert.equal(await f.ports.convenience.loadConvenienceRaw(op,subject,input,id(3)),payload);
 assert.equal(await f.ports.loadTitlesRaw(op,account,subject),payload);assert.equal(f.calls.length,5);
 assert.deepEqual(f.calls.map(c=>c.parameters),[[op],[op,subject],[op],[op,subject],[op,subject]]);
 assert.ok(f.calls.every(c=>exactGenerationSourceStatementsV3.includes(c.sql)));assert.ok(Object.isFrozen(f.ports));
});
test('foreign owner/operation/input/kind/subject and storage substitutions reject',async()=>{
 const f=fixture();for(const patch of [{accountId:id(99)},{requestOperationId:id(99)},{generationInputDigest:'0'.repeat(64)},{sourceKind:'GRAPH'},{subjectSha256:subject},{storageSha256:'0'.repeat(64)},{purpose:'APPROVED'},{sourceRef:''}]){
  f.setPatch(patch);await assert.rejects(f.ports.pool.loadForOperationRaw(op));
 }
});
test('invalid lookup never queries SQL and absent source never reuses a previous payload',async()=>{
 const f=fixture();await assert.rejects(f.ports.pool.loadForOperationRaw(id(99)));await assert.rejects(f.ports.graph.loadForProposalRaw(op,'bad'));
 await assert.rejects(f.ports.loadTitlesRaw(op,id(99),subject));await assert.rejects(f.ports.convenience.loadConvenienceRaw(op,subject,'0'.repeat(64),id(3)));assert.equal(f.calls.length,0);
 assert.equal(await f.ports.pool.loadForOperationRaw(op),payload);f.setRows([{result_raw:null}]);assert.equal(await f.ports.pool.loadForOperationRaw(op),null);
});
test('duplicate JSON, extra SQL rows/columns and oversized source fail closed',async()=>{
 const f=fixture();for(const rows of [[],[{result_raw:raw(envelope('POOL',null))},{result_raw:null}],[{result_raw:null,extra:true}],[{result_raw:raw(envelope('POOL',null)).replace('{','{"contract":"duplicate",')}]]){
  f.setRows(rows);await assert.rejects(f.ports.pool.loadForOperationRaw(op));
 }
 f.setRows([{result_raw:raw(envelope('POOL',null,' '.repeat(4_194_305)))}]);await assert.rejects(f.ports.pool.loadForOperationRaw(op));
});
test('fixed SQL composition runs the real exact optimizer and derived metrics, retaining NONE authority',async()=>{
 const f=await admissionFixtureV3(),binding={requestOperationId:f.operation,accountId:f.input.accountId,generationInputDigest:f.proposal.generationInputDigest};
 const policy={contract:exactWeekMetricPolicyContractV3,metricPolicyRevision:id(210001),optimizationPolicyRevision:f.input.optimizationPolicyRevision,targetFit:'MEAN_DAILY_EXACT_CALORIE_FIT_V3',diversity:'UNIQUE_RECIPE_MEAL_SHARE_V1',shoppingReuse:'CANONICAL_FOOD_MEAL_REUSE_SHARE_V1',convenience:'INDEPENDENT_EXACT_WEEK_CONVENIENCE_V3'};
 const calls:string[]=[];const sql={async query(statement:string,parameters:readonly string[]){calls.push(statement);assert.equal(parameters[0],f.operation);
  if(statement===exactPlanCurrentSqlV3)return {rows:[{result_raw:raw({...f.admission,evaluatedProposalRawSha256:null})}]};
  const kind=Object.entries(exactGenerationSourceSqlV3).find(([,s])=>s===statement)?.[0];let body:string|null=null;
  if(kind==='POOL')body=raw(f.pool);if(kind==='GRAPH')body=f.sources.get(parameters[1])??null;if(kind==='METRIC_POLICY')body=raw(policy);
  if(kind==='CONVENIENCE')body=raw({contract:exactWeekConvenienceContractV3,requestOperationId:f.operation,graphRawSha256:parameters[1],generationInputDigest:binding.generationInputDigest,metricPolicyRevision:policy.metricPolicyRevision,sourceRevision:id(210002),score:{numerator:'0',denominator:'1'}});
  return {rows:[{result_raw:body===null?null:raw({...envelope(kind!,parameters[1]??null,body),...binding})}]};
 }};
 const r=await createExactGenerationSqlOptimizerV3(sql,authorized).optimize(f.operation);assert.equal(r.status,'EXACT_WEEK_SELECTED_PENDING_STORAGE_ADMISSION');
 if(r.status!=='EXACT_WEEK_SELECTED_PENDING_STORAGE_ADMISSION')assert.fail(JSON.stringify(r));assert.equal(r.proposal.graph.evaluatedSnapshotRawSha256,sha(f.snapshotRaw));
 assert.equal(r.proposal.canActivate,false);assert.deepEqual(r.proposal.facts,[]);assert.ok(calls.every(c=>exactGenerationSourceStatementsV3.includes(c)));
});
