import { supabase } from '../lib/supabaseClient';
import {
  getOptionalSupabaseResourceState,
  isOptionalSupabaseResourceMissingError,
  setOptionalSupabaseResourceState,
} from '../utils/optionalSupabaseResource';

export interface RecipeNote {
  id: string;
  user_id: string;
  recipe_id: string;
  text: string;
  created_at: string;
  updated_at: string;
}

// Кэш для отслеживания доступности таблицы в Supabase
let tableExistsCache: boolean | null = null;
const RECIPE_NOTES_RESOURCE = 'recipe_notes';

class RecipeNotesService {
  private async getSessionUserId(userId?: string): Promise<string> {
    if (!supabase) {
      throw new Error('Supabase не инициализирован');
    }

    const { data, error } = await supabase.auth.getUser();
    if (error || !data?.user?.id) {
      throw new Error('Пользователь не авторизован');
    }

    if (userId && userId !== data.user.id) {
      console.warn('[recipeNotesService] Передан userId не совпадает с сессией');
    }

    return data.user.id;
  }
  // Проверяем, существует ли таблица в Supabase (кэшируем результат)
  private async checkTableExists(): Promise<boolean> {
    if (tableExistsCache !== null) {
      return tableExistsCache;
    }

    const cachedState = getOptionalSupabaseResourceState(RECIPE_NOTES_RESOURCE);
    if (cachedState === 'present') {
      tableExistsCache = true;
      return true;
    }

    if (!supabase) {
      tableExistsCache = false;
      return false;
    }

    try {
      // Пробуем сделать простой запрос к таблице
      const { error } = await supabase
        .from('recipe_notes')
        .select('id')
        .limit(1);

      if (error) {
        // PGRST205 = table not found, 404 = Not Found
        if (isOptionalSupabaseResourceMissingError(error)) {
          // Таблица не найдена
          tableExistsCache = false;
          setOptionalSupabaseResourceState(RECIPE_NOTES_RESOURCE, 'missing');
          return false;
        }
        // Другая ошибка - считаем, что таблица существует, но есть проблема с доступом
        tableExistsCache = true;
        setOptionalSupabaseResourceState(RECIPE_NOTES_RESOURCE, 'present');
        return true;
      }

      tableExistsCache = true;
      setOptionalSupabaseResourceState(RECIPE_NOTES_RESOURCE, 'present');
      return true;
    } catch (error) {
      tableExistsCache = false;
      return false;
    }
  }
  /**
   * Получить заметку для рецепта
   */
  async getNoteByRecipeId(userId: string, recipeId: string): Promise<string | null> {
    const localNotes = this.getLocalStorageNotes(userId);
    const localNote = localNotes[recipeId] || null;

    // Проверяем, существует ли таблица в Supabase
    const tableExists = await this.checkTableExists();

    // Пробуем получить из Supabase только если таблица существует
    if (supabase && tableExists) {
      const sessionUserId = await this.getSessionUserId(userId);
      try {

        const { data, error } = await supabase
          .from('recipe_notes')
          .select('text')
          .eq('user_id', sessionUserId)
          .eq('recipe_id', recipeId)
          .single();

        if (error) {
          // Если записи нет, это нормально (not found)
          if (error.code === 'PGRST116') {
            return localNote;
          }
          // Если таблица не найдена, сбрасываем кэш
          if (isOptionalSupabaseResourceMissingError(error)) {
            tableExistsCache = false;
            setOptionalSupabaseResourceState(RECIPE_NOTES_RESOURCE, 'missing');
          }
          return localNote;
        }

        return data?.text || localNote;
      } catch (error) {
        return localNote;
      }
    }

    return localNote;
  }

  /**
   * Получить все заметки для массива рецептов
   */
  async getNotesByRecipeIds(userId: string, recipeIds: string[]): Promise<Record<string, string>> {
    if (recipeIds.length === 0) {
      return {};
    }
    const localNotes = this.getLocalStorageNotes(userId);
    const localNotesMap: Record<string, string> = {};
    for (const recipeId of recipeIds) {
      if (localNotes[recipeId]) {
        localNotesMap[recipeId] = localNotes[recipeId];
      }
    }

    // Проверяем, существует ли таблица в Supabase
    const tableExists = await this.checkTableExists();

    // Пробуем получить из Supabase только если таблица существует
    if (supabase && tableExists) {
      const sessionUserId = await this.getSessionUserId(userId);
      try {

        const { data, error } = await supabase
          .from('recipe_notes')
          .select('recipe_id, text')
          .eq('user_id', sessionUserId)
          .in('recipe_id', recipeIds);

        if (error) {
          if (isOptionalSupabaseResourceMissingError(error)) {
            tableExistsCache = false;
            setOptionalSupabaseResourceState(RECIPE_NOTES_RESOURCE, 'missing');
          }
          return localNotesMap;
        }

        // Supabase is the source of truth when the table exists; localStorage only fills temporary gaps.
        const notesMap: Record<string, string> = {};
        if (data) {
          data.forEach((note) => {
            notesMap[note.recipe_id] = note.text;
          });
        }
        for (const recipeId of recipeIds) {
          if (!notesMap[recipeId] && localNotesMap[recipeId]) {
            notesMap[recipeId] = localNotesMap[recipeId];
          }
        }

        return notesMap;
      } catch (error) {
        return localNotesMap;
      }
    }

    return localNotesMap;
  }

  /**
   * Сохранить или обновить заметку для рецепта
   */
  async saveNote(
    userId: string,
    recipeId: string,
    text: string
  ): Promise<void> {
    if (!userId || !recipeId) {
      const errorMsg = 'Не указаны userId или recipeId';
      console.error('[recipeNotesService]', errorMsg);
      throw new Error(errorMsg);
    }

    const trimmedText = text.trim();

    if (!trimmedText) {
      // Если текст пустой, удаляем заметку
      await this.deleteNote(userId, recipeId);
      return;
    }

    // Проверяем, существует ли таблица в Supabase
    const tableExists = await this.checkTableExists();

    // Supabase is the production source of truth. localStorage is only a temporary fallback.
    if (supabase && tableExists) {
      try {
        const activeUserId = await this.getSessionUserId(userId);

        const { error } = await supabase
          .from('recipe_notes')
          .upsert(
            {
              user_id: activeUserId,
              recipe_id: recipeId,
              text: trimmedText,
              updated_at: new Date().toISOString(),
            },
            { onConflict: 'user_id,recipe_id' }
          );

        if (error) {
          if (isOptionalSupabaseResourceMissingError(error)) {
            tableExistsCache = false;
            setOptionalSupabaseResourceState(RECIPE_NOTES_RESOURCE, 'missing');
          } else {
            throw error;
          }
        } else {
          setOptionalSupabaseResourceState(RECIPE_NOTES_RESOURCE, 'present');
          const localNotes = this.getLocalStorageNotes(userId);
          localNotes[recipeId] = trimmedText;
          this.saveLocalStorageNotes(userId, localNotes);
          return;
        }
      } catch (error) {
        throw error;
      }
    }

    const localNotes = this.getLocalStorageNotes(userId);
    localNotes[recipeId] = trimmedText;
    this.saveLocalStorageNotes(userId, localNotes);
  }

  /**
   * Удалить заметку для рецепта
   */
  async deleteNote(userId: string, recipeId: string): Promise<void> {
    // Проверяем, существует ли таблица в Supabase
    const tableExists = await this.checkTableExists();

    // Пробуем удалить из Supabase только если таблица существует
    if (supabase && tableExists) {
      try {
        const activeUserId = await this.getSessionUserId(userId);

        const { error } = await supabase
          .from('recipe_notes')
          .delete()
          .eq('user_id', activeUserId)
          .eq('recipe_id', recipeId);

        if (error) {
          // Если таблица не найдена, сбрасываем кэш и используем только localStorage
          if (isOptionalSupabaseResourceMissingError(error)) {
            tableExistsCache = false;
            setOptionalSupabaseResourceState(RECIPE_NOTES_RESOURCE, 'missing');
          } else {
            throw error;
          }
        } else {
          setOptionalSupabaseResourceState(RECIPE_NOTES_RESOURCE, 'present');
        }
      } catch (error) {
        throw error;
      }
    }

    const localNotes = this.getLocalStorageNotes(userId);
    delete localNotes[recipeId];
    this.saveLocalStorageNotes(userId, localNotes);
  }

  private notesKey(userId: string): string {
    return `potok_recipe_notes_${userId}`;
  }

  private getLocalStorageNotes(userId: string): Record<string, string> {
    try {
      const stored = localStorage.getItem(this.notesKey(userId));
      return stored ? (JSON.parse(stored) as Record<string, string>) : {};
    } catch (error) {
      console.error('[recipeNotesService] Error reading localStorage notes:', error);
      return {};
    }
  }

  private saveLocalStorageNotes(userId: string, notes: Record<string, string>): void {
    try {
      localStorage.setItem(this.notesKey(userId), JSON.stringify(notes));
    } catch (error) {
      console.error('[recipeNotesService] Error saving localStorage notes:', error);
    }
  }
}

export const recipeNotesService = new RecipeNotesService();
