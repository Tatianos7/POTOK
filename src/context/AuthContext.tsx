import React, { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import {
  User,
  LoginCredentials,
  RegisterCredentials,
  ProfileUpdatePayload,
  ResetPasswordPayload,
} from '../types';
import { authService } from '../services/authService';
import { activityService } from '../services/activityService';
import { profileService } from '../services/profileService';
import { useTheme } from './ThemeContext';

interface AuthContextType {
  user: User | null;
  isLoading: boolean;
  login: (credentials: LoginCredentials) => Promise<void>;
  register: (credentials: RegisterCredentials) => Promise<void>;
  updateProfile: (data: ProfileUpdatePayload) => Promise<void>;
  resetPassword: (payload: ResetPasswordPayload) => Promise<void>;
  deleteAccount: () => void;
  logout: () => void;
  isAuthenticated: boolean;
  getAllUsers: () => User[];
  setAdminStatus: (userId: string, isAdmin: boolean) => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const AuthProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<User | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const { setThemeExplicit } = useTheme();

  useEffect(() => {
    // Проверяем целостность данных пользователей при загрузке
    const users = authService.getAllUsers();
    if (users.length === 0) {
      // Если пользователей нет, пытаемся восстановить из резервной копии
      const restored = authService.restoreUsersFromBackup();
      if (restored) {
        console.log('Пользователи восстановлены из резервной копии');
      }
    }
    
    // Проверяем наличие сохраненного пользователя при загрузке
    const savedUser = authService.getCurrentUser();
    if (savedUser) {
      // Загружаем профиль из Supabase и обновляем пользователя
      profileService.getProfile(savedUser.id).then((supabaseProfile) => {
        if (supabaseProfile) {
          const updatedUser = {
            ...savedUser,
            profile: {
              ...savedUser.profile,
              ...supabaseProfile,
            },
          };
          setUser(updatedUser);
          // Сохраняем обновленного пользователя
          localStorage.setItem('potok_user', JSON.stringify(updatedUser));
        } else {
          setUser(savedUser);
        }
      }).catch(() => {
        setUser(savedUser);
      });
      
      // Обновляем активность при загрузке
      activityService.updateActivity(savedUser.id);
    }
    setIsLoading(false);
  }, []);

  const login = async (credentials: LoginCredentials) => {
    try {
      const response = await authService.login(credentials);
      
      // Загружаем профиль из Supabase и обновляем пользователя
      const supabaseProfile = await profileService.getProfile(response.user.id);
      if (supabaseProfile) {
        const updatedUser = {
          ...response.user,
          profile: {
            ...response.user.profile,
            ...supabaseProfile,
          },
        };
        setUser(updatedUser);
        // Сохраняем обновленного пользователя
        localStorage.setItem('potok_user', JSON.stringify(updatedUser));
      } else {
        setUser(response.user);
      }
      
      // Обновляем активность при входе
      activityService.updateActivity(response.user.id);
    } catch (error) {
      throw error;
    }
  };

  const register = async (credentials: RegisterCredentials) => {
    try {
      const response = await authService.register(credentials);
      setUser(response.user);
      // Устанавливаем светлую тему для нового пользователя
      setThemeExplicit('light');
      // Обновляем активность при регистрации
      activityService.updateActivity(response.user.id);
    } catch (error) {
      throw error;
    }
  };

  const updateProfile = async (data: ProfileUpdatePayload) => {
    if (!user) return;
    try {
      const updatedUser = authService.updateProfile(user.id, data);
      setUser(updatedUser);
    } catch (error) {
      throw error;
    }
  };

  const resetPassword = async (payload: ResetPasswordPayload) => {
    await authService.resetPassword(payload);
  };

  const logout = () => {
    authService.logout();
    setUser(null);
  };

  const deleteAccount = () => {
    if (!user) return;
    authService.deleteAccount(user.id);
    setUser(null);
    setThemeExplicit('light');
  };

      const getAllUsers = () => {
        return authService.getAllUsers();
      };

      const setAdminStatus = async (userId: string, isAdmin: boolean) => {
        const updatedUser = await authService.setAdminStatus(userId, isAdmin);
        // Если обновляем текущего пользователя, обновляем состояние
        if (user?.id === userId) {
          setUser(updatedUser);
        }
      };

      return (
        <AuthContext.Provider
          value={{
            user,
            isLoading,
            login,
            register,
            updateProfile,
            resetPassword,
            deleteAccount,
            logout,
            isAuthenticated: !!user,
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

