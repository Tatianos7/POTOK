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

function MetricCell({ value, trend }: { value: number; trend: WorkoutProgressMetricTrend }) {
  return (
    <div className="flex min-h-[52px] items-center justify-center gap-1 border-l border-gray-200 px-1 text-center">
      <span className="text-[14px] text-gray-900">{value}</span>
      <TrendIndicator trend={trend} />
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
      <div className="mb-2 grid grid-cols-[minmax(0,1fr)_56px_56px_56px] gap-0 text-[12px] italic text-gray-700">
        <div className="pr-3 font-medium">Название упражнения</div>
        <div className="flex items-center justify-center text-center font-medium">Подход</div>
        <div className="flex items-center justify-center text-center font-medium">Повтор</div>
        <div className="flex items-center justify-center text-center font-medium">Вес</div>
      </div>

      <div className="divide-y divide-gray-200">
        {rows.map((row) => (
          onRowSelect ? (
            <button
              key={row.exerciseGroupKey}
              type="button"
              onClick={() => onRowSelect(row)}
              className="grid w-full grid-cols-[minmax(0,1fr)_56px_56px_56px] gap-0 text-left transition-colors hover:bg-gray-50"
              aria-label={`Открыть прогресс упражнения ${row.exerciseName}`}
            >
              <div className="min-w-0 py-4 pr-2 text-[15px] leading-5 text-gray-700 [word-break:normal] [overflow-wrap:anywhere]">
                {row.exerciseName}
              </div>
              <MetricCell value={row.latestSets} trend={row.setsTrend} />
              <MetricCell value={row.latestReps} trend={row.repsTrend} />
              <MetricCell value={row.latestWeight} trend={row.weightTrend} />
            </button>
          ) : (
            <div
              key={row.exerciseGroupKey}
              className="grid grid-cols-[minmax(0,1fr)_56px_56px_56px] gap-0"
            >
              <div className="min-w-0 py-4 pr-2 text-[15px] leading-5 text-gray-700 [word-break:normal] [overflow-wrap:anywhere]">
                {row.exerciseName}
              </div>
              <MetricCell value={row.latestSets} trend={row.setsTrend} />
              <MetricCell value={row.latestReps} trend={row.repsTrend} />
              <MetricCell value={row.latestWeight} trend={row.weightTrend} />
            </div>
          )
        ))}
      </div>
    </div>
  );
};

export default WorkoutProgressList;
