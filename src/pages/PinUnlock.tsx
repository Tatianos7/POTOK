import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import OtpCodeInput from '../components/OtpCodeInput';
import { useAuth } from '../context/AuthContext';
import { supabase } from '../lib/supabaseClient';
import {
  clearPinLock,
  clearPinSessionUnlocked,
  isPinLockEnabled,
  isPinSessionUnlocked,
  markPinSessionUnlocked,
  verifyPinLock,
} from '../services/pinLockService';

const PinUnlock = () => {
  const navigate = useNavigate();
  const { authStatus } = useAuth();
  const [pin, setPin] = useState('');
  const [error, setError] = useState('');
  const [isChecking, setIsChecking] = useState(false);

  useEffect(() => {
    if (authStatus === 'unauthenticated') {
      navigate('/auth?reason=session-expired', { replace: true });
      return;
    }
    if (authStatus === 'authenticated' && (!isPinLockEnabled() || isPinSessionUnlocked())) {
      navigate('/', { replace: true });
    }
  }, [authStatus, navigate]);

  const handleUnlock = async () => {
    setError('');
    if (!/^\d{4}$/.test(pin)) {
      setError('Введите PIN из 4 цифр.');
      return;
    }
    setIsChecking(true);
    try {
      const ok = await verifyPinLock(pin);
      if (!ok) {
        setError('Неверный PIN.');
        return;
      }
      markPinSessionUnlocked();
      navigate('/', { replace: true });
    } catch {
      setError('Не удалось проверить PIN. Попробуйте снова.');
    } finally {
      setIsChecking(false);
    }
  };

  const handleOtherSignIn = async () => {
    clearPinSessionUnlocked();
    navigate('/auth?reason=pin-bypass', { replace: true });
  };

  const handleSignOut = async () => {
    clearPinSessionUnlocked();
    if (supabase) {
      await supabase.auth.signOut();
    }
    navigate('/auth', { replace: true });
  };

  const handleResetPin = () => {
    clearPinLock();
    navigate('/', { replace: true });
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-white px-4">
      <div className="w-full max-w-md rounded-xl border border-gray-200 p-6 space-y-4">
        <h1 className="text-xl font-semibold text-gray-900">Введите PIN</h1>
        <p className="text-sm text-gray-600">Введите локальный PIN для доступа к приложению.</p>

        {error && (
          <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg text-sm">
            {error}
          </div>
        )}

        <OtpCodeInput
          id="pinUnlock"
          value={pin}
          onChange={setPin}
          disabled={isChecking}
          label="PIN"
          placeholder="Введите 4 цифры"
          minLength={4}
          maxLength={4}
        />

        <div className="space-y-3">
          <button
            type="button"
            onClick={handleUnlock}
            disabled={isChecking}
            className="w-full bg-black text-white px-6 py-3 rounded-lg font-semibold hover:bg-gray-800 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {isChecking ? 'Проверяем...' : 'Разблокировать'}
          </button>
          <button
            type="button"
            onClick={handleOtherSignIn}
            className="w-full border border-gray-300 text-gray-800 px-6 py-3 rounded-lg font-semibold hover:bg-gray-50 transition-colors"
          >
            Войти другим способом
          </button>
          <button
            type="button"
            onClick={handleSignOut}
            className="w-full border border-red-300 text-red-700 px-6 py-3 rounded-lg font-semibold hover:bg-red-50 transition-colors"
          >
            Выйти из аккаунта
          </button>
          <button
            type="button"
            onClick={handleResetPin}
            className="w-full border border-gray-300 text-gray-800 px-6 py-3 rounded-lg font-semibold hover:bg-gray-50 transition-colors"
          >
            Сбросить PIN
          </button>
        </div>
      </div>
    </div>
  );
};

export default PinUnlock;
