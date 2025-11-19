import { useState, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { X, Camera, Moon } from 'lucide-react';

const Profile = () => {
  const { user } = useAuth();
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

  const profileMenuItems = [
    { id: 'edit', label: 'РЕДАКТИРОВАТЬ ПРОФИЛЬ' },
    { id: 'theme', label: 'СМЕНИТЬ ТЕМУ', icon: Moon },
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
                {user?.name || 'Пользователь'}
              </h2>
              <div className="space-y-1 text-sm text-gray-600">
                <p>20 мая 1987</p>
                <p>Рост: 165 см</p>
                <p>Возраст: 38 лет</p>
                <p>Цель: похудеть</p>
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
            <p className="text-gray-600">{user?.email}</p>
            <p className="text-gray-600">+79775067847</p>
          </div>

          {/* Menu Items */}
          <div className="space-y-2">
            {profileMenuItems.map((item) => {
              const IconComponent = item.icon;
              return (
                <button
                  key={item.id}
                  className={`w-full py-3 px-4 rounded-[13px] text-center font-semibold text-sm uppercase transition-colors flex items-center justify-center gap-2 ${
                    item.isActive
                      ? 'bg-gray-900 text-white'
                      : 'bg-white text-gray-900 border border-gray-200 hover:bg-gray-50'
                  }`}
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

