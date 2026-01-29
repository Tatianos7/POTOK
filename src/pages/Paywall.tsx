import { useCallback, useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { X, ShieldCheck } from 'lucide-react';
import { uiRuntimeAdapter, type RuntimeStatus } from '../services/uiRuntimeAdapter';
import { useAuth } from '../context/AuthContext';
import type { PaywallExplainabilityDTO } from '../types/explainability';
import { classifyTrustDecision } from '../services/trustSafetyService';
import Card from '../ui/components/Card';
import StateContainer from '../ui/components/StateContainer';
import TrustBanner from '../ui/components/TrustBanner';
import ExplainabilityDrawer from '../ui/components/ExplainabilityDrawer';
import CoachMessageCard from '../ui/coach/CoachMessageCard';
import CoachExplainabilityDrawer from '../ui/coach/CoachExplainabilityDrawer';
import type { CoachDecisionResponse } from '../services/coachRuntime';

type PaywallStatus =
  | 'free'
  | 'trial'
  | 'active'
  | 'grace'
  | 'expired'
  | 'payment_failed'
  | 'offline'
  | 'error'
  | 'recovery'
  | 'explainable';

const Paywall = () => {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [runtimeStatus, setRuntimeStatus] = useState<RuntimeStatus>('loading');
  const [paywallStatus, setPaywallStatus] = useState<PaywallStatus>('free');
  const [paywallPayload, setPaywallPayload] = useState<any>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [trustMessage, setTrustMessage] = useState<string | null>(null);
  const [explainability, setExplainability] = useState<PaywallExplainabilityDTO | null>(null);
  const [decisionSupport, setDecisionSupport] = useState<CoachDecisionResponse | null>(null);

  const loadPaywall = useCallback(async () => {
    if (!user?.id) return;
    setRuntimeStatus('loading');
    setErrorMessage(null);
    setTrustMessage(null);
    uiRuntimeAdapter.startLoadingTimer('Paywall', {
      pendingSources: ['entitlements', 'paywall_state'],
      onTimeout: () => {
        const decision = classifyTrustDecision('loading_timeout');
        setRuntimeStatus('error');
        setErrorMessage('Загрузка paywall заняла слишком много времени.');
        setTrustMessage(decision.message);
      },
    });
    try {
      const state = await uiRuntimeAdapter.getPaywallState('explainability');
      setRuntimeStatus(state.status);
      setPaywallPayload(state.paywall || null);
      setExplainability((state.explainability as PaywallExplainabilityDTO) ?? null);
      setTrustMessage(state.trust?.message ?? null);

      const paywallData = state.paywall as { status?: string; state?: string; tier?: string } | null;
      const statusFromPayload =
        paywallData?.status ??
        paywallData?.state ??
        (paywallData?.tier === 'free' ? 'free' : 'active');
      setPaywallStatus((statusFromPayload as PaywallStatus) ?? 'free');

      if (state.status === 'error') {
        setErrorMessage(state.message || 'Не удалось загрузить доступы.');
      }
    } catch (error) {
      const decision = classifyTrustDecision(error);
      setRuntimeStatus('error');
      setErrorMessage('Не удалось загрузить доступы.');
      setTrustMessage(decision.message);
    } finally {
      uiRuntimeAdapter.clearLoadingTimer('Paywall');
    }
  }, [user?.id]);

  useEffect(() => {
    loadPaywall();
  }, [loadPaywall]);

  useEffect(() => {
    const subscriptionState =
      paywallStatus === 'trial'
        ? 'Trial'
        : paywallStatus === 'active'
          ? 'Premium'
          : paywallStatus === 'grace'
            ? 'Grace'
            : paywallStatus === 'expired'
              ? 'Expired'
              : 'Free';
    uiRuntimeAdapter
      .getDecisionSupport({
        decision_type: 'subscription_doubt',
        emotional_state: 'neutral',
        trust_level: 50,
        history_pattern: `Статус подписки: ${paywallStatus}`,
        user_mode: 'Manual',
        screen: 'Paywall',
        subscription_state: subscriptionState,
        safety_flags: [],
      })
      .then(setDecisionSupport)
      .catch(() => setDecisionSupport(null));
  }, [paywallStatus]);

  const statusLabel: Record<PaywallStatus, string> = {
    free: 'Free',
    trial: 'Пробный период',
    active: 'Premium активен',
    grace: 'Льготный период',
    expired: 'Подписка истекла',
    payment_failed: 'Платёж не прошёл',
    offline: 'Офлайн',
    error: 'Ошибка',
    recovery: 'Восстановление',
    explainable: 'Объяснение доступно',
  };

  return (
    <div className="min-h-screen bg-white dark:bg-gray-900 w-full min-w-[320px]">
      <div className="container-responsive">
        <header className="py-4 flex items-center justify-between border-b border-gray-200 dark:border-gray-700">
          <div className="flex-1" />
          <h1 className="text-lg font-semibold text-gray-900 dark:text-white uppercase text-center flex-1">
            PREMIUM
          </h1>
          <div className="flex-1 flex justify-end">
            <button
              onClick={() => navigate('/')}
              className="p-2 hover:bg-gray-100 dark:hover:bg-gray-800 rounded-lg transition-colors"
              aria-label="Закрыть"
            >
              <X className="w-6 h-6 text-gray-700 dark:text-gray-300" />
            </button>
          </div>
        </header>

        <main className="py-4 tablet:py-6">
          <StateContainer
            status={runtimeStatus}
            message={
              runtimeStatus === 'empty'
                ? 'Premium пока не активен. Вы можете продолжать в Manual Mode.'
                : errorMessage || undefined
            }
            onRetry={() => {
              if (runtimeStatus === 'offline') {
                uiRuntimeAdapter.revalidate().finally(loadPaywall);
              } else {
                uiRuntimeAdapter.recover().finally(loadPaywall);
              }
            }}
          >
            {paywallStatus === 'payment_failed' && (
              <TrustBanner tone="safety">
                Платёж не прошёл. Мы сохраним ваш прогресс и поможем восстановить доступ без давления.
              </TrustBanner>
            )}
            {paywallStatus === 'grace' && (
              <TrustBanner tone="recovery">
                Льготный период активен. У вас есть время спокойно решить, как продолжать.
              </TrustBanner>
            )}

            <div className="space-y-4">
              {decisionSupport && (
                <CoachMessageCard
                  mode={decisionSupport.ui_mode}
                  message={decisionSupport.coach_message}
                  footer={
                    <CoachExplainabilityDrawer
                      decisionId={decisionSupport.decision_id}
                      trace={decisionSupport.explainability}
                      title="Почему коуч вмешался в это решение?"
                      confidence={decisionSupport.confidence}
                      trustLevel={decisionSupport.trust_state}
                      safetyFlags={decisionSupport.safety_flags}
                    />
                  }
                />
              )}
              <Card title="Статус доступа" action={<span className="text-xs text-gray-500">{statusLabel[paywallStatus]}</span>}>
                <div className="flex items-center gap-2 text-xs text-gray-600 dark:text-gray-400">
                  <ShieldCheck className="w-4 h-4" />
                  Мы показываем прозрачные причины и ценность, без давления.
                </div>
                <p className="mt-3 text-xs text-gray-600 dark:text-gray-400">
                  Вы уже можете вести дневники и видеть базовую динамику. Premium — это поддержка ритма и адаптация.
                </p>
              </Card>

              <Card title="Что у вас уже есть">
                <div className="grid grid-cols-1 gap-2 text-xs text-gray-600 dark:text-gray-300">
                  <div>Manual Mode: питание, тренировки, замеры</div>
                  <div>Прогресс: базовые тренды и записи</div>
                  <div>Привычки: старт ритма и самоконтроль</div>
                </div>
              </Card>

              <Card title="Что откроется с Premium" tone="premium">
                <div className="grid grid-cols-1 gap-2 text-xs text-gray-700 dark:text-gray-300">
                  <div>Follow Plan: ежедневные планы и адаптация</div>
                  <div>Today: безопасный сценарий дня</div>
                  <div>Explainability: «почему так» в каждом решении</div>
                  <div>Coach Layer: поддержка и ритм восстановления</div>
                </div>
              </Card>

              <Card title="Ваш выбор" action={<span className="text-xs text-gray-500">без давления</span>}>
                <p className="text-xs text-gray-600 dark:text-gray-400">
                  Вы можете остаться в Manual Mode. Premium — это ускорение и поддержка, если хотите.
                </p>
                <div className="mt-3 flex flex-col gap-2 mobile-lg:flex-row">
                  <button className="flex-1 rounded-xl bg-gray-900 text-white py-2 text-xs font-semibold uppercase">
                    Улучшить до Premium
                  </button>
                  <button className="flex-1 rounded-xl border border-gray-300 py-2 text-xs font-semibold uppercase text-gray-700 dark:border-gray-700 dark:text-gray-200">
                    Восстановить покупки
                  </button>
                </div>
              </Card>

              <Card tone="explainable" title="Почему доступ ограничен?">
                <p className="text-xs text-gray-600 dark:text-gray-400">
                  Мы объясняем причины доступа, чтобы вы сохраняли контроль.
                </p>
                <div className="mt-3 grid grid-cols-2 gap-3 text-xs text-gray-700 dark:text-gray-300">
                  <div>Причина: {explainability?.decision_ref ?? 'premium_required'}</div>
                  <div>Уверенность: {explainability?.confidence ?? '—'}</div>
                  <div>Trust: {explainability?.trust_level ?? '—'}</div>
                  <div>Safety: {explainability?.safety_notes?.join(', ') || '—'}</div>
                </div>
                <div className="mt-4">
                  <ExplainabilityDrawer explainability={explainability} />
                </div>
              </Card>

              {trustMessage && (
                <Card title="Поддержка">
                  <p className="text-xs text-gray-600 dark:text-gray-400">{trustMessage}</p>
                </Card>
              )}
            </div>
          </StateContainer>
        </main>
      </div>
    </div>
  );
};

export default Paywall;
