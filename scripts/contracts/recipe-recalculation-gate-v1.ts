import {createHash} from 'node:crypto';
import {readFileSync} from 'node:fs';
import {pathToFileURL} from 'node:url';
import {assertRawJsonWithoutDuplicateKeysV1} from '../../src/utils/adaptiveNutritionWireV1';
import {authoringSearchInput,decodeAuthoringRecipeCatalog} from '../../src/dev/authoringRecipeCatalog';
import {previewRecipeAuthoringWeekV1,type AuthoringWeekScenarioV1} from '../../src/dev/authoringWeekSearchV1';
import {previewConsolidatedAuthoringWeekV1} from './consolidated-authoring-candidate-week-v1';
import {readPinnedProposalSourcesV1} from './authoring-reference-proposals-v1';
import {readPrimaryRecheckRawV1,validateThreeFoodPrimaryRecheckV1} from './three-food-source-candidates-v1';
import {readDeclaredApplicabilityReviewRawV1,readWalnutOwnerInputStateRawV1,reproduceThreeFoodReferenceTextV1} from './three-food-applicability-review-v1';

type Obj=Record<string,unknown>;
const axes=['calories','protein','fat','carbs','fiber'] as const;
type Axis=typeof axes[number];
type Vector=Record<Axis,string>;
const codes={calories:'208',protein:'203',fat:'204',totalCarbohydrate:'205',fiber:'291'} as const;
const hash=(s:string)=>createHash('sha256').update(s).digest('hex');
function invalid():never{throw Error('INVALID_RECIPE_RECALCULATION_INPUT');}
function obj(v:unknown):Obj{if(!v||typeof v!=='object'||Array.isArray(v))invalid();return v as Obj;}
function list(v:unknown):unknown[]{if(!Array.isArray(v)||v.length>2000)invalid();return v;}
function parse(s:string){if(Buffer.byteLength(s)>15_000_000)invalid();assertRawJsonWithoutDuplicateKeysV1(s);return obj(JSON.parse(s));}
function canonical(v:unknown):string{
  if(v===null||typeof v==='string'||typeof v==='boolean'||typeof v==='number')return JSON.stringify(v);
  if(Array.isArray(v))return '['+v.map(canonical).join(',')+']';
  const r=obj(v);return '{'+Object.keys(r).sort().map(k=>JSON.stringify(k)+':'+canonical(r[k])).join(',')+'}';
}
function minor(v:unknown):bigint{
  if(typeof v!=='string'||!/^(0|[1-9][0-9]{0,5})(\.[0-9]{1,3})?$/.test(v))invalid();
  const [n,f='']=v.split('.');return BigInt(n)*1000n+BigInt(f.padEnd(3,'0'));
}
const fixed8=(n:bigint)=>String(n/100000000n)+'.'+String(n%100000000n).padStart(8,'0');

export interface ConditionalRecipeInputV1 {
  rowId:string; optional:boolean; sourceBinding:string|null;
  quantityBasis:'RECORDED_EDIBLE_G_CONDITIONAL'|'UNREVIEWED_VOLUME'|'UNREVIEWED_DISCRETE'|'UNKNOWN';
  grams:string|null; completeSourceCandidatePer100G:Vector|null; blockers:string[];
}
/** Trusted offline composition seam, not an evidence decoder or admission API.
 * Calculates total ingredient INPUT, never retained cooked nutrients or edible yield.
 * Optional rows are included; a recipe variant omitting one requires separate review. */
export function calculateCompleteConditionalRecipeInputV1(rows:readonly ConditionalRecipeInputV1[],declaredServings:unknown){
  if(!rows.length||rows.length>1000||new Set(rows.map(r=>r.rowId)).size!==rows.length)invalid();
  const blocked=rows.filter(r=>!r.rowId||typeof r.optional!=='boolean'||!r.sourceBinding||r.blockers.length
    ||r.quantityBasis!=='RECORDED_EDIBLE_G_CONDITIONAL'||r.grams===null||r.completeSourceCandidatePer100G===null);
  if(blocked.length)return {status:'INSUFFICIENT_COMPLETE_INPUT_DATA',blockedRowIds:blocked.map(r=>r.rowId),wholeInput:null,perDeclaredServing:null} as const;
  const sums=Object.fromEntries(axes.map(a=>[a,0n])) as Record<Axis,bigint>;
  for(const r of rows){
    if(!r.completeSourceCandidatePer100G||r.grams===null)invalid();
    const g=minor(r.grams);if(g<=0n||Object.keys(r.completeSourceCandidatePer100G).length!==5)invalid();
    for(const a of axes)sums[a]+=minor(r.completeSourceCandidatePer100G[a])*g;
  }
  // Integer products have scale 1e8 after /100 g; never recalculate energy as 4/9/4.
  const wholeInput=Object.fromEntries(axes.map(a=>[a,fixed8(sums[a])])) as Vector;
  const servings=typeof declaredServings==='number'&&Number.isFinite(declaredServings)&&declaredServings>0?minor(String(declaredServings)):null;
  // Round half up once, after summation/division. Report rounding explicitly.
  const perDeclaredServing=servings===null?null:Object.fromEntries(axes.map(a=>[a,fixed8((sums[a]*1000n+servings/2n)/servings)])) as Vector;
  return {status:'COMPLETE_CONDITIONAL_INGREDIENT_INPUT_ONLY',blockedRowIds:[],wholeInput,perDeclaredServing} as const;
}

const dairyRoot='docs/premium/retained-sources/dairy-primary-recheck-20261105/';
export function readDairyPrimaryRawV1(){
  const files:Record<string,string>={};
  for(const name of ['source-recheck-v1.json',...[172205,171265,170886,170903].map(i=>`fdc-${i}-primary-response.json`)])
    files[dairyRoot+name]=readFileSync(new URL('../../'+dairyRoot+name,import.meta.url),'utf8');
  return files;
}
/** Validate primary identity, exact five nutrient codes/units and retained byte binding. */
export function validateDairyPrimaryV1(files:Record<string,string>){
  const manifest=parse(files[dairyRoot+'source-recheck-v1.json']);
  if(manifest.contract!=='potok-dairy-primary-recheck-v1'||[manifest.sourceApproved,manifest.runtimePublishable,manifest.canApply,manifest.mayActivate].some(v=>v!==false))invalid();
  const records=list(manifest.records).map(value=>{
    const m=obj(value),id=m.fdcId;
    if(typeof id!=='number'||![172205,171265,170886,170903].includes(id)||m.path!==dairyRoot+`fdc-${id}-primary-response.json`)invalid();
    const raw=files[String(m.path)],s=parse(raw);
    if(hash(raw)!==m.sha256||s.fdcId!==id||s.dataType!=='SR Legacy'||m.dataType!==s.dataType
      ||m.description!==s.description||m.publicationDate!==s.publicationDate||m.ndb!==String(s.ndbNumber).padStart(5,'0'))invalid();
    const facts=obj(m.factsPer100GEdible);
    for(const axis of Object.keys(codes) as (keyof typeof codes)[]){
      const ns=list(s.foodNutrients).map(obj).filter(n=>obj(n.nutrient).number===codes[axis]);
      if(ns.length!==1||obj(ns[0].nutrient).unitName!==(axis==='calories'?'kcal':'g')||typeof ns[0].amount!=='number'
        ||minor(String(ns[0].amount))!==minor(facts[axis]))invalid();
    }
    return {fdcId:id,description:String(s.description),ndb:String(m.ndb),factsPer100GEdible:facts,sha256:String(m.sha256),sourceUrl:String(m.sourceUrl)};
  });
  if(records.length!==4||new Set(records.map(r=>r.fdcId)).size!==4)invalid();
  return records;
}

/** Derives current row coverage from bound existing evidence, never ingredient-name inference. */
export function evaluateRecipeRecalculationV1(candidateRaw:string,scenarioRaw:string){
  const pinned=parse(readFileSync(new URL('../../'+dairyRoot+'baseline-bindings-v1.json',import.meta.url),'utf8'));
  if(pinned.contract!=='potok-recalculation-stage-baseline-bindings-v1'||hash(candidateRaw)!==pinned.candidateBytesSha256
    ||hash(scenarioRaw)!==pinned.scenarioBytesSha256)invalid();
  const baseline=previewConsolidatedAuthoringWeekV1(candidateRaw,scenarioRaw),c=parse(candidateRaw);
  const original=obj(c.originalAuthoringCatalog),decoded=decodeAuthoringRecipeCatalog(original),sources=readPinnedProposalSourcesV1();
  const ledger=parse(sources.ledgerRaw),audit=parse(sources.auditRaw),provenance=obj(c.provenance);
  if(provenance.ledgerSha256!==hash(sources.ledgerRaw)||ledger.authoringCatalogSha256!==provenance.originalCatalogBytesSha256)invalid();
  const declarations=parse(readDeclaredApplicabilityReviewRawV1()),walnut=parse(readWalnutOwnerInputStateRawV1());
  if(declarations.privateCatalogSha256!==provenance.originalCatalogBytesSha256||walnut.privateCatalogSha256!==provenance.originalCatalogBytesSha256)invalid();
  const primary=validateThreeFoodPrimaryRecheckV1(readPrimaryRecheckRawV1(),sources.captureRaw);
  const dairy=validateDairyPrimaryV1(readDairyPrimaryRawV1());
  const indexed=new Map(list(ledger.rows).map(obj).map(r=>[String(r.ingredientRowId),r]));
  const cases=new Map(list(audit.cases).map(obj).flatMap(r=>list(r.rowIds).map(id=>[String(id),r] as const)));
  const originals=new Map(list(original.recipes).map(obj).map(r=>[String(r.recipeId),r]));
  const selected=baseline.selectedRecipeReviews;
  if(c.integritySha256!==pinned.candidateIntegritySha256||provenance.originalCatalogObjectSha256!==pinned.originalCatalogObjectSha256
    ||canonical(selected.map(r=>r.recipeId).sort())!==canonical(pinned.recipeIds)
    ||selected.flatMap(r=>r.ingredientReviews).length!==pinned.ingredientRows)invalid();
  const recipes=selected.map(review=>{
    const recipe=originals.get(review.recipeId),view=decoded.recipes.get(review.recipeId);if(!recipe||!view)invalid();
    const rawRows=list(recipe.ingredients).map(obj),reviews=new Map(review.ingredientReviews.map(r=>[r.ingredientRowId,r]));
    if(reviews.size!==rawRows.length)invalid();
    const rows=rawRows.map(raw=>{
      const id=String(raw.ingredient_row_id),r=reviews.get(id),pin=indexed.get(id),caseReview=cases.get(id);
      if(!r||!pin||pin.recipeId!==review.recipeId||pin.sourceAuthoringRowSha256!==hash(canonical(raw))||r.originalRowSha256!==pin.sourceAuthoringRowSha256)invalid();
      const caseId=caseReview?String(caseReview.caseId):null;
      if((r.sourceVariantReview?.caseId??null)!==caseId)invalid();
      const quantityBasis:ConditionalRecipeInputV1['quantityBasis']=raw.unit==='G'&&typeof raw.weight_g==='number'&&raw.weight_g>0
        ?'RECORDED_EDIBLE_G_CONDITIONAL':raw.unit==='ML'?'UNREVIEWED_VOLUME':['PCS','PIECE','TSP'].includes(String(raw.unit))?'UNREVIEWED_DISCRETE':'UNKNOWN';
      const blockers:string[]=[];
      let sourceBinding:string|null=null,vector:Vector|null=null;
      const annotation=list(declarations.records).map(obj).find(a=>a.ingredientRowId===id);
      if(annotation){
        const source=primary.records.get(String(annotation.caseId));if(!source||annotation.recipeId!==review.recipeId
          ||annotation.sourceAuthoringRowSha256!==hash(canonical(raw))
          ||annotation.recipeContextSha256!==hash(canonical({sourceRecipe:recipe.sourceRecipe,steps:recipe.steps})))invalid();
        if(annotation.caseId==='WALNUT'&&(walnut.ingredientRowId!==id||walnut.sourceAuthoringRowSha256!==annotation.sourceAuthoringRowSha256
          ||walnut.recipeContextSha256!==annotation.recipeContextSha256||walnut.processing!=='RAW'||walnut.edibleForm!=='SHELLED_KERNELS'
          ||walnut.saltAdded!==false||walnut.additivesAdded!==false))invalid();
        if(annotation.caseId!=='WALNUT'&&annotation.declaredAlignment!=='DECLARED_ORIGIN_AND_INPUT_STATE_ALIGN')invalid();
        const f=source.facts,available=minor(f.totalCarbohydrate)-minor(f.fiber);if(available<0n)invalid();
        vector={calories:f.calories,protein:f.protein,fat:f.fat,carbs:String(available/1000n)+'.'+String(available%1000n).padStart(3,'0'),fiber:f.fiber};
        const serialized=r.conditionalSourceInputReview;
        if(!serialized||axes.some(a=>minor(serialized.completeSourceCandidatePer100GEdible[a])!==minor(vector![a])))invalid();
        sourceBinding='HISTORICAL_SR28:'+source.ndb+':PER_100_G_EDIBLE:CONDITIONAL_NOT_ADMITTED';
      }else blockers.push(caseId?'SOURCE_CLASS_OR_VERSION_UNRESOLVED:'+caseId:'ROW_SPECIFIC_SOURCE_APPLICABILITY_OPEN:'+String(pin.openFinding));
      if(quantityBasis!=='RECORDED_EDIBLE_G_CONDITIONAL')blockers.push(quantityBasis);
      const grams=quantityBasis==='RECORDED_EDIBLE_G_CONDITIONAL'?String(raw.weight_g):null;
      let dairyReview:null|{caseId:string;claimedFdcId:number|null;primary:typeof dairy[number]|null;status:string;massRoute:string;
        literalReference:unknown;differentLiteralFields:string[];referenceSemanticsVerified:false}=null;
      if(caseId?.startsWith('DAIRY_')){
        const matches=typeof raw.notes==='string'?[...raw.notes.matchAll(/FDC\s+(\d{6,7})/g)]:[];
        if(matches.length>1)invalid();
        const claimedFdcId=matches.length?Number(matches[0][1]):null;
        const record=claimedFdcId===null?null:dairy.find(s=>s.fdcId===claimedFdcId);if(claimedFdcId!==null&&!record)invalid();
        const literalReference=record?reproduceThreeFoodReferenceTextV1(raw.notes):null;
        const differentLiteralFields=record?(Object.keys(codes) as (keyof typeof codes)[]).filter(a=>
          literalReference===null||minor(literalReference[a])!==minor(record.factsPer100GEdible[a])):[];
        dairyReview={caseId,claimedFdcId,primary:record??null,literalReference,differentLiteralFields,referenceSemanticsVerified:false,
          status:caseId==='DAIRY_TVOROG'?'GENERIC_TVOROG_NO_GO_RETAINED':claimedFdcId===171265?'CLAIMED_2_PERCENT_MILK_POINTS_TO_WHOLE_3_25_PERCENT'
            :claimedFdcId===null?'NO_PRIMARY_IDENTIFIER_IN_DECLARED_PROFILE'
            :caseId==='DAIRY_MILK'?'PRIMARY_RECORD_RESOLVED_CLASS_AND_VOLUME_STILL_OPEN'
            :'PRIMARY_LOW_FAT_RECORD_RESOLVED_GENERIC_2_PERCENT_MAPPING_OPEN',
          massRoute:raw.unit==='ML'?'PER_VOLUME_SOURCE_OR_CLASS_SPECIFIC_CONVERSION_REQUIRED':'RECORDED_GRAMS_NOT_MEASURED'};
      }
      return {rowId:id,optional:raw.optional as boolean,sourceBinding,quantityBasis,grams,completeSourceCandidatePer100G:vector,blockers,
        sourceCase:caseId,originalRowSha256:pin.sourceAuthoringRowSha256,recordedAmount:raw.amount,recordedUnit:raw.unit,
        recordedGramsReference:raw.weight_g,measuredMassG:null,dairyReview};
    });
    const calculation=calculateCompleteConditionalRecipeInputV1(rows,view.servings);
    return {recipeId:review.recipeId,name:view.name,declaredServings:view.servings,rows,calculation,
      completeInputArithmeticSufficient:calculation.wholeInput!==null,
      cookedNutrients:null,measuredYieldG:null,confirmedServings:null,sourceApproved:false,runtimePublishable:false};
  });
  const eligible=recipes.filter(r=>r.calculation.perDeclaredServing!==null),search=authoringSearchInput(decoded);
  const sufficientSearch={...search,recipes:search.recipes.filter(r=>eligible.some(e=>e.recipeId===r.recipeId)).map(r=>{
    const calc=eligible.find(e=>e.recipeId===r.recipeId)!.calculation.perDeclaredServing!;
    return {...r,numericReferenceTestInputAvailable:true,referenceNutrition:{values:Object.fromEntries(axes.map(a=>[a,Number(calc[a])]))}};
  })};
  const rerun=previewRecipeAuthoringWeekV1(sufficientSearch,parse(scenarioRaw) as unknown as AuthoringWeekScenarioV1);
  const all=recipes.flatMap(r=>r.rows),counts=(values:string[])=>Object.fromEntries([...new Set(values)].sort().map(v=>[v,values.filter(x=>x===v).length]));
  return {contract:'potok-complete-input-sufficiency-run-v1',usage:'OFFLINE_CONDITIONAL_INPUT_ARITHMETIC_NOT_COOKED_NUTRITION',
    candidateCatalogIntegritySha256:baseline.candidateCatalogIntegritySha256,
    provenance:{ledgerSha256:hash(sources.ledgerRaw),dairyRecheckSha256:hash(readDairyPrimaryRawV1()[dairyRoot+'source-recheck-v1.json']),hashesAreNotAuthority:true},
    summary:{selectedRecipes:recipes.length,ingredientRows:all.length,dairyRows:all.filter(r=>r.dairyReview!==null).length,
      completeConditionalSourceRows:all.filter(r=>r.completeSourceCandidatePer100G!==null).length,
      sufficientCompleteInputRecipes:eligible.length,recomputedCompleteInputRecipes:recipes.filter(r=>r.calculation.wholeInput!==null).length,
      massBasisCounts:counts(all.map(r=>r.quantityBasis)),dairyStatusCounts:counts(all.flatMap(r=>r.dairyReview?[r.dairyReview.status]:[])),
      sourceApprovals:0,admittedRecipes:0,appliedChanges:0},
    recipes,originalReferenceWeek:baseline.authoringPreview,
    sufficientOnlyWeek:{nutritionBasis:'COMPLETE_CONDITIONAL_INPUT_DIVIDED_BY_DECLARED_SERVINGS',
      status:eligible.length?rerun.status:'NO_SUFFICIENT_COMPLETE_INPUT_RECIPES',searchResult:rerun,
      originalReferencesUsedAsFallback:false,selectedRecipeScopeOnly:true,searchRounding:'HALF_UP_8_DECIMAL_PER_SERVING_THEN_EXISTING_SEARCH_3_DECIMAL',
      cookedRetentionAssumed:false},
    cookedNutritionRecomputed:false,originalDataModified:false,physicalCookingBlocksDevelopment:false,
    sourceApproved:false,runtimePublishable:false,mayActivate:false,canApply:false};
}

if(process.argv[1]&&import.meta.url===pathToFileURL(process.argv[1]).href){
  if(process.argv.length!==4)throw Error('Usage: ... CANDIDATE_CATALOG.json SCENARIO.json');
  process.stdout.write(JSON.stringify(evaluateRecipeRecalculationV1(readFileSync(process.argv[2],'utf8'),readFileSync(process.argv[3],'utf8')),null,2)+'\n');
}
