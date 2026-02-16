import { useState, useRef, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { X, Camera } from 'lucide-react';
import ChangePasswordModal from '../components/ChangePasswordModal';
import SubscriptionManagement from '../pages/SubscriptionManagement';
import PaymentHistoryModal from '../components/PaymentHistoryModal';
import PrivacyPolicyModal from '../components/PrivacyPolicyModal';
import { profileService } from '../services/profileService';
import type { CoachDecisionResponse } from '../services/coachRuntime';
import CoachMessageCard from '../ui/coach/CoachMessageCard';
import CoachExplainabilityDrawer from '../ui/coach/CoachExplainabilityDrawer';
import type {
  CoachMode,
  CoachSettings,
  CoachVoiceIntensity,
  CoachVoiceMode,
  CoachVoiceSettings,
  CoachVoiceStyle,
} from '../types/coachSettings';
import { uiRuntimeAdapter, type RuntimeStatus } from '../services/uiRuntimeAdapter';
import type { BaseExplainabilityDTO } from '../types/explainability';
import { classifyTrustDecision } from '../services/trustSafetyService';
import { entitlementService } from '../services/entitlementService';
import Card from '../ui/components/Card';
import StateContainer from '../ui/components/StateContainer';
import TrustBanner from '../ui/components/TrustBanner';
import ExplainabilityDrawer from '../ui/components/ExplainabilityDrawer';
import ScreenContainer from '../ui/components/ScreenContainer';
import Button from '../ui/components/Button';
import { colors, spacing, typography } from '../ui/theme/tokens';
import { clearPinLock, isPinLockEnabled } from '../services/pinLockService';

const Profile = () => {
  const { user, authStatus } = useAuth();
  const navigate = useNavigate();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const isProfileLoadInFlightRef = useRef(false);
  const isEntitlementsLoadInFlightRef = useRef(false);
  const activeProfileRequestIdRef = useRef(0);
  const profileTimeoutRef = useRef<number | null>(null);
  const profileDataRef = useRef<any>(null);
  const [avatar, setAvatar] = useState<string | null>(null);
  const [isChangePasswordOpen, setIsChangePasswordOpen] = useState(false);
  const [isPrivacyPolicyOpen, setIsPrivacyPolicyOpen] = useState(false);
  const [runtimeStatus, setRuntimeStatus] = useState<RuntimeStatus>('loading');
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [trustMessage, setTrustMessage] = useState<string | null>(null);
  const [explainability, setExplainability] = useState<BaseExplainabilityDTO | null>(null);
  const [profileData, setProfileData] = useState<any>(null);
  const [entitlements, setEntitlements] = useState<any>(null);
  const [coachEnabled, setCoachEnabled] = useState(true);
  const [coachMode, setCoachMode] = useState<CoachMode>('support');
  const [voiceEnabled, setVoiceEnabled] = useState(false);
  const [voiceMode, setVoiceMode] = useState<CoachVoiceMode>('off');
  const [voiceStyle, setVoiceStyle] = useState<CoachVoiceStyle>('calm');
  const [voiceIntensity, setVoiceIntensity] = useState<CoachVoiceIntensity>('soft');
  const [decisionSupport, setDecisionSupport] = useState<CoachDecisionResponse | null>(null);
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
      setExplainability((state.explainability as BaseExplainabilityDTO) ?? null);
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
    if (authStatus !== 'authenticated' || !user?.id) return;
    if (isEntitlementsLoadInFlightRef.current) return;
    isEntitlementsLoadInFlightRef.current = true;
    const timeoutId = window.setTimeout(() => {
      isEntitlementsLoadInFlightRef.current = false;
    }, 8000);
    void entitlementService
      .getEntitlements(user.id)
      .then((data) => {
        setEntitlements(data ?? null);
      })
      .catch(() => {
        // background only: do not block profile rendering
      })
      .finally(() => {
        window.clearTimeout(timeoutId);
        isEntitlementsLoadInFlightRef.current = false;
      });
  }, [authStatus, user?.id]);

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

  useEffect(() => {
    if (authStatus !== 'authenticated' || !user?.id) return;
    profileService
      .getVoiceSettings(user.id)
      .then((settings) => {
        setVoiceEnabled(settings.enabled);
        setVoiceMode(settings.mode);
        setVoiceStyle(settings.style);
        setVoiceIntensity(settings.intensity);
      })
      .catch(() => {
        setVoiceEnabled(false);
        setVoiceMode('off');
        setVoiceStyle('calm');
        setVoiceIntensity('soft');
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
  const subscriptionLabel = entitlements?.tier
    ? entitlements.tier.toUpperCase()
    : profile?.has_premium || user?.hasPremium
      ? 'PREMIUM'
      : 'FREE';
  const isPremium = subscriptionLabel === 'PREMIUM';
  const subscriptionStatus =
    entitlements?.status || (profile?.has_premium || user?.hasPremium ? 'active' : 'free');

  useEffect(() => {
    if (authStatus !== 'authenticated' || !user?.id) return;
    const subscriptionState = subscriptionLabel === 'PREMIUM' ? 'Premium' : 'Free';
    uiRuntimeAdapter
      .getDecisionSupport({
        decision_type: 'profile_reset',
        emotional_state: 'neutral',
        trust_level: 50,
        history_pattern: 'Настройки и данные профиля',
        user_mode: 'Manual',
        screen: 'Profile',
        subscription_state: subscriptionState,
        safety_flags: [],
      })
      .then(setDecisionSupport)
      .catch(() => setDecisionSupport(null));
  }, [authStatus, user?.id, subscriptionLabel]);

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

  const handleCreatePin = () => {
    navigate('/pin/setup?from=profile');
  };

  const handleChangePin = () => {
    clearPinLock();
    setPinEnabled(false);
    setPinNotice(null);
    navigate('/pin/setup?from=profile');
  };

  const handleDisablePin = () => {
    clearPinLock();
    setPinEnabled(false);
    setPinNotice('PIN отключён');
    window.setTimeout(() => setPinNotice(null), 3000);
  };

  const handleCoachHistory = () => {
    navigate('/coach-history');
  };

  const persistCoachSettings = async (settings: CoachSettings) => {
    if (!user?.id) return;
    try {
      await profileService.saveCoachSettings(user.id, settings);
    } catch (error) {
      console.warn('[Profile] coach settings save failed', error);
    }
  };

  const persistVoiceSettings = async (settings: CoachVoiceSettings) => {
    if (!user?.id) return;
    try {
      await profileService.saveVoiceSettings(user.id, settings);
    } catch (error) {
      console.warn('[Profile] voice settings save failed', error);
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

  const handleVoiceToggle = (enabled: boolean) => {
    const nextMode = enabled ? (voiceMode === 'off' ? 'on_request' : voiceMode) : 'off';
    setVoiceEnabled(enabled);
    setVoiceMode(nextMode);
    void persistVoiceSettings({
      enabled,
      mode: nextMode,
      style: voiceStyle,
      intensity: voiceIntensity,
    });
  };

  const handleVoiceModeChange = (mode: CoachVoiceMode) => {
    if (mode === 'always' && !isPremium) return;
    const enabled = mode !== 'off';
    setVoiceEnabled(enabled);
    setVoiceMode(mode);
    void persistVoiceSettings({
      enabled,
      mode,
      style: voiceStyle,
      intensity: voiceIntensity,
    });
  };

  const handleVoiceStyleChange = (style: CoachVoiceStyle) => {
    setVoiceStyle(style);
    void persistVoiceSettings({
      enabled: voiceEnabled,
      mode: voiceMode,
      style,
      intensity: voiceIntensity,
    });
  };

  const handleVoiceIntensityChange = (intensity: CoachVoiceIntensity) => {
    setVoiceIntensity(intensity);
    void persistVoiceSettings({
      enabled: voiceEnabled,
      mode: voiceMode,
      style: voiceStyle,
      intensity,
    });
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
                  Вы управляете тем, как коуч с вами взаимодействует. Можно изменить в любой момент.
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

              <Card title="Голосовой коуч">
                <p className="text-xs text-gray-600 dark:text-gray-400">
                  Голос помогает чувствовать поддержку в моменте. Вы можете выбрать стиль и интенсивность.
                </p>
                <div className="mt-3 flex items-center justify-between rounded-xl border border-gray-200 px-3 py-2 text-xs text-gray-700 dark:border-gray-700 dark:text-gray-300">
                  <span>Голосовой коуч</span>
                  <button
                    type="button"
                    onClick={() => handleVoiceToggle(!voiceEnabled)}
                    className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${
                      voiceEnabled ? 'bg-gray-900 dark:bg-white' : 'bg-gray-300 dark:bg-gray-700'
                    }`}
                    aria-pressed={voiceEnabled}
                  >
                    <span
                      className={`inline-block h-5 w-5 transform rounded-full bg-white dark:bg-gray-900 transition-transform ${
                        voiceEnabled ? 'translate-x-5' : 'translate-x-1'
                      }`}
                    />
                  </button>
                </div>
                <div className="mt-3 grid grid-cols-2 gap-2 text-xs">
                  {[
                    { id: 'off', label: 'Выключен' },
                    { id: 'risk_only', label: 'Только при риске' },
                    { id: 'on_request', label: 'По запросу' },
                    { id: 'always', label: 'Всегда (Premium)', premium: true },
                  ].map((option) => {
                    const disabled = option.premium && !isPremium;
                    return (
                      <button
                        key={option.id}
                        type="button"
                        disabled={disabled}
                        onClick={() => handleVoiceModeChange(option.id as CoachVoiceMode)}
                        className={`rounded-xl border px-3 py-2 font-semibold uppercase transition-colors ${
                          voiceMode === option.id
                            ? 'border-gray-900 bg-gray-900 text-white dark:border-white dark:bg-white dark:text-gray-900'
                            : 'border-gray-300 text-gray-700 dark:border-gray-700 dark:text-gray-200'
                        } ${disabled ? 'opacity-50 cursor-not-allowed' : ''}`}
                      >
                        {option.label}
                      </button>
                    );
                  })}
                </div>
                {!isPremium && (
                  <p className="mt-2 text-[11px] text-gray-500 dark:text-gray-400">
                    Режим «Всегда» доступен в Premium. В Free голос звучит только при риске.
                  </p>
                )}
                <div className="mt-3 grid gap-2 text-xs">
                  <p className="text-[11px] uppercase text-gray-500 dark:text-gray-400">Выбор голоса</p>
                  <div className="grid grid-cols-3 gap-2">
                    {[
                      { id: 'calm', label: 'Спокойный' },
                      { id: 'supportive', label: 'Поддерживающий' },
                      { id: 'motivational', label: 'Мотивирующий' },
                    ].map((option) => (
                      <button
                        key={option.id}
                        type="button"
                        onClick={() => handleVoiceStyleChange(option.id as CoachVoiceStyle)}
                        className={`rounded-xl border px-3 py-2 font-semibold uppercase transition-colors ${
                          voiceStyle === option.id
                            ? 'border-gray-900 bg-gray-900 text-white dark:border-white dark:bg-white dark:text-gray-900'
                            : 'border-gray-300 text-gray-700 dark:border-gray-700 dark:text-gray-200'
                        }`}
                      >
                        {option.label}
                      </button>
                    ))}
                  </div>
                </div>
                <div className="mt-3 grid gap-2 text-xs">
                  <p className="text-[11px] uppercase text-gray-500 dark:text-gray-400">Интенсивность</p>
                  <div className="grid grid-cols-3 gap-2">
                    {[
                      { id: 'soft', label: 'Мягко' },
                      { id: 'neutral', label: 'Нейтрально' },
                      { id: 'leading', label: 'Ведуще' },
                    ].map((option) => (
                      <button
                        key={option.id}
                        type="button"
                        onClick={() => handleVoiceIntensityChange(option.id as CoachVoiceIntensity)}
                        className={`rounded-xl border px-3 py-2 font-semibold uppercase transition-colors ${
                          voiceIntensity === option.id
                            ? 'border-gray-900 bg-gray-900 text-white dark:border-white dark:bg-white dark:text-gray-900'
                            : 'border-gray-300 text-gray-700 dark:border-gray-700 dark:text-gray-200'
                        }`}
                      >
                        {option.label}
                      </button>
                    ))}
                  </div>
                </div>
              </Card>

              <Card title="История рекомендаций коуча">
                <p className="text-xs text-gray-600 dark:text-gray-400">
                  История решений и объяснений, чтобы видеть логику и доверять процессу.
                </p>
                <button
                  onClick={handleCoachHistory}
                  className="mt-3 w-full rounded-xl border border-gray-300 py-2 text-xs font-semibold uppercase text-gray-700 dark:border-gray-700 dark:text-gray-200"
                >
                  Открыть историю
                </button>
              </Card>

              {decisionSupport && (
                <CoachMessageCard
                  mode={decisionSupport.ui_mode}
                  message={decisionSupport.coach_message}
                  footer={
                    <CoachExplainabilityDrawer
                      decisionId={decisionSupport.decision_id}
                      trace={decisionSupport.explainability}
                      title="Почему коуч помогает с решением?"
                      confidence={decisionSupport.confidence}
                      trustLevel={decisionSupport.trust_state}
                      safetyFlags={decisionSupport.safety_flags}
                    />
                  }
                />
              )}

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
    </ScreenContainer>
  );
};

export default Profile;
