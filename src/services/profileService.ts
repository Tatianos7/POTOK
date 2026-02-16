import { supabase } from '../lib/supabaseClient';
import { ProfileDetails } from '../types';
import type { CoachSettings, CoachVoiceSettings } from '../types/coachSettings';

export interface UserProfile {
  id_user: string;
  user_id?: string;
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
  private readonly VOICE_SETTINGS_KEY = 'potok_voice_settings';
  private readonly PROFILE_CACHE_KEY = 'profile_cache_v1';
  private readonly PROFILE_PENDING_KEY = 'profile_pending_v1';
  private userIdColumn: 'id_user' | 'user_id' = 'id_user';
  private isRemoteProfileQueryDisabled = false;
  private readonly unsupportedProfileColumns = new Set<string>();
  private hasRemoteProfileReadFailed = false;
  private lastProfileNotice: string | null = null;

  private isDev(): boolean {
    return typeof import.meta !== 'undefined' && Boolean(import.meta.env?.DEV);
  }

  private devLog(message: string, payload?: unknown): void {
    if (!this.isDev()) return;
    if (payload !== undefined) {
      console.info(`[profileService] ${message}`, payload);
      return;
    }
    console.info(`[profileService] ${message}`);
  }

  private cacheKey(userId: string): string {
    return `${this.PROFILE_CACHE_KEY}_${userId}`;
  }

  private pendingKey(userId: string): string {
    return `${this.PROFILE_PENDING_KEY}_${userId}`;
  }

  private buildDefaultProfile(userId: string): UserProfile {
    const now = new Date().toISOString();
    return {
      id_user: userId,
      user_id: userId,
      has_premium: false,
      is_admin: false,
      created_at: now,
      updated_at: now,
    };
  }

  private normalizeProfile(raw: Record<string, unknown>, fallbackUserId: string): UserProfile {
    const normalizedId = String(raw.id_user ?? raw.user_id ?? fallbackUserId);
    return {
      id_user: normalizedId,
      user_id: String(raw.user_id ?? raw.id_user ?? normalizedId),
      first_name: typeof raw.first_name === 'string' ? raw.first_name : undefined,
      last_name: typeof raw.last_name === 'string' ? raw.last_name : undefined,
      middle_name: typeof raw.middle_name === 'string' ? raw.middle_name : undefined,
      birth_date: typeof raw.birth_date === 'string' ? raw.birth_date : undefined,
      age: typeof raw.age === 'number' ? raw.age : undefined,
      height: typeof raw.height === 'number' ? raw.height : raw.height ? Number(raw.height) : undefined,
      goal: typeof raw.goal === 'string' ? raw.goal : undefined,
      email: typeof raw.email === 'string' ? raw.email : undefined,
      phone: typeof raw.phone === 'string' ? raw.phone : undefined,
      avatar_url: typeof raw.avatar_url === 'string' ? raw.avatar_url : undefined,
      has_premium: Boolean(raw.has_premium),
      is_admin: Boolean(raw.is_admin),
      created_at: typeof raw.created_at === 'string' ? raw.created_at : new Date().toISOString(),
      updated_at: typeof raw.updated_at === 'string' ? raw.updated_at : new Date().toISOString(),
    };
  }

  private readCachedProfile(userId: string): UserProfile | null {
    try {
      const raw = localStorage.getItem(this.cacheKey(userId));
      if (!raw) return null;
      const parsed = JSON.parse(raw) as Record<string, unknown>;
      return this.normalizeProfile(parsed, userId);
    } catch {
      return null;
    }
  }

  private writeCachedProfile(profile: UserProfile): void {
    try {
      localStorage.setItem(this.cacheKey(profile.id_user), JSON.stringify(profile));
    } catch (error) {
      console.warn('[profileService] Error writing profile cache:', error);
    }
  }

  private readPendingProfile(userId: string): UserProfile | null {
    try {
      const raw = localStorage.getItem(this.pendingKey(userId));
      if (!raw) return null;
      const parsed = JSON.parse(raw) as Record<string, unknown>;
      return this.normalizeProfile(parsed, userId);
    } catch {
      return null;
    }
  }

  private writePendingProfile(profile: UserProfile): void {
    try {
      localStorage.setItem(this.pendingKey(profile.id_user), JSON.stringify(profile));
    } catch (error) {
      console.warn('[profileService] Error writing pending profile:', error);
    }
  }

  private clearPendingProfile(userId: string): void {
    try {
      localStorage.removeItem(this.pendingKey(userId));
    } catch {
      // ignore
    }
  }

  private mergeProfileWithDetails(base: UserProfile, patch: Partial<ProfileDetails>): UserProfile {
    return {
      ...base,
      first_name: patch.firstName ?? base.first_name,
      last_name: patch.lastName ?? base.last_name,
      middle_name: patch.middleName ?? base.middle_name,
      birth_date: patch.birthDate ?? base.birth_date,
      age: patch.age ?? base.age,
      height: patch.height ?? base.height,
      goal: patch.goal ?? base.goal,
      email: patch.email ?? base.email,
      phone: patch.phone ?? base.phone,
      updated_at: new Date().toISOString(),
    };
  }

  consumeProfileNotice(): string | null {
    const notice = this.lastProfileNotice;
    this.lastProfileNotice = null;
    return notice;
  }

  getCachedProfile(userId: string): UserProfile | null {
    return this.readCachedProfile(userId);
  }

  private isProfileSchemaError(error: unknown): boolean {
    if (!error || typeof error !== 'object') return false;
    const record = error as { code?: string; message?: string };
    const message = (record.message || '').toLowerCase();
    return (
      record.code === '42703' ||
      record.code === 'PGRST204' ||
      message.includes('column user_profiles.id_user does not exist') ||
      message.includes('column "id_user" does not exist') ||
      message.includes('column user_profiles.user_id does not exist') ||
      message.includes('column "user_id" does not exist') ||
      (message.includes('could not find the') && message.includes('column') && message.includes('user_profiles'))
    );
  }

  private isMissingColumnError(error: unknown, columnName: string): boolean {
    if (!error || typeof error !== 'object') return false;
    const record = error as { code?: string; message?: string };
    const message = (record.message || '').toLowerCase();
    const normalizedColumn = columnName.toLowerCase();
    return (
      record.code === '42703' ||
      record.code === 'PGRST204' ||
      message.includes(`column user_profiles.${normalizedColumn} does not exist`) ||
      message.includes(`column "${normalizedColumn}" does not exist`) ||
      (message.includes(`'${normalizedColumn}'`) && message.includes('user_profiles') && message.includes('schema cache'))
    );
  }

  private getAlternateUserIdColumn(column: 'id_user' | 'user_id'): 'id_user' | 'user_id' {
    return column === 'id_user' ? 'user_id' : 'id_user';
  }

  private rememberWorkingUserIdColumn(column: 'id_user' | 'user_id') {
    if (this.userIdColumn !== column) {
      this.userIdColumn = column;
      console.info(`[profileService] switched user id column to "${column}"`);
    }
  }

  private handleProfileReadError(context: string, error: unknown): void {
    if (this.isProfileSchemaError(error)) {
      this.isRemoteProfileQueryDisabled = true;
      this.hasRemoteProfileReadFailed = true;
      return;
    }
    const message = error && typeof error === 'object' ? (error as { message?: string }).message : '';
    const isNetworkError =
      message?.includes('Failed to fetch') ||
      message?.includes('ERR_NAME_NOT_RESOLVED') ||
      message?.includes('NetworkError');
    if (!isNetworkError) {
      this.hasRemoteProfileReadFailed = true;
    }
    if (!isNetworkError) {
      console.warn(`[profileService] ${context}:`, message || error);
    }
  }

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

  // Получить профиль пользователя
  async getProfile(userId: string): Promise<UserProfile | null> {
    if (!supabase) {
      const fallback = this.readCachedProfile(userId) ?? this.buildDefaultProfile(userId);
      this.devLog('fallback used: default (supabase unavailable)');
      return fallback;
    }

    let sessionUserId = userId;
    try {
      sessionUserId = await this.getSessionUserId(userId);
    } catch {
      const fallback = this.readCachedProfile(userId) ?? this.buildDefaultProfile(userId);
      this.devLog('fallback used: cache/default (session unavailable)');
      return fallback;
    }
    const primaryUserIdColumn = this.userIdColumn;
    const client = supabase;
    const defaultProfile = this.buildDefaultProfile(sessionUserId);

    const syncPendingProfile = async (): Promise<void> => {
      const pending = this.readPendingProfile(sessionUserId);
      if (!pending) return;
      try {
        const payload = {
          first_name: pending.first_name || null,
          last_name: pending.last_name || null,
          middle_name: pending.middle_name || null,
          birth_date: pending.birth_date || null,
          age: pending.age || null,
          height: pending.height || null,
          goal: pending.goal || null,
          email: pending.email || null,
          phone: pending.phone || null,
          avatar_url: pending.avatar_url || null,
          has_premium: pending.has_premium,
          is_admin: pending.is_admin,
        };
        const upsertByColumn = async (column: 'id_user' | 'user_id') =>
          await client
            .from('user_profiles')
            .upsert({ [column]: sessionUserId, ...payload }, { onConflict: column });
        let { error } = await upsertByColumn(primaryUserIdColumn);
        if (error && this.isProfileSchemaError(error)) {
          const fallbackColumn = this.getAlternateUserIdColumn(primaryUserIdColumn);
          const retried = await upsertByColumn(fallbackColumn);
          error = retried.error;
          if (!error) this.rememberWorkingUserIdColumn(fallbackColumn);
        }
        if (!error) {
          this.clearPendingProfile(sessionUserId);
          this.devLog('pending sync success');
        } else {
          this.devLog('pending sync failed', { code: error.code, message: error.message });
        }
      } catch (error) {
        this.devLog('pending sync failed', error);
      }
    };

    const tryEnsureRemoteProfile = async (): Promise<UserProfile | null> => {
      const fetchByColumn = async (column: 'id_user' | 'user_id') =>
        await client
          .from('user_profiles')
          .select('*')
          .eq(column, sessionUserId)
          .maybeSingle();

      let { data, error } = await fetchByColumn(primaryUserIdColumn);
      if (error && this.isProfileSchemaError(error)) {
        const fallbackColumn = this.getAlternateUserIdColumn(primaryUserIdColumn);
        const retried = await fetchByColumn(fallbackColumn);
        data = retried.data;
        error = retried.error;
        if (!error) this.rememberWorkingUserIdColumn(fallbackColumn);
      }

      if (error) {
        if (error.code !== 'PGRST116') {
          this.devLog('remote load error', { code: error.code, message: error.message });
          this.handleProfileReadError('getProfile', error);
        }
        return null;
      }

      if (data) {
        const profile = this.normalizeProfile(data as Record<string, unknown>, sessionUserId);
        this.writeCachedProfile(profile);
        this.devLog('remote load success');
        return profile;
      }

      // Профиль отсутствует: создаём дефолтную строку и перечитываем.
      this.devLog('remote load empty');
      try {
        const insertByColumn = async (column: 'id_user' | 'user_id') =>
          await client
            .from('user_profiles')
            .insert({
              [column]: sessionUserId,
              has_premium: false,
              is_admin: false,
            });
        let { error: insertError } = await insertByColumn(primaryUserIdColumn);
        if (insertError && this.isProfileSchemaError(insertError)) {
          const fallbackColumn = this.getAlternateUserIdColumn(primaryUserIdColumn);
          const retried = await insertByColumn(fallbackColumn);
          insertError = retried.error;
          if (!insertError) this.rememberWorkingUserIdColumn(fallbackColumn);
        }
        if (insertError) {
          const message = insertError.message || '';
          const isRls =
            insertError.code === '42501' ||
            message.toLowerCase().includes('row-level security') ||
            message.toLowerCase().includes('permission denied');
          if (isRls) {
            this.lastProfileNotice = 'Не удалось создать профиль. Проверьте права (RLS).';
          }
          this.devLog('remote ensure profile failed', { code: insertError.code, message: insertError.message });
          return null;
        }
        const reread = await fetchByColumn(this.userIdColumn);
        if (reread.data) {
          const profile = this.normalizeProfile(reread.data as Record<string, unknown>, sessionUserId);
          this.writeCachedProfile(profile);
          return profile;
        }
      } catch (error) {
        this.devLog('remote ensure profile failed', error);
      }

      return null;
    };

    // Try Supabase first
    if (supabase && !this.isRemoteProfileQueryDisabled && !this.hasRemoteProfileReadFailed) {
      try {
        await syncPendingProfile();
        const remoteProfile = await tryEnsureRemoteProfile();
        if (remoteProfile) return remoteProfile;
      } catch (err: unknown) {
        this.handleProfileReadError('getProfile connection', err);
      }
    }

    const cached = this.readCachedProfile(sessionUserId);
    if (cached) {
      this.devLog('fallback used: cache');
      return cached;
    }
    this.devLog('fallback used: default');
    return defaultProfile;
  }

  // Сохранить/обновить профиль пользователя
  async saveProfile(userId: string, profile: Partial<ProfileDetails>): Promise<void> {
    let sessionUserId = userId;
    try {
      sessionUserId = await this.getSessionUserId(userId);
    } catch {
      const base = this.readCachedProfile(userId) ?? this.buildDefaultProfile(userId);
      const optimistic = this.mergeProfileWithDetails(base, profile);
      this.writeCachedProfile(optimistic);
      this.writePendingProfile(optimistic);
      return;
    }
    const primaryUserIdColumn = this.userIdColumn;
    const existingProfile = this.readCachedProfile(sessionUserId) ?? this.buildDefaultProfile(sessionUserId);
    const updatedProfile = this.mergeProfileWithDetails(existingProfile, profile);
    this.writeCachedProfile(updatedProfile);
    this.writePendingProfile(updatedProfile);

    // Try to save to Supabase
    if (supabase) {
      const client = supabase;
      try {
        const upsertByColumn = async (column: 'id_user' | 'user_id') => {
          return await client
            .from('user_profiles')
            .upsert({
              [column]: sessionUserId,
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
              onConflict: column,
            });
        };
        let { error } = await upsertByColumn(primaryUserIdColumn);
        if (error && this.isProfileSchemaError(error)) {
          const fallbackColumn = this.getAlternateUserIdColumn(primaryUserIdColumn);
          const retried = await upsertByColumn(fallbackColumn);
          error = retried.error;
          if (!error) {
            this.rememberWorkingUserIdColumn(fallbackColumn);
          }
        }

        if (error) {
          this.devLog('pending sync failed', { code: error.code, message: error.message });
          this.lastProfileNotice = 'Изменения сохранены на устройстве. Синхронизируем при появлении сети.';
          return;
        }
        this.clearPendingProfile(sessionUserId);
        this.hasRemoteProfileReadFailed = false;
        this.lastProfileNotice = null;
        this.devLog('pending sync success');
      } catch (err) {
        this.devLog('pending sync failed', err);
        this.lastProfileNotice = 'Изменения сохранены на устройстве. Синхронизируем при появлении сети.';
      }
    }
  }

  // Обновить админ статус
  async updateAdminStatus(userId: string, isAdmin: boolean): Promise<void> {
    const sessionUserId = await this.getSessionUserId(userId);
    const userIdColumn = this.userIdColumn;

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
    const userIdColumn = this.userIdColumn;

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
    const userIdColumn = this.userIdColumn;

    // Try to save to Supabase
    if (supabase && !this.isRemoteProfileQueryDisabled && !this.hasRemoteProfileReadFailed) {
      try {
        // Если это base64, сохраняем как avatar_url
        // В будущем можно загрузить в Supabase Storage и сохранить URL
        const { error } = await supabase
          .from('user_profiles')
          .update({ avatar_url: avatarData })
          .eq(userIdColumn, sessionUserId);

        if (error) {
          if (this.isMissingColumnError(error, 'avatar_url')) {
            this.unsupportedProfileColumns.add('avatar_url');
            return;
          }
          if (this.isProfileSchemaError(error)) {
            this.isRemoteProfileQueryDisabled = true;
          }
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
    const primaryUserIdColumn = this.userIdColumn;
    if (this.unsupportedProfileColumns.has('avatar_url')) {
      try {
        return localStorage.getItem(`${this.AVATAR_STORAGE_KEY}_${sessionUserId}`);
      } catch {
        return null;
      }
    }

    // Try Supabase first
    if (supabase && !this.isRemoteProfileQueryDisabled && !this.hasRemoteProfileReadFailed) {
      const client = supabase;
      try {
        const fetchAvatarByColumn = async (column: 'id_user' | 'user_id') => {
          return await client
            .from('user_profiles')
            .select('avatar_url')
            .eq(column, sessionUserId)
            .maybeSingle();
        };
        let { data, error } = await fetchAvatarByColumn(primaryUserIdColumn);
        if (error && this.isProfileSchemaError(error)) {
          const fallbackColumn = this.getAlternateUserIdColumn(primaryUserIdColumn);
          const retried = await fetchAvatarByColumn(fallbackColumn);
          data = retried.data;
          error = retried.error;
          if (!error) {
            this.rememberWorkingUserIdColumn(fallbackColumn);
          }
        }

        if (error && error.code !== 'PGRST116') {
          if (this.isMissingColumnError(error, 'avatar_url')) {
            this.unsupportedProfileColumns.add('avatar_url');
          } else if (this.isProfileSchemaError(error)) {
            this.isRemoteProfileQueryDisabled = true;
          } else {
            console.error('[profileService] Supabase avatar error:', error);
          }
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
      } catch (err: unknown) {
        this.handleProfileReadError('getAvatar connection', err);
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
    const primaryUserIdColumn = this.userIdColumn;
    const fallback: CoachSettings = { coach_enabled: true, coach_mode: 'support' };
    if (this.unsupportedProfileColumns.has('coach_settings')) {
      return this.readCoachSettingsCache(sessionUserId) ?? fallback;
    }

    if (supabase && !this.isRemoteProfileQueryDisabled && !this.hasRemoteProfileReadFailed) {
      const client = supabase;
      try {
        const fetchCoachByColumn = async (column: 'id_user' | 'user_id') => {
          return await client
            .from('user_profiles')
            .select('coach_settings')
            .eq(column, sessionUserId)
            .maybeSingle();
        };
        let { data, error } = await fetchCoachByColumn(primaryUserIdColumn);
        if (error && this.isProfileSchemaError(error)) {
          const fallbackColumn = this.getAlternateUserIdColumn(primaryUserIdColumn);
          const retried = await fetchCoachByColumn(fallbackColumn);
          data = retried.data;
          error = retried.error;
          if (!error) {
            this.rememberWorkingUserIdColumn(fallbackColumn);
          }
        }
        if (!error && data?.coach_settings) {
          const settings = data.coach_settings as CoachSettings;
          this.writeCoachSettingsCache(sessionUserId, settings);
          return settings;
        }
        if (error && this.isMissingColumnError(error, 'coach_settings')) {
          this.unsupportedProfileColumns.add('coach_settings');
          return this.readCoachSettingsCache(sessionUserId) ?? fallback;
        }
      } catch (err: unknown) {
        this.handleProfileReadError('getCoachSettings', err);
      }
    }

    return this.readCoachSettingsCache(sessionUserId) ?? fallback;
  }

  async saveCoachSettings(userId: string, settings: CoachSettings): Promise<void> {
    const sessionUserId = await this.getSessionUserId(userId);
    const userIdColumn = this.userIdColumn;
    this.writeCoachSettingsCache(sessionUserId, settings);

    if (!supabase || this.isRemoteProfileQueryDisabled || this.unsupportedProfileColumns.has('coach_settings')) return;
    try {
      const { error } = await supabase
        .from('user_profiles')
        .update({ coach_settings: settings })
        .eq(userIdColumn, sessionUserId);
      if (error) {
        if (this.isMissingColumnError(error, 'coach_settings')) {
          this.unsupportedProfileColumns.add('coach_settings');
          return;
        }
        console.warn('[profileService] coach settings save error', error);
      }
    } catch (err) {
      console.warn('[profileService] coach settings save connection error', err);
    }
  }

  async getVoiceSettings(userId: string): Promise<CoachVoiceSettings> {
    const sessionUserId = await this.getSessionUserId(userId);
    const primaryUserIdColumn = this.userIdColumn;
    const fallback: CoachVoiceSettings = {
      enabled: false,
      mode: 'off',
      style: 'calm',
      intensity: 'soft',
    };
    if (this.unsupportedProfileColumns.has('voice_settings')) {
      return this.readVoiceSettingsCache(sessionUserId) ?? fallback;
    }

    if (supabase && !this.isRemoteProfileQueryDisabled) {
      const client = supabase;
      try {
        const fetchVoiceByColumn = async (column: 'id_user' | 'user_id') => {
          return await client
            .from('user_profiles')
            .select('voice_settings')
            .eq(column, sessionUserId)
            .maybeSingle();
        };
        let { data, error } = await fetchVoiceByColumn(primaryUserIdColumn);
        if (error && this.isProfileSchemaError(error)) {
          const fallbackColumn = this.getAlternateUserIdColumn(primaryUserIdColumn);
          const retried = await fetchVoiceByColumn(fallbackColumn);
          data = retried.data;
          error = retried.error;
          if (!error) {
            this.rememberWorkingUserIdColumn(fallbackColumn);
          }
        }
        if (!error && data?.voice_settings) {
          const settings = data.voice_settings as CoachVoiceSettings;
          this.writeVoiceSettingsCache(sessionUserId, settings);
          return settings;
        }
        if (error && this.isMissingColumnError(error, 'voice_settings')) {
          this.unsupportedProfileColumns.add('voice_settings');
          return this.readVoiceSettingsCache(sessionUserId) ?? fallback;
        }
      } catch (err: unknown) {
        this.handleProfileReadError('getVoiceSettings', err);
      }
    }

    return this.readVoiceSettingsCache(sessionUserId) ?? fallback;
  }

  async saveVoiceSettings(userId: string, settings: CoachVoiceSettings): Promise<void> {
    const sessionUserId = await this.getSessionUserId(userId);
    const userIdColumn = this.userIdColumn;
    this.writeVoiceSettingsCache(sessionUserId, settings);

    if (!supabase || this.isRemoteProfileQueryDisabled || this.unsupportedProfileColumns.has('voice_settings')) return;
    try {
      const { error } = await supabase
        .from('user_profiles')
        .update({ voice_settings: settings })
        .eq(userIdColumn, sessionUserId);
      if (error) {
        if (this.isMissingColumnError(error, 'voice_settings')) {
          this.unsupportedProfileColumns.add('voice_settings');
          return;
        }
        console.warn('[profileService] voice settings save error', error);
      }
    } catch (err) {
      console.warn('[profileService] voice settings save connection error', err);
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

  private writeVoiceSettingsCache(userId: string, settings: CoachVoiceSettings) {
    try {
      localStorage.setItem(`${this.VOICE_SETTINGS_KEY}_${userId}`, JSON.stringify(settings));
      localStorage.setItem(this.VOICE_SETTINGS_KEY, JSON.stringify(settings));
    } catch (error) {
      console.warn('[profileService] Error saving voice settings to localStorage', error);
    }
  }

  private readVoiceSettingsCache(userId: string): CoachVoiceSettings | null {
    try {
      const raw =
        localStorage.getItem(`${this.VOICE_SETTINGS_KEY}_${userId}`) ??
        localStorage.getItem(this.VOICE_SETTINGS_KEY);
      if (!raw) return null;
      const parsed = JSON.parse(raw);
      return parsed && typeof parsed === 'object' ? (parsed as CoachVoiceSettings) : null;
    } catch (error) {
      console.warn('[profileService] Error reading voice settings from localStorage', error);
      return null;
    }
  }
}

export const profileService = new ProfileService();
