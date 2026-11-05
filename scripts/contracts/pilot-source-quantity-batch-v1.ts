import {createHash} from 'node:crypto';
import {readFileSync} from 'node:fs';
import {pathToFileURL} from 'node:url';
import {assertRawJsonWithoutDuplicateKeysV1} from '../../src/utils/adaptiveNutritionWireV1';
import {decodeAuthoringRecipeCatalog,authoringSearchInput} from '../../src/dev/authoringRecipeCatalog';
import {previewRecipeAuthoringWeekV1,type AuthoringWeekScenarioV1} from '../../src/dev/authoringWeekSearchV1';
import {calculateCompleteConditionalRecipeInputV1} from './recipe-recalculation-gate-v1';
import {deriveAvailableCarbohydrateCandidateV1} from './three-food-source-candidates-v1';
import {runGreekOwnerBalancedPoolV1} from './greek-owner-balanced-pool-v1';
import {diagnoseAuthoringCategoryCapacityV1} from './greek-snack-input-model-v1';

// Four-task acceptance: all 88 row/context reviews, direct primary-source checks,
// explicit quantity decisions, complete-only input calculation and actual rerun.
// This is conditional ingredient INPUT modelling, never cooked/retained nutrition,
// source authority, canonical admission, a nutrition safety claim or activation.
type Obj=Record<string,unknown>;
const axes=['calories','protein','fat','carbs','fiber'] as const;
type Vector=Record<typeof axes[number],string>;
type Facts=Record<'calories'|'protein'|'fat'|'totalCarbohydrate'|'fiber',string>;
const base='docs/premium/retained-sources/pilot-19-source-quantity-20261105/';
const oldCapture='docs/premium/retained-sources/pilot-source-stage-20261104/sr28-ascii-capture-v1.json';
const policyPath='docs/premium/retained-sources/p5-03/source-review-package-v1.json';
const definitionPath='docs/premium/retained-sources/p5-03/usda-carbohydrate-definition.txt';
const archiveSha='8308fd1d224ef1e5331093748007180da01a7ac713cbac6a1f5bc2a03e1ee70a';
const hash=(s:string)=>createHash('sha256').update(s).digest('hex');
function invalid():never{throw Error('INVALID_PILOT_SOURCE_QUANTITY_BATCH');}
function obj(v:unknown):Obj{if(!v||typeof v!=='object'||Array.isArray(v))invalid();return v as Obj;}
function list(v:unknown):unknown[]{if(!Array.isArray(v)||v.length>2000)invalid();return v;}
function parse(raw:string){if(typeof raw!=='string'||Buffer.byteLength(raw)>15_000_000)invalid();assertRawJsonWithoutDuplicateKeysV1(raw);return obj(JSON.parse(raw));}
function canonical(v:unknown):string{
  if(v===null||typeof v==='string'||typeof v==='boolean'||typeof v==='number')return JSON.stringify(v);
  if(Array.isArray(v))return '['+v.map(canonical).join(',')+']';
  const r=obj(v);return '{'+Object.keys(r).sort().map(k=>JSON.stringify(k)+':'+canonical(r[k])).join(',')+'}';
}
function minor(v:unknown){if(typeof v!=='string'||!/^(0|[1-9][0-9]{0,5})(\.[0-9]{1,3})?$/.test(v))invalid();
  const [n,f='']=v.split('.');return BigInt(n)*1000n+BigInt(f.padEnd(3,'0'));}
function offline(r:Obj){for(const k of ['sourceApproved','runtimePublishable','canApply','mayActivate'])if(r[k]!==false)invalid();}

export interface BatchComponentV2 {
  rowId:string;status:'DECLARED_SOURCE_INPUT_MODEL'|'BLOCKED';componentKind:'FOOD'|'POTABLE_WATER'|'TABLE_SALT';
  sourceRecord:string|null;vector:Vector|null;quantityG:string|null;quantityDecision:string;optional:boolean;
}
/** Separate V2 input seam. Water's explicit five-axis source zero is independent
 * of its mass; no ML density, nutrient retention or finished yield follows.
 * Salt still requires declared grams; unknown optional salt is never omitted. */
export function calculateBatchInputV2(rows:BatchComponentV2[],servings:unknown){
  if(!rows.length||rows.length>1000||new Set(rows.map(r=>r.rowId)).size!==rows.length)invalid();
  const blocked=rows.filter(r=>r.status!=='DECLARED_SOURCE_INPUT_MODEL'||r.vector===null||r.sourceRecord===null
    ||(r.componentKind!=='POTABLE_WATER'&&r.quantityG===null));
  if(blocked.length)return {status:'INCOMPLETE_DECLARED_INPUT_MODEL',blockedRowIds:blocked.map(r=>r.rowId),wholeInput:null,perDeclaredServing:null};
  for(const r of rows){
    if(!r.vector||Object.keys(r.vector).length!==5)invalid();axes.forEach(a=>minor(r.vector![a]));
    if(r.componentKind==='POTABLE_WATER'){
      if(r.sourceRecord!=='SR28:14411'||r.quantityDecision!=='TYPED_WATER_ZERO_NO_GRAM_CONVERSION'||r.quantityG!==null||axes.some(a=>minor(r.vector![a])!==0n))invalid();
    }else{
      if(!['FOOD','TABLE_SALT'].includes(r.componentKind)||r.quantityG===null||minor(r.quantityG)<=0n)invalid();
      if(r.componentKind==='TABLE_SALT'&&(r.sourceRecord!=='SR28:02047'||axes.some(a=>minor(r.vector![a])!==0n)))invalid();
      if(r.componentKind==='FOOD'&&['SR28:14411','SR28:02047'].includes(String(r.sourceRecord)))invalid();
    }
  }
  if(!rows.some(r=>r.componentKind==='FOOD'))return {status:'NO_FOOD_COMPONENT',blockedRowIds:rows.map(r=>r.rowId),wholeInput:null,perDeclaredServing:null};
  const calculated=calculateCompleteConditionalRecipeInputV1(rows.filter(r=>r.componentKind!=='POTABLE_WATER').map(r=>({
    rowId:r.rowId,optional:r.optional,sourceBinding:r.sourceRecord,quantityBasis:'RECORDED_EDIBLE_G_CONDITIONAL',grams:r.quantityG,
    completeSourceCandidatePer100G:r.vector,blockers:[]})),servings);
  return {...calculated,status:'COMPLETE_CONDITIONAL_INGREDIENT_INPUT_ONLY'};
}

/** Explicit bread gram authority differs from a reference grams-per-piece guess. */
export function resolveBatchQuantityV1(raw:Obj,decision:unknown,steps:unknown){
  if(decision==='TYPED_WATER_ZERO_NO_GRAM_CONVERSION'){
    if(!['Вода','Вода питьевая'].includes(String(raw.ingredient_name_ru))||raw.unit!=='ML'||typeof raw.amount!=='number'||raw.amount<=0)invalid();
    return {quantityG:null,status:'TYPED_WATER_SOURCE_ZERO_ONLY',measuredMassG:null};
  }
  if(decision==='EXPLICIT_GRAMS_PIECES_PRESENTATION'){
    if(raw.unit!=='PCS'||typeof raw.weight_g!=='number'||raw.weight_g<=0||typeof raw.notes!=='string')invalid();
    const declaredText=[raw.preparation_note,raw.notes].filter(v=>typeof v==='string').join(' ');
    const match=declaredText.match(/nutrition authority — exact ((?:0|[1-9][0-9]*)(?:\.[0-9]{1,3})?) г/);
    const instructions=list(steps).map(obj).map(s=>s.instruction_ru).join(' ');
    if(!match||minor(match[1])!==minor(String(raw.weight_g))||!instructions.includes('Взвесить ровно '+match[1]+' г'))invalid();
    return {quantityG:String(raw.weight_g),status:'DECLARED_GRAMS_WITH_PIECE_PRESENTATION_NOT_CONVERSION',measuredMassG:null};
  }
  if(decision==='DECLARED_GRAMS'&&raw.unit==='G'&&typeof raw.weight_g==='number'&&raw.weight_g>0&&raw.amount===raw.weight_g)
    return {quantityG:String(raw.weight_g),status:'DECLARED_EDIBLE_INPUT_GRAMS_NOT_MEASUREMENT',measuredMassG:null};
  return {quantityG:null,status:'UNRESOLVED_QUANTITY_NO_CONVERSION',measuredMassG:null};
}

export interface PilotBatchEvidenceV1{reviewRaw:string;materials:Record<string,string>}
export function readPilotBatchEvidenceV1():PilotBatchEvidenceV1{
  const read=(p:string)=>readFileSync(new URL('../../'+p,import.meta.url),'utf8');
  const reviewRaw=read(base+'batch-review-v1.json'),review=parse(reviewRaw);
  return {reviewRaw,materials:Object.fromEntries(list(review.materials).map(obj).map(m=>{
    const path=String(m.path);if(!path.startsWith(base)&&![oldCapture,policyPath,definitionPath].includes(path))invalid();
    if(path.includes('..'))invalid();return [path,read(path)];}))};
}
export function validatePilotBatchSourcesV1(e:PilotBatchEvidenceV1){
  const review=parse(e.reviewRaw);offline(review);
  if(review.contract!=='potok-pilot-19-source-quantity-review-v1'||review.reviewKind!=='PINNED_DECLARED_INPUT_REVIEW_NOT_SOURCE_AUTHORITY')invalid();
  const materials=list(review.materials).map(obj);if(new Set(materials.map(m=>m.path)).size!==materials.length)invalid();
  for(const m of materials)if(typeof m.path!=='string'||hash(e.materials[m.path])!==m.sha256)invalid();
  const current=parse(e.materials[base+'sr28-primary-subset-v1.json']),prior=parse(e.materials[oldCapture]);
  if(current.contract!=='potok-pilot-19-sr28-primary-subset-v1'||current.archiveSha256!==archiveSha||prior.archiveSha256!==archiveSha
    ||[current.sourceApproved,current.runtimePublishable,current.mayActivate].some(v=>v!==false))invalid();
  for(const n of ['FOOD_DES.txt','NUT_DATA.txt'])if(obj(current.fileHashes)[n]!==obj(prior.fileHashes)[n])invalid();
  const policyPackage=parse(e.materials[policyPath]),policy=obj(policyPackage.carbsMappingPolicy);
  if(policy.version!=='potok-source-total-including-fiber-to-available-v1'||policy.requireSameIdentityStateBasisUnits!==true||policy.calories!=='PRESERVE_SOURCE_NO_4_9_4')invalid();
  const definition=list(policyPackage.additionalRetainedSources).map(obj).find(r=>r.retainedPath===definitionPath);
  if(!definition||definition.sha256!==hash(e.materials[definitionPath]))invalid();
  const sources=new Map<string,Vector>(),records=[...list(current.records),...list(prior.records).filter(v=>['12155','09050'].includes(String(obj(v).ndb)))];
  const codes={calories:'208',protein:'203',fat:'204',totalCarbohydrate:'205',fiber:'291'} as const;
  for(const [axis,code] of Object.entries(codes)){
    const definitions=list(prior.nutrientDefinitions).map(obj).filter(r=>typeof r.text==='string'&&r.text.startsWith(`~${code}~^`));
    if(definitions.length!==1||String(definitions[0].text).split('^')[1]!==`~${axis==='calories'?'kcal':'g'}~`)invalid();
  }
  for(const value of records){
    const r=obj(value),id=String(r.ndb),f=obj(r.factsPer100GEdible) as Facts,food=obj(r.foodRecord),lines=list(r.nutrientRecords).map(obj);
    if(sources.has('SR28:'+id)||typeof food.text!=='string'||food.text.split('^')[0]!==`~${id}~`||food.text.split('^')[2]!==`~${r.description}~`||lines.length!==5)invalid();
    for(const a of Object.keys(codes) as (keyof typeof codes)[]){
      const matches=lines.filter(l=>l.nutrientCode===codes[a]);if(matches.length!==1||typeof matches[0].text!=='string')invalid();
      const raw=matches[0].text.split('^');if(raw[0]!==`~${id}~`||raw[1]!==`~${codes[a]}~`||minor(raw[2])!==minor(f[a]))invalid();
    }
    const binding='SR28:'+id+':PER_100_G_EDIBLE',carbs=deriveAvailableCarbohydrateCandidateV1(JSON.stringify({sourceTotalCarbohydrateG:f.totalCarbohydrate,
      sourceDietaryFiberG:f.fiber,sourceDefinition:'TOTAL_CARBOHYDRATE_BY_DIFFERENCE_INCLUDING_FIBER',carbohydrateBinding:binding,fiberBinding:binding,
      carbohydrateUnit:'g',fiberUnit:'g',basis:'PER_100_G_EDIBLE'}));
    sources.set('SR28:'+id,{calories:f.calories,protein:f.protein,fat:f.fat,carbs:carbs.availableCarbohydrateG,fiber:f.fiber});
  }
  const api=parse(e.materials[base+'fdc-747448-selected-fields-v1.json']);
  const assertCapture=(r:Obj,id:number)=>{
    if(r.captureContract!=='potok-fdc-primary-selected-fields-v1'||r.captureKind!=='SELECTED_NUMERIC_FIELDS_AND_DEFINITIONS_NOT_FULL_RESPONSE'
      ||r.fdcId!==id||r.sourceUrl!==`https://api.nal.usda.gov/fdc/v1/food/${id}`||typeof r.sourceResponseSha256!=='string'
      ||!/^[a-f0-9]{64}$/.test(r.sourceResponseSha256)||typeof r.sourceResponseBytes!=='number'||r.sourceResponseBytes<=0
      ||r.sourceApproved!==false||r.runtimePublishable!==false||r.mayActivate!==false)invalid();
  };
  assertCapture(api,747448);
  if(api.dataType!=='Foundation'||api.description!=='Strawberries, raw')invalid();
  const f:Obj={};for(const a of Object.keys(codes) as (keyof typeof codes)[]){
    const n=list(api.foodNutrients).map(obj).filter(n=>obj(n.nutrient).number===codes[a]);
    if(n.length!==1||obj(n[0].nutrient).unitName!==(a==='calories'?'kcal':'g')||typeof n[0].amount!=='number')invalid();f[a]=String(n[0].amount);minor(f[a]);
  }
  const mapped=deriveAvailableCarbohydrateCandidateV1(JSON.stringify({sourceTotalCarbohydrateG:f.totalCarbohydrate,sourceDietaryFiberG:f.fiber,
    sourceDefinition:'TOTAL_CARBOHYDRATE_BY_DIFFERENCE_INCLUDING_FIBER',carbohydrateBinding:'FDC747448:RAW:100G',fiberBinding:'FDC747448:RAW:100G',carbohydrateUnit:'g',fiberUnit:'g',basis:'PER_100_G_EDIBLE'}));
  sources.set('FDC_PRIMARY:747448',{calories:String(f.calories),protein:String(f.protein),fat:String(f.fat),carbs:mapped.availableCarbohydrateG,fiber:String(f.fiber)});
  const foundationFindings=[2346396,2346401,2346403].map(id=>{
    const r=parse(e.materials[base+`fdc-${id}-selected-fields-v1.json`]);assertCapture(r,id);if(r.dataType!=='Foundation')invalid();
    return {fdcId:id,description:r.description,publicationDate:r.publicationDate,selectedNutrients:list(r.foodNutrients).map(obj)
      .filter(n=>['203','204','205','291','293','957','958'].includes(String(obj(n.nutrient).number))).map(n=>({definition:n.nutrient,amount:n.amount??null})),
      status:'RETAINED_PRIMARY_LEAD_NOT_ELIGIBLE_OLD_POLICY_OR_GENERIC_CLASS_MAPPING'};
  });
  return {sources,foundationFindings};
}

export function runPilotSourceQuantityBatchV1(candidateRaw:string,scenarioRaw:string,e=readPilotBatchEvidenceV1()){
  const review=parse(e.reviewRaw);if(review.candidateBytesSha256!==hash(candidateRaw))invalid();
  const prior=runGreekOwnerBalancedPoolV1(candidateRaw,scenarioRaw),primary=validatePilotBatchSourcesV1(e);
  if(canonical(review.recipeIds)!==canonical(prior.balancedReferenceWorkPool.selectedRecipeIds))invalid();
  const candidate=parse(candidateRaw),catalog=obj(candidate.originalAuthoringCatalog),decoded=decodeAuthoringRecipeCatalog(catalog);
  const annotations=list(review.rows).map(obj);if(annotations.length!==88||new Set(annotations.map(a=>a.ingredientRowId)).size!==88)invalid();
  const owner=parse(e.materials[base+'owner-states-v1.json']);offline(owner);
  if(owner.contract!=='potok-owner-pilot-groat-potato-states-v1'||owner.scope!=='FIVE_PINNED_INPUT_ROWS_ONLY'
    ||owner.origin!=='OWNER_MULTIPLE_CHOICE_REPLY'||owner.date!=='2026-11-05')invalid();
  const ownerRows=list(owner.rows).map(obj);if(ownerRows.length!==5||new Set(ownerRows.map(r=>r.ingredientRowId)).size!==5)invalid();
  const stateById:Record<string,string>={buckwheat_porridge_mushrooms_ing_01:'ROASTED_BROWN_GROATS',turkey_buckwheat_ing_02:'ROASTED_BROWN_GROATS',
    chicken_meatballs_buckwheat_ing_06:'ROASTED_BROWN_GROATS',chicken_roasted_beet_potato_ing_03:'NON_YOUNG_PEELED',rabbit_potatoes_carrots_ing_02:'NON_YOUNG_PEELED'};
  if(ownerRows.some(r=>!Object.hasOwn(stateById,String(r.ingredientRowId))||stateById[String(r.ingredientRowId)]!==r.intendedState))invalid();
  const milk=parse(e.materials[base+'owner-milk-gram-inputs-v1.json']);offline(milk);
  if(milk.contract!=='potok-owner-milk-gram-inputs-v1'||milk.date!=='2026-11-05'||milk.origin!=='OWNER_REPLY_TO_EXPLICIT_NEW_MILK_GRAM_AMOUNTS'
    ||milk.scope!=='THREE_PINNED_AUTHORING_VARIANT_INPUTS_ONLY'||milk.originalInstructionsChanged!==false||milk.notVolumeToMassConversion!==true||milk.measuredMass!==false)invalid();
  const milkRows=list(milk.rows).map(obj),milkGramsById:Record<string,number>={oatmeal_pear_walnut_ing_02:300,rice_porridge_berries_ing_03:400,buckwheat_crepes_tvorog_ing_02:150};
  if(milkRows.length!==3||new Set(milkRows.map(r=>r.ingredientRowId)).size!==3||milkRows.some(r=>!Object.hasOwn(milkGramsById,String(r.ingredientRowId))
    ||r.newDeclaredGrams!==milkGramsById[String(r.ingredientRowId)]))invalid();
  const linked=new Set<string>(),usedOwner=new Set<string>(),usedMilk=new Set<string>();
  const recipes=list(catalog.recipes).map(obj).filter(r=>list(review.recipeIds).includes(r.recipeId)).map(recipe=>{
    const recipeId=String(recipe.recipeId),view=decoded.recipes.get(recipeId);if(!view)invalid();
    const rows=list(recipe.ingredients).map(obj).map(raw=>{
      const id=String(raw.ingredient_row_id),a=annotations.find(a=>a.ingredientRowId===id);
      const rowHash=hash(canonical(raw)),contextHash=hash(canonical({sourceRecipe:recipe.sourceRecipe,steps:recipe.steps}));
      if(!a||a.recipeId!==recipeId||a.sourceAuthoringRowSha256!==rowHash||a.recipeContextSha256!==contextHash||a.sourceApproved!==false||a.runtimePublishable!==false)invalid();linked.add(id);
      if(a.ownerState!==null){const state=ownerRows.find(r=>r.ingredientRowId===id);
        if(!state||state.recipeId!==recipeId||state.sourceAuthoringRowSha256!==rowHash||state.recipeContextSha256!==contextHash||state.intendedState!==a.ownerState
          ||!['ROASTED_BROWN_GROATS','NON_YOUNG_PEELED'].includes(String(state.intendedState)))invalid();usedOwner.add(id);
        if(a.ownerState==='ROASTED_BROWN_GROATS'&&(a.sourceCandidate===null||obj(a.sourceCandidate).record!=='20009'))invalid();
        if(a.ownerState==='NON_YOUNG_PEELED'&&a.status!=='BLOCKED')invalid();
      }
      const source=a.sourceCandidate===null?null:obj(a.sourceCandidate),key=source?String(source.kind)+':'+String(source.record):null;
      const vector=key?primary.sources.get(key)??null:null;
      let quantity:ReturnType<typeof resolveBatchQuantityV1>;
      if(a.quantityDecision==='OWNER_NEW_GRAM_INPUT_NOT_VOLUME_CONVERSION'){
        const revision=milkRows.find(r=>r.ingredientRowId===id);
        if(!revision||revision.recipeId!==recipeId||revision.sourceAuthoringRowSha256!==rowHash||revision.recipeContextSha256!==contextHash
          ||raw.ingredient_name_ru!=='Молоко 2%'||raw.unit!=='ML'||key!=='SR28:01174')invalid();
        usedMilk.add(id);quantity={quantityG:String(revision.newDeclaredGrams),status:'OWNER_NEW_DECLARED_GRAMS_ORIGINAL_ML_STEPS_UNCHANGED',measuredMassG:null};
      }else quantity=resolveBatchQuantityV1(raw,a.quantityDecision,recipe.steps);
      const kind:BatchComponentV2['componentKind']=a.quantityDecision==='TYPED_WATER_ZERO_NO_GRAM_CONVERSION'?'POTABLE_WATER':key==='SR28:02047'?'TABLE_SALT':'FOOD';
      if(a.status!=='DECLARED_SOURCE_INPUT_MODEL'&&a.status!=='BLOCKED')invalid();
      if(a.status==='DECLARED_SOURCE_INPUT_MODEL'&&!vector)invalid();
      const component:BatchComponentV2={rowId:id,status:a.status,componentKind:kind,sourceRecord:key,vector,quantityG:quantity.quantityG,
        quantityDecision:String(a.quantityDecision),optional:raw.optional as boolean};
      return {component,quantity,reviewStatus:a.status,finding:a.finding,ownerState:a.ownerState,
        originalRowSha256:rowHash,recipeContextSha256:contextHash,recordedAmount:raw.amount,recordedUnit:raw.unit,recordedGramsReference:raw.weight_g,
        retainedCookedNutrition:null,sodiumAssessed:false,sourceApproved:false,runtimePublishable:false};
    });
    return {recipeId,name:view.name,declaredServings:view.servings,rows,calculation:calculateBatchInputV2(rows.map(r=>r.component),view.servings),
      completeAdmittedRecipeNutrition:null,measuredYieldG:null,confirmedServings:null,sourceApproved:false,runtimePublishable:false};
  });
    if(linked.size!==88||usedOwner.size!==5||usedMilk.size!==3||recipes.length!==19)invalid();
  const complete=recipes.filter(r=>r.calculation.perDeclaredServing!==null),search=authoringSearchInput(decoded);
  const subset={...search,recipes:search.recipes.filter(r=>complete.some(c=>c.recipeId===r.recipeId)).map(r=>{
    const c=complete.find(c=>c.recipeId===r.recipeId)!.calculation.perDeclaredServing!;
    return {...r,recipeId:'conditional_input_batch__'+r.recipeId,numericReferenceTestInputAvailable:true,
      referenceNutrition:{values:Object.fromEntries(axes.map(a=>[a,Number(c[a])]))}};
  })};
  const scenario=parse(scenarioRaw) as unknown as AuthoringWeekScenarioV1,rerun=previewRecipeAuthoringWeekV1(subset,scenario);
  const all=recipes.flatMap(r=>r.rows);
  return {contract:'potok-pilot-19-source-quantity-batch-result-v1',usage:'OFFLINE_DECLARED_INGREDIENT_INPUT_MODELS_NOT_RETAINED_COOKED_NUTRITION',
    summary:{recipes:recipes.length,ingredientRows:all.length,declaredSourceInputModelRows:all.filter(r=>r.reviewStatus==='DECLARED_SOURCE_INPUT_MODEL').length,
      blockedSourceOrQuantityRows:all.filter(r=>r.reviewStatus==='BLOCKED').length,completeConditionalInputRecipes:complete.length,
      typedWaterInputs:all.filter(r=>r.component.componentKind==='POTABLE_WATER').length,explicitGramPiecePresentations:all.filter(r=>r.component.quantityDecision==='EXPLICIT_GRAMS_PIECES_PRESENTATION').length,
      ownerStateRows:usedOwner.size,ownerNewMilkGramInputs:usedMilk.size,sourceApprovals:0,admittedRecipes:0,appliedChanges:0},
    recipes,foundationFindings:primary.foundationFindings,conditionalInputModelWeek:{actualSearchResult:rerun,
      categoryCapacity:diagnoseAuthoringCategoryCapacityV1(subset,scenario),oldReferenceFallback:false,portionScaling:false,cookedNutrientRetentionModelled:false},
    previousReferenceWeek:prior.balancedReferenceWorkPool.actualReferenceSearch,
    sourceApproved:false,runtimePublishable:false,canApply:false,mayActivate:false,originalDataModified:false,physicalCookingBlocksDevelopment:false};
}
if(process.argv[1]&&import.meta.url===pathToFileURL(process.argv[1]).href){
  if(process.argv.length!==4)throw Error('Usage: ... CANDIDATE_CATALOG.json SCENARIO.json');
  process.stdout.write(JSON.stringify(runPilotSourceQuantityBatchV1(readFileSync(process.argv[2],'utf8'),readFileSync(process.argv[3],'utf8')),null,2)+'\n');
}
