import { useMemo, useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { X, Check, Circle, Calendar } from 'lucide-react';
import { createHabit, toggleHabitComplete, HabitWithStatus, HabitFrequency } from '../services/habitsService';
import { uiRuntimeAdapter, type RuntimeStatus } from '../services/uiRuntimeAdapter';
import type { HabitsExplainabilityDTO } from '../types/explainability';
import { classifyTrustDecision } from '../services/trustSafetyService';
import Card from '../ui/components/Card';
import Timeline from '../ui/components/Timeline';
import StateContainer from '../ui/components/StateContainer';
import TrustBanner from '../ui/components/TrustBanner';
import ExplainabilityDrawer from '../ui/components/ExplainabilityDrawer';
import ScreenContainer from '../ui/components/ScreenContainer';
import Button from '../ui/components/Button';
import Input from '../ui/components/Input';
import { colors, spacing, typography } from '../ui/theme/tokens';
import CoachMessageCard from '../ui/coach/CoachMessageCard';
import CoachNudge from '../ui/coach/CoachNudge';
import CoachExplainabilityDrawer from '../ui/coach/CoachExplainabilityDrawer';
import CoachRequestModal from '../ui/coach/CoachRequestModal';
import { coachRuntime, type CoachResponse, type CoachScreenContext } from '../services/coachRuntime';
import type { CoachExplainabilityBinding } from '../types/coachMemory';

const Habits = () => {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [habits, setHabits] = useState<HabitWithStatus[]>([]);
  const [selectedDate, setSelectedDate] = useState(new Date().toISOString().split('T')[0]);
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
  const [newHabitTitle, setNewHabitTitle] = useState('');
  const [newHabitDescription, setNewHabitDescription] = useState('');
  const [newHabitFrequency, setNewHabitFrequency] = useState<HabitFrequency>('daily');
  const [isWorking, setIsWorking] = useState(false);
  const [runtimeStatus, setRuntimeStatus] = useState<RuntimeStatus>('loading');
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [trustMessage, setTrustMessage] = useState<string | null>(null);
  const [explainability, setExplainability] = useState<HabitsExplainabilityDTO | null>(null);
  const [habitStats, setHabitStats] = useState<Record<string, { streak: number; adherence: number }>>({});
  const [coachOverlay, setCoachOverlay] = useState<CoachResponse | null>(null);
  const [coachExplainability, setCoachExplainability] = useState<CoachExplainabilityBinding | null>(null);
  const [coachRequestOpen, setCoachRequestOpen] = useState(false);

  const buildCoachContext = (): CoachScreenContext => ({
    screen: 'Habits',
    userMode: 'Manual',
    subscriptionState: user?.hasPremium ? 'Premium' : 'Free',
    trustLevel: explainability?.trust_level ?? explainability?.trust_score,
    safetyFlags: [],
  });

  useEffect(() => {
    if (!user?.id) {
      navigate('/login');
      return;
    }

    loadHabits();
  }, [user, selectedDate, navigate]);

  const loadHabits = async () => {
    if (!user?.id) return;
    setIsWorking(true);
    setRuntimeStatus('loading');
    setErrorMessage(null);
    setTrustMessage(null);
    uiRuntimeAdapter.startLoadingTimer('Habits', {
      pendingSources: ['habits', 'habit_logs'],
      onTimeout: () => {
        const decision = classifyTrustDecision('loading_timeout');
        setRuntimeStatus('error');
        setErrorMessage('Загрузка привычек заняла слишком много времени.');
        setTrustMessage(decision.message);
      },
    });
    try {
      const state = await uiRuntimeAdapter.getHabitsState(user.id, selectedDate);
      setRuntimeStatus(state.status);
      setHabits(state.habits || []);
      setExplainability(state.explainability ?? null);
      setTrustMessage(state.trust?.message ?? null);
      setHabitStats(state.habitStats || {});
      if (state.status === 'error') {
        setErrorMessage(state.message || 'Не удалось загрузить привычки.');
      }
    } catch (error) {
      const decision = classifyTrustDecision(error);
      setRuntimeStatus('error');
      setErrorMessage('Не удалось загрузить привычки.');
      setTrustMessage(decision.message);
    } finally {
      uiRuntimeAdapter.clearLoadingTimer('Habits');
      setIsWorking(false);
    }
  };

  const handleCreateHabit = async () => {
    if (!user?.id || !newHabitTitle.trim()) return;

    setIsWorking(true);
    try {
      const habit = await createHabit({
        userId: user.id,
        title: newHabitTitle.trim(),
        description: newHabitDescription.trim() || undefined,
        frequency: newHabitFrequency,
      });

      if (habit) {
        setNewHabitTitle('');
        setNewHabitDescription('');
        setNewHabitFrequency('daily');
        setIsCreateModalOpen(false);
        await loadHabits();
      }
    } catch (error) {
      const decision = classifyTrustDecision(error);
      setErrorMessage('Не удалось создать привычку.');
      setTrustMessage(decision.message);
    } finally {
      setIsWorking(false);
    }
  };

  const handleToggleHabit = async (habitId: string) => {
    if (!user?.id) return;

    setIsWorking(true);
    try {
      const targetHabit = habits.find((habit) => habit.id === habitId);
      const previousStatus = targetHabit ? habitStatus(targetHabit) : 'on_track';
      await toggleHabitComplete({
        userId: user.id,
        habitId,
        date: selectedDate,
      });
      const wasCompleted = Boolean(targetHabit?.completed);
      const eventType = wasCompleted
        ? 'HabitBroken'
        : previousStatus === 'break' || previousStatus === 'slip'
          ? 'StreakRecovered'
          : 'HabitCompleted';
      void coachRuntime.handleUserEvent(
        {
          type: eventType,
          timestamp: new Date().toISOString(),
          payload: {
            habit_id: habitId,
            date: selectedDate,
            previous_status: previousStatus,
            source: 'ui',
          },
          confidence: 0.6,
          safetyClass: 'normal',
          trustImpact: wasCompleted ? -1 : 1,
        },
        buildCoachContext()
      );
      await loadHabits();
    } catch (error) {
      const decision = classifyTrustDecision(error);
      setErrorMessage('Не удалось обновить привычку.');
      setTrustMessage(decision.message);
    } finally {
      setIsWorking(false);
    }
  };

  const handleDateChange = (days: number) => {
    const newDate = new Date(selectedDate);
    newDate.setDate(newDate.getDate() + days);
    setSelectedDate(newDate.toISOString().split('T')[0]);
  };

  const formatDate = (dateString: string): string => {
    const date = new Date(dateString);
    const today = new Date();
    const yesterday = new Date(today);
    yesterday.setDate(yesterday.getDate() - 1);
    const tomorrow = new Date(today);
    tomorrow.setDate(tomorrow.getDate() + 1);

    if (dateString === today.toISOString().split('T')[0]) {
      return 'Сегодня';
    } else if (dateString === yesterday.toISOString().split('T')[0]) {
      return 'Вчера';
    } else if (dateString === tomorrow.toISOString().split('T')[0]) {
      return 'Завтра';
    }

    const day = date.getDate();
    const month = date.toLocaleDateString('ru-RU', { month: 'long' });
    return `${day} ${month}`;
  };

  const totalHabits = habits.length;
  const completedHabits = habits.filter((habit) => habit.completed).length;
  const adherenceRate = totalHabits
    ? Math.round(
        (Object.values(habitStats).reduce((sum, stat) => sum + (stat?.adherence ?? 0), 0) / totalHabits) * 100
      )
    : 0;

  const habitStatus = (habit: HabitWithStatus) => {
    const stats = habitStats[habit.id];
    const streak = stats?.streak ?? 0;
    const adherence = stats?.adherence ?? 0;
    if (habit.completed && adherence < 0.5) return 'recovery';
    if (!habit.completed && streak === 0) return 'break';
    if (!habit.completed && streak > 0) return 'slip';
    return 'on_track';
  };

  const rhythmTimeline = useMemo(() => {
    if (totalHabits === 0) {
      return [
        {
          title: 'Ритм начинается здесь',
          subtitle: 'Создайте 1–2 привычки и двигайтесь спокойно.',
          status: 'upcoming' as const,
        },
      ];
    }
    if (adherenceRate >= 70) {
      return [
        { title: 'Ритм устойчив', subtitle: 'Вы держите темп уверенно.', status: 'done' as const },
        { title: 'Рост доверия', subtitle: 'Стабильность укрепляет уверенность.', status: 'active' as const },
      ];
    }
    if (adherenceRate >= 40) {
      return [
        { title: 'Ритм формируется', subtitle: 'Небольшие шаги дают устойчивость.', status: 'active' as const },
        { title: 'Срыв ≠ провал', subtitle: 'Мы поддержим возвращение.', status: 'upcoming' as const },
      ];
    }
    return [
      { title: 'Нужен мягкий возврат', subtitle: 'Ритм важнее идеальности.', status: 'active' as const },
      { title: 'План восстановления', subtitle: 'Мы начнем с малого.', status: 'upcoming' as const },
    ];
  }, [adherenceRate, totalHabits]);

  useEffect(() => {
    if (!user?.id) return;
    const trustLevel = explainability?.trust_level ?? explainability?.trust_score;
    const subscriptionState = user?.hasPremium ? 'Premium' : 'Free';
    uiRuntimeAdapter
      .getCoachOverlay('Habits', {
        trustLevel,
        subscriptionState,
        adherence: adherenceRate ? adherenceRate / 100 : undefined,
        streak: Math.max(...Object.values(habitStats).map((stat) => stat?.streak ?? 0), 0),
      })
      .then(setCoachOverlay)
      .catch(() => setCoachOverlay(null));
  }, [adherenceRate, habitStats, explainability?.trust_level, explainability?.trust_score, user?.hasPremium, user?.id]);

  useEffect(() => {
    const decisionId = explainability?.decision_ref;
    if (!decisionId) return;
    const subscriptionState = user?.hasPremium ? 'Premium' : 'Free';
    uiRuntimeAdapter
      .getCoachExplainability(decisionId, { subscriptionState })
      .then(setCoachExplainability)
      .catch(() => setCoachExplainability(null));
  }, [explainability?.decision_ref, user?.hasPremium]);

  return (
    <ScreenContainer>
      <header className="flex items-center justify-between" style={{ marginBottom: spacing.lg }}>
        <div style={{ width: 32 }} />
        <h1 style={{ ...typography.title, textTransform: 'uppercase', textAlign: 'center' }}>Привычки</h1>
        <Button variant="ghost" size="sm" onClick={() => navigate('/')} aria-label="Закрыть">
          <X className="w-5 h-5" style={{ color: colors.text.secondary }} />
        </Button>
      </header>

      <StateContainer
        status={runtimeStatus}
        message={runtimeStatus === 'empty' ? 'Пока нет привычек. Начните с одной опоры.' : errorMessage || undefined}
        onRetry={() => {
          if (runtimeStatus === 'offline') {
            uiRuntimeAdapter.revalidate().finally(loadHabits);
          } else {
            uiRuntimeAdapter.recover().finally(loadHabits);
          }
        }}
      >
        <Button variant="outline" size="sm" onClick={() => setCoachRequestOpen(true)} style={{ marginBottom: spacing.sm }}>
          🧠 Спросить коуча
        </Button>
            {coachOverlay && (
              <CoachNudge message={coachOverlay.coach_message} mode={coachOverlay.ui_mode} />
            )}
            {habits.some((habit) => habitStatus(habit) === 'break') && (
              <TrustBanner tone="recovery">
                Вы не сломались — вы восстанавливаетесь. Ритм важнее идеальности.
              </TrustBanner>
            )}
            {habits.some((habit) => habitStatus(habit) === 'slip') && (
              <TrustBanner tone="plateau">
                Один пропуск — это сигнал, не провал. Возвращаемся спокойно.
              </TrustBanner>
            )}

            {adherenceRate < 40 && totalHabits > 0 && (
              <CoachMessageCard
                mode="support"
                message="Ритм важнее идеальности. Начнем с одного устойчивого шага."
              />
            )}

            <div className="space-y-4">
              <Card title="Ритм дня" action={<span style={typography.micro}>{formatDate(selectedDate)}</span>}>
                <div className="flex items-center justify-between">
                  <Button variant="ghost" size="sm" onClick={() => handleDateChange(-1)} aria-label="Предыдущий день">
                    <Calendar className="w-5 h-5" style={{ color: colors.text.secondary }} />
                  </Button>
                  <div className="text-center">
                    <p style={typography.micro}>Выполнено</p>
                    <p style={{ ...typography.title, fontSize: '18px' }}>
                      {completedHabits}/{totalHabits}
                    </p>
                  </div>
                  <Button variant="ghost" size="sm" onClick={() => handleDateChange(1)} aria-label="Следующий день">
                    <Calendar className="w-5 h-5 rotate-180" style={{ color: colors.text.secondary }} />
                  </Button>
                </div>
                <div style={{ ...typography.subtitle, marginTop: spacing.sm }}>
                  Устойчивость: {adherenceRate}% · Стрики укрепляют доверие к себе.
                </div>
              </Card>

              <Timeline title="Линия ритма" items={rhythmTimeline} />

              <Card title="Мои привычки" action={<span style={typography.micro}>{totalHabits} активных</span>}>
                {totalHabits === 0 ? (
                  <div className="text-center py-6">
                    <p style={{ ...typography.body, marginBottom: spacing.sm }}>
                      Привычки — это опора, а не контроль. Начните с одной.
                    </p>
                    <Button variant="outline" size="sm" onClick={() => setIsCreateModalOpen(true)}>
                      Создать первую привычку
                    </Button>
                  </div>
                ) : (
                  <div className="space-y-3">
                    {habits.map((habit) => {
                      const status = habitStatus(habit);
                      const statusLabel =
                        status === 'recovery'
                          ? 'возврат'
                          : status === 'break'
                            ? 'пауза'
                            : status === 'slip'
                              ? 'срыв'
                              : 'ритм';
                      return (
                        <div
                          key={habit.id}
                          className="flex items-start justify-between gap-3"
                          style={{
                            borderRadius: 10,
                            border: `1px solid ${colors.border}`,
                            padding: spacing.sm,
                            backgroundColor: colors.surface,
                          }}
                        >
                          <div className="flex-1">
                            <h3 style={typography.body}>{habit.title}</h3>
                            {habit.description && (
                              <p style={{ ...typography.subtitle, marginTop: spacing.xs }}>
                                {habit.description}
                              </p>
                            )}
                            <div className="flex flex-wrap items-center" style={{ gap: spacing.xs, marginTop: spacing.xs }}>
                              <span style={typography.micro}>
                                {habit.frequency === 'daily' ? 'Ежедневно' : 'Еженедельно'}
                              </span>
                              <span style={typography.micro}>•</span>
                              <span style={typography.micro}>Стрик: {habitStats[habit.id]?.streak ?? 0}</span>
                              <span style={typography.micro}>•</span>
                              <span style={typography.micro}>
                                Ритм: {Math.round((habitStats[habit.id]?.adherence ?? 0) * 100)}%
                              </span>
                              <span style={typography.micro}>•</span>
                              <span style={typography.micro}>{statusLabel}</span>
                            </div>
                            {status !== 'on_track' && (
                              <p style={{ ...typography.micro, marginTop: spacing.xs }}>
                                Ритм важнее идеальности. Мы поможем вернуться.
                              </p>
                            )}
                          </div>
                          <button
                            onClick={() => handleToggleHabit(habit.id)}
                            disabled={isWorking}
                            className="mt-1 flex h-9 w-9 items-center justify-center"
                            style={{
                              borderRadius: 10,
                              border: `1px solid ${colors.border}`,
                              backgroundColor: habit.completed ? colors.success : colors.emotional.support,
                              color: habit.completed ? '#FFFFFF' : colors.text.secondary,
                            }}
                            aria-label={habit.completed ? 'Отметить как невыполненное' : 'Отметить как выполненное'}
                          >
                            {habit.completed ? <Check className="w-5 h-5" /> : <Circle className="w-5 h-5" />}
                          </button>
                        </div>
                      );
                    })}
                  </div>
                )}
              </Card>

              <Card title="Создать привычку">
                <p style={typography.subtitle}>
                  Привычка — это ваш ритм. Мы помогаем удерживать его мягко.
                </p>
                <Button
                  variant="primary"
                  size="lg"
                  onClick={() => setIsCreateModalOpen(true)}
                  disabled={isWorking}
                  style={{ width: '100%', marginTop: spacing.sm }}
                >
                  Создать привычку
                </Button>
              </Card>

              <Card tone="explainable" title="Почему привычки важны?">
                <p style={typography.subtitle}>
                  Мы объясняем влияние привычек на прогресс и восстановление.
                </p>
                <div className="grid grid-cols-2" style={{ gap: spacing.sm, marginTop: spacing.sm }}>
                  <div style={typography.body}>Источники: {explainability?.data_sources?.join(', ') || '—'}</div>
                  <div style={typography.body}>Уверенность: {explainability?.confidence ?? '—'}</div>
                  <div style={typography.body}>Trust: {explainability?.trust_level ?? '—'}</div>
                  <div style={typography.body}>Safety: {explainability?.safety_notes?.join(', ') || '—'}</div>
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
      </StateContainer>

      {/* Create Habit Modal */}
      {isCreateModalOpen && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-end z-50">
          <div
            className="w-full max-w-[768px] mx-auto max-h-[90vh] overflow-y-auto"
            style={{ backgroundColor: colors.surface, borderRadius: 16, padding: spacing.lg }}
          >
            <div className="flex items-center justify-between" style={{ marginBottom: spacing.lg }}>
              <h2 style={typography.title}>Создать привычку</h2>
              <Button variant="ghost" size="sm" onClick={() => setIsCreateModalOpen(false)}>
                <X className="w-5 h-5" style={{ color: colors.text.secondary }} />
              </Button>
            </div>

            <div className="flex flex-col" style={{ gap: spacing.md }}>
              <Input
                label="Название"
                value={newHabitTitle}
                onChange={(e) => setNewHabitTitle(e.target.value)}
                placeholder="Например: Ложиться спать до 23:00"
              />

              <div className="flex flex-col" style={{ gap: spacing.xs }}>
                <label style={typography.subtitle}>Описание (необязательно)</label>
                <textarea
                  value={newHabitDescription}
                  onChange={(e) => setNewHabitDescription(e.target.value)}
                  placeholder="Зачем мне это? Например: больше энергии утром"
                  rows={3}
                  style={{
                    borderRadius: 10,
                    border: `1px solid ${colors.border}`,
                    backgroundColor: colors.surface,
                    color: colors.text.primary,
                    padding: `10px ${spacing.md}px`,
                    fontSize: '14px',
                    resize: 'none',
                  }}
                />
              </div>

              <div className="flex flex-col" style={{ gap: spacing.xs }}>
                <label style={typography.subtitle}>Частота</label>
                <div className="flex" style={{ gap: spacing.sm }}>
                  <Button
                    variant={newHabitFrequency === 'daily' ? 'primary' : 'outline'}
                    size="md"
                    onClick={() => setNewHabitFrequency('daily')}
                    style={{ flex: 1 }}
                  >
                    Ежедневно
                  </Button>
                  <Button
                    variant={newHabitFrequency === 'weekly' ? 'primary' : 'outline'}
                    size="md"
                    onClick={() => setNewHabitFrequency('weekly')}
                    style={{ flex: 1 }}
                  >
                    Еженедельно
                  </Button>
                </div>
              </div>

              <div className="flex" style={{ gap: spacing.sm, paddingTop: spacing.xs }}>
                <Button variant="outline" size="lg" onClick={() => setIsCreateModalOpen(false)} style={{ flex: 1 }}>
                  Отмена
                </Button>
                <Button
                  variant="primary"
                  size="lg"
                  onClick={handleCreateHabit}
                  disabled={!newHabitTitle.trim() || isWorking}
                  style={{ flex: 1 }}
                >
                  Создать
                </Button>
              </div>
            </div>
          </div>
        </div>
      )}
      {coachRequestOpen && (
        <CoachRequestModal
          open={coachRequestOpen}
          onClose={() => setCoachRequestOpen(false)}
          context={{
            screen: 'Habits',
            userMode: 'Manual',
            subscriptionState: user?.hasPremium ? 'Premium' : 'Free',
            trustLevel: explainability?.trust_level ?? explainability?.trust_score,
            adherence: adherenceRate ? adherenceRate / 100 : undefined,
            streak: Math.max(...Object.values(habitStats).map((stat) => stat?.streak ?? 0), 0),
          }}
        />
      )}
    </ScreenContainer>
  );
};

export default Habits;

