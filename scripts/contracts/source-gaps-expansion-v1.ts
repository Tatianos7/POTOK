import {createHash} from 'node:crypto';
import {readFileSync} from 'node:fs';
import {pathToFileURL} from 'node:url';
import {assertRawJsonWithoutDuplicateKeysV1} from '../../src/utils/adaptiveNutritionWireV1';
import {decodeAuthoringRecipeCatalog,authoringSearchInput} from '../../src/dev/authoringRecipeCatalog';
import {previewRecipeAuthoringWeekV1,type AuthoringWeekScenarioV1} from '../../src/dev/authoringWeekSearchV1';
import {runOwnerGrainTunaChoicesV1,inspectOwnerGrainTunaSourcesV1,readOwnerGrainTunaEvidenceV1} from './owner-grain-tuna-choices-v1';
import {calculatePreciseInputV3} from './foundation-variants-review-v1';
import {readPilotBatchEvidenceV1,validatePilotBatchSourcesV1,type BatchComponentV2} from './pilot-source-quantity-batch-v1';
import {diagnoseAuthoringCategoryCapacityV1} from './greek-snack-input-model-v1';

type Obj=Record<string,unknown>;
type Vector=NonNullable<BatchComponentV2['vector']>;
const base='docs/premium/retained-sources/source-gaps-expansion-20261105/';
const paths=[...[2346393,168411,167747].map(i=>base+`fdc-${i}-selected-fields-v1.json`),base+'tuna-sodium-class-facts-v1.json',
 'docs/premium/retained-sources/owner-grain-tuna-20261105/fdc-168931-selected-fields-v1.json','docs/premium/retained-sources/owner-grain-tuna-20261105/fdc-173709-selected-fields-v1.json',
 'docs/premium/retained-sources/foundation-variants-20261105/method-facts-v1.json'];
const recipeIds=['pear_almonds','lemon_shelled_edamame','oatmeal_apple_cinnamon','oatmeal_pumpkin'];
const hash=(s:string)=>createHash('sha256').update(s).digest('hex');
function invalid():never{throw Error('INVALID_SOURCE_GAPS_EXPANSION');}
function obj(v:unknown):Obj{if(!v||typeof v!=='object'||Array.isArray(v))invalid();return v as Obj;}
function list(v:unknown):unknown[]{if(!Array.isArray(v)||v.length>2000)invalid();return v;}
function parse(raw:string){if(typeof raw!=='string'||Buffer.byteLength(raw)>15_000_000)invalid();assertRawJsonWithoutDuplicateKeysV1(raw);return obj(JSON.parse(raw));}
function canon(v:unknown):string{if(v===null||typeof v==='string'||typeof v==='boolean'||typeof v==='number')return JSON.stringify(v);if(Array.isArray(v))return '['+v.map(canon).join(',')+']';const o=obj(v);return '{'+Object.keys(o).sort().map(k=>JSON.stringify(k)+':'+canon(o[k])).join(',')+'}';}
function minor(v:unknown){if(typeof v!=='number'||!Number.isFinite(v)||v<0||v>100000||!/^\d+(?:\.\d{1,8})?$/.test(String(v)))invalid();const [n,f='']=String(v).split('.');return BigInt(n)*100000000n+BigInt(f.padEnd(8,'0'));}
const fixed=(n:bigint)=>String(n/100000000n)+'.'+String(n%100000000n).padStart(8,'0');
export interface SourceExpansionEvidenceV1{bindingsRaw:string;materials:Record<string,string>}
export function readSourceExpansionEvidenceV1():SourceExpansionEvidenceV1{
 const read=(p:string)=>readFileSync(new URL('../../'+p,import.meta.url),'utf8');return {bindingsRaw:read(base+'expansion-bindings-v1.json'),materials:Object.fromEntries(paths.map(p=>[p,read(p)]))};
}
export function validateSourceExpansionBindingsV1(candidateRaw:string,e:SourceExpansionEvidenceV1){
 const p=parse(e.bindingsRaw),catalog=obj(parse(candidateRaw).originalAuthoringCatalog),recipes=list(catalog.recipes).map(obj);
 if(p.contract!=='potok-source-gaps-expansion-v1'||p.scope!=='FOUR_PINNED_ADDITIONAL_RECIPES_AND_PRIOR_TUNA_ONLY'||p.candidateBytesSha256!==hash(candidateRaw)
 ||[p.sourceApproved,p.runtimePublishable,p.canApply,p.mayActivate].some(v=>v!==false)
 ||canon(p.unansweredOwnerChoices)!==canon({bananaYogurtType:'NO_REPLY_RECEIVED',cocoaType:'NO_REPLY_RECEIVED'}))invalid();
 const materials=list(p.materials).map(obj);if(materials.length!==paths.length||new Set(materials.map(m=>m.path)).size!==paths.length)invalid();
 for(const m of materials)if(typeof m.path!=='string'||!paths.includes(m.path)||hash(e.materials[m.path])!==m.sha256)invalid();
 const bindings=list(p.rows).map(obj);if(bindings.length!==4||new Set(bindings.map(b=>b.recipeId)).size!==4)invalid();
 for(const b of bindings){const r=recipes.find(r=>r.recipeId===b.recipeId);if(!r||!recipeIds.includes(String(b.recipeId))||b.recipeSha256!==hash(canon(r)))invalid();
  const inputs=list(r.ingredients).map(obj),rows=list(b.ingredientRows).map(obj);if(rows.length!==inputs.length||new Set(rows.map(i=>i.ingredientRowId)).size!==inputs.length)invalid();
  for(const row of rows){const raw=inputs.find(i=>i.ingredient_row_id===row.ingredientRowId);if(!raw||row.sha256!==hash(canon(raw)))invalid();}
 }
 return {catalog,recipes:recipes.filter(r=>recipeIds.includes(String(r.recipeId)))};
}
/** Separately versioned exact-source mapping, never a global food equivalence. */
export function mapExpansionPrimarySourcesV1(e:SourceExpansionEvidenceV1){
 function read(id:number,description:string,ndb:string,dataType:string,energy:number):Vector{
  const c=parse(e.materials[base+`fdc-${id}-selected-fields-v1.json`]);
  if(c.fdcId!==id||c.description!==description||c.ndb!==ndb||c.dataType!==dataType||c.captureContract!=='potok-fdc-primary-selected-fields-v1'
   ||c.captureKind!=='SELECTED_NUMERIC_FIELDS_AND_DEFINITIONS_NOT_FULL_RESPONSE'||c.sourceUrl!==`https://api.nal.usda.gov/fdc/v1/food/${id}`
   ||c.sourceApproved!==false||c.runtimePublishable!==false||c.mayActivate!==false||typeof c.sourceResponseSha256!=='string'||!/^[a-f0-9]{64}$/.test(c.sourceResponseSha256)
   ||typeof c.sourceResponseBytes!=='number'||!Number.isInteger(c.sourceResponseBytes)||c.sourceResponseBytes<=0)invalid();
  const rows=list(c.foodNutrients).map(obj);if(new Set(rows.map(n=>obj(n.nutrient).id)).size!==rows.length)invalid();
  function field(id:number,number:string,unit:string){const found=rows.filter(n=>obj(n.nutrient).id===id);if(found.length!==1)invalid();const r=found[0],n=obj(r.nutrient);
   if(n.number!==number||n.unitName!==unit||!Number.isInteger(r.sourceArrayIndex)||Number(r.sourceArrayIndex)<0)invalid();minor(r.amount);return r.amount as number;}
  const calories=field(energy,energy===2048?'958':'208','kcal'),protein=field(1003,'203','g'),fat=field(1004,'204','g'),total=field(1005,'205','g'),fiber=field(1079,'291','g');
  const carbs=minor(total)-minor(fiber);if(carbs<0n)invalid();
  if(energy===2048)field(2047,'957','kcal');
  return {calories:String(calories),protein:String(protein),fat:String(fat),carbs:fixed(carbs),fiber:String(fiber)};
 }
 const almond=read(2346393,'Nuts, almonds, whole, raw','12061','Foundation',2048),edamame=read(168411,'Edamame, frozen, prepared','11212','SR Legacy',1008),lemon=read(167747,'Lemon juice, raw','09152','SR Legacy',1008);
 const facts=parse(e.materials[base+'tuna-sodium-class-facts-v1.json']);
 if(facts.contract!=='potok-usda-salted-tuna-class-facts-v1'||facts.scope!=='PINNED_WATER_PACKED_TUNA_SOURCE_MODEL_ONLY'
 ||facts.ownJuiceEquivalenceEstablished!==false||facts.brandEquivalenceEstablished!==false||facts.sodiumIntakeSafetyAssessed!==false
 ||[facts.sourceApproved,facts.runtimePublishable,facts.canApply,facts.mayActivate].some(v=>v!==false)
 ||typeof facts.sourceResponseSha256!=='string'||!/^[a-f0-9]{64}$/.test(facts.sourceResponseSha256))invalid();
 const f=list(facts.facts).map(obj);if(f.length!==2||f[0].summary!=='USDA describes Sentinel Foods as commercially processed foods containing sodium added before purchase.'
 ||f[1].ndb!=='15121'||f[1].baselineYear!==2011||f[1].baselineSodiumMgPer100G!==247||f[1].resampledYear!==2017||f[1].resampledSodiumMgPer100G!==195)invalid();
 const previous=readOwnerGrainTunaEvidenceV1();
 for(const path of paths.filter(p=>p.includes('owner-grain-tuna-20261105/')))previous.materials[path]=e.materials[path];
 const leads=inspectOwnerGrainTunaSourcesV1(previous);if(!leads.tuna.vector||leads.tuna.sodiumMgPer100G!==f[1].baselineSodiumMgPer100G||leads.rice.vector!==null)invalid();
 const methods=parse(e.materials['docs/premium/retained-sources/foundation-variants-20261105/method-facts-v1.json']);if(methods.contract!=='potok-foundation-method-facts-v1'||methods.sourceApproved!==false)invalid();
 return {almond,edamame,lemon,tuna:leads.tuna.vector,rice:{status:'BLOCKED_MISSING_SAME_SOURCE_FIBER',fiber:null,availableCarbohydrate:null},
  tunaConditions:{ndb:'15121',packingMedium:'WATER_ONLY',saltClassEvidence:'USDA_SENTINEL_ADDED_SODIUM_CLASS',ownJuiceEquivalent:false,brandEquivalent:false,sodiumIntakeSafetyAssessed:false},
  almondConditions:{energyNutrientId:2048,alternateEnergyNutrientId:2047,fiberNutrientId:1079,basis:'PER_100_G_RAW_EDIBLE',sameRecordFiberSubtraction:true}};
}
export function reviewAdditionalRecipeV1(recipe:Obj,sources:ReturnType<typeof mapExpansionPrimarySourcesV1>,existing:Map<string,Vector>){
 const id=String(recipe.recipeId);if(!recipeIds.includes(id))invalid();
 const inputs=list(recipe.ingredients).map(obj),expected=id==='pear_almonds'||id==='lemon_shelled_edamame'?2:6;
 if(inputs.length!==expected||inputs.some((r,i)=>r.ingredient_row_id!==id+'_ing_'+String(i+1).padStart(2,'0')))invalid();
 if(id==='pear_almonds'&&(inputs[0].ingredient_name_en!=='fresh_pear'||inputs[1].ingredient_name_en!=='raw_unsalted_almonds'))invalid();
 if(id==='lemon_shelled_edamame'&&(inputs[0].ingredient_name_en!=='frozen_shelled_edamame_prepared'||inputs[1].ingredient_name_en!=='fresh_lemon_juice'))invalid();
 const rows=inputs.map(raw=>{
  const rowId=String(raw.ingredient_row_id),unit=raw.unit,grams=unit==='G'&&typeof raw.weight_g==='number'&&raw.weight_g===raw.amount&&raw.weight_g>0?String(raw.weight_g):null;
  let vector:Vector|null=null,sourceRecord:string|null=null,componentKind:BatchComponentV2['componentKind']='FOOD',quantityDecision='DECLARED_GRAMS',quantityG=grams,finding='BLOCKED_SOURCE_OR_STATE_NOT_REVIEWED';
  if(id==='pear_almonds'){if(rowId.endsWith('_01')){sourceRecord='SR28:09252';vector=existing.get(sourceRecord)??null;}else {sourceRecord='FDC_FOUNDATION:2346393:2048:1079:RAW:100G';vector=sources.almond;}}
  else if(id==='lemon_shelled_edamame'){sourceRecord=rowId.endsWith('_01')?'FDC_SR_LEGACY:168411:PREPARED:100G':'FDC_SR_LEGACY:167747:RAW_JUICE:100G';vector=rowId.endsWith('_01')?sources.edamame:sources.lemon;}
  else if(raw.ingredient_name_ru==='Вода'&&unit==='ML'&&typeof raw.amount==='number'&&raw.amount>0){componentKind='POTABLE_WATER';sourceRecord='SR28:14411';vector=existing.get(sourceRecord)??null;quantityG=null;quantityDecision='TYPED_WATER_ZERO_NO_GRAM_CONVERSION';}
  else if(raw.ingredient_name_ru==='Корица молотая'){sourceRecord='SR28:02010';vector=existing.get(sourceRecord)??null;}
  else if(raw.ingredient_name_ru==='Соль'){componentKind='TABLE_SALT';finding='UNKNOWN_OPTIONAL_SALT_NOT_OMITTED_OWNER_SCOPE_IS_TWO_OTHER_PORRIDGES';}
  else if(raw.ingredient_name_ru==='Молоко 2%')finding='ML_QUANTITY_UNKNOWN_NO_EXTENSION_OF_OTHER_RECIPE_GRAM_DECISIONS';
  else if(raw.ingredient_name_ru==='Овсяные хлопья')finding='FOUNDATION_OAT_POLICY_BOUND_TO_OTHER_PINNED_RECIPE';
  else if(raw.ingredient_name_ru==='Яблоко')finding='APPLE_PEEL_STATE_NOT_DECLARED';
  const status:BatchComponentV2['status']=vector&&(quantityG!==null||componentKind==='POTABLE_WATER')?'DECLARED_SOURCE_INPUT_MODEL':'BLOCKED';
  if(status==='DECLARED_SOURCE_INPUT_MODEL')finding='EXACT_STATE_CONDITIONAL_INPUT_MODEL_NOT_SOURCE_ADMISSION';
  return {component:{rowId,status,componentKind,sourceRecord,vector,quantityG,quantityDecision,optional:raw.optional===true} satisfies BatchComponentV2,finding,originalRowSha256:hash(canon(raw))};
 });
 return {recipeId:id,declaredServings:recipe.declaredServings,rows,calculation:calculatePreciseInputV3(rows.map(r=>r.component),recipe.declaredServings),measuredYieldG:null,confirmedServings:null,sourceApproved:false,runtimePublishable:false};
}
export function runSourceGapsExpansionV1(candidateRaw:string,scenarioRaw:string,e=readSourceExpansionEvidenceV1()){
 const {catalog,recipes:raw}=validateSourceExpansionBindingsV1(candidateRaw,e),sources=mapExpansionPrimarySourcesV1(e),prior=runOwnerGrainTunaChoicesV1(candidateRaw,scenarioRaw);
 const existing=validatePilotBatchSourcesV1(readPilotBatchEvidenceV1()).sources;
 const previous=prior.recipes.map(r=>{
  const rows=r.rows.map(row=>row.component.rowId==='tuna_tomato_pasta_ing_02'?{...row,reviewStatus:'DECLARED_SOURCE_INPUT_MODEL',finding:'WATER_PACKED_SALTED_TUNA_SENTINEL_SOURCE_INPUT_MODEL',component:{...row.component,status:'DECLARED_SOURCE_INPUT_MODEL' as const,sourceRecord:'FDC_SR_LEGACY:173709:WATER_DRAINED:100G',vector:sources.tuna}}:row);
  return {...r,rows,calculation:calculatePreciseInputV3(rows.map(row=>row.component),r.declaredServings)};
 });
 const additional=raw.map(r=>reviewAdditionalRecipeV1(r,sources,existing)),models=[...previous,...additional],complete=models.filter(r=>r.calculation.perDeclaredServing!==null);
 const search=authoringSearchInput(decodeAuthoringRecipeCatalog(catalog)),pool={...search,recipes:search.recipes.filter(r=>complete.some(c=>c.recipeId===r.recipeId)).map(r=>({...r,recipeId:'source_expansion__'+r.recipeId,numericReferenceTestInputAvailable:true,
  referenceNutrition:{values:Object.fromEntries(Object.entries(complete.find(c=>c.recipeId===r.recipeId)!.calculation.perDeclaredServing!).map(([k,v])=>[k,Number(v)]))}}))};
 const scenario=parse(scenarioRaw) as unknown as AuthoringWeekScenarioV1,allComponents=models.flatMap<BatchComponentV2>(r=>r.rows.map(row=>row.component));
 return {contract:'potok-source-gaps-expansion-result-v1',usage:'OFFLINE_CONDITIONAL_SOURCE_INPUT_MODELS_ONLY',summary:{recipes:models.length,additionalReviewedRecipes:additional.length,completeConditionalInputRecipes:complete.length,
  sourceModelRows:allComponents.filter(r=>r.status==='DECLARED_SOURCE_INPUT_MODEL').length,blockedRows:allComponents.filter(r=>r.status==='BLOCKED').length,sourceApprovals:0,admittedRecipes:0,appliedChanges:0},
  recipes:models,sourceConditions:{tuna:sources.tunaConditions,almond:sources.almondConditions,rice:sources.rice},
  unansweredOwnerChoices:{bananaYogurtType:'NO_REPLY_RECEIVED',cocoaType:'NO_REPLY_RECEIVED'},
  actualInputModelWeek:{result:previewRecipeAuthoringWeekV1(pool,scenario),categoryCapacity:diagnoseAuthoringCategoryCapacityV1(pool,scenario),oldReferenceFallback:false},
  sourceApproved:false,runtimePublishable:false,canApply:false,mayActivate:false,cookedNutritionClaimed:false,originalDataModified:false,physicalCookingBlocksDevelopment:false};
}
if(process.argv[1]&&import.meta.url===pathToFileURL(process.argv[1]).href){if(process.argv.length!==4)throw Error('Usage: ... CANDIDATE_CATALOG.json SCENARIO.json');process.stdout.write(JSON.stringify(runSourceGapsExpansionV1(readFileSync(process.argv[2],'utf8'),readFileSync(process.argv[3],'utf8')),null,2)+'\n');}
