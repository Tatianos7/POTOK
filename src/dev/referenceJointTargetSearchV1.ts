import type {AuthoringReport} from './authoringWeekReport';
import type {ReferenceSavedGoal} from './referenceSavedGoalV1';

export interface ReferenceJointTargetSearchV1 {
  evaluatedCandidates: number;
  changes: number;
  wholeWeekRebuilt?: true;
  exhaustedDays: number[];
  days: {date: string; before: {protein:number;fat:number;carbs:number}; after: {protein:number;fat:number;carbs:number}}[];
}

const axes = ['protein', 'fat', 'carbs'] as const;
const violation = (actual:number,target:number,percent:number) => {
  const actualUnits=Math.round(actual*1000),targetUnits=Math.round(target*1000);
  if (actualUnits*100 < targetUnits*(100-percent)) return targetUnits*(100-percent)-actualUnits*100;
  if (actualUnits*100 > targetUnits*(100+percent)) return actualUnits*100-targetUnits*(100+percent);
  return 0;
};

/** Validate the isolated, bounded reference search receipt; this is not trusted generation evidence. */
export function decodeReferenceJointTargetSearchV1(
  value: unknown,
  report: AuthoringReport,
  goal: ReferenceSavedGoal | null,
  distinctRecipes: number,
): ReferenceJointTargetSearchV1 | null {
  if (value === undefined) return null;
  const r = value as Record<string, unknown>;
  if (!r || Array.isArray(r) || !goal || report.days.length !== 7
    || r.scope !== 'REFERENCE_JOINT_DAILY_MACRO_WINDOWS'
    || !r.targets || typeof r.targets !== 'object' || Array.isArray(r.targets)
    || Object.keys(r.targets).sort().join(',')!=='carbs,fat,protein'
    || axes.some(axis => (r.targets as Record<string,unknown>)[axis] !== goal[axis])
    || !r.windows || typeof r.windows !== 'object' || Array.isArray(r.windows)
    || Object.keys(r.windows).sort().join(',') !== 'carbsPercent,fatPercent,proteinPercent'
    || (r.windows as Record<string,unknown>).proteinPercent !== 10
    || (r.windows as Record<string,unknown>).fatPercent !== 10
    || (r.windows as Record<string,unknown>).carbsPercent !== 15
    || !r.limits || typeof r.limits !== 'object' || Array.isArray(r.limits)
    || Object.keys(r.limits).sort().join(',') !== 'candidatesPerDayPerPass,passes,poolPerSlot'
    || (r.limits as Record<string,unknown>).passes !== 2
    || (r.limits as Record<string,unknown>).poolPerSlot !== 64
    || (r.limits as Record<string,unknown>).candidatesPerDayPerPass !== 8192
    || !Number.isSafeInteger(r.evaluatedCandidates) || Number(r.evaluatedCandidates)<0 || Number(r.evaluatedCandidates)>114688
    || !Number.isInteger(r.changes) || Number(r.changes)<0 || Number(r.changes)>14
    || !Number.isInteger(r.minimumDistinctRecipes) || Number(r.minimumDistinctRecipes)<1 || Number(r.minimumDistinctRecipes)>distinctRecipes
    || !Array.isArray(r.evaluationsByDay) || r.evaluationsByDay.length!==7
    || r.evaluationsByDay.some(n=>!Number.isInteger(n)||Number(n)<0||Number(n)>16384)
    || r.evaluationsByDay.reduce((sum,n)=>sum+Number(n),0)!==r.evaluatedCandidates
    || !Array.isArray(r.exhaustedDays) || r.exhaustedDays.length>7
    || r.exhaustedDays.some(n=>!Number.isInteger(n)||Number(n)<0||Number(n)>6)
    || new Set(r.exhaustedDays).size!==r.exhaustedDays.length
    || (r.wholeWeekRebuilt !== undefined && r.wholeWeekRebuilt !== true)
    || r.sourcePortionScaling!==false || r.recipeDataVerified!==false || r.globalOptimumProven!==false
    || !Array.isArray(r.days) || r.days.length!==7) throw Error('INVALID_REFERENCE_JOINT_TARGET_SEARCH');

  const days = r.days.map((raw,index) => {
    const d=raw as Record<string,unknown>;
    if(!d || Array.isArray(d) || d.date!==report.days[index].date) throw Error('INVALID_REFERENCE_JOINT_TARGET_SEARCH');
    const point=(rawPoint:unknown)=>{
      const p=rawPoint as Record<string,unknown>;
      if(!p || Array.isArray(p) || Object.keys(p).sort().join(',')!=='carbs,fat,protein'
        || axes.some(axis=>typeof p[axis]!=='number'||!Number.isFinite(p[axis])||Number(p[axis])<0||Number(p[axis])>1e6)) throw Error('INVALID_REFERENCE_JOINT_TARGET_SEARCH');
      return {protein:Number(p.protein),fat:Number(p.fat),carbs:Number(p.carbs)};
    };
    const before=point(d.before),after=point(d.after);
    for(const axis of axes){
      if(Math.round(after[axis]*1000)!==Math.round(report.days[index].referenceNutrition[axis]*1000)) throw Error('INVALID_REFERENCE_JOINT_TARGET_SEARCH');
    }
    const beforeViolation=axes.map(axis=>violation(before[axis],goal[axis],axis==='carbs'?15:10));
    const afterViolation=axes.map(axis=>violation(after[axis],goal[axis],axis==='carbs'?15:10));
    if(r.wholeWeekRebuilt === true && afterViolation.some(amount=>amount!==0)) throw Error('INVALID_REFERENCE_JOINT_TARGET_SEARCH');
    if(afterViolation.some((amount,i)=>amount>beforeViolation[i])) throw Error('INVALID_REFERENCE_JOINT_TARGET_SEARCH');
    return {date:String(d.date),before,after};
  });
  return {evaluatedCandidates:Number(r.evaluatedCandidates),changes:Number(r.changes),...(r.wholeWeekRebuilt===true ? {wholeWeekRebuilt:true as const} : {}),exhaustedDays:(r.exhaustedDays as number[]).map(Number),days};
}
