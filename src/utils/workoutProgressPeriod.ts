export interface WorkoutProgressMonthPeriod {
  anchorDate: string;
  from: string;
  to: string;
}

export type WorkoutProgressQuickPeriod = 'day' | 'week' | 'month' | 'year';

export interface WorkoutProgressPeriodRange {
  anchorDate: string;
  from: string;
  to: string;
  dayCount: number;
}

function pad2(value: number): string {
  return String(value).padStart(2, '0');
}

function formatDayKey(date: Date): string {
  return `${date.getFullYear()}-${pad2(date.getMonth() + 1)}-${pad2(date.getDate())}`;
}

function parseDayKey(dayKey: string): Date {
  const [year, month, day] = dayKey.split('-').map(Number);
  return new Date(year, month - 1, day);
}

function addDays(dayKey: string, amount: number): string {
  const date = parseDayKey(dayKey);
  date.setDate(date.getDate() + amount);
  return formatDayKey(date);
}

function formatDateLabel(dayKey: string): string {
  return new Intl.DateTimeFormat('ru-RU', {
    day: 'numeric',
    month: 'long',
  }).format(parseDayKey(dayKey));
}

function formatFullDateLabel(dayKey: string): string {
  return new Intl.DateTimeFormat('ru-RU', {
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  }).format(parseDayKey(dayKey));
}

function daysInMonth(year: number, monthIndex: number): number {
  return new Date(year, monthIndex + 1, 0).getDate();
}

export function getWorkoutProgressMonthPeriod(anchorDate: string): WorkoutProgressMonthPeriod {
  const [year, month] = anchorDate.split('-').map(Number);
  const monthIndex = month - 1;
  return {
    anchorDate,
    from: `${year}-${pad2(month)}-01`,
    to: `${year}-${pad2(month)}-${pad2(daysInMonth(year, monthIndex))}`,
  };
}

export function getWorkoutProgressPeriod(
  anchorDate: string,
  period: WorkoutProgressQuickPeriod,
): WorkoutProgressPeriodRange {
  if (period === 'day') {
    return {
      anchorDate,
      from: anchorDate,
      to: anchorDate,
      dayCount: 1,
    };
  }

  if (period === 'week') {
    return {
      anchorDate,
      from: addDays(anchorDate, -6),
      to: anchorDate,
      dayCount: 7,
    };
  }

  if (period === 'year') {
    return {
      anchorDate,
      from: addDays(anchorDate, -364),
      to: anchorDate,
      dayCount: 365,
    };
  }

  return {
    anchorDate,
    from: addDays(anchorDate, -29),
    to: anchorDate,
    dayCount: 30,
  };
}

export function formatWorkoutProgressPeriodLabel(
  anchorDate: string,
  period: WorkoutProgressQuickPeriod,
): string {
  const range = getWorkoutProgressPeriod(anchorDate, period);

  if (period === 'day') {
    return formatDateLabel(anchorDate);
  }

  if (period === 'year') {
    return `${formatFullDateLabel(range.from)} — ${formatFullDateLabel(range.to)}`;
  }

  return `${formatDateLabel(range.from)} — ${formatDateLabel(range.to)}`;
}

export function formatWorkoutProgressMonthLabel(anchorDate: string): string {
  const [year, month] = anchorDate.split('-').map(Number);
  const months = [
    'январь',
    'февраль',
    'март',
    'апрель',
    'май',
    'июнь',
    'июль',
    'август',
    'сентябрь',
    'октябрь',
    'ноябрь',
    'декабрь',
  ];

  return `${months[month - 1]} ${year}`;
}

export function applyWorkoutProgressMonthSelection(date: string): {
  selectedMonthDate: string;
  isCalendarOpen: false;
} {
  const [year, month] = date.split('-').map(Number);
  return {
    selectedMonthDate: `${year}-${pad2(month)}-01`,
    isCalendarOpen: false,
  };
}
