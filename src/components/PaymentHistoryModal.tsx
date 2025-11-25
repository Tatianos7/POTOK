import { useEffect, useState } from 'react';
import { X } from 'lucide-react';

interface PaymentRecord {
  id: string;
  date: string;
  description: string;
  amount: number;
}

interface PaymentHistoryModalProps {
  isOpen: boolean;
  onClose: () => void;
  userId?: string;
}

const PaymentHistoryModal = ({ isOpen, onClose, userId }: PaymentHistoryModalProps) => {
  const [history, setHistory] = useState<PaymentRecord[]>([]);

  const loadHistory = () => {
    if (!userId) return;
    const key = `payment_history_${userId}`;
    const data = JSON.parse(localStorage.getItem(key) || '[]');
    setHistory(data);
  };

  useEffect(() => {
    if (isOpen) {
      loadHistory();
    }
  }, [isOpen, userId]);

  useEffect(() => {
    const handler = (event: Event) => {
      const customEvent = event as CustomEvent<{ userId: string }>;
      if (customEvent.detail?.userId === userId) {
        loadHistory();
      }
    };

    window.addEventListener('payment-history-updated', handler as EventListener);
    return () => window.removeEventListener('payment-history-updated', handler as EventListener);
  }, [userId]);

  if (!isOpen) return null;

  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    return date.toLocaleDateString('ru-RU', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
    });
  };

  return (
    <div
      className="fixed inset-0 z-[70] flex items-center justify-center bg-black bg-opacity-50 px-4"
      onClick={(e) => {
        if (e.target === e.currentTarget) {
          onClose();
        }
      }}
    >
      <div className="bg-white dark:bg-gray-900 rounded-2xl w-full max-w-md shadow-xl max-h-[90vh] flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-200 dark:border-gray-700">
          <h2 className="text-lg font-bold uppercase text-gray-900 dark:text-white flex-1 text-center">
            ИСТОРИЯ ОПЛАТЫ
          </h2>
          <button
            onClick={onClose}
            className="p-2 hover:bg-gray-100 dark:hover:bg-gray-800 rounded-lg transition-colors"
            aria-label="Закрыть"
          >
            <X className="w-5 h-5 text-gray-500 dark:text-gray-300" />
          </button>
        </div>

        {/* Content */}
        <div className="px-6 py-6 space-y-4 overflow-y-auto flex-1">
          {history.length === 0 ? (
            <p className="text-center text-sm text-gray-500 dark:text-gray-400">
              Еще нет оплат
            </p>
          ) : (
            history.map((record) => (
              <div key={record.id} className="space-y-1">
                <div className="flex items-start justify-between text-sm">
                  <div>
                    <p className="text-gray-500 dark:text-gray-400">{formatDate(record.date)}</p>
                    <p className="text-gray-900 dark:text-white">{record.description}</p>
                  </div>
                  <p className="text-gray-900 dark:text-white font-semibold">
                    {record.amount.toLocaleString('ru-RU')} ₽
                  </p>
                </div>
                <div className="border-b border-gray-200 dark:border-gray-700"></div>
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  );
};

export default PaymentHistoryModal;

