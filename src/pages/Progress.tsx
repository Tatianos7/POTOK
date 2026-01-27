import { useCallback, useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { X } from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { ProgressSnapshot, TrendSummary } from '../services/progressAggregatorService';
import { uiRuntimeAdapter, type RuntimeStatus } from '../services/uiRuntimeAdapter';
import type { ProgressExplainabilityDTO } from '../types/explainability';
import { classifyTrustDecision } from '../services/trustSafetyService';
import Card from '../ui/components/Card';
import Timeline from '../ui/components/Timeline';
import StateContainer from '../ui/components/StateContainer';
import TrustBanner from '../ui/components/TrustBanner';
import ExplainabilityDrawer from '../ui/components/ExplainabilityDrawer';

const Progress = () => {
  const navigate = useNavigate();
  const { user } = useAuth();
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [snapshot, setSnapshot] = useState<ProgressSnapshot | null>(null);
  const [summary, setSummary] = useState<TrendSummary | null>(null);
  const [runtimeStatus, setRuntimeStatus] = useState<RuntimeStatus>('loading');
  const [explainability, setExplainability] = useState<ProgressExplainabilityDTO | null>(null);
  const [trustMessage, setTrustMessage] = useState<string | null>(null);

  const getTodayDate = () => {
    const today = new Date();
    const year = today.getFullYear();
    const month = String(today.getMonth() + 1).padStart(2, '0');
    const day = String(today.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
  };

  const period = useMemo(() => {
    const end = getTodayDate();
    const startDate = new Date(new Date(end).getTime() - 29 * 86400000);
    const start = startDate.toISOString().split('T')[0];
    return { start, end };
  }, []);

  const loadProgress = useCallback(async () => {
    if (!user?.id) return;
    setRuntimeStatus('loading');
    setErrorMessage(null);
    setTrustMessage(null);
    uiRuntimeAdapter.startLoadingTimer('Progress', {
      pendingSources: ['measurement_history', 'food_diary_entries', 'workout_entries', 'user_goals'],
      onTimeout: () => {
        const decision = classifyTrustDecision('loading_timeout');
        setRuntimeStatus('error');
        setErrorMessage('Загрузка прогресса заняла слишком много времени.');
        setTrustMessage(decision.message);
      },
    });
    try {
      const state = await uiRuntimeAdapter.getProgressState(user.id, period.end);
      setRuntimeStatus(state.status);
      setSnapshot(state.snapshot ?? null);
      setSummary(state.trends ?? null);
      setExplainability((state.explainability as ProgressExplainabilityDTO) ?? null);
      setTrustMessage(state.trust?.message ?? null);
      if (state.status === 'error') {
        setErrorMessage(state.message || 'Не удалось загрузить прогресс. Проверьте соединение и попробуйте снова.');
      }
    } catch (error) {
      const decision = classifyTrustDecision(error);
      setRuntimeStatus('error');
      setErrorMessage('Не удалось загрузить прогресс. Проверьте соединение и попробуйте снова.');
      setTrustMessage(decision.message);
    } finally {
      uiRuntimeAdapter.clearLoadingTimer('Progress');
    }
  }, [period.end, user?.id]);

  useEffect(() => {
    loadProgress();
  }, [loadProgress]);

  const weightTrend = summary?.weightSlope ?? 0;
  const volumeTrend = summary?.volumeSlope ?? 0;
  const isPlateau = Math.abs(weightTrend) < 0.05;
  const isRegression = weightTrend > 0.1 && (summary?.calorieBalance ?? 0) > 0;
  const isRecovery = volumeTrend < -0.2;
  const weightInsight = isPlateau
    ? 'Плато — это фаза, а не провал. Тело адаптируется.'
    : weightTrend > 0
      ? 'Рост идёт устойчиво. Главное — сохранять ритм.'
      : 'Снижение идёт стабильно. Берегите восстановление.';

  const safetyFlags = explainability?.safety_flags ?? [];
  const formatPercent = (value?: number | null) => {
    if (value === null || value === undefined) return '—';
    return `${Math.round(value * 100)}%`;
  };

  const timelineItems = useMemo(() => {
    const items = [];
    if (snapshot?.targets) {
      items.push({
        title: 'Старт цели',
        subtitle: 'Есть ориентиры по КБЖУ и траектории.',
        status: 'done' as const,
      });
    }
    if (isPlateau) {
      items.push({
        title: 'Плато',
        subtitle: 'Фаза адаптации, без давления.',
        status: 'active' as const,
      });
    }
    if (isRecovery) {
      items.push({
        title: 'Восстановление',
        subtitle: 'Нагрузка снижена ради устойчивости.',
        status: 'active' as const,
      });
    }
    if (snapshot?.habitsAdherence !== null && snapshot?.habitsAdherence !== undefined) {
      items.push({
        title: snapshot.habitsAdherence < 0.5 ? 'Срыв ритма' : 'Возврат в ритм',
        subtitle: 'Мы поддерживаем мягкое возвращение.',
        status: snapshot.habitsAdherence < 0.5 ? 'active' : 'done',
      });
    }
    if (explainability?.adaptation_reason) {
      items.push({
        title: 'Адаптация плана',
        subtitle: 'Причина: ' + explainability.adaptation_reason,
        status: 'active' as const,
      });
    }
    if (items.length === 0) {
      items.push({
        title: 'История начинается здесь',
        subtitle: 'Добавьте замеры, питание или тренировки.',
        status: 'upcoming' as const,
      });
    }
    return items;
  }, [snapshot?.targets, snapshot?.habitsAdherence, explainability?.adaptation_reason, isPlateau, isRecovery]);

  const insightCards = [
    {
      title: 'Тренд веса',
      message: weightInsight,
      meta: `EMA: ${summary?.weightEma ?? '—'} · slope: ${summary?.weightSlope ?? '—'}`,
    },
    {
      title: 'Сила и объём',
      message:
        volumeTrend > 0
          ? 'Сила растёт. Хороший сигнал устойчивости.'
          : 'Если объём снижается — это может быть период восстановления.',
      meta: `Склон объёма: ${summary?.volumeSlope ?? '—'}`,
    },
    {
      title: 'Белок и питание',
      message:
        summary?.proteinSufficiency !== null && summary?.proteinSufficiency !== undefined
          ? summary.proteinSufficiency < 0.7
            ? 'Белка не хватает. Небольшая корректировка усилит восстановление.'
            : 'Белок в порядке — это поддерживает рост и восстановление.'
          : 'Добавьте записи питания, и мы покажем баланс.',
      meta: `Достаточность: ${formatPercent(summary?.proteinSufficiency)}`,
    },
    {
      title: 'Энергия и ритм',
      message:
        isRecovery || safetyFlags.includes('recovery_needed')
          ? 'Мы видим сигналы усталости. Сейчас важна бережная поддержка.'
          : 'Ритм устойчив. Продолжайте в комфортном темпе.',
      meta: `Баланс калорий: ${summary?.calorieBalance ?? '—'}`,
    },
    {
      title: 'Соблюдение плана',
      message:
        snapshot?.programAdherence !== null && snapshot?.programAdherence !== undefined
          ? snapshot.programAdherence < 0.6
            ? 'Соблюдение снизилось — мы можем адаптировать план.'
            : 'Соблюдение устойчивое. План работает в вашу пользу.'
          : 'Когда план активен, мы покажем соблюдение.',
      meta: `Соблюдение: ${formatPercent(snapshot?.programAdherence ?? null)}`,
    },
  ];

  return (
    <div className="min-h-screen bg-white dark:bg-gray-900 w-full min-w-[320px]">
      <div className="container-responsive">
        <header className="py-4 flex items-center justify-between border-b border-gray-200 dark:border-gray-700">
          <div className="flex-1" />
          <h1 className="text-lg font-semibold text-gray-900 dark:text-white uppercase text-center flex-1">
            ПРОГРЕСС
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
                ? 'Пока нет данных для прогресса. Добавьте замеры, питание или тренировки.'
                : errorMessage || undefined
            }
            onRetry={() => {
              if (runtimeStatus === 'offline') {
                uiRuntimeAdapter.revalidate().finally(loadProgress);
              } else {
                uiRuntimeAdapter.recover().finally(loadProgress);
              }
            }}
          >
            {isPlateau && (
              <TrustBanner tone="plateau">
                Плато — это фаза, а не провал. Тело адаптируется, и это часть пути.
              </TrustBanner>
            )}
            {isRegression && !isPlateau && (
              <TrustBanner tone="recovery">
                Сейчас важно восстановление. Это не откат — это бережная фаза.
              </TrustBanner>
            )}
            {isRecovery && !isRegression && !isPlateau && (
              <TrustBanner tone="recovery">
                Мы видим сигналы усталости. Темп можно сохранить мягко и безопасно.
              </TrustBanner>
            )}

            <div className="space-y-4">
              <Card title="Life Timeline">
                <p className="text-xs text-gray-600 dark:text-gray-400">
                  Это история вашего пути — не только цифры, но и восстановление, ритм и устойчивость.
                </p>
                <div className="mt-3 grid grid-cols-2 gap-3 text-sm text-gray-700 dark:text-gray-300">
                  <div>Вес: {snapshot?.weight ?? '—'} кг</div>
                  <div>Фото: {snapshot?.photos ?? 0}</div>
                  <div>Сила/объём: {snapshot?.volume ?? '—'}</div>
                  <div>Калории: {snapshot?.calories ?? '—'} ккал</div>
                  <div>Привычки: {formatPercent(snapshot?.habitsAdherence ?? null)}</div>
                  <div>Соблюдение плана: {formatPercent(snapshot?.programAdherence ?? null)}</div>
                </div>
                <div className="mt-4">
                  <Timeline items={timelineItems} />
                </div>
              </Card>

              <Card title="Снимок дня">
                <div className="grid grid-cols-2 gap-3 text-sm text-gray-700 dark:text-gray-300">
                  <div>Вес: {snapshot?.weight ?? '—'} кг</div>
                  <div>Калории: {snapshot?.calories ?? '—'} ккал</div>
                  <div>Белки: {snapshot?.protein ?? '—'} г</div>
                  <div>Объём трен.: {snapshot?.volume ?? '—'}</div>
                  <div>Фото: {snapshot?.photos ?? 0}</div>
                  <div>Привычки: {formatPercent(snapshot?.habitsAdherence ?? null)}</div>
                </div>
              </Card>

              <Card title="Insight Engine">
                <p className="text-xs text-gray-600 dark:text-gray-400">
                  Мы переводим данные в смыслы: что происходит и как поддержать путь.
                </p>
                <div className="mt-3 grid gap-3">
                  {insightCards.map((card) => (
                    <Card key={card.title} tone="explainable" title={card.title}>
                      <p className="text-xs text-gray-700 dark:text-gray-300">{card.message}</p>
                      <p className="mt-2 text-[11px] text-gray-500 dark:text-gray-400">{card.meta}</p>
                      <p className="mt-2 text-[11px] text-gray-500 dark:text-gray-400">
                        {explainability?.decision_ref
                          ? `Почему так: ${explainability.decision_ref}`
                          : 'Почему так: объяснение будет здесь.'}
                      </p>
                    </Card>
                  ))}
                </div>
              </Card>

              {summary && (
                <Card title="Тренды (30 дней)">
                  <div className="grid grid-cols-2 gap-3 text-sm text-gray-700 dark:text-gray-300">
                    <div>EMA веса: {summary.weightEma ?? '—'}</div>
                    <div>Склон веса: {summary.weightSlope ?? '—'}</div>
                    <div>Склон объёма: {summary.volumeSlope ?? '—'}</div>
                    <div>Средние калории: {summary.avgCalories ?? '—'}</div>
                    <div>Баланс калорий: {summary.calorieBalance ?? '—'}</div>
                    <div>Достаточность белка: {formatPercent(summary.proteinSufficiency ?? null)}</div>
                  </div>
                  <p className="mt-3 text-xs text-gray-500 dark:text-gray-400">
                    Мы объясняем тренды, чтобы вы чувствовали контроль и поддержку.
                  </p>
                </Card>
              )}

              <Card title="Навигация по пути">
                <div className="flex flex-wrap gap-2">
                  <button
                    onClick={() => navigate('/today')}
                    className="rounded-lg border border-gray-300 px-3 py-1.5 text-xs font-semibold text-gray-800 hover:bg-gray-100 dark:border-gray-700 dark:text-gray-200 dark:hover:bg-gray-800"
                  >
                    Сегодня
                  </button>
                  <button
                    onClick={() => navigate('/my-program')}
                    className="rounded-lg border border-gray-300 px-3 py-1.5 text-xs font-semibold text-gray-800 hover:bg-gray-100 dark:border-gray-700 dark:text-gray-200 dark:hover:bg-gray-800"
                  >
                    Мой план
                  </button>
                  <button
                    onClick={() => navigate('/habits')}
                    className="rounded-lg border border-gray-300 px-3 py-1.5 text-xs font-semibold text-gray-800 hover:bg-gray-100 dark:border-gray-700 dark:text-gray-200 dark:hover:bg-gray-800"
                  >
                    Привычки
                  </button>
                  <button
                    onClick={() => navigate('/measurements')}
                    className="rounded-lg border border-gray-300 px-3 py-1.5 text-xs font-semibold text-gray-800 hover:bg-gray-100 dark:border-gray-700 dark:text-gray-200 dark:hover:bg-gray-800"
                  >
                    Замеры
                  </button>
                </div>
              </Card>

              <Card tone="explainable" title="Почему я вижу такой прогресс?">
                <p className="text-xs text-gray-600 dark:text-gray-400">
                  Мы показываем источники данных и уверенность интерпретации, чтобы вы чувствовали ясность.
                </p>
                <div className="mt-3 grid grid-cols-2 gap-3 text-xs text-gray-700 dark:text-gray-300">
                  <div>Источники: {explainability?.data_sources?.join(', ') || '—'}</div>
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

export default Progress;
