/**
 * Read-only validation for the shared exercise catalog.
 *
 * Exercise categories are global catalog data. Production clients must not try
 * to create them because RLS intentionally allows authenticated read access
 * and blocks client writes.
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
 * Checks that the shared exercise category catalog is readable.
 */
export async function initializeExerciseData(): Promise<void> {
  if (!supabase) {
    console.warn('[initializeExerciseData] Supabase не настроен, проверка каталога пропущена');
    return;
  }

  try {
    const categories = await exerciseService.getCategories();
    
    if (categories.length > 0) {
      console.log(`[initializeExerciseData] Найдено ${categories.length} категорий`);
      markAsInitialized();
      return;
    }

    console.warn(
      '[initializeExerciseData] Категории упражнений недоступны или пусты. ' +
      'Клиент не создает shared read-only catalog; проверьте catalog seed/RLS, если это повторяется после входа.'
    );
  } catch (error) {
    console.warn('[initializeExerciseData] Проверка каталога упражнений не выполнена:', error);
  }
}

/**
 * Сбрасывает флаг инициализации (для тестирования)
 */
export function resetInitialization(): void {
  if (typeof window === 'undefined') return;
  localStorage.removeItem(INITIALIZATION_KEY);
}
