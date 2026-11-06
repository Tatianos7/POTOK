import assert from 'node:assert/strict';
import test from 'node:test';
import { exactFoodFixtureV2, raw, id, copy, sha } from './exactFoodNutritionFixturesV2';
import { exactNutritionInputDigestV2, captureExactNutritionInputV2 } from '../../utils/exactNutritionValuesV2';
import { canonicalJsonV1 } from '../../utils/adaptiveNutritionWireV1';
import {
  exactRecipeNutritionRequestContractV2, exactRecipeNutritionEncodingV2,
  exactRecipeNutritionRequestDigestRawV2 as pin, decodeExactRecipeNutritionRequestRawV2 as decodeRequest,
  calculateExactRecipeNutritionRawV2 as calculate, decodeExactRecipeNutritionSnapshotRawV2 as decode,
} from '../../utils/exactRecipeNutritionV2';
import { prepareExactRecipeNutritionRawV2 as prepare } from '../exactRecipeNutritionPreparationV2';
const q = (numerator: string, denominator = '1') => ({numerator,denominator});
const authority = { isAuthorizedEvent: async () => true };
async function fixture() {
  const f = await exactFoodFixtureV2();
  const row = { rowId:'ingredient-1',inputKind:'FOOD' as const,foodId:f.canonical.foodId,foodState:f.canonical.foodState,
    basis:f.input.reference.basis,weightG:q('100'),nutritionRevisionId:f.revision.revisionId,nutritionDigest:f.revision.digest,
    sourceProposalDigest:f.proposal.digest,numericInputDigest:await exactNutritionInputDigestV2(f.input) };
  const request = {contract:exactRecipeNutritionRequestContractV2,encoding:exactRecipeNutritionEncodingV2,
    authoringRecipeId:'synthetic-recipe',authoringRevision:'synthetic-authoring-v1',declaredServings:q('3'),components:[row]};
  const inputs=[{rowId:row.rowId,input:f.input}], rows=[{rowId:row.rowId,snapshot:f.snapshot}];
  const requestPin = await pin(raw(request));
  return {...f,request,inputs,rows,requestPin};
}
test('verified food inputs produce exact whole and thirds, no authority or cooked-yield claim', async () => {
  const f = await fixture(), result=await prepare(raw(f.request),f.requestPin,f.rows,authority);
  assert.equal(result.kind,'PREPARED_EXACT_FOOD_INPUTS_V2');
  if(result.kind!=='PREPARED_EXACT_FOOD_INPUTS_V2')throw Error('expected preparation');
  const p=result.snapshot;
  assert.equal(p.authority,'NONE');assert.equal(p.cookedYieldGrams,null);assert.deepEqual(p.whole.values,f.input.values);
  assert.deepEqual(p.perDeclaredServing?.values.calories,q('378866123','3000000'));
  assert.deepEqual(p.inputMassGrams,q('100'));assert.equal(p.calculationBasis,'INPUT_COMPONENTS_NO_COOKING_RETENTION_CLAIM');
  assert.deepEqual(await decode(raw(p),f.requestPin),p);assert.ok(Object.isFrozen(p.components[0].contribution.values));
});
test('unknown servings stay null; whole input values remain available',async()=>{
  const f=await fixture(), request={...f.request,declaredServings:null};
  const p=await calculate(raw(request),raw(f.inputs),await pin(raw(request)));
  assert.equal(p.perDeclaredServing,null);assert.deepEqual(p.whole.values,f.input.values);assert.equal(p.cookedYieldGrams,null);
});
test('distinct ingredient rows for the same food are retained and summed without merging',async()=>{
  const f=await fixture(), second={...f.request.components[0],rowId:'ingredient-2',weightG:q('50')};
  const request={...f.request,components:[...f.request.components,second]};
  const inputs=[{...f.inputs[0],rowId:second.rowId},...f.inputs];
  const p=await calculate(raw(request),raw(inputs),await pin(raw(request)));
  assert.deepEqual(p.components.map(r=>r.rowId),['ingredient-1','ingredient-2']);assert.deepEqual(p.inputMassGrams,q('150'));
  assert.deepEqual(p.whole.values.calories,q('1136598369','2000000'));
});
test('fractional grams and servings keep nonterminating values as rationals',async()=>{
  const f=await fixture(),request={...f.request,declaredServings:q('1','3'),components:[{...f.request.components[0],weightG:q('1','3')}]};
  const p=await calculate(raw(request),raw(f.inputs),await pin(raw(request)));
  assert.deepEqual(p.inputMassGrams,q('1','3'));assert.deepEqual(p.whole.values.calories,q('378866123','300000000'));
  assert.deepEqual(p.perDeclaredServing?.values.calories,q('378866123','100000000'));
});
test('canonical snapshot digest independently agrees with node SHA and has a separate domain',async()=>{
  const f=await fixture(),p=await calculate(raw(f.request),raw(f.inputs),f.requestPin),{digest,...payload}=p;
  assert.equal(digest,sha(canonicalJsonV1({domain:'potok-exact-recipe-input-nutrition-snapshot-sha256-v2',payload})));
  assert.notEqual(digest,f.requestPin);
});
test('changed recipe, revision, grams, servings, order and missing rows cannot bypass original pin',async()=>{
  const f=await fixture();
  for(const request of [{...f.request,authoringRecipeId:'other'},{...f.request,authoringRevision:'other'},
    {...f.request,declaredServings:q('4')},{...f.request,components:[{...f.request.components[0],weightG:q('99')}]},
    {...f.request,components:[{...f.request.components[0],rowId:'other'}]}]){
    await assert.rejects(calculate(raw(request),raw(f.inputs),f.requestPin),/REQUEST_PIN/);
  }
});
test('claimed component/whole/portion totals, mass, digest and approval promotions are recomputed',async()=>{
  const f=await fixture(),p=await calculate(raw(f.request),raw(f.inputs),f.requestPin);
  for(const patch of [{whole:{...p.whole,values:{...p.whole.values,calories:q('1')}}},{perDeclaredServing:null},{inputMassGrams:q('1')},
    {cookedYieldGrams:q('100')},{authority:'OWNER'},{digest:'0'.repeat(64)},{requestDigest:'0'.repeat(64)}]){
    await assert.rejects(decode(raw({...p,...patch}),f.requestPin),/SNAPSHOT_RECOMPUTATION/);
  }
  const changed=copy(p) as unknown as {components:{contribution:{values:{calories:unknown}}}[]};
  changed.components[0].contribution.values.calories=q('0');await assert.rejects(decode(raw(changed),f.requestPin),/SNAPSHOT_RECOMPUTATION/);
});
test('missing, extra, duplicate or exchanged mapped input rows reject',async()=>{
  const f=await fixture();
  for(const inputs of [[],[...f.inputs,...f.inputs],[{...f.inputs[0],rowId:'other'}],[...f.inputs,{...f.inputs[0],rowId:'extra'}]]){
    await assert.rejects(calculate(raw(f.request),raw(inputs),f.requestPin));
  }
});
test('basis mismatch and changed self-consistent nutrient vector fail independent input binding',async()=>{
  const f=await fixture(),input=captureExactNutritionInputV2(f.input.reference,{...f.input.mappedDecimalText,calories:'1'});
  await assert.rejects(calculate(raw(f.request),raw([{rowId:'ingredient-1',input}]),f.requestPin),/INPUT_BINDING/);
  const request={...f.request,components:[{...f.request.components[0],basis:'PER_100_G_EDIBLE'}]};
  await assert.rejects(calculate(raw(request),raw(f.inputs),await pin(raw(request))),/BASIS_MISMATCH/);
});
test('water volume and salt stay explicit blockers, never silently dropped or treated as zero',async()=>{
  const f=await fixture();
  for(const extra of [{rowId:'water',inputKind:'POTABLE_WATER',amount:q('100'),unit:'ml'},
    {rowId:'salt',inputKind:'SALT',amount:q('1'),unit:'g'}]){
    const request={...f.request,components:[...f.request.components,extra]},expected=await pin(raw(request));
    assert.equal(decodeRequest(raw(request)).components.length,2);
    await assert.rejects(calculate(raw(request),raw(f.inputs),expected),/NONFOOD_EVIDENCE_NOT_INTEGRATED/);
    assert.deepEqual(await prepare(raw(request),expected,f.rows,authority),{kind:'BLOCKED',reason:'NONFOOD_EVIDENCE_NOT_INTEGRATED'});
  }
});
test('unknown weight, zero/negative/noncanonical rationals, wrong units and duplicate rows reject',async()=>{
  const f=await fixture();
  for(const weightG of [null,q('0'),q('-1'),q('2','2'),q('1','0'),100])await assert.rejects(pin(raw({...f.request,components:[{...f.request.components[0],weightG}]})));
  await assert.rejects(pin(raw({...f.request,components:[...f.request.components,...f.request.components]})));
  await assert.rejects(pin(raw({...f.request,components:[{...f.request.components[0],unit:'ml'}]})));
  await assert.rejects(pin(raw({...f.request,declaredServings:q('0')})));
});
test('empty/oversized components, duplicate JSON and raw bounds fail before calculation',async()=>{
  const f=await fixture();
  await assert.rejects(pin(raw({...f.request,components:[]})));
  await assert.rejects(pin(raw({...f.request,components:Array(129).fill(f.request.components[0])})),/COMPONENT_BUDGET/);
  await assert.rejects(pin(raw(f.request).replace('{','{"authoringRecipeId":"duplicate",')));
  await assert.rejects(pin(' '.repeat(262145)),/RAW_BUDGET/);
});
test('server requires every snapshot and denies absent or false authority',async()=>{
  const f=await fixture();
  for(const rows of [[],[...f.rows,...f.rows],[{...f.rows[0],rowId:'other'}]])assert.equal((await prepare(raw(f.request),f.requestPin,rows,authority)).kind,'BLOCKED');
  assert.equal((await prepare(raw(f.request),f.requestPin,f.rows,{isAuthorizedEvent:async()=>false})).kind,'BLOCKED');
});
test('server compares requested food/state/revision/source/numeric bindings',async()=>{
  const f=await fixture();
  for(const patch of [{foodId:id(90)},{foodState:'cooked'},{nutritionRevisionId:id(90)},{nutritionDigest:'0'.repeat(64)},
    {sourceProposalDigest:'0'.repeat(64)},{numericInputDigest:'0'.repeat(64)},{basis:'PER_100_G_EDIBLE'}]){
    const request={...f.request,components:[{...f.request.components[0],...patch}]};
    assert.equal((await prepare(raw(request),await pin(raw(request)),f.rows,authority)).kind,'BLOCKED');
  }
});
test('revoked, stale or incomplete reviewed food chain blocks the entire recipe',async()=>{
  const f=await fixture(),invalid=await f.nutritionEvent('INVALIDATION');
  for(const snapshot of [{...f.snapshot,activeNutritionRevisionId:id(90)}, {...f.snapshot,relevantEventRaws:[raw(f.ca)]},
    {...f.snapshot,relevantEventRaws:[...f.snapshot.relevantEventRaws,raw(invalid)]}]){
    assert.equal((await prepare(raw(f.request),f.requestPin,[{rowId:'ingredient-1',snapshot}],authority)).kind,'BLOCKED');
  }
});
test('all later ingredient snapshots are captured before asynchronous authority runs',async()=>{
  const f=await fixture(),request={...f.request,components:[...f.request.components,{...f.request.components[0],rowId:'ingredient-2'}]};
  const later={...f.snapshot,relevantEventRaws:[...f.snapshot.relevantEventRaws]}, rows=[...f.rows,{rowId:'ingredient-2',snapshot:later}];
  const result=await prepare(raw(request),await pin(raw(request)),rows,{isAuthorizedEvent:async()=>{later.relevantEventRaws.length=0;return true;}});
  assert.equal(result.kind,'PREPARED_EXACT_FOOD_INPUTS_V2');
});

test('state is a strict string and cannot coerce arrays into an accepted food state',async()=>{
  const f=await fixture();
  for(const foodState of [['as-sold'],null,{},true])await assert.rejects(pin(raw({...f.request,components:[{...f.request.components[0],foodState}]})),/FOOD_STATE/);
});
