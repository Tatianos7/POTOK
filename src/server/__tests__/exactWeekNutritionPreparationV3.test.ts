import assert from 'node:assert/strict';import test from 'node:test';
import {raw,id,copy,sha} from './exactFoodNutritionFixturesV2';
import {exactWeekFixtureV3 as fixture,q,authorized} from './exactWeekNutritionFixturesV3';
import {prepareExactTypedRecipeRawV3,exactTypedRecipeRequestDigestRawV3} from '../exactTypedRecipePreparationV3';
import {canonicalJsonV1} from '../../utils/adaptiveNutritionWireV1';
import {exactWeekNutritionRequestDigestRawV3 as pin,prepareExactWeekNutritionRawV3 as prepare,decodeExactWeekNutritionSnapshotRawV3 as decode,
 type ExactWeekNutritionRequestV3} from '../exactWeekNutritionPreparationV3';

test('28 meals produce exact portions, day/week totals, ingredient amounts and zero FACT',async()=>{
 const f=await fixture(),r=await prepare(raw(f.request),f.requestPin,f.recipeInputs,authorized);assert.equal(r.kind,'PREPARED_EXACT_WEEK_INPUTS_V3');
 if(r.kind!=='PREPARED_EXACT_WEEK_INPUTS_V3')throw Error('expected week');const p=r.snapshot,meal=p.days[0].meals[0],portion=meal.components[0];
 assert.equal(p.days.length,7);assert.equal(p.days.flatMap(d=>d.meals).length,28);assert.deepEqual(p.nutrition.values.calories,q('2652062861','750000'));
 assert.deepEqual(p.days[0].nutrition.values.calories,q('378866123','750000'));assert.deepEqual(meal.nutrition.values.calories,q('378866123','3000000'));
 assert.deepEqual(portion.wholeRecipeMultiplier,q('1','3'));assert.deepEqual(portion.ingredients.map(i=>i.amount),[q('100','3'),q('100','3'),q('2','3')]);
 assert.equal(portion.ingredients[1].unit,'ml');assert.equal(portion.ingredients[1].massGrams,null);assert.deepEqual(p.inputMass.knownGrams,q('952'));
 assert.equal(p.inputMass.totalGrams,null);assert.equal(p.inputMass.unknownItems.length,28);assert.equal(new Set(p.inputMass.unknownItems.map(i=>i.slotId)).size,28);
 assert.equal(p.authority,'NONE');assert.deepEqual(p.facts,[]);assert.equal(p.purpose,'CONDITIONAL_PLAN_INPUT_ARITHMETIC');assert.ok(Object.isFrozen(portion.ingredients[0].nutrition.values));
 assert.deepEqual(await decode(raw(p),f.requestPin,f.recipeInputs,authorized),p);
});
test('explicit fraction and equivalent declared servings produce identical component projections',async()=>{
 const f=await fixture(),request={...f.request,days:f.request.days.map(d=>({...d,meals:d.meals.map(m=>({...m,components:m.components.map(c=>({...c,portion:{kind:'FRACTION_OF_WHOLE' as const,amount:q('1','3')}}))}))}))};
 const a=await prepare(raw(f.request),f.requestPin,f.recipeInputs,authorized),b=await prepare(raw(request),await pin(raw(request)),f.recipeInputs,authorized);
 assert.equal(a.kind,'PREPARED_EXACT_WEEK_INPUTS_V3');assert.equal(b.kind,'PREPARED_EXACT_WEEK_INPUTS_V3');
 if(a.kind==='PREPARED_EXACT_WEEK_INPUTS_V3'&&b.kind==='PREPARED_EXACT_WEEK_INPUTS_V3'){assert.deepEqual(a.snapshot.days,b.snapshot.days);assert.notEqual(a.snapshot.digest,b.snapshot.digest);}
});
test('unknown declared servings block serving mode but allow an explicit whole-recipe fraction',async()=>{
 const a=await fixture({declaredServingsNull:true});assert.deepEqual(await prepare(raw(a.request),a.requestPin,a.recipeInputs,authorized),{kind:'BLOCKED',reason:'PORTION_UNAVAILABLE'});
 const b=await fixture({declaredServingsNull:true,fraction:true});assert.equal((await prepare(raw(b.request),b.requestPin,b.recipeInputs,authorized)).kind,'PREPARED_EXACT_WEEK_INPUTS_V3');
});
test('multiple recipe components aggregate without losing their ingredient or source identities',async()=>{
 const f=await fixture({twoRecipes:true});const request={...f.request,days:f.request.days.map(d=>({...d,meals:d.meals.map(m=>({...m,components:[
  {componentKey:'first',recipeKey:'a',portion:{kind:'FRACTION_OF_WHOLE' as const,amount:q('1','2')}},
  {componentKey:'second',recipeKey:'b',portion:{kind:'DECLARED_SERVINGS' as const,amount:q('1')}}]}))}))};
 const r=await prepare(raw(request),await pin(raw(request)),f.recipeInputs,authorized);assert.equal(r.kind,'PREPARED_EXACT_WEEK_INPUTS_V3');
 if(r.kind==='PREPARED_EXACT_WEEK_INPUTS_V3'){assert.equal(r.snapshot.sourceRecipes.length,2);assert.equal(r.snapshot.days[0].meals[0].components.length,2);assert.equal(r.snapshot.inputMass.unknownItems.length,56);}
});
test('each source is revalidated once per invocation, not once per repeated meal or across requests',async()=>{
 const f=await fixture();let calls=0;const authority={isAuthorizedEvent:async()=>{calls++;return true;}};
 assert.equal((await prepare(raw(f.request),f.requestPin,f.recipeInputs,authority)).kind,'PREPARED_EXACT_WEEK_INPUTS_V3');assert.equal(calls,12);
 assert.equal((await prepare(raw(f.request),f.requestPin,f.recipeInputs,authority)).kind,'PREPARED_EXACT_WEEK_INPUTS_V3');assert.equal(calls,24);
});
test('account, selection, timezone, week, slot and portion changes cannot bypass the independent pin',async()=>{
 const f=await fixture();const changed=copy(f.request) as unknown as {days:{meals:{components:{portion:{amount:unknown}}[];slotId:string}[]}[]};changed.days[0].meals[0].components[0].portion.amount=q('2');
 for(const request of [{...f.request,accountId:id(90)},{...f.request,selectionId:id(90)},{...f.request,timezone:'UTC'},changed]){
  assert.deepEqual(await prepare(raw(request),f.requestPin,f.recipeInputs,authorized),{kind:'BLOCKED',reason:'REQUEST_INVALID_OR_CHANGED'});
 }
});
test('invalid calendar dates, non-Monday anchors and missing/duplicate/out-of-week days reject',async()=>{
 const f=await fixture();for(const request of [{...f.request,weekStartLocal:'2026-11-03'},{...f.request,weekStartLocal:'2026-02-30'},
  {...f.request,days:f.request.days.slice(1)},{...f.request,days:[f.request.days[0],...f.request.days.slice(0,6)]},
  {...f.request,days:f.request.days.map((d,i)=>i===6?{...d,date:'2026-11-09'}:d)},{...f.request,timezone:'not/a/timezone'}])await assert.rejects(pin(raw(request)));
});
test('civil-date calculations preserve seven local days across both DST transitions',async()=>{
 for(const weekStart of ['2026-03-02','2026-10-26']){
  const f=await fixture({weekStart,timezone:'America/New_York'}),r=await prepare(raw(f.request),f.requestPin,f.recipeInputs,authorized);
  assert.equal(r.kind,'PREPARED_EXACT_WEEK_INPUTS_V3');if(r.kind==='PREPARED_EXACT_WEEK_INPUTS_V3')assert.deepEqual(r.snapshot.days.map(d=>d.date),f.request.days.map(d=>d.date));
 }
});
test('empty meals/components, duplicate slot IDs or component keys and unknown meal types reject',async()=>{
 const f=await fixture();const patch=(meals:unknown)=>({...f.request,days:[{...f.request.days[0],meals},...f.request.days.slice(1)]});
 const meal=f.request.days[0].meals[0];
 for(const request of [patch([]),patch([{...meal,components:[]}]),patch([meal,meal]),patch([{...meal,components:[...meal.components,...meal.components]}]),patch([{...meal,mealType:'brunch'}])])await assert.rejects(pin(raw(request)));
});
test('zero, negative, unreduced and unknown portion forms fail closed',async()=>{
 const f=await fixture();for(const portion of [{kind:'DECLARED_SERVINGS',amount:q('0')},{kind:'FRACTION_OF_WHOLE',amount:q('-1')},
  {kind:'FRACTION_OF_WHOLE',amount:q('2','2')},{kind:'GRAMS',amount:q('100')},{kind:'DECLARED_SERVINGS',amount:null}]){
  const request={...f.request,days:f.request.days.map((d,i)=>i?d:{...d,meals:d.meals.map((m,j)=>j?m:{...m,components:[{...m.components[0],portion}]})})};await assert.rejects(pin(raw(request)));
 }
});
test('missing/extra/duplicate source refs or contexts and dangling recipe keys are never ignored',async()=>{
 const f=await fixture();for(const recipes of [[],[...f.request.recipes,...f.request.recipes],[...f.request.recipes,{recipeKey:'unused',requestDigest:'1'.repeat(64),snapshotDigest:'2'.repeat(64)}]])await assert.rejects(pin(raw({...f.request,recipes})));
 for(const inputs of [[],[...f.recipeInputs,...f.recipeInputs],[{...f.recipeInputs[0],recipeKey:'foreign'}],new Array(1)]){
  assert.equal((await prepare(raw(f.request),f.requestPin,inputs,authorized)).kind,'BLOCKED');
 }
});
test('valid self-consistent replacement recipe content cannot replace pinned source request or snapshot',async()=>{
 const f=await fixture();for(const request of [{...f.request,recipes:[{...f.request.recipes[0],requestDigest:'0'.repeat(64)}]},
  {...f.request,recipes:[{...f.request.recipes[0],snapshotDigest:'0'.repeat(64)}]}]){
  assert.deepEqual(await prepare(raw(request),await pin(raw(request)),f.recipeInputs,authorized),{kind:'BLOCKED',reason:'RECIPE_EVIDENCE_UNAVAILABLE_OR_MISMATCHED'});
 }
 const request=JSON.parse(f.recipeInputs[0].requestRaw);request.authoring.authoringRecipeId='replacement';
 assert.equal((await prepare(raw(f.request),f.requestPin,[{...f.recipeInputs[0],requestRaw:raw(request)}],authorized)).kind,'BLOCKED');
});
test('stale or invalidated Food or Nonfood blocks the entire week without partial output',async()=>{
 const f=await fixture(),invalid=await f.salt.invalidate();
 for(const contexts of [f.recipeInputs[0].contexts.map(c=>c.kind==='FOOD'?{...c,snapshot:{...c.snapshot,activeNutritionRevisionId:id(90)}}:c),
  f.recipeInputs[0].contexts.map(c=>c.rowId==='salt'?{...c,kind:'NONFOOD_V1' as const,snapshot:{...f.salt.snapshot,relevantOperations:[...f.salt.snapshot.relevantOperations,invalid]}}:c)]){
  const r=await prepare(raw(f.request),f.requestPin,[{...f.recipeInputs[0],contexts}],authorized);assert.equal(r.kind,'BLOCKED');assert.equal('snapshot'in r,false);
 }
});
test('false/truthy/throwing authority remains a failure; a hash cannot authorize source data',async()=>{
 const f=await fixture();for(const value of [false,'ADMIN',1,undefined])assert.equal((await prepare(raw(f.request),f.requestPin,f.recipeInputs,{isAuthorizedEvent:async()=>value} as unknown as typeof authorized)).kind,'BLOCKED');
 assert.equal((await prepare(raw(f.request),f.requestPin,f.recipeInputs,{isAuthorizedEvent:async()=>{throw Error();}})).kind,'BLOCKED');
});
test('all recipes are owned before awaits; mutations to later source contexts cannot mix epochs',async()=>{
 const f=await fixture({twoRecipes:true});const later=f.recipeInputs[1].contexts.map(c=>c.kind==='FOOD'?{...c,snapshot:{...c.snapshot,relevantEventRaws:[...c.snapshot.relevantEventRaws]}}:c);
 const inputs=[f.recipeInputs[0],{...f.recipeInputs[1],contexts:later}];const food=later.find(c=>c.kind==='FOOD');
 const r=await prepare(raw(f.request),f.requestPin,inputs,{isAuthorizedEvent:async()=>{if(food?.kind==='FOOD')(food.snapshot.relevantEventRaws as string[]).length=0;return true;}});
 assert.equal(r.kind,'PREPARED_EXACT_WEEK_INPUTS_V3');
});
test('concurrent accounts and different authorization decisions share no prepared-source cache',async()=>{
 const f=await fixture(),request={...f.request,accountId:id(90),selectionId:id(91)};
 const [a,b]=await Promise.all([prepare(raw(f.request),f.requestPin,f.recipeInputs,authorized),prepare(raw(request),await pin(raw(request)),f.recipeInputs,{isAuthorizedEvent:async()=>false})]);
 assert.equal(a.kind,'PREPARED_EXACT_WEEK_INPUTS_V3');assert.equal(b.kind,'BLOCKED');
});
test('readback recomputes ingredient/meal/day/week totals, mass, source refs and authority',async()=>{
 const f=await fixture(),r=await prepare(raw(f.request),f.requestPin,f.recipeInputs,authorized);if(r.kind!=='PREPARED_EXACT_WEEK_INPUTS_V3')throw Error();
 for(const patch of [{nutrition:{...r.snapshot.nutrition,values:{...r.snapshot.nutrition.values,calories:q('1')}}},{inputMass:{...r.snapshot.inputMass,totalGrams:q('952')}},
  {authority:'OWNER'},{facts:[{consumed:true}]},{digest:'0'.repeat(64)},{sourceRecipes:[]}])await assert.rejects(decode(raw({...r.snapshot,...patch}),f.requestPin,f.recipeInputs,authorized));
 const changed=copy(r.snapshot) as unknown as {days:{meals:{components:{ingredients:{amount:unknown}[]}[]}[]}[]};changed.days[0].meals[0].components[0].ingredients[0].amount=q('1');
 await assert.rejects(decode(raw(changed),f.requestPin,f.recipeInputs,authorized));
 await assert.rejects(decode(raw(r.snapshot),f.requestPin,f.recipeInputs,{isAuthorizedEvent:async()=>false}));
});
test('request and output use independent SHA256 domains and exact canonical UTF8 bytes',async()=>{
 const f=await fixture(),r=await prepare(raw(f.request),f.requestPin,f.recipeInputs,authorized);if(r.kind!=='PREPARED_EXACT_WEEK_INPUTS_V3')throw Error();const {digest,...payload}=r.snapshot;
 assert.equal(digest,sha(canonicalJsonV1({domain:'potok-exact-week-input-nutrition-snapshot-sha256-v3',payload})));assert.notEqual(digest,f.requestPin);
});
test('raw duplicate keys, depth/byte and per-attempt placement budgets reject',async()=>{
 const f=await fixture();await assert.rejects(pin(raw(f.request).replace('{','{"contract":"duplicate",')));
 await assert.rejects(pin(' '.repeat(262145)));await assert.rejects(pin('['.repeat(13)+'0'+']'.repeat(13)));
 const request:ExactWeekNutritionRequestV3={...f.request,days:f.request.days.map((d,i)=>({...d,meals:Array.from({length:8},(_,j)=>({slotId:id(70000+i*8+j),mealType:'snack',components:Array.from({length:8},(_,k)=>({componentKey:'c'+k,recipeKey:'a',portion:{kind:'FRACTION_OF_WHOLE',amount:q('1')}}))}))}))};
 await assert.rejects(pin(raw(request)));
});

test('recorded gram water keeps all day/week masses known without a density conversion',async()=>{
 const f=await fixture(),source=JSON.parse(f.recipeInputs[0].requestRaw);source.authoring.components[1].unit='g';
 const requestRaw=raw(source),requestDigest=await exactTypedRecipeRequestDigestRawV3(requestRaw),prepared=await prepareExactTypedRecipeRawV3(requestRaw,requestDigest,f.recipeInputs[0].contexts,authorized);
 if(prepared.kind!=='PREPARED_EXACT_TYPED_INPUTS_V3')throw Error();
 const request={...f.request,recipes:[{...f.request.recipes[0],requestDigest,snapshotDigest:prepared.snapshot.digest}]};
 const r=await prepare(raw(request),await pin(raw(request)),[{...f.recipeInputs[0],requestRaw}],authorized);
 assert.equal(r.kind,'PREPARED_EXACT_WEEK_INPUTS_V3');if(r.kind==='PREPARED_EXACT_WEEK_INPUTS_V3'){
  assert.deepEqual(r.snapshot.inputMass.totalGrams,q('5656','3'));assert.deepEqual(r.snapshot.inputMass.unknownItems,[]);
  assert.deepEqual(r.snapshot.inputMass.knownGrams,r.snapshot.inputMass.totalGrams);
 }
});
test('large but individually valid schedules fail the output budget without partial results',async()=>{
 const f=await fixture();let slot=80000;
 const request:ExactWeekNutritionRequestV3={...f.request,days:f.request.days.map((d,index)=>({...d,meals:Array.from({length:index===0?8:4},()=>({slotId:id(slot++),mealType:'snack',components:Array.from({length:4},(_,c)=>({componentKey:'c'+c,recipeKey:'a',portion:{kind:'FRACTION_OF_WHOLE',amount:q('1','3')}}))}))}))};
 const r=await prepare(raw(request),await pin(raw(request)),f.recipeInputs,authorized);
 assert.deepEqual(r,{kind:'BLOCKED',reason:'CALCULATION_BUDGET_OR_INCONSISTENCY'});assert.equal('snapshot'in r,false);
});
