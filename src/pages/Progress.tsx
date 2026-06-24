import { type FC, useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { AlertCircle, Dumbbell, Ruler, Target, UtensilsCrossed, X } from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { progressHubService, type ProgressHubData } from '../services/progressHubService';
import { formatUiDay } from '../utils/dateKey';
import './ProgressHub.css';

const formatNumber = (value: number | null, unit = ''): string => {
  if (value === null || !Number.isFinite(value)) return '—';
  const formatted = Number.isInteger(value) ? value.toFixed(0) : value.toFixed(1);
  return unit ? `${formatted} ${unit}` : formatted;
};

const formatDelta = (value: number | null, unit: string): string => {
  if (value === null || !Number.isFinite(value)) return 'недостаточно данных';
  if (Math.abs(value) < 0.05) return 'без изменений';
  const sign = value > 0 ? '+' : '-';
  return `${sign}${formatNumber(Math.abs(value), unit)}`;
};

const formatChangeResult = (
  value: number | null,
  unit: string,
  labels: { decreased: string; increased: string; unchanged: string },
): string | null => {
  if (value === null || !Number.isFinite(value)) return null;
  if (Math.abs(value) < 0.05) return labels.unchanged;
  const amount = formatNumber(Math.abs(value), unit);
  return value < 0 ? `${labels.decreased} на ${amount}.` : `${labels.increased} на ${amount}.`;
};

const getNutritionSummaryResult = (data: ProgressHubData): string => {
  const nutrition = data.nutrition;

  if (nutrition.state === 'error') {
    return 'Питание временно недоступно.';
  }

  if (!nutrition.hasEnoughData) {
    return 'Для оценки питания нужно больше записей.';
  }

  const balance = nutrition.averageCalorieBalance;
  if (balance === null || !Number.isFinite(balance)) {
    return 'Для оценки питания нужно больше записей.';
  }

  if (Math.abs(balance) <= 100) {
    return 'Питание около дневной цели.';
  }

  const amount = Math.round(Math.abs(balance));
  return balance < 0 ? `Средний дефицит — ${amount} ккал/день.` : `Средний профицит — ${amount} ккал/день.`;
};

const getSummaryResults = (data: ProgressHubData | null): string[] => {
  if (!data) return ['Собираем данные за последние 30 дней.'];

  const results: string[] = [];

  const weightResult = formatChangeResult(data.measurements.weightDelta30d, 'кг', {
    decreased: 'Вес снизился',
    increased: 'Вес увеличился',
    unchanged: 'Вес не изменился.',
  });

  if (weightResult) {
    results.push(weightResult);
  }

  const waistResult = formatChangeResult(data.measurements.waistDelta30d, 'см', {
    decreased: 'Талия уменьшилась',
    increased: 'Талия увеличилась',
    unchanged: 'Талия не изменилась.',
  });

  if (waistResult) {
    results.push(waistResult);
  }

  if (data.workouts.workoutsCount30d > 0) {
    results.push(`Выполнено ${data.workouts.workoutsCount30d} тренировок.`);
  }

  results.push(getNutritionSummaryResult(data));

  return results.length > 0
    ? results.slice(0, 4)
    : ['Данных пока мало. Начните регулярно заполнять питание, тренировки и замеры.'];
};

const getSummaryFallbackText = (data: ProgressHubData | null): string => {
  const results = getSummaryResults(data);
  return results[0] ?? 'Данных пока мало. Начните регулярно заполнять питание, тренировки и замеры.';
};

const Progress: FC = () => {
  const navigate = useNavigate();
  const { user } = useAuth();
  const [data, setData] = useState<ProgressHubData | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!user?.id) {
      setData(null);
      return;
    }

    let isMounted = true;
    setIsLoading(true);
    setError(null);

    progressHubService
      .getProgressHubData(user.id)
      .then((result) => {
        if (isMounted) setData(result);
      })
      .catch((err) => {
        console.error('[Progress] hub load failed', err);
        if (isMounted) setError('Не удалось загрузить прогресс.');
      })
      .finally(() => {
        if (isMounted) setIsLoading(false);
      });

    return () => {
      isMounted = false;
    };
  }, [user?.id]);

  const summaryResults = useMemo(() => getSummaryResults(data), [data]);
  const summaryFallbackText = useMemo(() => getSummaryFallbackText(data), [data]);
  const periodLabel = data ? `${formatUiDay(data.period.startDate)} — ${formatUiDay(data.period.endDate)}` : 'Последние 30 дней';

  return (
    <div className="progress-hub">
      <header className="progress-header">
        <h1 className="progress-title">ПРОГРЕСС</h1>
        <button
          type="button"
          className="progress-close"
          onClick={() => navigate('/')}
          aria-label="Закрыть"
        >
          <X size={22} />
        </button>
      </header>

      <main className="progress-dashboard" aria-busy={isLoading}>
        <section className="progress-summary-card">
          <p className="progress-summary-kicker">{periodLabel}</p>
          <h2 className="progress-summary-title">Основной результат</h2>
          {isLoading ? (
            <p className="progress-summary-text">Загрузка...</p>
          ) : summaryResults.length > 1 ? (
            <div className="progress-summary-list">
              {summaryResults.map((item) => (
                <p key={item}>{item}</p>
              ))}
            </div>
          ) : (
            <p className="progress-summary-text">{summaryFallbackText}</p>
          )}
          {error && <p className="progress-error-text">{error}</p>}
        </section>

        <section className="progress-dashboard-card">
          <div className="progress-card-heading">
            <Target size={18} />
            <h2>Цель</h2>
          </div>
          {isLoading && !data ? (
            <p className="progress-muted">Загрузка...</p>
          ) : data?.goal.state === 'error' ? (
            <p className="progress-error-text">Цель временно недоступна.</p>
          ) : data?.goal.hasGoal ? (
            <div className="progress-metric-list">
              <div className="progress-metric-row">
                <span>Цель</span>
                <strong>{data.goal.goalTypeLabel ?? '—'}</strong>
              </div>
              <div className="progress-metric-row">
                <span>Текущий вес</span>
                <strong>{formatNumber(data.goal.currentWeight, 'кг')}</strong>
              </div>
              <div className="progress-metric-row">
                <span>Целевой вес</span>
                <strong>{formatNumber(data.goal.targetWeight, 'кг')}</strong>
              </div>
              <div className="progress-metric-row">
                <span>Осталось</span>
                <strong>{formatNumber(data.goal.remainingWeight, 'кг')}</strong>
              </div>
              <div className="progress-metric-row">
                <span>Дневная цель</span>
                <strong>{formatNumber(data.goal.caloriesTarget, 'ккал')}</strong>
              </div>
            </div>
          ) : (
            <p className="progress-muted">Цель не задана.</p>
          )}
        </section>

        <button
          type="button"
          className="progress-dashboard-card progress-dashboard-link"
          onClick={() => navigate('/progress/nutrition')}
        >
          <div className="progress-card-heading">
            <UtensilsCrossed size={18} />
            <h2>Питание</h2>
          </div>
          <div className="progress-metric-list">
            <div className="progress-metric-row">
              <span>Среднее</span>
              <strong>{formatNumber(data?.nutrition.averageCalories ?? null, 'ккал')}</strong>
            </div>
            <div className="progress-metric-row">
              <span>Цель</span>
              <strong>{formatNumber(data?.nutrition.caloriesTarget ?? null, 'ккал')}</strong>
            </div>
            <div className="progress-metric-row">
              <span>Записей</span>
              <strong>
                {data ? `${data.nutrition.loggedDays} из ${data.nutrition.totalDays} дней` : '—'}
              </strong>
            </div>
          </div>
          {data?.nutrition.state === 'empty' && <p className="progress-card-note">Нет записей за период.</p>}
          {data?.nutrition.state === 'error' && <p className="progress-error-text">Питание временно недоступно.</p>}
        </button>

        <button
          type="button"
          className="progress-dashboard-card progress-dashboard-link"
          onClick={() => navigate('/progress/measurements')}
        >
          <div className="progress-card-heading">
            <Ruler size={18} />
            <h2>Замеры</h2>
          </div>
          <div className="progress-metric-list">
            <div className="progress-metric-row">
              <span>Последний вес</span>
              <strong>{formatNumber(data?.measurements.latestWeight ?? null, 'кг')}</strong>
            </div>
            <div className="progress-metric-row">
              <span>Вес за 30 дней</span>
              <strong>{formatDelta(data?.measurements.weightDelta30d ?? null, 'кг')}</strong>
            </div>
            <div className="progress-metric-row">
              <span>Талия за 30 дней</span>
              <strong>{formatDelta(data?.measurements.waistDelta30d ?? null, 'см')}</strong>
            </div>
            <div className="progress-metric-row">
              <span>Последний замер</span>
              <strong>
                {data?.measurements.latestMeasurementDate
                  ? formatUiDay(data.measurements.latestMeasurementDate)
                  : '—'}
              </strong>
            </div>
          </div>
          {data?.measurements.state === 'empty' && <p className="progress-card-note">Нет замеров за период.</p>}
          {data?.measurements.state === 'error' && <p className="progress-error-text">Замеры временно недоступны.</p>}
        </button>

        <button
          type="button"
          className="progress-dashboard-card progress-dashboard-link"
          onClick={() => navigate('/progress/workouts')}
        >
          <div className="progress-card-heading">
            <Dumbbell size={18} />
            <h2>Тренировки</h2>
          </div>
          <div className="progress-metric-list">
            <div className="progress-metric-row">
              <span>Тренировок</span>
              <strong>{data?.workouts.workoutsCount30d ?? '—'}</strong>
            </div>
            <div className="progress-metric-row">
              <span>Средняя частота</span>
              <strong>{data?.workouts.averageFrequencyLabel ?? '—'}</strong>
            </div>
            <div className="progress-metric-row">
              <span>Последняя тренировка</span>
              <strong>{data?.workouts.lastWorkoutLabel ?? '—'}</strong>
            </div>
          </div>
          {data?.workouts.state === 'empty' && <p className="progress-card-note">Нет тренировок за период.</p>}
          {data?.workouts.state === 'error' && <p className="progress-error-text">Тренировки временно недоступны.</p>}
        </button>

        {data && data.attentionMessages.length > 0 && (
          <section className="progress-attention-card">
            <div className="progress-card-heading">
              <AlertCircle size={18} />
              <h2>Что проверить</h2>
            </div>
            <div className="progress-attention-list">
              {data.attentionMessages.map((message) => (
                <p key={message}>{message}</p>
              ))}
            </div>
          </section>
        )}
      </main>
    </div>
  );
};

export default Progress;
