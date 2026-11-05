import type {CapacityRecipeV1,CapacityScenarioV1} from './week-input-calorie-capacity-v1';
/** Full day-domain enumeration plus bounded multiset DFS for one fixed seven-day
 * scenario. This is a conditional input witness, never trusted plan validation.
 * Day order is symmetric because no date-specific eligibility is in this input. */
export function findCompleteInputWeekWitnessV1(recipes:CapacityRecipeV1[],s:CapacityScenarioV1&{weekStart:string},limits={maxDayCandidates:100000,maxWeekNodes:200000}){
 const invalid=():never=>{throw Error('INVALID_COMPLETE_INPUT_WEEK_WITNESS');};
 if(!Array.isArray(recipes)||recipes.length>32||new Set(recipes.map(r=>r.recipeId)).size!==recipes.length||recipes.some(r=>typeof r.recipeId!=='string'||!r.recipeId||typeof r.sourceCategory!=='string'||!r.sourceCategory||typeof r.caloriesPerDeclaredServing!=='string'||!/^(0|[1-9][0-9]{0,5})(\.[0-9]{1,8})?$/.test(r.caloriesPerDeclaredServing))
 ||!Number.isInteger(s.dailyCalorieTarget)||s.dailyCalorieTarget<1||s.dailyCalorieTarget>10000||!Number.isInteger(s.tolerancePercent)||s.tolerancePercent<0||s.tolerancePercent>50||!Number.isInteger(s.maxRecipeUses)||s.maxRecipeUses<1||s.maxRecipeUses>7
 ||!Array.isArray(s.slots)||s.slots.length<1||s.slots.length>7||new Set(s.slots.map(x=>x.label)).size!==s.slots.length||s.slots.some(x=>typeof x.label!=='string'||!x.label||!Array.isArray(x.sourceCategories)||!x.sourceCategories.length||x.sourceCategories.some(c=>typeof c!=='string'||!c)||new Set(x.sourceCategories).size!==x.sourceCategories.length)
 ||typeof s.weekStart!=='string'||!/^\d{4}-\d{2}-\d{2}$/.test(s.weekStart)||!Number.isFinite(Date.parse(s.weekStart+'T00:00:00Z'))||new Date(s.weekStart+'T00:00:00Z').toISOString().slice(0,10)!==s.weekStart
 ||!Number.isInteger(limits.maxDayCandidates)||limits.maxDayCandidates<1||limits.maxDayCandidates>100000||!Number.isInteger(limits.maxWeekNodes)||limits.maxWeekNodes<1||limits.maxWeekNodes>200000)invalid();
 const cmp=(a:string,b:string)=>a<b?-1:a>b?1:0,rs=[...recipes].sort((a,b)=>cmp(a.recipeId,b.recipeId)),kcal=rs.map(r=>Math.round(Number(r.caloriesPerDeclaredServing)*1000));
 const target=s.dailyCalorieTarget*1000,tolerance=Math.floor(target*s.tolerancePercent/100),lower=target-tolerance,upper=target+tolerance;
 const pools=s.slots.map(slot=>rs.map((r,i)=>slot.sourceCategories.includes(r.sourceCategory)?i:-1).filter(i=>i>=0));
 type Day={indexes:number[];kcal:number;key:string};const days:Day[]=[],seen=new Set<string>();let enumerated=0,dayLimited=false;
 function enumerate(slot:number,chosen:number[]){
  if(slot===pools.length){if(enumerated>=limits.maxDayCandidates){dayLimited=true;return;}enumerated++;if(new Set(chosen).size!==chosen.length)return;const total=chosen.reduce((n,i)=>n+kcal[i],0);if(total<lower||total>upper)return;const key=[...chosen].sort((a,b)=>a-b).join(',');if(!seen.has(key)){seen.add(key);days.push({indexes:[...chosen],kcal:total,key});}return;}
  for(const i of pools[slot]){if(dayLimited)return;chosen.push(i);enumerate(slot+1,chosen);chosen.pop();}
 }
 enumerate(0,[]);days.sort((a,b)=>Math.abs(a.kcal-target)-Math.abs(b.kcal-target)||cmp(a.key,b.key));
 const groups=new Map<string,{indexes:number[];slots:number}>();for(let slot=0;slot<s.slots.length;slot++){const key=JSON.stringify([...s.slots[slot].sourceCategories].sort()),g=groups.get(key);if(g)g.slots++;else groups.set(key,{indexes:pools[slot],slots:1});}
 const uses=Array(rs.length).fill(0) as number[],chosen:number[]=[],failed=new Set<string>();let nodes=0,weekTransitions=0,caloriePrunedNodes=0,weekLimited=false;
 function search(start:number):boolean{
  if(chosen.length===7)return true;if(nodes>=limits.maxWeekNodes){weekLimited=true;return false;}nodes++;
  const remaining=7-chosen.length;if([...groups.values()].some(g=>g.indexes.reduce((n,i)=>n+s.maxRecipeUses-uses[i],0)<remaining*g.slots))return false;
  let optimisticRemaining=0;for(const g of groups.values()){let need=remaining*g.slots;const available=g.indexes.map(i=>({kcal:kcal[i],capacity:s.maxRecipeUses-uses[i]})).sort((a,b)=>b.kcal-a.kcal);for(const r of available){const n=Math.min(need,r.capacity);optimisticRemaining+=n*r.kcal;need-=n;if(!need)break;}}
  if(optimisticRemaining<remaining*lower){caloriePrunedNodes++;return false;}
  const key=start+'|'+uses.join(',');if(failed.has(key))return false;
  for(let index=start;index<days.length;index++){if(weekLimited)return false;if(weekTransitions>=Math.min(2000000,limits.maxWeekNodes*16)){weekLimited=true;return false;}weekTransitions++;const d=days[index];if(d.indexes.some(i=>uses[i]>=s.maxRecipeUses))continue;d.indexes.forEach(i=>uses[i]++);chosen.push(index);if(search(index))return true;chosen.pop();d.indexes.forEach(i=>uses[i]--);}
  failed.add(key);return false;
 }
 const found=search(0),fixed=(n:number)=>(n/1000).toFixed(3);
 return {contract:'potok-complete-input-week-witness-v1',status:found?'CONDITIONAL_INPUT_WEEK_WITNESS':dayLimited||weekLimited?'INCOMPLETE_BOUNDED_WITNESS_SEARCH':'NO_WEEK_IN_COMPLETE_CONDITIONAL_INPUT_DOMAIN',
  dayEnumerationComplete:!dayLimited,dayCandidatesEnumerated:enumerated,distinctAcceptedDaySets:days.length,weekNodes:nodes,weekTransitions,caloriePrunedNodes,weekSearchLimited:weekLimited,optimizationClaimed:false,
  days:found?chosen.map((index,day)=>({date:new Date(Date.parse(s.weekStart+'T00:00:00Z')+day*86400000).toISOString().slice(0,10),calories:fixed(days[index].kcal),meals:days[index].indexes.map((i,slot)=>({slot:s.slots[slot].label,recipeId:rs[i].recipeId,sourceCategory:rs[i].sourceCategory,assignedDeclaredServings:1,measuredGrams:null}))})):[],
  recipeUses:found?rs.map((r,i)=>({recipeId:r.recipeId,uses:uses[i]})).filter(r=>r.uses>0):[],
  portionBasis:'ONE_AUTHORING_DECLARED_SERVING_NO_SCALING',notAssessed:['ALLERGENS','DIETARY_SAFETY','MEASURED_YIELD','PRACTICAL_PORTIONS','REPEAT_FAMILIES','PROTEIN_OR_OTHER_TARGETS','TRUSTED_PLAN_VALIDATION'],
  sourceApproved:false,runtimePublishable:false,canApply:false,mayActivate:false,cookedNutritionClaimed:false};
}
