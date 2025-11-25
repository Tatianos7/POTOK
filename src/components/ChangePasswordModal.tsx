import { useState } from 'react';
import { X, Eye, EyeOff } from 'lucide-react';
import { useAuth } from '../context/AuthContext';

interface ChangePasswordModalProps {
  isOpen: boolean;
  onClose: () => void;
}

const ChangePasswordModal = ({ isOpen, onClose }: ChangePasswordModalProps) => {
  const { resetPassword, user } = useAuth();
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showNewPassword, setShowNewPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [error, setError] = useState('');
  const [status, setStatus] = useState('');
  const [isLoading, setIsLoading] = useState(false);

  const validatePassword = (password: string): boolean => {
    return password.length >= 6;
  };

  const passwordsMatch = (): boolean => {
    return newPassword === confirmPassword && newPassword.length > 0;
  };

  const getPasswordFieldStyle = (value: string, isConfirm: boolean = false): string => {
    if (!value) {
      return 'border-gray-300 dark:border-gray-600';
    }

    if (isConfirm) {
      if (!validatePassword(value)) {
        return 'border-red-500';
      }
      if (passwordsMatch()) {
        return 'border-green-500';
      }
      return 'border-red-500';
    } else {
      if (!validatePassword(value)) {
        return 'border-red-500';
      }
      if (passwordsMatch()) {
        return 'border-green-500';
      }
      return 'border-gray-300 dark:border-gray-600';
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setStatus('');

    if (!validatePassword(newPassword)) {
      setError('Пароль должен содержать не менее 6 символов');
      return;
    }

    if (newPassword !== confirmPassword) {
      setError('Пароли не совпадают');
      return;
    }

    if (!user?.email && !user?.phone) {
      setError('Не указан email или телефон для смены пароля');
      return;
    }

    setIsLoading(true);
    try {
      const identifier = user?.email || user?.phone || '';
      await resetPassword({
        identifier,
        newPassword,
      });
      setStatus('Пароль успешно изменен');
      setTimeout(() => {
        onClose();
        setNewPassword('');
        setConfirmPassword('');
        setError('');
        setStatus('');
      }, 2000);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Ошибка смены пароля');
    } finally {
      setIsLoading(false);
    }
  };

  const handleClose = () => {
    setNewPassword('');
    setConfirmPassword('');
    setError('');
    setStatus('');
    setShowNewPassword(false);
    setShowConfirmPassword(false);
    onClose();
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-50 px-4">
      <div className="bg-white dark:bg-gray-800 rounded-2xl w-full max-w-md shadow-xl">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-200 dark:border-gray-700">
          <h2 className="text-lg font-bold uppercase text-gray-900 dark:text-white">
            СМЕНА ПАРОЛЯ
          </h2>
          <button
            onClick={handleClose}
            className="p-2 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg transition-colors"
            aria-label="Закрыть"
          >
            <X className="w-5 h-5 text-gray-500 dark:text-gray-400" />
          </button>
        </div>

        {/* Content */}
        <form onSubmit={handleSubmit} className="px-6 py-6 space-y-4">
          {error && (
            <div className="bg-red-50 dark:bg-red-900 border border-red-200 dark:border-red-700 text-red-700 dark:text-red-300 px-4 py-3 rounded-lg text-sm">
              {error}
            </div>
          )}
          {status && (
            <div className="bg-green-50 dark:bg-green-900 border border-green-200 dark:border-green-700 text-green-700 dark:text-green-300 px-4 py-3 rounded-lg text-sm">
              {status}
            </div>
          )}

          <p className="text-sm text-gray-600 dark:text-gray-400">
            *Придумайте новый надежный пароль
          </p>

          {/* New Password Field */}
          <div>
            <div className="relative">
              <input
                type={showNewPassword ? 'text' : 'password'}
                value={newPassword}
                onChange={(e) => {
                  setNewPassword(e.target.value);
                  setError('');
                }}
                placeholder="Новый пароль"
                className={`w-full px-4 py-3 pr-12 rounded-lg border-2 bg-white dark:bg-gray-700 text-gray-900 dark:text-white placeholder:text-gray-500 dark:placeholder:text-gray-400 focus:outline-none transition-colors ${getPasswordFieldStyle(newPassword)}`}
                required
              />
              <button
                type="button"
                onClick={() => setShowNewPassword(!showNewPassword)}
                className="absolute right-3 top-1/2 -translate-y-1/2 p-1 text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-300 transition-colors"
                aria-label={showNewPassword ? 'Скрыть пароль' : 'Показать пароль'}
              >
                {showNewPassword ? (
                  <EyeOff className="w-5 h-5" />
                ) : (
                  <Eye className="w-5 h-5" />
                )}
              </button>
            </div>
            {newPassword && !validatePassword(newPassword) && (
              <p className="mt-1 text-xs text-red-500">Пароль должен содержать не менее 6 символов</p>
            )}
          </div>

          {/* Confirm Password Field */}
          <div>
            <label className="block text-sm text-gray-700 dark:text-gray-300 mb-1">
              повторите пароль
            </label>
            <div className="relative">
              <input
                type={showConfirmPassword ? 'text' : 'password'}
                value={confirmPassword}
                onChange={(e) => {
                  setConfirmPassword(e.target.value);
                  setError('');
                }}
                placeholder="Повторите пароль"
                className={`w-full px-4 py-3 pr-12 rounded-lg border-2 bg-white dark:bg-gray-700 text-gray-900 dark:text-white placeholder:text-gray-500 dark:placeholder:text-gray-400 focus:outline-none transition-colors ${getPasswordFieldStyle(confirmPassword, true)}`}
                required
              />
              <button
                type="button"
                onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                className="absolute right-3 top-1/2 -translate-y-1/2 p-1 text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-300 transition-colors"
                aria-label={showConfirmPassword ? 'Скрыть пароль' : 'Показать пароль'}
              >
                {showConfirmPassword ? (
                  <EyeOff className="w-5 h-5" />
                ) : (
                  <Eye className="w-5 h-5" />
                )}
              </button>
            </div>
            {confirmPassword && newPassword !== confirmPassword && (
              <p className="mt-1 text-xs text-red-500">Пароли не совпадают</p>
            )}
          </div>

          {/* Submit Button */}
          <button
            type="submit"
            disabled={isLoading || !validatePassword(newPassword) || !passwordsMatch()}
            className="w-full bg-gray-900 dark:bg-white dark:text-gray-900 text-white px-6 py-3 rounded-lg font-semibold hover:bg-gray-800 dark:hover:bg-gray-200 transition-colors disabled:opacity-50 disabled:cursor-not-allowed uppercase"
          >
            {isLoading ? 'Сохранение...' : 'ПОДТВЕРДИТЬ'}
          </button>
        </form>

        {/* Footer */}
        <div className="px-6 py-4 border-t border-gray-200 dark:border-gray-700 text-center">
          <p className="text-sm text-gray-600 dark:text-gray-400">ПОТОК</p>
        </div>
      </div>
    </div>
  );
};

export default ChangePasswordModal;

