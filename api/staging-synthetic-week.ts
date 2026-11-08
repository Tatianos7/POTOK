/** STAGING ONLY: generated API module combining the original reviewed bounded traversal, authoring week search, synthetic test fixtures and HTTP handler. */
/** Shared deterministic traversal only. It issues no validation or authority. */
export function* boundedCartesianIndexesV1(counts:readonly number[],budget:number):Generator<readonly number[]>{
  const owned=[...counts];
  if(!owned.length||owned.length>7||owned.some(n=>!Number.isSafeInteger(n)||n<1||n>16)
    ||!Number.isSafeInteger(budget)||budget<1||budget>1024)throw Error('INVALID_CARTESIAN_SEARCH_BOUNDS');
  const indexes=owned.map(()=>0),limit=Math.min(budget,owned.reduce((a,b)=>a*b,1));
  for(let n=0;n<limit;n++){
    yield Object.freeze([...indexes]);
    for(let axis=owned.length-1;axis>=0;axis--){indexes[axis]++;if(indexes[axis]<owned[axis])break;indexes[axis]=0;}
  }
}

export interface AuthoringWeekScenarioV1{
  contract:'potok-authoring-week-scenario-v1';weekStart:string;dailyCalorieTarget:number;tolerancePercent:number;
  slots:{label:string;sourceCategories:string[];targetSharePercent:number}[];
  rankedCandidatePoolSize:number;shortlistPerSlot:number;dayPoolSize:number;maxDayEvaluations:number;maxWeekEvaluations:number;maxRecipeUses:number;
}
export interface AuthoringSearchCatalogV1 {
  contract: string; runtimePublishable: boolean;
  source: {fileName: string; sha256: string; bytes: number};
  recipes: {recipeId: string; name: string; sourceStatus: string; declaredServings: unknown;
    numericReferenceTestInputAvailable: boolean; sourceRecipe: {meal_type_primary?: unknown};
    referenceNutrition: {values: Record<string, unknown>}}[];
}
type Catalog=AuthoringSearchCatalogV1;
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

/** Synthetic, server-only walkthrough of the existing authoring selection engine.
 * NEVER a canonical plan, verified nutrition, prescription, or DB payload.
 */

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

/** Vercel Node API: auth-bound, bounded, synthetic-only preview.
 * Does not call Supabase RPC, write databases, or invoke the private generator.
 * Exact Staging environment required. No user-controlled optimization input.
 */

type Req={method?:string;headers:Record<string,string|string[]|undefined>;body?:unknown};
type Res={status:(code:number)=>Res;setHeader:(name:string,value:string)=>Res;json:(value:unknown)=>void};
const STAGING='https://ozidryfvhkcbtpnulakq.supabase.co';
const noWriteHeaders={'Cache-Control':'no-store','X-Content-Type-Options':'nosniff'};

export default async function handler(req:Req,res:Res):Promise<void>{
  for(const [key,value] of Object.entries(noWriteHeaders))res.setHeader(key,value);
  if(process.env.VITE_POTOK_STAGING_PREVIEW!=='true'||process.env.VITE_SUPABASE_URL!==STAGING){
    res.status(503).json({error:'STAGING_ENVIRONMENT_REQUIRED'});return;
  }
  if(req.method!=='POST'){res.setHeader('Allow','POST');res.status(405).json({error:'METHOD_NOT_ALLOWED'});return;}
  if(req.body!==undefined && req.body!==null && (
    typeof req.body!=='object'||Array.isArray(req.body)||Object.keys(req.body as object).length!==0
  )){res.status(400).json({error:'UNSUPPORTED_INPUT'});return;}
  const bearer=req.headers.authorization;
  const auth=typeof bearer==='string'&&/^Bearer [^\s,]+$/i.test(bearer)?bearer:null;
  if(!auth){res.status(401).json({error:'AUTH_REQUIRED'});return;}
  const publicKey=process.env.VITE_SUPABASE_ANON_KEY;
  if(!publicKey || !(publicKey.startsWith('sb_publishable_') || publicKey.split('.').length===3)){
    res.status(503).json({error:'STAGING_PUBLIC_KEY_MISSING'});return;
  }
  try {
    const controller=new AbortController();
    const timeout=setTimeout(()=>controller.abort(),5000);
    let remote:Response;
    try {
      remote=await fetch(STAGING+'/auth/v1/user',{
        method:'GET',signal:controller.signal,cache:'no-store',
        headers:{Authorization:auth,apikey:publicKey,Accept:'application/json'}
      });
    }finally{clearTimeout(timeout);}
    if(!remote.ok){res.status(remote.status===401||remote.status===403?401:503).json({error:'AUTH_UNAVAILABLE_OR_DENIED'});return;}
    const user=await remote.json() as {id?:unknown};
    if(typeof user.id!=='string'||!/^[-0-9a-f]{36}$/i.test(user.id)){
      res.status(401).json({error:'AUTH_INVALID_USER'});return;
    }
    res.status(200).json(buildSyntheticStagingWeekV1());
  }catch{
    res.status(503).json({error:'SYNTHETIC_PREVIEW_TEMPORARILY_UNAVAILABLE'});
  }
}
