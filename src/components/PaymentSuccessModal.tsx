import { X } from 'lucide-react';

interface PaymentSuccessModalProps {
  isOpen: boolean;
  onClose: () => void;
  planType: 'monthly' | 'yearly';
}

const PaymentSuccessModal = ({ isOpen, onClose, planType }: PaymentSuccessModalProps) => {
  if (!isOpen) return null;

  const period = planType === 'monthly' ? 'месяц' : 'год';

  return (
    <div className="fixed inset-0 z-[80] flex items-center justify-center bg-black bg-opacity-50 px-4">
      <div className="bg-white dark:bg-gray-800 rounded-2xl w-full max-w-md shadow-xl">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-200 dark:border-gray-700">
          <h2 className="text-lg font-bold uppercase text-gray-900 dark:text-white flex-1 text-center">
            ОПЛАТА УСПЕШНА
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
        <div className="px-6 py-6 space-y-4 text-center">
          <div className="space-y-2">
            <p className="text-lg font-bold text-gray-900 dark:text-white">
              Поздравляем!
            </p>
            <p className="text-base text-gray-700 dark:text-gray-300">
              Оплата прошла успешно
            </p>
            <p className="text-base text-gray-700 dark:text-gray-300">
              Вы приобрели PREMIUM подписку на {period}
            </p>
          </div>

          {/* Success Button */}
          <button
            onClick={onClose}
            className="w-full px-6 py-3 rounded-lg font-semibold uppercase bg-gray-900 dark:bg-white text-white dark:text-gray-900 hover:bg-gray-800 dark:hover:bg-gray-200 transition-colors"
          >
            ОТЛИЧНО
          </button>
        </div>
      </div>
    </div>
  );
};

export default PaymentSuccessModal;

