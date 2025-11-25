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

const createMockNotifications = (): AppNotification[] => [
  {
    id: 'n1',
    date: new Date().toISOString(),
    title: 'Ответ на обращение',
    message: 'Мы ответили на вашу заявку в поддержку.',
    category: 'support',
    isRead: false,
    isArchived: false,
    isDeleted: false,
  },
  {
    id: 'n2',
    date: new Date(Date.now() - 86400000).toISOString(),
    title: 'Подписка продлена',
    message: 'Ваша подписка PREMIUM успешно продлена на месяц.',
    category: 'messages',
    isRead: true,
    isArchived: false,
    isDeleted: false,
  },
  {
    id: 'n5',
    date: new Date(Date.now() - 345600000).toISOString(),
    title: 'Подписка приобретена',
    message: 'Вы успешно приобрели подписку PREMIUM на год.',
    category: 'messages',
    isRead: true,
    isArchived: false,
    isDeleted: false,
  },
  {
    id: 'n6',
    date: new Date(Date.now() - 432000000).toISOString(),
    title: 'Оплата прошла',
    message: 'Оплата в размере 499 ₽ успешно обработана.',
    category: 'messages',
    isRead: false,
    isArchived: false,
    isDeleted: false,
  },
  {
    id: 'n3',
    date: new Date(Date.now() - 172800000).toISOString(),
    title: 'Новости ПОТОК',
    message: 'Добавлены новые тренировки в разделе PREMIUM.',
    category: 'news',
    isRead: true,
    isArchived: false,
    isDeleted: false,
  },
  {
    id: 'n4',
    date: new Date(Date.now() - 259200000).toISOString(),
    title: 'Акция на годовую подписку',
    message: 'Скидка 20% до конца месяца.',
    category: 'news',
    isRead: false,
    isArchived: false,
    isDeleted: false,
  },
];

const notifyChange = (userId: string) => {
  window.dispatchEvent(
    new CustomEvent('notifications-updated', {
      detail: { userId },
    })
  );
};

const getNotifications = (userId: string): AppNotification[] => {
  const key = getStorageKey(userId);
  const stored = localStorage.getItem(key);
  if (!stored) {
    const mock = createMockNotifications();
    localStorage.setItem(key, JSON.stringify(mock));
    return mock;
  }
  return JSON.parse(stored);
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
  const notifications = getNotifications(userId);
  const newNotification: AppNotification = {
    id: `notif_${Date.now()}_${Math.random()}`,
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


