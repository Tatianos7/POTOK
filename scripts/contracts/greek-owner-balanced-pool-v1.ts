import {createHash} from 'node:crypto';
import {readFileSync} from 'node:fs';
import {pathToFileURL} from 'node:url';
import {assertRawJsonWithoutDuplicateKeysV1} from '../../src/utils/adaptiveNutritionWireV1';
import {authoringSearchInput,decodeAuthoringRecipeCatalog} from '../../src/dev/authoringRecipeCatalog';
import {previewRecipeAuthoringWeekV1,type AuthoringSearchCatalogV1,type AuthoringWeekScenarioV1} from '../../src/dev/authoringWeekSearchV1';
import {runGreekSnackInputModelV1,readGreekSnackModelEvidenceV1,diagnoseAuthoringCategoryCapacityV1,type buildGreekSnackDeclaredModelV1} from './greek-snack-input-model-v1';

// Stage acceptance: append the owner's exact two-row class intent without source
// approval; preserve both complete conditional calculations; prepare balanced
// category coverage from existing pilot recipes; rerun bounded reference search.
// Original recipe/reference/model history remains unchanged. No report artifact.
type Obj=Record<string,unknown>;
const base='docs/premium/retained-sources/greek-snack-input-model-20261105/';
const hash=(s:string)=>createHash('sha256').update(s).digest('hex');
function invalid():never{throw Error('INVALID_GREEK_OWNER_BALANCED_POOL');}
function obj(v:unknown):Obj{if(!v||typeof v!=='object'||Array.isArray(v))invalid();return v as Obj;}
function list(v:unknown):unknown[]{if(!Array.isArray(v)||v.length>2000)invalid();return v;}
function parse(s:string){if(typeof s!=='string'||Buffer.byteLength(s)>15_000_000)invalid();assertRawJsonWithoutDuplicateKeysV1(s);return obj(JSON.parse(s));}
function exact(r:Obj,keys:string[]){if(Object.keys(r).length!==keys.length||keys.some(k=>!Object.hasOwn(r,k)))invalid();}
export function readGreekOwnerInputClassRawV1(){return readFileSync(new URL('../../'+base+'owner-input-class-v1.json',import.meta.url),'utf8');}

/** Owner intent is scoped to these two ingredients; it cannot issue nutrient or mapping approval. */
export function applyGreekOwnerInputClassV1(prior:ReturnType<typeof buildGreekSnackDeclaredModelV1>,priorReviewRaw:string,ownerRaw:string){
  const owner=parse(ownerRaw),review=parse(priorReviewRaw),klass=obj(owner.ingredientClass);
  exact(owner,['contract','date','origin','scope','priorReviewSha256','candidateIntegritySha256','ingredientClass','rows','confirmationKind',
    'sourceApplicability','universalRetail2PercentEquivalence','sourceApproved','foodSpecificMappingApproved','runtimePublishable','canApply','mayActivate']);
  exact(klass,['family','flavor','nominalFatPercent','mandatoryBrand']);
  if(owner.contract!=='potok-owner-greek-yogurt-input-class-v1'||owner.date!=='2026-11-05'||owner.origin!=='OWNER_REPLY_TO_TWO_GREEK_SNACK_CLASS_QUESTION'
    ||owner.scope!=='TWO_RECIPE_AUTHORING_INPUTS_ONLY'||owner.priorReviewSha256!==hash(priorReviewRaw)||owner.candidateIntegritySha256!==review.candidateIntegritySha256
    ||owner.confirmationKind!=='AUTHORING_INGREDIENT_INTENT_NOT_NUTRIENT_APPROVAL'||owner.sourceApplicability!=='PENDING_INDEPENDENT_REVIEW'
    ||klass.family!=='GREEK_YOGURT'||klass.flavor!=='PLAIN_UNSWEETENED'||klass.nominalFatPercent!=='2'||klass.mandatoryBrand!==null
    ||[owner.universalRetail2PercentEquivalence,owner.sourceApproved,owner.foodSpecificMappingApproved,owner.runtimePublishable,owner.canApply,owner.mayActivate].some(v=>v!==false))invalid();
  const rows=list(owner.rows).map(obj);if(rows.length!==2||new Set(rows.map(r=>r.ingredientRowId)).size!==2)invalid();
  const expected=['greek_yogurt_apple','greek_yogurt_banana'];
  if(prior.contract!=='potok-two-greek-snack-input-model-v1'||prior.selectedOption!==null||prior.ownerDecision!==null
    ||prior.recipes.length!==2||new Set(prior.recipes.map(r=>r.recipeId)).size!==2||prior.recipes.some(r=>!expected.includes(r.recipeId)))invalid();
  const recipes=prior.recipes.map(r=>{
    const annotation=rows.find(a=>a.recipeId===r.recipeId),input=r.rows.find(row=>row.role==='GREEK_YOGURT');
    if(!annotation||!input)invalid();exact(annotation,['recipeId','ingredientRowId','sourceAuthoringRowSha256','recipeContextSha256']);
    if(annotation.ingredientRowId!==input.input.rowId||annotation.sourceAuthoringRowSha256!==input.sourceAuthoringRowSha256
      ||annotation.recipeContextSha256!==input.recipeContextSha256||r.sourceApproved!==false||r.foodSpecificMappingApproved!==false||r.runtimePublishable!==false)invalid();
    return {recipeId:r.recipeId,intendedIngredientClass:{family:'GREEK_YOGURT',flavor:'PLAIN_UNSWEETENED',nominalFatPercent:'2',mandatoryBrand:null},
      intendedClassStatus:'OWNER_CONFIRMED',numericSourceApplicability:'PENDING_INDEPENDENT_REVIEW',
      conditionalReferenceModel:{...r.conditionalClassScenario,ownerIntentAligned:true,sourceMappingApproved:false},
      completeAdmittedRecipeNutrition:null,measuredYieldG:null,confirmedServings:null,
      sourceApproved:false,foodSpecificMappingApproved:false,runtimePublishable:false};
  });
  return {contract:'potok-owner-greek-yogurt-input-class-result-v1',status:'OWNER_INGREDIENT_INTENT_RECORDED_NOT_SOURCE_APPROVAL',
    provenance:{priorReviewSha256:hash(priorReviewRaw),ownerInputSha256:hash(ownerRaw),hashesAreNotAuthority:true},
    recipes,ownerConfirmedRows:2,admittedRecipes:0,sourceApprovals:0,originalDataModified:false,
    sourceApproved:false,runtimePublishable:false,canApply:false,mayActivate:false,physicalCookingBlocksDevelopment:false};
}

export interface BalancedPoolReviewPriorityV1{recipeId:string;rowsWithoutCompleteConditionalVector:number;conditionalModelAvailable:boolean}
/** Reference-only work-pool selection. Scores prioritize review effort, never food safety.
 * Bounded to the existing 24-recipe pilot. Minimum capacity is not week feasibility. */
export function buildBalancedPilotReferencePoolV1(catalog:AuthoringSearchCatalogV1,s:AuthoringWeekScenarioV1,priorities:BalancedPoolReviewPriorityV1[]){
  previewRecipeAuthoringWeekV1({...catalog,recipes:[]},s); // Validate scenario and offline contract first.
  if(catalog.recipes.length>24||new Set(catalog.recipes.map(r=>r.recipeId)).size!==catalog.recipes.length
    ||priorities.length!==catalog.recipes.length||new Set(priorities.map(p=>p.recipeId)).size!==priorities.length
    ||priorities.some(p=>!catalog.recipes.some(r=>r.recipeId===p.recipeId)||!Number.isInteger(p.rowsWithoutCompleteConditionalVector)
      ||p.rowsWithoutCompleteConditionalVector<0||p.rowsWithoutCompleteConditionalVector>1000||typeof p.conditionalModelAvailable!=='boolean'))invalid();
  const groups=diagnoseAuthoringCategoryCapacityV1(catalog,s),seen=new Set<string>();
  for(const group of groups)for(const cat of group.sourceCategories){if(seen.has(cat))invalid();seen.add(cat);}
  const eligible=catalog.recipes.filter(r=>r.numericReferenceTestInputAvailable&&r.sourceStatus!=='BLOCKED');
  const priority=new Map(priorities.map(p=>[p.recipeId,p]));
  const cmp=(a:string,b:string)=>a<b?-1:a>b?1:0;
  const score=(a:AuthoringSearchCatalogV1['recipes'][number],b:AuthoringSearchCatalogV1['recipes'][number],target:number)=>{
    const pa=priority.get(a.recipeId)!,pb=priority.get(b.recipeId)!;
    const ca=a.referenceNutrition.values.calories,cb=b.referenceNutrition.values.calories;
    if(typeof ca!=='number'||!Number.isFinite(ca)||typeof cb!=='number'||!Number.isFinite(cb))invalid();
    return Number(pb.conditionalModelAvailable)-Number(pa.conditionalModelAvailable)
      ||pa.rowsWithoutCompleteConditionalVector-pb.rowsWithoutCompleteConditionalVector
      ||Math.abs(ca-target)-Math.abs(cb-target)||cmp(a.recipeId,b.recipeId);
  };
  const initialIds=new Set<string>(),ranked=[];
  for(const group of groups){
    const slots=s.slots.filter(slot=>slot.sourceCategories.some(cat=>group.sourceCategories.includes(cat)));
    const target=s.dailyCalorieTarget*slots.reduce((n,slot)=>n+slot.targetSharePercent,0)/100/slots.length;
    const candidates=eligible.filter(r=>group.sourceCategories.includes(String(r.sourceRecipe.meal_type_primary))).sort((a,b)=>score(a,b,target));
    candidates.slice(0,group.minimumRecipes).forEach(r=>initialIds.add(r.recipeId));ranked.push(...candidates);
  }
  const selected=new Set(initialIds),tail=ranked.filter(r=>!selected.has(r.recipeId));
  const attempts:{poolSize:number;status:string}[]=[];let result:ReturnType<typeof previewRecipeAuthoringWeekV1>|null=null;
  // At most 25 attempts for an empty-to-full pilot. No target/repeat/portion relaxation.
  for(let n=0;n<=tail.length;n++){
    const pool={...catalog,recipes:catalog.recipes.filter(r=>selected.has(r.recipeId))};
    result=previewRecipeAuthoringWeekV1(pool,s);attempts.push({poolSize:pool.recipes.length,status:result.status});
    if(result.status==='REFERENCE_WEEK_PREVIEW'||n===tail.length)break;
    selected.add(tail[n].recipeId);
  }
  if(result===null)invalid();
  return {contract:'potok-balanced-pilot-reference-work-pool-v1',usage:'UNVERIFIED_REFERENCE_WORK_QUEUE_NOT_SOURCE_ADMISSION',
    initialNecessaryPoolSize:initialIds.size,selectedPoolSize:selected.size,selectedRecipeIds:[...selected].sort(),
    initialRecipeIds:[...initialIds].sort(),capacityForAllPilotReferences:groups,
    selectedPoolCapacity:diagnoseAuthoringCategoryCapacityV1({...catalog,recipes:catalog.recipes.filter(r=>selected.has(r.recipeId))},s),
    attempts,actualReferenceSearch:result,reviewQueue:catalog.recipes.filter(r=>selected.has(r.recipeId)).map(r=>({
      recipeId:r.recipeId,sourceCategory:r.sourceRecipe.meal_type_primary,...priority.get(r.recipeId),sourceApplicability:'PENDING_INDEPENDENT_REVIEW',
      runtimePublishable:false,sourceApproved:false})),
    originalReferencesRecomputed:false,conditionalVectorsMixedIntoReferenceTotals:false,sourceApproved:false,runtimePublishable:false,mayActivate:false,canApply:false};
}

export function runGreekOwnerBalancedPoolV1(candidateRaw:string,scenarioRaw:string,ownerRaw=readGreekOwnerInputClassRawV1()){
  const prior=runGreekSnackInputModelV1(candidateRaw,scenarioRaw),e=readGreekSnackModelEvidenceV1();
  const owner=applyGreekOwnerInputClassV1(prior.model,e.reviewRaw,ownerRaw),candidate=parse(candidateRaw),original=obj(candidate.originalAuthoringCatalog);
  const search=authoringSearchInput(decodeAuthoringRecipeCatalog(original)),selectedIds=new Set(prior.originalReferenceWeek.days.flatMap(d=>d.meals.map(m=>m.recipeId)));
  const reviews=list(candidate.recipeReviews).map(obj),conditionalIds=new Set(prior.model.recipes.filter(r=>r.conditionalClassScenario.calculation.perDeclaredServing!==null).map(r=>r.recipeId));
  const pool={...search,recipes:search.recipes.filter(r=>selectedIds.has(r.recipeId))};
  const priorities=pool.recipes.map(r=>{
    const review=reviews.find(x=>x.recipeId===r.recipeId);if(!review)invalid();
    return {recipeId:r.recipeId,conditionalModelAvailable:conditionalIds.has(r.recipeId),
      rowsWithoutCompleteConditionalVector:conditionalIds.has(r.recipeId)?0:list(review.ingredientReviews).map(obj).filter(row=>row.conditionalSourceInputReview===null).length};
  });
  const balanced=buildBalancedPilotReferencePoolV1(pool,parse(scenarioRaw) as unknown as AuthoringWeekScenarioV1,priorities);
  const sourceWorkQueue=balanced.selectedRecipeIds.map(id=>{
    const r=reviews.find(r=>r.recipeId===id);if(!r)invalid();
    return {recipeId:id,sourceApplicability:'PENDING_INDEPENDENT_REVIEW',rows:list(r.ingredientReviews).map(obj).map(row=>({
      ingredientRowId:row.ingredientRowId,sourceCase:row.sourceVariantReview===null?null:obj(row.sourceVariantReview).caseId,
      previousOpenFinding:row.preparation===null?null:obj(row.preparation).openFinding,
      conditionalReferenceModelAvailable:conditionalIds.has(id)||row.conditionalSourceInputReview!==null,
      sourceApproved:false,runtimePublishable:false}))};
  });
  return {contract:'potok-greek-owner-balanced-work-pool-run-v1',ownerInputReview:owner,
    priorUnselectedClassModel:prior.model,balancedReferenceWorkPool:balanced,sourceWorkQueue,
    conditionalModelOnlyWeek:prior.conditionalClassModelOnly,originalSufficientOnlyWeek:prior.originalSufficientOnlyWeek,
    originalDataModified:false,sourceApproved:false,runtimePublishable:false,canApply:false,mayActivate:false,physicalCookingBlocksDevelopment:false};
}
if(process.argv[1]&&import.meta.url===pathToFileURL(process.argv[1]).href){
  if(process.argv.length!==4)throw Error('Usage: ... CANDIDATE_CATALOG.json SCENARIO.json');
  process.stdout.write(JSON.stringify(runGreekOwnerBalancedPoolV1(readFileSync(process.argv[2],'utf8'),readFileSync(process.argv[3],'utf8')),null,2)+'\n');
}
