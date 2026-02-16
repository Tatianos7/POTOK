import { useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { isPinLockEnabled, isPinOfferSkipped, markPinOfferSkipped } from '../services/pinLockService';

const PinOffer = () => {
  const navigate = useNavigate();
  const { authStatus } = useAuth();

  useEffect(() => {
    if (authStatus === 'unauthenticated') {
      navigate('/auth', { replace: true });
      return;
    }
    if (isPinLockEnabled() || isPinOfferSkipped()) {
      navigate('/', { replace: true });
    }
  }, [authStatus, navigate]);

  const handleSkip = () => {
    markPinOfferSkipped();
    navigate('/', { replace: true });
  };

  const handleCreatePin = () => {
    navigate('/pin/setup', { replace: true });
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-white px-4">
      <div className="w-full max-w-md rounded-xl border border-gray-200 p-6 space-y-4">
        <h1 className="text-xl font-semibold text-gray-900">Создать PIN-код?</h1>
        <p className="text-sm text-gray-600">PIN-код позволит быстрее входить в приложение на этом устройстве.</p>

        <div className="space-y-3">
          <button
            type="button"
            onClick={handleCreatePin}
            className="w-full bg-black text-white px-6 py-3 rounded-lg font-semibold hover:bg-gray-800 transition-colors"
          >
            Создать PIN-code
          </button>
          <button
            type="button"
            onClick={handleSkip}
            className="w-full border border-gray-300 text-gray-800 px-6 py-3 rounded-lg font-semibold hover:bg-gray-50 transition-colors"
          >
            Пропустить
          </button>
        </div>
      </div>
    </div>
  );
};

export default PinOffer;
