import {createHash} from 'node:crypto';
import {readFileSync} from 'node:fs';
import {pathToFileURL} from 'node:url';
import {assertRawJsonWithoutDuplicateKeysV1} from '../../src/utils/adaptiveNutritionWireV1';
import {decodeAuthoringRecipeCatalog,authoringSearchInput} from '../../src/dev/authoringRecipeCatalog';
import {previewRecipeAuthoringWeekV1,type AuthoringWeekScenarioV1} from '../../src/dev/authoringWeekSearchV1';
import {runSourceGapsExpansionV1} from './source-gaps-expansion-v1';
import {calculatePreciseInputV3} from './foundation-variants-review-v1';
import {readPilotBatchEvidenceV1,validatePilotBatchSourcesV1,type BatchComponentV2} from './pilot-source-quantity-batch-v1';
import {diagnoseAuthoringCategoryCapacityV1} from './greek-snack-input-model-v1';
type Obj=Record<string,unknown>;
type Vector=NonNullable<BatchComponentV2['vector']>;
const base='docs/premium/retained-sources/breakfast-main-capacity-20261105/';
const oatPath='docs/premium/retained-sources/pilot-19-source-quantity-20261105/fdc-2346396-selected-fields-v1.json';
const methodPath='docs/premium/retained-sources/foundation-variants-20261105/method-facts-v1.json';
const paths=[...[169986,168448,175154,169961].map(id=>base+`fdc-${id}-selected-fields-v1.json`),oatPath,methodPath];
const mains=['chicken_breast_cauliflower','chicken_pumpkin_mushrooms','trout_green_beans'];
const breakfasts=['oatmeal_apple_cinnamon','oatmeal_pumpkin'];
const noReplies={twoBreakfastMilk:'NO_REPLY_RECEIVED',twoBreakfastSalt:'NO_REPLY_RECEIVED',applePeel:'NO_REPLY_RECEIVED',bananaYogurtType:'NO_REPLY_RECEIVED',cocoaType:'NO_REPLY_RECEIVED'};
const oatPolicy={scope:'TWO_PINNED_UNSELECTED_PROPOSALS_ONLY',fdcId:2346396,energyNutrientId:2048,fiberNutrientId:2033,carbohydrateNutrientId:1005,fiberMethod:'AOAC_2011_25',carbs:'SAME_SOURCE_TOTAL_MINUS_FIBER',precision:8,runtimePolicyReplaced:false};
const hash=(s:string)=>createHash('sha256').update(s).digest('hex');
function invalid():never{throw Error('INVALID_BREAKFAST_MAIN_CAPACITY');}
function obj(v:unknown):Obj{if(!v||typeof v!=='object'||Array.isArray(v))invalid();return v as Obj;}
function list(v:unknown):unknown[]{if(!Array.isArray(v)||v.length>2000)invalid();return v;}
function parse(raw:string){if(typeof raw!=='string'||Buffer.byteLength(raw)>15_000_000)invalid();assertRawJsonWithoutDuplicateKeysV1(raw);return obj(JSON.parse(raw));}
function canon(v:unknown):string{if(v===null||typeof v==='string'||typeof v==='boolean'||typeof v==='number')return JSON.stringify(v);if(Array.isArray(v))return '['+v.map(canon).join(',')+']';const o=obj(v);return '{'+Object.keys(o).sort().map(k=>JSON.stringify(k)+':'+canon(o[k])).join(',')+'}';}
function minor(v:unknown){if(typeof v!=='number'||!Number.isFinite(v)||v<0||v>100000||!/^\d+(?:\.\d{1,8})?$/.test(String(v)))invalid();const [n,f='']=String(v).split('.');return BigInt(n)*100000000n+BigInt(f.padEnd(8,'0'));}
const fixed=(n:bigint)=>String(n/100000000n)+'.'+String(n%100000000n).padStart(8,'0');
export interface BreakfastMainEvidenceV1{bindingsRaw:string;materials:Record<string,string>}
export function readBreakfastMainEvidenceV1():BreakfastMainEvidenceV1{
 const read=(p:string)=>readFileSync(new URL('../../'+p,import.meta.url),'utf8');return {bindingsRaw:read(base+'review-bindings-v1.json'),materials:Object.fromEntries(paths.map(p=>[p,read(p)]))};
}
export function validateBreakfastMainBindingsV1(candidateRaw:string,e:BreakfastMainEvidenceV1){
 const p=parse(e.bindingsRaw),catalog=obj(parse(candidateRaw).originalAuthoringCatalog),recipes=list(catalog.recipes).map(obj);
 if(p.contract!=='potok-breakfast-main-capacity-review-v1'||p.scope!=='THREE_PINNED_MAINS_AND_TWO_UNSELECTED_BREAKFAST_PROPOSALS'||p.candidateBytesSha256!==hash(candidateRaw)
 ||[p.sourceApproved,p.runtimePublishable,p.canApply,p.mayActivate].some(v=>v!==false)||canon(p.unansweredOwnerChoices)!==canon(noReplies)||canon(p.oatProposalPolicy)!==canon(oatPolicy))invalid();
 const materials=list(p.materials).map(obj);if(materials.length!==paths.length||new Set(materials.map(m=>m.path)).size!==paths.length)invalid();
 for(const m of materials)if(typeof m.path!=='string'||!paths.includes(m.path)||hash(e.materials[m.path])!==m.sha256)invalid();
 const rows=list(p.rows).map(obj);if(rows.length!==5||new Set(rows.map(r=>r.recipeId)).size!==5)invalid();
 for(const row of rows){const r=recipes.find(r=>r.recipeId===row.recipeId);if(!r||![...mains,...breakfasts].includes(String(row.recipeId))||row.recipeSha256!==hash(canon(r)))invalid();}
 return {catalog,recipes:recipes.filter(r=>[...mains,...breakfasts].includes(String(r.recipeId)))};
}
/** Source-specific input vectors. Old policies and owner choices are never widened. */
export function mapBreakfastMainSourcesV1(e:BreakfastMainEvidenceV1){
 function read(id:number,ndb:string|null,description:string,energyId=1008,fiberId=1079):Vector{
  const c=parse(e.materials[id===2346396?oatPath:base+`fdc-${id}-selected-fields-v1.json`]);
  if(c.fdcId!==id||(ndb===null?c.ndb!==undefined:String(c.ndb)!==ndb)||c.description!==description||c.dataType!==(id===2346396?'Foundation':'SR Legacy')
   ||c.captureContract!=='potok-fdc-primary-selected-fields-v1'||c.captureKind!=='SELECTED_NUMERIC_FIELDS_AND_DEFINITIONS_NOT_FULL_RESPONSE'
   ||c.sourceUrl!==`https://api.nal.usda.gov/fdc/v1/food/${id}`||c.sourceApproved!==false||c.runtimePublishable!==false||c.mayActivate!==false
   ||typeof c.sourceResponseSha256!=='string'||!/^[a-f0-9]{64}$/.test(c.sourceResponseSha256)||typeof c.sourceResponseBytes!=='number'||!Number.isInteger(c.sourceResponseBytes)||c.sourceResponseBytes<=0)invalid();
  const rows=list(c.foodNutrients).map(obj);if(new Set(rows.map(r=>obj(r.nutrient).id)).size!==rows.length)invalid();
  function field(id:number,number:string,unit:string){const found=rows.filter(n=>obj(n.nutrient).id===id);if(found.length!==1)invalid();const r=found[0],n=obj(r.nutrient);if(n.number!==number||n.unitName!==unit||!Number.isInteger(r.sourceArrayIndex)||Number(r.sourceArrayIndex)<0)invalid();minor(r.amount);return r.amount as number;}
  const calories=field(energyId,energyId===2048?'958':'208','kcal'),protein=field(1003,'203','g'),fat=field(1004,'204','g'),total=field(1005,'205','g'),fiber=field(fiberId,fiberId===2033?'293':'291','g');
  const carbs=minor(total)-minor(fiber);if(carbs<0n)invalid();if(id===2346396)field(2047,'957','kcal');
  return {calories:String(calories),protein:String(protein),fat:String(fat),carbs:fixed(carbs),fiber:String(fiber)};
 }
 const method=parse(e.materials[methodPath]);if(method.contract!=='potok-foundation-method-facts-v1'||method.sourceApproved!==false)invalid();
 return {cauliflower:read(169986,'11135','Cauliflower, raw'),pumpkin:read(168448,'11422','Pumpkin, raw'),trout:read(175154,'15115','Fish, trout, rainbow, wild, raw'),beans:read(169961,'11052','Beans, snap, green, raw'),oatProposalOnly:read(2346396,null,'Oats, whole grain, rolled, old fashioned',2048,2033)};
}
export function modelPinnedMainV1(recipe:Obj,sources:ReturnType<typeof mapBreakfastMainSourcesV1>,existing:Map<string,Vector>){
 const id=String(recipe.recipeId);if(!mains.includes(id))invalid();
 const specs:Record<string,[string,string][]>={
 chicken_breast_cauliflower:[['chicken_breast_skinless','SR28:05062'],['cauliflower','NEW:cauliflower'],['onion','SR28:11282'],['olive_oil','SR28:04053'],['water','SR28:14411'],['salt','SR28:02047']],
 chicken_pumpkin_mushrooms:[['chicken_breast','SR28:05062'],['pumpkin','NEW:pumpkin'],['white_mushrooms','SR28:11260'],['onion','SR28:11282'],['olive_oil','SR28:04053'],['salt','SR28:02047']],
 trout_green_beans:[['rainbow_trout_fillet','NEW:trout'],['green_snap_beans','NEW:beans'],['olive_oil','SR28:04053']]};
 const inputs=list(recipe.ingredients).map(obj),spec=specs[id];if(inputs.length!==spec.length)invalid();
 const rows=inputs.map((raw,i)=>{
  const [name,key]=spec[i],rowId=id+'_ing_'+String(i+1).padStart(2,'0');if(raw.ingredient_row_id!==rowId||raw.ingredient_name_en!==name||raw.optional!==false)invalid();
  const water=name==='water',quantityG=!water&&raw.unit==='G'&&typeof raw.weight_g==='number'&&raw.amount===raw.weight_g&&raw.weight_g>0?String(raw.weight_g):null;
  if(water&&(raw.unit!=='ML'||typeof raw.amount!=='number'||raw.amount<=0))invalid();
  const vector=key.startsWith('NEW:')?sources[key.slice(4) as 'cauliflower'|'pumpkin'|'trout'|'beans']:existing.get(key);if(!vector)invalid();
  const component:BatchComponentV2={rowId,status:water||quantityG!==null?'DECLARED_SOURCE_INPUT_MODEL':'BLOCKED',componentKind:water?'POTABLE_WATER':name==='salt'?'TABLE_SALT':'FOOD',sourceRecord:key.startsWith('NEW:')?'FDC_SR_LEGACY:'+({cauliflower:169986,pumpkin:168448,trout:175154,beans:169961}[key.slice(4) as 'cauliflower'|'pumpkin'|'trout'|'beans'])+':RAW:100G':key,vector,quantityG,quantityDecision:water?'TYPED_WATER_ZERO_NO_GRAM_CONVERSION':'DECLARED_GRAMS',optional:false};
  return {component,originalRowSha256:hash(canon(raw)),finding:'PINNED_DECLARED_SOURCE_STATE_INPUT_ONLY'};
 });
 return {recipeId:id,declaredServings:recipe.declaredServings,rows,calculation:calculatePreciseInputV3(rows.map(r=>r.component),recipe.declaredServings),sourceConditions:id==='trout_green_beans'?['WILD_RAINBOW_TROUT_RAW_ONLY','FRESH_RAW_GREEN_BEANS_NOT_FROZEN']:['RAW_SKINLESS_BONELESS_CHICKEN_BREAST','RAW_EDIBLE_VEGETABLES'],measuredYieldG:null,confirmedServings:null,sourceApproved:false,runtimePublishable:false};
}
/** A reviewable hypothesis only. No reply is never treated as ingredient selection. */
export function prepareBreakfastProposalV1(recipe:Obj,sources:ReturnType<typeof mapBreakfastMainSourcesV1>,existing:Map<string,Vector>){
 const id=String(recipe.recipeId);if(!breakfasts.includes(id))invalid();const inputs=list(recipe.ingredients).map(obj);if(inputs.length!==6)invalid();
 const milkIndex=id==='oatmeal_apple_cinnamon'?1:2,waterIndex=id==='oatmeal_apple_cinnamon'?2:3,fruitIndex=id==='oatmeal_apple_cinnamon'?3:1;
 if(inputs.some((r,i)=>r.ingredient_row_id!==id+'_ing_'+String(i+1).padStart(2,'0'))||inputs[0].ingredient_name_ru!=='Овсяные хлопья'||inputs[4].ingredient_name_ru!=='Корица молотая'||inputs[fruitIndex].ingredient_name_ru!==(id==='oatmeal_apple_cinnamon'?'Яблоко':'Тыква'))invalid();
 const salt=inputs[5];if(salt.ingredient_name_ru!=='Соль'||salt.optional!==true||salt.ingredient_row_id!==id+'_ing_06')invalid();
 if(inputs[milkIndex].unit!=='ML'||inputs[milkIndex].ingredient_name_ru!=='Молоко 2%'||inputs[waterIndex].unit!=='ML'||inputs[waterIndex].ingredient_name_ru!=='Вода')invalid();
 const rows=inputs.slice(0,5).map((raw,i)=>{
  const water=i===waterIndex,sourceRecord=i===0?'FDC_FOUNDATION:2346396:PROPOSAL_ONLY':i===milkIndex?'SR28:01174':water?'SR28:14411':i===4?'SR28:02010':id==='oatmeal_apple_cinnamon'?'SR28:09003':'FDC_SR_LEGACY:168448';
  const vector=i===0?sources.oatProposalOnly:sourceRecord==='FDC_SR_LEGACY:168448'?sources.pumpkin:existing.get(sourceRecord);if(!vector)invalid();
  const quantityG=water?null:i===milkIndex?'300':raw.unit==='G'&&typeof raw.weight_g==='number'&&raw.weight_g===raw.amount&&raw.weight_g>0?String(raw.weight_g):null;
  return {rowId:String(raw.ingredient_row_id),status:water||quantityG!==null?'DECLARED_SOURCE_INPUT_MODEL' as const:'BLOCKED' as const,componentKind:water?'POTABLE_WATER' as const:'FOOD' as const,sourceRecord,vector,quantityG,quantityDecision:water?'TYPED_WATER_ZERO_NO_GRAM_CONVERSION':i===milkIndex?'UNSELECTED_NEW_GRAM_AMOUNT_NOT_VOLUME_CONVERSION':'DECLARED_GRAMS',optional:false};
 });
 return {recipeId:id,selectionStatus:'UNSELECTED_NO_OWNER_REPLY',excludedFromSearch:true,assumptions:{newMilkGrams:300,notVolumeToMassConversion:true,noAddedSalt:true,appleWithPeel:id==='oatmeal_apple_cinnamon'?true:null},omittedOptionalSaltRowId:salt.ingredient_row_id,calculation:calculatePreciseInputV3(rows,recipe.declaredServings),sourceApproved:false,runtimePublishable:false,canApply:false,measuredMass:false,originalDataModified:false};
}
export function runBreakfastMainCapacityV1(candidateRaw:string,scenarioRaw:string,e=readBreakfastMainEvidenceV1()){
 const {catalog,recipes:raw}=validateBreakfastMainBindingsV1(candidateRaw,e),sources=mapBreakfastMainSourcesV1(e),prior=runSourceGapsExpansionV1(candidateRaw,scenarioRaw),existing=validatePilotBatchSourcesV1(readPilotBatchEvidenceV1()).sources;
 const additional=raw.filter(r=>mains.includes(String(r.recipeId))).map(r=>modelPinnedMainV1(r,sources,existing)),proposals=raw.filter(r=>breakfasts.includes(String(r.recipeId))).map(r=>prepareBreakfastProposalV1(r,sources,existing));
 const recipes=[...prior.recipes,...additional],complete=recipes.filter(r=>r.calculation.perDeclaredServing!==null),search=authoringSearchInput(decodeAuthoringRecipeCatalog(catalog));
 const pool={...search,recipes:search.recipes.filter(r=>complete.some(c=>c.recipeId===r.recipeId)).map(r=>({...r,recipeId:'breakfast_main__'+r.recipeId,numericReferenceTestInputAvailable:true,referenceNutrition:{values:Object.fromEntries(Object.entries(complete.find(c=>c.recipeId===r.recipeId)!.calculation.perDeclaredServing!).map(([k,v])=>[k,Number(v)]))}}))};
 const scenario=parse(scenarioRaw) as unknown as AuthoringWeekScenarioV1,components=recipes.flatMap<BatchComponentV2>(r=>r.rows.map(row=>row.component));
 return {contract:'potok-breakfast-main-capacity-result-v1',usage:'OFFLINE_CONDITIONAL_INPUTS_WITH_UNSELECTED_BREAKFAST_PROPOSALS',summary:{recipes:recipes.length,completeConditionalInputRecipes:complete.length,sourceModelRows:components.filter(r=>r.status==='DECLARED_SOURCE_INPUT_MODEL').length,blockedRows:components.filter(r=>r.status==='BLOCKED').length,unselectedBreakfastProposals:proposals.length,sourceApprovals:0,admittedRecipes:0,appliedChanges:0},recipes,unselectedBreakfastProposals:proposals,unansweredOwnerChoices:noReplies,
 actualInputModelWeek:{result:previewRecipeAuthoringWeekV1(pool,scenario),categoryCapacity:diagnoseAuthoringCategoryCapacityV1(pool,scenario),unselectedProposalsIncluded:false,oldReferenceFallback:false},sourceApproved:false,runtimePublishable:false,canApply:false,mayActivate:false,originalDataModified:false,cookedNutritionClaimed:false,physicalCookingBlocksDevelopment:false};
}
if(process.argv[1]&&import.meta.url===pathToFileURL(process.argv[1]).href){if(process.argv.length!==4)throw Error('Usage: ... CANDIDATE_CATALOG.json SCENARIO.json');process.stdout.write(JSON.stringify(runBreakfastMainCapacityV1(readFileSync(process.argv[2],'utf8'),readFileSync(process.argv[3],'utf8')),null,2)+'\n');}
