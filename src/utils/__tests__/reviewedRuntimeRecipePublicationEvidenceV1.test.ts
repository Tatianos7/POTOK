import assert from 'node:assert/strict';
import test from 'node:test';
import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';
import ts from 'typescript';
import type { GraphRecipeSnapshotV1 } from '../adaptiveNutritionGraphV1';
import { candidateRecipeSnapshotDigestV2, type AdaptiveNutritionCandidateManifestEntryV2 } from '../adaptiveNutritionAuthoritiesV1';
import { adaptiveMealCompositionEligibilityV1_1 } from '../adaptiveNutritionMealCompositionV1';
import { sealPlanEligibilityEvidenceV1, planEligibilityEvidenceContractV1 } from '../trustedValidationEvidenceV1';
import { decodeReviewedRuntimeRecipePublicationEvidenceRawV1 as decode,
  reviewedRuntimeRecipePublicationEvidenceCanonicalBytesRawV1 as bytes,
  reviewedRuntimeRecipePublicationEvidenceContractV1 as contract,
  reviewedRuntimeRecipePublicationEvidenceEncodingV1 as encoding,
  type ReviewedRuntimeRecipePublicationEvidenceV1 as Package } from '../reviewedRuntimeRecipePublicationEvidenceV1';
const uuid=(value:number)=>`${value.toString(16).padStart(8,'0')}-0000-4000-8000-${String(value).padStart(12,'0')}`;
const hash=(value:string)=>value.repeat(64);
const ingredientId=uuid(20);
function recipeSnapshot(seed = 10): GraphRecipeSnapshotV1 {
  const recipeRevisionId = uuid(seed + 1);
  const nutrition = { calories: '100.000', protein: '10.000', fat: '5.000', carbs: '12.000', fiber: '3.000' };
  return {
    recipeId: uuid(seed),
    recipeRevisionId,
    displayNameSnapshot: `Synthetic recipe ${seed}`,
    baseYield: { servings: '1.000', servingLabel: 'portion', totalYieldGrams: '100.000' },
    fullRecipeNutrition: nutrition,
    ingredients: [{
      componentId: ingredientId,
      recipeRevisionId,
      identity: { kind: 'canonical_food', canonicalFoodId: uuid(seed + 2) },
      displayNameSnapshot: 'Synthetic ingredient',
      state: 'as-sold',
      quantity: { amount: '100.000', unit: 'g' },
      normalizedGrams: '100.000',
      normalizationEvidenceRef: null,
      scaling: { mode: 'continuous' },
      nutrition,
      sortOrder: 0,
    }],
  };
}

async function manifestEntry(seed = 10): Promise<AdaptiveNutritionCandidateManifestEntryV2> {
  const recipe = recipeSnapshot(seed);
  return {
    recipeId: recipe.recipeId,
    recipeRevisionId: recipe.recipeRevisionId,
    portionRevisionId: uuid(seed + 3),
    eligibilityRevisionId: uuid(seed + 4),
    publicationRevision: uuid(seed + 5),
    publicationStatus: 'PUBLISHED',
    canonicalEvidenceRevision: uuid(seed + 6),
    canonicalEvidenceDigest: hash('a'),
    nutritionEvidenceRevision: uuid(seed + 7),
    nutritionEvidenceDigest: hash('b'),
    allergenEvidenceRevision: uuid(seed + 8),
    dietaryEvidenceRevision: uuid(seed + 9),
    ingredientIds: [uuid(seed + 2)],
    allergenCodes: [],
    intoleranceCodes: [],
    dietaryCodes: [],
    allowedMealTypes: ['breakfast', 'lunch', 'dinner', 'snack'],
    role: 'MAIN_COMPONENT',
    anchorKind: 'COMPLETE',
    requiredCompanionRoleSets: [],
    pairingTags: [],
    incompatiblePairingTags: [],
    repeatFamily: `synthetic_${seed}`,
    energyClass: 'BALANCED',
    beverageClass: 'NOT_BEVERAGE',
    dominantIngredientFamily: `synthetic_${seed}`,
    accessibility: 'COMMON_RU_RETAIL',
    specialty: false,
    expensive: false,
    portionRules: {
      mode: 'HYBRID',
      assignedServingsMinimum: '0.500',
      assignedServingsMaximum: '2.000',
      assignedServingsIncrement: '0.500',
      componentIncrements: [],
    },
    recipeSnapshot: recipe,
    recipeSnapshotDigest: await candidateRecipeSnapshotDigestV2(recipe),
  };
}


function canonical(value:unknown):string {
  if(Array.isArray(value)) return `[${value.map(canonical).join(',')}]`;
  if(value&&typeof value==='object') {const row=value as Record<string,unknown>;
    return `{${Object.keys(row).sort().map(k=>`${JSON.stringify(k)}:${canonical(row[k])}`).join(',')}}`;}
  return JSON.stringify(value);
}
function sign(f:Package):string {
  const {digest,...evidence}=f;assert.equal(typeof digest,'string');
  f.digest=createHash('sha256').update(canonical({contract,encoding,evidence}),'utf8').digest('hex');
  return JSON.stringify(f);
}
async function fixture(nonFood=false):Promise<Package> {
  const entry=await manifestEntry();
  if(nonFood) {
    entry.recipeSnapshot.ingredients[0].identity={kind:'approved_non_food',componentDefinitionId:uuid(99)};
    entry.ingredientIds=[];entry.recipeSnapshotDigest=await candidateRecipeSnapshotDigestV2(entry.recipeSnapshot);
  }
  const f:Package={contract,manifestEntry:entry,compositionEligibility:{contract:adaptiveMealCompositionEligibilityV1_1,
    eligibilityRevisionId:entry.eligibilityRevisionId,recipeRevisionId:entry.recipeRevisionId,compositionPolicyRevision:uuid(100),
    role:entry.role,anchorKind:entry.anchorKind,allowedMealTypes:entry.allowedMealTypes,requiredCompanionRoleSets:entry.requiredCompanionRoleSets,
    pairingTags:entry.pairingTags,incompatiblePairingTags:entry.incompatiblePairingTags,repeatFamily:entry.repeatFamily,
    energyClass:entry.energyClass,beverageClass:entry.beverageClass},
    planEligibility:structuredClone(await sealPlanEligibilityEvidenceV1({contract:planEligibilityEvidenceContractV1,
      recipeId:entry.recipeId,recipeRevisionId:entry.recipeRevisionId,portionRevisionId:entry.portionRevisionId,
      eligibilityRevisionId:entry.eligibilityRevisionId,planEligible:true,evidenceRevision:uuid(101)})),
    reviewedSource:{reviewStatus:'REVIEWED',authoringRecipeId:'synthetic_recipe',workbookRevision:'synthetic-reviewed-revision',
      recipeEvidenceRef:'synthetic:recipe',publicationRevision:entry.publicationRevision,
      nutritionEvidenceRef:'synthetic:nutrition',allergenEvidenceRef:'synthetic:allergen',dietaryEvidenceRef:'synthetic:dietary',
      foodBindings:nonFood?[]:[{componentId:ingredientId,canonicalStatus:'RESOLVED',canonical:{foodStableId:'synthetic_food',canonicalFoodId:uuid(12),
        source:'core',sharedCatalogAccessible:true,evidenceRevision:'synthetic-food-evidence',evidenceDigest:hash('a')}}],
      nonFoodBindings:nonFood?[{componentId:ingredientId,componentDefinitionId:uuid(99),approvedNonFoodEvidenceRef:'synthetic:approved_non_food'}]:[]},digest:hash('0')};
  sign(f);return f;
}
test('valid reviewed food package immutable; recipe/eligibility digest authorities preserved',async()=>{
  const f=await fixture();const raw=sign(f);const result=await decode(raw,raw);
  assert.deepEqual(result,f);assert.ok(Object.isFrozen(result.manifestEntry.recipeSnapshot.ingredients));
  assert.equal(result.planEligibility.digest,f.planEligibility.digest);
  assert.equal(createHash('sha256').update(await bytes(raw,raw)).digest('hex'),result.digest);
});
test('explicit typed non-food binding accepted without food IDs',async()=>{
  const f=await fixture(true);const raw=sign(f);assert.deepEqual((await decode(raw,raw)).manifestEntry.ingredientIds,[]);
});
for(const [name,mutate] of [
  ['missing food ID',(f:Package)=>{f.manifestEntry.ingredientIds=[];}],
  ['extra food ID',(f:Package)=>{f.manifestEntry.ingredientIds.push(uuid(500));}],
  ['duplicate food ID',(f:Package)=>{f.manifestEntry.ingredientIds.push(f.manifestEntry.ingredientIds[0]);}],
  ['missing food binding',(f:Package)=>{f.reviewedSource.foodBindings=[];}],
  ['duplicate food binding',(f:Package)=>{f.reviewedSource.foodBindings.push(f.reviewedSource.foodBindings[0]);}],
  ['unknown food component',(f:Package)=>{f.reviewedSource.foodBindings[0].componentId=uuid(500);}],
  ['wrong canonical identity',(f:Package)=>{f.reviewedSource.foodBindings[0].canonical.canonicalFoodId=uuid(500);}],
  ['private canonical pointer',(f:Package)=>{f.reviewedSource.foodBindings[0].canonical.source='private';}],
  ['inaccessible canonical pointer',(f:Package)=>{f.reviewedSource.foodBindings[0].canonical.sharedCatalogAccessible=false;}],
  ['missing canonical evidence',(f:Package)=>{f.reviewedSource.foodBindings[0].canonical.evidenceRevision='';}],
  ['wrong publication binding',(f:Package)=>{f.reviewedSource.publicationRevision=uuid(500);}],
  ['wrong composition revision',(f:Package)=>{f.compositionEligibility.recipeRevisionId=uuid(500);}],
  ['wrong composition eligibility',(f:Package)=>{f.compositionEligibility.eligibilityRevisionId=uuid(500);}],
  ['wrong meal types',(f:Package)=>{f.compositionEligibility.allowedMealTypes=['dinner'];}],
  ['wrong repeat family',(f:Package)=>{f.compositionEligibility.repeatFamily='other';}],
  ['wrong anchor',(f:Package)=>{f.compositionEligibility.anchorKind='PARTIAL';}],
  ['wrong portion decimal',(f:Package)=>{f.manifestEntry.portionRules.assignedServingsMinimum='1e0';}],
  ['invalid accessibility axes',(f:Package)=>{f.manifestEntry.accessibility='SPECIALTY_PRODUCT_REQUIRED';f.manifestEntry.specialty=false;}],
  ['recipe snapshot digest tamper',(f:Package)=>{f.manifestEntry.recipeSnapshotDigest=hash('f');}],
  ['eligibility digest tamper',(f:Package)=>{f.planEligibility.digest=hash('f');}],
  ['missing nutrition proof',(f:Package)=>{f.reviewedSource.nutritionEvidenceRef='';}],
  ['missing allergen proof',(f:Package)=>{f.reviewedSource.allergenEvidenceRef='';}],
  ['missing dietary proof',(f:Package)=>{f.reviewedSource.dietaryEvidenceRef='';}],
] as const) {
  test(`${name} fails closed even with re-signed package`,async()=>{
    const f=await fixture();mutate(f);const raw=sign(f);await assert.rejects(decode(raw,raw));
  });
}
for(const name of ['missing','wrong_definition','food_namespace','unknown_component'] as const) {
  test(`non-food ${name} rejected`,async()=>{
    const f=await fixture(true);
    if(name==='missing') f.reviewedSource.nonFoodBindings=[];
    if(name==='wrong_definition') f.reviewedSource.nonFoodBindings[0].componentDefinitionId=uuid(500);
    if(name==='food_namespace') f.manifestEntry.ingredientIds=[uuid(99)];
    if(name==='unknown_component') f.reviewedSource.nonFoodBindings[0].componentId=uuid(500);
    const raw=sign(f);await assert.rejects(decode(raw,raw));
  });
}
test('explicit review required; READY_FOR_REVIEW never promoted',async()=>{
  const f=await fixture();const changed={...f,reviewedSource:{...f.reviewedSource,reviewStatus:'READY_FOR_REVIEW'}};
  const raw=JSON.stringify(changed);await assert.rejects(decode(raw,raw),/REVIEW_REQUIRED/);
});
test('planEligible false never promoted',async()=>{
  const f=await fixture();const raw=JSON.stringify({...f,planEligibility:{...f.planEligibility,planEligible:false}});
  await assert.rejects(decode(raw,raw),/PLAN_ELIGIBILITY_REQUIRED/);
});
for(const key of ['recipeId','recipeRevisionId','portionRevisionId','eligibilityRevisionId'] as const) {
  test(`separate plan eligibility ${key} binding exact`,async()=>{
    const f=await fixture();const {digest,...value}=f.planEligibility;assert.equal(typeof digest,'string');
    f.planEligibility=await sealPlanEligibilityEvidenceV1({...value,[key]:uuid(500)});
    const raw=sign(f);await assert.rejects(decode(raw,raw),/PLAN_ELIGIBILITY_MISMATCH/);
  });
}
for(const field of ['canonicalEvidenceDigest','nutritionEvidenceDigest','publicationRevision'] as const) {
  test(`self-consistent proposed ${field} substitution rejected against separately pinned package`,async()=>{
    const f=await fixture();const pinned=sign(f);
    f.manifestEntry[field]=field==='publicationRevision'?uuid(500):hash('f');
    if(field==='publicationRevision') f.reviewedSource.publicationRevision=uuid(500);
    await assert.rejects(decode(sign(f),pinned),/PINNED_MISMATCH/);
  });
}
test('unknown and missing fields rejected',async()=>{
  const f=await fixture();const raw=sign(f);
  await assert.rejects(decode(JSON.stringify({...f,extra:true}),raw),/FIELDS_INVALID/);
  const {reviewedSource,...partial}=f;assert.ok(reviewedSource);
  await assert.rejects(decode(JSON.stringify(partial),raw),/FIELDS_INVALID/);
});
test('digest tamper rejected independently',async()=>{
  const f=await fixture();const pinned=sign(f);f.digest=hash('f');await assert.rejects(decode(JSON.stringify(f),pinned),/PACKAGE_DIGEST_MISMATCH/);
});
test('key order changes preserve canonical bytes; changed reviewed reference changes digest',async()=>{
  const f=await fixture();const raw=sign(f);const reverse=(v:unknown):unknown=>Array.isArray(v)?v.map(reverse):
    v&&typeof v==='object'?Object.fromEntries(Object.entries(v).reverse().map(([k,x])=>[k,reverse(x)])):v;
  assert.deepEqual(await bytes(JSON.stringify(reverse(f)),raw),await bytes(raw,raw));
  const before=f.digest;f.reviewedSource.recipeEvidenceRef='different:review';sign(f);assert.notEqual(f.digest,before);
});
for(const which of ['top','escaped','nested'] as const) {
  test(`duplicate raw ${which} keys rejected on proposed and pinned boundaries`,async()=>{
    const f=await fixture();const raw=sign(f);
    const hostile=which==='top'?raw.replace('{','{"contract":"other",'):which==='escaped'?
      raw.replace('{','{"\\u0063ontract":"other",'):raw.replace('"reviewStatus":','"reviewStatus":"REVIEWED","reviewStatus":');
    await assert.rejects(decode(hostile,raw),/duplicate/i);await assert.rejects(decode(raw,hostile),/duplicate/i);
  });
}
test('all public arguments reject objects/wrappers/Proxy without get/meta/coercion traps',async()=>{
  const f=await fixture();const raw=sign(f);let traps=0;const trap=()=>{traps++;throw new Error('trap');};
  const proxy=new Proxy([],{get:trap,getOwnPropertyDescriptor:trap,ownKeys:trap,getPrototypeOf:trap});
  for(const value of [proxy,{},[],new String(raw),null,true,7,()=>{},{toJSON:trap,toString:trap,valueOf:trap}]) {
    for(const api of [decode,bytes]) {
      await assert.rejects(api(value as string,raw),/RAW_STRING_REQUIRED/);await assert.rejects(api(raw,value as string),/RAW_STRING_REQUIRED/);
    }
  }
  assert.equal(traps,0);
});
test('export audit: only two raw-string runtime functions, no object/seal/builder API or Node dependency',()=>{
  const source=readFileSync(new URL('../reviewedRuntimeRecipePublicationEvidenceV1.ts',import.meta.url),'utf8');
  const ast=ts.createSourceFile('module.ts',source,ts.ScriptTarget.Latest,true);
  const fns=ast.statements.filter(ts.isFunctionDeclaration).filter(f=>f.modifiers?.some(m=>m.kind===ts.SyntaxKind.ExportKeyword));
  assert.deepEqual(fns.map(f=>f.name?.text),['decodeReviewedRuntimeRecipePublicationEvidenceRawV1','reviewedRuntimeRecipePublicationEvidenceCanonicalBytesRawV1']);
  assert.ok(fns.every(f=>f.parameters.every(p=>p.type?.kind===ts.SyntaxKind.StringKeyword)));assert.ok(!source.includes('node:'));
});

test('repeated canonical food identity has one manifest ID and separate exact component bindings',async()=>{
  const f=await fixture();const second=structuredClone(f.manifestEntry.recipeSnapshot.ingredients[0]);
  second.componentId=uuid(21);second.sortOrder=1;f.manifestEntry.recipeSnapshot.ingredients.push(second);
  const binding=structuredClone(f.reviewedSource.foodBindings[0]);binding.componentId=second.componentId;
  f.reviewedSource.foodBindings.push(binding);
  f.manifestEntry.recipeSnapshot.fullRecipeNutrition={...f.manifestEntry.recipeSnapshot.fullRecipeNutrition};
  for(const axis of ['calories','protein','fat','carbs','fiber'] as const){
    const n=BigInt(f.manifestEntry.recipeSnapshot.fullRecipeNutrition[axis].replace('.',''))*2n;
    f.manifestEntry.recipeSnapshot.fullRecipeNutrition[axis]=`${n/1000n}.${String(n%1000n).padStart(3,'0')}`;
  }
  f.manifestEntry.recipeSnapshotDigest=await candidateRecipeSnapshotDigestV2(f.manifestEntry.recipeSnapshot);
  const raw=sign(f);assert.equal((await decode(raw,raw)).manifestEntry.ingredientIds.length,1);
});
test('mixed food/non-food snapshot has disjoint typed coverage, food exclusions unchanged',async()=>{
  const f=await fixture();const second=structuredClone(f.manifestEntry.recipeSnapshot.ingredients[0]);
  second.componentId=uuid(21);second.sortOrder=1;second.identity={kind:'approved_non_food',componentDefinitionId:uuid(99)};
  f.manifestEntry.recipeSnapshot.ingredients.push(second);
  f.reviewedSource.nonFoodBindings=[{componentId:second.componentId,componentDefinitionId:uuid(99),approvedNonFoodEvidenceRef:'synthetic:approved'}];
  f.manifestEntry.recipeSnapshot.fullRecipeNutrition={...f.manifestEntry.recipeSnapshot.fullRecipeNutrition};
  for(const axis of ['calories','protein','fat','carbs','fiber'] as const){
    const n=BigInt(f.manifestEntry.recipeSnapshot.fullRecipeNutrition[axis].replace('.',''))*2n;
    f.manifestEntry.recipeSnapshot.fullRecipeNutrition[axis]=`${n/1000n}.${String(n%1000n).padStart(3,'0')}`;
  }
  f.manifestEntry.recipeSnapshotDigest=await candidateRecipeSnapshotDigestV2(f.manifestEntry.recipeSnapshot);
  const raw=sign(f);assert.deepEqual((await decode(raw,raw)).manifestEntry.ingredientIds,[uuid(12)]);
});
test('noncanonical food binding order rejected, never quietly sorted',async()=>{
  const f=await fixture();f.reviewedSource.foodBindings.push({...f.reviewedSource.foodBindings[0],componentId:uuid(1)});
  const raw=sign(f);await assert.rejects(decode(raw,raw),/BINDINGS_ORDER_OR_DUPLICATE/);
});
test('boolean coercion and unknown nested pointer fields rejected',async()=>{
  const f=await fixture();const pinned=sign(f);
  const pointer={...f.reviewedSource.foodBindings[0].canonical,sharedCatalogAccessible:'true'};
  const value={...f,reviewedSource:{...f.reviewedSource,foodBindings:[{componentId:ingredientId,canonicalStatus:'RESOLVED',canonical:pointer}]}};
  await assert.rejects(decode(JSON.stringify(value),pinned),/POINTER_INACCESSIBLE/);
  pointer.sharedCatalogAccessible='true';
  await assert.rejects(decode(JSON.stringify({...value,reviewedSource:{...value.reviewedSource,foodBindings:[{componentId:ingredientId,canonicalStatus:'RESOLVED',
    canonical:{...pointer,extra:true}}]}}),pinned),/FIELDS_INVALID/);
});

test('food NOT_APPLICABLE cannot bypass explicit canonical resolution evidence',async()=>{
  const f=await fixture();const raw=JSON.stringify({...f,reviewedSource:{...f.reviewedSource,
    foodBindings:f.reviewedSource.foodBindings.map(b=>({...b,canonicalStatus:'NOT_APPLICABLE'}))}});
  await assert.rejects(decode(raw,raw),/CANONICAL_RESOLUTION_REQUIRED/);
});

test('whitespace-only reviewed source reference is missing evidence, not an authority',async()=>{
  const f=await fixture();f.reviewedSource.recipeEvidenceRef=' \n ';const raw=sign(f);
  await assert.rejects(decode(raw,raw),/TEXT_REQUIRED/);
});
