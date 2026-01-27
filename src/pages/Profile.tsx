import { useState, useRef, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { useTheme } from '../context/ThemeContext';
import { X, Camera, Moon, Sun } from 'lucide-react';
import ChangePasswordModal from '../components/ChangePasswordModal';
import SubscriptionManagement from '../pages/SubscriptionManagement';
import PaymentHistoryModal from '../components/PaymentHistoryModal';
import PrivacyPolicyModal from '../components/PrivacyPolicyModal';
import { profileService } from '../services/profileService';
import { uiRuntimeAdapter, type RuntimeStatus } from '../services/uiRuntimeAdapter';
import ExplainabilityDrawer from '../components/ExplainabilityDrawer';
import type { BaseExplainabilityDTO } from '../types/explainability';
import { classifyTrustDecision } from '../services/trustSafetyService';

const Profile = () => {
  const { user } = useAuth();
  const { theme, toggleTheme } = useTheme();
  const navigate = useNavigate();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [avatar, setAvatar] = useState<string | null>(null);
  const [isChangePasswordOpen, setIsChangePasswordOpen] = useState(false);
  const [isPrivacyPolicyOpen, setIsPrivacyPolicyOpen] = useState(false);
  const [runtimeStatus, setRuntimeStatus] = useState<RuntimeStatus>('loading');
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [trustMessage, setTrustMessage] = useState<string | null>(null);
  const [explainability, setExplainability] = useState<BaseExplainabilityDTO | null>(null);
  const [profileData, setProfileData] = useState<any>(null);
  const [entitlements, setEntitlements] = useState<any>(null);

  const loadProfileState = useCallback(async () => {
    if (!user?.id) return;
    setRuntimeStatus('loading');
    setErrorMessage(null);
    setTrustMessage(null);
    uiRuntimeAdapter.startLoadingTimer('Profile', {
      pendingSources: ['user_profiles', 'entitlements'],
      onTimeout: () => {
        const decision = classifyTrustDecision('loading_timeout');
        setRuntimeStatus('error');
        setErrorMessage('Загрузка профиля заняла слишком много времени.');
        setTrustMessage(decision.message);
      },
    });
    try {
      const state = await uiRuntimeAdapter.getProfileState(user.id);
      setRuntimeStatus(state.status);
      setExplainability((state.explainability as BaseExplainabilityDTO) ?? null);
      setTrustMessage(state.trust?.message ?? null);
      setProfileData(state.profile ?? null);
      setEntitlements(state.entitlements ?? null);
      if (state.status === 'error') {
        setErrorMessage(state.message || 'Не удалось загрузить профиль.');
      }
    } catch (error) {
      const decision = classifyTrustDecision(error);
      setRuntimeStatus('error');
      setErrorMessage('Не удалось загрузить профиль.');
      setTrustMessage(decision.message);
    } finally {
      uiRuntimeAdapter.clearLoadingTimer('Profile');
    }
  }, [user?.id]);

  // Загружаем аватар из Supabase при монтировании
  useEffect(() => {
    if (user?.id) {
      profileService.getAvatar(user.id).then((avatarUrl) => {
        if (avatarUrl) {
          setAvatar(avatarUrl);
        } else {
          // Fallback to localStorage
          const localAvatar = localStorage.getItem(`avatar_${user.id}`);
          if (localAvatar) {
            setAvatar(localAvatar);
          }
        }
      });
    }
  }, [user?.id]);

  useEffect(() => {
    loadProfileState();
  }, [loadProfileState]);

  const handleAvatarClick = () => {
    fileInputRef.current?.click();
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file && user?.id) {
      const reader = new FileReader();
      reader.onloadend = () => {
        const result = reader.result as string;
        setAvatar(result);
        // Сохраняем в localStorage для быстрого доступа
        localStorage.setItem(`avatar_${user.id}`, result);
        // Синхронизируем с Supabase
        void profileService.saveAvatar(user.id, result);
      };
      reader.readAsDataURL(file);
    }
  };

  const handleClose = () => {
    navigate('/');
  };

  const profile = profileData || user?.profile;

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

  const handleChangePassword = () => {
    setIsChangePasswordOpen(true);
  };

  const [isSubscriptionOpen, setIsSubscriptionOpen] = useState(false);
  const [isHistoryOpen, setIsHistoryOpen] = useState(false);

  const handleSubscription = () => {
    setIsSubscriptionOpen(true);
  };

  const handleHistory = () => {
    setIsHistoryOpen(true);
  };

  const handlePrivacyPolicy = () => {
    setIsPrivacyPolicyOpen(true);
  };

  const profileMenuItems = [
    { id: 'edit', label: 'РЕДАКТИРОВАТЬ ПРОФИЛЬ', action: handleEdit },
    { id: 'theme', label: 'СМЕНИТЬ ТЕМУ', icon: theme === 'dark' ? Sun : Moon, action: toggleTheme },
    { id: 'password', label: 'СМЕНИТЬ ПАРОЛЬ', action: handleChangePassword },
    { id: 'subscription', label: 'УПРАВЛЕНИЕ ПОДПИСКОЙ', isActive: true, action: handleSubscription },
    { id: 'history', label: 'ИСТОРИЯ ОПЛАТЫ', action: handleHistory },
    { id: 'terms', label: 'УСЛОВИЯ ИСПОЛЬЗОВАНИЯ' },
    { id: 'offer', label: 'ОФЕРТА' },
    { id: 'privacy', label: 'ПОЛИТИКА КОНФИДЕНЦИАЛЬНОСТИ', action: handlePrivacyPolicy },
  ];

  return (
    <div className="min-h-screen bg-white w-full min-w-[320px]">
      <div className="container-responsive">
        {/* Header */}
        <header className="py-4 flex items-center justify-between border-b border-gray-200">
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
        <main className="py-4 tablet:py-6">
          {runtimeStatus === 'offline' && (
            <div className="mb-4 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800">
              Работаем офлайн. Данные могут быть неактуальны.
              <button
                onClick={() => {
                  uiRuntimeAdapter.revalidate().finally(loadProfileState);
                }}
                className="ml-3 rounded-lg border border-amber-300 px-2.5 py-1 text-xs font-semibold text-amber-800 hover:bg-amber-100"
              >
                Обновить
              </button>
            </div>
          )}
          {runtimeStatus === 'recovery' && (
            <div className="mb-4 rounded-xl border border-blue-200 bg-blue-50 px-4 py-3 text-sm text-blue-800">
              Идёт восстановление данных. Продолжаем безопасно.
            </div>
          )}
          {runtimeStatus === 'partial' && (
            <div className="mb-4 rounded-xl border border-gray-200 bg-gray-50 px-4 py-3 text-sm text-gray-700">
              Данные профиля доступны частично. Мы покажем доступное.
            </div>
          )}
          {runtimeStatus === 'error' && (
            <div className="mb-4 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800">
              <div className="flex flex-col gap-2 mobile-lg:flex-row mobile-lg:items-center mobile-lg:justify-between">
                <span>{errorMessage || 'Не удалось загрузить профиль.'}</span>
                {trustMessage && <span className="text-xs text-red-700">{trustMessage}</span>}
                <button
                  onClick={() => {
                    uiRuntimeAdapter.recover().finally(loadProfileState);
                  }}
                  className="rounded-lg border border-red-300 px-3 py-1.5 text-xs font-semibold text-red-800 hover:bg-red-100"
                >
                  Повторить
                </button>
              </div>
            </div>
          )}
          {runtimeStatus === 'loading' && (
            <div className="flex items-center justify-center py-8">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-green-500"></div>
            </div>
          )}
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
              <span className={profile?.has_premium || user?.hasPremium ? 'text-primary-600' : 'text-gray-600'}>
                {profile?.has_premium || user?.hasPremium ? 'PREMIUM' : 'FREE'}
              </span>
            </p>
            <p className="text-gray-600">{profile?.email || 'Email не указан'}</p>
            <p className="text-gray-600">{profile?.phone || 'Телефон не указан'}</p>
            {entitlements?.tier && (
              <p className="text-gray-600">
                <span className="font-semibold">Entitlement:</span> {entitlements.tier}
              </p>
            )}
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
          <div className="mt-6 rounded-2xl border border-gray-200 p-4 space-y-3">
            <h3 className="text-sm font-semibold text-gray-900">Данные и права</h3>
            <p className="text-xs text-gray-600">
              Ваши данные принадлежат вам. Мы обеспечиваем прозрачность и контроль.
            </p>
            <div className="flex flex-col gap-2">
              <button className="rounded-xl border border-gray-300 py-2 text-xs font-semibold uppercase text-gray-700">
                Экспорт данных
              </button>
              <button className="rounded-xl border border-red-300 py-2 text-xs font-semibold uppercase text-red-600">
                Удалить аккаунт
              </button>
              <button className="rounded-xl border border-gray-300 py-2 text-xs font-semibold uppercase text-gray-700">
                Юридические согласия (РФ)
              </button>
            </div>
          </div>
          <div className="mt-6">
            <ExplainabilityDrawer explainability={explainability} />
          </div>
        </main>
      </div>

      {/* Change Password Modal */}
      <ChangePasswordModal
        isOpen={isChangePasswordOpen}
        onClose={() => setIsChangePasswordOpen(false)}
      />

      {/* Subscription Management Modal */}
      {isSubscriptionOpen && (
        <SubscriptionManagement onClose={() => setIsSubscriptionOpen(false)} />
      )}

      {isHistoryOpen && (
        <PaymentHistoryModal
          isOpen={isHistoryOpen}
          onClose={() => setIsHistoryOpen(false)}
          userId={user?.id}
        />
      )}

      {/* Privacy Policy Modal */}
      <PrivacyPolicyModal
        isOpen={isPrivacyPolicyOpen}
        onClose={() => setIsPrivacyPolicyOpen(false)}
      />
    </div>
  );
};

export default Profile;

