import {createHash} from 'node:crypto';
import {readFileSync} from 'node:fs';
import {pathToFileURL} from 'node:url';
import {assertRawJsonWithoutDuplicateKeysV1} from '../../src/utils/adaptiveNutritionWireV1';
import {decodeAuthoringRecipeCatalog,authoringSearchInput} from '../../src/dev/authoringRecipeCatalog';
import {previewRecipeAuthoringWeekV1,type AuthoringSearchCatalogV1,type AuthoringWeekScenarioV1} from '../../src/dev/authoringWeekSearchV1';
import {calculateCompleteConditionalRecipeInputV1,evaluateRecipeRecalculationV1,readDairyPrimaryRawV1,validateDairyPrimaryV1,type ConditionalRecipeInputV1} from './recipe-recalculation-gate-v1';
import {deriveAvailableCarbohydrateCandidateV1} from './three-food-source-candidates-v1';

// Four-task acceptance: exact dairy options without selecting a replacement;
// four row/context-bound reviews; separate complete conditional input arithmetic;
// actual model-only week search with explicit missing-category/capacity diagnostics.
// No report file, recipe mutation, runtime admission or source-approval event.
type Obj=Record<string,unknown>;
type Facts=Record<'calories'|'protein'|'fat'|'totalCarbohydrate'|'fiber',string>;
const axes=['calories','protein','fat','totalCarbohydrate','fiber'] as const;
const ids=['greek_yogurt_apple','greek_yogurt_banana'];
const modelOption='MODEL_USDA_SR28_01287_PLAIN_LOWFAT';
const root='docs/premium/retained-sources/';
const reviewPath=root+'greek-snack-input-model-20261105/declared-input-review-v1.json';
const paths={capture:root+'pilot-source-stage-20261104/sr28-ascii-capture-v1.json',
  dairy:root+'dairy-primary-recheck-20261105/source-recheck-v1.json',api:root+'dairy-primary-recheck-20261105/fdc-170903-primary-response.json',
  produce:root+'produce-review-20261104/source-candidates-v1.json',banana:root+'produce-review-20261104/sr28-09040-facts.txt',
  policy:root+'p5-03/source-review-package-v1.json',apple:root+'p5-03/apple-usda-sr27-ndb-09003.txt',
  definition:root+'p5-03/usda-carbohydrate-definition.txt',target:root+'p5-03/eaeu-carbohydrate-fiber-excerpt.txt'};
const hash=(s:string)=>createHash('sha256').update(s).digest('hex');
function invalid():never{throw Error('INVALID_GREEK_SNACK_INPUT_MODEL');}
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
function facts(v:unknown):Facts{const f=obj(v);if(Object.keys(f).length!==5)invalid();axes.forEach(a=>minor(f[a]));return f as Facts;}
function offline(v:unknown){if(!v||typeof v!=='object')return;if(Array.isArray(v)){v.forEach(offline);return;}
  for(const [k,x] of Object.entries(v)){
    if(['sourceApproved','foodSpecificMappingApproved','runtimePublishable','canApply','mayActivate'].includes(k)&&x!==false)invalid();
    if(['ownerDecision','selectedOption'].includes(k)&&x!==null)invalid();offline(x);
  }
}
export interface GreekSnackModelEvidenceV1{reviewRaw:string;materials:Record<string,string>}
export function readGreekSnackModelEvidenceV1():GreekSnackModelEvidenceV1{
  const read=(path:string)=>readFileSync(new URL('../../'+path,import.meta.url),'utf8');
  return {reviewRaw:read(reviewPath),materials:Object.fromEntries(Object.values(paths).map(path=>[path,read(path)]))};
}
function sourceCandidates(e:GreekSnackModelEvidenceV1){
  const policyPackage=parse(e.materials[paths.policy]),policy=obj(policyPackage.carbsMappingPolicy);
  if(policy.version!=='potok-source-total-including-fiber-to-available-v1'||policy.requireSameIdentityStateBasisUnits!==true
    ||policy.requireExplicitIncludesFiber!==true||policy.calories!=='PRESERVE_SOURCE_NO_4_9_4')invalid();
  const capture=parse(e.materials[paths.capture]),yogurt=list(capture.records).map(obj).find(r=>r.ndb==='01287');if(!yogurt)invalid();
  const api=validateDairyPrimaryV1({...readDairyPrimaryRawV1(),[paths.api]:e.materials[paths.api],[paths.dairy]:e.materials[paths.dairy]}).find(r=>r.fdcId===170903);
  if(!api||api.ndb!=='01287'||api.description!==yogurt.description)invalid();
  const yf=facts(yogurt.factsPer100GEdible);for(const a of axes)if(minor(yf[a])!==minor(api.factsPer100GEdible[a]))invalid();
  const apple=list(policyPackage.products).map(obj).find(r=>r.stableFoodId==='apple');if(!apple)invalid();
  const as=obj(apple.source),af=obj(apple.sourceFactsPer100GEdible);
  if(as.retainedPath!==paths.apple||as.retainedBytesSha256!==hash(e.materials[paths.apple])||af.carbsDefinition!=='TOTAL_CARBOHYDRATE_BY_DIFFERENCE_INCLUDING_FIBER')invalid();
  const appleFacts=facts({calories:af.caloriesKcal,protein:af.proteinG,fat:af.fatG,totalCarbohydrate:af.carbsG,fiber:af.fiberG});
  const appleText=e.materials[paths.apple];
  for(const [label,a,unit] of [['Energy','calories','kcal'],['Protein (N x 6.25)','protein','g'],['Total lipid (fat)','fat','g'],
    ['Carbohydrate, by difference','totalCarbohydrate','g'],['Fiber, total dietary','fiber','g']] as const)
    if(!appleText.includes(label+': '+appleFacts[a]+' '+unit))invalid();
  if(!appleText.includes('NDB No. 09003')||!appleText.includes('Amount in 100 grams of edible portion'))invalid();
  const produce=parse(e.materials[paths.produce]),banana=list(produce.groups).map(obj).find(g=>obj(g.source).record==='NDB09040');if(!banana)invalid();
  const bs=obj(banana.source),bananaFacts=facts(bs.factsPer100GEdible);
  if(bs.capturePath!=='sr28-09040-facts.txt'||bs.captureSha256!==hash(e.materials[paths.banana])
    ||!list(banana.rows).map(obj).some(r=>r.ingredientRowId==='greek_yogurt_banana_ing_02'))invalid();
  for(const [label,a,unit] of [['Energy','calories','kcal'],['protein','protein','g'],['fat','fat','g'],
    ['carbohydrate by difference','totalCarbohydrate','g'],['total dietary fiber','fiber','g']] as const)
    if(!e.materials[paths.banana].includes(label+' '+bananaFacts[a]+' '+unit))invalid();
  const definitions=list(policyPackage.additionalRetainedSources).map(obj);
  for(const p of [paths.definition,paths.target]){const source=definitions.find(s=>s.retainedPath===p);if(!source||source.sha256!==hash(e.materials[p]))invalid();}
  const records={GREEK_YOGURT:{record:'USDA_SR28_NDB01287',state:'PLAIN_LOWFAT_GREEK_SOURCE_CLASS_ONLY',facts:yf},
    RAW_APPLE_WITH_SKIN:{record:'USDA_SR27_NDB09003',state:'RAW_WITH_SKIN_CORE_STEM_EXCLUDED',facts:appleFacts},
    RAW_BANANA_PEELED:{record:'USDA_SR28_NDB09040',state:'RAW_EDIBLE_PULP_PEEL_EXCLUDED',facts:bananaFacts}};
  return Object.fromEntries(Object.entries(records).map(([role,r])=>{
    const binding=r.record+':'+r.state+':PER_100_G_EDIBLE',mapped=deriveAvailableCarbohydrateCandidateV1(JSON.stringify({
      sourceTotalCarbohydrateG:r.facts.totalCarbohydrate,sourceDietaryFiberG:r.facts.fiber,sourceDefinition:'TOTAL_CARBOHYDRATE_BY_DIFFERENCE_INCLUDING_FIBER',
      carbohydrateBinding:binding,fiberBinding:binding,carbohydrateUnit:'g',fiberUnit:'g',basis:'PER_100_G_EDIBLE'}));
    return [role,{sourceBinding:binding,facts:{calories:r.facts.calories,protein:r.facts.protein,fat:r.facts.fat,carbs:mapped.availableCarbohydrateG,fiber:r.facts.fiber}}];
  }));
}

/** Offline test/composition seam. The normal entry additionally pins the #321 bytes via #322.
 * A source-class model is NOT a choice of product for the owner's generic 2% recipe. */
export function buildGreekSnackDeclaredModelV1(catalogRaw:string,e:GreekSnackModelEvidenceV1){
  const catalog=parse(catalogRaw),decoded=decodeAuthoringRecipeCatalog(catalog),review=parse(e.reviewRaw);offline(review);
  if(review.contract!=='potok-two-greek-snack-declared-input-review-v1'||review.status!=='DECLARED_INPUT_REVIEW_WITH_UNSELECTED_DAIRY_MODEL'
    ||review.selectedOption!==null||review.ownerDecision!==null||[review.sourceApproved,review.runtimePublishable,review.canApply,review.mayActivate].some(v=>v!==false))invalid();
  const materials=list(review.sourceMaterials).map(obj),expectedPaths=Object.values(paths);
  if(materials.length!==expectedPaths.length||new Set(materials.map(m=>m.path)).size!==expectedPaths.length
    ||materials.some(m=>!expectedPaths.includes(String(m.path))||hash(e.materials[String(m.path)])!==m.sha256))invalid();
  const options=list(review.classOptions).map(obj);
  if(options.length!==2||options[0].optionId!=='KEEP_DECLARED_GENERIC_GREEK_2_PERCENT'||options[0].sourceRecord!==null
    ||options[0].status!=='BLOCKED_EXACT_CLASS_SOURCE_APPLICABILITY'
    ||options[1].status!=='CONDITIONAL_SCENARIO_ONLY_NOT_RECIPE_SUBSTITUTION'
    ||options[1].optionId!==modelOption||options[1].sourceRecord!=='USDA_SR28_NDB01287'||options[1].apiCorroborationFdcId!==170903)invalid();
  const annotations=list(review.rows).map(obj);
  if(annotations.length!==4||new Set(annotations.map(a=>a.ingredientRowId)).size!==4)invalid();
  const sources=sourceCandidates(e),originals=list(catalog.recipes).map(obj);
  const recipes=ids.map(id=>{
    const original=originals.find(r=>r.recipeId===id),view=decoded.recipes.get(id);if(!original||!view)invalid();
    const rawRows=list(original.ingredients).map(obj);if(rawRows.length!==2)invalid();
    const rows=rawRows.map(raw=>{
      const rowId=String(raw.ingredient_row_id),a=annotations.find(a=>a.ingredientRowId===rowId);
      const role=rowId===id+'_ing_01'?'GREEK_YOGURT':rowId===id+'_ing_02'?(id==='greek_yogurt_apple'?'RAW_APPLE_WITH_SKIN':'RAW_BANANA_PEELED'):invalid();
      if(!a||a.recipeId!==id||a.role!==role||a.sourceAuthoringRowSha256!==hash(canonical(raw))
        ||a.recipeContextSha256!==hash(canonical({sourceRecipe:original.sourceRecipe,steps:original.steps}))
        ||a.sourceApproved!==false||a.foodSpecificMappingApproved!==false
        ||a.declaredAlignment!==(role==='GREEK_YOGURT'?'CLASS_CHOICE_NOT_APPROVED':'DECLARED_RAW_EDIBLE_STATE_ALIGNS_NOT_MEASURED'))invalid();
      if(raw.food_stable_id!==null||raw.canonical_status!=='UNRESOLVED'||typeof raw.optional!=='boolean')invalid();
      const massKnown=raw.unit==='G'&&typeof raw.weight_g==='number'&&raw.weight_g>0&&raw.amount===raw.weight_g;
      const source=sources[role],input:ConditionalRecipeInputV1={rowId,optional:raw.optional,sourceBinding:source.sourceBinding,
        quantityBasis:massKnown?'RECORDED_EDIBLE_G_CONDITIONAL':'UNKNOWN',grams:massKnown?String(raw.weight_g):null,
        completeSourceCandidatePer100G:source.facts,blockers:massKnown?[]:['DECLARED_EDIBLE_GRAM_BASIS_NOT_ESTABLISHED']};
      return {role,sourceAuthoringRowSha256:a.sourceAuthoringRowSha256,recipeContextSha256:a.recipeContextSha256,input,
        declaredStateReview:role==='GREEK_YOGURT'?'CONDITIONAL_SOURCE_CLASS_NOT_SELECTED':'DECLARED_EDIBLE_STATE_MATCH_NOT_ADMISSION',measuredMassG:null};
    });
    const originalInputs=rows.map(r=>r.role==='GREEK_YOGURT'?{...r.input,sourceBinding:null,completeSourceCandidatePer100G:null,
      blockers:[...r.input.blockers,'GENERIC_2_PERCENT_DAIRY_CLASS_MAPPING_UNAPPROVED']}:r.input);
    return {recipeId:id,name:view.name,declaredServings:view.servings,rows,
      originalDeclaredRecipe:calculateCompleteConditionalRecipeInputV1(originalInputs,view.servings),
      conditionalClassScenario:{optionId:modelOption,selectionStatus:'UNSELECTED_CLASS_MODEL_ONLY',
        calculation:calculateCompleteConditionalRecipeInputV1(rows.map(r=>r.input),view.servings)},
      originalReferenceNutrition:view.nutrition,beforeAvailableCarbohydrateG:null,carbohydrateDelta:null,
      declaredGramSumIsNotMeasuredYield:true,measuredYieldG:null,confirmedServings:null,
      sourceApproved:false,foodSpecificMappingApproved:false,runtimePublishable:false};
  });
  return {contract:'potok-two-greek-snack-input-model-v1',usage:'OFFLINE_UNSELECTED_DAIRY_CLASS_SCENARIO_NOT_RECIPE_ADMISSION',
    classOptions:options,selectedOption:null,ownerDecision:null,recipes,
    declaredFruitRowsReviewed:2,originalCompleteRecipeVectors:0,
    conditionalCompleteInputModels:recipes.filter(r=>r.conditionalClassScenario.calculation.perDeclaredServing!==null).length,
    sourceApproved:false,runtimePublishable:false,mayActivate:false,canApply:false,originalDataModified:false,physicalCookingBlocksDevelopment:false};
}

/** Necessary capacity per category group, not proof of a feasible calorie/variety week.
 * Overlapping distinct category sets can share candidates; groups are not additive then. */
export function diagnoseAuthoringCategoryCapacityV1(catalog:AuthoringSearchCatalogV1,s:AuthoringWeekScenarioV1){
  if(!Number.isInteger(s.maxRecipeUses)||s.maxRecipeUses<1||s.maxRecipeUses>7||!Array.isArray(s.slots)||!s.slots.length||s.slots.length>7
    ||s.slots.some(slot=>!Array.isArray(slot.sourceCategories)||!slot.sourceCategories.length||slot.sourceCategories.some(c=>typeof c!=='string'||!c)))invalid();
  const groups=new Map<string,{sourceCategories:string[];slots:number}>();
  for(const slot of s.slots){const cats=[...new Set(slot.sourceCategories)].sort(),key=JSON.stringify(cats),g=groups.get(key);
    if(g)g.slots++;else groups.set(key,{sourceCategories:cats,slots:1});}
  return [...groups.values()].map(g=>{
    const recipes=new Set(catalog.recipes.filter(r=>r.numericReferenceTestInputAvailable&&r.sourceStatus!=='BLOCKED'
      &&g.sourceCategories.includes(String(r.sourceRecipe.meal_type_primary))).map(r=>r.recipeId));
    const requiredMealSlots=7*g.slots,minimumRecipes=Math.ceil(requiredMealSlots/s.maxRecipeUses);
    return {...g,requiredMealSlots,availableDistinctRecipes:recipes.size,maxWeeklyUses:recipes.size*s.maxRecipeUses,minimumRecipes,
      additionalRecipesLowerBound:Math.max(0,minimumRecipes-recipes.size),status:recipes.size<minimumRecipes?'INSUFFICIENT_REPEAT_CAPACITY':'NECESSARY_CAPACITY_ONLY_NOT_FEASIBILITY'};
  });
}

export function runGreekSnackInputModelV1(candidateRaw:string,scenarioRaw:string,e=readGreekSnackModelEvidenceV1()){
  const prior=evaluateRecipeRecalculationV1(candidateRaw,scenarioRaw),candidate=parse(candidateRaw),review=parse(e.reviewRaw);
  if(review.candidateIntegritySha256!==candidate.integritySha256)invalid();
  const catalog=obj(candidate.originalAuthoringCatalog),model=buildGreekSnackDeclaredModelV1(JSON.stringify(catalog),e);
  const search=authoringSearchInput(decodeAuthoringRecipeCatalog(catalog)),scenario=parse(scenarioRaw) as unknown as AuthoringWeekScenarioV1;
  const modelPool:AuthoringSearchCatalogV1={...search,recipes:model.recipes.flatMap(r=>{
    const calc=r.conditionalClassScenario.calculation.perDeclaredServing,source=search.recipes.find(x=>x.recipeId===r.recipeId);if(!calc||!source)return [];
    return [{...source,recipeId:'unselected_sr28_01287__'+r.recipeId,numericReferenceTestInputAvailable:true,
      referenceNutrition:{values:Object.fromEntries(Object.entries(calc).map(([a,n])=>[a,Number(n)]))}}];
  })};
  const conditionalSearch=previewRecipeAuthoringWeekV1(modelPool,scenario);
  return {contract:'potok-two-greek-snack-model-week-run-v1',model,
    originalReferenceWeek:prior.originalReferenceWeek,originalSufficientOnlyWeek:prior.sufficientOnlyWeek,
    conditionalClassModelOnly:{selectionStatus:'UNSELECTED_CLASS_MODEL_ONLY',actualSearchResult:conditionalSearch,
      categoryCapacity:diagnoseAuthoringCategoryCapacityV1(modelPool,scenario),originalReferenceFallback:false,
      carbohydrateBasis:'SOURCE_TOTAL_MINUS_SAME_SOURCE_FIBER_CANDIDATE_ONLY',portionBasis:'ONE_DECLARED_SERVING_NO_SCALING',
      cookedNutritionClaimed:false,retail2PercentEquivalenceAssumed:false},
    originalDataModified:false,sourceApproved:false,runtimePublishable:false,mayActivate:false,canApply:false,physicalCookingBlocksDevelopment:false};
}
if(process.argv[1]&&import.meta.url===pathToFileURL(process.argv[1]).href){
  if(process.argv.length!==4)throw Error('Usage: ... CANDIDATE_CATALOG.json SCENARIO.json');
  process.stdout.write(JSON.stringify(runGreekSnackInputModelV1(readFileSync(process.argv[2],'utf8'),readFileSync(process.argv[3],'utf8')),null,2)+'\n');
}
