import React, { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import type { Session } from '@supabase/supabase-js';
import {
  User,
  LoginCredentials,
  RegisterCredentials,
  ProfileUpdatePayload,
  ResetPasswordPayload,
} from '../types';
import { supabase } from '../lib/supabaseClient';
import { activityService } from '../services/activityService';
import { profileService } from '../services/profileService';
import { useTheme } from './ThemeContext';

interface AuthContextType {
  user: User | null;
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
  getAllUsers: () => User[];
  setAdminStatus: (userId: string, isAdmin: boolean) => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const AuthProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<User | null>(null);
  const [session, setSession] = useState<Session | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const { setThemeExplicit } = useTheme();

  const buildUser = async (sessionUser: Session['user']): Promise<User> => {
    const supabaseProfile = await profileService.getProfile(sessionUser.id);
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
    };
  };

  useEffect(() => {
    if (!supabase) {
      setIsLoading(false);
      return;
    }

    const supabaseClient = supabase;
    let isMounted = true;

    const init = async () => {
      const { data, error } = await supabaseClient.auth.getSession();
      if (!isMounted) return;

      if (error) {
        console.error('[AuthContext] getSession error:', error);
      }

      const currentSession = data?.session ?? null;
      setSession(currentSession);

      if (currentSession?.user) {
        try {
          const builtUser = await buildUser(currentSession.user);
          if (!isMounted) return;
          setUser(builtUser);
          activityService.updateActivity(builtUser.id);
        } catch (buildError) {
          console.error('[AuthContext] buildUser error:', buildError);
          setUser(null);
        }
      } else {
        setUser(null);
      }

      setIsLoading(false);
    };

    init();

    const { data: authListener } = supabaseClient.auth.onAuthStateChange(async (_event, newSession) => {
      setSession(newSession);
      if (newSession?.user) {
        try {
          const builtUser = await buildUser(newSession.user);
          if (!isMounted) return;
          setUser(builtUser);
          activityService.updateActivity(builtUser.id);
        } catch (buildError) {
          console.error('[AuthContext] buildUser error:', buildError);
          setUser(null);
        }
      } else {
        setUser(null);
      }
    });

    return () => {
      isMounted = false;
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
      setUser(null);
      return;
    }
    void supabase.auth.signOut();
    setUser(null);
  };

  const deleteAccount = () => {
    if (!supabase || !user) return;
    void supabase.auth.signOut();
    setUser(null);
    setThemeExplicit('light');
  };

      const getAllUsers = () => {
        console.warn('[AuthContext] getAllUsers is not available with Supabase Auth');
        return [];
      };

      const setAdminStatus = async (userId: string, isAdmin: boolean) => {
        console.warn('[AuthContext] setAdminStatus is not available with Supabase Auth', userId, isAdmin);
      };

      return (
        <AuthContext.Provider
          value={{
            user,
            isLoading,
            login,
            register,
            verifyOtp,
            updateProfile,
            requestPasswordReset,
            updatePassword,
            deleteAccount,
            logout,
            isAuthenticated: !!session?.user,
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

