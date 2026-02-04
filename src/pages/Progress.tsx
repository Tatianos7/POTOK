import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { X } from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { uiRuntimeAdapter, type RuntimeStatus } from '../services/uiRuntimeAdapter';
import type { ProgressExplainabilityDTO } from '../types/explainability';
import { classifyTrustDecision } from '../services/trustSafetyService';
import { coachRuntime } from '../services/coachRuntime';
import Card from '../ui/components/Card';
import StateContainer from '../ui/components/StateContainer';
import TrustBanner from '../ui/components/TrustBanner';
import ExplainabilityDrawer from '../ui/components/ExplainabilityDrawer';
import ScreenContainer from '../ui/components/ScreenContainer';
import Button from '../ui/components/Button';
import ProgressTable from '../ui/components/ProgressTable';
import Chip from '../ui/components/Chip';
import Divider from '../ui/components/Divider';
import Section from '../ui/components/Section';
import Badge from '../ui/components/Badge';
import Stack from '../ui/components/Stack';
import Text from '../ui/components/Text';
import type { CoachDecisionResponse, CoachResponse } from '../services/coachRuntime';
import type { CoachExplainabilityBinding } from '../types/coachMemory';
import type {
  ProgressPeriod,
  ProgressPeriodKey,
  ProgressSummary,
  NutritionStats,
  TrainingStats,
  MeasurementsTable,
  HabitsStats,
  ProgressSectionResult,
  CoachRecommendations,
} from '../types/progressDashboard';

const Progress = () => {
  const navigate = useNavigate();
  const { user } = useAuth();
  const [runtimeStatus, setRuntimeStatus] = useState<RuntimeStatus>('loading');
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [trustMessage, setTrustMessage] = useState<string | null>(null);
  const [explainability, setExplainability] = useState<ProgressExplainabilityDTO | null>(null);
  const [coachOverlay, setCoachOverlay] = useState<CoachResponse | null>(null);
  const [coachExplainability, setCoachExplainability] = useState<CoachExplainabilityBinding | null>(null);
  const [decisionSupport, setDecisionSupport] = useState<CoachDecisionResponse | null>(null);
  const lastCoachEventKey = useRef<string | null>(null);

  const [summary, setSummary] = useState<ProgressSectionResult<ProgressSummary> | null>(null);
  const [nutrition, setNutrition] = useState<ProgressSectionResult<NutritionStats> | null>(null);
  const [training, setTraining] = useState<ProgressSectionResult<TrainingStats> | null>(null);
  const [measurements, setMeasurements] = useState<ProgressSectionResult<MeasurementsTable> | null>(null);
  const [habits, setHabits] = useState<ProgressSectionResult<HabitsStats> | null>(null);
  const [coach, setCoach] = useState<ProgressSectionResult<CoachRecommendations> | null>(null);

  const periodOptions: Array<{ key: ProgressPeriodKey; label: string; days: number }> = [
    { key: '7d', label: '7д', days: 7 },
    { key: '14d', label: '14д', days: 14 },
    { key: '30d', label: '30д', days: 30 },
    { key: '3m', label: '3м', days: 90 },
    { key: '6m', label: '6м', days: 180 },
    { key: '1y', label: 'год', days: 365 },
    { key: 'custom', label: 'custom', days: 30 },
  ];

  const [periodKey, setPeriodKey] = useState<ProgressPeriodKey>('30d');
  const period = useMemo<ProgressPeriod>(() => {
    const option = periodOptions.find((item) => item.key === periodKey) ?? periodOptions[2];
    const endDate = new Date();
    endDate.setHours(0, 0, 0, 0);
    const startDate = new Date(endDate);
    startDate.setDate(startDate.getDate() - (option.days - 1));
    const toDate = (value: Date) => value.toISOString().split('T')[0];
    const start = toDate(startDate);
    const end = toDate(endDate);
    const days: string[] = [];
    const cursor = new Date(startDate);
    while (cursor <= endDate) {
      days.push(toDate(cursor));
      cursor.setDate(cursor.getDate() + 1);
    }
    return { key: option.key, label: option.label, start, end, days };
  }, [periodKey]);

  const loadProgress = useCallback(async () => {
    if (!user?.id) return;
    setRuntimeStatus('loading');
    setErrorMessage(null);
    setTrustMessage(null);
    uiRuntimeAdapter.startLoadingTimer('Progress', {
      pendingSources: ['measurement_history', 'food_diary_entries', 'workout_entries', 'habit_logs', 'user_goals'],
      onTimeout: () => {
        const decision = classifyTrustDecision('loading_timeout');
        setRuntimeStatus('error');
        setErrorMessage('Загрузка прогресса заняла слишком много времени.');
        setTrustMessage(decision.message);
      },
    });
    try {
      const state = await uiRuntimeAdapter.getProgressState(user.id, period);
      setRuntimeStatus(state.status);
      setSummary(state.summary ?? null);
      setNutrition(state.nutrition ?? null);
      setTraining(state.training ?? null);
      setMeasurements(state.measurements ?? null);
      setHabits(state.habits ?? null);
      setCoach(state.coach ?? null);
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
  }, [period, user?.id]);

  useEffect(() => {
    if (!user?.id) return;
    void uiRuntimeAdapter.refresh().finally(loadProgress);
  }, [loadProgress, period, user?.id]);

  const summaryData = summary?.data;
  const weightTrend = summaryData?.weightTrend ?? 0;
  const strengthTrend = summaryData?.strengthTrend ?? 0;
  const isPlateau = Math.abs(weightTrend) < 0.05;
  const isRegression = weightTrend > 0.1;
  const isRecovery = strengthTrend < -0.2;
  const safetyFlags = explainability?.safety_flags ?? [];
  const trustLevel = explainability?.trust_level ?? explainability?.trust_score;

  const sectionStatus = (section: ProgressSectionResult<unknown> | null): RuntimeStatus => {
    if (!section) return runtimeStatus === 'loading' ? 'loading' : 'empty';
    if (section.status === 'error') return 'error';
    if (section.status === 'empty') return 'empty';
    return 'active';
  };

  const periodLabel = periodOptions.find((option) => option.key === periodKey)?.label ?? '30д';
  const adherencePercent =
    summaryData?.adherence !== null && summaryData?.adherence !== undefined
      ? Math.round(summaryData.adherence * 100)
      : null;
  const habitPercent = habits?.data?.adherence ?? null;
  const workoutsCount = training?.data?.dates?.length ?? 0;
  const weightDirection = weightTrend > 0.05 ? '↑' : weightTrend < -0.05 ? '↓' : '—';
  const weightTrendLabel =
    summaryData?.weightTrend !== null && summaryData?.weightTrend !== undefined
      ? `${summaryData.weightTrend.toFixed(2)} ${weightDirection}`
      : '—';
  const nutritionTopItems = nutrition?.data?.popularItem ? [nutrition.data.popularItem] : [];
  const decisionSupportTip = decisionSupport?.coach_message ? [decisionSupport.coach_message] : [];
  const coachTips = [...(coach?.data?.items?.slice(0, 2) ?? []), ...decisionSupportTip].slice(0, 2);
  const habitsList = habits?.data?.habits ?? [];

  useEffect(() => {
    if (!user) {
      setCoachOverlay(null);
      return;
    }
    const adherenceValue = summaryData?.adherence ?? null;
    uiRuntimeAdapter
      .getCoachOverlay('Progress', {
        trustLevel,
        safetyFlags,
        userMode: 'Manual',
        subscriptionState: user.hasPremium ? 'Premium' : 'Free',
        adherence: typeof adherenceValue === 'number' ? adherenceValue : undefined,
      })
      .then(setCoachOverlay)
      .catch(() => setCoachOverlay(null));
  }, [user, trustLevel, safetyFlags, summaryData?.adherence]);

  useEffect(() => {
    const decisionId = explainability?.decision_ref;
    if (!decisionId) return;
    const subscriptionState = user?.hasPremium ? 'Premium' : 'Free';
    uiRuntimeAdapter
      .getCoachExplainability(decisionId, { subscriptionState })
      .then(setCoachExplainability)
      .catch(() => setCoachExplainability(null));
  }, [explainability?.decision_ref, user?.hasPremium]);

  useEffect(() => {
    if (!user?.id || !summaryData) return;
    const trendKey = `${period.end}_${summaryData.weightTrend ?? 0}`;
    if (lastCoachEventKey.current === trendKey) return;
    lastCoachEventKey.current = trendKey;
    void coachRuntime.handleUserEvent(
      {
        type: 'ProgressViewed',
        timestamp: new Date().toISOString(),
        payload: {
          trend: summaryData.weightTrend ?? 0,
          adherence: summaryData.adherence ?? 0,
        },
        confidence: 0.5,
        safetyClass: isRegression ? 'caution' : 'normal',
        trustImpact: isRegression ? -1 : 1,
      },
      {
        screen: 'Progress',
        userMode: 'Manual',
        subscriptionState: user?.hasPremium ? 'Premium' : 'Free',
      }
    );
  }, [summaryData, period.end, isRegression, user?.hasPremium, user?.id]);

  useEffect(() => {
    if (!user || !summaryData) {
      setDecisionSupport(null);
      return;
    }
    const slope = typeof summaryData.weightTrend === 'number' ? Math.abs(summaryData.weightTrend) : null;
    if (slope === null || slope > 0.02) {
      setDecisionSupport(null);
      return;
    }
    uiRuntimeAdapter
      .getDecisionSupport({
        decision_type: 'plateau',
        emotional_state: 'neutral',
        trust_level: 50,
        history_pattern: `Стабильность веса за период ${period.start}–${period.end}`,
        user_mode: 'Manual',
        screen: 'Progress',
        subscription_state: user.hasPremium ? 'Premium' : 'Free',
        safety_flags: [],
      })
      .then(setDecisionSupport)
      .catch(() => setDecisionSupport(null));
  }, [user, summaryData, period.start, period.end]);

  return (
    <ScreenContainer padding="lg" gap="xl">
      <Card variant="surface" size="lg">
        <Section title="Прогресс" subtitle="Твоя динамика и изменения" />
        <Stack direction="row" gap="sm" wrap>
          {periodOptions.map((option) => (
            <Chip key={option.key} onClick={() => setPeriodKey(option.key)} selected={periodKey === option.key}>
              {option.label}
            </Chip>
          ))}
          <Button variant="outline" size="sm" onClick={() => setPeriodKey('custom')}>
            Календарь
          </Button>
          <Button variant="ghost" size="sm" onClick={() => navigate('/')} aria-label="Закрыть">
            <X size={18} />
          </Button>
        </Stack>
      </Card>

      {isPlateau && <TrustBanner tone="plateau">Плато — это фаза, а не провал. Тело адаптируется, и это часть пути.</TrustBanner>}
      {isRegression && !isPlateau && (
        <TrustBanner tone="recovery">Сейчас важно восстановление. Это не откат — это бережная фаза.</TrustBanner>
      )}
      {isRecovery && !isRegression && !isPlateau && (
        <TrustBanner tone="recovery">Мы видим сигналы усталости. Темп можно сохранить мягко и безопасно.</TrustBanner>
      )}

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
        <Stack gap="lg">
          <StateContainer status={sectionStatus(summary)} message={summary?.message}>
            <Card size="lg">
              <Section title="Life Overview" subtitle={`Период: ${periodLabel}`} />
              <Stack direction="row" gap="sm" wrap>
                <Card variant="ghost" size="sm">
                  <Text variant="micro">Вес</Text>
                  <Text variant="title">{weightTrendLabel}</Text>
                </Card>
                <Card variant="ghost" size="sm">
                  <Text variant="micro">Калории среднее</Text>
                  <Text variant="title">{summaryData?.avgCalories ?? '—'}</Text>
                </Card>
                <Card variant="ghost" size="sm">
                  <Text variant="micro">Тренировок</Text>
                  <Text variant="title">{workoutsCount}</Text>
                </Card>
                <Card variant="ghost" size="sm">
                  <Text variant="micro">Adherence</Text>
                  <Text variant="title">{adherencePercent ?? '—'}%</Text>
                </Card>
                <Card variant="ghost" size="sm">
                  <Text variant="micro">Привычки</Text>
                  <Text variant="title">{habitPercent ?? '—'}%</Text>
                </Card>
              </Stack>
              <Divider />
              <Text variant="subtitle">
                {summaryData?.coachInsight ?? coachOverlay?.coach_message ?? 'Вот как изменилась твоя жизнь за период.'}
              </Text>
            </Card>
          </StateContainer>

          <StateContainer status={sectionStatus(nutrition)} message={nutrition?.message}>
            <Card title="Питание">
              <Stack gap="md">
                <Stack direction="row" gap="sm" wrap>
                  <Chip>Средние: {nutrition?.data?.average.calories ?? '—'} ккал</Chip>
                  <Chip>Б {nutrition?.data?.average.protein ?? '—'} г</Chip>
                  <Chip>Ж {nutrition?.data?.average.fat ?? '—'} г</Chip>
                  <Chip>У {nutrition?.data?.average.carbs ?? '—'} г</Chip>
                </Stack>
                <Stack direction="row" gap="sm" wrap>
                  <Chip>Всего: {nutrition?.data?.total.calories ?? '—'} ккал</Chip>
                  <Chip>Соблюдение цели: —</Chip>
                </Stack>
                <Divider />
                <Stack gap="sm">
                  <Text variant="subtitle">Популярное</Text>
                  <Stack direction="row" gap="sm" wrap>
                    {nutritionTopItems.length > 0 ? (
                      nutritionTopItems.map((item) => (
                        <Badge key={item} tone="default">
                          {item}
                        </Badge>
                      ))
                    ) : (
                      <Text variant="micro">Нет данных</Text>
                    )}
                  </Stack>
                </Stack>
                <Divider />
                <Stack gap="sm">
                  <Text variant="subtitle">Coach рекомендации</Text>
                  <Stack direction="row" gap="sm" wrap>
                    {coachTips.length > 0 ? (
                      coachTips.map((tip) => (
                        <Badge key={tip} tone="warning">
                          {tip}
                        </Badge>
                      ))
                    ) : (
                      <Text variant="micro">Пока нет рекомендаций</Text>
                    )}
                  </Stack>
                </Stack>
              </Stack>
            </Card>
          </StateContainer>

          <StateContainer status={sectionStatus(training)} message={training?.message}>
            <Card title="Тренировки">
              <ProgressTable
                layout="stacked"
                rowHeaderLabel="Упражнение"
                columns={training?.data?.dates ?? []}
                rows={(training?.data?.rows ?? []).map((row) => ({
                  id: row.id,
                  label: row.name,
                  cells: Object.fromEntries(
                    (training?.data?.dates ?? []).map((date) => {
                      const cell = row.cells[date];
                      const volume = cell ? Math.round(cell.sets * cell.reps * cell.weight) : null;
                      const value = cell
                        ? `${cell.sets}×${cell.reps}×${cell.weight} · V ${volume ?? '—'}`
                        : '—';
                      return [date, { value, trend: cell?.trend }];
                    })
                  ),
                }))}
              />
            </Card>
          </StateContainer>

          <StateContainer status={sectionStatus(measurements)} message={measurements?.message}>
            <Card title="Замеры">
              <ProgressTable
                layout="stacked"
                rowHeaderLabel="Дата"
                columns={measurements?.data?.metrics ?? []}
                rows={(measurements?.data?.rows ?? []).map((row) => ({
                  id: row.date,
                  label: row.date,
                  cells: Object.fromEntries(
                    (measurements?.data?.metrics ?? []).map((metric) => {
                      const value = row.values[metric]?.value;
                      const formatted = value === null || value === undefined ? '—' : String(value);
                      return [metric, { value: formatted, trend: row.values[metric]?.trend }];
                    })
                  ),
                }))}
              />
              <Divider />
              <Stack direction="row" gap="sm" wrap>
                {coachTips.length > 0 ? (
                  coachTips.map((tip) => (
                    <Chip key={tip} tone="warning">
                      {tip}
                    </Chip>
                  ))
                ) : (
                  <Text variant="micro">Рекомендации появятся после новых замеров.</Text>
                )}
              </Stack>
            </Card>
          </StateContainer>

          <StateContainer status={sectionStatus(habits)} message={habits?.message}>
            <Card title="Привычки">
              <Stack direction="row" gap="sm" wrap>
                <Chip>Streak: {habits?.data?.streak ?? 0}</Chip>
                <Chip>Adherence: {habits?.data?.adherence ?? 0}%</Chip>
              </Stack>
              <Divider />
              <Stack direction="row" gap="sm" wrap>
                {habitsList.length > 0 ? (
                  habitsList.map((habit) => (
                    <Badge key={habit.id} tone={habit.adherence >= 0.7 ? 'success' : 'warning'}>
                      {habit.title} · {Math.round(habit.adherence * 100)}%
                    </Badge>
                  ))
                ) : (
                  <Text variant="micro">Пока нет привычек</Text>
                )}
              </Stack>
            </Card>
          </StateContainer>

          <Card tone="explainable" title="Coach Insights">
            <Stack gap="sm">
              <Text variant="subtitle">Почему такие рекомендации</Text>
              <Stack direction="row" gap="sm" wrap>
                <Chip>Источники: {explainability?.data_sources?.join(', ') || '—'}</Chip>
                <Chip>Confidence: {explainability?.confidence ?? '—'}</Chip>
                <Chip>Trust: {explainability?.trust_level ?? '—'}</Chip>
              </Stack>
              {coachExplainability?.decision?.whyNow && (
                <Text variant="micro">{coachExplainability.decision.whyNow}</Text>
              )}
              <ExplainabilityDrawer explainability={explainability} />
            </Stack>
          </Card>

          {trustMessage && (
            <Card title="Поддержка">
              <Text variant="subtitle">{trustMessage}</Text>
            </Card>
          )}
        </Stack>
      </StateContainer>
    </ScreenContainer>
  );
};

export default Progress;
