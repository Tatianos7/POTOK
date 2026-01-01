import { supabase } from '../lib/supabaseClient';
import { toUUID } from '../utils/uuid';

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
  /**
   * Получить заметку для записи приёма пищи
   */
  async getNoteByEntryId(userId: string, mealEntryId: string): Promise<string | null> {
    if (!supabase) {
      console.warn('[mealEntryNotesService] Supabase not available');
      return null;
    }

    try {
      const uuidUserId = toUUID(userId);
      const uuidEntryId = toUUID(mealEntryId);

      const { data, error } = await supabase
        .from('meal_entry_notes')
        .select('text')
        .eq('user_id', uuidUserId)
        .eq('meal_entry_id', uuidEntryId)
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
      const uuidUserId = toUUID(userId);
      const uuidEntryIds = mealEntryIds.map(id => toUUID(id));

      const { data, error } = await supabase
        .from('meal_entry_notes')
        .select('meal_entry_id, text')
        .eq('user_id', uuidUserId)
        .in('meal_entry_id', uuidEntryIds);

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
      const uuidUserId = toUUID(userId);
      const uuidEntryId = toUUID(mealEntryId);
      const trimmedText = text.trim();

      // Проверяем, существует ли заметка
      const existingNote = await this.getNoteByEntryId(userId, mealEntryId);

      if (existingNote !== null) {
        // Обновляем существующую заметку
        const { error } = await supabase
          .from('meal_entry_notes')
          .update({
            text: trimmedText,
            updated_at: new Date().toISOString(),
          })
          .eq('user_id', uuidUserId)
          .eq('meal_entry_id', uuidEntryId);

        if (error) {
          // Если таблица не найдена, это значит, что SQL схема не выполнена
          if (error.code === 'PGRST205') {
            const errorMsg = 'Таблица meal_entry_notes не найдена. Пожалуйста, выполните SQL схему из файла supabase/meal_entry_notes_schema.sql в Supabase SQL Editor';
            console.error('[mealEntryNotesService]', errorMsg);
            throw new Error(errorMsg);
          }
          console.error('[mealEntryNotesService] Error updating note:', error);
          throw error;
        }
      } else {
        // Создаём новую заметку
        const { error } = await supabase
          .from('meal_entry_notes')
          .insert({
            user_id: uuidUserId,
            meal_entry_id: uuidEntryId,
            text: trimmedText,
          });

        if (error) {
          // Если таблица не найдена, это значит, что SQL схема не выполнена
          if (error.code === 'PGRST205') {
            const errorMsg = 'Таблица meal_entry_notes не найдена. Пожалуйста, выполните SQL схему из файла supabase/meal_entry_notes_schema.sql в Supabase SQL Editor';
            console.error('[mealEntryNotesService]', errorMsg);
            throw new Error(errorMsg);
          }
          console.error('[mealEntryNotesService] Error creating note:', error);
          throw error;
        }
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
      const uuidUserId = toUUID(userId);
      const uuidEntryId = toUUID(mealEntryId);

      const { error } = await supabase
        .from('meal_entry_notes')
        .delete()
        .eq('user_id', uuidUserId)
        .eq('meal_entry_id', uuidEntryId);

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

