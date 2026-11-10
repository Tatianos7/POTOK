import type {AuthoringReport} from './authoringWeekReport';
import type {ReferenceSavedGoal} from './referenceSavedGoalV1';
export interface ReferenceMacroFit {
  improvedDays: number;
  days: {date: string; before: {protein: number; fat: number}; after: {protein: number; fat: number}}[];
}
/** Independent reference receipt check; never admits a nutrition policy or source. */
export function decodeReferenceMacroFit(value: unknown, report: AuthoringReport, goal: ReferenceSavedGoal | null, distinctRecipes: number): ReferenceMacroFit | null {
  if (value === undefined) return null;
  const r = value as Record<string, unknown>;
  if (!r || Array.isArray(r) || !goal || report.days.length !== 7
    || r.scope !== 'REFERENCE_PROTEIN_FAT_PARETO_ONLY' || r.carbsAssessed !== false || r.hardMacroBoundsAssessed !== false
    || r.targetProtein !== goal.protein || r.targetFat !== goal.fat
    || !Number.isSafeInteger(r.evaluatedCandidates) || Number(r.evaluatedCandidates) < 0 || Number(r.evaluatedCandidates) > 114688
    || !Number.isInteger(r.minimumDistinctRecipes) || Number(r.minimumDistinctRecipes) < 1 || Number(r.minimumDistinctRecipes) > distinctRecipes
    || !r.limits || typeof r.limits !== 'object' || Array.isArray(r.limits)
    || Object.keys(r.limits).sort().join(',') !== 'candidatesPerDayPerPass,passes,poolPerSlot'
    || (r.limits as Record<string,unknown>).passes !== 2 || (r.limits as Record<string,unknown>).poolPerSlot !== 64 || (r.limits as Record<string,unknown>).candidatesPerDayPerPass !== 8192
    || !Number.isInteger(r.changes) || Number(r.changes) < 0 || Number(r.changes) > 14
    || !Array.isArray(r.days) || r.days.length !== 7) throw Error('INVALID_REFERENCE_MACRO_FIT');
  let improvedDays = 0;
  const days = r.days.map((value, i) => {
    const d = value as Record<string, unknown>;
    if (!d || Array.isArray(d) || d.date !== report.days[i].date) throw Error('INVALID_REFERENCE_MACRO_FIT');
    const point = (v: unknown) => {
      const p = v as Record<string, unknown>;
      if (!p || Array.isArray(p) || Object.keys(p).sort().join(',') !== 'fat,protein'
        || ['protein','fat'].some(k => typeof p[k] !== 'number' || !Number.isFinite(p[k]) || Number(p[k]) < 0 || Number(p[k]) > 1e6)) throw Error('INVALID_REFERENCE_MACRO_FIT');
      return {protein: Number(p.protein), fat: Number(p.fat)};
    };
    const before = point(d.before), after = point(d.after);
    let improved = false;
    for (const axis of ['protein','fat'] as const) {
      const minor = (n: number) => Math.round(n*1000), target = minor(goal[axis]);
      if (minor(after[axis]) !== minor(report.days[i].referenceNutrition[axis])
        || Math.abs(minor(after[axis])-target) > Math.abs(minor(before[axis])-target)) throw Error('INVALID_REFERENCE_MACRO_FIT');
      if (Math.abs(minor(after[axis])-target) < Math.abs(minor(before[axis])-target)) improved = true;
    }
    if (improved) improvedDays++;
    return {date: String(d.date), before, after};
  });
  return {days, improvedDays};
}
