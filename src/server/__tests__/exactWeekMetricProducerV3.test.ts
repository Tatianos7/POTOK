import test from 'node:test';import assert from 'node:assert/strict';
import {optimizationFixtureV3,raw,sha,id,copy,q,authorized} from './exactWeekOptimizationFixturesV3';
import {createExactWeekMetricProducerV3,calculateExactCalorieTargetFitV3,exactWeekMetricPolicyContractV3,exactWeekConvenienceContractV3} from '../exactWeekMetricProducerV3';
import {createExactWeekGraphPreparationV3} from '../exactWeekGraphPreparationV3';
import {createExactWeekOptimizationV3} from '../exactWeekOptimizationV3';
import {canonicalJsonV1} from '../../utils/adaptiveNutritionWireV1';
import {calculateGoalTargetFitV1,goalTargetFitInputContractV1} from '../../utils/adaptiveNutritionMealBalanceV1';
import {projectExactNutritionForDisplayV2,createExactNutritionValuesV2} from '../../utils/exactNutritionValuesV2';
const canonical=(v:unknown)=>canonicalJsonV1(v,'SAFE_INTEGER');
async function fixture(){
 const f=await optimizationFixtureV3();let poolRaw:string|null=raw(f.pool),convenienceRaw:string|null=null,revoked=false;
 const poolPort={loadForOperationRaw:async()=>poolRaw},graphPort={loadForProposalRaw:async(op:string,subject:string)=>op===f.operation?f.sources.get(subject)??null:null};
 const prepared=await createExactWeekGraphPreparationV3(graphPort,authorized).prepare(f.operation,f.snapshotRaw);if(prepared.status!=='EXACT_GRAPH_PREPARED_PENDING_OPTIMIZATION')throw Error();
 const graph=prepared.graph,graphRaw=canonical(graph),metricPolicy={contract:exactWeekMetricPolicyContractV3,metricPolicyRevision:id(200001),optimizationPolicyRevision:f.input.optimizationPolicyRevision,
  targetFit:'MEAN_DAILY_EXACT_CALORIE_FIT_V3',diversity:'UNIQUE_RECIPE_MEAL_SHARE_V1',shoppingReuse:'CANONICAL_FOOD_MEAL_REUSE_SHARE_V1',convenience:'INDEPENDENT_EXACT_WEEK_CONVENIENCE_V3'};
 const events={isAuthorizedEvent:async()=>!revoked};
 const producer=createExactWeekMetricProducerV3(poolPort,graphPort,events,raw(metricPolicy),{loadConvenienceRaw:async()=>convenienceRaw});
 const convenience={contract:exactWeekConvenienceContractV3,requestOperationId:f.operation,graphRawSha256:sha(graphRaw),generationInputDigest:graph.generationInputDigest,metricPolicyRevision:metricPolicy.metricPolicyRevision,sourceRevision:id(200002),score:q('1','3')};
 return {...f,graph,graphRaw,poolPort,graphPort,metricPolicy,convenience,producer,setPool:(s:string|null)=>{poolRaw=s;},setConvenience:(s:string|null)=>{convenienceRaw=s;},revoke:()=>{revoked=true;},
  calculate:()=>producer.calculateGraphRaw(f.operation,graphRaw,graph.generationInputDigest,f.policyRaw)};
}
test('exact calorie fit preserves asymmetric V1 definition without early rounding',()=>{
 const axis={min:'0.000',target:'1.000',max:'4.000'};
 assert.deepEqual(calculateExactCalorieTargetFitV3(axis,q('0')),q('2','3'));
 assert.deepEqual(calculateExactCalorieTargetFitV3(axis,q('2')),q('2','3'));
 assert.deepEqual(calculateExactCalorieTargetFitV3(axis,q('1')),q('1'));
 assert.deepEqual(calculateExactCalorieTargetFitV3(axis,q('4')),q('0'));
 assert.deepEqual(calculateExactCalorieTargetFitV3({min:'1.000',target:'1.000',max:'1.000'},q('1')),q('1'));
 assert.throws(()=>calculateExactCalorieTargetFitV3(axis,q('5')),/BOUNDS/);
 assert.throws(()=>calculateExactCalorieTargetFitV3({min:'2.000',target:'1.000',max:'4.000'},q('2')),/BOUNDS/);
});
test('V1 compatibility is display-only: exact 2/3 rounds to prior 0.667 without coercing exact score',async()=>{
 const f=await optimizationFixtureV3(),goal={...f.input.goalNutritionTarget,calories:{min:'0.000',target:'1.000',max:'4.000'}};
 const legacy=await calculateGoalTargetFitV1({contract:goalTargetFitInputContractV1,goalTarget:goal,expected:{goalRevision:goal.goalRevision,targetPolicyRevision:goal.targetPolicyRevision},actualNutrition:{calories:'2.000',protein:'0.000',fat:'0.000',carbs:'0.000',fiber:'0.000'}});
 const exact=calculateExactCalorieTargetFitV3(goal.calories,q('2')),display=projectExactNutritionForDisplayV2(createExactNutritionValuesV2({calories:exact,protein:q('0'),fat:q('0'),carbs:q('0'),fiber:q('0')}),{fractionDigits:3,rounding:'HALF_UP'});
 assert.equal(display.values.calories,legacy.score);assert.deepEqual(exact,q('2','3'));
});
test('fresh graph produces exact diversity/reuse, excludes water/salt, and leaves missing convenience unknown',async()=>{
 const f=await fixture(),r=await f.calculate();assert.ok(r);assert.equal(r.status,'PARTIAL');const assessment=JSON.parse(r.metricsRaw),receipt=JSON.parse(r.calculationReceiptRaw);
 assert.deepEqual(assessment.metrics.diversity,q('1'));assert.deepEqual(assessment.metrics.shoppingReuse,q('6','7'));assert.equal(assessment.metrics.convenience,null);
 assert.deepEqual(assessment.metrics.targetFit,q('18378866123','24000000000'));
 assert.equal(receipt.canonicalFoodMealAppearances,7);assert.equal(receipt.distinctCanonicalFoodIds.length,1);assert.equal(receipt.excludedNonFoodMealAppearances,14);
 assert.equal(receipt.dailyFits.length,7);assert.equal(receipt.authority,'NONE');assert.equal(assessment.graphRawSha256,sha(f.graphRaw));
 assert.equal(assessment.evaluatedSnapshotRawSha256,sha(f.snapshotRaw));assert.equal(receipt.convenienceSourceRawSha256,null);
 const {digest,assessmentRevision,...payload}=receipt;assert.equal(digest,sha(canonical({domain:'potok-exact-week-metric-calculation-sha256-v3',payload})));assert.equal(assessment.assessmentRevision,assessmentRevision);
 assert.deepEqual(await f.calculate(),r);
});
test('independent rational convenience binds to actual graph, input and metric policy',async()=>{
 const f=await fixture();f.setConvenience(raw(f.convenience));const r=await f.calculate();assert.ok(r);assert.equal(r.status,'ASSESSED');assert.deepEqual(JSON.parse(r.metricsRaw).metrics.convenience,q('1','3'));
 for(const patch of [{graphRawSha256:'0'.repeat(64)},{requestOperationId:id(99)},{generationInputDigest:'0'.repeat(64)},{metricPolicyRevision:id(99)},{sourceRevision:'bad'},{score:q('2')},{score:{numerator:'2',denominator:'6'}},{score:-0}]){
  f.setConvenience(raw({...f.convenience,...patch}));assert.equal(await f.calculate(),null);
 }
});
test('changed graph values/flags or unknown snapshot pin never become metric authority',async()=>{
 const f=await fixture();for(const patch of [{canActivate:true},{digest:'0'.repeat(64)},{evaluatedSnapshotRawSha256:'0'.repeat(64)},{nutrition:{...f.graph.nutrition,values:{...f.graph.nutrition.values,calories:q('1')}}}]){
  assert.equal(await f.producer.assessGraphRaw(f.operation,raw({...f.graph,...patch}),f.graph.generationInputDigest,f.policyRaw),null);
 }
 assert.equal(await f.producer.assessGraphRaw(id(99),f.graphRaw,f.graph.generationInputDigest,f.policyRaw),null);
 assert.equal(await f.producer.assessGraphRaw(f.operation,f.graphRaw,'0'.repeat(64),f.policyRaw),null);
});
test('pool bytes, policy revision and duplicate subject substitutions block derived assessment',async()=>{
 const f=await fixture(),p=f.pool;
 for(const v of [null,raw({...p,requestOperationId:id(99)}),raw({...p,candidates:[p.candidates[0],p.candidates[0]]}),raw({...p,candidates:p.candidates.map(c=>({...c,snapshotRaw:c.snapshotRaw+' '}))}),raw({...p,optimizationPolicyRaw:f.policyRaw+' '})]){
  f.setPool(v);assert.equal(await f.calculate(),null);
 }
 assert.throws(()=>createExactWeekMetricProducerV3(f.poolPort,f.graphPort,authorized,raw({...f.metricPolicy,targetFit:'UNKNOWN'}),null));
});
test('readback reloads source/event authority and rejects revoked or modified evidence',async()=>{
 const f=await fixture();assert.ok(await f.calculate());f.revoke();assert.equal(await f.calculate(),null);
 const g=await fixture(),source=copy(g.graphSource);source.warningEvidenceRaw=raw({...JSON.parse(source.warningEvidenceRaw),entries:[]});g.sources.set(sha(g.snapshotRaw),raw(source));assert.equal(await g.calculate(),null);
});
test('real exact optimizer consumes derived metrics; unknown convenience keeps STRICT blocked',async()=>{
 const f=await fixture();const strict=createExactWeekOptimizationV3(f.poolPort,f.graphPort,f.producer,authorized);assert.equal((await strict.optimize(f.operation)).status,'BLOCKED');
 const complete=createExactWeekMetricProducerV3(f.poolPort,f.graphPort,authorized,raw(f.metricPolicy),{loadConvenienceRaw:async(op,graphSha,inputDigest,revision)=>raw({...f.convenience,requestOperationId:op,graphRawSha256:graphSha,generationInputDigest:inputDigest,metricPolicyRevision:revision,score:q('0')})});
 const selected=await createExactWeekOptimizationV3(f.poolPort,f.graphPort,complete,authorized).optimize(f.operation);assert.equal(selected.status,'EXACT_WEEK_SELECTED_PENDING_STORAGE_ADMISSION');
 if(selected.status!=='EXACT_WEEK_SELECTED_PENDING_STORAGE_ADMISSION')assert.fail(JSON.stringify(selected));
 const receipt=JSON.parse(selected.proposal.optimizationReceiptRaw);assert.equal(receipt.evaluated,2);assert.equal(receipt.evaluations.every((v:{metricAssessmentRawSha256:string})=>v.metricAssessmentRawSha256!==null),true);
 assert.equal(selected.proposal.graph.evaluatedSnapshotRawSha256,sha(f.snapshotRaw));
 assert.equal(selected.proposal.canActivate,false);assert.deepEqual(selected.proposal.facts,[]);
});
test('duplicate JSON keys, huge graph and source exception fail closed',async()=>{
 const f=await fixture();assert.equal(await f.producer.assessGraphRaw(f.operation,f.graphRaw.replace('{','{"contract":"duplicate",'),f.graph.generationInputDigest,f.policyRaw),null);
 assert.equal(await f.producer.assessGraphRaw(f.operation,' '.repeat(1_048_577),f.graph.generationInputDigest,f.policyRaw),null);
 const broken=createExactWeekMetricProducerV3({loadForOperationRaw:async()=>{throw Error('private');}},f.graphPort,authorized,raw(f.metricPolicy),null);
 assert.equal(await broken.assessGraphRaw(f.operation,f.graphRaw,f.graph.generationInputDigest,f.policyRaw),null);
});
