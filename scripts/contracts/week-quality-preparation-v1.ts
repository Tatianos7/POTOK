import {createHash} from 'node:crypto';import {readFileSync} from 'node:fs';import {pathToFileURL} from 'node:url';
import {assertRawJsonWithoutDuplicateKeysV1} from '../../src/utils/adaptiveNutritionWireV1';
import {runGrainMainWeekV1} from './grain-main-week-v1';
import {calculatePreciseInputV3} from './foundation-variants-review-v1';
import {findCompleteInputWeekWitnessV1} from './complete-input-week-witness-v1';
import {analyzeWeekInputCalorieCapacityV1,type CapacityRecipeV1,type CapacityScenarioV1} from './week-input-calorie-capacity-v1';
import type {BatchComponentV2} from './pilot-source-quantity-batch-v1';
type Obj=Record<string,unknown>;const axes=['calories','protein','fat','carbs','fiber'] as const;type Vector=Record<typeof axes[number],string>;
export interface ReviewInputModelV1{recipeId:string;sourceCategory:string;declaredServings:unknown;rows:{component:BatchComponentV2}[];calculation:{perDeclaredServing:Vector|null};sourceApproved:boolean;runtimePublishable:boolean}
type Witness=ReturnType<typeof findCompleteInputWeekWitnessV1>;
const hash=(s:string)=>createHash('sha256').update(s).digest('hex');
function invalid():never{throw Error('INVALID_WEEK_QUALITY_PREPARATION');}
function obj(v:unknown):Obj{if(!v||typeof v!=='object'||Array.isArray(v))invalid();return v as Obj;}
function parse(raw:string){if(typeof raw!=='string'||Buffer.byteLength(raw)>15_000_000)invalid();assertRawJsonWithoutDuplicateKeysV1(raw);return obj(JSON.parse(raw));}
function canon(v:unknown):string{if(v===null||typeof v==='string'||typeof v==='boolean'||typeof v==='number')return JSON.stringify(v);if(Array.isArray(v))return '['+v.map(canon).join(',')+']';const o=obj(v);return '{'+Object.keys(o).sort().map(k=>JSON.stringify(k)+':'+canon(o[k])).join(',')+'}';}
function minor(v:unknown){if(typeof v!=='string'||!/^(0|[1-9][0-9]{0,6})(\.[0-9]{1,8})?$/.test(v))invalid();const [n,f='']=v.split('.');return BigInt(n)*100000000n+BigInt(f.padEnd(8,'0'));}
const fixed=(n:bigint)=>String(n/100000000n)+'.'+String(n%100000000n).padStart(8,'0');
export function readObservedGroupsRawV1(){return readFileSync(new URL('../../docs/premium/retained-sources/week-quality-20261105/observed-groups-v1.json',import.meta.url),'utf8');}
export function decodeObservedGroupsV1(raw:string){
 const p=parse(raw);if(p.contract!=='potok-observed-source-groups-v1'||p.usage!=='SOURCE_RECORD_OCCURRENCE_OBSERVATION_ONLY'||[p.repeatFamilyPolicy,p.allergenClassification,p.dietaryEligibility,p.thresholdsApproved,p.sourceApproved,p.runtimePublishable,p.canApply,p.mayActivate].some(v=>v!==false))invalid();
 const groups=obj(p.groups),entries=Object.entries(groups);if(!entries.length||entries.length>32)invalid();const seen=new Set<string>();
 for(const [group,values] of entries){if(!/^[A-Z][A-Z_]{0,63}$/.test(group)||!Array.isArray(values)||!values.length||values.length>32)invalid();for(const v of values){if(typeof v!=='string'||!v||seen.has(v))invalid();seen.add(v);}}
 return groups as Record<string,string[]>;
}
/** Rechecks the complete witness against the exact source-input models before
 * summing. Search rounding is checked separately from eight-place input totals. */
export function reviewConditionalWeekV1(models:ReviewInputModelV1[],witness:Witness,scenario:CapacityScenarioV1&{weekStart:string},groupsRaw=readObservedGroupsRawV1()){
 if(models.length>128||new Set(models.map(m=>m.recipeId)).size!==models.length||witness.contract!=='potok-complete-input-week-witness-v1'||witness.status!=='CONDITIONAL_INPUT_WEEK_WITNESS'||witness.days.length!==7||witness.sourceApproved!==false||witness.runtimePublishable!==false||witness.canApply!==false||witness.mayActivate!==false)invalid();
 if(typeof scenario.weekStart!=='string'||!/^\d{4}-\d{2}-\d{2}$/.test(scenario.weekStart)||!Number.isFinite(Date.parse(scenario.weekStart+'T00:00:00Z'))||new Date(scenario.weekStart+'T00:00:00Z').toISOString().slice(0,10)!==scenario.weekStart)invalid();
 for(const m of models){if(m.sourceApproved!==false||m.runtimePublishable!==false||typeof m.sourceCategory!=='string'||!m.sourceCategory||!m.calculation.perDeclaredServing||canon(calculatePreciseInputV3(m.rows.map(r=>r.component),m.declaredServings).perDeclaredServing)!==canon(m.calculation.perDeclaredServing))invalid();}
 analyzeWeekInputCalorieCapacityV1(models.map(m=>({recipeId:m.recipeId,sourceCategory:m.sourceCategory,caloriesPerDeclaredServing:m.calculation.perDeclaredServing!.calories})),scenario);
 const groups=decodeObservedGroupsV1(groupsRaw),mapping=new Map(Object.entries(groups).flatMap(([g,records])=>records.map(r=>[r,g] as const))),uses=new Map<string,number>(),frequencies=new Map<string,{mealMentions:number;mainMealMentions:number;dates:Set<string>}>();
 const weekly=Object.fromEntries(axes.map(a=>[a,0n])) as Record<typeof axes[number],bigint>,usedModels=new Map<string,ReviewInputModelV1>();
 const target=scenario.dailyCalorieTarget*1000,tolerance=Math.floor(target*scenario.tolerancePercent/100);
 const days=witness.days.map((day,index)=>{
  const date=new Date(Date.parse(scenario.weekStart+'T00:00:00Z')+index*86400000).toISOString().slice(0,10);if(day.date!==date||day.meals.length!==scenario.slots.length||new Set(day.meals.map(m=>m.recipeId)).size!==day.meals.length)invalid();
  const totals=Object.fromEntries(axes.map(a=>[a,0n])) as Record<typeof axes[number],bigint>;let searchKcal=0;
  for(let slot=0;slot<day.meals.length;slot++){
   const meal=day.meals[slot],model=models.find(m=>m.recipeId===meal.recipeId),expected=scenario.slots[slot];
   if(!model||model.sourceApproved!==false||model.runtimePublishable!==false||!model.calculation.perDeclaredServing||meal.slot!==expected.label||meal.sourceCategory!==model.sourceCategory||!expected.sourceCategories.includes(meal.sourceCategory)||meal.assignedDeclaredServings!==1||meal.measuredGrams!==null)invalid();
   const calculated=calculatePreciseInputV3(model.rows.map(r=>r.component),model.declaredServings);if(!calculated.perDeclaredServing||canon(calculated.perDeclaredServing)!==canon(model.calculation.perDeclaredServing))invalid();
   const values=calculated.perDeclaredServing;for(const a of axes)totals[a]+=minor(values[a]);searchKcal+=Math.round(Number(values.calories)*1000);uses.set(meal.recipeId,(uses.get(meal.recipeId)??0)+1);usedModels.set(meal.recipeId,model);
   const observed=new Set(model.rows.map(r=>mapping.get(String(r.component.sourceRecord))).filter((g):g is string=>g!==undefined));
   for(const g of observed){const f=frequencies.get(g)??{mealMentions:0,mainMealMentions:0,dates:new Set<string>()};f.mealMentions++;if(meal.sourceCategory==='LUNCH')f.mainMealMentions++;f.dates.add(date);frequencies.set(g,f);}
  }
  if(searchKcal<target-tolerance||searchKcal>target+tolerance||day.calories!==(searchKcal/1000).toFixed(3))invalid();for(const a of axes)weekly[a]+=totals[a];
  return {date,sourceInputNutrition:Object.fromEntries(axes.map(a=>[a,fixed(totals[a])])) as Vector,searchCalories:day.calories};
 });
 if([...uses.values()].some(n=>n>scenario.maxRecipeUses)||witness.recipeUses.length!==uses.size||new Set(witness.recipeUses.map(r=>r.recipeId)).size!==uses.size||witness.recipeUses.some(r=>uses.get(r.recipeId)!==r.uses))invalid();
 return {contract:'potok-conditional-week-quality-review-v1',observationScope:'ONLY_LISTED_SOURCE_BINDINGS_NOT_EXHAUSTIVE',thresholdsApplied:false,observedGroupsBytesSha256:hash(groupsRaw),days,weeklySourceInputNutrition:Object.fromEntries(axes.map(a=>[a,fixed(weekly[a])])) as Vector,
  averageDailySourceInputNutrition:Object.fromEntries(axes.map(a=>[a,fixed((weekly[a]+3n)/7n)])) as Vector,
  observedSourceGroups:[...frequencies].sort(([a],[b])=>a<b?-1:a>b?1:0).map(([group,f])=>({group,mealMentions:f.mealMentions,mainMealMentions:f.mainMealMentions,distinctDays:f.dates.size})),
  proteinFatCarbohydrateFiberTargets:{status:'NOT_ASSESSED_PINNED_PERSONAL_TARGETS_NOT_BOUND'},repeatFamilyPolicy:{status:'NOT_ASSESSED_OBSERVATIONS_ARE_NOT_ELIGIBILITY'},allergenAndDietaryEvidence:{status:'NOT_REVIEWED'},
  recipeModelDigests:[...usedModels].sort(([a],[b])=>a<b?-1:a>b?1:0).map(([recipeId,m])=>({recipeId,sha256:hash(canon(m))})),
  sourceApproved:false,runtimePublishable:false,canApply:false,mayActivate:false,cookedNutritionClaimed:false};
}
export function evaluateExplicitRecipeExclusionV1(inputs:CapacityRecipeV1[],scenario:CapacityScenarioV1&{weekStart:string},excludedRecipeIds:string[]){
 if(!Array.isArray(excludedRecipeIds)||!excludedRecipeIds.length||excludedRecipeIds.length>128||new Set(excludedRecipeIds).size!==excludedRecipeIds.length||excludedRecipeIds.some(id=>typeof id!=='string'||!inputs.some(r=>r.recipeId===id)))invalid();
 const remaining=inputs.filter(r=>!excludedRecipeIds.includes(r.recipeId)),capacity=analyzeWeekInputCalorieCapacityV1(remaining,scenario),witness=findCompleteInputWeekWitnessV1(remaining,scenario);
 if(witness.days.some(d=>d.meals.some(m=>excludedRecipeIds.includes(m.recipeId))))invalid();
 return {excludedRecipeIds:[...excludedRecipeIds].sort(),remainingInputRecipes:remaining.length,calorieCapacity:capacity,witness,exclusionScope:'EXPLICIT_RECIPE_IDS_ONLY_NOT_ALLERGEN_OR_DIETARY_SCREENING',fallbackUsed:false,sourceApproved:false,runtimePublishable:false,canApply:false,mayActivate:false};
}
export function buildOfflineValidationPreparationV1(candidateRaw:string,scenarioRaw:string,inputModels:ReviewInputModelV1[],witness:Witness,review:ReturnType<typeof reviewConditionalWeekV1>,groupsRaw=readObservedGroupsRawV1()){
 const candidate=obj(parse(candidateRaw).originalAuthoringCatalog);if(!Array.isArray(candidate.recipes))invalid();const originals=candidate.recipes.map(obj);
 for(const m of inputModels){const r=originals.find(r=>r.recipeId===m.recipeId);if(!r||r.declaredServings!==m.declaredServings||obj(r.sourceRecipe).meal_type_primary!==m.sourceCategory)invalid();}
 const scenario=parse(scenarioRaw) as unknown as CapacityScenarioV1&{weekStart:string},fresh=reviewConditionalWeekV1(inputModels,witness,scenario,groupsRaw);
 if(canon(fresh)!==canon(review))invalid();
 return {contract:'potok-offline-week-validation-preparation-v1',usage:'REVIEW_INPUT_ONLY_NOT_SERVER_REQUEST_OR_AUTHORITY',bindings:{candidateBytesSha256:hash(candidateRaw),scenarioBytesSha256:hash(scenarioRaw),inputModelsSha256:hash(canon(inputModels)),witnessSha256:hash(canon(witness)),qualityReviewSha256:hash(canon(review))},
  witness,conditionalQualityReview:review,accountContext:null,requestOperationId:null,canonicalRecipeIdentities:null,
  requiredEvidence:{sourceNutritionAdmission:'NOT_REVIEWED',canonicalFoodBindings:'UNRESOLVED',recipePublicationRevisions:'NOT_ASSIGNED',allergenEvidence:'NOT_REVIEWED',dietaryEvidence:'NOT_REVIEWED',portionAndYield:'DECLARED_ONLY_PHYSICAL_REVIEW_DEFERRED',personalTargetPolicy:'NOT_BOUND',accountPreferenceSafetyEntitlement:'NOT_BOUND',serverPolicyManifestCurrentness:'NOT_CHECKED'},
  trustedServerValidationAttempted:false,readyForServerSubmission:false,sourceApproved:false,runtimePublishable:false,canApply:false,mayActivate:false};
}
export function runWeekQualityPreparationV1(raw:string,scenarioRaw:string){
 const candidate=parse(raw),catalog=obj(candidate.originalAuthoringCatalog);if(!Array.isArray(catalog.recipes))invalid();const rawRecipes=catalog.recipes.map(obj);
 const prior=runGrainMainWeekV1(raw,scenarioRaw),scenario=parse(scenarioRaw) as unknown as CapacityScenarioV1&{weekStart:string},models=prior.recipes.filter(r=>r.calculation.perDeclaredServing!==null).map(r=>{const original=rawRecipes.find(x=>x.recipeId===r.recipeId);if(!original)invalid();return {...r,sourceCategory:String(obj(original.sourceRecipe).meal_type_primary)};}),witness=prior.actualInputModelWeek.completeDomainWitness;
 const review=reviewConditionalWeekV1(models,witness,scenario),capacityInputs=models.map(m=>({recipeId:m.recipeId,sourceCategory:m.sourceCategory,caloriesPerDeclaredServing:m.calculation.perDeclaredServing!.calories}));
 const cases=[{name:'WITHOUT_TUNA',ids:['tuna_tomato_pasta']},{name:'WITHOUT_SALMON',ids:['salmon_brown_rice']},{name:'WITHOUT_THREE_NAMED_FISH_RECIPES',ids:['tuna_tomato_pasta','salmon_brown_rice','trout_green_beans']}].map(c=>({name:c.name,...evaluateExplicitRecipeExclusionV1(capacityInputs,scenario,c.ids)}));
 return {contract:'potok-week-quality-preparation-result-v1',summary:{completeConditionalInputRecipes:models.length,days:review.days.length,meals:witness.days.reduce((n,d)=>n+d.meals.length,0),exclusionCases:cases.length,sourceApprovals:0,admittedRecipes:0,appliedChanges:0},qualityReview:review,explicitExclusionCases:cases,offlineValidationPreparation:buildOfflineValidationPreparationV1(raw,scenarioRaw,models,witness,review),
  unansweredOwnerChoices:prior.unansweredOwnerChoices,sourceApproved:false,runtimePublishable:false,canApply:false,mayActivate:false,originalDataModified:false,cookedNutritionClaimed:false};
}
if(process.argv[1]&&import.meta.url===pathToFileURL(process.argv[1]).href){if(process.argv.length!==4)throw Error('Usage: ... CANDIDATE_CATALOG.json SCENARIO.json');process.stdout.write(JSON.stringify(runWeekQualityPreparationV1(readFileSync(process.argv[2],'utf8'),readFileSync(process.argv[3],'utf8')),null,2)+'\n');}
