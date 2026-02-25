import React, { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import type { User as SupabaseUser } from '@supabase/supabase-js';
import {
  User,
  LoginCredentials,
  RegisterCredentials,
  ProfileUpdatePayload,
  ResetPasswordPayload,
} from '../types';
import { getSessionCached, supabase } from '../lib/supabaseClient';
import { activityService } from '../services/activityService';
import { profileService, type UserProfile } from '../services/profileService';
import { useTheme } from './ThemeContext';

type AuthStatus = 'booting' | 'authenticated' | 'unauthenticated';

interface AuthContextType {
  user: User | null;
  profile: UserProfile | null;
  authStatus: AuthStatus;
  isLoading: boolean;
  login: (credentials: LoginCredentials) => Promise<void>;
  register: (credentials: RegisterCredentials) => Promise<void>;
  verifyOtp: (params: { identifier: string; token: string }) => Promise<void>;
  updateProfile: (data: ProfileUpdatePayload) => Promise<void>;
  requestPasswordReset: (payload: ResetPasswordPayload) => Promise<void>;
  updatePassword: (newPassword: string) => Promise<void>;
  deleteAccount: () => void;
  logout: () => void;
  isAuthenticated: boolean;
  entitlements: Record<string, boolean> | null;
  trustScore: number | null;
  getAllUsers: () => Promise<User[]>;
  setAdminStatus: (userId: string, isAdmin: boolean) => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const AuthProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<User | null>(null);
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [authStatus, setAuthStatus] = useState<AuthStatus>('booting');
  const [entitlements, setEntitlements] = useState<Record<string, boolean> | null>(null);
  const [trustScore, setTrustScore] = useState<number | null>(null);
  const { setThemeExplicit } = useTheme();
  const isInvalidRefreshTokenError = (error: unknown): boolean => {
    if (!error || typeof error !== 'object') return false;
    const message = ((error as { message?: string }).message || '').toLowerCase();
    return message.includes('invalid refresh token') || message.includes('refresh token not found');
  };

  const resetInvalidSessionSafely = (client: NonNullable<typeof supabase>) => {
    void client.auth.signOut().catch(() => undefined);
    clearSessionState();
  };

  const withTimeout = async <T,>(promise: Promise<T>, timeoutMs: number): Promise<T | null> => {
    let timeoutId: ReturnType<typeof setTimeout> | undefined;
    try {
      const timeoutPromise = new Promise<null>((resolve) => {
        timeoutId = setTimeout(() => resolve(null), timeoutMs);
      });
      const result = await Promise.race([promise, timeoutPromise]);
      return result as T | null;
    } finally {
      if (timeoutId) clearTimeout(timeoutId);
    }
  };

  const buildUser = async (
    sessionUser: SupabaseUser
  ): Promise<{ user: User; profile: UserProfile | null }> => {
    let supabaseProfile: UserProfile | null = null;
    try {
      const profileResult = await withTimeout(profileService.getProfile(sessionUser.id), 5000);
      supabaseProfile = profileResult ?? null;
    } catch (error) {
      console.warn('[AuthContext] getProfile failed, continue without profile:', error);
    }
    const email = sessionUser.email ?? supabaseProfile?.email ?? undefined;
    const phone = sessionUser.phone ?? supabaseProfile?.phone ?? undefined;
    const firstName =
      supabaseProfile?.first_name ||
      (sessionUser.user_metadata?.first_name as string | undefined) ||
      '';
    const lastName =
      supabaseProfile?.last_name ||
      (sessionUser.user_metadata?.last_name as string | undefined) ||
      undefined;
    const middleName =
      supabaseProfile?.middle_name ||
      (sessionUser.user_metadata?.middle_name as string | undefined) ||
      undefined;
    const name =
      firstName ||
      (sessionUser.user_metadata?.name as string | undefined) ||
      email ||
      phone ||
      'Пользователь';

    return {
      profile: supabaseProfile ?? null,
      user: {
      id: sessionUser.id,
      name,
      email,
      phone,
      hasPremium: supabaseProfile?.has_premium ?? false,
      createdAt: sessionUser.created_at || new Date().toISOString(),
      profile: {
        firstName,
        lastName,
        middleName,
        birthDate: supabaseProfile?.birth_date ?? undefined,
        age: supabaseProfile?.age ?? undefined,
        height: supabaseProfile?.height ?? undefined,
        goal: supabaseProfile?.goal ?? undefined,
        email,
        phone,
      },
      isAdmin: supabaseProfile?.is_admin ?? false,
      },
    };
  };

  const clearSessionState = () => {
    setUser(null);
    setProfile(null);
    setEntitlements(null);
    setTrustScore(null);
    setAuthStatus('unauthenticated');
  };

  useEffect(() => {
    if (!supabase) {
      setAuthStatus('unauthenticated');
      return;
    }

    const supabaseClient = supabase;
    let isMounted = true;

    const init = async () => {
      const sessionResult = await withTimeout(getSessionCached(), 12000);
      if (!isMounted) return;
      if (!sessionResult) {
        console.warn('[AuthContext] getSession timeout, retrying direct session fetch');
        try {
          const directSession = await withTimeout(supabaseClient.auth.getSession(), 5000);
          if (!isMounted) return;
          const directUser = directSession?.data?.session?.user ?? null;
          if (directUser) {
            const built = await withTimeout(buildUser(directUser), 8000);
            if (!isMounted) return;
            if (built) {
              setUser(built.user);
              setProfile(built.profile);
              setAuthStatus('authenticated');
              activityService.updateActivity(directUser.id);
            } else {
              clearSessionState();
            }
          } else {
            clearSessionState();
          }
        } catch {
          clearSessionState();
        }
        return;
      }
      const { data, error } = sessionResult;
      if (!isMounted) return;

      if (error) {
        if (isInvalidRefreshTokenError(error)) {
          resetInvalidSessionSafely(supabaseClient);
          return;
        }
        console.warn('[AuthContext] getSession error:', error);
      }

      const currentSession = data?.session ?? null;

      if (currentSession?.user) {
        try {
          const built = await withTimeout(buildUser(currentSession.user), 8000);
          if (!isMounted) return;
          if (built) {
            setUser(built.user);
            setProfile(built.profile);
          } else {
            console.warn('[AuthContext] buildUser timeout, using minimal session user');
            setUser({
              id: currentSession.user.id,
              name:
                currentSession.user.email ||
                currentSession.user.phone ||
                'Пользователь',
              email: currentSession.user.email ?? undefined,
              phone: currentSession.user.phone ?? undefined,
              hasPremium: false,
              createdAt: currentSession.user.created_at || new Date().toISOString(),
              profile: {
                firstName:
                  (currentSession.user.user_metadata?.first_name as string | undefined) || '',
                lastName:
                  (currentSession.user.user_metadata?.last_name as string | undefined) || undefined,
                middleName:
                  (currentSession.user.user_metadata?.middle_name as string | undefined) || undefined,
                birthDate: undefined,
                age: undefined,
                height: undefined,
                goal: undefined,
                email: currentSession.user.email ?? undefined,
                phone: currentSession.user.phone ?? undefined,
              },
              isAdmin: false,
            });
            setProfile(null);
          }
          setAuthStatus('authenticated');
          activityService.updateActivity(currentSession.user.id);
        } catch (buildError) {
          if (isInvalidRefreshTokenError(buildError)) {
            resetInvalidSessionSafely(supabaseClient);
            return;
          }
          console.warn('[AuthContext] buildUser error:', buildError);
          const fallbackUser: User = {
            id: currentSession.user.id,
            name:
              currentSession.user.email ||
              currentSession.user.phone ||
              'Пользователь',
            email: currentSession.user.email ?? undefined,
            phone: currentSession.user.phone ?? undefined,
            hasPremium: false,
            createdAt: currentSession.user.created_at || new Date().toISOString(),
            profile: {
              firstName:
                (currentSession.user.user_metadata?.first_name as string | undefined) || '',
              lastName:
                (currentSession.user.user_metadata?.last_name as string | undefined) || undefined,
              middleName:
                (currentSession.user.user_metadata?.middle_name as string | undefined) || undefined,
              birthDate: undefined,
              age: undefined,
              height: undefined,
              goal: undefined,
              email: currentSession.user.email ?? undefined,
              phone: currentSession.user.phone ?? undefined,
            },
            isAdmin: false,
          };
          setUser(fallbackUser);
          setProfile(null);
          setAuthStatus('authenticated');
        }
      } else {
        clearSessionState();
      }
    };

    const authInitGuard = window.setTimeout(() => {
      if (!isMounted) return;
      setAuthStatus((prev) => (prev === 'booting' ? 'unauthenticated' : prev));
    }, 20000);

    init();

    const { data: authListener } = supabaseClient.auth.onAuthStateChange(async (_event, newSession) => {
      if (newSession?.user) {
        try {
          const built = await withTimeout(buildUser(newSession.user), 8000);
          if (!isMounted) return;
          if (built) {
            setUser(built.user);
            setProfile(built.profile);
          } else {
            setUser({
              id: newSession.user.id,
              name:
                newSession.user.email ||
                newSession.user.phone ||
                'Пользователь',
              email: newSession.user.email ?? undefined,
              phone: newSession.user.phone ?? undefined,
              hasPremium: false,
              createdAt: newSession.user.created_at || new Date().toISOString(),
              profile: {
                firstName:
                  (newSession.user.user_metadata?.first_name as string | undefined) || '',
                lastName:
                  (newSession.user.user_metadata?.last_name as string | undefined) || undefined,
                middleName:
                  (newSession.user.user_metadata?.middle_name as string | undefined) || undefined,
                birthDate: undefined,
                age: undefined,
                height: undefined,
                goal: undefined,
                email: newSession.user.email ?? undefined,
                phone: newSession.user.phone ?? undefined,
              },
              isAdmin: false,
            });
            setProfile(null);
          }
          setAuthStatus('authenticated');
          activityService.updateActivity(newSession.user.id);
        } catch (buildError) {
          if (isInvalidRefreshTokenError(buildError)) {
            resetInvalidSessionSafely(supabaseClient);
            return;
          }
          console.warn('[AuthContext] buildUser error:', buildError);
          const fallbackUser: User = {
            id: newSession.user.id,
            name:
              newSession.user.email ||
              newSession.user.phone ||
              'Пользователь',
            email: newSession.user.email ?? undefined,
            phone: newSession.user.phone ?? undefined,
            hasPremium: false,
            createdAt: newSession.user.created_at || new Date().toISOString(),
            profile: {
              firstName:
                (newSession.user.user_metadata?.first_name as string | undefined) || '',
              lastName:
                (newSession.user.user_metadata?.last_name as string | undefined) || undefined,
              middleName:
                (newSession.user.user_metadata?.middle_name as string | undefined) || undefined,
              birthDate: undefined,
              age: undefined,
              height: undefined,
              goal: undefined,
              email: newSession.user.email ?? undefined,
              phone: newSession.user.phone ?? undefined,
            },
            isAdmin: false,
          };
          setUser(fallbackUser);
          setProfile(null);
          setAuthStatus('authenticated');
        }
      } else {
        clearSessionState();
      }
    });

    return () => {
      isMounted = false;
      window.clearTimeout(authInitGuard);
      authListener?.subscription?.unsubscribe();
    };
  }, []);

  const login = async (credentials: LoginCredentials) => {
    if (!supabase) {
      throw new Error('Supabase не инициализирован');
    }

    const identifier = credentials.identifier.trim();
    const isEmail = identifier.includes('@');

    const { error } = await supabase.auth.signInWithOtp(
      isEmail
        ? { email: identifier, options: { shouldCreateUser: false } }
        : { phone: identifier, options: { shouldCreateUser: false } }
    );

    if (error) {
      throw new Error(error.message || 'Ошибка отправки кода');
    }
  };

  const register = async (credentials: RegisterCredentials) => {
    if (!supabase) {
      throw new Error('Supabase не инициализирован');
    }

    const contact = credentials.contact.trim();
    const isEmail = contact.includes('@');

    const { error } = await supabase.auth.signInWithOtp(
      isEmail
        ? {
            email: contact,
            options: {
              shouldCreateUser: true,
              data: {
                first_name: credentials.firstName,
                last_name: credentials.lastName,
                middle_name: credentials.middleName,
              },
            },
          }
        : {
            phone: contact,
            options: {
              shouldCreateUser: true,
              data: {
                first_name: credentials.firstName,
                last_name: credentials.lastName,
                middle_name: credentials.middleName,
              },
            },
          }
    );

    if (error) {
      throw new Error(error.message || 'Ошибка отправки кода');
    }

    setThemeExplicit('light');
  };

  const verifyOtp = async (params: { identifier: string; token: string }) => {
    if (!supabase) {
      throw new Error('Supabase не инициализирован');
    }

    const identifier = params.identifier.trim();
    const token = params.token.trim();
    const isEmail = identifier.includes('@');

    const { error } = await supabase.auth.verifyOtp(
      isEmail
        ? { email: identifier, token, type: 'email' }
        : { phone: identifier, token, type: 'sms' }
    );

    if (error) {
      throw new Error(error.message || 'Ошибка проверки кода');
    }
  };

  const updateProfile = async (data: ProfileUpdatePayload) => {
    if (!user) return;
    try {
      await profileService.saveProfile(user.id, data);
      const updatedProfile = await profileService.getProfile(user.id);
      if (updatedProfile) {
        setUser((prev) =>
          prev
            ? {
                ...prev,
                name: updatedProfile.first_name || prev.name,
                email: updatedProfile.email || prev.email,
                phone: updatedProfile.phone || prev.phone,
                hasPremium: updatedProfile.has_premium ?? prev.hasPremium,
                isAdmin: updatedProfile.is_admin ?? prev.isAdmin,
                profile: {
                  ...prev.profile,
                  firstName: updatedProfile.first_name || prev.profile.firstName,
                  lastName: updatedProfile.last_name || prev.profile.lastName,
                  middleName: updatedProfile.middle_name || prev.profile.middleName,
                  birthDate: updatedProfile.birth_date || prev.profile.birthDate,
                  age: updatedProfile.age ?? prev.profile.age,
                  height: updatedProfile.height ?? prev.profile.height,
                  goal: updatedProfile.goal || prev.profile.goal,
                  email: updatedProfile.email || prev.profile.email,
                  phone: updatedProfile.phone || prev.profile.phone,
                },
              }
            : prev
        );
      }
    } catch (error) {
      throw error;
    }
  };

  const requestPasswordReset = async (payload: ResetPasswordPayload) => {
    if (!supabase) {
      throw new Error('Supabase не инициализирован');
    }

    const email = payload.email.trim();
    if (!email) {
      throw new Error('Укажите email для восстановления');
    }

    const { error } = await supabase.auth.resetPasswordForEmail(email);
    if (error) {
      throw new Error(error.message || 'Ошибка восстановления пароля');
    }
  };

  const updatePassword = async (newPassword: string) => {
    if (!supabase) {
      throw new Error('Supabase не инициализирован');
    }

    const { error } = await supabase.auth.updateUser({ password: newPassword });
    if (error) {
      throw new Error(error.message || 'Ошибка обновления пароля');
    }
  };

  const logout = () => {
    if (!supabase) {
      clearSessionState();
      return;
    }
    void supabase.auth.signOut();
    clearSessionState();
  };

  const deleteAccount = () => {
    if (!supabase || !user) return;
    void supabase.auth.signOut();
    clearSessionState();
    setThemeExplicit('light');
  };

      const mapProfileToUser = (profile: Record<string, any>): User | null => {
        const id = profile?.id_user ?? profile?.user_id ?? profile?.id;
        if (!id) {
          return null;
        }
        const firstName = profile?.first_name || '';
        const lastName = profile?.last_name || undefined;
        const name =
          `${firstName} ${lastName ?? ''}`.trim() ||
          profile?.email ||
          profile?.phone ||
          'Пользователь';

        return {
          id,
          name,
          email: profile?.email || undefined,
          phone: profile?.phone || undefined,
          hasPremium: profile?.has_premium ?? false,
          createdAt: profile?.created_at || new Date().toISOString(),
          profile: {
            firstName,
            lastName,
            middleName: profile?.middle_name || undefined,
            birthDate: profile?.birth_date || undefined,
            age: profile?.age ?? undefined,
            height: profile?.height ?? undefined,
            goal: profile?.goal ?? undefined,
            email: profile?.email || undefined,
            phone: profile?.phone || undefined,
          },
          isAdmin: profile?.is_admin ?? false,
        };
      };

      const getAllUsers = async (): Promise<User[]> => {
        if (!supabase) {
          return [];
        }
        try {
          let { data, error } = await supabase
            .from('user_profiles')
            .select('*')
            .order('created_at', { ascending: false });

          if (error && error.message?.includes('created_at')) {
            const fallback = await supabase.from('user_profiles').select('*');
            if (!fallback.error) {
              data = fallback.data;
              error = null;
            } else {
              error = fallback.error;
            }
          }

          if (error) {
            if (error.code !== 'PGRST205') {
              console.warn('[AuthContext] getAllUsers error:', error.message || error);
            }
            return [];
          }

          return (data || [])
            .map((profile) => mapProfileToUser(profile))
            .filter((userEntry): userEntry is User => Boolean(userEntry));
        } catch (err) {
          console.warn('[AuthContext] getAllUsers failed:', err);
          return [];
        }
      };

      const setAdminStatus = async (userId: string, isAdmin: boolean) => {
        if (!supabase) return;
        const { error } = await supabase!
          .from('user_profiles')
          .update({ is_admin: isAdmin })
          .eq('id_user', userId);
        if (error) {
          console.warn('[AuthContext] setAdminStatus error:', error.message || error);
        }
      };

      const isLoading = authStatus === 'booting';
      const isAuthenticated = authStatus === 'authenticated';

      return (
        <AuthContext.Provider
          value={{
            user,
            profile,
            authStatus,
            isLoading,
            login,
            register,
            verifyOtp,
            updateProfile,
            requestPasswordReset,
            updatePassword,
            deleteAccount,
            logout,
            isAuthenticated,
            entitlements,
            trustScore,
            getAllUsers,
            setAdminStatus,
          }}
        >
          {children}
        </AuthContext.Provider>
      );
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};
