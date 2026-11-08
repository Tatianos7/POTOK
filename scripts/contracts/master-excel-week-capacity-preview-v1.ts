/**
 * Offline bridge from the owner's Master Excel to the EXISTING weekly calorie
 * capacity checker. Never publishes recipes, resolves food identities or writes
 * a plan. Reference kcal are authoring estimates, not canonical nutrition.
 *
 * Usage: npx tsx scripts/contracts/master-excel-week-capacity-preview-v1.ts
 *   /path/to/POTOK_recipe_master.xlsx 1800
 */
import {readFileSync} from 'node:fs';
import {pathToFileURL} from 'node:url';
import * as XLSX from 'xlsx';
import {findCompleteInputWeekWitnessV1} from './complete-input-week-witness-v1';
import {analyzeWeekInputCalorieCapacityV1,type CapacityRecipeV1} from './week-input-calorie-capacity-v1';

type RecipeRow = Record<string,unknown>;
const invalid = (why:string):never => {throw Error('INVALID_MASTER_EXCEL_PREVIEW: '+why);};
const string = (v:unknown) => typeof v==='string'?v.trim():'';
const positive = (v:unknown) => typeof v==='number'&&Number.isFinite(v)&&v>0;
const categories = new Set(['BREAKFAST','LUNCH','DINNER','SNACK']);

export function readMasterExcelCapacityInputsV1(bytes:Buffer) {
 if(bytes.length===0||bytes.length>10_000_000)invalid('file size');
 const book=XLSX.read(bytes,{type:'buffer',cellDates:false,cellFormula:false});
 const sheet=book.Sheets['01_Рецепты'];
 if(!sheet)invalid('missing 01_Рецепты');
 const rows=XLSX.utils.sheet_to_json<RecipeRow>(sheet,{defval:null,raw:true});
 if(rows.length===0||rows.length>5000)invalid('recipe count');
 const seen=new Set<string>();
 const usable:CapacityRecipeV1[]=[];
 const excluded:Record<string,number>={};
 const statusCounts:Record<string,number>={};
 const skip=(reason:string)=>{excluded[reason]=(excluded[reason]??0)+1;};
 for(const row of rows){
  const id=string(row.recipe_id);
  if(!/^[a-z][a-z0-9_]{1,127}$/.test(id)||seen.has(id))invalid('invalid or duplicate recipe_id');
  seen.add(id);
  if(id.startsWith('example_')){skip('DEMONSTRATION');continue;}
  const status=string(row.status);
  if(!['DRAFT','READY_FOR_REVIEW','APPROVED'].includes(status)){skip('UNKNOWN_STATUS');continue;}
  const category=string(row.meal_type_primary);
  if(!categories.has(category)){skip('UNKNOWN_CATEGORY');continue;}
  if(!positive(row.servings)){skip('NO_DECLARED_SERVINGS');continue;}
  if(!positive(row.ref_kcal_per_serving)){skip('NO_REFERENCE_KCAL');continue;}
  statusCounts[status]=(statusCounts[status]??0)+1;
  usable.push({recipeId:id,sourceCategory:category,caloriesPerDeclaredServing:String(row.ref_kcal_per_serving)});
 }
 return {contract:'potok-master-excel-offline-capacity-input-v1' as const,
  authoringRecipes:rows.length,usableRecipes:usable.length,excluded,statusCounts,
  recipes:usable,referenceNutritionOnly:true,sourceApproved:false,
  runtimePublishable:false,canApply:false,mayActivate:false};
}
export function previewMasterExcelWeekCapacityV1(bytes:Buffer,dailyCalorieTarget:number,weekStart='2026-11-09'){
 if(!/^\d{4}-\d{2}-\d{2}$/.test(weekStart)||!Number.isFinite(Date.parse(weekStart+'T00:00:00Z'))
  ||new Date(weekStart+'T00:00:00Z').toISOString().slice(0,10)!==weekStart)invalid('weekStart');
 if(!Number.isInteger(dailyCalorieTarget)||dailyCalorieTarget<1||dailyCalorieTarget>10000)invalid('target');
 const catalog=readMasterExcelCapacityInputsV1(bytes);
 // Existing checker accepts <=128 inputs. Never silently discard the last
 // Excel rows: keep the highest-reference-kcal candidates per category and
 // make any negative result conditional on this bounded subset.
 const sorted=[...catalog.recipes].sort((a,b)=>Number(b.caloriesPerDeclaredServing)-Number(a.caloriesPerDeclaredServing)
  ||(a.recipeId<b.recipeId?-1:a.recipeId>b.recipeId?1:0));
 const reserved=new Set<string>();
 for(const category of categories){
  for(const candidate of sorted.filter(r=>r.sourceCategory===category).slice(0,8))reserved.add(candidate.recipeId);
 }
 const recipes=[...sorted.filter(r=>reserved.has(r.recipeId)),
  ...sorted.filter(r=>!reserved.has(r.recipeId))].slice(0,128);
 const hasDinner=catalog.recipes.some(r=>r.sourceCategory==='DINNER');
 const scenario={dailyCalorieTarget,tolerancePercent:15,maxRecipeUses:7,
  slots:[
   {label:'BREAKFAST',sourceCategories:['BREAKFAST']},
   {label:'LUNCH',sourceCategories:['LUNCH']},
   {label:'DINNER',sourceCategories:hasDinner?['DINNER']:['LUNCH']},
   {label:'SNACK',sourceCategories:['SNACK']}
  ]};
 const capacity=analyzeWeekInputCalorieCapacityV1(recipes,scenario);
 // The existing complete-week search accepts at most 32 inputs. Prefer
 // target-proximate authoring candidates instead of arbitrary alphabetical
 // or always-highest-kcal choices (which can miss low-calorie target weeks).
 // This remains an incomplete subset search, NOT an eligibility decision.
 const perSlotTarget=dailyCalorieTarget/scenario.slots.length;
 const byCategory=(category:string,count:number)=>recipes.filter(r=>r.sourceCategory===category)
   .sort((a,b)=>Math.abs(Number(a.caloriesPerDeclaredServing)-perSlotTarget)
     -Math.abs(Number(b.caloriesPerDeclaredServing)-perSlotTarget)
     ||(a.recipeId<b.recipeId?-1:a.recipeId>b.recipeId?1:0)).slice(0,count);
 const dinnerCount=hasDinner?Math.min(8,recipes.filter(r=>r.sourceCategory==='DINNER').length):0;
 const witnessInputs=[
   ...byCategory('BREAKFAST',8),
   ...byCategory('LUNCH',16-dinnerCount),
   ...byCategory('DINNER',dinnerCount),
   ...byCategory('SNACK',8)
 ];
 const witness=witnessInputs.length===32 && capacity.status==='NECESSARY_CALORIE_BOUND_PASSED_NOT_FEASIBILITY'
   ?findCompleteInputWeekWitnessV1(witnessInputs,{...scenario,weekStart},
      {maxDayCandidates:25000,maxWeekNodes:30000})
   :null;
 return {contract:'potok-master-excel-week-capacity-preview-v1',
  catalog:{authoringRecipes:catalog.authoringRecipes,usableRecipes:catalog.usableRecipes,
   excluded:catalog.excluded,statusCounts:catalog.statusCounts,consideredRecipes:recipes.length,
   omittedByExistingCheckerLimit:catalog.recipes.length-recipes.length,
   capacityBoundIsFullCatalog:catalog.recipes.length<=128},
  scenario,weekStart,capacity,offlineWeekWitness:witness,
  witnessInputRecipeIds:witnessInputs.map(r=>r.recipeId),
  witnessSubsetLimitedTo32:true,
  witnessSubsetSelection:'TARGET_PROXIMATE_REFERENCE_KCAL_PER_CATEGORY_WITH_STABLE_ID_TIEBREAK',
  dinnerUsesLunchFallback:!hasDinner,
  witnessDinnerRecipeCount:dinnerCount,
  witnessNegativeResultDoesNotProveFullCatalogInfeasibility:true,
  capacityNegativeResultDoesNotProveFullCatalogInfeasibility:catalog.recipes.length>128,
  witnessSkippedReason:witness===null?(witnessInputs.length!==32?'INSUFFICIENT_CATEGORY_INPUTS':'WEEK_CALORIE_CAPACITY_ALREADY_FAILED'):null,
  source:'OWNER_MASTER_EXCEL_REFERENCE_ONLY',
  dinnerFallback:hasDinner?'NONE_EXPLICIT_DINNER_CATEGORY':'LUNCH_ALLOWED_FOR_OFFLINE_PREVIEW_ONLY',
  personalMacrosAndAllergensChecked:false,portionScaling:false,
  sourceApproved:false,runtimePublishable:false,canApply:false,mayActivate:false};
}
if(process.argv[1]&&import.meta.url===pathToFileURL(process.argv[1]).href){
 if(process.argv.length!==4&&process.argv.length!==5)invalid('usage: XLSX_PATH DAILY_KCAL [WEEK_START_YYYY-MM-DD]');
 const target=Number(process.argv[3]);
 process.stdout.write(JSON.stringify(previewMasterExcelWeekCapacityV1(readFileSync(process.argv[2]),target,process.argv[4]??'2026-11-09'),null,2)+'\n');
}
