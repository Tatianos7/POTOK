import {
  User,
  LoginCredentials,
  RegisterCredentials,
  AuthResponse,
  ProfileUpdatePayload,
  ResetPasswordPayload,
} from '../types';
import { profileService } from './profileService';

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

    // Проверка админ-входа
    const identifier = credentials.identifier.trim();
    if (identifier.toLowerCase() === 'admin' && credentials.password === '4561519') {
      const adminUser: User = {
        id: 'admin',
        name: 'Admin',
        email: 'admin@potok.com',
        hasPremium: true,
        isAdmin: true,
        createdAt: new Date().toISOString(),
        profile: {
          firstName: 'Admin',
        },
      };

      const token = this.generateToken(adminUser.id);
      localStorage.setItem(TOKEN_KEY, token);
      localStorage.setItem(STORAGE_KEY, JSON.stringify(adminUser));

      return { user: adminUser, token };
    }

    // Проверяем существующих пользователей
    const existingUsers = this.getStoredUsers();
    const identifierLower = identifier.toLowerCase();
    const normalizedInputPhone = this.normalizePhone(credentials.identifier);
    const userIndex = existingUsers.findIndex((u) => {
      const emailMatch = u.email?.toLowerCase() === identifierLower || u.profile?.email?.toLowerCase() === identifierLower;
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
    
    // Загружаем профиль из Supabase (если есть)
    const supabaseProfile = await profileService.getProfile(user.id);
    if (supabaseProfile) {
      // Обновляем пользователя данными из Supabase
      user.profile = profileService.toProfileDetails(supabaseProfile);
      user.hasPremium = supabaseProfile.has_premium;
      user.isAdmin = supabaseProfile.is_admin;
      
      // Обновляем localStorage пользователей
      existingUsers[userIndex] = user;
      localStorage.setItem('potok_users', JSON.stringify(existingUsers));
    }
    
    // Сохраняем токен и пользователя
    localStorage.setItem(TOKEN_KEY, token);
    const ensuredUser = this.ensureProfile(user);
    localStorage.setItem(STORAGE_KEY, JSON.stringify(ensuredUser));

    return { user: ensuredUser, token };
  }

  async register(credentials: RegisterCredentials): Promise<AuthResponse> {
    await this.delay();

    // Проверка админ-регистрации
    if (credentials.firstName.toLowerCase() === 'admin' && credentials.password === '4561519') {
      const adminUser: User = {
        id: 'admin',
        name: 'Admin',
        email: 'admin@potok.com',
        hasPremium: true,
        isAdmin: true,
        createdAt: new Date().toISOString(),
        profile: {
          firstName: 'Admin',
        },
      };

      const token = this.generateToken(adminUser.id);
      localStorage.setItem(TOKEN_KEY, token);
      localStorage.setItem(STORAGE_KEY, JSON.stringify(adminUser));

      return { user: adminUser, token };
    }

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
    // Создаем резервную копию перед сохранением
    this.createBackup();
    localStorage.setItem('potok_users', JSON.stringify(existingUsers));
    
    // Отправляем событие об изменении данных пользователей для обновления админ-панели
    window.dispatchEvent(new Event('user-data-changed'));

    const token = this.generateToken(newUser.id);
    localStorage.setItem(TOKEN_KEY, token);
    const ensuredUser = this.ensureProfile(newUser);
    localStorage.setItem(STORAGE_KEY, JSON.stringify(ensuredUser));

    // Синхронизируем профиль с Supabase
    void profileService.saveProfile(newUser.id, ensuredUser.profile);
    void profileService.updatePremiumStatus(newUser.id, newUser.hasPremium);
    if (newUser.isAdmin) {
      void profileService.updateAdminStatus(newUser.id, true);
    }

    return { user: ensuredUser, token };
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
    if (!usersStr) {
      // Если основных данных нет, пытаемся восстановить из резервной копии
      const backup = localStorage.getItem('potok_users_backup');
      if (backup) {
        try {
          const backupUsers: User[] = JSON.parse(backup);
          if (Array.isArray(backupUsers) && backupUsers.length > 0) {
            console.warn('Восстановление пользователей из резервной копии (основные данные отсутствуют)');
            localStorage.setItem('potok_users', backup);
            return backupUsers.map((u) =>
              this.ensureProfile({
                ...u,
                profile: u.profile ?? {
                  firstName: u.name,
                  email: u.email,
                  phone: u.phone,
                },
              })
            );
          }
        } catch (backupError) {
          console.error('Ошибка восстановления из резервной копии:', backupError);
        }
      }
      
      // Информационное сообщение для разработчиков
      if (typeof window !== 'undefined') {
        const hostname = window.location.hostname;
        if (hostname !== 'localhost' && hostname !== '127.0.0.1') {
          console.info(
            '💡 Примечание: Данные пользователей хранятся локально в браузере (localStorage). ' +
            'Пользователи, зарегистрированные на localhost, не будут видны на GitHub Pages и наоборот. ' +
            'Это нормальное поведение для демо-версии. Для продакшена требуется backend с базой данных.'
          );
        }
      }
      
      return [];
    }

    try {
      const users: User[] = JSON.parse(usersStr);
      // Проверяем, что это массив
      if (!Array.isArray(users)) {
        console.error('potok_users не является массивом, пытаемся восстановить из резервной копии');
        // Пытаемся восстановить из резервной копии
        const backup = localStorage.getItem('potok_users_backup');
        if (backup) {
          try {
            const backupUsers: User[] = JSON.parse(backup);
            if (Array.isArray(backupUsers) && backupUsers.length > 0) {
              console.warn('Восстановление пользователей из резервной копии (данные повреждены)');
              localStorage.setItem('potok_users', backup);
              return backupUsers.map((u) =>
                this.ensureProfile({
                  ...u,
                  profile: u.profile ?? {
                    firstName: u.name,
                    email: u.email,
                    phone: u.phone,
                  },
                })
              );
            }
          } catch (backupError) {
            console.error('Ошибка восстановления из резервной копии:', backupError);
          }
        }
        return [];
      }
      
      // Проверяем, что массив не пустой (может быть потеря данных)
      if (users.length === 0) {
        const backup = localStorage.getItem('potok_users_backup');
        if (backup) {
          try {
            const backupUsers: User[] = JSON.parse(backup);
            if (Array.isArray(backupUsers) && backupUsers.length > 0) {
              console.warn('Восстановление пользователей из резервной копии (массив пустой)');
              localStorage.setItem('potok_users', backup);
              return backupUsers.map((u) =>
                this.ensureProfile({
                  ...u,
                  profile: u.profile ?? {
                    firstName: u.name,
                    email: u.email,
                    phone: u.phone,
                  },
                })
              );
            }
          } catch (backupError) {
            console.error('Ошибка восстановления из резервной копии:', backupError);
          }
        }
      }
      
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
    } catch (error) {
      console.error('Ошибка парсинга potok_users:', error);
      // Пытаемся восстановить из резервной копии
      const backup = localStorage.getItem('potok_users_backup');
      if (backup) {
        try {
          const backupUsers: User[] = JSON.parse(backup);
          if (Array.isArray(backupUsers) && backupUsers.length > 0) {
            console.warn('Восстановление пользователей из резервной копии (ошибка парсинга)');
            localStorage.setItem('potok_users', backup);
            return backupUsers.map((u) =>
              this.ensureProfile({
                ...u,
                profile: u.profile ?? {
                  firstName: u.name,
                  email: u.email,
                  phone: u.phone,
                },
              })
            );
          }
        } catch (backupError) {
          console.error('Ошибка восстановления из резервной копии:', backupError);
        }
      }
      return [];
    }
  }

  // Получить всех пользователей (для админ-панели)
  getAllUsers(): User[] {
    return this.getStoredUsers();
  }

  // Восстановить пользователей из резервной копии
  restoreUsersFromBackup(): boolean {
    try {
      const backup = localStorage.getItem('potok_users_backup');
      if (!backup) {
        console.warn('Резервная копия не найдена');
        return false;
      }

      const backupUsers: User[] = JSON.parse(backup);
      if (!Array.isArray(backupUsers) || backupUsers.length === 0) {
        console.warn('Резервная копия пуста или повреждена');
        return false;
      }

      // Восстанавливаем пользователей
      localStorage.setItem('potok_users', backup);
      console.log(`Восстановлено ${backupUsers.length} пользователей из резервной копии`);
      
      // Отправляем событие для обновления
      window.dispatchEvent(new Event('user-data-changed'));
      
      return true;
    } catch (error) {
      console.error('Ошибка восстановления из резервной копии:', error);
      return false;
    }
  }

  // Назначить/снять права администратора
  async setAdminStatus(userId: string, isAdmin: boolean): Promise<User> {
    await this.delay();
    
    const users = this.getStoredUsers();
    const index = users.findIndex((u) => u.id === userId);
    
    if (index === -1) {
      throw new Error('Пользователь не найден');
    }

    users[index].isAdmin = isAdmin;
    // Создаем резервную копию перед сохранением
    this.createBackup();
    localStorage.setItem('potok_users', JSON.stringify(users));
    
    // Отправляем событие об изменении данных пользователей для обновления админ-панели
    window.dispatchEvent(new Event('user-data-changed'));
    
    // Отправляем событие об изменении данных пользователей
    window.dispatchEvent(new Event('user-data-changed'));

    // Обновляем текущего пользователя, если это он
    const currentUser = this.getCurrentUser();
    if (currentUser?.id === userId) {
      const updatedUser = { ...currentUser, isAdmin };
      localStorage.setItem(STORAGE_KEY, JSON.stringify(updatedUser));
      
      // Синхронизируем админ статус с Supabase
      void profileService.updateAdminStatus(userId, isAdmin);
      
      return updatedUser;
    }

    // Синхронизируем админ статус с Supabase
    void profileService.updateAdminStatus(userId, isAdmin);

    return users[index];
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
    // Создаем резервную копию перед сохранением
    this.createBackup();
    localStorage.setItem('potok_users', JSON.stringify(users));
    localStorage.setItem(STORAGE_KEY, JSON.stringify(updatedUser));
    
    // Синхронизируем профиль с Supabase
    void profileService.saveProfile(userId, updatedProfile);
    
    // Отправляем событие об изменении данных пользователей
    window.dispatchEvent(new Event('user-data-changed'));

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
    // Создаем резервную копию перед сохранением
    this.createBackup();
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
    // Создаем резервную копию перед сохранением
    this.createBackup();
    localStorage.setItem('potok_users', JSON.stringify(users));
    if (this.getCurrentUser()?.id === userId) {
      this.logout();
    }
  }

  // Обновить статус подписки пользователя
  updateUserSubscription(userId: string, hasPremium: boolean, subscriptionType?: 'monthly' | 'yearly'): User {
    const users = this.getStoredUsers();
    const index = users.findIndex((u) => u.id === userId);
    
    if (index === -1) {
      throw new Error('Пользователь не найден');
    }

    // Создаем резервную копию перед изменением
    this.createBackup();

    // Обновляем подписку
    users[index].hasPremium = hasPremium;
    if (subscriptionType !== undefined) {
      (users[index] as any).subscriptionType = subscriptionType;
    }

    // Безопасно сохраняем
    try {
      localStorage.setItem('potok_users', JSON.stringify(users));
    } catch (storageError) {
      console.error('Ошибка сохранения пользователей:', storageError);
      // Восстанавливаем из резервной копии при ошибке
      const backup = localStorage.getItem('potok_users_backup');
      if (backup) {
        localStorage.setItem('potok_users', backup);
      }
      throw new Error('Не удалось сохранить изменения');
    }

    // Обновляем текущего пользователя, если это он
    const currentUser = this.getCurrentUser();
    if (currentUser?.id === userId) {
      const updatedUser = { ...currentUser, hasPremium, subscriptionType };
      localStorage.setItem(STORAGE_KEY, JSON.stringify(updatedUser));
      
      // Синхронизируем статус подписки с Supabase
      void profileService.updatePremiumStatus(userId, hasPremium);
      
      // Отправляем событие для обновления
      window.dispatchEvent(new Event('user-data-changed'));
      return updatedUser;
    }

    // Синхронизируем статус подписки с Supabase
    void profileService.updatePremiumStatus(userId, hasPremium);

    // Отправляем событие для обновления
    window.dispatchEvent(new Event('user-data-changed'));
    return users[index];
  }

  // Создать резервную копию пользователей
  private createBackup(): void {
    try {
      const usersStr = localStorage.getItem('potok_users');
      if (usersStr) {
        // Проверяем, что данные валидны перед созданием резервной копии
        try {
          const users = JSON.parse(usersStr);
          if (Array.isArray(users) && users.length > 0) {
            localStorage.setItem('potok_users_backup', usersStr);
            // Также создаем дополнительную резервную копию с timestamp
            const timestamp = new Date().toISOString();
            localStorage.setItem(`potok_users_backup_${timestamp}`, usersStr);
            // Храним только последние 5 резервных копий
            this.cleanupOldBackups();
          }
        } catch (parseError) {
          console.warn('Не удалось создать резервную копию: данные повреждены', parseError);
        }
      }
    } catch (error) {
      console.error('Ошибка создания резервной копии:', error);
    }
  }

  // Очистить старые резервные копии, оставить только последние 5
  private cleanupOldBackups(): void {
    try {
      const backupKeys: string[] = [];
      for (let i = 0; i < localStorage.length; i++) {
        const key = localStorage.key(i);
        if (key && key.startsWith('potok_users_backup_') && key !== 'potok_users_backup') {
          backupKeys.push(key);
        }
      }
      
      // Сортируем по timestamp (в имени ключа)
      backupKeys.sort().reverse();
      
      // Удаляем все кроме последних 5
      if (backupKeys.length > 5) {
        for (let i = 5; i < backupKeys.length; i++) {
          localStorage.removeItem(backupKeys[i]);
        }
      }
    } catch (error) {
      console.error('Ошибка очистки старых резервных копий:', error);
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

