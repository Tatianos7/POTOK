export type NotificationCategory = 'support' | 'messages' | 'news';

export interface AppNotification {
  id: string;
  date: string;
  title: string;
  message: string;
  category: NotificationCategory;
  isRead: boolean;
  isArchived: boolean;
  isDeleted: boolean;
}

export interface NotificationMessage {
  id: string;
  text: string;
  isUser: boolean;
  date: string;
}

const STORAGE_PREFIX = 'notifications_';
const THREAD_PREFIX = 'notification_thread_';

const getStorageKey = (userId: string) => `${STORAGE_PREFIX}${userId}`;
const getThreadKey = (userId: string, notificationId: string) =>
  `${THREAD_PREFIX}${userId}_${notificationId}`;

const notifyChange = (userId: string) => {
  window.dispatchEvent(
    new CustomEvent('notifications-updated', {
      detail: { userId },
    })
  );
};

const getNotifications = (userId: string): AppNotification[] => {
  if (!userId || userId.trim() === '') {
    console.warn('Попытка получить уведомления без userId');
    return [];
  }
  
  // Дополнительная проверка: userId должен быть валидным
  if (userId === 'undefined' || userId === 'null') {
    console.warn('Некорректный userId для получения уведомлений:', userId);
    return [];
  }
  
  const key = getStorageKey(userId);
  const stored = localStorage.getItem(key);
  if (!stored) {
    // Не создаем моковые уведомления для новых пользователей
    // Уведомления будут создаваться только при реальных действиях (оплата, ответы поддержки и т.д.)
    return [];
  }
  try {
    const notifications = JSON.parse(stored);
    // Проверяем, что это массив
    if (!Array.isArray(notifications)) {
      console.error('Уведомления не являются массивом для userId:', userId);
      return [];
    }
    return notifications;
  } catch (error) {
    console.error('Ошибка парсинга уведомлений для userId:', userId, error);
    return [];
  }
};

const saveNotifications = (userId: string, notifications: AppNotification[]) => {
  const key = getStorageKey(userId);
  localStorage.setItem(key, JSON.stringify(notifications));
  notifyChange(userId);
};

const addNotification = (
  userId: string,
  notification: Omit<AppNotification, 'id' | 'date' | 'isRead' | 'isArchived' | 'isDeleted'>
) => {
  if (!userId || userId.trim() === '') {
    console.error('Не указан userId для уведомления');
    return;
  }
  
  // Дополнительная проверка: userId должен быть валидным
  if (userId === 'undefined' || userId === 'null') {
    console.error('Некорректный userId для уведомления:', userId);
    return;
  }
  
  const notifications = getNotifications(userId);
  const newNotification: AppNotification = {
    id: `notif_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
    date: new Date().toISOString(),
    isRead: false,
    isArchived: false,
    isDeleted: false,
    ...notification,
  };
  saveNotifications(userId, [newNotification, ...notifications]);
};

const seedThreadIfNeeded = (
  userId: string,
  notificationId: string,
  initialMessage: NotificationMessage
) => {
  const key = getThreadKey(userId, notificationId);
  const stored = localStorage.getItem(key);
  if (!stored) {
    localStorage.setItem(key, JSON.stringify([initialMessage]));
  }
};

const getThread = (userId: string, notificationId: string): NotificationMessage[] => {
  const key = getThreadKey(userId, notificationId);
  const stored = localStorage.getItem(key);
  if (!stored) {
    const message: NotificationMessage = {
      id: `msg_${Date.now()}`,
      text: 'Здравствуйте! Мы получили ваше сообщение и ответим в ближайшее время.',
      isUser: false,
      date: new Date().toISOString(),
    };
    localStorage.setItem(key, JSON.stringify([message]));
    return [message];
  }
  return JSON.parse(stored);
};

const addThreadMessage = (
  userId: string,
  notificationId: string,
  text: string,
  isUser: boolean
) => {
  const key = getThreadKey(userId, notificationId);
  const thread = getThread(userId, notificationId);
  const newMessage: NotificationMessage = {
    id: `msg_${Date.now()}_${Math.random()}`,
    text,
    isUser,
    date: new Date().toISOString(),
  };
  const updatedThread = [...thread, newMessage];
  localStorage.setItem(key, JSON.stringify(updatedThread));
};

export const notificationService = {
  getNotifications,
  saveNotifications,
  addNotification,
  getThread,
  addThreadMessage,
  seedThreadIfNeeded,
};


