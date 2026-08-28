import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import test from 'node:test';

import {
  PREMIUM_CATALOG_READ_MODE,
  createPremiumCatalogService,
  mapPremiumMealRecipeOption,
  mapPremiumMealSlot,
  mapPremiumPlan,
  mapPremiumPlanDay,
  mapPremiumRecipe,
  mapPremiumRecipeHint,
  mapPremiumRecipeIngredient,
  mapPremiumRecipeStep,
  premiumCatalogService,
} from '../premiumCatalogService';

const testDir = dirname(fileURLToPath(import.meta.url));
const serviceSource = readFileSync(resolve(testDir, '../premiumCatalogService.ts'), 'utf8');

test('premium catalog service exports expected read functions', () => {
  assert.equal(PREMIUM_CATALOG_READ_MODE, 'staging_readonly');

  for (const functionName of [
    'getActivePremiumPlans',
    'getPremiumPlanDetail',
    'getPremiumPlanDays',
    'getPremiumPlanDay',
    'getPremiumMealSlots',
    'getPremiumRecipeLibrary',
    'getPremiumRecipeDetail',
    'getMealRecipeOptions',
    'buildDerivedShoppingList',
  ]) {
    assert.equal(typeof (premiumCatalogService as unknown as Record<string, unknown>)[functionName], 'function');
  }
});

test('premium catalog service source stays read-only', () => {
  for (const forbiddenPattern of [/\.insert\(/, /\.update\(/, /\.upsert\(/, /\.delete\(/, /\.rpc\(/]) {
    assert.doesNotMatch(serviceSource, forbiddenPattern);
  }

  for (const forbiddenSurface of [
    'service_role',
    'user_premium_plan_selections',
    'user_premium_meal_selections',
    'food_diary_entries',
    'workout_entries',
    'public.recipes',
    'premium_shopping_items',
    'user_premium_shopping_checks',
  ]) {
    assert.equal(serviceSource.includes(forbiddenSurface), false, forbiddenSurface);
  }
});

test('premium catalog service returns typed fallback results without supabase client', async () => {
  const service = createPremiumCatalogService(null);

  assert.deepEqual(await service.getActivePremiumPlans(), {
    ok: false,
    data: [],
    source: 'fallback',
    error: 'supabase_unavailable',
  });

  assert.deepEqual(await service.getPremiumPlanDetail('plan-id'), {
    ok: false,
    data: null,
    source: 'fallback',
    error: 'supabase_unavailable',
  });

  assert.deepEqual(await service.buildDerivedShoppingList('plan-id', { startDay: 1, endDay: 2 }), {
    ok: false,
    data: [],
    source: 'fallback',
    error: 'supabase_unavailable',
  });
});

test('premium catalog DTO mappers return stable UI shapes', () => {
  assert.deepEqual(
    mapPremiumPlan({
      id: 'plan-id',
      title: 'staging_seed_plan',
      subtitle: null,
      goal_type: 'weight_loss',
      duration_days: 14,
      difficulty: null,
      is_active: true,
      created_at: '2026-08-27T00:00:00Z',
      updated_at: '2026-08-27T00:00:00Z',
    }),
    {
      id: 'plan-id',
      title: 'staging_seed_plan',
      subtitle: '',
      goalType: 'weight_loss',
      durationDays: 14,
      difficulty: '',
      isActive: true,
    }
  );

  assert.deepEqual(
    mapPremiumPlanDay({
      id: 'day-id',
      premium_plan_id: 'plan-id',
      day_number: 1,
      calories: 1850,
      protein: '135.50',
      fat: '58.25',
      carbs: '190.75',
      workout_title: null,
      workout_duration_min: null,
      workout_focus: null,
      created_at: '2026-08-27T00:00:00Z',
      updated_at: '2026-08-27T00:00:00Z',
    }),
    {
      id: 'day-id',
      planId: 'plan-id',
      dayNumber: 1,
      calories: 1850,
      protein: 135.5,
      fat: 58.25,
      carbs: 190.75,
      workoutTitle: '',
      workoutDurationMin: null,
      workoutFocus: '',
    }
  );

  assert.deepEqual(
    mapPremiumMealSlot({
      id: 'slot-id',
      premium_plan_day_id: 'day-id',
      meal_type: 'breakfast',
      title: 'staging_seed_breakfast',
      calories: 410,
      protein: '31',
      fat: '10',
      carbs: '52',
      sort_order: 1,
    }),
    {
      id: 'slot-id',
      dayId: 'day-id',
      mealType: 'breakfast',
      title: 'staging_seed_breakfast',
      calories: 410,
      protein: 31,
      fat: 10,
      carbs: 52,
      sortOrder: 1,
    }
  );

  assert.deepEqual(
    mapPremiumRecipe({
      id: 'recipe-id',
      title: 'staging_seed_recipe',
      category: null,
      calories: 500,
      protein: '35',
      fat: '15',
      carbs: '55',
      cooking_time_min: 15,
      difficulty_label: null,
      is_active: true,
      created_at: '2026-08-27T00:00:00Z',
      updated_at: '2026-08-27T00:00:00Z',
    }),
    {
      id: 'recipe-id',
      title: 'staging_seed_recipe',
      category: '',
      calories: 500,
      protein: 35,
      fat: 15,
      carbs: 55,
      cookingTimeMin: 15,
      difficultyLabel: '',
      isActive: true,
    }
  );

  assert.deepEqual(
    mapPremiumRecipeIngredient({
      id: 'ingredient-id',
      premium_recipe_id: 'recipe-id',
      ingredient_name: 'staging_seed_oats',
      amount_g: '45.25',
      display_amount: null,
      sort_order: 1,
    }),
    {
      id: 'ingredient-id',
      recipeId: 'recipe-id',
      name: 'staging_seed_oats',
      amountG: 45.25,
      displayAmount: '',
      sortOrder: 1,
    }
  );

  assert.deepEqual(
    mapPremiumRecipeStep({
      id: 'step-id',
      premium_recipe_id: 'recipe-id',
      step_number: 1,
      instruction: 'Mix.',
    }),
    {
      id: 'step-id',
      recipeId: 'recipe-id',
      stepNumber: 1,
      instruction: 'Mix.',
    }
  );

  assert.deepEqual(
    mapPremiumRecipeHint({
      id: 'hint-id',
      premium_recipe_id: 'recipe-id',
      hint_text: 'No scale: one handful.',
      sort_order: 1,
    }),
    {
      id: 'hint-id',
      recipeId: 'recipe-id',
      text: 'No scale: one handful.',
      sortOrder: 1,
    }
  );

  assert.deepEqual(
    mapPremiumMealRecipeOption({
      id: 'option-id',
      premium_meal_slot_id: 'slot-id',
      premium_recipe_id: 'recipe-id',
      option_type: null,
      label: null,
      sort_order: 1,
    }),
    {
      id: 'option-id',
      mealSlotId: 'slot-id',
      recipeId: 'recipe-id',
      optionType: '',
      label: '',
      sortOrder: 1,
    }
  );
});
