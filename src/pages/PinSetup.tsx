import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import OtpCodeInput from '../components/OtpCodeInput';
import { markPinOfferSkipped, setupPinLock } from '../services/pinLockService';

const PinSetup = () => {
  const navigate = useNavigate();
  const [pin, setPin] = useState('');
  const [confirmPin, setConfirmPin] = useState('');
  const [error, setError] = useState('');
  const [isSaving, setIsSaving] = useState(false);

  const handleSavePin = async () => {
    setError('');
    if (!/^\d{4}$/.test(pin) || !/^\d{4}$/.test(confirmPin)) {
      setError('PIN должен состоять из 4 цифр');
      return;
    }
    if (pin !== confirmPin) {
      setError('PIN не совпадает');
      return;
    }
    setIsSaving(true);
    try {
      await setupPinLock(pin);
      markPinOfferSkipped();
      navigate('/', { replace: true });
    } catch {
      setError('Не удалось сохранить PIN. Попробуйте снова.');
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-white px-4">
      <div className="w-full max-w-md rounded-xl border border-gray-200 p-6 space-y-4">
        <h1 className="text-xl font-semibold text-gray-900">Настройка PIN</h1>
        <p className="text-sm text-gray-600">PIN используется как локальная блокировка на этом устройстве.</p>

        {error && (
          <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg text-sm">
            {error}
          </div>
        )}

        <OtpCodeInput
          id="pinSetup"
          value={pin}
          onChange={setPin}
          disabled={isSaving}
          label="PIN"
          placeholder="Введите 4 цифры"
          minLength={4}
          maxLength={4}
          autoFocus
        />

        <OtpCodeInput
          id="pinSetupConfirm"
          value={confirmPin}
          onChange={setConfirmPin}
          disabled={isSaving}
          label="Подтвердите PIN"
          placeholder="Повторите PIN"
          minLength={4}
          maxLength={4}
        />

        <div className="space-y-3">
          <button
            type="button"
            onClick={handleSavePin}
            disabled={isSaving}
            className="w-full bg-black text-white px-6 py-3 rounded-lg font-semibold hover:bg-gray-800 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {isSaving ? 'Сохраняем...' : 'Сохранить PIN'}
          </button>
          <button
            type="button"
            onClick={() => navigate('/')}
            className="w-full border border-gray-300 text-gray-800 px-6 py-3 rounded-lg font-semibold hover:bg-gray-50 transition-colors"
          >
            Отмена
          </button>
        </div>
      </div>
    </div>
  );
};

export default PinSetup;
