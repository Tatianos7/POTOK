// Synthetic test-only fixtures; never a source of runtime publication or authority.
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
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
import { goalNutritionTargetContractV1, dayValidatorInputContractV1, mealValidatorInputContractV1,
  mealCandidateEvidenceContractV2, weekValidatorInputContractV2, validateWeekSnapshotWithChildResultsRawV2,
} from '../adaptiveNutritionMealBalanceV1';
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

import {
  mealWarningEvidenceContractV1, mealWarningEvidenceEncodingV1,
  trustedMealWarningEvidenceSetContractV1, trustedMealWarningEvidenceSetEncodingV1,
  type MealWarningSignalsV1, type MealWarningEvidenceV1, type TrustedMealWarningEvidenceSetV1,
} from '../trustedMealWarningEvidenceV1';
import { composeAdaptiveMealV1, adaptiveMealCompositionEligibilityV1_1, type MealCompositionPolicyV1 } from '../adaptiveNutritionMealCompositionV1';
import { scalePremiumRecipeCollectionV1 } from '../adaptiveNutritionGraphV1';
import { sealAdaptiveNutritionGraphV2, bindGeneratedWeekPlanV1,
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

import { validateGeneratedWeekPlanTrustedV1 } from '../trustedGeneratedWeekValidatorV1';
import { adaptiveNutritionGraphEncodingV2, type GeneratedWeekPlanV1 } from '../adaptiveNutritionGraphV2';
import { adaptiveMealCompositionContractV1_1, adaptiveMealCompositionEncodingV1_1 } from '../adaptiveNutritionMealCompositionV1';

type FixtureState = {
  context: Awaited<ReturnType<typeof evidenceFixture>>['context'];
  evidence: TrustedValidationEvidenceV1;
  composition: CompositionPolicySnapshotV1;
  balance: BalancePolicySnapshotV1;
};
function tuple(entry: {recipeId:string;recipeRevisionId:string;portionRevisionId:string;eligibilityRevisionId:string}) {
  return [entry.recipeId,entry.recipeRevisionId,entry.portionRevisionId,entry.eligibilityRevisionId].join(':');
}
function useRecipe(state: FixtureState, componentIndex: number, recipeIndex: number) {
  const entry=state.context.manifest.entries[recipeIndex];
  Object.assign(state.evidence.components[componentIndex],{
    recipeId:entry.recipeId,recipeRevisionId:entry.recipeRevisionId,portionRevisionId:entry.portionRevisionId,
    eligibilityRevisionId:entry.eligibilityRevisionId,ingredientFamilies:[entry.dominantIngredientFamily],
  });
}
function warningSetFor(plan:GeneratedWeekPlanV1,evidence:TrustedValidationEvidenceV1,policiesDigest:string) {
  const entries=plan.graph.days.flatMap(day=>day.slots.map(slot=>sealEntry({contract:mealWarningEvidenceContractV1,
    slotId:slot.slotId,validationPolicyRevision:evidence.validationPolicyRevision,validationEvidenceDigest:evidence.digest,
    mealSnapshotDigest:slot.mealSnapshot.digest,signals:{...explicitSignals},evidenceRevision:id(70)})))
    .sort((a,b)=>a.slotId<b.slotId?-1:a.slotId>b.slotId?1:0);
  return sealSet({contract:trustedMealWarningEvidenceSetContractV1,validationEvidenceDigest:evidence.digest,
    validationPoliciesDigest:policiesDigest,entries});
}
async function fullFixture(change: (state:FixtureState)=>void=()=>{},slotsPerDay=1) {
  const seed=await warningFixture();
  const context={input:JSON.parse(seed.inputRaw) as TrustedGenerationInputV1,
    manifest:JSON.parse(seed.rawContext.candidateManifestRaw) as AdaptiveNutritionCandidateManifestV2,
    preference:JSON.parse(seed.rawContext.preferenceSnapshotRaw) as Awaited<ReturnType<typeof sealNutritionPreferenceSnapshotV1>>,
    safety:JSON.parse(seed.rawContext.safetySnapshotRaw) as Awaited<ReturnType<typeof sealNutritionSafetySnapshotV1>>};
  const evidence=JSON.parse(seed.rawContext.trustedValidationEvidenceRaw) as TrustedValidationEvidenceV1;
  const entryTemplate=structuredClone(context.manifest.entries[0]);
  const componentTemplate=structuredClone(evidence.components[0]);
  const distributionTemplate=structuredClone(evidence.distributionPolicy.days[0]);
  context.manifest.entries=[]; evidence.components=[];
  for (let day=0;day<7;day++) {
    const distribution=evidence.distributionPolicy.days[day];
    distribution.requiredSlots=[];distribution.nutritionBounds=[];distribution.requirements=[];distribution.distributionBounds=[];
    for (let sortOrder=0;sortOrder<slotsPerDay;sortOrder++) {
      const ordinal=day*slotsPerDay+sortOrder; const offset=1000+ordinal*100;
      const entry=structuredClone(entryTemplate);
      Object.assign(entry,{recipeId:id(offset),recipeRevisionId:id(offset+1),portionRevisionId:id(offset+2),
        eligibilityRevisionId:id(offset+3),publicationRevision:id(offset+4),canonicalEvidenceRevision:id(offset+5),
        nutritionEvidenceRevision:id(offset+6),allergenEvidenceRevision:id(offset+7),dietaryEvidenceRevision:id(offset+8),
        repeatFamily:`family_${ordinal}`,dominantIngredientFamily:`ingredient_${ordinal}`});
      entry.recipeSnapshot.recipeId=entry.recipeId;entry.recipeSnapshot.recipeRevisionId=entry.recipeRevisionId;
      entry.recipeSnapshot.ingredients[0].componentId=id(offset+9);
      entry.recipeSnapshot.ingredients[0].recipeRevisionId=entry.recipeRevisionId;
      entry.recipeSnapshot.ingredients[0].identity={kind:'canonical_food',canonicalFoodId:id(offset+10)};
      entry.ingredientIds=[id(offset+10)];context.manifest.entries.push(entry);
      const component=structuredClone(componentTemplate);
      Object.assign(component,{recipeId:entry.recipeId,recipeRevisionId:entry.recipeRevisionId,portionRevisionId:entry.portionRevisionId,
        eligibilityRevisionId:entry.eligibilityRevisionId,slotId:id(offset+50),mealComponentId:id(offset+51),ingredientFamilies:[entry.dominantIngredientFamily]});
      evidence.components.push(component);
      distribution.requiredSlots.push({slotId:component.slotId,sortOrder,mealType:'dinner'});
      distribution.nutritionBounds.push({...structuredClone(distributionTemplate.nutritionBounds[0]),slotId:component.slotId});
      distribution.requirements.push({...structuredClone(distributionTemplate.requirements[0]),slotId:component.slotId});
      distribution.distributionBounds.push({...structuredClone(distributionTemplate.distributionBounds[0]),slotId:component.slotId,sortOrder});
    }
  }
  if(slotsPerDay>1) context.input.goalNutritionTarget.calories={min:'100.000',target:'250.000',max:'400.000'};
  const state:FixtureState={context,evidence,composition:structuredClone(seed.composition),balance:structuredClone(seed.balance)};
  change(state);
  for(const entry of context.manifest.entries) entry.recipeSnapshotDigest=await candidateRecipeSnapshotDigestV2(entry.recipeSnapshot);
  context.manifest=await sealAdaptiveNutritionCandidateManifestV2(withoutDigest(context.manifest));
  context.preference=await sealNutritionPreferenceSnapshotV1(withoutDigest(context.preference));
  context.safety=await sealNutritionSafetySnapshotV1(withoutDigest(context.safety));
  context.input.candidateManifestDigest=context.manifest.digest;context.input.candidateManifestRevision=context.manifest.manifestRevision;
  context.input.preferenceRevision=context.preference.revisionId;context.input.safetyRevision=context.safety.revisionId;
  evidence.generationInputDigest=await trustedGenerationInputDigestV1(context.input);
  evidence.candidateManifestDigest=context.manifest.digest;evidence.candidateManifestRevision=context.manifest.manifestRevision;
  evidence.preferenceRevision=context.preference.revisionId;evidence.preferenceDigest=context.preference.digest;
  evidence.safetyRevision=context.safety.revisionId;evidence.safetyDigest=context.safety.digest;
  evidence.ordinaryFallback.candidateManifestDigest=context.manifest.digest;
  evidence.ordinaryFallback.candidateManifestRevision=context.manifest.manifestRevision;
  for(let index=0;index<evidence.components.length;index++) {
    const component=evidence.components[index];const entry=context.manifest.entries.find(v=>tuple(v)===tuple(component))!;
    assert.ok(entry);
    for(const key of ['publicationRevision','canonicalEvidenceRevision','canonicalEvidenceDigest','nutritionEvidenceRevision',
      'nutritionEvidenceDigest','allergenEvidenceRevision','dietaryEvidenceRevision'] as const) component[key]=entry[key];
    evidence.components[index]=await sealComponentValidationEvidenceV1(withoutDigest(component));
  }
  const identities=new Map(evidence.components.map(component=>[tuple(component),component]));
  evidence.planEligibility=await Promise.all([...identities].sort(([a],[b])=>a<b?-1:a>b?1:0).map(([,component])=>
    sealPlanEligibilityEvidenceV1({contract:planEligibilityEvidenceContractV1,recipeId:component.recipeId,recipeRevisionId:component.recipeRevisionId,
      portionRevisionId:component.portionRevisionId,eligibilityRevisionId:component.eligibilityRevisionId,planEligible:true,evidenceRevision:id(53)})));
  const pinnedEvidence=await sealTrustedValidationEvidenceV1(withoutDigest(evidence),context);
  const composition=fixtureSeal(withoutDigest(state.composition),compositionPolicySnapshotContractV1,compositionPolicySnapshotEncodingV1);
  const balance=fixtureSeal(withoutDigest(state.balance),balancePolicySnapshotContractV1,balancePolicySnapshotEncodingV1);
  const aggregate=fixtureSeal({contract:trustedValidationPoliciesContractV1,generationInputDigest:pinnedEvidence.generationInputDigest,
    validationEvidenceDigest:pinnedEvidence.digest,composition,balance},trustedValidationPoliciesContractV1,trustedValidationPoliciesEncodingV1);
  const rawContext:TrustedValidationPoliciesRawContextV2={contract:trustedValidationPoliciesRawBoundaryContractV2,
    trustedGenerationInputRaw:JSON.stringify(context.input),candidateManifestRaw:JSON.stringify(context.manifest),
    preferenceSnapshotRaw:JSON.stringify(context.preference),safetySnapshotRaw:JSON.stringify(context.safety),
    trustedValidationEvidenceRaw:JSON.stringify(pinnedEvidence)};
  const contextRaw=JSON.stringify(rawContext);const policiesRaw=JSON.stringify(aggregate);
  await decodeTrustedValidationPoliciesRawV2(policiesRaw,contextRaw);
  const plan=await evaluatedPlanFixture(context.input,pinnedEvidence,context.manifest,seed.composition.policy);
  const set=warningSetFor(plan,pinnedEvidence,aggregate.digest);
  const full = {context,evidence:pinnedEvidence,policies:aggregate,plan,set,rawContext,contextRaw,policiesRaw,
    planRaw:JSON.stringify(plan),warningRaw:JSON.stringify(set)};
  await bindFixtureValidationDigests(full);
  return full;
}
type FullFixture=Awaited<ReturnType<typeof fullFixture>>;
function check(f:FullFixture) {return validateGeneratedWeekPlanTrustedV1(f.planRaw,f.policiesRaw,f.contextRaw,f.warningRaw);}
function rawHash(value:unknown) {return createHash('sha256').update(fixtureCanonical(value),'utf8').digest('hex');}
// Independent test signing can represent hostile, internally self-consistent candidates;
// production uses only the accepted strict decoders and never these fixture builders.
function resignPlan(f:FullFixture,refreshWarnings=true) {
  for(const day of f.plan.graph.days) {
    for(const slot of day.slots) {
      const meal=slot.mealSnapshot;
      meal.digest=rawHash({encoding:adaptiveMealCompositionEncodingV1_1,contract:adaptiveMealCompositionContractV1_1,meal:withoutDigest(meal)});
      const {canonicalSnapshotDigest,...content}=slot;assert.equal(typeof canonicalSnapshotDigest,'string');
      slot.canonicalSnapshotDigest=rawHash({contract:adaptiveNutritionGraphContractV2,slot:content});
    }
    day.nutritionTotal=Object.fromEntries(Object.keys(zero).map(key=>{
      const value=day.slots.reduce((sum,slot)=>sum+BigInt(slot.mealSnapshot.nutrition[key as keyof GraphNutritionV1].replace('.','')),0n);
      return [key,`${value/1000n}.${String(value%1000n).padStart(3,'0')}`];
    })) as unknown as GraphNutritionV1;
  }
  f.plan.graphDigest=rawHash({encoding:adaptiveNutritionGraphEncodingV2,contract:adaptiveNutritionGraphContractV2,graph:f.plan.graph});
  const {deterministicContentDigest,...content}=f.plan;assert.equal(typeof deterministicContentDigest,'string');
  f.plan.deterministicContentDigest=rawHash(content);f.planRaw=JSON.stringify(f.plan);
  if(refreshWarnings) {f.set=warningSetFor(f.plan,f.evidence,f.policies.digest);f.warningRaw=JSON.stringify(f.set);}
}
async function rejected(f:FullFixture,code?:string) {
  const result=await check(f);assert.equal(result.status,'REJECTED');
  if(result.status!=='REJECTED') throw new Error('fixture_expected_rejection');
  assert.ok(result.reasons.length>0);if(code) assert.ok(result.reasons.some(reason=>reason.code===code),JSON.stringify(result));
  return result;
}

// Test-only explicit DTO projection: receipts are the existing validators' actual results,
// not copied output fields or hashes invented by a synthetic generator.
async function fixtureValidationResults(f: FullFixture) {
  const { input, manifest, preference, safety } = f.context;
  const balance = f.policies.balance.policy;
  const composition = f.policies.composition.policy;
  const days = f.plan.graph.days.map((day, index) => {
    const distribution = f.evidence.distributionPolicy.days[index];
    const meals = day.slots.map(slot => ({ slotId:slot.slotId,sortOrder:slot.sortOrder,mealType:slot.mealType,date:slot.civilDate,
      validationInput:{contract:mealValidatorInputContractV1,sourceKind:slot.sourceKind,meal:slot.mealSnapshot,
        compositionPolicy:{...composition,maxComponents:balance.maxComponents,
          patterns:composition.patterns.filter(p=>p.roles.length<=balance.maxComponents)},balancePolicy:balance,
        expected:{goalRevision:input.goalNutritionTarget.goalRevision,compositionPolicyRevision:input.compositionPolicyRevision},
        userConstraints:{revisionId:preference.revisionId,excludedAllergens:safety.declaredAllergenCodes,
          excludedIngredientFamilies:[],requiredDietaryTags:preference.hard.dietaryPattern==='UNSPECIFIED'?[]:[preference.hard.dietaryPattern.toLowerCase()],
          forbiddenDietaryTags:safety.dietaryHardExclusionCodes},
        componentEvidence:slot.mealSnapshot.components.map(component=>{
          const entry=manifest.entries.find(e=>e.recipeId===component.recipe.recipeId)!;
          const evidence=f.evidence.components.find(e=>e.slotId===slot.slotId&&e.mealComponentId===component.mealComponentId)!;
          return {contract:mealCandidateEvidenceContractV2,mealComponentId:component.mealComponentId,recipeRevision:entry.recipeRevisionId,
            recipeId:entry.recipeId,portionRevision:entry.portionRevisionId,eligibilityRevision:entry.eligibilityRevisionId,
            manifestRevision:manifest.manifestRevision,manifestDigest:manifest.digest,specialty:entry.specialty,expensive:entry.expensive,
            publicationStatus:entry.publicationStatus,publicationRevision:entry.publicationRevision,
            canonicalStatus:'READY',canonicalEvidenceRevision:evidence.canonicalEvidenceRevision,
            nutritionStatus:'COMPLETE',nutritionEvidenceRevision:evidence.nutritionEvidenceRevision,
            allergenStatus:'REVIEWED',allergenEvidenceRevision:evidence.allergenEvidenceRevision,
            dietaryStatus:'REVIEWED',dietaryEvidenceRevision:evidence.dietaryEvidenceRevision,
            portionPolicyRevision:evidence.portionPolicyRevision,accessibility:entry.accessibility,
            allergens:entry.allergenCodes,dietaryTags:entry.dietaryCodes,ingredientFamilies:evidence.ingredientFamilies,
            dominantIngredientFamily:entry.dominantIngredientFamily,repeatFamily:entry.repeatFamily,
            assignedServingsMinimum:entry.portionRules.assignedServingsMinimum,assignedServingsMaximum:entry.portionRules.assignedServingsMaximum,
            proteinSource:evidence.proteinSource,produceSource:evidence.produceSource};}),
        nutritionBounds:distribution.nutritionBounds.find(e=>e.slotId===slot.slotId)!.bounds,
        requirements:{proteinSourceRequired:distribution.requirements.find(e=>e.slotId===slot.slotId)!.proteinSourceRequired,
          produceRequired:distribution.requirements.find(e=>e.slotId===slot.slotId)!.produceRequired},
        warningSignals:f.set.entries.find(e=>e.slotId===slot.slotId)!.signals}}));
    return {contract:dayValidatorInputContractV1,date:day.date,timezone:f.plan.timezone,goalRevision:input.goalNutritionTarget.goalRevision,
      targetPolicyRevision:input.goalNutritionTarget.targetPolicyRevision,planRevision:f.plan.proposedPlanRevision,
      compositionPolicyRevision:input.compositionPolicyRevision,balancePolicy:balance,requiredSlots:distribution.requiredSlots,
      meals,goalTarget:input.goalNutritionTarget,distributionBounds:distribution.distributionBounds};
  });
  const fallback=f.evidence.ordinaryFallback;
  return validateWeekSnapshotWithChildResultsRawV2(JSON.stringify({contract:weekValidatorInputContractV2,
    weekAnchor:f.plan.weekStartLocal,timezone:f.plan.timezone,goalRevision:input.goalNutritionTarget.goalRevision,
    targetPolicyRevision:input.goalNutritionTarget.targetPolicyRevision,planRevision:f.plan.proposedPlanRevision,
    compositionPolicyRevision:input.compositionPolicyRevision,balancePolicy:balance,days,
    ordinaryFallbackProof:{candidatePoolDigest:fallback.candidatePoolDigest,status:fallback.status,ordinaryWeekDigest:fallback.ordinaryWeekDigest}}),
  f.rawContext.candidateManifestRaw);
}
async function bindFixtureValidationDigests(f: FullFixture) {
  const results=await fixtureValidationResults(f);
  for(let i=0;i<f.plan.graph.days.length;i++) {
    const day=f.plan.graph.days[i];day.validationResultDigest=results.days[i].validation.subjectDigest;
    for(const slot of day.slots) slot.validationResultDigest=results.days[i].meals.find(e=>e.slotId===slot.slotId)!.validation.subjectDigest;
  }
  f.plan.graph.weekValidationResultDigest=results.week.subjectDigest;
  resignPlan(f, false);
}


export { fullFixture, check, id, h, resignPlan, rejected, useRecipe, withoutDigest, fixtureSeal, resignEntry, resignSet, bindFixtureValidationDigests, fixtureValidationResults };
export type { FullFixture, FixtureState };
