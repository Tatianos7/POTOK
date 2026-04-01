import { supabase } from '../lib/supabaseClient';

class WorkoutEntryNotesService {
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
      console.warn('[workoutEntryNotesService] Передан userId не совпадает с сессией');
    }

    return data.user.id;
  }

  async getNoteByEntryId(userId: string, workoutEntryId: string): Promise<string | null> {
    if (!this.isUuid(workoutEntryId)) {
      return null;
    }

    const client = this.getSupabaseClient();
    if (!client) {
      console.warn('[workoutEntryNotesService] Supabase not available');
      return null;
    }

    try {
      const sessionUserId = await this.getSessionUserId(userId);
      const { data, error } = await client
        .from('workout_entry_notes')
        .select('text')
        .eq('user_id', sessionUserId)
        .eq('workout_entry_id', workoutEntryId)
        .limit(2);

      if (error) {
        if (error.code === 'PGRST205') {
          console.warn('[workoutEntryNotesService] Table workout_entry_notes not found. Please run SQL schema from supabase/workout_entry_notes_schema.sql');
          return null;
        }
        console.error('[workoutEntryNotesService] Error getting note:', error);
        return null;
      }

      if (!data || data.length === 0) {
        return null;
      }

      if (data.length > 1) {
        console.warn('[workoutEntryNotesService] Multiple notes found for one workout_entry_id; expected at most one');
      }

      return data[0]?.text || null;
    } catch (error) {
      console.error('[workoutEntryNotesService] Error getting note:', error);
      return null;
    }
  }

  async getNotesByEntryIds(userId: string, workoutEntryIds: string[]): Promise<Record<string, string>> {
    const validIds = workoutEntryIds.filter((id) => this.isUuid(id));
    const client = this.getSupabaseClient();
    if (!client || validIds.length === 0) {
      return {};
    }

    try {
      const sessionUserId = await this.getSessionUserId(userId);
      const { data, error } = await client
        .from('workout_entry_notes')
        .select('workout_entry_id, text')
        .eq('user_id', sessionUserId)
        .in('workout_entry_id', validIds);

      if (error) {
        if (error.code === 'PGRST205') {
          console.warn('[workoutEntryNotesService] Table workout_entry_notes not found. Please run SQL schema from supabase/workout_entry_notes_schema.sql');
          return {};
        }
        console.error('[workoutEntryNotesService] Error getting notes:', error);
        return {};
      }

      const notesMap: Record<string, string> = {};
      if (data) {
        data.forEach((note) => {
          notesMap[String(note.workout_entry_id)] = note.text;
        });
      }

      return notesMap;
    } catch (error) {
      console.error('[workoutEntryNotesService] Error getting notes:', error);
      return {};
    }
  }

  async saveNote(userId: string, workoutEntryId: string, text: string): Promise<void> {
    if (!this.isUuid(workoutEntryId)) {
      return;
    }

    const client = this.getSupabaseClient();
    if (!client) {
      console.warn('[workoutEntryNotesService] Supabase not available');
      return;
    }

    try {
      const sessionUserId = await this.getSessionUserId(userId);
      const { error } = await client
        .from('workout_entry_notes')
        .upsert(
          {
            user_id: sessionUserId,
            workout_entry_id: workoutEntryId,
            text: text.trim(),
            updated_at: new Date().toISOString(),
          },
          { onConflict: 'workout_entry_id' },
        );

      if (error) {
        if (error.code === 'PGRST205') {
          const errorMsg =
            'Таблица workout_entry_notes не найдена. Пожалуйста, выполните SQL схему из файла supabase/workout_entry_notes_schema.sql в Supabase SQL Editor';
          console.error('[workoutEntryNotesService]', errorMsg);
          throw new Error(errorMsg);
        }
        console.error('[workoutEntryNotesService] Error saving note:', error);
        throw error;
      }
    } catch (error) {
      console.error('[workoutEntryNotesService] Error saving note:', error);
      throw error;
    }
  }

  async deleteNote(userId: string, workoutEntryId: string): Promise<void> {
    if (!this.isUuid(workoutEntryId)) {
      return;
    }

    const client = this.getSupabaseClient();
    if (!client) {
      console.warn('[workoutEntryNotesService] Supabase not available');
      return;
    }

    try {
      const sessionUserId = await this.getSessionUserId(userId);
      const { error } = await client
        .from('workout_entry_notes')
        .delete()
        .eq('user_id', sessionUserId)
        .eq('workout_entry_id', workoutEntryId);

      if (error) {
        if (error.code === 'PGRST205') {
          const errorMsg =
            'Таблица workout_entry_notes не найдена. Пожалуйста, выполните SQL схему из файла supabase/workout_entry_notes_schema.sql в Supabase SQL Editor';
          console.error('[workoutEntryNotesService]', errorMsg);
          throw new Error(errorMsg);
        }
        console.error('[workoutEntryNotesService] Error deleting note:', error);
        throw error;
      }
    } catch (error) {
      console.error('[workoutEntryNotesService] Error deleting note:', error);
      throw error;
    }
  }
}

export const workoutEntryNotesService = new WorkoutEntryNotesService();
