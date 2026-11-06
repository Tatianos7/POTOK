import assert from 'node:assert/strict';import test from 'node:test';
import {raw,id,copy,sha} from './exactFoodNutritionFixturesV2';
import {authorized} from './exactWeekNutritionFixturesV3';
import {exactWeekValidationFixtureV3 as fixture,refreshInputFixtureV3,sealBalanceFixtureV3} from './exactWeekNutritionValidationFixturesV3';
import {createExactWeekNutritionValidationAdapterV3 as create,exactWeekNumericRemainingChecksV3} from '../exactWeekNutritionValidationV3';
import {canonicalJsonV1} from '../../utils/adaptiveNutritionWireV1';
import {fullFixture} from '../../utils/__tests__/trustedGeneratedWeekFixturesV1';
import {createGenerationValidationAdapterV1,generationValidationAuthorityContractV1} from '../generationValidationAdapterV1';
const adapter=(a:unknown)=>create({loadForProposalRaw:async()=>typeof a==='string'||a===null?a:raw(a)},authorized);

test('numeric pass uses existing admitted goals/policies but cannot authorize record/activation or claim full validation',async()=>{
 const f=await fixture(),calls:unknown[]=[];const gate=create({loadForProposalRaw:async(op,hash)=>{calls.push([op,hash]);return raw(f.authority);}},authorized);
 const r=await gate.validate(f.operation,f.snapshotRaw);assert.equal(r.status,'NUMERIC_CHECKS_PASSED_PENDING_VALIDATION');
 assert.equal(r.accepted,false);assert.equal(r.canRecord,false);assert.equal(r.canActivate,false);assert.equal('generatedPlanRaw'in r,false);
 assert.equal(r.authority,'NONE');assert.deepEqual(r.remainingChecks,exactWeekNumericRemainingChecksV3);
 assert.deepEqual(r.checkedGoalAxes,['calories']);assert.deepEqual(r.unspecifiedGoalAxes,['protein','fat','carbs','fiber']);assert.deepEqual(r.violations,[]);
 assert.deepEqual(calls,[[f.operation,sha(f.snapshotRaw)]]);assert.ok(Object.isFrozen(r.remainingChecks));assert.ok(Object.isFrozen(gate));
 // The synthetic week repeats a recipe 28 times: numeric pass explicitly does not prove repeat/publication/safety checks.
 assert.ok(r.remainingChecks.includes('COMPOSITION_REPEAT_ACCESSIBILITY'));
});
test('null, unavailable and throwing authority port blocks with no writable payload',async()=>{
 const f=await fixture();for(const port of [{loadForProposalRaw:async()=>null},{loadForProposalRaw:async()=>{throw Error();}}]){
  const r=await create(port,authorized).validate(f.operation,f.snapshotRaw);assert.equal(r.status,'BLOCKED');assert.equal(r.canRecord,false);assert.equal('snapshot'in r,false);
 }
});
test('hostile/non-string API arguments and lone surrogate never reach the source port',async()=>{
 let calls=0,traps=0;const gate=create({loadForProposalRaw:async()=>{calls++;return null;}},authorized),proxy=new Proxy({},{get(){traps++;throw Error();}});
 for(const operation of [proxy,null,{},id(9).toUpperCase()+'x'])assert.equal((await gate.validate(operation as string,'{}')).status,'BLOCKED');
 for(const proposal of [proxy,null,{},5,'{"name":"\ud800"}'])assert.equal((await gate.validate(id(9),proposal as string)).status,'BLOCKED');
 assert.equal(calls,0);assert.equal(traps,0);
});
test('legacy V1 authority package and other malformed packages cannot be used as exact authority',async()=>{
 const f=await fixture();for(const a of [{...f.authority,contract:generationValidationAuthorityContractV1},{...f.authority,canRecord:true},[],{},null])assert.equal((await adapter(a).validate(f.operation,f.snapshotRaw)).status,'BLOCKED');
 for(const a of [false,5,undefined,new String('{}')]){
  const gate=create({loadForProposalRaw:async()=>a as unknown as string},authorized);assert.equal((await gate.validate(f.operation,f.snapshotRaw)).status,'BLOCKED');
 }
});
test('operation, raw proposal, admitted digest, source request and expected snapshot bindings are mandatory',async()=>{
 const f=await fixture();for(const patch of [{requestOperationId:id(9)},{evaluatedSnapshotRawSha256:'0'.repeat(64)},
  {generationInputDigest:'0'.repeat(64)},{weekRequestDigest:'0'.repeat(64)},{snapshotDigest:'0'.repeat(64)}]){
  assert.equal((await adapter({...f.authority,...patch}).validate(f.operation,f.snapshotRaw)).status,'BLOCKED');
 }
 assert.equal((await adapter(f.authority).validate(f.operation,f.snapshotRaw+'\n')).status,'BLOCKED');
});
test('current goal differing from admitted immutable goal is stale, including unchanged revision with changed numbers',async()=>{
 const f=await fixture();for(const goal of [{...f.goal,goalRevision:id(9)},{...f.goal,targetPolicyRevision:id(9)},
  {...f.goal,calories:{...f.goal.calories,max:'9000.000'}}]){
  const r=await adapter({...f.authority,currentGoalTargetRaw:raw(goal)}).validate(f.operation,f.snapshotRaw);assert.equal(r.status,'BLOCKED');
 }
});
test('admitted account, selection, operation, timezone and week cannot be substituted',async()=>{
 const f=await fixture();for(const change of [{accountId:id(9)},{selection:{...f.input.selection,selectionId:id(9)}},
  {operation:{...f.input.operation,requestId:id(9)}},{timezone:'UTC'},{weekStartLocal:'2026-11-09'}]){
  const a=copy(f.authority);await refreshInputFixtureV3(a,{...f.input,...change});assert.equal((await adapter(a).validate(f.operation,f.snapshotRaw)).status,'BLOCKED');
 }
});
test('existing balance policy digest/revision/literal constraints stay unchanged',async()=>{
 const f=await fixture();const sealed=JSON.parse(f.authority.balancePolicySnapshotRaw);
 for(const balancePolicySnapshotRaw of [raw({...sealed,digest:'0'.repeat(64)}),raw(sealBalanceFixtureV3({...f.balance,policyRevision:id(9)})),
  raw(sealBalanceFixtureV3({...f.balance,maxComponents:6} as unknown as typeof f.balance))])assert.equal((await adapter({...f.authority,balancePolicySnapshotRaw}).validate(f.operation,f.snapshotRaw)).status,'BLOCKED');
});
test('distribution needs both complete meal bounds and distribution bounds in exact slot order',async()=>{
 const f=await fixture();for(const change of ['missing','swap','date','revision','type'] as const){
  const d=copy(f.distribution);if(change==='missing')d.days[0].nutritionBounds.pop();
  if(change==='swap')d.days[0].distributionBounds.reverse();if(change==='date')d.days[0].date='2026-11-09';
  if(change==='revision')d.policyRevision=id(9);if(change==='type')d.days[0].requiredSlots[0].mealType='snack';
  assert.equal((await adapter({...f.authority,distributionPolicyRaw:raw(d)}).validate(f.operation,f.snapshotRaw)).status,'BLOCKED');
 }
});
test('exact lower meal bound rejects a value that rounding to three places would falsely accept',async()=>{
 const f=await fixture(),d=copy(f.distribution);const b=d.days[0].nutritionBounds[0].bounds;
 b.minimum.calories=b.target.calories='126.289';
 const r=await adapter({...f.authority,distributionPolicyRaw:raw(d)}).validate(f.operation,f.snapshotRaw);
 assert.equal(r.status,'NUMERIC_LIMITS_REJECTED');
 const v=r.violations.find(v=>v.check==='MEAL_NUTRITION'&&v.axis==='calories');assert.ok(v);assert.equal(v.code,'BELOW_MINIMUM');
 assert.deepEqual(v.actual,{numerator:'378866123',denominator:'3000000'});assert.deepEqual(v.minimum,{numerator:'126289',denominator:'1000'});
});
test('meal-distribution bounds are independently enforced with exact fractions',async()=>{
 const f=await fixture(),d=copy(f.distribution);d.days[0].distributionBounds[0].bounds.maximum.protein='4.498';
 const r=await adapter({...f.authority,distributionPolicyRaw:raw(d)}).validate(f.operation,f.snapshotRaw);
 assert.equal(r.status,'NUMERIC_LIMITS_REJECTED');assert.ok(r.violations.some(v=>v.check==='MEAL_DISTRIBUTION'&&v.axis==='protein'&&v.code==='ABOVE_MAXIMUM'));
});
test('daily goal min/max checks exact values and weekly goal bounds scale by seven',async()=>{
 const f=await fixture(),a=copy(f.authority),goal={...f.goal,calories:{min:'505.155',target:'600.000',max:'1000.000'}};
 await refreshInputFixtureV3(a,{...f.input,goalNutritionTarget:goal});const r=await adapter(a).validate(f.operation,f.snapshotRaw);
 assert.equal(r.status,'NUMERIC_LIMITS_REJECTED');
 assert.equal(r.violations.filter(v=>v.check==='DAY_GOAL'&&v.axis==='calories').length,7);
 const w=r.violations.find(v=>v.check==='WEEK_GOAL'&&v.axis==='calories');assert.ok(w);assert.deepEqual(w.minimum,{numerator:'707217',denominator:'200'});
});
test('optional null goal axes stay unspecified; supplying a fiber limit enforces it',async()=>{
 const f=await fixture(),a=copy(f.authority),goal={...f.goal,fiber:{min:'0.000',target:'1.000',max:'2.000'}};
 await refreshInputFixtureV3(a,{...f.input,goalNutritionTarget:goal});const r=await adapter(a).validate(f.operation,f.snapshotRaw);
 assert.equal(r.status,'NUMERIC_LIMITS_REJECTED');assert.deepEqual(r.checkedGoalAxes,['calories','fiber']);
 assert.equal(r.violations.filter(v=>v.check==='DAY_GOAL'&&v.axis==='fiber').length,7);
});
test('exact endpoint equality remains inclusive for existing goal and meal bounds',async()=>{
 const f=await fixture({whole:true}),a=copy(f.authority),goal={...f.goal,fat:{min:'23.560',target:'23.560',max:'23.560'}};
 await refreshInputFixtureV3(a,{...f.input,goalNutritionTarget:goal});const d=copy(f.distribution);
 for(const day of d.days)for(const list of [day.nutritionBounds,day.distributionBounds])for(const e of list)e.bounds.minimum.fat=e.bounds.target.fat=e.bounds.maximum.fat='5.890';
 a.distributionPolicyRaw=raw(d);const r=await adapter(a).validate(f.operation,f.snapshotRaw);assert.equal(r.status,'NUMERIC_CHECKS_PASSED_PENDING_VALIDATION');
});
test('existing five-component balance cap is enforced without changing preparation limits',async()=>{
 const f=await fixture({manyComponents:true}),r=await adapter(f.authority).validate(f.operation,f.snapshotRaw);
 assert.equal(r.status,'NUMERIC_LIMITS_REJECTED');assert.ok(r.violations.some(v=>v.check==='COMPONENT_COUNT'&&v.actual.numerator==='6'&&v.maximum.numerator==='5'));
});
test('tampered snapshot totals cannot pass even when the fake output digest and raw binding are recomputed',async()=>{
 const f=await fixture(),p=JSON.parse(f.snapshotRaw);p.nutrition.values.calories={numerator:'1',denominator:'1'};const{digest,...payload}=p;void digest;
 p.digest=sha(canonicalJsonV1({domain:'potok-exact-week-input-nutrition-snapshot-sha256-v3',payload}));const snapshotRaw=raw(p);
 const r=await adapter({...f.authority,snapshotDigest:p.digest,evaluatedSnapshotRawSha256:sha(snapshotRaw)}).validate(f.operation,snapshotRaw);assert.equal(r.status,'BLOCKED');
});
test('invalidated ingredient and missing source contexts block numeric evaluation',async()=>{
 const f=await fixture(),invalid=await f.salt.invalidate();const a=copy(f.authority);
 a.recipeInputs=[{...a.recipeInputs[0],contexts:a.recipeInputs[0].contexts.map(c=>c.rowId==='salt'?{...c,kind:'NONFOOD_V1' as const,snapshot:{...f.salt.snapshot,relevantOperations:[...f.salt.snapshot.relevantOperations,invalid]}}:c)}];
 assert.equal((await adapter(a).validate(f.operation,f.snapshotRaw)).status,'BLOCKED');
 assert.equal((await adapter({...f.authority,recipeInputs:[]}).validate(f.operation,f.snapshotRaw)).status,'BLOCKED');
});
test('event-time authorization is independent from the policy source package and checked on every attempt',async()=>{
 const f=await fixture();let loads=0,calls=0;const gate=create({loadForProposalRaw:async()=>{loads++;return raw(f.authority);}},{isAuthorizedEvent:async()=>{calls++;return false;}});
 assert.equal((await gate.validate(f.operation,f.snapshotRaw)).status,'BLOCKED');assert.equal((await gate.validate(f.operation,f.snapshotRaw)).status,'BLOCKED');assert.equal(loads,2);assert.equal(calls,2);
});
test('source strings are parser owned; mutation of the source object after return cannot rewrite loaded limits',async()=>{
 const f=await fixture();const gate=create({loadForProposalRaw:async()=>{const result=raw(f.authority);f.authority.currentGoalTargetRaw='null';return result;}},authorized);
 assert.equal((await gate.validate(f.operation,f.snapshotRaw)).status,'NUMERIC_CHECKS_PASSED_PENDING_VALIDATION');
});
test('source/proposal duplicates, negative zero, depth and byte budgets reject',async()=>{
 const f=await fixture();assert.equal((await adapter(raw(f.authority).replace('{','{"contract":"duplicate",')).validate(f.operation,f.snapshotRaw)).status,'BLOCKED');
 assert.equal((await adapter(' '.repeat(8_388_609)).validate(f.operation,f.snapshotRaw)).status,'BLOCKED');
 assert.equal((await adapter('['.repeat(25)+'0'+']'.repeat(25)).validate(f.operation,f.snapshotRaw)).status,'BLOCKED');
 const d=raw(f.distribution).replace('"sortOrder":0','"sortOrder":-0');assert.equal((await adapter({...f.authority,distributionPolicyRaw:d}).validate(f.operation,f.snapshotRaw)).status,'BLOCKED');
});
test('result hashes bind raw source/proposal and remaining gates; no legacy ACCEPTED shape is produced',async()=>{
 const f=await fixture(),r=await adapter(f.authority).validate(f.operation,f.snapshotRaw);if(r.status==='BLOCKED')throw Error();const{digest,...payload}=r;
 assert.equal(digest,sha(canonicalJsonV1({domain:'potok-exact-week-numeric-validation-result-sha256-v3',payload},'SAFE_INTEGER')));
 assert.equal(r.authorityPackageRawSha256,sha(raw(f.authority)));assert.equal(r.balancePolicyDigest,JSON.parse(f.authority.balancePolicySnapshotRaw).digest);
 const legacy=await fullFixture();const old=createGenerationValidationAdapterV1({loadForProposalRaw:async()=>raw({contract:generationValidationAuthorityContractV1,
  requestOperationId:legacy.context.input.operation.requestId,accountId:legacy.context.input.accountId,generationInputDigest:legacy.evidence.generationInputDigest,
  evaluatedPlanRawSha256:sha(f.snapshotRaw),trustedContextRaw:legacy.contextRaw,pinnedPoliciesRaw:legacy.policiesRaw,pinnedWarningEvidenceRaw:legacy.warningRaw})});
 const result=await old.validate(legacy.context.input.operation.requestId,f.snapshotRaw);assert.notEqual(result.status,'ACCEPTED');
});

test('exact upper bound also rejects a value that three-place rounding down would hide',async()=>{
 const f=await fixture({whole:true}),d=copy(f.distribution);d.days[0].nutritionBounds[0].bounds.maximum.calories='378.866';
 const r=await adapter({...f.authority,distributionPolicyRaw:raw(d)}).validate(f.operation,f.snapshotRaw);
 assert.equal(r.status,'NUMERIC_LIMITS_REJECTED');const v=r.violations.find(v=>v.check==='MEAL_NUTRITION'&&v.axis==='calories');
 assert.ok(v);assert.equal(v.code,'ABOVE_MAXIMUM');assert.deepEqual(v.actual,{numerator:'378866123',denominator:'1000000'});
});
