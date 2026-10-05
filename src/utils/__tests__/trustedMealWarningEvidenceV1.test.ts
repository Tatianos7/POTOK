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

import {
  compositionPolicySnapshotContractV1, balancePolicySnapshotContractV1, trustedValidationPoliciesContractV1,
  compositionPolicySnapshotEncodingV1, balancePolicySnapshotEncodingV1, trustedValidationPoliciesEncodingV1,
  trustedValidationPoliciesRawBoundaryContractV2,
  decodeCompositionPolicySnapshotRawV2, decodeBalancePolicySnapshotRawV2, decodeTrustedValidationPoliciesRawV2,
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

import * as warningModule from '../trustedMealWarningEvidenceV1';
import {
  mealWarningEvidenceContractV1, mealWarningEvidenceEncodingV1,
  trustedMealWarningEvidenceSetContractV1, trustedMealWarningEvidenceSetEncodingV1,
  decodeMealWarningEvidenceRawV1, decodeTrustedMealWarningEvidenceSetRawV1,
  mealWarningEvidenceCanonicalBytesRawV1, trustedMealWarningEvidenceSetCanonicalBytesRawV1,
  assertTrustedMealWarningEvidenceSetPinnedRawV1,
  type MealWarningSignalsV1, type MealWarningEvidenceV1, type TrustedMealWarningEvidenceSetV1,
} from '../trustedMealWarningEvidenceV1';
import ts from 'typescript';
import { readFileSync } from 'node:fs';
import { composeAdaptiveMealV1, adaptiveMealCompositionEligibilityV1_1, type MealCompositionPolicyV1 } from '../adaptiveNutritionMealCompositionV1';
import { scalePremiumRecipeCollectionV1 } from '../adaptiveNutritionGraphV1';
import { sealAdaptiveNutritionGraphV2, bindGeneratedWeekPlanV1, decodeGeneratedWeekPlanV1,
  adaptiveNutritionGraphContractV2, type AdaptiveNutritionGraphDraftV2 } from '../adaptiveNutritionGraphV2';
import type { TrustedValidationEvidenceV1 } from '../trustedValidationEvidenceV1';
import type { AdaptiveNutritionCandidateManifestV2 } from '../adaptiveNutritionAuthoritiesV1';

async function evaluatedPlanFixture(input: TrustedGenerationInputV1, evidence: TrustedValidationEvidenceV1,
  manifest: AdaptiveNutritionCandidateManifestV2, policy: MealCompositionPolicyV1,
  options: {assigned?:string; changedNutrition?:boolean; changedContent?:boolean}={}) {
  const days:AdaptiveNutritionGraphDraftV2['days']=[];
  for(let dayIndex=0;dayIndex<evidence.distributionPolicy.days.length;dayIndex++) {
    const distribution=evidence.distributionPolicy.days[dayIndex];
    const slots:AdaptiveNutritionGraphDraftV2['days'][number]['slots']=[];
    for(const required of distribution.requiredSlots) {
      const component=evidence.components.find(c=>c.slotId===required.slotId);assert.ok(component);
      const entry=manifest.entries.find(c=>c.recipeId===component.recipeId);assert.ok(entry);
      const recipe=structuredClone(entry.recipeSnapshot);
      if(options.changedNutrition) {recipe.fullRecipeNutrition.calories='110.000';recipe.ingredients[0].nutrition.calories='110.000';}
      if(options.changedContent) recipe.displayNameSnapshot='Different evaluated content';
      const assigned=options.assigned??'1.000';const scaled=scalePremiumRecipeCollectionV1(recipe,assigned);
      const candidate={mealComponentId:component.mealComponentId,eligibility:{contract:adaptiveMealCompositionEligibilityV1_1,
        eligibilityRevisionId:entry.eligibilityRevisionId,recipeRevisionId:entry.recipeRevisionId,
        compositionPolicyRevision:input.compositionPolicyRevision,role:entry.role,anchorKind:entry.anchorKind,
        allowedMealTypes:entry.allowedMealTypes,requiredCompanionRoleSets:entry.requiredCompanionRoleSets,
        pairingTags:entry.pairingTags,incompatiblePairingTags:entry.incompatiblePairingTags,repeatFamily:entry.repeatFamily,
        energyClass:entry.energyClass,beverageClass:entry.beverageClass},recipeRevision:entry.recipeRevisionId,
        portionRevision:entry.portionRevisionId,recipe,assignedPortion:{source:'potok_generator',portionRevisionId:entry.portionRevisionId,
          assignedServings:assigned,servingMultiplier:scaled.scaleFactor,assignedGrams:assigned==='1.000'?'100.000':'200.000'},
        ingredients:scaled.ingredients,nutrition:scaled.nutrition};
      const high={calories:'9999.000',protein:'9999.000',fat:'9999.000',carbs:'9999.000',fiber:'9999.000'};
      const result=await composeAdaptiveMealV1({mealSlotId:required.slotId,mealSnapshotRevision:id(80+required.sortOrder),
        mealType:required.mealType,goalRevision:input.goalNutritionTarget.goalRevision,goalProfile:'MAINTENANCE',policy,
        slotTarget:scaled.nutrition,slotHardMaximum:high,currentDayNutrition:zero,dayTarget:high,dayHardMaximum:high,
        excludedRecipeRevisions:[],excludedRepeatFamilies:[],candidates:[candidate]});
      assert.equal(result.status,'COMPLETE');if(result.status!=='COMPLETE') throw new Error('fixture_meal_incomplete');
      slots.push({slotId:required.slotId,civilDate:distribution.date,mealType:required.mealType,sortOrder:required.sortOrder,
        sourceKind:'COMPLETE_RECIPE',mealSnapshotRevision:result.meal.mealSnapshotRevision,mealSnapshot:result.meal,
        validationResultDigest:h('a'),generatorDecisionEvidence:{decisionPath:'COMPLETE_RECIPE',
          generationPolicyRevision:input.generationPolicyRevision,candidateManifestDigest:input.candidateManifestDigest,
          candidateSetDigest:h('b'),selectedCandidateDigest:h('c'),optimizationResultDigest:h('d')},
        goalRevision:input.goalNutritionTarget.goalRevision,targetPolicyRevision:input.goalNutritionTarget.targetPolicyRevision,
        compositionPolicyRevision:input.compositionPolicyRevision,validationPolicyRevision:input.validationPolicyRevision,
        optimizationPolicyRevision:input.optimizationPolicyRevision,catalogManifestRevision:input.candidateManifestRevision,
        componentEvidence:[{mealComponentId:component.mealComponentId,eligibilityRevisionId:component.eligibilityRevisionId,
          publicationRevision:component.publicationRevision,canonicalEvidenceRevision:component.canonicalEvidenceRevision,
          nutritionEvidenceRevision:component.nutritionEvidenceRevision,allergenEvidenceRevision:component.allergenEvidenceRevision,
          dietaryEvidenceRevision:component.dietaryEvidenceRevision,evidenceDigest:component.digest}]});
    }
    const nutritionTotal=Object.fromEntries(Object.keys(zero).map(key=>{
      const total=slots.reduce((sum,slot)=>sum+BigInt(slot.mealSnapshot.nutrition[key as keyof GraphNutritionV1].replace('.','')),0n);
      return [key,`${total/1000n}.${String(total%1000n).padStart(3,'0')}`];
    })) as unknown as GraphNutritionV1;
    days.push({date:distribution.date,dayIndex,slots,nutritionTotal,validationResultDigest:h('e')});
  }
  const graph=await sealAdaptiveNutritionGraphV2({contract:adaptiveNutritionGraphContractV2,contractVersion:2,
    selectionId:input.selection.selectionId,planSelectionRevision:input.selection.planSelectionRevision,
    planRevision:input.selection.proposedPlanRevision,weekStartLocal:input.weekStartLocal,timezone:input.timezone,
    goalRevision:input.goalNutritionTarget.goalRevision,targetPolicyRevision:input.goalNutritionTarget.targetPolicyRevision,
    goalNutritionTarget:input.goalNutritionTarget,preferenceRevision:input.preferenceRevision,safetyRevision:input.safetyRevision,
    catalogManifestRevision:input.candidateManifestRevision,candidateManifestDigest:input.candidateManifestDigest,
    compositionPolicyRevision:input.compositionPolicyRevision,validationPolicyRevision:input.validationPolicyRevision,
    optimizationPolicyRevision:input.optimizationPolicyRevision,generationPolicyRevision:input.generationPolicyRevision,
    days,weekValidationResultDigest:h('f'),weekOptimizationResultDigest:h('a')});
  return bindGeneratedWeekPlanV1(input,graph);
}

const explicitSignals: MealWarningSignalsV1 = { softTargetFitDeviation:false, longPreparationBurden:false,
  shoppingListBurden:false, lowerConvenienceScore:false, repetitionApproachingLimit:false };
const signalNames = Object.keys(explicitSignals) as Array<keyof MealWarningSignalsV1>;
function sealEntry(content: Omit<MealWarningEvidenceV1,'digest'>): MealWarningEvidenceV1 {
  return {...content,digest:createHash('sha256').update(fixtureCanonical({contract:mealWarningEvidenceContractV1,
    encoding:mealWarningEvidenceEncodingV1,evidence:content}),'utf8').digest('hex')};
}
function sealSet(content: Omit<TrustedMealWarningEvidenceSetV1,'digest'>): TrustedMealWarningEvidenceSetV1 {
  return {...content,digest:createHash('sha256').update(fixtureCanonical({contract:trustedMealWarningEvidenceSetContractV1,
    encoding:trustedMealWarningEvidenceSetEncodingV1,evidence:content}),'utf8').digest('hex')};
}
function resignEntry(entry: MealWarningEvidenceV1): MealWarningEvidenceV1 { return sealEntry(withoutDigest(entry)); }
function resignSet(set: TrustedMealWarningEvidenceSetV1): string { return JSON.stringify(sealSet(withoutDigest(set))); }
async function warningFixture(twoSlots=false) {
  const f=await fixture();
  let evidence=JSON.parse(f.rawContext.trustedValidationEvidenceRaw);
  if(twoSlots) {
    const context={input:JSON.parse(f.inputRaw),manifest:JSON.parse(f.rawContext.candidateManifestRaw),
      preference:JSON.parse(f.rawContext.preferenceSnapshotRaw),safety:JSON.parse(f.rawContext.safetySnapshotRaw)};
    const content=withoutDigest(evidence);
    const component=await sealComponentValidationEvidenceV1({...withoutDigest(evidence.components[0]),
      slotId:id(60),mealComponentId:id(61)} as Parameters<typeof sealComponentValidationEvidenceV1>[0]);
    const day=evidence.distributionPolicy.days[0];
    day.requiredSlots.push({slotId:id(60),sortOrder:1,mealType:'dinner'});
    day.nutritionBounds.push({...day.nutritionBounds[0],slotId:id(60)});
    day.requirements.push({...day.requirements[0],slotId:id(60)});
    day.distributionBounds.push({...day.distributionBounds[0],slotId:id(60),sortOrder:1});
    evidence=await sealTrustedValidationEvidenceV1({...content,components:[...evidence.components,component]} as
      Parameters<typeof sealTrustedValidationEvidenceV1>[0],context);
    f.rawContext.trustedValidationEvidenceRaw=JSON.stringify(evidence);
    f.contextRaw=JSON.stringify(f.rawContext);
    f.aggregateRaw=JSON.stringify(fixtureSeal({...withoutDigest(f.aggregate),validationEvidenceDigest:evidence.digest},
      trustedValidationPoliciesContractV1,trustedValidationPoliciesEncodingV1));
    f.aggregate=await decodeTrustedValidationPoliciesRawV2(f.aggregateRaw,f.contextRaw);
  }
  const plan=await evaluatedPlanFixture(JSON.parse(f.inputRaw),evidence,JSON.parse(f.rawContext.candidateManifestRaw),f.composition.policy);
  const mealDigests=new Map(plan.graph.days.flatMap(day=>day.slots.map(slot=>[slot.slotId,slot.mealSnapshot.digest] as const)));
  const entries: MealWarningEvidenceV1[]=evidence.distributionPolicy.days.flatMap((day: {requiredSlots: Array<{slotId:string}>})=>
    day.requiredSlots.map((slot)=>sealEntry({contract:mealWarningEvidenceContractV1,slotId:slot.slotId,
      validationPolicyRevision:JSON.parse(f.inputRaw).validationPolicyRevision,validationEvidenceDigest:evidence.digest,
      mealSnapshotDigest:mealDigests.get(slot.slotId)!,signals:{...explicitSignals},evidenceRevision:id(70)})));
  entries.sort((a,b)=>a.slotId<b.slotId?-1:a.slotId>b.slotId?1:0);
  const set=sealSet({contract:trustedMealWarningEvidenceSetContractV1,validationEvidenceDigest:evidence.digest,
    validationPoliciesDigest:f.aggregate.digest,entries});
  return {...f,plan,planRaw:JSON.stringify(plan),entry:entries[0],set,setRaw:JSON.stringify(set),entryRaw:JSON.stringify(entries[0])};
}

test('complete raw warning evidence set, all false explicit, immutable owned output',async()=>{
  const f=await warningFixture(true);
  const decoded=await decodeTrustedMealWarningEvidenceSetRawV1(f.setRaw,f.aggregateRaw,f.contextRaw,f.planRaw);
  assert.deepEqual(decoded,f.set);assert.equal(decoded.entries.length,2);
  assert.ok(Object.isFrozen(decoded));assert.ok(Object.isFrozen(decoded.entries));
  assert.ok(Object.isFrozen(decoded.entries[0]));assert.ok(Object.isFrozen(decoded.entries[0].signals));
  assert.deepEqual(decoded.entries[0].signals,explicitSignals);
});
test('entry and aggregate canonical envelopes independently verify SHA-256',async()=>{
  const f=await warningFixture();
  for(const [bytes,digest,contract,encoding] of [
    [await mealWarningEvidenceCanonicalBytesRawV1(f.entryRaw,f.aggregateRaw,f.contextRaw,f.planRaw),f.entry.digest,
      mealWarningEvidenceContractV1,mealWarningEvidenceEncodingV1],
    [await trustedMealWarningEvidenceSetCanonicalBytesRawV1(f.setRaw,f.aggregateRaw,f.contextRaw,f.planRaw),f.set.digest,
      trustedMealWarningEvidenceSetContractV1,trustedMealWarningEvidenceSetEncodingV1],
  ] as const) {
    assert.equal(createHash('sha256').update(bytes).digest('hex'),digest);
    const envelope=JSON.parse(new TextDecoder().decode(bytes));assert.equal(envelope.contract,contract);assert.equal(envelope.encoding,encoding);
    assert.equal('digest' in envelope.evidence,false);
  }
});
test('object key order does not change canonical bytes or digest',async()=>{
  const f=await warningFixture();
  const reverse=(v:unknown):unknown=>Array.isArray(v)?v.map(reverse):v&&typeof v==='object'
    ?Object.fromEntries(Object.entries(v).reverse().map(([k,x])=>[k,reverse(x)])):v;
  assert.deepEqual(await trustedMealWarningEvidenceSetCanonicalBytesRawV1(JSON.stringify(reverse(f.set)),f.aggregateRaw,f.contextRaw,f.planRaw),
    await trustedMealWarningEvidenceSetCanonicalBytesRawV1(f.setRaw,f.aggregateRaw,f.contextRaw,f.planRaw));
});
for(const signal of signalNames) {
  test(`${signal}: explicit true admitted, entry/set digests change independently`,async()=>{
    const f=await warningFixture();const entry=resignEntry({...f.entry,signals:{...explicitSignals,[signal]:true}});
    const changed=sealSet({...withoutDigest(f.set),entries:[entry]});
    assert.notEqual(entry.digest,f.entry.digest);assert.notEqual(changed.digest,f.set.digest);
    assert.deepEqual(await decodeTrustedMealWarningEvidenceSetRawV1(JSON.stringify(changed),f.aggregateRaw,f.contextRaw,f.planRaw),changed);
    // The fixture's allowedWarningCodes excludes this signal's warning; evidence must still preserve true.
    assert.equal(changed.entries[0].signals[signal],true);
  });
  test(`${signal}: missing boolean rejects without default`,async()=>{
    const f=await warningFixture();const signals:Record<string,unknown>={...explicitSignals};delete signals[signal];
    await assert.rejects(decodeMealWarningEvidenceRawV1(JSON.stringify({...f.entry,signals}),f.aggregateRaw,f.contextRaw,f.planRaw),/INVALID_WARNING_EVIDENCE_FIELDS/);
  });
  test(`${signal}: boolean coercion rejected`,async()=>{
    const f=await warningFixture();
    for(const value of ['false',0,null]) await assert.rejects(decodeMealWarningEvidenceRawV1(
      JSON.stringify({...f.entry,signals:{...explicitSignals,[signal]:value}}),f.aggregateRaw,f.contextRaw,f.planRaw),/INVALID_WARNING_SIGNAL_TYPE/);
  });
}
test('multiple true signals preserved with no computed defaults',async()=>{
  const f=await warningFixture();const entry=resignEntry({...f.entry,signals:Object.fromEntries(signalNames.map(k=>[k,true])) as unknown as MealWarningSignalsV1});
  assert.deepEqual(await decodeMealWarningEvidenceRawV1(JSON.stringify(entry),f.aggregateRaw,f.contextRaw,f.planRaw),entry);
});
for(const [name,mutate,error] of [
  ['unknown slot',(v:Record<string,unknown>)=>{v.slotId=id(999);},'WARNING_SLOT_UNKNOWN'],
  ['policy revision',(v:Record<string,unknown>)=>{v.validationPolicyRevision=id(999);},'WARNING_VALIDATION_POLICY_MISMATCH'],
  ['evidence digest',(v:Record<string,unknown>)=>{v.validationEvidenceDigest=h('e');},'WARNING_VALIDATION_EVIDENCE_MISMATCH'],
  ['digest tamper',(v:Record<string,unknown>)=>{v.digest=h('f');},'WARNING_EVIDENCE_DIGEST_MISMATCH'],
  ['unknown field',(v:Record<string,unknown>)=>{v.extra=false;},'INVALID_WARNING_EVIDENCE_FIELDS'],
  ['missing evidenceRevision',(v:Record<string,unknown>)=>{delete v.evidenceRevision;},'INVALID_WARNING_EVIDENCE_FIELDS'],
  ['bad evidenceRevision',(v:Record<string,unknown>)=>{v.evidenceRevision='not-a-uuid';},'INVALID_WARNING_EVIDENCE_UUID'],
  ['wrong contract',(v:Record<string,unknown>)=>{v.contract='other';},'INVALID_WARNING_EVIDENCE_CONTRACT'],
] as const) test(`entry rejects ${name}`,async()=>{
  const f=await warningFixture();const bad={...f.entry};mutate(bad);await assert.rejects(
    decodeMealWarningEvidenceRawV1(JSON.stringify(bad),f.aggregateRaw,f.contextRaw,f.planRaw),new RegExp(error));
});
test('unknown or missing signals object rejected',async()=>{
  const f=await warningFixture();
  await assert.rejects(decodeMealWarningEvidenceRawV1(JSON.stringify({...f.entry,signals:{...explicitSignals,extra:false}}),f.aggregateRaw,f.contextRaw,f.planRaw));
  const bad:Record<string,unknown>={...f.entry};delete bad.signals;
  await assert.rejects(decodeMealWarningEvidenceRawV1(JSON.stringify(bad),f.aggregateRaw,f.contextRaw,f.planRaw));
});
for(const [name,mutate,error] of [
 ['duplicate slot',(v: {entries:MealWarningEvidenceV1[]})=>{v.entries=[v.entries[0],v.entries[0]];},'WARNING_SLOT_DUPLICATE'],
 ['missing slot',(v: {entries:MealWarningEvidenceV1[]})=>{v.entries.pop();},'WARNING_SLOT_COVERAGE_MISMATCH'],
 ['noncanonical order',(v: {entries:MealWarningEvidenceV1[]})=>{v.entries.reverse();},'WARNING_SLOT_ORDER_INVALID'],
 ['extra slot',(v: {entries:MealWarningEvidenceV1[]})=>{v.entries.push(resignEntry({...v.entries[0],slotId:id(999)}));},'WARNING_SLOT_UNKNOWN'],
] as const) test(`set rejects ${name}`,async()=>{
 const f=await warningFixture(true);const bad={...f.set,entries:f.set.entries.map(entry=>structuredClone(entry))};mutate(bad);
 await assert.rejects(decodeTrustedMealWarningEvidenceSetRawV1(resignSet(bad),f.aggregateRaw,f.contextRaw,f.planRaw),new RegExp(error));
});
for(const [field,value,error] of [
 ['validationEvidenceDigest',h('e'),'WARNING_VALIDATION_EVIDENCE_MISMATCH'],
 ['validationPoliciesDigest',h('e'),'WARNING_VALIDATION_POLICIES_MISMATCH'],
 ['digest',h('e'),'WARNING_EVIDENCE_DIGEST_MISMATCH'],
 ['contract','other','INVALID_WARNING_SET_CONTRACT'],
 ['entries',{},'INVALID_WARNING_ENTRIES'],
] as const) test(`set rejects altered ${field}`,async()=>{
 const f=await warningFixture();await assert.rejects(decodeTrustedMealWarningEvidenceSetRawV1(
  JSON.stringify({...f.set,[field]:value}),f.aggregateRaw,f.contextRaw,f.planRaw),new RegExp(error));
});
test('set missing/unknown fields rejected',async()=>{
 const f=await warningFixture();
 for(const key of Object.keys(f.set)) {const bad:Record<string,unknown>={...f.set};delete bad[key];
   await assert.rejects(decodeTrustedMealWarningEvidenceSetRawV1(JSON.stringify(bad),f.aggregateRaw,f.contextRaw,f.planRaw),/INVALID_WARNING_EVIDENCE_FIELDS/);}
 await assert.rejects(decodeTrustedMealWarningEvidenceSetRawV1(JSON.stringify({...f.set,extra:true}),f.aggregateRaw,f.contextRaw,f.planRaw));
});
test('re-signed proposed warning substitution rejected against separately pinned set',async()=>{
 const f=await warningFixture();const changed=resignSet({...f.set,entries:[resignEntry({...f.entry,signals:{...explicitSignals,longPreparationBurden:true}})]});
 await assert.rejects(assertTrustedMealWarningEvidenceSetPinnedRawV1(changed,f.setRaw,f.aggregateRaw,f.contextRaw,f.planRaw),/WARNING_EVIDENCE_SUBSTITUTION/);
 assert.deepEqual(await assertTrustedMealWarningEvidenceSetPinnedRawV1(f.setRaw,f.setRaw,f.aggregateRaw,f.contextRaw,f.planRaw),f.set);
});
test('duplicate raw keys, escaped equivalents and nested signals fail before digest checks',async()=>{
 const f=await warningFixture();
 for(const raw of [f.entryRaw.replace('{','{"contract":null,'),f.entryRaw.replace('{','{"\\u0063ontract":null,'),
   f.entryRaw.replace('"softTargetFitDeviation":false','"softTargetFitDeviation":false,"softTargetFitDeviation":true')]) {
  await assert.rejects(decodeMealWarningEvidenceRawV1(raw,f.aggregateRaw,f.contextRaw,f.planRaw),/Duplicate JSON key/);
 }
 await assert.rejects(decodeTrustedMealWarningEvidenceSetRawV1(f.setRaw.replace('{','{"contract":null,'),f.aggregateRaw,f.contextRaw,f.planRaw),/Duplicate JSON key/);
});
for(const field of ['trustedGenerationInputRaw','candidateManifestRaw','preferenceSnapshotRaw','safetySnapshotRaw','trustedValidationEvidenceRaw'] as const)
 test(`nested authority ${field} retains duplicate-aware primitive-string boundary`,async()=>{
  const f=await warningFixture();
  const duplicate={...f.rawContext,[field]:f.rawContext[field].replace('{','{"contract":null,')};
  await assert.rejects(decodeTrustedMealWarningEvidenceSetRawV1(f.setRaw,f.aggregateRaw,JSON.stringify(duplicate),f.planRaw),/Duplicate JSON key/);
  const object={...f.rawContext,[field]:JSON.parse(f.rawContext[field])};
  await assert.rejects(decodeTrustedMealWarningEvidenceSetRawV1(f.setRaw,f.aggregateRaw,JSON.stringify(object),f.planRaw),/RAW_JSON_STRING_REQUIRED/);
 });
test('policy/context raw boundaries remain exact and reject policy substitution/digest tamper',async()=>{
 const f=await warningFixture();
 await assert.rejects(decodeTrustedMealWarningEvidenceSetRawV1(f.setRaw,f.aggregateRaw.replace('{','{"contract":null,'),f.contextRaw,f.planRaw),/Duplicate JSON key/);
 await assert.rejects(decodeTrustedMealWarningEvidenceSetRawV1(f.setRaw,f.aggregateRaw,f.contextRaw.replace('{','{"contract":null,'),f.planRaw),/Duplicate JSON key/);
 const changed=fixtureSeal({...withoutDigest(f.aggregate),balance:fixtureSeal({...withoutDigest(f.balance),
   policy:{...f.balance.policy,allowedWarningCodes:[]}},balancePolicySnapshotContractV1,balancePolicySnapshotEncodingV1)},
   trustedValidationPoliciesContractV1,trustedValidationPoliciesEncodingV1);
 await assert.rejects(decodeTrustedMealWarningEvidenceSetRawV1(f.setRaw,JSON.stringify(changed),f.contextRaw,f.planRaw),/WARNING_VALIDATION_POLICIES_MISMATCH/);
});
test('every public argument rejects object/Proxy/wrapper/coercion without touching traps',async()=>{
 const f=await warningFixture();let traps=0;const hit=()=>{traps++;throw new Error('TRAP_CALLED');};
 const proxy=new Proxy({}, {get:hit,ownKeys:hit,getOwnPropertyDescriptor:hit,getPrototypeOf:hit});
 const arrayProxy=new Proxy(['UNKNOWN_ROLE'],{get:hit,ownKeys:hit,getOwnPropertyDescriptor:hit,getPrototypeOf:hit});
 const callableProxy=new Proxy(()=>undefined,{get:hit,apply:hit,ownKeys:hit,getOwnPropertyDescriptor:hit,getPrototypeOf:hit});
 const revoked=Proxy.revocable({},{});revoked.revoke();
 const coercion={toJSON:hit,toString:hit,valueOf:hit};
 const apis:Array<[ (...args:string[])=>Promise<unknown>,string[]]>=[
  [decodeMealWarningEvidenceRawV1,[f.entryRaw,f.aggregateRaw,f.contextRaw,f.planRaw]],
  [decodeTrustedMealWarningEvidenceSetRawV1,[f.setRaw,f.aggregateRaw,f.contextRaw,f.planRaw]],
  [mealWarningEvidenceCanonicalBytesRawV1,[f.entryRaw,f.aggregateRaw,f.contextRaw,f.planRaw]],
  [trustedMealWarningEvidenceSetCanonicalBytesRawV1,[f.setRaw,f.aggregateRaw,f.contextRaw,f.planRaw]],
  [assertTrustedMealWarningEvidenceSetPinnedRawV1,[f.setRaw,f.setRaw,f.aggregateRaw,f.contextRaw,f.planRaw]],
 ];
 for(const [api,args] of apis) for(let index=0;index<args.length;index++) {
  for(const hostile of [{},[],proxy,arrayProxy,callableProxy,revoked.proxy,coercion,new String(f.entryRaw),0,true,null,undefined,()=>undefined]) {
   const bad=[...args];bad[index]=hostile as unknown as string;
   await assert.rejects(api(...bad),/RAW_JSON_STRING_REQUIRED/);
  }
 }
 assert.equal(traps,0);
});
test('empty required-slot package admits an explicit empty set, no synthesized slots',async()=>{
 const f=await warningFixture();const context={input:JSON.parse(f.inputRaw),manifest:JSON.parse(f.rawContext.candidateManifestRaw),
  preference:JSON.parse(f.rawContext.preferenceSnapshotRaw),safety:JSON.parse(f.rawContext.safetySnapshotRaw)};
 const evidence=JSON.parse(f.rawContext.trustedValidationEvidenceRaw);
 for(const day of evidence.distributionPolicy.days) {day.requiredSlots=[];day.nutritionBounds=[];day.requirements=[];day.distributionBounds=[];}
 evidence.components=[];evidence.planEligibility=[];
 const empty=await sealTrustedValidationEvidenceV1(withoutDigest(evidence) as Parameters<typeof sealTrustedValidationEvidenceV1>[0],context);
 const rawContext=JSON.stringify({...f.rawContext,trustedValidationEvidenceRaw:JSON.stringify(empty)});
 const policies=fixtureSeal({...withoutDigest(f.aggregate),validationEvidenceDigest:empty.digest},trustedValidationPoliciesContractV1,trustedValidationPoliciesEncodingV1);
 const emptyPlanRaw=JSON.stringify(await evaluatedPlanFixture(context.input,empty,context.manifest,f.composition.policy));
 const set=sealSet({contract:trustedMealWarningEvidenceSetContractV1,validationEvidenceDigest:empty.digest,validationPoliciesDigest:policies.digest,entries:[]});
 assert.deepEqual(await decodeTrustedMealWarningEvidenceSetRawV1(JSON.stringify(set),JSON.stringify(policies),rawContext,emptyPlanRaw),set);
});
test('runtime/AST export audit: five raw-only functions, four constants; policy integration uses RawV2 only',()=>{
 const functions=Object.entries(warningModule).filter(([,v])=>typeof v==='function').map(([k])=>k).sort();
 assert.deepEqual(functions,['decodeMealWarningEvidenceRawV1','decodeTrustedMealWarningEvidenceSetRawV1',
  'mealWarningEvidenceCanonicalBytesRawV1','trustedMealWarningEvidenceSetCanonicalBytesRawV1','assertTrustedMealWarningEvidenceSetPinnedRawV1'].sort());
 assert.equal(Object.keys(warningModule).length,9);
 const source=readFileSync(new URL('../trustedMealWarningEvidenceV1.ts',import.meta.url),'utf8');
 const ast=ts.createSourceFile('warning.ts',source,ts.ScriptTarget.Latest,true);
 for(const node of ast.statements) if(ts.isFunctionDeclaration(node)&&node.modifiers?.some(m=>m.kind===ts.SyntaxKind.ExportKeyword)) {
  for(const param of node.parameters) assert.equal(param.type?.kind,ts.SyntaxKind.StringKeyword);
 }
 const policyImport=ast.statements.filter(ts.isImportDeclaration).find(n=>n.moduleSpecifier.getText().includes('trustedValidationPoliciesV1'));
 assert.match(policyImport?.getText()??'',/decodeTrustedValidationPoliciesRawV2/);
 assert.doesNotMatch(source,/decode(?:Composition|Balance|Aggregate)Owned|sealTrustedValidationPolicies|node:/);
});

test('same evaluated slot/meal and independently pinned authorities admit the same warning package',async()=>{
  const f=await warningFixture();
  const again=await evaluatedPlanFixture(JSON.parse(f.inputRaw),JSON.parse(f.rawContext.trustedValidationEvidenceRaw),
    JSON.parse(f.rawContext.candidateManifestRaw),f.composition.policy);
  assert.equal(again.graph.days[0].slots[0].mealSnapshot.digest,f.entry.mealSnapshotDigest);
  assert.deepEqual(await decodeTrustedMealWarningEvidenceSetRawV1(f.setRaw,f.aggregateRaw,f.contextRaw,JSON.stringify(again)),f.set);
});
for(const [name,options] of [
  ['assigned servings',{assigned:'2.000'}],
  ['meal nutrition',{changedNutrition:true}],
  ['component/meal content',{changedContent:true}],
] as const) test(`warning evidence from graph A cannot replay on self-consistent graph B: ${name}`,async()=>{
  const f=await warningFixture();const input=JSON.parse(f.inputRaw);
  const changed=await evaluatedPlanFixture(input,JSON.parse(f.rawContext.trustedValidationEvidenceRaw),
    JSON.parse(f.rawContext.candidateManifestRaw),f.composition.policy,options);
  // Every changed candidate passes the existing strict Graph/meal/input/digest boundary.
  assert.deepEqual(await decodeGeneratedWeekPlanV1(changed,input),changed);
  const meal=changed.graph.days[0].slots[0].mealSnapshot;
  assert.notEqual(meal.digest,f.entry.mealSnapshotDigest);
  assert.equal(changed.generationInputDigest,f.plan.generationInputDigest);
  assert.equal(changed.graph.days[0].slots[0].slotId,f.entry.slotId);
  assert.deepEqual(changed.graph.days[0].slots[0].componentEvidence,f.plan.graph.days[0].slots[0].componentEvidence);
  const raw=JSON.stringify(changed);
  await assert.rejects(decodeMealWarningEvidenceRawV1(f.entryRaw,f.aggregateRaw,f.contextRaw,raw),/WARNING_MEAL_STATE_MISMATCH/);
  await assert.rejects(decodeTrustedMealWarningEvidenceSetRawV1(f.setRaw,f.aggregateRaw,f.contextRaw,raw),/WARNING_MEAL_STATE_MISMATCH/);
  await assert.rejects(trustedMealWarningEvidenceSetCanonicalBytesRawV1(f.setRaw,f.aggregateRaw,f.contextRaw,raw),/WARNING_MEAL_STATE_MISMATCH/);
  const boundEntry=resignEntry({...f.entry,mealSnapshotDigest:meal.digest});
  const boundSet=resignSet({...f.set,entries:[boundEntry]});
  assert.notEqual(boundEntry.digest,f.entry.digest);
  assert.notEqual(JSON.parse(boundSet).digest,f.set.digest);
  assert.deepEqual(await decodeTrustedMealWarningEvidenceSetRawV1(boundSet,f.aggregateRaw,f.contextRaw,raw),JSON.parse(boundSet));
  await assert.rejects(assertTrustedMealWarningEvidenceSetPinnedRawV1(f.setRaw,boundSet,f.aggregateRaw,f.contextRaw,raw),/WARNING_MEAL_STATE_MISMATCH/);
  await assert.rejects(assertTrustedMealWarningEvidenceSetPinnedRawV1(f.setRaw,f.setRaw,f.aggregateRaw,f.contextRaw,raw),/WARNING_MEAL_STATE_MISMATCH/);
});
test('evaluated meal digest must be explicit, correct type and recomputed from evaluated plan',async()=>{
  const f=await warningFixture();
  const missing:Record<string,unknown>={...f.entry};delete missing.mealSnapshotDigest;
  await assert.rejects(decodeMealWarningEvidenceRawV1(JSON.stringify(missing),f.aggregateRaw,f.contextRaw,f.planRaw),/INVALID_WARNING_EVIDENCE_FIELDS/);
  for(const mealSnapshotDigest of [null,0,'invalid',h('b')]) await assert.rejects(decodeMealWarningEvidenceRawV1(
    JSON.stringify({...f.entry,mealSnapshotDigest}),f.aggregateRaw,f.contextRaw,f.planRaw),/WARNING_MEAL_STATE_MISMATCH/);
});
test('evaluated plan is duplicate-aware raw JSON, never an arbitrary object',async()=>{
 const f=await warningFixture();
 await assert.rejects(decodeTrustedMealWarningEvidenceSetRawV1(f.setRaw,f.aggregateRaw,f.contextRaw,
  f.planRaw.replace('{','{"contract":null,')),/Duplicate JSON key/);
 await assert.rejects(decodeTrustedMealWarningEvidenceSetRawV1(f.setRaw,f.aggregateRaw,f.contextRaw,
  f.planRaw.replace('"assignedServings":"1.000"','"assignedServings":"1.000","assignedServings":"2.000"')),/Duplicate JSON key/);
 const bad=structuredClone(f.plan);bad.graph.days[0].slots[0].mealSnapshot.digest=h('a');
 await assert.rejects(decodeTrustedMealWarningEvidenceSetRawV1(f.setRaw,f.aggregateRaw,f.contextRaw,JSON.stringify(bad)),/meal_digest_mismatch/);
});
test('evaluated Graph must contain exactly the required slot/date/order/type coverage',async()=>{
 const f=await warningFixture();const graph=structuredClone(f.plan.graph);graph.days[0].slots=[];graph.days[0].nutritionTotal=zero;
 const changed=await bindGeneratedWeekPlanV1(JSON.parse(f.inputRaw),graph);
 await assert.rejects(decodeTrustedMealWarningEvidenceSetRawV1(f.setRaw,f.aggregateRaw,f.contextRaw,JSON.stringify(changed)),/WARNING_EVALUATED_SLOT_COVERAGE_MISMATCH/);
});
