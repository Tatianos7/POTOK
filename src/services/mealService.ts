import { DailyMeals, MealEntry } from '../types';
import { trackEvent } from './analyticsService';
import { supabase } from '../lib/supabaseClient';
import { toUUID } from '../utils/uuid';

class MealService {
  private readonly MEALS_STORAGE_KEY = 'potok_daily_meals';

  // Get meals for a specific date (with Supabase integration)
  async getMealsForDate(userId: string, date: string): Promise<DailyMeals> {
    // Try Supabase first
    if (supabase) {
      try {
        const uuidUserId = toUUID(userId);
        const { data, error } = await supabase
          .from('food_diary_entries')
          .select('*')
          .eq('user_id', uuidUserId)
          .eq('date', date)
          .order('created_at', { ascending: true });

        if (error) {
          console.error('[mealService] Supabase error:', error);
          // Fallback to localStorage
        } else if (data && data.length > 0) {
          // Convert Supabase data to DailyMeals format
          const meals = this.createEmptyMeals(date);
          
          // Group by meal_type
          data.forEach((entry) => {
            const mealEntry: MealEntry = {
              id: entry.id,
              foodId: entry.id, // We'll need to store foodId separately or in metadata
              food: {
                id: entry.id,
                name: entry.product_name,
                calories: Number(entry.calories),
                protein: Number(entry.protein),
                fat: Number(entry.fat),
                carbs: Number(entry.carbs),
                source: 'manual',
                createdAt: entry.created_at,
                updatedAt: entry.created_at,
              },
              weight: Number(entry.weight),
              calories: Number(entry.calories),
              protein: Number(entry.protein),
              fat: Number(entry.fat),
              carbs: Number(entry.carbs),
            };

            if (entry.meal_type === 'breakfast') meals.breakfast.push(mealEntry);
            else if (entry.meal_type === 'lunch') meals.lunch.push(mealEntry);
            else if (entry.meal_type === 'dinner') meals.dinner.push(mealEntry);
            else if (entry.meal_type === 'snack') meals.snack.push(mealEntry);
          });

          // Also sync to localStorage for offline support
          this.saveMealsToLocalStorage(userId, meals);
          return meals;
        }
      } catch (err) {
        console.error('[mealService] Supabase connection error:', err);
        // Fallback to localStorage
      }
    }

    // Fallback to localStorage
    try {
      const stored = localStorage.getItem(`${this.MEALS_STORAGE_KEY}_${userId}`);
      if (!stored) {
        return this.createEmptyMeals(date);
      }

      const allMeals: Record<string, DailyMeals> = JSON.parse(stored);
      return allMeals[date] || this.createEmptyMeals(date);
    } catch (error) {
      console.error('Error loading meals:', error);
      return this.createEmptyMeals(date);
    }
  }

  // Save meals for a specific date (with Supabase integration)
  async saveMealsForDate(userId: string, meals: DailyMeals): Promise<void> {
    // Save to localStorage first (for offline support)
    this.saveMealsToLocalStorage(userId, meals);

    // Try to save to Supabase
    if (supabase) {
      try {
        const uuidUserId = toUUID(userId);
        // Delete existing entries for this date
        await supabase
          .from('food_diary_entries')
          .delete()
          .eq('user_id', uuidUserId)
          .eq('date', meals.date);

        // Insert all entries
        const entriesToInsert = [
          ...meals.breakfast.map((entry) => ({
            user_id: uuidUserId,
            date: meals.date,
            meal_type: 'breakfast' as const,
            product_name: entry.food?.name || 'Unknown',
            protein: entry.protein,
            fat: entry.fat,
            carbs: entry.carbs,
            calories: entry.calories,
            weight: entry.weight,
          })),
          ...meals.lunch.map((entry) => ({
            user_id: uuidUserId,
            date: meals.date,
            meal_type: 'lunch' as const,
            product_name: entry.food?.name || 'Unknown',
            protein: entry.protein,
            fat: entry.fat,
            carbs: entry.carbs,
            calories: entry.calories,
            weight: entry.weight,
          })),
          ...meals.dinner.map((entry) => ({
            user_id: uuidUserId,
            date: meals.date,
            meal_type: 'dinner' as const,
            product_name: entry.food?.name || 'Unknown',
            protein: entry.protein,
            fat: entry.fat,
            carbs: entry.carbs,
            calories: entry.calories,
            weight: entry.weight,
          })),
          ...meals.snack.map((entry) => ({
            user_id: uuidUserId,
            date: meals.date,
            meal_type: 'snack' as const,
            product_name: entry.food?.name || 'Unknown',
            protein: entry.protein,
            fat: entry.fat,
            carbs: entry.carbs,
            calories: entry.calories,
            weight: entry.weight,
          })),
        ];

        if (entriesToInsert.length > 0) {
          const { error } = await supabase
            .from('food_diary_entries')
            .insert(entriesToInsert);

          if (error) {
            console.error('[mealService] Supabase save error:', error);
          }
        }
      } catch (err) {
        console.error('[mealService] Supabase save connection error:', err);
      }
    }
  }

  // Helper: Save to localStorage
  private saveMealsToLocalStorage(userId: string, meals: DailyMeals): void {
    try {
      const stored = localStorage.getItem(`${this.MEALS_STORAGE_KEY}_${userId}`);
      const allMeals: Record<string, DailyMeals> = stored ? JSON.parse(stored) : {};
      allMeals[meals.date] = meals;
      localStorage.setItem(`${this.MEALS_STORAGE_KEY}_${userId}`, JSON.stringify(allMeals));
    } catch (error) {
      console.error('Error saving meals to localStorage:', error);
    }
  }

  // Add meal entry to a specific meal type
  async addMealEntry(userId: string, date: string, mealType: 'breakfast' | 'lunch' | 'dinner' | 'snack', entry: MealEntry): Promise<void> {
    const meals = await this.getMealsForDate(userId, date);
    meals[mealType].push(entry);
    await this.saveMealsForDate(userId, meals);

    // Аналитика: пользователь добавил еду
    // Не блокируем основной флоу, ошибки логируем в консоль
    void trackEvent({
      name: 'add_food',
      userId,
      metadata: {
        date,
        meal_type: mealType,
        food_id: entry.foodId,
        food_name: entry.food?.name,
        calories: entry.calories,
      },
    });
  }

  // Remove meal entry
  async removeMealEntry(userId: string, date: string, mealType: 'breakfast' | 'lunch' | 'dinner' | 'snack', entryId: string): Promise<void> {
    const meals = await this.getMealsForDate(userId, date);
    meals[mealType] = meals[mealType].filter((entry) => entry.id !== entryId);
    await this.saveMealsForDate(userId, meals);

    // Also delete from Supabase if exists
    if (supabase) {
      try {
        const uuidUserId = toUUID(userId);
        await supabase
          .from('food_diary_entries')
          .delete()
          .eq('id', entryId)
          .eq('user_id', uuidUserId);
      } catch (err) {
        console.error('[mealService] Error deleting from Supabase:', err);
      }
    }
  }

  // Update meal entry
  async updateMealEntry(userId: string, date: string, mealType: 'breakfast' | 'lunch' | 'dinner' | 'snack', entryId: string, updatedEntry: MealEntry): Promise<void> {
    const meals = await this.getMealsForDate(userId, date);
    const index = meals[mealType].findIndex((entry) => entry.id === entryId);
    if (index !== -1) {
      meals[mealType][index] = updatedEntry;
      await this.saveMealsForDate(userId, meals);
    }
  }

  // Update water intake
  async updateWater(userId: string, date: string, glasses: number): Promise<void> {
    const meals = await this.getMealsForDate(userId, date);
    meals.water = glasses;
    await this.saveMealsForDate(userId, meals);
    // Note: water is stored in localStorage only, not in Supabase schema
  }

  // Calculate totals for a meal type
  calculateMealTotals(entries: MealEntry[]) {
    return entries.reduce(
      (totals, entry) => ({
        calories: totals.calories + entry.calories,
        protein: totals.protein + entry.protein,
        fat: totals.fat + entry.fat,
        carbs: totals.carbs + entry.carbs,
      }),
      { calories: 0, protein: 0, fat: 0, carbs: 0 }
    );
  }

  // Calculate totals for entire day
  calculateDayTotals(meals: DailyMeals) {
    const allEntries = [
      ...meals.breakfast,
      ...meals.lunch,
      ...meals.dinner,
      ...meals.snack,
    ];
    return this.calculateMealTotals(allEntries);
  }

  // Create empty meals structure
  private createEmptyMeals(date: string): DailyMeals {
    return {
      date,
      breakfast: [],
      lunch: [],
      dinner: [],
      snack: [],
      water: 0,
    };
  }
}

export const mealService = new MealService();

