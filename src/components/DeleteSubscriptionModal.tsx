import { X } from 'lucide-react';

interface DeleteSubscriptionModalProps {
  isOpen: boolean;
  onClose: () => void;
  subscriptionEndDate?: string;
}

const DeleteSubscriptionModal = ({ 
  isOpen, 
  onClose,
  subscriptionEndDate 
}: DeleteSubscriptionModalProps) => {

  // Заглушка для даты окончания подписки
  // В будущем это будет приходить из API или localStorage
  const getSubscriptionEndDate = (): string => {
    if (subscriptionEndDate) {
      return subscriptionEndDate;
    }
    // Заглушка: дата через 2 года от текущей даты
    const futureDate = new Date();
    futureDate.setFullYear(futureDate.getFullYear() + 2);
    return futureDate.toLocaleDateString('ru-RU', {
      day: 'numeric',
      month: 'long',
      year: 'numeric'
    });
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black bg-opacity-50 px-4">
      <div className="bg-white dark:bg-gray-800 rounded-2xl w-full max-w-md shadow-xl">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-200 dark:border-gray-700">
          <h2 className="text-lg font-bold uppercase text-gray-900 dark:text-white flex-1 text-center">
            УДАЛЕНИЕ ПОДПИСКИ
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
        <div className="px-6 py-6 space-y-4">
          {/* Main Message */}
          <div className="text-center space-y-2">
            <p className="text-lg font-bold uppercase text-gray-900 dark:text-white">
              ВАША ПОДПИСКА УДАЛЕНА
            </p>
            <p className="text-sm text-gray-600 dark:text-gray-400">
              Срок действия до {getSubscriptionEndDate()}
            </p>
          </div>

          {/* Confirm Button */}
          <button
            onClick={onClose}
            className={`w-full px-6 py-3 rounded-lg font-semibold uppercase transition-colors ${
              'bg-gray-900 text-white hover:bg-gray-800 dark:bg-white dark:text-gray-900 dark:hover:bg-gray-200'
            }`}
          >
            OK
          </button>
        </div>
      </div>
    </div>
  );
};

export default DeleteSubscriptionModal;

