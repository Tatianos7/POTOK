/**
 * Утилита для проверки данных упражнений в базе
 */

import { supabase } from '../lib/supabaseClient';

export async function checkExercisesData() {
  if (!supabase) {
    console.error('Supabase не инициализирован');
    return {
      categories: 0,
      muscles: 0,
      exercises: 0,
      links: 0,
      error: 'Supabase не инициализирован',
    };
  }

  try {
    // Проверяем категории
    const { data: categories, error: categoriesError } = await supabase
      .from('exercise_categories')
      .select('*', { count: 'exact' });

    // Проверяем мышцы
    const { data: muscles, error: musclesError } = await supabase
      .from('muscles')
      .select('*', { count: 'exact' });

    // Проверяем упражнения
    const { data: exercises, error: exercisesError } = await supabase
      .from('exercises')
      .select('*', { count: 'exact' });

    // Проверяем связи
    const { data: links, error: linksError } = await supabase
      .from('exercise_muscles')
      .select('*', { count: 'exact' });

    const result = {
      categories: categories?.length || 0,
      muscles: muscles?.length || 0,
      exercises: exercises?.length || 0,
      links: links?.length || 0,
      errors: [] as string[],
    };

    if (categoriesError) result.errors.push(`Категории: ${categoriesError.message}`);
    if (musclesError) result.errors.push(`Мышцы: ${musclesError.message}`);
    if (exercisesError) result.errors.push(`Упражнения: ${exercisesError.message}`);
    if (linksError) result.errors.push(`Связи: ${linksError.message}`);

    console.log('📊 Проверка данных упражнений:');
    console.log(`  Категории: ${result.categories}`);
    console.log(`  Мышцы: ${result.muscles}`);
    console.log(`  Упражнения: ${result.exercises}`);
    console.log(`  Связи: ${result.links}`);
    
    if (result.errors.length > 0) {
      console.error('  Ошибки:', result.errors);
    }

    return result;
  } catch (error: any) {
    console.error('Ошибка проверки данных:', error);
    return {
      categories: 0,
      muscles: 0,
      exercises: 0,
      links: 0,
      error: error.message || 'Неизвестная ошибка',
    };
  }
}

// Экспортируем в window для доступа из консоли
if (typeof window !== 'undefined') {
  (window as any).checkExercisesData = checkExercisesData;
}

