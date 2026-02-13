export type GoalMode = 'weight-loss' | 'gain' | 'maintain';

export interface GoalPlanInput {
  gender: 'male' | 'female';
  age: number;
  weight: number;
  height: number;
  lifestyle: string;
  goal: GoalMode;
  intensity?: string;
  targetWeight?: number;
}

export interface GoalTimelineInput {
  goal: GoalMode;
  currentWeight: number;
  targetWeight: number;
  tdee: number;
  calories: number;
}

export interface GoalTimelineResult {
  deficitPerDay: number;
  surplusPerDay: number;
  kgPerWeek: number;
  daysToGoal: number;
  monthsToGoal: number;
}

export interface GoalPlanResult {
  bmr: number;
  tdee: number;
  calories: number;
  proteins: number;
  fats: number;
  carbs: number;
  timeline: GoalTimelineResult;
}

const KCAL_PER_KG = 7700;
const WEEKS_PER_MONTH = 4.345;

const clamp = (value: number, min: number, max: number): number => Math.min(max, Math.max(min, value));

export const calculateBMR = (gender: 'male' | 'female', weight: number, height: number, age: number): number => {
  if (gender === 'male') {
    return 88.362 + (13.397 * weight) + (4.799 * height) - (5.677 * age);
  }
  return 447.593 + (9.247 * weight) + (3.098 * height) - (4.33 * age);
};

export const getActivityFactor = (lifestyle: string): number => {
  const factors: Record<string, number> = {
    sedentary: 1.2,
    light: 1.375,
    moderate: 1.55,
    high: 1.725,
    'very-high': 1.9,
  };
  return factors[lifestyle] ?? 1.2;
};

export const calculateTargetCalories = (
  bmr: number,
  activityFactor: number,
  goal: GoalMode,
  intensity?: string
): number => {
  const tdee = bmr * activityFactor;
  if (goal === 'weight-loss') {
    const deficitPercent = intensity ? parseFloat(intensity) / 100 : 0.1;
    return Math.round(tdee * (1 - deficitPercent));
  }
  if (goal === 'gain') {
    const dailySurplusTarget = clamp(tdee * 0.15, 200, 500);
    return Math.round(tdee + dailySurplusTarget);
  }
  return Math.round(tdee);
};

export const calculateMacros = (
  weight: number,
  totalCalories: number
): { proteins: number; fats: number; carbs: number } => {
  const proteins = Math.round(weight * 2);
  const fats = Math.round(weight * 0.9);
  const caloriesProtein = proteins * 4;
  const caloriesFat = fats * 9;
  const carbsExact = (totalCalories - caloriesProtein - caloriesFat) / 4;

  const carbsFloor = Math.floor(carbsExact);
  const carbsCeil = Math.ceil(carbsExact);
  const totalWithFloor = caloriesProtein + caloriesFat + carbsFloor * 4;
  const totalWithCeil = caloriesProtein + caloriesFat + carbsCeil * 4;

  const carbs = Math.abs(totalWithFloor - totalCalories) <= Math.abs(totalWithCeil - totalCalories)
    ? carbsFloor
    : carbsCeil;

  return { proteins, fats, carbs };
};

export const calculateGoalTimeline = (input: GoalTimelineInput): GoalTimelineResult => {
  const { goal, currentWeight, targetWeight, tdee, calories } = input;
  const base: GoalTimelineResult = {
    deficitPerDay: 0,
    surplusPerDay: 0,
    kgPerWeek: 0,
    daysToGoal: 0,
    monthsToGoal: 0,
  };

  if (!Number.isFinite(currentWeight) || !Number.isFinite(targetWeight) || !Number.isFinite(tdee) || !Number.isFinite(calories)) {
    return base;
  }
  if (currentWeight <= 0 || targetWeight <= 0 || tdee <= 0 || calories <= 0) {
    return base;
  }

  if (goal === 'gain') {
    const surplus = calories - tdee;
    const kgToGoal = targetWeight - currentWeight;
    if (surplus <= 0 || kgToGoal <= 0) return base;
    const kgPerWeek = (surplus * 7) / KCAL_PER_KG;
    if (kgPerWeek <= 0) return base;
    const weeksToGoal = kgToGoal / kgPerWeek;
    const daysToGoal = weeksToGoal * 7;
    const monthsToGoal = Math.max(1, Math.ceil(weeksToGoal / WEEKS_PER_MONTH));
    return {
      deficitPerDay: 0,
      surplusPerDay: Math.round(surplus),
      kgPerWeek: Number(kgPerWeek.toFixed(2)),
      daysToGoal,
      monthsToGoal,
    };
  }

  if (goal === 'weight-loss') {
    const deficit = tdee - calories;
    const kgToGoal = currentWeight - targetWeight;
    if (deficit <= 0 || kgToGoal <= 0) return base;
    const kgPerWeek = (deficit * 7) / KCAL_PER_KG;
    if (kgPerWeek <= 0) return base;
    const weeksToGoal = kgToGoal / kgPerWeek;
    const daysToGoal = weeksToGoal * 7;
    const monthsToGoal = Math.max(1, Math.ceil(weeksToGoal / WEEKS_PER_MONTH));
    return {
      deficitPerDay: Math.round(deficit),
      surplusPerDay: 0,
      kgPerWeek: Number(kgPerWeek.toFixed(2)),
      daysToGoal,
      monthsToGoal,
    };
  }

  return base;
};

export const computeGoalPlan = (input: GoalPlanInput): GoalPlanResult => {
  const bmr = calculateBMR(input.gender, input.weight, input.height, input.age);
  const activityFactor = getActivityFactor(input.lifestyle);
  const tdee = Math.round(bmr * activityFactor);
  const calories = calculateTargetCalories(bmr, activityFactor, input.goal, input.intensity);
  const { proteins, fats, carbs } = calculateMacros(input.weight, calories);
  const timeline = calculateGoalTimeline({
    goal: input.goal,
    currentWeight: input.weight,
    targetWeight: Number.isFinite(input.targetWeight) ? Number(input.targetWeight) : input.weight,
    tdee,
    calories,
  });

  return {
    bmr: Math.round(bmr),
    tdee,
    calories,
    proteins,
    fats,
    carbs,
    timeline,
  };
};

