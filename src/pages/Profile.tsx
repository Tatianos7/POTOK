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
import type { BaseExplainabilityDTO } from '../types/explainability';
import { classifyTrustDecision } from '../services/trustSafetyService';
import Card from '../ui/components/Card';
import StateContainer from '../ui/components/StateContainer';
import TrustBanner from '../ui/components/TrustBanner';
import ExplainabilityDrawer from '../ui/components/ExplainabilityDrawer';

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
  const subscriptionLabel = entitlements?.tier
    ? entitlements.tier.toUpperCase()
    : profile?.has_premium || user?.hasPremium
      ? 'PREMIUM'
      : 'FREE';
  const subscriptionStatus =
    entitlements?.status || (profile?.has_premium || user?.hasPremium ? 'active' : 'free');

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
    <div className="min-h-screen bg-white dark:bg-gray-900 w-full min-w-[320px]">
      <div className="container-responsive">
        {/* Header */}
        <header className="py-4 flex items-center justify-between border-b border-gray-200 dark:border-gray-700">
          <div className="flex-1" />
          <h1 className="text-lg font-semibold text-gray-900 dark:text-white flex-1 text-center uppercase">
            Профиль
          </h1>
          <div className="flex-1 flex justify-end">
            <button
              onClick={handleClose}
              className="p-2 hover:bg-gray-100 dark:hover:bg-gray-800 rounded-lg transition-colors"
              aria-label="Закрыть"
            >
              <X className="w-6 h-6 text-gray-700 dark:text-gray-300" />
            </button>
          </div>
        </header>

        {/* Profile Content */}
        <main className="py-4 tablet:py-6">
          <StateContainer
            status={runtimeStatus}
            message={runtimeStatus === 'empty' ? 'Профиль ещё не заполнен. Мы поможем начать.' : errorMessage || undefined}
            onRetry={() => {
              if (runtimeStatus === 'offline') {
                uiRuntimeAdapter.revalidate().finally(loadProfileState);
              } else {
                uiRuntimeAdapter.recover().finally(loadProfileState);
              }
            }}
          >
            <div className="space-y-4">
              <Card title="Мой профиль" action={<button onClick={handleEdit} className="text-xs text-gray-500">Редактировать</button>}>
                <div className="flex items-start gap-4">
                  <div className="relative">
                    <div
                      onClick={handleAvatarClick}
                      className="w-[90px] h-[90px] rounded-xl bg-gray-200 dark:bg-gray-800 flex items-center justify-center overflow-hidden cursor-pointer hover:opacity-80 transition-opacity"
                    >
                      {avatar ? (
                        <img src={avatar} alt="Avatar" className="w-full h-full object-cover" />
                      ) : (
                        <div className="w-full h-full bg-gray-300 dark:bg-gray-700 flex items-center justify-center">
                          <Camera className="w-8 h-8 text-gray-500 dark:text-gray-400" />
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
                      className="absolute -bottom-1 -right-1 w-6 h-6 bg-gray-900 dark:bg-white rounded-full flex items-center justify-center hover:opacity-90"
                      aria-label="Загрузить фото"
                    >
                      <Camera className="w-3 h-3 text-white dark:text-gray-900" />
                    </button>
                  </div>

                  <div className="flex-1">
                    <h2 className="text-lg font-semibold text-gray-900 dark:text-white mb-2">
                      {profile?.lastName && `${profile.lastName} `}
                      {profile?.firstName || user?.name || 'Пользователь'}
                      {profile?.middleName && ` ${profile.middleName}`}
                    </h2>
                    <div className="flex flex-wrap gap-2 text-xs text-gray-600 dark:text-gray-400">
                      {profile?.birthDate && (
                        <span className="px-3 py-1 rounded-full bg-gray-100 dark:bg-gray-800">
                          {new Date(profile.birthDate).toLocaleDateString('ru-RU')}
                        </span>
                      )}
                      {profile?.age && (
                        <span className="px-3 py-1 rounded-full bg-gray-100 dark:bg-gray-800">
                          {formatAge(profile.age)}
                        </span>
                      )}
                      {profile?.height && (
                        <span className="px-3 py-1 rounded-full bg-gray-100 dark:bg-gray-800">
                          {profile.height} см
                        </span>
                      )}
                      {profile?.goal && (
                        <span className="px-3 py-1 rounded-full bg-gray-100 dark:bg-gray-800">
                          Цель: {profile.goal}
                        </span>
                      )}
                    </div>
                    <p className="mt-2 text-xs text-gray-600 dark:text-gray-400">
                      Эти данные помогают делать рекомендации точнее и безопаснее.
                    </p>
                  </div>
                </div>
              </Card>

              <Card title="Подписка">
                <p className="text-xs text-gray-600 dark:text-gray-400">
                  Вы контролируете подписку и всегда можете изменить решение.
                </p>
                <div className="mt-3 grid grid-cols-2 gap-3 text-xs text-gray-700 dark:text-gray-300">
                  <div>Статус: {subscriptionStatus}</div>
                  <div>Тариф: {subscriptionLabel}</div>
                </div>
                <div className="mt-3 flex flex-wrap gap-2">
                  <button
                    onClick={handleSubscription}
                    className="rounded-xl bg-gray-900 text-white px-4 py-2 text-xs font-semibold uppercase dark:bg-white dark:text-gray-900"
                  >
                    Управление подпиской
                  </button>
                  <button
                    onClick={handleHistory}
                    className="rounded-xl border border-gray-300 px-4 py-2 text-xs font-semibold uppercase text-gray-700 dark:border-gray-700 dark:text-gray-200"
                  >
                    История оплат
                  </button>
                </div>
              </Card>

              <Card title="История платежей">
                <p className="text-xs text-gray-600 dark:text-gray-400">
                  Прозрачность — основа доверия. Все списания доступны в истории.
                </p>
                <button
                  onClick={handleHistory}
                  className="mt-3 w-full rounded-xl border border-gray-300 py-2 text-xs font-semibold uppercase text-gray-700 dark:border-gray-700 dark:text-gray-200"
                >
                  Открыть историю
                </button>
              </Card>

              <Card title="Данные и права">
                <p className="text-xs text-gray-600 dark:text-gray-400">
                  Вы владеете своими данными. Мы обеспечиваем полный контроль.
                </p>
                <div className="mt-3 flex flex-col gap-2">
                  <button className="rounded-xl border border-gray-300 py-2 text-xs font-semibold uppercase text-gray-700 dark:border-gray-700 dark:text-gray-200">
                    Экспорт данных
                  </button>
                  <button className="rounded-xl border border-red-300 py-2 text-xs font-semibold uppercase text-red-600">
                    Удалить аккаунт
                  </button>
                  <button
                    onClick={handlePrivacyPolicy}
                    className="rounded-xl border border-gray-300 py-2 text-xs font-semibold uppercase text-gray-700 dark:border-gray-700 dark:text-gray-200"
                  >
                    Политика конфиденциальности
                  </button>
                  <button className="rounded-xl border border-gray-300 py-2 text-xs font-semibold uppercase text-gray-700 dark:border-gray-700 dark:text-gray-200">
                    Оферта и условия
                  </button>
                  <button className="rounded-xl border border-gray-300 py-2 text-xs font-semibold uppercase text-gray-700 dark:border-gray-700 dark:text-gray-200">
                    Юридические согласия (РФ)
                  </button>
                </div>
              </Card>

              <Card title="Безопасность">
                <div className="flex flex-wrap gap-2">
                  <button
                    onClick={handleChangePassword}
                    className="rounded-xl border border-gray-300 px-4 py-2 text-xs font-semibold uppercase text-gray-700 dark:border-gray-700 dark:text-gray-200"
                  >
                    Сменить пароль
                  </button>
                  <button className="rounded-xl border border-gray-300 px-4 py-2 text-xs font-semibold uppercase text-gray-700 dark:border-gray-700 dark:text-gray-200">
                    Активные сессии
                  </button>
                  <button className="rounded-xl border border-gray-300 px-4 py-2 text-xs font-semibold uppercase text-gray-700 dark:border-gray-700 dark:text-gray-200">
                    Устройства
                  </button>
                </div>
              </Card>

              <Card title="Поддержка">
                <p className="text-xs text-gray-600 dark:text-gray-400">
                  Мы рядом, если нужна помощь. Ответим спокойно и по делу.
                </p>
                <button className="mt-3 w-full rounded-xl border border-gray-300 py-2 text-xs font-semibold uppercase text-gray-700 dark:border-gray-700 dark:text-gray-200">
                  Связаться с поддержкой
                </button>
              </Card>

              <Card tone="explainable" title="Почему такой доступ?">
                <p className="text-xs text-gray-600 dark:text-gray-400">
                  Мы объясняем статус, чтобы вы чувствовали контроль.
                </p>
                <div className="mt-3">
                  <ExplainabilityDrawer explainability={explainability} />
                </div>
              </Card>

              {trustMessage && (
                <TrustBanner tone="safety">
                  {trustMessage}
                </TrustBanner>
              )}
            </div>
          </StateContainer>
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

