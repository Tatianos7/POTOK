import { type FC, useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { progressNutritionService, type NutritionProgressPeriod } from '../services/progressNutritionService';
import type { NutritionStats } from '../types/progressDashboard';
import { getLocalDayKey } from '../utils/dayKey';

const PERIOD_OPTIONS: Array<{ key: NutritionProgressPeriod; label: string }> = [
  { key: 'day', label: 'День' },
  { key: 'week', label: '7 дней' },
  { key: 'month', label: '30 дней' },
];

const cardClass = 'rounded-2xl border border-gray-200 bg-white p-4 shadow-sm';

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

  const title = useMemo(() => {
    return PERIOD_OPTIONS.find((option) => option.key === period)?.label ?? 'Период';
  }, [period]);

  return (
    <div className="mx-auto max-w-3xl p-4">
      <button type="button" className="mb-4 text-sm text-gray-600" onClick={() => navigate('/progress')}>
        Назад
      </button>

      <div className="mb-4 flex items-center justify-between">
        <div>
          <h1 className="text-xl font-semibold">Питание</h1>
          <p className="mt-1 text-sm text-gray-500">
            Период: {title}, anchor date: {anchorDate}
          </p>
        </div>
      </div>

      <div className="mb-6 flex gap-2">
        {PERIOD_OPTIONS.map((option) => (
          <button
            key={option.key}
            type="button"
            onClick={() => setPeriod(option.key)}
            className={`rounded-full px-4 py-2 text-sm ${
              period === option.key ? 'bg-gray-900 text-white' : 'bg-gray-100 text-gray-700'
            }`}
          >
            {option.label}
          </button>
        ))}
      </div>

      {loading && <p className="text-sm text-gray-500">Загрузка...</p>}
      {error && <p className="text-sm text-red-600">{error}</p>}
      {!loading && !error && data && (
        <div className="space-y-4">
          <div className="grid gap-4 md:grid-cols-2">
            <div className={cardClass}>
              <div className="text-sm text-gray-500">Калории</div>
              <div className="mt-2 text-3xl font-semibold">{data.calories?.total ?? 0}</div>
              <div className="mt-1 text-xs text-gray-400">
                {data.calories?.has_data ? 'Есть данные' : 'Нет данных'}
              </div>
            </div>

            <div className={cardClass}>
              <div className="text-sm text-gray-500">Дефицит</div>
              <div className="mt-2 text-3xl font-semibold">
                {data.deficit?.is_visible ? data.deficit.value ?? 0 : '—'}
              </div>
              <div className="mt-1 text-xs text-gray-400">
                {data.deficit?.is_visible ? `Цель: ${data.deficit.target_calories}` : 'Цель не задана'}
              </div>
            </div>
          </div>

          <div className={`${cardClass} grid gap-4 md:grid-cols-3`}>
            <div>
              <div className="text-sm text-gray-500">Белки</div>
              <div className="mt-2 text-2xl font-semibold">{data.macros?.protein_g ?? 0} г</div>
            </div>
            <div>
              <div className="text-sm text-gray-500">Жиры</div>
              <div className="mt-2 text-2xl font-semibold">{data.macros?.fat_g ?? 0} г</div>
            </div>
            <div>
              <div className="text-sm text-gray-500">Углеводы</div>
              <div className="mt-2 text-2xl font-semibold">{data.macros?.carbs_g ?? 0} г</div>
            </div>
          </div>

          <div className={cardClass}>
            <div className="mb-3 text-sm text-gray-500">Топ-5 продуктов</div>
            {data.topFoods?.length ? (
              <div className="space-y-2">
                {data.topFoods.map((item) => (
                  <div key={item.canonical_food_id} className="flex items-center justify-between text-sm">
                    <span>{item.product_name}</span>
                    <span className="text-gray-500">
                      {Math.round(item.total_weight_g)} г · {Math.round(item.total_calories)} ккал
                    </span>
                  </div>
                ))}
              </div>
            ) : (
              <div className="text-sm text-gray-400">Нет canonical данных для топа продуктов.</div>
            )}
          </div>
        </div>
      )}
    </div>
  );
};

export default ProgressNutrition;
