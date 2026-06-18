export type GoalInputGoal = 'weight-loss' | 'maintain' | 'gain';
export type GoalInputLifestyle = 'sedentary' | 'light' | 'moderate' | 'high' | 'very-high';

export interface GoalInputLike {
  age: string;
  weight: string;
  height: string;
  lifestyle: string;
  goal: string;
  targetWeight?: string;
}

export type GoalInputField = keyof GoalInputLike;

export interface GoalValidationResult {
  isValid: boolean;
  errors: Partial<Record<GoalInputField, string>>;
}

const SUPPORTED_LIFESTYLES = new Set<GoalInputLifestyle>([
  'sedentary',
  'light',
  'moderate',
  'high',
  'very-high',
]);

const SUPPORTED_GOALS = new Set<GoalInputGoal>(['weight-loss', 'maintain', 'gain']);

const parseRequiredNumber = (value: string): number | null => {
  if (typeof value !== 'string' || value.trim() === '') return null;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
};

export const validateGoalInput = (input: GoalInputLike): GoalValidationResult => {
  const errors: Partial<Record<GoalInputField, string>> = {};

  const age = parseRequiredNumber(input.age);
  if (age === null || age < 18 || age > 100) {
    errors.age = 'Укажите возраст от 18 до 100 лет.';
  }

  const weight = parseRequiredNumber(input.weight);
  if (weight === null || weight < 30 || weight > 300) {
    errors.weight = 'Укажите вес от 30 до 300 кг.';
  }

  const height = parseRequiredNumber(input.height);
  if (height === null || height < 120 || height > 250) {
    errors.height = 'Укажите рост от 120 до 250 см.';
  }

  if (!SUPPORTED_LIFESTYLES.has(input.lifestyle as GoalInputLifestyle)) {
    errors.lifestyle = 'Выберите уровень активности.';
  }

  if (!SUPPORTED_GOALS.has(input.goal as GoalInputGoal)) {
    errors.goal = 'Выберите цель.';
  }

  const targetWeight = parseRequiredNumber(input.targetWeight ?? '');
  if (weight !== null && input.goal === 'weight-loss' && (targetWeight === null || targetWeight >= weight)) {
    errors.targetWeight = 'Для похудения целевой вес должен быть меньше текущего.';
  }

  if (weight !== null && input.goal === 'gain' && (targetWeight === null || targetWeight <= weight)) {
    errors.targetWeight = 'Для набора массы целевой вес должен быть больше текущего.';
  }

  return {
    isValid: Object.keys(errors).length === 0,
    errors,
  };
};
