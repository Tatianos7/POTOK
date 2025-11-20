import { useState, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { useTheme } from '../context/ThemeContext';
import { X, Camera, Moon, Sun } from 'lucide-react';

const Profile = () => {
  const { user } = useAuth();
  const { theme, toggleTheme } = useTheme();
  const navigate = useNavigate();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [avatar, setAvatar] = useState<string | null>(
    localStorage.getItem(`avatar_${user?.id}`) || null
  );

  const handleAvatarClick = () => {
    fileInputRef.current?.click();
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onloadend = () => {
        const result = reader.result as string;
        setAvatar(result);
        if (user?.id) {
          localStorage.setItem(`avatar_${user.id}`, result);
        }
      };
      reader.readAsDataURL(file);
    }
  };

  const handleClose = () => {
    navigate('/');
  };

  const profile = user?.profile;

  const formatAge = (value?: number) => {
    if (!value) return '';
    const lastDigit = value % 10;
    const lastTwoDigits = value % 100;
    if (lastTwoDigits >= 11 && lastTwoDigits <= 14) {
      return `${value} лет`;
    }
    if (lastDigit === 1) {
      return `${value} год`;
    }
    if (lastDigit >= 2 && lastDigit <= 4) {
      return `${value} года`;
    }
    return `${value} лет`;
  };

  const handleEdit = () => {
    navigate('/profile/edit');
  };

  const profileMenuItems = [
    { id: 'edit', label: 'РЕДАКТИРОВАТЬ ПРОФИЛЬ', action: handleEdit },
    { id: 'theme', label: 'СМЕНИТЬ ТЕМУ', icon: theme === 'dark' ? Sun : Moon, action: toggleTheme },
    { id: 'password', label: 'СМЕНИТЬ ПАРОЛЬ' },
    { id: 'subscription', label: 'УПРАВЛЕНИЕ ПОДПИСКОЙ', isActive: true },
    { id: 'history', label: 'ИСТОРИЯ ОПЛАТЫ' },
    { id: 'terms', label: 'УСЛОВИЯ ИСПОЛЬЗОВАНИЯ' },
    { id: 'offer', label: 'ОФЕРТА' },
    { id: 'privacy', label: 'ПОЛИТИКА КОНФИДЕНЦИАЛЬНОСТИ' },
  ];

  return (
    <div className="min-h-screen bg-white" style={{ minWidth: '360px' }}>
      <div className="max-w-[1024px] mx-auto">
        {/* Header */}
        <header className="px-4 py-4 flex items-center justify-between border-b border-gray-200">
          <div className="flex-1"></div>
          <h1 className="text-lg font-semibold text-gray-900 flex-1 text-center">
            Профиль
          </h1>
          <div className="flex-1 flex justify-end">
            <button
              onClick={handleClose}
              className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
              aria-label="Закрыть"
            >
              <X className="w-6 h-6 text-gray-700" />
            </button>
          </div>
        </header>

        {/* Profile Content */}
        <main className="px-4 py-6">
          {/* Profile Info */}
          <div className="flex items-start gap-4 mb-6">
            {/* Avatar */}
            <div className="relative">
              <div
                onClick={handleAvatarClick}
                className="w-[90px] h-[90px] rounded-lg bg-gray-200 flex items-center justify-center overflow-hidden cursor-pointer hover:opacity-80 transition-opacity"
              >
                {avatar ? (
                  <img
                    src={avatar}
                    alt="Avatar"
                    className="w-full h-full object-cover"
                  />
                ) : (
                  <div className="w-full h-full bg-gray-300 flex items-center justify-center">
                    <Camera className="w-8 h-8 text-gray-500" />
                  </div>
                )}
              </div>
              <input
                ref={fileInputRef}
                type="file"
                accept="image/*"
                onChange={handleFileChange}
                className="hidden"
              />
              <button
                onClick={handleAvatarClick}
                className="absolute -bottom-1 -right-1 w-6 h-6 bg-primary-600 rounded-full flex items-center justify-center hover:bg-primary-700 transition-colors"
                aria-label="Загрузить фото"
              >
                <Camera className="w-3 h-3 text-white" />
              </button>
            </div>

            {/* User Info */}
            <div className="flex-1">
              <h2 className="text-lg font-semibold text-gray-900 mb-2">
                {profile?.lastName && `${profile.lastName} `}
                {profile?.firstName || user?.name || 'Пользователь'}
                {profile?.middleName && ` ${profile.middleName}`}
              </h2>
              <div className="space-y-2">
                <div className="flex flex-wrap gap-2">
                  {profile?.birthDate && (
                    <span className="px-3 py-1 rounded-full bg-gray-100 text-xs text-gray-700">
                      {new Date(profile.birthDate).toLocaleDateString('ru-RU')}
                    </span>
                  )}
                  {profile?.age && (
                    <span className="px-3 py-1 rounded-full bg-gray-100 text-xs text-gray-700">
                      {formatAge(profile.age)}
                    </span>
                  )}
                  {profile?.height && (
                    <span className="px-3 py-1 rounded-full bg-gray-100 text-xs text-gray-700">
                      {profile.height} см
                    </span>
                  )}
                  {profile?.goal && (
                    <span className="px-3 py-1 rounded-full bg-gray-100 text-xs text-gray-700">
                      Цель: {profile.goal}
                    </span>
                  )}
                </div>
              </div>
            </div>
          </div>

          {/* Contact Info */}
          <div className="mb-6 space-y-2 text-sm">
            <p className="text-gray-900">
              <span className="font-semibold">Тариф:</span>{' '}
              <span className={user?.hasPremium ? 'text-primary-600' : 'text-gray-600'}>
                {user?.hasPremium ? 'PREMIUM' : 'FREE'}
              </span>
            </p>
            <p className="text-gray-600">{profile?.email || 'Email не указан'}</p>
            <p className="text-gray-600">{profile?.phone || 'Телефон не указан'}</p>
          </div>

          {/* Menu Items */}
          <div className="space-y-2">
            {profileMenuItems.map((item) => {
              const IconComponent = item.icon;
              const isThemeButton = item.id === 'theme';
              const baseClasses =
                'w-full py-3 px-4 rounded-[13px] text-center font-semibold text-sm uppercase transition-colors flex items-center justify-center gap-2';
              let variantClasses = '';

              if (isThemeButton) {
                variantClasses =
                  theme === 'light'
                    ? 'bg-gray-900 text-white border border-gray-900 hover:bg-gray-800'
                    : 'bg-white text-gray-900 border border-gray-200 hover:bg-gray-50';
              } else if (item.isActive) {
                variantClasses = 'bg-gray-900 text-white';
              } else {
                variantClasses = 'bg-white text-gray-900 border border-gray-200 hover:bg-gray-50';
              }

              return (
                <button
                  key={item.id}
                  className={`${baseClasses} ${variantClasses}`}
                  onClick={item.action ? () => item.action?.() : undefined}
                >
                  <span>{item.label}</span>
                  {IconComponent && (
                    <IconComponent className="w-4 h-4" />
                  )}
                </button>
              );
            })}
          </div>
        </main>
      </div>
    </div>
  );
};

export default Profile;

