import {readFileSync} from 'node:fs';
import {pathToFileURL} from 'node:url';
import {captureExactNutritionInputV2,createExactNutritionValuesV2,scaleExactNutritionValuesV2,sumExactNutritionValuesV2,
 exactScalarFromDecimalV2,compareExactScalarsV2,exactNutritionValuesCanonicalRawV2,decodeExactNutritionValuesRawV2,
 projectExactNutritionForDisplayV2,exactNutritionAxesV2,type ExactNutritionValuesV2} from '../../src/utils/exactNutritionValuesV2';
import {readPilotBindingSourceDossiersV1} from './pilot-source-binding-proposals-v1';
import {verifyPilotInputFreezeV1,readPilotFreezeRawV1,pilotDigestV1,pilotCanonicalV1} from './pilot-admission-readiness-v1';
import {preparePilotServerTransferV1} from './pilot-server-transfer-v1';
import {buildWeekTransferHandoffV1} from './week-transfer-handoff-v1';
import {runNonfishLentilAlternativesV1} from './nonfish-lentil-alternatives-v1';
import type {ReviewInputModelV1} from './week-quality-preparation-v1';
import type {findCompleteInputWeekWitnessV1} from './complete-input-week-witness-v1';
type Witness=ReturnType<typeof findCompleteInputWeekWitnessV1>;
const flags={sourceApproved:false,runtimePublishable:false,canApply:false,mayActivate:false,readyForServerSubmission:false} as const;
const groupsPath='docs/premium/retained-sources/nonfish-lentil-20261105/observed-groups-with-lentils-v1.json';
function invalid():never{throw Error('EXACT_NUMERIC_PILOT_COMPATIBILITY_MISMATCH');}
/** Offline integration only. The new numeric values are never submitted as
 * Food evidence or a Graph proposal, and cannot clear existing source gates. */
export async function prepareExactNutritionPilotCompatibilityV2(candidateRaw:string,models:ReviewInputModelV1[],scenarioRaw:string,witness:Witness,freezeRaw=readPilotFreezeRawV1()){
 models=structuredClone(models);witness=structuredClone(witness);
 const freeze=verifyPilotInputFreezeV1(candidateRaw,models,freezeRaw),sources=readPilotBindingSourceDossiersV1();
 const transfer=await preparePilotServerTransferV1(candidateRaw,models,freezeRaw);
 const groupsRaw=readFileSync(new URL('../../'+groupsPath,import.meta.url),'utf8');
 const legacyWeek=await buildWeekTransferHandoffV1(candidateRaw,models,freezeRaw,scenarioRaw,witness,[],groupsRaw);
 let comparisons=0;
 const compare=(p:ExactNutritionValuesV2,expected:Record<string,unknown>)=>{for(const a of exactNutritionAxesV2){if(compareExactScalarsV2(p.values[a],expected[a])!==0)invalid();comparisons++;}};
 const recipes=models.map(m=>{
  const original=transfer.recipes.find(r=>r.recipeId===m.recipeId);if(!original)invalid();
  const components=m.rows.map(({component:c})=>{
   const source=sources.get(String(c.sourceRecord)),previous=original.components.find(r=>r.rowId===c.rowId);if(!source||!previous||!c.vector)invalid();
   const input=captureExactNutritionInputV2({sourceRecord:c.sourceRecord,declaredRetainedArtifactSha256:source.retainedSha256,basis:source.basis,
    units:{calories:'kcal',protein:'g',fat:'g',carbs:'g',fiber:'g'},carbohydrateSemantics:'AVAILABLE_EXCLUDING_FIBER',
    mappingPolicyRef:'EXISTING_OFFLINE_SAME_SOURCE_CARBOHYDRATE_MAPPING_NOT_ISSUED_EVIDENCE'},source.vector);
   const values=createExactNutritionValuesV2(input.values);
   for(const a of exactNutritionAxesV2)if(compareExactScalarsV2(values.values[a],exactScalarFromDecimalV2(c.vector[a]))!==0)invalid();
   let contribution:ExactNutritionValuesV2;
   if(c.componentKind==='POTABLE_WATER'){
    if(c.quantityG!==null||exactNutritionAxesV2.some(a=>values.values[a].numerator!=='0'))invalid();contribution=values;
   }else{if(c.quantityG===null)invalid();contribution=scaleExactNutritionValuesV2(values,exactScalarFromDecimalV2(c.quantityG),exactScalarFromDecimalV2('100'));}
   compare(contribution,Object.fromEntries(exactNutritionAxesV2.map(a=>[a,previous.values[a].exact])));
   return {rowId:c.rowId,inputKind:c.componentKind,quantityG:c.quantityG,input,contribution};
  });
  const whole=sumExactNutritionValuesV2(components.map(c=>c.contribution)),perServing=scaleExactNutritionValuesV2(whole,exactScalarFromDecimalV2('1'),exactScalarFromDecimalV2(String(m.declaredServings)));
  compare(whole,Object.fromEntries(exactNutritionAxesV2.map(a=>[a,original.wholeInput[a].exact])));
  compare(perServing,Object.fromEntries(exactNutritionAxesV2.map(a=>[a,original.perDeclaredServing[a].exact])));
  return {recipeId:m.recipeId,declaredServings:m.declaredServings,components,whole,perServing};
 });
 const days=legacyWeek.days.map(day=>{
  const meals=day.meals.map(meal=>{const r=recipes.find(r=>r.recipeId===meal.recipeId);if(!r)invalid();const values=r.perServing;compare(values,meal.exactConditionalInputNutrition);return {slotIndex:meal.slotIndex,recipeId:meal.recipeId,values};});
  const values=sumExactNutritionValuesV2(meals.map(m=>m.values));compare(values,day.exactConditionalInputNutrition);return {date:day.date,meals,values,displayOnly:projectExactNutritionForDisplayV2(values,{fractionDigits:1,rounding:'HALF_UP'})};
 });
 const week=sumExactNutritionValuesV2(days.map(d=>d.values));compare(week,legacyWeek.exactWeeklyConditionalInputNutrition);
 const serialized=exactNutritionValuesCanonicalRawV2(week),decoded=decodeExactNutritionValuesRawV2(serialized);
 if(exactNutritionValuesCanonicalRawV2(decoded)!==serialized)invalid();
 return {contract:'potok-exact-numeric-pilot-compatibility-v2',usage:'OFFLINE_NUMERIC_COMPATIBILITY_NOT_FOOD_EVIDENCE_OR_GRAPH',
  freezeSha256:pilotDigestV1(pilotCanonicalV1(freeze)),summary:{recipes:recipes.length,componentRows:recipes.reduce((n,r)=>n+r.components.length,0),days:days.length,
   meals:days.reduce((n,d)=>n+d.meals.length,0),exactAxisComparisons:comparisons,admittedRecipes:0},recipes,days,week,canonicalWeekRaw:serialized,
  existingServerStatus:legacyWeek.status,serverValidationAttempted:false,canonicalIdentities:null,authorityContext:null,...flags};
}
export async function runExactNutritionPilotCompatibilityV2(candidateRaw:string,scenarioRaw:string){
 const prior=runNonfishLentilAlternativesV1(candidateRaw,scenarioRaw);
 return prepareExactNutritionPilotCompatibilityV2(candidateRaw,prior.expandedInputModels,scenarioRaw,prior.baselineExpandedWeek.witness);
}
if(process.argv[1]&&import.meta.url===pathToFileURL(process.argv[1]).href){
 if(process.argv.length!==4)throw Error('Usage: ... ORIGINAL_CANDIDATE.json ORIGINAL_SCENARIO.json');
 process.stdout.write(JSON.stringify(await runExactNutritionPilotCompatibilityV2(readFileSync(process.argv[2],'utf8'),readFileSync(process.argv[3],'utf8')),null,2)+'\n');
}
