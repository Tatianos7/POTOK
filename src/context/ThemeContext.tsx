import { createContext, useContext, useEffect, useMemo, useState, ReactNode } from 'react';

type Theme = 'light' | 'dark';

interface ThemeContextType {
  theme: Theme;
  toggleTheme: () => void;
  setThemeExplicit: (value: Theme) => void;
}

const ThemeContext = createContext<ThemeContextType | undefined>(undefined);

const isAuthenticated = (): boolean => {
  if (typeof window === 'undefined') return false;
  const token = localStorage.getItem('potok_token');
  const user = localStorage.getItem('potok_user');
  return !!(token && user);
};

const getInitialTheme = (): Theme => {
  if (typeof window === 'undefined') return 'light';
  
  // Если пользователь не авторизован, всегда используем светлую тему
  if (!isAuthenticated()) {
    return 'light';
  }
  
  // Для авторизованных пользователей проверяем сохраненную тему
  const stored = localStorage.getItem('potok_theme');
  if (stored === 'light' || stored === 'dark') {
    return stored;
  }
  
  // Для новых пользователей (без сохраненной темы) всегда используем светлую тему
  // Не используем системную тему устройства, чтобы не удивлять пользователей
  return 'light';
};

export const ThemeProvider = ({ children }: { children: ReactNode }) => {
  const [theme, setTheme] = useState<Theme>(getInitialTheme);

  useEffect(() => {
    const root = document.documentElement;
    if (theme === 'dark') {
      root.classList.add('dark');
    } else {
      root.classList.remove('dark');
    }
    localStorage.setItem('potok_theme', theme);
  }, [theme]);

  // Следим за изменением авторизации и обновляем тему
  useEffect(() => {
    if (!isAuthenticated()) {
      // Если пользователь не авторизован, принудительно устанавливаем светлую тему
      setTheme('light');
    }
  }, []);

  // Следим за изменениями в localStorage для отслеживания авторизации
  useEffect(() => {
    const handleStorageChange = () => {
      if (!isAuthenticated()) {
        setTheme('light');
      }
    };

    // Слушаем изменения localStorage (срабатывает в других вкладках)
    window.addEventListener('storage', handleStorageChange);
    
    // Также слушаем кастомное событие для отслеживания изменений в текущей вкладке
    const handleAuthChange = () => {
      if (!isAuthenticated()) {
        setTheme('light');
      }
    };
    
    window.addEventListener('auth-change', handleAuthChange);

    return () => {
      window.removeEventListener('storage', handleStorageChange);
      window.removeEventListener('auth-change', handleAuthChange);
    };
  }, []);

  // Не слушаем изменения системной темы - пользователь должен явно выбрать тему в профиле
  // Это предотвращает неожиданные изменения темы при смене системных настроек

  const value = useMemo(
    () => ({
      theme,
      toggleTheme: () => setTheme((prev) => (prev === 'light' ? 'dark' : 'light')),
      setThemeExplicit: (value: Theme) => setTheme(value),
    }),
    [theme]
  );

  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>;
};

export const useTheme = () => {
  const context = useContext(ThemeContext);
  if (!context) {
    throw new Error('useTheme must be used within a ThemeProvider');
  }
  return context;
};

