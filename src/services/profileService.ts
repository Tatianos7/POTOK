import { supabase } from '../lib/supabaseClient';
import { ProfileDetails } from '../types';
import type { CoachMode, CoachSettings } from '../types/coachSettings';

export interface UserProfile {
  user_id: string;
  first_name?: string;
  last_name?: string;
  middle_name?: string;
  birth_date?: string;
  age?: number;
  height?: number;
  goal?: string;
  email?: string;
  phone?: string;
  avatar_url?: string;
  has_premium: boolean;
  is_admin: boolean;
  created_at: string;
  updated_at: string;
}

class ProfileService {
  private readonly AVATAR_STORAGE_KEY = 'potok_user_avatar';
  private readonly COACH_SETTINGS_KEY = 'potok_coach_settings';
  private userIdColumn: 'user_id' | 'id_user' | null = null;

  private async getSessionUserId(userId?: string): Promise<string> {
    if (!supabase) {
      throw new Error('Supabase не инициализирован');
    }

    const { data, error } = await supabase.auth.getUser();
    if (error || !data?.user?.id) {
      throw new Error('Пользователь не авторизован');
    }

    if (userId && userId !== data.user.id) {
      console.warn('[profileService] Передан userId не совпадает с сессией');
    }

    return data.user.id;
  }

  private async resolveUserIdColumn(): Promise<'user_id' | 'id_user'> {
    if (this.userIdColumn) {
      return this.userIdColumn;
    }
    if (!supabase) {
      this.userIdColumn = 'user_id';
      return this.userIdColumn;
    }
    const { error } = await supabase.from('user_profiles').select('user_id').limit(1);
    if (error?.message?.includes('user_profiles.user_id does not exist')) {
      this.userIdColumn = 'id_user';
    } else {
      this.userIdColumn = 'user_id';
    }
    return this.userIdColumn;
  }

  // Получить профиль пользователя
  async getProfile(userId: string): Promise<UserProfile | null> {
    if (!supabase) {
      throw new Error('Supabase не инициализирован');
    }

    const sessionUserId = await this.getSessionUserId(userId);
    const userIdColumn = await this.resolveUserIdColumn();

    // Try Supabase first
    if (supabase) {
      try {
        const { data, error } = await supabase
          .from('user_profiles')
          .select('*')
          .eq(userIdColumn, sessionUserId)
          .maybeSingle();

        if (error) {
          // PGRST116 = no rows returned (это нормально, если профиля еще нет)
          if (error.code !== 'PGRST116') {
            // Не показываем ошибки для сетевых проблем (Failed to fetch, ERR_NAME_NOT_RESOLVED)
            const isNetworkError = error.message?.includes('Failed to fetch') || 
                                   error.message?.includes('ERR_NAME_NOT_RESOLVED') ||
                                   error.message?.includes('NetworkError');
            if (!isNetworkError) {
              console.warn('[profileService] Supabase error:', error.message || error);
            }
          }
          // Fallback to localStorage
        } else if (data) {
          const profile: UserProfile = {
            user_id: data.user_id ?? data.id_user,
            first_name: data.first_name || undefined,
            last_name: data.last_name || undefined,
            middle_name: data.middle_name || undefined,
            birth_date: data.birth_date || undefined,
            age: data.age || undefined,
            height: data.height ? Number(data.height) : undefined,
            goal: data.goal || undefined,
            email: data.email || undefined,
            phone: data.phone || undefined,
            avatar_url: data.avatar_url || undefined,
            has_premium: data.has_premium || false,
            is_admin: data.is_admin || false,
            created_at: data.created_at,
            updated_at: data.updated_at,
          };

          return profile;
        }
      } catch (err: any) {
        // Не показываем ошибки для сетевых проблем
        const isNetworkError = err?.message?.includes('Failed to fetch') || 
                               err?.message?.includes('ERR_NAME_NOT_RESOLVED') ||
                               err?.message?.includes('NetworkError');
        if (!isNetworkError) {
          console.warn('[profileService] Supabase connection error:', err?.message || err);
        }
        // Fallback to localStorage
      }
    }

    return null;
  }

  // Сохранить/обновить профиль пользователя
  async saveProfile(userId: string, profile: Partial<ProfileDetails>): Promise<void> {
    const sessionUserId = await this.getSessionUserId(userId);
    const userIdColumn = await this.resolveUserIdColumn();

    const existingProfile = await this.getProfile(userId);
    const updatedProfile: UserProfile = {
      user_id: sessionUserId,
      first_name: profile.firstName || existingProfile?.first_name,
      last_name: profile.lastName || existingProfile?.last_name,
      middle_name: profile.middleName || existingProfile?.middle_name,
      birth_date: profile.birthDate || existingProfile?.birth_date,
      age: profile.age || existingProfile?.age,
      height: profile.height || existingProfile?.height,
      goal: profile.goal || existingProfile?.goal,
      email: profile.email || existingProfile?.email,
      phone: profile.phone || existingProfile?.phone,
      avatar_url: existingProfile?.avatar_url,
      has_premium: existingProfile?.has_premium || false,
      is_admin: existingProfile?.is_admin || false,
      created_at: existingProfile?.created_at || new Date().toISOString(),
      updated_at: new Date().toISOString(),
    };

    // Try to save to Supabase
    if (supabase) {
      try {
        const { error } = await supabase
          .from('user_profiles')
          .upsert({
            [userIdColumn]: sessionUserId,
            first_name: updatedProfile.first_name || null,
            last_name: updatedProfile.last_name || null,
            middle_name: updatedProfile.middle_name || null,
            birth_date: updatedProfile.birth_date || null,
            age: updatedProfile.age || null,
            height: updatedProfile.height || null,
            goal: updatedProfile.goal || null,
            email: updatedProfile.email || null,
            phone: updatedProfile.phone || null,
            avatar_url: updatedProfile.avatar_url || null,
            has_premium: updatedProfile.has_premium,
            is_admin: updatedProfile.is_admin,
          }, {
            onConflict: userIdColumn,
          });

        if (error) {
          console.error('[profileService] Supabase save error:', error);
        }
      } catch (err) {
        console.error('[profileService] Supabase save connection error:', err);
      }
    }
  }

  // Обновить админ статус
  async updateAdminStatus(userId: string, isAdmin: boolean): Promise<void> {
    const sessionUserId = await this.getSessionUserId(userId);
    const userIdColumn = await this.resolveUserIdColumn();

    // Try to update in Supabase
    if (supabase) {
      try {
        const { error } = await supabase
          .from('user_profiles')
          .update({ is_admin: isAdmin })
          .eq(userIdColumn, sessionUserId);

        if (error) {
          console.error('[profileService] Supabase admin status update error:', error);
        }
      } catch (err) {
        console.error('[profileService] Supabase admin status update connection error:', err);
      }
    }
  }

  // Обновить премиум статус
  async updatePremiumStatus(userId: string, hasPremium: boolean): Promise<void> {
    const sessionUserId = await this.getSessionUserId(userId);
    const userIdColumn = await this.resolveUserIdColumn();

    // Try to update in Supabase
    if (supabase) {
      try {
        const { error } = await supabase
          .from('user_profiles')
          .update({ has_premium: hasPremium })
          .eq(userIdColumn, sessionUserId);

        if (error) {
          console.error('[profileService] Supabase premium status update error:', error);
        }
      } catch (err) {
        console.error('[profileService] Supabase premium status update connection error:', err);
      }
    }
  }

  // Сохранить аватар (base64 или URL)
  async saveAvatar(userId: string, avatarData: string): Promise<void> {
    const sessionUserId = await this.getSessionUserId(userId);
    const userIdColumn = await this.resolveUserIdColumn();

    // Try to save to Supabase
    if (supabase) {
      try {
        // Если это base64, сохраняем как avatar_url
        // В будущем можно загрузить в Supabase Storage и сохранить URL
        const { error } = await supabase
          .from('user_profiles')
          .update({ avatar_url: avatarData })
          .eq(userIdColumn, sessionUserId);

        if (error) {
          // Если профиля еще нет, создаем его
          if (error.code === 'PGRST116' || error.message?.includes('No rows')) {
            const { error: insertError } = await supabase
              .from('user_profiles')
              .insert({
                [userIdColumn]: sessionUserId,
                avatar_url: avatarData,
                has_premium: false,
                is_admin: false,
              });

            if (insertError) {
              console.error('[profileService] Supabase avatar insert error:', insertError);
              return;
            }
          } else {
            console.error('[profileService] Supabase avatar update error:', error);
            return;
          }
        }

        try {
          localStorage.setItem(`${this.AVATAR_STORAGE_KEY}_${sessionUserId}`, avatarData);
        } catch (storageError) {
          console.error('[profileService] Error saving avatar to localStorage:', storageError);
        }
      } catch (err) {
        console.error('[profileService] Supabase avatar save connection error:', err);
      }
    }
  }

  // Получить аватар
  async getAvatar(userId: string): Promise<string | null> {
    const sessionUserId = await this.getSessionUserId(userId);
    const userIdColumn = await this.resolveUserIdColumn();

    // Try Supabase first
    if (supabase) {
      try {
        const { data, error } = await supabase
          .from('user_profiles')
          .select('avatar_url')
          .eq(userIdColumn, sessionUserId)
          .maybeSingle();

        if (error && error.code !== 'PGRST116') {
          console.error('[profileService] Supabase avatar error:', error);
          // Fallback to localStorage
        } else if (data?.avatar_url) {
          // Sync to localStorage
          try {
            localStorage.setItem(`${this.AVATAR_STORAGE_KEY}_${sessionUserId}`, data.avatar_url);
          } catch (err) {
            console.error('[profileService] Error syncing avatar to localStorage:', err);
          }
          return data.avatar_url;
        }
      } catch (err) {
        console.error('[profileService] Supabase avatar connection error:', err);
        // Fallback to localStorage
      }
    }

    // Fallback to localStorage
    try {
      const avatar = localStorage.getItem(`${this.AVATAR_STORAGE_KEY}_${sessionUserId}`);
      return avatar;
    } catch (error) {
      console.error('[profileService] Error loading avatar from localStorage:', error);
      return null;
    }
  }

  // Конвертировать UserProfile в ProfileDetails для использования в приложении
  toProfileDetails(profile: UserProfile | null): ProfileDetails {
    if (!profile) {
      return { firstName: '' };
    }

    return {
      firstName: profile.first_name || '',
      lastName: profile.last_name,
      middleName: profile.middle_name,
      birthDate: profile.birth_date,
      age: profile.age,
      height: profile.height,
      goal: profile.goal,
      email: profile.email,
      phone: profile.phone,
    };
  }

  async getCoachSettings(userId: string): Promise<CoachSettings> {
    const sessionUserId = await this.getSessionUserId(userId);
    const userIdColumn = await this.resolveUserIdColumn();
    const fallback: CoachSettings = { coach_enabled: true, coach_mode: 'support' };

    if (supabase) {
      try {
        const { data, error } = await supabase
          .from('user_profiles')
          .select('coach_settings')
          .eq(userIdColumn, sessionUserId)
          .maybeSingle();
        if (!error && data?.coach_settings) {
          const settings = data.coach_settings as CoachSettings;
          this.writeCoachSettingsCache(sessionUserId, settings);
          return settings;
        }
      } catch (err) {
        console.warn('[profileService] coach settings load error', err);
      }
    }

    return this.readCoachSettingsCache(sessionUserId) ?? fallback;
  }

  async saveCoachSettings(userId: string, settings: CoachSettings): Promise<void> {
    const sessionUserId = await this.getSessionUserId(userId);
    const userIdColumn = await this.resolveUserIdColumn();
    this.writeCoachSettingsCache(sessionUserId, settings);

    if (!supabase) return;
    try {
      const { error } = await supabase
        .from('user_profiles')
        .update({ coach_settings: settings })
        .eq(userIdColumn, sessionUserId);
      if (error) {
        console.warn('[profileService] coach settings save error', error);
      }
    } catch (err) {
      console.warn('[profileService] coach settings save connection error', err);
    }
  }

  private writeCoachSettingsCache(userId: string, settings: CoachSettings) {
    try {
      localStorage.setItem(`${this.COACH_SETTINGS_KEY}_${userId}`, JSON.stringify(settings));
      localStorage.setItem(this.COACH_SETTINGS_KEY, JSON.stringify(settings));
    } catch (error) {
      console.warn('[profileService] Error saving coach settings to localStorage', error);
    }
  }

  private readCoachSettingsCache(userId: string): CoachSettings | null {
    try {
      const raw = localStorage.getItem(`${this.COACH_SETTINGS_KEY}_${userId}`) ?? localStorage.getItem(this.COACH_SETTINGS_KEY);
      if (!raw) return null;
      const parsed = JSON.parse(raw);
      return parsed && typeof parsed === 'object' ? (parsed as CoachSettings) : null;
    } catch (error) {
      console.warn('[profileService] Error reading coach settings from localStorage', error);
      return null;
    }
  }
}

export const profileService = new ProfileService();
