import React, { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import {
  User,
  LoginCredentials,
  RegisterCredentials,
  ProfileUpdatePayload,
  ResetPasswordPayload,
} from '../types';
import { authService } from '../services/authService';
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
    }
    setIsLoading(false);
  }, []);

  const login = async (credentials: LoginCredentials) => {
    try {
      const response = await authService.login(credentials);
      setUser(response.user);
    } catch (error) {
      throw error;
    }
  };

  const register = async (credentials: RegisterCredentials) => {
    try {
      const response = await authService.register(credentials);
      setUser(response.user);
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

