import type { WorkoutEntry } from '../types/workout';
import { formatWorkoutMetricValue, normalizeWorkoutMetricType } from '../utils/workoutEntryMetric';

interface WorkoutHistoryDayDetailsProps {
  date: string | null;
  entries: WorkoutEntry[];
  isLoading?: boolean;
}

const WorkoutHistoryDayDetails = ({ date, entries, isLoading = false }: WorkoutHistoryDayDetailsProps) => {
  if (!date) {
    return (
      <div className="rounded-xl border border-dashed border-gray-300 px-4 py-6 text-sm text-gray-500 dark:border-gray-700 dark:text-gray-400">
        Выберите день, чтобы посмотреть тренировку.
      </div>
    );
  }

  if (isLoading) {
    return (
      <div className="rounded-xl border border-gray-200 px-4 py-6 text-sm text-gray-500 dark:border-gray-700 dark:text-gray-400">
        Загружаем тренировку...
      </div>
    );
  }

  if (entries.length === 0) {
    return (
      <div className="rounded-xl border border-gray-200 bg-white px-4 py-6 text-sm text-gray-500 dark:border-gray-700 dark:bg-gray-900 dark:text-gray-400">
        Для этого дня тренировка не найдена.
      </div>
    );
  }

  return (
    <div className="rounded-xl border border-gray-200 bg-white dark:border-gray-700 dark:bg-gray-900">
      <div className="border-b border-gray-200 px-4 py-3 text-sm font-semibold uppercase text-gray-900 dark:border-gray-700 dark:text-white">
        Тренировка за {date}
      </div>
      <div className="grid grid-cols-[minmax(0,1fr)_48px_48px_64px] gap-0 border-b border-gray-100 px-4 py-3 text-[11px] font-medium italic text-gray-600 dark:border-gray-800 dark:text-gray-300">
        <div className="min-w-0 pr-2">Упражнение</div>
        <div className="flex items-center justify-center text-center">Подх</div>
        <div className="flex items-center justify-center text-center">Пов</div>
        <div className="flex items-center justify-center text-center">Вес</div>
      </div>
      <div className="divide-y divide-gray-100 dark:divide-gray-800">
        {entries.map((entry) => (
          <div
            key={entry.id}
            className="grid grid-cols-[minmax(0,1fr)_48px_48px_64px] gap-0 px-4 py-3 text-sm text-gray-900 dark:text-white"
          >
            <div className="min-w-0 pr-2 text-[13px] leading-5 break-words overflow-hidden">
              {entry.exercise?.name || 'Неизвестное упражнение'}
            </div>
            <div className="flex items-center justify-center border-l border-gray-200 px-1 text-center dark:border-gray-700">{entry.sets}</div>
            <div className="flex items-center justify-center border-l border-gray-200 px-1 text-center dark:border-gray-700">{entry.reps}</div>
            <div className="flex items-center justify-center border-l border-gray-200 px-1 text-center dark:border-gray-700">
              {formatWorkoutMetricValue(entry.displayAmount ?? entry.weight, normalizeWorkoutMetricType(entry.metricType), entry.metricUnit ?? entry.displayUnit)}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};

export default WorkoutHistoryDayDetails;
