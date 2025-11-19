import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import type { User, AuthState } from '../types';

interface AuthStore extends AuthState {
  login: (email: string, password: string) => Promise<void>;
  register: (name: string, email: string, password: string) => Promise<void>;
  logout: () => void;
  checkAuth: () => void;
}

// Имитация API для демонстрации
// В реальном приложении здесь будут запросы к backend
const API_DELAY = 500; // Имитация сетевой задержки

const mockUsers: Array<{ email: string; password: string; user: User }> = [];

export const useAuthStore = create<AuthStore>()(
  persist(
    (set) => ({
      user: null,
      isAuthenticated: false,
      isLoading: false,

      login: async (email: string, password: string) => {
        set({ isLoading: true });
        
        // Имитация API запроса
        await new Promise(resolve => setTimeout(resolve, API_DELAY));
        
        // Проверка в localStorage (для демо)
        const storedUsers = localStorage.getItem('mock_users');
        const users = storedUsers ? JSON.parse(storedUsers) : [];
        
        const foundUser = users.find(
          (u: { email: string; password: string }) => 
            u.email === email && u.password === password
        );
        
        if (foundUser) {
          set({
            user: foundUser.user,
            isAuthenticated: true,
            isLoading: false,
          });
        } else {
          set({ isLoading: false });
          throw new Error('Неверный email или пароль');
        }
      },

      register: async (name: string, email: string, password: string) => {
        set({ isLoading: true });
        
        // Имитация API запроса
        await new Promise(resolve => setTimeout(resolve, API_DELAY));
        
        // Проверка существующего пользователя
        const storedUsers = localStorage.getItem('mock_users');
        const users = storedUsers ? JSON.parse(storedUsers) : [];
        
        if (users.some((u: { email: string }) => u.email === email)) {
          set({ isLoading: false });
          throw new Error('Пользователь с таким email уже существует');
        }
        
        // Создание нового пользователя
        const newUser: User = {
          id: `user_${Date.now()}`,
          name,
          email,
          hasPremium: false,
          createdAt: new Date().toISOString(),
        };
        
        users.push({
          email,
          password, // В реальном приложении пароль должен быть захеширован
          user: newUser,
        });
        
        localStorage.setItem('mock_users', JSON.stringify(users));
        
        set({
          user: newUser,
          isAuthenticated: true,
          isLoading: false,
        });
      },

      logout: () => {
        set({
          user: null,
          isAuthenticated: false,
        });
      },

      checkAuth: () => {
        // Проверка аутентификации при загрузке
        const state = useAuthStore.getState();
        if (state.user) {
          set({ isAuthenticated: true });
        }
      },
    }),
    {
      name: 'auth-storage',
      partialize: (state) => ({ 
        user: state.user, 
        isAuthenticated: state.isAuthenticated 
      }),
    }
  )
);

