/** A necessary bound, not a search or nutrition/portion approval. It ignores
 * day-level conflicts and cross-group resource competition, so the sum is an
 * optimistic upper bound even when category groups overlap. */
export interface CapacityRecipeV1{recipeId:string;sourceCategory:string;caloriesPerDeclaredServing:string}
export interface CapacityScenarioV1{dailyCalorieTarget:number;tolerancePercent:number;maxRecipeUses:number;slots:{label:string;sourceCategories:string[]}[]}
function invalid():never{throw Error('INVALID_WEEK_INPUT_CALORIE_CAPACITY');}
function minor3(s:unknown){if(typeof s!=='string'||!/^(0|[1-9][0-9]{0,5})(\.[0-9]{1,8})?$/.test(s))invalid();return BigInt(Math.round(Number(s)*1000));}
const fixed=(n:bigint)=>String(n/1000n)+'.'+String(n%1000n).padStart(3,'0');
export function analyzeWeekInputCalorieCapacityV1(recipes:CapacityRecipeV1[],s:CapacityScenarioV1){
 if(!Array.isArray(recipes)||recipes.length>128||new Set(recipes.map(r=>r.recipeId)).size!==recipes.length
 ||recipes.some(r=>typeof r.recipeId!=='string'||!r.recipeId||typeof r.sourceCategory!=='string'||!r.sourceCategory)
 ||!Number.isInteger(s.dailyCalorieTarget)||s.dailyCalorieTarget<1||s.dailyCalorieTarget>10000||!Number.isInteger(s.tolerancePercent)||s.tolerancePercent<0||s.tolerancePercent>50
 ||!Number.isInteger(s.maxRecipeUses)||s.maxRecipeUses<1||s.maxRecipeUses>7||!Array.isArray(s.slots)||s.slots.length<1||s.slots.length>7
 ||new Set(s.slots.map(x=>x.label)).size!==s.slots.length||s.slots.some(x=>typeof x.label!=='string'||!x.label||!Array.isArray(x.sourceCategories)||!x.sourceCategories.length||x.sourceCategories.some(c=>typeof c!=='string'||!c)||new Set(x.sourceCategories).size!==x.sourceCategories.length))invalid();
 const inputs=recipes.map(r=>({...r,kcal:minor3(r.caloriesPerDeclaredServing)})),groups=new Map<string,{categories:string[];slots:number}>();
 for(const slot of s.slots){const categories=[...slot.sourceCategories].sort(),key=JSON.stringify(categories),g=groups.get(key);if(g)g.slots++;else groups.set(key,{categories,slots:1});}
 const certificate=[...groups.values()].map(g=>{
  const available=inputs.filter(r=>g.categories.includes(r.sourceCategory)).sort((a,b)=>a.kcal===b.kcal?(a.recipeId<b.recipeId?-1:a.recipeId>b.recipeId?1:0):a.kcal>b.kcal?-1:1);
  const required=7*g.slots,capacity=available.length*s.maxRecipeUses;let left=required,total=0n;
  const optimisticAllocation: {recipeId:string;uses:number;caloriesPerServing:string}[]=[];
  for(const r of available){const uses=Math.min(left,s.maxRecipeUses);if(!uses)break;total+=r.kcal*BigInt(uses);left-=uses;optimisticAllocation.push({recipeId:r.recipeId,uses,caloriesPerServing:fixed(r.kcal)});}
  return {sourceCategories:g.categories,weeklyMealSlots:required,availableRepeatCapacity:capacity,remainingSlots:left,optimisticAllocation,
   optimisticMaxKcal:left===0?fixed(total):null,upperBound:left===0?total:null};
 });
 const minDaily=BigInt(s.dailyCalorieTarget)*1000n-BigInt(s.dailyCalorieTarget)*1000n*BigInt(s.tolerancePercent)/100n,minWeek=minDaily*7n;
 const capacityMissing=certificate.some(c=>c.remainingSlots>0),upper=capacityMissing?null:certificate.reduce((n,c)=>n+c.upperBound!,0n);
 return {contract:'potok-week-input-calorie-capacity-v1',status:capacityMissing?'INSUFFICIENT_RECIPE_REPEAT_CAPACITY':upper!<minWeek?'PROVEN_INSUFFICIENT_WEEK_CALORIES':'NECESSARY_CALORIE_BOUND_PASSED_NOT_FEASIBILITY',
  precision:'SAME_NUMBER_ROUND3_AS_EXISTING_AUTHORING_SEARCH',requiredMinimumDailyKcal:fixed(minDaily),requiredMinimumWeekKcal:fixed(minWeek),optimisticMaximumWeekKcal:upper===null?null:fixed(upper),
  provenWeeklyShortfallKcal:upper!==null&&upper<minWeek?fixed(minWeek-upper):null,certificate:certificate.map(({upperBound,...c})=>{void upperBound;return c;}),
  assumptions:{oneDeclaredServingPerMeal:true,dayConflictsIgnoredForUpperBound:true,crossGroupCompetitionIgnoredForUpperBound:true,portionScaling:false},
  fullWeekFeasibilityProven:false,sourceApproved:false,runtimePublishable:false,canApply:false,mayActivate:false};
}
