import { supabase } from '../lib/supabaseClient';

export interface MealEntryNote {
  id: string;
  user_id: string;
  meal_entry_id: string;
  product_id?: string | null;
  text: string;
  created_at: string;
  updated_at: string;
}

class MealEntryNotesService {
  private async getSessionUserId(userId?: string): Promise<string> {
    if (!supabase) {
      throw new Error('Supabase не инициализирован');
    }

    const { data, error } = await supabase.auth.getUser();
    if (error || !data?.user?.id) {
      throw new Error('Пользователь не авторизован');
    }

    if (userId && userId !== data.user.id) {
      console.warn('[mealEntryNotesService] Передан userId не совпадает с сессией');
    }

    return data.user.id;
  }
  /**
   * Получить заметку для записи приёма пищи
   */
  async getNoteByEntryId(userId: string, mealEntryId: string): Promise<string | null> {
    if (!supabase) {
      console.warn('[mealEntryNotesService] Supabase not available');
      return null;
    }

    try {
      const sessionUserId = await this.getSessionUserId(userId);

      const { data, error } = await supabase
        .from('meal_entry_notes')
        .select('text')
        .eq('user_id', sessionUserId)
        .eq('meal_entry_id', mealEntryId)
        .single();

      if (error) {
        // Если записи нет, это нормально (not found)
        if (error.code === 'PGRST116') {
          return null;
        }
        // Если таблица не найдена, это значит, что SQL схема не выполнена
        if (error.code === 'PGRST205') {
          console.warn('[mealEntryNotesService] Table meal_entry_notes not found. Please run SQL schema from supabase/meal_entry_notes_schema.sql');
          return null;
        }
        console.error('[mealEntryNotesService] Error getting note:', error);
        return null;
      }

      return data?.text || null;
    } catch (error) {
      console.error('[mealEntryNotesService] Error getting note:', error);
      return null;
    }
  }

  /**
   * Получить все заметки для массива записей приёма пищи
   */
  async getNotesByEntryIds(userId: string, mealEntryIds: string[]): Promise<Record<string, string>> {
    if (!supabase || mealEntryIds.length === 0) {
      return {};
    }

    try {
      const sessionUserId = await this.getSessionUserId(userId);

      const { data, error } = await supabase
        .from('meal_entry_notes')
        .select('meal_entry_id, text')
        .eq('user_id', sessionUserId)
        .in('meal_entry_id', mealEntryIds);

      if (error) {
        // Если таблица не найдена, это значит, что SQL схема не выполнена
        if (error.code === 'PGRST205') {
          console.warn('[mealEntryNotesService] Table meal_entry_notes not found. Please run SQL schema from supabase/meal_entry_notes_schema.sql');
          return {};
        }
        console.error('[mealEntryNotesService] Error getting notes:', error);
        return {};
      }

      // Преобразуем массив в объект { meal_entry_id: text }
      const notesMap: Record<string, string> = {};
      if (data) {
        data.forEach((note) => {
          // Преобразуем UUID обратно в строку для совместимости
          const entryId = String(note.meal_entry_id);
          notesMap[entryId] = note.text;
        });
      }

      return notesMap;
    } catch (error) {
      console.error('[mealEntryNotesService] Error getting notes:', error);
      return {};
    }
  }

  /**
   * Сохранить или обновить заметку для записи приёма пищи
   */
  async saveNote(
    userId: string,
    mealEntryId: string,
    text: string
  ): Promise<void> {
    if (!supabase) {
      console.warn('[mealEntryNotesService] Supabase not available');
      return;
    }

    try {
      const sessionUserId = await this.getSessionUserId(userId);
      const trimmedText = text.trim();

      const { error } = await supabase
        .from('meal_entry_notes')
        .upsert({
          user_id: sessionUserId,
          meal_entry_id: mealEntryId,
          text: trimmedText,
          updated_at: new Date().toISOString(),
        }, {
          onConflict: 'meal_entry_id',
        });

      if (error) {
        // Если таблица не найдена, это значит, что SQL схема не выполнена
        if (error.code === 'PGRST205') {
          const errorMsg = 'Таблица meal_entry_notes не найдена. Пожалуйста, выполните SQL схему из файла supabase/meal_entry_notes_schema.sql в Supabase SQL Editor';
          console.error('[mealEntryNotesService]', errorMsg);
          throw new Error(errorMsg);
        }
        console.error('[mealEntryNotesService] Error saving note:', error);
        throw error;
      }
    } catch (error) {
      console.error('[mealEntryNotesService] Error saving note:', error);
      throw error;
    }
  }

  /**
   * Удалить заметку для записи приёма пищи
   */
  async deleteNote(userId: string, mealEntryId: string): Promise<void> {
    if (!supabase) {
      console.warn('[mealEntryNotesService] Supabase not available');
      return;
    }

    try {
      const sessionUserId = await this.getSessionUserId(userId);

      const { error } = await supabase
        .from('meal_entry_notes')
        .delete()
        .eq('user_id', sessionUserId)
        .eq('meal_entry_id', mealEntryId);

      if (error) {
        // Если таблица не найдена, это значит, что SQL схема не выполнена
        if (error.code === 'PGRST205') {
          const errorMsg = 'Таблица meal_entry_notes не найдена. Пожалуйста, выполните SQL схему из файла supabase/meal_entry_notes_schema.sql в Supabase SQL Editor';
          console.error('[mealEntryNotesService]', errorMsg);
          throw new Error(errorMsg);
        }
        console.error('[mealEntryNotesService] Error deleting note:', error);
        throw error;
      }
    } catch (error) {
      console.error('[mealEntryNotesService] Error deleting note:', error);
      throw error;
    }
  }
}

export const mealEntryNotesService = new MealEntryNotesService();

