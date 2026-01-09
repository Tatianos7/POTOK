/**
 * Скрипт для импорта упражнений в Supabase
 * Запускать вручную через Supabase SQL Editor или через API
 */

import { supabase } from '../lib/supabaseClient';
import { exercisesSeed } from '../data/exercisesSeed';

interface CategoryCache {
  [key: string]: string;
}

interface MuscleCache {
  [key: string]: string;
}

/**
 * Импортирует все упражнения в базу данных
 */
export async function seedExercises(): Promise<void> {
  if (!supabase) {
    console.error('Supabase не инициализирован');
    return;
  }

  const categoryCache: CategoryCache = {};
  const muscleCache: MuscleCache = {};

  try {
    // 1. Создаем категории
    const categories = ['Плечи', 'Руки', 'Грудь', 'Спина', 'Ноги', 'Пресс', 'Кардио'];
    
    for (let i = 0; i < categories.length; i++) {
      const categoryName = categories[i];
      
      // Проверяем, существует ли категория
      const { data: existingCategory } = await supabase
        .from('exercise_categories')
        .select('id')
        .eq('name', categoryName)
        .maybeSingle();

      if (existingCategory) {
        categoryCache[categoryName] = existingCategory.id;
      } else {
        // Создаем новую категорию
        const { data: newCategory, error } = await supabase
          .from('exercise_categories')
          .insert({
            name: categoryName,
            order: i + 1,
          })
          .select('id')
          .single();

        if (error) {
          console.error(`Ошибка создания категории ${categoryName}:`, error);
          continue;
        }

        if (newCategory) {
          categoryCache[categoryName] = newCategory.id;
        }
      }
    }

    // 2. Собираем все уникальные мышцы
    const allMuscles = new Set<string>();
    exercisesSeed.forEach(exercise => {
      exercise.muscles.forEach(muscle => allMuscles.add(muscle));
    });

    // 3. Создаем мышцы
    for (const muscleName of allMuscles) {
      // Проверяем, существует ли мышца
      const { data: existingMuscle } = await supabase
        .from('muscles')
        .select('id')
        .eq('name', muscleName)
        .maybeSingle();

      if (existingMuscle) {
        muscleCache[muscleName] = existingMuscle.id;
      } else {
        // Создаем новую мышцу
        const { data: newMuscle, error } = await supabase
          .from('muscles')
          .insert({
            name: muscleName,
          })
          .select('id')
          .single();

        if (error) {
          console.error(`Ошибка создания мышцы ${muscleName}:`, error);
          continue;
        }

        if (newMuscle) {
          muscleCache[muscleName] = newMuscle.id;
        }
      }
    }

    // 4. Создаем упражнения и связи с мышцами
    for (const exerciseData of exercisesSeed) {
      const categoryId = categoryCache[exerciseData.category];
      
      if (!categoryId) {
        console.error(`Категория не найдена: ${exerciseData.category}`);
        continue;
      }

      // Проверяем, существует ли упражнение
      const { data: existingExercise } = await supabase
        .from('exercises')
        .select('id')
        .eq('name', exerciseData.name)
        .eq('category_id', categoryId)
        .eq('is_custom', false)
        .maybeSingle();

      let exerciseId: string;

      if (existingExercise) {
        exerciseId = existingExercise.id;
        console.log(`Упражнение уже существует: ${exerciseData.name}`);
      } else {
        // Создаем новое упражнение
        const { data: newExercise, error } = await supabase
          .from('exercises')
          .insert({
            name: exerciseData.name,
            category_id: categoryId,
            is_custom: false,
          })
          .select('id')
          .single();

        if (error) {
          console.error(`Ошибка создания упражнения ${exerciseData.name}:`, error);
          continue;
        }

        if (!newExercise) {
          console.error(`Не удалось создать упражнение: ${exerciseData.name}`);
          continue;
        }

        exerciseId = newExercise.id;
      }

      // 5. Создаем связи упражнение-мышца
      for (const muscleName of exerciseData.muscles) {
        const muscleId = muscleCache[muscleName];
        
        if (!muscleId) {
          console.error(`Мышца не найдена: ${muscleName}`);
          continue;
        }

        // Проверяем, существует ли связь
        const { data: existingLink } = await supabase
          .from('exercise_muscles')
          .select('*')
          .eq('exercise_id', exerciseId)
          .eq('muscle_id', muscleId)
          .maybeSingle();

        if (!existingLink) {
          // Создаем связь
          const { error: linkError } = await supabase
            .from('exercise_muscles')
            .insert({
              exercise_id: exerciseId,
              muscle_id: muscleId,
            });

          if (linkError) {
            console.error(`Ошибка создания связи для ${exerciseData.name} - ${muscleName}:`, linkError);
          }
        }
      }
    }

    console.log('Импорт упражнений завершен успешно!');
  } catch (error) {
    console.error('Ошибка импорта упражнений:', error);
    throw error;
  }
}

/**
 * Функция для запуска seed через консоль браузера
 * Использование: window.seedExercises()
 */
if (typeof window !== 'undefined') {
  (window as any).seedExercises = seedExercises;
}

