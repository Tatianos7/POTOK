import {readFileSync} from 'node:fs';
import {pathToFileURL} from 'node:url';
import {assertRawJsonWithoutDuplicateKeysV1} from '../../src/utils/adaptiveNutritionWireV1';
import {decodeReviewedRuntimeRecipePublicationEvidenceRawV1} from '../../src/utils/reviewedRuntimeRecipePublicationEvidenceV1';
import type {GraphNutritionV1} from '../../src/utils/adaptiveNutritionGraphV1';
import {runNonfishLentilAlternativesV1} from './nonfish-lentil-alternatives-v1';
import {pilotCanonicalV1,pilotDigestV1,readPilotFreezeRawV1,verifyPilotInputFreezeV1} from './pilot-admission-readiness-v1';
import type {ReviewInputModelV1} from './week-quality-preparation-v1';

// A separate OFFLINE preparation protocol. This is neither Graph v2 nor a
// publication/receipt authority, and has no storage, network or activation port.
export const pilotTransferRequestContractV1='potok-pilot-server-transfer-request-v1';
export const pilotTransferContractV1='potok-pilot-server-transfer-preparation-v1';
export const pilotTransferPrecisionPolicyV1='EXACT_THREE_DECIMAL_ONLY_NO_ROUNDING_NO_RESIDUAL_ALLOCATION';
const axes=['calories','protein','fat','carbs','fiber'] as const;
type Axis=typeof axes[number];type Obj=Record<string,unknown>;
const flags={sourceApproved:false,runtimePublishable:false,canApply:false,mayActivate:false,readyForServerSubmission:false} as const;
function invalid():never{throw Error('INVALID_PILOT_SERVER_TRANSFER');}
function object(v:unknown):Obj{if(!v||typeof v!=='object'||Array.isArray(v)||Object.getPrototypeOf(v)!==Object.prototype)invalid();return v as Obj;}
function record(v:unknown,keys:readonly string[]){const o=object(v);if(Object.keys(o).length!==keys.length||keys.some(k=>!Object.hasOwn(o,k)))invalid();return o;}
function list(v:unknown):unknown[]{if(!Array.isArray(v)||v.length>2000)invalid();return v;}
function text(v:unknown):string{if(typeof v!=='string'||!v||v.length>160||v.includes('\0'))invalid();return v;}
function parse(raw:string){if(typeof raw!=='string'||Buffer.byteLength(raw)>15_000_000)invalid();assertRawJsonWithoutDuplicateKeysV1(raw);return JSON.parse(raw) as unknown;}
function minor(value:unknown,places:number){if(typeof value!=='string'||!new RegExp('^(0|[1-9][0-9]{0,6})(\\.[0-9]{1,'+places+'})?$').test(value))invalid();const [n,f='']=value.split('.');return BigInt(n)*10n**BigInt(places)+BigInt(f.padEnd(places,'0'));}
const fixed3=(n:bigint)=>String(n/1000n)+'.'+String(n%1000n).padStart(3,'0');
function gcd(a:bigint,b:bigint):bigint{while(b){const r=a%b;a=b;b=r;}return a;}
/** Exact rational in kcal or grams, before V3's eight-place presentation. */
function fraction(n:bigint,d:bigint){if(n<0n||d<=0n)invalid();const g=gcd(n,d);return {numerator:String(n/g),denominator:String(d/g)};}
function graphValue(n:bigint,d:bigint):string|null{return n*1000n%d===0n?fixed3(n*1000n/d):null;}
interface BindingV1{recipeId:string;reviewedPublicationRaw:string;pinnedReviewedPublicationRaw:string;componentBindings:{rowId:string;componentId:string}[]}
function bindings(raw:string|undefined,freeze:ReturnType<typeof verifyPilotInputFreezeV1>):BindingV1[]{
 if(raw===undefined)return [];
 const r=record(parse(raw),['contract','candidateBytesSha256','inputSetSha256','recipes']);
 if(r.contract!==pilotTransferRequestContractV1||r.candidateBytesSha256!==freeze.candidateBytesSha256||r.inputSetSha256!==freeze.inputSetSha256)invalid();
 const seen=new Set<string>();return list(r.recipes).map(value=>{
  const v=record(value,['recipeId','reviewedPublicationRaw','pinnedReviewedPublicationRaw','componentBindings']),recipeId=text(v.recipeId);
  if(seen.has(recipeId)||!freeze.recipes.some(r=>r.recipeId===recipeId))invalid();seen.add(recipeId);
  for(const k of ['reviewedPublicationRaw','pinnedReviewedPublicationRaw'])if(typeof v[k]!=='string'||!v[k]||Buffer.byteLength(v[k] as string)>2_000_000)invalid();
  const componentBindings=list(v.componentBindings).map(x=>{const b=record(x,['rowId','componentId']);return {rowId:text(b.rowId),componentId:text(b.componentId)};});
  if(new Set(componentBindings.map(b=>b.rowId)).size!==componentBindings.length||new Set(componentBindings.map(b=>b.componentId)).size!==componentBindings.length)invalid();
  return {recipeId,reviewedPublicationRaw:v.reviewedPublicationRaw as string,pinnedReviewedPublicationRaw:v.pinnedReviewedPublicationRaw as string,componentBindings};
 });
}
export async function preparePilotServerTransferV1(candidateRaw:string,models:ReviewInputModelV1[],freezeRaw:string,reviewedBindingsRaw?:string){
 const freeze=verifyPilotInputFreezeV1(candidateRaw,models,freezeRaw),supplied=bindings(reviewedBindingsRaw,freeze);
 const originals=list(object(object(parse(candidateRaw)).originalAuthoringCatalog).recipes).map(object);
 const recipes=[];
 for(const frozen of freeze.recipes){
  const model=models.find(m=>m.recipeId===frozen.recipeId)!;const original=originals.find(r=>r.recipeId===model.recipeId)!;
  const originalsById=new Map(list(original.ingredients).map(object).map(r=>[r.ingredient_row_id,r]));
  const servingsMinor=minor(String(model.declaredServings),3);if(servingsMinor<=0n)invalid();
  const whole=Object.fromEntries(axes.map(a=>[a,0n])) as Record<Axis,bigint>;
  const components=model.rows.map((row,sortOrder)=>{
   const c=row.component,authoring=originalsById.get(c.rowId);if(!authoring||!c.vector)invalid();
   const water=c.componentKind==='POTABLE_WATER';
   // V3's typed-water zero check has already run in freeze verification. The
   // recorded volume is preserved, never normalized using an assumed density.
   let amount:string,unit:'g'|'ml',normalizedGrams:string|null;
   if(water){if(authoring.unit!=='ML'||typeof authoring.amount!=='number')invalid();const volume=minor(String(authoring.amount),3);if(volume<=0n||c.quantityG!==null)invalid();amount=fixed3(volume);unit='ml';normalizedGrams=null;}
   else {if(c.quantityG===null)invalid();amount=fixed3(minor(c.quantityG,3));unit='g';normalizedGrams=amount;}
   const values=Object.fromEntries(axes.map(a=>{
    // value_per100g (1e8) * mass_g (1e3) /100 = numerator /1e13.
    const n=water?0n:minor(c.vector![a],8)*minor(c.quantityG,3);whole[a]+=n;
    return [a,{exact:fraction(n,10_000_000_000_000n),graphValue:graphValue(n,10_000_000_000_000n)}];
   })) as Record<Axis,{exact:{numerator:string;denominator:string};graphValue:string|null}>;
   return {rowId:c.rowId,sortOrder,inputKind:c.componentKind,sourceRecord:c.sourceRecord,
    quantity:{amount,unit,normalizedGrams,normalizationEvidenceRef:null},quantityBasis:water?'RECORDED_ML_NO_GRAM_CONVERSION':'CONDITIONAL_MODEL_GRAMS_NOT_A_VOLUME_CONVERSION',
    identity:null,approvedNonFoodEvidenceRef:null,values};
  });
  const wholeInput=Object.fromEntries(axes.map(a=>[a,{exact:fraction(whole[a],10_000_000_000_000n),graphValue:graphValue(whole[a],10_000_000_000_000n)}]));
  const perDeclaredServing=Object.fromEntries(axes.map(a=>[a,{exact:fraction(whole[a]*1000n,10_000_000_000_000n*servingsMinor),
   graphValue:graphValue(whole[a]*1000n,10_000_000_000_000n*servingsMinor),v3Preview:model.calculation.perDeclaredServing![a]}]));
  const precisionBlockers=[...components.flatMap(c=>axes.filter(a=>c.values[a].graphValue===null).map(axis=>({scope:'COMPONENT',rowId:c.rowId,axis}))),
   ...axes.filter(a=>wholeInput[a].graphValue===null).map(axis=>({scope:'WHOLE_INPUT',rowId:null,axis})),
   ...axes.filter(a=>perDeclaredServing[a].graphValue===null).map(axis=>({scope:'PER_DECLARED_SERVING',rowId:null,axis}))];
  const mlRows=components.filter(c=>c.quantity.unit==='ml'&&c.quantity.normalizedGrams===null).map(c=>c.rowId);
  const binding=supplied.find(b=>b.recipeId===model.recipeId);
  let evidenceComparison:'NOT_SUPPLIED'|'MATCHED_VALUES_ONLY_NOT_SOURCE_ADMISSION'='NOT_SUPPLIED';
  let publicationRawSha256:string|null=null;
  if(binding){
   // Caller must supply independently pinned raw evidence. Equality/hash checks
   // do not authenticate a reviewer; no receipt/currentness authority is created.
   const publication=await decodeReviewedRuntimeRecipePublicationEvidenceRawV1(binding.reviewedPublicationRaw,binding.pinnedReviewedPublicationRaw);
   if(publication.reviewedSource.authoringRecipeId!==model.recipeId||binding.componentBindings.length!==components.length)invalid();
   const snapshot=publication.manifestEntry.recipeSnapshot;
   if(snapshot.ingredients.length!==components.length||snapshot.baseYield.servings!==fixed3(servingsMinor)||precisionBlockers.length)invalid();
   for(const c of components){
    const map=binding.componentBindings.find(b=>b.rowId===c.rowId),target=snapshot.ingredients.find(i=>i.componentId===map?.componentId);if(!target)invalid();
    if(target.sortOrder!==c.sortOrder)invalid();
    if(c.inputKind==='FOOD'&&target.identity.kind!=='canonical_food')invalid();
    if(target.quantity.amount!==c.quantity.amount||target.quantity.unit!==c.quantity.unit||target.normalizedGrams!==c.quantity.normalizedGrams)invalid();
    if(c.quantity.unit==='ml'&&target.normalizationEvidenceRef!==null)invalid();
    for(const a of axes)if(target.nutrition[a]!==c.values[a].graphValue)invalid();
   }
   for(const a of axes)if(snapshot.fullRecipeNutrition[a]!==wholeInput[a].graphValue)invalid();
   // Positive result is a structural/value comparison only; the source models
   // and their actual canonical identity remain unapproved and unchanged.
   evidenceComparison='MATCHED_VALUES_ONLY_NOT_SOURCE_ADMISSION';publicationRawSha256=pilotDigestV1(binding.reviewedPublicationRaw);
  }
  const graphAxis=(a:Axis)=>{const v=wholeInput[a].graphValue;if(v===null)invalid();return v;};
  const exactGraphNutrition:GraphNutritionV1|null=precisionBlockers.length?null:{calories:graphAxis('calories'),protein:graphAxis('protein'),fat:graphAxis('fat'),carbs:graphAxis('carbs'),fiber:graphAxis('fiber')};
  recipes.push({recipeId:model.recipeId,inputModelSha256:frozen.modelSha256,authoringRecipeSha256:frozen.authoringRecipeSha256,
   declaredServings:fixed3(servingsMinor),components,wholeInput,perDeclaredServing,precisionBlockers,exactGraphNutrition,
   evidenceComparison,publicationRawSha256,
   currentPublicationAudit:{status:mlRows.length?'ML_NORMALIZATION_BLOCKED':'NOT_RUN_AUTHORING_EVIDENCE_NOT_BOUND',missingMassAndNormalizationRows:mlRows},
   sourceAdmission:'NOT_PERFORMED',sourceStateComparison:'NOT_ASSESSED_BY_NUMERIC_COMPARISON',nonFoodReceiptsAndCurrentness:'NOT_VERIFIED',accountAndRequestContext:null,
   measuredYieldG:null,confirmedServings:null,physicalCookingValidation:'DEFERRED_TO_OWNER_PRELAUNCH_NOT_AN_OFFLINE_GATE',...flags});
 }
 return {contract:pilotTransferContractV1,usage:'OFFLINE_TRANSFER_PREPARATION_NOT_RUNTIME_AUTHORITY',precisionPolicy:pilotTransferPrecisionPolicyV1,
  freezeSha256:pilotDigestV1(pilotCanonicalV1(freeze)),candidateBytesSha256:freeze.candidateBytesSha256,inputSetSha256:freeze.inputSetSha256,
  summary:{recipes:recipes.length,componentRows:recipes.reduce((s,r)=>s+r.components.length,0),
   recipesWithPrecisionBlockers:recipes.filter(r=>r.precisionBlockers.length).length,
   recipesWithCurrentPublicationMLBlockers:recipes.filter(r=>r.currentPublicationAudit.missingMassAndNormalizationRows.length).length,
   matchedReviewedValueComparisons:recipes.filter(r=>r.evidenceComparison==='MATCHED_VALUES_ONLY_NOT_SOURCE_ADMISSION').length,admittedRecipes:0},recipes,...flags};
}
if(process.argv[1]&&import.meta.url===pathToFileURL(process.argv[1]).href){
 if(process.argv.length!==4&&process.argv.length!==5)throw Error('Usage: ... CANDIDATE_CATALOG.json SCENARIO.json [REVIEWED_BINDINGS.json]');
 const raw=readFileSync(process.argv[2],'utf8'),models=runNonfishLentilAlternativesV1(raw,readFileSync(process.argv[3],'utf8')).expandedInputModels;
 const result=await preparePilotServerTransferV1(raw,models,readPilotFreezeRawV1(),process.argv[4]?readFileSync(process.argv[4],'utf8'):undefined);
 process.stdout.write(JSON.stringify(result,null,2)+'\n');
}
