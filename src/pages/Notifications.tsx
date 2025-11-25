import { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Trash2, Check, RotateCcw } from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { AppNotification, notificationService, NotificationCategory } from '../services/notificationService';
import NotificationThreadModal from '../components/NotificationThreadModal';
import NotificationDetailsModal from '../components/NotificationDetailsModal';

const tabs: { id: NotificationCategory; label: string }[] = [
  { id: 'support', label: 'ПОДДЕРЖКА' },
  { id: 'messages', label: 'СООБЩЕНИЯ' },
  { id: 'news', label: 'НОВОСТИ' },
];

type ViewFilter = 'inbox' | 'trash';

const Notifications = () => {
  const navigate = useNavigate();
  const { user } = useAuth();
  const [activeTab, setActiveTab] = useState<NotificationCategory>('support');
  const [view, setView] = useState<ViewFilter>('inbox');
  const [notifications, setNotifications] = useState<AppNotification[]>([]);
  const [selectedNotification, setSelectedNotification] = useState<AppNotification | null>(null);
  const [isThreadOpen, setIsThreadOpen] = useState(false);
  const [selectedNews, setSelectedNews] = useState<AppNotification | null>(null);
  const [isNewsModalOpen, setIsNewsModalOpen] = useState(false);

  const loadNotifications = () => {
    if (!user?.id) return;
    const data = notificationService.getNotifications(user.id);
    data
      .filter((item) => item.category === 'support')
      .forEach((item) => {
        notificationService.seedThreadIfNeeded(user.id!, item.id, {
          id: `msg_seed_${item.id}`,
          text: item.message,
          isUser: false,
          date: item.date,
        });
      });
    setNotifications(data);
  };

  useEffect(() => {
    if (!user) {
      navigate('/login');
      return;
    }
    loadNotifications();
  }, [user, navigate]);

  const filteredNotifications = useMemo(() => {
    return notifications.filter((item) => {
      const matchesCategory =
        item.category === activeTab ||
        (activeTab === 'messages' && item.category !== 'support' && item.category !== 'news');

      if (!matchesCategory) return false;

      if (view === 'trash') {
        return item.isDeleted;
      }

      return !item.isDeleted;
    });
  }, [notifications, activeTab, view]);

  const saveNotifications = (items: AppNotification[]) => {
    if (!user?.id) return;
    notificationService.saveNotifications(user.id, items);
    setNotifications(items);
  };

  const toggleRead = (id: string) => {
    const updated = notifications.map((item) =>
      item.id === id ? { ...item, isRead: !item.isRead } : item
    );
    saveNotifications(updated);
  };

  const moveToTrash = (id: string) => {
    const updated = notifications.map((item) =>
      item.id === id ? { ...item, isDeleted: true, isArchived: false } : item
    );
    saveNotifications(updated);
  };

  const restoreNotification = (id: string) => {
    const updated = notifications.map((item) =>
      item.id === id ? { ...item, isDeleted: false } : item
    );
    saveNotifications(updated);
    setView('inbox');
  };

  const formatDate = (value: string) =>
    new Date(value).toLocaleDateString('ru-RU', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
    });

  const handleClose = () => {
    navigate('/');
  };

  return (
    <>
      <div className="min-h-screen bg-white dark:bg-gray-900" style={{ minWidth: '360px' }}>
        <div className="max-w-[1024px] mx-auto">
        {/* Header */}
        <header className="px-4 py-4 flex items-center justify-between border-b border-gray-200 dark:border-gray-800">
          <div className="flex-1"></div>
          <h1 className="text-lg font-semibold text-gray-900 dark:text-white flex-1 text-center uppercase">
            уведомления
          </h1>
          <div className="flex-1 flex justify-end">
            <button
              onClick={handleClose}
              className="p-2 hover:bg-gray-100 dark:hover:bg-gray-800 rounded-lg transition-colors"
              aria-label="Закрыть"
            >
              <svg className="w-6 h-6 text-gray-700 dark:text-gray-300" viewBox="0 0 24 24">
                <path
                  stroke="currentColor"
                  strokeWidth="2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  d="M18 6L6 18M6 6l12 12"
                />
              </svg>
            </button>
          </div>
        </header>

        <main className="px-4 py-6 space-y-6">
          {/* Tabs */}
          <div className="flex gap-2">
            {tabs.map((tab) => (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={`flex-1 py-3 rounded-2xl font-semibold text-sm uppercase transition-colors border ${
                  activeTab === tab.id
                    ? 'bg-gray-900 text-white border-gray-900'
                    : 'bg-white text-gray-900 border-gray-200'
                }`}
              >
                {tab.label}
              </button>
            ))}
          </div>

          {/* Notification List */}
          <div className="space-y-4">
            {filteredNotifications.length === 0 ? (
              <p className="text-center text-sm text-gray-500 dark:text-gray-400">
                Нет уведомлений в этой категории
              </p>
            ) : (
              filteredNotifications.map((notification) => (
                <div key={notification.id} className="space-y-2">
                  <div className="flex items-start justify-between">
                    <div className="flex items-start gap-3 flex-1">
                      <button
                        onClick={() => toggleRead(notification.id)}
                        className="mt-1"
                        aria-label={notification.isRead ? 'Сделать непрочитанным' : 'Пометить прочитанным'}
                      >
                        {notification.isRead ? (
                          <Check className="w-4 h-4 text-green-500" />
                        ) : (
                          <span className="w-3 h-3 rounded-full bg-red-500 block"></span>
                        )}
                      </button>
                      {notification.category === 'support' ? (
                        <button
                          className="text-left flex-1"
                          onClick={() => {
                            if (!notification.isRead) {
                              toggleRead(notification.id);
                            }
                            setSelectedNotification(notification);
                            setIsThreadOpen(true);
                          }}
                        >
                          <p className="text-xs text-gray-500 dark:text-gray-400">
                            {formatDate(notification.date)}
                          </p>
                          <p className="text-sm font-semibold text-gray-900 dark:text-white">
                            {notification.title}
                          </p>
                          <p className="text-sm text-gray-700 dark:text-gray-300">{notification.message}</p>
                        </button>
                      ) : notification.category === 'news' ? (
                        <button
                          className="text-left flex-1"
                          onClick={() => {
                            if (!notification.isRead) {
                              toggleRead(notification.id);
                            }
                            setSelectedNews(notification);
                            setIsNewsModalOpen(true);
                          }}
                        >
                          <p className="text-xs text-gray-500 dark:text-gray-400">
                            {formatDate(notification.date)}
                          </p>
                          <p className="text-sm font-semibold text-gray-900 dark:text-white">
                            {notification.title}
                          </p>
                          <p className="text-sm text-gray-700 dark:text-gray-300 line-clamp-2">
                            {notification.message}
                          </p>
                        </button>
                      ) : (
                        <div className="text-left flex-1">
                          <p className="text-xs text-gray-500 dark:text-gray-400">
                            {formatDate(notification.date)}
                          </p>
                          <p className="text-sm font-semibold text-gray-900 dark:text-white">
                            {notification.title}
                          </p>
                          <p className="text-sm text-gray-700 dark:text-gray-300">{notification.message}</p>
                        </div>
                      )}
                    </div>
                    {view === 'trash' ? (
                      <button
                        onClick={() => restoreNotification(notification.id)}
                        className="p-1 text-gray-400 hover:text-gray-600 transition-colors"
                        aria-label="Вернуть"
                      >
                        <RotateCcw className="w-4 h-4" />
                      </button>
                    ) : (
                      <button
                        onClick={() => moveToTrash(notification.id)}
                        className="p-1 text-gray-400 hover:text-gray-600 transition-colors"
                        aria-label="Удалить"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    )}
                  </div>
                  <div className="border-b border-gray-200 dark:border-gray-700"></div>
                </div>
              ))
            )}
          </div>

          {/* Bottom Controls */}
          <div className="flex justify-end text-sm font-semibold text-gray-400 uppercase">
            <button
              onClick={() => setView((prev) => (prev === 'trash' ? 'inbox' : 'trash'))}
              className={`px-4 ${view === 'trash' ? 'text-gray-900 dark:text-white' : ''}`}
            >
              корзина
            </button>
          </div>
        </main>
        </div>
      </div>

      <NotificationThreadModal
        isOpen={isThreadOpen}
        notificationId={selectedNotification?.id || null}
        notificationTitle={selectedNotification?.title || ''}
        onClose={() => setIsThreadOpen(false)}
      />
      <NotificationDetailsModal
        isOpen={isNewsModalOpen}
        title={selectedNews?.title || ''}
        date={selectedNews?.date || ''}
        message={selectedNews?.message || ''}
        onClose={() => setIsNewsModalOpen(false)}
      />
    </>
  );
};

export default Notifications;

