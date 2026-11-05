import {readFileSync} from 'node:fs';
import {pathToFileURL} from 'node:url';
import {assertRawJsonWithoutDuplicateKeysV1} from '../../src/utils/adaptiveNutritionWireV1';
import {preparePilotServerTransferV1} from './pilot-server-transfer-v1';
import {pilotCanonicalV1,pilotDigestV1,readPilotFreezeRawV1} from './pilot-admission-readiness-v1';
import {reviewConditionalWeekV1,type ReviewInputModelV1,readObservedGroupsRawV1} from './week-quality-preparation-v1';
import {findCompleteInputWeekWitnessV1} from './complete-input-week-witness-v1';
import {runNonfishLentilAlternativesV1} from './nonfish-lentil-alternatives-v1';
import type {CapacityScenarioV1} from './week-input-calorie-capacity-v1';

type Witness=ReturnType<typeof findCompleteInputWeekWitnessV1>;
type Scenario=CapacityScenarioV1&{weekStart:string};
type Fraction={numerator:string;denominator:string};
const axes=['calories','protein','fat','carbs','fiber'] as const;
const flags={sourceApproved:false,runtimePublishable:false,canApply:false,mayActivate:false,readyForServerSubmission:false} as const;
function invalid():never{throw Error('INVALID_WEEK_TRANSFER_HANDOFF');}
function scenario(raw:string):Scenario{
 if(typeof raw!=='string'||Buffer.byteLength(raw)>100_000)invalid();assertRawJsonWithoutDuplicateKeysV1(raw);
 const s=JSON.parse(raw);if(!s||typeof s!=='object'||Array.isArray(s))invalid();return s as Scenario;
}
function exclusions(ids:string[],models:ReviewInputModelV1[]){
 if(!Array.isArray(ids)||ids.length>128||new Set(ids).size!==ids.length||ids.some(id=>typeof id!=='string'||!models.some(m=>m.recipeId===id)))invalid();
}
function gcd(a:bigint,b:bigint):bigint{while(b){const r=a%b;a=b;b=r;}return a;}
function add(a:Fraction,b:Fraction):Fraction{
 const n=BigInt(a.numerator)*BigInt(b.denominator)+BigInt(b.numerator)*BigInt(a.denominator),d=BigInt(a.denominator)*BigInt(b.denominator),g=gcd(n,d);
 return {numerator:String(n/g),denominator:String(d/g)};
}
const zero=():Fraction=>({numerator:'0',denominator:'1'});
export async function buildWeekTransferHandoffV1(candidateRaw:string,models:ReviewInputModelV1[],freezeRaw:string,scenarioRaw:string,witness:Witness,excludedRecipeIds:string[]=[],groupsRaw=readObservedGroupsRawV1()){
 const s=scenario(scenarioRaw);exclusions(excludedRecipeIds,models);
 // Review the entire witness, never just the changed slot or its summary flags.
 const review=reviewConditionalWeekV1(models,witness,s,groupsRaw);
 if(witness.days.some(d=>d.meals.some(m=>excludedRecipeIds.includes(m.recipeId))))invalid();
 const transfer=await preparePilotServerTransferV1(candidateRaw,models,freezeRaw);
 const days=witness.days.map((day,dayIndex)=>{
  const meals=day.meals.map((meal,slotIndex)=>{
   const recipe=transfer.recipes.find(r=>r.recipeId===meal.recipeId);if(!recipe)invalid();
   const exactNutrition=Object.fromEntries(axes.map(a=>[a,recipe.perDeclaredServing[a].exact]));
   const v3Preview=Object.fromEntries(axes.map(a=>[a,recipe.perDeclaredServing[a].v3Preview]));
   return {slotIndex,slotLabel:meal.slot,recipeId:meal.recipeId,sourceCategory:meal.sourceCategory,assignedDeclaredServings:1,
    measuredGrams:null,inputModelSha256:recipe.inputModelSha256,exactConditionalInputNutrition:exactNutrition,v3Preview,
    precisionBlockers:recipe.precisionBlockers,currentPublicationAudit:recipe.currentPublicationAudit,
    sourceAdmission:recipe.sourceAdmission,nonFoodReceiptsAndCurrentness:recipe.nonFoodReceiptsAndCurrentness,...flags};
  });
  const exactNutrition=Object.fromEntries(axes.map(a=>[a,meals.reduce((sum,m)=>add(sum,m.exactConditionalInputNutrition[a]),zero())]));
  return {date:day.date,meals,exactConditionalInputNutrition:exactNutrition,v3Preview:review.days[dayIndex].sourceInputNutrition,searchCalories:day.calories};
 });
 const exactWeeklyNutrition=Object.fromEntries(axes.map(a=>[a,days.reduce((sum,d)=>add(sum,d.exactConditionalInputNutrition[a]),zero())]));
 return {contract:'potok-offline-week-transfer-handoff-v1',usage:'CONDITIONAL_INPUT_REVIEW_NOT_SERVER_REQUEST',
  bindings:{candidateBytesSha256:transfer.candidateBytesSha256,freezeSha256:transfer.freezeSha256,inputSetSha256:transfer.inputSetSha256,
   scenarioBytesSha256:pilotDigestV1(scenarioRaw),witnessSha256:pilotDigestV1(pilotCanonicalV1(witness)),
   transferSha256:pilotDigestV1(pilotCanonicalV1(transfer)),reviewSha256:pilotDigestV1(pilotCanonicalV1(review))},
  days,exactWeeklyConditionalInputNutrition:exactWeeklyNutrition,weeklyV3Preview:review.weeklySourceInputNutrition,
  excludedRecipeIds:[...excludedRecipeIds].sort(),exclusionScope:'NAMED_RECIPE_IDS_ONLY_NOT_ALLERGEN_OR_DIETARY_PROOF',
  summary:{days:days.length,meals:days.reduce((n,d)=>n+d.meals.length,0),distinctRecipes:new Set(days.flatMap(d=>d.meals.map(m=>m.recipeId))).size,
   mealsWithPrecisionBlockers:days.flatMap(d=>d.meals).filter(m=>m.precisionBlockers.length).length,
   mealsWithCurrentPublicationMLBlockers:days.flatMap(d=>d.meals).filter(m=>m.currentPublicationAudit.missingMassAndNormalizationRows.length).length,admittedRecipes:0},
  status:'BLOCKED_SOURCE_ADMISSION_AND_SERVER_CONTEXT_NOT_BOUND',serverRequest:null,requestOperationId:null,accountContext:null,
  serverValidationAttempted:false,serverValidationResult:null,
  physicalCookingValidation:'DEFERRED_TO_OWNER_PRELAUNCH_NOT_AN_OFFLINE_GATE',cookedNutritionClaimed:false,...flags};
}
export async function evaluateWeekMealReplacementV1(candidateRaw:string,models:ReviewInputModelV1[],freezeRaw:string,scenarioRaw:string,witness:Witness,
 replacement:{date:string;slotIndex:number;recipeId:string},excludedRecipeIds:string[]=[],groupsRaw=readObservedGroupsRawV1()){
 // A stale/forged base never becomes a valid proposal because a replacement was
 // individually plausible. This also binds the original source/model freeze.
 const base=await buildWeekTransferHandoffV1(candidateRaw,models,freezeRaw,scenarioRaw,witness,excludedRecipeIds,groupsRaw),s=scenario(scenarioRaw);
 if(!replacement||Object.keys(replacement).length!==3||typeof replacement.date!=='string'||!Number.isInteger(replacement.slotIndex))invalid();
 const dayIndex=witness.days.findIndex(d=>d.date===replacement.date),target=models.find(m=>m.recipeId===replacement.recipeId);
 if(dayIndex<0||replacement.slotIndex<0||replacement.slotIndex>=s.slots.length||!target||!target.calculation.perDeclaredServing)invalid();
 const current=witness.days[dayIndex].meals[replacement.slotIndex];
 const blocked=(reason:string)=>({contract:'potok-offline-week-replacement-result-v1',status:'BLOCKED',reason,baseWitnessSha256:base.bindings.witnessSha256,
  requestedReplacement:{...replacement},proposal:null,replacementWitness:null,fallbackUsed:false,...flags});
 if(current.recipeId===replacement.recipeId)return blocked('NO_CHANGE');
 if(excludedRecipeIds.includes(replacement.recipeId))return blocked('EXCLUDED_RECIPE');
 if(!s.slots[replacement.slotIndex].sourceCategories.includes(target.sourceCategory))return blocked('CATEGORY_NOT_ALLOWED');
 if(witness.days[dayIndex].meals.some(m=>m.recipeId===replacement.recipeId))return blocked('DAILY_DUPLICATE');
 const oldUses=witness.days.flatMap(d=>d.meals).filter(m=>m.recipeId===replacement.recipeId).length;
 if(oldUses+1>s.maxRecipeUses)return blocked('REPEAT_LIMIT');
 const next=structuredClone(witness),day=next.days[dayIndex];
 day.meals[replacement.slotIndex]={...current,recipeId:replacement.recipeId,sourceCategory:target.sourceCategory,assignedDeclaredServings:1,measuredGrams:null};
 const kcal=day.meals.reduce((sum,m)=>{const v=models.find(r=>r.recipeId===m.recipeId)?.calculation.perDeclaredServing?.calories;if(!v)invalid();return sum+Math.round(Number(v)*1000);},0);
 const targetKcal=s.dailyCalorieTarget*1000,tolerance=Math.floor(targetKcal*s.tolerancePercent/100);
 if(kcal<targetKcal-tolerance||kcal>targetKcal+tolerance)return blocked('CALORIE_RANGE');
 day.calories=(kcal/1000).toFixed(3);
 const counts=new Map<string,number>();for(const meal of next.days.flatMap(d=>d.meals))counts.set(meal.recipeId,(counts.get(meal.recipeId)??0)+1);
 next.recipeUses=[...counts].sort(([a],[b])=>a<b?-1:a>b?1:0).map(([recipeId,uses])=>({recipeId,uses}));
 const proposal=await buildWeekTransferHandoffV1(candidateRaw,models,freezeRaw,scenarioRaw,next,excludedRecipeIds,groupsRaw);
 return {contract:'potok-offline-week-replacement-result-v1',status:'CONDITIONAL_REPLACEMENT_ONLY_NOT_SERVER_ADMISSION',reason:null,
  baseWitnessSha256:base.bindings.witnessSha256,requestedReplacement:{...replacement},proposal,replacementWitness:next,searchDiagnosticsScope:'BASE_DOMAIN_SEARCH_REPLACEMENT_REVALIDATED_NOT_RESEARCHED',fallbackUsed:false,...flags};
}
export async function runWeekTransferHandoffV1(raw:string,scenarioRaw:string){
 const input=runNonfishLentilAlternativesV1(raw,scenarioRaw),models=input.expandedInputModels,freezeRaw=readPilotFreezeRawV1();
 const groupsRaw=readFileSync(new URL('../../docs/premium/retained-sources/nonfish-lentil-20261105/observed-groups-with-lentils-v1.json',import.meta.url),'utf8');
 const baseline=await buildWeekTransferHandoffV1(raw,models,freezeRaw,scenarioRaw,input.baselineExpandedWeek.witness,[],groupsRaw);
 const excludedWeeks=[];for(const c of input.explicitExclusionCases){
  if(c.witness.status!=='CONDITIONAL_INPUT_WEEK_WITNESS')invalid();
  const handoff=await buildWeekTransferHandoffV1(raw,models,freezeRaw,scenarioRaw,c.witness,c.excludedRecipeIds,groupsRaw);
  const replacement=await evaluateWeekMealReplacementV1(raw,models,freezeRaw,scenarioRaw,c.witness,{date:c.witness.days[0].date,slotIndex:1,recipeId:c.excludedRecipeIds[0]},c.excludedRecipeIds,groupsRaw);
  excludedWeeks.push({name:c.name,handoff,excludedReplacement:replacement});
 }
 return {contract:'potok-week-transfer-handoff-result-v1',baseline,excludedWeeks,sourceModels:models.length,
  validationScope:'OFFLINE_REAL_INPUTS_BLOCKED_SEPARATE_SYNTHETIC_SERVER_ACCEPTANCE_TESTS',...flags};
}
if(process.argv[1]&&import.meta.url===pathToFileURL(process.argv[1]).href){
 if(process.argv.length!==4)throw Error('Usage: ... CANDIDATE_CATALOG.json SCENARIO.json');
 process.stdout.write(JSON.stringify(await runWeekTransferHandoffV1(readFileSync(process.argv[2],'utf8'),readFileSync(process.argv[3],'utf8')),null,2)+'\n');
}
