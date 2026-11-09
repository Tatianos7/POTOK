/** Synthetic contract fixture only. Not a real recipe, identity or reviewed input. */
export function referenceWeekFixture(target = 1600) {
  const source = {fileName:'synthetic.xlsx', sha256:'a'.repeat(64), bytes:1};
  const slots = ['Завтрак','Обед','Ужин','Перекус'];
  const nutrition = {calories:target/4, protein:20, fat:10, carbs:50, fiber:4};
  const recipes = Array.from({length:28}, (_,i) => ({
    recipeId:`synthetic-${i}`, name:`Тестовое блюдо ${i}`, sourceStatus:'READY_FOR_REVIEW',
    sourceRecipe:{recipe_id:`synthetic-${i}`, meal_type_primary:'LUNCH'},
    runtimePublishable:false, measuredYieldG:null, confirmedServings:null, declaredYieldG:null, declaredServings:2,
    physicalReview:'DEFERRED_UNTIL_OWNER_PRELAUNCH_TESTING', numericReferenceTestInputAvailable:true, sourceTagsAreVerifiedRestrictions:false,
    referenceNutrition:{verified:false,basis:'SOURCE_DECLARED_PER_SERVING',carbohydrateSemantics:'UNVERIFIED_SOURCE_REFERENCE',values:{...nutrition}},
    ingredients:[{recipe_id:`synthetic-${i}`,ingredient_row_id:`i-${i}`,sort_order:1,ingredient_name_ru:'Тестовый ингредиент',amount:null,unit:null,weight_g:null,optional:false,preparation_note:null,notes:null}],
    steps:[{recipe_id:`synthetic-${i}`,step_id:`s-${i}`,step_number:1,instruction_ru:'Тестовый шаг приготовления.',duration_min:null,temperature_c:null,notes:null}],
  }));
  return {contract:'potok-staging-real-reference-week-v1',mode:'REFERENCE_MENU_TEST_NOT_ACTIVE_PLAN',
    noDatabaseWrites:true,verifiedNutrition:false,mayActivate:false,notPersonalized:true,omittedAuthorNotes:true,
    sourceRecipeCount:28,eligibleReferenceRecipes:28,
    calorieCapacity:{status:'REQUIRED_WEEK_MINIMUM_NOT_PROVEN',requiredWeekKcal:((target-50)*7).toFixed(3),optimisticMaximumWeekKcal:null,provenWeekShortfallKcal:null},
    catalog:{contract:'potok-recipe-authoring-test-catalog-v1',usage:'OFFLINE_AUTHORING_TEST_INPUT_ONLY',runtimePublishable:false,mayActivate:false,referenceNutritionMustNotBePresentedAsVerified:true,physicalCookingBlocksDevelopment:false,source,recipes},
    report:{contract:'potok-recipe-authoring-week-preview-v1',runtimePublishable:false,mayActivate:false,
      usage:'OFFLINE_UNVERIFIED_REFERENCE_EXPERIMENT',portionBasis:'ONE_SOURCE_DECLARED_SERVING_NO_SCALING',physicalReview:'DEFERRED_UNTIL_OWNER_PRELAUNCH_TESTING',
      status:'REFERENCE_WEEK_PREVIEW',scope:'BEST_IN_RETAINED_POOL',source,
      scenario:{dailyCalorieTarget:target,maxRecipeUses:2,weekStart:'2026-11-09',slots:slots.map(label=>({label}))},
      calorieCorridor:{contract:'potok-reference-calorie-corridor-v1',minimumKcal:target-50,maximumKcal:target+50},
      assumptions:slots.map(slot=>({slot,sourceCategories:['LUNCH'],applicabilityVerified:false})),notAssessed:['ALLERGENS'],
      days:Array.from({length:7},(_,day)=>({date:`2026-11-${String(day+9).padStart(2,'0')}`,
        referenceNutrition:Object.fromEntries(Object.entries(nutrition).map(([k,v])=>[k,(v*4).toFixed(3)])),
        meals:slots.map((slot,s)=>({slot,recipeId:recipes[day*4+s].recipeId,name:recipes[day*4+s].name,
          sourcePrimaryCategory:'LUNCH',sourceDeclaredServings:2,assignedSourceServings:1,measuredGrams:null,verified:false,referenceNutrition:{...nutrition}}))})),
    }};
}
