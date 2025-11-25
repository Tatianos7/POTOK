import { useState, useEffect } from 'react';
import { useAuth } from '../context/AuthContext';
import { useTheme } from '../context/ThemeContext';
import { authService } from '../services/authService';
import { X } from 'lucide-react';
import DeleteSubscriptionModal from '../components/DeleteSubscriptionModal';
import ChangeSubscriptionModal from '../components/ChangeSubscriptionModal';

interface SubscriptionManagementProps {
  onClose: () => void;
}

const SubscriptionManagement = ({ onClose }: SubscriptionManagementProps) => {
  const { user } = useAuth();
  const { theme } = useTheme();
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState('');
  const [status, setStatus] = useState('');
  const [currentUser, setCurrentUser] = useState(user);
  const [isDeleteModalOpen, setIsDeleteModalOpen] = useState(false);
  const [isChangeModalOpen, setIsChangeModalOpen] = useState(false);

  useEffect(() => {
    if (!user) {
      onClose();
      return;
    }
    setCurrentUser(user);
  }, [user, onClose]);

  const handleChangeSubscription = () => {
    setIsChangeModalOpen(true);
  };

  const handleSelectPlan = async (planType: 'monthly' | 'yearly') => {
    if (!user) return;
    
    setIsLoading(true);
    setError('');
    setStatus('');

    try {
      // Используем безопасный метод из authService
      const updatedUser = authService.updateUserSubscription(user.id, true, planType);
      
      setCurrentUser(updatedUser);
      
      setStatus(`Подписка PREMIUM успешно активирована!`);
      
      // Закрываем модальное окно выбора тарифа
      setIsChangeModalOpen(false);
      
      setTimeout(() => {
        onClose();
        // Перезагружаем страницу для обновления контекста
        window.location.reload();
      }, 2000);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Ошибка смены подписки');
    } finally {
      setIsLoading(false);
    }
  };

  const handleDeleteSubscription = async () => {
    if (!user || !currentUser?.hasPremium) return;
    
    setIsLoading(true);
    setError('');
    setStatus('');

    try {
      // Используем безопасный метод из authService
      const updatedUser = authService.updateUserSubscription(user.id, false);
      
      setCurrentUser(updatedUser);
      
      // Показываем модальное окно с подтверждением удаления
      setIsDeleteModalOpen(true);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Ошибка отмены подписки');
    } finally {
      setIsLoading(false);
    }
  };

  const handleCloseDeleteModal = () => {
    setIsDeleteModalOpen(false);
    setTimeout(() => {
      onClose();
      // Перезагружаем страницу для обновления контекста
      window.location.reload();
    }, 300);
  };

  const subscriptionStatus = currentUser?.hasPremium ? 'PREMIUM' : 'FREE';
  const statusText = 'АКТИВНА';

  if (!user) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-50 px-4">
      <div className="bg-white dark:bg-gray-800 rounded-2xl w-full max-w-md shadow-xl">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-200 dark:border-gray-700">
          <h2 className="text-lg font-bold uppercase text-gray-900 dark:text-white flex-1 text-center">
            УПРАВЛЕНИЕ ПОДПИСКОЙ
          </h2>
          <button
            onClick={onClose}
            className="p-2 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg transition-colors"
            aria-label="Закрыть"
          >
            <X className="w-5 h-5 text-gray-500 dark:text-gray-400" />
          </button>
        </div>

        {/* Content */}
        <div className="px-6 py-6 space-y-6">
          {error && (
            <div className="bg-red-50 dark:bg-red-900 border border-red-200 dark:border-red-700 text-red-700 dark:text-red-300 px-4 py-3 rounded-lg text-sm">
              {error}
            </div>
          )}
          {status && (
            <div className="bg-green-50 dark:bg-green-900 border border-green-200 dark:border-green-700 text-green-700 dark:text-green-300 px-4 py-3 rounded-lg text-sm">
              {status}
            </div>
          )}

          {/* Subscription Status */}
          <div className="text-center">
            <p className="text-base font-semibold text-gray-900 dark:text-white">
              {subscriptionStatus} → {statusText}
            </p>
          </div>

          {/* Buttons */}
          <div className="space-y-3">
            <button
              onClick={handleChangeSubscription}
              disabled={isLoading}
              className={`w-full px-6 py-3 rounded-lg font-semibold uppercase transition-colors disabled:opacity-50 disabled:cursor-not-allowed ${
                theme === 'dark'
                  ? 'bg-white text-gray-900 hover:bg-gray-200 border-2 border-white'
                  : 'bg-gray-900 text-white hover:bg-gray-800 border-2 border-gray-900'
              }`}
            >
              {isLoading ? 'Обработка...' : 'СМЕНИТЬ ПОДПИСКУ'}
            </button>
            
            <button
              onClick={handleDeleteSubscription}
              disabled={isLoading || !currentUser?.hasPremium}
              className={`w-full px-6 py-3 rounded-lg font-semibold uppercase transition-colors disabled:opacity-50 disabled:cursor-not-allowed ${
                theme === 'dark'
                  ? 'bg-gray-700 text-white border-2 border-gray-500 hover:bg-gray-600 hover:border-gray-400'
                  : 'bg-white border-2 border-gray-900 text-gray-900 hover:bg-gray-50'
              }`}
            >
              {isLoading ? 'Обработка...' : 'УДАЛИТЬ ПОДПИСКУ'}
            </button>
          </div>
        </div>
      </div>

      {/* Delete Subscription Modal */}
      <DeleteSubscriptionModal
        isOpen={isDeleteModalOpen}
        onClose={handleCloseDeleteModal}
        subscriptionEndDate={undefined} // Заглушка, в будущем будет из данных пользователя
      />

      {/* Change Subscription Modal */}
      <ChangeSubscriptionModal
        isOpen={isChangeModalOpen}
        onClose={() => setIsChangeModalOpen(false)}
        currentStatus={subscriptionStatus}
        onSelectPlan={handleSelectPlan}
      />
    </div>
  );
};

export default SubscriptionManagement;

