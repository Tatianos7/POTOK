import {readFileSync} from 'node:fs';
import {pathToFileURL} from 'node:url';
import {assertRawJsonWithoutDuplicateKeysV1} from '../../src/utils/adaptiveNutritionWireV1';
import {normalizeFoodEvidenceSourceDecimalV1} from '../../src/utils/foodReviewedEvidenceV1';
import {readPilotBindingSourceDossiersV1} from './pilot-source-binding-proposals-v1';
import {pilotCanonicalV1,pilotDigestV1,readPilotFreezeRawV1,verifyPilotInputFreezeV1} from './pilot-admission-readiness-v1';
import {preparePilotServerTransferV1} from './pilot-server-transfer-v1';
import {buildWeekTransferHandoffV1} from './week-transfer-handoff-v1';
import {findCompleteInputWeekWitnessV1} from './complete-input-week-witness-v1';
import type {ReviewInputModelV1} from './week-quality-preparation-v1';
import type {CapacityScenarioV1} from './week-input-calorie-capacity-v1';

type Obj=Record<string,unknown>;
const axes=['calories','protein','fat','carbs','fiber'] as const;
const flags={sourceApproved:false,runtimePublishable:false,canApply:false,mayActivate:false,readyForServerSubmission:false} as const;
const definitionsPath='docs/premium/retained-sources/source-class-precision-20261105/source-classes-v1.json';
const read=(p:string)=>readFileSync(new URL('../../'+p,import.meta.url),'utf8');
function invalid():never{throw Error('INVALID_SOURCE_CLASS_PRECISION_REVIEW');}
function obj(v:unknown):Obj{if(!v||typeof v!=='object'||Array.isArray(v))invalid();return v as Obj;}
function list(v:unknown):unknown[]{if(!Array.isArray(v)||v.length>5000)invalid();return v;}
function parse(raw:string){if(typeof raw!=='string'||Buffer.byteLength(raw)>15_000_000)invalid();assertRawJsonWithoutDuplicateKeysV1(raw);return obj(JSON.parse(raw));}
function draft(v:Obj){for(const k of ['sourceApproved','runtimePublishable','canApply','mayActivate'])if(v[k]!==false)invalid();}
export const readSourceClassDefinitionDraftsRawV1=()=>read(definitionsPath);

/** Analyze the existing transfer's canonical rationals, without changing its
 * arithmetic or rounding them. Finite source precision does not bound serving
 * division: a reduced denominator containing other primes repeats forever. */
export function inspectExactRationalRepresentationV1(value:unknown){
 const r=obj(value);if(Object.keys(r).length!==2)invalid();
 const integer=(v:unknown)=>{if(typeof v!=='string'||!/^(0|[1-9][0-9]{0,79})$/.test(v))invalid();return BigInt(v);};
 const n=integer(r.numerator),d=integer(r.denominator);if(d===0n)invalid();
 let a=n,b=d;while(b){const t=a%b;a=b;b=t;}if(a!==1n)invalid();
 let rest=d,twos=0,fives=0;while(rest%2n===0n){rest/=2n;twos++;}while(rest%5n===0n){rest/=5n;fives++;}
 return {exact:{numerator:String(n),denominator:String(d)},decimalKind:rest===1n?'FINITE':'NON_TERMINATING',
  minimumFinitePlaces:rest===1n?Math.max(twos,fives):null,losslessAtThreePlaces:rest===1n&&twos<=3&&fives<=3};
}

export function validateSourceClassDefinitionDraftsV1(raw:string,sourceKeys:string[]){
 const p=parse(raw);draft(p);
 if(p.contract!=='potok-source-class-definition-drafts-v1'||p.usage!=='EXACT_RETAINED_REFERENCE_CLASSES_NOT_OWNER_FOOD_APPROVAL')invalid();
 if(new Set(sourceKeys).size!==sourceKeys.length)invalid();
 const sources=readPilotBindingSourceDossiersV1(),seen=new Set<string>(),definitions=list(p.definitions).map(obj);
 for(const d of definitions){draft(d);if(d.status!=='DRAFT_SOURCE_CLASS_NOT_CANONICAL'||d.canonicalFoodId!==null||d.foodStableId!==null
  ||typeof d.proposedNameRu!=='string'||!d.proposedNameRu.trim()||!['FOOD','POTABLE_WATER','TABLE_SALT'].includes(String(d.componentKind))
  ||!(d.proposedFoodState===null||['raw','dry','frozen','cooked','as-sold'].includes(String(d.proposedFoodState)))
  ||list(d.unresolvedSourceAttributes).some(a=>typeof a!=='string'||!a))invalid();
  const bindings=list(d.sourceBindings);if(!bindings.length)invalid();
  for(const k of bindings){if(typeof k!=='string'||seen.has(k)||!sourceKeys.includes(k))invalid();seen.add(k);const s=sources.get(k);if(!s)invalid();
   const kind=k==='SR28:14411'?'POTABLE_WATER':k==='SR28:02047'?'TABLE_SALT':'FOOD';
   if(d.sourceDescription!==s.description||d.retainedPath!==s.retainedPath||d.retainedSha256!==s.retainedSha256
    ||d.sourceVectorSha256!==pilotDigestV1(pilotCanonicalV1(s.vector))||d.basis!==s.basis||d.componentKind!==kind)invalid();
  }
 }
 if(seen.size!==sourceKeys.length)invalid();return definitions;
}

// An observed compatibility inventory, not new accepted contract versions.
export const precisionBoundaryPathsV1=[
 'src/utils/foodReviewedEvidenceV1.ts','src/utils/adaptiveNutritionGraphV1.ts','src/utils/adaptiveNutritionGraphV2.ts',
 'src/utils/curatedRecipePublicationV1.ts','src/utils/reviewedRuntimeRecipePublicationEvidenceV1.ts',
 'src/utils/adaptiveNutritionMealCompositionV1.ts','src/utils/adaptiveNutritionMealBalanceV1.ts',
 'src/server/generationMenuCandidatesV1.ts','src/server/generationPlanProposalV1.ts',
 'src/server/generationValidationAdapterV1.ts','src/server/generationWeekOptimizationV1.ts',
 'src/server/generationWeekMetricProducerV1.ts','src/server/generationWeekDecisionProjectionV1.ts',
 'src/server/generationValidationAuthorityLoaderV1.ts','src/server/generationSqlGatewayV1.ts',
 'scripts/contracts/generation-validation-store-v1.sql',
 'docs/premium/drafts/generation_plan_readback_v2.sql',
 'docs/premium/drafts/20260927_adaptive_nutrition_graph_v2_authorities_activation_v1.sql',
] as const;

export async function reviewSourceClassesAndPrecisionV1(candidateRaw:string,models:ReviewInputModelV1[],scenarioRaw:string,
 definitionsRaw=readSourceClassDefinitionDraftsRawV1(),freezeRaw=readPilotFreezeRawV1()){
 const freeze=verifyPilotInputFreezeV1(candidateRaw,models,freezeRaw),keys=[...new Set(models.flatMap(m=>m.rows.map(r=>String(r.component.sourceRecord))))].sort();
 const definitions=validateSourceClassDefinitionDraftsV1(definitionsRaw,keys),dossiers=readPilotBindingSourceDossiersV1();
 const sourceRows=models.flatMap(m=>m.rows.map(({component:c})=>{
  const s=dossiers.get(String(c.sourceRecord));if(!s||!c.vector)invalid();
  const definition=definitions.find(d=>list(d.sourceBindings).includes(c.sourceRecord));if(!definition)invalid();
  const comparison=(v:string)=>v.includes('.')?v.replace(/0+$/,'').replace(/\.$/,''):v;
  if(axes.some(a=>comparison(c.vector![a])!==comparison(s.vector[a])))invalid();
  const blockedAxes=axes.filter(a=>{try{normalizeFoodEvidenceSourceDecimalV1(s.vector[a]);return false;}catch{return true;}});
  return {recipeId:m.recipeId,rowId:c.rowId,componentKind:c.componentKind,sourceRecord:c.sourceRecord,
   proposedSourceClass:definition.proposedNameRu,proposedFoodState:definition.proposedFoodState,unresolvedSourceAttributes:definition.unresolvedSourceAttributes,
   blockedFoodEvidenceAxes:blockedAxes,sourceValues:s.vector,canonicalFoodId:null,foodStableId:null,...flags};
 }));
 const transfer=await preparePilotServerTransferV1(candidateRaw,models,freezeRaw);
 const s=parse(scenarioRaw) as unknown as CapacityScenarioV1&{weekStart:string};
 const witness=findCompleteInputWeekWitnessV1(models.map(m=>({recipeId:m.recipeId,sourceCategory:m.sourceCategory,caloriesPerDeclaredServing:m.calculation.perDeclaredServing!.calories})),s);
 if(witness.status!=='CONDITIONAL_INPUT_WEEK_WITNESS')invalid();
 const groups=read('docs/premium/retained-sources/nonfish-lentil-20261105/observed-groups-with-lentils-v1.json');
 const week=await buildWeekTransferHandoffV1(candidateRaw,models,freezeRaw,scenarioRaw,witness,[],groups);
 const scopes:Record<string,ReturnType<typeof inspectExactRationalRepresentationV1>[]>={};
 const collect=(scope:string,value:unknown)=>(scopes[scope]??=[]).push(inspectExactRationalRepresentationV1(value));
 for(const recipe of transfer.recipes){for(const c of recipe.components)for(const a of axes)collect('COMPONENT_INPUT',c.values[a].exact);
  for(const a of axes){collect('WHOLE_RECIPE_INPUT',recipe.wholeInput[a].exact);collect('DECLARED_SERVING',recipe.perDeclaredServing[a].exact);}}
 for(const day of week.days){for(const meal of day.meals)for(const a of axes)collect('ASSIGNED_MEAL',meal.exactConditionalInputNutrition[a]);for(const a of axes)collect('DAY',day.exactConditionalInputNutrition[a]);}
 for(const a of axes)collect('WEEK',week.exactWeeklyConditionalInputNutrition[a]);
 const scopeSummary=Object.fromEntries(Object.entries(scopes).map(([scope,values])=>[scope,{axes:values.length,
  finiteBeyondThree:values.filter(v=>v.decimalKind==='FINITE'&&!v.losslessAtThreePlaces).length,
  nonTerminating:values.filter(v=>v.decimalKind==='NON_TERMINATING').length,
  maxFinitePlaces:Math.max(0,...values.flatMap(v=>v.minimumFinitePlaces===null?[]:[v.minimumFinitePlaces]))}]));
 return {contract:'potok-source-class-precision-compatibility-review-v1',usage:'OFFLINE_DESIGN_REVIEW_NOT_NEW_RUNTIME_ENCODING',
  bindings:{freezeSha256:pilotDigestV1(pilotCanonicalV1(freeze)),definitionsSha256:pilotDigestV1(definitionsRaw),scenarioSha256:pilotDigestV1(scenarioRaw)},
  summary:{sourceClasses:definitions.length,sourceBindingLabels:keys.length,foodClasses:definitions.filter(d=>d.componentKind==='FOOD').length,
   sourceRows:sourceRows.length,foodEvidencePrecisionBlockedRows:sourceRows.filter(r=>r.componentKind==='FOOD'&&r.blockedFoodEvidenceAxes.length).length,
   sourceClassesWithUnspecifiedState:definitions.filter(d=>d.proposedFoodState===null).length,admittedRecipes:0},sourceRows,scopeSummary,
  exactWeek:week,existingBoundaryInventory:precisionBoundaryPathsV1.map(path=>({path,sha256:pilotDigestV1(read(path))})),
  proposedDirection:{sourceStorage:'RETAIN_ORIGINAL_FINITE_DECIMAL_TEXT_AND_SOURCE_BINDINGS',calculationStorage:'REDUCED_NONNEGATIVE_RATIONAL_TEXT_PAIRS',
   finiteScaleOnly:'INSUFFICIENT_FOR_NON_TERMINATING_SERVING_DIVISION',rounding:'EXPLICIT_PRESENTATION_PROJECTION_ONLY_NO_AUTHORITY_FROM_DISPLAY',
   migration:'SEPARATELY_VERSIONED_FOOD_EVIDENCE_GRAPH_PUBLICATION_VALIDATION_STORAGE_AND_READBACK',
   legacy:'PRESERVE_CURRENT_THREE_PLACE_FORMATS_DIGESTS_AND_ROUNDING',implementedRuntimeSupport:false},...flags};
}
if(process.argv[1]&&import.meta.url===pathToFileURL(process.argv[1]).href){
 if(process.argv.length!==5)throw Error('Usage: ... ORIGINAL_CANDIDATE.json MODEL_PACKET.json ORIGINAL_SCENARIO.json');
 const inputs=process.argv.slice(2).map(p=>readFileSync(p,'utf8'));
 process.stdout.write(JSON.stringify(await reviewSourceClassesAndPrecisionV1(inputs[0],list(parse(inputs[1]).expandedInputModels) as ReviewInputModelV1[],inputs[2]),null,2)+'\n');
}
