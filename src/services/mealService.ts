import { DailyMeals, MealEntry, Food } from '../types';
import type { Recipe } from '../types/recipe';
import { trackEvent } from './analyticsService';
import { supabase } from '../lib/supabaseClient';
import { mealEntryNotesService } from './mealEntryNotesService';
import { aiRecommendationsService, DayAnalysisContext } from './aiRecommendationsService';
import { foodIngestionService } from './foodIngestionService';
import { goalService } from './goalService';
import { userStateService } from './userStateService';
import { coachRuntime } from './coachRuntime';

class MealService {
  private readonly MEALS_STORAGE_KEY = 'potok_daily_meals';
  private saveQueue = new Map<string, Promise<void>>();

  private isValidUUID(value: string | null | undefined): boolean {
    if (!value) return false;
    return /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(value);
  }

  private async withRetry<T>(fn: () => Promise<T>, attempts = 2, delayMs = 200): Promise<T> {
    let lastError: unknown;
    for (let attempt = 1; attempt <= attempts; attempt += 1) {
      try {
        return await fn();
      } catch (error) {
        lastError = error;
        if (attempt === attempts) break;
        await new Promise((resolve) => setTimeout(resolve, delayMs * attempt));
      }
    }
    throw lastError;
  }

  private enqueueSave(userId: string, date: string, meals: DailyMeals): Promise<void> {
    const key = `${userId}:${date}`;
    const previous = this.saveQueue.get(key) || Promise.resolve();
    const next = previous
      .catch(() => undefined)
      .then(() => this.saveMealsForDate(userId, meals));

    this.saveQueue.set(
      key,
      next.finally(() => {
        if (this.saveQueue.get(key) === next) {
          this.saveQueue.delete(key);
        }
      })
    );

    return next;
  }

  private async getSessionUserId(userId?: string): Promise<string> {
    if (!supabase) {
      throw new Error('Supabase не инициализирован');
    }

    const { data, error } = await supabase.auth.getUser();
    if (error || !data?.user?.id) {
      throw new Error('Пользователь не авторизован');
    }

    if (userId && userId !== data.user.id) {
      console.warn('[mealService] Передан userId не совпадает с сессией');
    }

    return data.user.id;
  }

  private buildIdempotencyKey(date: string, mealType: 'breakfast' | 'lunch' | 'dinner' | 'snack', foodId?: string): string {
    const safeFoodId = foodId || 'unknown';
    return `${date}:${mealType}:${safeFoodId}`;
  }

  // Единый нормализатор Supabase entry → MealEntry
  // Гарантирует строгую типизацию и полный объект Food
  private mapSupabaseEntryToMealEntry(entry: any): MealEntry {
    if (!entry?.id) {
      throw new Error('Supabase entry without id');
    }

    const foodId = String(entry.canonical_food_id ?? entry.id);
    const weight = Number(entry.weight ?? 0);
    const totalCalories = Number(entry.calories ?? 0);
    const totalProtein = Number(entry.protein ?? 0);
    const totalFat = Number(entry.fat ?? 0);
    const totalCarbs = Number(entry.carbs ?? 0);
    const per100Factor = weight > 0 ? 100 / weight : 0;

    const food: Food = {
      id: foodId,
      name: String(entry.product_name ?? 'Unknown'),
      name_original: undefined,
      barcode: null,
      calories: totalCalories * per100Factor,
      protein: totalProtein * per100Factor,
      fat: totalFat * per100Factor,
      carbs: totalCarbs * per100Factor,
      fiber: Number(entry.fiber ?? 0),
      unit: entry.base_unit ?? 'г',
      category: undefined,
      brand: null,
      source: 'user',
      canonical_food_id: entry.canonical_food_id ?? null,
      photo: null,
      aliases: undefined,
      autoFilled: undefined,
      popularity: undefined,
      createdAt: String(entry.created_at ?? new Date().toISOString()),
      updatedAt: String(entry.created_at ?? new Date().toISOString()),
    };

    return {
      id: String(entry.id),
      foodId: foodId,
      food,
      weight: weight,
      calories: totalCalories,
      protein: totalProtein,
      fat: totalFat,
      carbs: totalCarbs,
      baseUnit: entry.base_unit ?? 'г',
      displayUnit: entry.display_unit ?? 'г',
      displayAmount: Number(entry.display_amount ?? entry.weight ?? 0),
      idempotencyKey: entry.idempotency_key ?? undefined,
      canonicalFoodId: food.canonical_food_id ?? null,
    };
  }

  private assertMealEntryValid(entry: MealEntry): void {
    const values = [
      entry.weight,
      entry.calories,
      entry.protein,
      entry.fat,
      entry.carbs,
    ];
    const invalid = values.some((value) => !Number.isFinite(value) || value < 0);
    if (invalid) {
      throw new Error('[mealService] Invalid macro values in meal entry');
    }
    if (!entry.food?.name || entry.food.name.trim().length === 0) {
      throw new Error('[mealService] Invalid food name in meal entry');
    }
  }

  private buildDayAnalysisContext(meals: DailyMeals, goals?: Awaited<ReturnType<typeof goalService.getUserGoal>>): DayAnalysisContext {
    const sum = (entries: MealEntry[]) =>
      entries.reduce(
        (acc, entry) => ({
          calories: acc.calories + entry.calories,
          protein: acc.protein + entry.protein,
          fat: acc.fat + entry.fat,
          carbs: acc.carbs + entry.carbs,
          weight: acc.weight + entry.weight,
        }),
        { calories: 0, protein: 0, fat: 0, carbs: 0, weight: 0 }
      );

    const breakfast = sum(meals.breakfast);
    const lunch = sum(meals.lunch);
    const dinner = sum(meals.dinner);
    const snack = sum(meals.snack);

    return {
      date: meals.date,
      totals: {
        calories: breakfast.calories + lunch.calories + dinner.calories + snack.calories,
        protein: breakfast.protein + lunch.protein + dinner.protein + snack.protein,
        fat: breakfast.fat + lunch.fat + dinner.fat + snack.fat,
        carbs: breakfast.carbs + lunch.carbs + dinner.carbs + snack.carbs,
        weight: breakfast.weight + lunch.weight + dinner.weight + snack.weight,
      },
      meals: {
        breakfast: meals.breakfast.length,
        lunch: meals.lunch.length,
        dinner: meals.dinner.length,
        snack: meals.snack.length,
      },
      foods: [
        ...meals.breakfast,
        ...meals.lunch,
        ...meals.dinner,
        ...meals.snack,
      ].map((entry) => {
        const canonicalFoodId = this.isValidUUID(entry.canonicalFoodId ?? null)
          ? entry.canonicalFoodId ?? null
          : this.isValidUUID(entry.food?.canonical_food_id ?? null)
            ? entry.food?.canonical_food_id ?? null
            : null;
        return {
          canonical_food_id: canonicalFoodId,
          name: entry.food?.name ?? entry.foodId,
          grams: entry.weight,
          calories: entry.calories,
          protein: entry.protein,
          fat: entry.fat,
          carbs: entry.carbs,
        };
      }),
      goals: goals ? {
        calories: goals.calories,
        protein: goals.protein,
        fat: goals.fat,
        carbs: goals.carbs,
      } : null,
    };
  }

  async closeDay(userId: string, date: string): Promise<void> {
    const meals = await this.getFoodDiaryByDate(userId, date);
    const goals = await goalService.getUserGoal(userId);
    const periodEnd = date;
    const periodStart = new Date(new Date(date).getTime() - 29 * 86400000).toISOString().split('T')[0];
    const userState = await userStateService.buildState(userId, { fromDate: periodStart, toDate: periodEnd });
    const context = this.buildDayAnalysisContext(meals, goals);
    const totals = this.calculateDayTotals(meals);
    const foodIds = Array.from(
      new Set((context.foods || []).map((item) => item.canonical_food_id).filter(Boolean))
    ) as string[];
    const confidenceMin = await foodIngestionService.getMinConfidence(foodIds);
    const blockAi = await foodIngestionService.shouldBlockAiForLowConfidence(foodIds);
    if (blockAi) {
      await aiRecommendationsService.queueDayRecommendation(userId, {
        ...context,
        user_state: userState,
        confidence_min: confidenceMin ?? undefined,
        confidence_blocked: true,
      } as any);
      return;
    }
    await aiRecommendationsService.queueDayRecommendation(userId, { ...context, user_state: userState } as any);

    if (goals?.calories && totals.calories > goals.calories) {
      await coachRuntime.handleUserEvent(
        {
          type: 'CalorieOverTarget',
          timestamp: new Date().toISOString(),
          payload: { date, calories: totals.calories, goal: goals.calories },
          confidence: 0.7,
          safetyClass: 'normal',
          trustImpact: 0,
        },
        {
          screen: 'Today',
          userMode: 'Manual',
          subscriptionState: 'Free',
        }
      );
    }

    if (goals?.protein && totals.protein < goals.protein) {
      await coachRuntime.handleUserEvent(
        {
          type: 'ProteinBelowTarget',
          timestamp: new Date().toISOString(),
          payload: { date, protein: totals.protein, goal: goals.protein },
          confidence: 0.7,
          safetyClass: 'normal',
          trustImpact: 0,
        },
        {
          screen: 'Today',
          userMode: 'Manual',
          subscriptionState: 'Free',
        }
      );
    }
  }

  async reopenDay(userId: string, date: string): Promise<DailyMeals> {
    const meals = await this.getFoodDiaryByDate(userId, date);
    try {
      await aiRecommendationsService.markDayRecommendationOutdated(userId, date);
    } catch (error) {
      console.error('[mealService] Error marking AI recommendation outdated on reopen:', error);
    }
    return meals;
  }

  // Get meals for a specific date from Supabase (primary source)
  async getFoodDiaryByDate(userId: string, date: string): Promise<DailyMeals> {
    // Если в localStorage нет, загружаем из Supabase
    const meals = this.createEmptyMeals(date);

    if (!supabase) {
      console.warn('[mealService] Supabase not available, returning empty meals');
      return meals;
    }

    try {
      const sessionUserId = await this.getSessionUserId(userId);
      const { data, error } = await supabase
        .from('food_diary_entries')
        .select('*')
        .eq('user_id', sessionUserId)
        .eq('date', date)
        .order('meal_type', { ascending: true })
        .order('created_at', { ascending: true });

      if (error) {
        console.error('[mealService] Supabase error:', error);
        return meals;
      }

      if (data && data.length > 0) {
        // Определяем тип даты для фильтрации
        const isPast = this.isPastDate(date);
        const isFuture = this.isFutureDate(date);
        
        // Group by meal_type
        data.forEach((entry) => {
          // Фильтруем данные по planned в зависимости от типа даты
          const entryPlanned = (entry as any).planned || false;
          
          // Для прошлых дат показываем только planned = false
          if (isPast && entryPlanned) {
            return; // Пропускаем планируемые записи для прошлых дат
          }
          
          // Для будущих дат показываем только planned = true
          if (isFuture && !entryPlanned) {
            return; // Пропускаем не планируемые записи для будущих дат
          }
          
          const mealEntry = this.mapSupabaseEntryToMealEntry(entry);

          if (entry.meal_type === 'breakfast') meals.breakfast.push(mealEntry);
          else if (entry.meal_type === 'lunch') meals.lunch.push(mealEntry);
          else if (entry.meal_type === 'dinner') meals.dinner.push(mealEntry);
          else if (entry.meal_type === 'snack') meals.snack.push(mealEntry);
        });

        // Загружаем заметки для всех записей
        const allEntryIds = [
          ...meals.breakfast.map(e => e.id),
          ...meals.lunch.map(e => e.id),
          ...meals.dinner.map(e => e.id),
          ...meals.snack.map(e => e.id),
        ];

        if (allEntryIds.length > 0) {
          try {
            const notesMap = await mealEntryNotesService.getNotesByEntryIds(sessionUserId, allEntryIds);
            
            // Присваиваем заметки к записям
            const assignNote = (entry: MealEntry) => {
              entry.note = notesMap[entry.id] || null;
            };
            
            meals.breakfast.forEach(assignNote);
            meals.lunch.forEach(assignNote);
            meals.dinner.forEach(assignNote);
            meals.snack.forEach(assignNote);
          } catch (error) {
            console.error('[mealService] Error loading notes:', error);
            // Продолжаем работу без заметок
          }
        }
      }

      // Загружаем воду из localStorage (вода хранится только в localStorage)
      try {
        const stored = localStorage.getItem(`${this.MEALS_STORAGE_KEY}_${userId}`);
        if (stored) {
          const allMeals: Record<string, DailyMeals> = JSON.parse(stored);
          const localMeals = allMeals[date];
          if (localMeals && typeof localMeals.water === 'number') {
            meals.water = localMeals.water;
          }
        }
      } catch (err) {
        console.error('[mealService] Error loading water from localStorage:', err);
      }

      // Синхронизируем с localStorage
      this.saveMealsToLocalStorage(sessionUserId, meals);

      return meals;
    } catch (err) {
      console.error('[mealService] Supabase connection error:', err);
      return meals;
    }
  }

  // Get meals for a specific date (with Supabase integration and localStorage fallback)
  async getMealsForDate(userId: string, date: string): Promise<DailyMeals> {
    // Приоритет: localStorage для мгновенного UI
    const local = this.getMealsFromLocalStorage(userId, date);
    if (local) return local;

    // Fallback: Supabase (если доступен)
    if (supabase) {
      try {
        return await this.getFoodDiaryByDate(userId, date);
      } catch (err) {
        console.error('[mealService] Error loading from Supabase:', err);
      }
    }

    // Совсем fallback: пустая структура
    return this.createEmptyMeals(date);
  }


  // Check if date is in the future (for planned field)
  private isFutureDate(date: string): boolean {
    const today = new Date().toISOString().split('T')[0];
    return date > today;
  }

  // Check if date is in the past (more than today)
  private isPastDate(date: string): boolean {
    const today = new Date().toISOString().split('T')[0];
    return date < today;
  }

  // Save meals for a specific date (with Supabase integration)
  async saveMealsForDate(userId: string, meals: DailyMeals): Promise<void> {
    // Always persist local snapshot for manual flow resilience
    this.saveMealsToLocalStorage(userId, meals);

    // Try to save to Supabase
    if (supabase) {
      try {
        const sessionUserId = await this.getSessionUserId(userId);
        // Подсчитываем общее количество записей
        const totalEntries = 
          meals.breakfast.length + 
          meals.lunch.length + 
          meals.dinner.length + 
          meals.snack.length;

        // Если нет записей о еде, только удаляем старые записи (если есть)
        if (totalEntries === 0) {
          await this.withRetry(async () =>
            await supabase!
              .from('food_diary_entries')
              .delete()
              .eq('user_id', sessionUserId)
              .eq('date', meals.date)
          );
          this.saveMealsToLocalStorage(sessionUserId, meals);
          try {
            await aiRecommendationsService.markDayRecommendationOutdated(sessionUserId, meals.date);
          } catch (error) {
            console.error('[mealService] Error marking AI recommendation outdated:', error);
          }
          return;
        }

        // Insert all entries (без поля planned, т.к. в БД его может не быть)
        // Валидация и нормализация числовых значений
        const safeNumber = (value: number | undefined | null): number => {
          const num = Number(value);
          return isNaN(num) || !isFinite(num) ? 0 : Math.max(0, num);
        };

        const baseEntry = (entry: MealEntry, mealType: 'breakfast' | 'lunch' | 'dinner' | 'snack') => ({
          user_id: sessionUserId,
          date: meals.date,
          meal_type: mealType,
          product_name: (entry.food?.name || 'Unknown').trim() || 'Unknown',
          protein: safeNumber(entry.protein),
          fat: safeNumber(entry.fat),
          carbs: safeNumber(entry.carbs),
          fiber: safeNumber(entry.food?.fiber ?? 0),
          calories: safeNumber(entry.calories),
          weight: safeNumber(entry.weight),
          base_unit: entry.baseUnit ?? 'г',
          display_unit: entry.displayUnit ?? entry.baseUnit ?? 'г',
          display_amount: safeNumber(entry.displayAmount ?? entry.weight),
          canonical_food_id: this.isValidUUID(entry.canonicalFoodId)
            ? entry.canonicalFoodId
            : this.isValidUUID(entry.food?.canonical_food_id ?? null)
              ? entry.food?.canonical_food_id ?? null
              : null,
          idempotency_key: entry.idempotencyKey || this.buildIdempotencyKey(meals.date, mealType, entry.foodId),
        });

        const entriesToInsert = [
          ...meals.breakfast.map((entry) => baseEntry(entry, 'breakfast')),
          ...meals.lunch.map((entry) => baseEntry(entry, 'lunch')),
          ...meals.dinner.map((entry) => baseEntry(entry, 'dinner')),
          ...meals.snack.map((entry) => baseEntry(entry, 'snack')),
        ];
        const entryIds = [
          ...meals.breakfast.map((entry) => entry.id),
          ...meals.lunch.map((entry) => entry.id),
          ...meals.dinner.map((entry) => entry.id),
          ...meals.snack.map((entry) => entry.id),
        ].filter((id): id is string => Boolean(id));

        // Валидация инвариантов
        [...meals.breakfast, ...meals.lunch, ...meals.dinner, ...meals.snack].forEach((entry) =>
          this.assertMealEntryValid(entry)
        );

        if (entriesToInsert.length > 0) {
          const validEntries = entriesToInsert.filter((entry) => {
            const isValid =
              entry.user_id &&
              entry.date &&
              entry.meal_type &&
              entry.product_name &&
              entry.product_name.trim() !== '' &&
              typeof entry.protein === 'number' &&
              typeof entry.fat === 'number' &&
              typeof entry.carbs === 'number' &&
              typeof entry.calories === 'number' &&
              typeof entry.weight === 'number' &&
              entry.idempotency_key;

            if (!isValid) {
              console.warn('[mealService] Invalid entry skipped:', entry);
            }
            return isValid;
          });

          if (validEntries.length === 0) {
            console.warn('[mealService] No valid entries to insert after validation');
            return;
          }

          const incomingKeys = new Set(validEntries.map((entry) => entry.idempotency_key));
          const incomingIds = new Set(entryIds);

          const { data: existingRows, error: existingError } = await this.withRetry(async () =>
            await supabase!
              .from('food_diary_entries')
              .select('id,idempotency_key')
              .eq('user_id', sessionUserId)
              .eq('date', meals.date)
          );

          if (existingError) {
            console.warn('[mealService] Failed to load existing entries:', existingError.message);
          }

          const staleKeys: string[] = [];
          const staleIds: string[] = [];

          (existingRows ?? []).forEach((row: { id?: string; idempotency_key?: string | null }) => {
            const rowKey = row.idempotency_key ? String(row.idempotency_key) : null;
            if (rowKey) {
              if (!incomingKeys.has(rowKey)) {
                staleKeys.push(rowKey);
              }
            } else if (row?.id) {
              const rowId = String(row.id);
              if (!incomingIds.has(rowId)) {
                staleIds.push(rowId);
              }
            }
          });

          if (staleKeys.length > 0) {
            await this.withRetry(async () =>
              await supabase!
                .from('food_diary_entries')
                .delete()
                .eq('user_id', sessionUserId)
                .eq('date', meals.date)
                .in('idempotency_key', staleKeys)
            );
          }

          if (staleIds.length > 0) {
            await this.withRetry(async () =>
              await supabase!
                .from('food_diary_entries')
                .delete()
                .eq('user_id', sessionUserId)
                .eq('date', meals.date)
                .in('id', staleIds)
            );
          }

          const upsert = (entries: Record<string, unknown>[]) =>
            this.withRetry(async () =>
              await supabase!
                .from('food_diary_entries')
                .upsert(entries, { onConflict: 'user_id,idempotency_key' })
            );

          const { error: upsertError } = await upsert(validEntries as Record<string, unknown>[]);
          if (upsertError) {
            const message = upsertError.message ?? '';
            const missingDisplayFields =
              upsertError.code === '42703' ||
              message.includes('base_unit') ||
              message.includes('display_unit') ||
              message.includes('display_amount');

            if (missingDisplayFields) {
              const stripped = validEntries.map((entry) => {
                const { base_unit, display_unit, display_amount, ...rest } = entry as Record<string, unknown>;
                return rest;
              });
              const { error: retryError } = await upsert(stripped);
              if (retryError) {
                console.warn('[mealService] Failed to upsert after stripping display fields:', retryError.message);
                return;
              }
            } else {
              console.warn('[mealService] Failed to upsert to Supabase:', upsertError.message);
              return;
            }
          }

          this.saveMealsToLocalStorage(sessionUserId, meals);
          try {
            await aiRecommendationsService.markDayRecommendationOutdated(sessionUserId, meals.date);
          } catch (error) {
            console.error('[mealService] Error marking AI recommendation outdated:', error);
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
      console.log('[mealService] Saving to localStorage:', { date: meals.date, water: meals.water });
      localStorage.setItem(`${this.MEALS_STORAGE_KEY}_${userId}`, JSON.stringify(allMeals));
      console.log('[mealService] Saved successfully, verifying...');
      // Проверяем, что сохранилось
      const verify = localStorage.getItem(`${this.MEALS_STORAGE_KEY}_${userId}`);
      if (verify) {
        const verifyData = JSON.parse(verify);
        console.log('[mealService] Verified water in storage:', verifyData[meals.date]?.water);
      }
    } catch (error) {
      console.error('[mealService] Error saving meals to localStorage:', error);
    }
  }

  // Add meal entry to a specific meal type
  async addMealEntry(userId: string, date: string, mealType: 'breakfast' | 'lunch' | 'dinner' | 'snack', entry: MealEntry): Promise<void> {
    // Получаем текущие данные из localStorage для мгновенного обновления
    let meals: DailyMeals;
    try {
      const stored = localStorage.getItem(`${this.MEALS_STORAGE_KEY}_${userId}`);
      if (stored) {
        const allMeals: Record<string, DailyMeals> = JSON.parse(stored);
        meals = allMeals[date] || this.createEmptyMeals(date);
      } else {
        meals = this.createEmptyMeals(date);
      }
    } catch (error) {
      console.error('[mealService] Error loading from localStorage:', error);
      meals = this.createEmptyMeals(date);
    }

    const entryWithKey: MealEntry = {
      ...entry,
      baseUnit: entry.baseUnit || 'г',
      displayUnit: entry.displayUnit || 'г',
      displayAmount: Number(entry.displayAmount ?? entry.weight) || 0,
      idempotencyKey: entry.idempotencyKey || this.buildIdempotencyKey(date, mealType, entry.foodId),
    };

    // Добавляем новую запись или заменяем существующую (idempotency)
    const existingIndex = meals[mealType].findIndex(
      (item) => item.idempotencyKey && item.idempotencyKey === entryWithKey.idempotencyKey
    );
    if (existingIndex >= 0) {
      meals[mealType][existingIndex] = entryWithKey;
    } else {
      meals[mealType].push(entryWithKey);
    }
    
    // Затем сохраняем в Supabase в фоне
    await this.enqueueSave(userId, date, meals);

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

    await coachRuntime.handleUserEvent(
      {
        type: 'MealLogged',
        timestamp: new Date().toISOString(),
        payload: {
          date,
          meal_type: mealType,
          calories: entry.calories,
          protein: entry.protein,
          food_id: entry.foodId,
        },
        confidence: 0.8,
        safetyClass: 'normal',
        trustImpact: 0,
      },
      {
        screen: 'Today',
        userMode: 'Manual',
        subscriptionState: 'Free',
      }
    );
  }

  async addRecipeEntry(
    userId: string,
    date: string,
    mealType: 'breakfast' | 'lunch' | 'dinner' | 'snack',
    recipe: Recipe
  ): Promise<void> {
    const totalWeight =
      recipe.ingredients?.reduce((sum, ing) => sum + (Number(ing.grams) || 0), 0) || 0;
    const weight = totalWeight > 0 ? totalWeight : 100;
    const entry: MealEntry = {
      id: `recipe-${recipe.id}-${Date.now()}`,
      foodId: recipe.id,
      food: {
        id: recipe.id,
        name: recipe.name,
        calories: recipe.totalCalories ?? 0,
        protein: recipe.totalProteins ?? 0,
        fat: recipe.totalFats ?? 0,
        carbs: recipe.totalCarbs ?? 0,
        source: 'user',
        createdAt: recipe.createdAt,
        updatedAt: recipe.updatedAt,
      },
      weight,
      calories: recipe.totalCalories ?? 0,
      protein: recipe.totalProteins ?? 0,
      fat: recipe.totalFats ?? 0,
      carbs: recipe.totalCarbs ?? 0,
      recipeId: recipe.id,
    };

    await this.addMealEntry(userId, date, mealType, entry);
  }

  // Remove meal entry
  async removeMealEntry(userId: string, date: string, mealType: 'breakfast' | 'lunch' | 'dinner' | 'snack', entryId: string): Promise<void> {
    let sessionUserId = userId;
    try {
      sessionUserId = await this.getSessionUserId(userId);
    } catch (error) {
      console.warn('[mealService] removeMealEntry: no active session, using local storage only');
    }
    // Получаем текущие данные из localStorage для мгновенного обновления
    let meals: DailyMeals;
    try {
      const stored = localStorage.getItem(`${this.MEALS_STORAGE_KEY}_${sessionUserId}`);
      if (stored) {
        const allMeals: Record<string, DailyMeals> = JSON.parse(stored);
        meals = allMeals[date] || this.createEmptyMeals(date);
      } else {
        meals = this.createEmptyMeals(date);
      }
    } catch (error) {
      console.error('[mealService] Error loading from localStorage:', error);
      meals = this.createEmptyMeals(date);
    }

    // Удаляем запись
    meals[mealType] = meals[mealType].filter((entry) => entry.id !== entryId);
    
    // Затем сохраняем в Supabase в фоне
    await this.enqueueSave(sessionUserId, date, meals);

    // Also delete from Supabase if exists and session is valid
    if (supabase && sessionUserId) {
      try {
        await supabase
          .from('food_diary_entries')
          .delete()
          .eq('id', entryId)
          .eq('user_id', sessionUserId);
      } catch (err) {
        console.error('[mealService] Error deleting from Supabase:', err);
      }
    }
  }

  // Clear all entries from a specific meal type
  async clearMealType(userId: string, date: string, mealType: 'breakfast' | 'lunch' | 'dinner' | 'snack'): Promise<void> {
    let sessionUserId = userId;
    try {
      sessionUserId = await this.getSessionUserId(userId);
    } catch (error) {
      console.warn('[mealService] clearMealType: no active session, using local storage only');
    }
    // Получаем текущие данные из localStorage для мгновенного обновления
    let meals: DailyMeals;
    try {
      const stored = localStorage.getItem(`${this.MEALS_STORAGE_KEY}_${sessionUserId}`);
      if (stored) {
        const allMeals: Record<string, DailyMeals> = JSON.parse(stored);
        meals = allMeals[date] || this.createEmptyMeals(date);
      } else {
        meals = this.createEmptyMeals(date);
      }
    } catch (error) {
      console.error('[mealService] Error loading from localStorage:', error);
      meals = this.createEmptyMeals(date);
    }

    // Очищаем все записи выбранного приёма пищи
    meals[mealType] = [];
    
    // Затем сохраняем в Supabase в фоне
    await this.enqueueSave(sessionUserId, date, meals);

    // Также удаляем все записи этого приёма пищи из Supabase, если сессия валидна
    if (supabase && sessionUserId) {
      try {
        const mealTypeMap: Record<string, string> = {
          breakfast: 'breakfast',
          lunch: 'lunch',
          dinner: 'dinner',
          snack: 'snack',
        };
        
        await supabase
          .from('food_diary_entries')
          .delete()
          .eq('user_id', sessionUserId)
          .eq('date', date)
          .eq('meal_type', mealTypeMap[mealType]);
      } catch (err) {
        console.error('[mealService] Error deleting meal type from Supabase:', err);
      }
    }
  }

  // Save note for a specific meal type
  async saveMealNote(userId: string, date: string, mealType: 'breakfast' | 'lunch' | 'dinner' | 'snack', note: string): Promise<void> {
    // Получаем текущие данные из localStorage
    let meals: DailyMeals;
    try {
      const stored = localStorage.getItem(`${this.MEALS_STORAGE_KEY}_${userId}`);
      if (stored) {
        const allMeals: Record<string, DailyMeals> = JSON.parse(stored);
        meals = allMeals[date] || this.createEmptyMeals(date);
      } else {
        meals = this.createEmptyMeals(date);
      }
    } catch (error) {
      console.error('[mealService] Error loading from localStorage:', error);
      meals = this.createEmptyMeals(date);
    }

    // Инициализируем notes, если их нет
    if (!meals.notes) {
      meals.notes = {
        breakfast: null,
        lunch: null,
        dinner: null,
        snack: null,
      };
    }

    // Сохраняем заметку
    meals.notes[mealType] = note.trim() || null;

    // Затем сохраняем в Supabase в фоне
    await this.enqueueSave(userId, date, meals);
  }

  // Update meal entry (используем локальные данные, чтобы избежать устаревших значений)
  async updateMealEntry(userId: string, date: string, mealType: 'breakfast' | 'lunch' | 'dinner' | 'snack', entryId: string, updatedEntry: MealEntry): Promise<void> {
    // Берём актуальные данные из localStorage (быстрее и не даёт устаревших значений)
    const meals = this.getMealsFromLocalStorage(userId, date) || this.createEmptyMeals(date);
    const index = meals[mealType].findIndex((entry) => entry.id === entryId);
    if (index !== -1) {
      meals[mealType][index] = {
        ...updatedEntry,
        weight: Number(updatedEntry.weight) || 0,
        calories: Number(updatedEntry.calories) || 0,
        protein: Number(updatedEntry.protein) || 0,
        fat: Number(updatedEntry.fat) || 0,
        carbs: Number(updatedEntry.carbs) || 0,
        note: updatedEntry.note || null, // Сохраняем заметку
        baseUnit: updatedEntry.baseUnit || 'г',
        displayUnit: updatedEntry.displayUnit || 'г',
        displayAmount: Number(updatedEntry.displayAmount ?? updatedEntry.weight) || 0,
        idempotencyKey: updatedEntry.idempotencyKey || this.buildIdempotencyKey(date, mealType, updatedEntry.foodId),
      };
      await this.enqueueSave(userId, date, meals);
    }
  }

  // Update water intake
  async updateWater(userId: string, date: string, glasses: number): Promise<void> {
    console.log('[mealService] updateWater called:', { userId, date, glasses });
    const meals = await this.getMealsForDate(userId, date);
    console.log('[mealService] Current meals water before update:', meals.water);
    meals.water = glasses;
    console.log('[mealService] Setting water to:', meals.water);
    await this.enqueueSave(userId, date, meals);
    console.log('[mealService] Water saved successfully');
    // Note: water is stored in localStorage only, not in Supabase schema
  }

  // Copy meal entries to another date and meal type
  async copyMeal(
    userId: string,
    sourceDate: string,
    sourceMealType: 'breakfast' | 'lunch' | 'dinner' | 'snack',
    targetDate: string,
    targetMealType: 'breakfast' | 'lunch' | 'dinner' | 'snack',
    selectedEntryIds?: string[] // Опциональный массив ID продуктов для копирования
  ): Promise<void> {
    // Получаем исходный приём пищи (из localStorage для скорости)
    const sourceMeals = await this.getMealsForDate(userId, sourceDate);
    let sourceEntries = sourceMeals[sourceMealType] || [];

    // Если указаны конкретные продукты, фильтруем по ID
    if (selectedEntryIds && selectedEntryIds.length > 0) {
      sourceEntries = sourceEntries.filter(entry => selectedEntryIds.includes(entry.id));
    }

    if (sourceEntries.length === 0) {
      console.warn('[mealService] No entries to copy');
      return;
    }

    // Копирование записей: используем существующий foodId (НЕ создаём новый Food)
    // MealEntry ссылается на СУЩЕСТВУЮЩИЙ продукт из таблицы foods
    const copiedEntries: MealEntry[] = sourceEntries.map((entry): MealEntry => {
      const timestamp = Date.now();
      const random = Math.random();
      const entryId = `${timestamp}-${random}`;
      
      // Используем существующий foodId (НЕ создаём новый Food)
      // foodId должен быть ID продукта из таблицы foods
      const existingFoodId: string = entry.foodId;
      
      // Создаём новый MealEntry с тем же foodId (ссылка на существующий продукт)
      const copiedEntry: MealEntry = {
        id: entryId,
        foodId: existingFoodId, // Используем существующий foodId
        food: entry.food, // Используем существующий объект Food (не создаём новый)
        weight: entry.weight,
        calories: entry.calories,
        protein: entry.protein,
        fat: entry.fat,
        carbs: entry.carbs,
        note: entry.note || null, // Копируем заметку, если есть
        baseUnit: entry.baseUnit || 'г',
        displayUnit: entry.displayUnit || 'г',
        displayAmount: Number(entry.displayAmount ?? entry.weight) || 0,
        idempotencyKey: this.buildIdempotencyKey(targetDate, targetMealType, existingFoodId),
      };
      
      return copiedEntry;
    });

    // Получаем целевой приём пищи (из localStorage для мгновенного обновления)
    const targetMeals = await this.getMealsForDate(userId, targetDate);

    // Добавляем скопированные записи к существующим (если есть)
    targetMeals[targetMealType] = [...(targetMeals[targetMealType] || []), ...copiedEntries];

    // Сохраняем обновлённые данные в Supabase (не ждём завершения)
    this.enqueueSave(userId, targetDate, targetMeals).catch((error) => {
      console.error('[mealService] Error saving copied meals to Supabase:', error);
    });

    // Копируем заметки в Supabase для скопированных продуктов
    if (supabase) {
      try {
        // Копируем заметки для каждого скопированного продукта
        // Используем индекс, так как порядок сохранён при копировании
        const noteCopyPromises = copiedEntries.map(async (copiedEntry, index) => {
          // Находим исходный entry по индексу (порядок сохранён)
          const sourceEntry = sourceEntries[index];
          
          if (sourceEntry?.note) {
            try {
              // Сохраняем заметку для нового entry в Supabase
              await mealEntryNotesService.saveNote(userId, copiedEntry.id, sourceEntry.note);
            } catch (error) {
              console.error('[mealService] Error copying note to Supabase:', error);
              // Продолжаем работу, даже если заметка не скопировалась
            }
          }
        });
        
        // Выполняем копирование заметок в фоне (не блокируем основной процесс)
        Promise.all(noteCopyPromises).catch((error) => {
          console.error('[mealService] Error copying notes:', error);
        });
      } catch (error) {
        console.error('[mealService] Error in note copying process:', error);
        // Продолжаем работу, даже если копирование заметок не удалось
      }
    }
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

  // Get meals for a date range (period)
  async getMealsByPeriod(userId: string, fromDate: string, toDate: string): Promise<DailyMeals[]> {
    const meals: DailyMeals[] = [];
    const startDate = new Date(fromDate);
    const endDate = new Date(toDate);
    
    // Iterate through all dates in the range
    const currentDate = new Date(startDate);
    while (currentDate <= endDate) {
      const dateStr = currentDate.toISOString().split('T')[0];
      const dailyMeals = await this.getMealsForDate(userId, dateStr);
      meals.push(dailyMeals);
      currentDate.setDate(currentDate.getDate() + 1);
    }
    
    return meals;
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
      notes: {
        breakfast: null,
        lunch: null,
        dinner: null,
        snack: null,
      },
    };
  }

  // Чтение из localStorage (приоритет для мгновенного UI)
  private getMealsFromLocalStorage(userId: string, date: string): DailyMeals | null {
    try {
      const stored = localStorage.getItem(`${this.MEALS_STORAGE_KEY}_${userId}`);
      if (stored) {
        const allMeals: Record<string, DailyMeals> = JSON.parse(stored);
        if (allMeals[date]) {
          return allMeals[date];
        }
      }
    } catch (error) {
      console.error('[mealService] Error loading meals from localStorage:', error);
    }
    return null;
  }
}

export const mealService = new MealService();

