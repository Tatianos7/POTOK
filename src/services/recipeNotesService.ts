import { supabase } from '../lib/supabaseClient';
import { toUUID } from '../utils/uuid';

export interface RecipeNote {
  id: string;
  user_id: string;
  recipe_id: string;
  text: string;
  created_at: string;
  updated_at: string;
}

// Fallback на localStorage, если Supabase недоступен
const RECIPE_NOTES_STORAGE_KEY = 'potok_recipe_notes_v1';

// Кэш для отслеживания доступности таблицы в Supabase
let tableExistsCache: boolean | null = null;

class RecipeNotesService {
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
        if (error.code === 'PGRST205') {
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
  // Получить заметки из localStorage (fallback)
  private getLocalStorageNotes(userId: string): Record<string, string> {
    try {
      const key = `${RECIPE_NOTES_STORAGE_KEY}_${userId}`;
      const stored = localStorage.getItem(key);
      return stored ? JSON.parse(stored) : {};
    } catch (error) {
      console.error('[recipeNotesService] Error reading from localStorage:', error);
      return {};
    }
  }

  // Сохранить заметки в localStorage (fallback)
  private saveLocalStorageNotes(userId: string, notes: Record<string, string>): void {
    try {
      const key = `${RECIPE_NOTES_STORAGE_KEY}_${userId}`;
      localStorage.setItem(key, JSON.stringify(notes));
    } catch (error) {
      console.error('[recipeNotesService] Error saving to localStorage:', error);
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
      try {
        const uuidUserId = toUUID(userId);

        const { data, error } = await supabase
          .from('recipe_notes')
          .select('text')
          .eq('user_id', uuidUserId)
          .eq('recipe_id', recipeId)
          .single();

        if (error) {
          // Если записи нет, это нормально (not found)
          if (error.code === 'PGRST116') {
            // Fallback на localStorage
            const localNotes = this.getLocalStorageNotes(userId);
            return localNotes[recipeId] || null;
          }
          // Если таблица не найдена, сбрасываем кэш и используем localStorage
          if (error.code === 'PGRST205') {
            tableExistsCache = false;
            const localNotes = this.getLocalStorageNotes(userId);
            return localNotes[recipeId] || null;
          }
          // Fallback на localStorage при любой другой ошибке
          const localNotes = this.getLocalStorageNotes(userId);
          return localNotes[recipeId] || null;
        }

        const note = data?.text || null;
        
        // Синхронизируем с localStorage
        if (note) {
          const localNotes = this.getLocalStorageNotes(userId);
          localNotes[recipeId] = note;
          this.saveLocalStorageNotes(userId, localNotes);
        }
        
        return note;
      } catch (error) {
        // Fallback на localStorage при любой ошибке
        const localNotes = this.getLocalStorageNotes(userId);
        return localNotes[recipeId] || null;
      }
    }

    // Fallback на localStorage, если Supabase недоступен или таблица не существует
    const localNotes = this.getLocalStorageNotes(userId);
    return localNotes[recipeId] || null;
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
      try {
        const uuidUserId = toUUID(userId);

        const { data, error } = await supabase
          .from('recipe_notes')
          .select('recipe_id, text')
          .eq('user_id', uuidUserId)
          .in('recipe_id', recipeIds);

        if (error) {
          // Если таблица не найдена, сбрасываем кэш и используем localStorage
          if (error.code === 'PGRST205') {
            tableExistsCache = false;
            const localNotes = this.getLocalStorageNotes(userId);
            const result: Record<string, string> = {};
            recipeIds.forEach((id) => {
              if (localNotes[id]) {
                result[id] = localNotes[id];
              }
            });
            return result;
          }
          // Fallback на localStorage при любой ошибке
          const localNotes = this.getLocalStorageNotes(userId);
          const result: Record<string, string> = {};
          recipeIds.forEach((id) => {
            if (localNotes[id]) {
              result[id] = localNotes[id];
            }
          });
          return result;
        }

        // Преобразуем массив в объект { recipe_id: text }
        const notesMap: Record<string, string> = {};
        if (data) {
          data.forEach((note) => {
            notesMap[note.recipe_id] = note.text;
          });
        }

        // Синхронизируем с localStorage
        const localNotes = this.getLocalStorageNotes(userId);
        Object.assign(localNotes, notesMap);
        this.saveLocalStorageNotes(userId, localNotes);

        return notesMap;
      } catch (error) {
        // Fallback на localStorage
        const localNotes = this.getLocalStorageNotes(userId);
        const result: Record<string, string> = {};
        recipeIds.forEach((id) => {
          if (localNotes[id]) {
            result[id] = localNotes[id];
          }
        });
        return result;
      }
    }

    // Fallback на localStorage, если Supabase недоступен
    const localNotes = this.getLocalStorageNotes(userId);
    const result: Record<string, string> = {};
    recipeIds.forEach((id) => {
      if (localNotes[id]) {
        result[id] = localNotes[id];
      }
    });
    return result;
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

    // Сохраняем в localStorage сразу (оптимистичное обновление)
    const localNotes = this.getLocalStorageNotes(userId);
    localNotes[recipeId] = trimmedText;
    this.saveLocalStorageNotes(userId, localNotes);

    // Проверяем, существует ли таблица в Supabase
    const tableExists = await this.checkTableExists();

    // Пробуем сохранить в Supabase только если таблица существует
    if (supabase && tableExists) {
      try {
        const uuidUserId = toUUID(userId);

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
            .eq('user_id', uuidUserId)
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
        } else {
          // Создаём новую заметку
          const { error } = await supabase
            .from('recipe_notes')
            .insert({
              user_id: uuidUserId,
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
    // Удаляем из localStorage сразу
    const localNotes = this.getLocalStorageNotes(userId);
    delete localNotes[recipeId];
    this.saveLocalStorageNotes(userId, localNotes);

    // Проверяем, существует ли таблица в Supabase
    const tableExists = await this.checkTableExists();

    // Пробуем удалить из Supabase только если таблица существует
    if (supabase && tableExists) {
      try {
        const uuidUserId = toUUID(userId);

        const { error } = await supabase
          .from('recipe_notes')
          .delete()
          .eq('user_id', uuidUserId)
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
      } catch (error) {
        // Не бросаем ошибку, так как уже удалено из localStorage
        return;
      }
    }
    // Если Supabase недоступен, заметка уже удалена из localStorage
  }
}

export const recipeNotesService = new RecipeNotesService();

