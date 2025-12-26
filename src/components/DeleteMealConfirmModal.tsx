import { X, AlertTriangle } from 'lucide-react';

interface DeleteMealConfirmModalProps {
  isOpen: boolean;
  onClose: () => void;
  onConfirm: () => void;
}

const DeleteMealConfirmModal = ({ isOpen, onClose, onConfirm }: DeleteMealConfirmModalProps) => {
  if (!isOpen) return null;

  const handleConfirm = () => {
    onConfirm();
    onClose();
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-end justify-center z-50">
      <div className="bg-white dark:bg-gray-800 rounded-t-2xl w-full max-w-md">
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b border-gray-200 dark:border-gray-700">
          <h2 className="text-lg font-semibold text-gray-900 dark:text-white">
            Удалить приём пищи?
          </h2>
          <button
            onClick={onClose}
            className="p-2 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg transition-colors"
            aria-label="Закрыть"
          >
            <X className="w-5 h-5 text-gray-600 dark:text-gray-400" />
          </button>
        </div>

        {/* Content */}
        <div className="p-4 space-y-4">
          <div className="flex items-start gap-3">
            <div className="flex-shrink-0 w-10 h-10 flex items-center justify-center rounded-full bg-red-100 dark:bg-red-900/20">
              <AlertTriangle className="w-5 h-5 text-red-600 dark:text-red-400" />
            </div>
            <div className="flex-1">
              <p className="text-sm text-gray-700 dark:text-gray-300">
                Все продукты в этом приёме пищи будут удалены. Действие нельзя отменить.
              </p>
            </div>
          </div>
        </div>

        {/* Footer buttons */}
        <div className="p-4 border-t border-gray-200 dark:border-gray-700 flex gap-3">
          <button
            onClick={onClose}
            className="flex-1 py-3 px-4 rounded-lg border-2 border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 text-gray-900 dark:text-white font-medium hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors"
          >
            Отмена
          </button>
          <button
            onClick={handleConfirm}
            className="flex-1 py-3 px-4 rounded-lg bg-red-600 text-white font-medium hover:bg-red-700 transition-colors"
          >
            Удалить
          </button>
        </div>
      </div>
    </div>
  );
};

export default DeleteMealConfirmModal;

