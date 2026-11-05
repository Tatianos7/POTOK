import {createHash} from 'node:crypto';
import {readFileSync} from 'node:fs';
import {pathToFileURL} from 'node:url';
import {assertRawJsonWithoutDuplicateKeysV1} from '../../src/utils/adaptiveNutritionWireV1';
import {calculatePreciseInputV3} from './foundation-variants-review-v1';
import {runNonfishLentilAlternativesV1} from './nonfish-lentil-alternatives-v1';
import type {ReviewInputModelV1} from './week-quality-preparation-v1';

// Offline inventory only. Digests establish reproducibility, never approval.
// Real publication/context decoders remain the only admission boundary.
const axes=['calories','protein','fat','carbs','fiber'] as const;
const flags={sourceApproved:false,runtimePublishable:false,canApply:false,mayActivate:false,readyForServerSubmission:false} as const;
const freezePath='docs/premium/retained-sources/pilot19-admission-20261105/pilot-input-freeze-v1.json';
export const admissionContractPathsV1=[
 'src/utils/curatedRecipePublicationV1.ts',
 'src/utils/adaptiveNutritionGraphV1.ts',
 'src/utils/adaptiveNutritionAuthoritiesV1.ts',
 'src/utils/reviewedRuntimeRecipePublicationEvidenceV1.ts',
 'src/utils/adaptiveNutritionMealCompositionV1.ts',
 'src/utils/trustedValidationEvidenceV1.ts',
 'src/server/generationValidationAuthorityLoaderV1.ts',
] as const;
type Obj=Record<string,unknown>;
export const pilotDigestV1=(s:string)=>createHash('sha256').update(s).digest('hex');
function invalid():never{throw Error('INVALID_PILOT_ADMISSION_INVENTORY');}
function obj(v:unknown):Obj{if(!v||typeof v!=='object'||Array.isArray(v))invalid();return v as Obj;}
function list(v:unknown):unknown[]{if(!Array.isArray(v)||v.length>2000)invalid();return v;}
export function pilotCanonicalV1(v:unknown):string{
 if(v===null||typeof v==='string'||typeof v==='boolean')return JSON.stringify(v);
 if(typeof v==='number'){if(!Number.isFinite(v))invalid();return JSON.stringify(v);}
 if(Array.isArray(v))return '['+v.map(pilotCanonicalV1).join(',')+']';
 const o=obj(v);return '{'+Object.keys(o).sort().map(k=>JSON.stringify(k)+':'+pilotCanonicalV1(o[k])).join(',')+'}';
}
function parse(raw:string){if(typeof raw!=='string'||Buffer.byteLength(raw)>15_000_000)invalid();assertRawJsonWithoutDuplicateKeysV1(raw);return obj(JSON.parse(raw));}
function id(v:unknown):string{if(typeof v!=='string'||!v||v.length>160)invalid();return v;}
function noPromotion(v:Obj){for(const k of Object.keys(flags))if(k in v&&v[k]!==false)invalid();}
const read=(p:string)=>readFileSync(new URL('../../'+p,import.meta.url),'utf8');
export function readAdmissionContractSourcesV1(){return Object.fromEntries(admissionContractPathsV1.map(p=>[p,read(p)]));}
export function readPilotFreezeRawV1(){return read(freezePath);}

function checkedInputs(candidateRaw:string,models:ReviewInputModelV1[]){
 const catalog=obj(parse(candidateRaw).originalAuthoringCatalog),recipes=list(catalog.recipes).map(obj);
 if(!models.length||models.length>128||new Set(models.map(m=>m.recipeId)).size!==models.length||new Set(recipes.map(r=>r.recipeId)).size!==recipes.length)invalid();
 return [...models].sort((a,b)=>a.recipeId<b.recipeId?-1:a.recipeId>b.recipeId?1:0).map(m=>{
  id(m.recipeId);noPromotion(obj(m));if(m.sourceApproved!==false||m.runtimePublishable!==false)invalid();
  const recipe=recipes.find(r=>r.recipeId===m.recipeId);if(!recipe||recipe.declaredServings!==m.declaredServings||obj(recipe.sourceRecipe).meal_type_primary!==m.sourceCategory)invalid();
  const originalRows=list(recipe.ingredients).map(obj),rowIds=originalRows.map(r=>id(r.ingredient_row_id));
  if(new Set(rowIds).size!==rowIds.length||new Set(m.rows.map(r=>r.component.rowId)).size!==m.rows.length)invalid();
  const recalculated=calculatePreciseInputV3(m.rows.map(r=>r.component),m.declaredServings);
  if(!recalculated.perDeclaredServing||pilotCanonicalV1(recalculated.perDeclaredServing)!==pilotCanonicalV1(m.calculation.perDeclaredServing))invalid();
  const rows=m.rows.map(row=>{
   noPromotion(obj(row));noPromotion(obj(row.component));const original=originalRows.find(r=>r.ingredient_row_id===row.component.rowId);if(!original)invalid();
   if(!['UNRESOLVED','AMBIGUOUS','RESOLVED'].includes(String(original.canonical_status)))invalid();
   return {rowId:row.component.rowId,inputKind:row.component.componentKind,authoringCanonicalStatus:original.canonical_status,
    identityEvidence:'NOT_SUPPLIED_IN_INPUT_MODEL',approvedNonFoodEvidence:'NOT_SUPPLIED_IN_INPUT_MODEL',
    publicationNormalization:row.component.componentKind==='POTABLE_WATER'&&row.component.quantityG===null?'ML_WITHOUT_GRAMS_REQUIRES_COMPATIBILITY_REVIEW':'REVIEWED_NORMALIZATION_NOT_SUPPLIED'};
  });
  return {model:m,recipe,rows};
 });
}
/** A helper for reproducible fixtures as well as the bounded real pilot. The
 * checked-in freeze, not a caller-provided flag or regenerated hash, pins scope. */
export function buildPilotInputFreezeV1(candidateRaw:string,models:ReviewInputModelV1[],sources:Record<string,string>){
 const inputs=checkedInputs(candidateRaw,models);
 if(Object.keys(sources).length!==admissionContractPathsV1.length||admissionContractPathsV1.some(p=>typeof sources[p]!=='string'||!sources[p]))invalid();
 return {contract:'potok-pilot-input-freeze-v1',usage:'OFFLINE_INPUT_INTEGRITY_ONLY_NOT_ADMISSION',candidateBytesSha256:pilotDigestV1(candidateRaw),
  inputSetSha256:pilotDigestV1(pilotCanonicalV1(inputs.map(i=>i.model))),
  recipes:inputs.map(i=>({recipeId:i.model.recipeId,authoringRecipeSha256:pilotDigestV1(pilotCanonicalV1(i.recipe)),modelSha256:pilotDigestV1(pilotCanonicalV1(i.model)),componentRows:i.rows.length})),
  serverContracts:admissionContractPathsV1.map(path=>({path,sha256:pilotDigestV1(sources[path])})),...flags};
}
export function verifyPilotInputFreezeV1(candidateRaw:string,models:ReviewInputModelV1[],freezeRaw:string,sources=readAdmissionContractSourcesV1()){
 const expected=buildPilotInputFreezeV1(candidateRaw,models,sources),provided=parse(freezeRaw);
 if(pilotCanonicalV1(provided)!==pilotCanonicalV1(expected))invalid();return expected;
}
// These are evidence requests, not alternate admission rules. Null means absent
// from THIS pilot packet; it says nothing about the contents of a live database.
export const pilotEvidenceRequirementsV1={
 sourceNutrition:['reviewedSource.reviewStatus','reviewedSource.recipeEvidenceRef','reviewedSource.nutritionEvidenceRef'],
 foodIdentity:['reviewedSource.foodBindings[].canonical','reviewedSource.foodBindings[].canonical.sharedCatalogAccessible'],
 zeroInputIdentity:['reviewedSource.foodBindings[].canonical OR reviewedSource.nonFoodBindings[].componentDefinitionId + approvedNonFoodEvidenceRef'],
 portionPolicy:['manifestEntry.portionRules','manifestEntry.recipeSnapshot.ingredients[].scaling'],
 safety:['reviewedSource.allergenEvidenceRef','reviewedSource.dietaryEvidenceRef'],
 composition:['compositionEligibility','manifestEntry.allowedMealTypes','manifestEntry.repeatFamily'],
 planEligibility:['planEligibility'],
 publicationIdentity:['manifestEntry.recipeId','manifestEntry.recipeRevisionId','manifestEntry.publicationRevision'],
 currentContext:['accountId','requestOperationId','input','manifest','preference','safety','validationEvidenceRaw','policiesRaw'],
} as const;
export function inspectPilotAdmissionReadinessV1(candidateRaw:string,models:ReviewInputModelV1[],freezeRaw:string,sources=readAdmissionContractSourcesV1()){
 const freeze=verifyPilotInputFreezeV1(candidateRaw,models,freezeRaw,sources),inputs=checkedInputs(candidateRaw,models);
 const recipes=inputs.map(({model,rows})=>({recipeId:model.recipeId,status:'BLOCKED_EVIDENCE_NOT_BOUND',rows,
  evidence:Object.fromEntries(Object.keys(pilotEvidenceRequirementsV1).filter(k=>k!=='currentContext').map(k=>[k,null])),
  precision:{inputDecimalPlaces:8,serverGraphDecimalPlaces:3,
   nonzeroBeyondThreeAxes:axes.filter(a=>{const s=model.calculation.perDeclaredServing![a];if(!/^\d+\.\d{8}$/.test(s))invalid();return /[1-9]/.test(s.split('.')[1].slice(3));}),
   mappingPolicy:'NOT_SUPPLIED_NO_ROUNDING_OR_CONTRIBUTION_ALLOCATION_APPLIED'},
  physicalCookingValidation:'DEFERRED_TO_OWNER_PRELAUNCH_NOT_AN_OFFLINE_GATE',...flags}));
 const rows=recipes.flatMap(r=>r.rows);
 return {contract:'potok-pilot-admission-readiness-v1',scope:'OFFLINE_EVIDENCE_INVENTORY_NOT_RUNTIME_AUTHORITY',freezeSha256:pilotDigestV1(pilotCanonicalV1(freeze)),
  summary:{recipes:recipes.length,componentRows:rows.length,foodRows:rows.filter(r=>r.inputKind==='FOOD').length,
   potableWaterRows:rows.filter(r=>r.inputKind==='POTABLE_WATER').length,tableSaltRows:rows.filter(r=>r.inputKind==='TABLE_SALT').length,
   authoringUnresolvedRows:rows.filter(r=>r.authoringCanonicalStatus==='UNRESOLVED').length,
   recipesWithNonzeroBeyondThree:recipes.filter(r=>r.precision.nonzeroBeyondThreeAxes.length).length,admittedRecipes:0},
  requiredEvidence:pilotEvidenceRequirementsV1,recipes,currentAccountAndRequestContext:null,
  normalizationCompatibility:{graphAllowsPairedNullMassAndEvidenceForML:true,publicationAuditRequiresPositiveMassAndEvidenceForML:true,
   decision:'PRESERVE_EXISTING_GATES_NO_DENSITY_OR_MASS_INVENTED'},...flags};
}
if(process.argv[1]&&import.meta.url===pathToFileURL(process.argv[1]).href){
 if(process.argv.length!==4)throw Error('Usage: ... CANDIDATE_CATALOG.json SCENARIO.json');
 const raw=readFileSync(process.argv[2],'utf8'),models=runNonfishLentilAlternativesV1(raw,readFileSync(process.argv[3],'utf8')).expandedInputModels;
 process.stdout.write(JSON.stringify(inspectPilotAdmissionReadinessV1(raw,models,readPilotFreezeRawV1()),null,2)+'\n');
}
