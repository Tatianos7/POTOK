import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import test from 'node:test';
import {
  sealAdaptiveNutritionCandidateManifestV2, candidateRecipeSnapshotDigestV2,
  sealNutritionPreferenceSnapshotV1, sealNutritionSafetySnapshotV1,
  adaptiveNutritionCandidateManifestContractV2, adaptiveNutritionCandidateManifestEncodingV2,
  nutritionPreferenceSnapshotContractV1, nutritionSafetySnapshotContractV1,
} from '../adaptiveNutritionAuthoritiesV1';
import {
  trustedGenerationInputContractV1, sharedAccountGateContractV1, trustedGenerationInputDigestV1,
  type TrustedGenerationInputV1,
} from '../adaptiveNutritionGraphV2';
import { goalNutritionTargetContractV1 } from '../adaptiveNutritionMealBalanceV1';
import type { GraphNutritionV1, GraphRecipeSnapshotV1 } from '../adaptiveNutritionGraphV1';
import {
  trustedValidationEvidenceContractV1, componentValidationEvidenceContractV1,
  mealDistributionPolicyContractV1, ordinaryFallbackEvidenceContractV1, planEligibilityEvidenceContractV1,
  sealComponentValidationEvidenceV1,
  sealPlanEligibilityEvidenceV1, sealTrustedValidationEvidenceV1,
} from '../trustedValidationEvidenceV1';

const id = (n: number) => `00000000-0000-4000-8000-${String(n).padStart(12, '0')}`;
const h = (s: string) => s.repeat(64);
const nutrition: GraphNutritionV1 = { calories: '100.000', protein: '10.000', fat: '5.000', carbs: '10.000', fiber: '2.000' };
const zero: GraphNutritionV1 = { calories: '0.000', protein: '0.000', fat: '0.000', carbs: '0.000', fiber: '0.000' };

async function evidenceFixture() {
  const recipe: GraphRecipeSnapshotV1 = {
    recipeId: id(10), recipeRevisionId: id(11), displayNameSnapshot: 'Synthetic only',
    baseYield: { servings: '1.000', servingLabel: 'portion', totalYieldGrams: '100.000' },
    fullRecipeNutrition: nutrition, ingredients: [{ componentId: id(12), recipeRevisionId: id(11),
      identity: { kind: 'canonical_food', canonicalFoodId: id(13) }, displayNameSnapshot: 'Synthetic food',
      state: 'as-sold', quantity: { amount: '100.000', unit: 'g' }, normalizedGrams: '100.000',
      normalizationEvidenceRef: null, scaling: { mode: 'continuous' }, nutrition, sortOrder: 0 }],
  };
  const manifest = await sealAdaptiveNutritionCandidateManifestV2({
    contract: adaptiveNutritionCandidateManifestContractV2, encoding: adaptiveNutritionCandidateManifestEncodingV2,
    manifestRevision: id(20), supersedesManifestRevision: null, publicationState: 'PUBLISHED',
    publishedAt: '2026-09-28T00:00:00.000Z', entries: [{
      recipeId: id(10), recipeRevisionId: id(11), portionRevisionId: id(14), eligibilityRevisionId: id(15),
      publicationRevision: id(16), publicationStatus: 'PUBLISHED', canonicalEvidenceRevision: id(17), canonicalEvidenceDigest: h('a'),
      nutritionEvidenceRevision: id(18), nutritionEvidenceDigest: h('b'), allergenEvidenceRevision: id(19), dietaryEvidenceRevision: id(21),
      ingredientIds: [id(13)], allergenCodes: [], intoleranceCodes: [], dietaryCodes: [], allowedMealTypes: ['dinner'],
      role: 'MAIN_COMPONENT', anchorKind: 'COMPLETE', requiredCompanionRoleSets: [], pairingTags: [], incompatiblePairingTags: [],
      repeatFamily: 'synthetic', energyClass: 'BALANCED', beverageClass: 'NOT_BEVERAGE', dominantIngredientFamily: 'synthetic_family',
      accessibility: 'COMMON_RU_RETAIL', specialty: false, expensive: false,
      portionRules: { mode: 'HYBRID', assignedServingsMinimum: '1.000', assignedServingsMaximum: '2.000',
        assignedServingsIncrement: '1.000', componentIncrements: [] }, recipeSnapshot: recipe,
      recipeSnapshotDigest: await candidateRecipeSnapshotDigestV2(recipe),
    }],
  });
  const preference = await sealNutritionPreferenceSnapshotV1({ contract: nutritionPreferenceSnapshotContractV1,
    accountId: id(1), revisionId: id(30), supersedesRevisionId: null, createdAt: '2026-09-28T00:00:00.000Z',
    hard: { dietaryPattern: 'UNSPECIFIED', excludedMealTypes: [], excludedIngredientIds: [], excludedRecipeIds: [] },
    soft: { likedIngredientIds: [], dislikedIngredientIds: [], conveniencePreference: null, mealStylePreferences: [] } });
  const safety = await sealNutritionSafetySnapshotV1({ contract: nutritionSafetySnapshotContractV1, accountId: id(1),
    revisionId: id(31), supersedesRevisionId: null, createdAt: '2026-09-28T00:00:00.000Z',
    declaredAllergenCodes: [], declaredIntoleranceCodes: [], dietaryHardExclusionCodes: [] });
  const input: TrustedGenerationInputV1 = {
    contract: trustedGenerationInputContractV1, accountGateContract: sharedAccountGateContractV1, accountId: id(1),
    selection: { selectionId: id(2), planSelectionRevision: id(3), expectedStatus: 'pending_generation',
      expectedPlanRevision: null, proposedPlanRevision: id(4) }, weekStartLocal: '2026-09-28', timezone: 'UTC',
    goalNutritionTarget: { contract: goalNutritionTargetContractV1, goalRevision: id(5), targetPolicyRevision: id(6),
      calories: { min: '100.000', target: '150.000', max: '200.000' }, protein: null, fat: null, carbs: null, fiber: null },
    preferenceRevision: id(30), safetyRevision: id(31), entitlementEvidenceRevision: id(32),
    candidateManifestRevision: manifest.manifestRevision, candidateManifestDigest: manifest.digest,
    compositionPolicyRevision: id(40), validationPolicyRevision: id(41), optimizationPolicyRevision: id(42), generationPolicyRevision: id(43),
    operation: { requestId: id(44), idempotencyKey: id(45) },
  };
  const entry = manifest.entries[0];
  const component = await sealComponentValidationEvidenceV1({ contract: componentValidationEvidenceContractV1,
    recipeId: entry.recipeId, recipeRevisionId: entry.recipeRevisionId, portionRevisionId: entry.portionRevisionId,
    eligibilityRevisionId: entry.eligibilityRevisionId, slotId: id(50), mealComponentId: id(51),
    publicationRevision: entry.publicationRevision, ingredientFamilies: ['synthetic_family'], proteinSource: true, produceSource: false,
    portionPolicyRevision: id(52), canonicalEvidenceRevision: entry.canonicalEvidenceRevision,
    canonicalEvidenceDigest: entry.canonicalEvidenceDigest, nutritionEvidenceRevision: entry.nutritionEvidenceRevision,
    nutritionEvidenceDigest: entry.nutritionEvidenceDigest, allergenEvidenceRevision: entry.allergenEvidenceRevision,
    dietaryEvidenceRevision: entry.dietaryEvidenceRevision });
  const eligibility = await sealPlanEligibilityEvidenceV1({ contract: planEligibilityEvidenceContractV1, recipeId: entry.recipeId,
    recipeRevisionId: entry.recipeRevisionId, portionRevisionId: entry.portionRevisionId, eligibilityRevisionId: entry.eligibilityRevisionId,
    planEligible: true, evidenceRevision: id(53) });
  const context = { input, manifest, preference, safety };
  const evidence = await sealTrustedValidationEvidenceV1({ contract: trustedValidationEvidenceContractV1,
    accountId: input.accountId, selectionId: input.selection.selectionId, weekStartLocal: input.weekStartLocal, timezone: input.timezone,
    generationInputDigest: await trustedGenerationInputDigestV1(input), validationPolicyRevision: input.validationPolicyRevision,
    compositionPolicyRevision: input.compositionPolicyRevision, optimizationPolicyRevision: input.optimizationPolicyRevision,
    candidateManifestRevision: manifest.manifestRevision, candidateManifestDigest: manifest.digest,
    preferenceRevision: preference.revisionId, preferenceDigest: preference.digest, safetyRevision: safety.revisionId, safetyDigest: safety.digest,
    distributionPolicy: { contract: mealDistributionPolicyContractV1, policyRevision: input.validationPolicyRevision,
      compositionPolicyRevision: input.compositionPolicyRevision, days: Array.from({ length: 7 }, (_, i) => ({
        date: `2026-${i < 3 ? '09' : '10'}-${String(i < 3 ? 28 + i : i - 2).padStart(2, '0')}`,
        requiredSlots: i === 0 ? [{ slotId: id(50), sortOrder: 0, mealType: 'dinner' as const }] : [],
        nutritionBounds: i === 0 ? [{ slotId: id(50), bounds: { minimum: zero, target: nutrition, maximum: nutrition } }] : [],
        requirements: i === 0 ? [{ slotId: id(50), proteinSourceRequired: true, produceRequired: false }] : [],
        distributionBounds: i === 0 ? [{ slotId: id(50), sortOrder: 0, bounds: { minimum: zero, target: nutrition, maximum: nutrition } }] : [],
      })) }, components: [component], ordinaryFallback: { contract: ordinaryFallbackEvidenceContractV1,
      validationPolicyRevision: input.validationPolicyRevision, candidateManifestRevision: manifest.manifestRevision,
      candidateManifestDigest: manifest.digest, candidatePoolDigest: h('c'), status: 'VALID', ordinaryWeekDigest: h('d') },
    planEligibility: [eligibility] }, context);
  return { evidence, context };
}

function withoutDigest<T extends { digest: string }>(value: T): Omit<T, 'digest'> {
  const { digest, ...content } = value;
  assert.equal(typeof digest, 'string');
  return content;
}

import * as policyModule from '../trustedValidationPoliciesV1';
import {
  compositionPolicySnapshotContractV1, balancePolicySnapshotContractV1, trustedValidationPoliciesContractV1,
  compositionPolicySnapshotEncodingV1, balancePolicySnapshotEncodingV1, trustedValidationPoliciesEncodingV1,
  trustedValidationPoliciesRawBoundaryContractV2,
  decodeCompositionPolicySnapshotRawV2, decodeBalancePolicySnapshotRawV2, decodeTrustedValidationPoliciesRawV2,
  compositionPolicySnapshotCanonicalBytesRawV2, balancePolicySnapshotCanonicalBytesRawV2,
  trustedValidationPoliciesCanonicalBytesRawV2, assertTrustedValidationPoliciesPinnedRawV2,
  type CompositionPolicySnapshotV1, type BalancePolicySnapshotV1, type TrustedValidationPoliciesRawContextV2,
} from '../trustedValidationPoliciesV1';
import { balancePolicyContractV1 } from '../adaptiveNutritionMealBalanceV1';

// Only explicitly owned synthetic test fixtures are serialized here. This is NOT a
// sanitizer bridge for arbitrary objects: adversarial inputs go directly to raw APIs.
function fixtureCanonical(value: unknown): string {
  if (Array.isArray(value)) return `[${value.map(fixtureCanonical).join(',')}]`;
  if (value && typeof value === 'object') return `{${Object.entries(value).sort(([a],[b])=>a<b?-1:a>b?1:0)
    .map(([k,v])=>`${JSON.stringify(k)}:${fixtureCanonical(v)}`).join(',')}}`;
  return JSON.stringify(value);
}
function fixtureSeal<T extends object>(content:T,contract:string,encoding:string): T & {digest:string} {
  return { ...content,digest:createHash('sha256').update(fixtureCanonical({contract,encoding,policy:content}),'utf8').digest('hex') };
}
function resignComposition(value:CompositionPolicySnapshotV1):string {
  return JSON.stringify(fixtureSeal(withoutDigest(value),compositionPolicySnapshotContractV1,compositionPolicySnapshotEncodingV1));
}
function resignBalance(value:BalancePolicySnapshotV1):string {
  return JSON.stringify(fixtureSeal(withoutDigest(value),balancePolicySnapshotContractV1,balancePolicySnapshotEncodingV1));
}
async function fixture() {
  const {evidence,context}=await evidenceFixture();
  const inputRaw=JSON.stringify(context.input);
  const rawContext:TrustedValidationPoliciesRawContextV2={contract:trustedValidationPoliciesRawBoundaryContractV2,
    trustedGenerationInputRaw:inputRaw,candidateManifestRaw:JSON.stringify(context.manifest),
    preferenceSnapshotRaw:JSON.stringify(context.preference),safetySnapshotRaw:JSON.stringify(context.safety),
    trustedValidationEvidenceRaw:JSON.stringify(evidence)};
  const contextRaw=JSON.stringify(rawContext);
  const c:Omit<CompositionPolicySnapshotV1,'digest'>={contract:compositionPolicySnapshotContractV1,
    policy:{policyRevision:context.input.compositionPolicyRevision,maxComponents:5,
      patterns:[{patternId:'synthetic_complete',allowedMealTypes:['dinner'],roles:['MAIN_COMPONENT']}],
      nutritionWeights:{calories:2,protein:1,fat:1,carbs:1,fiber:1}}};
  const b:Omit<BalancePolicySnapshotV1,'digest'>={contract:balancePolicySnapshotContractV1,
    policy:{contract:balancePolicyContractV1,policyRevision:context.input.validationPolicyRevision,maxComponents:5,
      exactRecipePerWeek:2,exactRecipePerDay:1,repeatFamilyPerWeek:3,dominantIngredientFamilyPerWeek:4,
      specialtyMealsPerWeek:1,expensiveMealsPerWeek:2,allowedWarningCodes:['OPTIONAL_SPECIALTY_USED']}};
  const compositionRaw=JSON.stringify(fixtureSeal(c,compositionPolicySnapshotContractV1,compositionPolicySnapshotEncodingV1));
  const balanceRaw=JSON.stringify(fixtureSeal(b,balancePolicySnapshotContractV1,balancePolicySnapshotEncodingV1));
  const composition=await decodeCompositionPolicySnapshotRawV2(compositionRaw,inputRaw);
  const balance=await decodeBalancePolicySnapshotRawV2(balanceRaw,inputRaw);
  const content={contract:trustedValidationPoliciesContractV1,generationInputDigest:evidence.generationInputDigest,
    validationEvidenceDigest:evidence.digest,composition,balance};
  const aggregateRaw=JSON.stringify(fixtureSeal(content,trustedValidationPoliciesContractV1,trustedValidationPoliciesEncodingV1));
  const aggregate=await decodeTrustedValidationPoliciesRawV2(aggregateRaw,contextRaw);
  return {inputRaw,rawContext,contextRaw,composition,balance,aggregate,compositionRaw,balanceRaw,aggregateRaw};
}

test('valid primitive raw strings, frozen normalized snapshots and old golden digests',async()=>{
  const f=await fixture();
  assert.equal(f.composition.digest,'89b5e7c38c61bdb2dd05e5a9412a4b91aade28f169a9cf5d3dd77df176786ffa');
  assert.equal(f.balance.digest,'c055c8df77fb39d34f519205e3fd33a5cadf2edc28bf3340e2f2f4937fdae2ba');
  assert.equal(f.aggregate.digest,'f2ba00fbc9cbf2e038067625e246864f61c93e74953b0d440cce2af6f7999bc0');
  assert.ok(Object.isFrozen(f.aggregate.composition.policy.patterns[0].roles));
  assert.ok(Object.isFrozen(f.aggregate.balance.policy.allowedWarningCodes));
  assert.deepEqual(await assertTrustedValidationPoliciesPinnedRawV2(f.aggregateRaw,f.aggregateRaw,f.contextRaw),f.aggregate);
});
test('independent SHA-256 and lexical object keys preserve all three digest domains',async()=>{
  const f=await fixture();
  for(const [bytes,snapshot] of [
    [await compositionPolicySnapshotCanonicalBytesRawV2(f.compositionRaw,f.inputRaw),f.composition],
    [await balancePolicySnapshotCanonicalBytesRawV2(f.balanceRaw,f.inputRaw),f.balance],
    [await trustedValidationPoliciesCanonicalBytesRawV2(f.aggregateRaw,f.contextRaw),f.aggregate],
  ] as const) assert.equal(createHash('sha256').update(bytes).digest('hex'),snapshot.digest);
  const reordered=JSON.stringify(Object.fromEntries(Object.entries(f.composition).reverse()));
  assert.deepEqual(await decodeCompositionPolicySnapshotRawV2(reordered,f.inputRaw),f.composition);
});
for(const [name,mutate] of [
 ['unknown field',(p:Record<string,unknown>)=>{p.extra=true;}],
 ['missing field',(p:Record<string,unknown>)=>{delete p.nutritionWeights;}],
 ['coerced number',(p:Record<string,unknown>)=>{p.maxComponents='5';}],
 ['wrong revision',(p:Record<string,unknown>)=>{p.policyRevision=id(999);} ],
 ['duplicate pattern',(p:Record<string,unknown>)=>{(p.patterns as unknown[]).push(structuredClone((p.patterns as unknown[])[0]));}],
 ['invalid meal type',(p:Record<string,unknown>)=>{(p.patterns as Array<Record<string,unknown>>)[0].allowedMealTypes=['supper'];}],
 ['invalid role',(p:Record<string,unknown>)=>{(p.patterns as Array<Record<string,unknown>>)[0].roles=['UNKNOWN'];}],
 ['meal enum order',(p:Record<string,unknown>)=>{(p.patterns as Array<Record<string,unknown>>)[0].allowedMealTypes=['dinner','breakfast'];}],
 ['role enum order',(p:Record<string,unknown>)=>{(p.patterns as Array<Record<string,unknown>>)[0].roles=['SAUCE','MAIN_COMPONENT'];}],
 ['empty patterns',(p:Record<string,unknown>)=>{p.patterns=[];}],
 ['empty roles',(p:Record<string,unknown>)=>{(p.patterns as Array<Record<string,unknown>>)[0].roles=[];}],
 ['invalid max components',(p:Record<string,unknown>)=>{p.maxComponents=7;}],
 ['zero weights',(p:Record<string,unknown>)=>{p.nutritionWeights={calories:0,protein:0,fat:0,carbs:0,fiber:0};}],
 ['fractional weights',(p:Record<string,unknown>)=>{(p.nutritionWeights as Record<string,unknown>).calories=0.1;}],
 ['weight range',(p:Record<string,unknown>)=>{(p.nutritionWeights as Record<string,unknown>).calories=1001;}],
] as const) test(`composition raw rejects ${name}`,async()=>{
 const f=await fixture();const bad=structuredClone(f.composition);mutate(bad.policy as unknown as Record<string,unknown>);
 await assert.rejects(decodeCompositionPolicySnapshotRawV2(resignComposition(bad),f.inputRaw));
});
for(const [name,mutate] of [
 ['missing warnings',(p:Record<string,unknown>)=>{delete p.allowedWarningCodes;}],
 ['unknown warning',(p:Record<string,unknown>)=>{p.allowedWarningCodes=['UNKNOWN'];}],
 ['duplicate warnings',(p:Record<string,unknown>)=>{p.allowedWarningCodes=['OPTIONAL_SPECIALTY_USED','OPTIONAL_SPECIALTY_USED'];}],
 ['wrong warning type',(p:Record<string,unknown>)=>{p.allowedWarningCodes=false;}],
 ['warning order',(p:Record<string,unknown>)=>{p.allowedWarningCodes=['OPTIONAL_SPECIALTY_USED','OPTIONAL_EXPENSIVE_USED'];}],
 ['wrong revision',(p:Record<string,unknown>)=>{p.policyRevision=id(999);} ],
 ['unknown field',(p:Record<string,unknown>)=>{p.extra=true;}],
 ['changed numeric limit',(p:Record<string,unknown>)=>{p.exactRecipePerWeek=3;}],
 ['coerced limit',(p:Record<string,unknown>)=>{p.maxComponents='5';}],
] as const) test(`balance raw rejects ${name}`,async()=>{
 const f=await fixture();const bad=structuredClone(f.balance);mutate(bad.policy as unknown as Record<string,unknown>);
 await assert.rejects(decodeBalancePolicySnapshotRawV2(resignBalance(bad),f.inputRaw));
});
test('negative zero and unsafe numeric JSON representations reject before normalizing',async()=>{
 const f=await fixture();
 for(const n of ['-0','9007199254740992','0.5']) await assert.rejects(decodeCompositionPolicySnapshotRawV2(
  f.compositionRaw.replace('"calories":2',`"calories":${n}`),f.inputRaw));
});
for(const [name,value] of [['object',{}],['array',[]],['String wrapper',new String('{}')],['number',7],['null',null],['boolean',true],['undefined',undefined]] as const)
 test(`every public API rejects ${name} in payload and authority positions`,async()=>{
  const f=await fixture();const bad=value as unknown as string;
  const pairs=[
   [decodeCompositionPolicySnapshotRawV2,f.compositionRaw,f.inputRaw],
   [decodeBalancePolicySnapshotRawV2,f.balanceRaw,f.inputRaw],
   [decodeTrustedValidationPoliciesRawV2,f.aggregateRaw,f.contextRaw],
   [compositionPolicySnapshotCanonicalBytesRawV2,f.compositionRaw,f.inputRaw],
   [balancePolicySnapshotCanonicalBytesRawV2,f.balanceRaw,f.inputRaw],
   [trustedValidationPoliciesCanonicalBytesRawV2,f.aggregateRaw,f.contextRaw],
  ] as const;
  for(const [api,raw,authority] of pairs){
   await assert.rejects(api(bad,authority),/RAW_JSON_STRING_REQUIRED/);
   await assert.rejects(api(raw,bad),/RAW_JSON_STRING_REQUIRED/);
  }
  for(const args of [[bad,f.aggregateRaw,f.contextRaw],[f.aggregateRaw,bad,f.contextRaw],[f.aggregateRaw,f.aggregateRaw,bad]] as const)
   await assert.rejects(assertTrustedValidationPoliciesPinnedRawV2(...args),/RAW_JSON_STRING_REQUIRED/);
 });
for(const kind of ['get','map','descriptor','ownKeys','prototype','combined'] as const)
 test(`Proxy ${kind} cannot enter any public API; zero Proxy traps run`,async()=>{
  const f=await fixture();let traps=0;
  const fail=():never=>{traps++;throw Error('PROXY_TRAP_MUST_NOT_RUN');};
  const target=['UNKNOWN_ROLE'];
  const handler:ProxyHandler<string[]>={};
  if(kind==='get')handler.get=fail;
  if(kind==='map')handler.get=(_target,key,receiver)=>{traps++;return key==='map'?()=>['MAIN_COMPONENT']:Reflect.get(target,key,receiver);};
  if(kind==='descriptor'||kind==='combined')handler.getOwnPropertyDescriptor=(t,key)=>{
    traps++;const d=Reflect.getOwnPropertyDescriptor(t,key);return key==='0'?{...d,value:'MAIN_COMPONENT'}:d;
  };
  if(kind==='ownKeys'||kind==='combined'){
    Object.defineProperty(target,'extra',{value:true,configurable:true});
    handler.ownKeys=t=>{traps++;return Reflect.ownKeys(t).filter(k=>k!=='extra');};
  }
  if(kind==='prototype'||kind==='combined'){
    Object.setPrototypeOf(target,Object.create(Array.prototype));
    handler.getPrototypeOf=()=>{traps++;return Array.prototype;};
  }
  const proxy=new Proxy(target,handler) as unknown as string;
  for(const [api,raw,authority] of [
   [decodeCompositionPolicySnapshotRawV2,f.compositionRaw,f.inputRaw],
   [decodeBalancePolicySnapshotRawV2,f.balanceRaw,f.inputRaw],
   [decodeTrustedValidationPoliciesRawV2,f.aggregateRaw,f.contextRaw],
   [compositionPolicySnapshotCanonicalBytesRawV2,f.compositionRaw,f.inputRaw],
   [balancePolicySnapshotCanonicalBytesRawV2,f.balanceRaw,f.inputRaw],
   [trustedValidationPoliciesCanonicalBytesRawV2,f.aggregateRaw,f.contextRaw],
  ] as const){
   await assert.rejects(api(proxy,authority),/RAW_JSON_STRING_REQUIRED/);
   await assert.rejects(api(raw,proxy),/RAW_JSON_STRING_REQUIRED/);
  }
  await assert.rejects(assertTrustedValidationPoliciesPinnedRawV2(proxy,f.aggregateRaw,f.contextRaw),/RAW_JSON_STRING_REQUIRED/);
  await assert.rejects(assertTrustedValidationPoliciesPinnedRawV2(f.aggregateRaw,proxy,f.contextRaw),/RAW_JSON_STRING_REQUIRED/);
  await assert.rejects(assertTrustedValidationPoliciesPinnedRawV2(f.aggregateRaw,f.aggregateRaw,proxy),/RAW_JSON_STRING_REQUIRED/);
  assert.equal(traps,0);
 });
for(const name of ['subclass','modified prototype','non-enumerable','sparse','accessor','string extra','symbol extra','own map'] as const)
 test(`old array exploit ${name} rejected at primitive type boundary`,async()=>{
  const f=await fixture();const hostile:string[]=['UNKNOWN_ROLE'];
  if(name==='subclass'){class CustomArray extends Array<string>{}Object.setPrototypeOf(hostile,CustomArray.prototype);}
  if(name==='modified prototype')Object.setPrototypeOf(hostile,Object.create(Array.prototype));
  if(name==='non-enumerable')Object.defineProperty(hostile,'0',{enumerable:false});
  if(name==='sparse')delete hostile[0];
  if(name==='accessor')Object.defineProperty(hostile,'0',{get(){throw Error('GETTER_MUST_NOT_RUN');}});
  if(name==='string extra')Object.defineProperty(hostile,'extra',{value:true});
  if(name==='symbol extra')Object.defineProperty(hostile,Symbol('extra'),{value:true});
  if(name==='own map')Object.defineProperty(hostile,'map',{value(){throw Error('MAP_MUST_NOT_RUN');}});
  await assert.rejects(decodeCompositionPolicySnapshotRawV2(hostile as unknown as string,f.inputRaw),/RAW_JSON_STRING_REQUIRED/);
 });
for(const name of ['duplicate','escaped duplicate','nested duplicate'] as const)
 test(`raw JSON ${name} rejected`,async()=>{
  const f=await fixture();let raw=f.compositionRaw;
  if(name==='duplicate')raw=raw.replace('{','{"contract":"extra",');
  if(name==='escaped duplicate')raw=raw.replace('{','{"\\u0063ontract":"extra",');
  if(name==='nested duplicate')raw=raw.replace('"maxComponents":5','"maxComponents":5,"maxComponents":5');
  await assert.rejects(decodeCompositionPolicySnapshotRawV2(raw,f.inputRaw));
 });
const authorityFields=['trustedGenerationInputRaw','candidateManifestRaw','preferenceSnapshotRaw','safetySnapshotRaw','trustedValidationEvidenceRaw'] as const;
for(const field of authorityFields){
 test(`authority ${field} rejects object payload inside context`,async()=>{
  const f=await fixture();const raw=JSON.stringify({...f.rawContext,[field]:JSON.parse(f.rawContext[field])});
  await assert.rejects(decodeTrustedValidationPoliciesRawV2(f.aggregateRaw,raw),/RAW_JSON_STRING_REQUIRED/);
 });
 test(`authority ${field} duplicate keys reject before decoding`,async()=>{
  const f=await fixture();const original=f.rawContext[field];const key=Object.keys(JSON.parse(original))[0];
  const repeated=original.replace('{',`{${JSON.stringify(key)}:null,`);
  await assert.rejects(decodeTrustedValidationPoliciesRawV2(f.aggregateRaw,JSON.stringify({...f.rawContext,[field]:repeated})));
 });
}
test('context exact allowlist, version, missing raw evidence and nested escaped duplicates reject',async()=>{
 const f=await fixture();
 for(const raw of [JSON.stringify({...f.rawContext,contract:'v1'}),JSON.stringify({...f.rawContext,extra:1}),
  JSON.stringify({...f.rawContext,trustedValidationEvidenceRaw:undefined}),f.contextRaw.replace('{','{"contract":"extra",'),
  JSON.stringify({...f.rawContext,preferenceSnapshotRaw:f.rawContext.preferenceSnapshotRaw.replace('{','{"\\u0063ontract":"extra",')})])
  await assert.rejects(decodeTrustedValidationPoliciesRawV2(f.aggregateRaw,raw));
});
for(const kind of ['composition','balance','aggregate'] as const) test(`${kind} digest tamper rejects`,async()=>{
 const f=await fixture();
 if(kind==='composition')await assert.rejects(decodeCompositionPolicySnapshotRawV2(JSON.stringify({...f.composition,digest:h('f')}),f.inputRaw));
 if(kind==='balance')await assert.rejects(decodeBalancePolicySnapshotRawV2(JSON.stringify({...f.balance,digest:h('f')}),f.inputRaw));
 if(kind==='aggregate')await assert.rejects(decodeTrustedValidationPoliciesRawV2(JSON.stringify({...f.aggregate,digest:h('f')}),f.contextRaw));
});
for(const field of ['composition','balance','generationInputDigest','validationEvidenceDigest'] as const)
 test(`aggregate pins and requires ${field}`,async()=>{
  const f=await fixture();const bad=structuredClone(f.aggregate) as unknown as Record<string,unknown>;
  if(field.endsWith('Digest'))bad[field]=h('f');else delete bad[field];
  await assert.rejects(decodeTrustedValidationPoliciesRawV2(JSON.stringify(bad),f.contextRaw));
 });
test('changed admitted policies and pattern array order change digest; pinned substitute rejects',async()=>{
 const f=await fixture();const c=structuredClone(f.composition);c.policy.patterns[0].allowedMealTypes=['lunch'];
 const changed=await decodeCompositionPolicySnapshotRawV2(resignComposition(c),f.inputRaw);
 assert.notEqual(changed.digest,f.composition.digest);
 const b=structuredClone(f.balance);b.policy.allowedWarningCodes=[];
 const changedBalance=await decodeBalancePolicySnapshotRawV2(resignBalance(b),f.inputRaw);
 assert.notEqual(changedBalance.digest,f.balance.digest);
 for(const delta of [{composition:changed},{balance:changedBalance}]){
  const proposal=fixtureSeal({...withoutDigest(f.aggregate),...delta},trustedValidationPoliciesContractV1,trustedValidationPoliciesEncodingV1);
  await assert.rejects(assertTrustedValidationPoliciesPinnedRawV2(JSON.stringify(proposal),f.aggregateRaw,f.contextRaw),/SUBSTITUTION/);
 }
 c.policy.patterns.push({patternId:'second_synthetic',allowedMealTypes:['dinner'],roles:['MAIN_COMPONENT']});
 const first=await decodeCompositionPolicySnapshotRawV2(resignComposition(c),f.inputRaw);c.policy.patterns.reverse();
 assert.notEqual((await decodeCompositionPolicySnapshotRawV2(resignComposition(c),f.inputRaw)).digest,first.digest);
});
test('raw evidence or input substitution remains bound independently',async()=>{
 const f=await fixture();const input=JSON.parse(f.inputRaw);input.accountId=id(999);
 await assert.rejects(decodeTrustedValidationPoliciesRawV2(f.aggregateRaw,JSON.stringify({...f.rawContext,trustedGenerationInputRaw:JSON.stringify(input)})));
 const evidence=JSON.parse(f.rawContext.trustedValidationEvidenceRaw);evidence.digest=h('f');
 await assert.rejects(decodeTrustedValidationPoliciesRawV2(f.aggregateRaw,JSON.stringify({...f.rawContext,trustedValidationEvidenceRaw:JSON.stringify(evidence)})));
});
test('policy object Proxy and coercion hooks are rejected without touching them',async()=>{
 const f=await fixture();let traps=0;
 const fail=():never=>{traps++;throw Error('OBJECT_TRAP_MUST_NOT_RUN');};
 const proxy=new Proxy(f.composition,{get:fail,ownKeys:fail,getOwnPropertyDescriptor:fail,getPrototypeOf:fail});
 await assert.rejects(decodeCompositionPolicySnapshotRawV2(proxy as unknown as string,f.inputRaw),/RAW_JSON_STRING_REQUIRED/);
 const hooks={toJSON:fail,valueOf:fail,toString:fail};
 await assert.rejects(decodeTrustedValidationPoliciesRawV2(f.aggregateRaw,hooks as unknown as string),/RAW_JSON_STRING_REQUIRED/);
 assert.equal(traps,0);
});
test('full runtime export audit: only seven raw-only functions and seven domain constants',()=>{
 const functions=Object.entries(policyModule).filter(([,v])=>typeof v==='function').map(([k])=>k).sort();
 assert.deepEqual(functions,[
  'decodeCompositionPolicySnapshotRawV2','decodeBalancePolicySnapshotRawV2','decodeTrustedValidationPoliciesRawV2',
  'compositionPolicySnapshotCanonicalBytesRawV2','balancePolicySnapshotCanonicalBytesRawV2',
  'trustedValidationPoliciesCanonicalBytesRawV2','assertTrustedValidationPoliciesPinnedRawV2',
 ].sort());
 assert.equal(Object.keys(policyModule).length,14);
});
