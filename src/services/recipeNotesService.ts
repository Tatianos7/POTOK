import { supabase } from '../lib/supabaseClient';

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
        if (error.code === 'PGRST205' || error.code === 'PGRST204' || error.message?.includes('404')) {
          // Таблица не найдена
          tableExistsCache = false;
          return false;
        }
        // Другая ошибка - считаем, что таблица существует, но есть проблема с доступом
        tableExistsCache = true;
        return true;
      }

      tableExistsCache = true;
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
            return null;
          }
          // Если таблица не найдена, сбрасываем кэш
          if (error.code === 'PGRST205') {
            tableExistsCache = false;
          }
          return null;
        }

        const note = data?.text || null;
        return note;
      } catch (error) {
        return null;
      }
    }

    return null;
  }

  /**
   * Получить все заметки для массива рецептов
   */
  async getNotesByRecipeIds(userId: string, recipeIds: string[]): Promise<Record<string, string>> {
    if (recipeIds.length === 0) {
      return {};
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
          if (error.code === 'PGRST205') {
            tableExistsCache = false;
          }
          return {};
        }

        // Преобразуем массив в объект { recipe_id: text }
        const notesMap: Record<string, string> = {};
        if (data) {
          data.forEach((note) => {
            notesMap[note.recipe_id] = note.text;
          });
        }

        return notesMap;
      } catch (error) {
        return {};
      }
    }

    return {};
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

    // Пробуем сохранить в Supabase только если таблица существует
    if (supabase && tableExists) {
      try {
        const activeUserId = await this.getSessionUserId(userId);

        // Проверяем, существует ли заметка
        const existingNote = await this.getNoteByRecipeId(userId, recipeId);

        if (existingNote !== null) {
          // Обновляем существующую заметку
          const { error } = await supabase
            .from('recipe_notes')
            .update({
              text: trimmedText,
              updated_at: new Date().toISOString(),
            })
            .eq('user_id', activeUserId)
            .eq('recipe_id', recipeId);

          if (error) {
            // Если таблица не найдена, сбрасываем кэш и используем только localStorage
            if (error.code === 'PGRST205') {
              tableExistsCache = false;
              return; // Уже сохранено в localStorage
            }
            // Не бросаем ошибку, так как уже сохранено в localStorage
            return;
          }
          const localNotes = this.getLocalStorageNotes(activeUserId);
          localNotes[recipeId] = trimmedText;
          this.saveLocalStorageNotes(activeUserId, localNotes);
        } else {
          // Создаём новую заметку
          const { error } = await supabase
            .from('recipe_notes')
            .insert({
              user_id: activeUserId,
              recipe_id: recipeId,
              text: trimmedText,
            });

          if (error) {
            // Если таблица не найдена, сбрасываем кэш и используем только localStorage
            if (error.code === 'PGRST205') {
              tableExistsCache = false;
              return; // Уже сохранено в localStorage
            }
            // Не бросаем ошибку, так как уже сохранено в localStorage
            return;
          }
          const localNotes = this.getLocalStorageNotes(activeUserId);
          localNotes[recipeId] = trimmedText;
          this.saveLocalStorageNotes(activeUserId, localNotes);
        }
      } catch (error) {
        // Не бросаем ошибку, так как уже сохранено в localStorage
        return;
      }
    }
    // Если Supabase недоступен, заметка уже сохранена в localStorage
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
          if (error.code === 'PGRST205') {
            tableExistsCache = false;
            return; // Уже удалено из localStorage
          }
          // Не бросаем ошибку, так как уже удалено из localStorage
          return;
        }
        const localNotes = this.getLocalStorageNotes(activeUserId);
        delete localNotes[recipeId];
        this.saveLocalStorageNotes(activeUserId, localNotes);
      } catch (error) {
        // Не бросаем ошибку, так как уже удалено из localStorage
        return;
      }
    }
    // Если Supabase недоступен, заметка уже удалена из localStorage
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

