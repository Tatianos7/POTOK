import { ArrowDown, ArrowUp } from 'lucide-react';
import type { WorkoutProgressMetricTrend, WorkoutProgressRow } from '../types/workout';

interface WorkoutProgressListProps {
  rows: WorkoutProgressRow[];
  isLoading?: boolean;
  onRowSelect?: (row: WorkoutProgressRow) => void;
}

function TrendIndicator({ trend }: { trend: WorkoutProgressMetricTrend }) {
  if (trend === 'up') {
    return <ArrowUp aria-label="Рост показателя" className="h-[14px] w-[14px] text-green-500" strokeWidth={2.25} />;
  }

  if (trend === 'down') {
    return <ArrowDown aria-label="Снижение показателя" className="h-[14px] w-[14px] text-red-500" strokeWidth={2.25} />;
  }

  if (trend === 'return') {
    return (
      <span
        aria-label="Возврат к базовому уровню"
        className="inline-block h-4 border-l-2 border-orange-400"
        data-trend="return"
      />
    );
  }

  return null;
}

function MetricCell({
  label,
  trend,
  value,
}: {
  label: string;
  value: number | string;
  trend: WorkoutProgressMetricTrend;
}) {
  return (
    <div className="flex min-h-[54px] flex-col items-center justify-center gap-1 rounded-lg border border-gray-100 bg-gray-50 px-2 py-2 text-center sm:min-h-[52px] sm:flex-row sm:rounded-none sm:border-0 sm:border-l sm:border-gray-200 sm:bg-white sm:px-1">
      <span className="text-[11px] font-medium text-gray-500 sm:hidden">{label}</span>
      <span className="flex items-center justify-center gap-1 text-[14px] text-gray-900">
        <span>{value}</span>
        <TrendIndicator trend={trend} />
      </span>
    </div>
  );
}

const WorkoutProgressList = ({ rows, isLoading = false, onRowSelect }: WorkoutProgressListProps) => {
  if (isLoading) {
    return (
      <div className="bg-white px-1 py-6 text-sm text-gray-500">
        Загружаем прогресс тренировок...
      </div>
    );
  }

  if (rows.length === 0) {
    return (
      <div className="bg-white px-1 py-6 text-sm text-gray-500">
        За выбранный месяц нет тренировочных данных
      </div>
    );
  }

  return (
    <div className="bg-white px-1">
      <div className="mb-2 hidden grid-cols-[minmax(0,1fr)_56px_56px_56px] gap-0 text-[12px] italic text-gray-700 sm:grid">
        <div className="pr-3 font-medium">Название упражнения</div>
        <div className="flex items-center justify-center text-center font-medium">Подход</div>
        <div className="flex items-center justify-center text-center font-medium">Повтор</div>
        <div className="flex items-center justify-center text-center font-medium">Метрика</div>
      </div>

      <div className="divide-y divide-gray-200 sm:divide-y">
        {rows.map((row) => (
          onRowSelect ? (
            <button
              key={row.exerciseGroupKey}
              type="button"
              onClick={() => onRowSelect(row)}
              className="block w-full py-3 text-left transition-colors hover:bg-gray-50 sm:grid sm:grid-cols-[minmax(0,1fr)_56px_56px_56px] sm:gap-0 sm:py-0"
              aria-label={`Открыть прогресс упражнения ${row.exerciseName}`}
            >
              <div className="min-w-0 break-words pb-3 text-[15px] leading-5 text-gray-800 sm:py-4 sm:pr-2 sm:text-gray-700">
                {row.exerciseName}
              </div>
              <div className="grid grid-cols-3 gap-2 sm:contents">
                <MetricCell label="Подход" value={row.latestSets} trend={row.setsTrend} />
                <MetricCell label="Повтор" value={row.latestReps} trend={row.repsTrend} />
                <MetricCell label="Метрика" value={row.latestMetricLabel} trend={row.weightTrend} />
              </div>
            </button>
          ) : (
            <div
              key={row.exerciseGroupKey}
              className="block py-3 sm:grid sm:grid-cols-[minmax(0,1fr)_56px_56px_56px] sm:gap-0 sm:py-0"
            >
              <div className="min-w-0 break-words pb-3 text-[15px] leading-5 text-gray-800 sm:py-4 sm:pr-2 sm:text-gray-700">
                {row.exerciseName}
              </div>
              <div className="grid grid-cols-3 gap-2 sm:contents">
                <MetricCell label="Подход" value={row.latestSets} trend={row.setsTrend} />
                <MetricCell label="Повтор" value={row.latestReps} trend={row.repsTrend} />
                <MetricCell label="Метрика" value={row.latestMetricLabel} trend={row.weightTrend} />
              </div>
            </div>
          )
        ))}
      </div>
    </div>
  );
};

export default WorkoutProgressList;
