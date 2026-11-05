import {createHash} from 'node:crypto';
import {readFileSync} from 'node:fs';
import {pathToFileURL} from 'node:url';
import {assertRawJsonWithoutDuplicateKeysV1} from '../../src/utils/adaptiveNutritionWireV1';
import {runPilotSourceQuantityBatchV1,readPilotBatchEvidenceV1,type BatchComponentV2} from './pilot-source-quantity-batch-v1';
import {decodeAuthoringRecipeCatalog,authoringSearchInput} from '../../src/dev/authoringRecipeCatalog';
import {previewRecipeAuthoringWeekV1,type AuthoringWeekScenarioV1} from '../../src/dev/authoringWeekSearchV1';
import {diagnoseAuthoringCategoryCapacityV1} from './greek-snack-input-model-v1';

// Four-task acceptance: review Foundation methods without global remapping;
// check exact grain/tuna source identities without choosing unanswered variants;
// reconcile previously authorized ingredient/step variants; recalculate/rerun.
// V1/V2 contracts, original authoring data and runtime admission stay unchanged.
type Obj=Record<string,unknown>;
const axes=['calories','protein','fat','carbs','fiber'] as const;
type Vector=Record<typeof axes[number],string>;
const base='docs/premium/retained-sources/foundation-variants-20261105/';
const parent='docs/premium/retained-sources/pilot-19-source-quantity-20261105/';
const hash=(s:string)=>createHash('sha256').update(s).digest('hex');
function invalid():never{throw Error('INVALID_FOUNDATION_VARIANTS_REVIEW');}
function obj(v:unknown):Obj{if(!v||typeof v!=='object'||Array.isArray(v))invalid();return v as Obj;}
function list(v:unknown):unknown[]{if(!Array.isArray(v)||v.length>2000)invalid();return v;}
function parse(raw:string){if(typeof raw!=='string'||Buffer.byteLength(raw)>15_000_000)invalid();assertRawJsonWithoutDuplicateKeysV1(raw);return obj(JSON.parse(raw));}
function canonical(v:unknown):string{
  if(v===null||typeof v==='string'||typeof v==='boolean'||typeof v==='number')return JSON.stringify(v);
  if(Array.isArray(v))return '['+v.map(canonical).join(',')+']';
  const r=obj(v);return '{'+Object.keys(r).sort().map(k=>JSON.stringify(k)+':'+canonical(r[k])).join(',')+'}';
}
function minor(v:unknown,scale:number){
  if(typeof v!=='string'||!new RegExp('^(0|[1-9][0-9]{0,5})(\\.[0-9]{1,'+scale+'})?$').test(v))invalid();
  const [n,f='']=v.split('.');return BigInt(n)*10n**BigInt(scale)+BigInt(f.padEnd(scale,'0'));
}
const fixed8=(n:bigint)=>String(n/100000000n)+'.'+String(n%100000000n).padStart(8,'0');
const round=(n:bigint,d:bigint)=>(n+d/2n)/d;

/** V3 extends only offline decimal precision. Missing/optional inputs still block. */
export function calculatePreciseInputV3(rows:BatchComponentV2[],servings:unknown){
  if(!rows.length||rows.length>1000||new Set(rows.map(r=>r.rowId)).size!==rows.length)invalid();
  const blocked=rows.filter(r=>r.status!=='DECLARED_SOURCE_INPUT_MODEL'||!r.vector||!r.sourceRecord||(r.componentKind!=='POTABLE_WATER'&&r.quantityG===null));
  if(blocked.length)return {status:'INCOMPLETE_PRECISE_INPUT_MODEL',blockedRowIds:blocked.map(r=>r.rowId),wholeInput:null,perDeclaredServing:null};
  if(!rows.some(r=>r.componentKind==='FOOD'))return {status:'NO_FOOD_COMPONENT',blockedRowIds:rows.map(r=>r.rowId),wholeInput:null,perDeclaredServing:null};
  const sums=Object.fromEntries(axes.map(a=>[a,0n])) as Record<typeof axes[number],bigint>;
  for(const r of rows){
    if(!r.vector||Object.keys(r.vector).length!==5)invalid();const v=Object.fromEntries(axes.map(a=>[a,minor(r.vector![a],8)])) as Record<typeof axes[number],bigint>;
    if(r.componentKind==='POTABLE_WATER'){
      if(r.sourceRecord!=='SR28:14411'||r.quantityDecision!=='TYPED_WATER_ZERO_NO_GRAM_CONVERSION'||r.quantityG!==null||axes.some(a=>v[a]!==0n))invalid();continue;
    }
    if(r.quantityG===null||!['FOOD','TABLE_SALT'].includes(r.componentKind))invalid();const grams=minor(r.quantityG,3);if(grams<=0n)invalid();
    if(r.componentKind==='FOOD'&&['SR28:14411','SR28:02047'].includes(r.sourceRecord!))invalid();
    if(r.componentKind==='TABLE_SALT'&&(r.sourceRecord!=='SR28:02047'||axes.some(a=>v[a]!==0n)))invalid();
    for(const a of axes)sums[a]+=v[a]*grams;
  }
  const wholeInput=Object.fromEntries(axes.map(a=>[a,fixed8(round(sums[a],100000n))])) as Vector;
  const count=typeof servings==='number'&&Number.isFinite(servings)&&servings>0?minor(String(servings),3):null;
  const perDeclaredServing=count===null?null:Object.fromEntries(axes.map(a=>[a,fixed8(round(sums[a],100n*count))])) as Vector;
  return {status:'COMPLETE_CONDITIONAL_INPUT_V3',blockedRowIds:[],wholeInput,perDeclaredServing};
}

export interface FoundationReviewEvidenceV1{policyRaw:string;materials:Record<string,string>}
export function readFoundationReviewEvidenceV1():FoundationReviewEvidenceV1{
  const read=(p:string)=>readFileSync(new URL('../../'+p,import.meta.url),'utf8'),policyRaw=read(base+'oats-source-policy-v1.json');
  return {policyRaw,materials:Object.fromEntries(list(parse(policyRaw).materials).map(obj).map(m=>{
    const p=String(m.path);if(p.includes('..')||(!p.startsWith(base)&&!p.startsWith(parent)))invalid();return [p,read(p)];}))};
}
export function mapFoundationOatsSourceV1(e:FoundationReviewEvidenceV1){
  const p=parse(e.policyRaw);
  if(p.contract!=='potok-foundation-oats-source-model-policy-v1'||p.status!=='OFFLINE_SOURCE_MODEL_POLICY_NOT_SOURCE_ADMISSION'
    ||p.scope!=='ONE_PINNED_ROLLED_OAT_INPUT_ONLY'||p.fdcId!==2346396||p.selectedEnergyNutrientId!==2048||p.preserveAlternateEnergyNutrientId!==2047
    ||p.fiberNutrientId!==2033||p.fiberMethod!=='AOAC_2011_25'||p.totalCarbohydrateNutrientId!==1005||p.basis!=='PER_100_G_FOOD'
    ||p.carbohydrateDefinition!=='TOTAL_BY_DIFFERENCE_INCLUDING_FIBER'||p.formula!=='TOTAL_MINUS_SAME_SOURCE_TOTAL_DIETARY_FIBER'||p.precision!==8
    ||p.rounding!=='HALF_UP_ONLY_AFTER_SUM_OR_SERVINGS_DIVISION'
    ||[p.sourceApproved,p.runtimePublishable,p.canApply,p.mayActivate].some(v=>v!==false))invalid();
  const paths=[base+'method-facts-v1.json',...[168927,168881,171986].map(id=>base+`fdc-${id}-selected-fields-v1.json`),
    ...[2346396,2346401,2346403].map(id=>parent+`fdc-${id}-selected-fields-v1.json`)];
  const materials=list(p.materials).map(obj);if(materials.length!==paths.length||new Set(materials.map(m=>m.path)).size!==paths.length)invalid();
  for(const m of materials)if(typeof m.path!=='string'||!paths.includes(m.path)||hash(e.materials[m.path])!==m.sha256)invalid();
  const choices=obj(p.unansweredOwnerChoices);if(Object.keys(choices).length!==3||['porridgeSalt','ricePastaEnrichment','tunaSalt'].some(k=>choices[k]!=='NO_REPLY_RECEIVED'))invalid();
  const docs=parse(e.materials[base+'method-facts-v1.json']);if(docs.contract!=='potok-foundation-method-facts-v1'||docs.sourceApproved!==false)invalid();
  const capture=parse(e.materials[parent+'fdc-2346396-selected-fields-v1.json']);
  if(capture.fdcId!==2346396||capture.dataType!=='Foundation'||capture.description!=='Oats, whole grain, rolled, old fashioned'
    ||capture.captureKind!=='SELECTED_NUMERIC_FIELDS_AND_DEFINITIONS_NOT_FULL_RESPONSE')invalid();
  const rows=list(capture.foodNutrients).map(obj);
  function field(id:number,number:string,unit:string){const ns=rows.filter(r=>obj(r.nutrient).id===id);
    if(ns.length!==1||obj(ns[0].nutrient).number!==number||obj(ns[0].nutrient).unitName!==unit||typeof ns[0].amount!=='number')invalid();
    const value=String(ns[0].amount);minor(value,8);return value;}
  const energy=field(2048,'958','kcal'),alternate=field(2047,'957','kcal'),protein=field(1003,'203','g'),fat=field(1004,'204','g');
  const total=field(1005,'205','g'),fiber=field(2033,'293','g'),carbs=minor(total,8)-minor(fiber,8);if(carbs<0n)invalid();
  return {vector:{calories:energy,protein,fat,carbs:fixed8(carbs),fiber},selectedEnergyNutrientId:2048,alternateEnergy:{nutrientId:2047,value:alternate},
    fiberMethod:'AOAC_2011_25',sourceTotalCarbohydrate:total,sourceBinding:'FDC_FOUNDATION:2346396:2048:2033:PER_100_G_FOOD',
    sourceApproved:false,runtimePublishable:false,canApply:false,mayActivate:false};
}

/** Builds an un-applied recipe view from already authorized owner rows only. */
export function buildOwnedRecipeVariantV1(recipe:Obj,milkRows:Obj[],stateRows:Obj[]){
  const id=String(recipe.recipeId),context=hash(canonical({sourceRecipe:recipe.sourceRecipe,steps:recipe.steps}));
  const ingredients=list(recipe.ingredients).map(obj),steps=list(recipe.steps).map(obj).map(s=>({...s}));
  const changes:Obj[]=[];
  const planned=ingredients.map(raw=>{
    const rowId=String(raw.ingredient_row_id),milk=milkRows.find(r=>r.ingredientRowId===rowId),state=stateRows.find(r=>r.ingredientRowId===rowId);
    const input={ingredientRowId:rowId,name:raw.ingredient_name_ru,amount:raw.amount,unit:raw.unit,declaredGrams:raw.weight_g};
    for(const r of [milk,state])if(r&&(r.recipeId!==id||r.sourceAuthoringRowSha256!==hash(canonical(raw))||r.recipeContextSha256!==context))invalid();
    if(milk){
      if(raw.unit!=='ML'||raw.ingredient_name_ru!=='Молоко 2%'||typeof milk.newDeclaredGrams!=='number'||typeof raw.amount!=='number'||!Number.isFinite(raw.amount))invalid();
      const grams=String(milk.newDeclaredGrams);if(minor(grams,3)<=0n)invalid();
      const oldAmount=String(raw.amount);if(minor(oldAmount,3)<=0n)invalid();
      input.amount=milk.newDeclaredGrams;input.unit='G';input.declaredGrams=milk.newDeclaredGrams;
      for(const step of steps){if(typeof step.instruction_ru!=='string')invalid();let text=step.instruction_ru;
        const needle=new RegExp('(?<![\\d.,])'+oldAmount.replaceAll('.','\\.')+' мл молока','g');text=text.replace(needle,grams+' г молока');
        if(/\d+(?:[.,]\d+)?\s*мл\s+молок/.test(text))invalid();step.instruction_ru=text;}
      changes.push({ingredientRowId:rowId,kind:'OWNER_NEW_GRAM_INPUT_NOT_CONVERSION',originalAmount:raw.amount,originalUnit:raw.unit,newAmount:milk.newDeclaredGrams,newUnit:'G'});
    }
    if(state){
      if(state.intendedState==='ROASTED_BROWN_GROATS')input.name='Гречневая ядрица коричневая обжаренная, сухая';
      else if(state.intendedState==='NON_YOUNG_PEELED'){
        input.name='Картофель немолодой очищенный';if(!steps.length||typeof steps[0].instruction_ru!=='string')invalid();
        steps[0].instruction_ru='Очистить немолодой картофель перед взвешиванием съедобной части. '+steps[0].instruction_ru;
      }else invalid();changes.push({ingredientRowId:rowId,kind:'OWNER_INPUT_STATE',state:state.intendedState});
    }
    return input;
  });
  return {recipeId:id,originalRecipeContextSha256:context,plannedIngredients:planned,plannedSteps:steps,
    changes,originalDataModified:false,appliedToOriginal:false,measuredMass:false,runtimePublishable:false,sourceApproved:false,canApply:false};
}

function identityAudit(e:FoundationReviewEvidenceV1){
  return [[168927,'20420','Pasta, dry, unenriched'],[168881,'20052','Rice, white, short-grain, enriched, uncooked'],
    [171986,'15184','Fish, tuna, light, canned in water, without salt, drained solids']].map(([id,ndb,description])=>{
    const r=parse(e.materials[base+`fdc-${id}-selected-fields-v1.json`]);
    if(r.fdcId!==id||r.ndb!==ndb||r.description!==description||r.dataType!=='SR Legacy'||r.sourceApproved!==false)invalid();
    return {fdcId:id,ndb,description,sourceResponseSha256:r.sourceResponseSha256,
      finding:id===168927?'ORIGINAL_FDC_ID_POINTS_TO_UNENRICHED_NOT_ENRICHED_PASTA':'EXACT_SOURCE_CLASS_VERIFIED_NOT_OWNER_SELECTION',
      ownerClassChoice:'NO_REPLY_RECEIVED',automaticReplacement:false};
  });
}
export function runFoundationVariantsReviewV1(candidateRaw:string,scenarioRaw:string,e=readFoundationReviewEvidenceV1()){
  const prior=runPilotSourceQuantityBatchV1(candidateRaw,scenarioRaw),oats=mapFoundationOatsSourceV1(e),policy=parse(e.policyRaw);
  const original=obj(parse(candidateRaw).originalAuthoringCatalog),rawRecipes=list(original.recipes).map(obj),batch=readPilotBatchEvidenceV1();
  const milk=list(parse(batch.materials[parent+'owner-milk-gram-inputs-v1.json']).rows).map(obj),states=list(parse(batch.materials[parent+'owner-states-v1.json']).rows).map(obj);
  const variants=rawRecipes.filter(r=>[...milk,...states].some(a=>a.recipeId===r.recipeId)).map(r=>buildOwnedRecipeVariantV1(r,milk,states));
  const recipes=prior.recipes.map(r=>{
    const rows=r.rows.map(row=>{
      if(row.component.rowId!==policy.ingredientRowId)return {...row,component:{...row.component}};
      if(row.originalRowSha256!==policy.sourceAuthoringRowSha256||row.recipeContextSha256!==policy.recipeContextSha256)invalid();
      return {...row,reviewStatus:'DECLARED_SOURCE_INPUT_MODEL',finding:'PINNED_FOUNDATION_OATS_V3_SOURCE_PRECISION_NOT_ADMISSION',
        component:{...row.component,status:'DECLARED_SOURCE_INPUT_MODEL' as const,sourceRecord:oats.sourceBinding,vector:oats.vector}};
    });
    return {...r,rows,calculation:calculatePreciseInputV3(rows.map(r=>r.component),r.declaredServings)};
  });
  const oatmeal=recipes.find(r=>r.recipeId==='oatmeal_pear_walnut');if(!oatmeal)invalid();
  const salt=oatmeal.rows.find(r=>r.component.rowId==='oatmeal_pear_walnut_ing_07');if(!salt||!salt.component.optional||salt.component.componentKind!=='TABLE_SALT')invalid();
  const proposal={selectionStatus:'UNSELECTED_OWNER_REPLY_REQUIRED',excludedFromSearch:true,omittedOptionalIngredientRowId:salt.component.rowId,
    calculation:calculatePreciseInputV3(oatmeal.rows.filter(r=>r!==salt).map(r=>r.component),oatmeal.declaredServings),sourceApproved:false,runtimePublishable:false};
  const complete=recipes.filter(r=>r.calculation.perDeclaredServing!==null),decoded=decodeAuthoringRecipeCatalog(original),search=authoringSearchInput(decoded);
  const pool={...search,recipes:search.recipes.filter(r=>complete.some(c=>c.recipeId===r.recipeId)).map(r=>({
    ...r,recipeId:'precise_input_v3__'+r.recipeId,numericReferenceTestInputAvailable:true,referenceNutrition:{values:Object.fromEntries(
      Object.entries(complete.find(c=>c.recipeId===r.recipeId)!.calculation.perDeclaredServing!).map(([k,v])=>[k,Number(v)]))}}))};
  const scenario=parse(scenarioRaw) as unknown as AuthoringWeekScenarioV1;
  return {contract:'potok-foundation-variants-review-result-v1',usage:'OFFLINE_PRECISE_INPUT_MODELS_AND_UNAPPLIED_VARIANTS',
    summary:{recipes:recipes.length,sourceModelRows:recipes.flatMap(r=>r.rows).filter(r=>r.reviewStatus==='DECLARED_SOURCE_INPUT_MODEL').length,
      blockedRows:recipes.flatMap(r=>r.rows).filter(r=>r.reviewStatus==='BLOCKED').length,completeConditionalInputRecipes:complete.length,
      ownedVariantViews:variants.length,sourceApprovals:0,admittedRecipes:0,appliedChanges:0},
    oatsSourceModel:oats,recipes,ownedVariants:variants,unselectedSaltFreeOatProposal:proposal,sourceIdentityAudit:identityAudit(e),
    potatoReview:{status:'BLOCKED_GENERIC_CLASS_AND_METHOD_APPLICABILITY',sourceFields:prior.foundationFindings.filter(f=>f.fdcId!==2346396),
      availableCarbohydrateForCookedRecipe:null,cultivarSubstitutionApproved:false,rawToCookedConversion:null},
    unansweredOwnerChoices:policy.unansweredOwnerChoices,
    actualInputModelWeek:{result:previewRecipeAuthoringWeekV1(pool,scenario),categoryCapacity:diagnoseAuthoringCategoryCapacityV1(pool,scenario),
      unselectedProposalsIncluded:false,oldReferenceFallback:false,searchPrecision:'EXISTING_SEARCH_3_DECIMALS_FROM_EXACT_8_DECIMAL_CALCULATIONS'},
    cookedNutritionClaimed:false,originalDataModified:false,physicalCookingBlocksDevelopment:false,sourceApproved:false,runtimePublishable:false,canApply:false,mayActivate:false};
}
if(process.argv[1]&&import.meta.url===pathToFileURL(process.argv[1]).href){
  if(process.argv.length!==4)throw Error('Usage: ... CANDIDATE_CATALOG.json SCENARIO.json');
  process.stdout.write(JSON.stringify(runFoundationVariantsReviewV1(readFileSync(process.argv[2],'utf8'),readFileSync(process.argv[3],'utf8')),null,2)+'\n');
}
