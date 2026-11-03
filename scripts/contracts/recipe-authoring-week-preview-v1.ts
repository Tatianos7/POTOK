import {readFileSync} from 'node:fs';
import {pathToFileURL} from 'node:url';
import {boundedCartesianIndexesV1} from '../../src/utils/boundedCartesianIndexesV1';
import {readRecipeAuthoringTestCatalogV1} from './recipe-authoring-test-catalog-v1';
export interface AuthoringWeekScenarioV1{
  contract:'potok-authoring-week-scenario-v1';weekStart:string;dailyCalorieTarget:number;tolerancePercent:number;
  slots:{label:string;sourceCategories:string[];targetSharePercent:number}[];
  rankedCandidatePoolSize:number;shortlistPerSlot:number;dayPoolSize:number;maxDayEvaluations:number;maxWeekEvaluations:number;maxRecipeUses:number;
}
type Catalog=ReturnType<typeof readRecipeAuthoringTestCatalogV1>;
type Recipe=Catalog['recipes'][number];
const axes=['calories','protein','fat','carbs','fiber'] as const;
const cmp=(a:string,b:string)=>a<b?-1:a>b?1:0;
const minor=(n:unknown):bigint=>{
  if(typeof n!=='number'||!Number.isFinite(n)||n<0||n>1e6)throw Error('INVALID_AUTHORING_REFERENCE_NUMBER');
  return BigInt(Math.round(n*1000));
};
const abs=(n:bigint)=>n<0n?-n:n;
const decimal=(n:bigint)=>`${n/1000n}.${String(n%1000n).padStart(3,'0')}`;
const total=(recipes:Recipe[])=>Object.fromEntries(axes.map(axis=>[axis,recipes.reduce((n,r)=>n+minor(r.referenceNutrition.values[axis]),0n)])) as Record<typeof axes[number],bigint>;
function validate(s:AuthoringWeekScenarioV1){
  if(s.contract!=='potok-authoring-week-scenario-v1'||!/^\d{4}-\d{2}-\d{2}$/.test(s.weekStart)
    ||!Number.isFinite(Date.parse(s.weekStart+'T00:00:00Z'))||new Date(s.weekStart+'T00:00:00Z').toISOString().slice(0,10)!==s.weekStart
    ||!Number.isInteger(s.dailyCalorieTarget)||s.dailyCalorieTarget<1||s.dailyCalorieTarget>10000
    ||!Number.isInteger(s.tolerancePercent)||s.tolerancePercent<0||s.tolerancePercent>50
    ||!Array.isArray(s.slots)||s.slots.length<1||s.slots.length>7
    ||s.slots.some(x=>!x.label||!Array.isArray(x.sourceCategories)||!x.sourceCategories.length||x.sourceCategories.some(y=>typeof y!=='string'||!y)
      ||!Number.isInteger(x.targetSharePercent)||x.targetSharePercent<1)
    ||new Set(s.slots.map(x=>x.label)).size!==s.slots.length||s.slots.reduce((a,b)=>a+b.targetSharePercent,0)!==100
    ||!Number.isInteger(s.rankedCandidatePoolSize)||s.rankedCandidatePoolSize<1||s.rankedCandidatePoolSize>128
    ||!Number.isInteger(s.shortlistPerSlot)||s.shortlistPerSlot<1||s.shortlistPerSlot>8
    ||!Number.isInteger(s.dayPoolSize)||s.dayPoolSize<1||s.dayPoolSize>16
    ||[s.maxDayEvaluations,s.maxWeekEvaluations].some(x=>!Number.isInteger(x)||x<1||x>1024)
    ||!Number.isInteger(s.maxRecipeUses)||s.maxRecipeUses<1||s.maxRecipeUses>7)throw Error('INVALID_AUTHORING_WEEK_SCENARIO');
}
/** Offline reference experiment; shares enumeration with strict search, never its validation status. */
export function previewRecipeAuthoringWeekV1(catalog:Catalog,scenario:AuthoringWeekScenarioV1){
  const s=structuredClone(scenario);validate(s);
  if(catalog.contract!=='potok-recipe-authoring-test-catalog-v1'||catalog.runtimePublishable!==false)throw Error('AUTHORING_CATALOG_REQUIRED');
  const recipes=structuredClone(catalog.recipes),ids=new Set<string>();
  for(const r of recipes){if(ids.has(r.recipeId))throw Error('DUPLICATE_AUTHORING_RECIPE');ids.add(r.recipeId);}
  const eligible=recipes.filter(r=>r.numericReferenceTestInputAvailable&&r.sourceStatus!=='BLOCKED');
  for(const r of eligible){axes.forEach(a=>minor(r.referenceNutrition.values[a]));if(typeof r.declaredServings!=='number'||r.declaredServings<=0)throw Error('INVALID_AUTHORING_SERVINGS');}
  const target=BigInt(s.dailyCalorieTarget)*1000n,tolerance=target*BigInt(s.tolerancePercent)/100n;
  const pools=s.slots.map(slot=>eligible.filter(r=>slot.sourceCategories.includes(String(r.sourceRecipe.meal_type_primary)))
    .sort((a,b)=>{const da=abs(minor(a.referenceNutrition.values.calories)*100n-target*BigInt(slot.targetSharePercent));
      const db=abs(minor(b.referenceNutrition.values.calories)*100n-target*BigInt(slot.targetSharePercent));return da===db?cmp(a.recipeId,b.recipeId):da<db?-1:1;}));
  const base={contract:'potok-recipe-authoring-week-preview-v1',scenario:s,source:catalog.source,
    usage:'OFFLINE_UNVERIFIED_REFERENCE_EXPERIMENT',runtimePublishable:false,mayActivate:false,
    physicalReview:'DEFERRED_UNTIL_OWNER_PRELAUNCH_TESTING',portionBasis:'ONE_SOURCE_DECLARED_SERVING_NO_SCALING',
    assumptions:s.slots.map(x=>({slot:x.label,sourceCategories:x.sourceCategories,applicabilityVerified:false})),
    notAssessed:['ALLERGENS','DIETARY_SAFETY','AVAILABLE_CARBOHYDRATE_SEMANTICS','MEASURED_YIELD','PRACTICAL_PORTIONS','REPEAT_FAMILIES','PROTEIN_OR_OTHER_NUTRIENT_TARGETS','TRUSTED_PLAN_VALIDATION'],
    poolCounts:pools.map((p,i)=>({slot:s.slots[i].label,fullReferenceCandidates:p.length})),
    excludedNumericInputs:recipes.length-eligible.length};
  if(pools.some(p=>!p.length))return {...base,status:'INCOMPLETE_CATEGORY_POOL',days:[],diagnostics:[]};
  type Day={date:string;meals:Recipe[];nutrition:ReturnType<typeof total>;distance:bigint};
  const dayPools:Day[][]=[],diagnostics=[];
  for(let day=0;day<7;day++){
    const date=new Date(Date.parse(s.weekStart+'T00:00:00Z')+day*86400000).toISOString().slice(0,10);
    // Explicit rotation of calorie-ranked shortlists expands variety without assigning recipe families.
    const lists=pools.map((full,slot)=>{const pool=full.slice(0,s.rankedCandidatePoolSize);const offset=(day*s.shortlistPerSlot*2+slot*s.shortlistPerSlot)%pool.length;
      return Array.from({length:Math.min(pool.length,s.shortlistPerSlot)},(_,i)=>pool[(offset+i)%pool.length]);});
    const accepted:Day[]=[];let evaluated=0;const combinations=lists.reduce((n,l)=>n*l.length,1);
    for(const indexes of boundedCartesianIndexesV1(lists.map(x=>x.length),s.maxDayEvaluations)){
      evaluated++;const meals=lists.map((l,i)=>l[indexes[i]]);if(new Set(meals.map(r=>r.recipeId)).size!==meals.length)continue;
      const nutrition=total(meals),distance=abs(nutrition.calories-target);if(distance<=tolerance)accepted.push({date,meals,nutrition,distance});
    }
    accepted.sort((a,b)=>a.distance===b.distance?cmp(a.meals.map(r=>r.recipeId).join('|'),b.meals.map(r=>r.recipeId).join('|')):a.distance<b.distance?-1:1);
    const remaining=[...accepted],retained:Day[]=[];
    // Preserve distinct recipe choices in the retained day pool, rather than four near-identical calorie ties.
    while(remaining.length&&retained.length<s.dayPoolSize){
      const used=new Set(retained.flatMap(d=>d.meals.map(r=>r.recipeId)));
      let winner=0,overlap=Infinity;
      remaining.forEach((d,i)=>{const n=d.meals.filter(r=>used.has(r.recipeId)).length;if(n<overlap){winner=i;overlap=n;}});
      retained.push(remaining.splice(winner,1)[0]);
    }
    dayPools.push(retained);
    diagnostics.push({date,evaluated,shortlistCombinations:combinations,shortlistRecipeIds:lists.map(l=>l.map(r=>r.recipeId)),matchingReferenceDays:accepted.length,retainedDayOptions:Math.min(accepted.length,s.dayPoolSize),exhaustedShortlists:evaluated===combinations});
  }
  if(dayPools.some(x=>!x.length))return {...base,status:'NO_REFERENCE_DAY_IN_EVALUATED_SHORTLISTS',days:[],diagnostics};
  const combinations=dayPools.reduce((n,p)=>n*p.length,1);let evaluated=0,best:Day[]|null=null,bestDistance:bigint|null=null;
  for(const indexes of boundedCartesianIndexesV1(dayPools.map(x=>x.length),s.maxWeekEvaluations)){
    evaluated++;const days=dayPools.map((l,i)=>l[indexes[i]]),uses=new Map<string,number>();
    for(const day of days)for(const r of day.meals)uses.set(r.recipeId,(uses.get(r.recipeId)??0)+1);
    if([...uses.values()].some(n=>n>s.maxRecipeUses))continue;
    const distance=days.reduce((n,d)=>n+d.distance,0n);if(bestDistance===null||distance<bestDistance){best=days;bestDistance=distance;}
  }
  if(!best)return {...base,status:evaluated<combinations?'WEEK_SEARCH_LIMIT_REACHED':'NO_REFERENCE_WEEK_IN_RETAINED_POOL',days:[],diagnostics,evaluated,retainedWeekCombinations:combinations};
  return {...base,status:'REFERENCE_WEEK_PREVIEW',scope:evaluated<combinations?'BEST_EVALUATED_PREFIX':'BEST_IN_RETAINED_POOL',evaluated,retainedWeekCombinations:combinations,
    distinctRecipes:new Set(best.flatMap(d=>d.meals.map(r=>r.recipeId))).size,
    days:best.map(d=>({date:d.date,referenceNutrition:Object.fromEntries(axes.map(a=>[a,decimal(d.nutrition[a])])),
      calorieDistance:decimal(d.distance),meals:d.meals.map((r,i)=>({slot:s.slots[i].label,recipeId:r.recipeId,name:r.name,sourcePrimaryCategory:r.sourceRecipe.meal_type_primary,
        sourceDeclaredServings:r.declaredServings,assignedSourceServings:1,measuredGrams:null,referenceNutrition:r.referenceNutrition.values,verified:false}))})),diagnostics};
}
if(process.argv[1]&&import.meta.url===pathToFileURL(process.argv[1]).href){
  if(process.argv.length!==4)throw Error('Usage: node --import tsx scripts/contracts/recipe-authoring-week-preview-v1.ts MASTER.xlsx SCENARIO.json');
  console.log(JSON.stringify(previewRecipeAuthoringWeekV1(readRecipeAuthoringTestCatalogV1(process.argv[2]),JSON.parse(readFileSync(process.argv[3],'utf8'))),null,2));
}
