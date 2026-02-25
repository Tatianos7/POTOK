import { useState, useEffect } from 'react';
import { Navigate, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { supportService } from '../services/supportService';
import { activityService } from '../services/activityService';
import { notificationService, type AppNotification } from '../services/notificationService';
import { SupportMessage, User } from '../types';
import { X, MessageSquare, Users, UserCheck, UserX, Mail, CheckCircle, Clock, AlertCircle, Shield, ShieldOff, Wifi } from 'lucide-react';
import FoodIngestionPanel from '../components/FoodIngestionPanel';

const AdminPanel = () => {
  const { user, authStatus, logout, getAllUsers, setAdminStatus } = useAuth();
  const navigate = useNavigate();
  const [messages, setMessages] = useState<SupportMessage[]>([]);
  const [selectedUserId, setSelectedUserId] = useState<string | null>(null);
  const [responseText, setResponseText] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [usersStats, setUsersStats] = useState({ total: 0, withPremium: 0, withoutPremium: 0, online: 0 });
  const [messagesStats, setMessagesStats] = useState({ total: 0, new: 0, inProgress: 0, resolved: 0 });
  const [allUsers, setAllUsers] = useState<User[]>([]);
  const [activeTab, setActiveTab] = useState<'stats' | 'messages' | 'users' | 'imports'>('stats');
  const [isResponding, setIsResponding] = useState(false);
  
  // Группируем сообщения по userId
  const messagesByUser = messages.reduce((acc, message) => {
    if (!acc[message.userId]) {
      acc[message.userId] = [];
    }
    acc[message.userId].push(message);
    return acc;
  }, {} as Record<string, SupportMessage[]>);
  
  // Получаем все сообщения выбранного пользователя в хронологическом порядке
  const selectedUserMessages = selectedUserId ? messagesByUser[selectedUserId] || [] : [];
  const allUserMessages = selectedUserMessages.flatMap(msg => {
    const responses = (msg.responses || []).map(r => ({
      id: r.id,
      text: r.text,
      fromAdmin: r.fromAdmin,
      createdAt: r.createdAt,
      messageId: msg.id,
    }));
    return [
      { ...msg, isOriginal: true },
      ...responses,
    ];
  }).sort((a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime());
  
  // Получаем информацию о выбранном пользователе
  const selectedUserInfo = selectedUserId && selectedUserMessages.length > 0 
    ? {
        userName: selectedUserMessages[0].userName,
        userEmail: selectedUserMessages[0].userEmail,
        userPhone: selectedUserMessages[0].userPhone,
      }
    : null;

  useEffect(() => {
    if (authStatus !== 'authenticated' || !user?.isAdmin) {
      return;
    }
    loadData();

    // Обновляем данные каждые 10 секунд для актуальной статистики
    const interval = setInterval(() => {
      loadData({ silent: true });
    }, 10000);

    // Слушаем изменения в localStorage для обновления в реальном времени
    const handleStorageChange = (e: StorageEvent) => {
      // Если изменились пользователи или сообщения, обновляем данные
      if (e.key === 'potok_users' || e.key === 'potok_support_messages' || e.key === 'potok_user_activity') {
        loadData({ silent: true });
      }
    };

    window.addEventListener('storage', handleStorageChange);

    // Также слушаем кастомные события для обновления в текущей вкладке
    const handleCustomStorageChange = () => {
      loadData({ silent: true });
    };

    window.addEventListener('user-data-changed', handleCustomStorageChange);
    window.addEventListener('support-message-changed', handleCustomStorageChange);
    window.addEventListener('user-activity-changed', handleCustomStorageChange);

    return () => {
      clearInterval(interval);
      window.removeEventListener('storage', handleStorageChange);
      window.removeEventListener('user-data-changed', handleCustomStorageChange);
      window.removeEventListener('support-message-changed', handleCustomStorageChange);
      window.removeEventListener('user-activity-changed', handleCustomStorageChange);
    };
  }, [authStatus, user?.isAdmin]);

  const loadData = async (options?: { silent?: boolean }): Promise<{ messages: SupportMessage[] } | null> => {
    const silent = options?.silent ?? false;
    if (!silent) {
      setIsLoading(true);
    }
    try {
      const [messagesData, usersStatsData, messagesStatsData, usersData] = await Promise.all([
        supportService.getAllMessages(),
        Promise.resolve(supportService.getUsersStats()),
        supportService.getMessagesStats(),
        getAllUsers(),
      ]);
      
      // Обновляем активность текущего админа
      if (user?.id) {
        activityService.updateActivity(user.id);
      }
      
      // Получаем количество онлайн пользователей
      const onlineCount = activityService.getOnlineUsersCount(usersData);
      
      setMessages(messagesData);
      setUsersStats({ ...usersStatsData, online: onlineCount });
      setMessagesStats(messagesStatsData);
      setAllUsers(usersData);
      
      // Очищаем старые активности
      activityService.cleanupOldActivities();
      return { messages: messagesData };
    } catch (error) {
      console.error('Ошибка загрузки данных:', error);
      return null;
    } finally {
      if (!silent) {
        setIsLoading(false);
      }
    }
  };

  const handleToggleAdmin = async (userId: string, currentStatus: boolean) => {
    if (!confirm(`Вы уверены, что хотите ${currentStatus ? 'снять' : 'назначить'} права администратора?`)) {
      return;
    }

    setIsLoading(true);
    try {
      await setAdminStatus(userId, !currentStatus);
      await loadData();
    } catch (error) {
      console.error('Ошибка изменения статуса администратора:', error);
      alert('Не удалось изменить статус администратора');
    } finally {
      setIsLoading(false);
    }
  };

  const handleSendResponse = async () => {
    if (!selectedUserId || !responseText.trim() || selectedUserMessages.length === 0) return;

    setIsResponding(true);
    try {
      // Проверяем валидность userId перед отправкой
      if (!selectedUserId || selectedUserId.trim() === '') {
        console.error('Некорректный userId для отправки ответа:', selectedUserId);
        alert('Ошибка: не удалось определить пользователя для отправки ответа');
        setIsResponding(false);
        return;
      }

      // Находим последнее сообщение пользователя для ответа
      const lastMessage = selectedUserMessages[selectedUserMessages.length - 1];
      
      // Отправляем ответ на последнее сообщение пользователя
      await supportService.addResponse(lastMessage.id, true, responseText.trim());
      
      // Создаем уведомление для пользователя, которому адресован ответ
      try {
        // Ищем существующее уведомление поддержки для этого пользователя
        const userNotifications = await notificationService.getNotifications(selectedUserId);
        const existingSupportNotification = userNotifications.find(
          (n: AppNotification) => n.category === 'support' && !n.isDeleted
        );
        
        let notificationId: string;
        
        if (existingSupportNotification) {
          // Используем существующее уведомление
          notificationId = existingSupportNotification.id;
          
          // ВСЕГДА помечаем уведомление как непрочитанное при получении нового ответа от админа
          // Это гарантирует, что пользователь увидит красный индикатор
          const updatedNotifications = userNotifications.map((n: AppNotification) =>
            n.id === notificationId ? { ...n, isRead: false } : n
          );
          await notificationService.saveNotifications(selectedUserId, updatedNotifications);
        } else {
          // Создаем новое уведомление только если его еще нет
          const newNotification = await notificationService.addNotification(selectedUserId, {
            title: 'Ответ на обращение',
            message: 'Мы ответили на вашу заявку в поддержку.',
            category: 'support',
          });
          
          if (!newNotification || !newNotification.id) {
            throw new Error('Не удалось создать уведомление');
          }
          
          notificationId = newNotification.id;
        }
        
        // Добавляем ответ админа в тред уведомления
        notificationService.addThreadMessage(
          selectedUserId,
          notificationId,
          responseText.trim(),
          false // false = от поддержки (не от пользователя)
        );
        
        // Отправляем событие обновления уведомлений для обновления индикатора
        window.dispatchEvent(
          new CustomEvent('notifications-updated', {
            detail: { userId: selectedUserId },
          })
        );
      } catch (notifError) {
        console.error('Ошибка создания уведомления:', notifError);
        // Продолжаем выполнение, даже если уведомление не создалось
      }
      
      // Очищаем поле ввода
      setResponseText('');
      
      // Обновляем данные без блокировки UI
      try {
        const messagesData = await supportService.getAllMessages();
        // Обновляем список сообщений
        setMessages(messagesData);
      } catch (loadError) {
        console.error('Ошибка обновления данных:', loadError);
        // Продолжаем выполнение, данные обновятся при следующей загрузке
      }
    } catch (error) {
      console.error('Ошибка отправки ответа:', error);
      alert('Не удалось отправить ответ. Попробуйте еще раз.');
    } finally {
      setIsResponding(false);
    }
  };

  const handleStatusChange = async (messageId: string, status: SupportMessage['status']) => {
    setIsLoading(true);
    try {
      await supportService.updateMessageStatus(messageId, status);
      await loadData({ silent: true });
    } catch (error) {
      console.error('Ошибка обновления статуса:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const getStatusBadge = (status: SupportMessage['status']) => {
    const styles = {
      new: 'bg-red-100 text-red-800 border-red-200',
      in_progress: 'bg-yellow-100 text-yellow-800 border-yellow-200',
      resolved: 'bg-green-100 text-green-800 border-green-200',
    };

    const labels = {
      new: 'Новое',
      in_progress: 'В работе',
      resolved: 'Решено',
    };

    return (
      <span className={`px-1.5 py-0.5 rounded text-xs font-semibold border ${styles[status]}`}>
        {labels[status]}
      </span>
    );
  };

  if (authStatus === 'booting') {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-gray-500">Загрузка...</div>
      </div>
    );
  }

  if (authStatus === 'authenticated' && !user?.isAdmin) {
    return <Navigate to="/" replace />;
  }

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900" style={{ minWidth: '320px' }}>
      <div className="max-w-[768px] mx-auto">
        {/* Header */}
        <header className="bg-white dark:bg-gray-800 border-b border-gray-200 dark:border-gray-700 px-3 py-3 flex items-center justify-between">
          <h1 className="text-base font-bold text-gray-900 dark:text-white">Админ-панель</h1>
          <div className="flex items-center gap-1.5">
            <button
              onClick={() => loadData()}
              disabled={isLoading}
              className="px-2.5 py-1.5 text-xs bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
              title="Обновить данные"
            >
              {isLoading ? '...' : 'Обновить'}
            </button>
            <button
              onClick={() => {
                logout();
                navigate('/login');
              }}
              className="px-2.5 py-1.5 text-xs bg-red-600 text-white rounded-lg hover:bg-red-700 transition-colors"
            >
              Выйти
            </button>
          </div>
        </header>

        {/* Tabs */}
        <div className="bg-white dark:bg-gray-800 border-b border-gray-200 dark:border-gray-700 px-3 overflow-x-auto">
          <div className="flex gap-1 min-w-max">
            <button
              onClick={() => setActiveTab('stats')}
              className={`px-3 py-2 text-sm font-medium transition-colors whitespace-nowrap ${
                activeTab === 'stats'
                  ? 'text-blue-600 border-b-2 border-blue-600'
                  : 'text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white'
              }`}
            >
              Статистика
            </button>
            <button
              onClick={() => setActiveTab('messages')}
              className={`px-3 py-2 text-sm font-medium transition-colors whitespace-nowrap ${
                activeTab === 'messages'
                  ? 'text-blue-600 border-b-2 border-blue-600'
                  : 'text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white'
              }`}
            >
              Сообщения
            </button>
            <button
              onClick={() => setActiveTab('users')}
              className={`px-3 py-2 text-sm font-medium transition-colors whitespace-nowrap ${
                activeTab === 'users'
                  ? 'text-blue-600 border-b-2 border-blue-600'
                  : 'text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white'
              }`}
            >
              Пользователи
            </button>
            <button
              onClick={() => setActiveTab('imports')}
              className={`px-3 py-2 text-sm font-medium transition-colors whitespace-nowrap ${
                activeTab === 'imports'
                  ? 'text-blue-600 border-b-2 border-blue-600'
                  : 'text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white'
              }`}
            >
              Импорт
            </button>
          </div>
        </div>

        {isLoading && (
          <div className="px-3 py-2 bg-blue-50 dark:bg-blue-900 text-blue-800 dark:text-blue-200 text-center text-sm">
            Загрузка...
          </div>
        )}

        {/* Content */}
        <div className="px-3 py-4">
          {activeTab === 'stats' && (
            <>
              <h2 className="text-base font-semibold text-gray-900 dark:text-white mb-3">Статистика</h2>
          
          {/* Users Stats */}
          <div className="grid grid-cols-2 gap-2.5 mb-4">
            <div className="bg-white dark:bg-gray-800 rounded-lg p-3 border border-gray-200 dark:border-gray-700">
              <div className="flex items-center gap-1.5 mb-1.5">
                <Users className="w-4 h-4 text-gray-600 dark:text-gray-400" />
                <span className="text-xs text-gray-600 dark:text-gray-400">Всего</span>
              </div>
              <p className="text-xl font-bold text-gray-900 dark:text-white">{usersStats.total}</p>
            </div>
            <div className="bg-white dark:bg-gray-800 rounded-lg p-3 border border-gray-200 dark:border-gray-700">
              <div className="flex items-center gap-1.5 mb-1.5">
                <Wifi className="w-4 h-4 text-blue-600" />
                <span className="text-xs text-gray-600 dark:text-gray-400">Онлайн</span>
              </div>
              <p className="text-xl font-bold text-blue-600">{usersStats.online}</p>
            </div>
            <div className="bg-white dark:bg-gray-800 rounded-lg p-3 border border-gray-200 dark:border-gray-700">
              <div className="flex items-center gap-1.5 mb-1.5">
                <UserCheck className="w-4 h-4 text-green-600" />
                <span className="text-xs text-gray-600 dark:text-gray-400">Premium</span>
              </div>
              <p className="text-xl font-bold text-green-600">{usersStats.withPremium}</p>
            </div>
            <div className="bg-white dark:bg-gray-800 rounded-lg p-3 border border-gray-200 dark:border-gray-700">
              <div className="flex items-center gap-1.5 mb-1.5">
                <UserX className="w-4 h-4 text-gray-600 dark:text-gray-400" />
                <span className="text-xs text-gray-600 dark:text-gray-400">Без подписки</span>
              </div>
              <p className="text-xl font-bold text-gray-900 dark:text-white">{usersStats.withoutPremium}</p>
            </div>
          </div>

          {/* Messages Stats */}
          <div className="grid grid-cols-2 gap-2.5 mb-4">
            <div className="bg-white dark:bg-gray-800 rounded-lg p-3 border border-gray-200 dark:border-gray-700">
              <div className="flex items-center gap-1.5 mb-1.5">
                <Mail className="w-4 h-4 text-gray-600 dark:text-gray-400" />
                <span className="text-xs text-gray-600 dark:text-gray-400">Всего</span>
              </div>
              <p className="text-xl font-bold text-gray-900 dark:text-white">{messagesStats.total}</p>
            </div>
            <div className="bg-white dark:bg-gray-800 rounded-lg p-3 border border-gray-200 dark:border-gray-700">
              <div className="flex items-center gap-1.5 mb-1.5">
                <AlertCircle className="w-4 h-4 text-red-600" />
                <span className="text-xs text-gray-600 dark:text-gray-400">Новых</span>
              </div>
              <p className="text-xl font-bold text-red-600">{messagesStats.new}</p>
            </div>
            <div className="bg-white dark:bg-gray-800 rounded-lg p-3 border border-gray-200 dark:border-gray-700">
              <div className="flex items-center gap-1.5 mb-1.5">
                <Clock className="w-4 h-4 text-yellow-600" />
                <span className="text-xs text-gray-600 dark:text-gray-400">В работе</span>
              </div>
              <p className="text-xl font-bold text-yellow-600">{messagesStats.inProgress}</p>
            </div>
            <div className="bg-white dark:bg-gray-800 rounded-lg p-3 border border-gray-200 dark:border-gray-700">
              <div className="flex items-center gap-1.5 mb-1.5">
                <CheckCircle className="w-4 h-4 text-green-600" />
                <span className="text-xs text-gray-600 dark:text-gray-400">Решено</span>
              </div>
              <p className="text-xl font-bold text-green-600">{messagesStats.resolved}</p>
            </div>
          </div>

          </>
          )}

          {activeTab === 'messages' && (
            <>
              <h2 className="text-base font-semibold text-gray-900 dark:text-white mb-3">Сообщения от пользователей</h2>
              <div className="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700">
                <div className="divide-y divide-gray-200 dark:divide-gray-700">
                  {Object.keys(messagesByUser).length === 0 ? (
                    <div className="p-6 text-center text-sm text-gray-500 dark:text-gray-400">
                      Нет сообщений
                    </div>
                  ) : (
                    Object.entries(messagesByUser).map(([userId, userMessages]) => {
                      const user = allUsers.find(u => u.id === userId);
                      const userName = userMessages[0]?.userName || user?.profile?.firstName || user?.name || 'Пользователь';
                      const unreadCount = userMessages.filter(m => m.status === 'new').length;
                      const lastMessage = userMessages.sort((a, b) => 
                        new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
                      )[0];
                      const totalMessages = userMessages.length;
                      const totalResponses = userMessages.reduce((sum, m) => sum + (m.responses?.length || 0), 0);
                      
                      return (
                        <div
                          key={userId}
                          className={`p-3 cursor-pointer hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors ${
                            selectedUserId === userId ? 'bg-blue-50 dark:bg-blue-900' : ''
                          }`}
                          onClick={() => setSelectedUserId(userId)}
                        >
                          <div className="flex items-start justify-between gap-2">
                            <div className="flex-1 min-w-0">
                              <div className="flex items-center gap-1.5 mb-1 flex-wrap">
                                <span className="text-sm font-semibold text-gray-900 dark:text-white">
                                  {userName}
                                </span>
                                {unreadCount > 0 && (
                                  <span className="px-1.5 py-0.5 rounded-full text-xs font-semibold bg-red-100 text-red-800 border border-red-200">
                                    {unreadCount} новых
                                  </span>
                                )}
                                {getStatusBadge(lastMessage.status)}
                              </div>
                              <p className="text-xs text-gray-600 dark:text-gray-400 mb-1">
                                Сообщений: {totalMessages} | Ответов: {totalResponses}
                              </p>
                              <p className="text-xs text-gray-500 dark:text-gray-400 line-clamp-1">
                                Последнее: {lastMessage.subject || lastMessage.message.substring(0, 50)}
                              </p>
                              <div className="flex flex-col gap-0.5 text-xs text-gray-500 dark:text-gray-400 mt-1">
                                <span>{new Date(lastMessage.createdAt).toLocaleString('ru-RU')}</span>
                                {lastMessage.userEmail && <span className="truncate">{lastMessage.userEmail}</span>}
                                {lastMessage.userPhone && <span>{lastMessage.userPhone}</span>}
                              </div>
                            </div>
                            <div className="flex flex-col items-end gap-1 flex-shrink-0">
                              <MessageSquare className="w-4 h-4 text-gray-400" />
                            </div>
                          </div>
                        </div>
                      );
                    })
                  )}
                </div>
              </div>
            </>
          )}

          {activeTab === 'users' && (
            <>
              <h2 className="text-base font-semibold text-gray-900 dark:text-white mb-3">Управление пользователями</h2>
              <div className="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700">
                <div className="p-3 border-b border-gray-200 dark:border-gray-700">
                  <h3 className="text-sm font-semibold text-gray-900 dark:text-white">
                    Всего: {allUsers.length}
                  </h3>
                </div>
                <div className="divide-y divide-gray-200 dark:divide-gray-700">
                  {allUsers.length === 0 ? (
                    <div className="p-6 text-center text-sm text-gray-500 dark:text-gray-400">
                      Нет пользователей
                    </div>
                  ) : (
                    allUsers.map((u) => (
                      <div
                        key={u.id}
                        className="p-3 hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors"
                      >
                        <div className="flex items-start justify-between gap-2">
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-1.5 mb-1 flex-wrap">
                              <span className="text-sm font-semibold text-gray-900 dark:text-white">
                                {u.profile?.firstName || u.name}
                                {u.profile?.lastName && ` ${u.profile.lastName}`}
                              </span>
                              {u.isAdmin && (
                                <span className="px-1.5 py-0.5 rounded text-xs font-semibold bg-purple-100 text-purple-800 border border-purple-200">
                                  АДМИН
                                </span>
                              )}
                              {u.hasPremium && (
                                <span className="px-1.5 py-0.5 rounded text-xs font-semibold bg-green-100 text-green-800 border border-green-200">
                                  PREMIUM
                                </span>
                              )}
                              {activityService.isUserOnline(u.id) && (
                                <span className="px-1.5 py-0.5 rounded text-xs font-semibold bg-blue-100 text-blue-800 border border-blue-200 flex items-center gap-1">
                                  <span className="w-1.5 h-1.5 bg-blue-600 rounded-full animate-pulse"></span>
                                  ОНЛАЙН
                                </span>
                              )}
                            </div>
                            <div className="text-xs text-gray-600 dark:text-gray-400 space-y-0.5">
                              {u.profile?.email || u.email ? (
                                <p className="truncate">{u.profile?.email || u.email}</p>
                              ) : null}
                              {u.profile?.phone || u.phone ? (
                                <p>{u.profile?.phone || u.phone}</p>
                              ) : null}
                              <p className="text-xs">
                                {new Date(u.createdAt).toLocaleDateString('ru-RU')}
                              </p>
                            </div>
                          </div>
                          <div className="flex items-center gap-1.5 flex-shrink-0">
                            <button
                              onClick={() => handleToggleAdmin(u.id, !!u.isAdmin)}
                              disabled={isLoading || u.id === user?.id}
                              className={`p-1.5 rounded-lg transition-colors ${
                                u.isAdmin
                                  ? 'bg-red-100 text-red-700 hover:bg-red-200 dark:bg-red-900 dark:text-red-300'
                                  : 'bg-green-100 text-green-700 hover:bg-green-200 dark:bg-green-900 dark:text-green-300'
                              } disabled:opacity-50 disabled:cursor-not-allowed`}
                              title={u.isAdmin ? 'Снять права администратора' : 'Назначить администратором'}
                            >
                              {u.isAdmin ? (
                                <ShieldOff className="w-4 h-4" />
                              ) : (
                                <Shield className="w-4 h-4" />
                              )}
                            </button>
                          </div>
                        </div>
                      </div>
                    ))
                  )}
                </div>
              </div>
            </>
          )}
          {activeTab === 'imports' && (
            <>
              <h2 className="text-base font-semibold text-gray-900 dark:text-white mb-3">Импорт базы продуктов</h2>
              <FoodIngestionPanel />
            </>
          )}
        </div>

        {/* Chat Modal */}
        {selectedUserId && selectedUserInfo && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-50 p-3">
            <div className="bg-white dark:bg-gray-800 rounded-lg w-full max-w-2xl max-h-[95vh] overflow-hidden flex flex-col">
              <div className="p-3 border-b border-gray-200 dark:border-gray-700 flex items-center justify-between">
                <div className="flex-1 min-w-0">
                  <h3 className="text-sm font-semibold text-gray-900 dark:text-white truncate">
                    {selectedUserInfo.userName}
                  </h3>
                  <div className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">
                    {selectedUserInfo.userEmail && <div className="truncate">{selectedUserInfo.userEmail}</div>}
                    {selectedUserInfo.userPhone && <div>{selectedUserInfo.userPhone}</div>}
                    <div>ID: {selectedUserId.substring(0, 8)}...</div>
                  </div>
                </div>
                <button
                  onClick={() => {
                    setSelectedUserId(null);
                    setResponseText('');
                  }}
                  className="p-1.5 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg transition-colors flex-shrink-0 ml-2"
                >
                  <X className="w-4 h-4 text-gray-500" />
                </button>
              </div>

              <div className="flex-1 overflow-y-auto p-3 space-y-3 bg-gray-50 dark:bg-gray-900">
                {/* All Messages in Chronological Order */}
                {allUserMessages.map((item) => {
                  if ('isOriginal' in item) {
                    // Это оригинальное сообщение пользователя
                    const msg = item as SupportMessage;
                    return (
                      <div key={msg.id} className="flex justify-start">
                        <div className="bg-white dark:bg-gray-800 rounded-lg p-3 max-w-[85%] border border-gray-200 dark:border-gray-700">
                          <div className="flex items-center justify-between mb-2 flex-wrap gap-1.5">
                            <div className="flex items-center gap-1.5 flex-wrap">
                              <span className="text-xs font-semibold text-gray-900 dark:text-white">
                                {msg.userName}
                              </span>
                              {getStatusBadge(msg.status)}
                            </div>
                            <span className="text-xs text-gray-500 dark:text-gray-400">
                              {new Date(msg.createdAt).toLocaleString('ru-RU')}
                            </span>
                          </div>
                          {msg.subject && (
                            <p className="text-xs font-medium text-gray-700 dark:text-gray-300 mb-2">
                              {msg.subject}
                            </p>
                          )}
                          <p className="text-xs text-gray-700 dark:text-gray-300 whitespace-pre-wrap">
                            {msg.message}
                          </p>
                        </div>
                      </div>
                    );
                  } else {
                    // Это ответ
                    const response = item as { id: string; text: string; fromAdmin: boolean; createdAt: string; messageId: string };
                    return (
                      <div key={response.id} className={`flex ${response.fromAdmin ? 'justify-end' : 'justify-start'}`}>
                        <div className={`rounded-lg p-3 max-w-[85%] ${
                          response.fromAdmin
                            ? 'bg-blue-50 dark:bg-blue-900 border border-blue-200 dark:border-blue-800'
                            : 'bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700'
                        }`}>
                          <div className="flex items-center justify-between mb-1.5 flex-wrap gap-1">
                            <span className="text-xs font-semibold text-gray-900 dark:text-white">
                              {response.fromAdmin ? 'Администратор' : selectedUserInfo.userName}
                            </span>
                            <span className="text-xs text-gray-500 dark:text-gray-400">
                              {new Date(response.createdAt).toLocaleString('ru-RU')}
                            </span>
                          </div>
                          <p className="text-xs text-gray-700 dark:text-gray-300 whitespace-pre-wrap">
                            {response.text}
                          </p>
                        </div>
                      </div>
                    );
                  }
                })}
                
                {allUserMessages.length === 0 && (
                  <div className="text-center text-sm text-gray-500 dark:text-gray-400 py-8">
                    Нет сообщений
                  </div>
                )}
              </div>

              {/* Response Form */}
              <div className="border-t border-gray-200 dark:border-gray-700 p-3 bg-white dark:bg-gray-800">
                <textarea
                  value={responseText}
                  onChange={(e) => setResponseText(e.target.value)}
                  placeholder="Введите ответ..."
                  className="w-full px-3 py-2 text-sm rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-white placeholder:text-gray-500 dark:placeholder:text-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500"
                  rows={3}
                />
                <div className="flex flex-col gap-2 mt-2">
                  <button
                    onClick={handleSendResponse}
                    disabled={!responseText.trim() || isResponding}
                    className="px-3 py-2 text-sm bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    {isResponding ? 'Отправка...' : 'Отправить ответ'}
                  </button>
                  {selectedUserMessages.length > 0 && (
                    <select
                      value={selectedUserMessages[selectedUserMessages.length - 1].status}
                      onChange={(e) =>
                        handleStatusChange(
                          selectedUserMessages[selectedUserMessages.length - 1].id,
                          e.target.value as SupportMessage['status']
                        )
                      }
                      className="px-3 py-2 text-sm rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                    >
                      <option value="new">Новое</option>
                      <option value="in_progress">В работе</option>
                      <option value="resolved">Решено</option>
                    </select>
                  )}
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default AdminPanel;
