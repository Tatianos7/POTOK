import { X } from 'lucide-react';

interface NotificationDetailsModalProps {
  isOpen: boolean;
  title: string;
  date: string;
  message: string;
  onClose: () => void;
}

const NotificationDetailsModal = ({
  isOpen,
  title,
  date,
  message,
  onClose,
}: NotificationDetailsModalProps) => {
  if (!isOpen) return null;

  const formattedDate = new Date(date).toLocaleDateString('ru-RU', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
  });

  return (
    <div
      className="fixed inset-0 z-[80] flex items-center justify-center bg-black bg-opacity-50 px-4"
      onClick={(e) => {
        if (e.target === e.currentTarget) {
          onClose();
        }
      }}
    >
      <div className="bg-white dark:bg-gray-900 rounded-2xl w-full max-w-md shadow-xl">
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-200 dark:border-gray-800">
          <h2 className="text-lg font-semibold text-gray-900 dark:text-white flex-1 text-center uppercase">
            {title}
          </h2>
          <button
            onClick={onClose}
            className="p-2 hover:bg-gray-100 dark:hover:bg-gray-800 rounded-lg transition-colors"
            aria-label="Закрыть"
          >
            <X className="w-5 h-5 text-gray-500 dark:text-gray-300" />
          </button>
        </div>

        <div className="px-6 py-6 space-y-4">
          <p className="text-xs text-gray-500 dark:text-gray-400">{formattedDate}</p>
          <p className="text-sm text-gray-800 dark:text-gray-100 whitespace-pre-line">{message}</p>
        </div>
      </div>
    </div>
  );
};

export default NotificationDetailsModal;

