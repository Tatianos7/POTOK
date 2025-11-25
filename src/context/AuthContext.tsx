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
    // Проверяем наличие сохраненного пользователя при загрузке
    const savedUser = authService.getCurrentUser();
    if (savedUser) {
      setUser(savedUser);
      // Обновляем активность при загрузке
      activityService.updateActivity(savedUser.id);
    }
    setIsLoading(false);
  }, []);

  const login = async (credentials: LoginCredentials) => {
    try {
      const response = await authService.login(credentials);
      setUser(response.user);
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

