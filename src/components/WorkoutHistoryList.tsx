import type { WorkoutHistoryDaySummary } from '../types/workout';

interface WorkoutHistoryListProps {
  items: WorkoutHistoryDaySummary[];
  selectedDate?: string | null;
  onSelect: (item: WorkoutHistoryDaySummary) => void;
}

function formatHistoryDate(date: string): string {
  const [year, month, day] = date.split('-').map(Number);
  const months = [
    'января', 'февраля', 'марта', 'апреля', 'мая', 'июня',
    'июля', 'августа', 'сентября', 'октября', 'ноября', 'декабря',
  ];
  return `${day} ${months[month - 1]} ${year}`;
}

const WorkoutHistoryList = ({ items, selectedDate, onSelect }: WorkoutHistoryListProps) => {
  if (items.length === 0) {
    return (
      <div className="rounded-xl border border-gray-200 bg-gray-50 px-4 py-6 text-sm text-gray-500 dark:border-gray-700 dark:bg-gray-800 dark:text-gray-400">
        За выбранный период тренировок нет.
      </div>
    );
  }

  return (
    <div className="space-y-3">
      {items.map((item) => {
        const isSelected = selectedDate === item.date;
        return (
          <button
            key={item.workout_day_id}
            type="button"
            onClick={() => onSelect(item)}
            className={`w-full rounded-xl border px-4 py-3 text-left transition-colors ${
              isSelected
                ? 'border-green-500 bg-green-50 dark:bg-green-900/20'
                : 'border-gray-200 bg-white hover:bg-gray-50 dark:border-gray-700 dark:bg-gray-900 dark:hover:bg-gray-800'
            }`}
          >
            <div className="flex items-start justify-between gap-4">
              <div>
                <div className="text-sm font-semibold text-gray-900 dark:text-white">
                  {formatHistoryDate(item.date)}
                </div>
                <div className="mt-1 text-xs text-gray-500 dark:text-gray-400">
                  Упражнений: {item.exercise_count}
                </div>
              </div>
              <div className="text-right text-xs text-gray-600 dark:text-gray-300">
                <div>Подходы: {item.total_sets}</div>
                <div>Объём: {item.total_volume}</div>
              </div>
            </div>
          </button>
        );
      })}
    </div>
  );
};

export default WorkoutHistoryList;
