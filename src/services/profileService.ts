import { supabase } from '../lib/supabaseClient';
import { toUUID } from '../utils/uuid';
import { ProfileDetails } from '../types';

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
  private readonly PROFILE_STORAGE_KEY = 'potok_user_profile';
  private readonly AVATAR_STORAGE_KEY = 'potok_user_avatar';

  // Получить профиль пользователя
  async getProfile(userId: string): Promise<UserProfile | null> {
    const uuidUserId = toUUID(userId);

    // Try Supabase first
    if (supabase) {
      try {
        const { data, error } = await supabase
          .from('user_profiles')
          .select('*')
          .eq('user_id', uuidUserId)
          .maybeSingle();

        if (error) {
          // PGRST116 = no rows returned (это нормально, если профиля еще нет)
          if (error.code !== 'PGRST116') {
            console.error('[profileService] Supabase error:', error);
          }
          // Fallback to localStorage
        } else if (data) {
          const profile: UserProfile = {
            user_id: data.user_id,
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

          // Sync to localStorage
          this.saveProfileToLocalStorage(userId, profile);
          return profile;
        }
      } catch (err) {
        console.error('[profileService] Supabase connection error:', err);
        // Fallback to localStorage
      }
    }

    // Fallback to localStorage
    return this.getProfileFromLocalStorage(userId);
  }

  // Сохранить/обновить профиль пользователя
  async saveProfile(userId: string, profile: Partial<ProfileDetails>): Promise<void> {
    const uuidUserId = toUUID(userId);

    // Save to localStorage first
    const existingProfile = await this.getProfile(userId);
    const updatedProfile: UserProfile = {
      user_id: uuidUserId,
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

    this.saveProfileToLocalStorage(userId, updatedProfile);

    // Try to save to Supabase
    if (supabase) {
      try {
        const { error } = await supabase
          .from('user_profiles')
          .upsert({
            user_id: uuidUserId,
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
            onConflict: 'user_id',
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
    const uuidUserId = toUUID(userId);

    // Update localStorage
    const existingProfile = await this.getProfile(userId);
    if (existingProfile) {
      const updatedProfile = { ...existingProfile, is_admin: isAdmin };
      this.saveProfileToLocalStorage(userId, updatedProfile);
    }

    // Try to update in Supabase
    if (supabase) {
      try {
        const { error } = await supabase
          .from('user_profiles')
          .update({ is_admin: isAdmin })
          .eq('user_id', uuidUserId);

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
    const uuidUserId = toUUID(userId);

    // Update localStorage
    const existingProfile = await this.getProfile(userId);
    if (existingProfile) {
      const updatedProfile = { ...existingProfile, has_premium: hasPremium };
      this.saveProfileToLocalStorage(userId, updatedProfile);
    }

    // Try to update in Supabase
    if (supabase) {
      try {
        const { error } = await supabase
          .from('user_profiles')
          .update({ has_premium: hasPremium })
          .eq('user_id', uuidUserId);

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
    const uuidUserId = toUUID(userId);

    // Save to localStorage
    try {
      localStorage.setItem(`${this.AVATAR_STORAGE_KEY}_${userId}`, avatarData);
    } catch (error) {
      console.error('[profileService] Error saving avatar to localStorage:', error);
    }

    // Try to save to Supabase
    if (supabase) {
      try {
        // Если это base64, сохраняем как avatar_url
        // В будущем можно загрузить в Supabase Storage и сохранить URL
        const { error } = await supabase
          .from('user_profiles')
          .update({ avatar_url: avatarData })
          .eq('user_id', uuidUserId);

        if (error) {
          // Если профиля еще нет, создаем его
          if (error.code === 'PGRST116' || error.message?.includes('No rows')) {
            const { error: insertError } = await supabase
              .from('user_profiles')
              .insert({
                user_id: uuidUserId,
                avatar_url: avatarData,
                has_premium: false,
                is_admin: false,
              });

            if (insertError) {
              console.error('[profileService] Supabase avatar insert error:', insertError);
            }
          } else {
            console.error('[profileService] Supabase avatar update error:', error);
          }
        }
      } catch (err) {
        console.error('[profileService] Supabase avatar save connection error:', err);
      }
    }
  }

  // Получить аватар
  async getAvatar(userId: string): Promise<string | null> {
    const uuidUserId = toUUID(userId);

    // Try Supabase first
    if (supabase) {
      try {
        const { data, error } = await supabase
          .from('user_profiles')
          .select('avatar_url')
          .eq('user_id', uuidUserId)
          .maybeSingle();

        if (error && error.code !== 'PGRST116') {
          console.error('[profileService] Supabase avatar error:', error);
          // Fallback to localStorage
        } else if (data?.avatar_url) {
          // Sync to localStorage
          try {
            localStorage.setItem(`${this.AVATAR_STORAGE_KEY}_${userId}`, data.avatar_url);
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
      const avatar = localStorage.getItem(`${this.AVATAR_STORAGE_KEY}_${userId}`);
      return avatar;
    } catch (error) {
      console.error('[profileService] Error loading avatar from localStorage:', error);
      return null;
    }
  }

  // Helper methods for localStorage
  private saveProfileToLocalStorage(userId: string, profile: UserProfile): void {
    try {
      localStorage.setItem(`${this.PROFILE_STORAGE_KEY}_${userId}`, JSON.stringify(profile));
    } catch (error) {
      console.error('[profileService] Error saving profile to localStorage:', error);
    }
  }

  private getProfileFromLocalStorage(userId: string): UserProfile | null {
    try {
      const stored = localStorage.getItem(`${this.PROFILE_STORAGE_KEY}_${userId}`);
      if (stored) {
        return JSON.parse(stored);
      }
    } catch (error) {
      console.error('[profileService] Error loading profile from localStorage:', error);
    }
    return null;
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
}

export const profileService = new ProfileService();
