import assert from 'node:assert/strict';import test from 'node:test';
import {raw,id,copy,sha} from './exactFoodNutritionFixturesV2';import {authorized} from './exactWeekNutritionFixturesV3';
import {contentFixtureV4 as fixture} from './exactMenuContentValidationFixturesV4';
import {createExactMenuContentValidationAdapterV4 as create,type ExactMenuContentSourceV4} from '../exactMenuContentValidationV4';
import {sealNutritionPreferenceSnapshotV1,sealNutritionSafetySnapshotV1} from '../../utils/adaptiveNutritionAuthoritiesV1';
import {canonicalJsonV1} from '../../utils/adaptiveNutritionWireV1';
const adapter=(source:ExactMenuContentSourceV4)=>create({loadForProposalRaw:async()=>raw(source)},authorized);
const updateReview=(f:Awaited<ReturnType<typeof fixture>>,change:(r:Record<string,unknown>,i:number)=>void)=>{
 const b=copy(f.bindings);b.forEach((v,i)=>{const r=JSON.parse(v.reviewMetadataRaw);change(r,i);v.reviewMetadataRaw=raw(r);});return {...f.source,bindingsRaw:raw(b)};
};
test('diverse complete synthetic publication bindings pass content checks with no storage/activation grant',async()=>{
 const f=await fixture();let reads=0;const r=await create({loadForProposalRaw:async(op,hash)=>{reads++;assert.equal(op,f.operation);assert.equal(hash,sha(f.snapshotRaw));return raw(f.source);}},authorized).validate(f.operation,f.snapshotRaw);
 assert.equal(r.status,'CONTENT_RULES_PASSED_PENDING_GRAPH');assert.equal(reads,1);assert.equal(r.accepted,false);assert.equal(r.canRecord,false);assert.equal(r.canActivate,false);
 assert.equal(r.authority,'NONE');assert.ok(Object.isFrozen(r.remainingChecks));assert.equal(r.reasons.length,0);assert.ok(!('generatedPlanRaw'in r));assert.ok(r.numericValidationDigest);assert.ok(r.contentBindingsDigest);
});
test('repeated baseline now fails daily, weekly, family and dominant-ingredient limits rather than becoming accepted',async()=>{
 const f=await fixture({repeated:true}),r=await adapter(f.source).validate(f.operation,f.snapshotRaw);assert.equal(r.status,'CONTENT_RULES_REJECTED');
 for(const code of ['DAY_RECIPE_REPEAT_EXCEEDED','WEEK_RECIPE_REPEAT_EXCEEDED','WEEK_REPEAT_FAMILY_EXCEEDED','WEEK_INGREDIENT_REPEAT_EXCEEDED'])assert.ok(r.reasons.some(v=>v.code===code));
});
test('daily repeat cap applies even when the weekly exact-recipe count is still within two',async()=>{
 const f=await fixture({duplicateWithinDay:true}),r=await adapter(f.source).validate(f.operation,f.snapshotRaw);assert.ok(r.reasons.some(v=>v.code==='DAY_RECIPE_REPEAT_EXCEEDED'));
 assert.ok(!r.reasons.some(v=>v.code==='WEEK_RECIPE_REPEAT_EXCEEDED'));
});
test('missing/extra/duplicate/reordered binding coverage and old unversioned metadata reject',async()=>{
 const f=await fixture();for(const b of [[],f.bindings.slice(1),[...f.bindings,f.bindings[0]],[...f.bindings].reverse(),f.bindings.map(v=>({...v,contract:'legacy'}))]){
  assert.equal((await adapter({...f.source,bindingsRaw:raw(b)}).validate(f.operation,f.snapshotRaw)).status,'BLOCKED');
 }
});
test('manifest, exact subject, active publication, canonical/typed identity and base amounts are bound',async()=>{
 const f=await fixture();for(const change of ['manifest','subject','current','food','water','amount','unit'] as const){
  const b=copy(f.bindings);if(change==='manifest')b[0].manifestDigest='0'.repeat(64);if(change==='subject')b[0].publicationSubject.snapshotDigest='0'.repeat(64);
  if(change==='current')b[0].activePublicationRevision=id(99);if(change==='food')b[0].componentBindings[0].identity={kind:'canonical_food',canonicalFoodId:id(99)};
  if(change==='water')b[0].componentBindings[1].identity={kind:'canonical_food',canonicalFoodId:id(99)};if(change==='amount')b[0].componentBindings[0].baseAmount={numerator:'99',denominator:'1'};
  if(change==='unit')b[0].componentBindings[1].unit='g';assert.equal((await adapter({...f.source,bindingsRaw:raw(b)}).validate(f.operation,f.snapshotRaw)).status,'BLOCKED');
 }
});
test('missing publication/canonical/nutrition/allergen/dietary/portion review cannot be inferred from numeric completeness',async()=>{
 const f=await fixture();for(const patch of [{publicationStatus:'MISSING'},{canonicalStatus:'MISSING'},{nutritionStatus:'MISSING'},{allergenStatus:'MISSING'},{dietaryStatus:'MISSING'},{portionPolicyRevision:null}]){
  const source=updateReview(f,(r,i)=>{if(i===0)Object.assign(r,patch);});assert.equal((await adapter(source).validate(f.operation,f.snapshotRaw)).status,'BLOCKED');
 }
});
test('allergen and intolerance conflicts use existing independent safety snapshots',async()=>{
 const f=await fixture();for(const code of ['allergen','intolerance'] as const){
  const source=code==='allergen'?updateReview(f,(r,i)=>{if(i===0)r.allergens=['milk'];}):{...f.source,bindingsRaw:raw(f.bindings.map((b,i)=>i?b:{...b,intoleranceCodes:['lactose']}))};
  const {digest,...s}=f.safety;void digest;source.safetyRaw=raw(await sealNutritionSafetySnapshotV1({...s,declaredAllergenCodes:code==='allergen'?['milk']:[],declaredIntoleranceCodes:code==='intolerance'?['lactose']:[]}));
  const r=await adapter(source).validate(f.operation,f.snapshotRaw);assert.equal(r.status,'CONTENT_RULES_REJECTED');assert.ok(r.reasons.some(v=>v.code===(code==='allergen'?'ALLERGEN_CONFLICT':'INTOLERANCE_CONFLICT')));
 }
});
test('meal/recipe/ingredient exclusions and required dietary patterns are enforced by existing restriction rules',async()=>{
 const f=await fixture(),{digest,...p}=f.preference;void digest;
 for(const hard of [{...p.hard,excludedMealTypes:['breakfast' as const]},{...p.hard,excludedRecipeIds:[f.bindings[0].recipeId]},
  {...p.hard,excludedIngredientIds:[f.food.canonical.foodId]},{...p.hard,dietaryPattern:'VEGAN' as const}]){
  const preferenceRaw=raw(await sealNutritionPreferenceSnapshotV1({...p,hard})),r=await adapter({...f.source,preferenceRaw}).validate(f.operation,f.snapshotRaw);
  assert.equal(r.status,'CONTENT_RULES_REJECTED');
 }
});
test('account/revision/digest substitution in preference/safety snapshots blocks',async()=>{
 const f=await fixture(),{digest,...s}=f.safety;void digest;
 for(const safetyRaw of [raw({...f.safety,digest:'0'.repeat(64)}),raw(await sealNutritionSafetySnapshotV1({...s,accountId:id(99)})),raw(await sealNutritionSafetySnapshotV1({...s,revisionId:id(99)}))]){
  assert.equal((await adapter({...f.source,safetyRaw}).validate(f.operation,f.snapshotRaw)).status,'BLOCKED');
 }
});
test('portion minimum, maximum and serving increment compare rational assigned servings without rounding',async()=>{
 const f=await fixture();for(const change of ['min','max','increment'] as const){
  const b=copy(f.bindings);if(change==='increment')b[0].portionRules.assignedServingsIncrement='0.600';
  else{const r=JSON.parse(b[0].reviewMetadataRaw);if(change==='min')r.assignedServingsMinimum='1.001';else r.assignedServingsMaximum='0.999';b[0].reviewMetadataRaw=raw(r);}
  const r=await adapter({...f.source,bindingsRaw:raw(b)}).validate(f.operation,f.snapshotRaw);assert.equal(r.status,'CONTENT_RULES_REJECTED');
  assert.ok(r.reasons.some(v=>v.code===(change==='increment'?'PORTION_INCREMENT_MISMATCH':'PORTION_OUTSIDE_REVIEWED_RANGE')));
 }
});
test('discrete ingredient increments reject 100/3 grams rather than rounding it to a representable amount',async()=>{
 const f=await fixture(),b=copy(f.bindings);b[0].componentBindings[0].scaling={mode:'discrete',increment:'0.001'};
 b[0].portionRules.componentIncrements=[{componentId:b[0].componentBindings[0].componentId,increment:'0.001'}];
 const r=await adapter({...f.source,bindingsRaw:raw(b)}).validate(f.operation,f.snapshotRaw);assert.equal(r.status,'CONTENT_RULES_REJECTED');assert.ok(r.reasons.some(v=>v.code==='DISCRETE_COMPONENT_INCREMENT_MISMATCH'));
});
test('missing/extra or inconsistent discrete rules and ingredient maps cannot be ignored',async()=>{
 const f=await fixture();for(const mode of ['coverage','extra','missing'] as const){const b=copy(f.bindings);
  if(mode==='coverage')b[0].componentBindings=b[0].componentBindings.slice(0,-1);if(mode==='extra')b[0].portionRules.componentIncrements=[{componentId:id(99),increment:'1.000'}];
  if(mode==='missing')b[0].componentBindings[0].scaling={mode:'discrete',increment:'1.000'};
  assert.equal((await adapter({...f.source,bindingsRaw:raw(b)}).validate(f.operation,f.snapshotRaw)).status,'BLOCKED');
 }
});
test('unknown declared servings stay blocked despite a PUBLISHED marker and explicit fraction',async()=>{
 const f=await fixture({unknownServings:true}),r=await adapter(f.source).validate(f.operation,f.snapshotRaw);assert.equal(r.status,'BLOCKED');assert.ok(r.reasons.some(v=>v.code==='PORTION_EVIDENCE_MISSING'));
});
test('protein/produce and allowed meal type metadata are required; no guessed defaults',async()=>{
 const f=await fixture();for(const key of ['proteinSource','produceSource']){const source=updateReview(f,(r,i)=>{if(i===0)r[key]=false;});const r=await adapter(source).validate(f.operation,f.snapshotRaw);
  assert.ok(r.reasons.some(v=>v.code===(key==='proteinSource'?'REQUIRED_PROTEIN_SOURCE_MISSING':'REQUIRED_PRODUCE_MISSING')));}
 const b=copy(f.bindings),e=JSON.parse(b[0].eligibilityRaw);e.allowedMealTypes=['dinner'];b[0].eligibilityRaw=raw(e);const r=await adapter({...f.source,bindingsRaw:raw(b)}).validate(f.operation,f.snapshotRaw);assert.ok(r.reasons.some(v=>v.code==='MEAL_TYPE_NOT_ALLOWED'));
});
test('incomplete anchors, role-pattern and stale composition revisions block or reject',async()=>{
 const f=await fixture();for(const change of ['anchor','revision','role'] as const){const b=copy(f.bindings),e=JSON.parse(b[0].eligibilityRaw);
  if(change==='anchor')e.anchorKind='NONE';if(change==='revision')e.compositionPolicyRevision=id(99);if(change==='role'){e.role='VEGETABLE_SIDE';e.anchorKind='NONE';}
  b[0].eligibilityRaw=raw(e);const r=await adapter({...f.source,bindingsRaw:raw(b)}).validate(f.operation,f.snapshotRaw);assert.notEqual(r.status,'CONTENT_RULES_PASSED_PENDING_GRAPH');
 }
});
test('orthogonal specialty/expensive flags count meals and preserve existing caps',async()=>{
 const f=await fixture();for(const field of ['specialty','expensive'] as const){const b=f.bindings.map(v=>({...v,[field]:true}));
  const r=await adapter({...f.source,bindingsRaw:raw(b)}).validate(f.operation,f.snapshotRaw);assert.ok(r.reasons.some(v=>v.code===(field==='specialty'?'SPECIALTY_LIMIT_EXCEEDED':'EXPENSIVE_LIMIT_EXCEEDED')));
 }
 const source=updateReview(f,(r,i)=>{if(i===0)r.accessibility='SPECIALTY_PRODUCT_REQUIRED';});assert.equal((await adapter(source).validate(f.operation,f.snapshotRaw)).status,'BLOCKED');
});
test('same exact recipe cannot be relabelled with conflicting canonical IDs/classifications across placements',async()=>{
 const f=await fixture({repeated:true}),b=copy(f.bindings);b[1].recipeId=id(99);
 assert.equal((await adapter({...f.source,bindingsRaw:raw(b)}).validate(f.operation,f.snapshotRaw)).status,'BLOCKED');
});
test('numeric failures and revoked ingredients remain failures in the composed validator',async()=>{
 const f=await fixture(),numeric=JSON.parse(f.source.numericAuthorityRaw),invalid=await f.salt.invalidate();
 numeric.recipeInputs[0].contexts=numeric.recipeInputs[0].contexts.map((c:{rowId:string})=>c.rowId==='salt'?{...c,kind:'NONFOOD_V1',snapshot:{...f.salt.snapshot,relevantOperations:[...f.salt.snapshot.relevantOperations,invalid]}}:c);
 assert.equal((await adapter({...f.source,numericAuthorityRaw:raw(numeric)}).validate(f.operation,f.snapshotRaw)).status,'BLOCKED');
 const gate=create({loadForProposalRaw:async()=>raw(f.source)},{isAuthorizedEvent:async()=>false});assert.equal((await gate.validate(f.operation,f.snapshotRaw)).status,'BLOCKED');
});
test('missing/duplicate/reordered source modes, source header and legacy packages are rejected',async()=>{
 const f=await fixture();for(const source of [{...f.source,mealModes:[]},{...f.source,mealModes:[...f.source.mealModes].reverse()},
  {...f.source,requestOperationId:id(99)},{...f.source,evaluatedSnapshotRawSha256:'0'.repeat(64)},{...f.source,contract:'legacy'}]){
  assert.equal((await adapter(source as ExactMenuContentSourceV4).validate(f.operation,f.snapshotRaw)).status,'BLOCKED');
 }
});
test('result digest binds captured source/proposal/check receipts, with all write flags false',async()=>{
 const f=await fixture(),r=await adapter(f.source).validate(f.operation,f.snapshotRaw),{digest,...payload}=r;
 assert.equal(digest,sha(canonicalJsonV1({domain:'potok-exact-menu-content-result-sha256-v4',payload},'SAFE_INTEGER')));assert.equal(r.sourcePackageRawSha256,sha(raw(f.source)));
 assert.ok(!('receipt'in r));assert.equal(r.accepted,false);assert.equal(r.canRecord,false);assert.equal(r.canActivate,false);
});
