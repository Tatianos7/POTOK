import { useCallback, useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { X } from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { uiRuntimeAdapter, type RuntimeStatus } from '../services/uiRuntimeAdapter';
import type { ProgramMyPlanDTO } from '../types/programDelivery';
import type { ProgramExplainabilityDTO } from '../types/explainability';
import { programDeliveryService } from '../services/programDeliveryService';
import { programGenerationService } from '../services/programGenerationService';
import { classifyTrustDecision } from '../services/trustSafetyService';
import Card from '../ui/components/Card';
import Timeline from '../ui/components/Timeline';
import StateContainer from '../ui/components/StateContainer';
import TrustBanner from '../ui/components/TrustBanner';
import ExplainabilityDrawer from '../ui/components/ExplainabilityDrawer';
import CoachMessageCard from '../ui/coach/CoachMessageCard';
import CoachExplainabilityDrawer from '../ui/coach/CoachExplainabilityDrawer';
import CoachRequestModal from '../ui/coach/CoachRequestModal';
import type { CoachDecisionResponse, CoachResponse } from '../services/coachRuntime';
import type { CoachExplainabilityBinding } from '../types/coachMemory';

const MyProgram = () => {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [runtimeStatus, setRuntimeStatus] = useState<RuntimeStatus>('loading');
  const [plan, setPlan] = useState<ProgramMyPlanDTO | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [trustMessage, setTrustMessage] = useState<string | null>(null);
  const [explainability, setExplainability] = useState<ProgramExplainabilityDTO | null>(null);
  const [selectedVersion, setSelectedVersion] = useState<number>(1);
  const [coachOverlay, setCoachOverlay] = useState<CoachResponse | null>(null);
  const [coachExplainability, setCoachExplainability] = useState<CoachExplainabilityBinding | null>(null);
  const [coachRequestOpen, setCoachRequestOpen] = useState(false);
  const [decisionSupport, setDecisionSupport] = useState<CoachDecisionResponse | null>(null);

  const loadProgram = useCallback(async () => {
    if (!user?.id) return;
    setRuntimeStatus('loading');
    setErrorMessage(null);
    setTrustMessage(null);
    uiRuntimeAdapter.startLoadingTimer('MyProgram', {
      pendingSources: ['program_phases', 'program_days', 'program_versions', 'program_adaptations'],
      onTimeout: () => {
        const decision = classifyTrustDecision('loading_timeout');
        setRuntimeStatus('error');
        setErrorMessage('Загрузка программы заняла слишком много времени.');
        setTrustMessage(decision.message);
      },
    });
    try {
      const state = await uiRuntimeAdapter.getProgramState(user.id);
      setRuntimeStatus(state.status);
      setPlan(state.program ?? null);
      setExplainability((state.explainability as ProgramExplainabilityDTO) ?? null);
      setTrustMessage(state.trust?.message ?? null);
      if (state.status === 'error') {
        setErrorMessage(state.message || 'Не удалось загрузить программу.');
      }
    } catch (error) {
      const decision = classifyTrustDecision(error);
      setRuntimeStatus('error');
      setErrorMessage('Не удалось загрузить программу.');
      setTrustMessage(decision.message);
    } finally {
      uiRuntimeAdapter.clearLoadingTimer('MyProgram');
    }
  }, [user?.id]);

  useEffect(() => {
    loadProgram();
  }, [loadProgram]);

  useEffect(() => {
    setSelectedVersion(plan?.programVersion ?? 1);
  }, [plan?.programVersion]);

  useEffect(() => {
    if (!user || !plan) {
      setDecisionSupport(null);
      return;
    }
    const status = plan.status?.toLowerCase() ?? '';
    const decisionType = status.includes('cancel')
      ? 'plan_drop'
      : status.includes('pause')
        ? 'long_pause'
        : null;
    if (!decisionType) {
      setDecisionSupport(null);
      return;
    }
    uiRuntimeAdapter
      .getDecisionSupport({
        decision_type: decisionType,
        emotional_state: status.includes('pause') ? 'recovering' : 'neutral',
        trust_level: 50,
        history_pattern: `Соблюдение: ${adherenceRate}%`,
        user_mode: 'Follow Plan',
        screen: 'Program',
        subscription_state: user.hasPremium ? 'Premium' : 'Free',
        safety_flags: plan.safetyFlags ?? [],
      })
      .then(setDecisionSupport)
      .catch(() => setDecisionSupport(null));
  }, [user, plan, adherenceRate]);

  const versionLabel = plan?.programVersion ? `v${plan.programVersion}` : 'v1';
  const phaseLabels = ['Build', 'Build', 'Deload', 'Recovery'];

  const weeks = useMemo(() => {
    if (!plan?.dayCards) return [];
    const grouped: Array<{ label: string; days: typeof plan.dayCards }> = [];
    plan.dayCards.forEach((day, index) => {
      const weekIndex = Math.floor(index / 7);
      const label = phaseLabels[weekIndex] || 'Build';
      if (!grouped[weekIndex]) {
        grouped[weekIndex] = { label, days: [] };
      }
      grouped[weekIndex].days.push(day);
    });
    return grouped;
  }, [plan?.dayCards]);

  const today = new Date().toISOString().split('T')[0];
  const totalDays = plan?.dayCards?.length ?? 0;
  const completedDays = plan?.dayCards?.filter((day) => day.status === 'completed').length ?? 0;
  const skippedDays = plan?.dayCards?.filter((day) => day.status === 'skipped').length ?? 0;
  const adherenceRate = totalDays ? Math.round((completedDays / totalDays) * 100) : 0;

  const timelineItems = weeks.map((week, index) => {
    const containsToday = week.days.some((day) => day.date === today);
    const weekCompleted = week.days.every((day) => day.status === 'completed');
    const weekUpcoming = week.days.every((day) => day.date > today);
    const status: 'active' | 'done' | 'upcoming' = weekCompleted
      ? 'done'
      : containsToday
        ? 'active'
        : weekUpcoming
          ? 'upcoming'
          : 'done';
    return {
      title: `Неделя ${index + 1} · ${week.label}`,
      subtitle: `${week.days.length} дней · ${Math.round(
        (week.days.filter((day) => day.status === 'completed').length / Math.max(1, week.days.length)) * 100
      )}% выполнения`,
      status,
    };
  });

  const safetyFlags = explainability?.safety_flags ?? [];
  const isPain = safetyFlags.includes('pain');
  const isFatigue = safetyFlags.includes('fatigue');
  const isRecovery = safetyFlags.includes('recovery_needed');
  const isOverload = safetyFlags.includes('overload');
  const trustLevel = explainability?.trust_level ?? explainability?.trust_score;

  const versionOptions = useMemo(() => {
    const count = plan?.programVersion ?? 1;
    return Array.from({ length: count }, (_, index) => index + 1);
  }, [plan?.programVersion]);

  const handleProgramAction = useCallback(
    async (action: 'pause' | 'resume' | 'replan') => {
      if (!plan) return;
      setRuntimeStatus('loading');
      setErrorMessage(null);
      setTrustMessage(null);
      try {
        if (action === 'pause') {
          await programDeliveryService.pauseProgram(plan.programId, plan.programType, 'manual_pause');
        }
        if (action === 'resume') {
          await programDeliveryService.resumeProgram(plan.programId, plan.programType);
        }
        if (action === 'replan') {
          await programGenerationService.replanProgram(plan.programId, plan.programType, {
            reason: 'manual_replan',
          });
        }
      } catch (error) {
        const decision = classifyTrustDecision(error);
        setRuntimeStatus('error');
        setErrorMessage('Не удалось обновить состояние плана.');
        setTrustMessage(decision.message);
        return;
      }
      loadProgram();
    },
    [plan, loadProgram]
  );

  useEffect(() => {
    if (!user?.id) return;
    const subscriptionState = user?.hasPremium ? 'Premium' : 'Free';
    uiRuntimeAdapter
      .getCoachOverlay('Program', {
        trustLevel,
        safetyFlags,
        userMode: plan ? 'Follow Plan' : 'Manual',
        subscriptionState,
        adherence: totalDays ? completedDays / totalDays : undefined,
      })
      .then(setCoachOverlay)
      .catch(() => setCoachOverlay(null));
  }, [completedDays, plan, safetyFlags, totalDays, trustLevel, user?.hasPremium, user?.id]);

  useEffect(() => {
    const decisionId = explainability?.decision_ref;
    if (!decisionId) return;
    const subscriptionState = user?.hasPremium ? 'Premium' : 'Free';
    uiRuntimeAdapter
      .getCoachExplainability(decisionId, { subscriptionState })
      .then(setCoachExplainability)
      .catch(() => setCoachExplainability(null));
  }, [explainability?.decision_ref, user?.hasPremium]);

  const getDayMarker = (day: ProgramMyPlanDTO['dayCards'][number]) => {
    const reasonText = `${day.explainabilitySummary?.reasonCode ?? ''} ${day.explainabilitySummary?.decisionRef ?? ''}`
      .toLowerCase()
      .trim();
    const hasSafety = ['pain', 'fatigue', 'overload', 'recovery'].some((flag) => reasonText.includes(flag));
    const isAdapted = !!day.explainabilitySummary && !hasSafety;

    if (hasSafety) {
      return { label: 'safety', className: 'bg-red-50 text-red-700 border-red-200' };
    }
    if (isAdapted) {
      return { label: 'адаптировано', className: 'bg-indigo-50 text-indigo-700 border-indigo-200' };
    }
    if (day.status === 'completed') {
      return { label: 'выполнено', className: 'bg-emerald-50 text-emerald-700 border-emerald-200' };
    }
    if (day.status === 'skipped') {
      return { label: 'пропущено', className: 'bg-amber-50 text-amber-700 border-amber-200' };
    }
    return { label: 'план', className: 'bg-gray-50 text-gray-600 border-gray-200' };
  };

  return (
    <div className="min-h-screen bg-white dark:bg-gray-900 w-full min-w-[320px]">
      <div className="container-responsive">
        <header className="py-4 flex items-center justify-between border-b border-gray-200 dark:border-gray-700">
          <div className="flex-1" />
          <h1 className="text-lg font-semibold text-gray-900 dark:text-white uppercase text-center flex-1">
            МОЯ ПРОГРАММА
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
                ? 'Активной программы ещё нет. Когда вы выберете режим Follow Plan, мы покажем путь здесь.'
                : errorMessage || undefined
            }
            onRetry={() => {
              if (runtimeStatus === 'offline') {
                uiRuntimeAdapter.revalidate().finally(loadProgram);
              } else {
                uiRuntimeAdapter.recover().finally(loadProgram);
              }
            }}
          >
            <button
              onClick={() => setCoachRequestOpen(true)}
              className="mb-3 rounded-xl border border-gray-300 px-3 py-2 text-xs font-semibold text-gray-700 dark:border-gray-700 dark:text-gray-200"
            >
              🧠 Спросить коуча
            </button>
            {isPain && (
              <TrustBanner tone="pain">
                Мы снизили нагрузку ради безопасности. Это бережное решение, а не откат.
              </TrustBanner>
            )}
            {isOverload && !isPain && (
              <TrustBanner tone="safety">
                Нагрузка скорректирована, чтобы сохранить устойчивость и здоровье.
              </TrustBanner>
            )}
            {isFatigue && !isPain && !isOverload && (
              <TrustBanner tone="fatigue">
                Усталость — нормальна. Мы подстроили план, чтобы сохранить ритм.
              </TrustBanner>
            )}
            {isRecovery && !isPain && !isOverload && !isFatigue && (
              <TrustBanner tone="recovery">
                Сейчас фаза восстановления. Сила растёт, когда отдых осознанный.
              </TrustBanner>
            )}

            {coachOverlay && (
              <CoachMessageCard
                mode={coachOverlay.ui_mode}
                message={coachOverlay.coach_message}
                footer={
                  plan?.status?.toLowerCase().includes('pause')
                    ? 'Мы можем вернуться, когда вы будете готовы.'
                    : undefined
                }
              />
            )}
            {decisionSupport && (
              <CoachMessageCard
                mode={decisionSupport.ui_mode}
                message={decisionSupport.coach_message}
                footer={
                  <CoachExplainabilityDrawer
                    decisionId={decisionSupport.decision_id}
                    trace={decisionSupport.explainability}
                    title="Почему важно решить это сейчас?"
                    confidence={decisionSupport.confidence}
                    trustLevel={decisionSupport.trust_state}
                    safetyFlags={decisionSupport.safety_flags}
                  />
                }
              />
            )}
            {plan?.status?.toLowerCase().includes('cancel') && (
              <CoachMessageCard
                mode="support"
                message="Мы сохраним ваш путь и поможем перейти в Manual Mode без давления."
              />
            )}

            {plan && (
              <div className="space-y-4">
                <Card
                  title="Мой путь"
                  action={<span className="text-xs text-gray-500">Версия {versionLabel}</span>}
                >
                  <div className="flex flex-wrap gap-3 text-xs text-gray-600 dark:text-gray-400">
                    <span>Статус: {plan.status}</span>
                    <span>Старт: {plan.startDate ?? '—'}</span>
                    <span>Финиш: {plan.endDate ?? '—'}</span>
                  </div>
                  <div className="mt-3 grid grid-cols-2 gap-3 text-sm text-gray-700 dark:text-gray-300">
                    <div>
                      Соблюдение: <span className="font-semibold">{adherenceRate}%</span>
                    </div>
                    <div>
                      Пропущено: <span className="font-semibold">{skippedDays}</span>
                    </div>
                  </div>
                  <p className="mt-3 text-xs text-gray-600 dark:text-gray-400">
                    План — это гибкий маршрут. Мы меняем его только ради устойчивости и результата.
                  </p>
                  <div className="mt-3 flex flex-wrap gap-2">
                    <button
                      onClick={() => navigate('/today')}
                      className="rounded-lg border border-gray-300 px-3 py-1.5 text-xs font-semibold text-gray-800 hover:bg-gray-100 dark:border-gray-700 dark:text-gray-200 dark:hover:bg-gray-800"
                    >
                      Сегодняшний день
                    </button>
                    <button
                      onClick={() => navigate('/progress')}
                      className="rounded-lg border border-gray-300 px-3 py-1.5 text-xs font-semibold text-gray-800 hover:bg-gray-100 dark:border-gray-700 dark:text-gray-200 dark:hover:bg-gray-800"
                    >
                      Смотреть прогресс по плану
                    </button>
                  </div>
                </Card>

                <Card title="Версии плана">
                  <div className="flex flex-wrap items-center gap-3">
                    <label htmlFor="program-version" className="text-xs text-gray-600 dark:text-gray-400">
                      Выберите версию:
                    </label>
                    <select
                      id="program-version"
                      value={selectedVersion}
                      onChange={(event) => setSelectedVersion(Number(event.target.value))}
                      className="rounded-lg border border-gray-200 bg-white px-3 py-1.5 text-xs text-gray-700 dark:border-gray-700 dark:bg-gray-900 dark:text-gray-200"
                    >
                      {versionOptions.map((version) => (
                        <option key={version} value={version}>
                          v{version}
                        </option>
                      ))}
                    </select>
                  </div>
                  {versionOptions.length === 1 && (
                    <p className="mt-2 text-xs text-gray-600 dark:text-gray-400">
                      Адаптации создают новые версии. Когда они появятся, здесь можно будет сравнить изменения.
                    </p>
                  )}
                </Card>

                <Timeline title="Таймлайн пути" items={timelineItems} />

                <Card title="Недели и дни">
                  <div className="space-y-3">
                    {weeks.map((week, idx) => (
                      <div key={`${week.label}-${idx}`} className="rounded-xl border border-gray-200 p-3 dark:border-gray-700">
                        <div className="flex items-center justify-between">
                          <span className="text-xs font-semibold text-gray-700 dark:text-gray-200">
                            Неделя {idx + 1}: {week.label}
                          </span>
                          <span className="text-xs text-gray-500">{week.days.length} дней</span>
                        </div>
                        <div className="mt-2 grid grid-cols-2 gap-2 mobile-lg:grid-cols-3">
                          {week.days.map((day) => {
                            const marker = getDayMarker(day);
                            return (
                              <div
                                key={day.date}
                                className={`rounded-lg border px-2 py-1 text-xs ${marker.className}`}
                              >
                                <div className="font-semibold">{day.date}</div>
                                <div className="text-[11px]">{marker.label}</div>
                              </div>
                            );
                          })}
                        </div>
                      </div>
                    ))}
                  </div>
                </Card>

                <Card title="Управление планом">
                  <p className="text-xs text-gray-600 dark:text-gray-400">
                    Вы управляете темпом. Мы бережно сохраняем путь и адаптируемся к вашему состоянию.
                  </p>
                  <div className="mt-3 flex flex-wrap gap-2">
                    <button
                      onClick={() => handleProgramAction('pause')}
                      className="rounded-lg border border-gray-300 px-3 py-1.5 text-xs font-semibold text-gray-800 hover:bg-gray-100 disabled:opacity-60 dark:border-gray-700 dark:text-gray-200 dark:hover:bg-gray-800"
                      disabled={plan.status === 'paused'}
                    >
                      Пауза
                    </button>
                    <button
                      onClick={() => handleProgramAction('resume')}
                      className="rounded-lg border border-gray-300 px-3 py-1.5 text-xs font-semibold text-gray-800 hover:bg-gray-100 disabled:opacity-60 dark:border-gray-700 dark:text-gray-200 dark:hover:bg-gray-800"
                      disabled={plan.status !== 'paused'}
                    >
                      Продолжить
                    </button>
                    <button
                      onClick={() => handleProgramAction('replan')}
                      className="rounded-lg border border-gray-300 px-3 py-1.5 text-xs font-semibold text-gray-800 hover:bg-gray-100 disabled:opacity-60 dark:border-gray-700 dark:text-gray-200 dark:hover:bg-gray-800"
                      disabled={plan.status === 'cancelled'}
                    >
                      Перепланировать
                    </button>
                    <button
                      className="rounded-lg border border-gray-200 px-3 py-1.5 text-xs font-semibold text-gray-400"
                      disabled
                    >
                      Отменить (скоро)
                    </button>
                  </div>
                </Card>

                <Card tone="explainable" title="Почему план изменился?">
                  <p className="text-xs text-gray-600 dark:text-gray-400">
                    Мы объясняем каждую адаптацию: что послужило триггером и как это защищает прогресс.
                  </p>
                  <div className="mt-3 grid grid-cols-1 gap-2 text-xs text-gray-700 dark:text-gray-300">
                    <div>Причина: {explainability?.adaptation_reason ?? 'нет данных'}</div>
                    <div>Решение: {explainability?.decision_ref ?? '—'}</div>
                    <div>Уверенность: {explainability?.confidence ?? 0}</div>
                    <div>Safety: {explainability?.safety_notes?.join(', ') || 'нет ограничений'}</div>
                  </div>
                  <div className="mt-4">
                    <ExplainabilityDrawer explainability={explainability} />
                    <div className="mt-3">
                      <CoachExplainabilityDrawer
                        decisionId={explainability?.decision_ref}
                        trace={coachExplainability}
                        confidence={explainability?.confidence}
                        trustLevel={String(explainability?.trust_level ?? explainability?.trust_score ?? '—')}
                        safetyFlags={explainability?.safety_flags ?? []}
                      />
                    </div>
                  </div>
                </Card>

                {trustMessage && (
                  <Card title="Поддержка">
                    <p className="text-xs text-gray-600 dark:text-gray-400">{trustMessage}</p>
                  </Card>
                )}
              </div>
            )}
          </StateContainer>
        </main>
      </div>
      {coachRequestOpen && (
        <CoachRequestModal
          open={coachRequestOpen}
          onClose={() => setCoachRequestOpen(false)}
          context={{
            screen: 'Program',
            userMode: plan ? 'Follow Plan' : 'Manual',
            subscriptionState: user?.hasPremium ? 'Premium' : 'Free',
            trustLevel,
            safetyFlags,
            adherence: totalDays ? completedDays / totalDays : undefined,
          }}
        />
      )}
    </div>
  );
};

export default MyProgram;
