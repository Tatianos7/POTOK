/**
 * Автоматическая инициализация данных упражнений при первом запуске
 * Проверяет наличие категорий и мышц, и импортирует их, если их нет
 */

import { supabase } from '../lib/supabaseClient';
import { exerciseService } from '../services/exerciseService';

const INITIALIZATION_KEY = 'exercise_data_initialized';

/**
 * Помечает данные как инициализированные
 */
function markAsInitialized(): void {
  if (typeof window === 'undefined') return;
  localStorage.setItem(INITIALIZATION_KEY, 'true');
}

/**
 * Инициализирует базовые данные упражнений (категории и мышцы)
 * Выполняется автоматически, если категорий нет в базе
 */
export async function initializeExerciseData(): Promise<void> {
  // Если Supabase не настроен, пропускаем инициализацию
  if (!supabase) {
    console.warn('[initializeExerciseData] Supabase не настроен, пропускаем инициализацию');
    return;
  }

  try {
    // Проверяем наличие категорий
    const categories = await exerciseService.getCategories();
    
    // Если категории уже есть, пропускаем инициализацию
    if (categories.length > 0) {
      console.log(`[initializeExerciseData] Найдено ${categories.length} категорий, инициализация не требуется`);
      markAsInitialized();
      return;
    }

    console.log('[initializeExerciseData] Категории не найдены, создаем базовые категории...');
    
    const basicCategories = [
      { name: 'Плечи', order: 1 },
      { name: 'Руки', order: 2 },
      { name: 'Грудь', order: 3 },
      { name: 'Спина', order: 4 },
      { name: 'Ноги', order: 5 },
      { name: 'Пресс', order: 6 },
      { name: 'Кардио', order: 7 },
    ];

    // Пытаемся создать категории через upsert (создаст, если нет, обновит, если есть)
    const { error: upsertError } = await supabase
      .from('exercise_categories')
      .upsert(basicCategories, { 
        onConflict: 'name',
        ignoreDuplicates: false 
      });
    
    if (upsertError) {
      console.error('[initializeExerciseData] Ошибка upsert категорий:', upsertError);
      // Если upsert не работает, пробуем вставить по одной
      for (const category of basicCategories) {
        const { error } = await supabase
          .from('exercise_categories')
          .insert(category)
          .select();
        
        if (error && !error.message.includes('duplicate') && !error.message.includes('unique')) {
          console.error(`[initializeExerciseData] Ошибка создания категории ${category.name}:`, error);
        }
      }
    }

    console.log('[initializeExerciseData] Базовые категории созданы');
    
    // Помечаем как инициализированное только после успешного создания
    markAsInitialized();
    console.log('[initializeExerciseData] Инициализация завершена');

  } catch (error) {
    console.error('[initializeExerciseData] Ошибка инициализации:', error);
    // Не помечаем как инициализированное при ошибке, чтобы попробовать снова
  }
}

/**
 * Сбрасывает флаг инициализации (для тестирования)
 */
export function resetInitialization(): void {
  if (typeof window === 'undefined') return;
  localStorage.removeItem(INITIALIZATION_KEY);
}

