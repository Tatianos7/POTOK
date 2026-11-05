import {createHash} from 'node:crypto';import {readFileSync} from 'node:fs';import {pathToFileURL} from 'node:url';
import {assertRawJsonWithoutDuplicateKeysV1} from '../../src/utils/adaptiveNutritionWireV1';
import {decodeAuthoringRecipeCatalog,authoringSearchInput} from '../../src/dev/authoringRecipeCatalog';
import {previewRecipeAuthoringWeekV1,type AuthoringWeekScenarioV1} from '../../src/dev/authoringWeekSearchV1';
import {runSelectedBreakfastWeekCapacityV1} from './selected-breakfast-week-capacity-v1';
import {readPilotBatchEvidenceV1,validatePilotBatchSourcesV1,type BatchComponentV2} from './pilot-source-quantity-batch-v1';
import {calculatePreciseInputV3} from './foundation-variants-review-v1';
import {diagnoseAuthoringCategoryCapacityV1} from './greek-snack-input-model-v1';
import {findCompleteInputWeekWitnessV1} from './complete-input-week-witness-v1';
import {analyzeWeekInputCalorieCapacityV1} from './week-input-calorie-capacity-v1';
type Obj=Record<string,unknown>;type Vector=NonNullable<BatchComponentV2['vector']>;
const base='docs/premium/retained-sources/grain-main-week-20261105/',method='docs/premium/retained-sources/foundation-variants-20261105/method-facts-v1.json';
const paths=[...[169756,169703,175167].map(i=>base+`fdc-${i}-selected-fields-v1.json`),method],ids=['chicken_breast_rice','salmon_brown_rice'];
const hash=(s:string)=>createHash('sha256').update(s).digest('hex');
function invalid():never{throw Error('INVALID_GRAIN_MAIN_WEEK');}
function obj(v:unknown):Obj{if(!v||typeof v!=='object'||Array.isArray(v))invalid();return v as Obj;}
function list(v:unknown):unknown[]{if(!Array.isArray(v)||v.length>2000)invalid();return v;}
function parse(raw:string){if(typeof raw!=='string'||Buffer.byteLength(raw)>15_000_000)invalid();assertRawJsonWithoutDuplicateKeysV1(raw);return obj(JSON.parse(raw));}
function canon(v:unknown):string{if(v===null||typeof v==='string'||typeof v==='boolean'||typeof v==='number')return JSON.stringify(v);if(Array.isArray(v))return '['+v.map(canon).join(',')+']';const o=obj(v);return '{'+Object.keys(o).sort().map(k=>JSON.stringify(k)+':'+canon(o[k])).join(',')+'}';}
function minor(v:unknown){if(typeof v!=='number'||!Number.isFinite(v)||v<0||v>100000||!/^\d+(?:\.\d{1,3})?$/.test(String(v)))invalid();const [n,f='']=String(v).split('.');return BigInt(n)*1000n+BigInt(f.padEnd(3,'0'));}
export interface GrainMainEvidenceV1{reviewRaw:string;materials:Record<string,string>}
export function readGrainMainEvidenceV1():GrainMainEvidenceV1{const read=(p:string)=>readFileSync(new URL('../../'+p,import.meta.url),'utf8');return {reviewRaw:read(base+'review-bindings-v1.json'),materials:Object.fromEntries(paths.map(p=>[p,read(p)]))};}
export function validateGrainMainBindingsV1(raw:string,e:GrainMainEvidenceV1){
 const p=parse(e.reviewRaw),catalog=obj(parse(raw).originalAuthoringCatalog),recipes=list(catalog.recipes).map(obj);
 if(p.contract!=='potok-grain-main-week-review-v1'||p.scope!=='TWO_PINNED_EXISTING_GRAIN_MAIN_RECIPES_ONLY'||p.candidateBytesSha256!==hash(raw)||[p.sourceApproved,p.runtimePublishable,p.canApply,p.mayActivate].some(v=>v!==false))invalid();
 const rows=list(p.rows).map(obj);if(rows.length!==2||new Set(rows.map(r=>r.recipeId)).size!==2)invalid();for(const b of rows){const r=recipes.find(r=>r.recipeId===b.recipeId);if(!r||!ids.includes(String(b.recipeId))||b.recipeSha256!==hash(canon(r)))invalid();}
 const materials=list(p.materials).map(obj);if(materials.length!==paths.length||new Set(materials.map(m=>m.path)).size!==paths.length)invalid();for(const m of materials)if(typeof m.path!=='string'||!paths.includes(m.path)||hash(e.materials[m.path])!==m.sha256)invalid();
 return {catalog,recipes:recipes.filter(r=>ids.includes(String(r.recipeId)))};
}
export function mapGrainMainSourcesV1(e:GrainMainEvidenceV1){
 function read(id:number,ndb:string,description:string):Vector{
  const c=parse(e.materials[base+`fdc-${id}-selected-fields-v1.json`]);if(c.fdcId!==id||c.ndb!==ndb||c.description!==description||c.dataType!=='SR Legacy'||c.captureContract!=='potok-fdc-primary-selected-fields-v1'||c.captureKind!=='SELECTED_NUMERIC_FIELDS_AND_DEFINITIONS_NOT_FULL_RESPONSE'||c.sourceUrl!==`https://api.nal.usda.gov/fdc/v1/food/${id}`||c.sourceApproved!==false||c.runtimePublishable!==false||c.mayActivate!==false||typeof c.sourceResponseSha256!=='string'||!/^[a-f0-9]{64}$/.test(c.sourceResponseSha256)||typeof c.sourceResponseBytes!=='number'||!Number.isInteger(c.sourceResponseBytes)||c.sourceResponseBytes<=0)invalid();
  const rows=list(c.foodNutrients).map(obj);if(new Set(rows.map(n=>obj(n.nutrient).id)).size!==rows.length)invalid();
  const field=(id:number,number:string,unit:string)=>{const a=rows.filter(n=>obj(n.nutrient).id===id);if(a.length!==1)invalid();const n=obj(a[0].nutrient);if(n.number!==number||n.unitName!==unit||!Number.isInteger(a[0].sourceArrayIndex)||Number(a[0].sourceArrayIndex)<0)invalid();minor(a[0].amount);return a[0].amount as number;};
  const calories=field(1008,'208','kcal'),protein=field(1003,'203','g'),fat=field(1004,'204','g'),total=field(1005,'205','g'),fiber=field(1079,'291','g'),carbs=minor(total)-minor(fiber);if(carbs<0n)invalid();
  return {calories:String(calories),protein:String(protein),fat:String(fat),carbs:String(carbs/1000n)+'.'+String(carbs%1000n).padStart(3,'0'),fiber:String(fiber)};
 }
 const definition=parse(e.materials[method]);if(definition.contract!=='potok-foundation-method-facts-v1'||definition.sourceApproved!==false)invalid();
 return {whiteRice:read(169756,'20444','Rice, white, long-grain, regular, raw, unenriched'),brownRice:read(169703,'20036',"Rice, brown, long-grain, raw (Includes foods for USDA's Food Distribution Program)"),salmon:read(175167,'15236','Fish, salmon, Atlantic, farmed, raw')};
}
export function modelGrainMainRecipeV1(recipe:Obj,sources:ReturnType<typeof mapGrainMainSourcesV1>,existing:Map<string,Vector>){
 const id=String(recipe.recipeId);if(!ids.includes(id))invalid();const raw=list(recipe.ingredients).map(obj),chicken=id==='chicken_breast_rice';if(raw.length!==4)invalid();
 const expected=chicken?['chicken_breast_skinless','white_long_grain_rice','water','olive_oil']:['farmed_atlantic_salmon_fillet','brown_long_grain_rice','olive_oil','water'];
 const keys=chicken?['SR28:05062','FDC_SR_LEGACY:169756:RAW_UNENRICHED:100G','SR28:14411','SR28:04053']:['FDC_SR_LEGACY:175167:FARMED_ATLANTIC_RAW:100G','FDC_SR_LEGACY:169703:BROWN_RAW:100G','SR28:04053','SR28:14411'];
 const vectors=chicken?[existing.get('SR28:05062'),sources.whiteRice,existing.get('SR28:14411'),existing.get('SR28:04053')]:[sources.salmon,sources.brownRice,existing.get('SR28:04053'),existing.get('SR28:14411')];
 const rows=raw.map((r,i)=>{
  if(r.ingredient_row_id!==id+'_ing_'+String(i+1).padStart(2,'0')||r.ingredient_name_en!==expected[i]||r.optional!==false||!vectors[i])invalid();const water=expected[i]==='water';if(water&&(r.unit!=='ML'||typeof r.amount!=='number'||r.amount<=0))invalid();
  const grams=water?null:r.unit==='G'&&typeof r.weight_g==='number'&&r.amount===r.weight_g&&r.weight_g>0?String(r.weight_g):null;
  const component:BatchComponentV2={rowId:String(r.ingredient_row_id),status:water||grams!==null?'DECLARED_SOURCE_INPUT_MODEL':'BLOCKED',componentKind:water?'POTABLE_WATER':'FOOD',sourceRecord:keys[i],vector:vectors[i]!,quantityG:grams,quantityDecision:water?'TYPED_WATER_ZERO_NO_GRAM_CONVERSION':'DECLARED_GRAMS',optional:false};
  return {component,originalRowSha256:hash(canon(r)),finding:'EXACT_PINNED_GRAIN_MAIN_SOURCE_INPUT_ONLY'};
 });
 return {recipeId:id,declaredServings:recipe.declaredServings,rows,calculation:calculatePreciseInputV3(rows.map(r=>r.component),recipe.declaredServings),sourceConditions:chicken?['RAW_SKINLESS_BONELESS_CHICKEN','UNENRICHED_LONG_GRAIN_WHITE_RICE_DRY']:['RAW_FARMED_ATLANTIC_SALMON','LONG_GRAIN_BROWN_RICE_DRY'],measuredYieldG:null,confirmedServings:null,sourceApproved:false,runtimePublishable:false,canApply:false};
}
export function runGrainMainWeekV1(raw:string,scenarioRaw:string,e=readGrainMainEvidenceV1()){
 const {catalog,recipes:originals}=validateGrainMainBindingsV1(raw,e),prior=runSelectedBreakfastWeekCapacityV1(raw,scenarioRaw),sources=mapGrainMainSourcesV1(e),existing=validatePilotBatchSourcesV1(readPilotBatchEvidenceV1()).sources;
 const additions=originals.map(r=>modelGrainMainRecipeV1(r,sources,existing)),recipes=[...prior.recipes,...additions],complete=recipes.filter(r=>r.calculation.perDeclaredServing!==null),search=authoringSearchInput(decodeAuthoringRecipeCatalog(catalog));
 const pool={...search,recipes:search.recipes.filter(r=>complete.some(c=>c.recipeId===r.recipeId)).map(r=>({...r,recipeId:'grain_main__'+r.recipeId,numericReferenceTestInputAvailable:true,referenceNutrition:{values:Object.fromEntries(Object.entries(complete.find(c=>c.recipeId===r.recipeId)!.calculation.perDeclaredServing!).map(([k,v])=>[k,Number(v)]))}}))};
 const s=parse(scenarioRaw) as unknown as AuthoringWeekScenarioV1,result=previewRecipeAuthoringWeekV1(pool,s),capacityInputs=complete.map(r=>({recipeId:r.recipeId,sourceCategory:String(search.recipes.find(x=>x.recipeId===r.recipeId)!.sourceRecipe.meal_type_primary),caloriesPerDeclaredServing:r.calculation.perDeclaredServing!.calories}));
 const components=recipes.flatMap<BatchComponentV2>(r=>r.rows.map(row=>row.component));
 return {contract:'potok-grain-main-week-result-v1',usage:'OFFLINE_CONDITIONAL_SOURCE_INPUT_WEEK_REVIEW',summary:{recipes:recipes.length,completeConditionalInputRecipes:complete.length,sourceModelRows:components.filter(c=>c.status==='DECLARED_SOURCE_INPUT_MODEL').length,blockedRows:components.filter(c=>c.status==='BLOCKED').length,sourceApprovals:0,admittedRecipes:0,appliedChanges:0},recipes,
 actualInputModelWeek:{result,categoryCapacity:diagnoseAuthoringCategoryCapacityV1(pool,s),calorieCapacity:analyzeWeekInputCalorieCapacityV1(capacityInputs,s),completeDomainWitness:findCompleteInputWeekWitnessV1(capacityInputs,s),oldReferenceFallback:false},
 unansweredOwnerChoices:prior.unansweredOwnerChoices,sourceApproved:false,runtimePublishable:false,canApply:false,mayActivate:false,originalDataModified:false,cookedNutritionClaimed:false,physicalCookingBlocksDevelopment:false};
}
if(process.argv[1]&&import.meta.url===pathToFileURL(process.argv[1]).href){if(process.argv.length!==4)throw Error('Usage: ... CANDIDATE_CATALOG.json SCENARIO.json');process.stdout.write(JSON.stringify(runGrainMainWeekV1(readFileSync(process.argv[2],'utf8'),readFileSync(process.argv[3],'utf8')),null,2)+'\n');}
