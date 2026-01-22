import { User } from '../types';
import { supabase } from '../lib/supabaseClient';

const ONLINE_THRESHOLD = 5 * 60 * 1000; // 5 минут в миллисекундах

interface UserActivity {
  userId: string;
  lastActivity: number; // timestamp
}

class ActivityService {
  private activities: UserActivity[] = [];
  // Обновить активность пользователя
  async updateActivity(userId: string): Promise<void> {
    let sessionUserId = userId;
    if (supabase) {
      const { data, error } = await supabase.auth.getUser();
      if (!error && data?.user?.id) {
        if (userId && userId !== data.user.id) {
          console.warn('[activityService] Передан userId не совпадает с сессией');
        }
        sessionUserId = data.user.id;
      }
    }

    const activities = this.getAllActivities();
    const existingIndex = activities.findIndex(a => a.userId === sessionUserId);
    
    const activity: UserActivity = {
      userId: sessionUserId,
      lastActivity: Date.now(),
    };

    if (existingIndex !== -1) {
      activities[existingIndex] = activity;
    } else {
      activities.push(activity);
    }

    // Отправляем событие для обновления админ-панели
    window.dispatchEvent(new Event('user-activity-changed'));
    
    // Отправляем событие об изменении активности
    window.dispatchEvent(new Event('user-activity-changed'));
  }

  // Получить все активности
  private getAllActivities(): UserActivity[] {
    return this.activities;
  }

  // Проверить, онлайн ли пользователь
  isUserOnline(userId: string): boolean {
    const activities = this.getAllActivities();
    const activity = activities.find(a => a.userId === userId);
    
    if (!activity) return false;

    const timeSinceLastActivity = Date.now() - activity.lastActivity;
    return timeSinceLastActivity < ONLINE_THRESHOLD;
  }

  // Получить количество онлайн пользователей
  getOnlineUsersCount(allUsers: User[]): number {
    const activities = this.getAllActivities();
    const now = Date.now();

    return allUsers.filter(user => {
      const activity = activities.find(a => a.userId === user.id);
      if (!activity) return false;
      
      const timeSinceLastActivity = now - activity.lastActivity;
      return timeSinceLastActivity < ONLINE_THRESHOLD;
    }).length;
  }

  // Получить список онлайн пользователей
  getOnlineUsers(allUsers: User[]): User[] {
    const activities = this.getAllActivities();
    const now = Date.now();

    return allUsers.filter(user => {
      const activity = activities.find(a => a.userId === user.id);
      if (!activity) return false;
      
      const timeSinceLastActivity = now - activity.lastActivity;
      return timeSinceLastActivity < ONLINE_THRESHOLD;
    });
  }

  // Очистить старые активности (оптимизация)
  cleanupOldActivities(): void {
    const activities = this.getAllActivities();
    const now = Date.now();
    const cleaned = activities.filter(
      a => now - a.lastActivity < ONLINE_THRESHOLD * 2 // Храним активности в 2 раза дольше порога
    );
    this.activities = cleaned;
  }
}

export const activityService = new ActivityService();

