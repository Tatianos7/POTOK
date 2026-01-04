import { DailyMeals, MealEntry, Food } from '../types';
import { trackEvent } from './analyticsService';
import { supabase } from '../lib/supabaseClient';
import { toUUID } from '../utils/uuid';
import { mealEntryNotesService } from './mealEntryNotesService';

class MealService {
  private readonly MEALS_STORAGE_KEY = 'potok_daily_meals';

  // Единый нормализатор Supabase entry → MealEntry
  // Гарантирует строгую типизацию и полный объект Food
  private mapSupabaseEntryToMealEntry(entry: any): MealEntry {
    if (!entry?.id) {
      throw new Error('Supabase entry without id');
    }

    const foodId = String(entry.id);

    const food: Food = {
      id: foodId,
      name: String(entry.product_name ?? 'Unknown'),
      name_original: undefined,
      barcode: null,
      calories: Number(entry.calories ?? 0),
      protein: Number(entry.protein ?? 0),
      fat: Number(entry.fat ?? 0),
      carbs: Number(entry.carbs ?? 0),
      category: undefined,
      brand: null,
      source: 'manual',
      photo: null,
      aliases: undefined,
      autoFilled: undefined,
      popularity: undefined,
      createdAt: String(entry.created_at ?? new Date().toISOString()),
      updatedAt: String(entry.created_at ?? new Date().toISOString()),
    };

    return {
      id: foodId,
      foodId: foodId,
      food,
      weight: Number(entry.weight ?? 0),
      calories: food.calories,
      protein: food.protein,
      fat: food.fat,
      carbs: food.carbs,
    };
  }

  // Get meals for a specific date from Supabase (primary source)
  async getFoodDiaryByDate(userId: string, date: string): Promise<DailyMeals> {
    // Сначала проверяем localStorage для мгновенного отображения
    try {
      const stored = localStorage.getItem(`${this.MEALS_STORAGE_KEY}_${userId}`);
      if (stored) {
        const allMeals: Record<string, DailyMeals> = JSON.parse(stored);
        const localMeals = allMeals[date];
        if (localMeals) {
          // Возвращаем локальные данные сразу, затем синхронизируем с Supabase в фоне
          this.syncWithSupabase(userId, date, localMeals).catch(err => {
            console.warn('[mealService] Background sync failed:', err);
          });
          return localMeals;
        }
      }
    } catch (error) {
      console.error('[mealService] Error loading from localStorage:', error);
    }

    // Если в localStorage нет, загружаем из Supabase
    const meals = this.createEmptyMeals(date);

    if (!supabase) {
      console.warn('[mealService] Supabase not available, returning empty meals');
      return meals;
    }

    try {
      const uuidUserId = toUUID(userId);
      const { data, error } = await supabase
        .from('food_diary_entries')
        .select('*')
        .eq('user_id', uuidUserId)
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
            const notesMap = await mealEntryNotesService.getNotesByEntryIds(userId, allEntryIds);
            
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
      this.saveMealsToLocalStorage(userId, meals);

      return meals;
    } catch (err) {
      console.error('[mealService] Supabase connection error:', err);
      return meals;
    }
  }

  // Синхронизация данных с Supabase в фоне (не блокирует UI)
  private async syncWithSupabase(userId: string, date: string, localMeals: DailyMeals): Promise<void> {
    if (!supabase) return;

    try {
      const uuidUserId = toUUID(userId);
      const { data } = await supabase
        .from('food_diary_entries')
        .select('*')
        .eq('user_id', uuidUserId)
        .eq('date', date);

      // Если данные в Supabase отличаются от локальных, обновляем localStorage
      if (data && data.length > 0) {
        const supabaseMeals = this.createEmptyMeals(date);
        
        // Определяем тип даты для фильтрации
        const isPast = this.isPastDate(date);
        const isFuture = this.isFutureDate(date);
        
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

          if (entry.meal_type === 'breakfast') supabaseMeals.breakfast.push(mealEntry);
          else if (entry.meal_type === 'lunch') supabaseMeals.lunch.push(mealEntry);
          else if (entry.meal_type === 'dinner') supabaseMeals.dinner.push(mealEntry);
          else if (entry.meal_type === 'snack') supabaseMeals.snack.push(mealEntry);
        });

        // Сохраняем воду из локальных данных
        supabaseMeals.water = localMeals.water;

        // Обновляем localStorage только если данные изменились
        const localStr = JSON.stringify(localMeals);
        const supabaseStr = JSON.stringify(supabaseMeals);
        if (localStr !== supabaseStr) {
          this.saveMealsToLocalStorage(userId, supabaseMeals);
          // Отправляем событие для обновления UI
          window.dispatchEvent(new CustomEvent('meals-synced', { detail: { userId, date, meals: supabaseMeals } }));
        }
      }
    } catch (err) {
      console.warn('[mealService] Sync error:', err);
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
    // Save to localStorage first (for offline support)
    this.saveMealsToLocalStorage(userId, meals);

    // Try to save to Supabase
    if (supabase) {
      try {
        const uuidUserId = toUUID(userId);
        // Подсчитываем общее количество записей
        const totalEntries = 
          meals.breakfast.length + 
          meals.lunch.length + 
          meals.dinner.length + 
          meals.snack.length;

        // Если нет записей о еде, только удаляем старые записи (если есть)
        if (totalEntries === 0) {
          // Удаляем старые записи для этой даты (если есть)
          await supabase
            .from('food_diary_entries')
            .delete()
            .eq('user_id', uuidUserId)
            .eq('date', meals.date);
          // Вода хранится только в localStorage, не сохраняем в Supabase
          return;
        }

        // Insert all entries (без поля planned, т.к. в БД его может не быть)
        // Валидация и нормализация числовых значений
        const safeNumber = (value: number | undefined | null): number => {
          const num = Number(value);
          return isNaN(num) || !isFinite(num) ? 0 : Math.max(0, num);
        };

        const baseEntry = (entry: MealEntry, mealType: 'breakfast' | 'lunch' | 'dinner' | 'snack') => ({
          user_id: uuidUserId,
          date: meals.date,
          meal_type: mealType,
          product_name: (entry.food?.name || 'Unknown').trim() || 'Unknown',
          protein: safeNumber(entry.protein),
          fat: safeNumber(entry.fat),
          carbs: safeNumber(entry.carbs),
          calories: safeNumber(entry.calories),
          weight: safeNumber(entry.weight),
        });

        const entriesToInsert = [
          ...meals.breakfast.map((entry) => baseEntry(entry, 'breakfast')),
          ...meals.lunch.map((entry) => baseEntry(entry, 'lunch')),
          ...meals.dinner.map((entry) => baseEntry(entry, 'dinner')),
          ...meals.snack.map((entry) => baseEntry(entry, 'snack')),
        ];

        if (entriesToInsert.length > 0) {
          // Валидация данных перед отправкой
          const validEntries = entriesToInsert.filter(entry => {
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
              typeof entry.weight === 'number';
            
            if (!isValid) {
              console.warn('[mealService] Invalid entry skipped:', entry);
            }
            return isValid;
          });

          if (validEntries.length === 0) {
            console.warn('[mealService] No valid entries to insert after validation');
            return;
          }

        console.log(`[mealService] Attempting to save ${validEntries.length} entries to Supabase`);

          // Сохраняем текущие данные из Supabase для восстановления при ошибке
          const { data: existingData } = await supabase
            .from('food_diary_entries')
            .select('*')
            .eq('user_id', uuidUserId)
            .eq('date', meals.date);

          // Удаляем старые записи
          await supabase
            .from('food_diary_entries')
            .delete()
            .eq('user_id', uuidUserId)
            .eq('date', meals.date);

          // Пытаемся вставить без поля planned (чтобы не было ошибок 400)
          const { error: insertError } = await supabase
            .from('food_diary_entries')
            .insert(validEntries);

          if (insertError) {
            console.warn('[mealService] Failed to insert to Supabase:', insertError.message);
            // Если вставка не удалась, восстанавливаем старые данные
            if (existingData && existingData.length > 0) {
              console.warn('[mealService] Restoring previous data due to insert failure');
              const restoreEntries = existingData;
              await supabase
                .from('food_diary_entries')
                .insert(restoreEntries);
              console.warn('[mealService] Previous data restored, new data saved to localStorage only');
            }
          } else {
            console.log('[mealService] Successfully saved to Supabase');
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

    // Добавляем новую запись
    meals[mealType].push(entry);
    
    // Сразу сохраняем в localStorage для мгновенного отображения
    this.saveMealsToLocalStorage(userId, meals);
    
    // Затем сохраняем в Supabase в фоне
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

    // Удаляем запись
    meals[mealType] = meals[mealType].filter((entry) => entry.id !== entryId);
    
    // Сразу сохраняем в localStorage для мгновенного отображения
    this.saveMealsToLocalStorage(userId, meals);
    
    // Затем сохраняем в Supabase в фоне
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

  // Clear all entries from a specific meal type
  async clearMealType(userId: string, date: string, mealType: 'breakfast' | 'lunch' | 'dinner' | 'snack'): Promise<void> {
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

    // Очищаем все записи выбранного приёма пищи
    meals[mealType] = [];
    
    // Сразу сохраняем в localStorage для мгновенного отображения
    this.saveMealsToLocalStorage(userId, meals);
    
    // Затем сохраняем в Supabase в фоне
    await this.saveMealsForDate(userId, meals);

    // Также удаляем все записи этого приёма пищи из Supabase
    if (supabase) {
      try {
        const uuidUserId = toUUID(userId);
        const mealTypeMap: Record<string, string> = {
          breakfast: 'breakfast',
          lunch: 'lunch',
          dinner: 'dinner',
          snack: 'snack',
        };
        
        await supabase
          .from('food_diary_entries')
          .delete()
          .eq('user_id', uuidUserId)
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

    // Сразу сохраняем в localStorage для мгновенного отображения
    this.saveMealsToLocalStorage(userId, meals);

    // Затем сохраняем в Supabase в фоне
    await this.saveMealsForDate(userId, meals);
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
      };
      await this.saveMealsForDate(userId, meals);
    }
  }

  // Update water intake
  async updateWater(userId: string, date: string, glasses: number): Promise<void> {
    console.log('[mealService] updateWater called:', { userId, date, glasses });
    const meals = await this.getMealsForDate(userId, date);
    console.log('[mealService] Current meals water before update:', meals.water);
    meals.water = glasses;
    console.log('[mealService] Setting water to:', meals.water);
    await this.saveMealsForDate(userId, meals);
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
      };
      
      return copiedEntry;
    });

    // Получаем целевой приём пищи (из localStorage для мгновенного обновления)
    const targetMeals = await this.getMealsForDate(userId, targetDate);

    // Добавляем скопированные записи к существующим (если есть)
    targetMeals[targetMealType] = [...(targetMeals[targetMealType] || []), ...copiedEntries];

    // Сохраняем обновлённые данные (сначала в localStorage для мгновенного отображения)
    this.saveMealsToLocalStorage(userId, targetMeals);
    
    // Затем сохраняем в Supabase в фоне (не ждём завершения)
    this.saveMealsForDate(userId, targetMeals).catch((error) => {
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

