import { type FC, type ReactNode, useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  ArrowLeft,
  CalendarRange,
  ChevronRight,
  Drumstick,
  Droplets,
  Flame,
  Sparkles,
  Target,
  TrendingDown,
  TrendingUp,
  UtensilsCrossed,
  Wheat,
} from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { progressNutritionService, type NutritionProgressPeriod } from '../services/progressNutritionService';
import type { NutritionStats } from '../types/progressDashboard';
import { getLocalDayKey } from '../utils/dayKey';

const PERIOD_OPTIONS: Array<{ key: NutritionProgressPeriod; label: string }> = [
  { key: 'day', label: 'День' },
  { key: 'week', label: '7 дней' },
  { key: 'month', label: '30 дней' },
];

const cardClass = 'rounded-[28px] border border-stone-200 bg-white shadow-[0_18px_50px_rgba(20,20,20,0.08)]';

const formatNumber = (value: number | null | undefined) => {
  if (value == null || !Number.isFinite(value)) return '—';
  return new Intl.NumberFormat('ru-RU', { maximumFractionDigits: 0 }).format(value);
};

const formatDateLabel = (value: string) =>
  new Intl.DateTimeFormat('ru-RU', {
    day: 'numeric',
    month: 'long',
  }).format(new Date(`${value}T00:00:00`));

const formatShortDateLabel = (value: string) =>
  new Intl.DateTimeFormat('ru-RU', {
    day: 'numeric',
    month: 'short',
  }).format(new Date(`${value}T00:00:00`));

const getPeriodMeta = (anchorDate: string, period: NutritionProgressPeriod) => {
  const anchor = new Date(`${anchorDate}T00:00:00`);
  const start = new Date(anchor);

  if (period === 'week') {
    start.setDate(anchor.getDate() - 6);
  } else if (period === 'month') {
    start.setDate(anchor.getDate() - 29);
  }

  return {
    dateRangeLabel:
      period === 'day'
        ? formatDateLabel(anchorDate)
        : `${formatDateLabel(start.toISOString().slice(0, 10))} - ${formatDateLabel(anchorDate)}`,
    subtitle:
      period === 'day'
        ? 'За выбранный день'
        : period === 'week'
          ? 'Последние 7 дней, включая выбранную дату'
          : 'Последние 30 дней, включая выбранную дату',
  };
};

const MacroBar: FC<{
  label: string;
  value: number;
  share: number;
  icon: ReactNode;
  fillClass: string;
  iconClass: string;
}> = ({ label, value, share, icon, fillClass, iconClass }) => (
  <div className="rounded-2xl border border-stone-200 bg-stone-50/80 p-4">
    <div className="mb-3 flex items-center justify-between">
      <div className="flex items-center gap-2 text-sm font-medium text-stone-700">
        <span className={`flex h-8 w-8 items-center justify-center rounded-full ${iconClass}`}>{icon}</span>
        {label}
      </div>
      <span className="text-sm text-stone-500">{Math.round(share)}%</span>
    </div>
    <div className="mb-2 text-2xl font-semibold text-stone-950">{formatNumber(value)} г</div>
    <div className="h-2 overflow-hidden rounded-full bg-stone-200">
      <div
        className={`h-full rounded-full ${fillClass}`}
        style={{ width: `${Math.max(share, value > 0 ? 8 : 0)}%` }}
      />
    </div>
  </div>
);

const InsightPill: FC<{ title: string; body: string }> = ({ title, body }) => (
  <div className="rounded-2xl border border-stone-200 bg-stone-50/80 p-4">
    <div className="mb-1 text-sm font-medium text-stone-900">{title}</div>
    <div className="text-sm leading-6 text-stone-600">{body}</div>
  </div>
);

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

  const title = useMemo(() => PERIOD_OPTIONS.find((option) => option.key === period)?.label ?? 'Период', [period]);
  const periodMeta = useMemo(() => getPeriodMeta(anchorDate, period), [anchorDate, period]);
  const hasNutritionData = Boolean(data?.calories?.has_data);
  const macroTotal = (data?.macros?.protein_g ?? 0) + (data?.macros?.fat_g ?? 0) + (data?.macros?.carbs_g ?? 0);

  const deficitState = useMemo(() => {
    if (!data?.deficit?.is_visible) {
      const hasTarget = data?.deficit?.target_calories != null;
      const isLowCoverage = hasTarget && (data?.periodDays ?? 1) > 1 && (data?.periodCoverage?.coverage_ratio ?? 0) < 0.8;
      return {
        valueLabel: isLowCoverage ? 'Недостаточно данных' : 'Цель не задана',
        badgeClass: 'bg-stone-100 text-stone-600',
        valueClass: 'text-stone-600',
        helper: isLowCoverage
          ? 'Недостаточно данных за период для корректного расчёта.'
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
  }, [data?.deficit]);

  const calorieAverageLabel = useMemo(() => {
    if (!data?.calories?.has_data) return null;
    if (period === 'day') return null;
    return `В среднем ${formatNumber(data?.average?.calories)} ккал в день`;
  }, [data?.average?.calories, data?.calories?.has_data, period]);

  const trendData = useMemo(() => {
    const series = (data?.dailyCalories ?? []).slice(-7);
    const max = Math.max(...series.map((item) => item.calories), 0);
    const first = series[0]?.calories ?? 0;
    const last = series[series.length - 1]?.calories ?? 0;
    const delta = last - first;

    let label = 'Недостаточно данных';
    let helper = 'Добавьте больше записей, чтобы увидеть направление.';
    let tone = 'text-stone-600';
    let icon: ReactNode = <Target className="h-4 w-4" />;

    if (series.length >= 3) {
      if (Math.abs(delta) <= 120) {
        label = 'Рацион стабилен';
        helper = 'Существенного сдвига по калориям за последние дни не видно.';
        tone = 'text-sky-700';
        icon = <Target className="h-4 w-4" />;
      } else if (delta > 120) {
        label = 'Калорийность растёт';
        helper = 'Последние дни идут с повышением общей калорийности.';
        tone = 'text-amber-700';
        icon = <TrendingUp className="h-4 w-4" />;
      } else {
        label = 'Калорийность снижается';
        helper = 'Последние дни идут с уменьшением общей калорийности.';
        tone = 'text-emerald-700';
        icon = <TrendingDown className="h-4 w-4" />;
      }
    }

    return { series, max, label, helper, tone, icon };
  }, [data?.dailyCalories]);

  const macroInsight = useMemo(() => {
    if (!hasNutritionData || macroTotal <= 0) {
      return {
        title: 'Баланс макросов недоступен',
        body: 'Недостаточно данных, чтобы оценить распределение белков, жиров и углеводов.',
      };
    }

    const proteinShare = ((data?.macros?.protein_g ?? 0) / macroTotal) * 100;
    const fatShare = ((data?.macros?.fat_g ?? 0) / macroTotal) * 100;
    const carbShare = ((data?.macros?.carbs_g ?? 0) / macroTotal) * 100;

    if (fatShare >= proteinShare + 10 && fatShare >= carbShare + 10) {
      return {
        title: 'Смещение в сторону жиров',
        body: 'Жиры дают заметно большую долю макросов, чем белки и углеводы.',
      };
    }

    if (proteinShare < 22) {
      return {
        title: 'Белка относительно мало',
        body: 'Доля белка ниже остальных макросов. Стоит проверить основные источники белка в рационе.',
      };
    }

    if (Math.max(proteinShare, fatShare, carbShare) - Math.min(proteinShare, fatShare, carbShare) <= 12) {
      return {
        title: 'Баланс близок к ровному',
        body: 'Распределение белков, жиров и углеводов выглядит достаточно равномерным.',
      };
    }

    if (carbShare >= proteinShare + 10 && carbShare >= fatShare + 10) {
      return {
        title: 'Смещение в сторону углеводов',
        body: 'Углеводы дают наибольшую долю суммарных макросов за этот период.',
      };
    }

    return {
      title: 'Баланс макросов смещён',
      body: 'Один из макросов доминирует. Проверьте состав основных продуктов в рационе.',
    };
  }, [data?.macros, hasNutritionData, macroTotal]);

  const contextualInsights = useMemo(() => {
    const insights: Array<{ title: string; body: string }> = [];

    if (!hasNutritionData) return insights;

    insights.push(macroInsight);

    if ((data?.topFoods?.length ?? 0) > 0 && (data?.calories?.total ?? 0) > 0) {
      const leader = data?.topFoods?.[0];
      const share = leader ? Math.round((leader.total_calories / Math.max(data.calories?.total ?? 1, 1)) * 100) : 0;
      if (leader && share >= 25) {
        insights.push({
          title: 'Один продукт сильно влияет на рацион',
          body: `${leader.product_name} даёт около ${share}% всех калорий за период.`,
        });
      }
    }

    if (insights.length < 2) {
      insights.push({
        title: trendData.label,
        body: trendData.helper,
      });
    }

    return insights.slice(0, 2);
  }, [data?.calories?.total, data?.topFoods, hasNutritionData, macroInsight, trendData.helper, trendData.label]);

  return (
    <div className="mx-auto max-w-5xl p-4 md:p-6">
      <button
        type="button"
        className="mb-4 inline-flex items-center gap-2 text-sm font-medium text-stone-600 transition hover:text-stone-900"
        onClick={() => navigate('/progress')}
      >
        <ArrowLeft className="h-4 w-4" />
        Назад
      </button>

      <div className="mb-6 overflow-hidden rounded-[32px] border border-stone-200 bg-[linear-gradient(135deg,#fff7ed_0%,#ffffff_45%,#f5f5f4_100%)] p-6 shadow-[0_24px_70px_rgba(0,0,0,0.08)]">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <div className="mb-3 inline-flex items-center gap-2 rounded-full bg-white/90 px-3 py-1 text-xs font-semibold uppercase tracking-[0.18em] text-stone-500">
              <Sparkles className="h-3.5 w-3.5" />
              Progress · Питание
            </div>
            <h1 className="text-3xl font-semibold tracking-tight text-stone-950">Питание</h1>
            <p className="mt-2 max-w-2xl text-sm leading-6 text-stone-600">{periodMeta.subtitle}</p>
          </div>

          <div className="rounded-2xl border border-stone-200 bg-white/90 px-4 py-3 text-right shadow-sm">
            <div className="mb-1 flex items-center justify-end gap-2 text-xs font-medium uppercase tracking-[0.16em] text-stone-500">
              <CalendarRange className="h-4 w-4" />
              Период
            </div>
            <div className="text-sm font-semibold text-stone-900">{title}</div>
            <div className="mt-1 text-sm text-stone-600">{periodMeta.dateRangeLabel}</div>
          </div>
        </div>
      </div>

      <div className="mb-6 flex flex-wrap gap-2">
        {PERIOD_OPTIONS.map((option) => (
          <button
            key={option.key}
            type="button"
            onClick={() => setPeriod(option.key)}
            className={`rounded-full px-4 py-2 text-sm font-medium transition ${
              period === option.key
                ? 'bg-stone-950 text-white shadow-lg shadow-stone-950/15'
                : 'bg-stone-100 text-stone-700 hover:bg-stone-200'
            }`}
          >
            {option.label}
          </button>
        ))}
      </div>

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
            <div className={`${cardClass} overflow-hidden p-0`}>
              <div className="bg-[radial-gradient(circle_at_top_left,#fef3c7,transparent_35%),linear-gradient(180deg,#fff,#fafaf9)] p-8">
                <div className="mb-4 flex h-14 w-14 items-center justify-center rounded-2xl bg-stone-900 text-white">
                  <UtensilsCrossed className="h-7 w-7" />
                </div>
                <h2 className="text-2xl font-semibold text-stone-950">За этот период пока нет данных</h2>
                <p className="mt-3 max-w-2xl text-sm leading-6 text-stone-600">
                  Записи из дневника питания за выбранный период не найдены. Когда появятся diary entries,
                  здесь отобразятся калории, макросы, динамика и топ продуктов.
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
          ) : (
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
                      Сумма по diary snapshot за период {periodMeta.dateRangeLabel}
                    </div>
                    {calorieAverageLabel ? (
                      <div className="mt-3 inline-flex rounded-full bg-white/10 px-3 py-1 text-sm text-white/80">
                        {calorieAverageLabel}
                      </div>
                    ) : null}
                  </div>
                  <div className="grid gap-4 border-t border-stone-200 bg-white p-6 sm:grid-cols-3">
                    <div>
                      <div className="text-xs uppercase tracking-[0.16em] text-stone-400">Статус данных</div>
                      <div className="mt-2 text-sm font-medium text-stone-900">Записи найдены</div>
                    </div>
                    <div>
                      <div className="text-xs uppercase tracking-[0.16em] text-stone-400">Canonical</div>
                      <div className="mt-2 text-sm font-medium text-stone-900">
                        {formatNumber(data.coverage?.included_canonical_count ?? 0)} строк
                      </div>
                    </div>
                    <div>
                      <div className="text-xs uppercase tracking-[0.16em] text-stone-400">Recipe snapshot</div>
                      <div className="mt-2 text-sm font-medium text-stone-900">
                        {formatNumber(data.coverage?.included_recipe_snapshot_count ?? 0)} строк
                      </div>
                    </div>
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

              <div className="grid gap-4 lg:grid-cols-[1.1fr_0.9fr]">
                <div className={`${cardClass} p-6`}>
                  <div className="mb-5">
                    <div className="text-sm font-medium text-stone-900">Макросы</div>
                    <div className="mt-1 text-sm text-stone-500">
                      Сумма белков, жиров и углеводов за выбранный период
                    </div>
                  </div>

                  <div className="grid gap-4">
                    <MacroBar
                      label="Белки"
                      value={data.macros?.protein_g ?? 0}
                      share={macroTotal > 0 ? ((data.macros?.protein_g ?? 0) / macroTotal) * 100 : 0}
                      icon={<Drumstick className="h-4 w-4" />}
                      fillClass="bg-rose-500"
                      iconClass="bg-rose-500 text-white"
                    />
                    <MacroBar
                      label="Жиры"
                      value={data.macros?.fat_g ?? 0}
                      share={macroTotal > 0 ? ((data.macros?.fat_g ?? 0) / macroTotal) * 100 : 0}
                      icon={<Droplets className="h-4 w-4" />}
                      fillClass="bg-amber-500"
                      iconClass="bg-amber-500 text-white"
                    />
                    <MacroBar
                      label="Углеводы"
                      value={data.macros?.carbs_g ?? 0}
                      share={macroTotal > 0 ? ((data.macros?.carbs_g ?? 0) / macroTotal) * 100 : 0}
                      icon={<Wheat className="h-4 w-4" />}
                      fillClass="bg-emerald-500"
                      iconClass="bg-emerald-500 text-white"
                    />
                  </div>

                  <div className="mt-4">
                    <InsightPill title={macroInsight.title} body={macroInsight.body} />
                  </div>
                </div>

                <div className={`${cardClass} p-6`}>
                  <div className="mb-4 flex items-center justify-between">
                    <div>
                      <div className="text-sm font-medium text-stone-900">Динамика калорий</div>
                      <div className="mt-1 text-sm text-stone-500">Последние 7 дней</div>
                    </div>
                    <div className={`inline-flex items-center gap-2 rounded-full px-3 py-1 text-xs font-semibold ${trendData.tone} bg-stone-100`}>
                      {trendData.icon}
                      {trendData.label}
                    </div>
                  </div>

                  {trendData.series.length ? (
                    <>
                      <div className="flex h-44 items-end gap-2">
                        {trendData.series.map((item) => {
                          const height = trendData.max > 0 ? Math.max((item.calories / trendData.max) * 100, 6) : 6;
                          return (
                            <div key={item.date} className="flex min-w-0 flex-1 flex-col items-center gap-2">
                              <div className="text-[11px] font-medium text-stone-500">{formatNumber(item.calories)}</div>
                              <div className="flex h-28 w-full items-end">
                                <div
                                  className="w-full rounded-t-2xl bg-[linear-gradient(180deg,#fb923c_0%,#ea580c_100%)]"
                                  style={{ height: `${height}%` }}
                                />
                              </div>
                              <div className="text-[11px] text-stone-500">{formatShortDateLabel(item.date)}</div>
                            </div>
                          );
                        })}
                      </div>
                      <p className="mt-4 text-sm leading-6 text-stone-600">{trendData.helper}</p>
                    </>
                  ) : (
                    <div className="rounded-2xl border border-dashed border-stone-300 bg-stone-50 p-5 text-sm leading-6 text-stone-500">
                      Недостаточно дневных записей, чтобы построить динамику.
                    </div>
                  )}
                </div>
              </div>

              <div className="grid gap-4 lg:grid-cols-[0.95fr_1.05fr]">
                <div className={`${cardClass} p-6`}>
                  <div className="mb-4">
                    <div className="text-sm font-medium text-stone-900">Короткие выводы</div>
                    <div className="mt-1 text-sm text-stone-500">Простые rule-based insights по текущему периоду</div>
                  </div>
                  <div className="grid gap-3">
                    {contextualInsights.map((insight) => (
                      <InsightPill key={insight.title} title={insight.title} body={insight.body} />
                    ))}
                  </div>
                </div>

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
              </div>

              <div className={`${cardClass} p-5`}>
                <div className="flex flex-wrap gap-3 text-sm text-stone-600">
                  <span className="rounded-full bg-stone-100 px-3 py-1.5">
                    Excluded fallback: {formatNumber(data.coverage?.excluded_fallback_count ?? 0)}
                  </span>
                  <span className="rounded-full bg-stone-100 px-3 py-1.5">
                    Excluded unresolved: {formatNumber(data.coverage?.excluded_unresolved_count ?? 0)}
                  </span>
                </div>
              </div>
            </>
          )}
        </div>
      )}
    </div>
  );
};

export default ProgressNutrition;
