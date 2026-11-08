import {boundedCartesianIndexesV1} from '../utils/boundedCartesianIndexesV1';
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
type Day={date:string;meals:Recipe[];nutrition:ReturnType<typeof total>;distance:bigint};

/** Improve an already feasible reference week without scaling portions, weakening
 * repeats or losing recipe diversity. This is bounded local improvement, not a
 * proof of global optimality or recipe/nutrition approval. */
function refineCalories(initial:Day[],pools:Recipe[][],s:AuthoringWeekScenarioV1,target:bigint){
  const days=initial.map(d=>({...d,meals:[...d.meals]}));
  const minimumDistinct=new Set(days.flatMap(d=>d.meals.map(r=>r.recipeId))).size;
  const limits={passes:2,candidatesPerDayPerPass:8192,poolPerSlot:128,nearestSecondChoices:8,balancePasses:8,balanceCandidates:4096};
  const bounded=pools.map(p=>p.slice(0,limits.poolPerSlot));
  const kcal=new Map(bounded.flat().map(r=>[r.recipeId,minor(r.referenceNutrition.values.calories)]));
  const calories=(r:Recipe)=>kcal.get(r.recipeId)??minor(r.referenceNutrition.values.calories);
  const sorted=bounded.map(p=>[...p].sort((a,b)=>calories(a)===calories(b)?cmp(a.recipeId,b.recipeId):calories(a)<calories(b)?-1:1));
  const shape=(meals:Recipe[])=>meals.reduce((n,r,i)=>n+abs(calories(r)*100n-target*BigInt(s.slots[i].targetSharePercent)),0n);
  const key=(meals:Recipe[])=>meals.map(r=>r.recipeId).join('|');
  let evaluated=0,changes=0,passes=0;
  const evaluationsByDay=days.map(()=>0);
  for(let pass=0;pass<limits.passes;pass++){
    let changed=false;passes++;
    const order=days.map((d,i)=>({i,distance:d.distance})).sort((a,b)=>a.distance===b.distance?a.i-b.i:a.distance>b.distance?-1:1);
    for(const {i:dayIndex} of order){
      const current=days[dayIndex];if(current.distance===0n)continue;
      const outside=new Map<string,number>();
      days.forEach((d,i)=>{if(i!==dayIndex)for(const r of d.meals)outside.set(r.recipeId,(outside.get(r.recipeId)??0)+1);});
      let best=current,bestShape=shape(current.meals),attempts=0;
      const consider=(meals:Recipe[])=>{
        if(attempts>=limits.candidatesPerDayPerPass)return;
        attempts++;evaluated++;evaluationsByDay[dayIndex]++;
        if(new Set(meals.map(r=>r.recipeId)).size!==meals.length)return;
        const distance=abs(meals.reduce((n,r)=>n+calories(r),0n)-target);
        if(distance>=current.distance||distance>best.distance)return;
        const uses=new Map(outside);
        for(const r of meals){const count=(uses.get(r.recipeId)??0)+1;if(count>s.maxRecipeUses)return;uses.set(r.recipeId,count);}
        if(uses.size<minimumDistinct)return;
        const distribution=shape(meals);
        if(distance===best.distance&&(distribution>bestShape||(distribution===bestShape&&cmp(key(meals),key(best.meals))>=0)))return;
        best={date:current.date,meals,nutrition:total(meals),distance};bestShape=distribution;
      };
      for(let slot=0;slot<bounded.length&&best.distance!==0n;slot++)for(const recipe of bounded[slot]){
        const meals=[...current.meals];meals[slot]=recipe;consider(meals);
      }
      // For each first replacement, binary-search the other slot's calorie list.
      // Neighbour and candidate caps bound work even for large category pools.
      for(let a=0;a<bounded.length&&best.distance!==0n&&attempts<limits.candidatesPerDayPerPass;a++){
        for(let b=a+1;b<bounded.length&&best.distance!==0n&&attempts<limits.candidatesPerDayPerPass;b++){
          const untouched=current.nutrition.calories-calories(current.meals[a])-calories(current.meals[b]);
          const seconds=sorted[b];
          for(const first of bounded[a]){
            if(best.distance===0n||attempts>=limits.candidatesPerDayPerPass)break;
            const needed=target-untouched-calories(first);let low=0,high=seconds.length;
            while(low<high){const mid=(low+high)>>>1;if(calories(seconds[mid])<needed)low=mid+1;else high=mid;}
            let left=low-1,right=low;
            for(let n=0;n<limits.nearestSecondChoices&&(left>=0||right<seconds.length);n++){
              const chooseLeft=left>=0&&(right>=seconds.length||abs(calories(seconds[left])-needed)<=abs(calories(seconds[right])-needed));
              const second=seconds[chooseLeft?left--:right++];
              if(abs(calories(second)-needed)>best.distance)break;
              const meals=[...current.meals];meals[a]=first;meals[b]=second;consider(meals);
            }
          }
        }
      }
      if(best.distance<current.distance){days[dayIndex]=best;changes++;changed=true;}
    }
    if(!changed)break;
  }
  // Redistribute existing source servings across days. Counts and weekly totals
  // stay unchanged; every day remains at least as close as its initial result.
  // Lexicographically reduce the worst daily gaps without increasing their sum.
  const allowed=bounded.map(p=>new Set(p.map(r=>r.recipeId)));
  const gaps=(week:Day[])=>week.map(d=>d.distance).sort((a,b)=>a===b?0:a>b?-1:1);
  const better=(a:bigint[],b:bigint[])=>{for(let i=0;i<a.length;i++){if(a[i]!==b[i])return a[i]<b[i];}return false;};
  let balanceEvaluated=0,balanceChanges=0;
  for(let pass=0;pass<limits.balancePasses&&balanceEvaluated<limits.balanceCandidates&&days.some(d=>d.distance!==0n);pass++){
    let changed=false;
    for(let a=0;a<days.length;a++)for(let b=a+1;b<days.length;b++){
      for(let sa=0;sa<bounded.length;sa++)for(let sb=0;sb<bounded.length;sb++){
        if(balanceEvaluated>=limits.balanceCandidates)break;
        const first=days[a],second=days[b],ra=first.meals[sa],rb=second.meals[sb];
        if(ra.recipeId===rb.recipeId||!allowed[sa].has(rb.recipeId)||!allowed[sb].has(ra.recipeId))continue;
        balanceEvaluated++;
        const ma=[...first.meals],mb=[...second.meals];ma[sa]=rb;mb[sb]=ra;
        if(new Set(ma.map(r=>r.recipeId)).size!==ma.length||new Set(mb.map(r=>r.recipeId)).size!==mb.length)continue;
        const na=total(ma),nb=total(mb),da=abs(na.calories-target),db=abs(nb.calories-target);
        if(da>initial[a].distance||db>initial[b].distance||da+db>first.distance+second.distance)continue;
        const candidate=[...days];candidate[a]={...first,meals:ma,nutrition:na,distance:da};candidate[b]={...second,meals:mb,nutrition:nb,distance:db};
        if(!better(gaps(candidate),gaps(days)))continue;
        days[a]=candidate[a];days[b]=candidate[b];balanceChanges++;changed=true;
      }
    }
    if(!changed)break;
  }
  return {days,diagnostics:{method:'BOUNDED_WHOLE_SOURCE_SERVING_REPLACEMENTS',limits,passes,evaluatedCandidates:evaluated,
    balanceEvaluated,balanceChanges,
    evaluationsByDay,changes,preservesMinimumDistinctRecipes:minimumDistinct,
    beforeDailyCalories:initial.map(d=>decimal(d.nutrition.calories)),afterDailyCalories:days.map(d=>decimal(d.nutrition.calories)),
    sourcePortionScaling:false,globalOptimumProven:false}};
}
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
  const refined=refineCalories(best,pools,s,target);best=refined.days;
  return {...base,status:'REFERENCE_WEEK_PREVIEW',scope:refined.diagnostics.changes||refined.diagnostics.balanceChanges?'CALORIE_REFINED_REFERENCE_WEEK':evaluated<combinations?'BEST_EVALUATED_PREFIX':'BEST_IN_RETAINED_POOL',evaluated,retainedWeekCombinations:combinations,
    calorieRefinement:refined.diagnostics,
    distinctRecipes:new Set(best.flatMap(d=>d.meals.map(r=>r.recipeId))).size,
    days:best.map(d=>({date:d.date,referenceNutrition:Object.fromEntries(axes.map(a=>[a,decimal(d.nutrition[a])])),
      calorieDistance:decimal(d.distance),meals:d.meals.map((r,i)=>({slot:s.slots[i].label,recipeId:r.recipeId,name:r.name,sourcePrimaryCategory:r.sourceRecipe.meal_type_primary,
        sourceDeclaredServings:r.declaredServings,assignedSourceServings:1,measuredGrams:null,referenceNutrition:r.referenceNutrition.values,verified:false}))})),diagnostics};
}
