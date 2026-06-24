import { type FC, useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  ChevronRight,
  Flame,
  Target,
  UtensilsCrossed,
  X,
} from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { progressNutritionService, type NutritionProgressPeriod } from '../services/progressNutritionService';
import type { NutritionStats } from '../types/progressDashboard';
import { getLocalDayKey } from '../utils/dayKey';

const PERIOD_OPTIONS: Array<{ key: NutritionProgressPeriod; label: string }> = [
  { key: 'day', label: 'День' },
  { key: 'week', label: '7 дней' },
  { key: 'month', label: '30 дней' },
  { key: 'year', label: 'Год' },
];

const cardClass = 'rounded-[28px] border border-stone-200 bg-white shadow-[0_18px_50px_rgba(20,20,20,0.08)]';
const SHOW_LEGACY_NUTRITION_RESULT_CARDS = false;
const SHOW_TOP_FOODS_BLOCK = false;
const SHOW_NUTRITION_INSIGHTS_BLOCK = true;

const formatNumber = (value: number | null | undefined) => {
  if (value == null || !Number.isFinite(value)) return '—';
  return new Intl.NumberFormat('ru-RU', { maximumFractionDigits: 0 }).format(value);
};

const formatDateLabel = (value: string) =>
  new Intl.DateTimeFormat('ru-RU', {
    day: 'numeric',
    month: 'long',
  }).format(new Date(`${value}T00:00:00`));

const formatFullDateLabel = (value: string) =>
  new Intl.DateTimeFormat('ru-RU', {
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  }).format(new Date(`${value}T00:00:00`));

const getPeriodMeta = (anchorDate: string, period: NutritionProgressPeriod) => {
  const anchor = new Date(`${anchorDate}T00:00:00`);
  const start = new Date(anchor);

  if (period === 'week') {
    start.setDate(anchor.getDate() - 6);
  } else if (period === 'month') {
    start.setDate(anchor.getDate() - 29);
  } else if (period === 'year') {
    start.setDate(anchor.getDate() - 364);
  }

  const startDate = start.toISOString().slice(0, 10);

  return {
    dateRangeLabel:
      period === 'day'
        ? formatDateLabel(anchorDate)
        : period === 'year'
          ? `${formatFullDateLabel(startDate)} - ${formatFullDateLabel(anchorDate)}`
          : `${formatDateLabel(startDate)} - ${formatDateLabel(anchorDate)}`,
    subtitle:
      period === 'day'
        ? 'За выбранный день'
        : period === 'week'
          ? 'Последние 7 дней, включая выбранную дату'
          : period === 'year'
            ? 'Последние 365 дней, включая выбранную дату'
            : 'Последние 30 дней, включая выбранную дату',
  };
};

const MacroSummaryRow: FC<{
  label: string;
  averagePerDay: number;
  targetPerDay: number | null | undefined;
  completionPercent: number | null | undefined;
  accentClass: string;
}> = ({ label, averagePerDay, targetPerDay, completionPercent, accentClass }) => {
  const hasTarget = targetPerDay != null && targetPerDay > 0;
  const completionLabel =
    hasTarget && completionPercent != null && Number.isFinite(completionPercent)
      ? `${formatNumber(completionPercent)}%`
      : 'нет данных';

  return (
    <div className="py-3">
      <div className="mb-2 flex min-w-0 items-center gap-2">
        <span className={`h-1.5 w-1.5 shrink-0 rounded-full ${accentClass}`} aria-hidden="true" />
        <div className="min-w-0 text-sm font-medium text-stone-800">{label}</div>
      </div>
      <div className="space-y-1.5 pl-3.5">
        {hasTarget ? (
          <>
            <div className="flex items-start justify-between gap-3">
              <div className="text-xs text-stone-400">факт / цель</div>
              <div className="max-w-[64%] break-words text-right text-sm font-semibold leading-5 text-stone-900">
                {formatNumber(averagePerDay)} г из {formatNumber(targetPerDay)} г
              </div>
            </div>
            <div className="flex items-start justify-between gap-3">
              <div className="text-xs text-stone-400">выполнение</div>
              <div className="max-w-[64%] break-words text-right text-sm font-medium leading-5 text-stone-600">
                {completionLabel}
              </div>
            </div>
          </>
        ) : (
          <>
            <div className="flex items-start justify-between gap-3">
              <div className="text-xs text-stone-400">факт</div>
              <div className="max-w-[64%] break-words text-right text-sm font-semibold leading-5 text-stone-900">
                {formatNumber(averagePerDay)} г
              </div>
            </div>
            <div className="flex items-start justify-between gap-3">
              <div className="text-xs text-stone-400">цель</div>
              <div className="max-w-[64%] break-words text-right text-sm font-medium leading-5 text-stone-500">
                не задана
              </div>
            </div>
          </>
        )}
      </div>
    </div>
  );
};

const ProgressNutrition: FC = () => {
  const navigate = useNavigate();
  const { user } = useAuth();
  const [period, setPeriod] = useState<NutritionProgressPeriod>('day');
  const [anchorDate] = useState(getLocalDayKey());
  const [data, setData] = useState<NutritionStats | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!user?.id) return;
    let isMounted = true;
    setLoading(true);
    setError(null);

    progressNutritionService
      .getNutritionProgress(user.id, anchorDate, period)
      .then((result) => {
        if (isMounted) setData(result);
      })
      .catch((err) => {
        if (isMounted) {
          console.error('[ProgressNutrition] load failed', err);
          setError('Не удалось загрузить питание.');
        }
      })
      .finally(() => {
        if (isMounted) setLoading(false);
      });

    return () => {
      isMounted = false;
    };
  }, [user?.id, anchorDate, period]);

  const periodMeta = useMemo(() => getPeriodMeta(anchorDate, period), [anchorDate, period]);
  const hasNutritionData = Boolean(data?.calories?.has_data);
  const periodDays = data?.periodDays ?? 1;
  const daysWithData = data?.periodCoverage?.days_with_data ?? 0;
  const missingDays = Math.max(periodDays - daysWithData, 0);
  const coverageRatio = data?.periodCoverage?.coverage_ratio ?? 0;
  const hasCalorieTarget = data?.deficit?.target_calories != null;
  const dailyTargetCalories =
    hasCalorieTarget && data?.deficit?.target_calories != null
      ? Math.round(data.deficit.target_calories / periodDays)
      : null;
  const isLowCoverage = periodDays > 1 && coverageRatio < 0.8;
  const recordsWarning =
    periodDays > 1 && isLowCoverage
      ? 'Данных пока мало: часть дней в периоде не заполнена.'
      : null;
  const showAverageExplanation = periodDays > 1;

  const deficitState = useMemo(() => {
    if (!data?.deficit?.is_visible) {
      return {
        valueLabel: hasCalorieTarget && isLowCoverage ? 'Недостаточно записей' : 'Цель не задана',
        badgeClass: 'bg-stone-100 text-stone-600',
        valueClass: 'text-stone-600',
        helper: hasCalorieTarget && isLowCoverage
          ? 'Недостаточно записей для точного расчёта дефицита.'
          : 'Чтобы увидеть дефицит или профицит, добавьте цель по калориям.',
      };
    }

    const value = data.deficit.value ?? 0;
    if (value > 0) {
      return {
        valueLabel: `Дефицит ${formatNumber(value)} ккал`,
        badgeClass: 'bg-emerald-100 text-emerald-700',
        valueClass: 'text-emerald-700',
        helper: `Факт ниже цели ${formatNumber(data.deficit.target_calories)} ккал.`,
      };
    }
    if (value < 0) {
      return {
        valueLabel: `Профицит ${formatNumber(Math.abs(value))} ккал`,
        badgeClass: 'bg-amber-100 text-amber-700',
        valueClass: 'text-amber-700',
        helper: `Факт выше цели ${formatNumber(data.deficit.target_calories)} ккал.`,
      };
    }
    return {
      valueLabel: 'Ровно по цели',
      badgeClass: 'bg-sky-100 text-sky-700',
      valueClass: 'text-sky-700',
      helper: `Факт совпал с целью ${formatNumber(data.deficit.target_calories)} ккал.`,
    };
  }, [data?.deficit, hasCalorieTarget, isLowCoverage]);

  const calorieAverageLabel = useMemo(() => {
    if (!data?.calories?.has_data) return null;
    if (period === 'day') return null;
    return `Среднее за весь период: ${formatNumber(data?.average?.calories)} ккал в день`;
  }, [data?.average?.calories, data?.calories?.has_data, period]);

  const trendData = useMemo(() => {
    const series = (data?.dailyCalories ?? []).slice(-7);
    const first = series[0]?.calories ?? 0;
    const last = series[series.length - 1]?.calories ?? 0;
    const delta = last - first;

    let label = 'Недостаточно данных';
    let helper = 'Добавьте больше записей, чтобы увидеть направление.';

    if (series.length >= 3) {
      if (Math.abs(delta) <= 120) {
        label = 'Рацион стабилен';
        helper = 'Существенного сдвига по калориям за последние дни не видно.';
      } else if (delta > 120) {
        label = 'Калорийность растёт';
        helper = 'Последние дни идут с повышением общей калорийности.';
      } else {
        label = 'Калорийность снижается';
        helper = 'Последние дни идут с уменьшением общей калорийности.';
      }
    }

    return { series, label, helper };
  }, [data?.dailyCalories]);

  const macroInsight = useMemo(() => {
    const macros = data?.macros;
    if (!hasNutritionData || !macros) {
      return {
        title: 'БЖУ недоступно',
        body: 'Недостаточно данных, чтобы оценить распределение белков, жиров и углеводов.',
      };
    }

    const completions = [
      macros.proteinCompletionPercent,
      macros.fatCompletionPercent,
      macros.carbsCompletionPercent,
    ].filter((value): value is number => value != null && Number.isFinite(value));

    if (completions.length === 0) {
      return {
        title: 'Цели по БЖУ пока не заданы',
        body: 'Факт по белкам, жирам и углеводам виден, но сравнить его с планом пока нельзя.',
      };
    }

    if (macros.proteinCompletionPercent != null && macros.proteinCompletionPercent < 90) {
      return {
        title: 'Основной недобор — белок',
        body: 'Среднее количество белка за период ниже цели. Это стоит проверить первым.',
      };
    }

    if (macros.fatCompletionPercent != null && macros.fatCompletionPercent > 110) {
      return {
        title: 'Жиры выше цели',
        body: 'Среднее количество жиров за период заметно выше заданной цели.',
      };
    }

    const allInRange = completions.every((value) => value >= 90 && value <= 110);
    if (allInRange) {
      return {
        title: 'БЖУ в хорошем диапазоне',
        body: 'Белки, жиры и углеводы держатся близко к заданным целям.',
      };
    }

    return {
      title: 'БЖУ требует внимания',
      body: 'Один или несколько макросов заметно отличаются от цели за выбранный период.',
    };
  }, [data?.macros, hasNutritionData]);

  const practicalInsights = useMemo(() => {
    const helps: Array<{ title: string; body: string }> = [];
    const fixes: Array<{ title: string; body: string }> = [];

    if (!hasNutritionData) return { helps, fixes };

    if (isLowCoverage) {
      fixes.push({
        title: 'Заполнено не всё',
        body: `Есть записи за ${daysWithData} из ${periodDays} дней. Чем полнее дневник, тем точнее выводы.`,
      });
    } else if (periodDays > 1 && daysWithData === periodDays) {
      helps.push({
        title: 'Дневник заполнен полностью',
        body: `Есть записи за все ${periodDays} дней выбранного периода.`,
      });
    } else if (coverageRatio >= 0.8) {
      helps.push({
        title: 'Есть достаточно записей',
        body: `Заполнено ${daysWithData} из ${periodDays} дней — этого достаточно для базовой оценки.`,
      });
    }

    if (data?.deficit?.is_visible && (data.deficit.value ?? 0) > 0) {
      helps.push({
        title: 'Вы держите дефицит',
        body: 'Калории за выбранный период ниже цели.',
      });
    } else if (data?.deficit?.is_visible && (data.deficit.value ?? 0) < 0) {
      fixes.push({
        title: 'Калории выше цели',
        body: 'За выбранный период факт по калориям выше плана.',
      });
    } else if (data?.deficit?.is_visible) {
      helps.push({
        title: 'Калории близко к цели',
        body: 'Факт за выбранный период совпадает с планом.',
      });
    }

    if ((data?.topFoods?.length ?? 0) > 0 && (data?.calories?.total ?? 0) > 0) {
      const leader = data?.topFoods?.[0];
      const share = leader ? Math.round((leader.total_calories / Math.max(data.calories?.total ?? 1, 1)) * 100) : 0;
      if (leader && share >= 25) {
        fixes.push({
          title: 'Один продукт сильно влияет на рацион',
          body: `${leader.product_name} даёт около ${share}% всех калорий за период.`,
        });
      }
    }

    if (trendData.series.length >= 3) {
      if (trendData.label === 'Рацион стабилен' || trendData.label === 'Калорийность снижается') {
        helps.push({
          title: trendData.label,
          body: trendData.helper,
        });
      } else {
        fixes.push({
          title: trendData.label,
          body: trendData.helper,
        });
      }
    }

    return {
      helps: helps.slice(0, 3),
      fixes: fixes.slice(0, 3),
    };
  }, [
    coverageRatio,
    data?.calories?.total,
    data?.deficit?.is_visible,
    data?.deficit?.value,
    data?.topFoods,
    daysWithData,
    hasNutritionData,
    isLowCoverage,
    periodDays,
    trendData.helper,
    trendData.label,
    trendData.series.length,
  ]);

  const mainInsightText = useMemo(() => {
    if (!data) return null;

    if (!hasNutritionData) {
      return 'За выбранный период пока нет записей питания.';
    }

    if (isLowCoverage) {
      return `Недостаточно данных для точной оценки. Заполнено ${daysWithData} из ${periodDays} дней.`;
    }

    if (data.deficit?.is_visible && (data.deficit.value ?? 0) > 0) {
      return 'Вы держите дефицит за выбранный период.';
    }

    if (data.deficit?.is_visible && (data.deficit.value ?? 0) < 0) {
      return 'За период есть профицит. Калории выше цели.';
    }

    if (!hasCalorieTarget) {
      return 'Цель по калориям пока не задана.';
    }

    return 'Калории совпадают с целью за выбранный период.';
  }, [data, daysWithData, hasCalorieTarget, hasNutritionData, isLowCoverage, periodDays]);

  return (
    <div className="mx-auto max-w-5xl p-4 md:p-6">
      <div className="mb-4">
        <div className="flex items-center justify-between gap-3">
          <h1 className="min-w-0 text-2xl font-semibold tracking-tight text-stone-950">Питание</h1>
          <button
            type="button"
            className="inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-stone-100 text-stone-600 transition hover:bg-stone-200 hover:text-stone-900"
            onClick={() => navigate('/progress')}
            aria-label="Закрыть"
          >
            <X className="h-5 w-5" />
          </button>
        </div>
        <p className="mt-1 text-sm leading-6 text-stone-600">{periodMeta.dateRangeLabel}</p>
      </div>

      <div className="mb-4 grid grid-cols-4 gap-1.5">
        {PERIOD_OPTIONS.map((option) => (
          <button
            key={option.key}
            type="button"
            onClick={() => setPeriod(option.key)}
            className={`min-w-0 rounded-full px-2 py-2 text-xs font-medium transition sm:text-sm ${
              period === option.key
                ? 'bg-stone-950 text-white shadow-lg shadow-stone-950/15'
                : 'bg-stone-100 text-stone-700 hover:bg-stone-200'
            }`}
          >
            {option.label}
          </button>
        ))}
      </div>

      {!loading && !error && mainInsightText && (
        <div className={`${cardClass} mb-4 p-6`}>
          <div className="mb-2 text-sm font-medium text-stone-900">Главный вывод</div>
          <p className="text-sm font-medium leading-6 text-stone-800">{mainInsightText}</p>
        </div>
      )}

      {!loading && !error && data && (
        <div className={`${cardClass} mb-4 p-6`}>
          <div className="mb-4 text-sm font-medium text-stone-900">Результат за период</div>
          <div className="divide-y divide-stone-100 border-y border-stone-100">
            <div className="flex items-start justify-between gap-4 py-3">
              <div className="min-w-0">
                <div className="text-sm font-medium text-stone-700">Среднее</div>
                <div className="mt-0.5 text-xs text-stone-400">за выбранный период</div>
              </div>
              <div className="max-w-[58%] break-words text-right text-sm font-semibold leading-5 text-stone-900">
                {formatNumber(data.average.calories)} ккал/день
              </div>
            </div>
            <div className="flex items-start justify-between gap-4 py-3">
              <div className="min-w-0">
                <div className="text-sm font-medium text-stone-700">Цель</div>
                <div className="mt-0.5 text-xs text-stone-400">дневная цель</div>
              </div>
              <div className="max-w-[58%] break-words text-right text-sm font-semibold leading-5 text-stone-900">
                {dailyTargetCalories != null ? `${formatNumber(dailyTargetCalories)} ккал/день` : 'Не задана'}
              </div>
            </div>
            <div className="flex items-start justify-between gap-4 py-3">
              <div className="min-w-0">
                <div className="text-sm font-medium text-stone-700">Дефицит / профицит</div>
                <div className="mt-0.5 text-xs text-stone-400">по калориям</div>
              </div>
              <div className={`max-w-[58%] break-words text-right text-sm font-semibold leading-5 ${deficitState.valueClass}`}>
                {deficitState.valueLabel}
              </div>
            </div>
            <div className="flex items-start justify-between gap-4 py-3">
              <div className="min-w-0">
                <div className="text-sm font-medium text-stone-700">Записи</div>
                <div className="mt-0.5 text-xs text-stone-400">заполненность</div>
              </div>
              <div className="max-w-[58%] break-words text-right text-sm font-semibold leading-5 text-stone-900">
                {daysWithData} из {periodDays} дней
              </div>
            </div>
          </div>
          {showAverageExplanation ? (
            <p className="mt-4 text-xs leading-5 text-stone-500">
              Среднее считается за весь выбранный период, включая дни без записей.
            </p>
          ) : null}
          {recordsWarning ? (
            <p className="mt-2 text-xs leading-5 text-amber-700">{recordsWarning}</p>
          ) : null}
        </div>
      )}

      {loading && (
        <div className={`${cardClass} p-6`}>
          <p className="text-sm text-stone-500">Загрузка данных по питанию...</p>
        </div>
      )}

      {error && (
        <div className={`${cardClass} border-red-200 bg-red-50/70 p-6`}>
          <p className="text-sm font-medium text-red-700">{error}</p>
        </div>
      )}

      {!loading && !error && data && (
        <div className="space-y-4">
          {!hasNutritionData ? (
            <>
              <div className={`${cardClass} overflow-hidden p-0`}>
                <div className="bg-[radial-gradient(circle_at_top_left,#fef3c7,transparent_35%),linear-gradient(180deg,#fff,#fafaf9)] p-8">
                  <div className="mb-4 flex h-14 w-14 items-center justify-center rounded-2xl bg-stone-900 text-white">
                    <UtensilsCrossed className="h-7 w-7" />
                  </div>
                  <h2 className="text-2xl font-semibold text-stone-950">За этот период пока нет записей питания</h2>
                  <p className="mt-3 max-w-2xl text-sm leading-6 text-stone-600">
                    {hasCalorieTarget
                      ? 'Нет данных за выбранный период. Progress учитывает только сохранённые записи дневника питания. Добавьте записи, чтобы увидеть калории, макросы и дефицит.'
                      : 'Нет данных за выбранный период. Progress учитывает только сохранённые записи дневника питания. Цель по калориям тоже не задана, поэтому дефицит или профицит сейчас рассчитать нельзя.'}
                  </p>
                  <div className="mt-5 flex flex-wrap gap-3">
                    <button
                      type="button"
                      onClick={() => navigate('/nutrition')}
                      className="inline-flex items-center gap-2 rounded-full bg-stone-950 px-4 py-2 text-sm font-medium text-white"
                    >
                      Перейти в дневник
                      <ChevronRight className="h-4 w-4" />
                    </button>
                    <div className="inline-flex rounded-full bg-stone-100 px-4 py-2 text-sm text-stone-700">
                      Период: {periodMeta.dateRangeLabel.toLowerCase()}
                    </div>
                  </div>
                </div>
              </div>
              {SHOW_LEGACY_NUTRITION_RESULT_CARDS && (
              <div className={`${cardClass} p-6`}>
                <div className="mb-4 text-sm font-medium text-stone-900">Записи за период</div>
                <div className="grid gap-3 sm:grid-cols-2">
                  <div className="rounded-2xl bg-stone-50 p-4">
                    <div className="text-xs uppercase tracking-[0.16em] text-stone-400">Дней с записями</div>
                    <div className="mt-2 text-lg font-semibold text-stone-900">{daysWithData} из {periodDays}</div>
                  </div>
                  <div className="rounded-2xl bg-stone-50 p-4">
                    <div className="text-xs uppercase tracking-[0.16em] text-stone-400">Дней без записей</div>
                    <div className="mt-2 text-lg font-semibold text-stone-900">{missingDays}</div>
                  </div>
                </div>
              </div>
              )}
            </>
          ) : (
            <>
              {SHOW_LEGACY_NUTRITION_RESULT_CARDS && (
              <>
              <div className="grid gap-4 lg:grid-cols-[1.3fr_0.9fr]">
                <div className={`${cardClass} overflow-hidden p-0`}>
                  <div className="bg-[linear-gradient(135deg,#111827_0%,#292524_100%)] p-6 text-white">
                    <div className="mb-3 inline-flex items-center gap-2 rounded-full bg-white/10 px-3 py-1 text-xs uppercase tracking-[0.16em] text-white/70">
                      <Flame className="h-3.5 w-3.5" />
                      Общие калории
                    </div>
                    <div className="text-5xl font-semibold tracking-tight">{formatNumber(data.calories?.total)}</div>
                    <div className="mt-2 text-sm text-white/70">
                      Сумма записей за период {periodMeta.dateRangeLabel}
                    </div>
                    {calorieAverageLabel ? (
                      <>
                        <div className="mt-3 inline-flex rounded-full bg-white/10 px-3 py-1 text-sm text-white/80">
                          {calorieAverageLabel}
                        </div>
                        <p className="mt-2 text-xs text-white/60">Учитывает дни без записей.</p>
                      </>
                    ) : null}
                  </div>
                </div>

                <div className={`${cardClass} p-6`}>
                  <div className="mb-4 flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-stone-100 text-stone-700">
                        <Target className="h-5 w-5" />
                      </div>
                      <div>
                        <div className="text-sm font-medium text-stone-900">Дефицит / профицит</div>
                        <div className="text-xs text-stone-500">Сравнение с целью по калориям</div>
                      </div>
                    </div>
                    <span className={`rounded-full px-3 py-1 text-xs font-semibold ${deficitState.badgeClass}`}>
                      {data.deficit?.is_visible ? 'Активно' : 'Нейтрально'}
                    </span>
                  </div>

                  <div className={`text-3xl font-semibold ${deficitState.valueClass}`}>{deficitState.valueLabel}</div>
                  <p className="mt-2 text-sm leading-6 text-stone-600">{deficitState.helper}</p>
                </div>
              </div>

              <div className={`${cardClass} p-6`}>
                <div className="mb-4 text-sm font-medium text-stone-900">Записи за период</div>
                <div className="grid gap-3 sm:grid-cols-2">
                  <div className="rounded-2xl bg-stone-50 p-4">
                    <div className="text-xs uppercase tracking-[0.16em] text-stone-400">Дней с записями</div>
                    <div className="mt-2 text-lg font-semibold text-stone-900">{daysWithData} из {periodDays}</div>
                  </div>
                  <div className="rounded-2xl bg-stone-50 p-4">
                    <div className="text-xs uppercase tracking-[0.16em] text-stone-400">Дней без записей</div>
                    <div className="mt-2 text-lg font-semibold text-stone-900">{missingDays}</div>
                  </div>
                </div>
                {recordsWarning ? (
                  <p className="mt-4 text-sm leading-6 text-amber-700">{recordsWarning}</p>
                ) : null}
              </div>
              </>
              )}

              <div className={`${cardClass} p-6`}>
                <div className="mb-5">
                  <div className="text-sm font-medium text-stone-900">БЖУ</div>
                  <div className="mt-1 text-sm text-stone-500">
                    Факт в среднем за день и сравнение с целями
                  </div>
                </div>

                <div className="divide-y divide-stone-100 border-y border-stone-100">
                  <MacroSummaryRow
                    label="Белок"
                    averagePerDay={data.macros?.averageProteinPerDay ?? 0}
                    targetPerDay={data.macros?.targetProteinPerDay}
                    completionPercent={data.macros?.proteinCompletionPercent}
                    accentClass="bg-rose-400"
                  />
                  <MacroSummaryRow
                    label="Жиры"
                    averagePerDay={data.macros?.averageFatPerDay ?? 0}
                    targetPerDay={data.macros?.targetFatPerDay}
                    completionPercent={data.macros?.fatCompletionPercent}
                    accentClass="bg-amber-400"
                  />
                  <MacroSummaryRow
                    label="Углеводы"
                    averagePerDay={data.macros?.averageCarbsPerDay ?? 0}
                    targetPerDay={data.macros?.targetCarbsPerDay}
                    completionPercent={data.macros?.carbsCompletionPercent}
                    accentClass="bg-emerald-500"
                  />
                </div>

                <div className="mt-4 border-t border-stone-100 pt-4">
                  <div className="text-sm font-medium text-stone-900">Что стоит поправить</div>
                  <div className="mt-1 text-sm font-medium leading-6 text-stone-800">{macroInsight.title}</div>
                  <div className="mt-1 text-sm leading-6 text-stone-600">{macroInsight.body}</div>
                </div>
              </div>

              {((SHOW_NUTRITION_INSIGHTS_BLOCK && (practicalInsights.helps.length > 0 || practicalInsights.fixes.length > 0)) || SHOW_TOP_FOODS_BLOCK) && (
              <div className={`grid gap-4 ${SHOW_TOP_FOODS_BLOCK ? 'lg:grid-cols-[0.95fr_1.05fr]' : ''}`}>
                {SHOW_NUTRITION_INSIGHTS_BLOCK && (practicalInsights.helps.length > 0 || practicalInsights.fixes.length > 0) && (
                <div className="grid gap-4">
                  {practicalInsights.helps.length > 0 && (
                    <div className={`${cardClass} p-6`}>
                      <div className="mb-4">
                        <div className="text-sm font-medium text-stone-900">Что помогает</div>
                        <div className="mt-1 text-sm text-stone-500">То, что уже поддерживает движение к цели</div>
                      </div>
                      <div className="divide-y divide-stone-100 border-y border-stone-100">
                        {practicalInsights.helps.map((insight) => (
                          <div key={insight.title} className="py-3">
                            <div className="text-sm font-medium text-stone-900">{insight.title}</div>
                            <div className="mt-1 text-sm leading-6 text-stone-600">{insight.body}</div>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  {practicalInsights.fixes.length > 0 && (
                    <div className={`${cardClass} p-6`}>
                      <div className="mb-4">
                        <div className="text-sm font-medium text-stone-900">Что стоит поправить</div>
                        <div className="mt-1 text-sm text-stone-500">То, что мешает точнее держать план</div>
                      </div>
                      <div className="divide-y divide-stone-100 border-y border-stone-100">
                        {practicalInsights.fixes.map((insight) => (
                          <div key={insight.title} className="py-3">
                            <div className="text-sm font-medium text-stone-900">{insight.title}</div>
                            <div className="mt-1 text-sm leading-6 text-stone-600">{insight.body}</div>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
                )}

                {SHOW_TOP_FOODS_BLOCK && (
                <div className={`${cardClass} p-6`}>
                  <div className="mb-4">
                    <div className="text-sm font-medium text-stone-900">Топ-5 продуктов</div>
                    <div className="mt-1 text-sm text-stone-500">По суммарному весу за период</div>
                  </div>

                  {data.topFoods?.length ? (
                    <div className="space-y-3">
                      {data.topFoods.map((item, index) => {
                        const calorieShare =
                          (data.calories?.total ?? 0) > 0
                            ? Math.round((item.total_calories / Math.max(data.calories?.total ?? 1, 1)) * 100)
                            : 0;

                        return (
                          <div
                            key={item.canonical_food_id}
                            className="rounded-2xl border border-stone-200 bg-stone-50/80 p-4"
                          >
                            <div className="mb-2 flex items-start justify-between gap-3">
                              <div className="min-w-0">
                                <div className="mb-1 text-xs font-semibold uppercase tracking-[0.16em] text-stone-400">
                                  #{index + 1}
                                </div>
                                <div className="truncate text-sm font-medium text-stone-900">{item.product_name}</div>
                              </div>
                              <div className="shrink-0 rounded-full bg-white px-2.5 py-1 text-xs font-medium text-stone-600">
                                {formatNumber(item.entry_count)} запис.
                              </div>
                            </div>
                            <div className="flex items-center justify-between text-sm text-stone-600">
                              <span>{formatNumber(item.total_weight_g)} г</span>
                              <span>{formatNumber(item.total_calories)} ккал</span>
                            </div>
                            <div className="mt-2 text-xs font-medium text-stone-500">
                              Вклад в калории периода: {calorieShare}%
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  ) : (
                    <div className="rounded-2xl border border-dashed border-stone-300 bg-stone-50 p-5 text-sm leading-6 text-stone-500">
                      За этот период нет canonical diary entries, из которых можно собрать топ продуктов.
                    </div>
                  )}
                </div>
                )}
              </div>
              )}

            </>
          )}
        </div>
      )}
    </div>
  );
};

export default ProgressNutrition;
