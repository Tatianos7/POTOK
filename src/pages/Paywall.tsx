import { useCallback, useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { X, ShieldCheck } from 'lucide-react';
import { uiRuntimeAdapter, type RuntimeStatus } from '../services/uiRuntimeAdapter';
import { useAuth } from '../context/AuthContext';
import ExplainabilityDrawer from '../components/ExplainabilityDrawer';
import type { BaseExplainabilityDTO } from '../types/explainability';
import { classifyTrustDecision } from '../services/trustSafetyService';

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
  const [explainability, setExplainability] = useState<BaseExplainabilityDTO | null>(null);

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
      setExplainability((state.explainability as BaseExplainabilityDTO) ?? null);
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
          {runtimeStatus === 'offline' && (
            <div className="mb-4 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800">
              Работаем офлайн. Данные могут быть неактуальны.
              <button
                onClick={() => {
                  uiRuntimeAdapter.revalidate().finally(loadPaywall);
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
              Данные доступны частично. Мы показываем то, что уже есть.
            </div>
          )}
          {runtimeStatus === 'error' && (
            <div className="mb-4 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800 dark:border-red-800 dark:bg-red-900/30 dark:text-red-200">
              <div className="flex flex-col gap-2 mobile-lg:flex-row mobile-lg:items-center mobile-lg:justify-between">
                <span>{errorMessage || 'Не удалось загрузить paywall.'}</span>
                {trustMessage && (
                  <span className="text-xs text-red-700 dark:text-red-200">{trustMessage}</span>
                )}
                <button
                  onClick={() => {
                    uiRuntimeAdapter.recover().finally(loadPaywall);
                  }}
                  className="rounded-lg border border-red-300 px-3 py-1.5 text-xs font-semibold text-red-800 hover:bg-red-100 dark:border-red-700 dark:text-red-200 dark:hover:bg-red-900/50"
                >
                  Повторить
                </button>
              </div>
            </div>
          )}

          {runtimeStatus === 'loading' && (
            <div className="flex items-center justify-center py-12">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-green-500"></div>
            </div>
          )}

          {runtimeStatus !== 'loading' && (
            <section className="rounded-2xl border border-gray-200 dark:border-gray-700 p-4">
              <div className="flex items-center gap-2 text-sm font-semibold text-gray-900 dark:text-white mb-2">
                <ShieldCheck className="w-4 h-4" />
                Статус: {paywallStatus}
              </div>
              <p className="text-sm text-gray-700 dark:text-gray-300">
                Мы не используем давление. Только прозрачные причины и ценность.
              </p>
              <div className="mt-3 grid grid-cols-2 gap-3 text-xs text-gray-600 dark:text-gray-300">
                <div className="rounded-xl border border-gray-200 dark:border-gray-700 p-3">
                  <p className="font-semibold mb-1">Free</p>
                  <p>Базовые дневники</p>
                  <p>Ручной контроль</p>
                  <p>Без адаптации</p>
                </div>
                <div className="rounded-xl border border-gray-200 dark:border-gray-700 p-3">
                  <p className="font-semibold mb-1">Premium</p>
                  <p>Адаптация плана</p>
                  <p>Explainability</p>
                  <p>Безопасные guard-rails</p>
                </div>
              </div>
              <div className="mt-3 text-xs text-gray-500">
                Причина блокировки: {explainability?.decision_ref ?? 'premium_required'}
              </div>
              <div className="mt-3 flex gap-2">
                <button className="flex-1 rounded-xl bg-gray-900 text-white py-2 text-xs font-semibold uppercase">
                  Улучшить до Premium
                </button>
                <button className="flex-1 rounded-xl border border-gray-300 py-2 text-xs font-semibold uppercase text-gray-700">
                  Восстановить покупки
                </button>
              </div>
              {paywallPayload && (
                <pre className="mt-3 rounded-lg bg-gray-50 dark:bg-gray-800 p-3 text-xs text-gray-600 dark:text-gray-300 whitespace-pre-wrap">
                  {JSON.stringify(paywallPayload, null, 2)}
                </pre>
              )}
            </section>
          )}

          <div className="mt-6">
            <ExplainabilityDrawer explainability={explainability} />
          </div>
        </main>
      </div>
    </div>
  );
};

export default Paywall;
