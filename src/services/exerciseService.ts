import { supabase } from '../lib/supabaseClient';
import { Exercise, ExerciseCategory, Muscle, CreateExerciseData } from '../types/workout';
import { normalizeMuscleNames } from '../utils/muscleNormalizer';

export function isExerciseDefinitionSchemaGapError(error: { message?: string | null; details?: string | null; code?: string | null } | null | undefined): boolean {
  const message = `${error?.message ?? ''} ${error?.details ?? ''}`.toLowerCase();
  return (
    message.includes('exercise_definition_cards') ||
    message.includes('exercise_muscles.role') ||
    message.includes("column 'role'") ||
    message.includes('does not exist') ||
    error?.code === 'PGRST205'
  );
}

export function canEditCustomExercise(exercise: Pick<Exercise, 'is_custom' | 'created_by_user_id'>, sessionUserId: string): boolean {
  return exercise.is_custom === true && exercise.created_by_user_id === sessionUserId;
}

export function canDeleteCustomExercise(exercise: Pick<Exercise, 'is_custom' | 'created_by_user_id'>, sessionUserId: string): boolean {
  return canEditCustomExercise(exercise, sessionUserId);
}

export function buildExerciseMuscleLinkRows(exerciseId: string, muscleIds: string[]) {
  return muscleIds.map((muscleId) => ({
    exercise_id: exerciseId,
    muscle_id: muscleId,
  }));
}

class ExerciseService {
  private getCategoryExercisesStorageKey(categoryId: string): string {
    return `exercises_${categoryId}`;
  }

  private getCustomExercisesStorageKey(userId: string, categoryId?: string): string {
    return categoryId
      ? `custom_exercises_${userId}_${categoryId}`
      : `custom_exercises_${userId}`;
  }

  private saveExercisesByCategoryToLocalStorage(categoryId: string, exercises: Exercise[]): void {
    try {
      localStorage.setItem(this.getCategoryExercisesStorageKey(categoryId), JSON.stringify(exercises));
    } catch (error) {
      console.error('[exerciseService] Error saving category exercises to localStorage:', error);
    }
  }

  private saveCustomExercisesToLocalStorage(userId: string, exercises: Exercise[], categoryId?: string): void {
    try {
      localStorage.setItem(this.getCustomExercisesStorageKey(userId, categoryId), JSON.stringify(exercises));
    } catch (error) {
      console.error('[exerciseService] Error saving custom exercises to localStorage:', error);
    }
  }

  private normalizeMuscles(muscles: Muscle[]): Muscle[] {
    const normalizedMap = new Map<string, string>();

    muscles.forEach((muscle) => {
      const rawName = muscle.name || '';
      const normalizedNames = normalizeMuscleNames([rawName]);
      normalizedNames.forEach((normalizedName) => {
        if (!normalizedMap.has(normalizedName)) {
          normalizedMap.set(normalizedName, muscle.id || normalizedName);
        }
      });
    });

    return Array.from(normalizedMap.entries()).map(([name, id]) => ({ id, name }));
  }

  private extractNormalizedMusclesFromViewRow(muscles: unknown): Muscle[] {
    if (!Array.isArray(muscles) || muscles.length === 0) {
      return [];
    }

    const rawNames =
      typeof muscles[0] === 'string'
        ? muscles.filter((m): m is string => typeof m === 'string' && m.trim() !== '')
        : muscles
            .map((m: any) => m?.name || m)
            .filter((m: unknown): m is string => typeof m === 'string' && m.trim() !== '');

    return normalizeMuscleNames(rawNames).map((name) => ({ id: '', name }));
  }

  private mergeExerciseRecords(exercises: Exercise[]): Exercise[] {
    const exercisesMap = new Map<string, Exercise>();

    exercises.forEach((exercise) => {
      const exerciseName = exercise.name.trim();
      if (!exerciseName) return;

      const current: Exercise = {
        ...exercise,
        name: exerciseName,
        muscles: exercise.muscles ? this.normalizeMuscles(exercise.muscles) : [],
      };

      const existing = exercisesMap.get(exerciseName);
      if (!existing) {
        exercisesMap.set(exerciseName, current);
        return;
      }

      const existingMuscles = existing.muscles || [];
      const currentMuscles = current.muscles || [];
      const existingHasMuscles = existingMuscles.length > 0;
      const currentHasMuscles = currentMuscles.length > 0;

      if (currentHasMuscles && !existingHasMuscles) {
        exercisesMap.set(exerciseName, { ...current, muscles: currentMuscles });
        return;
      }

      if (!currentHasMuscles && existingHasMuscles) {
        return;
      }

      const mergedMuscleNames = normalizeMuscleNames([
        ...existingMuscles.map((m) => m.name),
        ...currentMuscles.map((m) => m.name),
      ]);

      exercisesMap.set(exerciseName, {
        ...existing,
        canonical_exercise_id: existing.canonical_exercise_id ?? current.canonical_exercise_id ?? current.id,
        normalized_name: existing.normalized_name ?? current.normalized_name ?? null,
        movement_pattern: existing.movement_pattern ?? current.movement_pattern ?? undefined,
        equipment_type: existing.equipment_type ?? current.equipment_type ?? null,
        difficulty_level: existing.difficulty_level ?? current.difficulty_level ?? null,
        is_compound: existing.is_compound ?? current.is_compound ?? false,
        energy_system: existing.energy_system ?? current.energy_system ?? undefined,
        metabolic_equivalent: existing.metabolic_equivalent ?? current.metabolic_equivalent ?? null,
        muscles: mergedMuscleNames.map((name) => ({ id: '', name })),
      });
    });

    return Array.from(exercisesMap.values());
  }

  private mapExerciseFromViewRow(categoryId: string, ex: any): Exercise | null {
    const exerciseName = (ex.exercise_name || '').trim();
    if (!exerciseName) return null;

    return {
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
      muscles: this.extractNormalizedMusclesFromViewRow(ex.muscles),
    };
  }

  private mapExerciseFromDirectRow(ex: any): Exercise {
    const muscles = ex.exercise_muscles?.map((em: any) => em.muscle).filter(Boolean) || [];
    return {
      id: ex.id,
      name: ex.name,
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
      muscles: this.normalizeMuscles(muscles),
    };
  }

  private mapExerciseDefinitionCardRow(ex: any): Exercise | null {
    const exerciseName = (ex?.name || '').trim();
    if (!exerciseName) return null;

    const media = Array.isArray(ex.media)
      ? ex.media
          .map((item: any) => ({
            type: item?.type === 'video' ? 'video' : 'image',
            url: typeof item?.url === 'string' ? item.url : '',
            order: Number.isFinite(item?.order) ? item.order : 0,
          }))
          .filter((item: { url: string }) => item.url !== '')
      : [];

    return {
      id: ex.id,
      name: exerciseName,
      category_id: ex.category_id || '',
      description: ex.description ?? null,
      mistakes: ex.mistakes ?? null,
      primary_muscles: Array.isArray(ex.primary_muscles) ? ex.primary_muscles : [],
      secondary_muscles: Array.isArray(ex.secondary_muscles) ? ex.secondary_muscles : [],
      muscle_map_image_url: ex.muscle_map_image_url ?? null,
      media,
      is_custom: ex.is_custom ?? false,
      created_by_user_id: ex.created_by_user_id ?? null,
      canonical_exercise_id: ex.canonical_exercise_id ?? ex.id,
      normalized_name: ex.normalized_name ?? null,
      movement_pattern: ex.movement_pattern ?? null,
      equipment_type: ex.equipment_type ?? null,
      difficulty_level: ex.difficulty_level ?? null,
      is_compound: ex.is_compound ?? false,
      energy_system: ex.energy_system ?? null,
      metabolic_equivalent: ex.metabolic_equivalent ?? null,
      aliases: Array.isArray(ex.aliases) ? ex.aliases : null,
      safety_flags: ex.safety_flags ?? null,
      muscles: this.extractNormalizedMusclesFromViewRow(ex.primary_muscles),
    };
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

      const mapped = (data || [])
        .map((ex: any) => this.mapExerciseFromViewRow(categoryId, ex))
        .filter((exercise: Exercise | null): exercise is Exercise => exercise !== null);
      const deduplicated = this.mergeExerciseRecords(mapped);
      this.saveExercisesByCategoryToLocalStorage(categoryId, deduplicated);
      return deduplicated;
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

      const deduplicated = this.mergeExerciseRecords((data || []).map((ex: any) => this.mapExerciseFromDirectRow(ex)));
      this.saveExercisesByCategoryToLocalStorage(categoryId, deduplicated);
      return deduplicated;
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
      return this.mergeExerciseRecords((data || []).map((ex: any) => this.mapExerciseFromDirectRow(ex)));
    } catch (error) {
      console.error('[exerciseService] Error:', error);
      return [];
    }
  }

  async getCustomExercises(userId: string, categoryId?: string): Promise<Exercise[]> {
    if (!supabase) {
      return this.getCustomExercisesFromLocalStorage(userId, categoryId);
    }

    try {
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
        .eq('is_custom', true)
        .eq('created_by_user_id', sessionUserId)
        .order('name', { ascending: true })
        .limit(500);

      if (categoryId) {
        query = query.eq('category_id', categoryId);
      }

      const { data, error } = await query;

      if (error) {
        console.error('[exerciseService] Error fetching custom exercises:', error);
        return this.getCustomExercisesFromLocalStorage(sessionUserId, categoryId);
      }

      const customExercises = this.mergeExerciseRecords(
        (data || []).map((ex: any) => this.mapExerciseFromDirectRow(ex)),
      );
      this.saveCustomExercisesToLocalStorage(sessionUserId, customExercises, categoryId);
      return customExercises;
    } catch (error) {
      console.error('[exerciseService] Error:', error);
      return this.getCustomExercisesFromLocalStorage(userId, categoryId);
    }
  }

  async getExerciseDefinitionCard(exerciseId: string): Promise<Exercise | null> {
    if (!supabase) {
      return this.findExerciseInLocalStorage(exerciseId);
    }

    try {
      const { data, error } = await supabase
        .from('exercise_definition_cards')
        .select('*')
        .eq('id', exerciseId)
        .maybeSingle();

      if (!error && data) {
        return this.mapExerciseDefinitionCardRow(data);
      }

      if (error && !isExerciseDefinitionSchemaGapError(error)) {
        console.warn('[exerciseService] Error fetching exercise definition card:', error);
      }

      const { data: fallback, error: fallbackError } = await supabase
        .from('exercises')
        .select(`
          *,
          exercise_muscles(
            muscle:muscles(*)
          )
        `)
        .eq('id', exerciseId)
        .maybeSingle();

      if (fallbackError) {
        if (!isExerciseDefinitionSchemaGapError(fallbackError)) {
          console.error('[exerciseService] Error fetching fallback exercise definition:', fallbackError);
        }
        return this.findExerciseInLocalStorage(exerciseId);
      }

      return fallback ? this.mapExerciseFromDirectRow(fallback) : this.findExerciseInLocalStorage(exerciseId);
    } catch (error) {
      if (!isExerciseDefinitionSchemaGapError(error as { message?: string | null; details?: string | null; code?: string | null })) {
        console.error('[exerciseService] Error loading exercise definition card:', error);
      }
      return this.findExerciseInLocalStorage(exerciseId);
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
        const exerciseMuscles = buildExerciseMuscleLinkRows(exercise.id, data.muscle_ids);

        const { error: linkError } = await supabase
          .from('exercise_muscles')
          .insert(exerciseMuscles);

        if (linkError) {
          console.error('[exerciseService] Error creating muscle links:', linkError);
          await supabase
            .from('exercises')
            .delete()
            .eq('id', exercise.id)
            .eq('created_by_user_id', sessionUserId);
          throw new Error('Не удалось сохранить целевые мышцы упражнения');
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

  async updateCustomExercise(userId: string, exerciseId: string, data: CreateExerciseData): Promise<Exercise> {
    if (!supabase) {
      throw new Error('Supabase не инициализирован');
    }

    try {
      const sessionUserId = await this.getSessionUserId(userId);

      const { data: existingExercise, error: existingError } = await supabase
        .from('exercises')
        .select('id, is_custom, created_by_user_id')
        .eq('id', exerciseId)
        .single();

      if (existingError || !existingExercise) {
        throw new Error(existingError?.message || 'Упражнение не найдено');
      }

      if (!canEditCustomExercise(existingExercise, sessionUserId)) {
        throw new Error('Можно редактировать только свои пользовательские упражнения');
      }

      const { data: existingLinks, error: existingLinksError } = await supabase
        .from('exercise_muscles')
        .select('muscle_id')
        .eq('exercise_id', exerciseId);

      if (existingLinksError) {
        throw new Error(existingLinksError.message || 'Не удалось загрузить текущие связи мышц упражнения');
      }

      const { error: updateError } = await supabase
        .from('exercises')
        .update({
          name: data.name,
          category_id: data.category_id,
          description: data.description,
        })
        .eq('id', exerciseId)
        .eq('created_by_user_id', sessionUserId)
        .eq('is_custom', true);

      if (updateError) {
        throw new Error(updateError.message || 'Не удалось обновить упражнение');
      }

      const { error: deleteLinksError } = await supabase
        .from('exercise_muscles')
        .delete()
        .eq('exercise_id', exerciseId);

      if (deleteLinksError) {
        throw new Error(deleteLinksError.message || 'Не удалось обновить целевые мышцы упражнения');
      }

      if (data.muscle_ids.length > 0) {
        const { error: insertLinksError } = await supabase
          .from('exercise_muscles')
          .insert(buildExerciseMuscleLinkRows(exerciseId, data.muscle_ids));

        if (insertLinksError) {
          const previousMuscleIds = (existingLinks || []).map((link: any) => link.muscle_id).filter(Boolean);
          if (previousMuscleIds.length > 0) {
            await supabase
              .from('exercise_muscles')
              .insert(buildExerciseMuscleLinkRows(exerciseId, previousMuscleIds));
          }
          throw new Error('Не удалось обновить целевые мышцы упражнения');
        }
      }

      const { data: fullExercise, error: fetchError } = await supabase
        .from('exercises')
        .select(`
          *,
          category:exercise_categories(*),
          exercise_muscles(
            muscle:muscles(*)
          )
        `)
        .eq('id', exerciseId)
        .single();

      if (fetchError || !fullExercise) {
        throw new Error(fetchError?.message || 'Не удалось перечитать обновлённое упражнение');
      }

      const updatedExercise = this.mapExerciseFromDirectRow(fullExercise);
      const cachedCustomExercises = this.getCustomExercisesFromLocalStorage(sessionUserId);
      const nextCachedCustomExercises = cachedCustomExercises.some((exercise) => exercise.id === updatedExercise.id)
        ? cachedCustomExercises.map((exercise) => (exercise.id === updatedExercise.id ? updatedExercise : exercise))
        : [...cachedCustomExercises, updatedExercise];
      this.saveCustomExercisesToLocalStorage(sessionUserId, this.mergeExerciseRecords(nextCachedCustomExercises));
      this.saveCustomExercisesToLocalStorage(
        sessionUserId,
        this.mergeExerciseRecords(
          nextCachedCustomExercises.filter((exercise) => exercise.category_id === updatedExercise.category_id),
        ),
        updatedExercise.category_id,
      );

      return updatedExercise;
    } catch (error) {
      console.error('[exerciseService] Error updating custom exercise:', error);
      throw error;
    }
  }

  async deleteCustomExercise(userId: string, exerciseId: string): Promise<void> {
    if (!supabase) {
      throw new Error('Supabase не инициализирован');
    }

    try {
      const sessionUserId = await this.getSessionUserId(userId);

      const { data: existingExercise, error: existingError } = await supabase
        .from('exercises')
        .select('id, is_custom, created_by_user_id, category_id')
        .eq('id', exerciseId)
        .single();

      if (existingError || !existingExercise) {
        throw new Error(existingError?.message || 'Упражнение не найдено');
      }

      if (!canDeleteCustomExercise(existingExercise, sessionUserId)) {
        throw new Error('Можно удалять только свои пользовательские упражнения');
      }

      const { count: referencesCount, error: referencesError } = await supabase
        .from('workout_entries')
        .select('id', { count: 'exact', head: true })
        .eq('exercise_id', exerciseId);

      if (referencesError) {
        throw new Error(referencesError.message || 'Не удалось проверить использование упражнения в тренировках');
      }

      if ((referencesCount || 0) > 0) {
        throw new Error('Нельзя удалить упражнение, которое уже использовалось в тренировках');
      }

      const { error: deleteError } = await supabase
        .from('exercises')
        .delete()
        .eq('id', exerciseId)
        .eq('created_by_user_id', sessionUserId)
        .eq('is_custom', true);

      if (deleteError) {
        throw new Error(deleteError.message || 'Не удалось удалить упражнение');
      }

      const cachedCustomExercises = this.getCustomExercisesFromLocalStorage(sessionUserId);
      const nextCachedCustomExercises = cachedCustomExercises.filter((exercise) => exercise.id !== exerciseId);
      this.saveCustomExercisesToLocalStorage(sessionUserId, nextCachedCustomExercises);
      this.saveCustomExercisesToLocalStorage(
        sessionUserId,
        nextCachedCustomExercises.filter((exercise) => exercise.category_id === existingExercise.category_id),
        existingExercise.category_id,
      );
    } catch (error) {
      console.error('[exerciseService] Error deleting custom exercise:', error);
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
      const stored = localStorage.getItem(this.getCategoryExercisesStorageKey(categoryId));
      return stored ? JSON.parse(stored) : [];
    } catch {
      return [];
    }
  }

  private findExerciseInLocalStorage(exerciseId: string): Exercise | null {
    try {
      const keys = Object.keys(localStorage).filter((key) => key.startsWith('exercises_') || key.startsWith('custom_exercises_'));
      for (const key of keys) {
        const rawValue = localStorage.getItem(key);
        if (!rawValue) continue;
        const parsed = JSON.parse(rawValue);
        if (!Array.isArray(parsed)) continue;
        const found = parsed.find((item: any) => item?.id === exerciseId);
        if (found) {
          return found as Exercise;
        }
      }
    } catch (error) {
      console.error('[exerciseService] Error reading exercise from localStorage:', error);
    }

    return null;
  }

  private searchExercisesFromLocalStorage(searchTerm: string, categoryId?: string): Exercise[] {
    // Простая реализация для offline
    const exercises = this.getExercisesByCategoryFromLocalStorage(categoryId || '');
    return exercises.filter(ex => 
      ex.name.toLowerCase().includes(searchTerm.toLowerCase())
    );
  }

  private getCustomExercisesFromLocalStorage(userId: string, categoryId?: string): Exercise[] {
    try {
      const specific = localStorage.getItem(this.getCustomExercisesStorageKey(userId, categoryId));
      if (specific) {
        return JSON.parse(specific);
      }

      const allCustom = localStorage.getItem(this.getCustomExercisesStorageKey(userId));
      if (!allCustom) {
        return [];
      }

      const parsed = JSON.parse(allCustom) as Exercise[];
      if (!categoryId) {
        return parsed;
      }

      return parsed.filter((exercise) => exercise.category_id === categoryId);
    } catch {
      return [];
    }
  }
}

export const exerciseService = new ExerciseService();
