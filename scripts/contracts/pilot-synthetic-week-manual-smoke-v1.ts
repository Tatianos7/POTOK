/** Self-contained local smoke demonstration of the already-built week search.
 * Entire catalogue is SYNTHETIC, never actual POTOK food, source or publication.
 * No Supabase connection, persistent storage, user data or worker activation.
 */
import {pathToFileURL} from 'node:url';
import {buildRecipeAuthoringTestCatalogV1} from './recipe-authoring-test-catalog-v1';
import {recipeMasterSheetsV1} from './recipe-master-readiness-v1';
import {previewRecipeAuthoringWeekV1, type AuthoringWeekScenarioV1} from './recipe-authoring-week-preview-v1';

export function runSyntheticWeekManualSmokeV1(){
 const sheets:Record<string,Record<string,unknown>[]>=Object.fromEntries(recipeMasterSheetsV1.map(k=>[k,[]]));
 for(const [category,kcal] of [['BREAKFAST',500],['LUNCH',600],['SNACK',300]] as const){
  for(let n=0;n<12;n++){
   const id='DEMO_'+category+'_'+String(n+1).padStart(2,'0');
   sheets['01_Рецепты'].push({recipe_id:id,name_ru:'Демонстрационный '+category+' '+(n+1),
    status:'READY_FOR_REVIEW',servings:2,total_weight_g:null,meal_type_primary:category,
    ref_kcal_per_serving:kcal,ref_protein_g:10,ref_fat_g:5,ref_carbs_g:30,ref_fiber_g:2});
   sheets['02_Ингредиенты'].push({recipe_id:id,ingredient_row_id:id+'_ING_01',
    ingredient_name_ru:'SYNTHETIC — NOT REAL FOOD',weight_g:20,canonical_status:'UNRESOLVED'});
  }
 }
 const scenario:AuthoringWeekScenarioV1={contract:'potok-authoring-week-scenario-v1',
  weekStart:'2026-11-09',dailyCalorieTarget:2000,tolerancePercent:10,
  slots:[{label:'Завтрак',sourceCategories:['BREAKFAST'],targetSharePercent:25},
   {label:'Обед',sourceCategories:['LUNCH'],targetSharePercent:30},
   {label:'Ужин (демо из обеденной категории)',sourceCategories:['LUNCH'],targetSharePercent:30},
   {label:'Перекус',sourceCategories:['SNACK'],targetSharePercent:15}],
  rankedCandidatePoolSize:12,shortlistPerSlot:4,dayPoolSize:4,
  maxDayEvaluations:256,maxWeekEvaluations:1024,maxRecipeUses:2};
 const catalog=buildRecipeAuthoringTestCatalogV1(sheets);
 const preview=previewRecipeAuthoringWeekV1(catalog,scenario);
 const result={contract:'potok-synthetic-week-manual-smoke-v1',usage:'LOCAL_SYNTHETIC_DEMO_ONLY',
  dataset:'36 SYNTHETIC recipes; values are only arithmetic fixtures',
  status:preview.status,days:preview.days,
  generatedByRealSelectionAlgorithm:true,referenceValuesOnly:true,
  servingsNotVerified:true,realFoodDataUsed:false,sourceApproved:false,
  databaseWrites:0,stagingConnection:false,workerEnabled:false,
  readyForServerSubmission:false,runtimePublishable:false,mayActivate:false};
 return result;
}
if(process.argv[1]&&import.meta.url===pathToFileURL(process.argv[1]).href){
 if(process.argv.length!==2)throw Error('Usage: node --import tsx scripts/contracts/pilot-synthetic-week-manual-smoke-v1.ts');
 const r=runSyntheticWeekManualSmokeV1();
 process.stdout.write(JSON.stringify(r,null,2)+'\n');
 if(r.status!=='REFERENCE_WEEK_PREVIEW'||r.days.length!==7)process.exitCode=1;
}
