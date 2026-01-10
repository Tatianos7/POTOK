/**
 * Скрипт для импорта упражнений в Supabase
 * Запускать вручную через Supabase SQL Editor или через API
 */

import { supabase } from '../lib/supabaseClient';
import { exercisesSeed } from '../data/exercisesSeed';
import { normalizeMuscleNames } from '../utils/muscleNormalizer';

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
    // 0. Удаляем категорию "Ягодицы", если она существует
    const { data: glutesCategory } = await supabase
      .from('exercise_categories')
      .select('id')
      .eq('name', 'Ягодицы')
      .maybeSingle();
    
    if (glutesCategory) {
      // Удаляем все упражнения из категории "Ягодицы"
      const { data: glutesExercises } = await supabase
        .from('exercises')
        .select('id')
        .eq('category_id', glutesCategory.id);
      
      if (glutesExercises && glutesExercises.length > 0) {
        const exerciseIds = glutesExercises.map(ex => ex.id);
        
        // Удаляем связи упражнений с мышцами
        await supabase
          .from('exercise_muscles')
          .delete()
          .in('exercise_id', exerciseIds);
        
        // Удаляем сами упражнения
        await supabase
          .from('exercises')
          .delete()
          .eq('category_id', glutesCategory.id);
      }
      
      // Удаляем саму категорию "Ягодицы"
      await supabase
        .from('exercise_categories')
        .delete()
        .eq('id', glutesCategory.id);
      
      console.log('Категория "Ягодицы" удалена');
    }

    // 1. Создаем категории
    const categories = ['Плечи', 'Руки', 'Грудь', 'Спина', 'Ноги', 'Пресс', 'Кардио'];
    
    for (let i = 0; i < categories.length; i++) {
      const categoryName = categories[i];
      const categoryOrder = i + 1;
      
      // Проверяем, существует ли категория
      const { data: existingCategory } = await supabase
        .from('exercise_categories')
        .select('id, order')
        .eq('name', categoryName)
        .maybeSingle();

      if (existingCategory) {
        categoryCache[categoryName] = existingCategory.id;
        // Обновляем порядок, если он изменился
        if (existingCategory.order !== categoryOrder) {
          const { error: updateError } = await supabase
            .from('exercise_categories')
            .update({ order: categoryOrder })
            .eq('id', existingCategory.id);
          
          if (updateError) {
            console.error(`Ошибка обновления порядка категории ${categoryName}:`, updateError);
          }
        }
      } else {
        // Создаем новую категорию
        const { data: newCategory, error } = await supabase
          .from('exercise_categories')
          .insert({
            name: categoryName,
            order: categoryOrder,
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

      // Проверяем, существует ли упражнение (по точному названию)
      let { data: existingExercise } = await supabase
        .from('exercises')
        .select('id')
        .eq('name', exerciseData.name)
        .eq('category_id', categoryId)
        .eq('is_custom', false)
        .maybeSingle();

      // Если не найдено по точному названию, пытаемся найти похожее (без скобок и доп. текста)
      if (!existingExercise) {
        // Пробуем найти упражнение с похожим названием (без описания в скобках)
        const nameWithoutBrackets = exerciseData.name.replace(/\s*\([^)]*\)\s*/g, '').trim();
        if (nameWithoutBrackets !== exerciseData.name) {
          const { data: similarExercises } = await supabase
            .from('exercises')
            .select('id, name')
            .eq('category_id', categoryId)
            .eq('is_custom', false)
            .ilike('name', `${nameWithoutBrackets}%`);
          
          if (similarExercises && similarExercises.length > 0) {
            // Берем первое похожее упражнение
            existingExercise = similarExercises[0];
            console.log(`Найдено похожее упражнение: "${similarExercises[0].name}" для "${exerciseData.name}"`);
          }
        }
      }

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

      // 5. Удаляем все существующие связи упражнения с мышцами (чтобы обновить их)
      // Это гарантирует, что связи будут актуальными
      await supabase
        .from('exercise_muscles')
        .delete()
        .eq('exercise_id', exerciseId);

      // 6. Создаем связи упражнение-мышца заново (с нормализацией)
      const normalizedMuscles = normalizeMuscleNames(exerciseData.muscles);
      for (const muscleName of normalizedMuscles) {
        const muscleId = muscleCache[muscleName];
        
        if (!muscleId) {
          console.error(`Мышца не найдена: ${muscleName} для упражнения ${exerciseData.name}`);
          continue;
        }

        // Создаем связь
        const { error: linkError } = await supabase
          .from('exercise_muscles')
          .insert({
            exercise_id: exerciseId,
            muscle_id: muscleId,
          });

        if (linkError) {
          console.error(`Ошибка создания связи для ${exerciseData.name} - ${muscleName}:`, linkError);
        } else {
          console.log(`✓ Связь создана: ${exerciseData.name} - ${muscleName}`);
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

