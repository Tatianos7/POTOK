import {createHash} from 'node:crypto';
import {readFileSync} from 'node:fs';
import {pathToFileURL} from 'node:url';
import {isDeepStrictEqual} from 'node:util';
import {assertRawJsonWithoutDuplicateKeysV1} from '../../src/utils/adaptiveNutritionWireV1';
import {recipeMasterSheetsV1} from './recipe-master-readiness-v1';
import {buildRecipeAuthoringTestCatalogV1} from './recipe-authoring-test-catalog-v1';
import {buildRecipeIngredientReviewQueueV1} from './recipe-master-review-queue-v1';

type Catalog=ReturnType<typeof buildRecipeAuthoringTestCatalogV1> & {source:{fileName:string;sha256:string;bytes:number}};
const hash=(raw:string)=>createHash('sha256').update(raw).digest('hex');
const text=(v:unknown):v is string=>typeof v==='string'&&v.trim().length>0;
const positive=(v:unknown)=>typeof v==='number'&&Number.isFinite(v)&&v>0;
function parse(raw:string){
  if(typeof raw!=='string'||Buffer.byteLength(raw)>10_000_000)throw Error('PILOT_REVIEW_INPUT_TOO_LARGE');
  assertRawJsonWithoutDuplicateKeysV1(raw);return JSON.parse(raw);
}

/** Offline preparation, not a publication adapter. Hashes identify bytes, not review authority. */
export function buildRecipePilotReviewPacketV1(catalogRaw:string,selectionRaw:string){
  const catalog=parse(catalogRaw) as Catalog,selection=parse(selectionRaw);
  if(!catalog||catalog.contract!=='potok-recipe-authoring-test-catalog-v1'||catalog.runtimePublishable!==false
    ||catalog.mayActivate!==false||catalog.physicalCookingBlocksDevelopment!==false
    ||catalog.referenceNutritionMustNotBePresentedAsVerified!==true||!Array.isArray(catalog.recipes)
    ||catalog.recipes.length>512||!text(catalog.source?.fileName)||!/^[a-f0-9]{64}$/.test(catalog.source?.sha256)
    ||!Number.isSafeInteger(catalog.source?.bytes)||catalog.source.bytes<=0)throw Error('PILOT_REVIEW_INVALID_CATALOG');
  if(!selection||selection.contract!=='potok-recipe-pilot-selection-v1'||selection.workbookSha256!==catalog.source.sha256
    ||!text(selection.origin)||!Array.isArray(selection.recipeIds)||selection.recipeIds.length<1||selection.recipeIds.length>64
    ||selection.recipeIds.some((id:unknown)=>!text(id))||new Set(selection.recipeIds).size!==selection.recipeIds.length)
    throw Error('PILOT_REVIEW_INVALID_SELECTION');
  // Rebuild observations from original rows instead of trusting copied readiness flags.
  const sheets:Record<string,Record<string,unknown>[]>=Object.fromEntries(recipeMasterSheetsV1.map(n=>[n,[]]));
  for(const r of catalog.recipes){
    if(!r||!r.sourceRecipe||!Array.isArray(r.ingredients)||!Array.isArray(r.steps)||!Array.isArray(r.tags))throw Error('PILOT_REVIEW_INVALID_RECIPE');
    sheets['01_Рецепты'].push(r.sourceRecipe);sheets['02_Ингредиенты'].push(...r.ingredients);
    sheets['03_Шаги'].push(...r.steps);sheets['04_Теги'].push(...r.tags);
  }
  if(sheets['02_Ингредиенты'].length>8192)throw Error('PILOT_REVIEW_TOO_MANY_INGREDIENTS');
  const rebuilt=buildRecipeAuthoringTestCatalogV1(sheets);
  if(!isDeepStrictEqual(rebuilt.recipes,catalog.recipes))throw Error('PILOT_REVIEW_SOURCE_OBSERVATION_MISMATCH');
  const byId=new Map(rebuilt.recipes.map(r=>[r.recipeId,r]));
  const recipes=(selection.recipeIds as string[]).map(id=>{const r=byId.get(id);if(!r)throw Error('PILOT_REVIEW_UNKNOWN_RECIPE');return structuredClone(r);});
  const ingredients=recipes.flatMap(r=>r.ingredients);
  const mealCategoryCounts:Record<string,number>={};
  for(const r of recipes){const k=String(r.sourceRecipe.meal_type_primary??'UNSPECIFIED');mealCategoryCounts[k]=(mealCategoryCounts[k]??0)+1;}
  return {contract:'potok-recipe-pilot-review-packet-v1',usage:'OFFLINE_SOURCE_REVIEW_PREPARATION_ONLY',
    runtimePublishable:false,mayActivate:false,physicalCookingBlocksDevelopment:false,
    status:'BLOCKED_INDEPENDENT_RUNTIME_EVIDENCE_REQUIRED',
    provenance:{workbook:structuredClone(catalog.source),catalogBytesSha256:hash(catalogRaw),selectionBytesSha256:hash(selectionRaw),
      selectionOrigin:selection.origin,hashesDoNotProveReview:true},
    summary:{catalogRecipes:rebuilt.recipes.length,selectedRecipes:recipes.length,ingredientRows:ingredients.length,
      numericReferenceInputs:recipes.filter(r=>r.numericReferenceTestInputAvailable).length,
      unresolvedIngredientRows:ingredients.filter(r=>r.canonical_status!=='RESOLVED').length,
      missingStableFoodIds:ingredients.filter(r=>!text(r.food_stable_id)).length,
      missingRecordedIngredientGrams:ingredients.filter(r=>!positive(r.weight_g)).length,
      missingDeclaredServings:recipes.filter(r=>!positive(r.declaredServings)).length,
      missingRecordedYield:recipes.filter(r=>!positive(r.declaredYieldG)).length,sourcePrimaryMealCategories:mealCategoryCounts},
    requiredIndependentReviews:['CANONICAL_FOOD_OR_APPROVED_NONFOOD_BINDINGS','INGREDIENT_STATE_QUANTITY_AND_CONVERSIONS',
      'NUTRITION_WITH_SEPARATE_FIBER_AND_CARBOHYDRATE_SEMANTICS','ALLERGEN_AND_DIETARY_EVIDENCE',
      'PORTION_RULES_AND_COMPOSITION_ELIGIBILITY','MEAL_APPLICABILITY_AND_REPEAT_FAMILIES','PINNED_RUNTIME_PUBLICATION_EVIDENCE'],
    deferredUntilOwnerPrelaunchTesting:['PHYSICAL_COOKING','MEASURED_FINISHED_YIELD','PRACTICAL_PORTIONS'],
    requestPreparationStillRequired:['REAL_ACCOUNT_AUTH_GOAL_PREFERENCES_SAFETY','PINNED_GENERATION_AND_VALIDATION_POLICIES',
      'REQUEST_BOUND_PREPARATION_VALIDATION_AND_WARNING_SOURCES','SPECIFIC_STAGING_WRITE_PACKAGE'],
    ingredientReviewQueue:buildRecipeIngredientReviewQueueV1(ingredients),recipes};
}
if(process.argv[1]&&import.meta.url===pathToFileURL(process.argv[1]).href){
  if(process.argv.length!==4)throw Error('Usage: node --import tsx scripts/contracts/recipe-pilot-review-packet-v1.ts CATALOG.json SELECTION.json');
  process.stdout.write(JSON.stringify(buildRecipePilotReviewPacketV1(readFileSync(process.argv[2],'utf8'),readFileSync(process.argv[3],'utf8')),null,2)+'\n');
}
