import { DailyMeals, MealEntry } from '../types';

class MealService {
  private readonly MEALS_STORAGE_KEY = 'potok_daily_meals';

  // Get meals for a specific date
  getMealsForDate(userId: string, date: string): DailyMeals {
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

  // Save meals for a specific date
  saveMealsForDate(userId: string, meals: DailyMeals): void {
    try {
      const stored = localStorage.getItem(`${this.MEALS_STORAGE_KEY}_${userId}`);
      const allMeals: Record<string, DailyMeals> = stored ? JSON.parse(stored) : {};
      allMeals[meals.date] = meals;
      localStorage.setItem(`${this.MEALS_STORAGE_KEY}_${userId}`, JSON.stringify(allMeals));
    } catch (error) {
      console.error('Error saving meals:', error);
    }
  }

  // Add meal entry to a specific meal type
  addMealEntry(userId: string, date: string, mealType: 'breakfast' | 'lunch' | 'dinner' | 'snack', entry: MealEntry): void {
    const meals = this.getMealsForDate(userId, date);
    meals[mealType].push(entry);
    this.saveMealsForDate(userId, meals);
  }

  // Remove meal entry
  removeMealEntry(userId: string, date: string, mealType: 'breakfast' | 'lunch' | 'dinner' | 'snack', entryId: string): void {
    const meals = this.getMealsForDate(userId, date);
    meals[mealType] = meals[mealType].filter((entry) => entry.id !== entryId);
    this.saveMealsForDate(userId, meals);
  }

  // Update meal entry
  updateMealEntry(userId: string, date: string, mealType: 'breakfast' | 'lunch' | 'dinner' | 'snack', entryId: string, updatedEntry: MealEntry): void {
    const meals = this.getMealsForDate(userId, date);
    const index = meals[mealType].findIndex((entry) => entry.id === entryId);
    if (index !== -1) {
      meals[mealType][index] = updatedEntry;
      this.saveMealsForDate(userId, meals);
    }
  }

  // Update water intake
  updateWater(userId: string, date: string, glasses: number): void {
    const meals = this.getMealsForDate(userId, date);
    meals.water = glasses;
    this.saveMealsForDate(userId, meals);
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

