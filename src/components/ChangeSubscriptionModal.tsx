import { useState } from 'react';
import { X } from 'lucide-react';
import PaymentModal from './PaymentModal';

interface ChangeSubscriptionModalProps {
  isOpen: boolean;
  onClose: () => void;
  currentStatus: 'FREE' | 'PREMIUM';
  onSelectPlan: (planType: 'monthly' | 'yearly') => void;
}

const ChangeSubscriptionModal = ({
  isOpen,
  onClose,
  currentStatus,
  onSelectPlan,
}: ChangeSubscriptionModalProps) => {
  const [selectedPlan, setSelectedPlan] = useState<'monthly' | 'yearly' | null>(null);
  const [isPaymentModalOpen, setIsPaymentModalOpen] = useState(false);

  if (!isOpen) return null;

  const handlePlanSelect = (planType: 'monthly' | 'yearly') => {
    setSelectedPlan(planType);
    setIsPaymentModalOpen(true);
  };

  const handlePaymentSuccess = () => {
    setIsPaymentModalOpen(false);
    onSelectPlan(selectedPlan!);
  };

  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black bg-opacity-50 px-4">
      <div className="bg-white dark:bg-gray-800 rounded-2xl w-full max-w-md shadow-xl">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-200 dark:border-gray-700">
          <h2 className="text-lg font-bold uppercase text-gray-900 dark:text-white flex-1 text-center">
            СМЕНА ПОДПИСКИ
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
          {/* Current Status */}
          <div className="text-center">
            <p className="text-base font-semibold text-gray-900 dark:text-white">
              {currentStatus} → АКТИВНА
            </p>
          </div>

          {/* Premium Plan Card */}
          <div className="border-2 border-gray-900 dark:border-gray-300 rounded-2xl p-6 space-y-4">
            <h3 className="text-xl font-bold uppercase text-center text-gray-900 dark:text-white">
              PREMIUM
            </h3>
            
            {/* Features List */}
            <ul className="space-y-2 text-sm text-gray-900 dark:text-white">
              <li className="flex items-start">
                <span className="mr-2">•</span>
                <span>Все что в бесплатном</span>
              </li>
              <li className="flex items-start">
                <span className="mr-2">•</span>
                <span>Дневник тренировок</span>
              </li>
              <li className="flex items-start">
                <span className="mr-2">•</span>
                <span>Дневник прогресса целей</span>
              </li>
              <li className="flex items-start">
                <span className="mr-2">•</span>
                <span>Трекер полезных привычек</span>
              </li>
            </ul>

            {/* Disclaimer */}
            <p className="text-xs italic text-gray-600 dark:text-gray-400 text-center mt-4">
              *в будущем это будет самая лучшая и доступная платформа в мире
            </p>
          </div>

          {/* Pricing Options */}
          <div className="space-y-3">
            {/* Monthly Plan */}
            <button
              onClick={() => handlePlanSelect('monthly')}
              className={`w-full px-6 py-4 rounded-lg font-semibold text-center transition-colors border-2 ${
                selectedPlan === 'monthly'
                  ? 'bg-gray-900 text-white border-gray-900 dark:bg-white dark:text-gray-900 dark:border-white'
                  : 'bg-white text-gray-900 border-gray-900 dark:bg-gray-800 dark:text-white dark:border-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700'
              }`}
            >
              499 ₽ / месяц
            </button>

            {/* Yearly Plan */}
            <button
              onClick={() => handlePlanSelect('yearly')}
              className={`w-full px-6 py-4 rounded-lg font-semibold text-center transition-colors border-2 ${
                selectedPlan === 'yearly'
                  ? 'bg-gray-900 text-white border-gray-900 dark:bg-white dark:text-gray-900 dark:border-white'
                  : 'bg-gray-900 text-white border-gray-900 dark:bg-white dark:text-gray-900 dark:border-white hover:bg-gray-800 dark:hover:bg-gray-200'
              }`}
            >
              3999 ₽ / год
            </button>
          </div>
        </div>
      </div>

      {/* Payment Modal */}
      {selectedPlan && (
        <PaymentModal
          isOpen={isPaymentModalOpen}
          onClose={() => {
            setIsPaymentModalOpen(false);
            setSelectedPlan(null);
          }}
          planType={selectedPlan}
          onPaymentSuccess={handlePaymentSuccess}
        />
      )}
    </div>
  );
};

export default ChangeSubscriptionModal;

