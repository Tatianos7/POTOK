import { useEffect, useRef, useState } from 'react';
import { X } from 'lucide-react';
import {
  NotificationMessage,
  notificationService,
} from '../services/notificationService';
import { useAuth } from '../context/AuthContext';
import { supportService } from '../services/supportService';

interface NotificationThreadModalProps {
  isOpen: boolean;
  notificationId: string | null;
  notificationTitle: string;
  onClose: () => void;
  onMarkAsRead?: (notificationId: string) => void;
}

const NotificationThreadModal = ({
  isOpen,
  notificationId,
  notificationTitle,
  onClose,
  onMarkAsRead,
}: NotificationThreadModalProps) => {
  const { user } = useAuth();
  const [messages, setMessages] = useState<NotificationMessage[]>([]);
  const [inputValue, setInputValue] = useState('');
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (isOpen && user?.id && notificationId) {
      const thread = notificationService.getThread(user.id, notificationId);
      setMessages(thread);
      
      // Помечаем уведомление как прочитанное при открытии модального окна
      if (onMarkAsRead) {
        onMarkAsRead(notificationId);
      }
    }
  }, [isOpen, user?.id, notificationId, onMarkAsRead]);

  useEffect(() => {
    if (containerRef.current) {
      containerRef.current.scrollTop = containerRef.current.scrollHeight;
    }
  }, [messages]);

  if (!isOpen || !notificationId) return null;

  const handleSend = async () => {
    if (!inputValue.trim() || !user?.id) return;
    notificationService.addThreadMessage(user.id, notificationId, inputValue.trim(), true);
    const updatedThread = notificationService.getThread(user.id, notificationId);
    setMessages(updatedThread);

    // Отправляем сообщение в админку
    try {
      const userName =
        user?.profile?.firstName || user?.name
          ? `${user?.profile?.firstName || user?.name} ${user?.profile?.lastName || ''}`.trim()
          : 'Пользователь';
      await supportService.createMessage(
        user.id,
        userName || 'Пользователь',
        inputValue.trim(),
        user.profile?.email || user.email,
        user.profile?.phone || user.phone,
        `Ответ на уведомление: ${notificationTitle}`
      );
      
      // Сообщение уже добавлено в тред выше, не нужно создавать новое уведомление
      // Используем существующее уведомление поддержки
    } catch (error) {
      console.error('Не удалось отправить сообщение в поддержку', error);
    }

    setInputValue('');

    setTimeout(() => {
      notificationService.addThreadMessage(
        user.id,
        notificationId,
        'Спасибо за сообщение! Мы скоро ответим.',
        false
      );
      const thread = notificationService.getThread(user.id, notificationId);
      setMessages(thread);
    }, 1500);
  };

  const handleClose = () => {
    setInputValue('');
    onClose();
  };

  return (
    <div
      className="fixed inset-0 z-[80] flex items-center justify-center bg-black bg-opacity-50 px-4"
      onClick={(e) => {
        if (e.target === e.currentTarget) {
          handleClose();
        }
      }}
    >
      <div className="bg-white dark:bg-gray-900 rounded-2xl w-full max-w-md shadow-xl max-h-[90vh] flex flex-col">
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-200 dark:border-gray-800">
          <h2 className="text-lg font-semibold text-gray-900 dark:text-white flex-1 text-center uppercase">
            {notificationTitle}
          </h2>
          <button
            onClick={handleClose}
            className="p-2 hover:bg-gray-100 dark:hover:bg-gray-800 rounded-lg transition-colors"
            aria-label="Закрыть"
          >
            <X className="w-5 h-5 text-gray-500 dark:text-gray-300" />
          </button>
        </div>

        <div
          ref={containerRef}
          className="flex-1 px-6 py-4 space-y-4 overflow-y-auto bg-gray-50 dark:bg-gray-800"
        >
          {messages.map((message) => (
            <div
              key={message.id}
              className={`flex ${message.isUser ? 'justify-end' : 'justify-start'}`}
            >
              <div
                className={`max-w-[80%] rounded-2xl px-4 py-2 text-sm ${
                  message.isUser
                    ? 'bg-gray-900 text-white dark:bg-white dark:text-gray-900'
                    : 'bg-white text-gray-900 dark:bg-gray-900 dark:text-white border border-gray-200 dark:border-gray-800'
                }`}
              >
                <p>{message.text}</p>
                <p className="text-xs mt-1 opacity-70">
                  {new Date(message.date).toLocaleTimeString('ru-RU', {
                    hour: '2-digit',
                    minute: '2-digit',
                  })}
                </p>
              </div>
            </div>
          ))}
        </div>

        <div className="px-6 py-4 border-t border-gray-200 dark:border-gray-800 space-y-2">
          <textarea
            value={inputValue}
            onChange={(e) => setInputValue(e.target.value)}
            placeholder="Напишите ответ..."
            rows={2}
            className="w-full rounded-xl border border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-800 text-sm text-gray-900 dark:text-white px-4 py-2 focus:outline-none"
          />
          <button
            onClick={handleSend}
            disabled={!inputValue.trim()}
            className="w-full py-3 rounded-xl font-semibold uppercase bg-gray-900 text-white dark:bg-white dark:text-gray-900 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            Отправить
          </button>
        </div>
      </div>
    </div>
  );
};

export default NotificationThreadModal;

