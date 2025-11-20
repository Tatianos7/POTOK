import {
  User,
  LoginCredentials,
  RegisterCredentials,
  AuthResponse,
  ProfileUpdatePayload,
  ResetPasswordPayload,
} from '../types';

// Временное хранилище для демо (в продакшене использовать backend API)
const STORAGE_KEY = 'potok_user';
const TOKEN_KEY = 'potok_token';

class AuthService {
  // Имитация API запроса с задержкой
  private async delay(ms: number = 500): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  private normalizePhone(value?: string) {
    if (!value) return '';
    return value.replace(/[^\d]/g, '');
  }

  private ensureProfile(user: User): User {
    return {
      ...user,
      name: user.name || user.profile?.firstName || 'Пользователь',
      profile: {
        firstName: user.profile?.firstName || user.name || 'Пользователь',
        lastName: user.profile?.lastName,
        middleName: user.profile?.middleName,
        birthDate: user.profile?.birthDate,
        age: user.profile?.age,
        height: user.profile?.height,
        goal: user.profile?.goal,
        email: user.profile?.email ?? user.email,
        phone: user.profile?.phone ?? user.phone,
      },
      email: user.email ?? user.profile?.email,
      phone: user.phone ?? user.profile?.phone,
    };
  }

  async login(credentials: LoginCredentials): Promise<AuthResponse> {
    await this.delay();

    // Проверяем существующих пользователей
    const existingUsers = this.getStoredUsers();
    const identifier = credentials.identifier.trim().toLowerCase();
    const normalizedInputPhone = this.normalizePhone(credentials.identifier);
    const userIndex = existingUsers.findIndex((u) => {
      const emailMatch = u.email?.toLowerCase() === identifier || u.profile?.email?.toLowerCase() === identifier;
      const phoneMatch =
        normalizedInputPhone &&
        (this.normalizePhone(u.phone) === normalizedInputPhone ||
          this.normalizePhone(u.profile?.phone) === normalizedInputPhone);
      return emailMatch || phoneMatch;
    });
    const user = userIndex !== -1 ? existingUsers[userIndex] : undefined;

    if (!user) {
      throw new Error('Пользователь с такими данными не найден');
    }

    if (user.password && user.password !== credentials.password) {
      throw new Error('Неверный пароль');
    }

    // В реальном приложении здесь будет проверка пароля на сервере
    const token = this.generateToken(user.id);
    
    // Сохраняем токен и пользователя
    localStorage.setItem(TOKEN_KEY, token);
    localStorage.setItem(STORAGE_KEY, JSON.stringify(this.ensureProfile(user)));

    return { user: this.ensureProfile(user), token };
  }

  async register(credentials: RegisterCredentials): Promise<AuthResponse> {
    await this.delay();

    const existingUsers = this.getStoredUsers();

    if (!credentials.email && !credentials.phone) {
      throw new Error('Укажите email или номер телефона');
    }

    const emailExists =
      credentials.email &&
      existingUsers.some(
        (u) =>
          u.email?.toLowerCase() === credentials.email?.toLowerCase() ||
          u.profile?.email?.toLowerCase() === credentials.email?.toLowerCase()
      );
    if (emailExists) {
      throw new Error('Пользователь с таким email уже существует');
    }

    const phoneExists =
      credentials.phone &&
      existingUsers.some(
        (u) =>
          this.normalizePhone(u.phone) === this.normalizePhone(credentials.phone) ||
          this.normalizePhone(u.profile?.phone) === this.normalizePhone(credentials.phone)
      );
    if (phoneExists) {
      throw new Error('Пользователь с таким телефоном уже существует');
    }

    const newUser: User = {
      id: this.generateId(),
      name: credentials.firstName,
      email: credentials.email,
      phone: credentials.phone,
      password: credentials.password,
      hasPremium: false,
      createdAt: new Date().toISOString(),
      profile: {
        firstName: credentials.firstName,
        lastName: credentials.lastName,
        middleName: credentials.middleName,
        birthDate: credentials.birthDate,
        age: credentials.age,
        height: credentials.height,
        goal: credentials.goal,
        email: credentials.email,
        phone: credentials.phone,
      },
    };

    existingUsers.push(newUser);
    localStorage.setItem('potok_users', JSON.stringify(existingUsers));

    const token = this.generateToken(newUser.id);
    localStorage.setItem(TOKEN_KEY, token);
    localStorage.setItem(STORAGE_KEY, JSON.stringify(this.ensureProfile(newUser)));

    return { user: this.ensureProfile(newUser), token };
  }

  getCurrentUser(): User | null {
    const userStr = localStorage.getItem(STORAGE_KEY);
    if (!userStr) return null;
    
    try {
      return this.ensureProfile(JSON.parse(userStr));
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
      const users: User[] = JSON.parse(usersStr);
      return users.map((u) =>
        this.ensureProfile({
          ...u,
          profile: u.profile ?? {
            firstName: u.name,
            email: u.email,
            phone: u.phone,
          },
        })
      );
    } catch {
      return [];
    }
  }

  updateProfile(userId: string, data: ProfileUpdatePayload): User {
    const users = this.getStoredUsers();
    const index = users.findIndex((u) => u.id === userId);
    if (index === -1) {
      throw new Error('Пользователь не найден');
    }

    const existingUser = users[index];
    const updatedProfile: ProfileUpdatePayload = {
      ...existingUser.profile,
      ...data,
    };

    const updatedUser: User = this.ensureProfile({
      ...existingUser,
      name: updatedProfile.firstName || existingUser.name,
      email: updatedProfile.email || existingUser.email,
      phone: updatedProfile.phone || existingUser.phone,
      profile: updatedProfile,
    });

    users[index] = updatedUser;
    localStorage.setItem('potok_users', JSON.stringify(users));
    localStorage.setItem(STORAGE_KEY, JSON.stringify(updatedUser));

    return updatedUser;
  }

  resetPassword(payload: ResetPasswordPayload) {
    const users = this.getStoredUsers();
    const identifier = payload.identifier.trim().toLowerCase();
    const normalizedPhone = this.normalizePhone(payload.identifier);
    const index = users.findIndex((u) => {
      const emailMatch = u.email?.toLowerCase() === identifier || u.profile?.email?.toLowerCase() === identifier;
      const phoneMatch =
        normalizedPhone &&
        (this.normalizePhone(u.phone) === normalizedPhone || this.normalizePhone(u.profile?.phone) === normalizedPhone);
      return emailMatch || phoneMatch;
    });

    if (index === -1) {
      throw new Error('Пользователь не найден');
    }

    users[index].password = payload.newPassword;
    localStorage.setItem('potok_users', JSON.stringify(users));

    const currentUser = this.getCurrentUser();
    if (currentUser?.id === users[index].id) {
      localStorage.setItem(
        STORAGE_KEY,
        JSON.stringify({
          ...users[index],
        })
      );
    }
  }

  deleteAccount(userId: string) {
    const users = this.getStoredUsers().filter((u) => u.id !== userId);
    localStorage.setItem('potok_users', JSON.stringify(users));
    if (this.getCurrentUser()?.id === userId) {
      this.logout();
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

