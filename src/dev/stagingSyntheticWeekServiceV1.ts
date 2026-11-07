/** Synthetic, server-only walkthrough of the existing authoring selection engine.
 * NEVER a canonical plan, verified nutrition, prescription, or DB payload.
 */
import {previewRecipeAuthoringWeekV1, type AuthoringWeekScenarioV1, type AuthoringSearchCatalogV1} from './authoringWeekSearchV1';

export const syntheticStagingWeekContractV1='potok-staging-synthetic-week-v1' as const;

const blocks=[
  {category:'BREAKFAST',kcal:500,label:'Завтрак'},
  {category:'LUNCH',kcal:600,label:'Обед/ужин'},
  {category:'SNACK',kcal:300,label:'Перекус'},
] as const;

function scenario(weekStart:string):AuthoringWeekScenarioV1 {
  return {contract:'potok-authoring-week-scenario-v1',weekStart,dailyCalorieTarget:2000,tolerancePercent:10,
    slots:[
      {label:'Завтрак',sourceCategories:['BREAKFAST'],targetSharePercent:25},
      {label:'Обед',sourceCategories:['LUNCH'],targetSharePercent:30},
      {label:'Ужин (тестовая категория LUNCH)',sourceCategories:['LUNCH'],targetSharePercent:30},
      {label:'Перекус',sourceCategories:['SNACK'],targetSharePercent:15},
    ],rankedCandidatePoolSize:12,shortlistPerSlot:4,dayPoolSize:4,maxDayEvaluations:256,
    maxWeekEvaluations:1024,maxRecipeUses:2};
}

/** Fixed reference-only values. No food source or user preferences are accessed. */
export function buildSyntheticStagingWeekV1(weekStart='2026-11-09') {
  const recipes:AuthoringSearchCatalogV1['recipes']=[];
  for (const block of blocks) for(let i=1;i<=12;i++){
    const n=String(i).padStart(2,'0');
    recipes.push({
      recipeId:'SYNTH_'+block.category+'_'+n,
      name:'Тестовый вариант '+block.label+' №'+n+' (НЕ РЕЦЕПТ)',
      sourceStatus:'READY_FOR_REVIEW',declaredServings:2,numericReferenceTestInputAvailable:true,
      sourceRecipe:{meal_type_primary:block.category},
      referenceNutrition:{values:{calories:block.kcal,protein:10,fat:5,carbs:30,fiber:2}}
    });
  }
  const catalog:AuthoringSearchCatalogV1={
    contract:'potok-recipe-authoring-test-catalog-v1',runtimePublishable:false,
    source:{fileName:'synthetic-staging-fixture-NOT_REAL_FOOD',sha256:'a'.repeat(64),bytes:1},
    recipes
  };
  const result=previewRecipeAuthoringWeekV1(catalog,scenario(weekStart));
  if(result.status!=='REFERENCE_WEEK_PREVIEW'||result.days.length!==7)throw Error('SYNTHETIC_WEEK_NOT_FOUND');
  // Deliberately narrow output; no authoring details or useable serving recommendations.
  return {contract:syntheticStagingWeekContractV1,
    mode:'SYNTHETIC_TEST_ONLY' as const,
    engine:'existing-authoring-week-search-v1',
    noDatabaseWrites:true,verifiedNutrition:false,realRecipes:false,mayActivate:false,
    notPersonalized:true, targetIsArithmeticFixture:true,
    days:result.days.map(d=>({date:d.date,referenceCalories:Number(d.referenceNutrition.calories),
      meals:d.meals.map(m=>({slot:m.slot,syntheticId:m.recipeId,label:m.name,
        referenceCalories:Number(m.referenceNutrition.calories)}))})),
  };
}
