import { useState, useEffect } from 'react';
import { X, ChevronDown, ArrowRight } from 'lucide-react';
import PaymentSuccessModal from './PaymentSuccessModal';
import { useAuth } from '../context/AuthContext';
import { notificationService } from '../services/notificationService';

interface PaymentModalProps {
  isOpen: boolean;
  onClose: () => void;
  planType: 'monthly' | 'yearly';
  onPaymentSuccess: () => void;
}

interface FieldValidation {
  isValid: boolean;
  isTouched: boolean;
}

const PaymentModal = ({ isOpen, onClose, planType, onPaymentSuccess }: PaymentModalProps) => {
  const { user } = useAuth();
  const [formData, setFormData] = useState({
    cardNumber: '',
    expiryDate: '',
    cvc: '',
    cardholderName: '',
    email: '',
    promoCode: '',
  });

  const [options, setOptions] = useState({
    rememberCard: false,
    getReceipt: false,
    noNewsletter: false,
    agreeToTerms: false,
  });

  const [selectedCard, setSelectedCard] = useState<string | null>(null);
  const [showCardDropdown, setShowCardDropdown] = useState(false);
  const [isSuccessModalOpen, setIsSuccessModalOpen] = useState(false);
  const linkedCards = ['4255 2333 2222 55', '1234 5678 9012 3456'];
  const [validation, setValidation] = useState<Record<string, FieldValidation>>({
    cardNumber: { isValid: false, isTouched: false },
    expiryDate: { isValid: false, isTouched: false },
    cvc: { isValid: false, isTouched: false },
    cardholderName: { isValid: false, isTouched: false },
    email: { isValid: false, isTouched: false },
  });

  const price = planType === 'monthly' ? 499 : 3999;
  const period = planType === 'monthly' ? 'месяц' : 'год';

  const savePaymentRecord = () => {
    if (!user?.id) {
      console.error('Не удалось сохранить запись об оплате: userId отсутствует');
      return;
    }
    
    // Дополнительная проверка userId
    if (user.id === 'undefined' || user.id === 'null' || user.id.trim() === '') {
      console.error('Некорректный userId при сохранении оплаты:', user.id);
      return;
    }
    
    const key = `payment_history_${user.id}`;
    const history = JSON.parse(localStorage.getItem(key) || '[]');
    const record = {
      id: `${Date.now()}_${Math.random()}`,
      date: new Date().toISOString(),
      amount: price,
      description: planType === 'monthly' ? 'Оплата подписки' : 'Оплата годовой подписки',
    };
    const updatedHistory = [record, ...history];
    localStorage.setItem(key, JSON.stringify(updatedHistory));
    window.dispatchEvent(
      new CustomEvent('payment-history-updated', { detail: { userId: user.id } })
    );

    // Создаем уведомление только для текущего пользователя
    notificationService.addNotification(user.id, {
      title: 'Оплата прошла успешно',
      message: `Подписка PREMIUM на ${period} активирована. Сумма: ${price.toLocaleString('ru-RU')} ₽`,
      category: 'messages',
    });
  };

  // Блокируем прокрутку body когда модальное окно открыто
  useEffect(() => {
    if (isOpen) {
      document.body.style.overflow = 'hidden';
    } else {
      document.body.style.overflow = '';
    }
    return () => {
      document.body.style.overflow = '';
    };
  }, [isOpen]);

  if (!isOpen) return null;

  // Валидация номера карты (16 цифр)
  const validateCardNumber = (value: string): boolean => {
    const cleaned = value.replace(/\s/g, '');
    return /^\d{16}$/.test(cleaned);
  };

  // Валидация срока действия (ММ/ГГ)
  const validateExpiryDate = (value: string): boolean => {
    // Если поле пустое или неполное, не валидируем как ошибку до завершения ввода
    if (!value || value.length < 5) return false;
    
    const regex = /^(0[1-9]|1[0-2])\/\d{2}$/;
    if (!regex.test(value)) return false;
    
    const [month, year] = value.split('/');
    const currentYear = new Date().getFullYear() % 100;
    const currentMonth = new Date().getMonth() + 1;
    const cardYear = parseInt(year);
    const cardMonth = parseInt(month);
    
    // Проверяем, что год не в прошлом
    if (cardYear < currentYear) return false;
    // Если год текущий, проверяем что месяц не в прошлом
    if (cardYear === currentYear && cardMonth < currentMonth) return false;
    // Проверяем, что год не слишком далеко в будущем (максимум 20 лет)
    if (cardYear > currentYear + 20) return false;
    
    return true;
  };

  // Валидация CVC (3 цифры)
  const validateCVC = (value: string): boolean => {
    return /^\d{3}$/.test(value);
  };

  // Валидация имени
  const validateCardholderName = (value: string): boolean => {
    return value.trim().length >= 3;
  };

  // Валидация email
  const validateEmail = (value: string): boolean => {
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    return emailRegex.test(value);
  };

  const handleInputChange = (field: string, value: string) => {
    setFormData((prev) => ({ ...prev, [field]: value }));

    let isValid = false;
    switch (field) {
      case 'cardNumber':
        isValid = validateCardNumber(value);
        break;
      case 'expiryDate':
        isValid = validateExpiryDate(value);
        break;
      case 'cvc':
        isValid = validateCVC(value);
        break;
      case 'cardholderName':
        isValid = validateCardholderName(value);
        break;
      case 'email':
        isValid = validateEmail(value);
        break;
    }

    setValidation((prev) => ({
      ...prev,
      [field]: { isValid, isTouched: true },
    }));
  };

  // Форматирование номера карты
  const formatCardNumber = (value: string): string => {
    const cleaned = value.replace(/\s/g, '');
    const formatted = cleaned.match(/.{1,4}/g)?.join(' ') || cleaned;
    return formatted.slice(0, 19); // Максимум 16 цифр + 3 пробела
  };

  // Форматирование срока действия
  const formatExpiryDate = (value: string): string => {
    const cleaned = value.replace(/\D/g, '');
    if (cleaned.length >= 2) {
      return `${cleaned.slice(0, 2)}/${cleaned.slice(2, 4)}`;
    }
    return cleaned;
  };

  const handleCardNumberChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const formatted = formatCardNumber(e.target.value);
    handleInputChange('cardNumber', formatted);
  };

  const handleExpiryDateChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const formatted = formatExpiryDate(e.target.value);
    handleInputChange('expiryDate', formatted);
  };

  const handleCVCChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = e.target.value.replace(/\D/g, '').slice(0, 3);
    handleInputChange('cvc', value);
  };

  const getFieldBorderColor = (field: string): string => {
    const fieldValidation = validation[field];
    // Для имитации - показываем зеленую границу если поле заполнено, иначе серую
    if (!fieldValidation.isTouched) {
      return 'border-gray-300 dark:border-gray-600';
    }
    
    const fieldValue = formData[field as keyof typeof formData];
    if (fieldValue && fieldValue.trim().length > 0) {
      return 'border-green-500';
    }
    
    return 'border-gray-300 dark:border-gray-600';
  };

  const isFormValid = (): boolean => {
    // Для имитации - проверяем только что обязательные поля заполнены и согласие с офертой
    return (
      formData.cardNumber.trim().length > 0 &&
      formData.expiryDate.trim().length > 0 &&
      formData.cvc.trim().length > 0 &&
      formData.cardholderName.trim().length > 0 &&
      formData.email.trim().length > 0 &&
      options.agreeToTerms
    );
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!isFormValid()) {
      return;
    }
    
    // Имитация оплаты - показываем окно успеха
    setIsSuccessModalOpen(true);
  };

  const handleSuccessModalClose = () => {
    setIsSuccessModalOpen(false);
    savePaymentRecord();
    onPaymentSuccess();
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
      <div className="bg-white dark:bg-gray-800 rounded-2xl w-full max-w-md shadow-xl max-h-[90vh] flex flex-col">
        {/* Header - фиксированный */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-200 dark:border-gray-700 flex-shrink-0">
          <h2 className="text-lg font-bold uppercase text-gray-900 dark:text-white flex-1 text-center">
            ОПЛАТА ПРЕМИУМ ТАРИФА
          </h2>
          <button
            onClick={onClose}
            className="p-2 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg transition-colors flex-shrink-0"
            aria-label="Закрыть"
          >
            <X className="w-5 h-5 text-gray-500 dark:text-gray-400" />
          </button>
        </div>

        {/* Content - прокручиваемый */}
        <form onSubmit={handleSubmit} className="px-6 py-6 space-y-4 overflow-y-auto flex-1">
          {/* Payment by Contract Section */}
          <div>
            <p className="text-sm font-bold text-gray-900 dark:text-white mb-2">
              Оплата по договору ......
            </p>
          </div>

          {/* Card Number with Linked Cards Dropdown */}
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
              Номер карты <span className="text-red-500">*</span>
            </label>
            <div className="relative">
              <input
                type="text"
                value={selectedCard ? formatCardNumber(selectedCard.replace(/\s/g, '')) : formData.cardNumber}
                onChange={(e) => {
                  if (selectedCard) {
                    setSelectedCard(null);
                  }
                  handleCardNumberChange(e);
                }}
                onFocus={() => {
                  if (linkedCards.length > 0 && !formData.cardNumber && !selectedCard) {
                    setShowCardDropdown(true);
                  }
                }}
                placeholder=".... .... .... ...."
                className={`w-full px-4 py-3 pr-10 rounded-lg border-2 bg-white dark:bg-gray-700 text-gray-900 dark:text-white placeholder:text-gray-400 dark:placeholder:text-gray-500 focus:outline-none ${getFieldBorderColor('cardNumber')}`}
                maxLength={19}
              />
              {linkedCards.length > 0 && (
                <button
                  type="button"
                  onClick={() => setShowCardDropdown(!showCardDropdown)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 p-1 text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-300 focus:outline-none"
                >
                  <ChevronDown className={`w-5 h-5 transition-transform ${showCardDropdown ? 'rotate-180' : ''}`} />
                </button>
              )}
              {showCardDropdown && linkedCards.length > 0 && (
                <div className="absolute z-10 w-full mt-1 bg-white dark:bg-gray-700 border border-gray-300 dark:border-gray-600 rounded-lg shadow-lg max-h-48 overflow-y-auto">
                  {linkedCards.map((card, index) => (
                    <button
                      key={index}
                      type="button"
                      onClick={() => {
                        const formattedCard = formatCardNumber(card.replace(/\s/g, ''));
                        setFormData((prev) => ({ ...prev, cardNumber: formattedCard }));
                        setSelectedCard(card);
                        setShowCardDropdown(false);
                        handleInputChange('cardNumber', formattedCard);
                      }}
                      className="w-full px-4 py-2 text-left hover:bg-gray-100 dark:hover:bg-gray-600 text-gray-900 dark:text-white"
                    >
                      {card}
                    </button>
                  ))}
                </div>
              )}
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                Срок действия <span className="text-red-500">*</span>
              </label>
              <input
                type="text"
                value={formData.expiryDate}
                onChange={handleExpiryDateChange}
                placeholder="ММ/ГГ"
                className={`w-full px-4 py-3 rounded-lg border-2 bg-white dark:bg-gray-700 text-gray-900 dark:text-white placeholder:text-gray-400 dark:placeholder:text-gray-500 focus:outline-none ${getFieldBorderColor('expiryDate')}`}
                maxLength={5}
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                Проверочный код <span className="text-red-500">*</span>
              </label>
              <input
                type="text"
                value={formData.cvc}
                onChange={handleCVCChange}
                placeholder="CVC"
                className={`w-full px-4 py-3 rounded-lg border-2 bg-white dark:bg-gray-700 text-gray-900 dark:text-white placeholder:text-gray-400 dark:placeholder:text-gray-500 focus:outline-none ${getFieldBorderColor('cvc')}`}
                maxLength={3}
              />
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
              Имя владельца карты <span className="text-red-500">*</span>
            </label>
            <input
              type="text"
              value={formData.cardholderName}
              onChange={(e) => handleInputChange('cardholderName', e.target.value.toUpperCase())}
              placeholder="PETR IVANOV IVANOVICH"
              className={`w-full px-4 py-3 rounded-lg border-2 bg-white dark:bg-gray-700 text-gray-900 dark:text-white placeholder:text-gray-400 dark:placeholder:text-gray-500 focus:outline-none ${getFieldBorderColor('cardholderName')}`}
            />
          </div>

          {/* Options */}
          <div className="space-y-2">
            <label className="flex items-center cursor-pointer">
              <input
                type="checkbox"
                checked={options.rememberCard}
                onChange={(e) => setOptions((prev) => ({ ...prev, rememberCard: e.target.checked }))}
                className="mr-2 w-4 h-4"
              />
              <span className="text-sm text-gray-700 dark:text-gray-300">Запомнить карту</span>
            </label>
            <label className="flex items-center cursor-pointer">
              <input
                type="checkbox"
                checked={options.getReceipt}
                onChange={(e) => setOptions((prev) => ({ ...prev, getReceipt: e.target.checked }))}
                className="mr-2 w-4 h-4"
              />
              <span className="text-sm text-gray-700 dark:text-gray-300">Получить квитанцию</span>
            </label>
            <label className="flex items-center cursor-pointer">
              <input
                type="checkbox"
                checked={options.noNewsletter}
                onChange={(e) => setOptions((prev) => ({ ...prev, noNewsletter: e.target.checked }))}
                className="mr-2 w-4 h-4"
              />
              <span className="text-sm text-gray-700 dark:text-gray-300">Не хочу получать рассылку</span>
            </label>
            <div>
              <label className="flex items-start cursor-pointer">
                <input
                  type="checkbox"
                  checked={options.agreeToTerms}
                  onChange={(e) => setOptions((prev) => ({ ...prev, agreeToTerms: e.target.checked }))}
                  className="mr-2 mt-1 w-4 h-4"
                />
                <span className="text-sm text-gray-700 dark:text-gray-300">
                  Согласен с условиями оферты*
                </span>
              </label>
              <p className="text-xs text-gray-600 dark:text-gray-400 ml-6 mt-1">
                *Ставя галочку "Согласен с условиями оферты", вы подтверждаете, что ознакомились и согласны с условиями публичной оферты
              </p>
              <a href="#" className="text-xs text-blue-600 dark:text-blue-400 ml-6 hover:underline">
                Ознакомиться с условиями оферты
              </a>
            </div>
          </div>

          {/* Email */}
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
              e-mail
            </label>
            <input
              type="email"
              value={formData.email}
              onChange={(e) => handleInputChange('email', e.target.value)}
              placeholder="your@email.com"
              className={`w-full px-4 py-3 rounded-lg border-2 bg-white dark:bg-gray-700 text-gray-900 dark:text-white placeholder:text-gray-400 dark:placeholder:text-gray-500 focus:outline-none ${getFieldBorderColor('email')}`}
            />
          </div>

          {/* Promo Code */}
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
              Промокод
            </label>
            <div className="flex gap-2">
              <input
                type="text"
                value={formData.promoCode}
                onChange={(e) => setFormData((prev) => ({ ...prev, promoCode: e.target.value }))}
                placeholder="Введите промокод"
                className="flex-1 px-4 py-3 rounded-lg border-2 border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-white placeholder:text-gray-400 dark:placeholder:text-gray-500 focus:outline-none"
              />
              <button
                type="button"
                className="px-4 py-3 bg-gray-900 dark:bg-white text-white dark:text-gray-900 rounded-lg hover:bg-gray-800 dark:hover:bg-gray-200 transition-colors"
              >
                <ArrowRight className="w-5 h-5" />
              </button>
            </div>
          </div>

          {/* Total */}
          <div className="flex items-center justify-between py-4 border-t border-gray-200 dark:border-gray-700">
            <span className="text-sm font-bold uppercase text-gray-900 dark:text-white">
              ИТОГО К ОПЛАТЕ
            </span>
            <span className="text-lg font-bold text-gray-900 dark:text-white">
              {price} ₽ / {period}
            </span>
          </div>

          {/* Action Buttons */}
          <div className="space-y-3">
            <button
              type="button"
              className="w-full px-6 py-3 rounded-lg font-semibold uppercase border-2 border-gray-900 dark:border-gray-300 bg-white dark:bg-gray-800 text-gray-900 dark:text-white hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors"
            >
              ПОДКЛЮЧИТЬ АВТОПЛАТЕЖ
            </button>
            <button
              type="submit"
              disabled={!isFormValid()}
              className="w-full px-6 py-3 rounded-lg font-semibold uppercase bg-gray-900 dark:bg-white text-white dark:text-gray-900 hover:bg-gray-800 dark:hover:bg-gray-200 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            >
              ОПЛАТИТЬ
            </button>
          </div>

          {/* Footer */}
          <div className="text-center pt-4">
            <p className="text-sm text-gray-600 dark:text-gray-400">ПОТОК</p>
          </div>
        </form>
      </div>

      {/* Payment Success Modal */}
      <PaymentSuccessModal
        isOpen={isSuccessModalOpen}
        onClose={handleSuccessModalClose}
        planType={planType}
      />
    </div>
  );
};

export default PaymentModal;

