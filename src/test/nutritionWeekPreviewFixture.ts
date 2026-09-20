import { projectTodayNutritionWeeks, type TodayPlan } from '../services/premiumTodayAdapter';

/** Synthetic identities for local tests only, never canonical food/recipe IDs. */
export function nutritionWeekPreviewFixture() {
  const plan: TodayPlan = { id: 'fixture-plan', kind: 'nutrition', title: 'Fixture', subtitle: '', description: '',
    days: Array.from({ length: 14 }, (_, index) => ({ day: index + 1, calories: '—', macros: '—', macroDetails: '—',
      workout: null, meals: [{ title: 'Обед', summary: `Fixture meal ${index + 1}`, calories: '—', macroDetails: '—',
        ingredients: [], portionHints: [], steps: [], catalogSlotId: `fixture-slot-${index + 1}` }] })) };
  const scope = { userId: 'account-A', planId: plan.id, planVersion: 'plan-v1', goalVersion: 'goal-v1' };
  const today = '2026-09-16';
  const weeks = projectTodayNutritionWeeks({ plan, scope, today, sourceStartDate: '2026-09-14', sourceDurationDays: 14 });
  return { plan, scope, today, weeks, context: { currentUserId: scope.userId, today, week: weeks.active } };
}
