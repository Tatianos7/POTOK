import { supabase } from '../lib/supabaseClient';

class WorkoutDayNotesService {
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
      console.warn('[workoutDayNotesService] Передан userId не совпадает с сессией');
    }

    return data.user.id;
  }

  async getNoteByWorkoutDayId(userId: string, workoutDayId: string): Promise<string | null> {
    if (!this.isUuid(workoutDayId)) {
      return null;
    }

    const client = this.getSupabaseClient();
    if (!client) {
      console.warn('[workoutDayNotesService] Supabase not available');
      return null;
    }

    try {
      const sessionUserId = await this.getSessionUserId(userId);
      const { data, error } = await client
        .from('workout_day_notes')
        .select('text')
        .eq('user_id', sessionUserId)
        .eq('workout_day_id', workoutDayId)
        .limit(2);

      if (error) {
        if (error.code === 'PGRST205') {
          console.warn('[workoutDayNotesService] Table workout_day_notes not found. Please run SQL schema from supabase/workout_day_notes_schema.sql');
          return null;
        }
        console.error('[workoutDayNotesService] Error getting note:', error);
        return null;
      }

      if (!data || data.length === 0) {
        return null;
      }

      if (data.length > 1) {
        console.warn('[workoutDayNotesService] Multiple notes found for one workout_day_id; expected at most one');
      }

      return data[0]?.text || null;
    } catch (error) {
      console.error('[workoutDayNotesService] Error getting note:', error);
      return null;
    }
  }

  async saveNote(userId: string, workoutDayId: string, text: string): Promise<void> {
    if (!this.isUuid(workoutDayId)) {
      throw new Error('Некорректный workout day для сохранения заметки');
    }

    const client = this.getSupabaseClient();
    if (!client) {
      throw new Error('Supabase не инициализирован');
    }

    try {
      const sessionUserId = await this.getSessionUserId(userId);
      const { error } = await client
        .from('workout_day_notes')
        .upsert(
          {
            user_id: sessionUserId,
            workout_day_id: workoutDayId,
            text: text.trim(),
            updated_at: new Date().toISOString(),
          },
          { onConflict: 'workout_day_id' },
        );

      if (error) {
        if (error.code === 'PGRST205') {
          const errorMsg =
            'Таблица workout_day_notes не найдена. Пожалуйста, выполните SQL схему из файла supabase/workout_day_notes_schema.sql в Supabase SQL Editor';
          console.error('[workoutDayNotesService]', errorMsg);
          throw new Error(errorMsg);
        }
        console.error('[workoutDayNotesService] Error saving note:', error);
        throw error;
      }
    } catch (error) {
      console.error('[workoutDayNotesService] Error saving note:', error);
      throw error;
    }
  }

  async deleteNote(userId: string, workoutDayId: string): Promise<void> {
    if (!this.isUuid(workoutDayId)) {
      throw new Error('Некорректный workout day для удаления заметки');
    }

    const client = this.getSupabaseClient();
    if (!client) {
      throw new Error('Supabase не инициализирован');
    }

    try {
      const sessionUserId = await this.getSessionUserId(userId);
      const { error } = await client
        .from('workout_day_notes')
        .delete()
        .eq('user_id', sessionUserId)
        .eq('workout_day_id', workoutDayId);

      if (error) {
        if (error.code === 'PGRST205') {
          const errorMsg =
            'Таблица workout_day_notes не найдена. Пожалуйста, выполните SQL схему из файла supabase/workout_day_notes_schema.sql в Supabase SQL Editor';
          console.error('[workoutDayNotesService]', errorMsg);
          throw new Error(errorMsg);
        }
        console.error('[workoutDayNotesService] Error deleting note:', error);
        throw error;
      }
    } catch (error) {
      console.error('[workoutDayNotesService] Error deleting note:', error);
      throw error;
    }
  }
}

export const workoutDayNotesService = new WorkoutDayNotesService();
