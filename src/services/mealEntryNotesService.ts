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
  private readonly UUID_RE =
    /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

  protected getSupabaseClient() {
    return supabase;
  }

  private isUuid(value: string | null | undefined): boolean {
    return typeof value === 'string' && this.UUID_RE.test(value);
  }

  private async getSessionUserId(userId?: string): Promise<string> {
    const client = this.getSupabaseClient();
    if (!client) {
      throw new Error('Supabase не инициализирован');
    }

    const { data, error } = await client.auth.getUser();
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
    if (!this.isUuid(mealEntryId)) {
      return null;
    }
    const client = this.getSupabaseClient();
    if (!client) {
      console.warn('[mealEntryNotesService] Supabase not available');
      return null;
    }

    try {
      const sessionUserId = await this.getSessionUserId(userId);

      const { data, error } = await client
        .from('meal_entry_notes')
        .select('text')
        .eq('user_id', sessionUserId)
        .eq('meal_entry_id', mealEntryId)
        .limit(2);

      if (error) {
        // Если таблица не найдена, это значит, что SQL схема не выполнена
        if (error.code === 'PGRST205') {
          console.warn('[mealEntryNotesService] Table meal_entry_notes not found. Please run SQL schema from supabase/meal_entry_notes_schema.sql');
          return null;
        }
        console.error('[mealEntryNotesService] Error getting note:', error);
        return null;
      }

      if (!data || data.length === 0) {
        return null;
      }

      if (data.length > 1) {
        console.warn('[mealEntryNotesService] Multiple notes found for one meal_entry_id; expected at most one');
      }

      return data[0]?.text || null;
    } catch (error) {
      console.error('[mealEntryNotesService] Error getting note:', error);
      return null;
    }
  }

  /**
   * Получить все заметки для массива записей приёма пищи
   */
  async getNotesByEntryIds(userId: string, mealEntryIds: string[]): Promise<Record<string, string>> {
    const validIds = mealEntryIds.filter((id) => this.isUuid(id));
    const client = this.getSupabaseClient();
    if (!client || validIds.length === 0) {
      return {};
    }

    try {
      const sessionUserId = await this.getSessionUserId(userId);

      const { data, error } = await client
        .from('meal_entry_notes')
        .select('meal_entry_id, text')
        .eq('user_id', sessionUserId)
        .in('meal_entry_id', validIds);

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
    if (!this.isUuid(mealEntryId)) {
      return;
    }
    const client = this.getSupabaseClient();
    if (!client) {
      console.warn('[mealEntryNotesService] Supabase not available');
      return;
    }

    try {
      const sessionUserId = await this.getSessionUserId(userId);
      const trimmedText = text.trim();

      const { error } = await client
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
    if (!this.isUuid(mealEntryId)) {
      return;
    }
    const client = this.getSupabaseClient();
    if (!client) {
      console.warn('[mealEntryNotesService] Supabase not available');
      return;
    }

    try {
      const sessionUserId = await this.getSessionUserId(userId);

      const { error } = await client
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
