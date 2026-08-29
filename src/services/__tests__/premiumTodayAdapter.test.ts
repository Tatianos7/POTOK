import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import test from 'node:test';

import {
  buildTodayPlanFromPremiumCatalog,
  mapDerivedShoppingListToShoppingGroups,
  mapMealRecipeOptionsToReplacementOptions,
  mapPremiumMealSlotsToTodayMeals,
  mapPremiumPlanDaysToTodayDays,
  mapPremiumPlanToTodayPlan,
  mapPremiumRecipeDetailToTodayMealDetail,
} from '../premiumTodayAdapter';
import type {
  PremiumMealRecipeOption,
  PremiumMealSlot,
  PremiumPlan,
  PremiumPlanDay,
  PremiumRecipeDetail,
  PremiumShoppingListItem,
} from '../premiumCatalogService';

const testDir = dirname(fileURLToPath(import.meta.url));
const adapterSource = readFileSync(resolve(testDir, '../premiumTodayAdapter.ts'), 'utf8');
const todaySource = readFileSync(resolve(testDir, '../../pages/Today.tsx'), 'utf8');
const premiumRecipesSource = readFileSync(resolve(testDir, '../../pages/PremiumRecipes.tsx'), 'utf8');

const activePlan: PremiumPlan = {
  id: 'plan-1',
  title: 'staging_seed_weight_loss_14_day_test_plan',
  subtitle: 'Staging-only minimal Premium catalog seed',
  goalType: 'weight_loss',
  durationDays: 14,
  difficulty: 'staging_test',
  isActive: true,
};

const day1: PremiumPlanDay = {
  id: 'day-1',
  planId: 'plan-1',
  dayNumber: 1,
  calories: 1850,
  protein: 135,
  fat: 58,
  carbs: 190,
  workoutTitle: 'staging_seed_light_walk',
  workoutDurationMin: 30,
  workoutFocus: 'recovery',
};

const day2: PremiumPlanDay = {
  id: 'day-2',
  planId: 'plan-1',
  dayNumber: 2,
  calories: 1900,
  protein: 140,
  fat: 60,
  carbs: 195,
  workoutTitle: '',
  workoutDurationMin: null,
  workoutFocus: '',
};

const mealSlots: PremiumMealSlot[] = [
  {
    id: 'slot-dinner',
    dayId: 'day-1',
    mealType: 'dinner',
    title: 'staging_seed_day1_dinner',
    calories: 610,
    protein: 43,
    fat: 24,
    carbs: 48,
    sortOrder: 3,
  },
  {
    id: 'slot-breakfast',
    dayId: 'day-1',
    mealType: 'breakfast',
    title: 'staging_seed_day1_breakfast',
    calories: 410,
    protein: 31,
    fat: 10,
    carbs: 52,
    sortOrder: 1,
  },
  {
    id: 'slot-lunch',
    dayId: 'day-1',
    mealType: 'lunch',
    title: 'staging_seed_day1_lunch',
    calories: 560,
    protein: 45,
    fat: 16,
    carbs: 58,
    sortOrder: 2,
  },
  {
    id: 'slot-snack',
    dayId: 'day-1',
    mealType: 'snack',
    title: 'staging_seed_day1_snack',
    calories: 260,
    protein: 24,
    fat: 6,
    carbs: 28,
    sortOrder: 4,
  },
];

const oatsRecipe: PremiumRecipeDetail = {
  id: 'recipe-oats',
  title: 'staging_seed_protein_oats',
  category: 'breakfast',
  calories: 410,
  protein: 31,
  fat: 10,
  carbs: 52,
  cookingTimeMin: 10,
  difficultyLabel: 'staging_test_easy',
  isActive: true,
  ingredients: [
    {
      id: 'ingredient-oats',
      recipeId: 'recipe-oats',
      name: 'staging_seed_oats',
      amountG: 45,
      displayAmount: 'half cup oats',
      sortOrder: 1,
    },
  ],
  steps: [
    {
      id: 'step-oats',
      recipeId: 'recipe-oats',
      stepNumber: 1,
      instruction: 'Mix oats with hot water or milk until soft.',
    },
  ],
  hints: [
    {
      id: 'hint-oats',
      recipeId: 'recipe-oats',
      text: 'No scale: use one small bowl of oats and one scoop protein.',
      sortOrder: 1,
    },
  ],
};

const eggsRecipe: PremiumRecipeDetail = {
  ...oatsRecipe,
  id: 'recipe-eggs',
  title: 'staging_seed_egg_plate',
  category: 'breakfast',
  calories: 390,
  protein: 29,
  fat: 18,
  carbs: 28,
  ingredients: [],
  steps: [],
  hints: [],
};

test('premium today adapter maps two seeded days without synthesizing days 3-14', () => {
  const days = mapPremiumPlanDaysToTodayDays([day2, day1], { 'day-1': mealSlots }, { 'slot-breakfast': oatsRecipe });

  assert.equal(days.length, 2);
  assert.deepEqual(
    days.map((day) => day.day),
    [1, 2]
  );
  assert.equal(days.some((day) => day.day === 14), false);
  assert.equal(days[0]?.macros, '1850 ккал · Б 135 · Ж 58 · У 190');
  assert.equal(days[0]?.catalogDayId, 'day-1');
  assert.equal(days[0]?.workout?.duration, '30 минут');
  assert.equal(days[1]?.workout, null);
});

test('premium today adapter maps meal slots in breakfast lunch dinner snack order', () => {
  const meals = mapPremiumMealSlotsToTodayMeals(mealSlots, { 'slot-breakfast': oatsRecipe });

  assert.deepEqual(
    meals.map((meal) => meal.title),
    ['Завтрак', 'Обед', 'Ужин', 'Перекус']
  );
  assert.equal(meals[0]?.summary, 'staging_seed_protein_oats');
  assert.equal(meals[0]?.calories, '410 ккал');
  assert.equal(meals[0]?.macroDetails, 'Б 31 · Ж 10 · У 52');
  assert.equal(meals[0]?.catalogSlotId, 'slot-breakfast');
  assert.equal(meals[0]?.catalogPrimaryRecipeId, 'recipe-oats');
});

test('premium today adapter maps recipe detail to meal ingredients steps and hints', () => {
  const meal = mapPremiumRecipeDetailToTodayMealDetail(oatsRecipe, mealSlots[1]);

  assert.deepEqual(meal.ingredients, ['staging_seed_oats — half cup oats']);
  assert.deepEqual(meal.portionHints, ['No scale: use one small bowl of oats and one scoop protein.']);
  assert.deepEqual(meal.steps, ['Mix oats with hot water or milk until soft.']);
  assert.equal(meal.summary, 'staging_seed_protein_oats');
  assert.equal(meal.title, 'Завтрак');
});

test('premium today adapter maps primary and replacement recipe options', () => {
  const options: PremiumMealRecipeOption[] = [
    {
      id: 'option-replacement',
      mealSlotId: 'slot-breakfast',
      recipeId: 'recipe-eggs',
      optionType: 'replacement',
      label: 'staging_seed_replacement',
      sortOrder: 2,
    },
    {
      id: 'option-primary',
      mealSlotId: 'slot-breakfast',
      recipeId: 'recipe-oats',
      optionType: 'primary',
      label: 'staging_seed_primary',
      sortOrder: 1,
    },
  ];

  const replacements = mapMealRecipeOptionsToReplacementOptions(options, {
    'recipe-oats': oatsRecipe,
    'recipe-eggs': eggsRecipe,
  });

  assert.deepEqual(
    replacements.map((option) => option.optionType),
    ['primary', 'replacement']
  );
  assert.equal(replacements[0]?.summary, 'staging_seed_protein_oats');
  assert.equal(replacements[1]?.summary, 'staging_seed_egg_plate');
  assert.equal(replacements[1]?.note, 'staging_seed_replacement');
});

test('premium today adapter maps derived shopping to grouped in-memory shape', () => {
  const items: PremiumShoppingListItem[] = [
    {
      name: 'staging_seed_oats',
      amountG: 45,
      displayAmounts: ['half cup oats'],
      recipeIds: ['recipe-oats'],
    },
    {
      name: 'staging_seed_banana',
      amountG: null,
      displayAmounts: ['one small banana'],
      recipeIds: ['recipe-oats'],
    },
  ];

  const groups = mapDerivedShoppingListToShoppingGroups(items);

  assert.equal(groups.length, 1);
  assert.equal(groups[0]?.title, 'Список');
  assert.deepEqual(
    groups[0]?.products.map((product) => product.name),
    ['staging_seed_banana', 'staging_seed_oats']
  );
  assert.equal(groups[0]?.products[0]?.amount, 0);
  assert.equal(groups[0]?.products[0]?.unit, 'г');
  assert.equal(groups[0]?.products[0]?.isDerivedCatalogAmount, true);
});

test('premium today adapter builds Today plan from catalog input', () => {
  const plan = buildTodayPlanFromPremiumCatalog({
    plan: activePlan,
    days: [day1, day2],
    slotsByDayId: {
      'day-1': mealSlots,
    },
    primaryRecipeBySlotId: {
      'slot-breakfast': oatsRecipe,
    },
  });

  assert.equal(plan.id, 'plan-1');
  assert.equal(plan.kind, 'nutrition');
  assert.equal(plan.title, 'staging_seed_weight_loss_14_day_test_plan');
  assert.equal(plan.subtitle, 'Staging-only minimal Premium catalog seed · 14 дней');
  assert.equal(plan.days.length, 2);
  assert.equal(plan.days[0]?.meals.length, 4);
});

test('premium today adapter empty inputs are safe and fallback-ready', () => {
  assert.deepEqual(mapPremiumPlanDaysToTodayDays(null), []);
  assert.deepEqual(mapPremiumMealSlotsToTodayMeals(undefined), []);
  assert.deepEqual(mapMealRecipeOptionsToReplacementOptions(null), []);
  assert.deepEqual(mapDerivedShoppingListToShoppingGroups(undefined), []);

  assert.deepEqual(mapPremiumPlanToTodayPlan(null), {
    id: '',
    kind: 'nutrition',
    title: '',
    subtitle: '',
    description: '',
    days: [],
  });

  assert.deepEqual(mapPremiumRecipeDetailToTodayMealDetail(null), {
    title: 'Приём пищи',
    summary: 'Блюдо',
    calories: '0 ккал',
    macroDetails: 'Б 0 · Ж 0 · У 0',
    ingredients: [],
    portionHints: [],
    steps: [],
  });
});

test('premium today adapter source stays pure and read-only', () => {
  assert.doesNotMatch(adapterSource, /supabase/i);
  assert.doesNotMatch(adapterSource, /localStorage|window|import\.meta|process\.env/);

  for (const forbiddenPattern of [/\.insert\(/, /\.update\(/, /\.upsert\(/, /\.delete\(/, /\.rpc\(/]) {
    assert.doesNotMatch(adapterSource, forbiddenPattern);
  }

  for (const forbiddenSurface of [
    'user_premium_plan_selections',
    'user_premium_meal_selections',
    'food_diary_entries',
    'workout_entries',
    'public.recipes',
    'premium_shopping_items',
    'user_premium_shopping_checks',
  ]) {
    assert.equal(adapterSource.includes(forbiddenSurface), false, forbiddenSurface);
  }
});

test('/today uses the Today adapter for plan day meal replacement and shopping detail while /premium-recipes stays separate', () => {
  assert.match(todaySource, /premiumTodayAdapter/);
  assert.match(todaySource, /buildTodayPlanFromPremiumCatalog/);
  assert.match(todaySource, /mapPremiumMealSlotsToTodayMeals/);
  assert.match(todaySource, /mapMealRecipeOptionsToReplacementOptions/);
  assert.match(todaySource, /mapDerivedShoppingListToShoppingGroups/);
  assert.match(todaySource, /getPremiumMealSlots\(selectedPlanDay\.catalogDayId\)/);
  assert.match(todaySource, /getMealRecipeOptions\(slot\.id\)/);
  assert.match(todaySource, /getPremiumRecipeDetail\(primaryOption\.recipeId\)/);
  assert.match(todaySource, /getMealRecipeOptions\(selectedMeal\.catalogSlotId\)/);
  assert.match(todaySource, /buildDerivedShoppingList\(selectedPlan\.id/);
  assert.doesNotMatch(premiumRecipesSource, /premiumTodayAdapter/);
});
