import { useCallback, useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { X } from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { uiRuntimeAdapter, type RuntimeStatus } from '../services/uiRuntimeAdapter';
import type { ProgramTodayDTO } from '../types/programDelivery';
import type { RuntimeContext } from '../services/uiRuntimeAdapter';
import type { BaseExplainabilityDTO } from '../types/explainability';
import { classifyTrustDecision } from '../services/trustSafetyService';
import { mealService } from '../services/mealService';
import type { CoachResponse } from '../services/coachRuntime';
import ScreenContainer from '../ui/components/ScreenContainer';
import Card from '../ui/components/Card';
import StateContainer from '../ui/components/StateContainer';
import TrustBanner from '../ui/components/TrustBanner';
import ExplainabilityDrawer from '../ui/components/ExplainabilityDrawer';
import Button from '../ui/components/Button';
import Chip from '../ui/components/Chip';
import Divider from '../ui/components/Divider';
import ProgressBar from '../ui/components/ProgressBar';
import CoachRequestModal from '../ui/coach/CoachRequestModal';

const Today = () => {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [runtimeStatus, setRuntimeStatus] = useState<RuntimeStatus>('loading');
  const [today, setToday] = useState<ProgramTodayDTO | null>(null);
  const [runtimeContext, setRuntimeContext] = useState<RuntimeContext | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [explainability, setExplainability] = useState<BaseExplainabilityDTO | null>(null);
  const [coachOverlay, setCoachOverlay] = useState<CoachResponse | null>(null);
  const [coachRequestOpen, setCoachRequestOpen] = useState(false);

  const loadToday = useCallback(async () => {
    if (!user?.id) return;
    setRuntimeStatus('loading');
    setErrorMessage(null);
    uiRuntimeAdapter.startLoadingTimer('Today', {
      pendingSources: ['program_sessions', 'food_diary_entries', 'workout_entries', 'habit_logs', 'user_goals'],
      onTimeout: () => {
        setRuntimeStatus('error');
        setErrorMessage('Загрузка дня заняла слишком много времени.');
      },
    });
    try {
      const state = await uiRuntimeAdapter.getTodayState(user.id);
      setRuntimeStatus(state.status);
      setToday(state.program ?? null);
      setRuntimeContext(state.context ?? null);
      setExplainability((state.explainability as BaseExplainabilityDTO) ?? null);
      if (state.status === 'error') {
        setErrorMessage(state.message || 'Не удалось загрузить день.');
      }
    } catch (error) {
      classifyTrustDecision(error);
      setRuntimeStatus('error');
      setErrorMessage('Не удалось загрузить день.');
    } finally {
      uiRuntimeAdapter.clearLoadingTimer('Today');
    }
  }, [user?.id]);

  useEffect(() => {
    loadToday();
  }, [loadToday]);

  const safetyFlags = (explainability as any)?.safety_flags ?? [];
  const isFatigue = safetyFlags.includes('fatigue');
  const isPain = safetyFlags.includes('pain');
  const isRecovery = safetyFlags.includes('recovery_needed');

  useEffect(() => {
    if (!user?.id) return;
    const trustLevel = (explainability as any)?.trust_level ?? explainability?.trust_score;
    const subscriptionState = user?.hasPremium ? 'Premium' : 'Free';
    uiRuntimeAdapter
      .getCoachOverlay('Today', {
        trustLevel,
        safetyFlags,
        userMode: today ? 'Follow Plan' : 'Manual',
        subscriptionState,
        adherence: today?.day?.status === 'completed' ? 1 : today?.day?.status === 'skipped' ? 0 : undefined,
      })
      .then(setCoachOverlay)
      .catch(() => setCoachOverlay(null));
  }, [explainability, safetyFlags, today, user?.hasPremium, user?.id]);

  const mealTotals = useMemo(() => {
    if (!runtimeContext?.meals) return null;
    return mealService.calculateDayTotals(runtimeContext.meals);
  }, [runtimeContext?.meals]);

  const caloriesTarget = today?.day?.targets?.calories ?? null;
  const proteinTarget = today?.day?.targets?.protein ?? null;
  const caloriesConsumed = mealTotals?.calories ?? 0;

  const habitsTotal = runtimeContext?.habits?.length ?? 0;
  const habitsCompleted = runtimeContext?.habits?.filter((habit) => habit.completed).length ?? 0;

  const trainingStatus =
    today?.day?.status === 'completed' ? 'выполнена' : today?.day?.status === 'skipped' ? 'пропущена' : 'запланирована';
  const trainingTone = today?.day?.status === 'completed' ? 'success' : today?.day?.status === 'skipped' ? 'warning' : 'default';

  const coachMessage =
    (isPain && 'Сегодня важно беречь себя. Мы предлагаем безопасный режим и поддержку.') ||
    (isFatigue && 'Усталость — нормальна. Мы адаптируем день, чтобы сохранить устойчивость.') ||
    (isRecovery && 'Это день восстановления. Сила растёт, когда мы даём телу отдых.') ||
    coachOverlay?.coach_message ||
    'Мы рядом, чтобы поддержать ваш день.';

  const coachTone = isPain ? 'pain' : isFatigue ? 'fatigue' : isRecovery ? 'recovery' : 'safety';

  return (
    <ScreenContainer padding="lg" gap="xl">
      <StateContainer
        status={runtimeStatus}
        message={runtimeStatus === 'empty' ? 'План на сегодня не найден.' : errorMessage || undefined}
        onRetry={() => {
          if (runtimeStatus === 'offline') {
            uiRuntimeAdapter.revalidate().finally(loadToday);
          } else {
            uiRuntimeAdapter.recover().finally(loadToday);
          }
        }}
      >
        <Card
          variant="surface"
          size="xl"
          title="Сегодня"
          action={
            <Button variant="ghost" size="sm" onClick={() => navigate('/')} aria-label="Закрыть">
              <X size={18} />
            </Button>
          }
        >
          <h1>{caloriesTarget ?? '—'}</h1>
          <p>ккал</p>
          <Divider />
          <p>
            <Chip>Белок {proteinTarget ?? '—'} г</Chip> <Chip>Тренировка: {trainingStatus}</Chip>{' '}
            <Chip>
              Привычки {habitsCompleted}/{habitsTotal}
            </Chip>
          </p>
          <Button variant="primary" size="lg" onClick={() => navigate('/my-program')}>
            Перейти к плану
          </Button>
        </Card>

        <Divider />

        <Card variant="default" title="Питание">
          <ProgressBar value={caloriesConsumed} max={caloriesTarget ?? 1} />
          <p>
            {caloriesConsumed} / {caloriesTarget ?? '—'} ккал
          </p>
          <Button variant="outline" size="sm" onClick={() => navigate('/nutrition')}>
            Открыть дневник
          </Button>
        </Card>

        <Divider />

        <Card variant="default" title="Тренировка">
          <Chip tone={trainingTone}>Статус: {trainingStatus}</Chip>
          <p>{today?.day?.sessionPlan?.focus ?? today?.day?.sessionPlan?.intensity ?? 'План на сегодня готов.'}</p>
          <Button variant="outline" size="sm" onClick={() => navigate('/workouts')}>
            Открыть тренировку
          </Button>
        </Card>

        <Divider />

        <Card variant="ghost" size="sm" title="Привычки">
          <p>
            <Chip tone={habitsTotal > 0 && habitsCompleted === habitsTotal ? 'success' : 'default'}>
              Отмечено {habitsCompleted}/{habitsTotal}
            </Chip>{' '}
            <Chip>Streak —</Chip>
          </p>
        </Card>

        <Divider />

        <TrustBanner tone={coachTone}>{coachMessage}</TrustBanner>

        <Button variant="ghost" size="sm" onClick={() => setCoachRequestOpen(true)}>
          Спросить коуча
        </Button>

        <ExplainabilityDrawer explainability={explainability} />
      </StateContainer>

      {coachRequestOpen && (
        <CoachRequestModal
          open={coachRequestOpen}
          onClose={() => setCoachRequestOpen(false)}
          context={{
            screen: 'Today',
            userMode: today ? 'Follow Plan' : 'Manual',
            subscriptionState: user?.hasPremium ? 'Premium' : 'Free',
            trustLevel: (explainability as any)?.trust_level ?? explainability?.trust_score,
            safetyFlags,
          }}
        />
      )}
    </ScreenContainer>
  );
};

export default Today;
