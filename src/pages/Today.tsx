import { useCallback, useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { X } from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { uiRuntimeAdapter, type RuntimeStatus } from '../services/uiRuntimeAdapter';
import type { ProgramTodayDTO } from '../types/programDelivery';
import type { RuntimeContext } from '../services/uiRuntimeAdapter';
import type { BaseExplainabilityDTO } from '../types/explainability';
import ExplainabilityDrawer from '../ui/components/ExplainabilityDrawer';
import Card from '../ui/components/Card';
import StateContainer from '../ui/components/StateContainer';
import TrustBanner from '../ui/components/TrustBanner';
import { classifyTrustDecision } from '../services/trustSafetyService';
import CoachMessageCard, { CoachMemoryChip } from '../ui/coach/CoachMessageCard';
import { CoachDailyNudge } from '../ui/coach/CoachNudge';
import CoachSafetyBanner from '../ui/coach/CoachSafetyBanner';
import CoachExplainabilityDrawer from '../ui/coach/CoachExplainabilityDrawer';
import CoachRequestModal from '../ui/coach/CoachRequestModal';
import CoachVoiceButton from '../ui/coach/CoachVoiceButton';
import type { CoachResponse } from '../services/coachRuntime';
import type { CoachExplainabilityBinding } from '../types/coachMemory';

const Today = () => {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [runtimeStatus, setRuntimeStatus] = useState<RuntimeStatus>('loading');
  const [today, setToday] = useState<ProgramTodayDTO | null>(null);
  const [runtimeContext, setRuntimeContext] = useState<RuntimeContext | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [explainability, setExplainability] = useState<BaseExplainabilityDTO | null>(null);
  const [coachOverlay, setCoachOverlay] = useState<CoachResponse | null>(null);
  const [coachExplainability, setCoachExplainability] = useState<CoachExplainabilityBinding | null>(null);
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
  const dayTone = isPain ? 'Pain' : isFatigue ? 'Fatigue' : isRecovery ? 'Recovery' : 'Normal';

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
        <header className="py-4 flex items-center justify-between border-b border-gray-200 dark:border-gray-700">
          <div className="flex-1" />
          <h1 className="text-lg font-semibold text-gray-900 dark:text-white uppercase text-center flex-1">
            TODAY
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
            message={runtimeStatus === 'empty' ? 'План на сегодня не найден.' : errorMessage || undefined}
            onRetry={() => {
              if (runtimeStatus === 'offline') {
                uiRuntimeAdapter.revalidate().finally(loadToday);
              } else {
                uiRuntimeAdapter.recover().finally(loadToday);
              }
            }}
          >
            <div className="space-y-3">
              <div className="flex flex-wrap gap-2">
                <button
                  onClick={() => setCoachRequestOpen(true)}
                  className="rounded-xl border border-gray-300 px-3 py-2 text-xs font-semibold text-gray-700 dark:border-gray-700 dark:text-gray-200"
                >
                  🧠 Спросить коуча
                </button>
                <CoachVoiceButton label="🎧 Голос" disabled />
              </div>
              {coachOverlay && (
                <CoachDailyNudge
                  message={coachOverlay.coach_message}
                  mode={coachOverlay.ui_mode}
                  action={<CoachMemoryChip text="Я рядом, чтобы поддержать твой день" />}
                />
              )}
              {isPain && (
                <CoachSafetyBanner message="Сегодня важна безопасность. Мы снизим нагрузку и поддержим восстановление." />
              )}
              {isFatigue && !isPain && (
                <CoachSafetyBanner message="Усталость — это сигнал. Давай сделаем день более бережным." />
              )}
              {isRecovery && !isPain && !isFatigue && (
                <CoachSafetyBanner message="Фаза восстановления — часть пути. Мы поддержим мягкий темп." />
              )}
            </div>

            {isPain && (
              <TrustBanner tone="pain">
                Сегодня важно беречь себя. Мы предлагаем безопасный режим и поддержку.
              </TrustBanner>
            )}
            {isFatigue && !isPain && (
              <TrustBanner tone="fatigue">
                Усталость — нормальна. Мы адаптируем день, чтобы сохранить устойчивость.
              </TrustBanner>
            )}
            {isRecovery && !isPain && !isFatigue && (
              <TrustBanner tone="recovery">
                Это день восстановления. Сила растёт, когда мы даём телу отдых.
              </TrustBanner>
            )}

            {today && (
              <div className="space-y-4">
                {today.day?.status === 'completed' && (
                  <CoachMessageCard
                    mode="celebrate"
                    message="Ты завершил день. Это укрепляет доверие к себе."
                    voiceAction={<CoachVoiceButton label="🎧 Голос" disabled />}
                    action={<CoachMemoryChip text="Устойчивость растет от маленьких побед" />}
                  />
                )}
                {today.day?.status === 'skipped' && (
                  <CoachMessageCard
                    mode="support"
                    message="Пропуски — часть пути. Давай вернемся мягко."
                    voiceAction={<CoachVoiceButton label="🎧 Голос" disabled />}
                    action={<CoachMemoryChip text="Ритм важнее идеальности" />}
                  />
                )}
                <Card title="План дня" action={<span className="text-xs text-gray-500">Состояние: {dayTone}</span>}>
                  <p className="text-xs text-gray-600 dark:text-gray-400">
                    Сегодня мы держим курс с заботой о восстановлении.
                  </p>
                  <div className="mt-3 grid grid-cols-2 gap-2 text-sm text-gray-700 dark:text-gray-300">
                    <p>Калории: {today.day?.targets?.calories ?? '—'}</p>
                    <p>Белки: {today.day?.targets?.protein ?? '—'}</p>
                    <p>Жиры: {today.day?.targets?.fat ?? '—'}</p>
                    <p>Углеводы: {today.day?.targets?.carbs ?? '—'}</p>
                  </div>
                </Card>

                <Card title="Питание сегодня">
                  <p className="text-xs text-gray-600 dark:text-gray-400">
                    Маленькие шаги дают устойчивый результат. Сбалансируйте день без давления.
                  </p>
                  <div className="mt-3 text-sm text-gray-700 dark:text-gray-300">
                    Съедено сегодня: {runtimeContext?.meals ? 'есть данные' : 'нет данных'}
                  </div>
                </Card>

                <Card title="Тренировка сегодня">
                  <p className="text-xs text-gray-600 dark:text-gray-400">
                    Мы подстроим нагрузку под ваше самочувствие.
                  </p>
                  <div className="mt-3 text-sm text-gray-700 dark:text-gray-300">
                    План: {today.day?.sessionPlan?.focus ?? today.day?.sessionPlan?.intensity ?? 'Запланировано'}
                  </div>
                </Card>

                <Card title="Привычки">
                  <p className="text-xs text-gray-600 dark:text-gray-400">
                    Привычки укрепляют доверие к себе, даже в сложные дни.
                  </p>
                  <div className="mt-3 text-sm text-gray-700 dark:text-gray-300">
                    Отмечено: {runtimeContext?.habits?.filter((h) => h.completed).length ?? 0} /{' '}
                    {runtimeContext?.habits?.length ?? 0}
                  </div>
                </Card>

                <Card title="Самочувствие">
                  <p className="text-xs text-gray-600 dark:text-gray-400">
                    Если чувствуете усталость или боль — мы сделаем день безопасным.
                  </p>
                  <div className="mt-3 text-sm text-gray-700 dark:text-gray-300">
                    Сигналы: {isPain ? 'боль' : isFatigue ? 'усталость' : 'норма'}
                  </div>
                </Card>
              </div>
            )}

            <div className="mt-6">
              <Card tone="explainable" title="Почему сегодня так?">
                <p className="text-xs text-gray-600 dark:text-gray-400">
                  Мы объясняем каждое изменение и выбор нагрузки.
                </p>
                <div className="mt-3">
                  <ExplainabilityDrawer explainability={explainability} />
                  <div className="mt-3">
                    <CoachExplainabilityDrawer
                      decisionId={explainability?.decision_ref}
                      trace={coachExplainability}
                      confidence={explainability?.confidence}
                      trustLevel={String((explainability as any)?.trust_level ?? explainability?.trust_score ?? '—')}
                      safetyFlags={(explainability as any)?.safety_flags ?? []}
                    />
                  </div>
                </div>
              </Card>
            </div>
          </StateContainer>
        </main>
      </div>
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
    </div>
  );
};

export default Today;
