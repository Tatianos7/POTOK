import { useState, useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { useTheme } from '../context/ThemeContext';

const Login = () => {
  const [identifier, setIdentifier] = useState('');
  const [otpCode, setOtpCode] = useState('');
  const [error, setError] = useState('');
  const [status, setStatus] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const { login, verifyOtp, isAuthenticated } = useAuth();
  const navigate = useNavigate();
  const { setThemeExplicit } = useTheme();

  // Принудительно устанавливаем светлую тему для неавторизованных пользователей
  useEffect(() => {
    setThemeExplicit('light');
  }, [setThemeExplicit]);

  useEffect(() => {
    if (isAuthenticated) {
      navigate('/');
    }
  }, [isAuthenticated, navigate]);

  const trimmedIdentifier = identifier.trim();
  const isEmail = trimmedIdentifier.includes('@');
  const isPhone = trimmedIdentifier.length > 0 && !isEmail;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setStatus('');
    setIsLoading(true);

    try {
      if (!otpCode) {
        await login({ identifier: trimmedIdentifier });
        if (isEmail) {
          setStatus('Ссылка для входа отправлена на email. Проверьте почту.');
        } else {
          setStatus('Код подтверждения отправлен по SMS.');
        }
      } else {
        await verifyOtp({ identifier: trimmedIdentifier, token: otpCode });
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Ошибка входа');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-white w-full min-w-[320px]">
      <div className="container-responsive w-full flex justify-center">
        <div className="w-full max-w-md">
        <div className="text-center mb-8">
          <h1 className="text-3xl font-bold text-gray-900 mb-2">ПОТОК</h1>
          <p className="text-gray-600">Войдите в свой аккаунт</p>
        </div>

          <form onSubmit={handleSubmit} className="bg-white rounded-xl p-6 space-y-4">
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
            <label htmlFor="identifier" className="block text-sm font-medium text-gray-700 mb-1">
              Email или телефон
            </label>
            <input
              id="identifier"
              type="text"
              value={identifier}
              onChange={(e) => setIdentifier(e.target.value)}
              required
              className="input-field"
              placeholder="your@email.com или +7 999 000 00 00"
            />
          </div>

          {isPhone && (
            <div>
              <label htmlFor="otpCode" className="block text-sm font-medium text-gray-700 mb-1">
                Код из SMS
              </label>
              <input
                id="otpCode"
                type="text"
                value={otpCode}
                onChange={(e) => setOtpCode(e.target.value)}
                className="input-field"
                placeholder="123456"
              />
            </div>
          )}

          <button
            type="submit"
            disabled={isLoading}
            className="w-full min-[768px]:button-limited bg-black text-white px-6 py-3 rounded-lg font-semibold hover:bg-gray-800 active:bg-gray-900 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {isLoading ? 'Отправка...' : otpCode ? 'Подтвердить' : 'Получить код'}
          </button>
          <div className="text-right">
            <Link to="/forgot-password" className="text-sm text-primary-600 font-semibold hover:underline">
              Забыли пароль?
            </Link>
          </div>

          <div className="text-center text-sm text-gray-600">
            Нет аккаунта?{' '}
            <Link to="/register" className="text-primary-600 font-semibold hover:underline">
              Зарегистрироваться
            </Link>
          </div>
          </form>
        </div>
      </div>
    </div>
  );
};

export default Login;
