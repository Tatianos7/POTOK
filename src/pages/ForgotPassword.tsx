import { useState, useEffect } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { useTheme } from '../context/ThemeContext';

const ForgotPassword = () => {
  const { requestPasswordReset } = useAuth();
  const navigate = useNavigate();
  const { setThemeExplicit } = useTheme();
  const [email, setEmail] = useState('');
  const [error, setError] = useState('');
  const [status, setStatus] = useState('');
  const [isLoading, setIsLoading] = useState(false);

  // Принудительно устанавливаем светлую тему для неавторизованных пользователей
  useEffect(() => {
    setThemeExplicit('light');
  }, [setThemeExplicit]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setStatus('');

    setIsLoading(true);
    try {
      await requestPasswordReset({ email });
      setStatus('Ссылка для восстановления отправлена на email');
      setTimeout(() => navigate('/login'), 1500);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Не удалось отправить ссылку');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center px-4 bg-white">
      <div className="w-full max-w-md">
        <div className="text-center mb-8">
          <h1 className="text-3xl font-bold text-gray-900 mb-2">ПОТОК</h1>
          <p className="text-gray-600">Восстановление доступа</p>
        </div>

        <form onSubmit={handleSubmit} className="bg-white rounded-xl shadow-md p-6 space-y-4">
          {error && (
            <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg text-sm">
              {error}
            </div>
          )}
          {status && (
            <div className="bg-green-50 border border-green-200 text-green-700 px-4 py-3 rounded-lg text-sm">
              {status}
            </div>
          )}

          <div>
            <label htmlFor="email" className="block text-sm font-medium text-gray-700 mb-1">
              Email
            </label>
            <input
              id="email"
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
              className="input-field"
              placeholder="your@email.com"
            />
          </div>

          <button
            type="submit"
            disabled={isLoading}
            className="w-full min-[768px]:button-limited bg-black text-white px-6 py-3 rounded-lg font-semibold hover:bg-gray-800 active:bg-gray-900 transition-colors disabled:opacity-50"
          >
            {isLoading ? 'Отправка...' : 'Отправить ссылку'}
          </button>

          <div className="text-center text-sm text-gray-600">
            Вспомнили пароль?{' '}
            <Link to="/login" className="text-primary-600 font-semibold hover:underline">
              Войти
            </Link>
          </div>
        </form>
      </div>
    </div>
  );
};

export default ForgotPassword;

