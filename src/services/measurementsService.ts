import { supabase } from '../lib/supabaseClient';

export interface Measurement {
  id: string;
  name: string;
  value: string;
}

export interface MeasurementHistory {
  id: string;
  date: string;
  measurements: Measurement[];
  photos: string[];
  additionalPhotos: string[];
}

export interface PhotoHistory {
  id: string;
  date: string;
  photos: string[];
  additionalPhotos: string[];
}

class MeasurementsService {
  private readonly MEASUREMENTS_STORAGE_KEY = 'potok_measurements';
  private readonly PHOTOS_STORAGE_KEY = 'potok_measurement_photos';
  private readonly ADDITIONAL_PHOTOS_STORAGE_KEY = 'potok_measurement_additional_photos';
  private readonly HISTORY_STORAGE_KEY = 'potok_measurement_history';
  private readonly PHOTO_HISTORY_STORAGE_KEY = 'potok_measurement_photo_history';

  private async getSessionUserId(userId?: string): Promise<string> {
    if (!supabase) {
      throw new Error('Supabase не инициализирован');
    }

    const { data, error } = await supabase.auth.getUser();
    if (error || !data?.user?.id) {
      throw new Error('Пользователь не авторизован');
    }

    if (userId && userId !== data.user.id) {
      console.warn('[measurementsService] Передан userId не совпадает с сессией');
    }

    return data.user.id;
  }

  // Получить текущие замеры
  async getCurrentMeasurements(userId: string): Promise<Measurement[]> {
    // Try Supabase first
    if (supabase) {
      try {
        const sessionUserId = await this.getSessionUserId(userId);
        const { data, error } = await supabase
          .from('user_measurements')
          .select('measurements')
          .eq('user_id', sessionUserId)
          .maybeSingle();

        if (error) {
          // PGRST116 = no rows returned (это нормально, если замеров еще нет)
          if (error.code !== 'PGRST116') {
            console.error('[measurementsService] Supabase error:', error);
          }
          // Fallback to localStorage
        } else if (data && data.measurements) {
          const measurements: Measurement[] = data.measurements as Measurement[];
          // Sync to localStorage
          this.saveMeasurementsToLocalStorage(sessionUserId, measurements);
          return measurements;
        }
      } catch (err) {
        console.error('[measurementsService] Supabase connection error:', err);
        // Fallback to localStorage
      }
    }

    // Fallback to localStorage
    try {
      const sessionUserId = await this.getSessionUserId(userId);
      const stored = localStorage.getItem(`${this.MEASUREMENTS_STORAGE_KEY}_${sessionUserId}`);
      if (stored) {
        return JSON.parse(stored);
      }
    } catch (error) {
      console.error('[measurementsService] Error loading from localStorage:', error);
    }

    // Default measurements
    return [
      { id: 'neck', name: 'ШЕЯ', value: '0' },
      { id: 'shoulders', name: 'ПЛЕЧИ', value: '0' },
      { id: 'chest', name: 'ГРУДЬ', value: '0' },
      { id: 'back', name: 'СПИНА', value: '0' },
    ];
  }

  // Сохранить текущие замеры
  async saveCurrentMeasurements(
    userId: string,
    measurements: Measurement[],
    photos: string[],
    additionalPhotos: string[]
  ): Promise<void> {
    // Try to save to Supabase
    if (supabase) {
      try {
        const sessionUserId = await this.getSessionUserId(userId);
        const { error } = await supabase
          .from('user_measurements')
          .upsert({
            user_id: sessionUserId,
            measurements: measurements,
            photos: photos.filter(p => p !== ''),
            additional_photos: additionalPhotos.filter(p => p !== ''),
            updated_at: new Date().toISOString(),
          }, {
            onConflict: 'user_id',
          });

        if (error) {
          console.error('[measurementsService] Supabase save error:', error);
        }
        this.saveMeasurementsToLocalStorage(sessionUserId, measurements);
        this.savePhotosToLocalStorage(sessionUserId, photos, additionalPhotos);
      } catch (err) {
        console.error('[measurementsService] Supabase save connection error:', err);
      }
    }
  }

  // Получить текущие фото
  async getCurrentPhotos(userId: string): Promise<{ photos: string[]; additionalPhotos: string[] }> {
    // Try Supabase first
    if (supabase) {
      try {
        const sessionUserId = await this.getSessionUserId(userId);
        const { data, error } = await supabase
          .from('user_measurements')
          .select('photos, additional_photos')
          .eq('user_id', sessionUserId)
          .maybeSingle();

        if (error) {
          // PGRST116 = no rows returned (это нормально, если фото еще нет)
          if (error.code !== 'PGRST116') {
            console.error('[measurementsService] Supabase error:', error);
          }
          // Fallback to localStorage
        } else if (data) {
          const photos = (data.photos as string[]) || [];
          const additionalPhotos = (data.additional_photos as string[]) || [];
          return { photos, additionalPhotos };
        }
      } catch (err) {
        console.error('[measurementsService] Supabase connection error:', err);
        // Fallback to localStorage
      }
    }

    // Fallback to localStorage
    try {
      const sessionUserId = await this.getSessionUserId(userId);
      const savedPhotos = localStorage.getItem(`${this.PHOTOS_STORAGE_KEY}_${sessionUserId}`);
      const savedAdditional = localStorage.getItem(`${this.ADDITIONAL_PHOTOS_STORAGE_KEY}_${sessionUserId}`);
      
      const photos = savedPhotos ? JSON.parse(savedPhotos) : ['', '', ''];
      const additionalPhotos = savedAdditional ? JSON.parse(savedAdditional) : [];
      
      return { photos, additionalPhotos };
    } catch (error) {
      console.error('[measurementsService] Error loading photos from localStorage:', error);
      return { photos: ['', '', ''], additionalPhotos: [] };
    }
  }

  // Получить историю замеров
  async getMeasurementHistory(userId: string): Promise<MeasurementHistory[]> {
    const limit = 365;
    // Try Supabase first
    if (supabase) {
      try {
        const sessionUserId = await this.getSessionUserId(userId);
        const { data, error } = await supabase
          .from('measurement_history')
          .select('*')
          .eq('user_id', sessionUserId)
          .order('date', { ascending: false })
          .limit(limit);

        if (error) {
          console.error('[measurementsService] Supabase error:', error);
          // Fallback to localStorage
        } else if (data) {
          const history: MeasurementHistory[] = data.map((entry) => ({
            id: entry.id,
            date: entry.date,
            measurements: entry.measurements as Measurement[],
            photos: (entry.photos as string[]) || [],
            additionalPhotos: (entry.additional_photos as string[]) || [],
          }));
          // Sync to localStorage
          this.saveHistoryToLocalStorage(sessionUserId, history);
          return history;
        }
      } catch (err) {
        console.error('[measurementsService] Supabase connection error:', err);
        // Fallback to localStorage
      }
    }

    // Fallback to localStorage
    try {
      const sessionUserId = await this.getSessionUserId(userId);
      const stored = localStorage.getItem(`${this.HISTORY_STORAGE_KEY}_${sessionUserId}`);
      if (stored) {
        return JSON.parse(stored);
      }
    } catch (error) {
      console.error('[measurementsService] Error loading history from localStorage:', error);
    }

    return [];
  }

  // Сохранить запись в историю замеров
  async saveMeasurementHistory(
    userId: string,
    entry: MeasurementHistory
  ): Promise<void> {
    // Try to save to Supabase
    if (supabase) {
      try {
        const sessionUserId = await this.getSessionUserId(userId);
        const { error } = await supabase
          .from('measurement_history')
          .upsert(
            {
              id: entry.id,
              user_id: sessionUserId,
              date: entry.date,
              measurements: entry.measurements,
              photos: entry.photos,
              additional_photos: entry.additionalPhotos,
            },
            { onConflict: 'user_id,date' }
          );

        if (error) {
          console.error('[measurementsService] Supabase history upsert error:', error);
        }
      } catch (err) {
        console.error('[measurementsService] Supabase history save connection error:', err);
      }
    }

    const history = await this.getMeasurementHistory(userId);
    const updatedHistory = [entry, ...history.filter(h => h.date !== entry.date)];
    const sessionUserId = await this.getSessionUserId(userId);
    this.saveHistoryToLocalStorage(sessionUserId, updatedHistory);
  }

  // Получить историю фото
  async getPhotoHistory(userId: string): Promise<PhotoHistory[]> {
    const limit = 365;
    // Try Supabase first
    if (supabase) {
      try {
        const sessionUserId = await this.getSessionUserId(userId);
        const { data, error } = await supabase
          .from('measurement_photo_history')
          .select('*')
          .eq('user_id', sessionUserId)
          .order('date', { ascending: false })
          .limit(limit);

        if (error) {
          console.error('[measurementsService] Supabase error:', error);
          // Fallback to localStorage
        } else if (data) {
          const history: PhotoHistory[] = data.map((entry) => ({
            id: entry.id,
            date: entry.date,
            photos: (entry.photos as string[]) || [],
            additionalPhotos: (entry.additional_photos as string[]) || [],
          }));
          // Sync to localStorage
          this.savePhotoHistoryToLocalStorage(sessionUserId, history);
          return history;
        }
      } catch (err) {
        console.error('[measurementsService] Supabase connection error:', err);
        // Fallback to localStorage
      }
    }

    // Fallback to localStorage
    try {
      const sessionUserId = await this.getSessionUserId(userId);
      const stored = localStorage.getItem(`${this.PHOTO_HISTORY_STORAGE_KEY}_${sessionUserId}`);
      if (stored) {
        return JSON.parse(stored);
      }
    } catch (error) {
      console.error('[measurementsService] Error loading photo history from localStorage:', error);
    }

    return [];
  }

  // Сохранить запись в историю фото
  async savePhotoHistory(
    userId: string,
    entry: PhotoHistory
  ): Promise<void> {
    // Try to save to Supabase
    if (supabase) {
      try {
        const sessionUserId = await this.getSessionUserId(userId);
        const { error } = await supabase
          .from('measurement_photo_history')
          .upsert(
            {
              id: entry.id,
              user_id: sessionUserId,
              date: entry.date,
              photos: entry.photos,
              additional_photos: entry.additionalPhotos,
            },
            { onConflict: 'user_id,date' }
          );

        if (error) {
          console.error('[measurementsService] Supabase photo history upsert error:', error);
        }
      } catch (err) {
        console.error('[measurementsService] Supabase photo history save connection error:', err);
      }
    }

    const history = await this.getPhotoHistory(userId);
    const updatedHistory = [entry, ...history.filter(h => h.date !== entry.date)];
    const sessionUserId = await this.getSessionUserId(userId);
    this.savePhotoHistoryToLocalStorage(sessionUserId, updatedHistory);
  }

  // Удалить запись из истории замеров
  async deleteMeasurementHistory(userId: string, entryId: string): Promise<void> {
    // Delete from localStorage
    const history = await this.getMeasurementHistory(userId);
    const updatedHistory = history.filter(h => h.id !== entryId);
    this.saveHistoryToLocalStorage(userId, updatedHistory);

    // Try to delete from Supabase
    if (supabase) {
      try {
        const { error } = await supabase
          .from('measurement_history')
          .delete()
          .eq('id', entryId);

        if (error) {
          console.error('[measurementsService] Supabase delete error:', error);
        }
      } catch (err) {
        console.error('[measurementsService] Supabase delete connection error:', err);
      }
    }
  }

  // Удалить запись из истории фото
  async deletePhotoHistory(userId: string, entryId: string): Promise<void> {
    // Delete from localStorage
    const history = await this.getPhotoHistory(userId);
    const updatedHistory = history.filter(h => h.id !== entryId);
    this.savePhotoHistoryToLocalStorage(userId, updatedHistory);

    // Try to delete from Supabase
    if (supabase) {
      try {
        const { error } = await supabase
          .from('measurement_photo_history')
          .delete()
          .eq('id', entryId);

        if (error) {
          console.error('[measurementsService] Supabase photo history delete error:', error);
        }
      } catch (err) {
        console.error('[measurementsService] Supabase photo history delete connection error:', err);
      }
    }
  }

  // Helper methods for localStorage
  private saveMeasurementsToLocalStorage(userId: string, measurements: Measurement[]): void {
    try {
      localStorage.setItem(`${this.MEASUREMENTS_STORAGE_KEY}_${userId}`, JSON.stringify(measurements));
    } catch (error) {
      console.error('[measurementsService] Error saving measurements to localStorage:', error);
    }
  }

  private savePhotosToLocalStorage(userId: string, photos: string[], additionalPhotos: string[]): void {
    try {
      const allPhotos = [...photos, ...additionalPhotos];
      localStorage.setItem(`${this.PHOTOS_STORAGE_KEY}_${userId}`, JSON.stringify(allPhotos));
      localStorage.setItem(`${this.ADDITIONAL_PHOTOS_STORAGE_KEY}_${userId}`, JSON.stringify(additionalPhotos));
    } catch (error) {
      console.error('[measurementsService] Error saving photos to localStorage:', error);
    }
  }

  private saveHistoryToLocalStorage(userId: string, history: MeasurementHistory[]): void {
    try {
      localStorage.setItem(`${this.HISTORY_STORAGE_KEY}_${userId}`, JSON.stringify(history));
    } catch (error) {
      console.error('[measurementsService] Error saving history to localStorage:', error);
    }
  }

  private savePhotoHistoryToLocalStorage(userId: string, history: PhotoHistory[]): void {
    try {
      localStorage.setItem(`${this.PHOTO_HISTORY_STORAGE_KEY}_${userId}`, JSON.stringify(history));
    } catch (error) {
      console.error('[measurementsService] Error saving photo history to localStorage:', error);
    }
  }
}

export const measurementsService = new MeasurementsService();

