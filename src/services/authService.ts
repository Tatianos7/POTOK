import { User, LoginCredentials, RegisterCredentials, AuthResponse } from '../types';

// Временное хранилище для демо (в продакшене использовать backend API)
const STORAGE_KEY = 'potok_user';
const TOKEN_KEY = 'potok_token';

class AuthService {
  // Имитация API запроса с задержкой
  private async delay(ms: number = 500): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  async login(credentials: LoginCredentials): Promise<AuthResponse> {
    await this.delay();
    
    // Проверяем существующих пользователей
    const existingUsers = this.getStoredUsers();
    const user = existingUsers.find(u => u.email === credentials.email);
    
    if (!user) {
      throw new Error('Пользователь с таким email не найден');
    }

    // В реальном приложении здесь будет проверка пароля на сервере
    const token = this.generateToken(user.id);
    
    // Сохраняем токен и пользователя
    localStorage.setItem(TOKEN_KEY, token);
    localStorage.setItem(STORAGE_KEY, JSON.stringify(user));

    return { user, token };
  }

  async register(credentials: RegisterCredentials): Promise<AuthResponse> {
    await this.delay();
    
    const existingUsers = this.getStoredUsers();
    
    if (existingUsers.some(u => u.email === credentials.email)) {
      throw new Error('Пользователь с таким email уже существует');
    }

    const newUser: User = {
      id: this.generateId(),
      name: credentials.name,
      email: credentials.email,
      hasPremium: false,
      createdAt: new Date().toISOString(),
    };

    existingUsers.push(newUser);
    localStorage.setItem('potok_users', JSON.stringify(existingUsers));

    const token = this.generateToken(newUser.id);
    localStorage.setItem(TOKEN_KEY, token);
    localStorage.setItem(STORAGE_KEY, JSON.stringify(newUser));

    return { user: newUser, token };
  }

  getCurrentUser(): User | null {
    const userStr = localStorage.getItem(STORAGE_KEY);
    if (!userStr) return null;
    
    try {
      return JSON.parse(userStr);
    } catch {
      return null;
    }
  }

  getToken(): string | null {
    return localStorage.getItem(TOKEN_KEY);
  }

  logout(): void {
    localStorage.removeItem(STORAGE_KEY);
    localStorage.removeItem(TOKEN_KEY);
  }

  isAuthenticated(): boolean {
    return !!this.getToken() && !!this.getCurrentUser();
  }

  private getStoredUsers(): User[] {
    const usersStr = localStorage.getItem('potok_users');
    if (!usersStr) return [];
    
    try {
      return JSON.parse(usersStr);
    } catch {
      return [];
    }
  }

  private generateId(): string {
    return Date.now().toString(36) + Math.random().toString(36).substr(2);
  }

  private generateToken(userId: string): string {
    // В реальном приложении токен будет приходить с сервера
    return btoa(`${userId}:${Date.now()}`);
  }
}

export const authService = new AuthService();

