import { supabase } from '../lib/supabaseClient';
import { toUUID } from '../utils/uuid';
import { Exercise, ExerciseCategory, Muscle, CreateExerciseData } from '../types/workout';

class ExerciseService {
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
   * Получить упражнения по категории
   */
  async getExercisesByCategory(categoryId: string, userId?: string): Promise<Exercise[]> {
    if (!supabase) {
      return this.getExercisesByCategoryFromLocalStorage(categoryId);
    }

    try {
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
        .order('name', { ascending: true });

      // Включаем стандартные упражнения и пользовательские упражнения текущего пользователя
      if (userId) {
        query = query.or(`is_custom.eq.false,created_by_user_id.eq.${toUUID(userId)}`);
      } else {
        query = query.eq('is_custom', false);
      }

      const { data, error } = await query;

      if (error) {
        console.error('[exerciseService] Error fetching exercises:', error);
        return this.getExercisesByCategoryFromLocalStorage(categoryId);
      }

      // Преобразуем данные
      const exercises: Exercise[] = (data || []).map((ex: any) => ({
        id: ex.id,
        name: ex.name,
        category_id: ex.category_id,
        description: ex.description,
        is_custom: ex.is_custom,
        created_by_user_id: ex.created_by_user_id,
        category: ex.category,
        muscles: ex.exercise_muscles?.map((em: any) => em.muscle).filter(Boolean) || [],
      }));

      return exercises;
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
        .order('name', { ascending: true });

      if (categoryId) {
        query = query.eq('category_id', categoryId);
      }

      // Включаем стандартные упражнения и пользовательские упражнения текущего пользователя
      if (userId) {
        query = query.or(`is_custom.eq.false,created_by_user_id.eq.${toUUID(userId)}`);
      } else {
        query = query.eq('is_custom', false);
      }

      const { data, error } = await query;

      if (error) {
        console.error('[exerciseService] Error searching exercises:', error);
        return [];
      }

      // Преобразуем данные
      const exercises: Exercise[] = (data || []).map((ex: any) => ({
        id: ex.id,
        name: ex.name,
        category_id: ex.category_id,
        description: ex.description,
        is_custom: ex.is_custom,
        created_by_user_id: ex.created_by_user_id,
        category: ex.category,
        muscles: ex.exercise_muscles?.map((em: any) => em.muscle).filter(Boolean) || [],
      }));

      return exercises;
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
      const uuidUserId = toUUID(userId);

      // Создаем упражнение
      const { data: exercise, error: exerciseError } = await supabase
        .from('exercises')
        .insert({
          name: data.name,
          category_id: data.category_id,
          description: data.description,
          is_custom: true,
          created_by_user_id: uuidUserId,
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

