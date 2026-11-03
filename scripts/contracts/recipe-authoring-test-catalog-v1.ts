import {pathToFileURL} from 'node:url';
import {inspectRecipeMasterRowsV1,readRecipeMasterSheetsV1} from './recipe-master-readiness-v1';

type Row=Record<string,unknown>;
const numeric=(x:unknown)=>typeof x==='number'&&Number.isFinite(x)&&x>=0;
const positive=(x:unknown)=>numeric(x)&&(x as number)>0;
const axes={calories:'ref_kcal_per_serving',protein:'ref_protein_g',fat:'ref_fat_g',carbs:'ref_carbs_g',fiber:'ref_fiber_g'} as const;

/** Authoring data for offline development. Never a runtime manifest or trusted acceptance input. */
export function buildRecipeAuthoringTestCatalogV1(sheets:Record<string,Row[]>){
  const observation=inspectRecipeMasterRowsV1(sheets);
  if(observation.summary.orphanIngredients)throw new Error('TEST_CATALOG_ORPHAN_INGREDIENTS');
  const allIds=new Set(sheets['01_Рецепты'].map(r=>r.recipe_id));
  for(const [sheet,key] of [['02_Ингредиенты','ingredient_row_id'],['03_Шаги','step_id']] as const){
    const seen=new Set<unknown>();
    for(const row of sheets[sheet]){
      if(!row[key]&&!row.recipe_id)continue;
      if(typeof row[key]!=='string'||!row[key]||seen.has(row[key]))throw new Error('TEST_CATALOG_INVALID_CHILD_ID');
      seen.add(row[key]);if(!allIds.has(row.recipe_id))throw new Error('TEST_CATALOG_ORPHAN_CHILD');
    }
  }
  for(const row of sheets['04_Теги'])if(row.recipe_id&&!allIds.has(row.recipe_id))throw new Error('TEST_CATALOG_ORPHAN_TAG');
  const recipes=observation.recipes.map(observed=>{
    const source=sheets['01_Рецепты'].find(r=>r.recipe_id===observed.recipeId)!;
    const issues:string[]=[];
    if(!positive(source.servings))issues.push('DECLARED_SERVINGS_MISSING_OR_INVALID');
    for(const [axis,column] of Object.entries(axes))if(!numeric(source[column]))issues.push('REFERENCE_'+axis.toUpperCase()+'_MISSING_OR_INVALID');
    if(!observed.ingredientCount)issues.push('INGREDIENTS_MISSING');
    if(source.status==='BLOCKED')issues.push('SOURCE_EXPLICITLY_BLOCKED');
    return {
      recipeId:observed.recipeId,name:observed.name,sourceStatus:observed.status,
      sourceRecipe:structuredClone(source),
      declaredServings:source.servings??null,declaredYieldG:source.total_weight_g??null,
      measuredYieldG:null,confirmedServings:null,physicalReview:'DEFERRED_UNTIL_OWNER_PRELAUNCH_TESTING',
      referenceNutrition:{basis:'SOURCE_DECLARED_PER_SERVING',verified:false,
        carbohydrateSemantics:'UNVERIFIED_SOURCE_REFERENCE',
        values:Object.fromEntries(Object.entries(axes).map(([axis,column])=>[axis,source[column]??null]))},
      ingredients:structuredClone(sheets['02_Ингредиенты'].filter(r=>r.recipe_id===observed.recipeId)),
      steps:structuredClone(sheets['03_Шаги'].filter(r=>r.recipe_id===observed.recipeId)),
      tags:structuredClone(sheets['04_Теги'].filter(r=>r.recipe_id===observed.recipeId)),
      numericReferenceTestInputAvailable:issues.length===0,referenceTestIssues:issues,
      pendingReview:observed.issues,sourceTagsAreVerifiedRestrictions:false,runtimePublishable:false,
    };
  });
  return {contract:'potok-recipe-authoring-test-catalog-v1',usage:'OFFLINE_AUTHORING_TEST_INPUT_ONLY',
    physicalCookingBlocksDevelopment:false,runtimePublishable:false,mayActivate:false,
    referenceNutritionMustNotBePresentedAsVerified:true,
    summary:{recipes:recipes.length,excludedExamples:observation.summary.excludedExamples,
      numericReferenceTestInputs:recipes.filter(r=>r.numericReferenceTestInputAvailable).length,
      deferredPhysicalReviews:recipes.length,missingDeclaredServings:observation.summary.missingServings,
      missingRecordedYield:observation.summary.missingRecordedYield},recipes};
}

export function readRecipeAuthoringTestCatalogV1(path:string){
  const {sheets,source}=readRecipeMasterSheetsV1(path);
  return {...buildRecipeAuthoringTestCatalogV1(sheets),source};
}
if(process.argv[1]&&import.meta.url===pathToFileURL(process.argv[1]).href){
  if(process.argv.length!==3)throw new Error('Usage: node --import tsx scripts/contracts/recipe-authoring-test-catalog-v1.ts INPUT.xlsx');
  process.stdout.write(JSON.stringify(readRecipeAuthoringTestCatalogV1(process.argv[2]),null,2)+'\n');
}
