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
import ScreenContainer from '../ui/components/ScreenContainer';
import Button from '../ui/components/Button';
import { colors, spacing, typography } from '../ui/theme/tokens';
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
  const safetyFlags = explainability?.safety_flags ?? [];

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
        safety_flags: safetyFlags,
      })
      .then(setDecisionSupport)
      .catch(() => setDecisionSupport(null));
  }, [user, plan, adherenceRate, safetyFlags]);

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
      return {
        label: 'safety',
        style: { backgroundColor: colors.emotional.fatigue, color: colors.danger, borderColor: colors.border },
      };
    }
    if (isAdapted) {
      return {
        label: 'адаптировано',
        style: { backgroundColor: colors.emotional.plateau, color: colors.primary, borderColor: colors.border },
      };
    }
    if (day.status === 'completed') {
      return {
        label: 'выполнено',
        style: { backgroundColor: colors.emotional.recovery, color: colors.success, borderColor: colors.border },
      };
    }
    if (day.status === 'skipped') {
      return {
        label: 'пропущено',
        style: { backgroundColor: colors.emotional.fatigue, color: colors.warning, borderColor: colors.border },
      };
    }
    return {
      label: 'план',
      style: { backgroundColor: colors.emotional.support, color: colors.text.secondary, borderColor: colors.border },
    };
  };

  return (
    <ScreenContainer>
      <header className="flex items-center justify-between" style={{ marginBottom: spacing.lg }}>
        <div style={{ width: 32 }} />
        <h1 style={{ ...typography.title, textTransform: 'uppercase', textAlign: 'center' }}>Моя программа</h1>
        <Button variant="ghost" size="sm" onClick={() => navigate('/')} aria-label="Закрыть">
          <X className="w-5 h-5" style={{ color: colors.text.secondary }} />
        </Button>
      </header>

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
        <Button variant="outline" size="sm" onClick={() => setCoachRequestOpen(true)} style={{ marginBottom: spacing.sm }}>
          🧠 Спросить коуча
        </Button>
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
                <Card title="Мой путь" action={<span style={typography.micro}>Версия {versionLabel}</span>}>
                  <div className="flex flex-wrap" style={{ gap: spacing.sm }}>
                    <span style={typography.subtitle}>Статус: {plan.status}</span>
                    <span style={typography.subtitle}>Старт: {plan.startDate ?? '—'}</span>
                    <span style={typography.subtitle}>Финиш: {plan.endDate ?? '—'}</span>
                  </div>
                  <div className="grid grid-cols-2" style={{ gap: spacing.sm, marginTop: spacing.sm }}>
                    <div style={typography.body}>
                      Соблюдение: <span style={{ fontWeight: 600 }}>{adherenceRate}%</span>
                    </div>
                    <div style={typography.body}>
                      Пропущено: <span style={{ fontWeight: 600 }}>{skippedDays}</span>
                    </div>
                  </div>
                  <p style={{ ...typography.subtitle, marginTop: spacing.sm }}>
                    План — это гибкий маршрут. Мы меняем его только ради устойчивости и результата.
                  </p>
                  <div className="flex flex-wrap" style={{ gap: spacing.sm, marginTop: spacing.sm }}>
                    <Button variant="outline" size="sm" onClick={() => navigate('/today')}>
                      Сегодняшний день
                    </Button>
                    <Button variant="outline" size="sm" onClick={() => navigate('/progress')}>
                      Смотреть прогресс по плану
                    </Button>
                  </div>
                </Card>

                <Card title="Версии плана">
                  <div className="flex flex-wrap items-center" style={{ gap: spacing.sm }}>
                    <label htmlFor="program-version" style={typography.subtitle}>
                      Выберите версию:
                    </label>
                    <select
                      id="program-version"
                      value={selectedVersion}
                      onChange={(event) => setSelectedVersion(Number(event.target.value))}
                      style={{
                        borderRadius: 8,
                        border: `1px solid ${colors.border}`,
                        backgroundColor: colors.surface,
                        color: colors.text.primary,
                        padding: '6px 10px',
                        fontSize: '12px',
                      }}
                    >
                      {versionOptions.map((version) => (
                        <option key={version} value={version}>
                          v{version}
                        </option>
                      ))}
                    </select>
                  </div>
                  {versionOptions.length === 1 && (
                    <p style={{ ...typography.subtitle, marginTop: spacing.xs }}>
                      Адаптации создают новые версии. Когда они появятся, здесь можно будет сравнить изменения.
                    </p>
                  )}
                </Card>

                <Timeline title="Таймлайн пути" items={timelineItems} />

                <Card title="Недели и дни">
                  <div className="flex flex-col" style={{ gap: spacing.sm }}>
                    {weeks.map((week, idx) => (
                      <div
                        key={`${week.label}-${idx}`}
                        style={{
                          borderRadius: 10,
                          border: `1px solid ${colors.border}`,
                          padding: spacing.sm,
                          backgroundColor: colors.surface,
                        }}
                      >
                        <div className="flex items-center justify-between">
                          <span style={{ ...typography.subtitle, fontWeight: 600 }}>
                            Неделя {idx + 1}: {week.label}
                          </span>
                          <span style={typography.micro}>{week.days.length} дней</span>
                        </div>
                        <div
                          className="grid grid-cols-2 mobile-lg:grid-cols-3"
                          style={{ gap: spacing.xs, marginTop: spacing.xs }}
                        >
                          {week.days.map((day) => {
                            const marker = getDayMarker(day);
                            return (
                              <div
                                key={day.date}
                                style={{
                                  borderRadius: 8,
                                  border: `1px solid ${marker.style.borderColor}`,
                                  backgroundColor: marker.style.backgroundColor,
                                  color: marker.style.color,
                                  padding: '4px 8px',
                                  fontSize: '12px',
                                }}
                              >
                                <div style={{ fontWeight: 600 }}>{day.date}</div>
                                <div style={{ fontSize: '11px' }}>{marker.label}</div>
                              </div>
                            );
                          })}
                        </div>
                      </div>
                    ))}
                  </div>
                </Card>

                <Card title="Управление планом">
                  <p style={typography.subtitle}>
                    Вы управляете темпом. Мы бережно сохраняем путь и адаптируемся к вашему состоянию.
                  </p>
                  <div className="flex flex-wrap" style={{ gap: spacing.sm, marginTop: spacing.sm }}>
                    <Button variant="outline" size="sm" onClick={() => handleProgramAction('pause')} disabled={plan.status === 'paused'}>
                      Пауза
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => handleProgramAction('resume')}
                      disabled={plan.status !== 'paused'}
                    >
                      Продолжить
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => handleProgramAction('replan')}
                      disabled={plan.status === 'cancelled'}
                    >
                      Перепланировать
                    </Button>
                    <Button variant="ghost" size="sm" disabled>
                      Отменить (скоро)
                    </Button>
                  </div>
                </Card>

                <Card tone="explainable" title="Почему план изменился?">
                  <p style={typography.subtitle}>
                    Мы объясняем каждую адаптацию: что послужило триггером и как это защищает прогресс.
                  </p>
                  <div className="grid grid-cols-1" style={{ gap: spacing.xs, marginTop: spacing.sm }}>
                    <div style={typography.body}>Причина: {explainability?.adaptation_reason ?? 'нет данных'}</div>
                    <div style={typography.body}>Решение: {explainability?.decision_ref ?? '—'}</div>
                    <div style={typography.body}>Уверенность: {explainability?.confidence ?? 0}</div>
                    <div style={typography.body}>Safety: {explainability?.safety_notes?.join(', ') || 'нет ограничений'}</div>
                  </div>
                  <div style={{ marginTop: spacing.md }}>
                    <ExplainabilityDrawer explainability={explainability} />
                    <div style={{ marginTop: spacing.sm }}>
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
                    <p style={typography.subtitle}>{trustMessage}</p>
                  </Card>
                )}
              </div>
            )}
      </StateContainer>
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
    </ScreenContainer>
  );
};

export default MyProgram;
