import { useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { useTheme } from '../context/ThemeContext';
import { X } from 'lucide-react';

const EditProfile = () => {
  const { user, updateProfile, deleteAccount } = useAuth();
  const { theme } = useTheme();
  const navigate = useNavigate();
  const [form, setForm] = useState({
    firstName: user?.profile.firstName || '',
    lastName: user?.profile.lastName || '',
    middleName: user?.profile.middleName || '',
    birthDate: user?.profile.birthDate || '',
    age: user?.profile.age?.toString() || '',
    height: user?.profile.height?.toString() || '',
    goal: user?.profile.goal || '',
    email: user?.profile.email || user?.email || '',
    phone: user?.profile.phone || user?.phone || '',
  });
  const [status, setStatus] = useState('');
  const [error, setError] = useState('');
  const [isSaving, setIsSaving] = useState(false);
  const [isDeleteConfirmOpen, setIsDeleteConfirmOpen] = useState(false);
  const [isReasonModalOpen, setIsReasonModalOpen] = useState(false);
  const [isDeletedModalOpen, setIsDeletedModalOpen] = useState(false);
  const [reasonError, setReasonError] = useState('');
  const [selectedReason, setSelectedReason] = useState('');
  const birthInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (!user) {
      navigate('/login');
      return;
    }
    
    // Инициализируем форму с данными пользователя
    if (user.profile) {
      const initialAge = user.profile.age?.toString() || 
        (user.profile.birthDate ? calculateAge(user.profile.birthDate) : '');
      
      setForm({
        firstName: user.profile.firstName || '',
        lastName: user.profile.lastName || '',
        middleName: user.profile.middleName || '',
        birthDate: user.profile.birthDate || '',
        age: initialAge,
        height: user.profile.height?.toString() || '',
        goal: user.profile.goal || '',
        email: user.profile.email || user.email || '',
        phone: user.profile.phone || user.phone || '',
      });
    }
  }, [user, navigate]);

  const calculateAge = (birthDate: string) => {
    if (!birthDate) return '';
    try {
      const today = new Date();
      const birth = new Date(birthDate);
      
      // Проверяем, что дата валидна
      if (isNaN(birth.getTime())) {
        return '';
      }
      
      let age = today.getFullYear() - birth.getFullYear();
      const monthDiff = today.getMonth() - birth.getMonth();
      const dayDiff = today.getDate() - birth.getDate();
      
      // Если день рождения еще не наступил в этом году, уменьшаем возраст
      if (monthDiff < 0 || (monthDiff === 0 && dayDiff < 0)) {
        age--;
      }
      
      return age > 0 ? String(age) : '';
    } catch (error) {
      console.error('Ошибка расчета возраста:', error);
      return '';
    }
  };

  const handleChange =
    (field: keyof typeof form) => (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) => {
      const value = e.target.value;
      setForm((prev) => {
        if (field === 'birthDate') {
          const calculatedAge = calculateAge(value);
          return { ...prev, birthDate: value, age: calculatedAge };
        }
        return { ...prev, [field]: value };
      });
    };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user) return;
    setStatus('');
    setError('');
    setIsSaving(true);
    try {
      await updateProfile({
        firstName: form.firstName,
        lastName: form.lastName || undefined,
        middleName: form.middleName || undefined,
        birthDate: form.birthDate || undefined,
        age: form.age ? Number(form.age) : undefined,
        height: form.height ? Number(form.height) : undefined,
        goal: form.goal || undefined,
        email: form.email || undefined,
        phone: form.phone || undefined,
      });
      setStatus('Изменения сохранены');
      navigate('/profile');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Не удалось сохранить изменения');
    } finally {
      setIsSaving(false);
    }
  };

  const reasons = [
    'Не нуждаюсь больше в приложении',
    'Не удобное приложение',
    'Не интересно',
    'Дорогая подписка',
  ];

  const handleDeleteProfile = () => {
    if (!user) return;
    deleteAccount();
    setIsDeletedModalOpen(true);
  };

  const handleBack = () => navigate('/profile');

  const fieldClasses = 'input-field rounded-[13px] bg-gray-100 dark:bg-gray-700 text-gray-800 dark:text-white placeholder:text-gray-500 dark:placeholder:text-gray-400';

  return (
    <div className="min-h-screen bg-white dark:bg-gray-900" style={{ minWidth: '360px' }}>
      <div className="max-w-[1024px] mx-auto">
        <header className="px-4 py-4 flex items-center justify-between border-b border-gray-200">
          <div className="flex-1"></div>
          <h1 className="text-lg font-semibold text-gray-900 flex-1 text-center uppercase">
            Редактировать профиль
          </h1>
          <div className="flex-1 flex justify-end">
            <button
              onClick={handleBack}
              className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
              aria-label="Закрыть"
            >
              <X className="w-6 h-6 text-gray-700" />
            </button>
          </div>
        </header>

        <main className="px-4 py-6">
          <form onSubmit={handleSubmit} className="space-y-4">
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

            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-medium text-gray-600 dark:text-gray-400 mb-1">Имя</label>
                <input
                  type="text"
                  className={fieldClasses}
                  value={form.firstName}
                  onChange={handleChange('firstName')}
                  required
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-600 mb-1">Фамилия</label>
                <input
                  type="text"
                  className={fieldClasses}
                  value={form.lastName}
                  onChange={handleChange('lastName')}
                />
              </div>
            </div>

            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">Отчество</label>
              <input
                type="text"
                className={fieldClasses}
                value={form.middleName}
                onChange={handleChange('middleName')}
              />
            </div>

            <div className="grid grid-cols-1 gap-4">
              <div>
                <label className="block text-xs font-medium text-gray-600 mb-1">Дата рождения</label>
                <div className="relative">
                  <input
                    type="date"
                    ref={birthInputRef}
                    className={`${fieldClasses} pr-12 w-full date-input`}
                    value={form.birthDate}
                    onChange={handleChange('birthDate')}
                  />
                  <button
                    type="button"
                    onClick={() => birthInputRef.current?.showPicker?.()}
                    className="absolute inset-y-0 right-3 flex items-center text-gray-500 dark:text-gray-100"
                  >
                    <svg
                      className="w-5 h-5"
                      fill="currentColor"
                      viewBox="0 0 20 20"
                      aria-hidden="true"
                    >
                      <path d="M6 2a1 1 0 0 0-1 1v1H4a2 2 0 0 0-2 2v9a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V6a2 2 0 0 0-2-2h-1V3a1 1 0 1 0-2 0v1H7V3a1 1 0 0 0-1-1Zm9 6H5v7h10V8Z" />
                    </svg>
                  </button>
                </div>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-medium text-gray-600 mb-1">Лет</label>
                  <input
                    type="number"
                    className={`${fieldClasses} text-center`}
                    value={form.age}
                    onChange={handleChange('age')}
                    min={0}
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-gray-600 mb-1">Рост (см)</label>
                  <input
                    type="number"
                    className={`${fieldClasses} text-center`}
                    value={form.height}
                    onChange={handleChange('height')}
                    min={0}
                  />
                </div>
              </div>
            </div>

            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">Цель</label>
              <select
                className={fieldClasses}
                value={form.goal}
                onChange={handleChange('goal')}
              >
                <option value="">Выберите цель</option>
                <option value="Похудение">Похудение</option>
                <option value="Поддержка">Поддержание формы</option>
                <option value="Набор массы">Набор массы</option>
              </select>
            </div>

            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">E-mail</label>
              <input
                type="email"
                className={fieldClasses}
                value={form.email}
                onChange={handleChange('email')}
              />
            </div>

            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">Телефон</label>
              <input
                type="tel"
                className={fieldClasses}
                value={form.phone}
                onChange={handleChange('phone')}
                placeholder="+79775067847"
              />
            </div>

            <div className="pt-4 space-y-3">
              <button
                type="submit"
                className={`w-full px-6 py-3 rounded-[13px] font-semibold transition-colors disabled:opacity-60 ${
                  theme === 'dark'
                    ? 'bg-white text-black hover:bg-gray-100'
                    : 'bg-gray-900 text-white hover:bg-gray-800'
                }`}
                disabled={isSaving}
              >
                {isSaving ? 'Сохранение...' : 'Подтвердить изменения'}
              </button>
              <button
                type="button"
                onClick={() => setIsDeleteConfirmOpen(true)}
                className={`w-full px-6 py-3 rounded-[13px] font-semibold transition-colors ${
                  theme === 'dark'
                    ? 'bg-transparent text-white border-2 border-gray-300 hover:bg-gray-800'
                    : 'bg-white border-2 border-gray-900 text-gray-900 hover:bg-gray-50'
                }`}
              >
                Удалить профиль
              </button>
            </div>
          </form>
        </main>
      </div>

      {isDeleteConfirmOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 px-4">
          <div className="bg-white rounded-2xl w-full max-w-sm shadow-xl">
            <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100">
              <h2 className="text-sm font-semibold uppercase tracking-wide text-gray-900">
                Удаление профиля
              </h2>
              <button
                onClick={() => setIsDeleteConfirmOpen(false)}
                className="p-2 hover:bg-gray-100 rounded-full transition-colors"
                aria-label="Закрыть"
              >
                <X className="w-4 h-4 text-gray-500" />
              </button>
            </div>
            <div className="px-6 py-6 text-center space-y-6">
              <p className="text-sm font-semibold text-gray-800">
                Вы уверены что хотите удалить профиль?
              </p>
              <div className="flex gap-3">
                <button
                  type="button"
                  onClick={() => setIsDeleteConfirmOpen(false)}
                  className="flex-1 bg-black text-white py-3 rounded-[13px] font-semibold hover:bg-gray-800 transition-colors"
                >
                  НЕТ
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setIsDeleteConfirmOpen(false);
                    setIsReasonModalOpen(true);
                  }}
                  className="flex-1 border border-gray-300 text-gray-900 py-3 rounded-[13px] font-semibold hover:bg-gray-50 transition-colors"
                >
                  УДАЛИТЬ
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {isReasonModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 px-4">
          <div className="bg-white rounded-2xl w-full max-w-sm shadow-xl">
            <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100">
              <h2 className="text-sm font-semibold uppercase tracking-wide text-gray-900">
                Почему вы нас хотите покинуть?
              </h2>
              <button
                onClick={() => setIsReasonModalOpen(false)}
                className="p-2 hover:bg-gray-100 rounded-full transition-colors"
                aria-label="Закрыть"
              >
                <X className="w-4 h-4 text-gray-500" />
              </button>
            </div>
            <div className="px-6 py-6 space-y-3">
              {reasons.map((reason) => (
                <label key={reason} className="flex items-center gap-3 text-sm text-gray-800">
                  <input
                    type="radio"
                    name="deleteReason"
                    value={reason}
                    checked={selectedReason === reason}
                    onChange={(e) => {
                      setSelectedReason(e.target.value);
                      setReasonError('');
                    }}
                    className="w-4 h-4"
                  />
                  <span>{reason}</span>
                </label>
              ))}
              {reasonError && <p className="text-xs text-red-500">{reasonError}</p>}
            </div>
            <div className="px-6 pb-6">
              <button
                type="button"
                onClick={() => {
                  if (!selectedReason) {
                    setReasonError('Пожалуйста, выберите причину');
                    return;
                  }
                  setIsReasonModalOpen(false);
                  handleDeleteProfile();
                }}
                className="w-full border border-gray-300 text-gray-900 py-3 rounded-[13px] font-semibold hover:bg-gray-50 transition-colors"
              >
                УДАЛИТЬ
              </button>
            </div>
          </div>
        </div>
      )}

      {isDeletedModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 px-4">
          <div className="bg-white rounded-2xl w-full max-w-sm shadow-xl text-center space-y-4 px-6 py-6">
            <div className="flex justify-end">
              <button
                onClick={() => {
                  setIsDeletedModalOpen(false);
                  navigate('/register');
                }}
                className="p-2 hover:bg-gray-100 rounded-full transition-colors"
                aria-label="Закрыть"
              >
                <X className="w-4 h-4 text-gray-500" />
              </button>
            </div>
            <div className="space-y-2">
              <p className="text-sm font-semibold text-gray-900">Нам очень жаль!</p>
              <p className="text-sm text-gray-700">Ваш профиль удален</p>
            </div>
            <button
              type="button"
              onClick={() => navigate('/register')}
              className="text-green-600 font-semibold text-sm hover:underline"
            >
              OK
            </button>
          </div>
        </div>
      )}
    </div>
  );
};

export default EditProfile;

