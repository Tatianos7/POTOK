import {createHash} from 'node:crypto';
import {readFileSync} from 'node:fs';
import {pathToFileURL} from 'node:url';
import {assertRawJsonWithoutDuplicateKeysV1} from '../../src/utils/adaptiveNutritionWireV1';
import {decodeAuthoringRecipeCatalog,authoringSearchInput} from '../../src/dev/authoringRecipeCatalog';
import {previewRecipeAuthoringWeekV1,type AuthoringWeekScenarioV1} from '../../src/dev/authoringWeekSearchV1';
import {diagnoseAuthoringCategoryCapacityV1} from './greek-snack-input-model-v1';
import {runFoundationVariantsReviewV1,calculatePreciseInputV3} from './foundation-variants-review-v1';

type Obj=Record<string,unknown>;
const base='docs/premium/retained-sources/owner-grain-tuna-20261105/';
const pastaPath='docs/premium/retained-sources/foundation-variants-20261105/fdc-168927-selected-fields-v1.json';
const axes=['calories','protein','fat','carbs','fiber'] as const;
const expectedDecisions={porridgeSalt:'NO_ADDED_SALT_TWO_PINNED_PORRIDGES',ricePastaEnrichment:'UNENRICHED_TWO_PINNED_INPUTS',tunaSalt:'WITH_SALT_WATER_OR_OWN_JUICE_DRAINED_NO_OIL_OR_SAUCE'};
const pinnedRows=['oatmeal_pear_walnut_ing_07','rice_porridge_berries_ing_06','rice_porridge_berries_ing_01','tuna_tomato_pasta_ing_01','tuna_tomato_pasta_ing_02'];
const hash=(s:string)=>createHash('sha256').update(s).digest('hex');
function invalid():never{throw Error('INVALID_OWNER_GRAIN_TUNA_CHOICES');}
function obj(v:unknown):Obj{if(!v||typeof v!=='object'||Array.isArray(v))invalid();return v as Obj;}
function list(v:unknown):unknown[]{if(!Array.isArray(v)||v.length>2000)invalid();return v;}
function parse(raw:string){if(typeof raw!=='string'||Buffer.byteLength(raw)>15_000_000)invalid();assertRawJsonWithoutDuplicateKeysV1(raw);return obj(JSON.parse(raw));}
function canonical(v:unknown):string{
  if(v===null||typeof v==='string'||typeof v==='boolean'||typeof v==='number')return JSON.stringify(v);
  if(Array.isArray(v))return '['+v.map(canonical).join(',')+']';
  const o=obj(v);return '{'+Object.keys(o).sort().map(k=>JSON.stringify(k)+':'+canonical(o[k])).join(',')+'}';
}
export interface OwnerGrainTunaEvidenceV1{ownerRaw:string;materials:Record<string,string>}
export function readOwnerGrainTunaEvidenceV1():OwnerGrainTunaEvidenceV1{
  const read=(p:string)=>readFileSync(new URL('../../'+p,import.meta.url),'utf8');
  return {ownerRaw:read(base+'owner-choices-v1.json'),materials:Object.fromEntries([base+'fdc-168931-selected-fields-v1.json',base+'fdc-173709-selected-fields-v1.json',pastaPath].map(p=>[p,read(p)]))};
}
/** Exact source models only: missing fiber is never zero or borrowed from rice's enriched sibling. */
export function inspectOwnerGrainTunaSourcesV1(e:OwnerGrainTunaEvidenceV1){
  function source(path:string,id:number,ndb:string,description:string){
    const r=parse(e.materials[path]);
    if(r.captureContract!=='potok-fdc-primary-selected-fields-v1'||r.captureKind!=='SELECTED_NUMERIC_FIELDS_AND_DEFINITIONS_NOT_FULL_RESPONSE'
      ||r.fdcId!==id||r.ndb!==ndb||r.description!==description||r.dataType!=='SR Legacy'
      ||r.sourceUrl!==`https://api.nal.usda.gov/fdc/v1/food/${id}`||r.sourceApproved!==false||r.runtimePublishable!==false||r.mayActivate!==false
      ||typeof r.sourceResponseSha256!=='string'||!/^[a-f0-9]{64}$/.test(r.sourceResponseSha256)||typeof r.sourceResponseBytes!=='number'||r.sourceResponseBytes<=0)invalid();
    const rows=list(r.foodNutrients).map(obj),numbers=rows.map(n=>obj(n.nutrient).number);
    if(new Set(numbers).size!==numbers.length)invalid();
    const read=(number:string,id:number,unit:string)=>{
      const found=rows.filter(n=>obj(n.nutrient).number===number);if(!found.length)return null;
      const f=found[0],n=obj(f.nutrient);
      if(n.id!==id||n.unitName!==unit||typeof f.amount!=='number'||!Number.isFinite(f.amount)||f.amount<0||f.amount>100000||!/^\d+(?:\.\d{1,3})?$/.test(String(f.amount))||!Number.isInteger(f.sourceArrayIndex)||Number(f.sourceArrayIndex)<0)invalid();
      return f.amount;
    };
    const calories=read('208',1008,'kcal'),protein=read('203',1003,'g'),fat=read('204',1004,'g'),total=read('205',1005,'g'),fiber=read('291',1079,'g');
    const sodium=id===168927?null:read('307',1093,'mg');
    if([calories,protein,fat,total].some(v=>v===null))invalid();
    if(id!==168927){const missing=list(r.missingNutrientNumbers);if(canonical(missing)!==canonical(fiber===null?['291']:[]))invalid();}
    const vector=fiber===null?null:{calories:String(calories),protein:String(protein),fat:String(fat),carbs:'',fiber:String(fiber)};
    // Decimal subtraction uses the same-source values, without binary rounding or integer truncation.
    if(vector){const minor=(n:number)=>{const [a,b='']=String(n).split('.');return BigInt(a)*1000n+BigInt(b.padEnd(3,'0'));};
      const c=minor(total!)-minor(fiber!);if(c<0n)invalid();vector.carbs=String(c/1000n)+'.'+String(c%1000n).padStart(3,'0');}
    return {fdcId:id,description,vector,sodiumMgPer100G:sodium,sourceResponseSha256:r.sourceResponseSha256,sourceApproved:false};
  }
  return {pasta:source(pastaPath,168927,'20420','Pasta, dry, unenriched'),rice:source(base+'fdc-168931-selected-fields-v1.json',168931,'20452','Rice, white, short-grain, raw, unenriched'),
    tuna:source(base+'fdc-173709-selected-fields-v1.json',173709,'15121',"Fish, tuna, light, canned in water, drained solids (Includes foods for USDA's Food Distribution Program)")};
}

/** A separately selected input view. No edits to original recipe or implied approval of source data. */
export function selectOwnedRecipeChoiceViewV1(recipe:Obj,priorView:Obj|undefined){
  const id=String(recipe.recipeId);if(!['oatmeal_pear_walnut','rice_porridge_berries','tuna_tomato_pasta'].includes(id))invalid();
  const ingredients=list(recipe.ingredients).map(obj),steps=list(priorView?.plannedSteps??recipe.steps).map(obj).map(s=>({...s}));
  const planned=list(priorView?.plannedIngredients??ingredients.map(i=>({ingredientRowId:i.ingredient_row_id,name:i.ingredient_name_ru,amount:i.amount,unit:i.unit,declaredGrams:i.weight_g}))).map(obj).map(i=>({...i}));
  const omitted=id==='oatmeal_pear_walnut'?'oatmeal_pear_walnut_ing_07':id==='rice_porridge_berries'?'rice_porridge_berries_ing_06':null;
  if(omitted){const salt=ingredients.find(i=>i.ingredient_row_id===omitted);if(!salt||salt.ingredient_name_ru!=='Соль'||salt.optional!==true)invalid();
    if(id==='rice_porridge_berries'){
      const s=steps.find(s=>s.step_id==='rice_porridge_berries_step_03');if(!s||s.instruction_ru!=='Снять кашу с огня и при необходимости добавить соль.')invalid();
      s.instruction_ru='Снять кашу с огня.';
    }
    if(steps.some(s=>typeof s.instruction_ru!=='string'||/соль|соли|солить/i.test(s.instruction_ru)))invalid();
  }
  for(const i of planned){
    if(i.ingredientRowId==='rice_porridge_berries_ing_01')i.name='Рис белый круглозёрный, необогащённый, сухой';
    if(i.ingredientRowId==='tuna_tomato_pasta_ing_01')i.name='Паста пшеничная сухая, необогащённая';
    if(i.ingredientRowId==='tuna_tomato_pasta_ing_02')i.name='Тунец светлый с солью, в воде или собственном соку, без масла и соуса, после слива жидкости';
  }
  if(id==='tuna_tomato_pasta'){
    const s=steps.find(s=>s.step_id==='tuna_tomato_pasta_step_02');if(!s||typeof s.instruction_ru!=='string')invalid();
    s.instruction_ru='Использовать светлый тунец с солью в воде или собственном соку, без масла и соуса. Полностью слить жидкость и взвесить ровно 240 г рыбы.';
  }
  return {recipeId:id,selectionStatus:'OWNER_SELECTED_INGREDIENT_VARIANT_ONLY',omittedIngredientRowIds:omitted?[omitted]:[],plannedIngredients:planned.filter(i=>i.ingredientRowId!==omitted),plannedSteps:steps,
    sourceApproved:false,runtimePublishable:false,canApply:false,originalDataModified:false,measuredMass:false};
}

export function validateOwnerGrainTunaChoicesV1(candidateRaw:string,e:OwnerGrainTunaEvidenceV1){
  const p=parse(e.ownerRaw),original=obj(parse(candidateRaw).originalAuthoringCatalog),rawRecipes=list(original.recipes).map(obj);
  if(p.contract!=='potok-owner-grain-tuna-choices-v1'||p.origin!=='OWNER_MULTIPLE_CHOICE_REPLY'||p.date!=='2026-11-05'
    ||p.candidateBytesSha256!==hash(candidateRaw)||canonical(p.decisions)!==canonical(expectedDecisions)
    ||[p.sourceApproved,p.runtimePublishable,p.canApply,p.mayActivate].some(v=>v!==false))invalid();
  const bindings=list(p.rows).map(obj);if(bindings.length!==5||new Set(bindings.map(r=>r.ingredientRowId)).size!==5)invalid();
  for(const b of bindings){const r=rawRecipes.find(r=>r.recipeId===b.recipeId),input=r&&list(r.ingredients).map(obj).find(i=>i.ingredient_row_id===b.ingredientRowId);
    if(!r||!input||!pinnedRows.includes(String(b.ingredientRowId))||b.sourceAuthoringRowSha256!==hash(canonical(input))||b.recipeContextSha256!==hash(canonical({sourceRecipe:r.sourceRecipe,steps:r.steps})))invalid();}
  const paths=[base+'fdc-168931-selected-fields-v1.json',base+'fdc-173709-selected-fields-v1.json',pastaPath],materials=list(p.materials).map(obj);
  if(materials.length!==3||new Set(materials.map(m=>m.path)).size!==3)invalid();
  for(const m of materials)if(typeof m.path!=='string'||!paths.includes(m.path)||hash(e.materials[m.path])!==m.sha256)invalid();
  return {policy:p,original,rawRecipes};
}
export function runOwnerGrainTunaChoicesV1(candidateRaw:string,scenarioRaw:string,e=readOwnerGrainTunaEvidenceV1()){
  const {policy:p,original,rawRecipes}=validateOwnerGrainTunaChoicesV1(candidateRaw,e);
  const sources=inspectOwnerGrainTunaSourcesV1(e),prior=runFoundationVariantsReviewV1(candidateRaw,scenarioRaw);
  const ownedVariants=rawRecipes.filter(r=>['oatmeal_pear_walnut','rice_porridge_berries','tuna_tomato_pasta'].includes(String(r.recipeId)))
    .map(r=>selectOwnedRecipeChoiceViewV1(r,prior.ownedVariants.find(v=>v.recipeId===r.recipeId)));
  const recipes=prior.recipes.map(r=>{
    const selected=ownedVariants.find(v=>v.recipeId===r.recipeId),omitted=selected?.omittedIngredientRowIds??[];
    const rows=r.rows.filter(row=>!omitted.includes(row.component.rowId)).map(row=>{
      if(row.component.rowId==='tuna_tomato_pasta_ing_01'){
        if(!sources.pasta.vector)invalid();return {...row,reviewStatus:'DECLARED_SOURCE_INPUT_MODEL',finding:'OWNER_UNENRICHED_PASTA_EXACT_SOURCE_INPUT_ONLY',component:{...row.component,status:'DECLARED_SOURCE_INPUT_MODEL' as const,vector:sources.pasta.vector,sourceRecord:'FDC_SR_LEGACY:168927:PER_100_G_EDIBLE'}};
      }
      if(row.component.rowId==='rice_porridge_berries_ing_01')return {...row,reviewStatus:'BLOCKED',finding:'UNENRICHED_RICE_SOURCE_MISSING_FIBER_NO_ENRICHED_BORROW',component:{...row.component,status:'BLOCKED' as const,vector:null,sourceRecord:null}};
      if(row.component.rowId==='tuna_tomato_pasta_ing_02')return {...row,reviewStatus:'BLOCKED',finding:'SOURCE_LEAD_NOT_EXPLICIT_SALTED_PRODUCT_CLASS_NO_SALT_FREE_FALLBACK',component:{...row.component,status:'BLOCKED' as const,vector:null,sourceRecord:null}};
      return {...row,component:{...row.component}};
    });
    return {...r,rows,omittedIngredientRowIds:omitted,calculation:calculatePreciseInputV3(rows.map(row=>row.component),r.declaredServings)};
  });
  const complete=recipes.filter(r=>r.calculation.perDeclaredServing!==null),search=authoringSearchInput(decodeAuthoringRecipeCatalog(original));
  const pool={...search,recipes:search.recipes.filter(r=>complete.some(c=>c.recipeId===r.recipeId)).map(r=>({...r,recipeId:'owner_choice_input__'+r.recipeId,numericReferenceTestInputAvailable:true,
    referenceNutrition:{values:Object.fromEntries(axes.map(a=>[a,Number(complete.find(c=>c.recipeId===r.recipeId)!.calculation.perDeclaredServing![a])]))}}))};
  const scenario=parse(scenarioRaw) as unknown as AuthoringWeekScenarioV1;
  return {contract:'potok-owner-grain-tuna-choice-result-v1',usage:'OFFLINE_OWNER_SELECTED_INGREDIENT_INPUT_VARIANTS_ONLY',ownerDecisions:p.decisions,ownedVariants,recipes,sourceLeads:sources,
    summary:{recipes:recipes.length,selectedRecipeVariants:ownedVariants.length,omittedSaltRows:2,sourceModelRows:recipes.flatMap(r=>r.rows).filter(r=>r.reviewStatus==='DECLARED_SOURCE_INPUT_MODEL').length,
      blockedRows:recipes.flatMap(r=>r.rows).filter(r=>r.reviewStatus==='BLOCKED').length,completeConditionalInputRecipes:complete.length,sourceApprovals:0,admittedRecipes:0,appliedChanges:0},
    actualInputModelWeek:{result:previewRecipeAuthoringWeekV1(pool,scenario),categoryCapacity:diagnoseAuthoringCategoryCapacityV1(pool,scenario),oldReferenceFallback:false,unselectedProposalsIncluded:false},
    priorModelsUnmodified:true,sourceApproved:false,runtimePublishable:false,canApply:false,mayActivate:false,cookedNutritionClaimed:false,originalDataModified:false};
}
if(process.argv[1]&&import.meta.url===pathToFileURL(process.argv[1]).href){
  if(process.argv.length!==4)throw Error('Usage: ... CANDIDATE_CATALOG.json SCENARIO.json');
  process.stdout.write(JSON.stringify(runOwnerGrainTunaChoicesV1(readFileSync(process.argv[2],'utf8'),readFileSync(process.argv[3],'utf8')),null,2)+'\n');
}
