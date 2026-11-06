import assert from 'node:assert/strict';import test from 'node:test';
import {exactFoodFixtureV2,raw,id,copy} from './exactFoodNutritionFixturesV2';
import {typedNonFoodFixtureV1} from './typedNonFoodFixturesV1';
import {verifyNonFoodReceiptV1,nonFoodDigestV1} from '../nonFoodEvidenceV1';
import {resolveNonFoodReviewedSnapshotV1} from '../nonFoodReviewedSnapshotV1';
import {exactNutritionInputDigestV2} from '../../utils/exactNutritionValuesV2';
import {exactRecipeNutritionRequestContractV2,exactRecipeNutritionEncodingV2,calculateExactRecipeNutritionRawV2,exactRecipeNutritionRequestDigestRawV2} from '../../utils/exactRecipeNutritionV2';
import {exactTypedRecipeRequestContractV3,exactTypedRecipeEncodingV3,exactTypedRecipeRequestDigestRawV3 as pin,
  prepareExactTypedRecipeRawV3 as prepare,decodeExactTypedRecipeSnapshotRawV3 as decode,decodeExactTypedRecipeRequestRawV3,
  type ExactTypedRecipeRequestV3,type ExactTypedRecipeContextV3,type ExactTypedRecipeAuthorityV3} from '../exactTypedRecipePreparationV3';
const q=(numerator:string,denominator='1')=>({numerator,denominator});
const authority:ExactTypedRecipeAuthorityV3={isAuthorizedEvent:async()=>true};
async function fixture(){
  const f=await exactFoodFixtureV2(),water=await typedNonFoodFixtureV1(),salt=await typedNonFoodFixtureV1('SALT',2000,'salt');
  const food={rowId:'food',inputKind:'FOOD' as const,foodId:f.canonical.foodId,foodState:f.canonical.foodState,basis:f.input.reference.basis,weightG:q('100'),
    nutritionRevisionId:f.revision.revisionId,nutritionDigest:f.revision.digest,sourceProposalDigest:f.proposal.digest,numericInputDigest:await exactNutritionInputDigestV2(f.input)};
  const request:ExactTypedRecipeRequestV3={contract:exactTypedRecipeRequestContractV3,encoding:exactTypedRecipeEncodingV3,
    authoring:{contract:exactRecipeNutritionRequestContractV2,encoding:exactRecipeNutritionEncodingV2,authoringRecipeId:'synthetic',authoringRevision:'v1',declaredServings:q('3'),
      components:[food,{rowId:'water',inputKind:'POTABLE_WATER',amount:q('100'),unit:'ml'},{rowId:'salt',inputKind:'SALT',amount:q('2'),unit:'g'}]},nonFoodBindings:[water.binding,salt.binding]};
  const contexts:ExactTypedRecipeContextV3[]=[{rowId:'food',kind:'FOOD',snapshot:f.snapshot},{rowId:'water',kind:'NONFOOD_V1',snapshot:water.snapshot},{rowId:'salt',kind:'NONFOOD_V1',snapshot:salt.snapshot}];
  const requestPin=await pin(raw(request));return {f,water,salt,request,contexts,requestPin};
}
test('unchanged PR165 verifier accepts separately linked synthetic definition and nutrition receipts',async()=>{
  const f=await typedNonFoodFixtureV1();for(const op of f.snapshot.relevantOperations)await verifyNonFoodReceiptV1(op.requestRaw,op.actorId,JSON.parse(op.receiptRaw));
  assert.equal((await resolveNonFoodReviewedSnapshotV1(f.snapshot,f.binding,authority)).kind,'REVIEWED_NONFOOD_V1');
});
test('mixed food/water/salt: exact totals, thirds, known mass and unknown ml mass stay separate',async()=>{
  const f=await fixture(),r=await prepare(raw(f.request),f.requestPin,f.contexts,authority);assert.equal(r.kind,'PREPARED_EXACT_TYPED_INPUTS_V3');
  if(r.kind!=='PREPARED_EXACT_TYPED_INPUTS_V3')throw Error('expected mixed preparation');const p=r.snapshot;
  assert.deepEqual(p.whole.values,f.f.input.values);assert.deepEqual(p.knownInputMassGrams,q('102'));assert.equal(p.inputMassGrams,null);
  assert.deepEqual(p.unknownMassRowIds,['water']);assert.equal(p.components[1].massGrams,null);assert.equal(p.components[1].recordedUnit,'ml');
  assert.deepEqual(p.perDeclaredServing?.values.calories,q('378866123','3000000'));assert.equal(p.authority,'NONE');assert.equal(p.cookedYieldGrams,null);
  assert.deepEqual(await decode(raw(p),f.requestPin,f.contexts,authority),p);assert.ok(Object.isFrozen(p.components[1].sourceBinding));
});
test('water recorded in grams has known input mass without invoking density',async()=>{
  const f=await fixture(),authoring={...f.request.authoring,components:f.request.authoring.components.map(c=>c.rowId==='water'?{...c,unit:'g' as const}:c)};
  const request={...f.request,authoring},r=await prepare(raw(request),await pin(raw(request)),f.contexts,authority);
  assert.equal(r.kind,'PREPARED_EXACT_TYPED_INPUTS_V3');if(r.kind==='PREPARED_EXACT_TYPED_INPUTS_V3'){assert.deepEqual(r.snapshot.inputMassGrams,q('202'));assert.deepEqual(r.snapshot.unknownMassRowIds,[]);}
});
test('nonfood-only recipe retains verified zeros without fake food IDs; servings may remain unknown',async()=>{
  const f=await fixture(),request={...f.request,authoring:{...f.request.authoring,declaredServings:null,components:f.request.authoring.components.filter(c=>c.inputKind!=='FOOD')}};
  const r=await prepare(raw(request),await pin(raw(request)),f.contexts.filter(c=>c.kind==='NONFOOD_V1'),authority);
  assert.equal(r.kind,'PREPARED_EXACT_TYPED_INPUTS_V3');if(r.kind==='PREPARED_EXACT_TYPED_INPUTS_V3'){assert.equal(r.snapshot.perDeclaredServing,null);for(const v of Object.values(r.snapshot.whole.values))assert.deepEqual(v,q('0'));}
});
test('no V2 widening: same typed authoring stays blocked in the old FOOD-only calculator',async()=>{
  const f=await fixture();await assert.rejects(calculateExactRecipeNutritionRawV2(raw(f.request.authoring),'[]',await exactRecipeNutritionRequestDigestRawV2(raw(f.request.authoring))),/NONFOOD_EVIDENCE_NOT_INTEGRATED/);
});
test('missing, extra, duplicate and foreign typed definition bindings reject before preparation',async()=>{
  const f=await fixture();for(const nonFoodBindings of [[],[f.water.binding], [...f.request.nonFoodBindings,f.water.binding],
    [f.water.binding,{...f.salt.binding,rowId:'foreign'}]])await assert.rejects(pin(raw({...f.request,nonFoodBindings})));
});
test('all independent request fields including typed identities, grams, volume and kind are pinned',async()=>{
  const f=await fixture();for(const request of [{...f.request,nonFoodBindings:f.request.nonFoodBindings.map(b=>({...b,stableKey:'other'}))},
    {...f.request,authoring:{...f.request.authoring,components:f.request.authoring.components.map(c=>c.rowId==='water'?{...c,amount:q('99')}:c)}}]){
    assert.deepEqual(await prepare(raw(request),f.requestPin,f.contexts,authority),{kind:'BLOCKED',reason:'REQUEST_INVALID_OR_CHANGED'});
  }
});
test('changed source definition/stable key/state/head bindings cannot use a valid receipt for another class',async()=>{
  const f=await fixture();for(const patch of [{definitionId:id(90)},{stableKey:'other'},{foodState:'raw' as const},{definitionRevisionId:id(90)},
    {definitionDigest:'0'.repeat(64)},{nutritionRevisionId:id(90)},{nutritionDigest:'0'.repeat(64)}]){
    const request={...f.request,nonFoodBindings:[{...f.water.binding,...patch},f.salt.binding]};assert.equal((await prepare(raw(request),await pin(raw(request)),f.contexts,authority)).kind,'BLOCKED');
  }
});
test('source bytes tampering and actor/receipt substitution fail despite zero claims',async()=>{
  const f=await typedNonFoodFixtureV1();const op=f.snapshot.nutritionApproval;
  const r=JSON.parse(op.receiptRaw);r.revision.retainedSource.text+='forged';
  for(const nutritionApproval of [{...op,receiptRaw:raw(r)},{...op,actorId:id(90)},{...op,receiptRaw:f.snapshot.definitionApproval.receiptRaw}]){
    assert.equal((await resolveNonFoodReviewedSnapshotV1({...f.snapshot,nutritionApproval},f.binding,authority)).kind,'UNRESOLVED');
  }
});
test('definition and nutrition need independently authorized events; V1-only Food verifier cannot authorize Nonfood',async()=>{
  const f=await fixture();for(const deny of [f.water.definition.event.eventId,f.water.nutrition.event.eventId,f.salt.nutrition.event.eventId]){
    assert.equal((await prepare(raw(f.request),f.requestPin,f.contexts,{isAuthorizedEvent:async e=>e.eventId!==deny})).kind,'BLOCKED');
  }
  assert.equal((await prepare(raw(f.request),f.requestPin,f.contexts,{isAuthorizedEvent:async e=>e.contract!=='potok-nonfood-review-event-v1'})).kind,'BLOCKED');
});
test('false/truthy/throwing Nonfood authority and failures during history validation fail closed',async()=>{
  const f=await typedNonFoodFixtureV1();for(const value of [false,1,'ADMIN',undefined]){
    assert.equal((await resolveNonFoodReviewedSnapshotV1(f.snapshot,f.binding,{isAuthorizedEvent:async()=>value} as unknown as ExactTypedRecipeAuthorityV3)).kind,'UNRESOLVED');
  }
  let n=0;assert.equal((await resolveNonFoodReviewedSnapshotV1(f.snapshot,f.binding,{isAuthorizedEvent:async()=>++n<3})).kind,'UNRESOLVED');
  assert.equal((await resolveNonFoodReviewedSnapshotV1(f.snapshot,f.binding,{isAuthorizedEvent:async()=>{throw Error();}})).kind,'UNRESOLVED');
});
test('complete matching history is required; missing/duplicate/extra receipts and sparse history reject',async()=>{
  const f=await typedNonFoodFixtureV1();for(const relevantOperations of [[],[f.snapshot.definitionApproval],[f.snapshot.nutritionApproval],
    [...f.snapshot.relevantOperations,f.snapshot.nutritionApproval],new Array(2),Array(129).fill(f.snapshot.nutritionApproval)]){
    assert.equal((await resolveNonFoodReviewedSnapshotV1({...f.snapshot,relevantOperations},f.binding,authority)).kind,'UNRESOLVED');
  }
});
test('either definition or nutrition invalidation blocks regardless of order, earlier date or severity',async()=>{
  const f=await typedNonFoodFixtureV1();for(const kind of ['DEFINITION','NUTRITION'] as const)for(const severity of ['CORRECTION','SAFETY_CRITICAL'] as const){
    const invalid=await f.invalidate(kind,severity);await verifyNonFoodReceiptV1(invalid.requestRaw,invalid.actorId,JSON.parse(invalid.receiptRaw));
    for(const relevantOperations of [[invalid,...f.snapshot.relevantOperations],[...f.snapshot.relevantOperations,invalid]]){
      assert.equal((await resolveNonFoodReviewedSnapshotV1({...f.snapshot,relevantOperations},f.binding,authority)).kind,'UNRESOLVED');
    }
  }
});
test('any revoked nonfood ingredient blocks entire mixed recipe; no partial total emitted',async()=>{
  const f=await fixture(),invalid=await f.salt.invalidate();const contexts=f.contexts.map(c=>c.rowId==='salt'?{...c,kind:'NONFOOD_V1' as const,snapshot:{...f.salt.snapshot,relevantOperations:[...f.salt.snapshot.relevantOperations,invalid]}}:c);
  const r=await prepare(raw(f.request),f.requestPin,contexts,authority);assert.equal(r.kind,'BLOCKED');assert.equal('snapshot'in r,false);
});
test('same event ID with changed independently valid authority payload cannot replace approval history',async()=>{
  const f=await typedNonFoodFixtureV1(),r=JSON.parse(f.snapshot.nutritionApproval.receiptRaw),{digest,...payload}=r.event;void digest;
  payload.authorityReference='potok-control-admin-attestation-v2:'+id(99);r.event={...payload,digest:await nonFoodDigestV1('potok-nonfood-event-sha256-v1',payload)};
  const changed={...f.snapshot.nutritionApproval,receiptRaw:raw(r)};await verifyNonFoodReceiptV1(changed.requestRaw,changed.actorId,r);
  assert.equal((await resolveNonFoodReviewedSnapshotV1({...f.snapshot,relevantOperations:[f.snapshot.definitionApproval,changed]},f.binding,authority)).kind,'UNRESOLVED');
});
test('positive nutrient values cannot bypass the unchanged non-nutritive V1 namespace',async()=>{
  const f=await typedNonFoodFixtureV1(),request=copy(f.nutritionRequest);
  if(request.proposal.kind!=='NUTRITION')throw Error();request.proposal.sourceValues.calories=request.proposal.nutrition.calories='1.000';
  const op={...f.snapshot.nutritionApproval,requestRaw:raw(request)};
  assert.equal((await resolveNonFoodReviewedSnapshotV1({...f.snapshot,nutritionApproval:op},f.binding,authority)).kind,'UNRESOLVED');
});
test('all context snapshots are owned before async authorization; later row mutation cannot mix generations',async()=>{
  const f=await fixture(),later={...f.salt.snapshot,relevantOperations:[...f.salt.snapshot.relevantOperations]};
  const contexts=f.contexts.map(c=>c.rowId==='salt'?{...c,kind:'NONFOOD_V1' as const,snapshot:later}:c);
  assert.equal((await prepare(raw(f.request),f.requestPin,contexts,{isAuthorizedEvent:async()=>{later.relevantOperations.length=0;return true;}})).kind,'PREPARED_EXACT_TYPED_INPUTS_V3');
});
test('snapshot changes to totals/mass/authority and loss of current evidence reject on readback',async()=>{
  const f=await fixture(),r=await prepare(raw(f.request),f.requestPin,f.contexts,authority);if(r.kind!=='PREPARED_EXACT_TYPED_INPUTS_V3')throw Error();
  for(const patch of [{inputMassGrams:q('202')},{knownInputMassGrams:q('202')},{unknownMassRowIds:[]},{authority:'OWNER'},{digest:'0'.repeat(64)}]){
    await assert.rejects(decode(raw({...r.snapshot,...patch}),f.requestPin,f.contexts,authority));
  }
  await assert.rejects(decode(raw(r.snapshot),f.requestPin,f.contexts,{isAuthorizedEvent:async()=>false}));
});
test('raw duplicates, invalid state coercion and source negative zero reject',async()=>{
  const f=await fixture();assert.throws(()=>decodeExactTypedRecipeRequestRawV3(raw(f.request).replace('{','{"contract":"duplicate",')));
  await assert.rejects(pin(raw({...f.request,nonFoodBindings:f.request.nonFoodBindings.map(b=>({...b,foodState:['as-sold']}))})));
  const op=f.water.snapshot.nutritionApproval,receiptRaw=op.receiptRaw.replace(/"byteLength":\d+/,'"byteLength":-0');
  assert.equal((await resolveNonFoodReviewedSnapshotV1({...f.water.snapshot,nutritionApproval:{...op,receiptRaw}},f.water.binding,authority)).kind,'UNRESOLVED');
});

test('a Food-only typed authorization port cannot silently satisfy the mixed event union',()=>{
  const foodOnly:import('../exactFoodNutritionReviewedAdapterV2').ExactFoodNutritionReviewAuthorityV2={isAuthorizedEvent:async()=>true};
  // @ts-expect-error The issuer verifier must explicitly support legacy Nonfood events.
  const invalid:ExactTypedRecipeAuthorityV3=foodOnly;void invalid;
});
