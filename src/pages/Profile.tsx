import { useState, useRef, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { X, Camera } from 'lucide-react';
import ChangePasswordModal from '../components/ChangePasswordModal';
import PrivacyPolicyModal from '../components/PrivacyPolicyModal';
import { profileService } from '../services/profileService';
import type {
  CoachMode,
  CoachSettings,
} from '../types/coachSettings';
import { uiRuntimeAdapter, type RuntimeStatus } from '../services/uiRuntimeAdapter';
import { classifyTrustDecision } from '../services/trustSafetyService';
import Card from '../ui/components/Card';
import StateContainer from '../ui/components/StateContainer';
import TrustBanner from '../ui/components/TrustBanner';
import ScreenContainer from '../ui/components/ScreenContainer';
import Button from '../ui/components/Button';
import { colors, spacing, typography } from '../ui/theme/tokens';
import { clearPinLock, isPinLockEnabled } from '../services/pinLockService';

const PROFILE_GENERIC_TRUST_MESSAGE = 'Произошла ошибка. Мы постарались сохранить данные.';
const SUPPORT_EMAIL = 'potok_sup@mail.ru';
const SUPPORT_MAILTO = `mailto:${SUPPORT_EMAIL}?subject=${encodeURIComponent('POTOK — обращение в поддержку')}`;
const ACCOUNT_DELETION_MAILTO = `mailto:${SUPPORT_EMAIL}?subject=${encodeURIComponent('Удаление аккаунта')}`;

const Profile = () => {
  const { user, authStatus } = useAuth();
  const navigate = useNavigate();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const isProfileLoadInFlightRef = useRef(false);
  const activeProfileRequestIdRef = useRef(0);
  const profileTimeoutRef = useRef<number | null>(null);
  const profileDataRef = useRef<any>(null);
  const [avatar, setAvatar] = useState<string | null>(null);
  const [isChangePasswordOpen, setIsChangePasswordOpen] = useState(false);
  const [isPrivacyPolicyOpen, setIsPrivacyPolicyOpen] = useState(false);
  const [isAccountDeletionRequestOpen, setIsAccountDeletionRequestOpen] = useState(false);
  const [runtimeStatus, setRuntimeStatus] = useState<RuntimeStatus>('loading');
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [trustMessage, setTrustMessage] = useState<string | null>(null);
  const [profileData, setProfileData] = useState<any>(null);
  const [coachEnabled, setCoachEnabled] = useState(true);
  const [coachMode, setCoachMode] = useState<CoachMode>('support');
  const [pinEnabled, setPinEnabled] = useState(false);
  const [pinNotice, setPinNotice] = useState<string | null>(null);
  const PROFILE_LOAD_TIMEOUT_MS = 10000;

  const loadProfileState = useCallback(async () => {
    if (authStatus !== 'authenticated' || !user?.id) return;
    if (isProfileLoadInFlightRef.current) return;
    activeProfileRequestIdRef.current += 1;
    const requestId = activeProfileRequestIdRef.current;
    isProfileLoadInFlightRef.current = true;
    const initialCoreProfile = profileService.getCachedProfile(user.id) ?? user.profile ?? null;
    if (initialCoreProfile) {
      setProfileData((prev: typeof initialCoreProfile) => prev ?? initialCoreProfile);
      setRuntimeStatus('active');
    } else {
      setRuntimeStatus('loading');
    }
    setErrorMessage(null);
    setTrustMessage(null);
    if (profileTimeoutRef.current) {
      window.clearTimeout(profileTimeoutRef.current);
      profileTimeoutRef.current = null;
    }
    let timedOut = false;
    profileTimeoutRef.current = window.setTimeout(() => {
      if (activeProfileRequestIdRef.current !== requestId) return;
      timedOut = true;
      const decision = classifyTrustDecision('loading_timeout');
      const hasRenderableCore = Boolean(profileService.getCachedProfile(user.id) ?? user.profile ?? profileDataRef.current);
      if (!hasRenderableCore) {
        setRuntimeStatus('error');
      }
      setErrorMessage('Не удалось загрузить профиль за отведённое время.');
      setTrustMessage(decision.message);
    }, PROFILE_LOAD_TIMEOUT_MS);

    uiRuntimeAdapter.startLoadingTimer('Profile', {
      pendingSources: ['user_profiles'],
      authState: authStatus,
      onTimeout: () => {
        if (activeProfileRequestIdRef.current !== requestId) return;
        const decision = classifyTrustDecision('loading_timeout');
        const hasRenderableCore = Boolean(profileService.getCachedProfile(user.id) ?? user.profile ?? profileDataRef.current);
        if (!hasRenderableCore) {
          setRuntimeStatus('error');
        }
        setErrorMessage('Не удалось загрузить профиль за отведённое время.');
        setTrustMessage(decision.message);
      },
    });
    try {
      const state = await uiRuntimeAdapter.getProfileState(user.id);
      if (activeProfileRequestIdRef.current !== requestId) return;
      if (profileTimeoutRef.current) {
        window.clearTimeout(profileTimeoutRef.current);
        profileTimeoutRef.current = null;
      }
      const fallbackProfile = profileService.getCachedProfile(user.id);
      const effectiveProfile = state.profile ?? fallbackProfile ?? user.profile ?? null;
      const shouldFallback = state.status === 'error' || state.status === 'partial' || state.status === 'empty';
      setRuntimeStatus(shouldFallback ? 'active' : state.status);
      setTrustMessage(state.trust?.message ?? null);
      setProfileData(effectiveProfile);
      const serviceNotice = profileService.consumeProfileNotice();
      if (serviceNotice) {
        setErrorMessage(serviceNotice);
      } else if (shouldFallback && !effectiveProfile) {
        setErrorMessage(state.message || 'Не удалось загрузить профиль.');
      } else if (!timedOut) {
        setErrorMessage(null);
      } else {
        setErrorMessage(null);
      }
    } catch (error) {
      if (activeProfileRequestIdRef.current !== requestId) return;
      if (profileTimeoutRef.current) {
        window.clearTimeout(profileTimeoutRef.current);
        profileTimeoutRef.current = null;
      }
      const decision = classifyTrustDecision(error);
      const fallbackProfile = profileService.getCachedProfile(user.id) ?? user.profile ?? null;
      setProfileData(fallbackProfile);
      setRuntimeStatus(fallbackProfile ? 'active' : 'error');
      setErrorMessage(fallbackProfile ? 'Не удалось загрузить профиль. Показываем последние сохранённые данные.' : 'Не удалось загрузить профиль.');
      setTrustMessage(decision.message);
    } finally {
      if (activeProfileRequestIdRef.current === requestId && profileTimeoutRef.current) {
        window.clearTimeout(profileTimeoutRef.current);
        profileTimeoutRef.current = null;
      }
      uiRuntimeAdapter.clearLoadingTimer('Profile');
      isProfileLoadInFlightRef.current = false;
    }
  }, [PROFILE_LOAD_TIMEOUT_MS, authStatus, user?.id, user?.profile]);

  useEffect(() => {
    profileDataRef.current = profileData;
  }, [profileData]);

  // Загружаем аватар из Supabase при монтировании
  useEffect(() => {
    if (authStatus === 'authenticated' && user?.id) {
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
  }, [authStatus, user?.id]);

  useEffect(() => {
    loadProfileState();
  }, [loadProfileState]);

  useEffect(() => {
    setPinEnabled(isPinLockEnabled());
  }, []);

  useEffect(() => {
    return () => {
      if (profileTimeoutRef.current) {
        window.clearTimeout(profileTimeoutRef.current);
        profileTimeoutRef.current = null;
      }
    };
  }, []);

  useEffect(() => {
    if (authStatus !== 'authenticated' || !user?.id) return;
    profileService
      .getCoachSettings(user.id)
      .then((settings) => {
        setCoachEnabled(settings.coach_enabled);
        setCoachMode(settings.coach_mode);
      })
      .catch(() => {
        setCoachEnabled(true);
        setCoachMode('support');
      });
  }, [authStatus, user?.id]);

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
  const visibleTrustMessage =
    trustMessage && trustMessage !== PROFILE_GENERIC_TRUST_MESSAGE ? trustMessage : null;

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

  const handlePrivacyPolicy = () => {
    setIsPrivacyPolicyOpen(true);
  };

  const handleCreatePin = () => {
    navigate('/pin/setup?from=profile');
  };

  const handleChangePin = () => {
    setPinNotice(null);
    navigate('/pin/setup?from=profile&mode=change');
  };

  const handleDisablePin = () => {
    clearPinLock();
    setPinEnabled(false);
    setPinNotice('PIN отключён');
    window.setTimeout(() => setPinNotice(null), 3000);
  };

  const persistCoachSettings = async (settings: CoachSettings) => {
    if (!user?.id) return;
    try {
      await profileService.saveCoachSettings(user.id, settings);
    } catch (error) {
      console.warn('[Profile] coach settings save failed', error);
    }
  };

  const handleCoachToggle = (enabled: boolean) => {
    const nextMode = enabled ? (coachMode === 'off' ? 'support' : coachMode) : 'off';
    setCoachEnabled(enabled);
    setCoachMode(nextMode);
    void persistCoachSettings({ coach_enabled: enabled, coach_mode: nextMode });
  };

  const handleCoachModeChange = (mode: CoachMode) => {
    setCoachMode(mode);
    const enabled = mode !== 'off';
    setCoachEnabled(enabled);
    void persistCoachSettings({ coach_enabled: enabled, coach_mode: mode });
  };

  return (
    <ScreenContainer>
        <header className="flex items-center justify-between" style={{ marginBottom: spacing.lg }}>
          <div style={{ width: 32 }} />
          <h1 style={{ ...typography.title, textTransform: 'uppercase', textAlign: 'center' }}>Профиль</h1>
          <Button variant="ghost" size="sm" onClick={handleClose} aria-label="Закрыть">
            <X className="w-5 h-5" style={{ color: colors.text.secondary }} />
          </Button>
        </header>

        <main className="py-4 tablet:py-6">
          <StateContainer
            status={runtimeStatus}
            message={runtimeStatus === 'empty' ? 'Профиль ещё не заполнен. Мы поможем начать.' : errorMessage || undefined}
            onRetry={loadProfileState}
          >
            <div className="space-y-4">
              {errorMessage && (
                <Card title="Профиль">
                  <p className="text-xs text-gray-600 dark:text-gray-400">{errorMessage}</p>
                  <button
                    onClick={loadProfileState}
                    className="mt-3 rounded-xl border border-gray-300 px-4 py-2 text-xs font-semibold uppercase text-gray-700 dark:border-gray-700 dark:text-gray-200"
                  >
                    Повторить
                  </button>
                </Card>
              )}
              <Card title="Мой профиль" action={<button onClick={handleEdit} className="text-xs text-gray-500">Редактировать</button>}>
                <div className="flex min-w-0 items-start gap-3 min-[376px]:gap-4">
                  <div className="relative">
                    <div
                      onClick={handleAvatarClick}
                      className="h-[72px] w-[72px] rounded-xl bg-gray-200 dark:bg-gray-800 flex items-center justify-center overflow-hidden cursor-pointer hover:opacity-80 transition-opacity min-[376px]:h-[90px] min-[376px]:w-[90px]"
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

                  <div className="min-w-0 flex-1">
                    <h2 className="mb-2 break-words text-base font-semibold leading-tight text-gray-900 dark:text-white min-[376px]:text-lg">
                      {profile?.lastName && `${profile.lastName} `}
                      {profile?.firstName || user?.name || 'Пользователь'}
                      {profile?.middleName && ` ${profile.middleName}`}
                    </h2>
                    <div className="flex min-w-0 flex-wrap gap-1.5 text-xs text-gray-600 dark:text-gray-400 min-[376px]:gap-2">
                      {profile?.birthDate && (
                        <span className="max-w-full break-words rounded-full bg-gray-100 px-2.5 py-1 dark:bg-gray-800 min-[376px]:px-3">
                          {new Date(profile.birthDate).toLocaleDateString('ru-RU')}
                        </span>
                      )}
                      {profile?.age && (
                        <span className="max-w-full break-words rounded-full bg-gray-100 px-2.5 py-1 dark:bg-gray-800 min-[376px]:px-3">
                          {formatAge(profile.age)}
                        </span>
                      )}
                      {profile?.height && (
                        <span className="max-w-full break-words rounded-full bg-gray-100 px-2.5 py-1 dark:bg-gray-800 min-[376px]:px-3">
                          {profile.height} см
                        </span>
                      )}
                      {profile?.goal && (
                        <span className="max-w-full break-words rounded-full bg-gray-100 px-2.5 py-1 dark:bg-gray-800 min-[376px]:px-3">
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
                <div className="text-xs text-gray-700 dark:text-gray-300">
                  Тариф: FREE
                </div>
                <p className="mt-3 text-xs leading-5 text-gray-600 dark:text-gray-400">
                  Монетизация находится в разработке.
                </p>
                <p className="mt-2 text-xs leading-5 text-gray-600 dark:text-gray-400">
                  Подписки появятся в одном из будущих обновлений POTOK.
                </p>
              </Card>

              <Card title="PIN-код">
                <p className="text-xs text-gray-600 dark:text-gray-400">
                  Локальная защита входа на этом устройстве.
                </p>
                <div className="mt-3 flex flex-wrap gap-2">
                  {!pinEnabled ? (
                    <button
                      onClick={handleCreatePin}
                      className="rounded-xl bg-gray-900 text-white px-4 py-2 text-xs font-semibold uppercase dark:bg-white dark:text-gray-900"
                    >
                      Создать PIN
                    </button>
                  ) : (
                    <>
                      <button
                        onClick={handleChangePin}
                        className="rounded-xl border border-gray-300 px-4 py-2 text-xs font-semibold uppercase text-gray-700 dark:border-gray-700 dark:text-gray-200"
                      >
                        Сменить PIN
                      </button>
                      <button
                        onClick={handleDisablePin}
                        className="rounded-xl border border-red-300 px-4 py-2 text-xs font-semibold uppercase text-red-700 dark:border-red-700 dark:text-red-300"
                      >
                        Отключить PIN
                      </button>
                    </>
                  )}
                </div>
                {pinNotice && (
                  <p className="mt-3 rounded-lg border border-green-200 bg-green-50 px-3 py-2 text-xs text-green-700 dark:border-green-800 dark:bg-green-900/20 dark:text-green-300">
                    {pinNotice}
                  </p>
                )}
              </Card>

              <Card title="Настройки коуча">
                <p className="text-xs text-gray-600 dark:text-gray-400">
                  Коуч помогает поддерживать мотивацию и показывать полезные подсказки в приложении.
                </p>
                <div className="mt-3 flex items-center justify-between rounded-xl border border-gray-200 px-3 py-2 text-xs text-gray-700 dark:border-gray-700 dark:text-gray-300">
                  <span>Коуч включён</span>
                  <button
                    type="button"
                    onClick={() => handleCoachToggle(!coachEnabled)}
                    className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${
                      coachEnabled ? 'bg-gray-900 dark:bg-white' : 'bg-gray-300 dark:bg-gray-700'
                    }`}
                    aria-pressed={coachEnabled}
                  >
                    <span
                      className={`inline-block h-5 w-5 transform rounded-full bg-white dark:bg-gray-900 transition-transform ${
                        coachEnabled ? 'translate-x-5' : 'translate-x-1'
                      }`}
                    />
                  </button>
                </div>
                <div className="mt-3 grid grid-cols-2 gap-2 text-xs">
                  {[
                    { id: 'support', label: 'Поддержка' },
                    { id: 'on_request', label: 'Только по запросу' },
                    { id: 'risk_only', label: 'Только при риске' },
                    { id: 'off', label: 'Выключен' },
                  ].map((option) => (
                    <button
                      key={option.id}
                      type="button"
                      onClick={() => handleCoachModeChange(option.id as CoachMode)}
                      className={`rounded-xl border px-3 py-2 font-semibold uppercase transition-colors ${
                        coachMode === option.id
                          ? 'border-gray-900 bg-gray-900 text-white dark:border-white dark:bg-white dark:text-gray-900'
                          : 'border-gray-300 text-gray-700 dark:border-gray-700 dark:text-gray-200'
                      }`}
                    >
                      {option.label}
                    </button>
                  ))}
                </div>
              </Card>

              <Card title="Данные и права">
                <p className="text-xs text-gray-600 dark:text-gray-400">
                  Вы владеете своими данными. Мы обеспечиваем полный контроль.
                </p>
                <div className="mt-3 flex flex-col gap-2">
                  <button className="rounded-xl border border-gray-300 py-2 text-xs font-semibold uppercase text-gray-700 dark:border-gray-700 dark:text-gray-200">
                    Экспорт данных
                  </button>
                  <button
                    onClick={() => setIsAccountDeletionRequestOpen(true)}
                    className="rounded-xl border border-red-300 py-2 text-xs font-semibold uppercase text-red-600"
                  >
                    Запросить удаление аккаунта
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
                  Если у вас возник вопрос, ошибка или предложение по улучшению POTOK, напишите нам на:
                </p>
                <p className="mt-3 text-sm font-semibold text-gray-900 dark:text-white">
                  {SUPPORT_EMAIL}
                </p>
                <a
                  href={SUPPORT_MAILTO}
                  className="mt-3 block w-full rounded-xl border border-gray-300 py-2 text-center text-xs font-semibold uppercase text-gray-700 dark:border-gray-700 dark:text-gray-200"
                >
                  Написать письмо
                </a>
              </Card>

              {visibleTrustMessage && (
                <TrustBanner tone="safety">
                  {visibleTrustMessage}
                </TrustBanner>
              )}
            </div>
          </StateContainer>
        </main>
      {/* Change Password Modal */}
      <ChangePasswordModal
        isOpen={isChangePasswordOpen}
        onClose={() => setIsChangePasswordOpen(false)}
      />

      {/* Privacy Policy Modal */}
      <PrivacyPolicyModal
        isOpen={isPrivacyPolicyOpen}
        onClose={() => setIsPrivacyPolicyOpen(false)}
      />

      {isAccountDeletionRequestOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 px-4">
          <div className="w-full max-w-sm rounded-2xl bg-white p-6 shadow-xl dark:bg-gray-900">
            <h2 className="text-base font-semibold text-gray-900 dark:text-white">
              Запрос на удаление аккаунта
            </h2>
            <p className="mt-3 text-sm leading-6 text-gray-600 dark:text-gray-300">
              Для удаления аккаунта отправьте письмо на:
            </p>
            <p className="mt-3 text-sm font-semibold text-gray-900 dark:text-white">
              {SUPPORT_EMAIL}
            </p>
            <p className="mt-3 text-sm leading-6 text-gray-600 dark:text-gray-300">
              Используйте email, на который зарегистрирован аккаунт POTOK.
            </p>
            <p className="mt-3 text-sm leading-6 text-gray-600 dark:text-gray-300">
              В теме письма укажите:
            </p>
            <p className="mt-2 rounded-xl bg-gray-100 px-3 py-2 text-sm font-semibold text-gray-900 dark:bg-gray-800 dark:text-white">
              Удаление аккаунта
            </p>
            <div className="mt-6 flex gap-3">
              <button
                type="button"
                onClick={() => setIsAccountDeletionRequestOpen(false)}
                className="flex-1 rounded-xl border border-gray-300 px-4 py-3 text-sm font-semibold uppercase text-gray-700 dark:border-gray-700 dark:text-gray-200"
              >
                Отмена
              </button>
              <a
                href={ACCOUNT_DELETION_MAILTO}
                className="flex-1 rounded-xl bg-gray-900 px-4 py-3 text-center text-sm font-semibold uppercase text-white dark:bg-white dark:text-gray-900"
              >
                Написать письмо
              </a>
            </div>
          </div>
        </div>
      )}
    </ScreenContainer>
  );
};

export default Profile;
