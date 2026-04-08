import { ChevronLeft, ChevronRight } from 'lucide-react';

interface WorkoutProgressMonthPickerProps {
  selectedMonthDate: string;
  minDate?: string;
  maxDate?: string;
  onMonthSelect: (date: string) => void;
}

const MONTHS = [
  'Янв',
  'Фев',
  'Мар',
  'Апр',
  'Май',
  'Июн',
  'Июл',
  'Авг',
  'Сен',
  'Окт',
  'Ноя',
  'Дек',
];

function pad2(value: number): string {
  return String(value).padStart(2, '0');
}

function toMonthKey(date: string): string {
  return date.slice(0, 7);
}

function buildMonthDate(year: number, monthIndex: number): string {
  return `${year}-${pad2(monthIndex + 1)}-01`;
}

export function clampMonthDateForBounds(
  monthDate: string,
  minMonthKey: string | null,
  maxMonthKey: string | null,
): string {
  const monthKey = toMonthKey(monthDate);
  if (minMonthKey !== null && monthKey < minMonthKey) {
    return `${minMonthKey}-01`;
  }
  if (maxMonthKey !== null && monthKey > maxMonthKey) {
    return `${maxMonthKey}-01`;
  }
  return monthDate;
}

export function getYearNavigationTargetMonthDate(
  currentYear: number,
  selectedMonthIndex: number,
  deltaYears: -1 | 1,
  minMonthKey: string | null,
  maxMonthKey: string | null,
): string {
  return clampMonthDateForBounds(
    buildMonthDate(currentYear + deltaYears, selectedMonthIndex - 1),
    minMonthKey,
    maxMonthKey,
  );
}

const WorkoutProgressMonthPicker = ({
  selectedMonthDate,
  minDate,
  maxDate,
  onMonthSelect,
}: WorkoutProgressMonthPickerProps) => {
  const [selectedYear, selectedMonthIndex] = selectedMonthDate.split('-').map(Number);
  const currentYear = selectedYear;
  const selectedMonthKey = toMonthKey(selectedMonthDate);
  const minMonthKey = minDate ? toMonthKey(minDate) : null;
  const maxMonthKey = maxDate ? toMonthKey(maxDate) : null;

  const prevYearTarget = getYearNavigationTargetMonthDate(currentYear, selectedMonthIndex, -1, minMonthKey, maxMonthKey);
  const nextYearTarget = getYearNavigationTargetMonthDate(currentYear, selectedMonthIndex, 1, minMonthKey, maxMonthKey);
  const canGoPrevYear = toMonthKey(prevYearTarget) !== selectedMonthKey;
  const canGoNextYear = toMonthKey(nextYearTarget) !== selectedMonthKey;

  return (
    <div
      className="absolute left-0 right-0 top-full z-20 mt-2 rounded-xl border border-gray-200 bg-white p-4 shadow-lg"
      data-testid="progress-month-picker-overlay"
    >
      <div className="mb-3 flex items-center justify-between">
        <button
          type="button"
          onClick={() => canGoPrevYear && onMonthSelect(prevYearTarget)}
          disabled={!canGoPrevYear}
          className="rounded-lg p-2 text-gray-500 transition-colors hover:bg-gray-100 disabled:cursor-not-allowed disabled:opacity-30"
          aria-label="Предыдущий год"
        >
          <ChevronLeft className="h-4 w-4" />
        </button>
        <div className="text-sm font-semibold text-gray-900">{currentYear}</div>
        <button
          type="button"
          onClick={() => canGoNextYear && onMonthSelect(nextYearTarget)}
          disabled={!canGoNextYear}
          className="rounded-lg p-2 text-gray-500 transition-colors hover:bg-gray-100 disabled:cursor-not-allowed disabled:opacity-30"
          aria-label="Следующий год"
        >
          <ChevronRight className="h-4 w-4" />
        </button>
      </div>

      <div className="grid grid-cols-3 gap-2">
        {MONTHS.map((monthLabel, monthIndex) => {
          const monthDate = buildMonthDate(currentYear, monthIndex);
          const monthKey = toMonthKey(monthDate);
          const isSelected = monthKey === selectedMonthKey;
          const isDisabled =
            (minMonthKey !== null && monthKey < minMonthKey) ||
            (maxMonthKey !== null && monthKey > maxMonthKey);

          return (
            <button
              key={monthLabel}
              type="button"
              onClick={() => !isDisabled && onMonthSelect(monthDate)}
              disabled={isDisabled}
              className={`rounded-lg px-3 py-2 text-sm transition-colors ${
                isDisabled
                  ? 'cursor-not-allowed text-gray-300'
                  : isSelected
                    ? 'bg-green-500 text-white'
                    : 'text-gray-700 hover:bg-gray-100'
              }`}
              aria-label={`Выбрать ${monthLabel}`}
            >
              {monthLabel}
            </button>
          );
        })}
      </div>
    </div>
  );
};

export default WorkoutProgressMonthPicker;
