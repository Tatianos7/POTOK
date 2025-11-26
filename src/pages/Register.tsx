import { useState, useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { useTheme } from '../context/ThemeContext';

const Register = () => {
  const [form, setForm] = useState({
    firstName: '',
    lastName: '',
    middleName: '',
    contact: '',
    password: '',
  });
  const [error, setError] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const { register } = useAuth();
  const navigate = useNavigate();
  const { setThemeExplicit } = useTheme();

  // Принудительно устанавливаем светлую тему для неавторизованных пользователей
  useEffect(() => {
    setThemeExplicit('light');
  }, [setThemeExplicit]);

  const handleChange = (field: keyof typeof form) => (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    setForm((prev) => ({ ...prev, [field]: e.target.value }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setIsLoading(true);

    if (!form.contact.trim()) {
      setError('Укажите email или номер телефона');
      setIsLoading(false);
      return;
    }

    const contactValue = form.contact.trim();
    const isEmail = contactValue.includes('@');

    try {
      await register({
        firstName: form.firstName,
        lastName: form.lastName || undefined,
        middleName: form.middleName || undefined,
        email: isEmail ? contactValue : undefined,
        phone: !isEmail ? contactValue : undefined,
        password: form.password,
      });
      navigate('/');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Ошибка регистрации');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center px-4 bg-gray-50">
      <div className="w-full max-w-[1024px] flex justify-center">
      <div className="w-full max-w-md">
        <div className="text-center mb-8">
          <h1 className="text-3xl font-bold text-gray-900 mb-2">POTOK</h1>
          <p className="text-gray-600">Создайте новый аккаунт</p>
        </div>

          <form onSubmit={handleSubmit} className="bg-white rounded-xl shadow-md p-6 space-y-4">
          {error && (
            <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg text-sm">
              {error}
            </div>
          )}

          <div className="grid grid-cols-1 gap-4">
          <div>
              <label htmlFor="firstName" className="block text-sm font-medium text-gray-700 mb-1">
                Имя <span className="text-red-500">*</span>
            </label>
            <input
                id="firstName"
              type="text"
                value={form.firstName}
                onChange={handleChange('firstName')}
              required
                className="input-field text-gray-900"
                placeholder="Иван"
              />
            </div>

            <div>
              <label htmlFor="lastName" className="block text-sm font-medium text-gray-700 mb-1">
                Фамилия
              </label>
              <input
                id="lastName"
                type="text"
                value={form.lastName}
                onChange={handleChange('lastName')}
                className="input-field text-gray-900"
                placeholder="Иванов"
            />
          </div>

          <div>
              <label htmlFor="middleName" className="block text-sm font-medium text-gray-700 mb-1">
                Отчество
            </label>
            <input
                id="middleName"
                type="text"
                value={form.middleName}
                onChange={handleChange('middleName')}
                className="input-field text-gray-900"
                placeholder="Иванович"
            />
          </div>

          <div>
              <label htmlFor="contact" className="block text-sm font-medium text-gray-700 mb-1">
                Email или телефон <span className="text-red-500">*</span>
            </label>
            <input
                id="contact"
                type="text"
                value={form.contact}
                onChange={handleChange('contact')}
              required
                className="input-field text-gray-900"
                placeholder="your@email.com или +7 999 000 00 00"
            />
          </div>

          <div>
              <label htmlFor="password" className="block text-sm font-medium text-gray-700 mb-1">
                Пароль <span className="text-red-500">*</span>
            </label>
            <input
                id="password"
              type="password"
                value={form.password}
                onChange={handleChange('password')}
              required
              minLength={6}
                className="input-field text-gray-900"
                placeholder="••••••••"
            />
            </div>
          </div>

          <button
            type="submit"
            disabled={isLoading}
            className="btn-primary w-full"
          >
            {isLoading ? 'Регистрация...' : 'Зарегистрироваться'}
          </button>

          <div className="text-center text-sm text-gray-600">
            Уже есть аккаунт?{' '}
            <Link to="/login" className="text-primary-600 font-semibold hover:underline">
              Войти
            </Link>
          </div>
          </form>
        </div>
      </div>
    </div>
  );
};

export default Register;
