import { supabase } from '../lib/supabaseClient';
import { Exercise, ExerciseCategory, Muscle, CreateExerciseData } from '../types/workout';
import { normalizeMuscleNames } from '../utils/muscleNormalizer';

class ExerciseService {
  private normalizeMuscles(muscles: Muscle[]): Muscle[] {
    const names = muscles.map((m) => m.name).filter(Boolean);
    const normalized = normalizeMuscleNames(names);
    return normalized.map((name) => ({ id: '', name }));
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
      console.warn('[exerciseService] Передан userId не совпадает с сессией');
    }

    return data.user.id;
  }
  /**
   * Получить все категории упражнений
   */
  async getCategories(): Promise<ExerciseCategory[]> {
    if (!supabase) {
      // Fallback to localStorage
      return this.getCategoriesFromLocalStorage();
    }

    try {
      const { data, error } = await supabase
        .from('exercise_categories')
        .select('*')
        .order('order', { ascending: true });

      if (error) {
        console.error('[exerciseService] Error fetching categories:', error);
        return this.getCategoriesFromLocalStorage();
      }


      // Сохраняем в localStorage для offline
      if (data) {
        localStorage.setItem('exercise_categories', JSON.stringify(data));
      }

      return data || [];
    } catch (error) {
      console.error('[exerciseService] Error:', error);
      return this.getCategoriesFromLocalStorage();
    }
  }

  /**
   * Получить все мышцы
   */
  async getMuscles(): Promise<Muscle[]> {
    if (!supabase) {
      return this.getMusclesFromLocalStorage();
    }

    try {
      const { data, error } = await supabase
        .from('muscles')
        .select('*')
        .order('name', { ascending: true });

      if (error) {
        console.error('[exerciseService] Error fetching muscles:', error);
        return this.getMusclesFromLocalStorage();
      }

      // Сохраняем в localStorage для offline
      if (data) {
        localStorage.setItem('muscles', JSON.stringify(data));
      }

      return data || [];
    } catch (error) {
      console.error('[exerciseService] Error:', error);
      return this.getMusclesFromLocalStorage();
    }
  }

  /**
   * Получить упражнения по категории (используя exercises_full_view)
   */
  async getExercisesByCategory(categoryId: string, userId?: string): Promise<Exercise[]> {
    if (!supabase) {
      return this.getExercisesByCategoryFromLocalStorage(categoryId);
    }

    try {
      // Сначала получаем название категории
      const { data: categoryData } = await supabase
        .from('exercise_categories')
        .select('name')
        .eq('id', categoryId)
        .single();

      if (!categoryData) {
        return [];
      }

      const limit = 500;
      // Используем exercises_full_view для получения упражнений
      const { data, error } = await supabase
        .from('exercises_full_view')
        .select('*')
        .eq('category', categoryData.name)
        .order('exercise_name', { ascending: true })
        .limit(limit);

      if (error) {
        console.error('[exerciseService] Error fetching exercises from view:', error);
        // Fallback на прямой запрос
        return this.getExercisesByCategoryDirect(categoryId, userId);
      }

      // Преобразуем данные из view в формат Exercise с дедупликацией
      const exercisesMap = new Map<string, Exercise>();
      
      (data || []).forEach((ex: any) => {
        const exerciseName = (ex.exercise_name || '').trim();
        if (!exerciseName) return; // Пропускаем упражнения без названия
        
        // Обрабатываем мышцы: может быть массив строк или уже объекты
        let musclesArray: string[] = [];
        if (Array.isArray(ex.muscles)) {
          if (ex.muscles.length > 0 && typeof ex.muscles[0] === 'string') {
            // Если это массив строк
            musclesArray = ex.muscles.filter((m: any) => m && typeof m === 'string' && m.trim() !== '');
          } else if (ex.muscles.length > 0 && typeof ex.muscles[0] === 'object') {
            // Если это массив объектов, извлекаем name
            musclesArray = ex.muscles
              .map((m: any) => m?.name || m)
              .filter((m: any) => m && typeof m === 'string' && m.trim() !== '');
          }
        }
        
        // Если упражнение уже есть в мапе
        if (exercisesMap.has(exerciseName)) {
          const existing = exercisesMap.get(exerciseName)!;
          const existingHasMuscles = existing.muscles && existing.muscles.length > 0;
          const currentHasMuscles = musclesArray.length > 0;
          
          // Приоритет: версия с мышцами > версия без мышц
          if (currentHasMuscles && !existingHasMuscles) {
            // Заменяем версию без мышц на версию с мышцами
            exercisesMap.set(exerciseName, {
              id: ex.id,
              name: exerciseName,
              category_id: categoryId,
              description: undefined,
              is_custom: false,
              created_by_user_id: undefined,
              canonical_exercise_id: ex.canonical_exercise_id ?? ex.id,
              normalized_name: ex.normalized_name ?? null,
              movement_pattern: ex.movement_pattern ?? null,
              equipment_type: ex.equipment_type ?? null,
              difficulty_level: ex.difficulty_level ?? null,
              is_compound: ex.is_compound ?? false,
              energy_system: ex.energy_system ?? null,
              metabolic_equivalent: ex.metabolic_equivalent ?? null,
              muscles: normalizeMuscleNames(musclesArray).map((muscleName: string) => ({
                id: '',
                name: muscleName,
              })),
            });
          } else if (currentHasMuscles && existingHasMuscles && existing.muscles && existing.muscles.length > 0) {
            // Если обе версии с мышцами, объединяем уникальные мышцы (с нормализацией)
            const existingMuscles = existing.muscles; // TypeScript guard
            if (existingMuscles) {
              const normalizedExisting = normalizeMuscleNames(existingMuscles.map((m: Muscle) => m.name));
              const normalizedNew = normalizeMuscleNames(musclesArray);
              
              // Объединяем нормализованные массивы и убираем дубликаты
              const allNormalized = normalizeMuscleNames([...normalizedExisting, ...normalizedNew]);
              
              if (allNormalized.length > normalizedExisting.length) {
                exercisesMap.set(exerciseName, {
                  ...existing,
                  muscles: allNormalized.map((muscleName: string) => ({
                    id: '',
                    name: muscleName,
                  })),
                });
              }
            }
          }
          // Если новая версия без мышц, а существующая с мышцами - игнорируем новую
        } else {
          // Добавляем новое упражнение с нормализацией мышц
          const normalizedMuscles = normalizeMuscleNames(musclesArray);
          exercisesMap.set(exerciseName, {
            id: ex.id,
            name: exerciseName,
            category_id: categoryId,
            description: undefined,
            is_custom: false,
            created_by_user_id: undefined,
            canonical_exercise_id: ex.canonical_exercise_id ?? ex.id,
            normalized_name: ex.normalized_name ?? null,
            movement_pattern: ex.movement_pattern ?? null,
            equipment_type: ex.equipment_type ?? null,
            difficulty_level: ex.difficulty_level ?? null,
            is_compound: ex.is_compound ?? false,
            energy_system: ex.energy_system ?? null,
            metabolic_equivalent: ex.metabolic_equivalent ?? null,
            muscles: normalizedMuscles.map((muscleName: string) => ({
              id: '',
              name: muscleName,
            })),
          });
        }
      });

      // Конвертируем Map в массив и фильтруем: если есть упражнения с мышцами, возвращаем только их
      const exercisesArray = Array.from(exercisesMap.values());
      const exercisesWithMuscles = exercisesArray.filter(ex => ex.muscles && ex.muscles.length > 0);
      const exercisesWithoutMuscles = exercisesArray.filter(ex => !ex.muscles || ex.muscles.length === 0);
      
      // Если есть упражнения с мышцами, возвращаем только их. Иначе возвращаем все (на случай, если все без мышц)
      return exercisesWithMuscles.length > 0 ? exercisesWithMuscles : exercisesWithoutMuscles;
    } catch (error) {
      console.error('[exerciseService] Error:', error);
      // Fallback на прямой запрос
      return this.getExercisesByCategoryDirect(categoryId, userId);
    }
  }

  /**
   * Прямой запрос к таблице exercises (fallback)
   */
  private async getExercisesByCategoryDirect(categoryId: string, userId?: string): Promise<Exercise[]> {
    if (!supabase) {
      return this.getExercisesByCategoryFromLocalStorage(categoryId);
    }

    try {
      const limit = 500;
      const sessionUserId = await this.getSessionUserId(userId);
      let query = supabase
        .from('exercises')
        .select(`
          *,
          category:exercise_categories(*),
          exercise_muscles(
            muscle:muscles(*)
          )
        `)
        .eq('category_id', categoryId)
        .order('name', { ascending: true })
        .limit(limit);

      // Включаем стандартные упражнения и пользовательские упражнения текущего пользователя
      query = query.or(`is_custom.eq.false,created_by_user_id.eq.${sessionUserId}`);

      const { data, error } = await query;

      if (error) {
        console.error('[exerciseService] Error fetching exercises:', error);
        return this.getExercisesByCategoryFromLocalStorage(categoryId);
      }

      // Преобразуем данные и дедуплицируем
      const exercisesMap = new Map<string, Exercise>();
      
      (data || []).forEach((ex: any) => {
        const exerciseName = ex.name;
        const muscles = ex.exercise_muscles?.map((em: any) => em.muscle).filter(Boolean) || [];
        const normalizedMuscles = this.normalizeMuscles(muscles);
        
        // Если упражнение уже есть в мапе
        if (exercisesMap.has(exerciseName)) {
          const existing = exercisesMap.get(exerciseName)!;
          
          // Приоритет: оставляем версию с мышцами
          if (normalizedMuscles.length > 0 && (!existing.muscles || existing.muscles.length === 0)) {
            // Заменяем версию без мышц на версию с мышцами
            exercisesMap.set(exerciseName, {
              id: ex.id,
              name: exerciseName,
              category_id: ex.category_id,
              description: ex.description,
              is_custom: ex.is_custom,
              created_by_user_id: ex.created_by_user_id,
              category: ex.category,
              muscles: normalizedMuscles,
            });
          } else if (normalizedMuscles.length > 0 && existing.muscles && existing.muscles.length > 0) {
            // Если обе версии с мышцами, объединяем уникальные мышцы
            const existingMuscleNames = new Set(existing.muscles.map((m: Muscle) => m.name));
            const newMuscles = normalizedMuscles.filter((m: Muscle) => {
              const key = m.name;
              return key && !existingMuscleNames.has(key);
            });
            
            if (newMuscles.length > 0) {
              exercisesMap.set(exerciseName, {
                ...existing,
                muscles: [...existing.muscles, ...newMuscles],
              });
            }
          }
          // Если новая версия без мышц, а существующая с мышцами - игнорируем новую
        } else {
          // Добавляем новое упражнение
          exercisesMap.set(exerciseName, {
            id: ex.id,
            name: exerciseName,
            category_id: ex.category_id,
            description: ex.description,
            is_custom: ex.is_custom,
            created_by_user_id: ex.created_by_user_id,
            canonical_exercise_id: ex.canonical_exercise_id ?? ex.id,
            normalized_name: ex.normalized_name ?? null,
            movement_pattern: ex.movement_pattern ?? null,
            equipment_type: ex.equipment_type ?? null,
            difficulty_level: ex.difficulty_level ?? null,
            is_compound: ex.is_compound ?? false,
            energy_system: ex.energy_system ?? null,
            metabolic_equivalent: ex.metabolic_equivalent ?? null,
            category: ex.category,
            muscles: normalizedMuscles,
          });
        }
      });

      // Конвертируем Map в массив и фильтруем упражнения без мышц, если есть версии с мышцами
      const exercisesArray = Array.from(exercisesMap.values());
      const exercisesWithMuscles = exercisesArray.filter(ex => ex.muscles && ex.muscles.length > 0);
      const exercisesWithoutMuscles = exercisesArray.filter(ex => !ex.muscles || ex.muscles.length === 0);
      
      // Если есть упражнения с мышцами, возвращаем только их. Иначе возвращаем все
      return exercisesWithMuscles.length > 0 ? exercisesWithMuscles : exercisesWithoutMuscles;
    } catch (error) {
      console.error('[exerciseService] Error:', error);
      return this.getExercisesByCategoryFromLocalStorage(categoryId);
    }
  }

  /**
   * Поиск упражнений по названию
   */
  async searchExercises(searchTerm: string, categoryId?: string, userId?: string): Promise<Exercise[]> {
    if (!supabase) {
      return this.searchExercisesFromLocalStorage(searchTerm, categoryId);
    }

    try {
      const limit = 200;
      const sessionUserId = await this.getSessionUserId(userId);
      let query = supabase
        .from('exercises')
        .select(`
          *,
          category:exercise_categories(*),
          exercise_muscles(
            muscle:muscles(*)
          )
        `)
        .ilike('name', `%${searchTerm}%`)
        .order('name', { ascending: true })
        .limit(limit);

      if (categoryId) {
        query = query.eq('category_id', categoryId);
      }

      // Включаем стандартные упражнения и пользовательские упражнения текущего пользователя
      query = query.or(`is_custom.eq.false,created_by_user_id.eq.${sessionUserId}`);

      const { data, error } = await query;

      if (error) {
        console.error('[exerciseService] Error searching exercises:', error);
        return [];
      }

      // Преобразуем данные и дедуплицируем
      const exercisesMap = new Map<string, Exercise>();
      
      (data || []).forEach((ex: any) => {
        const exerciseName = ex.name;
        const muscles = ex.exercise_muscles?.map((em: any) => em.muscle).filter(Boolean) || [];
        const normalizedMuscles = this.normalizeMuscles(muscles);
        
        // Если упражнение уже есть в мапе
        if (exercisesMap.has(exerciseName)) {
          const existing = exercisesMap.get(exerciseName)!;
          
          // Приоритет: оставляем версию с мышцами
          if (normalizedMuscles.length > 0 && (!existing.muscles || existing.muscles.length === 0)) {
            // Заменяем версию без мышц на версию с мышцами
            exercisesMap.set(exerciseName, {
              id: ex.id,
              name: exerciseName,
              category_id: ex.category_id,
              description: ex.description,
              is_custom: ex.is_custom,
              created_by_user_id: ex.created_by_user_id,
              category: ex.category,
              muscles: normalizedMuscles,
            });
          } else if (normalizedMuscles.length > 0 && existing.muscles && existing.muscles.length > 0) {
            // Если обе версии с мышцами, объединяем уникальные мышцы
            const existingMuscleNames = new Set(existing.muscles.map((m: Muscle) => m.name));
            const newMuscles = normalizedMuscles.filter((m: Muscle) => {
              const key = m.name;
              return key && !existingMuscleNames.has(key);
            });
            
            if (newMuscles.length > 0) {
              exercisesMap.set(exerciseName, {
                ...existing,
                muscles: [...existing.muscles, ...newMuscles],
              });
            }
          }
          // Если новая версия без мышц, а существующая с мышцами - игнорируем новую
        } else {
          // Добавляем новое упражнение
          exercisesMap.set(exerciseName, {
            id: ex.id,
            name: exerciseName,
            category_id: ex.category_id,
            description: ex.description,
            is_custom: ex.is_custom,
            created_by_user_id: ex.created_by_user_id,
            category: ex.category,
            muscles: normalizedMuscles,
          });
        }
      });

      // Конвертируем Map в массив и фильтруем упражнения без мышц, если есть версии с мышцами
      const exercisesArray = Array.from(exercisesMap.values());
      const exercisesWithMuscles = exercisesArray.filter(ex => ex.muscles && ex.muscles.length > 0);
      const exercisesWithoutMuscles = exercisesArray.filter(ex => !ex.muscles || ex.muscles.length === 0);
      
      // Если есть упражнения с мышцами, возвращаем только их. Иначе возвращаем все
      return exercisesWithMuscles.length > 0 ? exercisesWithMuscles : exercisesWithoutMuscles;
    } catch (error) {
      console.error('[exerciseService] Error:', error);
      return [];
    }
  }

  /**
   * Создать пользовательское упражнение
   */
  async createCustomExercise(userId: string, data: CreateExerciseData): Promise<Exercise> {
    if (!supabase) {
      throw new Error('Supabase не инициализирован');
    }

    try {
      const sessionUserId = await this.getSessionUserId(userId);

      // Создаем упражнение
      const { data: exercise, error: exerciseError } = await supabase
        .from('exercises')
        .insert({
          name: data.name,
          category_id: data.category_id,
          description: data.description,
          is_custom: true,
          created_by_user_id: sessionUserId,
        })
        .select(`
          *,
          category:exercise_categories(*)
        `)
        .single();

      if (exerciseError || !exercise) {
        throw new Error(exerciseError?.message || 'Ошибка создания упражнения');
      }

      // Создаем связи с мышцами
      if (data.muscle_ids.length > 0) {
        const exerciseMuscles = data.muscle_ids.map(muscleId => ({
          exercise_id: exercise.id,
          muscle_id: muscleId,
        }));

        const { error: linkError } = await supabase
          .from('exercise_muscles')
          .insert(exerciseMuscles);

        if (linkError) {
          console.error('[exerciseService] Error creating muscle links:', linkError);
        }
      }

      // Получаем полные данные с мышцами
      const { data: fullExercise, error: fetchError } = await supabase
        .from('exercises')
        .select(`
          *,
          category:exercise_categories(*),
          exercise_muscles(
            muscle:muscles(*)
          )
        `)
        .eq('id', exercise.id)
        .single();

      if (fetchError || !fullExercise) {
        return {
          ...exercise,
          muscles: [],
        };
      }

      return {
        id: fullExercise.id,
        name: fullExercise.name,
        category_id: fullExercise.category_id,
        description: fullExercise.description,
        is_custom: fullExercise.is_custom,
        created_by_user_id: fullExercise.created_by_user_id,
        category: fullExercise.category,
        muscles: fullExercise.exercise_muscles?.map((em: any) => em.muscle).filter(Boolean) || [],
      };
    } catch (error) {
      console.error('[exerciseService] Error creating exercise:', error);
      throw error;
    }
  }

  // Fallback методы для localStorage
  private getCategoriesFromLocalStorage(): ExerciseCategory[] {
    try {
      const stored = localStorage.getItem('exercise_categories');
      return stored ? JSON.parse(stored) : [];
    } catch {
      return [];
    }
  }

  private getMusclesFromLocalStorage(): Muscle[] {
    try {
      const stored = localStorage.getItem('muscles');
      return stored ? JSON.parse(stored) : [];
    } catch {
      return [];
    }
  }

  private getExercisesByCategoryFromLocalStorage(categoryId: string): Exercise[] {
    try {
      const stored = localStorage.getItem(`exercises_${categoryId}`);
      return stored ? JSON.parse(stored) : [];
    } catch {
      return [];
    }
  }

  private searchExercisesFromLocalStorage(searchTerm: string, categoryId?: string): Exercise[] {
    // Простая реализация для offline
    const exercises = this.getExercisesByCategoryFromLocalStorage(categoryId || '');
    return exercises.filter(ex => 
      ex.name.toLowerCase().includes(searchTerm.toLowerCase())
    );
  }
}

export const exerciseService = new ExerciseService();

