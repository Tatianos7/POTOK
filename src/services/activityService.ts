import { User } from '../types';

const ACTIVITY_KEY = 'potok_user_activity';
const ONLINE_THRESHOLD = 5 * 60 * 1000; // 5 минут в миллисекундах

interface UserActivity {
  userId: string;
  lastActivity: number; // timestamp
}

class ActivityService {
  // Обновить активность пользователя
  updateActivity(userId: string): void {
    const activities = this.getAllActivities();
    const existingIndex = activities.findIndex(a => a.userId === userId);
    
    const activity: UserActivity = {
      userId,
      lastActivity: Date.now(),
    };

    if (existingIndex !== -1) {
      activities[existingIndex] = activity;
    } else {
      activities.push(activity);
    }

    localStorage.setItem(ACTIVITY_KEY, JSON.stringify(activities));
    
    // Отправляем событие для обновления админ-панели
    window.dispatchEvent(new Event('user-activity-changed'));
    
    // Отправляем событие об изменении активности
    window.dispatchEvent(new Event('user-activity-changed'));
  }

  // Получить все активности
  private getAllActivities(): UserActivity[] {
    const activitiesStr = localStorage.getItem(ACTIVITY_KEY);
    if (!activitiesStr) return [];

    try {
      return JSON.parse(activitiesStr);
    } catch {
      return [];
    }
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
    localStorage.setItem(ACTIVITY_KEY, JSON.stringify(cleaned));
  }
}

export const activityService = new ActivityService();

