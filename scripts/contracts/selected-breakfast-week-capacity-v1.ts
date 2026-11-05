import {createHash} from 'node:crypto';import {readFileSync} from 'node:fs';import {pathToFileURL} from 'node:url';
import {assertRawJsonWithoutDuplicateKeysV1} from '../../src/utils/adaptiveNutritionWireV1';
import {decodeAuthoringRecipeCatalog,authoringSearchInput} from '../../src/dev/authoringRecipeCatalog';
import {previewRecipeAuthoringWeekV1,type AuthoringWeekScenarioV1} from '../../src/dev/authoringWeekSearchV1';
import {readBreakfastMainEvidenceV1,mapBreakfastMainSourcesV1,runBreakfastMainCapacityV1} from './breakfast-main-capacity-v1';
import {readPilotBatchEvidenceV1,validatePilotBatchSourcesV1,type BatchComponentV2} from './pilot-source-quantity-batch-v1';
import {calculatePreciseInputV3} from './foundation-variants-review-v1';
import {diagnoseAuthoringCategoryCapacityV1} from './greek-snack-input-model-v1';
import {analyzeWeekInputCalorieCapacityV1} from './week-input-calorie-capacity-v1';
type Obj=Record<string,unknown>;type Vector=NonNullable<BatchComponentV2['vector']>;
const ids=['oatmeal_apple_cinnamon','oatmeal_pumpkin'],base='docs/premium/retained-sources/selected-breakfast-20261105/';
const paths=['docs/premium/retained-sources/breakfast-main-capacity-20261105/review-bindings-v1.json','docs/premium/retained-sources/breakfast-main-capacity-20261105/fdc-168448-selected-fields-v1.json','docs/premium/retained-sources/pilot-19-source-quantity-20261105/fdc-2346396-selected-fields-v1.json'];
const decisions={newMilkGramsEachRecipe:300,milkFatPercent:2,noAddedSaltBoth:true,appleWithPeelNoCoreOrStem:true,notVolumeToMassConversion:true};
const hash=(s:string)=>createHash('sha256').update(s).digest('hex');
function invalid():never{throw Error('INVALID_SELECTED_BREAKFAST_WEEK_CAPACITY');}
function obj(v:unknown):Obj{if(!v||typeof v!=='object'||Array.isArray(v))invalid();return v as Obj;}
function list(v:unknown):unknown[]{if(!Array.isArray(v)||v.length>2000)invalid();return v;}
function parse(raw:string){if(typeof raw!=='string'||Buffer.byteLength(raw)>15_000_000)invalid();assertRawJsonWithoutDuplicateKeysV1(raw);return obj(JSON.parse(raw));}
function canon(v:unknown):string{if(v===null||typeof v==='string'||typeof v==='boolean'||typeof v==='number')return JSON.stringify(v);if(Array.isArray(v))return '['+v.map(canon).join(',')+']';const o=obj(v);return '{'+Object.keys(o).sort().map(k=>JSON.stringify(k)+':'+canon(o[k])).join(',')+'}';}
export interface SelectedBreakfastEvidenceV1{ownerRaw:string;materials:Record<string,string>}
export function readSelectedBreakfastEvidenceV1():SelectedBreakfastEvidenceV1{const read=(p:string)=>readFileSync(new URL('../../'+p,import.meta.url),'utf8');return {ownerRaw:read(base+'owner-decision-v1.json'),materials:Object.fromEntries(paths.map(p=>[p,read(p)]))};}
export function validateSelectedBreakfastEvidenceV1(raw:string,e:SelectedBreakfastEvidenceV1){
 const p=parse(e.ownerRaw),catalog=obj(parse(raw).originalAuthoringCatalog),recipes=list(catalog.recipes).map(obj);
 if(p.contract!=='potok-selected-breakfast-owner-decision-v1'||p.origin!=='OWNER_REPLY_DO_AFTER_EXPLICIT_TWO_BREAKFAST_PROPOSAL'||p.date!=='2026-11-05'||p.scope!=='TWO_PINNED_BREAKFAST_VARIANTS_ONLY'
 ||p.candidateBytesSha256!==hash(raw)||canon(p.decisions)!==canon(decisions)||[p.sourceApproved,p.runtimePublishable,p.canApply,p.mayActivate].some(v=>v!==false)
 ||canon(p.unansweredOwnerChoices)!==canon({bananaYogurtType:'NO_REPLY_RECEIVED',cocoaType:'NO_REPLY_RECEIVED'}))invalid();
 const bindings=list(p.rows).map(obj);if(bindings.length!==2||new Set(bindings.map(b=>b.recipeId)).size!==2)invalid();
 for(const b of bindings){const r=recipes.find(r=>r.recipeId===b.recipeId);if(!r||!ids.includes(String(b.recipeId))||b.recipeSha256!==hash(canon(r)))invalid();}
 const materials=list(p.materials).map(obj);if(materials.length!==3||new Set(materials.map(m=>m.path)).size!==3)invalid();
 for(const m of materials)if(typeof m.path!=='string'||!paths.includes(m.path)||hash(e.materials[m.path])!==m.sha256)invalid();
 return {policy:p,catalog,recipes:recipes.filter(r=>ids.includes(String(r.recipeId)))};
}
/** Owner-selected ingredient views only. Originals, earlier hypotheses and source authority stay untouched. */
export function selectBreakfastVariantV1(recipe:Obj,sources:ReturnType<typeof mapBreakfastMainSourcesV1>,existing:Map<string,Vector>){
 const id=String(recipe.recipeId);if(!ids.includes(id))invalid();const inputs=list(recipe.ingredients).map(obj),steps=list(recipe.steps).map(obj).map(s=>({...s}));
 const milk=id==='oatmeal_apple_cinnamon'?1:2,water=id==='oatmeal_apple_cinnamon'?2:3,fruit=id==='oatmeal_apple_cinnamon'?3:1;
 if(inputs.length!==6||inputs.slice(0,5).some(r=>r.optional!==false)||typeof inputs[water].amount!=='number'||Number(inputs[water].amount)<=0||(id==='oatmeal_apple_cinnamon'&&(inputs[fruit].amount!==180||inputs[fruit].weight_g!==180))||inputs.some((r,i)=>r.ingredient_row_id!==id+'_ing_'+String(i+1).padStart(2,'0'))||inputs[0].ingredient_name_ru!=='Овсяные хлопья'||inputs[4].ingredient_name_ru!=='Корица молотая'
 ||inputs[milk].ingredient_name_ru!=='Молоко 2%'||inputs[milk].unit!=='ML'||inputs[water].ingredient_name_ru!=='Вода'||inputs[water].unit!=='ML'||inputs[fruit].ingredient_name_ru!==(id==='oatmeal_apple_cinnamon'?'Яблоко':'Тыква')||inputs[5].ingredient_name_ru!=='Соль'||inputs[5].optional!==true)invalid();
 const last=steps.find(s=>s.step_id===id+'_step_04');if(!last)invalid();
 const expected=id==='oatmeal_apple_cinnamon'?'Снять с огня, при необходимости посолить и разделить на 2 порции.':'Добавить корицу, при необходимости соль и разделить на 2 порции.';
 if(last.instruction_ru!==expected)invalid();last.instruction_ru=id==='oatmeal_apple_cinnamon'?'Снять с огня и разделить на 2 порции.':'Добавить корицу и разделить на 2 порции.';
 const first=steps[0];if(!first||typeof first.instruction_ru!=='string')invalid();first.instruction_ru=(id==='oatmeal_apple_cinnamon'?'Отмерить 300 г молока 2%. Яблоко оставить с кожурой, удалить сердцевину и плодоножку, затем взвесить 180 г съедобной части. ':'Отмерить 300 г молока 2%. ')+first.instruction_ru;
 if(steps.some(s=>typeof s.instruction_ru!=='string'||/соль|соли|солить|\d+\s*мл\s+молок/i.test(s.instruction_ru)))invalid();
 const rows=inputs.slice(0,5).map((r,i)=>{
  const isWater=i===water,key=i===0?'FDC_FOUNDATION:2346396:2048:2033:100G':i===milk?'SR28:01174':isWater?'SR28:14411':i===4?'SR28:02010':id==='oatmeal_apple_cinnamon'?'SR28:09003':'FDC_SR_LEGACY:168448:RAW:100G';
  const vector=i===0?sources.oatProposalOnly:key.startsWith('FDC_SR_LEGACY')?sources.pumpkin:existing.get(key);if(!vector)invalid();
  const quantityG=isWater?null:i===milk?'300':r.unit==='G'&&typeof r.weight_g==='number'&&r.amount===r.weight_g&&r.weight_g>0?String(r.weight_g):null;
  const component:BatchComponentV2={rowId:String(r.ingredient_row_id),status:isWater||quantityG!==null?'DECLARED_SOURCE_INPUT_MODEL':'BLOCKED',componentKind:isWater?'POTABLE_WATER':'FOOD',sourceRecord:key,vector,quantityG,quantityDecision:isWater?'TYPED_WATER_ZERO_NO_GRAM_CONVERSION':i===milk?'OWNER_NEW_GRAM_INPUT_NOT_VOLUME_CONVERSION':'DECLARED_GRAMS',optional:false};
  return {component,originalRowSha256:hash(canon(r)),finding:'OWNER_SELECTED_BREAKFAST_CONDITIONAL_INPUT_MODEL'};
 });
 const plannedIngredients=inputs.slice(0,5).map((r,i)=>({ingredientRowId:r.ingredient_row_id,name:i===fruit&&id==='oatmeal_apple_cinnamon'?'Яблоко свежее с кожурой, без сердцевины и плодоножки':r.ingredient_name_ru,amount:i===milk?300:r.amount,unit:i===milk?'G':r.unit,declaredGrams:i===milk?300:r.weight_g}));
 return {recipeId:id,declaredServings:recipe.declaredServings,selectionStatus:'OWNER_SELECTED_TWO_BREAKFAST_VARIANT',rows,plannedIngredients,plannedSteps:steps,omittedOptionalSaltRowId:inputs[5].ingredient_row_id,calculation:calculatePreciseInputV3(rows.map(r=>r.component),recipe.declaredServings),originalDataModified:false,appliedToOriginal:false,measuredMass:false,measuredYieldG:null,confirmedServings:null,sourceApproved:false,runtimePublishable:false,canApply:false};
}
export function runSelectedBreakfastWeekCapacityV1(raw:string,scenarioRaw:string,e=readSelectedBreakfastEvidenceV1()){
 const {catalog,recipes:originals}=validateSelectedBreakfastEvidenceV1(raw,e),prior=runBreakfastMainCapacityV1(raw,scenarioRaw),sources=mapBreakfastMainSourcesV1(readBreakfastMainEvidenceV1()),existing=validatePilotBatchSourcesV1(readPilotBatchEvidenceV1()).sources;
 const selected=originals.map(r=>selectBreakfastVariantV1(r,sources,existing)),recipes=prior.recipes.map(r=>selected.find(s=>s.recipeId===r.recipeId)??r),complete=recipes.filter(r=>r.calculation.perDeclaredServing!==null);
 const search=authoringSearchInput(decodeAuthoringRecipeCatalog(catalog)),pool={...search,recipes:search.recipes.filter(r=>complete.some(c=>c.recipeId===r.recipeId)).map(r=>({...r,recipeId:'selected_breakfast__'+r.recipeId,numericReferenceTestInputAvailable:true,referenceNutrition:{values:Object.fromEntries(Object.entries(complete.find(c=>c.recipeId===r.recipeId)!.calculation.perDeclaredServing!).map(([k,v])=>[k,Number(v)]))}}))};
 const scenario=parse(scenarioRaw) as unknown as AuthoringWeekScenarioV1,result=previewRecipeAuthoringWeekV1(pool,scenario);
 const calorieCapacity=analyzeWeekInputCalorieCapacityV1(complete.map(r=>({recipeId:r.recipeId,sourceCategory:String(search.recipes.find(x=>x.recipeId===r.recipeId)!.sourceRecipe.meal_type_primary),caloriesPerDeclaredServing:r.calculation.perDeclaredServing!.calories})),scenario);
 const components=recipes.flatMap<BatchComponentV2>(r=>r.rows.map(row=>row.component));
 return {contract:'potok-selected-breakfast-week-capacity-result-v1',usage:'OFFLINE_SELECTED_INPUT_VARIANTS_WITH_NECESSARY_WEEK_BOUNDS',summary:{recipes:recipes.length,completeConditionalInputRecipes:complete.length,sourceModelRows:components.filter(c=>c.status==='DECLARED_SOURCE_INPUT_MODEL').length,blockedRows:components.filter(c=>c.status==='BLOCKED').length,selectedBreakfastVariants:selected.length,sourceApprovals:0,admittedRecipes:0,appliedChanges:0},recipes,selectedBreakfastVariants:selected,
 actualInputModelWeek:{result,categoryCapacity:diagnoseAuthoringCategoryCapacityV1(pool,scenario),calorieCapacity,oldReferenceFallback:false,oldUnselectedProposalsIncluded:false},unansweredOwnerChoices:{bananaYogurtType:'NO_REPLY_RECEIVED',cocoaType:'NO_REPLY_RECEIVED'},
 sourceApproved:false,runtimePublishable:false,canApply:false,mayActivate:false,originalDataModified:false,cookedNutritionClaimed:false,physicalCookingBlocksDevelopment:false};
}
if(process.argv[1]&&import.meta.url===pathToFileURL(process.argv[1]).href){if(process.argv.length!==4)throw Error('Usage: ... CANDIDATE_CATALOG.json SCENARIO.json');process.stdout.write(JSON.stringify(runSelectedBreakfastWeekCapacityV1(readFileSync(process.argv[2],'utf8'),readFileSync(process.argv[3],'utf8')),null,2)+'\n');}
