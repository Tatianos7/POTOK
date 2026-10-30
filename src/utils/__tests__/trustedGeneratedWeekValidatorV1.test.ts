import assert from 'node:assert/strict';
import test from 'node:test';
import ts from 'typescript';
import { readFileSync } from 'node:fs';
import { decodeGeneratedWeekPlanV1 } from '../adaptiveNutritionGraphV2';
import { scalePremiumRecipeCollectionV1 } from '../adaptiveNutritionGraphV1';
import { validateGeneratedWeekPlanTrustedV1, trustedGeneratedWeekValidatorContractV1 } from '../trustedGeneratedWeekValidatorV1';
import {
  compositionPolicySnapshotContractV1, compositionPolicySnapshotEncodingV1,
  balancePolicySnapshotContractV1, balancePolicySnapshotEncodingV1,
  trustedValidationPoliciesContractV1, trustedValidationPoliciesEncodingV1,
} from '../trustedValidationPoliciesV1';
import {
  fullFixture, check, id, h, resignPlan, rejected, useRecipe, withoutDigest, fixtureSeal,
  resignEntry, resignSet, bindFixtureValidationDigests, fixtureValidationResults,
  type FullFixture, type FixtureState,
} from './trustedGeneratedWeekFixturesV1';

test('valid synthetic full week accepted, ideal target is not hard equality; immutable complete receipts',async()=>{
  const f=await fullFixture(); const result=await check(f);
  assert.equal(result.status,'ACCEPTED');if(result.status!=='ACCEPTED') throw new Error('expected_accept');
  assert.equal(result.contract,trustedGeneratedWeekValidatorContractV1);
  assert.equal(result.graphDigest,f.plan.graphDigest);assert.equal(result.generationInputDigest,f.evidence.generationInputDigest);
  assert.equal(result.validationEvidenceDigest,f.evidence.digest);assert.equal(result.validationPoliciesDigest,f.policies.digest);
  assert.equal(result.warningEvidenceDigest,f.set.digest);assert.equal(result.manifestDigest,f.context.manifest.digest);
  assert.equal(result.preferenceDigest,f.context.preference.digest);assert.equal(result.safetyDigest,f.context.safety.digest);
  assert.ok(Object.isFrozen(result));assert.ok(Object.isFrozen(result.plan.graph.days[0].slots[0].mealSnapshot.components));
  assert.deepEqual(result.warnings,[]);
  await decodeGeneratedWeekPlanV1(result.plan,f.context.input);
});

for(const [name,mutate] of [
  ['absent recipe',(f:FullFixture)=>{f.plan.graph.days[0].slots[0].mealSnapshot.components[0].recipe.recipeId=id(99999);}],
  ['stale recipe revision',(f:FullFixture)=>{const c=f.plan.graph.days[0].slots[0].mealSnapshot.components[0];
    c.recipeRevision=id(99999);c.recipe.recipeRevisionId=c.recipeRevision;c.eligibility.recipeRevisionId=c.recipeRevision;
    for(const i of [...c.recipe.ingredients,...c.ingredients]) i.recipeRevisionId=c.recipeRevision;}],
  ['stale portion revision',(f:FullFixture)=>{const c=f.plan.graph.days[0].slots[0].mealSnapshot.components[0];
    c.portionRevision=id(99999);c.assignedPortion.portionRevisionId=c.portionRevision;}],
  ['wrong eligibility revision',(f:FullFixture)=>{const s=f.plan.graph.days[0].slots[0];s.mealSnapshot.components[0].eligibility.eligibilityRevisionId=id(99999);
    s.componentEvidence[0].eligibilityRevisionId=id(99999);}],
  ['publication mismatch',(f:FullFixture)=>{f.plan.graph.days[0].slots[0].componentEvidence[0].publicationRevision=id(99999);}],
  ['canonical evidence mismatch',(f:FullFixture)=>{f.plan.graph.days[0].slots[0].componentEvidence[0].canonicalEvidenceRevision=id(99999);}],
  ['nutrition evidence mismatch',(f:FullFixture)=>{f.plan.graph.days[0].slots[0].componentEvidence[0].nutritionEvidenceRevision=id(99999);}],
  ['allergen evidence mismatch',(f:FullFixture)=>{f.plan.graph.days[0].slots[0].componentEvidence[0].allergenEvidenceRevision=id(99999);}],
  ['dietary evidence mismatch',(f:FullFixture)=>{f.plan.graph.days[0].slots[0].componentEvidence[0].dietaryEvidenceRevision=id(99999);}],
  ['component digest domain mismatch',(f:FullFixture)=>{f.plan.graph.days[0].slots[0].componentEvidence[0].evidenceDigest=h('f');}],
  ['role mismatch',(f:FullFixture)=>{f.plan.graph.days[0].slots[0].mealSnapshot.components[0].eligibility.role='SALAD';}],
  ['invalid COMPLETE',(f:FullFixture)=>{f.plan.graph.days[0].slots[0].sourceKind='COMPOSED_MEAL';
    f.plan.graph.days[0].slots[0].generatorDecisionEvidence.decisionPath='COMPOSED_MEAL';}],
  ['invalid PARTIAL',(f:FullFixture)=>{f.plan.graph.days[0].slots[0].mealSnapshot.components[0].eligibility.anchorKind='PARTIAL';}],
  ['invalid NONE',(f:FullFixture)=>{f.plan.graph.days[0].slots[0].mealSnapshot.components[0].eligibility.anchorKind='NONE';}],
  ['wrapper snapshot mealType mismatch',(f:FullFixture)=>{f.plan.graph.days[0].slots[0].mealType='breakfast';}],
  ['wrong meal type',(f:FullFixture)=>{const s=f.plan.graph.days[0].slots[0];s.mealType='breakfast';s.mealSnapshot.mealType='breakfast';}],
  ['wrong date',(f:FullFixture)=>{f.plan.graph.days[0].slots[0].civilDate='2026-09-29';}],
  ['wrong order',(f:FullFixture)=>{f.plan.graph.days[0].slots[0].sortOrder=1;}],
  ['missing slot',(f:FullFixture)=>{f.plan.graph.days[0].slots=[];}],
  ['hostile re-signed Goal',(f:FullFixture)=>{f.plan.graph.goalNutritionTarget.calories={min:'9000.000',target:'9000.000',max:'9000.000'};}],
  ['recipe content substitution',(f:FullFixture)=>{f.plan.graph.days[0].slots[0].mealSnapshot.components[0].recipe.displayNameSnapshot='Hostile substitute';}],
  ['discrete increment violation',(f:FullFixture)=>{const c=f.plan.graph.days[0].slots[0].mealSnapshot.components[0];
    c.recipe.ingredients[0].scaling={mode:'discrete',increment:'3.000'};c.ingredients[0].scaling={mode:'discrete',increment:'3.000'};}],
] as const) {
  test(`re-signed candidate ${name} rejected against pinned authorities`,async()=>{
    const f=await fullFixture();mutate(f);resignPlan(f);await rejected(f);
  });
}

for(const [name,change,code] of [
  ['below calorie minimum',(s:FixtureState)=>{s.context.input.goalNutritionTarget.calories={min:'110.000',target:'150.000',max:'200.000'};},'DAY_TARGET_MISMATCH'],
  ['above calorie maximum',(s:FixtureState)=>{s.context.input.goalNutritionTarget.calories={min:'50.000',target:'70.000',max:'90.000'};},'DAY_TARGET_MISMATCH'],
  ['servings increment',(s:FixtureState)=>{s.context.manifest.entries[0].portionRules.assignedServingsIncrement='2.000';},'PORTION_FAILURE'],
  ['recipe exclusion',(s:FixtureState)=>{s.context.preference.hard.excludedRecipeIds=[s.context.manifest.entries[0].recipeId];},'PREFERENCE_SAFETY_FAILURE'],
  ['ingredient exclusion',(s:FixtureState)=>{s.context.preference.hard.excludedIngredientIds=[s.context.manifest.entries[0].ingredientIds[0]];},'PREFERENCE_SAFETY_FAILURE'],
  ['meal type exclusion',(s:FixtureState)=>{s.context.preference.hard.excludedMealTypes=['dinner'];},'PREFERENCE_SAFETY_FAILURE'],
  ['allergen conflict',(s:FixtureState)=>{s.context.manifest.entries[0].allergenCodes=['milk'];s.context.safety.declaredAllergenCodes=['milk'];},'PREFERENCE_SAFETY_FAILURE'],
  ['intolerance conflict',(s:FixtureState)=>{s.context.manifest.entries[0].intoleranceCodes=['lactose'];s.context.safety.declaredIntoleranceCodes=['lactose'];},'PREFERENCE_SAFETY_FAILURE'],
  ['dietary hard exclusion',(s:FixtureState)=>{s.context.manifest.entries[0].dietaryCodes=['animal_product'];s.context.safety.dietaryHardExclusionCodes=['animal_product'];},'PREFERENCE_SAFETY_FAILURE'],
  ['dietary pattern conflict',(s:FixtureState)=>{s.context.preference.hard.dietaryPattern='VEGAN';},'PREFERENCE_SAFETY_FAILURE'],
  ['composition pattern mismatch',(s:FixtureState)=>{s.composition.policy.patterns[0].allowedMealTypes=['breakfast'];},'COMPOSITION_FAILURE'],
  ['meal distribution',(s:FixtureState)=>{s.evidence.distributionPolicy.days[0].distributionBounds[0].bounds.maximum.calories='90.000';
    s.evidence.distributionPolicy.days[0].distributionBounds[0].bounds.target.calories='80.000';},'MEAL_DISTRIBUTION_MISMATCH'],
  ['meal nutrition bounds',(s:FixtureState)=>{s.evidence.distributionPolicy.days[0].nutritionBounds[0].bounds.maximum.calories='90.000';
    s.evidence.distributionPolicy.days[0].nutritionBounds[0].bounds.target.calories='80.000';},'MEAL_TARGET_MISMATCH'],
  ['structured meal balance evidence failure',(s:FixtureState)=>{s.evidence.components[0].proteinSource=false;},'REQUIRED_PROTEIN_SOURCE_MISSING'],
  ['repeatFamily excess',(s:FixtureState)=>{for(const e of s.context.manifest.entries) e.repeatFamily='same_family';},'WEEK_REPEAT_FAMILY_EXCEEDED'],
  ['dominant family excess',(s:FixtureState)=>{for(const e of s.context.manifest.entries) e.dominantIngredientFamily='same_family';
    for(const e of s.evidence.components) e.ingredientFamilies=['same_family'];},'WEEK_INGREDIENT_REPEAT_EXCEEDED'],
  ['specialty excess common accessibility',(s:FixtureState)=>{for(const e of s.context.manifest.entries.slice(0,2)) e.specialty=true;},'SPECIALTY_LIMIT_EXCEEDED'],
  ['expensive excess common accessibility',(s:FixtureState)=>{for(const e of s.context.manifest.entries.slice(0,3)) e.expensive=true;},'EXPENSIVE_LIMIT_EXCEEDED'],
  ['ACCESSIBILITY_BLOCKED',(s:FixtureState)=>{s.context.manifest.entries[0].accessibility='ACCESSIBILITY_BLOCKED';},'ACCESSIBILITY_BLOCKED'],
] as const) {
  test(`pinned ${name} enforced without defaults/thresholds`,async()=>{await rejected(await fullFixture(change),code);});
}

for(const axis of ['protein','fat','carbs','fiber'] as const) {
  test(`optional authoritative ${axis} hard bound violation rejected`,async()=>{
    const f=await fullFixture(s=>{s.context.input.goalNutritionTarget[axis]={min:'20.000',target:'25.000',max:'30.000'};});
    await rejected(f,'DAY_TARGET_MISMATCH');
  });
}

test('both independent accessibility axes can exceed simultaneously',async()=>{
  const f=await fullFixture(s=>{for(const e of s.context.manifest.entries.slice(0,3)) {e.specialty=true;e.expensive=true;}});
  const result=await rejected(f);
  assert.ok(result.reasons.some(r=>r.code==='SPECIALTY_LIMIT_EXCEEDED'));
  assert.ok(result.reasons.some(r=>r.code==='EXPENSIVE_LIMIT_EXCEEDED'));
});
test('same recipe more than twice per week rejected',async()=>{
  const f=await fullFixture(s=>{useRecipe(s,1,0);useRecipe(s,2,0);});await rejected(f,'WEEK_RECIPE_REPEAT_EXCEEDED');
});
test('same recipe twice in one day rejected',async()=>{
  const f=await fullFixture(s=>useRecipe(s,1,0),2);await rejected(f,'DAY_RECIPE_REPEAT_EXCEEDED');
});
for(const status of ['UNAVAILABLE_SPECIALTY','UNAVAILABLE_EXPENSIVE','UNAVAILABLE_BOTH'] as const) {
  test(`ordinary fallback ${status} remains independently blocking`,async()=>{
    const f=await fullFixture(s=>{s.evidence.ordinaryFallback.status=status;s.evidence.ordinaryFallback.ordinaryWeekDigest=null;});
    const result=await rejected(f);
    assert.equal(result.reasons.some(r=>r.code==='SPECIALTY_DEPENDENCY_REQUIRED'),status!=='UNAVAILABLE_EXPENSIVE');
    assert.equal(result.reasons.some(r=>r.code==='EXPENSIVE_DEPENDENCY_REQUIRED'),status!=='UNAVAILABLE_SPECIALTY');
  });
}

for(const [name,mutate] of [
  ['assigned servings',(f:FullFixture)=>{const c=f.plan.graph.days[0].slots[0].mealSnapshot.components[0];
    const scaled=scalePremiumRecipeCollectionV1(c.recipe,'2.000');c.assignedPortion={...c.assignedPortion,assignedServings:'2.000',
      assignedGrams:'200.000',servingMultiplier:scaled.scaleFactor};c.ingredients=scaled.ingredients;c.nutrition=scaled.nutrition;
    f.plan.graph.days[0].slots[0].mealSnapshot.nutrition=scaled.nutrition;}],
  ['meal nutrition',(f:FullFixture)=>{const c=f.plan.graph.days[0].slots[0].mealSnapshot.components[0];
    c.recipe.fullRecipeNutrition.calories='110.000';c.recipe.ingredients[0].nutrition.calories='110.000';
    c.ingredients[0].nutrition.calories='110.000';c.nutrition.calories='110.000';
    f.plan.graph.days[0].slots[0].mealSnapshot.nutrition.calories='110.000';}],
  ['component content',(f:FullFixture)=>{f.plan.graph.days[0].slots[0].mealSnapshot.components[0].recipe.displayNameSnapshot='Different meal';}],
] as const) {
  test(`warning evidence replay after changed ${name} rejected`,async()=>{
    const f=await fullFixture();mutate(f);resignPlan(f,false);await rejected(f,'AUTHORITY_BINDING_MISMATCH');
  });
}

for(const key of ['trustedGenerationInputRaw','candidateManifestRaw','preferenceSnapshotRaw','safetySnapshotRaw',
  'trustedValidationEvidenceRaw'] as const) {
  test(`separately pinned ${key} substitution rejected`,async()=>{
    const f=await fullFixture();const value=JSON.parse(f.rawContext[key]);
    if(key==='trustedGenerationInputRaw') value.operation.requestId=id(99999);
    else if(key==='candidateManifestRaw') value.digest=h('f');
    else if(key==='preferenceSnapshotRaw'||key==='safetySnapshotRaw') value.revisionId=id(99999);
    else value.digest=h('f');
    f.rawContext[key]=JSON.stringify(value);f.contextRaw=JSON.stringify(f.rawContext);
    await rejected(f,'AUTHORITY_BINDING_MISMATCH');
  });
}
test('self-consistent re-signed policy substitute cannot replace warning-pinned policy digest',async()=>{
  const f=await fullFixture();const policies=structuredClone(f.policies);
  policies.composition.policy.nutritionWeights.calories=3;
  policies.composition=fixtureSeal(withoutDigest(policies.composition),compositionPolicySnapshotContractV1,compositionPolicySnapshotEncodingV1);
  f.policiesRaw=JSON.stringify(fixtureSeal(withoutDigest(policies),trustedValidationPoliciesContractV1,trustedValidationPoliciesEncodingV1));
  await rejected(f,'AUTHORITY_BINDING_MISMATCH');
});
test('wrong policy digest rejected rather than trusted',async()=>{
  const f=await fullFixture();f.policiesRaw=JSON.stringify({...f.policies,digest:h('f')});await rejected(f,'AUTHORITY_BINDING_MISMATCH');
});
test('warning set from another evaluated plan rejected',async()=>{
  const f=await fullFixture();const entries=[...f.set.entries];entries[0]=resignEntry({...entries[0],mealSnapshotDigest:h('f')});
  f.warningRaw=resignSet({...f.set,entries});await rejected(f,'AUTHORITY_BINDING_MISMATCH');
});
test('missing warning evidence returns BLOCKED, never false signals',async()=>{
  const f=await fullFixture();f.warningRaw=resignSet({...f.set,entries:[]});
  const result=await check(f);assert.equal(result.status,'BLOCKED');
});
test('warning emission uses explicit pinned signals and only allowed codes',async()=>{
  const f=await fullFixture(s=>{s.balance.policy.allowedWarningCodes=['SOFT_TARGET_FIT_DEVIATION'];});
  const entries=[...f.set.entries];entries[0]=resignEntry({...entries[0],signals:{...entries[0].signals,
    softTargetFitDeviation:true,longPreparationBurden:true}});f.set={...f.set,entries};f.warningRaw=resignSet(f.set);
  await bindFixtureValidationDigests(f);
  const result=await check(f);assert.equal(result.status,'ACCEPTED');if(result.status!=='ACCEPTED') throw new Error('expected_accept');
  assert.deepEqual(result.warnings.map(r=>r.code),['SOFT_TARGET_FIT_DEVIATION']);
});
test('Graph digest tamper rejected',async()=>{const f=await fullFixture();f.plan.graphDigest=h('f');f.planRaw=JSON.stringify(f.plan);await rejected(f);});
test('deterministic content digest tamper rejected',async()=>{const f=await fullFixture();f.plan.deterministicContentDigest=h('f');f.planRaw=JSON.stringify(f.plan);await rejected(f);});
test('PLAN FACT contamination rejected',async()=>{const f=await fullFixture();f.planRaw=JSON.stringify({...f.plan,facts:[{consumed:true}]});await rejected(f);});
test('duplicate generated JSON keys rejected with structured result',async()=>{
  const f=await fullFixture();f.planRaw=f.planRaw.replace('"accountId":', '"accountId":"bad","accountId":');await rejected(f);
});
test('noncanonical decimal rejected, not coerced',async()=>{
  const f=await fullFixture();f.plan.graph.goalNutritionTarget.calories.min='1e2';resignPlan(f);await rejected(f);
});
test('malformed trusted shape remains a contract exception',async()=>{
  const f=await fullFixture();f.rawContext.safetySnapshotRaw='{}';f.contextRaw=JSON.stringify(f.rawContext);
  await assert.rejects(check(f),/invalid_/);
});
test('raw public API rejects authority objects/proxies without traps',async()=>{
  const f=await fullFixture();let traps=0;const proxy=new Proxy({}, {get(){traps++;throw new Error('trap');},
    ownKeys(){traps++;throw new Error('trap');},getOwnPropertyDescriptor(){traps++;throw new Error('trap');},getPrototypeOf(){traps++;throw new Error('trap');}});
  for(const value of [proxy,{},[],new String('{}'),null,false,4,()=>{}]) {
    const candidate=await validateGeneratedWeekPlanTrustedV1(value as string,f.policiesRaw,f.contextRaw,f.warningRaw);
    assert.equal(candidate.status,'REJECTED');
    for(const index of [1,2,3]) {const args=[f.planRaw,f.policiesRaw,f.contextRaw,f.warningRaw];args[index]=value as string;
      await assert.rejects(validateGeneratedWeekPlanTrustedV1(args[0],args[1],args[2],args[3]),/RAW_STRING_REQUIRED/);}
  }
  assert.equal(traps,0);
});
test('validator invokes public RawV2 policy/week APIs only and exports no object/seal decoder',()=>{
  const source=readFileSync(new URL('../trustedGeneratedWeekValidatorV1.ts',import.meta.url),'utf8');
  const ast=ts.createSourceFile('validator.ts',source,ts.ScriptTarget.Latest,true);
  const funcs=ast.statements.filter(ts.isFunctionDeclaration).filter(n=>n.modifiers?.some(m=>m.kind===ts.SyntaxKind.ExportKeyword));
  assert.deepEqual(funcs.map(n=>n.name?.text),['validateGeneratedWeekPlanTrustedV1']);
  assert.ok(funcs[0].parameters.every(p=>p.type?.kind===ts.SyntaxKind.StringKeyword));
  assert.ok(source.includes('decodeTrustedValidationPoliciesRawV2(policiesRaw, contextRaw)'));
  assert.ok(source.includes('validateWeekSnapshotWithChildResultsRawV2(JSON.stringify(week), authority.manifestRaw)'));
  assert.ok(!/decode.*OwnedV2|seal.*Policy|node:/.test(source));
});
test('failure ordering/paths/codes deterministic and frozen across repeated evaluation',async()=>{
  const f=await fullFixture(s=>{s.context.preference.hard.excludedRecipeIds=s.context.manifest.entries.map(e=>e.recipeId);
    for(const e of s.context.manifest.entries) e.portionRules.assignedServingsIncrement='2.000';});
  const a=await rejected(f);const b=await rejected(f);assert.deepEqual(a,b);assert.ok(Object.isFrozen(a.reasons));
  assert.ok(a.reasons.every(r=>r.path.includes('components')&&r.mealComponentId&&r.slotId&&r.dayIndex!==undefined));
});

test('original smaller composition cap is enforced before Balance projection', async () => {
  const f = await fullFixture(s => { s.composition.policy.maxComponents = 3; });
  assert.equal((await check(f)).status, 'ACCEPTED');
});
test('existing larger composition cap interoperates with fixed Balance cap without new thresholds', async () => {
  const f = await fullFixture(s => { s.composition.policy.maxComponents = 6; });
  assert.equal((await check(f)).status, 'ACCEPTED');
});
test('structured meal failure survives day/week aggregation', async () => {
  const f = await fullFixture(s => { s.evidence.components[0].proteinSource = false;
    s.evidence.distributionPolicy.days[0].requirements[0].proteinSourceRequired = true; });
  const result = await rejected(f);
  assert.ok(result.reasons.some(r => r.scope === 'meal' && r.dayIndex === 0 && r.code === 'REQUIRED_PROTEIN_SOURCE_MISSING'));
});
for (const key of ['trustedGenerationInputRaw', 'candidateManifestRaw', 'preferenceSnapshotRaw',
  'safetySnapshotRaw', 'trustedValidationEvidenceRaw'] as const) {
  test(`duplicate nested authority ${key} cannot enter trusted decoding`, async () => {
    const f = await fullFixture();
    f.rawContext[key] = f.rawContext[key].replace('{', '{"contract":"duplicate",');
    f.contextRaw = JSON.stringify(f.rawContext);
    await assert.rejects(check(f), /duplicate/i);
  });
}
test('self-consistent balance warning filter replacement rejected by pinned warning package', async () => {
  const f = await fullFixture(); const policies = structuredClone(f.policies);
  policies.balance.policy.allowedWarningCodes = ['SOFT_TARGET_FIT_DEVIATION'];
  policies.balance = fixtureSeal(withoutDigest(policies.balance), balancePolicySnapshotContractV1, balancePolicySnapshotEncodingV1);
  f.policiesRaw = JSON.stringify(fixtureSeal(withoutDigest(policies), trustedValidationPoliciesContractV1, trustedValidationPoliciesEncodingV1));
  await rejected(f, 'AUTHORITY_BINDING_MISMATCH');
});
test('stale warning validation revision rejected', async () => {
  const f = await fullFixture(); const entries = [...f.set.entries];
  entries[0] = resignEntry({ ...entries[0], validationPolicyRevision: id(99999) });
  f.warningRaw = resignSet({ ...f.set, entries }); await rejected(f, 'AUTHORITY_BINDING_MISMATCH');
});
test('extra generated slot cannot bypass distribution coverage', async () => {
  const f = await fullFixture();
  const extra = structuredClone(f.plan.graph.days[0].slots[0]);
  extra.slotId = id(99999); extra.sortOrder = 1; extra.mealSnapshot.mealSlotId = extra.slotId;
  f.plan.graph.days[0].slots.push(extra); resignPlan(f);
  const result = await check(f); assert.notEqual(result.status, 'ACCEPTED');
});
test('generator cannot add self-declared policy authority fields', async () => {
  const f = await fullFixture();
  f.planRaw = JSON.stringify({ ...f.plan, trustedPolicies: f.policies }); await rejected(f);
});

for (const field of ['components', 'planEligibility'] as const) {
  test(`missing mandatory ${field} authority yields explicit BLOCKED`, async () => {
    const f = await fullFixture(); const evidence = JSON.parse(f.rawContext.trustedValidationEvidenceRaw);
    evidence[field] = [];
    f.rawContext.trustedValidationEvidenceRaw = JSON.stringify(evidence);
    f.contextRaw = JSON.stringify(f.rawContext);
    const result = await check(f); assert.equal(result.status, 'BLOCKED');
    if (result.status !== 'BLOCKED') throw new Error('expected_blocked');
    assert.equal(result.reasons[0].code, 'TRUSTED_AUTHORITY_MISSING');
  });
}
test('ordinary fallback authority binding mismatch rejected', async () => {
  const f = await fullFixture(); const evidence = JSON.parse(f.rawContext.trustedValidationEvidenceRaw);
  evidence.ordinaryFallback.candidateManifestDigest = h('f');
  f.rawContext.trustedValidationEvidenceRaw = JSON.stringify(evidence); f.contextRaw = JSON.stringify(f.rawContext);
  await rejected(f, 'AUTHORITY_BINDING_MISMATCH');
});
test('reordering transport envelope keys preserves accepted receipt and digests', async () => {
  const f = await fullFixture(); const before = await check(f);
  const reverse = (value: Record<string, unknown>) => Object.fromEntries(Object.entries(value).reverse());
  f.planRaw = JSON.stringify(reverse(JSON.parse(f.planRaw)));
  f.warningRaw = JSON.stringify(reverse(JSON.parse(f.warningRaw)));
  f.policiesRaw = JSON.stringify(reverse(JSON.parse(f.policiesRaw)));
  await decodeGeneratedWeekPlanV1(JSON.parse(f.planRaw), f.context.input);
  assert.deepEqual(await check(f), before);
});
test('stale manifest accessibility classification cannot replace pinned recipe tuple', async () => {
  const f = await fullFixture(); const manifest = JSON.parse(f.rawContext.candidateManifestRaw);
  manifest.entries[0].specialty = true;
  f.rawContext.candidateManifestRaw = JSON.stringify(manifest); f.contextRaw = JSON.stringify(f.rawContext);
  await rejected(f, 'AUTHORITY_BINDING_MISMATCH');
});

for(const level of ['slot','day','week','all'] as const) {
  test(`forged ${level} validation digest rejected despite independently re-signed outer hashes`,async()=>{
    const f=await fullFixture();
    if(level==='slot'||level==='all') f.plan.graph.days[0].slots[0].validationResultDigest=h('f');
    if(level==='day'||level==='all') f.plan.graph.days[0].validationResultDigest=h('f');
    if(level==='week'||level==='all') f.plan.graph.weekValidationResultDigest=h('f');
    resignPlan(f);
    // Strict output and warning boundaries still accept these fully self-consistent outer layers.
    await decodeGeneratedWeekPlanV1(JSON.parse(f.planRaw),f.context.input);
    const first=await rejected(f,'VALIDATION_DIGEST_MISMATCH');const second=await check(f);
    assert.deepEqual(first,second);
    const scopes=first.reasons.filter(r=>r.code==='VALIDATION_DIGEST_MISMATCH').map(r=>r.scope);
    assert.deepEqual(scopes,level==='all'?['day','meal','week']:[level==='slot'?'meal':level]);
    assert.ok(first.reasons.every(r=>r.path.endsWith('validationResultDigest')||r.path.endsWith('weekValidationResultDigest')));
  });
}
test('unchanged independently recomputed meal/day/week digests accepted',async()=>{
  const f=await fullFixture();const actual=await fixtureValidationResults(f);
  assert.equal(f.plan.graph.days[0].slots[0].validationResultDigest,actual.days[0].meals[0].validation.subjectDigest);
  assert.equal(f.plan.graph.days[0].validationResultDigest,actual.days[0].validation.subjectDigest);
  assert.equal(f.plan.graph.weekValidationResultDigest,actual.week.subjectDigest);
  assert.equal((await check(f)).status,'ACCEPTED');
});
test('changed servings and refreshed plan/warning hashes cannot replay old validation receipts',async()=>{
  const f=await fullFixture();const slot=f.plan.graph.days[0].slots[0];const c=slot.mealSnapshot.components[0];
  const scaled=scalePremiumRecipeCollectionV1(c.recipe,'2.000');
  c.assignedPortion={...c.assignedPortion,assignedServings:'2.000',assignedGrams:'200.000',servingMultiplier:scaled.scaleFactor};
  c.ingredients=scaled.ingredients;c.nutrition=scaled.nutrition;slot.mealSnapshot.nutrition=scaled.nutrition;
  resignPlan(f);await rejected(f,'VALIDATION_DIGEST_MISMATCH');
});
