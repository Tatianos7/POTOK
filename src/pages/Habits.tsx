import { useMemo, useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { X, Plus, Check, Circle, Calendar } from 'lucide-react';
import { createHabit, toggleHabitComplete, HabitWithStatus, HabitFrequency } from '../services/habitsService';
import { uiRuntimeAdapter, type RuntimeStatus } from '../services/uiRuntimeAdapter';
import type { HabitsExplainabilityDTO } from '../types/explainability';
import { classifyTrustDecision } from '../services/trustSafetyService';
import Card from '../ui/components/Card';
import Timeline from '../ui/components/Timeline';
import StateContainer from '../ui/components/StateContainer';
import TrustBanner from '../ui/components/TrustBanner';
import ExplainabilityDrawer from '../ui/components/ExplainabilityDrawer';
import CoachMessageCard from '../ui/coach/CoachMessageCard';
import CoachNudge from '../ui/coach/CoachNudge';
import CoachExplainabilityDrawer from '../ui/coach/CoachExplainabilityDrawer';
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
    <div className="min-h-screen bg-white dark:bg-gray-900 w-full min-w-[320px]">
      <div className="container-responsive">
        {/* Header */}
        <header className="py-4 flex items-center justify-between border-b border-gray-200 dark:border-gray-700">
          <div className="flex-1" />
          <h1 className="text-lg font-semibold text-gray-900 dark:text-white flex-1 text-center uppercase">
            ПРИВЫЧКИ
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
            message={runtimeStatus === 'empty' ? 'Пока нет привычек. Начните с одной опоры.' : errorMessage || undefined}
            onRetry={() => {
              if (runtimeStatus === 'offline') {
                uiRuntimeAdapter.revalidate().finally(loadHabits);
              } else {
                uiRuntimeAdapter.recover().finally(loadHabits);
              }
            }}
          >
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
              <Card title="Ритм дня" action={<span className="text-xs text-gray-500">{formatDate(selectedDate)}</span>}>
                <div className="flex items-center justify-between">
                  <button
                    onClick={() => handleDateChange(-1)}
                    className="p-2 hover:bg-gray-100 dark:hover:bg-gray-800 rounded-lg transition-colors"
                    aria-label="Предыдущий день"
                  >
                    <Calendar className="w-5 h-5 text-gray-700 dark:text-gray-300" />
                  </button>
                  <div className="text-center">
                    <p className="text-xs text-gray-600 dark:text-gray-400">Выполнено</p>
                    <p className="text-lg font-semibold text-gray-900 dark:text-white">
                      {completedHabits}/{totalHabits}
                    </p>
                  </div>
                  <button
                    onClick={() => handleDateChange(1)}
                    className="p-2 hover:bg-gray-100 dark:hover:bg-gray-800 rounded-lg transition-colors"
                    aria-label="Следующий день"
                  >
                    <Calendar className="w-5 h-5 text-gray-700 dark:text-gray-300 rotate-180" />
                  </button>
                </div>
                <div className="mt-3 text-xs text-gray-600 dark:text-gray-400">
                  Устойчивость: {adherenceRate}% · Стрики укрепляют доверие к себе.
                </div>
              </Card>

              <Timeline title="Линия ритма" items={rhythmTimeline} />

              <Card title="Мои привычки" action={<span className="text-xs text-gray-500">{totalHabits} активных</span>}>
                {totalHabits === 0 ? (
                  <div className="text-center py-6">
                    <p className="text-sm text-gray-600 dark:text-gray-400 mb-3">
                      Привычки — это опора, а не контроль. Начните с одной.
                    </p>
                    <button
                      onClick={() => setIsCreateModalOpen(true)}
                      className="px-4 py-2 rounded-lg border border-gray-300 text-gray-800 text-xs font-semibold hover:bg-gray-100 dark:border-gray-700 dark:text-gray-200 dark:hover:bg-gray-800"
                    >
                      Создать первую привычку
                    </button>
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
                          className="flex items-start justify-between gap-3 rounded-xl border border-gray-200 p-3 dark:border-gray-700"
                        >
                          <div className="flex-1">
                            <h3 className="text-sm font-semibold text-gray-900 dark:text-white">
                              {habit.title}
                            </h3>
                            {habit.description && (
                              <p className="text-xs text-gray-600 dark:text-gray-400 mt-1">
                                {habit.description}
                              </p>
                            )}
                            <div className="mt-2 flex flex-wrap items-center gap-2 text-xs text-gray-600 dark:text-gray-400">
                              <span>{habit.frequency === 'daily' ? 'Ежедневно' : 'Еженедельно'}</span>
                              <span>•</span>
                              <span>Стрик: {habitStats[habit.id]?.streak ?? 0}</span>
                              <span>•</span>
                              <span>Ритм: {Math.round((habitStats[habit.id]?.adherence ?? 0) * 100)}%</span>
                              <span>•</span>
                              <span>{statusLabel}</span>
                            </div>
                            {status !== 'on_track' && (
                              <p className="mt-1 text-[11px] text-gray-500 dark:text-gray-400">
                                Ритм важнее идеальности. Мы поможем вернуться.
                              </p>
                            )}
                          </div>
                          <button
                            onClick={() => handleToggleHabit(habit.id)}
                            disabled={isWorking}
                            className={`mt-1 p-2 rounded-lg transition-colors ${
                              habit.completed
                                ? 'bg-emerald-500 text-white'
                                : 'bg-gray-100 dark:bg-gray-800 text-gray-600 dark:text-gray-400'
                            }`}
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
                <p className="text-xs text-gray-600 dark:text-gray-400">
                  Привычка — это ваш ритм. Мы помогаем удерживать его мягко.
                </p>
                <button
                  onClick={() => setIsCreateModalOpen(true)}
                  disabled={isWorking}
                  className="mt-3 w-full rounded-xl bg-gray-900 text-white py-3 text-sm font-semibold uppercase hover:bg-gray-800 disabled:opacity-50 dark:bg-white dark:text-gray-900 dark:hover:bg-gray-100"
                >
                  Создать привычку
                </button>
              </Card>

              <Card tone="explainable" title="Почему привычки важны?">
                <p className="text-xs text-gray-600 dark:text-gray-400">
                  Мы объясняем влияние привычек на прогресс и восстановление.
                </p>
                <div className="mt-3 grid grid-cols-2 gap-3 text-xs text-gray-700 dark:text-gray-300">
                  <div>Источники: {explainability?.data_sources?.join(', ') || '—'}</div>
                  <div>Уверенность: {explainability?.confidence ?? '—'}</div>
                  <div>Trust: {explainability?.trust_level ?? '—'}</div>
                  <div>Safety: {explainability?.safety_notes?.join(', ') || '—'}</div>
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
          </StateContainer>
        </main>
      </div>

      {/* Create Habit Modal */}
      {isCreateModalOpen && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-end z-50">
          <div className="w-full max-w-[768px] mx-auto bg-white dark:bg-gray-900 rounded-t-3xl p-6 max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between mb-6">
              <h2 className="text-lg font-semibold text-gray-900 dark:text-white">
                Создать привычку
              </h2>
              <button
                onClick={() => setIsCreateModalOpen(false)}
                className="p-2 hover:bg-gray-100 dark:hover:bg-gray-800 rounded-lg"
              >
                <X className="w-5 h-5 text-gray-700 dark:text-gray-300" />
              </button>
            </div>

            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                  Название *
                </label>
                <input
                  type="text"
                  value={newHabitTitle}
                  onChange={(e) => setNewHabitTitle(e.target.value)}
                  placeholder="Например: Ложиться спать до 23:00"
                  className="w-full px-4 py-3 rounded-xl border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 text-gray-900 dark:text-white placeholder:text-gray-500 focus:outline-none focus:ring-2 focus:ring-gray-500"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                  Описание (необязательно)
                </label>
                <textarea
                  value={newHabitDescription}
                  onChange={(e) => setNewHabitDescription(e.target.value)}
                  placeholder="Зачем мне это? Например: больше энергии утром"
                  rows={3}
                  className="w-full px-4 py-3 rounded-xl border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 text-gray-900 dark:text-white placeholder:text-gray-500 focus:outline-none focus:ring-2 focus:ring-gray-500 resize-none"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                  Частота
                </label>
                <div className="flex gap-3">
                  <button
                  onClick={() => setNewHabitFrequency('daily')}
                    className={`flex-1 px-4 py-3 rounded-xl border-2 font-medium transition-colors ${
                      newHabitFrequency === 'daily'
                        ? 'border-gray-900 dark:border-white bg-gray-900 dark:bg-white text-white dark:text-gray-900'
                        : 'border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-300'
                    }`}
                  >
                    Ежедневно
                  </button>
                  <button
                  onClick={() => setNewHabitFrequency('weekly')}
                    className={`flex-1 px-4 py-3 rounded-xl border-2 font-medium transition-colors ${
                      newHabitFrequency === 'weekly'
                        ? 'border-gray-900 dark:border-white bg-gray-900 dark:bg-white text-white dark:text-gray-900'
                        : 'border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-300'
                    }`}
                  >
                    Еженедельно
                  </button>
                </div>
              </div>

              <div className="flex gap-3 pt-4">
                <button
                  onClick={() => setIsCreateModalOpen(false)}
                  className="flex-1 px-4 py-3 rounded-xl border-2 border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-300 font-medium hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors"
                >
                  Отмена
                </button>
                <button
                  onClick={handleCreateHabit}
                  disabled={!newHabitTitle.trim() || isWorking}
                  className="flex-1 px-4 py-3 rounded-xl bg-gray-900 dark:bg-white text-white dark:text-gray-900 font-medium hover:bg-gray-800 dark:hover:bg-gray-100 transition-colors disabled:opacity-50"
                >
                  Создать
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default Habits;

